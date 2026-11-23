"""Demand-based KPIs shared by the run, the Executive Overview, the brief and the agent.

Pure functions on a material x plant status frame. Totals across materials are in INR only (rule 8);
quantity ratios are per material x plant pair.
"""
from __future__ import annotations

import pandas as pd

SHORT = ("critical", "at_risk")


def _r(v: float | None, n: int = 1) -> float | None:
    return None if v is None or pd.isna(v) else round(float(v), n)


def demand_kpis(df: pd.DataFrame, price_col: str = "standard_price_inr") -> dict:
    """KPIs from the deck that this dataset supports.

    days_of_inventory: usable INR / daily demand INR, over pairs with a demand basis (A17).
    stockout_risk_pairs: pairs projected below zero (line stops) within their lead time.
    demand_multiple: per pair, horizon requirement / usable stock (pairs with stock and demand) - min, median, max.
    """
    basis = df[df["has_demand_basis"]]
    daily_inr = float((basis["daily_demand_qty"] * basis[price_col]).sum())
    usable_inr = float(basis["usable_value_inr"].sum())
    so = basis["days_to_stockout"]
    at_risk = basis[so.notna() & (so <= basis["lt_days"])]
    with_dem = basis[basis["demand_horizon_qty"] > 0]
    stocked = with_dem[with_dem["usable_qty"] > 0]
    ratio = stocked["demand_horizon_qty"] / stocked["usable_qty"]
    return {
        "days_of_inventory": _r(usable_inr / daily_inr) if daily_inr > 0 else None,
        "stockout_risk_pairs": int(len(at_risk)),
        "pairs_with_demand": int(len(basis)),
        "short_pairs": int(basis["status"].isin(SHORT).sum()),
        "demand_multiple": {"min": _r(ratio.min()), "median": _r(ratio.median()), "max": _r(ratio.max()),
                            "pairs": int(len(stocked)), "zero_stock_pairs": int(len(with_dem) - len(stocked))}
        if len(stocked) else None,
    }


def status_counts(df: pd.DataFrame, statuses: tuple[str, ...]) -> dict:
    return {k: int((df["status"] == k).sum()) for k in statuses}
