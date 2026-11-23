"""Tenant-isolation fixture: a small second tenant (TEN-02) built from a subset of the raw dataset.

Two materials at one plant; written to a temporary folder (the raw dataset is never modified) and loaded
through the normal pipeline. Users get the suffix '.t2' (e.g. buyer.t2).
"""
from __future__ import annotations

import tempfile
from pathlib import Path

import pandas as pd

from app.config import get_settings

TENANT = "TEN-02"
MATERIALS = ["MAT-SOC-001", "MAT-BOX-014"]
PLANT = "IN-KA-01"


def build_subset(dest: Path) -> Path:
    raw = get_settings().raw_data_path
    for f in raw.glob("*.csv"):
        df = pd.read_csv(f)
        if "material_id" in df.columns:
            df = df[df["material_id"].isin(MATERIALS)]
        if "part_id" in df.columns:
            df = df[df["part_id"].isin(MATERIALS)]
        if "plant_id" in df.columns:
            df = df[df["plant_id"] == PLANT]
        df.to_csv(dest / f.name, index=False)
    return dest


def load_second_tenant() -> int:
    import app.services  # noqa: F401
    from app import models as m
    from app.auth import DEMO_USERS, seed_roles_and_users
    from app.db import get_sessionmaker
    from app.pipeline import ingest
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    with tempfile.TemporaryDirectory() as d, get_sessionmaker()() as s, s.begin():
        s.execute(pg_insert(m.Tenant).values(tenant_id=TENANT, name="Isolation test tenant").on_conflict_do_nothing())
        run_id, _ = ingest(s, build_subset(Path(d)), TENANT, uploaded_by="fixture", write_scenario=False)
        seed_roles_and_users(s, TENANT, [(u, n, r, "*") for u, n, r, _ in DEMO_USERS if "." not in u], suffix=".t2")
    return run_id
