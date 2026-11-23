"""Daily brief: facts from engine output -> template text (always) -> Domo text (Stage 3, optional).

Every number in the brief comes from `facts`; the template is the fallback whenever Domo is unavailable.
"""
from __future__ import annotations

from datetime import date

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models as m
from app.fmt import day, inr


def brief_facts(s: Session, run_id: int, calc) -> dict:
    res = calc.res
    t = res.config.tenant_id
    k = res.kpis
    sm = res.summary
    crit = sm[sm["status"] == "critical"].sort_values(["days_to_shortage", "material_id"])
    props = s.execute(select(m.Proposal.state, func.count(), func.coalesce(func.sum(m.Proposal.value_inr), 0))
                      .where(m.Proposal.tenant_id == t, m.Proposal.state.in_(["draft", "pending_buyer", "pending_manager"]))
                      .group_by(m.Proposal.state)).all()
    by_state = {st: {"count": int(n), "value_inr": float(v)} for st, n, v in props}
    age = (pd.Timestamp(date.today()) - res.as_of).days
    return {
        "run_id": run_id, "as_of": k["as_of"], "horizon_days": res.config.horizon_days, "data_age_days": int(age),
        "stale": age > res.config.staleness_days, "demand_source": res.config.demand_source,
        "inventory_health_pct": k["inventory_health_pct"], "status_counts": k["status_counts"],
        "critical": [{"material_id": r.material_id, "plant_id": r.plant_id,
                      "days_to_shortage": int(r.days_to_shortage),
                      "stockout_date": None if pd.isna(r.stockout_date) else r.stockout_date.date().isoformat(),
                      "orders_affected": int(r.orders_affected)} for r in crit.head(5).itertuples()],
        "critical_count": int(len(crit)),
        "production_orders_at_risk": k["production_orders_at_risk"],
        "production_orders_at_risk_14d": k["production_orders_at_risk_14d"],
        "excess_value_inr": k["excess_value_inr"], "expiring_30d_value_inr": k["expiring_30d_value_inr"],
        "overdue_po_lines": k["overdue_po_lines"], "open_po_lines": k["open_po_lines"],
        "proposals": by_state, "total_on_hand_value_inr": k["total_on_hand_value_inr"],
        "dq_issues": int(sum(d.fired for d in calc.dq)),
        "other_source": _other_source(getattr(calc, "alt", None)),
    }


def _other_source(alt) -> dict | None:
    """The non-default demand source's headline (D33): same fields as the agent tools' other_source."""
    if alt is None:
        return None
    k = alt.kpis
    m_ = k.get("demand_multiple") or {}
    return {"source": alt.config.demand_source, "status_counts": k["status_counts"], "short_pairs": k["short_pairs"],
            "pairs_with_demand": k["pairs_with_demand"], "requirement_vs_usable_median": m_.get("median"),
            "requirement_vs_usable_min": m_.get("min"), "requirement_vs_usable_max": m_.get("max"),
            "used_for_proposals": False}


def template_text(f: dict) -> str:
    sc = f["status_counts"]
    lines = [f"Data as of {day(f['as_of'])} · {f['data_age_days']} days old"
             + (" — STALE, upload today's files." if f["stale"] else "."),
             ""]
    lines.append(f"Shortages: {sc['critical']} material × plant pairs are critical (below safety stock within "
                 f"their lead time) and {sc['at_risk']} are at risk later in the {f['horizon_days']}-day horizon.")
    for c in f["critical"][:3]:
        so = f", stock-out {day(c['stockout_date'])}" if c["stockout_date"] else ""
        lines.append(f"  • {c['material_id']} at {c['plant_id']}: below safety stock in {c['days_to_shortage']} "
                     f"day(s){so}; {c['orders_affected']} planned orders affected.")
    lines.append(f"Production at risk: {f['production_orders_at_risk_14d']} planned orders in the next 14 days "
                 f"({f['production_orders_at_risk']} in the horizon) start after a component stock-out.")
    lines.append(f"Cash in excess: {inr(f['excess_value_inr'])} above maximum stock "
                 f"(total on hand {inr(f['total_on_hand_value_inr'])}).")
    lines.append(f"Expiry: {inr(f['expiring_30d_value_inr'])} expiring in the next 30 days "
                 "(only consumables carry expiry dates, A13).")
    lines.append(f"Overdue POs: {f['overdue_po_lines']} of {f['open_po_lines']} open PO lines are past their "
                 "promised date (expected at as-of + supplier delay, A10).")
    p = f["proposals"]
    pb, pm, dr = (p.get(k, {"count": 0, "value_inr": 0}) for k in ("pending_buyer", "pending_manager", "draft"))
    lines.append(f"Approvals: {pb['count']} waiting for the purchasing officer ({inr(pb['value_inr'])}), {pm['count']} for the "
                 f"manager ({inr(pm['value_inr'])}); {dr['count']} drafts ({inr(dr['value_inr'])}) to review.")
    lines.append(f"Data quality: {f['dq_issues']} issues found before calculation; inventory health "
                 f"{f['inventory_health_pct']}%.")
    if f["demand_source"] == "scenario":
        lines.append("Demand is based on the planning scenario – replace with the organization's plan (A15).")
    from app.agent.templates import other_line
    if f.get("other_source"):
        lines.append(other_line(f["other_source"]).strip())
    return "\n".join(lines)


# Stage 3 sets this to a callable(facts) -> (text, model_id, latency_ms) or raises.
AI_WRITER = None


def write_brief(s: Session, run_id: int, calc) -> m.DailyBrief:
    f = brief_facts(s, run_id, calc)
    text, kind, model_id, latency, err = template_text(f), "template", None, None, None
    if AI_WRITER is not None:
        try:
            text, model_id, latency = AI_WRITER(f)
            kind = "ai"
        except Exception as e:  # Domo down or invalid: keep the template (fallback)
            err = f"{type(e).__name__}: {e}"[:500]
    from app.ingest.loader import json_safe
    b = m.DailyBrief(tenant_id=calc.res.config.tenant_id, run_id=run_id, kind=kind, text=text, facts=json_safe(f),
                     model_id=model_id, latency_ms=latency, error=err)
    s.add(b)
    s.flush()
    return b
