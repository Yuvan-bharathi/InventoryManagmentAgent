"""Day 1 command line.

  python -m app.cli report [path]   DQ gate + engine on a ZIP/folder, printed; no database needed
  python -m app.cli load   [path]   same, then load everything into Postgres (DATABASE_URL in .env)
  python -m app.cli seed            demo users (one per role) + the small isolation tenant TEN-02
  python -m app.cli reset-proposals demo reset: delete ORG-01 proposals + approval logs (next upload regenerates)

`path` defaults to data/raw. The planning scenario is (re)generated before each run.
"""
from __future__ import annotations

import sys
from datetime import date

import pandas as pd

from app.config import EngineConfig, get_settings
from app.pipeline import calculate, ingest

STATUS_LABEL = {"critical": "Critical", "at_risk": "At risk", "excess": "Excess", "healthy": "Healthy",
                "stale": "Stale / unknown"}


def _print(dq, res) -> None:
    age = (pd.Timestamp(date.today()) - res.as_of).days
    print(f"Data as of {res.as_of:%d-%b-%Y} · {age} days old (refreshed, not live)")
    fired = [d for d in dq if d.fired]
    print(f"\n{len(fired)} issues found in the dataset before any calculation:")
    for d in dq:
        mark = "!" if d.fired else " "
        print(f" {mark} [{d.severity:7}] {d.name:22} {d.message}" + (f"  ({d.assumption_id})" if d.assumption_id else ""))
    k = res.kpis
    print(f"\nInventory Health: {k['inventory_health_pct']}%   "
          f"Usable stock value: ₹{k['total_usable_value_inr'] / 1e7:.2f} Cr   "
          f"Demand: {'Planning scenario – replace with the organization’s plan' if k['demand_source'] == 'scenario' else 'production orders'}")
    print("Status: " + ", ".join(f"{STATUS_LABEL[s]} {n}" for s, n in k["status_counts"].items()))
    rank = {s: i for i, s in enumerate(STATUS_LABEL)}
    sh = res.summary.assign(_r=res.summary["status"].map(rank)) \
        .sort_values(["_r", "shortage_date", "material_id"], na_position="last")
    print("\nShortage horizon (material x plant):")
    for r in sh.itertuples():
        when = f"{r.shortage_date:%d-%b} (day {int(r.days_to_shortage)}, LT {r.lt_days}d)" if pd.notna(r.shortage_date) else "—"
        print(f"  {STATUS_LABEL[r.status]:15} {r.material_id:14} {r.plant_id}  usable {r.usable_qty:>8,.0f} {r.uom:<3} "
              f"SS {r.ss_qty:>6,.0f}  shortage {when}  [{', '.join(r.assumption_ids)}]")


def main(argv: list[str]) -> int:
    if sys.platform == "win32":
        try:
            if hasattr(sys.stdout, "reconfigure"):
                sys.stdout.reconfigure(encoding="utf-8")
            if hasattr(sys.stderr, "reconfigure"):
                sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    if not argv or argv[0] not in ("report", "load", "seed", "reset-proposals"):
        print(__doc__)
        return 2
    path = argv[1] if len(argv) > 1 else str(get_settings().raw_data_path)

    if argv[0] == "report":
        calc = calculate(path, EngineConfig.from_seed())
        _print(calc.dq, calc.res)
        return 0

    import app.services  # noqa: F401  registers post-run hooks (proposals, brief)
    from app.auth import seed_roles_and_users
    from app.db import get_sessionmaker

    if argv[0] == "reset-proposals":
        from sqlalchemy import delete
        from app import models as m
        t = EngineConfig.from_seed().tenant_id
        with get_sessionmaker()() as s, s.begin():
            s.execute(delete(m.ApprovalLog).where(m.ApprovalLog.tenant_id == t))
            n = s.execute(delete(m.Proposal).where(m.Proposal.tenant_id == t)).rowcount
        print(f"Deleted {n} proposals for {t}.")
        return 0

    if argv[0] == "seed":
        from seed.tenant_fixture import load_second_tenant
        with get_sessionmaker()() as s, s.begin():
            seed_roles_and_users(s, EngineConfig.from_seed().tenant_id)
        run_id = load_second_tenant()
        print(f"Seeded demo users (password 'demo') and tenant TEN-02 (run {run_id}).")
        return 0

    tenant = EngineConfig.from_seed().tenant_id
    with get_sessionmaker()() as s, s.begin():
        run_id, calc = ingest(s, path, tenant, uploaded_by="cli")
        seed_roles_and_users(s, tenant)
    _print(calc.dq, calc.res)
    print(f"\nLoaded into Postgres as tenant {tenant}, run_id {run_id}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
