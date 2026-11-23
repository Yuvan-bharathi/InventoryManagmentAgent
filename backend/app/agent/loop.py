"""Agent: intent router + JSON-action loop over the 12 tools, with grounding and a template fallback.

- Router: common questions go straight to one tool; one LLM call phrases the answer (template if AI is down).
- Loop: temperature 0, JSON actions, max 5 LLM steps; one repair retry on invalid JSON.
- Grounding: every number in an LLM answer must appear in that answer's tool results, else the deterministic
  template answer (engine numbers only) is used instead.
- The agent can only read: tools are read-only and run in a READ ONLY transaction; there is no write tool.
"""
from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Callable

from sqlalchemy import text

from app.agent import domo, templates
from app.agent.tools import TOOLS, ToolCtx, ToolResult, tool_catalog
from app.mcp import mcp_client
from app.api.common import run_ctx
from app.auth import Principal
from app.db import get_sessionmaker

MAX_STEPS = 5
Llm = Callable[[str, str], "domo.Generation"]  # (input, system) -> Generation

SYSTEM = """%s for a phone-manufacturing company (2 plants: IN-TN-01 Chennai,
IN-KA-01 Bengaluru). You answer ONLY from tool results. Never compute, estimate or invent numbers: copy them exactly
from tool results. Never sum quantities across different materials (mixed units); totals across materials are in INR.
You cannot approve, change or release anything — say so if asked.
Reply with ONE JSON object and nothing else:
  {"action": "tool", "tool": "<name>", "args": {...}}      to call a tool, or
  {"action": "final", "answer": "<2-6 short sentences>"}   when you can answer.
Tools:
%s
Rules for the final answer: name the materials (e.g. MAT-SOC-001 at IN-TN-01) and proposals (e.g. PR-0016-013) you
rely on; say "based on the planning scenario" when demand is involved; name assumption ids from the results that
matter (e.g. A10, A19); write INR as ₹ with lakh/crore exactly as given or as plain digits from the results."""

COORDINATOR_ROLE = "You are the Inventory Copilot, the inventory-management assistant"
COMBINE_SYSTEM = """Combine the specialist answers below into ONE short answer (2-6 sentences) to the user's question.
Use ONLY numbers that appear in the specialist answers, copied exactly; keep material ids and proposal numbers.
Keep any sentence about the planning scenario / assumptions. Reply with JSON: {"answer": "..."}"""

PHRASE_SYSTEM = """Rewrite the facts below into a short, plain answer (2-5 sentences) to the user's question.
Use ONLY numbers that appear in the facts, copied exactly. Keep material ids and proposal numbers as written.
Keep the sentence about the planning scenario / assumptions. Reply with JSON: {"answer": "..."}"""


@dataclass
class AgentConfig:
    use_router: bool = True
    use_cache: bool = True
    parallel: bool = True
    repair_retry: bool = True
    timeout_s: float = 20.0
    llm: Llm | None = None  # default: Domo
    specialists: bool = True       # coordinator + 6 specialists (D38); False = single agent with all tools
    classifier: bool = True        # one Domo classification call when rules are unclear
    reasoning: str | None = None   # Domo reasoningConfig: NONE | LOW | None (model default)
    model: str | None = None       # Domo model override (None = DOMO_MODEL_ID / instance default)
    compact: bool = False          # compact tool outputs sent to the model
    few_shot: bool = False         # few-shot examples in the loop prompt
    precomputed: bool = True       # serve precomputed answers to the five leadership questions
    grounding: str = "v2"          # v1 = original string check; v2 = normalised (lakh/crore, %, rounding, dates) (D42)


@dataclass
class Trace:
    steps: list[dict] = field(default_factory=list)
    domo_calls: int = 0
    tool_ms: int = 0
    usage: dict = field(default_factory=lambda: {"input_tokens": 0, "output_tokens": 0})
    llm_errors: list[str] = field(default_factory=list)
    rejected: list[dict] = field(default_factory=list)  # AI answers replaced by the template (grounding)


_TOOL_CACHE: dict[tuple, ToolResult] = {}


def clear_tool_cache() -> None:
    _TOOL_CACHE.clear()


def _call_tool(t: ToolCtx, name: str, args: dict, tr: Trace, cfg: AgentConfig) -> ToolResult:
    key = (t.user.tenant_id, tuple(sorted(t.user.plants)), t.user.role, t.ctx.run_id, name,
           json.dumps(args, sort_keys=True))
    t0 = time.perf_counter()
    cached = cfg.use_cache and key in _TOOL_CACHE and name != "get_proposal_details"  # proposal states are live
    res = _TOOL_CACHE[key] if cached else mcp_client.call_tool(name, args, context=t)
    if cfg.use_cache:
        _TOOL_CACHE[key] = res
    ms = round((time.perf_counter() - t0) * 1000)
    tr.tool_ms += ms
    tr.steps.append({"tool": name, "args": args, "ms": ms, "cached": cached,
                     "summary": json.dumps(res.data, default=str)[:160]})
    return res


def _llm(cfg: AgentConfig, inp: str, system: str, tr: Trace, response_format: dict | None = None) -> str:
    gen = (cfg.llm or (lambda i, s: domo.generate(i, s, timeout_s=cfg.timeout_s, model=cfg.model,
                                                  reasoning=cfg.reasoning, response_format=response_format)))(inp, system)
    tr.domo_calls += 1
    u = gen.usage or {}
    tr.usage["input_tokens"] += int(u.get("input_tokens", u.get("input_tokens_est", 0)) or 0)
    tr.usage["output_tokens"] += int(u.get("output_tokens", u.get("output_tokens_est", 0)) or 0)
    return gen.text


def _llm_json(cfg: AgentConfig, inp: str, system: str, tr: Trace, response_format: dict | None = None) -> dict:
    out = _llm(cfg, inp, system, tr, response_format)
    try:
        return domo.parse_json(out)
    except (json.JSONDecodeError, ValueError):
        if not cfg.repair_retry:
            raise
        fixed = _llm(cfg, f"Your previous reply was not valid JSON:\n{out[:800]}\nReturn only the corrected JSON object.",
                     system, tr)
        return domo.parse_json(fixed)


# ---------------- grounding ----------------
_NUM = re.compile(r"(?<![A-Za-z-])(\d[\d,]*(?:\.\d+)?)")


def _numbers(s: str) -> set[str]:
    out = set()
    for n in _NUM.findall(s):
        n = n.replace(",", "").rstrip(".")
        if n:
            out.add(n.rstrip("0").rstrip(".") if "." in n else n)
    return out


_MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
                                       "Dec"], 1)}
_DATE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b|\b(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{4})\b")


def ungrounded_numbers_v1(answer: str, results: list[ToolResult], question: str = "") -> set[str]:
    """v1 (until D42): numbers in the answer that appear nowhere in the tool results, by string renderings."""
    blob = json.dumps([r.data for r in results], default=str)
    bad_dates: set[str] = set()

    def _date(mo: re.Match) -> str:  # a date must exist in the tool results; then it leaves the number check
        iso = mo.group(1) or f"{mo.group(4)}-{_MONTHS[mo.group(3)]:02d}-{int(mo.group(2)):02d}"
        if iso not in blob and iso not in question:
            bad_dates.add(mo.group(0))
        return " "
    ans = _DATE.sub(_date, answer)
    ans = re.sub(r"\b(?:MAT|PR|TR|SUP|IN|PO|POC|PLN|CO|ECR|LOT)-?[A-Z0-9-]*\d[\w-]*", " ", ans)
    ans = re.sub(r"\bA\d{1,2}\b", " ", ans)
    allowed = _numbers(question) | {"0", "1", "2", "3", "4", "5"}  # small counting words are tolerated
    have = _numbers(blob)
    # also allow numbers as INR crore / lakh renderings of tool values
    for v in _NUM.findall(blob):
        try:
            x = float(v.replace(",", ""))
        except ValueError:
            continue
        for scale in (1e7, 1e5):
            for d in (1, 2):
                have.add(f"{x / scale:.{d}f}".rstrip("0").rstrip("."))
        have.add(f"{x:.0f}"); have.add(f"{x:.1f}".rstrip("0").rstrip("."))
    return {n for n in _numbers(ans) if n not in have and n not in allowed} | bad_dates


_LONG = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
         "november", "december"]
_MON = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
_DATES2 = [  # (pattern, groups -> (year|None, month, day))
    (re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"), lambda g: (g[0], int(g[1]), int(g[2]))),
    (re.compile(r"\b(\d{1,2})[- ]" + _MON + r"(?:[- ,]+(\d{4}))?", re.I), lambda g: (g[2], _mon(g[1]), int(g[0]))),
    (re.compile(_MON + r" (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?", re.I), lambda g: (g[2], _mon(g[0]), int(g[1]))),
]


def _mon(name: str) -> int:
    n = name.lower()[:3]
    return [m[:3] for m in _LONG].index(n) + 1


def _blob_values(blob: str) -> list[float]:
    vals = []
    for v in _NUM.findall(blob):
        try:
            vals.append(float(v.replace(",", "")))
        except ValueError:
            pass
    return vals


def ungrounded_numbers(answer: str, results: list[ToolResult], question: str = "") -> set[str]:
    """v2 (D42): numbers in the answer that are not a rendering of some tool-result value.

    A number counts as grounded when it equals a tool value (or a question number) after any of: rounding to the
    answer's own precision; INR in crore (/1e7) or lakh (/1e5); a fraction shown as a percentage (x100).
    Dates in any common format (ISO, 27-Nov-2026, 27 Nov 2026, Nov 27, November 27, 2026) must exist in the results
    (month and day; the year too when given). Material / proposal / supplier / assumption ids are ignored.
    """
    blob = json.dumps([r.data for r in results], default=str)
    iso_in_blob = set(re.findall(r"\d{4}-\d{2}-\d{2}", blob + " " + question))
    md_in_blob = {(int(d[5:7]), int(d[8:10])) for d in iso_in_blob}
    bad: set[str] = set()
    ans = answer
    for pat, conv in _DATES2:
        def _date(mo: re.Match) -> str:
            try:
                y, mth, day = conv(mo.groups())
            except (ValueError, IndexError):
                return mo.group(0)
            if not (1 <= mth <= 12 and 1 <= day <= 31):
                return mo.group(0)
            ok = (f"{y}-{mth:02d}-{day:02d}" in iso_in_blob) if y else ((mth, day) in md_in_blob)
            if not ok:
                bad.add(mo.group(0))
            return " "
        ans = pat.sub(_date, ans)
    ans = re.sub(r"\b(?:MAT|PR|TR|SUP|IN|PO|POC|PLN|CO|ECR|LOT)-?[A-Z0-9-]*\d[\w-]*", " ", ans)
    ans = re.sub(r"\bA\d{1,2}\b", " ", ans)
    vals = _blob_values(blob) + _blob_values(question)
    for mo in _NUM.finditer(ans):
        tok = mo.group(1)
        t = tok.replace(",", "").rstrip(".")
        if not t:
            continue
        n = float(t)
        if n in (0, 1, 2, 3, 4, 5):
            continue
        # The unit written after the number decides the scale: lakh / crore for INR, % for fractions or percents.
        after = ans[mo.end():mo.end() + 9].lower().lstrip()
        scales = (1e5,) if after.startswith("lakh") else (1e7,) if after.startswith(("cr", "crore"))             else (1, 0.01) if after.startswith("%") else (1,)
        dp = len(t.split(".")[1]) if "." in t else 0
        half = 0.5 * 10 ** -dp + 1e-9
        if dp == 0 and scales == (1,):
            half = 0.5 if any(abs(v - round(v)) > 1e-9 for v in vals if abs(n - v) <= 0.5) else 1e-9
        if not any(abs(n - v / scale) <= half for v in vals for scale in scales):
            bad.add(tok)
    return bad


def _ground(cfg: "AgentConfig", answer: str, results: list[ToolResult], question: str) -> set[str]:
    return (ungrounded_numbers_v1 if cfg.grounding == "v1" else ungrounded_numbers)(answer, results, question)


def _cites(answer: str, results: list[ToolResult]) -> list[dict]:
    allc, seen = [], set()
    for r in results:
        for c in r.cites:
            if c["url"] not in seen:
                seen.add(c["url"]); allc.append(c)
    hit = [c for c in allc if c["label"].split(" @ ")[0] in answer]
    return hit or allc[:5]


def _footer(results: list[ToolResult]) -> tuple[list[str], bool]:
    ids = sorted(set().union(*[r.assumption_ids for r in results]) if results else set(), key=lambda x: int(x[1:]))
    return ids, any(r.scenario for r in results)


# ---------------- router ----------------
_MAT = re.compile(r"\bMAT-[A-Z]+-\d{3}\b", re.I)
_PROP = re.compile(r"\b(?:PR|TR)-\d{4}-\d{3}\b", re.I)
_SUP = re.compile(r"\bSUP-\d{3}\b", re.I)
_PLANT = re.compile(r"\bIN-(?:TN|KA)-01\b", re.I)
_PROD = re.compile(r"\bSPH-[A-Z0-9]+-\d+\b", re.I)


def route(question: str, context: dict) -> tuple[str, dict] | None:
    q = question.lower()
    item = (context or {}).get("item") or {}
    plant = (_PLANT.search(question).group(0).upper() if _PLANT.search(question) else None) \
        or item.get("plant") or (context or {}).get("plant")
    mat = _MAT.search(question)
    mat = mat.group(0).upper() if mat else (item.get("id") if item.get("type") == "material" else None)
    prop = _PROP.search(question)
    prop = prop.group(0).upper() if prop else (item.get("label") if item.get("type") == "proposal" else None)
    prod = _PROD.search(question)
    product_id = prod.group(0).upper() if prod else None
    days = re.search(r"(\d+)\s*(?:day|d\b)", q)
    if prop and re.search(r"proposal|why|explain|quantity|supplier|this", q):
        return "get_proposal_details", {"proposal_no": prop}
    if re.search(r"how many.*(units|phones|products|finished)|build(able)?|capacity|limiting (component|material)|bottleneck|assembly capacity|bom", q):
        return "get_production_capacity", {"plant": plant, "product_id": product_id}
    if re.search(r"supplier.*\b(late|delay)|\b(late|delay).*supplier|what breaks", q):
        sup = _SUP.search(question)
        return "simulate_shortage_impact", {"supplier_id": sup.group(0).upper() if sup else None,
                                            "delay_days": int(days.group(1)) if days else 7,
                                            **({"plant": plant} if plant and (context or {}).get("plant") else {})}
    if mat and "transfer" in q and plant:
        return "get_transfer_options", {"material_id": mat, "plant": plant}
    if mat and plant and re.search(r"order|replenish|buy|purchase|propos|how much|options", q):
        return "get_replenishment_options", {"material_id": mat, "plant": plant}
    if mat:
        return "get_stock_position", {"material_id": mat, **({"plant": plant} if plant else {})}
    p = {"plant": (context or {}).get("plant")} if (context or {}).get("plant") else {}
    if re.search(r"line stop|lines? .*stop|stop.*line|stock-?out|run out", q):
        return "get_shortage_horizon", {"days": 60, **p}
    if re.search(r"go critical|critical|shortage|short of|at risk", q):
        return "get_shortage_horizon", {"days": int(days.group(1)) if days else 60,
                                         **({"status": "critical"} if "critical" in q and "risk" not in q else {}), **p}
    if re.search(r"cash|tied up|excess|overstock|don.t need|working capital", q):
        return "get_excess_inventory", p
    if re.search(r"expir|waste|shelf", q):
        return "get_expiring_lots", {"days": int(days.group(1)) if days else 30, **p}
    if re.search(r"approv|waiting for me|pending", q):
        return "get_proposal_details", {}
    if re.search(r"rank|riskiest|top risk|most at risk", q):
        return "get_material_risk_ranking", {"top": 10, **p}
    if re.search(r"data quality|dq\b|issues in the data|trust the data|data issues", q):
        return "get_data_quality", {}
    if re.search(r"brief|summary|today|what happened", q):
        return "get_daily_brief", {}
    if re.search(r"overview|health|kpi|how are we doing|inventory value", q):
        return "get_inventory_overview", p
    return None


# ---------------- main entry ----------------
def run_agent(question: str, context: dict, user: Principal, cfg: AgentConfig | None = None,
              role: str = COORDINATOR_ROLE, tools: tuple[str, ...] | None = None) -> dict:
    """One agent: intent router (restricted to `tools`) then the JSON-action loop over `tools` (None = all 12)."""
    cfg = cfg or AgentConfig()
    allowed = tuple(tools) if tools else tuple(TOOLS)
    t_start = time.perf_counter()
    tr = Trace()
    results: list[ToolResult] = []
    status, route_used, text_out = "ok", "loop", ""
    ai_ok = cfg.llm is not None or domo.ai_status()["available"]
    with get_sessionmaker()() as s:
        s.execute(text("SET TRANSACTION READ ONLY"))
        ctx = run_ctx(s, user.tenant_id)
        t = ToolCtx(user, ctx, s)
        r = route(question, context) if cfg.use_router else None
        if r is not None and r[0] not in allowed:
            r = None
        try:
            if r is not None:
                route_used = "router"
                res = _call_tool(t, r[0], r[1], tr, cfg)
                results.append(res)
                fallback = templates.render(r[0], res, question)
                text_out = fallback
                if ai_ok:
                    try:
                        j = _llm_json(cfg, f"Question: {question}\nFacts:\n{fallback}\nTool result JSON:\n"
                                      f"{json.dumps(_for_model(res, cfg), default=str)}", PHRASE_SYSTEM, tr)
                        cand = str(j.get("answer", "")).strip()
                        bad = _ground(cfg, cand, results, question)
                        if cand and not bad:
                            text_out = cand
                        else:
                            status = "grounding_fallback" if cand else "invalid_llm_reply"
                            if cand:
                                tr.rejected.append({"answer": cand, "ungrounded": sorted(bad)})
                    except Exception as e:  # AI down / invalid JSON / timeout -> template
                        tr.llm_errors.append(f"{type(e).__name__}: {e}"[:300])
                        status = "ai_error_template"
                else:
                    status = "ai_unavailable_template"
            elif not ai_ok:
                status = "ai_unavailable"
                text_out = ("AI is unavailable right now. I can still answer the common questions from the engine — "
                            "try one of the five leadership questions, or name a material (e.g. MAT-SOC-001) or a "
                            "proposal number.")
            else:
                text_out, status = _loop(question, context, t, tr, cfg, results, role, allowed)
        except PermissionError as e:
            status, text_out = "no_permission", str(e)
        except Exception as e:  # noqa: BLE001 — never fail the panel
            if "403" in str(getattr(e, "status_code", "")) or "No access" in str(e):
                status, text_out = "no_permission", str(getattr(e, "detail", e))
            else:
                status, text_out = "error", f"Sorry — that failed: {type(e).__name__}: {str(e)[:200]}"
        s.rollback()
    ids, scenario = _footer(results)
    if results and status not in ("no_permission",):
        tail = []
        if scenario and "planning scenario" not in text_out.lower():
            tail.append("based on the planning scenario (A15)")
        named = [i for i in ids if i in text_out]
        if ids and len(named) < min(3, len(ids)):
            tail.append("assumptions " + ", ".join(ids))
        if tail:
            text_out = text_out.rstrip() + "\n(" + "; ".join(tail) + ")"
    return {"answer": text_out, "citations": _cites(text_out, results), "assumptions": ids, "scenario": scenario,
            "status": status, "route": route_used, "tool_trace": tr.steps, "domo_calls": tr.domo_calls,
            "tool_ms": tr.tool_ms, "latency_ms": round((time.perf_counter() - t_start) * 1000), "usage": tr.usage,
            "llm_errors": tr.llm_errors, "rejected": tr.rejected, "run_id": ctx.run_id if 'ctx' in locals() else None,
            "tool_results": [r.compact() for r in results]}


def _for_model(res: ToolResult, cfg: AgentConfig) -> dict:
    """What the model sees of a tool result; compact mode drops nulls, notes and long lists."""
    c = res.compact()
    if not cfg.compact:
        return c

    def slim(v):
        if isinstance(v, dict):
            return {k: slim(x) for k, x in v.items() if x is not None and k not in ("rule", "note")}
        if isinstance(v, list):
            return [slim(x) for x in v[:5]]
        return v
    return slim(c)


def _loop(question: str, context: dict, t: ToolCtx, tr: Trace, cfg: AgentConfig,
          results: list[ToolResult], role: str = COORDINATOR_ROLE,
          allowed: tuple[str, ...] | None = None) -> tuple[str, str]:
    allowed = allowed or tuple(TOOLS)
    system = SYSTEM % (role, tool_catalog(allowed))
    if cfg.few_shot:
        system += "\n" + few_shot_block(allowed)
    scratch = [f"Question: {question}",
               f"Context: page={context.get('page')}, plant filter={context.get('plant') or 'all'}, "
               f"selected={json.dumps(context.get('item'))}, as_of={t.ctx.as_of}, run={t.ctx.run_id}"]
    for step in range(MAX_STEPS):
        last = step == MAX_STEPS - 1
        prompt = "\n".join(scratch) + ("\nYou must now give the final answer." if last else "") + "\nJSON:"
        try:
            act = _llm_json(cfg, prompt, system, tr)
        except Exception as e:
            tr.llm_errors.append(f"{type(e).__name__}: {e}"[:300])
            if results:
                return templates.render(tr.steps[-1]["tool"], results[-1], question), "ai_error_template"
            return "AI is unavailable right now.", "ai_unavailable"
        if act.get("action") == "final" or last:
            ans = str(act.get("answer", "")).strip()
            bad = _ground(cfg, ans, results, question)
            if ans and not bad:
                return ans, "ok"
            if ans:
                tr.rejected.append({"answer": ans, "ungrounded": sorted(bad)})
            if results:
                return templates.render(tr.steps[-1]["tool"], results[-1], question), "grounding_fallback"
            return ans or "I could not find that in the engine results.", "ok" if ans else "no_answer"
        calls = act.get("calls") or [{"tool": act.get("tool"), "args": act.get("args") or {}}]
        def one(c):  # noqa: E306
            if c.get("tool") not in allowed:
                return c, None, f"tool not available to you; use one of {', '.join(allowed)}"
            try:
                return c, _call_tool(t, c["tool"], c.get("args") or {}, tr, cfg), None
            except Exception as e:  # noqa: BLE001
                return c, None, f"{type(e).__name__}: {e}"
        if cfg.parallel and len(calls) > 1:
            with ThreadPoolExecutor(max_workers=4) as ex:
                outs = list(ex.map(one, calls))
        else:
            outs = [one(c) for c in calls]
        for c, res, err in outs:
            if res is not None:
                results.append(res)
                scratch.append(f"[tool {c['tool']} {json.dumps(c.get('args') or {})}] -> "
                               f"{json.dumps(_for_model(res, cfg), default=str)}")
            else:
                scratch.append(f"[tool {c.get('tool')}] ERROR: {err}")
    return "I could not finish within 5 steps.", "max_steps"


# ---------------- few-shot examples (filled from failing evaluation cases, D39) ----------------
FEW_SHOT: dict[str, list[str]] = {}


def few_shot_block(allowed: tuple[str, ...]) -> str:
    ex = [e for tool, items in FEW_SHOT.items() if tool in allowed for e in items]
    return ("Examples:\n" + "\n".join(ex)) if ex else ""


# ---------------- Inventory Copilot coordinator (D38) ----------------
FIVE = [
    "will any line stop because of a material",
    "how much cash is tied up in stock we don't need",
    "what is about to expire or become waste",
    "what is waiting for my approval, and why",
    "if a supplier is late, what breaks",
]
_PRECOMPUTED: dict[tuple, dict] = {}


def _norm(q: str) -> str:
    return re.sub(r"[\s?.!]+$", "", re.sub(r"\s+", " ", q.strip().lower().replace("’", "'")))


def answer(question: str, context: dict, user: Principal, cfg: AgentConfig | None = None) -> dict:
    """Inventory Copilot: choose specialist(s) by rules (then one Domo classification call if unclear),
    run them (two in parallel, then one combining call), or fall back to the coordinator with all tools."""
    cfg = cfg or AgentConfig()
    t0 = time.perf_counter()
    context = context or {}
    key = None
    if cfg.precomputed and _norm(question) in FIVE:
        with get_sessionmaker()() as s:
            run_id = run_ctx(s, user.tenant_id).run_id
        key = (user.tenant_id, run_id, tuple(sorted(user.plants)), user.role, context.get("plant"), _norm(question))
        if key in _PRECOMPUTED:
            out = dict(_PRECOMPUTED[key])
            out.update(latency_ms=round((time.perf_counter() - t0) * 1000), domo_calls=0, precomputed=True,
                       usage={"input_tokens": 0, "output_tokens": 0})
            return out

    from app.agent.specialists import (CLASSIFY_FORMAT, CLASSIFY_SYSTEM, COORDINATOR, SPECIALISTS, choose,
                                       classify_prompt, valid_choice)
    pre = Trace()
    if context.get("force_specialist") and context.get("force_specialist") in SPECIALISTS:
        names, method = [context["force_specialist"]], "forced_specialist"
    elif context.get("force_specialist") == COORDINATOR:
        names, method = [], "forced_coordinator"
    else:
        names, method = (choose(question, context) if cfg.specialists else ([], "single_agent"))
        if cfg.specialists and not names and cfg.classifier and (cfg.llm is not None or domo.ai_status()["available"]):
            try:
                pick = valid_choice(_llm_json(cfg, classify_prompt(question, context), CLASSIFY_SYSTEM, pre, CLASSIFY_FORMAT))
                names, method = ([] if pick == COORDINATOR else [pick]), "classifier"
            except Exception as e:  # noqa: BLE001 — classifier failure -> coordinator
                pre.llm_errors.append(f"classifier {type(e).__name__}: {e}"[:300])
                method = "classifier_failed"

    def spec_run(n: str) -> dict:
        sp = SPECIALISTS[n]
        return run_agent(question, context, user, cfg, role=f"You are the {sp.label} specialist of the Inventory "
                         f"Copilot. {sp.role} You are the assistant", tools=sp.tools)

    if not names:
        out = run_agent(question, context, user, cfg)
        out["specialists"] = [COORDINATOR]
    elif len(names) == 1:
        out = spec_run(names[0])
        out["specialists"] = names
    else:
        with ThreadPoolExecutor(max_workers=2) if cfg.parallel else _Serial() as ex:
            parts = list(ex.map(spec_run, names))
        out = _combine(question, parts, cfg, pre)
        out["specialists"] = names
    out["routing"] = method
    out["domo_calls"] = out.get("domo_calls", 0) + pre.domo_calls
    for k in ("input_tokens", "output_tokens"):
        out.setdefault("usage", {})[k] = int(out["usage"].get(k, 0)) + pre.usage.get(k, 0)
    out["llm_errors"] = pre.llm_errors + out.get("llm_errors", [])
    out["tool_trace"] = [{"tool": f"route:{'+'.join(out['specialists'])}", "args": {"method": method}, "ms": 0}] \
        + out.get("tool_trace", [])
    out["latency_ms"] = round((time.perf_counter() - t0) * 1000)
    if key is not None and out.get("status") in ("ok", "ai_unavailable_template"):
        _PRECOMPUTED[key] = dict(out)
    return out


class _Serial:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    @staticmethod
    def map(fn, items):
        return [fn(i) for i in items]


def _combine(question: str, parts: list[dict], cfg: AgentConfig, pre: Trace) -> dict:
    """Two specialist answers -> one. The combined text is grounded against both specialists' tool results."""
    results = [ToolResult(r["data"], set(r.get("assumptions", [])), r.get("scenario", False))
               for p in parts for r in p.get("tool_results", [])]
    joined = "\n\n".join(p["answer"] for p in parts)
    text_out, status = joined, "ok"
    ai_ok = cfg.llm is not None or domo.ai_status()["available"]
    if ai_ok and all(p["status"] == "ok" for p in parts):
        try:
            j = _llm_json(cfg, f"Question: {question}\n" + "\n".join(
                f"Specialist answer {i + 1}:\n{p['answer']}" for i, p in enumerate(parts)) + "\nJSON:", COMBINE_SYSTEM, pre)
            cand = str(j.get("answer", "")).strip()
            if cand and not _ground(cfg, cand, results, question):
                text_out = cand
            else:
                status = "combine_fallback"
        except Exception as e:  # noqa: BLE001
            pre.llm_errors.append(f"combine {type(e).__name__}: {e}"[:300])
            status = "combine_fallback"
    else:
        status = next((p["status"] for p in parts if p["status"] != "ok"), "ok")
    cites, seen = [], set()
    for p in parts:
        for c in p.get("citations", []):
            if c["url"] not in seen:
                seen.add(c["url"]); cites.append(c)
    first = parts[0]
    return {"answer": text_out, "citations": cites,
            "assumptions": sorted(set().union(*[set(p["assumptions"]) for p in parts]), key=lambda x: int(x[1:])),
            "scenario": any(p["scenario"] for p in parts), "status": status,
            "route": "+".join(p["route"] for p in parts), "tool_trace": [s for p in parts for s in p["tool_trace"]],
            "domo_calls": sum(p["domo_calls"] for p in parts), "tool_ms": sum(p["tool_ms"] for p in parts),
            "usage": {k: sum(int(p["usage"].get(k, 0)) for p in parts) for k in ("input_tokens", "output_tokens")},
            "llm_errors": [e for p in parts for e in p.get("llm_errors", [])], "run_id": first.get("run_id"),
            "tool_results": [r for p in parts for r in p.get("tool_results", [])]}
