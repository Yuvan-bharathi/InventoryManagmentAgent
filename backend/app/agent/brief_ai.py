"""Domo-written daily brief. Grounded: every number must appear in the engine facts, else the template is kept."""
from __future__ import annotations

import json

from app.agent import domo
from app.agent.loop import ungrounded_numbers
from app.agent.tools import ToolResult
from app.services.brief import template_text

SYSTEM = """You write the 9 a.m. inventory brief for plant leadership. Use ONLY the facts and numbers given, copied
exactly (₹ values as written). Sections in this order, one or two sentences each: Shortages, Production at risk,
Cash in excess, Expiry, Overdue POs, Approvals, Data freshness. Mention that demand is based on the planning scenario.
Plain text, no markdown headers, at most 170 words. Reply with JSON: {"brief": "..."}"""


def write(facts: dict) -> tuple[str, str | None, int]:
    if not domo.configured()[0]:
        raise domo.DomoError(domo.configured()[1])
    tmpl = template_text(facts)
    g = domo.generate(f"Facts (template version):\n{tmpl}\n\nFacts (JSON):\n{json.dumps(facts, default=str)}", SYSTEM)
    text = str(domo.parse_json(g.text).get("brief", "")).strip()
    bad = ungrounded_numbers(text, [ToolResult(facts), ToolResult({"t": tmpl})])
    if not text or bad:
        raise ValueError(f"AI brief rejected: ungrounded numbers {sorted(bad)[:5]}")
    return text, g.model_id, g.latency_ms
