"""FastAPI REST routes for the Inventory Intelligence Engine & Digital Twin."""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.common import get_db
from app.auth import Principal, current_user
from app.intelligence.capacity import calculate_production_capacity, explode_bom, get_packaging_conversions, simulate_receipt_capacity
from app.intelligence.conversions import convert_packaging
from app.intelligence.forecasting import calculate_demand_forecast, get_supplier_delivery_predictions
from app.intelligence.simulations import simulate_production_change, simulate_supplier_delay

router = APIRouter(prefix="/api", tags=["intelligence"])


# Request Models
class PackagingConvertRequest(BaseModel):
    material_code: str = Field(default="RM-SOLDER-01", description="Material identifier")
    package_uom: str = Field(default="BOX", description="Purchase or storage packaging UOM")
    package_qty: float = Field(default=20.0, description="Quantity of packaging units received")
    qc_loss_pct: float = Field(default=5.0, description="QC rejection or scrap loss percentage")
    unit_cost_inr: float = Field(default=250.0, description="Standard cost per base unit in INR")


class ProductionCapacityRequest(BaseModel):
    plant_id: str | None = None
    product_id: str | None = None
    scrap_multiplier: float = 1.0


class ProductionSimulationRequest(BaseModel):
    plant_id: str | None = None
    volume_change_pct: float = 20.0
    scrap_change_pct: float = 0.0


class SimulateReceiptRequest(BaseModel):
    plant_id: str = Field(default="IN-KA-01", description="Plant code: IN-KA-01 (Bengaluru) or IN-TN-01 (Chennai)")
    product_id: str = Field(default="SPH-A15-128", description="Target finished product model")
    material_id: str = Field(default="MAT-WIRE-019", description="Material code received, e.g. MAT-WIRE-019 or MAT-PCB-004")
    pack_quantity: float = Field(default=20.0, description="Quantity of purchase pack units received")
    pack_type: str | None = Field(default=None, description="Optional packaging type (BOX, CASE, REEL, TRAY, CARTON)")
    inners_per_pack: float | None = Field(default=None, description="Optional custom inner item count per pack (e.g. 10 coils/box, 8 coils/box)")


class SupplierDelaySimulationRequest(BaseModel):
    supplier_id: str | None = None
    delay_days: int = 5
    plant_id: str | None = None
    receipt_rate_pct: float = 100.0


class ScrapChangeSimulationRequest(BaseModel):
    plant_id: str | None = None
    scrap_increase_pct: float = 10.0


# 1. Module A: Packaging and UOM Conversion
@router.post("/materials/convert")
def convert_material(
    req: PackagingConvertRequest,
    u: Principal = Depends(current_user),
):
    """Convert received packaging units to usable base UOM with QC loss deductions."""
    res = convert_packaging(
        material_code=req.material_code,
        package_uom=req.package_uom,
        package_qty=req.package_qty,
        qc_loss_pct=req.qc_loss_pct,
        unit_cost_inr=req.unit_cost_inr,
    )
    return {"data": res, "status": "success"}


# 2. Module B: BOM Explosion
@router.post("/bom/explode")
def api_explode_bom(
    product_id: str | None = None,
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Expand multi-level BOM with scrap factors and component requirements."""
    res = explode_bom(s, u.tenant_id, product_id)
    return {"data": res, "total_components": len(res)}


# 3. Module B: Production Capacity & Bottlenecks
@router.get("/production/capacity")
@router.post("/production/capacity")
@router.get("/forecast/production-capacity")
def get_production_capacity_endpoint(
    plant_id: str | None = Query(None),
    product_id: str | None = Query(None),
    scrap_multiplier: float = Query(1.0),
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Calculate maximum finished products supported by available usable stock."""
    # Enforce plant permission if user is plant-scoped
    pid = plant_id if not u.plants or (plant_id in u.plants) else u.plants[0]
    res = calculate_production_capacity(
        s,
        tenant_id=u.tenant_id,
        plant_id=pid,
        product_id=product_id,
        scrap_multiplier=scrap_multiplier,
    )
    return {"data": res}


@router.get("/inventory/bottlenecks")
def get_bottlenecks_endpoint(
    plant_id: str | None = Query(None),
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Identify the exact limiting bottleneck materials across all finished products."""
    pid = plant_id if not u.plants or (plant_id in u.plants) else u.plants[0]
    res = calculate_production_capacity(s, tenant_id=u.tenant_id, plant_id=pid)
    return {"data": res["summary"]["bottlenecks"], "total": len(res["summary"]["bottlenecks"])}


@router.get("/production/packaging-conversions")
def get_packaging_conversions_endpoint(u: Principal = Depends(current_user)):
    """Return all packaging conversion rules and BOM standard consumption rates."""
    return {"data": get_packaging_conversions()}


@router.post("/production/simulate-receipt")
def simulate_receipt_endpoint(
    req: SimulateReceiptRequest,
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Simulate incoming pack receipt and calculate capacity added to plant vs receipt alone."""
    pid = req.plant_id if not u.plants or (req.plant_id in u.plants) else u.plants[0]
    res = simulate_receipt_capacity(
        s,
        tenant_id=u.tenant_id,
        plant_id=pid,
        product_id=req.product_id,
        material_id=req.material_id,
        pack_quantity=req.pack_quantity,
        pack_type=req.pack_type,
        inners_per_pack=req.inners_per_pack,
    )
    return {"data": res}


# 4. Module C: Material Demand Forecasting (30, 60, 90 Days)
@router.get("/forecast/material-demand")
def get_material_demand_forecast_endpoint(
    horizon: int = Query(30, description="Planning horizon in days: 30, 60, or 90"),
    plant_id: str | None = Query(None),
    category: str | None = Query(None),
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Retrieve 30, 60, or 90-day material demand forecast and replenishment requirements."""
    pid = plant_id if not u.plants or (plant_id in u.plants) else u.plants[0]
    res = calculate_demand_forecast(
        s,
        tenant_id=u.tenant_id,
        horizon_days=horizon,
        plant_id=pid,
        category=category,
    )
    return {"data": res, "horizon_days": horizon, "count": len(res)}


# 5. Module D: Supplier Delivery Intelligence
@router.get("/forecast/supplier-delivery")
def get_supplier_delivery_endpoint(
    plant_id: str | None = Query(None),
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Retrieve predicted supplier delivery dates and late-delivery risk ranking."""
    pid = plant_id if not u.plants or (plant_id in u.plants) else u.plants[0]
    res = get_supplier_delivery_predictions(s, tenant_id=u.tenant_id, plant_id=pid)
    return {"data": res, "total_lines": len(res)}


# 6. Module E: Scenario Simulations
@router.post("/simulations/production")
def simulate_production_endpoint(
    req: ProductionSimulationRequest,
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Simulate changes in production volume (+/- X%) and scrap rate."""
    pid = req.plant_id if not u.plants or (req.plant_id in u.plants) else u.plants[0]
    res = simulate_production_change(
        s,
        tenant_id=u.tenant_id,
        plant_id=pid,
        volume_change_pct=req.volume_change_pct,
        scrap_change_pct=req.scrap_change_pct,
    )
    return {"data": res}


@router.post("/simulations/supplier-delay")
def simulate_supplier_delay_endpoint(
    req: SupplierDelaySimulationRequest,
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Simulate delivery delay (+D days) and partial arrival percentage."""
    pid = req.plant_id if not u.plants or (req.plant_id in u.plants) else u.plants[0]
    res = simulate_supplier_delay(
        s,
        tenant_id=u.tenant_id,
        supplier_id=req.supplier_id,
        delay_days=req.delay_days,
        plant_id=pid,
        receipt_rate_pct=req.receipt_rate_pct,
    )
    return {"data": res}


@router.post("/simulations/scrap-change")
def simulate_scrap_change_endpoint(
    req: ScrapChangeSimulationRequest,
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Simulate abnormal material scrap and consumption increases."""
    pid = req.plant_id if not u.plants or (req.plant_id in u.plants) else u.plants[0]
    res = simulate_production_change(
        s,
        tenant_id=u.tenant_id,
        plant_id=pid,
        volume_change_pct=0.0,
        scrap_change_pct=req.scrap_increase_pct,
    )
    return {"data": res}


# 7. Digital Twin Consolidated Overview
@router.get("/digital-twin/overview")
def get_digital_twin_overview(
    plant_id: str | None = Query(None),
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Consolidated digital twin status across manufacturing plant zones and lines."""
    pid = plant_id if not u.plants or (plant_id in u.plants) else (u.plants[0] if u.plants else "IN-TN-01")
    cap = calculate_production_capacity(s, tenant_id=u.tenant_id, plant_id=pid)
    forecast_30 = calculate_demand_forecast(s, tenant_id=u.tenant_id, horizon_days=30, plant_id=pid)
    suppliers = get_supplier_delivery_predictions(s, tenant_id=u.tenant_id, plant_id=pid)

    # Manufacturing zones telemetry
    zones = [
        {
            "id": "inbound_dock",
            "name": "Receiving Dock & QC",
            "status": "ACTIVE",
            "open_deliveries": len(suppliers),
            "overdue_pos": sum(1 for p in suppliers if p["is_overdue"]),
            "throughput_utilization": 82,
        },
        {
            "id": "rm_storage",
            "name": "Raw Material Warehouse",
            "status": "OPTIMAL",
            "total_skus": len(forecast_30),
            "critical_skus": sum(1 for m_ in forecast_30 if m_["status"] == "CRITICAL"),
            "throughput_utilization": 74,
        },
        {
            "id": "smt_lines",
            "name": "SMT PCB Assembly (Lines 1-4)",
            "status": "RUNNING",
            "active_products": ["Aster 15 128GB", "Aster 15 256GB"],
            "line_speed_uph": 450,
            "throughput_utilization": 91,
        },
        {
            "id": "final_assembly",
            "name": "Main Box Assembly (Lines 5-8)",
            "status": "BOTTLENECK_ALERT",
            "limiting_material": cap["summary"]["bottlenecks"][0]["material_name"] if cap["summary"]["bottlenecks"] else "None",
            "capacity_units": cap["summary"]["total_buildable_units"],
            "throughput_utilization": 88,
        },
        {
            "id": "testing_qc",
            "name": "Functional Testing & Burn-In",
            "status": "ACTIVE",
            "yield_rate_pct": 98.4,
            "throughput_utilization": 79,
        },
        {
            "id": "fg_packaging",
            "name": "Packaging & Finished Goods",
            "status": "READY",
            "supported_output": cap["summary"]["total_buildable_units"],
            "throughput_utilization": 68,
        },
    ]

    return {
        "data": {
            "plant_id": pid,
            "plant_name": "Chennai Manufacturing Complex" if "TN" in str(pid) else "Bengaluru Electronics Plant",
            "zones": zones,
            "production_capacity": cap,
            "bottlenecks": cap["summary"]["bottlenecks"],
            "critical_materials": [m_ for m_ in forecast_30 if m_["status"] == "CRITICAL"][:5],
            "supplier_alerts": [p for p in suppliers if p["is_overdue"]][:5],
        }
    }


# 8. Module F: Quality Hold & Rejects
@router.get("/quality")
@router.get("/quality/overview")
def get_quality_endpoint(
    plant_id: str | None = Query(None),
    stage: str | None = Query(None),
    disposition: str | None = Query(None),
    u: Principal = Depends(current_user),
):
    """Retrieve quality hold, rework, scrap analysis, defect pareto, and quarantined stock."""
    from app.intelligence.quality import get_quality_overview
    pid = plant_id if not u.plants or (plant_id in u.plants) else u.plants[0]
    res = get_quality_overview(plant_id=pid, stage=stage, disposition=disposition)
    return {"data": res}


# 9. Finished Goods & Dispatch
@router.get("/dispatch")
@router.get("/dispatch/overview")
def get_dispatch_endpoint(
    plant_id: str | None = Query(None),
    status: str | None = Query(None),
    carrier: str | None = Query(None),
    vehicle_type: str | None = Query(None),
    limit: int = Query(100),
    u: Principal = Depends(current_user),
):
    """Retrieve finished goods dispatch milestones, carrier SLAs, container stuffing, and freight tracking."""
    from app.intelligence.dispatch import get_dispatch_overview
    pid = plant_id if not u.plants or (plant_id in u.plants) else u.plants[0]
    res = get_dispatch_overview(
        plant_id=pid,
        status=status,
        carrier=carrier,
        vehicle_type=vehicle_type,
        limit=limit,
    )
    return {"data": res}


# 10. Batch Traceability & Product Genealogy
@router.get("/traceability")
@router.get("/traceability/overview")
def get_traceability_endpoint(
    query_type: str = Query("lot"),
    query_id: str | None = Query(None),
    plant_id: str | None = Query(None),
    u: Principal = Depends(current_user),
):
    """Two-way batch traceability: forward supplier lot recall trees and backward serial root-cause tracing."""
    from app.intelligence.traceability import get_traceability_overview
    pid = plant_id if not u.plants or (plant_id in u.plants) else u.plants[0]
    res = get_traceability_overview(
        query_type=query_type,
        query_id=query_id,
        plant_id=pid,
    )
    return {"data": res}


# 11. Supplier Intelligence & Smart Procurement
@router.get("/procurement/overview")
def get_procurement_overview_endpoint(
    plant_id: str | None = Query(None),
    u: Principal = Depends(current_user),
):
    """Procurement KPIs, pending draft POs, and prioritized shortage requirements."""
    from app.intelligence.procurement import get_procurement_overview
    pid = plant_id if not u.plants or (plant_id in u.plants) else u.plants[0]
    res = get_procurement_overview(plant_id=pid)
    return {"data": res}


@router.get("/procurement/shortages")
def get_procurement_shortages_endpoint(
    plant_id: str | None = Query(None),
    u: Principal = Depends(current_user),
):
    """List materials with active shortages requiring purchase order generation."""
    from app.intelligence.procurement import get_procurement_shortages
    pid = plant_id if not u.plants or (plant_id in u.plants) else u.plants[0]
    res = get_procurement_shortages(plant_id=pid)
    return {"data": res}


@router.get("/procurement/compare")
def compare_quotes_endpoint(
    material_id: str = Query("MAT-CAM-007"),
    required_qty: int = Query(20),
    plant_id: str | None = Query(None),
    u: Principal = Depends(current_user),
):
    """Multi-criteria supplier comparison: price, delivery lead time, OTIF, and quality score."""
    from app.intelligence.procurement import compare_supplier_quotes
    pid = plant_id if not u.plants or (plant_id in u.plants) else u.plants[0]
    res = compare_supplier_quotes(
        material_id=material_id,
        required_qty=required_qty,
        plant_id=pid or "IN-TN-01",
    )
    return {"data": res}


@router.get("/procurement/materials")
def get_procurement_materials_endpoint(
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """List all catalog materials available for manual purchase order creation."""
    from app import models as m
    from sqlalchemy import select
    mats = s.scalars(
        select(m.Material)
        .where(m.Material.tenant_id == u.tenant_id)
        .order_by(m.Material.material_category, m.Material.material_id)
    ).all()
    return {
        "data": [
            {
                "material_id": m_row.material_id,
                "material_name": m_row.material_name,
                "category": m_row.material_category,
                "uom": m_row.uom,
                "standard_cost_inr": float(getattr(m_row, "standard_price_inr", 0) or 0),
            }
            for m_row in mats
        ]
    }


class DraftPOCreateRequest(BaseModel):
    material_id: str
    supplier_id: str
    order_qty: float
    unit_price_inr: float
    plant_id: str = "IN-TN-01"
    need_by_date: str | None = None
    incoterm: str = "FOB"
    payment_terms: str = "NET 45"
    notes: str | None = None
    route_to_approval: bool = True
    created_via: str = "smart_procurement"


@router.post("/procurement/draft-po")
def create_draft_po_endpoint(
    req: DraftPOCreateRequest,
    u: Principal = Depends(current_user),
    s: Session = Depends(get_db),
):
    """Create a draft purchase order / proposal from the Smart Procurement Quote Engine."""
    u.require("replenishment", "A")
    u.require_plant(req.plant_id)

    from datetime import date, datetime, timedelta, timezone
    from sqlalchemy import func, select
    from app import models as m

    run = s.scalar(
        select(m.CalculationRun)
        .where(m.CalculationRun.tenant_id == u.tenant_id, m.CalculationRun.status == "succeeded")
        .order_by(m.CalculationRun.id.desc())
    )
    run_id = run.id if run else 1

    mat = s.scalar(
        select(m.Material).where(
            m.Material.tenant_id == u.tenant_id, m.Material.material_id == req.material_id
        )
    )
    uom = mat.uom if mat else "EA"

    val_inr = round(float(req.order_qty) * float(req.unit_price_inr), 2)
    threshold = 1_000_000.0  # ₹10 Lakhs
    approval_level = 2 if val_inr >= threshold else 1

    count = s.scalar(
        select(func.count()).select_from(m.Proposal).where(m.Proposal.tenant_id == u.tenant_id)
    ) or 0
    prop_no = f"PO-{datetime.now().strftime('%y%m')}-{count + 1:04d}"

    need_by = (
        datetime.strptime(req.need_by_date, "%Y-%m-%d").date()
        if req.need_by_date
        else (date.today() + timedelta(days=14))
    )
    arrival = date.today() + timedelta(days=12)

    state = "pending_buyer" if req.route_to_approval else "draft"

    prop = m.Proposal(
        tenant_id=u.tenant_id,
        run_id=run_id,
        proposal_no=prop_no,
        kind="purchase",
        material_id=req.material_id,
        plant_id=req.plant_id,
        supplier_id=req.supplier_id,
        qty=req.order_qty,
        uom=uom,
        unit_price_inr=req.unit_price_inr,
        value_inr=val_inr,
        order_by=date.today(),
        needed_by=need_by,
        arrival_date=arrival,
        shortage_date=need_by,
        in_time="yes",
        state=state,
        approval_level=approval_level,
        inputs={
            "created_via": req.created_via or "smart_procurement_quote_engine",
            "incoterm": req.incoterm,
            "payment_terms": req.payment_terms,
            "notes": req.notes,
            "creator": u.username,
        },
        assumption_ids=["A11", "A12", "A21"],
    )
    s.add(prop)
    s.flush()

    channel_name = "Manual Procurement Requisition" if "manual" in (req.created_via or "").lower() else "Smart Procurement"
    s.add(
        m.ApprovalLog(
            tenant_id=u.tenant_id,
            proposal_id=prop.id,
            action="submit" if req.route_to_approval else "create",
            from_state="draft",
            to_state=state,
            username=u.username,
            role_id=u.role,
            comment=f"Created via {channel_name}: {req.supplier_id} @ ₹{req.unit_price_inr:,.2f}/unit ({req.incoterm}, {req.payment_terms})",
            run_id=run_id,
            at=datetime.now(timezone.utc),
        )
    )
    s.commit()

    return {
        "ok": True,
        "proposal_id": prop.id,
        "proposal_no": prop.proposal_no,
        "state": prop.state,
        "approval_level": prop.approval_level,
        "value_inr": prop.value_inr,
        "message": f"Draft PO {prop.proposal_no} generated successfully for {req.supplier_id} and routed to {'Buyer Level 1 approval' if approval_level == 1 else 'Buyer + Procurement Manager Level 2 approval'}!",
    }





