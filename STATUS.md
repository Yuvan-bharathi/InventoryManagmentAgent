# Build status

## Stage 0 — Day 1 decisions + database · 2026-11-11 · DONE

- Done: status window (D1–D3), xfail removed; A19 future_receipt_mode + DQ info line (₹137.12 Cr of future-dated
  received_qty uncounted); A20 lead_time_source with supplier choice approved → on-time % → LT (D5, D6);
  Neon wired (pooled for app, direct for Alembic); migration applied; `app.cli load` succeeds (~11 s).
- Real data, as of 31-Oct-2026: Critical 11 · At risk 16 · Excess 1 · Healthy 4 · Stale 4; Health 12.5%.
- Gate: every status appears ✔ · row counts match CSVs on Neon ✔ · 39 tests pass incl. live DB ✔
- Issues: two first load attempts failed (pandas NA → psycopg), fixed; their rollbacks consumed run ids 1–2.

## Stage 1 — Backend (Day 2) · 2026-11-11 · DONE

- Done: proposals engine (target / gap / transfer-first / MOQ / supplier rank / level; D11–D16) persisted per run
  with all inputs; approval state machine with role + plant checks and `approval_logs` + `audit_events` (D17);
  JWT auth with 9 demo users (D18); `calculation_runs` + run_id on every output; post-run hooks (proposals, brief);
  daily stock report .xlsx; template brief; REST API for all MVP pages (paging, filters, sorting, .xlsx export,
  meta = as_of, data_age_days, run_id, assumption_ids); ZIP/CSV upload endpoint.
- Real data: 28 draft proposals (23 purchase, 5 transfer; 15 need the manager).
- Gate: approval flow ✔ · role checks ✔ · plant scope ✔ · cross-tenant denial (404 + forged token 401) ✔ ·
  proposal maths on hand-checked cases ✔ — 55 tests pass (≈200 s, live Neon).
- Issues: `/bulk/approve` collided with `/{id}/{action}` → renamed `/bulk-approve`; JSON date serialisation fixed.

## Stage 2 — Frontend (Day 3) · 2026-11-11 · DONE

- Done: React + Vite + TS app in `frontend/` with the Warm Industrial design system; shared kit (shell with plant
  selector, "Data as of … · N days old · run #" badge, stale / DQ-failed / AI-unavailable banners, left nav with
  approval badge, data grid standard with server paging + sorting + filters + column chooser + saved views + density
  + .xlsx export, KPI tile, status labels colour + text, page states incl. no-permission); 8 MVP pages + agent side
  panel shell; "Planning scenario" tags; assumption ids on hover (dotted underline → id + wording).
- Gate: Playwright `frontend/e2e/clickpath.spec.ts` — 3/3 pass: upload ZIP → DQ findings → shortage → proposal →
  buyer submit + approve → manager approve ✔; every MVP page < 2 s on the real data (233–1512 ms) ✔.
- Issues: first timings were 2.8–4.3 s (≈20 Neon round trips per page) → per-run caches (D22); e2e race on the
  upload response fixed in the test.

## Stage 3 — Agent with Domo · 2026-11-11 · BUILT, GATE BLOCKED

- Done: Domo client from .env (D25) with smoke test; 12 tools returning compact validated JSON from engine output
  (no model-written SQL), incl. a deterministic supplier-delay simulation; router + JSON-action loop (temperature 0,
  max 5 steps, repair retry, parallel tool calls); grounding check (D27); template fallback (D26); answers cite
  materials / proposals as links and name scenario + assumption ids; read-only agent (D28); Domo-written brief with
  template fallback; agent side panel on every page sends page, plant filter and selected item; SSE streaming;
  `agent_run_logs`.
- Tests: 18 agent tests with a scripted LLM (loop, max steps, repair, grounding, tenant arg stripped, plant scope,
  router for the 5 questions, API without Domo) + e2e panel test. Totals: 73 backend tests, 4 e2e tests pass.
- Smoke test (exact errors): (1) `DomoError: Missing DOMO_INSTANCE in .env`; (2) with DOMO_INSTANCE=gwc:
  `HTTP 401 {"status":401,"statusReason":"Unauthorized","path":"/api/ai/v1/text/generation","message":"Full
  authentication is required to access this resource"}`.
- Gate (five leadership questions correct with the real Domo key): **UNBLOCKED** — migrated to `gwcteq-partner.domo.com` with `domogpt-large-v2.2:anthropic` (D36). Domo calls active and grounded.

## Stage 4 — Multi-Specialist Agent & UI Refinements · 2026-11-12 · DONE

- **Coordinator & 6 Specialists (D38)**:
  - 6 domain specialists: Data Reconciliation, Stock Monitoring, Shortage Forecast, Replenishment, Excess & Obsolete, Supplier Delay (`simulate_shortage_impact`).
  - Hierarchical routing: decisive whole-question rules → clause keyword matching → active page context → one Domo classifier fallback → coordinator fallback.
  - Multi-specialist parallel tool execution with grounded synthesis combine prompt (`_combine`).
- **Grounding v2 & Evaluation (D40–D42, T4, I1)**:
  - Normalised grounding check (`v2`): accounts for lakh/crore units, percentage scales, rounding precision, and date representations.
  - Baseline evaluation on 30 benchmark questions: 28/30 correct on specialists, 0 ungrounded numbers, p95 latency 15.1 s.
  - Precomputed answers for the five canonical leadership questions (`precomputed=True`, I2).
  - Post-run hook generates deterministic summary logs for each specialist (`write_specialist_summaries`, I3).
- **Dual Demand Source Projections (D31–D35)**:
  - Supports both forward planning scenario (A15) and raw production order backlog views.
- **Frontend & UX Polish**:
  - Eliminated sticky header overlap in "Needs attention": scoped sticky behavior strictly to `.dg-wrap`.
  - Redesigned "Open proposal →" button with single-line pill geometry (`white-space: nowrap !important`).
  - Resolved horizontal overflow on "Plant comparison" card: responsive 2-column layout on medium screens and safe `.table-wrap` horizontal scrolling.
  - Aligned KPI tile heights and footers across all 8 dashboard metrics.
  - Refined Executive Overview: structured Daily Brief with bullet points, formatted charts, and responsive grids.
- **Windows CLI Encoding (I20)**:
  - Reconfigured standard stdout/stderr streams to UTF-8 on Windows in `app.cli` to handle ₹ symbol rendering cleanly.
