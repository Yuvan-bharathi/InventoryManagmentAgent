"""Module A - Material and Packaging Intelligence.

Converts packaging units (BOX, CARTON, DRUM, REEL, PACK) into material base UOMs,
accounting for scrap, QC rejection, and valuation.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# Material packaging conversions defaults per specification examples
PACKAGING_CONVERSIONS: dict[str, dict[str, Any]] = {
    # e.g. RM-SOLDER-01: 20 boxes * 10 coils = 200 coils; 1 coil = 100g -> 20,000g
    "RM-SOLDER": {
        "BOX": {"base_uom": "COIL", "factor": 10.0, "net_weight_per_unit": 100.0, "weight_uom": "GRAM"},
        "CARTON": {"base_uom": "COIL", "factor": 50.0, "net_weight_per_unit": 100.0, "weight_uom": "GRAM"},
    },
    "MAT-BOX-014": {
        "CARTON": {"base_uom": "EA", "factor": 24.0, "net_weight_per_unit": 150.0, "weight_uom": "GRAM"},
        "PALLET": {"base_uom": "EA", "factor": 240.0, "net_weight_per_unit": 150.0, "weight_uom": "GRAM"},
    },
    "MAT-SCR-016": {
        "BOX": {"base_uom": "SET", "factor": 100.0, "net_weight_per_unit": 50.0, "weight_uom": "GRAM"},
        "PACK": {"base_uom": "SET", "factor": 20.0, "net_weight_per_unit": 50.0, "weight_uom": "GRAM"},
    },
    "MAT-GLS-010": {
        "CRATE": {"base_uom": "EA", "factor": 50.0, "net_weight_per_unit": 40.0, "weight_uom": "GRAM"},
        "BOX": {"base_uom": "EA", "factor": 10.0, "net_weight_per_unit": 40.0, "weight_uom": "GRAM"},
    },
    "DEFAULT": {
        "BOX": {"base_uom": "EA", "factor": 10.0, "net_weight_per_unit": 100.0, "weight_uom": "GRAM"},
        "CARTON": {"base_uom": "EA", "factor": 24.0, "net_weight_per_unit": 100.0, "weight_uom": "GRAM"},
        "DRUM": {"base_uom": "LITRE", "factor": 25.0, "net_weight_per_unit": 1000.0, "weight_uom": "GRAM"},
        "REEL": {"base_uom": "METRE", "factor": 500.0, "net_weight_per_unit": 200.0, "weight_uom": "GRAM"},
        "PACK": {"base_uom": "EA", "factor": 10.0, "net_weight_per_unit": 50.0, "weight_uom": "GRAM"},
    }
}


def convert_packaging(
    material_code: str,
    package_uom: str,
    package_qty: float,
    qc_loss_pct: float = 0.0,
    unit_cost_inr: float = 100.0,
) -> dict[str, Any]:
    """Convert package quantity to base UOM, applying conversion factors and QC scrap allowance."""
    pkg_upper = package_uom.upper().strip()
    mat_key = material_code.upper().strip()

    # Look up conversion parameters
    conv_rule = None
    if mat_key in PACKAGING_CONVERSIONS and pkg_upper in PACKAGING_CONVERSIONS[mat_key]:
        conv_rule = PACKAGING_CONVERSIONS[mat_key][pkg_upper]
    elif pkg_upper in PACKAGING_CONVERSIONS["DEFAULT"]:
        conv_rule = PACKAGING_CONVERSIONS["DEFAULT"][pkg_upper]
    else:
        # Fallback 1:1 if unit is already base or unrecognized
        conv_rule = {"base_uom": pkg_upper, "factor": 1.0, "net_weight_per_unit": 1.0, "weight_uom": "UNIT"}

    base_uom = conv_rule["base_uom"]
    conversion_factor = conv_rule["factor"]
    total_base_qty = package_qty * conversion_factor

    # QC loss / scrap adjustment
    loss_fraction = max(0.0, min(100.0, qc_loss_pct)) / 100.0
    rejected_qty = total_base_qty * loss_fraction
    usable_base_qty = total_base_qty - rejected_qty

    # Weight equivalent if defined
    weight_per_unit = conv_rule.get("net_weight_per_unit", 1.0)
    weight_uom = conv_rule.get("weight_uom", "GRAM")
    total_weight = total_base_qty * weight_per_unit
    usable_weight = usable_base_qty * weight_per_unit

    # Valuation
    total_value_inr = usable_base_qty * unit_cost_inr

    return {
        "material_code": material_code,
        "input_package_qty": package_qty,
        "package_uom": pkg_upper,
        "conversion_factor": conversion_factor,
        "base_uom": base_uom,
        "total_received_base_qty": total_base_qty,
        "qc_loss_pct": qc_loss_pct,
        "rejected_qty": round(rejected_qty, 2),
        "usable_base_qty": round(usable_base_qty, 2),
        "total_weight": round(total_weight, 2),
        "usable_weight": round(usable_weight, 2),
        "weight_uom": weight_uom,
        "unit_cost_inr": unit_cost_inr,
        "total_value_inr": round(total_value_inr, 2),
        "audit_trace": (
            f"{package_qty} {pkg_upper} × {conversion_factor} {base_uom}/{pkg_upper} = "
            f"{total_base_qty:,.0f} {base_uom} (less {qc_loss_pct}% loss → {usable_base_qty:,.0f} usable {base_uom})"
        ),
    }

