"""The 12 agent tools. Each validates its arguments (pydantic), reads engine output only (never model-written SQL),
and returns compact JSON: top-N rows with short keys + totals, the assumption ids used, and citable items.

Tenant and plant scope come from the signed-in user (never from tool arguments). The agent's own queries run in a
READ ONLY transaction; the agent has no tool that writes.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

import pandas as pd
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.api.common import RunCtx, projection_df, status_df
from app.auth import Principal
from app.engine.kpis import demand_kpis
from app.engine.simulate import simulate_supplier_delay

TOP = 8


@dataclass
class ToolCtx:
    user: Principal
    ctx: RunCtx
    s: Session  # read-only transaction

    def plants(self, plant: str | None) -> list[str]:
        return self.user.scope(plant)


@dataclass
class ToolResult:
    data: dict
    assumption_ids: set[str] = field(default_factory=set)
    scenario: bool = False
    cites: list[dict] = field(default_factory=list)

    def compact(self) -> dict:
        return {"data": self.data, "assumptions": sorted(self.assumption_ids, key=lambda x: int(x[1:])),
                "scenario": self.scenario}


def _d(v) -> str | None:
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NaT:
        return None
    return pd.Timestamp(v).date().isoformat()


def _r(v, n=0):
    return None if v is None or pd.isna(v) else (round(float(v), n) if n else int(round(float(v))))


def _mat_cite(mat: str, plant: str) -> dict:
    return {"type": "material", "id": f"{mat}@{plant}", "label": f"{mat} @ {plant}", "url": f"/material/{mat}?plant={plant}"}


def _prop_cite(pid: int, no: str) -> dict:
    return {"type": "proposal", "id": str(pid), "label": no, "url": f"/proposals/{pid}"}


def _ids(df: pd.DataFrame) -> set[str]:
    return set().union(*df["assumption_ids"]) if len(df) else set()


# ---------------- argument schemas ----------------
class NoArgs(BaseModel):
    model_config = {"extra": "forbid"}


class PlantArg(NoArgs):
    plant: str | None = Field(None, description="IN-TN-01 or IN-KA-01; omit for all your plants")


class StockArgs(PlantArg):
    material_id: str = Field(..., description="e.g. MAT-SOC-001")


class HorizonArgs(PlantArg):
    days: int = Field(30, ge=1, le=60)
    status: str | None = Field(None, description="critical | at_risk | omit for both")


class RankArgs(PlantArg):
    top: int = Field(10, ge=1, le=36)


class ExpiryArgs(PlantArg):
    days: int = Field(30, ge=1, le=365)


class PairArgs(BaseModel):
    model_config = {"extra": "forbid"}
    material_id: str
    plant: str


class SimArgs(PlantArg):
    supplier_id: str | None = Field(None, description="e.g. SUP-006; omit to test every supplier")
    delay_days: int = Field(7, ge=1, le=60)


class ProposalArgs(NoArgs):
    proposal_no: str | None = Field(None, description="e.g. PR-0016-013; omit for proposals waiting for approval")


SOURCE_LABEL = {"scenario": "planning scenario", "production_orders": "your production orders (incl. overdue backlog)"}


def _other_source(t: ToolCtx, plant: str | None) -> tuple[dict | None, set[str]]:
    """The non-default demand source's counts (D31/D33), so answers can state both without a toggle."""
    avail = (t.ctx.kpis.get("by_source") or {}).keys()
    other = next((x for x in avail if x != t.ctx.demand_source), None)
    if other is None:
        return None, set()
    o = status_df(t.user, t.ctx, plant, other)
    k = demand_kpis(o)
    m_ = k["demand_multiple"] or {}
    return ({"source": other, "label": SOURCE_LABEL[other],
             "status_counts": {x: int((o["status"] == x).sum()) for x in ("critical", "at_risk", "excess", "healthy", "stale")},
             "short_pairs": k["short_pairs"], "pairs_with_demand": k["pairs_with_demand"],
             "requirement_vs_usable_median": m_.get("median"), "requirement_vs_usable_min": m_.get("min"),
             "requirement_vs_usable_max": m_.get("max"), "used_for_proposals": False},
            {"A21"} if other == "production_orders" else {"A15"})


# ---------------- tools ----------------
def get_daily_brief(t: ToolCtx, a: NoArgs) -> ToolResult:
    b = t.s.scalar(select(m.DailyBrief).where(m.DailyBrief.tenant_id == t.user.tenant_id)
                   .order_by(m.DailyBrief.id.desc()).limit(1))
    if b is None:
        return ToolResult({"brief": None})
    f = b.facts
    keep = ["as_of", "data_age_days", "stale", "inventory_health_pct", "status_counts", "critical_count",
            "production_orders_at_risk", "production_orders_at_risk_14d", "excess_value_inr", "expiring_30d_value_inr",
            "overdue_po_lines", "open_po_lines", "proposals", "dq_issues", "other_source"]
    return ToolResult({"run": b.run_id, "kind": b.kind, **{k: f.get(k) for k in keep},
                       "top_critical": f.get("critical", [])[:3]},
                      {"A1", "A10", "A13", "A14", "A15", "A19", "A20"}, True,
                      [_mat_cite(c["material_id"], c["plant_id"]) for c in f.get("critical", [])[:3]])


def get_inventory_overview(t: ToolCtx, a: PlantArg) -> ToolResult:
    df = status_df(t.user, t.ctx, a.plant)
    oth, oth_ids = _other_source(t, a.plant)
    basis = df[df["has_demand_basis"]]
    ex = df[df["status"] == "excess"]
    by_plant = t.ctx.kpis.get("production_orders_at_risk_by_plant", {})
    pend = t.s.execute(select(m.Proposal.state, m.Proposal.value_inr).where(
        m.Proposal.tenant_id == t.user.tenant_id, m.Proposal.plant_id.in_(t.plants(a.plant)),
        m.Proposal.state.in_(["pending_buyer", "pending_manager"]))).all()
    return ToolResult({
        "plants": t.plants(a.plant), "pairs": int(len(df)),
        "status_counts": {k: int((df["status"] == k).sum()) for k in ("critical", "at_risk", "excess", "healthy", "stale")},
        "health_pct": round(100 * (basis["status"] == "healthy").mean(), 1) if len(basis) else None,
        "on_hand_value_inr": _r(df["on_hand_value_inr"].sum()), "usable_value_inr": _r(df["usable_value_inr"].sum()),
        "critical_in_7d": int(((df["status"] == "critical") & (df["days_to_shortage"] <= 7)).sum()),
        "orders_at_risk": int(sum(by_plant.get(p, 0) for p in t.plants(a.plant))),
        "excess_value_inr": _r(((ex["usable_qty"] - ex["max_qty"]).clip(lower=0) * ex["standard_price_inr"]).sum()),
        "pending_approvals": len(pend), "pending_value_inr": _r(sum(float(v) for _, v in pend)),
        "overdue_po_lines": int(df["overdue_po_lines"].fillna(0).sum()),
        "demand_source": t.ctx.demand_source, "other_source": oth,
    }, _ids(df) | oth_ids, True)


def get_stock_position(t: ToolCtx, a: StockArgs) -> ToolResult:
    df = status_df(t.user, t.ctx, a.plant)
    df = df[df["material_id"] == a.material_id.upper()]
    rows = [{"plant": r.plant_id, "uom": r.uom, "status": r.status, "on_hand": _r(r.on_hand_qty),
             "allocated": _r(r.allocated_qty), "blocked": _r(r.blocked_qty), "qc_hold": _r(r.quality_hold_qty),
             "usable": _r(r.usable_qty), "in_transit": _r(r.in_transit_qty), "ss": _r(r.ss_qty), "max": _r(r.max_qty),
             "days_cover": _r(r.days_of_cover, 1), "shortage_date": _d(r.shortage_date),
             "stockout_date": _d(r.stockout_date), "lt_days": int(r.lt_days), "lt_source": r.lt_source,
             "open_po_qty": _r(r.open_po_qty), "usable_value_inr": _r(r.usable_value_inr)} for r in df.itertuples()]
    return ToolResult({"material": a.material_id.upper(), "name": df["material_name"].iloc[0] if len(df) else None,
                       "rows": rows}, _ids(df), True, [_mat_cite(r.material_id, r.plant_id) for r in df.itertuples()])


def _short_rows(df: pd.DataFrame) -> list[dict]:
    return [{"material": r.material_id, "plant": r.plant_id, "status": r.status, "uom": r.uom,
             "usable": _r(r.usable_qty), "ss": _r(r.ss_qty), "shortage_date": _d(r.shortage_date),
             "days": _r(r.days_to_shortage), "short_qty": _r(r.shortage_qty), "stockout_date": _d(r.stockout_date),
             "orders_affected": int(r.orders_affected), "lt_days": int(r.lt_days)} for r in df.itertuples()]


def get_shortage_horizon(t: ToolCtx, a: HorizonArgs) -> ToolResult:
    df = status_df(t.user, t.ctx, a.plant)
    oth, oth_ids = _other_source(t, a.plant)
    if a.status and a.status.lower() not in ("all", "both", "any", "*", "none"):
        st = [s.strip().lower() for s in a.status.split(",") if s.strip()]
    else:
        st = ["critical", "at_risk"]
    df = df[df["status"].isin(st) & (df["days_to_shortage"] <= a.days)].sort_values(["days_to_shortage", "material_id"])
    return ToolResult({"days": a.days, "count": int(len(df)),
                       "by_status": df["status"].value_counts().to_dict(),
                       "with_stockout": int(df["stockout_date"].notna().sum()),
                       "rows": _short_rows(df.head(TOP)), "more": max(0, len(df) - TOP),
                       "demand_source": t.ctx.demand_source, "other_source": oth},
                      _ids(df) | {"A14"} | oth_ids, True, [_mat_cite(r.material_id, r.plant_id) for r in df.head(TOP).itertuples()])


def get_material_risk_ranking(t: ToolCtx, a: RankArgs) -> ToolResult:
    df = status_df(t.user, t.ctx, a.plant)
    df = df[df["status"].isin(["critical", "at_risk"])].copy()
    df["rank_key"] = df["status"].map({"critical": 0, "at_risk": 1})
    df = df.sort_values(["rank_key", "days_to_shortage", "orders_affected"], ascending=[True, True, False]).head(a.top)
    return ToolResult({"rows": _short_rows(df)}, _ids(df), True,
                      [_mat_cite(r.material_id, r.plant_id) for r in df.itertuples()])


def get_excess_inventory(t: ToolCtx, a: PlantArg) -> ToolResult:
    df = status_df(t.user, t.ctx, a.plant)
    ex = df[df["status"] == "excess"].copy()
    ex["excess_qty"] = (ex["usable_qty"] - ex["max_qty"]).clip(lower=0)
    ex["excess_value_inr"] = ex["excess_qty"] * ex["standard_price_inr"]
    above_ss = df[df["has_demand_basis"] & df["shortage_date"].isna()]
    stale = df[~df["has_demand_basis"]]
    return ToolResult({
        "excess_value_inr": _r(ex["excess_value_inr"].sum()), "excess_pairs": int(len(ex)),
        "rows": [{"material": r.material_id, "plant": r.plant_id, "uom": r.uom, "usable": _r(r.usable_qty),
                  "max": _r(r.max_qty), "excess_qty": _r(r.excess_qty), "excess_value_inr": _r(r.excess_value_inr),
                  "days_cover": _r(r.days_of_cover, 1)} for r in ex.sort_values("excess_value_inr", ascending=False).itertuples()],
        "no_demand_basis_value_inr": _r(stale["usable_value_inr"].sum()),
        "no_demand_basis": [{"material": r.material_id, "plant": r.plant_id, "usable_value_inr": _r(r.usable_value_inr)}
                            for r in stale.itertuples()],
        "healthy_pairs_without_shortage": int(len(above_ss)),
    }, {"A14", "A15", "A17"}, True, [_mat_cite(r.material_id, r.plant_id) for r in ex.itertuples()])


def get_expiring_lots(t: ToolCtx, a: ExpiryArgs) -> ToolResult:
    from app.api.routes_inventory import _tenant_frames
    loc = _tenant_frames(t.s, t.user.tenant_id, t.ctx)["loc"]
    loc = loc[loc["plant_id"].isin(t.plants(a.plant)) & loc["expiry_date"].notna()].copy()
    loc["days_to_expiry"] = (pd.to_datetime(loc["expiry_date"]) - pd.Timestamp(t.ctx.as_of)).dt.days
    loc["usable"] = (loc["on_hand_qty"].astype(float) - loc[["allocated_qty", "blocked_qty", "quality_hold_qty"]]
                     .astype(float).sum(axis=1)).clip(lower=0)
    loc["value_inr"] = loc["usable"] * loc["unit_cost_inr"].astype(float)
    within = loc[loc["days_to_expiry"] <= a.days]
    return ToolResult({"days": a.days, "expiring_count": int(len(within)), "expiring_value_inr": _r(within["value_inr"].sum()),
                       "lots_with_expiry": [{"material": r.material_id, "plant": r.plant_id, "lot": r.lot_id,
                                             "expiry": _d(r.expiry_date), "days_to_expiry": int(r.days_to_expiry),
                                             "value_inr": _r(r.value_inr)} for r in loc.sort_values("days_to_expiry").head(TOP).itertuples()],
                       "lots_with_expiry_total": int(len(loc)),
                       "note": "Only consumables carry expiry dates; they have no demand basis (A13, A17)."},
                      {"A13", "A17"}, False,
                      [_mat_cite(r.material_id, r.plant_id) for r in loc.drop_duplicates(["material_id", "plant_id"]).itertuples()])


def _proposal_brief(p: m.Proposal) -> dict:
    i = p.inputs or {}
    return {"id": p.id, "no": p.proposal_no, "kind": p.kind, "material": p.material_id, "plant": p.plant_id,
            "state": p.state, "qty": _r(p.qty), "uom": p.uom, "value_inr": _r(p.value_inr), "level": p.approval_level,
            "supplier": p.supplier_id, "source_plant": p.source_plant_id, "needed_by": _d(p.needed_by),
            "arrival": _d(p.arrival_date), "in_time": p.in_time,
            "calc": {k: (_r(i[k]) if isinstance(i.get(k), (int, float)) and not isinstance(i.get(k), bool) else i.get(k))
                     for k in ("target_qty", "projected_at_arrival_qty", "gap_qty", "transfer_qty", "raw_qty",
                               "moq_qty", "moq_applied", "lead_time_days", "lead_time_source", "daily_demand_qty",
                               "safety_stock_qty", "max_qty") if k in i}}


def get_replenishment_options(t: ToolCtx, a: PairArgs) -> ToolResult:
    t.user.require_plant(a.plant)
    ps = t.s.scalars(select(m.Proposal).where(m.Proposal.tenant_id == t.user.tenant_id,
                                              m.Proposal.material_id == a.material_id.upper(), m.Proposal.plant_id == a.plant,
                                              m.Proposal.state.in_(["draft", "pending_buyer", "pending_manager", "approved"]))
                     .order_by(m.Proposal.kind)).all()
    cands = (ps[0].inputs or {}).get("supplier_candidates", []) if ps else []
    for p in ps:
        cands = cands or (p.inputs or {}).get("supplier_candidates", [])
    return ToolResult({"material": a.material_id.upper(), "plant": a.plant, "proposals": [_proposal_brief(p) for p in ps],
                       "supplier_candidates": cands,
                       "rule": "transfer first; target = min(SS + daily demand x (LT + review), max); qty = target - projected at arrival; round up to MOQ"},
                      set().union(*[set(p.assumption_ids) for p in ps]) | {"A11", "A12", "A20"}, True,
                      [_prop_cite(p.id, p.proposal_no) for p in ps] + [_mat_cite(a.material_id.upper(), a.plant)])


def get_transfer_options(t: ToolCtx, a: PairArgs) -> ToolResult:
    t.user.require_plant(a.plant)
    df = status_df(t.user, t.ctx)
    mat = df[df["material_id"] == a.material_id.upper()]
    pr = projection_df(t.user, t.ctx)
    rows = []
    for r in mat[mat["plant_id"] != a.plant].itertuples():
        g = pr[(pr["material_id"] == r.material_id) & (pr["plant_id"] == r.plant_id)]
        headroom = float((g["projected_qty"] - g["ss_qty"]).min()) if len(g) else 0.0
        ok = r.status in ("healthy", "excess")
        rows.append({"source": r.plant_id, "source_status": r.status, "usable": _r(r.usable_qty), "ss": _r(r.ss_qty),
                     "headroom_over_horizon": _r(headroom),
                     "eligible": ok, "why": "source never drops below its SS" if ok else "source has its own shortage"})
    tr = t.s.scalars(select(m.Proposal).where(m.Proposal.tenant_id == t.user.tenant_id, m.Proposal.kind == "transfer",
                                              m.Proposal.material_id == a.material_id.upper(), m.Proposal.plant_id == a.plant)
                     .order_by(m.Proposal.id.desc()).limit(1)).all()
    return ToolResult({"material": a.material_id.upper(), "to_plant": a.plant, "sources": rows,
                       "transfer_proposal": _proposal_brief(tr[0]) if tr else None},
                      {"A7", "A14", "A15"}, True,
                      ([_prop_cite(tr[0].id, tr[0].proposal_no)] if tr else []) + [_mat_cite(a.material_id.upper(), a.plant)])


def simulate_shortage_impact(t: ToolCtx, a: SimArgs) -> ToolResult:
    from app.api.routes_inventory import _tenant_frames
    st = status_df(t.user, t.ctx, a.plant)
    pr = projection_df(t.user, t.ctx)
    pr = pr[pr["plant_id"].isin(t.plants(a.plant))]
    po = _tenant_frames(t.s, t.user.tenant_id, t.ctx)["po"]
    po = po[po["plant_id"].isin(t.plants(a.plant))].assign(open_qty=lambda d: d["open_qty"].astype(float))
    st = st.assign(shortage_date=pd.to_datetime(st["shortage_date"]), stockout_date=pd.to_datetime(st["stockout_date"]))
    sups = [a.supplier_id.upper()] if a.supplier_id else sorted(po["supplier_id"].unique())
    results = []
    for sup in sups:
        sim = simulate_supplier_delay(pr, st, po, sup, a.delay_days, t.ctx.as_of)
        far = pd.Timestamp("2100-01-01")
        same = lambda a, b: pd.to_datetime(sim[a]).fillna(far) == pd.to_datetime(sim[b]).fillna(far)  # noqa: E731
        worse = sim[(sim["new_status"] != sim["baseline_status"]) | ~same("new_shortage_date", "baseline_shortage_date")
                    | ~same("new_stockout_date", "baseline_stockout_date")]
        newly_critical = worse[(worse["new_status"] == "critical") & (worse["baseline_status"] != "critical")]
        new_stockouts = worse[worse["new_stockout_date"].notna() & worse["baseline_stockout_date"].isna()]
        results.append({"supplier": sup, "pairs_with_delayed_supply": int(len(sim)), "pairs_worse": int(len(worse)),
                        "newly_critical": int(len(newly_critical)), "new_stockouts": int(len(new_stockouts)),
                        "rows": [{"material": r.material_id, "plant": r.plant_id, "delayed_qty": _r(r.delayed_qty),
                                  "status": f"{r.baseline_status}->{r.new_status}",
                                  "shortage": f"{_d(r.baseline_shortage_date)}->{_d(r.new_shortage_date)}",
                                  "stockout": f"{_d(r.baseline_stockout_date)}->{_d(r.new_stockout_date)}"}
                                 for r in worse.head(5).itertuples()]})
    results.sort(key=lambda x: (-x["newly_critical"], -x["new_stockouts"], -x["pairs_worse"]))
    shown = results[:3] if not a.supplier_id else results
    cites = [_mat_cite(r["material"], r["plant"]) for x in shown for r in x["rows"][:3]]
    return ToolResult({"delay_days": a.delay_days, "suppliers_tested": len(results), "results": shown},
                      {"A8", "A9", "A10", "A15", "A19"}, True, cites)


def get_proposal_details(t: ToolCtx, a: ProposalArgs) -> ToolResult:
    q = select(m.Proposal).where(m.Proposal.tenant_id == t.user.tenant_id, m.Proposal.plant_id.in_(t.user.plants))
    if a.proposal_no:
        p = t.s.scalar(q.where(m.Proposal.proposal_no == a.proposal_no.upper()))
        if p is None:
            return ToolResult({"error": f"Proposal {a.proposal_no} not found"})
        logs = t.s.scalars(select(m.ApprovalLog).where(m.ApprovalLog.proposal_id == p.id).order_by(m.ApprovalLog.at)).all()
        return ToolResult({**_proposal_brief(p), "timeline": [{"action": l.action, "to": l.to_state, "by": l.username,
                                                               "reason": l.reason_code} for l in logs],
                           "candidates": (p.inputs or {}).get("supplier_candidates", [])[:3],
                           "threshold_inr": _r((p.inputs or {}).get("manager_threshold_inr"))},
                          set(p.assumption_ids), True, [_prop_cite(p.id, p.proposal_no)])
    mine = {"buyer": ["pending_buyer"], "procurement_manager": ["pending_manager"]}.get(
        t.user.role, ["pending_buyer", "pending_manager"])
    ps = t.s.scalars(q.where(m.Proposal.state.in_(mine)).order_by(m.Proposal.value_inr.desc())).all()
    drafts = t.s.scalars(q.where(m.Proposal.state == "draft")).all()
    return ToolResult({"waiting_states": mine, "count": len(ps), "value_inr": _r(sum(float(p.value_inr) for p in ps)),
                       "rows": [_proposal_brief(p) for p in ps[:TOP]], "more": max(0, len(ps) - TOP),
                       "drafts": len(drafts), "drafts_value_inr": _r(sum(float(p.value_inr) for p in drafts))},
                      set().union(*[set(p.assumption_ids) for p in ps]) if ps else set(), True,
                      [_prop_cite(p.id, p.proposal_no) for p in ps[:TOP]])


def get_data_quality(t: ToolCtx, a: NoArgs) -> ToolResult:
    dq = t.s.scalars(select(m.DQResultRow).where(m.DQResultRow.upload_id == t.ctx.upload_id).order_by(m.DQResultRow.id)).all()
    return ToolResult({"issues_found": sum(d.fired for d in dq), "as_of": t.ctx.as_of.isoformat(),
                       "data_age_days": t.ctx.data_age_days,
                       "checks": [{"check": d.name, "severity": d.severity, "fired": d.fired, "affected": d.affected_count,
                                   "assumption": d.assumption_id, "finding": d.message} for d in dq if d.fired]},
                      {d.assumption_id for d in dq if d.fired and d.assumption_id}, False)


class CapacityArgs(BaseModel):
    plant: str | None = Field(default=None, description="Plant ID e.g. IN-TN-01 or IN-KA-01")
    product_id: str | None = Field(default=None, description="Product code e.g. SPH-A15-128 or SPH-PRO-256")


class ForecastArgs(BaseModel):
    horizon: int = Field(default=30, description="Forecast horizon in days (30, 60, or 90)")
    plant: str | None = Field(default=None, description="Plant ID")


class ProcurementArgs(BaseModel):
    material: str = Field(default="MAT-CAM-007", description="Material code e.g. MAT-CAM-007 or MAT-PCB-004")
    quantity: int = Field(default=20, description="Quantity to purchase or quote")
    plant: str | None = Field(default=None, description="Plant ID e.g. IN-TN-01")


def get_production_capacity(t: ToolCtx, a: CapacityArgs) -> ToolResult:
    from app.intelligence.capacity import calculate_production_capacity
    p = t.plants(a.plant)
    pid = p[0] if len(p) == 1 else None
    res = calculate_production_capacity(t.s, t.user.tenant_id, plant_id=pid, product_id=a.product_id)
    return ToolResult({
        "plant_id": pid or "all_plants",
        "total_buildable_units": res["summary"]["total_buildable_units"],
        "total_protected_units": res["summary"].get("total_protected_units", 0),
        "bottlenecks": res["summary"]["bottlenecks"],
        "products": [
            {
                "product_id": pr["product_id"],
                "product_name": pr["product_name"],
                "max_capacity": pr["max_production_capacity"],
                "protected_capacity": pr.get("protected_production_capacity", 0),
                "bottleneck_material": pr["bottleneck_material"],
                "bottleneck_material_id": pr.get("bottleneck_material_id", ""),
                "limiting_usable_stock": next((c["usable_stock"] for c in pr.get("components", []) if c.get("is_bottleneck")), None),
                "top_constraints": [
                    {
                        "material_id": c["material_id"],
                        "material_name": c["material_name"],
                        "usable_stock": c["usable_stock"],
                        "supported_capacity": c["supported_capacity"],
                        "uom": c["uom"]
                    }
                    for c in pr.get("components", [])[:3]
                ]
            }
            for pr in res["products"]
        ],
    }, {"A15"}, True)


def get_demand_forecast(t: ToolCtx, a: ForecastArgs) -> ToolResult:
    from app.intelligence.forecasting import calculate_demand_forecast
    p = t.plants(a.plant)
    pid = p[0] if len(p) == 1 else None
    res = calculate_demand_forecast(t.s, t.user.tenant_id, horizon_days=a.horizon, plant_id=pid)
    crit = [r for r in res if r["status"] == "CRITICAL"][:TOP]
    return ToolResult({
        "horizon_days": a.horizon,
        "critical_count": sum(1 for r in res if r["status"] == "CRITICAL"),
        "at_risk_count": sum(1 for r in res if r["status"] == "AT_RISK"),
        "top_critical": [
            {"material_id": r["material_id"], "material_name": r["material_name"],
             "days_of_cover": r["days_of_cover"], "closing_qty": r["projected_closing_qty"],
             "reorder_qty": r["recommended_reorder_qty"], "uom": r["uom"]}
            for r in crit
        ],
    }, {"A14", "A15"}, True)


def compare_supplier_quotes_tool(t: ToolCtx, a: ProcurementArgs) -> ToolResult:
    from app.intelligence.procurement import compare_supplier_quotes
    p = t.plants(a.plant)
    pid = p[0] if p else "IN-TN-01"
    res = compare_supplier_quotes(material_id=a.material, required_qty=a.quantity, plant_id=pid)
    cites = [_mat_cite(a.material, pid)]
    return ToolResult(res, {"A11", "A14"}, False, cites)


TOOLS: dict[str, tuple[Callable[[ToolCtx, Any], ToolResult], type[BaseModel], str]] = {
    "get_daily_brief": (get_daily_brief, NoArgs, "Today's summary: shortages, excess, expiry, overdue POs, approvals, freshness"),
    "get_inventory_overview": (get_inventory_overview, PlantArg, "KPIs: status counts, health %, values, orders at risk, pending approvals"),
    "get_stock_position": (get_stock_position, StockArgs, "One material's stock, SS, max, cover, shortage and stock-out date per plant"),
    "get_shortage_horizon": (get_shortage_horizon, HorizonArgs, "Pairs going below safety stock within N days, with stock-outs and orders affected"),
    "get_material_risk_ranking": (get_material_risk_ranking, RankArgs, "Materials ranked by risk (critical first, soonest shortage)"),
    "get_excess_inventory": (get_excess_inventory, PlantArg, "Cash tied up above max stock, and stock with no demand basis"),
    "get_expiring_lots": (get_expiring_lots, ExpiryArgs, "Lots expiring within N days and all lots that carry expiry dates"),
    "get_replenishment_options": (get_replenishment_options, PairArgs, "Purchase / transfer proposals and calculation for one material at one plant"),
    "get_transfer_options": (get_transfer_options, PairArgs, "Which other plants could transfer this material without their own shortage"),
    "simulate_shortage_impact": (simulate_shortage_impact, SimArgs, "What breaks if a supplier (or each supplier) is late by N days"),
    "get_proposal_details": (get_proposal_details, ProposalArgs, "One proposal's calculation and timeline, or what waits for my approval"),
    "get_data_quality": (get_data_quality, NoArgs, "Data-quality findings and data age"),
    "get_production_capacity": (get_production_capacity, CapacityArgs, "How many finished products can be manufactured from available stock and identify bottlenecks"),
    "get_demand_forecast": (get_demand_forecast, ForecastArgs, "Material demand requirement forecast for 30, 60, or 90 day horizons"),
    "compare_supplier_quotes": (compare_supplier_quotes_tool, ProcurementArgs, "Compare approved supplier quotes, prices, lead times, OTIF reliability, and recommend the best-value supplier"),
}


def run_tool(t: ToolCtx, name: str, args: dict | None) -> ToolResult:
    """Execute a tool via Model Context Protocol (MCP) Client."""
    from app.mcp.client import mcp_client
    return mcp_client.call_tool(name, args or {}, context=t)


def tool_catalog(names: list[str] | tuple[str, ...] | None = None) -> str:
    """Generate the tool catalog string from active MCP Server registrations."""
    from app.mcp.client import mcp_client
    return mcp_client.tool_catalog_str(list(names) if names else None)
