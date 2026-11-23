"""Inventory Copilot coordinator + 6 specialists (D38).

Routing order: decisive whole-question rules -> keyword rules per clause -> page context -> one Domo
classification call (only when still unclear) -> coordinator with the full tool list.
Each specialist has a short focused prompt and only its own tools.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Specialist:
    name: str
    label: str
    tools: tuple[str, ...]
    role: str  # one or two sentences: what it answers and how


SPECIALISTS: dict[str, Specialist] = {s.name: s for s in [
    Specialist("data_reconciliation", "Data Reconciliation", ("get_data_quality",),
               "You explain data-quality findings and data freshness: which checks fired, how many rows they affect, "
               "and which assumption handles each."),
    Specialist("stock_monitoring", "Stock Monitoring", ("get_inventory_overview", "get_stock_position", "get_daily_brief"),
               "You report stock positions and inventory KPIs: usable stock, safety stock, max, cover, status counts, "
               "health %, inventory value and today's brief."),
    Specialist("shortage_forecast", "Shortage Forecast", ("get_shortage_horizon", "get_material_risk_ranking", "get_production_capacity", "get_demand_forecast"),
               "You forecast shortages and production capacity: which material x plant pairs go below safety stock, "
               "how many finished products can be manufactured, and which materials are bottlenecks."),
    Specialist("replenishment", "Replenishment", ("get_replenishment_options", "get_transfer_options", "get_proposal_details"),
               "You explain purchase and transfer proposals: quantities, suppliers, lead times, timing and what waits "
               "for approval. You never approve anything."),
    Specialist("excess_obsolete", "Excess and Obsolete", ("get_excess_inventory", "get_expiring_lots"),
               "You find cash tied up in stock that is not needed: value above max stock, stock with no demand basis, "
               "and lots that expire."),
    Specialist("supplier_delay", "Supplier Delay", ("simulate_shortage_impact",),
               "You simulate what breaks when a supplier is late: pairs that get worse, new critical pairs and new "
               "stock-outs."),
    Specialist("procurement", "Smart Procurement", ("compare_supplier_quotes",),
               "You compare approved supplier quotes, analyze unit prices, delivery lead times, on-time OTIF rates, "
               "and recommend the best-value supplier for purchase orders."),
    Specialist("build_capacity", "Build Capacity & BOM Twin", ("get_production_capacity",),
               "You calculate finished product build capacity and convert packaging units. You identify the limiting "
               "bottleneck material and calculate gross versus safety-stock-protected capacity."),
    Specialist("qc_inspection", "Incoming QC & Lot Acceptance", ("get_data_quality",),
               "You evaluate incoming shipment quality, lot acceptance rates, and vendor defect probabilities "
               "to protect production lines."),
]}
COORDINATOR = "coordinator"

# Page context -> specialist (pages that span several topics are left to keywords / the classifier).
PAGE_SPECIALIST = {
    "data uploads": "data_reconciliation", "data quality": "data_reconciliation",
    "stock explorer": "stock_monitoring", "material 360": "stock_monitoring",
    "shortage horizon": "shortage_forecast", "digital twin": "build_capacity",
    "build capacity": "build_capacity", "capacity": "build_capacity",
    "build capacity calculator": "build_capacity",
    "proposals": "replenishment", "proposal detail": "replenishment",
    "excess and obsolete": "excess_obsolete",
    "smart procurement": "procurement", "procurement": "procurement",
}

_MAT = r"\bMAT-[A-Z]+-\d{3}\b"
# Decisive rules on the whole question (checked first, in order).
DECISIVE: list[tuple[str, re.Pattern]] = [
    ("build_capacity", re.compile(r"how many.*(units|phones|products|finished)|build(able)?|limiting (component|material)|bottleneck.*(build|product|capacity)|buildable units|assembly capacity", re.I)),
    ("procurement", re.compile(r"quote|quotes|lowest price|best.*supplier|supplier comparison|compare supplier|rfq|best value", re.I)),
    ("supplier_delay", re.compile(r"(supplier|SUP-\d{3}).*\b(late|delay)|\b(late|delay).*\bsupplier|what breaks", re.I)),
    ("replenishment", re.compile(r"\b(PR|TR)-\d{4}-\d{3}\b", re.I)),
    ("stock_monitoring", re.compile(r"how many (materials|pairs)[^?]*\b(critical|at risk|excess|healthy)\b[^?]*\b"
                                    r"(critical|at risk|excess|healthy|stale)\b", re.I)),
    ("replenishment", re.compile(_MAT + r".*\b(order|buy|purchase|replenish|transfer|propos|supplier|in time)|"
                                 r"\b(order|buy|purchase|replenish|transfer|propos|supplier)\b.*" + _MAT, re.I)),
    ("stock_monitoring", re.compile(_MAT, re.I)),
]
# Keyword rules per clause: (specialist, weight, pattern).
KEYWORDS: list[tuple[str, int, re.Pattern]] = [
    ("build_capacity", 3, re.compile(r"build(able)?|bom\b|capacity|bottleneck|finished (units?|goods?)|limiting (component|material)|assembly capacity", re.I)),
    ("data_reconciliation", 3, re.compile(r"data quality|\bdq\b|data issues?|issues in the data|trust the data|"
                                          r"validation|reconcil|how old is the data|data age|fresh|unit of measure|\buom\b|"
                                          r"data checks?|checks? (raised|fired)", re.I)),
    ("stock_monitoring", 2, re.compile(r"\bhealth|overview|\bkpis?\b|inventory value|stock value|value of (our )?inventory|"
                                       r"\bbrief\b|summary|today|how are we doing|on hand|usable stock|stock position", re.I)),
    ("shortage_forecast", 2, re.compile(r"shortage|\bshort\b|line stop|lines? .*stop|stop.*line|stock-?outs?|run out|"
                                        r"\bcritical\b|at risk|riskiest|most at risk|rank|below safety stock|go critical", re.I)),
    ("replenishment", 2, re.compile(r"approv|pending|waiting for (me|my)|proposals?\b|reorder|replenish|\bbuy\b|purchase|"
                                    r"transfer|\bmoq\b|lead time|which supplier", re.I)),
    ("excess_obsolete", 2, re.compile(r"excess|\bcash\b|tied up|overstock|don.?t need|working capital|expir|waste|"
                                      r"shelf.?life|obsolete|no demand", re.I)),
]
PRIORITY = ["supplier_delay", "build_capacity", "data_reconciliation", "replenishment", "excess_obsolete", "shortage_forecast",
            "stock_monitoring"]
_SPLIT = re.compile(r"\band (also )?(how|what|which|when|who|is|are|can|do|does|show|list|give)\b|;|\?\s+\S|\balso\b", re.I)


def _clause_pick(clause: str) -> str | None:
    score: dict[str, int] = {}
    for name, w, pat in KEYWORDS:
        hits = len(pat.findall(clause))
        if hits:
            score[name] = score.get(name, 0) + w * hits
    if not score:
        return None
    best = max(score.values())
    return min((n for n, v in score.items() if v == best), key=PRIORITY.index)


def choose(question: str, context: dict | None) -> tuple[list[str], str]:
    """(specialists, method) without any AI call; [] means unclear (classifier next, then coordinator)."""
    for name, pat in DECISIVE:
        if pat.search(question):
            return [name], "keyword"
    clauses = [c for c in _SPLIT.split(question) if c and len(c.strip()) > 2] or [question]
    picks: list[str] = []
    for c in clauses:
        p = _clause_pick(c)
        if p and p not in picks:
            picks.append(p)
    if len(picks) in (1, 2):
        return picks, "keyword"
    if len(picks) > 2:
        return [], "ambiguous"
    page = str((context or {}).get("page") or "").strip().lower()
    if page in PAGE_SPECIALIST:
        return [PAGE_SPECIALIST[page]], "page"
    return [], "unclear"


CLASSIFY_SYSTEM = ("You route questions for an inventory-management assistant. Reply with JSON only: "
                   '{"specialist": "<one name from the list>"}. Use "coordinator" if no single specialist fits.')


def classify_prompt(question: str, context: dict | None) -> str:
    lines = [f"- {s.name}: {s.role}" for s in SPECIALISTS.values()]
    return (f"Specialists:\n" + "\n".join(lines) + f"\n- {COORDINATOR}: anything else or several topics.\n"
            f"Page: {(context or {}).get('page') or 'none'}\nQuestion: {question}\nJSON:")


CLASSIFY_FORMAT = {"type": "JSON", "jsonSchema": {
    "type": "object", "required": ["specialist"], "additionalProperties": False,
    "properties": {"specialist": {"type": "string", "enum": [*SPECIALISTS, COORDINATOR]}}}}


def valid_choice(reply: dict) -> str:
    name = str((reply or {}).get("specialist", "")).strip().lower()
    return name if name in SPECIALISTS else COORDINATOR
