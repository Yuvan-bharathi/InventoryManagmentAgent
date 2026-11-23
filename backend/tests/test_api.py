"""API tests against the live database (Neon), in a dedicated test tenant TST-01 so demo data is untouched.

Covers the approval flow, role checks, plant scope, cross-tenant denial and the response meta contract.
"""
import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings

pytestmark = pytest.mark.skipif(not get_settings().database_url, reason="DATABASE_URL not set")
T = "TST-01"


@pytest.fixture(scope="module")
def client():
    import app.services  # noqa: F401
    from app.auth import DEMO_USERS, seed_roles_and_users
    from app.db import get_sessionmaker
    from app.main import app
    from app.pipeline import ingest
    from app import models as m
    from sqlalchemy import update
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from seed.tenant_fixture import load_second_tenant

    with get_sessionmaker()() as s, s.begin():
        s.execute(pg_insert(m.Tenant).values(tenant_id=T, name="API test tenant").on_conflict_do_nothing())
        # start every test session from fresh drafts
        s.execute(update(m.Proposal).where(m.Proposal.tenant_id == T).values(state="rejected", reason_code="OTHER"))
        ingest(s, get_settings().raw_data_path, T, uploaded_by="pytest", write_scenario=False)
        seed_roles_and_users(s, T, DEMO_USERS, suffix=".tst")
    load_second_tenant()
    return TestClient(app)


def login(client, user):
    r = client.post("/api/auth/login", json={"username": user, "password": "demo"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def drafts(client, h, level=None, plant=None):
    q = "/api/proposals?state=draft&page_size=200" + (f"&plant={plant}" if plant else "")
    rows = client.get(q, headers=h).json()["data"]["rows"]
    return [r for r in rows if level is None or r["approval_level"] == level]


def act(client, h, pid, action, **body):
    return client.post(f"/api/proposals/{pid}/{action}", headers=h, json=body or None)


def test_login_and_meta_contract(client):
    assert client.post("/api/auth/login", json={"username": "buyer.tst", "password": "x"}).status_code == 401
    assert client.get("/api/overview").status_code == 401
    h = login(client, "leader.tst")
    for url in ["/api/overview", "/api/stock", "/api/shortages", "/api/proposals", "/api/brief", "/api/assumptions",
                "/api/dq", "/api/materials/MAT-SOC-001?plant=IN-KA-01"]:
        r = client.get(url, headers=h)
        assert r.status_code == 200, (url, r.text)
        meta = r.json()["meta"]
        for k in ("as_of", "data_age_days", "run_id", "assumption_ids"):
            assert k in meta, (url, k)
        assert meta["as_of"] == "2026-10-31" and meta["assumption_ids"]


def test_level2_flow_buyer_then_manager_then_fulfil(client):
    buyer, mgr = login(client, "buyer.tst"), login(client, "procmgr.tst")
    p = drafts(client, buyer, level=2)[0]
    assert act(client, buyer, p["id"], "submit").json()["data"]["state"] == "pending_buyer"
    assert act(client, mgr, p["id"], "approve").status_code == 403  # L2 cannot do the buyer's L1 step
    assert act(client, buyer, p["id"], "approve").json()["data"]["state"] == "pending_manager"
    assert act(client, buyer, p["id"], "approve").status_code == 403  # buyer has no L2
    assert act(client, mgr, p["id"], "approve").json()["data"]["state"] == "approved"
    assert act(client, buyer, p["id"], "fulfil").json()["data"]["state"] == "fulfilled"
    tl = client.get(f"/api/proposals/{p['id']}", headers=buyer).json()["data"]["timeline"]
    assert [x["to_state"] for x in tl] == ["pending_buyer", "pending_manager", "approved", "fulfilled"]
    assert [x["username"] for x in tl] == ["buyer.tst", "buyer.tst", "procmgr.tst", "buyer.tst"]


def test_level1_goes_straight_to_approved(client):
    buyer = login(client, "buyer.tst")
    p = drafts(client, buyer, level=1)[0]
    act(client, buyer, p["id"], "submit")
    assert act(client, buyer, p["id"], "approve").json()["data"]["state"] == "approved"


def test_reject_needs_valid_reason_and_is_final(client):
    buyer = login(client, "buyer.tst")
    p = drafts(client, buyer)[0]
    act(client, buyer, p["id"], "submit")
    assert act(client, buyer, p["id"], "reject").status_code == 422
    assert act(client, buyer, p["id"], "reject", reason_code="BECAUSE").status_code == 422
    r = act(client, buyer, p["id"], "reject", reason_code="WRONG_QTY", comment="too much")
    assert r.json()["data"]["state"] == "rejected"
    assert act(client, buyer, p["id"], "approve").status_code == 409


def test_role_checks(client):
    planner, stores, leader = login(client, "planner.tst"), login(client, "stores.tst"), login(client, "leader.tst")
    p = drafts(client, planner)[0]
    for h in (planner, stores, leader):
        assert act(client, h, p["id"], "submit").status_code == 403
    assert client.post("/api/uploads", headers=planner, files={"files": ("x.csv", b"a,b\n")}).status_code == 403


def test_override_qty_recomputes_level(client):
    buyer, mgr = login(client, "buyer.tst"), login(client, "procmgr.tst")
    p = drafts(client, buyer, level=2)[0]
    act(client, buyer, p["id"], "submit")
    assert act(client, buyer, p["id"], "override_qty", qty=1).status_code == 422  # reason required
    r = act(client, buyer, p["id"], "override_qty", qty=1, comment="trial lot").json()["data"]
    assert r["approval_level"] == 1 and r["value_inr"] == p["unit_price_inr"]
    assert act(client, buyer, p["id"], "approve").json()["data"]["state"] == "approved"


def test_bulk_approve_only_below_threshold(client):
    buyer = login(client, "buyer.tst")
    l1, l2 = drafts(client, buyer, level=1)[0], drafts(client, buyer, level=2)[0]
    for p in (l1, l2):
        act(client, buyer, p["id"], "submit")
    r = client.post("/api/proposals/bulk-approve", headers=buyer, json={"ids": [l1["id"], l2["id"]]}).json()["data"]
    assert r["approved"] == [l1["id"]] and r["skipped"] == [l2["id"]]


def test_plant_scope(client):
    ka = login(client, "buyer.ka.tst")
    rows = client.get("/api/proposals?page_size=200", headers=ka).json()["data"]["rows"]
    assert rows and {r["plant_id"] for r in rows} == {"IN-KA-01"}
    tn = drafts(client, login(client, "buyer.tst"), plant="IN-TN-01")[0]
    assert act(client, ka, tn["id"], "submit").status_code == 403
    assert client.get("/api/stock?plant=IN-TN-01", headers=ka).status_code == 403
    assert client.get(f"/api/proposals/{tn['id']}", headers=ka).status_code == 403


def test_cross_tenant_denial(client):
    other = login(client, "buyer.t2")
    mine = drafts(client, login(client, "buyer.tst"))[0]
    assert client.get(f"/api/proposals/{mine['id']}", headers=other).status_code == 404
    assert act(client, other, mine["id"], "submit").status_code == 404
    rows = client.get("/api/proposals?page_size=500", headers=other).json()["data"]["rows"]
    assert all(r["id"] != mine["id"] for r in rows)
    stock = client.get("/api/stock?page_size=500", headers=other).json()["data"]["rows"]
    assert {r["material_id"] for r in stock} <= {"MAT-SOC-001", "MAT-BOX-014"}
    # a forged token claiming another tenant is rejected
    claims = jwt.decode(other["Authorization"][7:], options={"verify_signature": False})
    forged = jwt.encode(claims | {"tenant": T}, "not-the-secret", algorithm="HS256")
    assert client.get("/api/proposals", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_exports_are_xlsx(client):
    h = login(client, "leader.tst")
    for url in ["/api/stock/export.xlsx", "/api/proposals/export.xlsx", "/api/shortages/export.xlsx",
                "/api/reports/daily-stock.xlsx"]:
        r = client.get(url, headers=h)
        assert r.status_code == 200 and r.content[:2] == b"PK", url


def test_paging_sorting_filters(client):
    h = login(client, "leader.tst")
    r = client.get("/api/stock?page=2&page_size=10&sort=usable_value_inr&dir=desc", headers=h).json()["data"]
    assert r["total"] == 36 and r["page"] == 2 and len(r["rows"]) == 10
    vals = [x["usable_value_inr"] for x in r["rows"]]
    assert vals == sorted(vals, reverse=True)
    crit = client.get("/api/stock?status=critical&plant=IN-TN-01", headers=h).json()["data"]["rows"]
    assert crit and all(x["status"] == "critical" and x["plant_id"] == "IN-TN-01" for x in crit)


def test_run_history_policies_and_tools_are_tenant_scoped(client):
    h = login(client, "leader.tst")
    runs = client.get("/api/runs", headers=h)
    assert runs.status_code == 200
    rows = runs.json()["data"]
    assert rows and all(r["run_id"] > 0 for r in rows)
    from app import models as m
    from app.db import get_sessionmaker
    with get_sessionmaker()() as s:
        own = {r.id for r in s.query(m.CalculationRun).filter_by(tenant_id=T)}
    assert {r["run_id"] for r in rows} <= own  # no other tenant's runs
    pol = client.get("/api/policies", headers=h).json()["data"]
    assert any(p["key"] == "manager_approval_threshold_inr" for p in pol)
    tools = client.get("/api/agent/tools", headers=h).json()["data"]
    assert "get_shortage_horizon" in {t["name"] for t in tools}
    logs = client.get("/api/agent/runs", headers=h)
    assert logs.status_code == 200
    assert all(r["username"].endswith(".tst") for r in logs.json()["data"])


def test_demand_source_view_is_read_only_and_default_unchanged(client):
    h = login(client, "leader.tst")
    d = client.get("/api/overview", headers=h).json()
    assert d["meta"]["demand_source"] == "scenario" and d["meta"]["demand_source_shown"] == "scenario"
    v = d["data"]["demand_view"]
    assert v["is_default"] and v["available"] == ["production_orders", "scenario"]
    assert v["other"]["source"] == "production_orders"
    assert {x["kpi"] for x in d["data"]["not_measurable"]} >= {"Inventory record accuracy", "Customer impact"}
    k = d["data"]["kpis"]
    assert k["days_of_inventory"] > 0 and "stockout_risk_pairs" in k

    po = client.get("/api/overview?source=production_orders", headers=h).json()
    pk, pv = po["data"]["kpis"], po["data"]["demand_view"]
    assert po["meta"]["demand_source_shown"] == "production_orders" and not pv["is_default"]
    assert pk["status_counts"]["critical"] == pk["pairs_with_demand"] == 32  # all short on the open orders
    assert pv["note_multiple"]["median"] > 1 and pv["other"]["status_counts"] == k["status_counts"]
    assert "A21" in po["meta"]["assumption_ids"]

    sh = client.get("/api/shortages?source=production_orders&horizon=60", headers=h).json()
    assert sh["data"]["total"] == 32 and sh["data"]["demand_view"]["source"] == "production_orders"
    assert client.get("/api/shortages?horizon=60", headers=h).json()["meta"]["demand_source_shown"] == "scenario"
    assert client.get("/api/overview?source=bogus", headers=h).status_code == 422

    # Proposals never follow the view: they come only from the default source's run.
    pr = client.get("/api/proposals?state=draft,pending_buyer,pending_manager,approved&page_size=500", headers=h).json()
    assert all(r["qty"] < 50_000 for r in pr["data"]["rows"])
