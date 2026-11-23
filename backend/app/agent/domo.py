"""Domo AI Services — Text Generation client.

POST https://{DOMO_INSTANCE}.domo.com/api/ai/v1/text/generation
headers: X-DOMO-Developer-Token; body: input, system, model (optional: instance default), modelConfiguration.
The documented API has no JSON response-format flag, so JSON is enforced by the system prompt and parsed
(with one repair retry in the loop). Settings come from .env only; the token is never logged.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass

import httpx

from app.config import get_settings

_LAST: dict = {"ok": None, "reason": None, "at": 0.0}


class DomoError(RuntimeError):
    pass


def configured() -> tuple[bool, str | None]:
    s = get_settings()
    missing = [n for n, v in (("DOMO_INSTANCE", s.domo_instance), ("DOMO_DEVELOPER_TOKEN", s.domo_developer_token)) if not v]
    return (not missing, f"Missing {', '.join(missing)} in .env" if missing else None)


def ai_status() -> dict:
    ok, reason = configured()
    if not ok:
        return {"available": False, "reason": reason}
    if _LAST["ok"] is False and time.time() - _LAST["at"] < 300:
        return {"available": False, "reason": _LAST["reason"]}
    return {"available": True, "reason": None}


@dataclass
class Generation:
    text: str
    model_id: str | None
    latency_ms: int
    usage: dict


def generate(input_text: str, system: str | None = None, *, temperature: float = 0.0,
             max_tokens: int | None = None, timeout_s: float | None = None, model: str | None = None,
             reasoning: str | None = None, response_format: dict | None = None) -> Generation:
    """reasoning: NONE | LOW | MEDIUM | HIGH (None = model default). response_format: Domo accepts
    {"type": "JSON", "jsonSchema": {...}} but does not enforce the schema (verified 2026-11-12), so replies are
    always parsed and validated by the caller."""
    s = get_settings()
    ok, reason = configured()
    if not ok:
        raise DomoError(reason)
    url = f"https://{s.domo_instance}.domo.com/api/ai/v1/text/generation"
    body: dict = {"input": input_text, "modelConfiguration": {"temperature": temperature}}
    if max_tokens:
        body["modelConfiguration"]["max_tokens"] = max_tokens
    if system:
        body["system"] = system
    if model or s.domo_model_id:
        body["model"] = model or s.domo_model_id
    if reasoning:
        body["reasoningConfig"] = {"reasoningEffort": reasoning}
    if response_format:
        body["responseFormat"] = response_format
    t0 = time.perf_counter()
    try:
        r = httpx.post(url, json=body, timeout=timeout_s or s.domo_timeout_s,
                       headers={"X-DOMO-Developer-Token": s.domo_developer_token, "Content-Type": "application/json"})
    except httpx.HTTPError as e:
        _LAST.update(ok=False, reason=f"{type(e).__name__}: {e}", at=time.time())
        raise DomoError(f"{type(e).__name__}: {e}") from e
    ms = round((time.perf_counter() - t0) * 1000)
    if r.status_code != 200:
        msg = f"HTTP {r.status_code}: {r.text[:300]}"
        _LAST.update(ok=False, reason=msg, at=time.time())
        raise DomoError(msg)
    data = r.json()
    text = data.get("output")
    if text is None and data.get("choices"):
        text = data["choices"][0].get("output")
    if text is None:
        raise DomoError(f"Unexpected response shape: {list(data)[:8]}")
    _LAST.update(ok=True, reason=None, at=time.time())
    mpu = data.get("modelProviderUsage") or {}
    usage = ({"input_tokens": int(mpu.get("inputTokens") or 0), "output_tokens": int(mpu.get("outputTokens") or 0),
              "reasoning_tokens": int(mpu.get("reasoningTokens") or 0)} if mpu else (data.get("usage") or {}))
    if not usage:  # rough estimate when the API does not report usage (4 chars ≈ 1 token)
        usage = {"input_tokens_est": (len(input_text) + len(system or "")) // 4, "output_tokens_est": len(text) // 4}
    return Generation(text=text, model_id=data.get("modelId"), latency_ms=ms, usage=usage)


def parse_json(text: str) -> dict:
    """Extract the first JSON object from a model reply (tolerates code fences / prose around it)."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?|```$", "", t, flags=re.MULTILINE).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", t, flags=re.DOTALL)
        if not m:
            raise
        return json.loads(m.group(0))


def smoke() -> dict:
    """First call of Stage 3: one tiny request; returns ok + exact error."""
    try:
        g = generate('Reply with exactly this JSON: {"ok": true}', system="You reply with JSON only.", timeout_s=20)
        return {"ok": True, "model_id": g.model_id, "latency_ms": g.latency_ms, "reply": g.text[:200]}
    except Exception as e:  # report the exact error
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
