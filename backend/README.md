# Backend — Inventory Management Agent (Agent 09)

Spec: [../CLAUDE.md](../CLAUDE.md) (v3 + decisions log). Build log: [../STATUS.md](../STATUS.md). Raw dataset: `../data/raw/` (never modified).

## Setup (Windows, Git Bash)

```bash
cd backend
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
# ../.env: DATABASE_URL (Neon pooled), DATABASE_URL_DIRECT (Neon direct, Alembic), JWT_SECRET,
#          DOMO_INSTANCE, DOMO_DEVELOPER_TOKEN, DOMO_MODEL_ID (optional) — see ../.env.example
.venv/Scripts/alembic upgrade head
.venv/Scripts/python -m app.cli load      # dataset -> tenant ORG-01 (+ demo users)
.venv/Scripts/python -m app.cli seed      # demo users + isolation tenant TEN-02
```

## Run

```bash
cd ../frontend && npm install && npm run build && cd ../backend
.venv/Scripts/python -m uvicorn app.main:app --port 8000     # app + API on http://127.0.0.1:8000
```

Sign in as `leader`, `invmgr`, `planner`, `buyer`, `procmgr`, `stores`, `dataadmin`, `sysadmin` or `buyer.ka`
(password `demo`). Dev mode for the UI: `cd ../frontend && npm run dev` (proxies `/api` to :8000).

## Tests

```bash
.venv/Scripts/python -m pytest                    # 73 tests: engine, DQ, proposals, API, agent (live Neon)
cd ../frontend && npx playwright test             # 4 e2e tests (server must be running; DATASET_ZIP=<zip> optional)
.venv/Scripts/python -m app.cli reset-proposals   # reset the demo before re-running the click path
.venv/Scripts/python -c "from app.agent.domo import smoke; print(smoke())"   # Domo smoke test
```

## Layout

| Path | What |
| --- | --- |
| `app/ingest/` | reader (ZIP / CSVs), loader (bulk, one transaction per upload) |
| `app/dq/checks.py` | 13 data-quality checks |
| `app/engine/` | pure calculation: stock, supply, demand, projection, proposals, simulate, run |
| `app/services/` | post-run hooks: proposals + approval workflow, daily brief |
| `app/api/` | REST endpoints for the MVP pages (envelope `{data, meta}`), agent endpoints |
| `app/agent/` | Domo client, 12 tools, router + loop, templates, AI brief |
| `app/auth.py` | demo JWT auth, roles, permissions, plant scope |
| `seed/` | assumptions / policies defaults, planning scenario, isolation tenant |
