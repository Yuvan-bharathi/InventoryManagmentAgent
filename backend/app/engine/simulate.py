"""Supplier-delay simulation ("if a supplier is late, what breaks?") — pure, deterministic.

Delaying a supplier by D days moves each of its expected open PO receipts from day e to e + D. The projection
loses that quantity on days [e, e + D) (or for the rest of the horizon if e + D falls outside it).
New shortage dates and statuses use the same rules as the engine: below SS within LT = critical, later = at risk.
"""
from __future__ import annotations

import pandas as pd

KEY = ["material_id", "plant_id"]


def simulate_supplier_delay(daily: pd.DataFrame, status: pd.DataFrame, po_lines: pd.DataFrame, supplier_id: str,
                            delay_days: int, as_of) -> pd.DataFrame:
    """Return one row per affected material x plant: baseline vs delayed shortage and stock-out dates.

    daily: material_id, plant_id, date, projected_qty, ss_qty
    status: material_id, plant_id, status, lt_days, shortage_date, stockout_date, has_demand_basis
    po_lines: supplier_id, material_id, plant_id, open_qty, expected_date
    """
    as_of = pd.Timestamp(as_of)
    lines = po_lines[po_lines["supplier_id"] == supplier_id]
    cols = ["material_id", "plant_id", "delayed_qty", "lines", "baseline_status", "new_status",
            "baseline_shortage_date", "new_shortage_date", "baseline_stockout_date", "new_stockout_date",
            "lt_days", "min_projected_before", "min_projected_after"]
    if lines.empty:
        return pd.DataFrame(columns=cols)
    d = daily.copy()
    d["date"] = pd.to_datetime(d["date"])
    # expand each delayed line into the days its quantity is missing: [expected, expected + delay)
    ex = lines[KEY + ["open_qty", "expected_date"]].copy()
    ex["expected_date"] = pd.to_datetime(ex["expected_date"])
    ex = ex.loc[ex.index.repeat(delay_days)]
    ex["date"] = ex["expected_date"] + pd.to_timedelta(ex.groupby(level=0).cumcount(), unit="D")
    loss = ex.groupby(KEY + ["date"])["open_qty"].sum().rename("loss").reset_index()
    d = d.merge(loss, on=KEY + ["date"], how="left").fillna({"loss": 0.0})
    d["new_qty"] = d["projected_qty"] - d["loss"]
    affected = lines.groupby(KEY).agg(delayed_qty=("open_qty", "sum"), lines=("open_qty", "size")).reset_index()
    out = []
    st = status.set_index(KEY)
    for a in affected.itertuples():
        if (a.material_id, a.plant_id) not in st.index:
            continue
        s = st.loc[(a.material_id, a.plant_id)]
        if not bool(s["has_demand_basis"]):
            continue
        g = d[(d["material_id"] == a.material_id) & (d["plant_id"] == a.plant_id)].sort_values("date")
        below = g[g["new_qty"] < g["ss_qty"]]
        new_short = below["date"].min() if len(below) else pd.NaT
        neg = g[g["new_qty"] < 0]
        new_so = neg["date"].min() if len(neg) else pd.NaT
        lt = int(s["lt_days"])
        if pd.isna(new_short):
            new_status = s["status"] if s["status"] in ("excess", "healthy") else "healthy"
        else:
            new_status = "critical" if (new_short - as_of).days <= lt else "at_risk"
        out.append({"material_id": a.material_id, "plant_id": a.plant_id, "delayed_qty": float(a.delayed_qty),
                    "lines": int(a.lines), "baseline_status": s["status"], "new_status": new_status,
                    "baseline_shortage_date": s["shortage_date"], "new_shortage_date": new_short,
                    "baseline_stockout_date": s["stockout_date"], "new_stockout_date": new_so, "lt_days": lt,
                    "min_projected_before": float(g["projected_qty"].min()),
                    "min_projected_after": float(g["new_qty"].min())})
    return pd.DataFrame(out, columns=cols)
