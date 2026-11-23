"""Ingestion pipeline shared by the CLI, the upload API and tests:
read -> DQ gate -> planning scenario -> engine -> load (one transaction) -> post-run hooks (proposals, brief).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Callable

import pandas as pd
from sqlalchemy.orm import Session

from app.config import EngineConfig, get_settings
from app.dq.checks import DQResult, run_dq
from app.engine.run import EngineResult, run_engine
from app.ingest.reader import Dataset, parse_plan, read_dataset
from seed import planning_scenario

# Hooks run inside the load transaction after the calculation run row exists: f(session, run_id, ds, res).
POST_RUN_HOOKS: list[Callable] = []
ALT_SOURCE = {"scenario": "production_orders", "production_orders": "scenario"}


@dataclass
class Calculated:
    ds: Dataset
    dq: list[DQResult]
    scenario: pd.DataFrame | None
    res: EngineResult
    alt: EngineResult | None = None  # the other demand source, view-only (D31)


def calculate(path: str | Path, cfg: EngineConfig, today: date | None = None,
              write_scenario: bool = True) -> Calculated:
    ds = read_dataset(path)
    dq = run_dq(ds, cfg, today=today or date.today())
    # The planning scenario is always generated: it is either the default demand or the alternative view.
    raw = planning_scenario.generate(ds, cfg)
    if write_scenario:
        planning_scenario.write(raw, get_settings().scenario_path)
    scenario = parse_plan(raw)
    res = run_engine(ds, cfg, scenario if cfg.demand_source == "scenario" else None)
    # D31: both demand sources every run; the default drives proposals, brief and agent, the other is view-only.
    other = ALT_SOURCE[cfg.demand_source]
    alt = run_engine(ds, cfg.with_(demand_source=other), scenario if other == "scenario" else None)
    return Calculated(ds, dq, scenario if cfg.demand_source == "scenario" else None, res, alt)


def ingest(s: Session, path: str | Path, tenant_id: str, uploaded_by: str,
           file_name: str | None = None, write_scenario: bool | None = None) -> tuple[int, Calculated]:
    """Full ingestion for one tenant inside the caller's transaction; returns (run_id, calculated)."""
    from app.ingest.loader import config_from_db, ensure_tenant_config, load_upload

    started = datetime.now(timezone.utc)
    ensure_tenant_config(s, tenant_id)
    cfg = config_from_db(s, tenant_id)
    if write_scenario is None:  # only the default tenant owns data/scenario/
        write_scenario = tenant_id == EngineConfig.from_seed().tenant_id
    calc = calculate(path, cfg, write_scenario=write_scenario)
    run_id = load_upload(s, calc.ds, calc.scenario, calc.dq, calc.res, file_name=file_name or str(path),
                         uploaded_by=uploaded_by, started_at=started, alt=calc.alt)
    for hook in POST_RUN_HOOKS:
        hook(s, run_id, calc)
    return run_id, calc
