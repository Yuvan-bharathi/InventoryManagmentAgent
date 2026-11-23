"""Module E - Production Bottleneck and Scenario Simulation.

Simulates what-if scenarios:
  1. Production volume variations (+/- X%)
  2. Component scrap/consumption variations (+/- Y%)
  3. Supplier delivery delays (+D days)
  4. Partial shipment receipts (P% received)
  5. QC rejection / material loss
"""
from __future__ import annotations

import datetime
from typing import Any
from sqlalchemy.orm import Session

from app.intelligence.capacity import calculate_production_capacity
from app.intelligence.forecasting import calculate_demand_forecast


def simulate_production_change(
    s: Session,
    tenant_id: str,
    plant_id: str | None = None,
    volume_change_pct: float = 20.0,
    scrap_change_pct: float = 0.0,
) -> dict[str, Any]:
    """Simulate the effect of changing production output volume and scrap allowance.

    Calculates:
      - Baseline vs simulated capacity
      - New component requirement delta
      - Impact on limiting bottlenecks
    """
    # Baseline
    base_cap = calculate_production_capacity(s, tenant_id, plant_id=plant_id, scrap_multiplier=1.0)
    
    # Simulated
    scrap_mult = 1.0 + (scrap_change_pct / 100.0)
    sim_cap = calculate_production_capacity(s, tenant_id, plant_id=plant_id, scrap_multiplier=scrap_mult)

    # 30-day demand impact
    base_forecast = calculate_demand_forecast(s, tenant_id, horizon_days=30, plant_id=plant_id)
    
    demand_mult = 1.0 + (volume_change_pct / 100.0)
    affected_materials = []
    new_critical_count = 0

    for item in base_forecast:
        sim_demand = item["forecast_demand_qty"] * demand_mult * scrap_mult
        sim_closing = (item["usable_stock_qty"] + item["incoming_po_qty"]) - sim_demand
        new_status = "CRITICAL" if sim_closing < 0 else "AT_RISK" if sim_closing < item["safety_stock_qty"] else "HEALTHY"
        
        status_changed = (new_status != item["status"])
        if new_status == "CRITICAL":
            new_critical_count += 1

        if status_changed or new_status == "CRITICAL":
            affected_materials.append({
                "material_id": item["material_id"],
                "material_name": item["material_name"],
                "category": item["category"],
                "uom": item["uom"],
                "baseline_demand": item["forecast_demand_qty"],
                "simulated_demand": round(sim_demand, 2),
                "demand_increase": round(sim_demand - item["forecast_demand_qty"], 2),
                "baseline_closing": item["projected_closing_qty"],
                "simulated_closing": round(sim_closing, 2),
                "baseline_status": item["status"],
                "simulated_status": new_status,
            })

    return {
        "scenario_type": "PRODUCTION_VOLUME_VARIATION",
        "parameters": {
            "volume_change_pct": volume_change_pct,
            "scrap_change_pct": scrap_change_pct,
            "plant_id": plant_id or "ALL",
        },
        "baseline": {
            "total_buildable_units": base_cap["summary"]["total_buildable_units"],
            "bottlenecks": base_cap["summary"]["bottlenecks"],
            "critical_materials_count": sum(1 for m_ in base_forecast if m_["status"] == "CRITICAL"),
        },
        "simulated": {
            "total_buildable_units": sim_cap["summary"]["total_buildable_units"],
            "bottlenecks": sim_cap["summary"]["bottlenecks"],
            "critical_materials_count": new_critical_count,
            "capacity_delta_units": sim_cap["summary"]["total_buildable_units"] - base_cap["summary"]["total_buildable_units"],
        },
        "affected_materials": affected_materials,
        "recommendation": (
            f"A {volume_change_pct:+.0f}% change in production with {scrap_change_pct:+.0f}% scrap shift results in "
            f"{new_critical_count} critical materials in the 30-day horizon. Expedite replenishment for primary bottlenecks."
        ),
    }


def simulate_supplier_delay(
    s: Session,
    tenant_id: str,
    supplier_id: str | None = None,
    delay_days: int = 5,
    plant_id: str | None = None,
    receipt_rate_pct: float = 100.0,
) -> dict[str, Any]:
    """Simulate the effect of a supplier delivery delay or partial shipment arrival.

    Evaluates:
      - Postponed incoming PO lines
      - Accelerated stock-out dates
      - Affected production lines & finished goods risk
    """
    base_forecast = calculate_demand_forecast(s, tenant_id, horizon_days=30, plant_id=plant_id)
    receipt_factor = max(0.0, min(100.0, receipt_rate_pct)) / 100.0

    at_risk_materials = []
    line_stop_count = 0

    for item in base_forecast:
        # If delivery is delayed by delay_days, PO arrival is postponed
        daily_rate = item["daily_consumption_rate"]
        usable = item["usable_stock_qty"]
        adjusted_incoming = item["incoming_po_qty"] * receipt_factor

        # Days until stock runs out without new PO
        days_without_po = (usable / daily_rate) if daily_rate > 0 else 999.0
        stockout_imminent = days_without_po < delay_days

        if stockout_imminent and adjusted_incoming > 0:
            line_stop_count += 1
            shortage_pull_in_days = max(1, delay_days - int(days_without_po))
            at_risk_materials.append({
                "material_id": item["material_id"],
                "material_name": item["material_name"],
                "category": item["category"],
                "uom": item["uom"],
                "usable_stock": usable,
                "daily_burn_rate": daily_rate,
                "days_until_empty": round(days_without_po, 1),
                "delayed_po_qty": item["incoming_po_qty"],
                "effective_incoming_qty": round(adjusted_incoming, 2),
                "delay_days": delay_days,
                "shortage_accelerated_by_days": shortage_pull_in_days,
                "line_stop_risk": "HIGH" if days_without_po <= 3 else "MEDIUM",
            })

    return {
        "scenario_type": "SUPPLIER_DELIVERY_DELAY",
        "parameters": {
            "supplier_id": supplier_id or "ALL_SUPPLIERS",
            "delay_days": delay_days,
            "receipt_rate_pct": receipt_rate_pct,
            "plant_id": plant_id or "ALL",
        },
        "impact_summary": {
            "line_stop_risk_count": line_stop_count,
            "critical_shortages_triggered": len(at_risk_materials),
            "severity": "CRITICAL" if line_stop_count > 0 else "MANAGEABLE",
        },
        "affected_materials": at_risk_materials,
        "recommendation": (
            f"A {delay_days}-day delivery delay (at {receipt_rate_pct:.0f}% fulfillment) triggers {line_stop_count} "
            f"potential line-stop events. Review buffer stock and initiate inter-plant transfer proposals."
        ),
    }

