"""Data-quality gate: runs on every ingestion, before any calculation. Results go to dq_results.

Each check returns a DQResult; `fired` = the issue was found in the dataset.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date

import pandas as pd

from app.config import EngineConfig
from app.engine.stock import resolve_as_of
from app.engine.supply import approved_vendors

SAMPLE = 20


@dataclass
class DQResult:
    check_id: str
    name: str
    severity: str  # info | warning | error | blocked
    fired: bool
    affected_count: int
    message: str
    assumption_id: str | None = None
    sample: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _sample(df: pd.DataFrame, cols: list[str]) -> list[dict]:
    out = df[cols].head(SAMPLE).copy()
    for c in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[c]):
            out[c] = out[c].dt.strftime("%Y-%m-%d")
    return out.astype(object).where(out.notna(), None).to_dict("records")


def snapshot_continuity(snap: pd.DataFrame, cfg: EngineConfig) -> DQResult:
    s = snap.groupby(["material_id", "warehouse_id", "snapshot_date"])["on_hand_qty"].sum().sort_index()
    corr = s.groupby(level=[0, 1]).apply(lambda x: x.autocorr(lag=1)).dropna()
    low = corr[corr < cfg.snapshot_continuity_min_corr]
    median = float(corr.median()) if len(corr) else float("nan")
    fired = len(corr) > 0 and median < cfg.snapshot_continuity_min_corr
    return DQResult("snapshot_continuity", "Snapshot continuity", "warning", fired, int(len(low)),
                    f"Day-to-day correlation of on-hand is {median:.2f} (median over {len(corr)} material x "
                    f"warehouse series); history is not usable for trends.", "A1",
                    _sample(low.rename("lag1_corr").reset_index().round(3), ["material_id", "warehouse_id", "lag1_corr"]))


def plant_flip(snap: pd.DataFrame) -> DQResult:
    n = snap.groupby(["material_id", "warehouse_id"])["plant_id"].nunique()
    flips = n[n > 1].rename("plants").reset_index()
    return DQResult("plant_flip", "Plant flip", "warning", not flips.empty, len(flips),
                    f"{len(flips)} material x warehouse combinations appear under different plants on different days; "
                    "the plant on the latest snapshot row is used.", "A2",
                    _sample(flips, ["material_id", "warehouse_id", "plants"]))


def safety_stock_mismatch(latest: pd.DataFrame, materials: pd.DataFrame) -> DQResult:
    m = latest.merge(materials[["material_id", "safety_stock_qty"]], on="material_id", suffixes=("", "_master"))
    bad = m[m["safety_stock_qty"] != m["safety_stock_qty_master"]]
    return DQResult("ss_mismatch", "Safety stock mismatch", "warning", not bad.empty, len(bad),
                    f"{len(bad)} of {len(m)} latest snapshot rows carry a safety stock different from the material "
                    "master; the master value is used.", "A5",
                    _sample(bad, ["material_id", "plant_id", "warehouse_id", "safety_stock_qty", "safety_stock_qty_master"]))


def po_status(po: pd.DataFrame) -> DQResult:
    bad = po[(po["po_status"] == "CLOSED") & (po["received_qty"] < po["ordered_qty"])]
    closed = int((po["po_status"] == "CLOSED").sum())
    return DQResult("po_status", "PO status", "warning", not bad.empty, len(bad),
                    f"{len(bad)} of {closed} CLOSED PO lines received less than ordered; treated as short-closed "
                    "(nothing more due).", "A8",
                    _sample(bad, ["po_id", "po_line", "material_id", "ordered_qty", "received_qty"]))


def future_receipts(po: pd.DataFrame, as_of: pd.Timestamp) -> DQResult:
    bad = po[po["receipt_date"] > as_of]
    return DQResult("future_receipts", "Future receipts", "info", not bad.empty, len(bad),
                    f"{len(bad)} PO lines have a receipt_date after the as-of date; treated as expected, not actual, "
                    "receipts.", "A9",
                    _sample(bad, ["po_id", "po_line", "po_status", "material_id", "receipt_date", "received_qty"]))


def uncounted_future_receipts(po: pd.DataFrame, as_of: pd.Timestamp, cfg: EngineConfig) -> DQResult:
    """A19: received_qty on future-dated lines that the projection does not count (per material, never summed)."""
    from app.engine.supply import uncounted_future_receipts as per_material
    u = per_material(po, as_of).sort_values("value_inr", ascending=False)
    counted = cfg.future_receipt_mode == "full_received_qty"
    lines, value = int(u["lines"].sum()), float(u["value_inr"].sum())
    msg = (f"{lines} future-dated PO lines carry received_qty worth ₹{value / 1e7:.2f} Cr "
           f"across {len(u)} materials; "
           + ("counted as supply on their receipt date (A19 = full_received_qty)." if counted else
              "not counted as stock or supply (A19 = open_qty_only). Quantity per material in the detail."))
    return DQResult("uncounted_future_receipts", "Uncounted future receipts", "info", not u.empty and not counted,
                    lines, msg, "A19",
                    _sample(u.assign(qty=u["qty"].round(0), value_inr=u["value_inr"].round(0)),
                            ["material_id", "lines", "qty", "value_inr"]) if not u.empty else [])


def supplier_category(po: pd.DataFrame, materials: pd.DataFrame, suppliers: pd.DataFrame) -> DQResult:
    m = po.merge(materials[["material_id", "material_category"]], on="material_id") \
        .merge(suppliers[["supplier_id", "material_category"]].rename(columns={"material_category": "supplier_category"}),
               on="supplier_id")
    bad = m[m["material_category"] != m["supplier_category"]]
    return DQResult("supplier_category", "Supplier category", "warning", not bad.empty, len(bad),
                    f"{len(bad)} of {len(m)} PO lines are with a supplier whose approved category differs from the "
                    "material's category.", "A11",
                    _sample(bad, ["po_id", "po_line", "material_id", "material_category", "supplier_id", "supplier_category"]))


def missing_supplier(materials: pd.DataFrame, suppliers: pd.DataFrame) -> DQResult:
    covered = set(approved_vendors(materials, suppliers)["material_id"])
    bad = materials[~materials["material_id"].isin(covered)]
    cats = ", ".join(sorted(bad["material_category"].unique()))
    return DQResult("missing_supplier", "Missing supplier", "warning", not bad.empty, len(bad),
                    f"{len(bad)} materials have no approved supplier for their category ({cats}); proposals will show "
                    "'supplier to be assigned'.", "A11",
                    _sample(bad, ["material_id", "material_name", "material_category"]))


def broken_link(prod: pd.DataFrame, cust: pd.DataFrame | None) -> DQResult:
    ids = set(cust["customer_order_id"]) if cust is not None else set()
    linked = prod["customer_order_id"].notna() & (prod["customer_order_id"].astype(str) != "")
    bad = prod[linked & ~prod["customer_order_id"].isin(ids)]
    total = int(linked.sum())
    pct = 100.0 * (total - len(bad)) / total if total else 0.0
    return DQResult("broken_link", "Broken link", "warning", not bad.empty, len(bad),
                    f"{len(bad)} of {total} production orders reference a customer order that does not exist "
                    f"({pct:.0f}% match); customer orders are display only.", "A16",
                    _sample(bad, ["production_order_id", "customer_order_id", "product_id"]))


def stale_data(as_of: pd.Timestamp, today: date, cfg: EngineConfig) -> DQResult:
    age = (pd.Timestamp(today) - as_of).days
    fired = age > cfg.staleness_days
    return DQResult("stale_data", "Stale data", "warning", fired, 1 if fired else 0,
                    f"Data as of {as_of:%d-%b-%Y} · {age} days old (limit {cfg.staleness_days}).", "A1")


def mixed_uom(materials: pd.DataFrame) -> DQResult:
    uoms = sorted(materials["uom"].dropna().unique())
    fired = len(uoms) > 1
    return DQResult("mixed_uom", "Mixed UoM", "blocked", fired, len(uoms),
                    f"Materials use {len(uoms)} units of measure ({', '.join(uoms)}); quantity totals across "
                    "materials are blocked, totals are shown in INR only.", None,
                    _sample(materials.groupby("uom", as_index=False)["material_id"].count()
                            .rename(columns={"material_id": "materials"}), ["uom", "materials"]))


def plan_coverage(prod: pd.DataFrame, as_of: pd.Timestamp) -> DQResult:
    future = prod[prod["planned_start"] > as_of]
    last = prod["planned_start"].max()
    fired = future.empty
    return DQResult("plan_coverage", "Plan coverage", "warning", fired, 0 if fired else len(future),
                    (f"No production order starts after the as-of date (latest planned start {last:%d-%b-%Y}); "
                     "demand comes from the planning scenario.") if fired else
                    f"{len(future)} production orders start after the as-of date.", "A15")


def deductions(latest: pd.DataFrame) -> DQResult:
    bad = latest[latest[["allocated_qty", "blocked_qty", "quality_hold_qty"]].sum(axis=1) > latest["on_hand_qty"]]
    return DQResult("deductions", "Deductions", "error", not bad.empty, len(bad),
                    f"{len(bad)} stock rows have allocated + blocked + quality hold above on-hand; these rows are "
                    "excluded from usable stock." if len(bad) else
                    "No stock row has deductions above on-hand.", "A3",
                    _sample(bad, ["material_id", "plant_id", "warehouse_id", "on_hand_qty", "allocated_qty",
                                  "blocked_qty", "quality_hold_qty"]))


def run_dq(ds, cfg: EngineConfig, today: date | None = None) -> list[DQResult]:
    snap = ds["fact_inventory_daily_snapshot"]
    as_of = resolve_as_of(snap, cfg)
    latest = snap[snap["snapshot_date"] == as_of]
    mats, sups, po = ds["dim_material"], ds["dim_supplier"], ds["fact_purchase_order_receipt"]
    prod = ds["fact_production_order"]
    return [
        snapshot_continuity(snap, cfg),
        plant_flip(snap),
        safety_stock_mismatch(latest, mats),
        po_status(po),
        future_receipts(po, as_of),
        uncounted_future_receipts(po, as_of, cfg),
        supplier_category(po, mats, sups),
        missing_supplier(mats, sups),
        broken_link(prod, ds.get("fact_customer_order")),
        stale_data(as_of, today or date.today(), cfg),
        mixed_uom(mats),
        plan_coverage(prod, as_of),
        deductions(latest),
    ]
