"""Executive Overview, Stock Explorer, Material 360 and Shortage Horizon endpoints."""
from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models as m
from app.api.common import (Grid, RunCtx, ctx_dep, envelope, get_db, grid_params, page_df, projection_df,
                            resolve_source, rows_of, status_df, xlsx_response)
from app.engine.kpis import demand_kpis
from app.auth import Principal, current_user

router = APIRouter(prefix="/api")
STATUS_ORDER = {"critical": 0, "at_risk": 1, "excess": 2, "healthy": 3, "stale": 4}


def _filter(df: pd.DataFrame, category: str | None = None, status: str | None = None, search: str | None = None):
    if category:
        df = df[df["material_category"] == category]
    if status:
        df = df[df["status"].isin(status.split(","))]
    if search:
        q = search.lower()
        df = df[df["material_id"].str.lower().str.contains(q) | df["material_name"].str.lower().str.contains(q)]
    return df


def _ids(df: pd.DataFrame) -> set[str]:
    return set().union(*df["assumption_ids"]) if len(df) else set()


# Deck KPIs this dataset cannot support; shown on screen rather than left out.
NOT_MEASURABLE = [
    {"kpi": "Inventory turns", "reason": "No consumption history usable for trends: daily snapshots are not continuous (A1)."},
    {"kpi": "Stockout hours", "reason": "Hourly production data is inconsistent (good quantity about 4x the order quantity)."},
    {"kpi": "Inventory record accuracy", "reason": "No cycle counts, and the snapshots are not a continuous history."},
    {"kpi": "Customer impact", "reason": "Customer orders do not link to production orders in the data (A16)."},
]


# ---------------- Executive Overview ----------------
def overview_kpis(df: pd.DataFrame, ctx: RunCtx) -> dict:
    basis = df[df["has_demand_basis"]]
    ex = df[df["status"] == "excess"]
    return {
        "inventory_health_pct": round(100 * (basis["status"] == "healthy").mean(), 1) if len(basis) else None,
        "total_inventory_value_inr": float(df["on_hand_value_inr"].sum()),
        "usable_value_inr": float(df["usable_value_inr"].sum()),
        "critical_in_7_days": int(((df["status"] == "critical") & (df["days_to_shortage"] <= 7)).sum()),
        "excess_value_inr": float(((ex["usable_qty"] - ex["max_qty"]).clip(lower=0) * ex["standard_price_inr"]).sum()),
        "overdue_po_lines": int(df["overdue_po_lines"].fillna(0).sum()),
        "status_counts": {k: int((df["status"] == k).sum()) for k in STATUS_ORDER},
    } | demand_kpis(df)


def demand_view(ctx: RunCtx, source: str, user: Principal, plant: str | None, category: str | None) -> dict:
    """Which demand source is shown, the default, and the other source's headline counts (D31)."""
    out = {"source": source, "default": ctx.demand_source, "is_default": source == ctx.demand_source,
           "available": sorted((ctx.kpis.get("by_source") or {ctx.demand_source: None}).keys()), "other": None}
    other = next((x for x in out["available"] if x != source), None)
    if other:
        o = _filter(status_df(user, ctx, plant, other), category)
        out["other"] = {"source": other, "status_counts": {k: int((o["status"] == k).sum()) for k in STATUS_ORDER}}
    if not out["is_default"]:
        out["note_multiple"] = demand_kpis(_filter(status_df(user, ctx, plant, source), category))["demand_multiple"]
    return out


def _live_proposals(s: Session, tenant_id: str) -> pd.DataFrame:
    """One live query: proposals that are not final (states change between runs)."""
    rows = s.execute(select(m.Proposal.id, m.Proposal.material_id, m.Proposal.plant_id, m.Proposal.kind,
                            m.Proposal.state, m.Proposal.value_inr, m.Proposal.proposal_no)
                     .where(m.Proposal.tenant_id == tenant_id,
                            m.Proposal.state.in_(["draft", "pending_buyer", "pending_manager", "approved"]))).all()
    df = pd.DataFrame(rows, columns=["id", "material_id", "plant_id", "kind", "state", "value_inr", "proposal_no"])
    df["value_inr"] = df["value_inr"].astype(float)
    return df


@router.get("/overview")
def overview(plant: str | None = None, category: str | None = None, source: str | None = None,
             user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep), s: Session = Depends(get_db)):
    from app.api.common import cached
    plants = user.scope(plant)
    src = resolve_source(ctx, source)
    df = _filter(status_df(user, ctx, plant, src), category)
    k = overview_kpis(df, ctx)

    def history():
        runs = s.execute(select(m.CalculationRun.id, m.CalculationRun.as_of_date, m.CalculationRun.kpis)
                         .where(m.CalculationRun.tenant_id == user.tenant_id, m.CalculationRun.status == "succeeded",
                                m.CalculationRun.id <= ctx.run_id)
                         .order_by(m.CalculationRun.id.desc()).limit(30)).all()
        b = s.scalar(select(m.DailyBrief).where(m.DailyBrief.tenant_id == user.tenant_id,
                                                m.DailyBrief.run_id == ctx.run_id).order_by(m.DailyBrief.id.desc()).limit(1))
        brief = None if b is None else {"text": b.text, "kind": b.kind, "run_id": b.run_id,
                                        "created_at": b.created_at.isoformat()}
        return runs, brief
    runs, brief = cached(user.tenant_id, ctx.run_id, "overview-history", history)
    def for_src(kp: dict) -> dict | None:  # compare like with like: the same demand source in each run
        return kp if src == ctx.demand_source and kp.get("demand_source", src) == src else (kp.get("by_source") or {}).get(src)
    prev = for_src(runs[1][2]) if len(runs) > 1 else None
    props = _live_proposals(s, user.tenant_id)
    props = props[props["plant_id"].isin(plants)]
    pend = props[props["state"].isin(["pending_buyer", "pending_manager"])]

    by_plant = ((ctx.kpis.get("by_source") or {}).get(src) or ctx.kpis).get("production_orders_at_risk_by_plant", {})
    k["production_orders_at_risk"] = int(sum(by_plant.get(p, 0) for p in plants))
    k["pending_approvals"] = {"count": int(len(pend)), "value_inr": float(pend["value_inr"].sum())}
    k["expiring_30d_value_inr"] = float(ctx.kpis.get("expiring_30d_value_inr", 0.0)) if not plant else None

    strip = [{"date": (ctx.as_of + timedelta(days=i)).isoformat(),
              "critical": int((df["shortage_date"] == ctx.as_of + timedelta(days=i)).sum())} for i in range(1, 15)]

    att = df[df["status"].isin(["critical", "at_risk"])].copy()
    att["rank"] = att["status"].map(STATUS_ORDER)
    att = att.sort_values(["rank", "days_to_shortage", "orders_affected"], ascending=[True, True, False]).head(10)
    pp = props[props["kind"] == "purchase"].drop_duplicates(["material_id", "plant_id"]).set_index(["material_id", "plant_id"])
    needs = []
    for r in att.itertuples():
        p = pp.loc[(r.material_id, r.plant_id)] if (r.material_id, r.plant_id) in pp.index else None
        needs.append({"priority": "High" if r.status == "critical" else "Medium", "material_id": r.material_id,
                      "material_name": r.material_name, "plant_id": r.plant_id, "status": r.status,
                      "issue": f"Below safety stock in {int(r.days_to_shortage)} day(s)",
                      "orders_affected": int(r.orders_affected),
                      "act_by": (r.shortage_date - timedelta(days=int(r.lt_days))).isoformat()
                      if r.shortage_date else None,
                      "proposal_id": int(p["id"]) if p is not None else None,
                      "proposal_state": p["state"] if p is not None else None,
                      "proposal_value_inr": float(p["value_inr"]) if p is not None else None,
                      "assumption_ids": r.assumption_ids})

    mix_cat = df.groupby("material_category")["on_hand_value_inr"].sum().sort_values(ascending=False)
    mix_plant = df.groupby("plant_id")["on_hand_value_inr"].sum()
    comp = []
    for p in plants:
        kk = overview_kpis(df[df["plant_id"] == p], ctx)
        comp.append({"plant_id": p, "health_pct": kk["inventory_health_pct"], "value_inr": kk["total_inventory_value_inr"],
                     "critical": kk["status_counts"]["critical"], "excess_value_inr": kk["excess_value_inr"],
                     "approvals_pending": int((pend["plant_id"] == p).sum()), "data_age_days": ctx.data_age_days})
    cur_health = k.get("inventory_health_pct")
    trend = []
    for i, a, kp in reversed(runs):
        sk = for_src(kp)
        if sk is not None:
            # When plant is filtered, trend tracks that plant's health; otherwise enterprise total
            h = cur_health if (plant and cur_health is not None) else sk.get("inventory_health_pct")
            trend.append({"run_id": i, "as_of": a.isoformat(), "health_pct": h})

    return envelope({
        "kpis": k, "previous_kpis": prev, "shortage_strip": strip, "needs_attention": needs,
        "value_by_category": [{"category": c, "value_inr": float(v)} for c, v in mix_cat.items()],
        "value_by_plant": [{"plant_id": p, "value_inr": float(v)} for p, v in mix_plant.items()],
        "health_trend": trend,
        "plant_comparison": comp, "brief": brief,
        "demand_view": demand_view(ctx, src, user, plant, category),
        "not_measurable": NOT_MEASURABLE,
    }, ctx, _ids(df), demand_source_shown=src)


# ---------------- Stock Explorer ----------------
STOCK_COLS = ["material_id", "material_name", "material_category", "plant_id", "uom", "on_hand_qty", "allocated_qty",
              "blocked_qty", "quality_hold_qty", "in_transit_qty", "usable_qty", "ss_qty", "max_qty", "days_of_cover",
              "status", "usable_value_inr", "on_hand_value_inr", "supplier_id", "assumption_ids"]


def _stock_rows(user, ctx, s, plant, category, status, search, warehouse, level):
    df = _filter(status_df(user, ctx, plant), category, status, search)
    if level == "location":
        q = select(m.StockBalance).where(m.StockBalance.tenant_id == user.tenant_id,
                                         m.StockBalance.plant_id.in_(user.scope(plant)))
        if warehouse:
            q = q.where(m.StockBalance.warehouse_id == warehouse)
        sb = pd.DataFrame([{c.name: getattr(r, c.name) for c in m.StockBalance.__table__.columns}
                           for r in s.scalars(q)])
        if sb.empty:
            return sb
        for c in ["on_hand_qty", "allocated_qty", "blocked_qty", "quality_hold_qty", "in_transit_qty", "unit_cost_inr"]:
            sb[c] = sb[c].astype(float)
        sb["usable_qty"] = (sb["on_hand_qty"] - sb[["allocated_qty", "blocked_qty", "quality_hold_qty"]].sum(axis=1)) \
            .clip(lower=0).where(~sb["excluded"], 0)
        sb["usable_value_inr"] = sb["usable_qty"] * sb["unit_cost_inr"]
        sb["on_hand_value_inr"] = sb["on_hand_qty"] * sb["unit_cost_inr"]
        sb = sb.merge(df[["material_id", "plant_id", "material_name", "material_category", "uom", "status", "ss_qty",
                          "max_qty", "days_of_cover", "assumption_ids"]], on=["material_id", "plant_id"], how="inner")
        return sb[["material_id", "material_name", "material_category", "plant_id", "warehouse_id", "lot_id", "uom",
                   "on_hand_qty", "allocated_qty", "blocked_qty", "quality_hold_qty", "in_transit_qty", "usable_qty",
                   "inventory_status", "expiry_date", "status", "usable_value_inr", "on_hand_value_inr",
                   "assumption_ids"]]
    return df[STOCK_COLS]


@router.get("/stock")
def stock(plant: str | None = None, category: str | None = None, status: str | None = None, search: str | None = None,
          warehouse: str | None = None, level: str = Query("material", pattern="^(material|location)$"),
          g: Grid = Depends(grid_params), user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep),
          s: Session = Depends(get_db)):
    user.require("inventory", "V")
    df = _stock_rows(user, ctx, s, plant, category, status, search, warehouse, level)
    summary = {}
    if len(df):
        val = lambda c: float((df[c] * (df["usable_value_inr"] / df["usable_qty"]).where(df["usable_qty"] > 0)).sum()) \
            if level == "location" else None  # noqa: E731
        price = df["on_hand_value_inr"] / df["on_hand_qty"].where(df["on_hand_qty"] > 0)
        for c in ["on_hand", "usable", "allocated", "blocked", "quality_hold", "in_transit"]:
            summary[f"{c}_value_inr"] = float((df[f"{c}_qty"] * price).sum())
        if df["material_id"].nunique() == 1:  # quantities only within one material (rule 8)
            for c in ["on_hand", "usable", "allocated", "blocked", "quality_hold", "in_transit"]:
                summary[f"{c}_qty"] = float(df[f"{c}_qty"].sum())
            summary["uom"] = df["uom"].iloc[0]
    out = page_df(df, g, ["material_id", "plant_id"])
    out["summary"] = summary
    return envelope(out, ctx, _ids(df))


@router.get("/stock/export.xlsx")
def stock_export(plant: str | None = None, category: str | None = None, status: str | None = None,
                 search: str | None = None, warehouse: str | None = None, level: str = "material",
                 user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep), s: Session = Depends(get_db)):
    user.require("inventory", "V")
    df = _stock_rows(user, ctx, s, plant, category, status, search, warehouse, level)
    df = df.assign(assumption_ids=df["assumption_ids"].apply(", ".join))
    return xlsx_response({"Stock": df}, f"stock_{ctx.as_of}_run{ctx.run_id}.xlsx")


# ---------------- Material 360 ----------------
def _cols(o, model) -> dict:
    return {c.name: getattr(o, c.name) for c in model.__table__.columns if c.name != "tenant_id"}


def _tenant_frames(s: Session, t: str, ctx: RunCtx) -> dict[str, pd.DataFrame]:
    """All per-run detail rows for a tenant, loaded once per run (a few thousand rows)."""
    from app.api.common import cached

    def load():
        def df(model, *where):
            return pd.DataFrame([_cols(r, model) for r in s.scalars(select(model).where(model.tenant_id == t, *where))])
        end = ctx.as_of + timedelta(days=ctx.horizon_days)
        src = "scenario" if ctx.demand_source == "scenario" else "history"
        req = pd.DataFrame(s.execute(
            select(m.ProductionPlan.production_order_id, m.ProductionPlan.plant_id, m.ProductionPlan.product_id,
                   m.ProductionPlan.planned_start, m.ProductionPlan.priority, m.ProductionPlan.order_qty,
                   m.BomLine.material_id, m.BomLine.qty_per)
            .join(m.BomLine, (m.BomLine.tenant_id == m.ProductionPlan.tenant_id)
                  & (m.BomLine.product_id == m.ProductionPlan.product_id))
            .where(m.ProductionPlan.tenant_id == t, m.ProductionPlan.source == src,
                   m.BomLine.effective_from <= ctx.as_of, m.BomLine.effective_to >= ctx.as_of,
                   m.ProductionPlan.planned_start > ctx.as_of, m.ProductionPlan.planned_start <= end)).all(),
            columns=["production_order_id", "plant_id", "product_id", "date", "priority", "order_qty", "material_id",
                     "qty_per"])
        return {"loc": df(m.StockBalance), "po": df(m.PoSupplyLine, m.PoSupplyLine.run_id == ctx.run_id),
                "gr": df(m.GoodsReceipt), "lt": df(m.SupplierLeadTime, m.SupplierLeadTime.run_id == ctx.run_id),
                "ec": df(m.EngineeringChange), "req": req, "mat": df(m.Material)}
    return cached(t, ctx.run_id, "detail-frames", load)


def _recs(df: pd.DataFrame) -> list[dict]:
    return rows_of(df) if len(df) else []


def _pair(d: pd.DataFrame, material_id: str, plant: str) -> pd.DataFrame:
    return d[(d["material_id"] == material_id) & (d["plant_id"] == plant)] if len(d) else d


@router.get("/materials/{material_id}")
def material_360(material_id: str, plant: str, user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep),
                 s: Session = Depends(get_db)):
    user.require("inventory", "V")
    df = status_df(user, ctx, plant)
    row = df[df["material_id"] == material_id]
    if row.empty:
        raise HTTPException(404, "Material not found at this plant")
    st = rows_of(row)[0]
    f = _tenant_frames(s, user.tenant_id, ctx)
    mat = f["mat"][f["mat"]["material_id"] == material_id].iloc[0]
    pr = projection_df(user, ctx)
    pr = pr[(pr["material_id"] == material_id) & (pr["plant_id"] == plant)]
    req = _pair(f["req"], material_id, plant).sort_values("date")
    req = req.assign(required_qty=req["order_qty"].astype(float) * req["qty_per"].astype(float), reserved_qty=0.0)
    req = req.assign(unreserved_qty=req["required_qty"])[["production_order_id", "product_id", "date", "priority",
                                                          "required_qty", "reserved_qty", "unreserved_qty"]]
    lts = f["lt"][f["lt"]["material_id"] == material_id].sort_values("rank") if len(f["lt"]) else f["lt"]
    ecs = f["ec"][f["ec"]["material_id"] == material_id] if len(f["ec"]) else f["ec"]
    po = _pair(f["po"], material_id, plant)
    gr = _pair(f["gr"], material_id, plant)
    props = _live_proposals(s, user.tenant_id)
    props = props[(props["material_id"] == material_id) & (props["plant_id"] == plant)] \
        .sort_values(["kind", "id"], ascending=[True, False])
    prop = props.iloc[0] if len(props) else None
    return envelope({
        "header": {"material_id": material_id, "material_name": mat["material_name"],
                   "category": mat["material_category"], "uom": mat["uom"], "shelf_life_days": int(mat["shelf_life_days"]),
                   "standard_price_inr": float(mat["standard_price_inr"]), "moq": float(mat["moq"]),
                   "master_lead_time_days": int(mat["lead_time_days"]),
                   "preferred_supplier_id": lts.iloc[0]["supplier_id"] if len(lts) else None, "status": st["status"],
                   "plant_id": plant, "open_proposal": None if prop is None else
                   {"id": int(prop["id"]), "proposal_no": prop["proposal_no"], "state": prop["state"],
                    "kind": prop["kind"]}},
        "position": st,
        "projection": rows_of(pr.drop(columns=["material_id", "plant_id"])),
        "locations": _recs(_pair(f["loc"], material_id, plant)),
        "requirements": _recs(req),
        "open_po_lines": _recs(po.sort_values("expected_date") if len(po) else po),
        "receipts": _recs(gr.sort_values("received_date", ascending=False).head(30) if len(gr) else gr),
        "supplier_lead_times": _recs(lts),
        "engineering_changes": _recs(ecs),
    }, ctx, st["assumption_ids"])


# ---------------- Shortage Horizon ----------------
def _shortage_rows(user, ctx, s, horizon, plant, category, status, source=None):
    df = _filter(status_df(user, ctx, plant, source), category, status or "critical,at_risk")
    df = df[df["days_to_shortage"].isna() | (df["days_to_shortage"] <= horizon)] if not status else df
    props = pd.DataFrame([{"material_id": p.material_id, "plant_id": p.plant_id, "proposal_id": p.id,
                           "proposal_no": p.proposal_no, "proposal_state": p.state, "proposal_kind": p.kind,
                           "proposal_qty": float(p.qty), "in_time": p.in_time}
                          for p in s.scalars(select(m.Proposal).where(
                              m.Proposal.tenant_id == user.tenant_id,
                              m.Proposal.state.in_(["draft", "pending_buyer", "pending_manager", "approved"]),
                              m.Proposal.kind == "purchase"))],
                         columns=["material_id", "plant_id", "proposal_id", "proposal_no", "proposal_state",
                                  "proposal_kind", "proposal_qty", "in_time"])
    df = df.merge(props, on=["material_id", "plant_id"], how="left")
    arrival = pd.to_datetime(ctx.as_of) + pd.to_timedelta(df["lt_days"], unit="D")
    computed = (arrival <= pd.to_datetime(df["shortage_date"])).map({True: "yes", False: "expedite"})
    df["in_time"] = df["in_time"].fillna(computed.where(df["supplier_id"].notna(), "no"))
    df["recommended_action"] = df.apply(lambda r: "No action" if pd.isna(r["shortage_date"]) else (
        f"Purchase {int(r['proposal_qty'])} {r['uom']}" if pd.notna(r["proposal_qty"]) else "Review"), axis=1)
    return df[["material_id", "material_name", "material_category", "plant_id", "uom", "status", "usable_qty",
               "shortage_date", "days_to_shortage", "shortage_qty", "stockout_date", "lt_days", "lt_source",
               "master_lt_days", "in_time", "orders_affected", "recommended_action", "proposal_id", "proposal_no",
               "proposal_state", "supplier_id", "assumption_ids"]]


@router.get("/shortages")
def shortages(horizon: int = Query(30, ge=1, le=60), plant: str | None = None, category: str | None = None,
              status: str | None = None, view: str = Query("daily", pattern="^(daily|weekly)$"),
              source: str | None = None, g: Grid = Depends(grid_params), user: Principal = Depends(current_user),
              ctx: RunCtx = Depends(ctx_dep), s: Session = Depends(get_db)):
    user.require("planning", "V")
    src = resolve_source(ctx, source)
    df = _shortage_rows(user, ctx, s, horizon, plant, category, status, src)
    # heat map: pairs x days, cell = projected status
    allst = _filter(status_df(user, ctx, plant, src), category)
    allst = allst[allst["has_demand_basis"]]
    pr = projection_df(user, ctx, src).merge(allst[["material_id", "plant_id", "max_qty", "lt_days", "status"]],
                                        on=["material_id", "plant_id"])
    pr = pr[(pd.to_datetime(pr["date"]) - pd.Timestamp(ctx.as_of)).dt.days <= min(horizon, 30)]
    dayn = (pd.to_datetime(pr["date"]) - pd.Timestamp(ctx.as_of)).dt.days
    pr["cell"] = "healthy"
    pr.loc[pr["projected_qty"] > pr["max_qty"], "cell"] = "excess"
    pr.loc[pr["projected_qty"] < pr["ss_qty"], "cell"] = "at_risk"
    pr.loc[(pr["projected_qty"] < pr["ss_qty"]) & (dayn <= pr["lt_days"]), "cell"] = "critical"
    if view == "weekly":
        pr["bucket"] = ((dayn - 1) // 7) + 1
        sev = pr["cell"].map(STATUS_ORDER)
        pr = pr.assign(sev=sev).sort_values("sev").drop_duplicates(["material_id", "plant_id", "bucket"])
        pr["date"] = pr["bucket"].map(lambda b: f"W{b}")
    pr["rank"] = pr["status"].map(STATUS_ORDER)
    heat = {}
    for (mat, pl), grp in pr.sort_values(["rank", "material_id"]).groupby(["material_id", "plant_id"], sort=False):
        heat[f"{mat}|{pl}"] = {"material_id": mat, "plant_id": pl, "status": grp["status"].iloc[0],
                               "cells": [{"date": str(d), "status": c, "qty": round(q)} for d, c, q in
                                         zip(grp["date"], grp["cell"], grp["projected_qty"])]}
    out = page_df(df, g, ["days_to_shortage", "material_id"])
    out["heatmap"] = sorted(heat.values(), key=lambda h: (STATUS_ORDER[h["status"]], h["material_id"]))
    out["demand_view"] = demand_view(ctx, src, user, plant, category)
    return envelope(out, ctx, _ids(df) | {"A14"}, demand_source_shown=src)


@router.get("/shortages/export.xlsx")
def shortages_export(horizon: int = 60, plant: str | None = None, category: str | None = None,
                     status: str | None = None, user: Principal = Depends(current_user),
                     ctx: RunCtx = Depends(ctx_dep), s: Session = Depends(get_db)):
    df = _shortage_rows(user, ctx, s, horizon, plant, category, status)
    return xlsx_response({"Shortages": df.assign(assumption_ids=df["assumption_ids"].apply(", ".join))},
                         f"shortages_{ctx.as_of}_run{ctx.run_id}.xlsx")
