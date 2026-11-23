"""Quality intelligence: inspection results, defect telemetry, and quarantined inventory."""
from __future__ import annotations

from pathlib import Path
from typing import Any
import numpy as np
import pandas as pd

from app.config import REPO_ROOT

CSV_QC = REPO_ROOT / "data" / "data" / "fact_quality_inspection.csv"
CSV_DEFECTS = REPO_ROOT / "data" / "data" / "dim_defect_code.csv"
CSV_SNAPSHOT = REPO_ROOT / "data" / "raw" / "fact_inventory_daily_snapshot.csv"
CSV_MATERIALS = REPO_ROOT / "data" / "data" / "dim_material.csv"

_QC_CACHE: dict[str, Any] = {}


def get_quality_overview(plant_id: str | None = None, stage: str | None = None, disposition: str | None = None) -> dict[str, Any]:
    """Return consolidated quality hold, rework, scrap, and defect statistics."""
    # 1. Load inspections
    if "df_qc" not in _QC_CACHE:
        if CSV_QC.exists():
            _QC_CACHE["df_qc"] = pd.read_csv(CSV_QC)
        else:
            _QC_CACHE["df_qc"] = pd.DataFrame()

    if "df_defects" not in _QC_CACHE:
        if CSV_DEFECTS.exists():
            _QC_CACHE["df_defects"] = pd.read_csv(CSV_DEFECTS)
        else:
            _QC_CACHE["df_defects"] = pd.DataFrame()

    if "df_materials" not in _QC_CACHE:
        if CSV_MATERIALS.exists():
            _QC_CACHE["df_materials"] = pd.read_csv(CSV_MATERIALS)
        else:
            _QC_CACHE["df_materials"] = pd.DataFrame()

    df = _QC_CACHE["df_qc"].copy()
    defects = _QC_CACHE["df_defects"]
    materials = _QC_CACHE["df_materials"]

    if df.empty:
        return {"summary": {}, "by_stage": [], "by_defect": [], "lots": [], "quarantined_materials": []}

    if plant_id:
        df = df[df["plant_id"] == plant_id]
    if stage:
        df = df[df["inspection_stage"] == stage]
    if disposition:
        df = df[df["disposition"] == disposition]

    total_inspections = len(df)
    pass_count = int((df["result"] == "PASS").sum())
    fail_count = int((df["result"] == "FAIL").sum())
    hold_count = int((df["disposition"] == "HOLD").sum())
    rework_count = int((df["disposition"] == "REWORK").sum())
    scrap_count = int((df["disposition"] == "SCRAP").sum())
    yield_pct = round(100.0 * pass_count / total_inspections, 2) if total_inspections else 100.0

    # Defect map
    defect_names = {}
    if not defects.empty:
        defect_names = dict(zip(defects["defect_code"], defects["defect_name"]))

    # By Stage
    stage_groups = []
    if "inspection_stage" in df.columns:
        for stg, grp in df.groupby("inspection_stage"):
            stg_total = len(grp)
            stg_fail = int((grp["result"] == "FAIL").sum())
            stage_groups.append({
                "stage": stg,
                "total": stg_total,
                "fails": stg_fail,
                "fail_rate_pct": round(100.0 * stg_fail / stg_total, 2) if stg_total else 0.0,
                "holds": int((grp["disposition"] == "HOLD").sum()),
                "reworks": int((grp["disposition"] == "REWORK").sum()),
                "scraps": int((grp["disposition"] == "SCRAP").sum()),
            })
    stage_groups.sort(key=lambda x: x["fails"], reverse=True)

    # By Defect
    defect_groups = []
    fails_df = df[df["result"] == "FAIL"]
    if not fails_df.empty and "defect_code" in fails_df.columns:
        for code, grp in fails_df.groupby("defect_code"):
            defect_groups.append({
                "defect_code": code,
                "defect_name": defect_names.get(code, code),
                "count": len(grp),
                "severity": grp["severity"].iloc[0] if "severity" in grp.columns else "MAJOR",
                "default_disposition": grp["disposition"].iloc[0] if "disposition" in grp.columns else "HOLD",
            })
    defect_groups.sort(key=lambda x: x["count"], reverse=True)

    # Recent hold/rework/scrap lots
    non_pass = df[df["disposition"].isin(["HOLD", "REWORK", "SCRAP"])].sort_values("inspection_ts", ascending=False).head(100)
    lots = []
    for _, row in non_pass.iterrows():
        dcode = str(row.get("defect_code", ""))
        lots.append({
            "inspection_id": row.get("inspection_id"),
            "inspection_ts": row.get("inspection_ts"),
            "plant_id": row.get("plant_id"),
            "line_id": row.get("line_id"),
            "station_id": row.get("station_id"),
            "product_id": row.get("product_id"),
            "serial_number": row.get("serial_number"),
            "production_order_id": row.get("production_order_id"),
            "inspection_stage": row.get("inspection_stage"),
            "defect_code": dcode,
            "defect_name": defect_names.get(dcode, dcode),
            "result": row.get("result"),
            "severity": row.get("severity"),
            "measurement_value": row.get("measurement_value"),
            "spec_min": row.get("spec_min"),
            "spec_max": row.get("spec_max"),
            "disposition": row.get("disposition"),
        })

    # Quarantined inventory from snapshot
    quarantined = []
    total_quarantined_val = 0.0
    if CSV_SNAPSHOT.exists():
        snap = pd.read_csv(CSV_SNAPSHOT)
        latest_date = snap["snapshot_date"].max()
        lsnap = snap[snap["snapshot_date"] == latest_date]
        if plant_id:
            lsnap = lsnap[lsnap["plant_id"] == plant_id]
        holds = lsnap[lsnap["quality_hold_qty"] > 0].copy()
        holds["hold_value_inr"] = holds["quality_hold_qty"] * holds["unit_cost_inr"]
        total_quarantined_val = float(holds["hold_value_inr"].sum())

        mat_info = {}
        if not materials.empty:
            for _, mrow in materials.iterrows():
                mat_info[mrow["material_id"]] = {
                    "material_name": mrow["material_name"],
                    "material_category": mrow["material_category"],
                    "uom": mrow["uom"],
                }

        agg_holds = holds.groupby(["material_id", "plant_id"]).agg(
            quality_hold_qty=("quality_hold_qty", "sum"),
            hold_value_inr=("hold_value_inr", "sum"),
            unit_cost_inr=("unit_cost_inr", "mean"),
            warehouses=("warehouse_id", lambda x: ", ".join(sorted(x.unique()))),
        ).reset_index()

        for _, hrow in agg_holds.iterrows():
            mid = hrow["material_id"]
            minfo = mat_info.get(mid, {})
            quarantined.append({
                "material_id": mid,
                "material_name": minfo.get("material_name", mid),
                "material_category": minfo.get("material_category", "Raw Material"),
                "uom": minfo.get("uom", "EA"),
                "plant_id": hrow["plant_id"],
                "quality_hold_qty": float(hrow["quality_hold_qty"]),
                "unit_cost_inr": float(hrow["unit_cost_inr"]),
                "hold_value_inr": float(hrow["hold_value_inr"]),
                "warehouses": hrow["warehouses"],
                "status": "QUARANTINED",
            })
        quarantined.sort(key=lambda x: x["hold_value_inr"], reverse=True)

    return {
        "summary": {
            "total_inspections": total_inspections,
            "pass_count": pass_count,
            "fail_count": fail_count,
            "yield_pct": yield_pct,
            "hold_count": hold_count,
            "rework_count": rework_count,
            "scrap_count": scrap_count,
            "total_quarantined_value_inr": total_quarantined_val,
            "quarantined_materials_count": len(quarantined),
        },
        "by_stage": stage_groups,
        "by_defect": defect_groups[:10],
        "lots": lots,
        "quarantined_materials": quarantined,
    }

