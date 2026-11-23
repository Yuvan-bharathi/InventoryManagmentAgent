"""Stage 4 evaluation: python -m eval.run_eval <config> [<config> ...]   (from backend/)

Reads ORG-01 on the configured DATABASE_URL read-only (the agent runs in a READ ONLY transaction and the eval does
not log to agent_run_logs). Writes eval/results/<config>.json and prints a summary row per config.
"""
from __future__ import annotations

import json
import math
import re
import statistics
import sys
import time
from dataclasses import asdict, replace
from pathlib import Path

from sqlalchemy import select, text

from app import models as m
from app.agent import loop
from app.agent.loop import AgentConfig, answer, clear_tool_cache, ungrounded_numbers
from app.agent.tools import ToolCtx, ToolResult
from app.api.common import run_ctx
from app.auth import principal_for
from app.db import get_sessionmaker
from eval.questions import Q, build

OUT = Path(__file__).parent / "results"
USER = "invmgr"

BASE = dict(use_router=False, use_cache=False, parallel=False, repair_retry=False, timeout_s=60.0, grounding="v2")
CONFIGS: dict[str, AgentConfig] = {
    # baselines: plain JSON-action loop, every optimization off
    # baseline = the system as it was: original (v1) grounding check
    "baseline_specialists": AgentConfig(**{**BASE, "grounding": "v1"}, specialists=True),
    "baseline_single": AgentConfig(**{**BASE, "grounding": "v1"}, specialists=False),
    # same with the normalised grounding check (D42) - the base for every comparison after the baseline
    "spec": AgentConfig(**BASE, specialists=True),
    "single": AgentConfig(**BASE, specialists=False),
    "spec_reason_none": AgentConfig(**BASE, specialists=True, reasoning="NONE"),
    "spec_reason_low": AgentConfig(**BASE, specialists=True, reasoning="LOW"),
}


def cfg_named(name: str) -> AgentConfig:
    if name in CONFIGS:
        return CONFIGS[name]
    # "<base>+opt1+opt2" adds optimizations in order on top of a base config
    base, *opts = name.split("+")
    cfg = CONFIGS[base]
    flags = {"router": dict(use_router=True), "compact": dict(compact=True), "cache": dict(use_cache=True),
             "parallel": dict(parallel=True), "fewshot": dict(few_shot=True), "repair": dict(repair_retry=True),
             "timeout": dict(timeout_s=12.0), "precomputed": dict(precomputed=True),
             "none": dict(reasoning="NONE"), "low": dict(reasoning="LOW"), "small": dict(model="domo.domo_ai.domogpt-small-v2.1:anthropic")}
    for o in opts:
        cfg = replace(cfg, **flags[o])
    return cfg


# ---------------- grading ----------------
_N = re.compile(r"(?<![A-Za-z])\d[\d,]*(?:\.\d+)?")
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
        "November", "December"]


def _nums(s: str) -> list[float]:
    s = re.sub(r"\b(?:MAT|PR|TR|SUP|LOT|IN)-[\w-]*", " ", s)
    out = []
    for n in _N.findall(s):
        try:
            out.append(float(n.replace(",", "")))
        except ValueError:
            pass
    return out


def fact_ok(f: tuple, ans: str) -> bool:
    kind, v = f
    if kind == "any":
        return any(fact_ok(x, ans) for x in v)
    if kind == "id":
        return str(v).lower() in ans.lower()
    if kind == "date":
        y, mo, d = str(v)[:10].split("-")
        mi, di = int(mo) - 1, int(d)
        forms = [f"{y}-{mo}-{d}", f"{d}-{MONTHS[mi]}-{y}", f"{di} {MONTHS[mi]}", f"{d} {MONTHS[mi]}",
                 f"{MONTHS[mi]} {di}", f"{LONG[mi]} {di}", f"{di} {LONG[mi]}", f"{di}-{MONTHS[mi]}", f"{d}-{MONTHS[mi]}"]
        return any(x.lower() in ans.lower() for x in forms)
    x = float(v)
    nums = _nums(ans)
    if kind in ("int", "qty"):
        return any(abs(n - round(x)) < 0.5 for n in nums)
    if kind == "pct":
        return any(abs(n - x) < 0.051 or abs(n - round(x)) < 0.01 for n in nums)
    if kind == "inr":
        for n in nums:
            if abs(n - x) <= max(1.0, 0.005 * x):
                return True
            for scale in (1e7, 1e5):
                if x >= scale * 0.1 and abs(n - x / scale) <= 0.0051 * max(1, x / scale) + 0.006:
                    return True
        return False
    raise ValueError(kind)


PARSE = ("JSONDecodeError", "Expecting value", "Expecting property", "not valid JSON", "Extra data", "Unterminated")
TIMEOUT = ("Timeout", "timed out", "ReadTimeout")
_END = re.compile(r"[.!?)\]*_\"'`]$")


def cause(q: Q, out: dict, g: dict) -> str | None:
    """One cause per failure: timeout, json_parse, routing, tool, truncation, misquoted_number."""
    if g["correct"]:
        return None
    errs = " ".join(out.get("llm_errors", []))
    if any(k in errs for k in TIMEOUT) or out.get("status") == "timeout":
        return "timeout"
    if any(k in errs for k in PARSE) or out.get("status") == "invalid_llm_reply":
        return "json_parse"
    if not g["routing_ok"]:
        return "routing"
    if not g["facts_in_tools"] or out.get("status") == "max_steps":
        return "tool"
    a = (out.get("answer") or "").rstrip()
    if len(a) > 40 and not _END.search(a):
        return "truncation"
    return "misquoted_number"


def grade(q: Q, out: dict) -> dict:
    ans = out.get("answer", "")
    missing = [f for f in q.facts if not fact_ok(f, ans)]
    results = [ToolResult(r["data"]) for r in out.get("tool_results", [])]
    blob = json.dumps([r.data for r in results], default=str)
    facts_in_tools = all(fact_ok(f, blob) for f in q.facts)
    bad = sorted(ungrounded_numbers(ans, results, q.text)) if results else []
    # Grounding recount: AI answers rejected by the live check. A false positive = the normalised (v2) check finds
    # every number grounded, i.e. the rejection was a rendering mismatch, not an invented number.
    rej = out.get("rejected", [])
    fps = [r for r in rej if results and not ungrounded_numbers(r["answer"], results, q.text)]
    got = out.get("specialists", [])
    ok_routes = [sorted(q.expect_specialists)] + [sorted(a) for a in q.accept_specialists]
    return {"facts_in_tools": facts_in_tools, "rejections": len(rej), "rejections_false_positive": len(fps),
            "rejected": rej, "correct": not missing, "missing": [list(f) if f[0] != "any" else ["any", [list(x) for x in f[1]]] for f in missing],
            "ungrounded": bad, "routing_ok": sorted(got) in ok_routes}


def pct(xs: list[float], p: float) -> float:
    if not xs:
        return 0.0
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    lo, hi = math.floor(k), math.ceil(k)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def run(name: str, only: list[int] | None = None) -> dict:
    cfg = cfg_named(name)
    with get_sessionmaker()() as s:
        user = principal_for(s, s.scalar(select(m.User).where(m.User.username == USER)))
        s.execute(text("SET TRANSACTION READ ONLY"))
        ctx = run_ctx(s, user.tenant_id)
        qs = build(ToolCtx(user, ctx, s))
        s.rollback()
    if only:
        qs = [q for q in qs if q.qid in only]
    clear_tool_cache()
    loop._PRECOMPUTED.clear()
    if cfg.precomputed:  # the five leadership answers are precomputed after each calculation run (not timed)
        for q in qs:
            if loop._norm(q.text) in loop.FIVE:
                answer(q.text, {"page": q.page, "item": q.item}, user, cfg)
    rows = []
    for q in qs:
        if not cfg.use_cache:
            clear_tool_cache()
        t0 = time.perf_counter()
        try:
            out = answer(q.text, {"page": q.page, "plant": None, "item": q.item}, user, cfg)
        except Exception as e:  # noqa: BLE001
            out = {"answer": f"EXCEPTION {type(e).__name__}: {e}", "status": "exception", "specialists": [],
                   "domo_calls": 0, "usage": {}, "tool_results": []}
        wall = (time.perf_counter() - t0) * 1000
        g = grade(q, out)
        g["cause"] = cause(q, out, g)
        g["json_parse_errors"] = sum(any(k in e for k in PARSE) for e in out.get("llm_errors", []))
        rows.append({"qid": q.qid, "q": q.text, "note": q.note, "expect": q.expect_specialists,
                     "got": out.get("specialists"), "routing": out.get("routing"), **g,
                     "status": out.get("status"), "route": out.get("route"), "domo_calls": out.get("domo_calls", 0),
                     "latency_ms": round(wall), "tokens": int(out.get("usage", {}).get("input_tokens", 0))
                     + int(out.get("usage", {}).get("output_tokens", 0)),
                     "tools": [s_["tool"] for s_ in out.get("tool_trace", [])], "answer": out.get("answer"),
                     "llm_errors": out.get("llm_errors", [])[:5]})
        print(f"  q{q.qid:>2} {'OK ' if g['correct'] else 'BAD ' + str(g['cause'])} route={'ok' if g['routing_ok'] else 'NO'} "
              f"{out.get('status')} {wall / 1000:.1f}s calls={out.get('domo_calls', 0)}", flush=True)
    # Separate real failures from noise: every failing question runs twice more.
    for r in rows:
        if r["correct"]:
            continue
        q = next(x for x in qs if x.qid == r["qid"])
        r["reruns"] = []
        for _ in range(2):
            if not cfg.use_cache:
                clear_tool_cache()
            try:
                o = answer(q.text, {"page": q.page, "plant": None, "item": q.item}, user, cfg)
            except Exception as e:  # noqa: BLE001
                o = {"answer": f"EXCEPTION {e}", "status": "exception", "tool_results": [], "specialists": []}
            gg = grade(q, o)
            r["reruns"].append({"correct": gg["correct"], "cause": cause(q, o, gg), "status": o.get("status"),
                                "answer": o.get("answer")})
        r["failure"] = "real" if not any(x["correct"] for x in r["reruns"]) else "noise"
        print(f"  q{r['qid']:>2} rerun -> {[x['correct'] for x in r['reruns']]} = {r['failure']}", flush=True)
    lat = [r["latency_ms"] / 1000 for r in rows]
    causes: dict[str, int] = {}
    for r in rows:
        if r["cause"] and r.get("failure") == "real":
            causes[r["cause"]] = causes.get(r["cause"], 0) + 1
    summ = {"config": name, "n": len(rows), "correct": sum(r["correct"] for r in rows),
            "grounding_failures": sum(bool(r["ungrounded"]) for r in rows),
            "grounding_rejections": sum(r["rejections"] for r in rows),
            "grounding_false_positives": sum(r["rejections_false_positive"] for r in rows),
            "json_parse_errors": sum(r["json_parse_errors"] for r in rows),
            "failures_real": sum(r.get("failure") == "real" for r in rows),
            "failures_noise": sum(r.get("failure") == "noise" for r in rows),
            "causes": causes,
            "template_fallbacks": sum(r["status"] in ("grounding_fallback", "combine_fallback", "ai_error_template",
                                                      "invalid_llm_reply") for r in rows),
            "routing_correct": sum(r["routing_ok"] for r in rows) if cfg.specialists else None,
            "domo_calls_avg": round(statistics.mean(r["domo_calls"] for r in rows), 2),
            "p50_s": round(pct(lat, .5), 1), "p95_s": round(pct(lat, .95), 1),
            "tokens_avg": round(statistics.mean(r["tokens"] for r in rows)),
            "settings": {k: v for k, v in asdict(cfg).items() if k != "llm"}}
    OUT.mkdir(exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps({"summary": summ, "rows": rows}, indent=1, default=str), encoding="utf-8")
    return summ


def fmt(s: dict) -> str:
    rc = "—" if s["routing_correct"] is None else f"{s['routing_correct']}/{s['n']}"
    return (f"| {s['config']} | {s['correct']}/{s['n']} | {s['failures_real']} / {s['failures_noise']} | "
            f"{s['grounding_failures']} | {s['grounding_rejections']} ({s['grounding_false_positives']} FP) | "
            f"{s['json_parse_errors']} | {rc} | {s['domo_calls_avg']} | {s['p50_s']} | {s['p95_s']} | {s['tokens_avg']} | "
            f"{', '.join(f'{k} {v}' for k, v in sorted(s['causes'].items())) or '—'} |")


HEAD = ("| Config | Correct | Failures real / noise | Ungrounded final answers | AI answers rejected by grounding "
        "(false positives) | JSON parse errors | Routing | Domo calls / q | p50 s | p95 s | Tokens / q | Real-failure causes |\n"
        "|---|---|---|---|---|---|---|---|---|---|---|---|")

if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("--only=")]
    only = next((list(map(int, a[7:].split(","))) for a in sys.argv[1:] if a.startswith("--only=")), None)
    sums = []
    for n in names:
        print(f"== {n}", flush=True)
        sums.append(run(n, only))
        print(HEAD + "\n" + "\n".join(fmt(x) for x in sums), flush=True)
