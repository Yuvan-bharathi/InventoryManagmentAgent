"""Proposal maths on hand-checked cases (pure engine, no database).

Hand case — material M, horizon 10, review 7, LT 4, price ₹10, MOQ 200, manager threshold ₹1,000:
  Destination A: usable 100, SS 50, demand 20/day -> projected 80, 60, 40 (< SS on day 3 <= LT) -> critical
     max    = 50 + 20 x (4 + 7) x 1.5 = 380;  target = min(50 + 20 x 11, 380) = 270
     arrival = day 4, projected 20 -> gap = 270 - 20 = 250
  Source B: usable 300, SS 100, demand 10/day -> projected 290 ... 200 (never < SS) -> healthy
     surplus by formula = 300 - need over LT (4 x 10 = 40) - 100 = 160
     headroom over horizon = min(projected) - SS = 200 - 100 = 100  -> transferable = 100
  Transfer B -> A: 100 (value ₹1,000, level 1); purchase raw = 250 - 100 = 150 -> MOQ 200 (value ₹2,000, level 2)
  After the transfer B's lowest projection is 200 - 100 = 100 = SS: no shortage created at the source.
"""
from types import SimpleNamespace

import pandas as pd
import pytest

from app.engine import projection
from app.engine.proposals import build_proposals
from conftest import AS_OF, pair


def d(n):
    return AS_OF + pd.Timedelta(days=n)


@pytest.fixture
def hand(cfg):
    c = cfg.with_(horizon_days=10, review_days=7, manager_threshold_inr=1000.0, in_transit_days=3)
    pos = pd.DataFrame({"material_id": ["M", "M"], "plant_id": ["A", "B"], "usable_qty": [100.0, 300.0],
                        "ss_qty": [50.0, 100.0], "standard_price_inr": [10.0, 10.0], "uom": ["EA", "EA"],
                        "moq": [200.0, 200.0]})
    reqs = pd.concat([pd.DataFrame({"material_id": "M", "plant_id": p, "date": [d(i) for i in range(1, 11)],
                                    "qty": q}) for p, q in (("A", 20.0), ("B", 10.0))], ignore_index=True)
    none = pd.DataFrame({"material_id": [], "plant_id": [], "date": pd.to_datetime([]), "qty": []})
    po = pd.DataFrame({"material_id": [], "plant_id": [], "expected_date": pd.to_datetime([]), "open_qty": []})
    lt = pd.DataFrame({"material_id": ["M"], "lt_days": [4], "lt_source": ["master"], "supplier_id": ["S1"],
                       "supplier_assigned": [True]})
    daily, summary = projection.project(pos, none, po, reqs, lt, {"M"}, AS_OF, c)
    summary["assumption_ids"] = [["A1"], ["A1"]]
    ranked = pd.DataFrame({"material_id": ["M"], "supplier_id": ["S1"], "rank": [1], "on_time_pct": [0.8],
                           "on_time_basis": ["supplier x material"], "actual_lt_days": [3.5],
                           "standard_lead_time_days": [5], "receipts": [4]})
    res = SimpleNamespace(summary=summary, daily=daily, as_of=AS_OF, requirements=reqs, ranked_suppliers=ranked,
                          position=pos)
    return res, c


def test_hand_case_statuses(hand):
    res, _ = hand
    assert pair(res.summary, "M", "A")["status"] == "critical"
    assert pair(res.summary, "M", "B")["status"] == "healthy"
    assert pair(res.summary, "M", "A")["max_qty"] == 380


def test_transfer_before_purchase_and_moq(hand):
    res, c = hand
    p = build_proposals(res, c).set_index("kind")
    t, b = p.loc["transfer"], p.loc["purchase"]
    assert t["source_plant_id"] == "B" and t["plant_id"] == "A" and t["qty"] == 100
    assert t["inputs"]["transfer"]["surplus_by_formula_qty"] == 160
    assert t["inputs"]["transfer"]["headroom_over_horizon_qty"] == 100
    assert t["value_inr"] == 1000 and t["approval_level"] == 1  # not above the threshold
    i = b["inputs"]
    assert i["target_qty"] == 270 and i["projected_at_arrival_qty"] == 20 and i["gap_qty"] == 250
    assert i["raw_qty"] == 150 and i["moq_applied"] and b["qty"] == 200
    assert b["supplier_id"] == "S1" and b["value_inr"] == 2000 and b["approval_level"] == 2
    assert b["arrival_date"] == d(4) and b["in_time"] == "expedite"  # shortage day 3 < arrival day 4


def test_transfer_never_creates_source_shortage(hand):
    res, c = hand
    t = build_proposals(res, c).set_index("kind").loc["transfer"]
    src = res.daily[res.daily.plant_id == "B"]["projected_qty"] - t["qty"]
    assert (src >= 100).all()


def test_no_transfer_from_a_plant_that_is_short(hand):
    res, c = hand
    res.summary.loc[res.summary.plant_id == "B", "status"] = "at_risk"
    p = build_proposals(res, c)
    assert set(p["kind"]) == {"purchase"} and p.iloc[0]["qty"] == 250  # full gap, above MOQ


def test_real_proposals_follow_formula(result, cfg):
    p = build_proposals(result, cfg)
    for r in p[p.kind == "purchase"].itertuples():
        i = r.inputs
        target = min(i["safety_stock_qty"] + i["daily_demand_qty"] * (i["lead_time_days"] + i["review_days"]), i["max_qty"])
        assert abs(i["target_qty"] - target) < 1e-6
        assert abs(i["gap_qty"] - max(0, target - i["projected_at_arrival_qty"])) < 1e-6
        assert r.qty == max(-(-i["raw_qty"] // 1), i["moq_qty"]) or r.qty == -(-max(i["raw_qty"], i["moq_qty"]) // 1)
        assert r.approval_level == (2 if r.value_inr > cfg.manager_threshold_inr else 1)
        assert r.value_inr == r.qty * r.unit_price_inr
    # every transfer source keeps >= SS over the whole horizon
    for r in p[p.kind == "transfer"].itertuples():
        src = result.daily[(result.daily.material_id == r.material_id) & (result.daily.plant_id == r.source_plant_id)]
        assert (src["projected_qty"] - r.qty >= src["ss_qty"]).all()
