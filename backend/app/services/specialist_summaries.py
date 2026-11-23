"""Post-run specialist summaries (I3) and leadership answers precomputation (I2)."""
from __future__ import annotations

import logging
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models as m
from app.fmt import inr, pct
from app.services.brief import brief_facts

logger = logging.getLogger(__name__)


def write_specialist_summaries(s: Session, run_id: int, calc) -> None:
    """Write one agent_run_logs entry per specialist in template text (no Domo) after each run."""
    res = calc.res
    tenant_id = res.config.tenant_id
    f = brief_facts(s, run_id, calc)

    # 1. Data Reconciliation
    dq_count = f.get("dq_issues", 0)
    data_rec_summary = (
        f"Data Reconciliation identified {dq_count} data-quality findings across the dataset "
        f"before calculation (latest snapshot {f.get('data_age_days', 0)} days old)."
    )

    # 2. Stock Monitoring
    health_pct = f.get("inventory_health_pct", 0)
    val_inr = f.get("total_on_hand_value_inr", 0)
    stock_summary = (
        f"Stock Monitoring: Total inventory value ₹{val_inr / 1e7:.2f} Cr across plants; "
        f"inventory health is {pct(health_pct)} under current safety stock policies."
    )

    # 3. Shortage Forecast
    crit_cnt = f.get("critical_count", 0)
    orders_risk = f.get("production_orders_at_risk_14d", 0)
    shortage_summary = (
        f"Shortage Forecast: {crit_cnt} material × plant pairs projected below safety stock; "
        f"{orders_risk} planned production orders at risk within the next 14 days."
    )

    # 4. Replenishment
    props = f.get("proposals", {})
    draft_cnt = props.get("draft", {}).get("count", 0)
    buyer_cnt = props.get("pending_buyer", {}).get("count", 0)
    mgr_cnt = props.get("pending_manager", {}).get("count", 0)
    total_props = draft_cnt + buyer_cnt + mgr_cnt
    replenish_summary = (
        f"Replenishment drafted {total_props} replenishment proposals "
        f"({draft_cnt} drafts, {buyer_cnt} waiting for buyer, {mgr_cnt} need manager approval)."
    )

    # 5. Excess and Obsolete
    excess_val = f.get("excess_value_inr", 0)
    exp_val = f.get("expiring_30d_value_inr", 0) or 0
    excess_summary = (
        f"Excess and Obsolete identified ₹{excess_val / 1e5:.2f} lakh cash tied up in excess stock "
        f"above maximum policies; ₹{exp_val / 1e5:.2f} lakh in expiring lots within 30 days."
    )

    # 6. Supplier Delay
    overdue_po = f.get("overdue_po_lines", 0)
    open_po = f.get("open_po_lines", 0)
    delay_summary = (
        f"Supplier Delay monitored {open_po} open purchase order lines: "
        f"{overdue_po} lines are past promised delivery dates based on supplier history."
    )

    summaries = {
        "data_reconciliation": data_rec_summary,
        "stock_monitoring": stock_summary,
        "shortage_forecast": shortage_summary,
        "replenishment": replenish_summary,
        "excess_obsolete": excess_summary,
        "supplier_delay": delay_summary,
    }

    for spec_name, text in summaries.items():
        s.add(m.AgentRunLog(
            tenant_id=tenant_id,
            username="system",
            run_id=run_id,
            question=f"Post-run summary: {spec_name}",
            context={"post_run": True, "specialist": spec_name, "run_id": run_id},
            route="template",
            specialist=f"post_run:{spec_name}",
            tool_calls=[],
            answer=text,
            status="ok",
            domo_calls=0,
            latency_ms=0,
            usage={"input_tokens": 0, "output_tokens": 0},
        ))

