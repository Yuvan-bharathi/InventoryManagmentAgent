"""BOM, planning scenario (A15), projection, status, A14 and A17."""
import pandas as pd

from app.engine import demand, projection
from app.engine.run import run_engine
from conftest import AS_OF, pair
from app.ingest.reader import parse_plan
from seed import planning_scenario


def test_effective_bom_includes_scrap(ds):
    b = demand.effective_bom(ds["fact_bom_component"], AS_OF).set_index(["product_id", "material_id"])["qty_per"]
    assert abs(b[("SPH-A15-128", "MAT-SOC-001")] - 1.005) < 1e-12
    assert abs(b[("SPH-A15-128", "MAT-BOX-014")] - 1.001) < 1e-12


def test_scenario_volume_horizon_schema(ds, cfg, scenario):
    assert list(scenario.columns) == list(ds["fact_production_order"].columns)
    assert (scenario["order_status"] == "PLANNED").all()
    per_day = scenario.groupby(["plant_id", "planned_start"])["order_qty"].sum()
    assert (per_day == cfg.scenario_daily_units_per_plant).all()
    assert per_day.index.get_level_values(1).nunique() == cfg.horizon_days


def test_scenario_is_deterministic_and_follows_history_mix(ds, cfg, scenario):
    assert scenario.equals(parse_plan(planning_scenario.generate(ds, cfg)))
    mix = planning_scenario.product_mix(ds["fact_production_order"]).set_index(["plant_id", "product_id"])["share"]
    sc = scenario.groupby(["plant_id", "product_id"])["order_qty"].sum()
    sc = sc / sc.groupby(level=0).transform("sum")
    assert ((sc - mix).abs() < 0.005).all()


def test_projection_hand_case(cfg):
    """usable 100, SS 50, in-transit +20 on day 3, PO +30 on day 5, demand 20/day for 10 days, LT 4.
    Projected: d1 80, d2 60, d3 60, d4 40 (< SS) -> shortage day 4 <= LT -> critical.
    Max (A14) = 50 + 20 x (4 + 7) x 1.5 = 380."""
    c = cfg.with_(horizon_days=10)
    pos = pd.DataFrame({"material_id": ["M"], "plant_id": ["P"], "usable_qty": [100.0], "ss_qty": [50.0]})
    d = lambda n: AS_OF + pd.Timedelta(days=n)  # noqa: E731
    transit = pd.DataFrame({"material_id": ["M"], "plant_id": ["P"], "date": [d(3)], "qty": [20.0]})
    po = pd.DataFrame({"material_id": ["M"], "plant_id": ["P"], "expected_date": [d(5)], "open_qty": [30.0]})
    reqs = pd.DataFrame({"material_id": "M", "plant_id": "P", "date": [d(i) for i in range(1, 11)], "qty": 20.0})
    lt = pd.DataFrame({"material_id": ["M"], "lt_days": [4], "lt_source": ["master"], "supplier_id": ["S"],
                       "supplier_assigned": [True]})
    daily, s = projection.project(pos, transit, po, reqs, lt, {"M"}, AS_OF, c)
    assert list(daily["projected_qty"][:5]) == [80, 60, 60, 40, 50]
    row = s.iloc[0]
    assert row["shortage_date"] == d(4) and row["days_to_shortage"] == 4 and row["status"] == "critical"
    assert row["max_qty"] == 380


def test_real_shortage_hand_check(result):
    """MAT-BOX-014 @ IN-TN-01: usable 2540 < SS 3317 already, so shortage on day 1."""
    r = pair(result.summary, "MAT-BOX-014", "IN-TN-01")
    assert r["usable_qty"] == 2540 and r["ss_qty"] == 3317
    assert r["days_to_shortage"] == 1 and r["status"] == "critical"


def test_consumables_have_no_demand_basis(result):
    s = result.summary
    cons = s[s.material_id.isin(["MAT-PASTE-017", "MAT-ADH-018"])]
    assert (cons["status"] == "stale").all() and cons["shortage_date"].isna().all()
    assert all("A17" in ids for ids in cons["assumption_ids"])


def test_every_status_present_on_real_data(result):
    counts = result.kpis["status_counts"]
    for st in ("critical", "at_risk", "excess", "healthy", "stale"):
        assert counts[st] >= 1, st


def _window_case(cfg, usable, demand_per_day, lt=4):
    """One pair, SS 50, no supply; horizon 20; window = LT 4 + review 7 = 11 days."""
    c = cfg.with_(horizon_days=20)
    d = lambda n: AS_OF + pd.Timedelta(days=n)  # noqa: E731
    pos = pd.DataFrame({"material_id": ["M"], "plant_id": ["P"], "usable_qty": [float(usable)], "ss_qty": [50.0]})
    empty = pd.DataFrame({"material_id": [], "plant_id": [], "date": pd.to_datetime([]), "qty": []})
    po = pd.DataFrame({"material_id": [], "plant_id": [], "expected_date": pd.to_datetime([]), "open_qty": []})
    reqs = pd.DataFrame({"material_id": "M", "plant_id": "P", "date": [d(i) for i in range(1, 21)],
                         "qty": float(demand_per_day)})
    lt_df = pd.DataFrame({"material_id": ["M"], "lt_days": [lt], "lt_source": ["master"], "supplier_id": ["S"],
                          "supplier_assigned": [True]})
    return projection.project(pos, empty, po, reqs, lt_df, {"M"}, AS_OF, c)[1].iloc[0]


def test_excess_needs_whole_window_above_max(cfg):
    # demand 1/day -> max = 50 + 1 x 11 x 1.5 = 66.5; usable 1000 stays above it for all 11 days
    assert _window_case(cfg, 1000, 1)["status"] == "excess"
    # usable 70: day 1 = 69 > 66.5 but day 4 = 66 < max -> not the whole window, no shortage -> healthy
    r = _window_case(cfg, 70, 1)
    assert r["status"] == "healthy" and not r["window_in_band"]


def test_healthy_within_band_and_at_risk_after_lt(cfg):
    # demand 10/day: max = 50 + 10 x 11 x 1.5 = 215. usable 210 -> d11 = 100, d16 = 50, d17 = 40 < SS (day 17 > LT)
    r = _window_case(cfg, 210, 10)
    assert r["window_in_band"] and r["days_to_shortage"] == 17 and r["status"] == "at_risk"
    # usable 400 with demand 10/day for 20 days: d20 = 200 >= SS, d1 = 390 > max, d11 = 290 > max -> excess
    assert _window_case(cfg, 400, 10)["status"] == "excess"


def test_health_pct_is_share_of_healthy_status(result):
    s = result.summary[result.summary["has_demand_basis"]]
    assert result.kpis["inventory_health_pct"] == round(100 * (s["status"] == "healthy").mean(), 1)


def test_results_list_assumptions_and_demand_source(result):
    assert (result.summary["demand_source"] == "scenario").all()
    assert all({"A1", "A3", "A15"} <= set(ids) for ids in result.summary["assumption_ids"])


def test_a14_max_factor_changes_result(ds, cfg, scenario, result):
    other = run_engine(ds, cfg.with_(max_factor=3.0), scenario)
    assert (other.summary["max_qty"] > result.summary["max_qty"]).any()
    assert other.kpis["status_counts"]["excess"] < result.kpis["status_counts"]["excess"]


def test_a15_demand_source_switch_without_code_change(ds, cfg, scenario):
    po_based = run_engine(ds, cfg.with_(demand_source="production_orders"), scenario)
    assert (po_based.summary["demand_source"] == "production_orders").all()
    assert all("A15" not in ids and "A21" in ids for ids in po_based.summary["assumption_ids"])
    # A21: every open order is dated before as-of, so all demand is overdue backlog on as-of + 1.
    assert set(po_based.requirements["date"]) == {AS_OF + pd.Timedelta(days=1)}
    assert po_based.kpis["backlog_orders"] == 206


def test_a21_backlog_hand_case_from_real_rows(ds, cfg):
    """One real open order moves to as-of + 1 with its full qty; closed and completed orders never count."""
    po = ds["fact_production_order"]
    c = cfg.with_(demand_source="production_orders")
    plan = demand.demand_plan(po, None, AS_OF, c)
    open_ = po[po["order_status"].isin(["RELEASED", "IN_PROGRESS"])]
    assert len(plan) == len(open_) == 206 and plan["backlog"].all()
    first = open_.sort_values("production_order_id").iloc[0]
    row = plan.set_index("production_order_id").loc[first["production_order_id"]]
    assert row["planned_start"] == AS_OF + pd.Timedelta(days=1)
    assert row["order_qty"] == first["order_qty"]
    done = set(po.loc[po["order_status"].isin(["CLOSED", "COMPLETED"]), "production_order_id"])
    assert not done & set(plan["production_order_id"])
    # Requirement for one pair = sum of that plant's open order qty x BOM qty per (with scrap).
    bom = demand.effective_bom(ds["fact_bom_component"], AS_OF)
    reqs = demand.requirements(plan, bom)
    mat = "MAT-SOC-001"
    per = bom[bom["material_id"] == mat].set_index("product_id")["qty_per"]
    o = open_[(open_["plant_id"] == "IN-TN-01") & open_["product_id"].isin(per.index)]
    expected = float((o["order_qty"] * o["product_id"].map(per)).sum())
    got = reqs[(reqs["material_id"] == mat) & (reqs["plant_id"] == "IN-TN-01")]["qty"].sum()
    assert abs(got - expected) < 1e-6


def test_a21_switch_changes_result(ds, cfg):
    base = cfg.with_(demand_source="production_orders")
    backlog = run_engine(ds, base, None)
    future_only = run_engine(ds, base.with_(overdue_backlog="exclude"), None)
    assert future_only.requirements.empty  # no open order is planned after as-of
    assert all("A21" not in ids for ids in future_only.summary["assumption_ids"])
    assert backlog.kpis["status_counts"] != future_only.kpis["status_counts"]
    assert backlog.kpis["status_counts"]["critical"] == backlog.kpis["pairs_with_demand"] == 32


def test_demand_kpis_hand_case():
    from app.engine.kpis import demand_kpis
    df = pd.DataFrame({
        "has_demand_basis": [True, True, True, False],
        "status": ["critical", "healthy", "at_risk", "stale"],
        "usable_qty": [100.0, 400.0, 0.0, 50.0], "usable_value_inr": [1000.0, 2000.0, 0.0, 99.0],
        "daily_demand_qty": [10.0, 5.0, 2.0, 0.0], "demand_horizon_qty": [600.0, 300.0, 120.0, 0.0],
        "standard_price_inr": [10.0, 5.0, 20.0, 1.0],
        "days_to_stockout": [5, None, 1, None], "lt_days": [10, 10, 0, 10],
    })
    k = demand_kpis(df)
    # usable INR 3000 / daily demand INR (100 + 25 + 40) = 18.18 days
    assert k["days_of_inventory"] == 18.2
    assert k["stockout_risk_pairs"] == 1          # only the first: stock-out day 5 <= lead time 10
    assert (k["short_pairs"], k["pairs_with_demand"]) == (2, 3)
    assert k["demand_multiple"] == {"min": 0.8, "median": 3.4, "max": 6.0, "pairs": 2, "zero_stock_pairs": 1}