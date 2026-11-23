"""Open purchase-order supply, supplier delay, supplier choice and lead times (A8-A11, A18-A20)."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

OPEN_STATUSES = ("OPEN", "PARTIAL")


def past_receipts(po: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    """A9: rows with receipt_date <= as-of are actual receipts (one receipt per line)."""
    r = po.loc[po["receipt_date"].notna() & (po["receipt_date"] <= as_of)].copy()
    r["actual_lt_days"] = (r["receipt_date"] - r["po_date"]).dt.days
    r["promised_lt_days"] = (r["promised_date"] - r["po_date"]).dt.days
    r["delay_days"] = (r["receipt_date"] - r["promised_date"]).dt.days
    r["on_time"] = r["receipt_date"] <= r["promised_date"]
    return r


def supplier_avg_delay(po: pd.DataFrame, as_of: pd.Timestamp) -> pd.Series:
    """Average delay per supplier over past receipts, rounded up, at least 1 day (A10)."""
    d = past_receipts(po, as_of).groupby("supplier_id")["delay_days"].mean()
    return d.apply(lambda x: max(1, math.ceil(x)))


LINE_COLS = ["po_id", "po_line", "supplier_id", "material_id", "plant_id", "po_date", "promised_date",
             "receipt_date", "po_status", "ordered_qty", "received_qty", "open_qty", "expected_date",
             "date_basis", "overdue", "days_overdue", "unit_price_inr"]


def open_po_lines(po: pd.DataFrame, as_of: pd.Timestamp, delays: pd.Series,
                  future_receipt_mode: str = "open_qty_only") -> pd.DataFrame:
    """Expected supply per PO line with its date and the rule that set it.

    A8: open qty = ordered - received for OPEN / PARTIAL; CLOSED lines owe nothing more.
    A9: a receipt_date after as-of is the expected date of the open quantity.
    A10: otherwise the promised date; if that has passed, as-of + supplier average delay.
    A19: in full_received_qty mode, received_qty on lines with receipt_date after as-of is also
         expected on that date (one extra supply row per such line, any status).
    """
    o = po.loc[po["po_status"].isin(OPEN_STATUSES)].copy()
    o["open_qty"] = o["ordered_qty"] - o["received_qty"]
    o = o[o["open_qty"] > 0]
    future_receipt = o["receipt_date"].notna() & (o["receipt_date"] > as_of)
    promised_future = o["promised_date"] > as_of
    delay = o["supplier_id"].map(delays).fillna(1).astype(int)
    overdue_date = as_of + pd.to_timedelta(delay, unit="D")
    o["expected_date"] = o["promised_date"].where(promised_future, overdue_date)
    o.loc[future_receipt, "expected_date"] = o.loc[future_receipt, "receipt_date"]
    o["date_basis"] = "promised_date"
    o.loc[~promised_future, "date_basis"] = "overdue: as-of + supplier avg delay (A10)"
    o.loc[future_receipt, "date_basis"] = "future receipt_date (A9)"
    o["overdue"] = ~promised_future & ~future_receipt
    o["days_overdue"] = ((as_of - o["promised_date"]).dt.days).where(o["overdue"], 0)
    out = o[LINE_COLS]
    if future_receipt_mode == "full_received_qty":
        f = po.loc[po["receipt_date"].notna() & (po["receipt_date"] > as_of)].copy()
        f["open_qty"] = f["received_qty"]
        f["expected_date"] = f["receipt_date"]
        f["date_basis"] = "future received_qty (A19)"
        f["overdue"] = False
        f["days_overdue"] = 0
        out = pd.concat([out, f[LINE_COLS]], ignore_index=True)
    elif future_receipt_mode != "open_qty_only":
        raise ValueError(f"Unknown future_receipt_mode: {future_receipt_mode}")
    return out.reset_index(drop=True)


def uncounted_future_receipts(po: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    """received_qty on lines dated after as-of (not counted in open_qty_only mode), per material."""
    f = po.loc[po["receipt_date"].notna() & (po["receipt_date"] > as_of)]
    return f.groupby("material_id").agg(lines=("po_id", "size"), qty=("received_qty", "sum"),
                                        value_inr=("received_qty", lambda q: float((q * f.loc[q.index, "unit_price_inr"]).sum()))
                                        ).reset_index()


def supplier_stats(po: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    """A18: actual lead time and on-time % per supplier x material from past receipts."""
    r = past_receipts(po, as_of)
    return r.groupby(["supplier_id", "material_id"]).agg(
        actual_lt_days=("actual_lt_days", "mean"),
        promised_lt_days=("promised_lt_days", "mean"),
        on_time_pct=("on_time", "mean"),
        receipts=("po_id", "size"),
    ).reset_index()


# Kept for callers that only need lead times.
actual_lead_times = supplier_stats


def approved_vendors(materials: pd.DataFrame, suppliers: pd.DataFrame) -> pd.DataFrame:
    """A11: approved vendor = APPROVED supplier whose material_category matches the material's."""
    s = suppliers.loc[suppliers["approved_status"].eq("APPROVED"),
                      ["supplier_id", "material_category", "standard_lead_time_days", "risk_tier"]]
    return materials[["material_id", "material_category"]].merge(s, on="material_category", how="inner")


def rank_suppliers(materials: pd.DataFrame, suppliers: pd.DataFrame, stats: pd.DataFrame,
                   po: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    """Approved vendors per material, ranked: best on-time % -> shortest lead time -> supplier id.

    On-time % and lead time are per supplier x material; where a supplier has no receipts for the
    material, its overall on-time % and its standard lead time are used.
    """
    av = approved_vendors(materials, suppliers).merge(stats, on=["supplier_id", "material_id"], how="left")
    overall = past_receipts(po, as_of).groupby("supplier_id")["on_time"].mean()
    av["on_time_basis"] = np.where(av["on_time_pct"].notna(), "supplier x material", "supplier overall")
    av["on_time_pct"] = av["on_time_pct"].fillna(av["supplier_id"].map(overall))
    av["rank_lt_days"] = av["actual_lt_days"].fillna(av["standard_lead_time_days"])
    av = av.sort_values(["material_id", "on_time_pct", "rank_lt_days", "supplier_id"],
                        ascending=[True, False, True, True], na_position="last")
    av["rank"] = av.groupby("material_id").cumcount() + 1
    return av.reset_index(drop=True)


def material_lead_times(materials: pd.DataFrame, ranked: pd.DataFrame, lead_time_source: str) -> pd.DataFrame:
    """Planning lead time per material from the supplier a proposal would pick (rank 1).

    A20 lead_time_source: actual = chosen supplier's actual LT (master if unknown); master = material master;
    max = the larger of the two. No approved supplier (A11): master LT, supplier to be assigned.
    """
    best = ranked[ranked["rank"] == 1][["material_id", "supplier_id", "actual_lt_days", "on_time_pct", "receipts"]]
    out = materials[["material_id", "lead_time_days"]].merge(best, on="material_id", how="left")
    master = out["lead_time_days"].astype(int)
    actual = out["actual_lt_days"].apply(lambda x: math.ceil(x) if pd.notna(x) else np.nan)
    if lead_time_source == "actual":
        lt, src = actual.fillna(master), np.where(actual.notna(), "actual", "master")
    elif lead_time_source == "master":
        lt, src = master, np.full(len(out), "master")
    elif lead_time_source == "max":
        use_actual = actual.notna() & (actual > master)
        lt, src = np.where(use_actual, actual, master), np.where(use_actual, "actual", "master")
    else:
        raise ValueError(f"Unknown lead_time_source: {lead_time_source}")
    out["lt_days"] = pd.Series(lt).astype(int).values
    out["lt_source"] = src
    out["supplier_assigned"] = out["supplier_id"].notna()
    return out[["material_id", "lt_days", "lt_source", "supplier_id", "supplier_assigned", "actual_lt_days",
                "lead_time_days", "on_time_pct", "receipts"]].rename(
        columns={"lead_time_days": "master_lt_days", "receipts": "lt_receipts"})
