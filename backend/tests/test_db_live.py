"""Live-database tests (Neon). Skipped when DATABASE_URL is not set.

Loads the real dataset as tenant ORG-01 (idempotent replace) and checks row counts against the CSVs.
"""
import pandas as pd
import pytest
from sqlalchemy import func, select

from app import models as m
from app.config import get_settings

pytestmark = pytest.mark.skipif(not get_settings().database_url, reason="DATABASE_URL not set")

TENANT = "ORG-01"


@pytest.fixture(scope="module")
def loaded():
    import app.services  # noqa: F401
    from app.db import get_sessionmaker
    from app.pipeline import ingest

    with get_sessionmaker()() as s, s.begin():
        run_id, calc = ingest(s, get_settings().raw_data_path, TENANT, uploaded_by="pytest")
    return run_id, calc


def _count(s, model, **where):
    q = select(func.count()).select_from(model).where(model.tenant_id == TENANT)
    for k, v in where.items():
        q = q.where(getattr(model, k) == v)
    return s.scalar(q)


def test_row_counts_match_csvs(loaded):
    from app.db import get_sessionmaker
    run_id, calc = loaded
    raw = get_settings().raw_data_path
    csv = lambda n: len(pd.read_csv(raw / f"{n}.csv"))  # noqa: E731
    snap = pd.read_csv(raw / "fact_inventory_daily_snapshot.csv")
    with get_sessionmaker()() as s:
        assert _count(s, m.Material) == csv("dim_material")
        assert _count(s, m.Plant) == csv("dim_plant")
        assert _count(s, m.Supplier) == csv("dim_supplier")
        assert _count(s, m.Product) == csv("dim_product")
        assert _count(s, m.BomLine) == csv("fact_bom_component")
        assert _count(s, m.PurchaseOrder) == csv("fact_purchase_order_receipt")
        assert _count(s, m.CustomerOrder) == csv("fact_customer_order")
        assert _count(s, m.EngineeringChange) == csv("fact_engineering_change")
        assert _count(s, m.ProductionPlan, source="history") == csv("fact_production_order")
        assert _count(s, m.ProductionPlan, source="scenario") == len(calc.scenario)
        # stock_balances holds the as-of snapshot only (mapping: latest snapshot_date)
        assert _count(s, m.StockBalance) == int((snap["snapshot_date"] == snap["snapshot_date"].max()).sum())
        assert _count(s, m.GoodsReceipt) == int((pd.to_datetime(
            pd.read_csv(raw / "fact_purchase_order_receipt.csv")["receipt_date"]) <= calc.res.as_of).sum())


def test_every_status_in_database(loaded):
    from app.db import get_sessionmaker
    run_id, _ = loaded
    with get_sessionmaker()() as s:
        got = set(s.scalars(select(m.MaterialStatus.status).where(
            m.MaterialStatus.tenant_id == TENANT, m.MaterialStatus.run_id == run_id,
            m.MaterialStatus.demand_source == "scenario")))
        assert got == {"critical", "at_risk", "excess", "healthy", "stale"}
        # D31: both demand sources per run, 36 pairs and 36 x 60 projection days each
        for src in ("scenario", "production_orders"):
            assert _count(s, m.MaterialStatus, run_id=run_id, demand_source=src) == 36
            assert _count(s, m.InventoryProjection, run_id=run_id, demand_source=src) == 36 * 60
        assert _count(s, m.Assumption) >= 21
        run = s.get(m.CalculationRun, run_id)
        assert run.status == "succeeded" and run.kpis["status_counts"]["healthy"] >= 1
        assert run.config["demand_source"] == "scenario"  # A15 default unchanged (D32)
        assert set(run.kpis["by_source"]) == {"scenario", "production_orders"}
