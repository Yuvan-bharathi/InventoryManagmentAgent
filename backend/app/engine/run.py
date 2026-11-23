"""One deterministic calculation run: dataset + config -> stock, supply, demand, projection, status.

Every summary row carries the inputs it was computed from and the assumption ids it relied on
(rule 5); the caller attaches the run_id when persisting.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from app.config import EngineConfig
from app.engine import kpis as kpi_mod
from app.engine import demand, projection, stock, supply
from app.ingest.reader import Dataset


@dataclass
class EngineResult:
    as_of: pd.Timestamp
    config: EngineConfig
    stock_rows: pd.DataFrame
    position: pd.DataFrame
    po_lines: pd.DataFrame
    lead_times: pd.DataFrame
    supplier_delays: pd.Series
    requirements: pd.DataFrame
    daily: pd.DataFrame
    summary: pd.DataFrame
    ranked_suppliers: pd.DataFrame = None
    supplier_stats: pd.DataFrame = None
    bom: pd.DataFrame = None
    plan: pd.DataFrame = None
    kpis: dict = field(default_factory=dict)


def _assumptions_for(row: pd.Series, cfg: EngineConfig, overdue_pairs: set, future_receipt_pairs: set) -> list[str]:
    ids = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A14", "A19", "A20"]
    key = (row["material_id"], row["plant_id"])
    if key in future_receipt_pairs:
        ids.append("A9")
    if key in overdue_pairs:
        ids.append("A10")
    if not row["supplier_assigned"]:
        ids.append("A11")
    if cfg.demand_source == "scenario":
        ids.append("A15")
    elif cfg.overdue_backlog != "exclude":
        ids.append("A21")
    if not row["has_demand_basis"]:
        ids.append("A17")
    if row["lt_source"] == "actual":
        ids.append("A18")
    return sorted(set(ids), key=lambda x: int(x[1:]))


def run_engine(ds: Dataset, cfg: EngineConfig, scenario: pd.DataFrame | None) -> EngineResult:
    snap = ds["fact_inventory_daily_snapshot"]
    as_of = stock.resolve_as_of(snap, cfg)

    rows = stock.stock_rows(snap, as_of, cfg)
    position = stock.stock_position(rows, ds["dim_material"], ds["dim_plant"], cfg)
    transit = stock.in_transit_arrivals(position, as_of, cfg)

    po = ds["fact_purchase_order_receipt"]
    delays = supply.supplier_avg_delay(po, as_of)
    po_lines = supply.open_po_lines(po, as_of, delays, cfg.future_receipt_mode)
    stats = supply.supplier_stats(po, as_of)
    ranked = supply.rank_suppliers(ds["dim_material"], ds["dim_supplier"], stats, po, as_of)
    lead_times = supply.material_lead_times(ds["dim_material"], ranked, cfg.lead_time_source)

    bom_eff = demand.effective_bom(ds["fact_bom_component"], as_of)
    plan = demand.demand_plan(ds["fact_production_order"], scenario, as_of, cfg)
    reqs = demand.requirements(plan, bom_eff)

    daily, summary = projection.project(position, transit, po_lines, reqs, lead_times,
                                        set(bom_eff["material_id"]), as_of, cfg)

    open_by_pair = po_lines.groupby(["material_id", "plant_id"]).agg(
        open_po_qty=("open_qty", "sum"), open_po_lines=("po_id", "size"),
        overdue_po_lines=("overdue", "sum")).reset_index()
    summary = summary.merge(open_by_pair, on=["material_id", "plant_id"], how="left").fillna(
        {"open_po_qty": 0, "open_po_lines": 0, "overdue_po_lines": 0})
    overdue_pairs = set(map(tuple, po_lines.loc[po_lines["overdue"], ["material_id", "plant_id"]].values))
    fr_pairs = set(map(tuple, po_lines.loc[po_lines["date_basis"].str.contains("A9"),
                                           ["material_id", "plant_id"]].values))
    summary["assumption_ids"] = summary.apply(_assumptions_for, axis=1, args=(cfg, overdue_pairs, fr_pairs))
    summary["demand_source"] = cfg.demand_source

    # Stock-out (projected < 0) = the line would stop; orders affected = planned orders at that plant
    # starting on or after the stock-out date, for products whose BOM uses the material (D13).
    so = daily[daily["projected_qty"] < 0].groupby(["material_id", "plant_id"])["date"].min() \
        .rename("stockout_date").reset_index()
    summary = summary.merge(so, on=["material_id", "plant_id"], how="left")
    summary.loc[~summary["has_demand_basis"], "stockout_date"] = pd.NaT
    summary["days_to_stockout"] = (summary["stockout_date"] - as_of).dt.days
    uses = bom_eff[["product_id", "material_id"]].drop_duplicates()
    po_mat = plan[["production_order_id", "plant_id", "product_id", "planned_start", "order_qty"]].merge(uses, on="product_id")
    hit = po_mat.merge(summary[["material_id", "plant_id", "stockout_date"]], on=["material_id", "plant_id"])
    hit = hit[hit["stockout_date"].notna() & (hit["planned_start"] >= hit["stockout_date"])]
    summary = summary.merge(hit.groupby(["material_id", "plant_id"])["production_order_id"].nunique()
                            .rename("orders_affected").reset_index(), on=["material_id", "plant_id"], how="left")
    summary["orders_affected"] = summary["orders_affected"].fillna(0).astype(int)
    orders_at_risk = hit.groupby("production_order_id").agg(plant_id=("plant_id", "first"),
                                                            planned_start=("planned_start", "first"))
    in_14 = orders_at_risk[orders_at_risk["planned_start"] <= as_of + pd.Timedelta(days=14)]

    price = position.set_index(["material_id", "plant_id"])["standard_price_inr"]
    ex = summary[summary["status"] == "excess"].set_index(["material_id", "plant_id"])
    excess_value = float(((ex["usable_qty"] - ex["max_qty"]).clip(lower=0) * price.reindex(ex.index)).sum())
    exp = rows[rows["expiry_date"].notna() & (rows["expiry_date"] <= as_of + pd.Timedelta(days=30))]

    kpis = {
        "critical_in_7_days": int(((summary["status"] == "critical") & (summary["days_to_shortage"] <= 7)).sum()),
        "production_orders_at_risk": int(len(orders_at_risk)),
        "production_orders_at_risk_14d": int(len(in_14)),
        "production_orders_at_risk_by_plant": {k: int(v) for k, v in orders_at_risk.groupby("plant_id").size().items()},
        "excess_value_inr": excess_value,
        "expiring_30d_value_inr": float((exp["usable_qty"] * exp["unit_cost_inr"]).sum()),
        "overdue_po_lines": int(po_lines["overdue"].sum()),
        "open_po_lines": int(len(po_lines)),
        "as_of": as_of.date().isoformat(),
        "inventory_health_pct": projection.inventory_health_pct(summary),
        # Totals across materials are in INR only (rule 8).
        "total_on_hand_value_inr": float(position["on_hand_value_inr"].sum()),
        "total_usable_value_inr": float(position["usable_value_inr"].sum()),
        "status_counts": summary["status"].value_counts().reindex(projection.STATUSES, fill_value=0).to_dict(),
        "excluded_stock_rows": int(rows["excluded"].sum()),
        "demand_source": cfg.demand_source,
        "backlog_orders": int(plan["backlog"].sum()) if "backlog" in plan else 0,
    }
    kpis |= kpi_mod.demand_kpis(summary)
    return EngineResult(as_of, cfg, rows, position, po_lines, lead_times, delays, reqs, daily, summary,
                        ranked, stats, bom_eff, plan, kpis)
