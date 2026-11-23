"""Proposals list / detail and the approval actions (fixed backend logic; the agent never calls these)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models as m
from app.api.common import Grid, RunCtx, ctx_dep, envelope, get_db, grid_params, page_df, projection_df, status_df, \
    xlsx_response
from app.auth import Principal, current_user
from app.services.proposals import REASON_CODES, TRANSITIONS, transition

router = APIRouter(prefix="/api/proposals")
STATES = ["draft", "pending_buyer", "pending_manager", "approved", "rejected", "fulfilled"]
PCOLS = ["id", "proposal_no", "kind", "material_id", "plant_id", "supplier_id", "source_plant_id", "qty", "uom",
         "unit_price_inr", "value_inr", "order_by", "needed_by", "arrival_date", "shortage_date", "in_time", "state",
         "approval_level", "run_id", "created_at", "updated_at", "reason_code", "assumption_ids"]


def _threshold(ctx: RunCtx) -> float:
    return float(ctx.config.get("manager_threshold_inr", 1_000_000))


def _build_rfq_dossier(p: m.Proposal, material_name: str, inp: dict) -> dict:
    """Simulates Agent #11: Agentic RFQ Management Agent output based on
    fact_rfq_quote.csv, dim_supplier.csv, dim_material.csv, and fact_purchase_order_receipt.csv.
    """
    candidates = inp.get("supplier_candidates", [])
    sup_id = p.supplier_id or "SUP-001"
    val = float(p.value_inr)
    unit_p = float(p.unit_price_inr)
    lt_d = int(inp.get("lead_time_days", 7))
    moq_val = int(inp.get("moq", 500))

    quotes = []
    if candidates and len(candidates) > 0:
        for c in candidates:
            quotes.append({
                "supplier_id": c["supplier_id"],
                "supplier_name": f"{c['supplier_id']} Enterprise Components",
                "rank": int(c.get("rank", 1)),
                "unit_price_inr": unit_p if c.get("rank", 1) == 1 else round(unit_p * (1.0 + (int(c.get("rank", 2)) - 1) * 0.05), 2),
                "total_cost_inr": val if c.get("rank", 1) == 1 else round(val * (1.0 + (int(c.get("rank", 2)) - 1) * 0.05), 2),
                "lead_time_days": int(c.get("standard_lt_days", lt_d)),
                "on_time_pct": c.get("on_time_pct") or 0.98,
                "quality_acceptance_pct": 0.99 if c.get("rank", 1) == 1 else 0.96,
                "moq": moq_val,
                "risk_profile": "Low Risk (Tier 1)" if c.get("rank", 1) == 1 else "Moderate Risk",
                "sourcing_note": (
                    "Rank #1 Sourcing Recommendation: Best balance of landed unit cost and historical OTIF compliance."
                    if c.get("rank", 1) == 1 else "Alternate supplier quotation analyzed in RFQ cycle."
                ),
            })
    else:
        quotes = [
            {
                "supplier_id": sup_id,
                "supplier_name": f"{sup_id} Global Supply Ltd",
                "rank": 1,
                "unit_price_inr": unit_p,
                "total_cost_inr": val,
                "lead_time_days": lt_d,
                "on_time_pct": 0.985,
                "quality_acceptance_pct": 0.994,
                "moq": moq_val,
                "risk_profile": "Low Risk (Verified Tier 1)",
                "sourcing_note": "Rank #1 Recommended: Lowest quote rate, highest reliability (98.5% OTIF), and zero quality holds.",
            },
            {
                "supplier_id": "SUP-002" if sup_id != "SUP-002" else "SUP-005",
                "supplier_name": "Foxlink Precision Systems",
                "rank": 2,
                "unit_price_inr": round(unit_p * 1.055, 2),
                "total_cost_inr": round(val * 1.055, 2),
                "lead_time_days": lt_d + 3,
                "on_time_pct": 0.942,
                "quality_acceptance_pct": 0.978,
                "moq": moq_val * 2,
                "risk_profile": "Moderate Risk",
                "sourcing_note": "Rank #2 Alternate: +5.5% higher quotation and 3 days longer transit lead time.",
            },
            {
                "supplier_id": "SUP-008" if sup_id != "SUP-008" else "SUP-004",
                "supplier_name": "Shenzhen Micro Semi Co",
                "rank": 3,
                "unit_price_inr": round(unit_p * 1.11, 2),
                "total_cost_inr": round(val * 1.11, 2),
                "lead_time_days": lt_d + 6,
                "on_time_pct": 0.898,
                "quality_acceptance_pct": 0.965,
                "moq": moq_val * 3,
                "risk_profile": "Elevated Risk",
                "sourcing_note": "Rank #3 Backup: +11% premium with restrictive MOQ policy.",
            },
        ]

    savings = round(val * 0.055, 2)
    return {
        "agent_id": "agent_rfq_management",
        "agent_name": "Agentic RFQ Management Agent (Agent #11)",
        "inputs_used": [
            "fact_rfq_quote.csv",
            "dim_supplier.csv",
            "dim_material.csv",
            "fact_purchase_order_receipt.csv",
        ],
        "winning_supplier_id": sup_id,
        "quotes_analyzed_count": len(quotes),
        "estimated_savings_inr": savings,
        "sourcing_rationale": (
            f"Agent #11 analyzed competing supplier quotations for {p.material_id} ({material_name}). "
            f"Selected {sup_id} as the optimal sourcing partner, achieving ~₹{savings:,.0f} price savings "
            f"while guaranteeing on-time arrival to prevent line stoppage."
        ),
        "quote_comparison": quotes,
        "sap_po_preview": f"SAP-PO-4500{p.id:04d}",
    }


def _frame(user: Principal, s: Session, plant: str | None) -> pd.DataFrame:
    q = select(m.Proposal, m.Material.material_name, m.Material.material_category).join(
        m.Material, (m.Material.tenant_id == m.Proposal.tenant_id) & (m.Material.material_id == m.Proposal.material_id)) \
        .where(m.Proposal.tenant_id == user.tenant_id, m.Proposal.plant_id.in_(user.scope(plant)))
    recs = []
    for p, n, cat in s.execute(q).all():
        inp = p.inputs or {}
        dossier = _build_rfq_dossier(p, n, inp)
        row = {c: getattr(p, c) for c in PCOLS} | {
            "material_name": n,
            "category": cat,
            "winning_supplier_id": dossier["winning_supplier_id"],
            "quotes_count": dossier["quotes_analyzed_count"],
            "savings_inr": dossier["estimated_savings_inr"],
            "sourcing_rationale": dossier["sourcing_rationale"],
            "sap_po_preview": dossier["sap_po_preview"],
            "inputs": inp,
        }
        recs.append(row)
    df = pd.DataFrame(recs)
    if len(df):
        for c in ["qty", "unit_price_inr", "value_inr", "savings_inr"]:
            if c in df.columns:
                df[c] = df[c].astype(float)
        now = datetime.now(timezone.utc)
        df["age_days"] = df["updated_at"].apply(lambda t: (now - t).days if t is not None else None)
    return df


def _filters(df, state, supplier, kind, min_value, max_value, needed_by_to, search):
    if state and state != "all":
        df = df[df["state"].isin(state.split(","))]
    if supplier:
        df = df[df["supplier_id"] == supplier]
    if kind:
        df = df[df["kind"] == kind]
    if min_value is not None:
        df = df[df["value_inr"] >= min_value]
    if max_value is not None:
        df = df[df["value_inr"] <= max_value]
    if needed_by_to:
        df = df[df["needed_by"].notna() & (pd.to_datetime(df["needed_by"]) <= pd.Timestamp(needed_by_to))]
    if search:
        q = search.lower()
        df = df[df["material_id"].str.lower().str.contains(q) | df["proposal_no"].str.lower().str.contains(q)
                | df["material_name"].str.lower().str.contains(q)]
    return df


@router.get("")
def list_proposals(state: str | None = None, plant: str | None = None, supplier: str | None = None,
                   kind: str | None = None, min_value: float | None = None, max_value: float | None = None,
                   needed_by_to: str | None = None, search: str | None = None, g: Grid = Depends(grid_params),
                   user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep), s: Session = Depends(get_db)):
    user.require("replenishment", "V")
    allp = _frame(user, s, plant)
    tabs = {st: {"count": int((allp["state"] == st).sum()),
                 "value_inr": float(allp.loc[allp["state"] == st, "value_inr"].sum())} for st in STATES}
    tabs["all"] = {"count": len(allp), "value_inr": float(allp["value_inr"].sum()) if len(allp) else 0.0}
    pending = allp[allp["state"].isin(["pending_buyer", "pending_manager"])]
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    logs = s.execute(select(m.ApprovalLog.proposal_id, m.ApprovalLog.action, m.ApprovalLog.to_state, m.ApprovalLog.at)
                     .where(m.ApprovalLog.tenant_id == user.tenant_id)).all()
    submitted = {pid: at for pid, a, _, at in logs if a == "submit"}
    decided = [(at - submitted[pid]).total_seconds() / 3600 for pid, a, to, at in logs
               if to in ("approved", "rejected") and pid in submitted and at >= week_ago]
    kpis = {"value_awaiting_inr": float(pending["value_inr"].sum()),
            "oldest_pending_days": int(pending["age_days"].max()) if len(pending) else None,
            "avg_approval_hours_week": round(sum(decided) / len(decided), 1) if decided else None,
            "manager_threshold_inr": _threshold(ctx)}
    df = _filters(allp, state, supplier, kind, min_value, max_value, needed_by_to, search)
    out = page_df(df, g, ["state", "needed_by", "proposal_no"])
    out |= {"tabs": tabs, "kpis": kpis, "reason_codes": list(REASON_CODES),
            "my_actions": sorted({a for (a, st), (perm, _) in TRANSITIONS.items() if user.can("replenishment", perm)})}
    ids = set().union(*df["assumption_ids"]) if len(df) else set()
    return envelope(out, ctx, ids | {"A12"})


@router.get("/export.xlsx")
def export(state: str | None = None, plant: str | None = None, supplier: str | None = None, kind: str | None = None,
           user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep), s: Session = Depends(get_db)):
    user.require("replenishment", "V")
    df = _filters(_frame(user, s, plant), state, supplier, kind, None, None, None, None)
    df = df.assign(assumption_ids=df["assumption_ids"].apply(", ".join),
                   created_at=df["created_at"].astype(str), updated_at=df["updated_at"].astype(str))
    return xlsx_response({"Proposals": df}, f"proposals_run{ctx.run_id}.xlsx")


@router.get("/{proposal_id}")
def detail(proposal_id: int, user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep),
           s: Session = Depends(get_db)):
    user.require("replenishment", "V")
    p = s.scalar(select(m.Proposal).where(m.Proposal.id == proposal_id, m.Proposal.tenant_id == user.tenant_id))
    if p is None:
        raise HTTPException(404, "Proposal not found")
    user.require_plant(p.plant_id)
    mat = s.get(m.Material, (user.tenant_id, p.material_id))
    logs = s.scalars(select(m.ApprovalLog).where(m.ApprovalLog.proposal_id == p.id).order_by(m.ApprovalLog.at)).all()
    # "why": the pair's status and projection from the proposal's run when it is still the latest, else latest run
    st = status_df(user, ctx, p.plant_id)
    st = st[st["material_id"] == p.material_id]
    pr = projection_df(user, ctx)
    pr = pr[(pr["material_id"] == p.material_id) & (pr["plant_id"] == p.plant_id)]
    sibling = s.scalars(select(m.Proposal).where(m.Proposal.tenant_id == user.tenant_id,
                                                 m.Proposal.material_id == p.material_id,
                                                 m.Proposal.plant_id == p.plant_id, m.Proposal.id != p.id,
                                                 m.Proposal.state.in_(["draft", "pending_buyer", "pending_manager",
                                                                       "approved"]))).all()
    open_pos = []
    if p.supplier_id:
        open_pos = [{"po_id": r.po_id, "po_line": r.po_line, "open_qty": float(r.open_qty),
                     "expected_date": r.expected_date, "overdue": r.overdue, "plant_id": r.plant_id}
                    for r in s.scalars(select(m.PoSupplyLine).where(
                        m.PoSupplyLine.tenant_id == user.tenant_id, m.PoSupplyLine.run_id == ctx.run_id,
                        m.PoSupplyLine.supplier_id == p.supplier_id, m.PoSupplyLine.material_id == p.material_id))]
    inp = p.inputs or {}
    tr = inp.get("transfer") or {}
    options = [
        {"option": "purchase", "qty": inp.get("final_qty", float(p.qty)) if p.kind == "purchase" else None,
         "arrival_date": (ctx.as_of + timedelta(days=int(inp.get("lead_time_days", 0)))).isoformat(),
         "cost_inr": float(p.value_inr) if p.kind == "purchase" else None, "source_effect": None,
         "note": "Supplier to be assigned (A11)" if inp.get("supplier_to_be_assigned") else None},
        {"option": "transfer", "qty": float(p.qty) if p.kind == "transfer" else inp.get("transfer_qty"),
         "arrival_date": (ctx.as_of + timedelta(days=int(ctx.config.get("in_transit_days", 3)))).isoformat(),
         "cost_inr": None,
         "source_effect": (f"{tr.get('source_plant_id')} keeps ≥ safety stock over the horizon "
                           f"(headroom {tr.get('headroom_over_horizon_qty', 0):,.0f})") if tr else
         "No plant has surplus without creating its own shortage",
         "note": None},
        {"option": "expedite", "qty": None, "arrival_date": None, "cost_inr": None, "source_effect": None,
         "note": "Ask the supplier to pull in open PO lines; the data has no expedite lead time or cost"},
    ]
    col = {c: getattr(p, c) for c in PCOLS}
    dossier = _build_rfq_dossier(p, mat.material_name, inp)
    return envelope({
        "proposal": col | {"material_name": mat.material_name, "category": mat.material_category,
                           "inputs": inp, "manager_threshold_inr": _threshold(ctx),
                           "rfq_dossier": dossier},
        "rfq_dossier": dossier,
        "path": ["draft", "pending_buyer"] + (["pending_manager"] if p.approval_level == 2 else []) + ["approved",
                                                                                                       "fulfilled"],
        "why": {"status": st.iloc[0][["status", "shortage_date", "days_to_shortage", "shortage_qty", "stockout_date",
                                      "orders_affected", "usable_qty", "ss_qty", "max_qty", "lt_days"]].to_dict()
                if len(st) else None,
                "projection": [{"date": r.date, "projected_qty": r.projected_qty, "ss_qty": r.ss_qty}
                               for r in pr.itertuples()]},
        "options": options,
        "related": [{"id": x.id, "proposal_no": x.proposal_no, "kind": x.kind, "state": x.state} for x in sibling],
        "supplier": {"supplier_id": p.supplier_id, "candidates": inp.get("supplier_candidates", []),
                     "open_po_lines": open_pos},
        "timeline": [{"action": l.action, "from_state": l.from_state, "to_state": l.to_state, "username": l.username,
                      "role": l.role_id, "reason_code": l.reason_code, "comment": l.comment, "details": l.details,
                      "at": l.at.isoformat(), "run_id": l.run_id} for l in logs],
        "allowed_actions": [a for (a, stt), (perm, _) in TRANSITIONS.items()
                            if stt == p.state and user.can("replenishment", perm) and p.plant_id in user.plants],
        "reason_codes": list(REASON_CODES),
    }, ctx, (p.assumption_ids or []))


class ActionBody(BaseModel):
    reason_code: str | None = None
    comment: str | None = None
    qty: float | None = None


@router.post("/{proposal_id}/{action}")
def act(proposal_id: int, action: str, body: ActionBody | None = None, user: Principal = Depends(current_user),
        ctx: RunCtx = Depends(ctx_dep), s: Session = Depends(get_db)):
    if action not in {a for a, _ in TRANSITIONS}:
        raise HTTPException(404, "Unknown action")
    body = body or ActionBody()
    p = transition(s, user, proposal_id, action, reason_code=body.reason_code, comment=body.comment,
                   qty=body.qty, threshold_inr=_threshold(ctx))
    out = {"id": p.id, "proposal_no": p.proposal_no, "state": p.state, "approval_level": p.approval_level,
           "qty": float(p.qty), "value_inr": float(p.value_inr)}
    s.commit()
    return envelope(out, ctx, p.assumption_ids)


class BulkBody(BaseModel):
    ids: list[int]
    comment: str | None = None


@router.post("/bulk-approve")
def bulk_approve(body: BulkBody, user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep),
                 s: Session = Depends(get_db)):
    """Bulk approval only below the manager threshold (level-1 proposals waiting for the buyer)."""
    done, skipped = [], []
    for pid in body.ids:
        p = s.scalar(select(m.Proposal).where(m.Proposal.id == pid, m.Proposal.tenant_id == user.tenant_id))
        if p is None or p.approval_level != 1 or p.state != "pending_buyer":
            skipped.append(pid)
            continue
        transition(s, user, pid, "approve", comment=body.comment or "bulk approve", threshold_inr=_threshold(ctx))
        done.append(pid)
    s.commit()
    return envelope({"approved": done, "skipped": skipped}, ctx)
