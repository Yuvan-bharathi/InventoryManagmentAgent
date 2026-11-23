"""Specialist routing rules (D38): pure, no database."""
import pytest

from app.agent.specialists import COORDINATOR, SPECIALISTS, choose, valid_choice


@pytest.mark.parametrize("q,expected", [
    ("How many data quality issues were found in the latest upload?", "data_reconciliation"),
    ("How old is the data we are using?", "data_reconciliation"),
    ("How healthy is our inventory overall?", "stock_monitoring"),
    ("What is the usable stock of MAT-SOC-001 at IN-KA-01?", "stock_monitoring"),
    ("Give me today's brief.", "stock_monitoring"),
    ("How many materials are critical, at risk, excess and healthy?", "stock_monitoring"),
    ("Will any line stop because of a material?", "shortage_forecast"),
    ("What are the 5 riskiest materials right now?", "shortage_forecast"),
    ("What is waiting for my approval, and why?", "replenishment"),
    ("How much MAT-SOC-001 should we order for IN-TN-01?", "replenishment"),
    ("Explain proposal PR-0041-008.", "replenishment"),
    ("Can we transfer MAT-NAND-003 to IN-TN-01 from the other plant?", "replenishment"),
    ("How much cash is tied up in stock we don't need?", "excess_obsolete"),
    ("What is about to expire or become waste?", "excess_obsolete"),
    ("If a supplier is late, what breaks?", "supplier_delay"),
    ("If SUP-006 is 10 days late, what breaks?", "supplier_delay"),
])
def test_keyword_rules_pick_one_specialist(q, expected):
    assert choose(q, {}) == ([expected], "keyword")


def test_two_specialist_question():
    names, method = choose("Which material is short in the next 7 days and how much cash is tied up in excess?", {})
    assert method == "keyword" and names == ["shortage_forecast", "excess_obsolete"]


@pytest.mark.parametrize("page,expected", [("Proposal Detail", "replenishment"), ("Shortage Horizon", "shortage_forecast"),
                                           ("Data Uploads", "data_reconciliation"), ("Material 360", "stock_monitoring")])
def test_page_context_when_no_keyword(page, expected):
    assert choose("Why this quantity?", {"page": page}) == ([expected], "page")


def test_unclear_goes_to_classifier_then_coordinator():
    assert choose("What should we worry about most this week?", {"page": "Agent Workspace"}) == ([], "unclear")
    assert valid_choice({"specialist": "shortage_forecast"}) == "shortage_forecast"
    assert valid_choice({"specialist": "Material Planner"}) == COORDINATOR  # Domo does not enforce the enum


def test_tool_split_covers_all_twelve_tools_once():
    from app.agent.tools import TOOLS
    owned = [t for s in SPECIALISTS.values() for t in s.tools]
    assert sorted(owned) == sorted(TOOLS) and len(owned) == len(set(owned)) == 12
