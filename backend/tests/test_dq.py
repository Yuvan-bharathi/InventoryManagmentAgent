"""Every DQ check fires on the real dataset (deductions: no such row exists, tested on a constructed row)."""
from datetime import date

import pandas as pd

from app.dq import checks
from conftest import AS_OF


def test_checks_fire_on_real_dataset(ds, cfg):
    res = {r.check_id: r for r in checks.run_dq(ds, cfg, today=date(2026, 11, 11))}
    expected = {"snapshot_continuity": None, "plant_flip": 72, "ss_mismatch": 72, "po_status": 437,
                "future_receipts": 231, "uncounted_future_receipts": 231, "supplier_category": 1155, "missing_supplier": 2, "broken_link": 450,
                "stale_data": 1, "mixed_uom": 3, "plan_coverage": 0}
    for cid, n in expected.items():
        assert res[cid].fired, cid
        if n is not None:
            assert res[cid].affected_count == n, cid
    assert "11 days old" in res["stale_data"].message
    assert not res["deductions"].fired  # the real data has no such row


def test_stale_not_fired_when_fresh(cfg):
    assert not checks.stale_data(AS_OF, date(2026, 11, 1), cfg).fired


def test_deductions_fires_on_constructed_row():
    latest = pd.DataFrame([{"material_id": "M1", "plant_id": "P1", "warehouse_id": "W1", "on_hand_qty": 10,
                            "allocated_qty": 8, "blocked_qty": 5, "quality_hold_qty": 0}])
    r = checks.deductions(latest)
    assert r.fired and r.severity == "error" and r.affected_count == 1
