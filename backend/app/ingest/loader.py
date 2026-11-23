"""Persist one ingestion: dataset -> tables, DQ results, calculation run and engine output.

One transaction per upload. Master and fact tables are replaced for the tenant (the upload is the
new truth); uploads, dq_results, calculation_runs and results keep their history by id.
All inserts are bulk executemany; nothing is queried per row.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

import numpy as np
import pandas as pd
from sqlalchemy import delete, insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app import models as m
from app.config import EngineConfig, load_seed_assumptions, load_seed_policies
from app.dq.checks import DQResult
from app.engine.demand import effective_bom
from app.engine.run import EngineResult
from app.engine.supply import approved_vendors, past_receipts
from app.ingest.reader import Dataset

# Replaced on every upload, children before parents.
REPLACED = [m.StorageLocation, m.ApprovedVendor, m.BomLine, m.StockBalance, m.PurchaseOrder, m.GoodsReceipt,
            m.ProductionPlan, m.CustomerOrder, m.EngineeringChange, m.Material, m.Product, m.Supplier, m.Plant]


def _py(v: Any) -> Any:
    if v is None or v is pd.NA or v is pd.NaT or (isinstance(v, (float, np.floating)) and np.isnan(v)):
        return None
    if isinstance(v, pd.Timestamp):
        return v.date()
    if isinstance(v, np.generic):
        return v.item()
    if isinstance(v, (list, tuple)):
        return [_py(x) for x in v]
    return v


def json_safe(v: Any) -> Any:
    """For JSON columns: like _py, but dates become ISO strings."""
    if isinstance(v, dict):
        return {k: json_safe(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [json_safe(x) for x in v]
    v = _py(v)
    return v.isoformat() if hasattr(v, "isoformat") else v


def records(df: pd.DataFrame, columns: dict[str, str] | Iterable[str], **const: Any) -> list[dict]:
    """DataFrame -> list of plain-Python dicts; `columns` maps source -> target name."""
    mapping = columns if isinstance(columns, dict) else {c: c for c in columns}
    sub = df[list(mapping)].rename(columns=mapping)
    out = []
    for row in sub.itertuples(index=False):
        rec = {k: _py(v) for k, v in zip(sub.columns, row)}
        rec.update(const)
        out.append(rec)
    return out


def _bulk(s: Session, model, rows: list[dict]) -> None:
    if rows:
        s.execute(insert(model), rows)


def ensure_tenant_config(s: Session, tenant_id: str, tenant_name: str = "Organization dataset") -> None:
    """Create the tenant and seed assumptions/policies once; never overwrite current values."""
    s.execute(pg_insert(m.Tenant).values(tenant_id=tenant_id, name=tenant_name).on_conflict_do_nothing())
    a_rows = [{"tenant_id": tenant_id, "assumption_id": a["id"], "description": a["description"],
               "default_value": a["value"], "current_value": a["value"], "owner_question": a["owner_question"],
               "status": "awaiting confirmation"} for a in load_seed_assumptions()]
    ins = pg_insert(m.Assumption).values(a_rows)
    # Wording and defaults follow the seed; a tenant's current_value is never overwritten.
    s.execute(ins.on_conflict_do_update(
        index_elements=["tenant_id", "assumption_id"],
        set_={"description": ins.excluded.description, "default_value": ins.excluded.default_value,
              "owner_question": ins.excluded.owner_question}))
    p_rows = [{"tenant_id": tenant_id, "key": k, "value": {"value": v}}
              for k, v in load_seed_policies().items() if k != "tenant_id"]
    s.execute(pg_insert(m.InventoryPolicy).values(p_rows).on_conflict_do_nothing())


def config_from_db(s: Session, tenant_id: str) -> EngineConfig:
    """EngineConfig from the tenant's current assumption and policy values."""
    assumptions = [{"id": a.assumption_id, "value": a.current_value}
                   for a in s.scalars(select(m.Assumption).where(m.Assumption.tenant_id == tenant_id))]
    policies = {p.key: p.value["value"]
                for p in s.scalars(select(m.InventoryPolicy).where(m.InventoryPolicy.tenant_id == tenant_id))}
    policies["tenant_id"] = tenant_id
    return EngineConfig.from_values(assumptions, policies)


def load_upload(s: Session, ds: Dataset, scenario: pd.DataFrame | None, dq: list[DQResult], res: EngineResult,
                *, file_name: str, uploaded_by: str, started_at: datetime, alt: EngineResult | None = None) -> int:
    """Write everything for one upload; returns the calculation run id."""
    t = res.config.tenant_id
    as_of = res.as_of

    upload = m.Upload(tenant_id=t, file_name=file_name, uploaded_by=uploaded_by, status="loaded",
                      row_counts={k: int(len(v)) for k, v in ds.frames.items()})
    s.add(upload)
    s.flush()

    for model in REPLACED:
        s.execute(delete(model).where(model.tenant_id == t))

    # masters
    _bulk(s, m.Plant, records(ds["dim_plant"], ["plant_id", "plant_name", "state", "currency"], tenant_id=t))
    mats = ds["dim_material"]
    _bulk(s, m.Material, records(mats, ["material_id", "material_name", "material_category", "uom",
                                        "standard_price_inr", "lead_time_days", "safety_stock_qty", "moq",
                                        "shelf_life_days"]
                                 + (["approved_vendor_required"] if "approved_vendor_required" in mats else []),
                                 tenant_id=t))
    prod = ds["dim_product"]
    _bulk(s, m.Product, records(prod, ["product_id", "product_name"]
                                + (["product_family"] if "product_family" in prod else []), tenant_id=t))
    _bulk(s, m.Supplier, records(ds["dim_supplier"], ["supplier_id", "supplier_name", "country", "material_category",
                                                      "approved_status", "risk_tier", "standard_lead_time_days"],
                                 tenant_id=t))
    av = approved_vendors(mats, ds["dim_supplier"])
    _bulk(s, m.ApprovedVendor, records(av, ["material_id", "supplier_id"], tenant_id=t, basis="category match (A11)"))
    bom = ds["fact_bom_component"].copy()
    bom["qty_per"] = bom["component_qty"] * (1 + bom["scrap_factor"])
    _bulk(s, m.BomLine, records(bom, ["product_id", "material_id", "component_qty", "scrap_factor", "qty_per",
                                      "revision", "effective_from", "effective_to"], tenant_id=t))

    # stock on the as-of date (A1, A2)
    rows = res.stock_rows
    _bulk(s, m.StorageLocation, records(rows[["plant_id", "warehouse_id"]].drop_duplicates(),
                                        ["plant_id", "warehouse_id"], tenant_id=t))
    _bulk(s, m.StockBalance, records(rows, {
        "snapshot_date": "snapshot_date", "plant_id": "plant_id", "material_id": "material_id",
        "warehouse_id": "warehouse_id", "lot_id": "lot_id", "on_hand_qty": "on_hand_qty",
        "allocated_qty": "allocated_qty", "blocked_qty": "blocked_qty", "quality_hold_qty": "quality_hold_qty",
        "in_transit_qty": "in_transit_qty", "safety_stock_qty": "snapshot_safety_stock_qty",
        "inventory_status": "inventory_status", "unit_cost_inr": "unit_cost_inr", "expiry_date": "expiry_date",
        "excluded": "excluded"}, tenant_id=t, upload_id=upload.id))

    # purchasing (A8, A9, A18)
    po = ds["fact_purchase_order_receipt"].copy()
    po["open_qty"] = np.where(po["po_status"].isin(["OPEN", "PARTIAL"]),
                              (po["ordered_qty"] - po["received_qty"]).clip(lower=0), 0)
    _bulk(s, m.PurchaseOrder, records(po, ["po_id", "po_line", "supplier_id", "material_id", "plant_id", "po_date",
                                           "promised_date", "receipt_date", "ordered_qty", "received_qty",
                                           "open_qty", "unit_price_inr", "po_status"]
                                      + (["incoterm"] if "incoterm" in po else []), tenant_id=t, upload_id=upload.id))
    gr = past_receipts(ds["fact_purchase_order_receipt"], as_of)
    _bulk(s, m.GoodsReceipt, records(gr, {"po_id": "po_id", "po_line": "po_line", "supplier_id": "supplier_id",
                                          "material_id": "material_id", "plant_id": "plant_id",
                                          "receipt_date": "received_date", "received_qty": "received_qty",
                                          "actual_lt_days": "actual_lt_days"}, tenant_id=t))

    # production: history + scenario (A15)
    plan_cols = ["production_order_id", "plant_id", "product_id", "customer_order_id", "order_qty", "priority",
                 "planned_start", "planned_finish", "due_date", "order_status"]
    _bulk(s, m.ProductionPlan, records(ds["fact_production_order"], plan_cols, tenant_id=t, source="history"))
    if scenario is not None:
        sc = scenario.copy()
        sc["customer_order_id"] = sc["customer_order_id"].replace("", None)
        _bulk(s, m.ProductionPlan, records(sc, plan_cols, tenant_id=t, source="scenario"))

    co = ds.get("fact_customer_order")
    if co is not None:
        _bulk(s, m.CustomerOrder, records(co, [c for c in ["customer_order_id", "customer_id", "product_id",
                                                            "order_date", "requested_delivery_date",
                                                            "confirmed_delivery_date", "order_qty", "shipped_qty",
                                                            "order_status", "priority"] if c in co], tenant_id=t))
    ec = ds.get("fact_engineering_change")
    if ec is not None:
        _bulk(s, m.EngineeringChange, records(ec, {c: ("material_id" if c == "part_id" else c) for c in [
            "change_request_id", "change_type", "product_id", "part_id", "old_revision", "new_revision",
            "request_date", "cut_in_date", "affected_inventory_qty", "implementation_status"] if c in ec},
            tenant_id=t))

    # DQ results
    _bulk(s, m.DQResultRow, [{**d.to_dict(), "tenant_id": t, "upload_id": upload.id} for d in dq])

    # calculation run + outputs
    cfg = res.config
    run = m.CalculationRun(
        tenant_id=t, upload_id=upload.id, as_of_date=as_of.date(), started_at=started_at,
        finished_at=datetime.now(timezone.utc), status="succeeded",
        config={k: (list(v) if isinstance(v, tuple) else v) for k, v in cfg.__dict__.items() },
        dq_summary={"issues_found": sum(d.fired for d in dq),
                    "by_severity": pd.Series([d.severity for d in dq if d.fired]).value_counts().to_dict()},
        kpis=_kpis_json(res.kpis) | {"by_source": {r.config.demand_source: _kpis_json(r.kpis)
                                                    for r in (res, alt) if r is not None}},
    )
    s.add(run)
    s.flush()

    _write_outputs(s, res, t, run.id)
    if alt is not None:  # D31: the other demand source, view-only
        _write_outputs(s, alt, t, run.id, with_supply=False)
    return run.id


def _kpis_json(k: dict) -> dict:
    return json_safe(k)


def _write_outputs(s: Session, res: EngineResult, t: str, run_id: int, with_supply: bool = True) -> None:
    """Status and projection rows for one demand source (tagged demand_source); supply rows once per run."""
    cfg = res.config
    sm = res.summary.copy()
    input_cols = ["on_hand_qty", "allocated_qty", "blocked_qty", "quality_hold_qty", "usable_qty", "in_transit_qty",
                  "open_po_qty", "open_po_lines", "overdue_po_lines", "po_in_horizon_qty", "demand_horizon_qty",
                  "daily_demand_qty", "ss_qty", "snapshot_ss_qty", "max_qty", "lt_days", "lt_source",
                  "supplier_id", "moq", "uom", "window_days", "stockout_date", "orders_affected"]
    sm["inputs"] = [{c: json_safe(r[c]) for c in input_cols} | {"horizon_days": cfg.horizon_days,
                                                         "in_transit_days": cfg.in_transit_days,
                                                         "review_days": cfg.review_days,
                                                         "max_factor": cfg.max_factor}
                    for _, r in sm.iterrows()]
    sm["days_to_shortage"] = sm["days_to_shortage"].astype("Int64")
    sm["days_to_stockout"] = sm["days_to_stockout"].astype("Int64")
    _bulk(s, m.MaterialStatus, records(sm, ["material_id", "plant_id", "status", "shortage_date", "days_to_shortage",
                                            "usable_qty", "in_transit_qty", "open_po_qty", "demand_horizon_qty",
                                            "daily_demand_qty", "ss_qty", "max_qty", "min_projected_qty",
                                            "peak_projected_qty", "lt_days", "lt_source", "supplier_id",
                                            "usable_value_inr", "has_demand_basis", "demand_source",
                                            "assumption_ids", "inputs", "stockout_date", "days_to_stockout",
                                            "orders_affected", "window_days", "material_category", "uom"],
                                       tenant_id=t, run_id=run_id))
    daily = res.daily.copy()
    daily["demand_source"] = cfg.demand_source
    _bulk(s, m.InventoryProjection, records(daily, ["material_id", "plant_id", "date", "in_transit_in",
                                                    "po_receipts", "requirement", "projected_qty", "ss_qty",
                                                    "demand_source"], tenant_id=t, run_id=run_id))
    if not with_supply:
        return
    _bulk(s, m.PoSupplyLine, records(res.po_lines, ["po_id", "po_line", "supplier_id", "material_id", "plant_id",
                                                    "po_status", "po_date", "promised_date", "ordered_qty",
                                                    "received_qty", "open_qty", "expected_date", "date_basis",
                                                    "overdue", "days_overdue", "unit_price_inr"],
                                     tenant_id=t, run_id=run_id))
    _bulk(s, m.SupplierLeadTime, records(res.ranked_suppliers, {
        "material_id": "material_id", "supplier_id": "supplier_id", "rank": "rank", "on_time_pct": "on_time_pct",
        "on_time_basis": "on_time_basis", "actual_lt_days": "actual_lt_days", "promised_lt_days": "promised_lt_days",
        "standard_lead_time_days": "standard_lt_days", "receipts": "receipts"}, tenant_id=t, run_id=run_id))
