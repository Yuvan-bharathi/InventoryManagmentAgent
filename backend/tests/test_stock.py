"""Usable stock and assumption switches A1, A3, A5, A6, A7 — hand-checked on real snapshot rows.

MAT-SOC-001 @ IN-KA-01 on 2026-10-31 (on_hand - allocated - blocked - quality_hold):
  RM-WH-01   5109 - 1082 - 150 -  74 = 3803
  SMT-KIT-01 7028 - 2353 -  75 -  80 = 4520
  WIP-WH-01  6000 - 1481 - 154 - 113 = 4252
  FG-WH-01   4406 - 1562 - 165 -  43 = 2636      total 15211
  in-transit 872 + 774 + 548 + 983 = 3177;  snapshot SS 673 + 1352 + 1581 + 1773 = 5379;  master SS 1643
"""
import pandas as pd
import pytest

from app.engine import stock
from app.engine.run import run_engine
from conftest import AS_OF, pair


def _position(ds, cfg):
    snap = ds["fact_inventory_daily_snapshot"]
    rows = stock.stock_rows(snap, stock.resolve_as_of(snap, cfg), cfg)
    return stock.stock_position(rows, ds["dim_material"], ds["dim_plant"], cfg), rows


def test_as_of_is_latest_snapshot(ds, cfg):
    assert stock.resolve_as_of(ds["fact_inventory_daily_snapshot"], cfg) == AS_OF


def test_a1_fixed_as_of(ds, cfg):
    assert stock.resolve_as_of(ds["fact_inventory_daily_snapshot"], cfg.with_(as_of_date="2026-10-30")) \
        == pd.Timestamp("2026-10-30")


def test_usable_row_and_plant_total(ds, cfg):
    pos, rows = _position(ds, cfg)
    r = rows[(rows.material_id == "MAT-SOC-001") & (rows.plant_id == "IN-KA-01") & (rows.warehouse_id == "RM-WH-01")]
    assert r["usable_qty"].item() == 3803
    p = pair(pos, "MAT-SOC-001", "IN-KA-01")
    assert p["usable_qty"] == 15211
    assert p["in_transit_qty"] == 3177
    assert p["ss_qty"] == 1643


def test_pairs_without_stock_are_present_with_zero(ds, cfg):
    pos, _ = _position(ds, cfg)
    assert len(pos) == 36
    for mat, plant in [("MAT-SOC-001", "IN-TN-01"), ("MAT-CAM-008", "IN-TN-01"), ("MAT-ADH-018", "IN-KA-01")]:
        assert pair(pos, mat, plant)["usable_qty"] == 0


def test_a3_overlap_switch(ds, cfg):
    pos, rows = _position(ds, cfg.with_(deductions_overlap=True))
    r = rows[(rows.material_id == "MAT-SOC-001") & (rows.plant_id == "IN-KA-01") & (rows.warehouse_id == "RM-WH-01")]
    assert r["usable_qty"].item() == 5109 - 1082  # largest deduction only
    assert pair(pos, "MAT-SOC-001", "IN-KA-01")["usable_qty"] > 15211


def test_a5_snapshot_safety_stock_switch(ds, cfg):
    pos, _ = _position(ds, cfg.with_(ss_source="snapshot"))
    assert pair(pos, "MAT-SOC-001", "IN-KA-01")["ss_qty"] == 5379


def test_a6_warehouse_filter(ds, cfg):
    pos, _ = _position(ds, cfg.with_(production_warehouses=("RM-WH-01",)))
    assert pair(pos, "MAT-SOC-001", "IN-KA-01")["usable_qty"] == 3803


def test_a7_in_transit_days_changes_result(ds, cfg, scenario, result):
    late = run_engine(ds, cfg.with_(in_transit_days=30), scenario)
    a = result.daily.set_index(["material_id", "plant_id", "date"])["projected_qty"]
    b = late.daily.set_index(["material_id", "plant_id", "date"])["projected_qty"]
    day3 = (("MAT-SOC-001", "IN-KA-01", AS_OF + pd.Timedelta(days=3)))
    assert a.loc[day3] - b.loc[day3] == 3177


def test_deductions_above_on_hand_are_excluded(cfg):
    snap = pd.DataFrame([{
        "snapshot_date": AS_OF, "plant_id": "P1", "material_id": "M1", "warehouse_id": "W1", "lot_id": "L1",
        "on_hand_qty": 100, "allocated_qty": 80, "blocked_qty": 30, "quality_hold_qty": 0, "in_transit_qty": 0,
        "safety_stock_qty": 0, "inventory_status": "AVAILABLE", "unit_cost_inr": 1.0, "expiry_date": pd.NaT}])
    rows = stock.stock_rows(snap, AS_OF, cfg)
    assert rows["excluded"].item() and rows["usable_qty"].item() == 0


def test_no_cross_material_quantity_sum(result):
    with pytest.raises(stock.MixedUoMError):
        stock.sum_quantity(result.position, "usable_qty")
    one = result.position[result.position.material_id == "MAT-SOC-001"]
    assert stock.sum_quantity(one, "usable_qty") == 15211


def test_values_in_inr(result):
    p = pair(result.position, "MAT-SOC-001", "IN-KA-01")
    assert p["usable_value_inr"] == 15211 * 4200
