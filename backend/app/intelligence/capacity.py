"""Module B - BOM Intelligence and Production Capacity.

Calculates:
  Capacity_i = floor(UsableQuantity_i / AdjustedRequirementPerProduct_i)
  ProductionCapacity = min(Capacity_1, ..., Capacity_n)
Identifies the limiting bottleneck component and surplus inventory.
"""
from __future__ import annotations

import math
from typing import Any
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models as m
from app.config import REPO_ROOT


def _csv_explode_bom(product_id: str | None = None) -> list[dict[str, Any]]:
    p_path = REPO_ROOT / "data" / "data" / "dim_product.csv"
    m_path = REPO_ROOT / "data" / "data" / "dim_material.csv"
    b_path = REPO_ROOT / "data" / "data" / "fact_bom_component.csv"
    if not (p_path.exists() and m_path.exists() and b_path.exists()):
        return []
    p_df = pd.read_csv(p_path)
    m_df = pd.read_csv(m_path)
    b_df = pd.read_csv(b_path)
    if product_id:
        b_df = b_df[b_df["product_id"] == product_id]
    m_map = {row["material_id"]: row for _, row in m_df.iterrows()}
    p_map = {row["product_id"]: row["product_name"] for _, row in p_df.iterrows()}
    out = []
    for _, r in b_df.iterrows():
        mid = r["material_id"]
        pid = r["product_id"]
        minfo = m_map.get(mid, {})
        c_qty = float(r["component_qty"])
        scrap = float(r.get("scrap_factor", 0.0) or 0.0)
        out.append({
            "product_id": pid,
            "product_name": p_map.get(pid, pid),
            "material_id": mid,
            "material_name": minfo.get("material_name", mid),
            "material_category": minfo.get("material_category", "Component"),
            "uom": minfo.get("uom", "EA"),
            "standard_price_inr": float(minfo.get("standard_price_inr", 0.0)),
            "safety_stock_qty": float(minfo.get("safety_stock_qty", 0.0) or 0.0),
            "component_qty": c_qty,
            "scrap_factor": scrap,
            "adjusted_qty_per_unit": round(c_qty * (1.0 + scrap), 4),
        })
    return out


def explode_bom(s: Session, tenant_id: str, product_id: str | None = None) -> list[dict[str, Any]]:
    """Expand BOM for products with standard quantity per parent, scrap factor, and material master info."""
    try:
        q = (
            select(
                m.BomLine.product_id,
                m.Product.product_name,
                m.BomLine.material_id,
                m.Material.material_name,
                m.Material.material_category,
                m.Material.uom,
                m.Material.standard_price_inr,
                m.Material.safety_stock_qty,
                m.BomLine.component_qty,
                m.BomLine.scrap_factor,
            )
            .join(m.Product, (m.Product.product_id == m.BomLine.product_id) & (m.Product.tenant_id == tenant_id))
            .join(m.Material, (m.Material.material_id == m.BomLine.material_id) & (m.Material.tenant_id == tenant_id))
            .where(m.BomLine.tenant_id == tenant_id)
        )
        if product_id:
            q = q.where(m.BomLine.product_id == product_id)

        rows = s.execute(q).all()
        out = []
        for r in rows:
            c_qty = float(r.component_qty)
            scrap = float(r.scrap_factor or 0.0)
            adj_qty = c_qty * (1.0 + scrap)
            out.append({
                "product_id": r.product_id,
                "product_name": r.product_name,
                "material_id": r.material_id,
                "material_name": r.material_name,
                "material_category": r.material_category,
                "uom": r.uom,
                "standard_price_inr": float(r.standard_price_inr),
                "safety_stock_qty": float(r.safety_stock_qty or 0.0),
                "component_qty": c_qty,
                "scrap_factor": scrap,
                "adjusted_qty_per_unit": round(adj_qty, 4),
            })
        return out
    except Exception:
        return _csv_explode_bom(product_id)



def calculate_production_capacity(
    s: Session,
    tenant_id: str,
    plant_id: str | None = None,
    product_id: str | None = None,
    scrap_multiplier: float = 1.0,
    production_volume_scale: float = 1.0,
) -> dict[str, Any]:
    """Calculate finished product buildable units from usable stock and BOMs.

    Identifies the exact limiting bottleneck component and unused surplus for every other component.
    """
    # 1. Gather usable stock per material (and plant)
    stock_by_mat: dict[str, float] = {}
    try:
        sq = (
            select(
                m.StockBalance.material_id,
                m.StockBalance.plant_id,
                func.sum(
                    m.StockBalance.on_hand_qty
                    - m.StockBalance.allocated_qty
                    - m.StockBalance.blocked_qty
                    - m.StockBalance.quality_hold_qty
                ).label("usable_qty")
            )
            .where(m.StockBalance.tenant_id == tenant_id)
            .group_by(m.StockBalance.material_id, m.StockBalance.plant_id)
        )
        if plant_id:
            sq = sq.where(m.StockBalance.plant_id == plant_id)

        stock_rows = s.execute(sq).all()
        for r in stock_rows:
            val = max(0.0, float(r.usable_qty or 0.0))
            stock_by_mat[r.material_id] = stock_by_mat.get(r.material_id, 0.0) + val
    except Exception:
        snap_path = REPO_ROOT / "data" / "raw" / "fact_inventory_daily_snapshot.csv"
        if snap_path.exists():
            sdf = pd.read_csv(snap_path)
            ldate = sdf["snapshot_date"].max()
            lsdf = sdf[sdf["snapshot_date"] == ldate]
            if plant_id:
                lsdf = lsdf[lsdf["plant_id"] == plant_id]
            usable = (lsdf["on_hand_qty"] - lsdf["allocated_qty"] - lsdf["blocked_qty"] - lsdf["quality_hold_qty"]).clip(lower=0)
            lsdf = lsdf.assign(usable_qty=usable)
            for mid, grp in lsdf.groupby("material_id"):
                stock_by_mat[mid] = float(grp["usable_qty"].sum())

    # 2. Get BOM explosion
    bom_items = explode_bom(s, tenant_id, product_id)
    if not bom_items:
        return {"products": [], "summary": {"total_buildable_units": 0, "bottlenecks": []}}

    # Group BOM by product
    by_product: dict[str, list[dict[str, Any]]] = {}
    prod_names: dict[str, str] = {}
    for b in bom_items:
        pid = b["product_id"]
        by_product.setdefault(pid, []).append(b)
        prod_names[pid] = b["product_name"]

    product_results = []
    all_bottlenecks = []

    for pid, components in by_product.items():
        comp_analysis = []
        min_capacity = float("inf")
        bottleneck_mat: dict[str, Any] | None = None

        for c in components:
            mat_id = c["material_id"]
            usable = stock_by_mat.get(mat_id, 0.0)
            scrap = c["scrap_factor"] * scrap_multiplier
            req_per_unit = c["component_qty"] * (1.0 + scrap)

            # Direct safety stock lookup from pre-fetched BOM explosion
            ss_qty = float(c.get("safety_stock_qty", 0.0) or 0.0)

            net_usable_after_ss = max(0.0, usable - ss_qty)

            if req_per_unit > 0:
                cap = math.floor(usable / req_per_unit)
                prot_cap = math.floor(net_usable_after_ss / req_per_unit)
            else:
                cap = 999999999
                prot_cap = 999999999

            item = {
                "material_id": mat_id,
                "material_name": c["material_name"],
                "category": c["material_category"],
                "uom": c["uom"],
                "usable_stock": usable,
                "safety_stock_qty": ss_qty,
                "net_usable_after_ss": round(net_usable_after_ss, 2),
                "is_below_safety_stock": usable < ss_qty,
                "qty_per_product": c["component_qty"],
                "scrap_factor": scrap,
                "adjusted_req_per_unit": round(req_per_unit, 4),
                "supported_capacity": cap,
                "protected_capacity": prot_cap,
            }
            comp_analysis.append(item)

            if cap < min_capacity:
                min_capacity = cap
                bottleneck_mat = item

        # In case no components or 0
        if min_capacity == float("inf"):
            min_capacity = 0

        # Calculate surplus for other components when producing min_capacity units
        for item in comp_analysis:
            used_for_max = min_capacity * item["adjusted_req_per_unit"]
            item["required_for_capacity"] = round(used_for_max, 2)
            item["surplus_qty"] = round(max(0.0, item["usable_stock"] - used_for_max), 2)
            item["is_bottleneck"] = (item["material_id"] == (bottleneck_mat["material_id"] if bottleneck_mat else ""))

        if bottleneck_mat:
            all_bottlenecks.append({
                "product_id": pid,
                "product_name": prod_names[pid],
                "material_id": bottleneck_mat["material_id"],
                "material_name": bottleneck_mat["material_name"],
                "limiting_capacity": min_capacity,
                "usable_stock": bottleneck_mat["usable_stock"],
                "uom": bottleneck_mat["uom"],
            })

        # Sort components by supported capacity ascending (bottlenecks first)
        comp_analysis.sort(key=lambda x: x["supported_capacity"])
        min_protected = min((c["protected_capacity"] for c in comp_analysis), default=0)
        parts_below_ss = sum(1 for c in comp_analysis if c["is_below_safety_stock"])

        product_results.append({
            "product_id": pid,
            "product_name": prod_names[pid],
            "max_production_capacity": int(min_capacity),
            "protected_production_capacity": int(min_protected),
            "parts_below_ss_count": parts_below_ss,
            "bottleneck_material": bottleneck_mat["material_name"] if bottleneck_mat else "None",
            "bottleneck_material_id": bottleneck_mat["material_id"] if bottleneck_mat else "",
            "components": comp_analysis,
        })

    # Portfolio combined capacity (if shared across lines)
    total_capacity = sum(p["max_production_capacity"] for p in product_results)
    total_protected = sum(p["protected_production_capacity"] for p in product_results)

    return {
        "tenant_id": tenant_id,
        "plant_id": plant_id or "ALL",
        "scrap_multiplier": scrap_multiplier,
        "production_volume_scale": production_volume_scale,
        "products": product_results,
        "summary": {
            "total_buildable_units": total_capacity,
            "total_protected_units": total_protected,
            "product_count": len(product_results),
            "bottlenecks": all_bottlenecks,
        },
    }


PACKAGING_CONVERSIONS_CATALOG: list[dict[str, Any]] = [
    {"material_id": "MAT-WIRE-019", "material_name": "Solder Wire SAC305", "purchase_uom": "BOX", "inner_uom": "COIL", "inners_per_purchase": 10, "base_qty_per_inner": 0.1, "base_uom": "KG", "base_qty_per_purchase": 1.0, "std_use_per_phone": 0.0002, "std_loss_pct": 0.10, "assumption": "A25"},
    {"material_id": "MAT-PASTE-017", "material_name": "Solder Paste Type 4", "purchase_uom": "CASE", "inner_uom": "JAR", "inners_per_purchase": 10, "base_qty_per_inner": 0.5, "base_uom": "KG", "base_qty_per_purchase": 5.0, "std_use_per_phone": 0.0005, "std_loss_pct": 0.08, "assumption": "A22"},
    {"material_id": "MAT-ADH-018", "material_name": "Thermal Structural Adhesive", "purchase_uom": "CARTON", "inner_uom": "SYRINGE", "inners_per_purchase": 20, "base_qty_per_inner": 0.03, "base_uom": "KG", "base_qty_per_purchase": 0.6, "std_use_per_phone": 0.0003, "std_loss_pct": 0.05, "assumption": "A23"},
    {"material_id": "MAT-PCB-004", "material_name": "6-layer Main PCB", "purchase_uom": "BOX", "inner_uom": "PANEL", "inners_per_purchase": 10, "base_qty_per_inner": 5.0, "base_uom": "EA", "base_qty_per_purchase": 50.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-DSP-005", "material_name": "6.5in AMOLED Display", "purchase_uom": "BOX", "inner_uom": "UNIT", "inners_per_purchase": 40, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 40.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-BAT-006", "material_name": "5000mAh Li-ion Battery", "purchase_uom": "CARTON", "inner_uom": "UNIT", "inners_per_purchase": 50, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 50.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-CAM-007", "material_name": "Rear Camera Module", "purchase_uom": "TRAY", "inner_uom": "UNIT", "inners_per_purchase": 100, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 100.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-CAM-008", "material_name": "Front Camera Module", "purchase_uom": "TRAY", "inner_uom": "UNIT", "inners_per_purchase": 200, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 200.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-MEM-002", "material_name": "LPDDR Memory IC", "purchase_uom": "REEL", "inner_uom": "CHIP", "inners_per_purchase": 2000, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 2000.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-NAND-003", "material_name": "128GB UFS Flash Storage", "purchase_uom": "REEL", "inner_uom": "CHIP", "inners_per_purchase": 1000, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 1000.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-SOC-001", "material_name": "Application Processor SoC", "purchase_uom": "TRAY", "inner_uom": "CHIP", "inners_per_purchase": 100, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 100.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-HSG-009", "material_name": "Aluminium Mid-frame Housing", "purchase_uom": "CARTON", "inner_uom": "UNIT", "inners_per_purchase": 60, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 60.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-GLS-010", "material_name": "Cover Glass Panel", "purchase_uom": "CARTON", "inner_uom": "UNIT", "inners_per_purchase": 100, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 100.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-SPK-011", "material_name": "Stereo Speaker Module", "purchase_uom": "TRAY", "inner_uom": "UNIT", "inners_per_purchase": 500, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 500.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-ANT-012", "material_name": "RF Antenna Flex", "purchase_uom": "BAG", "inner_uom": "UNIT", "inners_per_purchase": 1000, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 1000.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-CON-013", "material_name": "Board-to-Board Connector", "purchase_uom": "REEL", "inner_uom": "CONNECTOR", "inners_per_purchase": 5000, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 5000.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
    {"material_id": "MAT-BOX-014", "material_name": "Retail Packaging Box", "purchase_uom": "BUNDLE", "inner_uom": "UNIT", "inners_per_purchase": 100, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 100.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.001, "assumption": "BOM"},
    {"material_id": "MAT-CBL-015", "material_name": "USB-C Cable", "purchase_uom": "CARTON", "inner_uom": "UNIT", "inners_per_purchase": 200, "base_qty_per_inner": 1.0, "base_uom": "EA", "base_qty_per_purchase": 200.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.001, "assumption": "BOM"},
    {"material_id": "MAT-SCR-016", "material_name": "Precision Screw Set", "purchase_uom": "BOX", "inner_uom": "SET", "inners_per_purchase": 1000, "base_qty_per_inner": 1.0, "base_uom": "SET", "base_qty_per_purchase": 1000.0, "std_use_per_phone": 1.0, "std_loss_pct": 0.005, "assumption": "BOM"},
]


def get_packaging_conversions() -> list[dict[str, Any]]:
    """Return all available material packaging conversion chains."""
    return PACKAGING_CONVERSIONS_CATALOG


def simulate_receipt_capacity(
    s: Session,
    tenant_id: str,
    plant_id: str,
    product_id: str,
    material_id: str,
    pack_quantity: float,
    pack_type: str | None = None,
    inners_per_pack: float | None = None,
) -> dict[str, Any]:
    """Answers the three fundamental leadership questions for any incoming receipt:

    1. Capacity from this receipt alone (e.g. 20 boxes solder wire -> 90,909 phones).
    2. Capacity it actually adds to the plant (0 phones if another part is bottleneck).
    3. What to buy to lift the limit (the next bottleneck material and purchase gap).
    """
    # 1. Baseline plant capacity
    baseline = calculate_production_capacity(s, tenant_id=tenant_id, plant_id=plant_id, product_id=product_id)
    prod = next((p for p in baseline["products"] if p["product_id"] == product_id), None)
    if not prod:
        prod = baseline["products"][0] if baseline["products"] else None

    baseline_gross = prod["max_production_capacity"] if prod else 0
    baseline_prot = prod["protected_production_capacity"] if prod else 0
    baseline_bottleneck_id = prod["bottleneck_material_id"] if prod else ""
    baseline_bottleneck_name = prod["bottleneck_material"] if prod else "None"

    # 2. Conversion lookup
    conv = next((c for c in PACKAGING_CONVERSIONS_CATALOG if c["material_id"] == material_id), None)
    if not conv:
        # Fallback 1:1 if not found
        conv = {
            "material_id": material_id,
            "material_name": material_id,
            "purchase_uom": pack_type or "EA",
            "inner_uom": pack_type or "EA",
            "inners_per_purchase": 1,
            "base_qty_per_inner": 1.0,
            "base_uom": "EA",
            "base_qty_per_purchase": 1.0,
            "std_use_per_phone": 1.0,
            "std_loss_pct": 0.005,
            "assumption": "STANDARD",
        }

    ptype = pack_type or conv["purchase_uom"]
    actual_inners = float(inners_per_pack) if inners_per_pack is not None and inners_per_pack > 0 else float(conv["inners_per_purchase"])
    base_qty_per_purchase = actual_inners * float(conv["base_qty_per_inner"])
    base_qty = pack_quantity * base_qty_per_purchase
    consumption_per_unit = conv["std_use_per_phone"] * (1.0 + conv["std_loss_pct"])
    receipt_alone_capacity = math.floor(base_qty / consumption_per_unit) if consumption_per_unit > 0 else 0

    # 3. Simulate plant capacity with the receipt added
    # We find the component in prod and simulate increasing its usable stock
    new_comp_caps = []
    comp_map = {c["material_id"]: dict(c) for c in (prod["components"] if prod else [])}

    if material_id in comp_map:
        target_comp = comp_map[material_id]
        new_usable = target_comp["usable_stock"] + base_qty
        target_comp["usable_stock"] = new_usable
        target_comp["supported_capacity"] = math.floor(new_usable / target_comp["adjusted_req_per_unit"])
        target_comp["net_usable_after_ss"] = max(0.0, new_usable - target_comp["safety_stock_qty"])
        target_comp["protected_capacity"] = math.floor(target_comp["net_usable_after_ss"] / target_comp["adjusted_req_per_unit"])

    for c in comp_map.values():
        new_comp_caps.append((c["supported_capacity"], c["protected_capacity"], c["material_id"], c["material_name"]))

    new_comp_caps.sort(key=lambda x: x[0])
    new_gross = new_comp_caps[0][0] if new_comp_caps else 0
    new_bottleneck_id = new_comp_caps[0][2] if new_comp_caps else ""
    new_bottleneck_name = new_comp_caps[0][3] if new_comp_caps else "None"

    # Effective capacity added to plant
    effective_added_gross = max(0, new_gross - baseline_gross)

    # 4. Find what to buy to lift the bottleneck
    # If the added capacity was 0, the bottleneck remains baseline_bottleneck_id
    current_limiting = new_comp_caps[0]
    limiting_comp = comp_map.get(current_limiting[2])
    gap_for_receipt_potential = 0
    if limiting_comp and receipt_alone_capacity > baseline_gross:
        needed_for_receipt_pot = math.ceil((receipt_alone_capacity - current_limiting[0]) * limiting_comp["adjusted_req_per_unit"])
        gap_for_receipt_potential = max(0, needed_for_receipt_pot)

    if effective_added_gross == 0:
        takeaway = (
            f"This receipt of {pack_quantity:g} {ptype} ({actual_inners:g} {conv['inner_uom']}/pack) of {conv['material_name']} supports {receipt_alone_capacity:,} units alone, "
            f"but adds 0 units to {plant_id} because {baseline_bottleneck_name} restricts line capacity to {baseline_gross:,} units."
        )
    else:
        takeaway = (
            f"This receipt of {pack_quantity:g} {ptype} ({actual_inners:g} {conv['inner_uom']}/pack) of {conv['material_name']} successfully lifts plant capacity by "
            f"{effective_added_gross:,} units from {baseline_gross:,} to {new_gross:,} units (next limit: {new_bottleneck_name})."
        )

    return {
        "plant_id": plant_id,
        "product_id": product_id,
        "receipt_input": {
            "material_id": material_id,
            "material_name": conv["material_name"],
            "pack_quantity": pack_quantity,
            "pack_type": ptype,
            "inners_per_pack": actual_inners,
            "inner_uom": conv["inner_uom"],
            "inner_breakdown": f"{pack_quantity:g} × {actual_inners:g} {conv['inner_uom']} of {conv['base_qty_per_inner']} {conv['base_uom']}",
            "base_quantity": round(base_qty, 3),
            "base_uom": conv["base_uom"],
            "consumption_standard": f"{conv['std_use_per_phone']:g} {conv['base_uom']}/unit (+{conv['std_loss_pct']*100:g}% loss = {consumption_per_unit:g} {conv['base_uom']})",
            "assumption_id": conv.get("assumption"),
        },
        "capacity_from_receipt_alone": receipt_alone_capacity,
        "baseline_plant_capacity": {
            "gross_capacity": baseline_gross,
            "protected_capacity": baseline_prot,
            "bottleneck_material_id": baseline_bottleneck_id,
            "bottleneck_material_name": baseline_bottleneck_name,
        },
        "new_simulated_capacity": {
            "gross_capacity": new_gross,
            "bottleneck_material_id": new_bottleneck_id,
            "bottleneck_material_name": new_bottleneck_name,
        },
        "effective_capacity_added_to_plant": effective_added_gross,
        "leadership_takeaway": takeaway,
        "next_bottleneck_to_buy": {
            "material_id": current_limiting[2],
            "material_name": current_limiting[3],
            "current_supported_capacity": current_limiting[0],
            "quantity_to_buy_to_match_receipt": gap_for_receipt_potential,
            "uom": limiting_comp.get("uom", "EA") if limiting_comp else "EA",
        },
    }

