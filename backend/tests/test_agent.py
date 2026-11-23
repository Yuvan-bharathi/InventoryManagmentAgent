"""Agent tests with a scripted LLM (no Domo needed) on the live database, read-only, tenant ORG-01."""
import json

import pytest
from sqlalchemy import select

from app.agent import domo
from app.agent.loop import AgentConfig, answer, clear_tool_cache, route, ungrounded_numbers
from app.agent.tools import TOOLS, ToolResult
from app.config import get_settings

pytestmark = pytest.mark.skipif(not get_settings().database_url, reason="DATABASE_URL not set")


def _user(name="buyer"):
    from app import models as m
    from app.auth import principal_for
    from app.db import get_sessionmaker
    with get_sessionmaker()() as s:
        return principal_for(s, s.scalar(select(m.User).where(m.User.username == name)))


class Script:
    """Fake LLM returning queued replies; records prompts."""
    def __init__(self, *replies):
        self.replies = list(replies)
        self.prompts = []

    def __call__(self, inp, system):
        self.prompts.append(inp)
        r = self.replies.pop(0) if self.replies else '{"action":"final","answer":"done"}'
        return domo.Generation(text=r if isinstance(r, str) else json.dumps(r), model_id="fake", latency_ms=1,
                               usage={"input_tokens": len(inp) // 4, "output_tokens": 10})


@pytest.fixture(autouse=True)
def _fresh():
    clear_tool_cache()


def test_twelve_tools_and_none_writes():
    assert len(TOOLS) == 12
    assert not any(w in n for n in TOOLS for w in ("approve", "update", "create", "delete", "submit", "run_sql"))


@pytest.mark.parametrize("q,tool", [
    ("Will any line stop because of a material?", "get_shortage_horizon"),
    ("How much cash is tied up in stock we don't need?", "get_excess_inventory"),
    ("What is about to expire or become waste?", "get_expiring_lots"),
    ("What is waiting for my approval, and why?", "get_proposal_details"),
    ("If a supplier is late, what breaks?", "simulate_shortage_impact"),
    ("Which materials will go critical?", "get_shortage_horizon"),
    ("How much MAT-SOC-001 should we order for IN-TN-01?", "get_replenishment_options"),
    ("Can we transfer MAT-NAND-003 to IN-TN-01?", "get_transfer_options"),
])
def test_router(q, tool):
    assert route(q, {})[0] == tool


def test_loop_calls_tool_then_answers_grounded():
    llm = Script({"action": "tool", "tool": "get_inventory_overview", "args": {}},
                 {"action": "final", "answer": "PLACEHOLDER"})
    # make the final answer quote real numbers from the tool result
    def final_from_tool(inp, system):
        if "get_inventory_overview" in inp and "->" in inp:
            data = json.loads(inp.split("-> ", 1)[1].split("\n")[0])["data"]
            return domo.Generation(json.dumps({"action": "final", "answer":
                f"{data['status_counts']['critical']} pairs are critical, based on the planning scenario."}), "fake", 1, {})
        return llm(inp, system)
    out = answer("Give me an unusual summary please", {"page": "x"}, _user(),
                 AgentConfig(use_router=False, llm=final_from_tool))
    assert out["status"] == "ok" and out["route"] == "loop"
    assert [t["tool"] for t in out["tool_trace"]] == ["get_inventory_overview"]
    assert "critical" in out["answer"] and out["domo_calls"] == 2


def test_ungrounded_answer_falls_back_to_template():
    llm = Script({"action": "tool", "tool": "get_excess_inventory", "args": {}},
                 {"action": "final", "answer": "Excess is 987654321 rupees."})
    out = answer("something odd", {}, _user(), AgentConfig(use_router=False, llm=llm))
    assert out["status"] == "grounding_fallback" and "987654321" not in out["answer"]
    assert "tied up above maximum stock" in out["answer"]


def test_invalid_json_gets_one_repair():
    llm = Script("not json at all", {"action": "final", "answer": "No numbers here."})
    out = answer("hello there", {}, _user(), AgentConfig(use_router=False, llm=llm))
    assert out["status"] == "ok" and out["domo_calls"] == 2


def test_max_five_steps():
    llm = Script(*[{"action": "tool", "tool": "get_data_quality", "args": {}}] * 10)
    out = answer("loop forever", {}, _user(), AgentConfig(use_router=False, llm=llm))
    assert out["domo_calls"] == 5


def test_tenant_argument_is_ignored_and_plant_scope_enforced():
    llm = Script({"action": "tool", "tool": "get_inventory_overview", "args": {"tenant_id": "TST-01"}},
                 {"action": "final", "answer": "ok"})
    out = answer("x", {}, _user(), AgentConfig(use_router=False, llm=llm))
    assert out["tool_trace"][0]["args"] == {"tenant_id": "TST-01"}  # passed in, but stripped before the tool
    ka = _user("buyer.ka")
    out = answer("How much MAT-SOC-001 should we order for IN-TN-01?", {}, ka, AgentConfig(llm=Script()))
    assert out["status"] == "no_permission"


def test_router_phrasing_must_be_grounded():
    llm = Script({"answer": "There are 4242 critical pairs."})
    out = answer("Which materials will go critical?", {}, _user(), AgentConfig(llm=llm))
    assert out["route"] == "router" and out["status"] == "grounding_fallback" and "4242" not in out["answer"]
    assert out["domo_calls"] == 1 and out["citations"]


def test_answers_name_scenario_and_assumptions_without_ai():
    out = answer("Will any line stop because of a material?", {}, _user(), AgentConfig(llm=None))
    if domo.ai_status()["available"]:
        pytest.skip("Domo configured; covered by the eval")
    assert out["status"] == "ai_unavailable_template"
    assert "planning scenario" in out["answer"].lower() and "A15" in out["answer"]
    assert all(c["url"].startswith("/material/") for c in out["citations"])


def test_grounding_helper():
    r = [ToolResult({"v": 5700000.0, "n": 27, "d": "2026-11-23"})]
    assert ungrounded_numbers("₹57.00 lakh and 27 pairs on 23-Nov-2026 for MAT-SOC-001", r) == set()
    assert ungrounded_numbers("31 pairs", r) == {"31"}


def test_chat_api_works_without_domo():
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
    tok = c.post("/api/auth/login", json={"username": "leader", "password": "demo"}).json()["token"]
    r = c.post("/api/agent/chat", headers={"Authorization": f"Bearer {tok}"},
               json={"question": "How much cash is tied up in stock we don't need?", "context": {"page": "Overview"}})
    assert r.status_code == 200
    j = r.json()
    assert j["answer"] and j["run_id"] and j["tool_trace"][0]["tool"] == "get_excess_inventory"


def test_shortage_answer_states_both_demand_sources_without_ai():
    """D33: the shortage tool carries the production-orders counts, so the answer names them without a toggle."""
    out = answer("Will any line stop because of a material?", {}, _user("leader"), AgentConfig(llm=None))
    if domo.ai_status()["available"]:
        pytest.skip("Domo configured; covered by the eval")
    a = out["answer"]
    assert "On your production orders" in a and "material × plant pairs with demand are short" in a
    assert "proposals use the planning scenario" in a and "A21" in out["assumptions"]
    assert not out.get("ungrounded")
