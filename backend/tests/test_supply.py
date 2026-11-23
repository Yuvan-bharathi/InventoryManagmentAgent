"""Open PO supply (A8-A10), lead times (A18) and approved vendors (A11) — real PO lines.

POC-000001 PARTIAL SUP-009: 6451 - 6191 = 260 open; promised 24-Oct and receipt 30-Oct both <= as-of
           -> overdue, expected as-of + SUP-009 avg delay (mean 1.8 -> 2 days) = 2026-11-02   (A10)
POC-000009 PARTIAL: 10370 - 10158 = 212 open; receipt_date 2026-11-06 > as-of -> expected 06-Nov (A9)
POC-000047 OPEN:    3335 - 3213 = 122 open; promised 2026-11-05 > as-of -> expected 05-Nov
POC-000003 CLOSED:  received 665 of 669 -> short-closed, nothing due                           (A8)
"""
import pandas as pd

from app.engine import supply
from conftest import AS_OF


def _line(result, po_id):
    return result.po_lines.set_index("po_id").loc[po_id]


def test_overdue_line_uses_supplier_delay(result):
    assert result.supplier_delays["SUP-009"] == 2
    ln = _line(result, "POC-000001")
    assert ln["open_qty"] == 260
    assert ln["expected_date"] == pd.Timestamp("2026-11-02")
    assert ln["overdue"]


def test_future_receipt_date_is_expected_date(result):
    ln = _line(result, "POC-000009")
    assert ln["open_qty"] == 212 and ln["expected_date"] == pd.Timestamp("2026-11-06")
    assert not ln["overdue"]


def test_future_promised_date(result):
    ln = _line(result, "POC-000047")
    assert ln["open_qty"] == 122 and ln["expected_date"] == pd.Timestamp("2026-11-05")


def test_closed_lines_contribute_nothing(result):
    assert "POC-000003" not in set(result.po_lines["po_id"])
    assert set(result.po_lines["po_status"]) <= {"OPEN", "PARTIAL"}


def test_expected_dates_never_before_day_one(result):
    assert (result.po_lines["expected_date"] > AS_OF).all()


def test_actual_lead_time_hand_case():
    po = pd.DataFrame({
        "po_id": ["A", "B", "C"], "supplier_id": ["S1", "S1", "S1"], "material_id": ["M1", "M1", "M1"],
        "po_date": pd.to_datetime(["2026-10-01", "2026-10-05", "2026-10-20"]),
        "promised_date": pd.to_datetime(["2026-10-11", "2026-10-15", "2026-10-30"]),
        "receipt_date": pd.to_datetime(["2026-10-13", "2026-10-21", "2026-11-05"]),  # C is after as-of
    })
    alt = supply.actual_lead_times(po, AS_OF)
    assert alt["actual_lt_days"].item() == (12 + 16) / 2 and alt["receipts"].item() == 2


def test_supplier_choice_on_time_then_lead_time(result):
    """MAT-SOC-001: approved SUP-001 / SUP-002 (SEMICONDUCTOR). Rank 1 = higher on-time % for this material."""
    r = result.ranked_suppliers[result.ranked_suppliers.material_id == "MAT-SOC-001"].set_index("supplier_id")
    assert set(r.index) == {"SUP-001", "SUP-002"}
    best = r["rank"].idxmin()
    other = ({"SUP-001", "SUP-002"} - {best}).pop()
    assert (r.loc[best, "on_time_pct"], -r.loc[best, "rank_lt_days"]) >= (r.loc[other, "on_time_pct"], -r.loc[other, "rank_lt_days"])
    assert result.lead_times.set_index("material_id").loc["MAT-SOC-001", "supplier_id"] == best


def test_a20_lead_time_source_max_actual_master(ds, cfg, scenario, result):
    lt = result.lead_times.set_index("material_id")
    # MAT-SOC-001: chosen supplier's actual LT 19.2 -> 20 days > master 12 -> max = 20 (actual)
    assert lt.loc["MAT-SOC-001", "lt_days"] == 20 and lt.loc["MAT-SOC-001", "lt_source"] == "actual"
    # MAT-ANT-012: actual 11.75 -> 12 < master 35 -> max = 35 (master)
    assert lt.loc["MAT-ANT-012", "lt_days"] == 35 and lt.loc["MAT-ANT-012", "lt_source"] == "master"
    from app.engine.run import run_engine
    a = run_engine(ds, cfg.with_(lead_time_source="actual"), scenario).lead_times.set_index("material_id")
    m = run_engine(ds, cfg.with_(lead_time_source="master"), scenario).lead_times.set_index("material_id")
    assert a.loc["MAT-ANT-012", "lt_days"] == 12 and m.loc["MAT-SOC-001", "lt_days"] == 12
    # AUDIO / CONNECTOR have no approved supplier (A11): master LT, supplier to be assigned
    for mat, master in [("MAT-SPK-011", 13), ("MAT-CON-013", 7)]:
        assert lt.loc[mat, "lt_source"] == "master" and lt.loc[mat, "lt_days"] == master
        assert not lt.loc[mat, "supplier_assigned"]


def test_a19_future_receipt_mode(ds, result):
    po = ds["fact_purchase_order_receipt"]
    full = supply.open_po_lines(po, AS_OF, result.supplier_delays, "full_received_qty")
    extra = full[full["date_basis"] == "future received_qty (A19)"]
    assert len(extra) == 231
    # POC-000003 CLOSED, received 665 on 14-Nov (after as-of): counted only in full mode
    row = extra.set_index("po_id").loc["POC-000003"]
    assert row["open_qty"] == 665 and row["expected_date"] == pd.Timestamp("2026-11-14")
    assert "POC-000003" not in set(result.po_lines["po_id"])


def test_approved_vendors_by_category(ds):
    av = supply.approved_vendors(ds["dim_material"], ds["dim_supplier"])
    assert set(av[av.material_id == "MAT-SOC-001"]["supplier_id"]) == {"SUP-001", "SUP-002"}
    assert av[av.material_id.isin(["MAT-SPK-011", "MAT-CON-013"])].empty
