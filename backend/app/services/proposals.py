"""Proposal persistence (post-run hook) and the approval workflow.

States: draft -> pending_buyer -> pending_manager (level 2 only) -> approved -> fulfilled;
rejected from either pending state (reason code required); send_back returns a pending proposal to draft.
Nothing is executed: 'fulfilled' only records that the buyer released / received it outside the system.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import delete, exists, select, update
from sqlalchemy.orm import Session

from app import models as m
from app.auth import Principal
from app.engine.proposals import build_proposals
from app.ingest.loader import _py, json_safe

ACTIVE = ("draft", "pending_buyer", "pending_manager", "approved")
REASON_CODES = ("NOT_NEEDED", "WRONG_QTY", "WRONG_SUPPLIER", "BUDGET", "DATA_ISSUE", "TIMING", "OTHER")

# (action, from_state) -> (module permission needed, next state or None for computed)
TRANSITIONS = {
    ("submit", "draft"): ("A", "pending_buyer"),
    ("approve", "pending_buyer"): ("L1", None),
    ("approve", "pending_manager"): ("L2", "approved"),
    ("reject", "pending_buyer"): ("L1", "rejected"),
    ("reject", "pending_manager"): ("L2", "rejected"),
    ("send_back", "pending_buyer"): ("L1", "draft"),
    ("send_back", "pending_manager"): ("L2", "draft"),
    ("override_qty", "pending_buyer"): ("L1", "pending_buyer"),
    ("fulfil", "approved"): ("A", "fulfilled"),
}


def persist_proposals(s: Session, run_id: int, calc) -> int:
    """Post-run hook: regenerate drafts; never duplicate a pair that already has a live proposal."""
    res = calc.res
    t = res.config.tenant_id
    has_log = exists().where(m.ApprovalLog.proposal_id == m.Proposal.id)
    s.execute(delete(m.Proposal).where(m.Proposal.tenant_id == t, m.Proposal.state == "draft", ~has_log))
    busy = set(s.execute(select(m.Proposal.material_id, m.Proposal.plant_id, m.Proposal.kind)
                         .where(m.Proposal.tenant_id == t, m.Proposal.state.in_(ACTIVE))).all())
    df = build_proposals(res, res.config)
    rows, n = [], 0
    for r in df.itertuples(index=False):
        if (r.material_id, r.plant_id, r.kind) in busy:
            continue
        n += 1
        rows.append({
            "tenant_id": t, "run_id": run_id, "proposal_no": f"{'TR' if r.kind == 'transfer' else 'PR'}-{run_id:04d}-{n:03d}",
            "kind": r.kind, "material_id": r.material_id, "plant_id": r.plant_id, "supplier_id": _py(r.supplier_id),
            "source_plant_id": _py(r.source_plant_id), "qty": float(r.qty), "uom": r.uom,
            "unit_price_inr": float(r.unit_price_inr), "value_inr": float(r.value_inr),
            "order_by": _py(r.order_by), "needed_by": _py(r.needed_by), "arrival_date": _py(r.arrival_date),
            "shortage_date": _py(r.shortage_date), "in_time": r.in_time, "state": "draft",
            "approval_level": int(r.approval_level), "inputs": json_safe(r.inputs) | {"run_id": run_id},
            "assumption_ids": list(r.assumption_ids)})
    if rows:
        s.execute(m.Proposal.__table__.insert(), rows)
    return len(rows)


def transition(s: Session, user: Principal, proposal_id: int, action: str, *, reason_code: str | None = None,
               comment: str | None = None, qty: float | None = None, threshold_inr: float) -> m.Proposal:
    p = s.scalar(select(m.Proposal).where(m.Proposal.id == proposal_id, m.Proposal.tenant_id == user.tenant_id)
                 .with_for_update())
    if p is None:  # other tenants' proposals are invisible, not forbidden
        raise HTTPException(404, "Proposal not found")
    user.require_plant(p.plant_id)
    rule = TRANSITIONS.get((action, p.state))
    if rule is None:
        raise HTTPException(409, f"Cannot {action} a proposal in state '{p.state}'")
    perm, nxt = rule
    user.require("replenishment", perm)
    if action in ("reject", "override_qty", "send_back") and not (reason_code or comment):
        raise HTTPException(422, "A reason is required")
    if action == "reject" and reason_code not in REASON_CODES:
        raise HTTPException(422, f"reason_code must be one of {', '.join(REASON_CODES)}")
    details = None
    if action == "override_qty":
        if qty is None or qty <= 0:
            raise HTTPException(422, "qty must be positive")
        old = (float(p.qty), float(p.value_inr), p.approval_level)
        p.qty = qty
        p.value_inr = qty * float(p.unit_price_inr)
        p.approval_level = 2 if float(p.value_inr) > threshold_inr else 1
        details = {"old_qty": old[0], "new_qty": qty, "old_value_inr": old[1], "new_value_inr": float(p.value_inr),
                   "old_level": old[2], "new_level": p.approval_level}
    if nxt is None:  # buyer approval: manager step only above the threshold
        nxt = "pending_manager" if p.approval_level == 2 else "approved"
    frm = p.state
    p.state = nxt
    p.reason_code = reason_code if action == "reject" else p.reason_code
    p.updated_at = datetime.now(timezone.utc)
    s.add(m.ApprovalLog(tenant_id=user.tenant_id, proposal_id=p.id, run_id=p.run_id, action=action, from_state=frm,
                        to_state=nxt, user_id=user.user_id, username=user.username, role_id=user.role,
                        reason_code=reason_code, comment=comment, details=details))
    s.add(m.AuditEvent(tenant_id=user.tenant_id, username=user.username, event_type=f"proposal.{action}",
                       item=p.proposal_no, before={"state": frm}, after={"state": nxt} | (details or {})))
    s.flush()
    return p
