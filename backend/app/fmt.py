"""Display formats from the UI spec: ₹ with lakh / crore, dates as 11-Nov-2026."""
from __future__ import annotations

from datetime import date, datetime


def inr(v: float | None) -> str:
    if v is None:
        return "—"
    a = abs(v)
    sign = "-" if v < 0 else ""
    if a >= 1e7:
        return f"{sign}₹{a / 1e7:.2f} Cr"
    if a >= 1e5:
        return f"{sign}₹{a / 1e5:.2f} lakh"
    s = f"{int(round(a))}"
    if len(s) > 3:  # Indian grouping: 12,34,567
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts) + "," + tail
    return f"{sign}₹{s}"


def pct(v: float | None) -> str:
    if v is None:
        return "—"
    return f"{v:.1f}%"


def day(d: date | datetime | str | None) -> str:
    if d is None:
        return "—"
    if isinstance(d, str):
        d = date.fromisoformat(d[:10])
    return d.strftime("%d-%b-%Y")
