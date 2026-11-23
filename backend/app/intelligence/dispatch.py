"""Finished Goods & Dispatch Intelligence Module

Analyzes shipment milestones, domestic vs. export container stuffing,
carrier SLAs, delivery exceptions, and transport mode throughput from:
  - data/data/fact_shipment_milestone.csv
  - data/data/fact_customer_order.csv
  - data/data/dim_customer.csv
  - data/data/dim_product.csv
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd


DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "data"


def _load_data() -> pd.DataFrame:
    ship_csv = DATA_DIR / "fact_shipment_milestone.csv"
    ord_csv = DATA_DIR / "fact_customer_order.csv"
    cus_csv = DATA_DIR / "dim_customer.csv"
    prod_csv = DATA_DIR / "dim_product.csv"

    if not ship_csv.exists():
        return pd.DataFrame()

    df_ship = pd.read_csv(ship_csv)

    if ord_csv.exists():
        df_ord = pd.read_csv(ord_csv)
        df_ship = df_ship.merge(
            df_ord[["customer_order_id", "customer_id", "product_id", "channel", "priority"]],
            on="customer_order_id",
            how="left",
        )
    else:
        df_ship["customer_id"] = "CUS-001"
        df_ship["product_id"] = "SPH-A15-256"
        df_ship["channel"] = "B2B"
        df_ship["priority"] = "NORMAL"

    if cus_csv.exists():
        df_cus = pd.read_csv(cus_csv)
        df_ship = df_ship.merge(
            df_cus[["customer_id", "customer_name", "country", "service_level"]],
            on="customer_id",
            how="left",
        )
    else:
        df_ship["customer_name"] = "Default Distributor"
        df_ship["country"] = "India"
        df_ship["service_level"] = "OTIF-95"

    if prod_csv.exists():
        df_prod = pd.read_csv(prod_csv)
        df_ship = df_ship.merge(
            df_prod[["product_id", "product_name"]],
            on="product_id",
            how="left",
        )
    else:
        df_ship["product_name"] = df_ship["product_id"]

    return df_ship


def get_dispatch_overview(
    plant_id: Optional[str] = None,
    status: Optional[str] = None,
    carrier: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    df = _load_data()
    if df.empty:
        return {"summary": {}, "carrier_performance": [], "mode_breakdown": [], "recent_shipments": []}

    # Filter by plant if specified
    if plant_id and "All" not in plant_id and plant_id != "all":
        df_filtered = df[df["plant_id"] == plant_id]
        if df_filtered.empty:
            df_filtered = df  # fallback gracefully
    else:
        df_filtered = df

    # Summary metrics
    total_shipments = len(df_filtered)
    total_units = int(df_filtered["shipment_qty"].sum())
    total_freight_inr = float(df_filtered["freight_cost_inr"].sum())

    delivered_df = df_filtered[df_filtered["shipment_status"] == "DELIVERED"]
    delivered_count = len(delivered_df)
    in_transit_count = len(df_filtered[df_filtered["shipment_status"] == "IN_TRANSIT"])
    delayed_count = len(df_filtered[df_filtered["shipment_status"] == "DELAYED"])

    # On-time calculation for delivered items: actual_delivery_ts <= planned_eta
    if not delivered_df.empty:
        on_time_delivered = int((delivered_df["actual_delivery_ts"] <= delivered_df["planned_eta"]).sum())
        on_time_rate = float(round((on_time_delivered / delivered_count) * 100, 1))
    else:
        on_time_rate = 0.0

    avg_utilization = float(round(float(df_filtered["vehicle_utilization_pct"].mean()), 1))

    # Carrier performance scorecard
    carrier_groups = []
    for c_name, c_df in df_filtered.groupby("carrier"):
        c_total = len(c_df)
        c_del = c_df[c_df["shipment_status"] == "DELIVERED"]
        c_on_time = (c_del["actual_delivery_ts"] <= c_del["planned_eta"]).sum() if not c_del.empty else 0
        c_ot_rate = round((c_on_time / len(c_del) * 100), 1) if not c_del.empty else 0.0
        c_modes = c_df["vehicle_type"].unique().tolist()
        carrier_groups.append({
            "carrier": str(c_name),
            "shipments_count": c_total,
            "delivered_count": len(c_del),
            "delayed_count": len(c_df[c_df["shipment_status"] == "DELAYED"]),
            "in_transit_count": len(c_df[c_df["shipment_status"] == "IN_TRANSIT"]),
            "on_time_pct": c_ot_rate,
            "avg_utilization_pct": round(float(c_df["vehicle_utilization_pct"].mean()), 1),
            "total_units": int(c_df["shipment_qty"].sum()),
            "total_freight_inr": round(float(c_df["freight_cost_inr"].sum()), 2),
            "primary_modes": c_modes,
        })
    carrier_groups.sort(key=lambda x: x["on_time_pct"], reverse=True)

    # Mode breakdown
    mode_labels = {
        "AIR_CARGO": "Air Express & Long-Haul",
        "32FT_TRUCK": "32ft Heavy Container Truck",
        "20FT_TRUCK": "20ft Medium Cargo Truck",
        "VAN": "Local Sprinter Delivery Van",
    }
    mode_groups = []
    for v_type, v_df in df_filtered.groupby("vehicle_type"):
        mode_groups.append({
            "vehicle_type": str(v_type),
            "display_name": mode_labels.get(str(v_type), str(v_type)),
            "shipments_count": len(v_df),
            "total_units": int(v_df["shipment_qty"].sum()),
            "avg_utilization_pct": round(float(v_df["vehicle_utilization_pct"].mean()), 1),
            "total_freight_inr": round(float(v_df["freight_cost_inr"].sum()), 2),
        })
    mode_groups.sort(key=lambda x: x["shipments_count"], reverse=True)

    # Filtered shipment table
    table_df = df_filtered
    if status and status != "ALL":
        table_df = table_df[table_df["shipment_status"] == status]
    if carrier and carrier != "ALL":
        table_df = table_df[table_df["carrier"] == carrier]
    if vehicle_type and vehicle_type != "ALL":
        table_df = table_df[table_df["vehicle_type"] == vehicle_type]

    # Sort recent shipments by dispatch_date descending
    table_df = table_df.sort_values("dispatch_date", ascending=False).head(limit)

    recent_shipments = []
    for _, row in table_df.iterrows():
        planned = str(row.get("planned_eta", ""))
        actual = str(row.get("actual_delivery_ts", ""))
        is_delayed = (row.get("shipment_status") == "DELAYED") or (actual > planned and planned != "")

        recent_shipments.append({
            "shipment_id": str(row.get("shipment_id")),
            "customer_order_id": str(row.get("customer_order_id")),
            "customer_name": str(row.get("customer_name") or "Global Devices"),
            "product_id": str(row.get("product_id") or "SPH-A15-256"),
            "product_name": str(row.get("product_name") or "Aster 15 256GB"),
            "carrier": str(row.get("carrier")),
            "vehicle_type": str(row.get("vehicle_type")),
            "vehicle_type_label": mode_labels.get(str(row.get("vehicle_type")), str(row.get("vehicle_type"))),
            "dispatch_date": str(row.get("dispatch_date")),
            "planned_eta": planned[:10] if planned else "",
            "actual_delivery_date": actual[:10] if actual and actual != "nan" else "In Transit",
            "shipment_qty": int(row.get("shipment_qty", 0)),
            "freight_cost_inr": float(row.get("freight_cost_inr", 0)),
            "vehicle_utilization_pct": float(row.get("vehicle_utilization_pct", 0)),
            "pod_status": str(row.get("pod_status")),
            "shipment_status": str(row.get("shipment_status")),
            "is_delayed": bool(is_delayed),
            "destination_country": str(row.get("country") or "India"),
            "channel": str(row.get("channel") or "B2B"),
        })

    return {
        "summary": {
            "total_shipments": total_shipments,
            "total_units_dispatched": total_units,
            "delivered_count": delivered_count,
            "in_transit_count": in_transit_count,
            "delayed_count": delayed_count,
            "on_time_delivery_rate": on_time_rate,
            "avg_vehicle_utilization": avg_utilization,
            "total_freight_cost_inr": total_freight_inr,
        },
        "carrier_performance": carrier_groups,
        "mode_breakdown": mode_groups,
        "recent_shipments": recent_shipments,
    }
