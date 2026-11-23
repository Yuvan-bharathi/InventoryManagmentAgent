"""Read the organization dataset from a ZIP or a folder of CSVs.

Only the 10 files the inventory agent needs are read; other files in the ZIP are ignored.
Raw files are never modified. A missing required file or column raises DatasetError.
"""
from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

# file -> (required columns, date columns, required?)
FILES: dict[str, tuple[list[str], list[str], bool]] = {
    "dim_material": (["material_id", "material_name", "material_category", "uom", "standard_price_inr",
                      "lead_time_days", "safety_stock_qty", "moq", "shelf_life_days"], [], True),
    "dim_plant": (["plant_id", "plant_name", "state", "currency"], [], True),
    "dim_supplier": (["supplier_id", "supplier_name", "material_category", "approved_status",
                      "standard_lead_time_days", "risk_tier"], [], True),
    "dim_product": (["product_id", "product_name"], [], True),
    "fact_bom_component": (["product_id", "material_id", "component_qty", "scrap_factor", "revision",
                            "effective_from", "effective_to"], ["effective_from", "effective_to"], True),
    "fact_inventory_daily_snapshot": (["snapshot_date", "plant_id", "material_id", "warehouse_id", "lot_id",
                                       "on_hand_qty", "allocated_qty", "blocked_qty", "quality_hold_qty",
                                       "in_transit_qty", "safety_stock_qty", "inventory_status",
                                       "unit_cost_inr", "expiry_date"], ["snapshot_date", "expiry_date"], True),
    "fact_purchase_order_receipt": (["po_id", "po_line", "supplier_id", "material_id", "plant_id", "po_date",
                                     "promised_date", "receipt_date", "ordered_qty", "received_qty",
                                     "unit_price_inr", "po_status"],
                                    ["po_date", "promised_date", "receipt_date"], True),
    "fact_production_order": (["production_order_id", "plant_id", "product_id", "customer_order_id",
                               "order_qty", "priority", "planned_start", "planned_finish", "due_date",
                               "order_status"], ["planned_start", "planned_finish", "due_date"], True),
    "fact_customer_order": (["customer_order_id", "product_id", "order_date", "order_qty", "order_status"],
                            ["order_date", "requested_delivery_date", "confirmed_delivery_date"], False),
    "fact_engineering_change": (["change_request_id", "change_type", "product_id", "part_id",
                                 "implementation_status"], ["request_date", "cut_in_date"], False),
}


class DatasetError(ValueError):
    pass


@dataclass
class Dataset:
    frames: dict[str, pd.DataFrame]
    source: str

    def __getitem__(self, name: str) -> pd.DataFrame:
        return self.frames[name]

    def get(self, name: str) -> pd.DataFrame | None:
        return self.frames.get(name)


def _parse(name: str, df: pd.DataFrame) -> pd.DataFrame:
    required, dates, _ = FILES[name]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise DatasetError(f"{name}.csv is missing required column(s): {', '.join(missing)}")
    for c in dates:
        if c in df.columns:
            # Timestamps such as 2026-09-15T00:00:00 are normalised to dates.
            df[c] = pd.to_datetime(df[c], errors="coerce").dt.normalize()
    return df


def read_dataset(path: str | Path) -> Dataset:
    """Read a ZIP file or a directory containing the dataset CSVs."""
    path = Path(path)
    raw: dict[str, pd.DataFrame] = {}
    if path.is_file() and path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as zf:
            for info in zf.infolist():
                stem = Path(info.filename).stem
                if stem in FILES and info.filename.lower().endswith(".csv"):
                    raw[stem] = pd.read_csv(io.BytesIO(zf.read(info)))
    elif path.is_dir():
        for name in FILES:
            f = path / f"{name}.csv"
            if f.exists():
                raw[name] = pd.read_csv(f)
    else:
        raise DatasetError(f"Not a ZIP file or directory: {path}")

    absent = [n for n, (_, _, req) in FILES.items() if req and n not in raw]
    if absent:
        raise DatasetError("Missing required file(s): " + ", ".join(f"{n}.csv" for n in absent))
    return Dataset({n: _parse(n, df) for n, df in raw.items()}, source=str(path))


def parse_plan(df: pd.DataFrame) -> pd.DataFrame:
    """Validate and type a production-order-shaped frame (e.g. the planning scenario)."""
    return _parse("fact_production_order", df.copy())


def read_plan_csv(path: str | Path) -> pd.DataFrame:
    """Read a production-order-shaped CSV (e.g. the planning scenario)."""
    return parse_plan(pd.read_csv(path))
