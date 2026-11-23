"""30 evaluation questions (Stage 4). Expected facts are taken from engine output at evaluation time.

Each question: text, page context (+ selected item), the specialist(s) that should answer it, and the facts the
answer must contain. Fact kinds: int, qty, inr, pct (numbers in any common rendering), id, date.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select

from app import models as m
from app.agent.tools import ToolCtx, run_tool
from app.api.common import status_df

Fact = tuple  # ("int"|"qty"|"inr"|"pct", value) | ("id", "MAT-..") | ("date", "2026-11-27") | ("any", [facts])


@dataclass
class Q:
    qid: int
    text: str
    expect_specialists: list[str]
    facts: list[Fact]
    page: str = "Agent Workspace"
    item: dict | None = None
    note: str = ""
    accept_specialists: list[list[str]] = field(default_factory=list)  # alternatives that also count as right


def build(t: ToolCtx) -> list[Q]:
    s = t.s
    tool = lambda n, **a: run_tool(t, n, a).data  # noqa: E731
    df = status_df(t.user, t.ctx).set_index(["material_id", "plant_id"])
    ov = tool("get_inventory_overview")
    dq = tool("get_data_quality")
    po_check = next(c for c in dq["checks"] if c["check"] == "PO status")
    ex = tool("get_excess_inventory")
    s60 = tool("get_shortage_horizon", days=60)
    s7 = tool("get_shortage_horizon", days=7)
    s30 = tool("get_shortage_horizon", days=30)
    rank = tool("get_material_risk_ranking", top=5)
    exp365 = tool("get_expiring_lots", days=365)
    exp30 = tool("get_expiring_lots", days=30)
    appr = tool("get_proposal_details")
    sim_all = tool("simulate_shortage_impact", delay_days=7)
    sim6 = tool("simulate_shortage_impact", supplier_id="SUP-006", delay_days=10)
    props = {p.proposal_no: p for p in s.scalars(select(m.Proposal).where(m.Proposal.tenant_id == t.user.tenant_id))}

    def prop_for(mat, plant, kind="purchase"):
        return next(p for p in props.values() if p.material_id == mat and p.plant_id == plant and p.kind == kind
                    and p.state in ("draft", "pending_buyer", "pending_manager", "approved"))

    so_first = min(((k, r) for k, r in df.iterrows() if r["stockout_date"] is not None and str(r["stockout_date"]) != "NaT"),
                   key=lambda kr: (str(kr[1]["stockout_date"]), -kr[1]["orders_affected"]))
    p_soc = prop_for("MAT-SOC-001", "IN-TN-01")
    p_nand_tr = prop_for("MAT-NAND-003", "IN-TN-01", "transfer")
    p_dsp = prop_for("MAT-DSP-005", "IN-KA-01")
    p_pcb = prop_for("MAT-PCB-004", "IN-KA-01")
    p_nand = prop_for("MAT-NAND-003", "IN-TN-01")
    p8 = props[next(n for n in props if props[n].material_id == "MAT-DSP-005" and props[n].plant_id == "IN-KA-01")]
    sc = ov["status_counts"]
    exrow = ex["rows"][0]

    return [
        # ---- Data Reconciliation (4)
        Q(1, "How many data quality issues were found in the latest upload?", ["data_reconciliation"],
          [("int", dq["issues_found"])]),
        Q(2, "How many CLOSED PO lines received less than ordered, according to the data checks?", ["data_reconciliation"],
          [("int", po_check["affected"])]),
        Q(3, "How old is the data we are using?", ["data_reconciliation"], [("int", dq["data_age_days"])]),
        Q(4, "Which material is short in the next 7 days and how much cash is tied up in excess?",
          ["shortage_forecast", "excess_obsolete"], [("int", s7["count"]), ("inr", ex["excess_value_inr"])],
          note="two-specialist"),
        # ---- Stock Monitoring (7)
        Q(5, "How healthy is our inventory overall?", ["stock_monitoring"], [("pct", ov["health_pct"])]),
        Q(6, "What is the total value of our inventory on hand?", ["stock_monitoring"], [("inr", ov["on_hand_value_inr"])]),
        Q(7, "What is the usable stock of MAT-SOC-001 at IN-KA-01?", ["stock_monitoring"],
          [("qty", df.loc[("MAT-SOC-001", "IN-KA-01"), "usable_qty"])]),
        Q(8, "What is the safety stock of MAT-BAT-006 at IN-TN-01?", ["stock_monitoring"],
          [("qty", df.loc[("MAT-BAT-006", "IN-TN-01"), "ss_qty"])]),
        Q(9, "Give me today's brief.", ["stock_monitoring"], [("int", sc["critical"]), ("int", sc["at_risk"])]),
        Q(10, "How many materials are critical, at risk, excess and healthy?", ["stock_monitoring"],
          [("int", sc["critical"]), ("int", sc["at_risk"]), ("int", sc["excess"]), ("int", sc["healthy"])]),
        Q(11, "When does MAT-PCB-004 at IN-KA-01 go below safety stock?", ["stock_monitoring"],
          [("date", str(df.loc[("MAT-PCB-004", "IN-KA-01"), "shortage_date"])[:10])]),
        # ---- Shortage Forecast (5)
        Q(12, "Will any line stop because of a material?", ["shortage_forecast"], [("int", s60["with_stockout"])]),
        Q(13, "Which materials go below safety stock in the next 7 days?", ["shortage_forecast"],
          [("int", s7["count"]), ("id", s7["rows"][0]["material"])]),
        Q(14, "What are the 5 riskiest materials right now?", ["shortage_forecast"], [("id", rank["rows"][0]["material"])]),
        Q(15, "How many material x plant pairs are short within 30 days?", ["shortage_forecast"], [("int", s30["count"])]),
        Q(16, "Which pair stocks out first, and how many production orders does it affect?", ["shortage_forecast"],
          [("id", so_first[0][0]), ("int", so_first[1]["orders_affected"])]),
        # ---- Replenishment (7)
        Q(17, "What is waiting for my approval, and why?", ["replenishment"],
          [("int", appr["drafts"])] if appr["count"] == 0 else [("int", appr["count"])]),
        Q(18, "How much MAT-SOC-001 should we order for IN-TN-01?", ["replenishment"],
          [("qty", float(p_soc.qty)), ("id", p_soc.proposal_no)]),
        Q(19, f"Explain proposal {p8.proposal_no}.", ["replenishment"], [("qty", float(p8.qty)), ("inr", float(p8.value_inr))]),
        Q(20, "Can we transfer MAT-NAND-003 to IN-TN-01 from the other plant?", ["replenishment"],
          [("qty", float(p_nand_tr.qty))]),
        Q(21, "Which supplier would supply MAT-DSP-005 for IN-KA-01?", ["replenishment"], [("id", p_dsp.supplier_id)]),
        Q(22, "Is the purchase of MAT-PCB-004 for IN-KA-01 in time?", ["replenishment"], [("id", p_pcb.proposal_no)]),
        Q(23, "Why this quantity?", ["replenishment"], [("qty", float(p_nand.qty))], page="Proposal Detail",
          item={"type": "proposal", "id": str(p_nand.id), "label": p_nand.proposal_no}, note="page context"),
        # ---- Excess and Obsolete (4)
        Q(24, "How much cash is tied up in stock we don't need?", ["excess_obsolete"], [("inr", ex["excess_value_inr"])]),
        Q(25, "Which material is in excess, and by how much?", ["excess_obsolete"],
          [("id", exrow["material"]), ("qty", exrow["excess_qty"])]),
        Q(26, "What is about to expire or become waste?", ["excess_obsolete"],
          [("date", exp30["lots_with_expiry"][0]["expiry"])] if exp30["lots_with_expiry"] else [("int", 0)]),
        Q(27, "How much stock has no demand basis?", ["excess_obsolete"], [("inr", ex["no_demand_basis_value_inr"])]),
        # ---- Supplier Delay (2)
        Q(28, "If a supplier is late, what breaks?", ["supplier_delay"], [("id", sim_all["results"][0]["supplier"])]),
        Q(29, "If SUP-006 is 10 days late, what breaks?", ["supplier_delay"], [("int", sim6["results"][0]["pairs_worse"])]),
        # ---- Classifier (unclear by rules)
        Q(30, "What should we worry about most this week?", ["shortage_forecast"],
          [("any", [("id", rank["rows"][0]["material"]), ("id", s7["rows"][0]["material"])])],
          note="classifier", accept_specialists=[["coordinator"]]),
    ]
