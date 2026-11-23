"""Planning scenario (A15): fills the missing forward production plan.

Writes data/scenario/fact_production_order_plan.csv in the same schema as fact_production_order,
with order_status = PLANNED. Deterministic (no randomness), so every run produces the same file:
- horizon: cfg.horizon_days from as-of + 1, per plant
- volume: cfg.scenario_daily_units_per_plant units per plant per day
- mix: historical share of order_qty by product and plant, split with largest-remainder rounding

Usage:  python -m seed.planning_scenario [dataset_path]
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

from app.config import EngineConfig, get_settings
from app.engine.demand import effective_bom
from app.engine.stock import resolve_as_of
from app.ingest.reader import Dataset, read_dataset

SCENARIO_LABEL = "Planning scenario – replace with the organization's plan"


def product_mix(history: pd.DataFrame) -> pd.DataFrame:
    """Historical share of order_qty per product within each plant."""
    q = history.groupby(["plant_id", "product_id"], as_index=False)["order_qty"].sum()
    q["share"] = q["order_qty"] / q.groupby("plant_id")["order_qty"].transform("sum")
    return q[["plant_id", "product_id", "share"]]


def split_units(shares: pd.Series, units: int) -> pd.Series:
    """Largest-remainder split of `units` by `shares` (sums exactly to units)."""
    raw = shares * units
    base = raw.astype(int)
    rest = units - int(base.sum())
    order = (raw - base).sort_values(ascending=False, kind="mergesort").index[:rest]
    base.loc[order] += 1
    return base


def generate(ds: Dataset, cfg: EngineConfig) -> pd.DataFrame:
    history = ds["fact_production_order"]
    as_of = resolve_as_of(ds["fact_inventory_daily_snapshot"], cfg)
    mix = product_mix(history)
    mix["units"] = 0
    for plant, idx in mix.groupby("plant_id").groups.items():
        mix.loc[idx, "units"] = split_units(mix.loc[idx, "share"], cfg.scenario_daily_units_per_plant)
    mix = mix[mix["units"] > 0]

    bom_rev = effective_bom(ds["fact_bom_component"], as_of).drop_duplicates("product_id") \
        .set_index("product_id")["revision"]
    routing = history.groupby(["plant_id", "product_id"])["routing_revision"].agg(lambda s: s.mode().iat[0]) \
        if "routing_revision" in history.columns else None

    days = pd.date_range(as_of + pd.Timedelta(days=1), periods=cfg.horizon_days, freq="D")
    rows = []
    for d in days:
        for r in mix.itertuples(index=False):
            ts = d.strftime("%Y-%m-%dT00:00:00")
            rows.append({
                "production_order_id": f"PLN-{d:%Y%m%d}-{r.plant_id}-{r.product_id}",
                "plant_id": r.plant_id,
                "product_id": r.product_id,
                "customer_order_id": "",
                "order_qty": int(r.units),
                "priority": "MEDIUM",
                "planned_start": ts,
                "planned_finish": ts,
                "due_date": d.strftime("%Y-%m-%d"),
                "bom_revision": bom_rev.get(r.product_id, ""),
                "routing_revision": routing.get((r.plant_id, r.product_id), "") if routing is not None else "",
                "order_status": "PLANNED",
            })
    # Same schema (and column order) as fact_production_order.
    return pd.DataFrame(rows, columns=list(history.columns))


def write(df: pd.DataFrame, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    return path


def main(argv: list[str]) -> None:
    settings = get_settings()
    ds = read_dataset(argv[0] if argv else settings.raw_data_path)
    cfg = EngineConfig.from_seed()
    df = generate(ds, cfg)
    out = write(df, settings.scenario_path)
    per_day = df.groupby(["plant_id", "planned_start"])["order_qty"].sum()
    print(f"Wrote {len(df)} planned orders to {out}")
    print(f"Units per plant per day: min {per_day.min()}, max {per_day.max()}")


if __name__ == "__main__":
    main(sys.argv[1:])
