"""Material requirements from a production plan x BOM (A15, A17)."""
from __future__ import annotations

import pandas as pd

from app.config import EngineConfig

DONE_STATUSES = ("CLOSED", "COMPLETED")
BACKLOG_STATUSES = ("RELEASED", "IN_PROGRESS")  # A21: open orders still owed


def effective_bom(bom: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    """BOM rows effective on the as-of date; qty per = component_qty x (1 + scrap_factor)."""
    b = bom.loc[(bom["effective_from"] <= as_of) & (bom["effective_to"] >= as_of)].copy()
    b["qty_per"] = b["component_qty"] * (1 + b["scrap_factor"])
    return b[["product_id", "material_id", "qty_per", "revision"]].reset_index(drop=True)


def demand_plan(production_orders: pd.DataFrame, scenario: pd.DataFrame | None,
                as_of: pd.Timestamp, cfg: EngineConfig) -> pd.DataFrame:
    """Orders that create demand inside the horizon (as-of, as-of + horizon].

    A15: source is the planning scenario or the organization's production orders; both share the
    fact_production_order schema, so switching demand_source needs no code change.
    """
    if cfg.demand_source == "scenario":
        if scenario is None:
            raise ValueError("demand_source = scenario but no planning scenario was supplied")
        plan = scenario
    elif cfg.demand_source == "production_orders":
        plan = production_orders_plan(production_orders, as_of, cfg)
    else:
        raise ValueError(f"Unknown demand_source: {cfg.demand_source}")
    end = as_of + pd.Timedelta(days=cfg.horizon_days)
    out = plan.loc[(plan["planned_start"] > as_of) & (plan["planned_start"] <= end)].reset_index(drop=True)
    if "backlog" not in out:
        out["backlog"] = False
    return out


def production_orders_plan(production_orders: pd.DataFrame, as_of: pd.Timestamp, cfg: EngineConfig) -> pd.DataFrame:
    """The organization's production orders as demand.

    Orders planned after as-of keep their planned start. A21 (`overdue_backlog = as_of_plus_1`): open orders
    (RELEASED / IN_PROGRESS) planned on or before as-of are still owed and fall due on as-of + 1 for their full
    order_qty (no reliable record of what is already built). `exclude` drops them (future orders only).
    """
    po = production_orders.loc[~production_orders["order_status"].isin(DONE_STATUSES)].copy()
    po["backlog"] = False
    past = po["planned_start"] <= as_of
    if cfg.overdue_backlog == "as_of_plus_1":
        owed = past & po["order_status"].isin(BACKLOG_STATUSES)
        po.loc[owed, "planned_start"] = as_of + pd.Timedelta(days=1)
        po.loc[owed, "backlog"] = True
    elif cfg.overdue_backlog != "exclude":
        raise ValueError(f"Unknown overdue_backlog: {cfg.overdue_backlog}")
    return po


def requirements(plan: pd.DataFrame, bom_eff: pd.DataFrame) -> pd.DataFrame:
    """Requirement per material x plant x day (on the order's planned start)."""
    r = plan[["production_order_id", "plant_id", "product_id", "order_qty", "planned_start"]].merge(
        bom_eff, on="product_id", how="inner")
    r["qty"] = r["order_qty"] * r["qty_per"]
    return r.groupby(["material_id", "plant_id", "planned_start"], as_index=False)["qty"].sum() \
        .rename(columns={"planned_start": "date"})
