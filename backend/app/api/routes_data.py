"""Auth, meta (shell), Data Uploads, data quality, assumptions, brief and reports."""
from __future__ import annotations

import io
import shutil
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models as m
from app.api.common import RunCtx, ctx_dep, envelope, get_db, run_ctx
from app.auth import ROLES, Principal, authenticate, current_user, issue_token, principal_for
from app.config import REPO_ROOT
from app.ingest.reader import FILES, DatasetError
from app.reports import daily_stock

router = APIRouter(prefix="/api")
UPLOAD_DIR = REPO_ROOT / "data" / "uploads"


class LoginBody(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
def login(body: LoginBody, s: Session = Depends(get_db)):
    u = authenticate(s, body.username, body.password)
    if u is None:
        raise HTTPException(401, "Wrong username or password")
    p = principal_for(s, u)
    s.add(m.AuditEvent(tenant_id=p.tenant_id, username=p.username, event_type="login"))
    s.commit()
    return {"token": issue_token(p), "user": _user(p)}


def _user(p: Principal) -> dict:
    return {"username": p.username, "display_name": p.display_name, "tenant_id": p.tenant_id, "role": p.role,
            "role_name": ROLES[p.role][0], "lands_on": ROLES[p.role][1], "plants": p.plants}


@router.get("/demo-users")
def demo_users(s: Session = Depends(get_db)):
    """Login page helper for the demo: usernames and roles only (password is 'demo')."""
    rows = s.execute(select(m.User.username, m.User.display_name, m.User.role_id, m.User.tenant_id)
                     .where(m.User.active.is_(True)).order_by(m.User.id)).all()
    return [{"username": u, "display_name": n, "role": r, "role_name": ROLES[r][0], "tenant_id": t}
            for u, n, r, t in rows]


@router.get("/meta")
def meta(user: Principal = Depends(current_user), s: Session = Depends(get_db)):
    from app.agent.domo import ai_status
    from app.api.common import cached
    try:
        ctx = run_ctx(s, user.tenant_id)
    except HTTPException:
        ctx = None

    def static():
        plants = s.execute(select(m.Plant.plant_id, m.Plant.plant_name).where(m.Plant.tenant_id == user.tenant_id)).all()
        cats = list(s.scalars(select(m.Material.material_category).where(m.Material.tenant_id == user.tenant_id)
                              .distinct().order_by(m.Material.material_category)))
        tenant = s.get(m.Tenant, user.tenant_id)
        dq_err = s.scalar(select(func.count()).select_from(m.DQResultRow).where(
            m.DQResultRow.upload_id == ctx.upload_id, m.DQResultRow.fired.is_(True),
            m.DQResultRow.severity == "error")) or 0 if ctx else 0
        return plants, cats, tenant.name if tenant else user.tenant_id, dq_err
    allplants, cats, tenant_name, dq_err = cached(user.tenant_id, ctx.run_id if ctx else 0, "meta", static)
    plants = [(p, n) for p, n in allplants if p in user.plants]
    badge = {"buyer": "pending_buyer", "procurement_manager": "pending_manager"}.get(user.role)
    pending = s.scalar(select(func.count()).select_from(m.Proposal).where(
        m.Proposal.tenant_id == user.tenant_id, m.Proposal.plant_id.in_(user.plants),
        m.Proposal.state == badge)) if badge else None
    ai = ai_status()
    return envelope({
        "user": _user(user), "tenant_name": tenant_name,
        "plants": [{"plant_id": p, "plant_name": n} for p, n in plants], "categories": cats,
        "banners": {"stale": bool(ctx and ctx.data_age_days > ctx.staleness_days), "dq_failed": dq_err > 0,
                    "ai_unavailable": not ai["available"], "ai_reason": ai.get("reason"),
                    "no_data": ctx is None},
        "badges": {"proposals": pending},
        "permissions": {mod: sorted(p.get(user.role, set())) for mod, p in __import__("app.auth").auth.PERMS.items()},
    }, ctx)


# ---------------- Data Uploads ----------------
def _store_upload(files: list[UploadFile]) -> Path:
    dest = UPLOAD_DIR / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    dest.mkdir(parents=True)
    for f in files:
        data = f.file.read()
        name = Path(f.filename or "upload").name
        if name.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                for info in zf.infolist():
                    stem = Path(info.filename).name
                    if stem.lower().endswith(".csv") and not info.is_dir():
                        (dest / stem).write_bytes(zf.read(info))
        elif name.lower().endswith(".csv"):
            (dest / name).write_bytes(data)
        else:
            shutil.rmtree(dest, ignore_errors=True)
            raise HTTPException(422, f"{name}: only .zip or .csv files are accepted (.xlsx comes later)")
    return dest


@router.post("/uploads")
def upload(files: list[UploadFile] = File(...), user: Principal = Depends(current_user), s: Session = Depends(get_db)):
    user.require("data", "A")
    from app.pipeline import ingest
    import app.services  # noqa: F401  (post-run hooks)
    steps = []
    t0 = time.perf_counter()
    path = _store_upload(files)
    steps.append({"step": "received", "ms": round((time.perf_counter() - t0) * 1000)})
    try:
        s.rollback()  # end the implicit transaction opened by dependencies
        t1 = time.perf_counter()
        run_id, calc = ingest(s, path, user.tenant_id, uploaded_by=user.username,
                              file_name=", ".join(f.filename or "" for f in files))
        steps.append({"step": "validated, loaded, calculated, brief ready",
                      "ms": round((time.perf_counter() - t1) * 1000)})
        s.commit()
    except DatasetError as e:
        s.rollback()
        raise HTTPException(422, str(e))
    from app.api.common import clear_caches, warm
    clear_caches()
    warm(user.tenant_id)
    run = s.get(m.CalculationRun, run_id)
    return envelope(_upload_report(s, user, run.upload_id) | {"steps": steps, "run_id": run_id},
                    run_ctx(s, user.tenant_id, run_id))


def _upload_report(s: Session, user: Principal, upload_id: int) -> dict:
    up = s.scalar(select(m.Upload).where(m.Upload.id == upload_id, m.Upload.tenant_id == user.tenant_id))
    if up is None:
        raise HTTPException(404, "Upload not found")
    excluded = s.scalar(select(func.count()).select_from(m.StockBalance).where(
        m.StockBalance.tenant_id == user.tenant_id, m.StockBalance.upload_id == upload_id,
        m.StockBalance.excluded.is_(True))) or 0
    files = []
    for name, (_, _, required) in FILES.items():
        n = (up.row_counts or {}).get(name)
        rej = excluded if name == "fact_inventory_daily_snapshot" else 0
        files.append({"file": f"{name}.csv", "required": required, "rows": n,
                      "accepted": None if n is None else n - rej, "rejected": None if n is None else rej,
                      "status": "missing" if n is None else ("loaded" if rej == 0 else "loaded with rejects")})
    dq = s.scalars(select(m.DQResultRow).where(m.DQResultRow.upload_id == upload_id).order_by(m.DQResultRow.id)).all()
    run = s.scalar(select(m.CalculationRun).where(m.CalculationRun.upload_id == upload_id))
    return {"upload": {"id": up.id, "file_name": up.file_name, "uploaded_by": up.uploaded_by,
                       "uploaded_at": up.uploaded_at.isoformat(), "status": up.status,
                       "run_id": run.id if run else None},
            "files": files,
            "dq": [{"check_id": d.check_id, "name": d.name, "severity": d.severity, "fired": d.fired,
                    "affected_count": d.affected_count, "message": d.message, "assumption_id": d.assumption_id,
                    "sample": d.sample} for d in dq],
            "issues_found": sum(d.fired for d in dq)}


@router.get("/uploads")
def uploads(user: Principal = Depends(current_user), s: Session = Depends(get_db)):
    user.require("data", "V")
    rows = s.execute(select(m.Upload, m.CalculationRun.id, m.CalculationRun.status, m.CalculationRun.dq_summary)
                     .outerjoin(m.CalculationRun, m.CalculationRun.upload_id == m.Upload.id)
                     .where(m.Upload.tenant_id == user.tenant_id).order_by(m.Upload.id.desc()).limit(50)).all()
    try:
        ctx = run_ctx(s, user.tenant_id)
    except HTTPException:
        ctx = None
    return envelope([{"id": u.id, "file_name": u.file_name, "uploaded_by": u.uploaded_by,
                      "uploaded_at": u.uploaded_at.isoformat(), "status": u.status, "run_id": rid,
                      "run_status": rst, "issues_found": (dqs or {}).get("issues_found")}
                     for u, rid, rst, dqs in rows], ctx)


@router.get("/uploads/{upload_id}")
def upload_detail(upload_id: int, user: Principal = Depends(current_user), s: Session = Depends(get_db)):
    user.require("data", "V")
    rep = _upload_report(s, user, upload_id)
    return envelope(rep, run_ctx(s, user.tenant_id, rep["upload"]["run_id"]) if rep["upload"]["run_id"] else None)


@router.get("/dq")
def dq_latest(user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep), s: Session = Depends(get_db)):
    return envelope(_upload_report(s, user, ctx.upload_id), ctx)


@router.get("/assumptions")
def assumptions(user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep), s: Session = Depends(get_db)):
    from app.api.common import cached

    def load():
        rows = s.scalars(select(m.Assumption).where(m.Assumption.tenant_id == user.tenant_id)).all()
        return [{"id": a.assumption_id, "description": a.description, "default": a.default_value,
                 "current": a.current_value, "owner_question": a.owner_question, "status": a.status}
                for a in sorted(rows, key=lambda a: int(a.assumption_id[1:]))]
    data = cached(user.tenant_id, ctx.run_id, "assumptions", load)
    return envelope(data, ctx, [a["id"] for a in data])


@router.get("/policies")
def policies(user: Principal = Depends(current_user), s: Session = Depends(get_db)):
    """Read-only view of the tenant's inventory policies (Settings page)."""
    rows = s.scalars(select(m.InventoryPolicy).where(m.InventoryPolicy.tenant_id == user.tenant_id)
                     .order_by(m.InventoryPolicy.key)).all()
    return {"data": [{"key": p.key, "value": p.value} for p in rows]}


# ---------------- Run history ----------------
@router.get("/runs")
def runs(user: Principal = Depends(current_user), s: Session = Depends(get_db)):
    """Calculation runs for the tenant, newest first (Run History page)."""
    user.require("data", "V")
    rows = s.execute(select(m.CalculationRun, m.Upload.file_name, m.Upload.uploaded_by)
                     .join(m.Upload, m.Upload.id == m.CalculationRun.upload_id)
                     .where(m.CalculationRun.tenant_id == user.tenant_id)
                     .order_by(m.CalculationRun.id.desc()).limit(100)).all()
    out = []
    for r, fname, by in rows:
        k = r.kpis or {}
        dur = (r.finished_at - r.started_at).total_seconds() if r.finished_at and r.started_at else None
        out.append({"run_id": r.id, "upload_id": r.upload_id, "as_of": r.as_of_date.isoformat(),
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "duration_s": round(dur, 1) if dur is not None else None, "status": r.status,
                    "file_name": fname, "uploaded_by": by,
                    "issues_found": (r.dq_summary or {}).get("issues_found"),
                    "inventory_health_pct": k.get("inventory_health_pct"),
                    "critical_in_7_days": k.get("critical_in_7_days"),
                    "excess_value_inr": k.get("excess_value_inr")})
    return {"data": out}


# ---------------- Brief and reports ----------------
@router.get("/brief")
def brief(user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep), s: Session = Depends(get_db)):
    b = s.scalar(select(m.DailyBrief).where(m.DailyBrief.tenant_id == user.tenant_id)
                 .order_by(m.DailyBrief.id.desc()).limit(1))
    hist = s.execute(select(m.DailyBrief.id, m.DailyBrief.run_id, m.DailyBrief.kind, m.DailyBrief.created_at)
                     .where(m.DailyBrief.tenant_id == user.tenant_id).order_by(m.DailyBrief.id.desc()).limit(30)).all()
    data = None if b is None else {"id": b.id, "run_id": b.run_id, "kind": b.kind, "text": b.text, "facts": b.facts,
                                   "model_id": b.model_id, "created_at": b.created_at.isoformat(), "error": b.error}
    return envelope({"brief": data, "history": [{"id": i, "run_id": r, "kind": k, "created_at": c.isoformat()}
                                                for i, r, k, c in hist]}, ctx,
                    ["A1", "A10", "A13", "A14", "A15", "A19", "A20"])


@router.get("/brief/{brief_id}")
def brief_by_id(brief_id: int, user: Principal = Depends(current_user), ctx: RunCtx = Depends(ctx_dep),
                s: Session = Depends(get_db)):
    b = s.scalar(select(m.DailyBrief).where(m.DailyBrief.id == brief_id, m.DailyBrief.tenant_id == user.tenant_id))
    if b is None:
        raise HTTPException(404, "Brief not found")
    return envelope({"id": b.id, "run_id": b.run_id, "kind": b.kind, "text": b.text, "facts": b.facts,
                     "created_at": b.created_at.isoformat()}, ctx)


@router.get("/reports/daily-stock.xlsx")
def daily_stock_report(run_id: int | None = None, user: Principal = Depends(current_user),
                       s: Session = Depends(get_db)):
    ctx = run_ctx(s, user.tenant_id, run_id)
    data = daily_stock.build(s, user.tenant_id, ctx.run_id)
    return StreamingResponse(io.BytesIO(data),
                             media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition":
                                      f'attachment; filename="daily_stock_report_{ctx.as_of}_run{ctx.run_id}.xlsx"'})
