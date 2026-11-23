"""Process settings (from .env) and the engine configuration (from assumptions + policies).

The engine never reads constants from code: every threshold comes from an EngineConfig,
which is built from the `assumptions` / `inventory_policies` rows (seeded from backend/seed/*.json).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = REPO_ROOT / "backend" / "seed"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    database_url: str | None = None
    database_url_direct: str | None = None  # Neon direct (non-pooled) connection, used by Alembic
    # Tests only: a separate Neon branch. pytest and Playwright swap DATABASE_URL for these; never main.
    test_database_url: str | None = None
    test_database_url_direct: str | None = None
    domo_instance: str | None = None
    domo_developer_token: str | None = None
    domo_model_id: str | None = None
    domo_timeout_s: float = 20.0
    jwt_secret: str = "dev-only-insecure"
    jwt_ttl_hours: int = 12
    raw_data_path: Path = REPO_ROOT / "data" / "raw"
    scenario_path: Path = REPO_ROOT / "data" / "scenario" / "fact_production_order_plan.csv"


def get_settings() -> Settings:
    return Settings()


def load_seed_assumptions() -> list[dict[str, Any]]:
    return json.loads((SEED_DIR / "assumptions.json").read_text(encoding="utf-8"))


def load_seed_policies() -> dict[str, Any]:
    return json.loads((SEED_DIR / "policies.json").read_text(encoding="utf-8"))


@dataclass(frozen=True)
class EngineConfig:
    """All tunable inputs of the deterministic engine. Field -> assumption id in ASSUMPTION_OF."""

    tenant_id: str
    as_of_date: str  # "latest" or ISO date (A1)
    deductions_overlap: bool  # A3
    ss_source: str  # A5: "master" | "snapshot"
    production_warehouses: str | tuple[str, ...]  # A6: "all" or warehouse ids
    in_transit_days: int  # A7
    review_days: int  # A14
    max_factor: float  # A14
    demand_source: str  # A15: "scenario" | "production_orders"
    horizon_days: int
    staleness_days: int
    scenario_daily_units_per_plant: int
    snapshot_continuity_min_corr: float
    future_receipt_mode: str = "open_qty_only"  # A19: "open_qty_only" | "full_received_qty"
    lead_time_source: str = "max"  # A20: "actual" | "master" | "max"
    overdue_backlog: str = "as_of_plus_1"  # A21: "as_of_plus_1" | "exclude"
    manager_threshold_inr: float = 1_000_000.0  # policy: level-2 approval above this value

    def with_(self, **changes: Any) -> "EngineConfig":
        return replace(self, **changes)

    @classmethod
    def from_values(cls, assumptions: list[dict[str, Any]], policies: dict[str, Any]) -> "EngineConfig":
        vals: dict[str, Any] = {}
        for a in assumptions:
            vals.update(a.get("value") or {})
        wh = vals["production_warehouses"]
        return cls(
            tenant_id=policies["tenant_id"],
            as_of_date=vals["as_of_date"],
            deductions_overlap=bool(vals["deductions_overlap"]),
            ss_source=vals["ss_source"],
            production_warehouses=wh if wh == "all" else tuple(wh),
            in_transit_days=int(vals["in_transit_days"]),
            review_days=int(vals["review_days"]),
            max_factor=float(vals["max_factor"]),
            demand_source=vals["demand_source"],
            horizon_days=int(policies["horizon_days"]),
            staleness_days=int(policies["staleness_days"]),
            scenario_daily_units_per_plant=int(policies["scenario_daily_units_per_plant"]),
            snapshot_continuity_min_corr=float(policies["snapshot_continuity_min_corr"]),
            future_receipt_mode=vals["future_receipt_mode"],
            lead_time_source=vals["lead_time_source"],
            overdue_backlog=vals.get("overdue_backlog", "as_of_plus_1"),
            manager_threshold_inr=float(policies["manager_approval_threshold_inr"]),
        )

    @classmethod
    def from_seed(cls) -> "EngineConfig":
        return cls.from_values(load_seed_assumptions(), load_seed_policies())


# Which assumption each config field belongs to, so results can list the assumption ids they used.
ASSUMPTION_OF = {
    "as_of_date": "A1",
    "deductions_overlap": "A3",
    "ss_source": "A5",
    "production_warehouses": "A6",
    "in_transit_days": "A7",
    "review_days": "A14",
    "max_factor": "A14",
    "demand_source": "A15",
    "future_receipt_mode": "A19",
    "lead_time_source": "A20",
    "overdue_backlog": "A21",
}
