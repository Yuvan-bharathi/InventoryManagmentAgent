"""Daily stock report (.xlsx) for one run — replaces the plant's hand-made daily report.

Every sheet comes from stored engine output for that run_id; nothing is recalculated here.
"""
from __future__ import annotations

import io

import pandas as pd
from openpyxl.styles import Font, PatternFill
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.fmt import day, inr

STATUS_FILL = {"critical": "FDE7E6", "at_risk": "FFF2E8", "excess": "FBE9E2", "stale": "ECE9E6", "healthy": "F1ECE8"}


def _df(s: Session, model, *where, drop=("tenant_id",)) -> pd.DataFrame:
    rows = s.scalars(select(model).where(*where)).all()
    cols = [c.name for c in model.__table__.columns if c.name not in drop]
    return pd.DataFrame([{c: getattr(r, c) for c in cols} for r in rows], columns=cols)


def build(s: Session, tenant_id: str, run_id: int) -> bytes:
    run = s.get(m.CalculationRun, run_id)
    if run is None or run.tenant_id != tenant_id:
        raise ValueError("run not found")
    k = run.kpis
    st = _df(s, m.MaterialStatus, m.MaterialStatus.tenant_id == tenant_id, m.MaterialStatus.run_id == run_id,
             m.MaterialStatus.demand_source == run.config["demand_source"], drop=("tenant_id", "id", "inputs"))
    st["assumption_ids"] = st["assumption_ids"].apply(", ".join)
    sb = _df(s, m.StockBalance, m.StockBalance.tenant_id == tenant_id, drop=("tenant_id", "id", "upload_id"))
    pr = _df(s, m.Proposal, m.Proposal.tenant_id == tenant_id, drop=("tenant_id", "inputs"))
    if len(pr):
        pr["assumption_ids"] = pr["assumption_ids"].apply(", ".join)
        for c in ("created_at", "updated_at"):
            pr[c] = pr[c].astype(str)
    po = _df(s, m.PoSupplyLine, m.PoSupplyLine.tenant_id == tenant_id, m.PoSupplyLine.run_id == run_id,
             drop=("tenant_id", "id"))
    dq = _df(s, m.DQResultRow, m.DQResultRow.tenant_id == tenant_id, m.DQResultRow.upload_id == run.upload_id,
             drop=("tenant_id", "id", "sample"))
    asm = _df(s, m.Assumption, m.Assumption.tenant_id == tenant_id, drop=("tenant_id", "updated_at"))
    for c in ("default_value", "current_value"):
        asm[c] = asm[c].astype(str)

    summary = pd.DataFrame([
        ("Data as of", f"{day(run.as_of_date)} (refreshed, not live)"),
        ("Calculation run", run_id),
        ("Demand basis", "Planning scenario – replace with the organization's plan" if run.config["demand_source"] ==
         "scenario" else "Production orders"),
        ("Inventory health", f"{k['inventory_health_pct']}%"),
        ("Total on-hand value", inr(k["total_on_hand_value_inr"])),
        ("Usable value", inr(k["total_usable_value_inr"])),
        ("Excess value", inr(k["excess_value_inr"])),
        ("Expiring in 30 days", inr(k["expiring_30d_value_inr"])),
        ("Critical / at risk / excess / healthy / stale",
         " / ".join(str(k["status_counts"][x]) for x in ("critical", "at_risk", "excess", "healthy", "stale"))),
        ("Production orders at risk (14 days / horizon)",
         f"{k['production_orders_at_risk_14d']} / {k['production_orders_at_risk']}"),
        ("Overdue PO lines", f"{k['overdue_po_lines']} of {k['open_po_lines']}"),
        ("Data-quality issues", run.dq_summary.get("issues_found")),
    ], columns=["Item", "Value"])

    sheets = {"Summary": summary, "Status by material": st.sort_values(["status", "days_to_shortage"]),
              "Stock by location": sb, "Shortages": st[st["status"].isin(["critical", "at_risk"])]
              .sort_values("days_to_shortage"), "Proposals": pr, "Open PO lines": po, "Data quality": dq,
              "Assumptions": asm}
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as xw:
        for name, df in sheets.items():
            df.to_excel(xw, sheet_name=name, index=False)
            ws = xw.sheets[name]
            for c in ws[1]:
                c.font = Font(bold=True)
            if "status" in df.columns:
                ci = list(df.columns).index("status") + 1
                for row in ws.iter_rows(min_row=2, min_col=ci, max_col=ci):
                    for c in row:
                        if c.value in STATUS_FILL:
                            c.fill = PatternFill("solid", fgColor=STATUS_FILL[c.value])
            for col in ws.columns:
                ws.column_dimensions[col[0].column_letter].width = min(40, max(10, len(str(col[0].value)) + 2))
    return buf.getvalue()
