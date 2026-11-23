"""Test isolation: every database test runs against TEST_DATABASE_URL (a Neon test branch), never main.

The swap happens here, before any test imports the engine, so ORG-01 on main can't be reloaded or modified by tests.
Without TEST_DATABASE_URL the database tests are skipped (they skip when DATABASE_URL is empty).
"""
import os

from app.config import get_settings as _gs

_s = _gs()
_main = (_s.database_url or "").strip()
_test = (_s.test_database_url or "").strip()
if _test and _test == _main:
    raise RuntimeError("TEST_DATABASE_URL equals DATABASE_URL - tests must use a separate Neon branch")
os.environ["DATABASE_URL"] = _test  # empty -> database tests skip
os.environ["DATABASE_URL_DIRECT"] = (_s.test_database_url_direct or _test).strip()

import pandas as pd
import pytest

from app.config import EngineConfig, get_settings
from app.engine.run import run_engine
from app.ingest.reader import parse_plan, read_dataset
from seed import planning_scenario

AS_OF = pd.Timestamp("2026-10-31")


@pytest.fixture(scope="session")
def ds():
    return read_dataset(get_settings().raw_data_path)


@pytest.fixture(scope="session")
def cfg():
    return EngineConfig.from_seed()


@pytest.fixture(scope="session")
def scenario(ds, cfg):
    return parse_plan(planning_scenario.generate(ds, cfg))


@pytest.fixture(scope="session")
def result(ds, cfg, scenario):
    return run_engine(ds, cfg, scenario)


def pair(summary: pd.DataFrame, material: str, plant: str) -> pd.Series:
    return summary.set_index(["material_id", "plant_id"]).loc[(material, plant)]
