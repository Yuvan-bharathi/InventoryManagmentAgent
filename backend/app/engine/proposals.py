"""Replenishment and transfer proposals (pure; nothing is executed — every proposal goes to approval).

Per destination material x plant with status critical / at risk:
  target       = min(SS + daily demand x (LT + review), max)                      (CLAUDE.md)
  gap          = target - projected stock on the arrival date (as-of + LT), floored at 0
  transfer     = checked first, from a plant whose projection never drops below its own SS in the
                 horizon (D11): transferable = min(usable - own need over LT - SS,
                                                   min over horizon of (projected - SS))
                 so the source never gets a shortage; qty = min(transferable, gap)
  purchase raw = gap - transfer; final = max(raw, MOQ) rounded up (D12); supplier = rank 1 (D5)
  value        = qty x standard_price_inr (A12); approval level 2 above the manager threshold.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from app.config import EngineConfig

KEY = ["material_id", "plant_id"]
ACTION_STATUSES = ("critical", "at_risk")
SOURCE_STATUSES = ("healthy", "excess")


def _proj_on(daily_idx: pd.Series, mat: str, plant: str, day: pd.Timestamp, last: pd.Timestamp) -> float:
    return float(daily_idx.loc[(mat, plant, min(day, last))])


def transferable_qty(src_row: pd.Series, src_daily: pd.DataFrame, src_need_lt: float) -> tuple[float, dict]:
    """Quantity a source plant can give without ever going below its own SS in the horizon."""
    by_formula = src_row["usable_qty"] - src_need_lt - src_row["ss_qty"]
    by_projection = float((src_daily["projected_qty"] - src_row["ss_qty"]).min())
    qty = max(0.0, math.floor(min(by_formula, by_projection)))
    return qty, {"source_usable_qty": float(src_row["usable_qty"]), "source_need_over_lt_qty": float(src_need_lt),
                 "source_ss_qty": float(src_row["ss_qty"]), "surplus_by_formula_qty": float(by_formula),
                 "headroom_over_horizon_qty": by_projection, "transferable_qty": qty}


def build_proposals(res, cfg: EngineConfig) -> pd.DataFrame:
    s = res.summary.set_index(KEY)
    daily = res.daily
    daily_idx = daily.set_index(KEY + ["date"])["projected_qty"]
    last_day = daily["date"].max()
    as_of = res.as_of
    reqs = res.requirements
    ranked = res.ranked_suppliers
    position = res.position.set_index(KEY)

    dest = res.summary[res.summary["status"].isin(ACTION_STATUSES)].sort_values(["shortage_date", "material_id", "plant_id"])
    used_from_source: dict[tuple[str, str], float] = {}
    out: list[dict] = []

    for _, r in dest.iterrows():
        mat, plant = r["material_id"], r["plant_id"]
        lt, d, ss, mx = int(r["lt_days"]), float(r["daily_demand_qty"]), float(r["ss_qty"]), float(r["max_qty"])
        target = min(ss + d * (lt + cfg.review_days), mx)
        arrival = as_of + pd.Timedelta(days=lt)
        proj_arrival = _proj_on(daily_idx, mat, plant, arrival, last_day)
        gap = max(0.0, target - proj_arrival)
        if gap <= 0:
            continue
        price = float(position.loc[(mat, plant), "standard_price_inr"])
        uom = position.loc[(mat, plant), "uom"]
        moq = float(position.loc[(mat, plant), "moq"])
        shortage = r["shortage_date"]
        common = {"material_id": mat, "plant_id": plant, "uom": uom, "unit_price_inr": price,
                  "shortage_date": shortage, "needed_by": shortage,
                  "assumption_ids": sorted(set(r["assumption_ids"]) | {"A12"}, key=lambda x: int(x[1:]))}
        base_inputs = {
            "status": r["status"], "daily_demand_qty": d, "safety_stock_qty": ss, "max_qty": mx,
            "lead_time_days": lt, "lead_time_source": r["lt_source"], "review_days": cfg.review_days,
            "target_qty": target, "arrival_date": arrival.date().isoformat(),
            "projected_at_arrival_qty": proj_arrival, "gap_qty": gap, "usable_qty": float(r["usable_qty"]),
            "shortage_date": shortage.date().isoformat() if pd.notna(shortage) else None,
            "days_to_shortage": None if pd.isna(r["days_to_shortage"]) else int(r["days_to_shortage"]),
            "horizon_days": cfg.horizon_days, "demand_source": cfg.demand_source, "moq_qty": moq,
            "manager_threshold_inr": cfg.manager_threshold_inr,
        }

        # 1) transfer before purchase
        transfer_qty, transfer_inputs = 0.0, None
        for src_plant in sorted(set(s.loc[mat].index) - {plant}):
            src = s.loc[(mat, src_plant)]
            if src["status"] not in SOURCE_STATUSES:
                continue
            src_daily = daily[(daily.material_id == mat) & (daily.plant_id == src_plant)]
            need_lt = float(reqs[(reqs.material_id == mat) & (reqs.plant_id == src_plant)
                                 & (reqs.date <= as_of + pd.Timedelta(days=lt))]["qty"].sum())
            avail, tin = transferable_qty(src, src_daily, need_lt)
            avail -= used_from_source.get((mat, src_plant), 0.0)
            qty = math.floor(min(max(avail, 0.0), gap))
            if qty > 0:
                used_from_source[(mat, src_plant)] = used_from_source.get((mat, src_plant), 0.0) + qty
                transfer_qty = qty
                arr_t = as_of + pd.Timedelta(days=cfg.in_transit_days)
                transfer_inputs = tin | {"source_plant_id": src_plant, "transfer_qty": qty,
                                         "already_allocated_from_source_qty": used_from_source[(mat, src_plant)] - qty,
                                         "source_status": src["status"]}
                value = qty * price
                out.append(common | {
                    "kind": "transfer", "supplier_id": None, "source_plant_id": src_plant, "qty": qty,
                    "value_inr": value, "arrival_date": arr_t, "order_by": as_of + pd.Timedelta(days=1),
                    "in_time": "yes" if pd.isna(shortage) or arr_t <= shortage else "expedite",
                    "approval_level": 2 if value > cfg.manager_threshold_inr else 1,
                    "inputs": base_inputs | {"transfer": transfer_inputs, "transfer_arrival_days": cfg.in_transit_days},
                    "assumption_ids": sorted(set(common["assumption_ids"]) | {"A7"}, key=lambda x: int(x[1:])),
                })
                break

        # 2) purchase the remainder
        raw = max(0.0, gap - transfer_qty)
        if raw <= 0:
            continue
        final = float(math.ceil(max(raw, moq)))
        cand = ranked[ranked.material_id == mat].head(3)
        sup = cand.iloc[0] if len(cand) else None
        value = final * price
        order_by = max(as_of + pd.Timedelta(days=1), (shortage - pd.Timedelta(days=lt)) if pd.notna(shortage) else arrival)
        out.append(common | {
            "kind": "purchase", "supplier_id": None if sup is None else sup["supplier_id"], "source_plant_id": None,
            "qty": final, "value_inr": value, "arrival_date": arrival, "order_by": order_by,
            "in_time": "no" if sup is None else ("yes" if pd.isna(shortage) or arrival <= shortage else "expedite"),
            "approval_level": 2 if value > cfg.manager_threshold_inr else 1,
            "inputs": base_inputs | {
                "transfer_qty": transfer_qty, "raw_qty": raw, "moq_applied": moq > raw, "final_qty": final,
                "supplier_to_be_assigned": sup is None,
                "supplier_candidates": [] if sup is None else [
                    {"supplier_id": c["supplier_id"], "rank": int(c["rank"]),
                     "on_time_pct": None if pd.isna(c["on_time_pct"]) else round(float(c["on_time_pct"]), 3),
                     "on_time_basis": c["on_time_basis"],
                     "actual_lt_days": None if pd.isna(c["actual_lt_days"]) else round(float(c["actual_lt_days"]), 1),
                     "standard_lt_days": int(c["standard_lead_time_days"]),
                     "receipts": None if pd.isna(c["receipts"]) else int(c["receipts"])} for _, c in cand.iterrows()],
            },
        })

    cols = ["kind", "material_id", "plant_id", "supplier_id", "source_plant_id", "qty", "uom", "unit_price_inr",
            "value_inr", "order_by", "needed_by", "arrival_date", "shortage_date", "in_time", "approval_level",
            "inputs", "assumption_ids"]
    return pd.DataFrame(out, columns=cols)
