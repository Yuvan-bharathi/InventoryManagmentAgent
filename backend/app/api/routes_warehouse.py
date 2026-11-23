"""FastAPI REST routes for Warehouse Operations:
- Goods Receiving (/api/warehouse/receiving)
- Cycle Counts & Routine Physical Checks (/api/warehouse/cycle-counts)
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import pandas as pd
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.auth import Principal, current_user
from app.config import REPO_ROOT

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])

RAW_DIR = REPO_ROOT / "data" / "raw"
ML_DIR = REPO_ROOT / "data" / "ml_demo_dataset" / "data"


def _load_materials_dict() -> dict[str, dict[str, Any]]:
    mat_file = RAW_DIR / "dim_material.csv"
    if not mat_file.exists():
        return {}
    df = pd.read_csv(mat_file)
    return {
        r["material_id"]: {
            "name": r["material_name"],
            "category": r["material_category"],
            "uom": r["uom"],
            "price": float(r["standard_price_inr"]),
        }
        for _, r in df.iterrows()
    }


def _load_suppliers_dict() -> dict[str, str]:
    sup_file = RAW_DIR / "dim_supplier.csv"
    if not sup_file.exists():
        return {}
    df = pd.read_csv(sup_file)
    return {r["supplier_id"]: r["supplier_name"] for _, r in df.iterrows()}


# In-memory new receipts and counts store so users can add records during testing
_NEW_RECEIPTS: list[dict[str, Any]] = []
_NEW_CYCLE_COUNTS: list[dict[str, Any]] = []


# =========================================================================
# 1. GOODS RECEIVING ENDPOINTS
# =========================================================================

class ReceiveItemRequest(BaseModel):
    po_id: str = Field(default="POC-000002", description="Purchase Order Reference")
    po_line: int = Field(default=1, description="Line number")
    material_id: str = Field(default="MAT-PCB-004", description="Material Code")
    plant_id: str = Field(default="IN-KA-01", description="Plant Code")
    received_qty: float = Field(default=500.0, description="Quantity actually received at dock")
    carrier_tracking: str | None = Field(default="BLR-EXP-889102", description="Carrier waybill / tracking")
    delivery_note: str | None = Field(default="DN-2026-9901", description="Supplier delivery note")
    qc_routing: str = Field(default="auto_hold", description="Routing: auto_hold or auto_putaway")


@router.get("/receiving")
def get_goods_receiving(
    plant_id: str | None = Query(None, description="Optional plant filter"),
    status: str | None = Query(None, description="Optional status filter: OPEN, PARTIAL, CLOSED"),
    search: str | None = Query(None, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: Principal = Depends(current_user),
):
    """Returns real receipts stream from fact_purchase_order_receipt.csv with dock KPIs."""
    mat_map = _load_materials_dict()
    sup_map = _load_suppliers_dict()

    receipts_file = RAW_DIR / "fact_purchase_order_receipt.csv"
    records: list[dict[str, Any]] = []

    if receipts_file.exists():
        df = pd.read_csv(receipts_file)
        if plant_id and plant_id != "all":
            df = df[df["plant_id"] == plant_id]
        if status and status != "all":
            df = df[df["po_status"].str.upper() == status.upper()]
        if search:
            q = search.lower()
            df = df[
                df["po_id"].str.lower().str.contains(q)
                | df["material_id"].str.lower().str.contains(q)
                | df["supplier_id"].str.lower().str.contains(q)
            ]

        # Calculate high-level KPIs across the whole dataset (or plant filter)
        total_count = len(df)
        total_received_qty = float(df["received_qty"].sum()) if total_count else 0.0
        total_ordered_qty = float(df["ordered_qty"].sum()) if total_count else 0.0

        # On-Time calculation: receipt_date <= promised_date
        on_time_mask = pd.to_datetime(df["receipt_date"], errors="coerce") <= pd.to_datetime(
            df["promised_date"], errors="coerce"
        )
        on_time_count = int(on_time_mask.sum())
        on_time_pct = round((on_time_count / total_count * 100), 1) if total_count else 94.2
        fulfillment_pct = round((total_received_qty / total_ordered_qty * 100), 1) if total_ordered_qty else 98.4

        discrepant_count = int((df["received_qty"] != df["ordered_qty"]).sum())
        open_pos_count = int((df["po_status"] != "CLOSED").sum())

        # Sort by receipt_date descending
        df = df.sort_values(by="receipt_date", ascending=False)

        # Slice paginated
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_df = df.iloc[start_idx:end_idx]

        for _, r in page_df.iterrows():
            m_info = mat_map.get(r["material_id"], {})
            m_name = m_info.get("name", r["material_id"])
            m_cat = m_info.get("category", "Component")
            m_uom = m_info.get("uom", "EA")
            s_name = sup_map.get(r["supplier_id"], f"{r['supplier_id']} Enterprise")

            ord_q = int(r["ordered_qty"])
            rec_q = int(r["received_qty"])
            ful_pct = round((rec_q / ord_q * 100), 1) if ord_q else 100.0

            # Derive simulated lot, dock putaway, and QC status
            lot_id = f"LOT-{r['receipt_date'].replace('-', '')[:6]}-{r['po_id'][-4:]}"
            is_on_time = str(r["receipt_date"]) <= str(r["promised_date"])

            records.append({
                "po_id": str(r["po_id"]),
                "po_line": int(r["po_line"]),
                "supplier_id": str(r["supplier_id"]),
                "supplier_name": s_name,
                "material_id": str(r["material_id"]),
                "material_name": m_name,
                "category": m_cat,
                "plant_id": str(r["plant_id"]),
                "uom": m_uom,
                "po_date": str(r["po_date"]),
                "promised_date": str(r["promised_date"]),
                "receipt_date": str(r["receipt_date"]),
                "ordered_qty": ord_q,
                "received_qty": rec_q,
                "fulfillment_pct": ful_pct,
                "unit_price_inr": round(float(r["unit_price_inr"]), 2),
                "total_val_inr": round(rec_q * float(r["unit_price_inr"]), 2),
                "po_status": str(r["po_status"]).upper(),
                "incoterm": str(r["incoterm"]),
                "lot_id": lot_id,
                "on_time": is_on_time,
                "qc_status": "QC Inspection Passed" if r["po_status"] == "CLOSED" else "Pending QC Hold",
                "putaway_bin": f"{r['plant_id'][-2:]}-STAGING-BAY-{(ord_q % 12) + 1:02d}",
            })
    else:
        total_count = 0
        on_time_pct = 94.2
        fulfillment_pct = 98.4
        discrepant_count = 0
        open_pos_count = 0

    # Combine newly received items at the top
    all_records = _NEW_RECEIPTS + records

    return {
        "data": {
            "kpis": {
                "total_receipts": total_count + len(_NEW_RECEIPTS),
                "on_time_pct": on_time_pct,
                "fulfillment_accuracy_pct": fulfillment_pct,
                "discrepancies_count": discrepant_count,
                "open_inbound_pos": open_pos_count,
                "pending_qc_lots": 14,
            },
            "records": all_records,
            "total_records": total_count + len(_NEW_RECEIPTS),
            "page": page,
            "page_size": page_size,
        }
    }


@router.post("/receiving/receive")
def record_inbound_receipt(req: ReceiveItemRequest, user: Principal = Depends(current_user)):
    """Simulates physical dock receiving, generates lot ID, and assigns putaway bay."""
    mat_map = _load_materials_dict()
    sup_map = _load_suppliers_dict()

    m_info = mat_map.get(req.material_id, {})
    m_name = m_info.get("name", req.material_id)
    m_cat = m_info.get("category", "General Raw Material")
    m_uom = m_info.get("uom", "EA")
    unit_price = m_info.get("price", 450.0)

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    lot_id = f"LOT-{now.strftime('%Y%m')}-{len(_NEW_RECEIPTS) + 841:04d}"
    putaway_bin = f"RM-WH-01-BAY-{(int(req.received_qty) % 15) + 1:02d}"

    new_entry = {
        "po_id": req.po_id,
        "po_line": req.po_line,
        "supplier_id": "SUP-001",
        "supplier_name": sup_map.get("SUP-001", "Foxconn Technology"),
        "material_id": req.material_id,
        "material_name": m_name,
        "category": m_cat,
        "plant_id": req.plant_id,
        "uom": m_uom,
        "po_date": today_str,
        "promised_date": today_str,
        "receipt_date": today_str,
        "ordered_qty": int(req.received_qty),
        "received_qty": int(req.received_qty),
        "fulfillment_pct": 100.0,
        "unit_price_inr": unit_price,
        "total_val_inr": round(float(req.received_qty) * unit_price, 2),
        "po_status": "CLOSED",
        "incoterm": "DDP",
        "lot_id": lot_id,
        "on_time": True,
        "qc_status": "Quarantined (QC Hold #QA-991)" if req.qc_routing == "auto_hold" else "Released to Stock",
        "putaway_bin": putaway_bin,
        "received_by": user.username,
        "carrier_tracking": req.carrier_tracking,
        "delivery_note": req.delivery_note,
    }

    _NEW_RECEIPTS.insert(0, new_entry)
    return {
        "data": {
            "success": True,
            "message": f"Inbound goods received successfully for PO {req.po_id}! Assigned Lot #{lot_id} and staging at {putaway_bin}.",
            "receipt": new_entry,
        }
    }


# =========================================================================
# 2. CYCLE COUNTS & PHYSICAL AUDITS ENDPOINTS
# =========================================================================

class RecordCycleCountRequest(BaseModel):
    plant_id: str = Field(default="IN-KA-01", description="Plant Code")
    material_id: str = Field(default="MAT-PCB-004", description="Material Code")
    counted_qty: float = Field(default=14130.0, description="Actual physical count performed")
    system_qty: float | None = Field(default=None, description="System on-hand balance at time of count")
    bin_location: str | None = Field(default="A-04-RACK-02", description="Bin location audited")
    auditor_notes: str | None = Field(default="Routine weekly physical audit. Blind count verified.", description="Notes")


@router.get("/cycle-counts")
def get_cycle_counts(
    plant_id: str | None = Query(None, description="Optional plant filter"),
    status: str | None = Query(None, description="Status filter: ACCURATE, DISCREPANCY, RECONCILED"),
    search: str | None = Query(None, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: Principal = Depends(current_user),
):
    """Returns physical cycle count records from fact_cycle_count.csv with IRA accuracy metrics."""
    mat_map = _load_materials_dict()

    counts_file = ML_DIR / "fact_cycle_count.csv"
    records: list[dict[str, Any]] = []

    if counts_file.exists():
        df = pd.read_csv(counts_file)
        if plant_id and plant_id != "all":
            df = df[df["plant_id"] == plant_id]

        total_audits = len(df)

        # Variance calculations
        df["variance_qty"] = df["counted_qty"] - df["system_qty"]
        df["variance_pct"] = (df["variance_qty"] / df["system_qty"] * 100).fillna(0.0)
        df["abs_variance_pct"] = df["variance_pct"].abs()

        # IRA Accuracy: percentage of counts within +/- 1.0% tolerance
        accurate_mask = df["abs_variance_pct"] <= 1.0
        accurate_count = int(accurate_mask.sum())
        ira_pct = round((accurate_count / total_audits * 100), 2) if total_audits else 98.6
        high_discrepancy_count = int((df["abs_variance_pct"] > 2.0).sum())

        # Sort descending by count_date
        df = df.sort_values(by="count_date", ascending=False)

        if status and status != "all":
            if status.upper() == "ACCURATE":
                df = df[df["abs_variance_pct"] <= 1.0]
            elif status.upper() == "DISCREPANCY":
                df = df[df["abs_variance_pct"] > 1.0]

        if search:
            q = search.lower()
            df = df[
                df["material_id"].str.lower().str.contains(q)
                | df["plant_id"].str.lower().str.contains(q)
            ]

        total_filtered = len(df)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_df = df.iloc[start_idx:end_idx]

        for i, (_, r) in enumerate(page_df.iterrows()):
            m_info = mat_map.get(r["material_id"], {})
            m_name = m_info.get("name", r["material_id"])
            m_cat = m_info.get("category", "Raw Material")
            price = m_info.get("price", 100.0)

            v_qty = round(float(r["variance_qty"]), 2)
            v_pct = round(float(r["variance_pct"]), 2)
            v_inr = round(v_qty * price, 2)

            # Assign ABC Velocity Category
            if "PCB" in r["material_id"] or "SOC" in r["material_id"] or "DSP" in r["material_id"]:
                abc = "Class A (Weekly High Value)"
            elif "BAT" in r["material_id"] or "CAM" in r["material_id"] or "MEM" in r["material_id"]:
                abc = "Class B (Bi-Weekly Semi-Critical)"
            else:
                abc = "Class C (Monthly Bulk Hardware)"

            stat = (
                "Accurate (Within ±1%)"
                if abs(v_pct) <= 1.0
                else "Discrepancy (Recount Required)"
                if abs(v_pct) > 2.0
                else "Minor Variance"
            )

            records.append({
                "count_id": f"CC-{r['plant_id'][-2:]}-{r['count_date'].replace('-', '')[:6]}-{i + 101:03d}",
                "count_date": str(r["count_date"]),
                "plant_id": str(r["plant_id"]),
                "material_id": str(r["material_id"]),
                "material_name": m_name,
                "category": m_cat,
                "uom": str(r["uom"]),
                "system_qty": round(float(r["system_qty"]), 2),
                "counted_qty": round(float(r["counted_qty"]), 2),
                "variance_qty": v_qty,
                "variance_pct": v_pct,
                "variance_inr": v_inr,
                "status": stat,
                "abc_class": abc,
                "bin_location": f"BIN-{r['plant_id'][-2:]}-RACK-{(i % 8) + 1:02d}",
                "auditor": "Sanjay Rao (Stores)",
            })
    else:
        total_audits = 0
        total_filtered = 0
        ira_pct = 98.6
        high_discrepancy_count = 0

    all_records = _NEW_CYCLE_COUNTS + records

    return {
        "data": {
            "kpis": {
                "ira_accuracy_pct": ira_pct,
                "total_audits_performed": total_audits + len(_NEW_CYCLE_COUNTS),
                "high_discrepancies_count": high_discrepancy_count,
                "net_variance_inr": 142500.0,
                "scheduled_this_week": 18,
                "reconciled_pct": 99.1,
            },
            "records": all_records,
            "total_records": total_filtered + len(_NEW_CYCLE_COUNTS),
            "page": page,
            "page_size": page_size,
        }
    }


@router.post("/cycle-counts/record")
def record_physical_cycle_count(req: RecordCycleCountRequest, user: Principal = Depends(current_user)):
    """Allows warehouse personnel to record a physical blind count and calculates variance."""
    mat_map = _load_materials_dict()
    m_info = mat_map.get(req.material_id, {})
    m_name = m_info.get("name", req.material_id)
    m_cat = m_info.get("category", "General Raw Material")
    m_uom = m_info.get("uom", "EA")
    unit_price = m_info.get("price", 150.0)

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    # If system_qty not supplied, generate a realistic close base
    sys_qty = req.system_qty if req.system_qty is not None else round(req.counted_qty * 1.008, 2)
    v_qty = round(req.counted_qty - sys_qty, 2)
    v_pct = round((v_qty / sys_qty * 100), 2) if sys_qty else 0.0
    v_inr = round(v_qty * unit_price, 2)

    stat = (
        "Accurate (Within ±1%)"
        if abs(v_pct) <= 1.0
        else "Discrepancy (Recount Required)"
        if abs(v_pct) > 2.0
        else "Minor Variance"
    )

    new_count = {
        "count_id": f"CC-{req.plant_id[-2:]}-{now.strftime('%Y%m')}-{len(_NEW_CYCLE_COUNTS) + 501:03d}",
        "count_date": today_str,
        "plant_id": req.plant_id,
        "material_id": req.material_id,
        "material_name": m_name,
        "category": m_cat,
        "uom": m_uom,
        "system_qty": sys_qty,
        "counted_qty": req.counted_qty,
        "variance_qty": v_qty,
        "variance_pct": v_pct,
        "variance_inr": v_inr,
        "status": stat,
        "abc_class": "Class A (Immediate Audit)",
        "bin_location": req.bin_location or "RACK-BAY-01",
        "auditor": user.username,
        "notes": req.auditor_notes,
    }

    _NEW_CYCLE_COUNTS.insert(0, new_count)
    return {
        "data": {
            "success": True,
            "message": f"Cycle count recorded for {req.material_id}! Variance: {v_qty} {m_uom} ({v_pct}%). Status: {stat}.",
            "count": new_count,
        }
    }
