"""Shared API pieces: DB session, run context, response envelope, paging/sorting, .xlsx export, run cache."""
from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from typing import Any, Iterable

import pandas as pd
from fastapi import Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.auth import Principal, current_user
from app.db import get_sessionmaker
from app.ingest.loader import _py

BASE_ASSUMPTIONS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A14", "A15", "A19", "A20"]


def get_db():
    s = get_sessionmaker()()
    try:
        yield s
    finally:
        s.close()


@dataclass
class RunCtx:
    run_id: int
    as_of: date
    data_age_days: int
    demand_source: str
    staleness_days: int
    horizon_days: int
    review_days: int
    kpis: dict
    config: dict
    upload_id: int

    def meta(self, assumption_ids: Iterable[str] | None = None, **extra) -> dict:
        ids = sorted(set(assumption_ids if assumption_ids is not None else BASE_ASSUMPTIONS), key=lambda x: int(x[1:]))
        return {"as_of": self.as_of.isoformat(), "data_age_days": self.data_age_days, "run_id": self.run_id,
                "assumption_ids": ids, "demand_source": self.demand_source,
                "stale": self.data_age_days > self.staleness_days} | extra


_LATEST: dict[str, tuple[float, int | None]] = {}   # tenant -> (fetched_at, latest run id)
_RUNS: dict[int, m.CalculationRun] = {}
_FRAMES: dict[tuple, Any] = {}
LATEST_TTL_S = 20.0


def clear_caches() -> None:
    """Called after every upload / run."""
    _LATEST.clear()
    _FRAMES.clear()
    _status_cached.cache_clear()
    _projection_cached.cache_clear()


def cached(tenant_id: str, run_id: int, name: str, fn):
    """Memoise immutable per-run data (frames, lists) by (tenant, run, name)."""
    key = (tenant_id, run_id, name)
    if key not in _FRAMES:
        _FRAMES[key] = fn()
    return _FRAMES[key]


def run_ctx(s: Session, tenant_id: str, run_id: int | None = None) -> RunCtx:
    import time
    if run_id is None:
        hit = _LATEST.get(tenant_id)
        if hit and time.monotonic() - hit[0] < LATEST_TTL_S:
            run_id = hit[1]
        else:
            run_id = s.scalar(select(m.CalculationRun.id).where(m.CalculationRun.tenant_id == tenant_id,
                                                               m.CalculationRun.status == "succeeded")
                              .order_by(m.CalculationRun.id.desc()).limit(1))
            _LATEST[tenant_id] = (time.monotonic(), run_id)
    r = None
    if run_id is not None:
        r = _RUNS.get(run_id)
        if r is None:
            r = s.scalar(select(m.CalculationRun).where(m.CalculationRun.id == run_id))
            if r is not None:
                s.expunge(r)
                _RUNS[run_id] = r
    if r is None or r.tenant_id != tenant_id or r.status != "succeeded":
        raise HTTPException(404, "No calculation run yet — upload the dataset first")
    return RunCtx(r.id, r.as_of_date, (date.today() - r.as_of_date).days, r.config["demand_source"],
                  int(r.config["staleness_days"]), int(r.config["horizon_days"]), int(r.config["review_days"]),
                  r.kpis, r.config, r.upload_id)


def ctx_dep(user: Principal = Depends(current_user), s: Session = Depends(get_db)) -> RunCtx:
    return run_ctx(s, user.tenant_id)


def envelope(data: Any, ctx: RunCtx | None, assumption_ids: Iterable[str] | None = None, **extra) -> dict:
    return {"data": data, "meta": ctx.meta(assumption_ids, **extra) if ctx else extra}


def rows_of(df: pd.DataFrame) -> list[dict]:
    return [{k: _py(v) for k, v in rec.items()} for rec in df.to_dict("records")]


@dataclass
class Grid:
    page: int
    page_size: int
    sort: str | None
    dir: str


def grid_params(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500),
                sort: str | None = None, dir: str = Query("asc", pattern="^(asc|desc)$")) -> Grid:
    return Grid(page, page_size, sort, dir)


def page_df(df: pd.DataFrame, g: Grid, default_sort: list[str] | None = None) -> dict:
    """Server-side sorting and paging of an already-filtered frame (sort keys are whitelisted by columns)."""
    if g.sort and g.sort in df.columns:
        df = df.sort_values(g.sort, ascending=g.dir == "asc", na_position="last", kind="mergesort")
    elif default_sort:
        df = df.sort_values(default_sort, na_position="last", kind="mergesort")
    total = len(df)
    start = (g.page - 1) * g.page_size
    return {"rows": rows_of(df.iloc[start:start + g.page_size]), "total": total, "page": g.page,
            "page_size": g.page_size}


def xlsx_response(sheets: dict[str, pd.DataFrame], filename: str) -> StreamingResponse:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as xw:
        for name, df in sheets.items():
            df.to_excel(xw, sheet_name=name[:31], index=False)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ---------- immutable per-run data, cached by (tenant, run_id) ----------
SOURCES = ("scenario", "production_orders")


def resolve_source(ctx: "RunCtx", source: str | None) -> str:
    """The demand source to show: the run's default unless a valid alternative was asked for (D31, view-only)."""
    if source in (None, "", ctx.demand_source):
        return ctx.demand_source
    if source not in SOURCES:
        raise HTTPException(422, f"Unknown demand source '{source}'")
    if source not in (ctx.kpis.get("by_source") or {}):
        raise HTTPException(404, "This calculation run has no results for that demand source — upload the dataset again")
    return source


@lru_cache(maxsize=32)
def _status_cached(tenant_id: str, run_id: int, source: str) -> pd.DataFrame:
    with get_sessionmaker()() as s:
        q = select(m.MaterialStatus, m.Material.material_name, m.Material.standard_price_inr, m.Material.moq,
                   m.Material.lead_time_days) \
            .join(m.Material, (m.Material.tenant_id == m.MaterialStatus.tenant_id)
                  & (m.Material.material_id == m.MaterialStatus.material_id)) \
            .where(m.MaterialStatus.tenant_id == tenant_id, m.MaterialStatus.run_id == run_id,
                   m.MaterialStatus.demand_source == source)
        recs = []
        for ms, name, price, moq, mlt in s.execute(q).all():
            d = {c.name: getattr(ms, c.name) for c in m.MaterialStatus.__table__.columns}
            inp = d.pop("inputs") or {}
            d |= {k: inp.get(k) for k in ("on_hand_qty", "allocated_qty", "blocked_qty", "quality_hold_qty",
                                          "open_po_lines", "overdue_po_lines")}
            d |= {"material_name": name, "standard_price_inr": float(price), "moq": float(moq), "master_lt_days": mlt}
            recs.append(d)
    df = pd.DataFrame(recs)
    num = ["usable_qty", "in_transit_qty", "open_po_qty", "demand_horizon_qty", "daily_demand_qty", "ss_qty", "max_qty",
           "min_projected_qty", "peak_projected_qty", "usable_value_inr", "on_hand_qty", "allocated_qty",
           "blocked_qty", "quality_hold_qty"]
    df[num] = df[num].astype(float)
    df["days_of_cover"] = (df["usable_qty"] / df["daily_demand_qty"].where(df["daily_demand_qty"] > 0)).round(1)
    df["shortage_qty"] = (df["ss_qty"] - df["min_projected_qty"]).clip(lower=0).where(df["shortage_date"].notna(), 0)
    df["on_hand_value_inr"] = df["on_hand_qty"] * df["standard_price_inr"]
    return df.drop(columns=["id"])


def status_df(user: Principal, ctx: RunCtx, plant: str | None = None, source: str | None = None) -> pd.DataFrame:
    df = _status_cached(user.tenant_id, ctx.run_id, resolve_source(ctx, source))
    return df[df["plant_id"].isin(user.scope(plant))].copy()


@lru_cache(maxsize=16)
def _projection_cached(tenant_id: str, run_id: int, source: str) -> pd.DataFrame:
    with get_sessionmaker()() as s:
        q = select(m.InventoryProjection.material_id, m.InventoryProjection.plant_id, m.InventoryProjection.date,
                   m.InventoryProjection.in_transit_in, m.InventoryProjection.po_receipts,
                   m.InventoryProjection.requirement, m.InventoryProjection.projected_qty, m.InventoryProjection.ss_qty) \
            .where(m.InventoryProjection.tenant_id == tenant_id, m.InventoryProjection.run_id == run_id,
                   m.InventoryProjection.demand_source == source)
        df = pd.DataFrame(s.execute(q).all(), columns=["material_id", "plant_id", "date", "in_transit_in",
                                                         "po_receipts", "requirement", "projected_qty", "ss_qty"])
    for c in ["in_transit_in", "po_receipts", "requirement", "projected_qty", "ss_qty"]:
        df[c] = df[c].astype(float)
    return df


def projection_df(user: Principal, ctx: RunCtx, source: str | None = None) -> pd.DataFrame:
    return _projection_cached(user.tenant_id, ctx.run_id, resolve_source(ctx, source))


def warm(tenant_id: str | None = None) -> None:
    """Fill the per-run caches for every tenant (or one) so first page loads stay fast."""
    with get_sessionmaker()() as s:
        tenants = [tenant_id] if tenant_id else list(s.scalars(select(m.CalculationRun.tenant_id).distinct()))
        for t in tenants:
            try:
                ctx = run_ctx(s, t)
            except HTTPException:
                continue
            for src in (ctx.kpis.get("by_source") or {ctx.demand_source: None}):
                _status_cached(t, ctx.run_id, src)
                _projection_cached(t, ctx.run_id, src)
            from app.api.routes_inventory import _tenant_frames
            _tenant_frames(s, t, ctx)
