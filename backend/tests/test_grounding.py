"""Grounding check v2 (D42): renderings of tool values pass; invented numbers and dates fail. Pure, no database."""
import pytest

from app.agent.loop import ungrounded_numbers, ungrounded_numbers_v1
from app.agent.tools import ToolResult

R = [ToolResult({"excess_value_inr": 5700450, "on_hand_value_inr": 367983279, "health_pct": 12.5, "on_time_pct": 0.8533,
                 "usable": 15211.4, "shortage_date": "2026-11-27", "lt_days": 23, "other_inr": 3700000})]


@pytest.mark.parametrize("text", ["₹57.00 lakh", "₹57 lakh", "₹36.80 Cr", "₹36.8 crore", "12.5%", "13%", "85%", "85.3%",
                                  "15,211 EA", "15211.4", "27-Nov-2026", "27 Nov 2026", "November 27", "Nov 27, 2026",
                                  "2026-11-27", "lead time 23 days", "₹37 lakh"])
def test_renderings_are_grounded(text):
    assert ungrounded_numbers(text, R) == set()


@pytest.mark.parametrize("text,bad", [("₹58 lakh", "58"), ("28-Nov-2026", "28-Nov-2026"), ("15,300 EA", "15,300"),
                                      ("₹1.45 Cr", "1.45"), ("37 pairs", "37"), ("Dec 3", "Dec 3")])
def test_invented_numbers_fail(text, bad):
    assert bad in ungrounded_numbers(text, R)


def test_v1_false_positives_that_v2_fixes():
    for text in ["85%", "27 Nov 2026", "November 27"]:
        assert ungrounded_numbers_v1(text, R) and not ungrounded_numbers(text, R)


def test_ids_and_small_counts_are_ignored():
    assert ungrounded_numbers("MAT-SOC-001 at IN-TN-01 (PR-0041-013, SUP-002, A15): 3 pairs", R) == set()
