"""SQLAlchemy models (Day 1 scope). Every tenant-owned table has tenant_id; plant tables have plant_id.

Masters use natural keys (tenant_id, code). Facts and results use surrogate ids and carry run_id
where they are calculation output.
"""
from __future__ import annotations

from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

JSONType = sa.JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


def _tenant() -> Mapped[str]:
    return mapped_column(sa.String(32), sa.ForeignKey("tenants.tenant_id"), index=True)


class Tenant(Base):
    __tablename__ = "tenants"
    tenant_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    name: Mapped[str] = mapped_column(sa.String(200))


# ---------- configuration ----------
class Assumption(Base):
    __tablename__ = "assumptions"
    tenant_id: Mapped[str] = mapped_column(sa.String(32), sa.ForeignKey("tenants.tenant_id"), primary_key=True)
    assumption_id: Mapped[str] = mapped_column(sa.String(8), primary_key=True)
    description: Mapped[str] = mapped_column(sa.Text)
    default_value: Mapped[dict] = mapped_column(JSONType)
    current_value: Mapped[dict] = mapped_column(JSONType)
    owner_question: Mapped[str] = mapped_column(sa.Text)
    status: Mapped[str] = mapped_column(sa.String(32), default="awaiting confirmation")
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


class InventoryPolicy(Base):
    __tablename__ = "inventory_policies"
    tenant_id: Mapped[str] = mapped_column(sa.String(32), sa.ForeignKey("tenants.tenant_id"), primary_key=True)
    key: Mapped[str] = mapped_column(sa.String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONType)


# ---------- master data ----------
class Plant(Base):
    __tablename__ = "plants"
    tenant_id: Mapped[str] = mapped_column(sa.String(32), sa.ForeignKey("tenants.tenant_id"), primary_key=True)
    plant_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    plant_name: Mapped[str] = mapped_column(sa.String(200))
    state: Mapped[str | None] = mapped_column(sa.String(100))
    currency: Mapped[str] = mapped_column(sa.String(3))


class StorageLocation(Base):
    __tablename__ = "storage_locations"
    tenant_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    plant_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    warehouse_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    __table_args__ = (sa.ForeignKeyConstraint(["tenant_id", "plant_id"], ["plants.tenant_id", "plants.plant_id"]),)


class Material(Base):
    __tablename__ = "materials"
    tenant_id: Mapped[str] = mapped_column(sa.String(32), sa.ForeignKey("tenants.tenant_id"), primary_key=True)
    material_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    material_name: Mapped[str] = mapped_column(sa.String(200))
    material_category: Mapped[str] = mapped_column(sa.String(32), index=True)
    uom: Mapped[str] = mapped_column(sa.String(8))
    standard_price_inr: Mapped[float] = mapped_column(sa.Numeric(14, 2))
    lead_time_days: Mapped[int] = mapped_column(sa.Integer)
    safety_stock_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    moq: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    shelf_life_days: Mapped[int] = mapped_column(sa.Integer)
    approved_vendor_required: Mapped[bool | None] = mapped_column(sa.Boolean)


class Product(Base):
    __tablename__ = "products"
    tenant_id: Mapped[str] = mapped_column(sa.String(32), sa.ForeignKey("tenants.tenant_id"), primary_key=True)
    product_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    product_name: Mapped[str] = mapped_column(sa.String(200))
    product_family: Mapped[str | None] = mapped_column(sa.String(64))


class Supplier(Base):
    __tablename__ = "suppliers"
    tenant_id: Mapped[str] = mapped_column(sa.String(32), sa.ForeignKey("tenants.tenant_id"), primary_key=True)
    supplier_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    supplier_name: Mapped[str] = mapped_column(sa.String(200))
    country: Mapped[str | None] = mapped_column(sa.String(64))
    material_category: Mapped[str] = mapped_column(sa.String(32))
    approved_status: Mapped[str] = mapped_column(sa.String(32))
    risk_tier: Mapped[str | None] = mapped_column(sa.String(16))
    standard_lead_time_days: Mapped[int] = mapped_column(sa.Integer)


class ApprovedVendor(Base):
    __tablename__ = "approved_vendors"
    tenant_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    material_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    supplier_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    basis: Mapped[str] = mapped_column(sa.String(64))  # e.g. "category match (A11)"


class BomLine(Base):
    __tablename__ = "bom"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    product_id: Mapped[str] = mapped_column(sa.String(32))
    material_id: Mapped[str] = mapped_column(sa.String(32))
    component_qty: Mapped[float] = mapped_column(sa.Numeric(14, 6))
    scrap_factor: Mapped[float] = mapped_column(sa.Numeric(8, 6))
    qty_per: Mapped[float] = mapped_column(sa.Numeric(14, 6))
    revision: Mapped[str] = mapped_column(sa.String(16))
    effective_from: Mapped[date] = mapped_column(sa.Date)
    effective_to: Mapped[date] = mapped_column(sa.Date)


# ---------- transactional data ----------
class StockBalance(Base):
    __tablename__ = "stock_balances"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    upload_id: Mapped[int] = mapped_column(sa.ForeignKey("uploads.id"))
    snapshot_date: Mapped[date] = mapped_column(sa.Date)
    plant_id: Mapped[str] = mapped_column(sa.String(32), index=True)
    material_id: Mapped[str] = mapped_column(sa.String(32), index=True)
    warehouse_id: Mapped[str] = mapped_column(sa.String(32))
    lot_id: Mapped[str | None] = mapped_column(sa.String(64))
    on_hand_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    allocated_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    blocked_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    quality_hold_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    in_transit_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    snapshot_safety_stock_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    inventory_status: Mapped[str | None] = mapped_column(sa.String(32))
    unit_cost_inr: Mapped[float] = mapped_column(sa.Numeric(14, 2))
    expiry_date: Mapped[date | None] = mapped_column(sa.Date)
    excluded: Mapped[bool] = mapped_column(sa.Boolean, default=False)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    upload_id: Mapped[int] = mapped_column(sa.ForeignKey("uploads.id"))
    po_id: Mapped[str] = mapped_column(sa.String(32))
    po_line: Mapped[int] = mapped_column(sa.Integer)
    supplier_id: Mapped[str] = mapped_column(sa.String(32))
    material_id: Mapped[str] = mapped_column(sa.String(32), index=True)
    plant_id: Mapped[str] = mapped_column(sa.String(32))
    po_date: Mapped[date] = mapped_column(sa.Date)
    promised_date: Mapped[date] = mapped_column(sa.Date)
    receipt_date: Mapped[date | None] = mapped_column(sa.Date)
    ordered_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    received_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    open_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    unit_price_inr: Mapped[float] = mapped_column(sa.Numeric(14, 4))
    po_status: Mapped[str] = mapped_column(sa.String(16))
    incoterm: Mapped[str | None] = mapped_column(sa.String(16))
    __table_args__ = (sa.UniqueConstraint("tenant_id", "po_id", "po_line"),)


class GoodsReceipt(Base):
    __tablename__ = "goods_receipts"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    po_id: Mapped[str] = mapped_column(sa.String(32))
    po_line: Mapped[int] = mapped_column(sa.Integer)
    supplier_id: Mapped[str] = mapped_column(sa.String(32))
    material_id: Mapped[str] = mapped_column(sa.String(32))
    plant_id: Mapped[str] = mapped_column(sa.String(32))
    received_date: Mapped[date] = mapped_column(sa.Date)
    received_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    actual_lt_days: Mapped[int] = mapped_column(sa.Integer)


class ProductionPlan(Base):
    __tablename__ = "production_plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    source: Mapped[str] = mapped_column(sa.String(16))  # "history" | "scenario"
    production_order_id: Mapped[str] = mapped_column(sa.String(48))
    plant_id: Mapped[str] = mapped_column(sa.String(32))
    product_id: Mapped[str] = mapped_column(sa.String(32))
    customer_order_id: Mapped[str | None] = mapped_column(sa.String(32))
    order_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    priority: Mapped[str | None] = mapped_column(sa.String(16))
    planned_start: Mapped[date] = mapped_column(sa.Date, index=True)
    planned_finish: Mapped[date | None] = mapped_column(sa.Date)
    due_date: Mapped[date | None] = mapped_column(sa.Date)
    order_status: Mapped[str] = mapped_column(sa.String(16))


class CustomerOrder(Base):
    __tablename__ = "customer_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    customer_order_id: Mapped[str] = mapped_column(sa.String(32))
    customer_id: Mapped[str | None] = mapped_column(sa.String(32))
    product_id: Mapped[str] = mapped_column(sa.String(32))
    order_date: Mapped[date | None] = mapped_column(sa.Date)
    requested_delivery_date: Mapped[date | None] = mapped_column(sa.Date)
    confirmed_delivery_date: Mapped[date | None] = mapped_column(sa.Date)
    order_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    shipped_qty: Mapped[float | None] = mapped_column(sa.Numeric(14, 3))
    order_status: Mapped[str] = mapped_column(sa.String(32))
    priority: Mapped[str | None] = mapped_column(sa.String(16))


class EngineeringChange(Base):
    __tablename__ = "engineering_changes"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    change_request_id: Mapped[str] = mapped_column(sa.String(32))
    change_type: Mapped[str] = mapped_column(sa.String(32))
    product_id: Mapped[str | None] = mapped_column(sa.String(32))
    material_id: Mapped[str | None] = mapped_column(sa.String(32), index=True)  # part_id
    old_revision: Mapped[str | None] = mapped_column(sa.String(16))
    new_revision: Mapped[str | None] = mapped_column(sa.String(16))
    request_date: Mapped[date | None] = mapped_column(sa.Date)
    cut_in_date: Mapped[date | None] = mapped_column(sa.Date)
    affected_inventory_qty: Mapped[float | None] = mapped_column(sa.Numeric(14, 3))
    implementation_status: Mapped[str | None] = mapped_column(sa.String(32))


# ---------- ingestion, DQ, runs, results ----------
class Upload(Base):
    __tablename__ = "uploads"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    file_name: Mapped[str] = mapped_column(sa.String(500))
    uploaded_by: Mapped[str] = mapped_column(sa.String(200))
    uploaded_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    status: Mapped[str] = mapped_column(sa.String(16))
    row_counts: Mapped[dict] = mapped_column(JSONType, default=dict)


class CalculationRun(Base):
    __tablename__ = "calculation_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    upload_id: Mapped[int] = mapped_column(sa.ForeignKey("uploads.id"))
    as_of_date: Mapped[date] = mapped_column(sa.Date)
    started_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    status: Mapped[str] = mapped_column(sa.String(16))
    config: Mapped[dict] = mapped_column(JSONType)  # assumption + policy values used
    dq_summary: Mapped[dict] = mapped_column(JSONType)
    kpis: Mapped[dict] = mapped_column(JSONType)


class DQResultRow(Base):
    __tablename__ = "dq_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    upload_id: Mapped[int] = mapped_column(sa.ForeignKey("uploads.id"))
    check_id: Mapped[str] = mapped_column(sa.String(48))
    name: Mapped[str] = mapped_column(sa.String(100))
    severity: Mapped[str] = mapped_column(sa.String(16))
    fired: Mapped[bool] = mapped_column(sa.Boolean)
    affected_count: Mapped[int] = mapped_column(sa.Integer)
    message: Mapped[str] = mapped_column(sa.Text)
    assumption_id: Mapped[str | None] = mapped_column(sa.String(8))
    sample: Mapped[list] = mapped_column(JSONType)


class MaterialStatus(Base):
    """One row per material x plant per run: status, shortage date and every input used."""
    __tablename__ = "material_status"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    run_id: Mapped[int] = mapped_column(sa.ForeignKey("calculation_runs.id"), index=True)
    material_id: Mapped[str] = mapped_column(sa.String(32))
    plant_id: Mapped[str] = mapped_column(sa.String(32))
    status: Mapped[str] = mapped_column(sa.String(16), index=True)
    shortage_date: Mapped[date | None] = mapped_column(sa.Date)
    days_to_shortage: Mapped[int | None] = mapped_column(sa.Integer)
    usable_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    in_transit_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    open_po_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    demand_horizon_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    daily_demand_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    ss_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    max_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    min_projected_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    peak_projected_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    lt_days: Mapped[int] = mapped_column(sa.Integer)
    lt_source: Mapped[str] = mapped_column(sa.String(32))
    supplier_id: Mapped[str | None] = mapped_column(sa.String(32))
    usable_value_inr: Mapped[float] = mapped_column(sa.Numeric(16, 2))
    has_demand_basis: Mapped[bool] = mapped_column(sa.Boolean)
    demand_source: Mapped[str] = mapped_column(sa.String(32))
    assumption_ids: Mapped[list] = mapped_column(JSONType)
    inputs: Mapped[dict] = mapped_column(JSONType)
    stockout_date: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    days_to_stockout: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    orders_affected: Mapped[int] = mapped_column(sa.Integer, server_default="0")
    window_days: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    material_category: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
    uom: Mapped[str | None] = mapped_column(sa.String(8), nullable=True)


class PoSupplyLine(Base):
    """Expected supply per open PO line for a run (A8-A10, A19)."""
    __tablename__ = "po_supply_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    run_id: Mapped[int] = mapped_column(sa.ForeignKey("calculation_runs.id"), index=True)
    po_id: Mapped[str] = mapped_column(sa.String(32))
    po_line: Mapped[int] = mapped_column(sa.Integer)
    supplier_id: Mapped[str] = mapped_column(sa.String(32))
    material_id: Mapped[str] = mapped_column(sa.String(32), index=True)
    plant_id: Mapped[str] = mapped_column(sa.String(32))
    po_status: Mapped[str] = mapped_column(sa.String(16))
    po_date: Mapped[date] = mapped_column(sa.Date)
    promised_date: Mapped[date] = mapped_column(sa.Date)
    ordered_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    received_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    open_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    expected_date: Mapped[date] = mapped_column(sa.Date)
    date_basis: Mapped[str] = mapped_column(sa.String(64))
    overdue: Mapped[bool] = mapped_column(sa.Boolean)
    days_overdue: Mapped[int] = mapped_column(sa.Integer)
    unit_price_inr: Mapped[float] = mapped_column(sa.Numeric(14, 4))


class SupplierLeadTime(Base):
    """Approved vendors per material with on-time %, lead times and rank (D5) for a run."""
    __tablename__ = "supplier_lead_times"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    run_id: Mapped[int] = mapped_column(sa.ForeignKey("calculation_runs.id"), index=True)
    material_id: Mapped[str] = mapped_column(sa.String(32))
    supplier_id: Mapped[str] = mapped_column(sa.String(32))
    rank: Mapped[int] = mapped_column(sa.Integer)
    on_time_pct: Mapped[float | None] = mapped_column(sa.Numeric(6, 4))
    on_time_basis: Mapped[str] = mapped_column(sa.String(32))
    actual_lt_days: Mapped[float | None] = mapped_column(sa.Numeric(8, 2))
    promised_lt_days: Mapped[float | None] = mapped_column(sa.Numeric(8, 2))
    standard_lt_days: Mapped[int] = mapped_column(sa.Integer)
    receipts: Mapped[int | None] = mapped_column(sa.Integer)


class InventoryProjection(Base):
    __tablename__ = "inventory_projections"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    run_id: Mapped[int] = mapped_column(sa.ForeignKey("calculation_runs.id"), index=True)
    material_id: Mapped[str] = mapped_column(sa.String(32))
    plant_id: Mapped[str] = mapped_column(sa.String(32))
    date: Mapped[date] = mapped_column(sa.Date)
    in_transit_in: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    po_receipts: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    requirement: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    projected_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    ss_qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    demand_source: Mapped[str] = mapped_column(sa.String(32), server_default="scenario")  # D31


# ---------- Stage 1: auth, proposals, approvals, briefs, audit ----------
class Role(Base):
    __tablename__ = "roles"
    role_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    name: Mapped[str] = mapped_column(sa.String(64))
    lands_on: Mapped[str] = mapped_column(sa.String(64))


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    username: Mapped[str] = mapped_column(sa.String(64), unique=True)
    display_name: Mapped[str] = mapped_column(sa.String(128))
    password_hash: Mapped[str] = mapped_column(sa.String(128))
    role_id: Mapped[str] = mapped_column(sa.ForeignKey("roles.role_id"))
    active: Mapped[bool] = mapped_column(sa.Boolean, default=True)


class UserPlant(Base):
    __tablename__ = "user_plants"
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id"), primary_key=True)
    plant_id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)


class Proposal(Base):
    """Purchase and transfer proposals (one table; `kind` distinguishes them)."""
    __tablename__ = "proposals"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    run_id: Mapped[int] = mapped_column(sa.ForeignKey("calculation_runs.id"), index=True)
    proposal_no: Mapped[str] = mapped_column(sa.String(32))
    kind: Mapped[str] = mapped_column(sa.String(16))  # purchase | transfer
    material_id: Mapped[str] = mapped_column(sa.String(32), index=True)
    plant_id: Mapped[str] = mapped_column(sa.String(32), index=True)  # destination
    supplier_id: Mapped[str | None] = mapped_column(sa.String(32))
    source_plant_id: Mapped[str | None] = mapped_column(sa.String(32))
    qty: Mapped[float] = mapped_column(sa.Numeric(14, 3))
    uom: Mapped[str] = mapped_column(sa.String(8))
    unit_price_inr: Mapped[float] = mapped_column(sa.Numeric(14, 2))
    value_inr: Mapped[float] = mapped_column(sa.Numeric(16, 2))
    order_by: Mapped[date | None] = mapped_column(sa.Date)
    needed_by: Mapped[date | None] = mapped_column(sa.Date)
    arrival_date: Mapped[date | None] = mapped_column(sa.Date)
    shortage_date: Mapped[date | None] = mapped_column(sa.Date)
    in_time: Mapped[str] = mapped_column(sa.String(16))  # yes | expedite | no
    state: Mapped[str] = mapped_column(sa.String(24), index=True)
    approval_level: Mapped[int] = mapped_column(sa.Integer)  # 1 buyer only, 2 buyer + manager
    inputs: Mapped[dict] = mapped_column(JSONType)
    assumption_ids: Mapped[list] = mapped_column(JSONType)
    reason_code: Mapped[str | None] = mapped_column(sa.String(32))
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    __table_args__ = (sa.UniqueConstraint("tenant_id", "proposal_no"),)


class ApprovalLog(Base):
    __tablename__ = "approval_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    proposal_id: Mapped[int] = mapped_column(sa.ForeignKey("proposals.id"), index=True)
    run_id: Mapped[int | None] = mapped_column(sa.Integer)
    action: Mapped[str] = mapped_column(sa.String(24))
    from_state: Mapped[str] = mapped_column(sa.String(24))
    to_state: Mapped[str] = mapped_column(sa.String(24))
    user_id: Mapped[int | None] = mapped_column(sa.ForeignKey("users.id"))
    username: Mapped[str] = mapped_column(sa.String(64))
    role_id: Mapped[str] = mapped_column(sa.String(32))
    reason_code: Mapped[str | None] = mapped_column(sa.String(32))
    comment: Mapped[str | None] = mapped_column(sa.Text)
    details: Mapped[dict | None] = mapped_column(JSONType)
    at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


class DailyBrief(Base):
    __tablename__ = "daily_briefs"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    run_id: Mapped[int] = mapped_column(sa.ForeignKey("calculation_runs.id"), index=True)
    kind: Mapped[str] = mapped_column(sa.String(16))  # template | ai
    text: Mapped[str] = mapped_column(sa.Text)
    facts: Mapped[dict] = mapped_column(JSONType)  # the engine numbers the brief is built from
    model_id: Mapped[str | None] = mapped_column(sa.String(128))
    latency_ms: Mapped[int | None] = mapped_column(sa.Integer)
    error: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    username: Mapped[str] = mapped_column(sa.String(64))
    event_type: Mapped[str] = mapped_column(sa.String(48))
    item: Mapped[str | None] = mapped_column(sa.String(128))
    before: Mapped[dict | None] = mapped_column(JSONType)
    after: Mapped[dict | None] = mapped_column(JSONType)
    at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


class AgentRunLog(Base):
    __tablename__ = "agent_run_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    username: Mapped[str] = mapped_column(sa.String(64))
    run_id: Mapped[int | None] = mapped_column(sa.Integer)
    question: Mapped[str] = mapped_column(sa.Text)
    context: Mapped[dict | None] = mapped_column(JSONType)
    route: Mapped[str | None] = mapped_column(sa.String(32))
    specialist: Mapped[str | None] = mapped_column(sa.String(120), nullable=True)  # D38: "<method>:<names>"
    tool_calls: Mapped[list] = mapped_column(JSONType)
    answer: Mapped[str | None] = mapped_column(sa.Text)
    status: Mapped[str] = mapped_column(sa.String(32))
    domo_calls: Mapped[int] = mapped_column(sa.Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(sa.Integer, default=0)
    usage: Mapped[dict | None] = mapped_column(JSONType)
    at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


class AlertAction(Base):
    __tablename__ = "alert_actions"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    alert_key: Mapped[str] = mapped_column(sa.String(128))
    action: Mapped[str] = mapped_column(sa.String(24))
    username: Mapped[str] = mapped_column(sa.String(64))
    comment: Mapped[str | None] = mapped_column(sa.Text)
    at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


class SavedView(Base):
    __tablename__ = "saved_views"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = _tenant()
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id"))
    page: Mapped[str] = mapped_column(sa.String(64))
    name: Mapped[str] = mapped_column(sa.String(128))
    params: Mapped[dict] = mapped_column(JSONType)
