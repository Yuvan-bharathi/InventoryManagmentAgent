"""Current stock position: usable stock, in-transit and safety stock per material x plant.

Pure functions over DataFrames; every threshold comes from EngineConfig.
"""
from __future__ import annotations

import pandas as pd

from app.config import EngineConfig

KEY = ["material_id", "plant_id"]


class MixedUoMError(ValueError):
    """Raised when quantities of different materials would be summed (rule 8)."""


def sum_quantity(df: pd.DataFrame, col: str) -> float:
    """The only sanctioned way to total a quantity column: refuses to mix materials."""
    if df["material_id"].nunique() > 1:
        raise MixedUoMError(f"Refusing to sum '{col}' across {df['material_id'].nunique()} materials; "
                            "totals across materials are in INR only.")
    return float(df[col].sum())


def resolve_as_of(snapshot: pd.DataFrame, cfg: EngineConfig) -> pd.Timestamp:
    """A1: as-of = latest snapshot_date unless configured to a fixed date."""
    if cfg.as_of_date == "latest":
        return pd.Timestamp(snapshot["snapshot_date"].max()).normalize()
    return pd.Timestamp(cfg.as_of_date).normalize()


def stock_rows(snapshot: pd.DataFrame, as_of: pd.Timestamp, cfg: EngineConfig) -> pd.DataFrame:
    """Snapshot rows on the as-of date with usable quantity and exclusion flag.

    A2: plant = plant_id on the row.  A3: usable = on_hand - deductions, floored at 0.
    A4: inventory_status is ignored.  A6: warehouse filter.
    Rows whose deductions exceed on_hand are kept but flagged `excluded` (DQ error) and carry 0 usable.
    """
    rows = snapshot.loc[snapshot["snapshot_date"] == as_of].copy()
    if cfg.production_warehouses != "all":
        rows = rows[rows["warehouse_id"].isin(cfg.production_warehouses)]
    ded = rows[["allocated_qty", "blocked_qty", "quality_hold_qty"]]
    rows["excluded"] = ded.sum(axis=1) > rows["on_hand_qty"]
    if cfg.deductions_overlap:
        # Overlapping deductions: the largest one is assumed to contain the others.
        deduction = ded.max(axis=1)
    else:
        deduction = ded.sum(axis=1)
    rows["usable_qty"] = (rows["on_hand_qty"] - deduction).clip(lower=0).where(~rows["excluded"], 0)
    rows["usable_value_inr"] = rows["usable_qty"] * rows["unit_cost_inr"]
    rows["on_hand_value_inr"] = rows["on_hand_qty"] * rows["unit_cost_inr"]
    return rows.reset_index(drop=True)


def stock_position(rows: pd.DataFrame, materials: pd.DataFrame, plants: pd.DataFrame,
                   cfg: EngineConfig) -> pd.DataFrame:
    """One row per material x plant (full cross product; pairs without stock get 0).

    Quantities are summed only within one material (same UoM).
    """
    universe = materials[["material_id", "material_category", "uom", "standard_price_inr",
                          "safety_stock_qty", "lead_time_days", "moq"]].merge(
        plants[["plant_id"]], how="cross")
    ok = rows[~rows["excluded"]]
    agg = ok.groupby(KEY).agg(
        on_hand_qty=("on_hand_qty", "sum"),
        allocated_qty=("allocated_qty", "sum"),
        blocked_qty=("blocked_qty", "sum"),
        quality_hold_qty=("quality_hold_qty", "sum"),
        usable_qty=("usable_qty", "sum"),
        in_transit_qty=("in_transit_qty", "sum"),
        snapshot_ss_qty=("safety_stock_qty", "sum"),
        usable_value_inr=("usable_value_inr", "sum"),
        on_hand_value_inr=("on_hand_value_inr", "sum"),
        stock_rows=("lot_id", "size"),
        earliest_expiry=("expiry_date", "min"),
    ).reset_index()
    pos = universe.merge(agg, on=KEY, how="left")
    qty_cols = ["on_hand_qty", "allocated_qty", "blocked_qty", "quality_hold_qty", "usable_qty",
                "in_transit_qty", "snapshot_ss_qty", "usable_value_inr", "on_hand_value_inr", "stock_rows"]
    pos[qty_cols] = pos[qty_cols].fillna(0)
    # A5: safety stock from the master (per material x plant) or summed from the snapshot.
    pos["ss_qty"] = pos["safety_stock_qty"] if cfg.ss_source == "master" else pos["snapshot_ss_qty"]
    return pos.drop(columns=["safety_stock_qty"]).rename(columns={"lead_time_days": "master_lead_time_days"})


def in_transit_arrivals(position: pd.DataFrame, as_of: pd.Timestamp, cfg: EngineConfig) -> pd.DataFrame:
    """A7: snapshot in-transit arrives in_transit_days after as-of."""
    arr = position.loc[position["in_transit_qty"] > 0, KEY + ["in_transit_qty"]].copy()
    arr["date"] = as_of + pd.Timedelta(days=cfg.in_transit_days)
    return arr.rename(columns={"in_transit_qty": "qty"})
