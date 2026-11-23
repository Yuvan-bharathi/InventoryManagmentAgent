"""Daily projection, shortage date, max stock and status per material x plant.

Projected(d) = Usable + in-transit (A7) + open PO receipts up to d (A8-A10) - requirements up to d.
Shortage date = first day projected < safety stock.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.config import EngineConfig

KEY = ["material_id", "plant_id"]
STATUSES = ("critical", "at_risk", "excess", "healthy", "stale")


def _daily(flows: pd.DataFrame, days: pd.DatetimeIndex, pairs: pd.DataFrame) -> pd.DataFrame:
    """Sum flows (material, plant, date, qty) onto the day grid; cumulative per pair."""
    grid = pairs[KEY].merge(pd.DataFrame({"date": days}), how="cross")
    f = flows.loc[flows["date"].isin(days)].groupby(KEY + ["date"], as_index=False)["qty"].sum()
    g = grid.merge(f, on=KEY + ["date"], how="left").fillna({"qty": 0})
    g["cum"] = g.groupby(KEY)["qty"].cumsum()
    return g


def project(position: pd.DataFrame, transit: pd.DataFrame, po_lines: pd.DataFrame, reqs: pd.DataFrame,
            lead_times: pd.DataFrame, bom_materials: set[str], as_of: pd.Timestamp,
            cfg: EngineConfig) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (daily projection, one summary row per material x plant)."""
    days = pd.date_range(as_of + pd.Timedelta(days=1), periods=cfg.horizon_days, freq="D")
    pairs = position[KEY]
    # Supply dated before day 1 cannot happen (A10 dates are >= as-of + 1), but clamp defensively.
    po_flow = po_lines.rename(columns={"open_qty": "qty", "expected_date": "date"})[KEY + ["date", "qty"]].copy()
    po_flow["date"] = po_flow["date"].clip(lower=days[0])
    tr = _daily(transit[KEY + ["date", "qty"]], days, pairs).rename(columns={"qty": "in_transit_in", "cum": "cum_transit"})
    po = _daily(po_flow, days, pairs).rename(columns={"qty": "po_receipts", "cum": "cum_po"})
    rq = _daily(reqs[KEY + ["date", "qty"]], days, pairs).rename(columns={"qty": "requirement", "cum": "cum_req"})

    daily = tr.merge(po, on=KEY + ["date"]).merge(rq, on=KEY + ["date"])
    daily = daily.merge(position[KEY + ["usable_qty", "ss_qty"]], on=KEY)
    daily["projected_qty"] = daily["usable_qty"] + daily["cum_transit"] + daily["cum_po"] - daily["cum_req"]

    s = position.merge(lead_times[["material_id", "lt_days", "lt_source", "supplier_id", "supplier_assigned"]],
                       on="material_id", how="left")
    totals = daily.groupby(KEY).agg(
        demand_horizon_qty=("requirement", "sum"),
        po_in_horizon_qty=("po_receipts", "sum"),
        min_projected_qty=("projected_qty", "min"),
        peak_projected_qty=("projected_qty", "max"),
        end_projected_qty=("projected_qty", "last"),
    ).reset_index()
    s = s.merge(totals, on=KEY, how="left")
    s["daily_demand_qty"] = s["demand_horizon_qty"] / cfg.horizon_days
    s["has_demand_basis"] = s["material_id"].isin(bom_materials)  # A17

    # A14: max = SS + daily demand x (LT + review) x factor
    s["max_qty"] = s["ss_qty"] + s["daily_demand_qty"] * (s["lt_days"] + cfg.review_days) * cfg.max_factor

    below = daily[daily["projected_qty"] < daily["ss_qty"]]
    first = below.groupby(KEY)["date"].min().rename("shortage_date").reset_index()
    s = s.merge(first, on=KEY, how="left")
    s["days_to_shortage"] = (s["shortage_date"] - as_of).dt.days
    shortage_in_lt = s["days_to_shortage"].notna() & (s["days_to_shortage"] <= s["lt_days"])
    has_shortage = s["shortage_date"].notna()

    # Protection window = lead time + review period (capped at the horizon).
    s["window_days"] = (s["lt_days"] + cfg.review_days).clip(upper=cfg.horizon_days)
    w = daily.merge(s[KEY + ["window_days", "max_qty"]], on=KEY)
    w = w[(w["date"] - as_of).dt.days <= w["window_days"]]
    win = w.assign(above=w["projected_qty"] > w["max_qty"],
                   inband=(w["projected_qty"] >= w["ss_qty"]) & (w["projected_qty"] <= w["max_qty"])) \
        .groupby(KEY).agg(window_all_above_max=("above", "all"), window_in_band=("inband", "all"),
                          window_min_qty=("projected_qty", "min"), window_peak_qty=("projected_qty", "max")) \
        .reset_index()
    s = s.merge(win, on=KEY, how="left")
    excess = s["window_all_above_max"].fillna(False).astype(bool)
    in_band = s["window_in_band"].fillna(False).astype(bool)
    # Precedence: stale > critical > at risk > excess > healthy. A pair with no shortage in the
    # horizon that is above max on only part of the window is 'healthy' (not excess) — see decisions log.
    s["status"] = np.select(
        [~s["has_demand_basis"], shortage_in_lt, has_shortage, excess],
        ["stale", "critical", "at_risk", "excess"], default="healthy")
    # Inventory Health: projection within [SS, max] across the protection window.
    s["within_band"] = s["has_demand_basis"] & in_band
    s["days_of_cover"] = np.where(s["daily_demand_qty"] > 0, s["usable_qty"] / s["daily_demand_qty"].replace(0, np.nan), np.nan)
    s.loc[~s["has_demand_basis"], "shortage_date"] = pd.NaT
    s.loc[~s["has_demand_basis"], "days_to_shortage"] = np.nan
    return daily, s


def inventory_health_pct(summary: pd.DataFrame) -> float | None:
    """Share of material x plant pairs with a demand basis whose status is healthy (decisions log D3)."""
    basis = summary[summary["has_demand_basis"]]
    if basis.empty:
        return None
    return round(100.0 * (basis["status"] == "healthy").mean(), 1)
