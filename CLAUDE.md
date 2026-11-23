# CLAUDE.md — Inventory Management Agent (Agent 09) · v3

Agent 09 of the Manufacturing Agentic AI Platform, built for one core manufacturing company in a
3-day MVP.

**v3 change:** the organization supplied a real dataset (36 CSVs, electronics / smartphone
manufacturing). It replaces our synthetic Excel contract. We use only the 10 files the
inventory agent needs.

The organization has not yet answered our data questions. Every open question is therefore
handled by a **named, configurable assumption** (section "Assumptions"). Never hard-code one,
and never hide one from the user.

Related docs (Claude Docs): "Inventory Management Agent – Build Plan v2.1" and
"Inventory Management – UI Page Specification". If code and this file disagree, ask before
changing either.

## The five questions the product must answer

1. Will any line stop because of a material?
2. How much cash is tied up in stock we don't need?
3. What is about to expire or become waste?
4. What is waiting for my approval, and why?
5. If a supplier is late, what breaks?

## Stack

- Frontend: React + Vite (extends the setup guide's chat app)
- Backend: FastAPI, SQLAlchemy, Alembic, Python 3.11+, pandas
- Agent: LangChain JSON-action loop calling Domo AI Text Generation
- Database: PostgreSQL
- Dev machine: Windows 11, Git Bash and CMD

## Non-negotiable rules

1. **The LLM never does inventory arithmetic.** Every number comes from the deterministic
   engine in `backend/app/engine/`.
2. **The LLM never writes to the database.** The agent uses the read-only `agent_ro` role.
3. **Nothing is executed automatically.** No PO release, stock change or write-off without
   approval: the buyer for every proposal, plus a manager above the value threshold.
4. **Tenant identity comes only from the authenticated session.** It is enforced in every
   backend query. The org dataset loads as tenant `ORG-01`.
5. **Every result stores its inputs and `run_id`.** Every result that depends on an assumption
   also lists the assumption IDs it used.
6. **Thresholds and assumptions live in `inventory_policies` / `assumptions` config, never in
   code.**
7. **Say "refreshed", never "live".** Show the as-of date and its age: "Data as of
   31-Oct-2026 · 11 days old".
8. **Never sum quantities across materials.** UoMs are mixed (EA, KG, SET); totals across
   materials are in ₹ only.
9. **Keep the raw dataset unchanged.** Store it in `data/raw/`; derived data goes to the
   database only.

## Dataset: files we use

Store `inventory_dataset.zip` in `data/raw/`. Ingestion accepts a ZIP or individual CSVs;
`.xlsx` support stays for later.

| File | Rows | Grain | Used for | Priority |
| --- | --- | --- | --- | --- |
| `dim_material.csv` | 18 | material | Master: category, UoM, standard price, lead time, safety stock, MOQ, shelf life | P0 |
| `dim_plant.csv` | 2 | plant | IN-TN-01 Chennai, IN-KA-01 Bengaluru | P0 |
| `dim_supplier.csv` | 10 | supplier | Supplier master; `material_category` = what each supplier is approved for | P0 |
| `dim_product.csv` | 3 | product | Phones built from the BOM | P0 |
| `fact_bom_component.csv` | 48 | product × material | Requirement per phone, with scrap factor | P0 |
| `fact_inventory_daily_snapshot.csv` | 6,624 | date × material × warehouse | **Latest date only** = current stock position | P0 |
| `fact_purchase_order_receipt.csv` | 1,300 | PO line | Open supply, actual vs promised lead time, delays | P0 |
| `fact_production_order.csv` | 450 | production order | History and product mix; **not** forward demand (A15) | P0 |
| `fact_customer_order.csv` | 1,500 | customer order | Display only; no link to production orders (A16) | P1 |
| `fact_engineering_change.csv` | 80 | change request | Flag materials affected by engineering changes (obsolete risk) | P1 |

**Excluded** (belong to other agents, or are inconsistent for inventory use):
- RFQ quotes: prices are 0.03× to 408× the standard price.
- Hourly production: good quantity is about 4× the order quantity.
- Genealogy, and the other 23 files.

## Column mapping (org dataset → our tables)

| Our table | Source | Mapping notes |
| --- | --- | --- |
| `plants` | `dim_plant` | `plant_id`, `plant_name`, `state`, `currency` |
| `storage_locations` | snapshot `warehouse_id` | 4 codes: RM-WH-01, SMT-KIT-01, WIP-WH-01, FG-WH-01, attached per plant as seen in the latest snapshot |
| `materials` | `dim_material` | `material_category` replaces RM/PKG/WIP/FG; `standard_price_inr` = cost; `safety_stock_qty` = SS (A5) |
| `suppliers` | `dim_supplier` | `approved_status`, `risk_tier`, `standard_lead_time_days` |
| `approved_vendors` | `dim_supplier.material_category` = `dim_material.material_category` | See A11 |
| `bom` | `fact_bom_component` | qty per = `component_qty × (1 + scrap_factor)`; only rows effective on the as-of date |
| `stock_balances` | snapshot, latest `snapshot_date` | on_hand, allocated, blocked, quality_hold, in_transit, lot, expiry, `unit_cost_inr` |
| `purchase_orders` | `fact_purchase_order_receipt` | open qty = `ordered_qty − received_qty` for OPEN / PARTIAL |
| `goods_receipts` | same file, rows with `receipt_date ≤ as-of` | One receipt per line (no partial-receipt history in data) |
| `production_plans` | `fact_production_order` (history) + planning scenario (A15) | |
| `customer_orders` | `fact_customer_order` | Display only |
| `engineering_changes` | `fact_engineering_change` | `part_id` → material |

## Assumptions (configurable; each shown in the UI where it is used)

Store these in an `assumptions` table: id, description, default, current value, owner question.
The Data Quality page lists them all with status "awaiting confirmation".

| ID | Assumption | Default |
| --- | --- | --- |
| A1 | As-of date = latest `snapshot_date` in the data; history is not used for trends (days are independent) | 2026-10-31 |
| A2 | Plant of a stock row = `plant_id` on that row in the latest snapshot | — |
| A3 | Usable = on_hand − allocated − blocked − quality_hold, floored at 0 (no overlap assumed) | `deductions_overlap = false` |
| A4 | `inventory_status` is ignored in calculations; the quantity columns decide | — |
| A5 | Safety stock = `dim_material.safety_stock_qty`, applied per material × plant; the snapshot's value is ignored | `ss_source = master` |
| A6 | All four warehouses count toward plant stock; the warehouse is a filter | `production_warehouses = all` |
| A7 | Snapshot `in_transit_qty` = internal transfers, arriving `in_transit_days` after as-of; not the same as open PO quantity | 3 days |
| A8 | PO open qty = ordered − received for OPEN / PARTIAL; CLOSED = short-closed, nothing more due | — |
| A9 | `receipt_date ≤ as-of` = actual receipt; a later date = expected receipt date. What arrives then depends on A19 | — |
| A10 | Overdue open PO lines are expected at as-of + that supplier's average delay | — |
| A11 | Approved vendor = supplier whose `material_category` matches the material's. AUDIO and CONNECTOR have no matching supplier: proposals show "supplier to be assigned" and a DQ warning | — |
| A12 | Price for proposal value = `standard_price_inr`; RFQ prices not used | — |
| A13 | Expiry checked only where `expiry_date` exists (2 consumables) | — |
| A14 | Max stock is not in the data: max = SS + daily demand × (lead time + review period) × `max_factor` | review 7 days, factor 1.5 |
| A15 | No forward production plan exists (latest planned start 15-Oct). Demand comes from the **planning scenario** (below), labelled "Planning scenario" in the UI. The organization's spec names `fact_production_order` as upcoming demand: that source is computed every run as a view-only alternative (D31), and becomes the default by switching this value once they confirm (D32) | `demand_source = scenario` |
| A16 | Customer orders don't link to production orders (0% ID match): display only, no customer impact | — |
| A17 | Consumables (solder paste, adhesive) are not in the BOM: no demand basis, so they are excluded from shortage calculation and flagged | — |
| A18 | Actual lead time = `receipt_date − po_date` on past receipts, per supplier × material | — |
| A19 | `future_receipt_mode`: `open_qty_only` = only ordered − received of OPEN / PARTIAL lines is supply; `full_received_qty` = received_qty on lines dated after as-of also arrives on that date. DQ info line shows the uncounted value | `open_qty_only` |
| A20 | `lead_time_source` for the supplier a proposal would pick (approved → best on-time % → shortest LT): `actual` (A18) \| `master` \| `max` of the two | `max` |
| A21 | `overdue_backlog` (when demand = production orders): open orders (RELEASED / IN_PROGRESS) planned on or before as-of are overdue backlog, due as-of + 1 for their full `order_qty` (hourly production can't show what is built); `exclude` = future-dated orders only | `as_of_plus_1` |

## Planning scenario (fills the missing forward plan)

- Generator: `backend/seed/planning_scenario.py`, fixed seed. It writes
  `data/scenario/fact_production_order_plan.csv` in the **same schema** as
  `fact_production_order`, with `order_status = PLANNED`.
- Horizon: 60 days from as-of + 1, per plant.
- Daily volume: `scenario_daily_units_per_plant` (default **300**). This gives a median of about
  25 days of cover against real usable stock (median ~7–8k per material per plant).
- Product mix: the historical share by product and plant from `fact_production_order`.
- No planted stock changes are needed. Real stock levels already vary (2,098 to 15,990 usable;
  3 material × plant pairs have no stock), so critical, at-risk, healthy and excess cases appear
  naturally. Verify after generation that each status has at least one material.
- The UI labels every scenario-based number "Planning scenario – replace with the
  organization's plan". Switching `demand_source = production_orders` must work without code
  changes.
- Both sources are calculated on every run (D31). The production-orders source applies the
  overdue-backlog rule (A21) and is shown view-only, with a banner, until the organization
  confirms which plan to use (D32, D33).

## Data-quality gate (runs on every ingestion; results go to `dq_results`)

| Check | Rule | Severity |
| --- | --- | --- |
| Snapshot continuity | Day-to-day correlation of on-hand per material × warehouse < 0.5 → "history not usable for trends" | Warning |
| Plant flip | Same material × warehouse under different plants across days | Warning |
| Safety stock mismatch | Snapshot SS ≠ master SS | Warning (A5) |
| PO status | CLOSED with received < ordered | Warning (A8) |
| Future receipts | `receipt_date` > as-of | Info (A9) |
| Supplier category | PO supplier category ≠ material category | Warning |
| Missing supplier | Material category with no approved supplier | Warning (A11) |
| Broken link | Production order `customer_order_id` not in customer orders | Warning (A16) |
| Stale data | As-of older than `staleness_days` (default 1) | Warning |
| Mixed UoM | Any cross-material quantity sum requested | Blocked |
| Plan coverage | No production order with planned start after as-of | Warning (A15) |
| Deductions | allocated + blocked + quality_hold > on_hand | Error, row excluded |

Show these on the Data Uploads validation report and the Data Quality page. The demo opens with
them: "N issues found in the dataset before any calculation."

## Domain rules

- **Projection** per material × plant × day:
  Projected(d) = Usable + in-transit (A7) + open PO receipts up to d (A8–A10)
  − requirements up to d.
- **Requirements** = planned units × BOM qty per (with scrap). No reservations exist in the
  data, so allocated is already in the snapshot and all scenario requirements count as
  unreserved.
- **Shortage date** = first day projected < SS.
- **Status** (protection window = LT + review period):
  - Critical: below SS within the lead time.
  - At risk: below SS later in the horizon.
  - Excess: above max (A14) on every day of the protection window.
  - Healthy: within [SS, max] across the protection window (see D2 for the remainder).
  - Stale/unknown: no demand basis (A17).
  - Precedence: stale > critical > at risk > excess > healthy.
- **Order quantity:**
  - Target = min(SS + daily demand × (LT + review), max).
  - Qty = Target − projected stock on the arrival date.
  - Round Qty up to MOQ (`dim_material.moq`).
  - LT = actual lead time where known (A18), else master.
- **Transfers:**
  - Check before purchase.
  - Source surplus = usable − own projected need over the LT − SS.
  - Never create a shortage at the source.
- **Inventory Health %:**
  - Count per material × plant, for materials with a demand basis.
  - Health % = share whose projection stays within [SS, max] over the horizon.
- **Values in ₹:** quantity × `unit_cost_inr` (equal to `standard_price_inr` in the data).

## Database additions over v2.1

- Tables: `assumptions`, `dq_results`, `engineering_changes`, `customer_orders`,
  `alert_actions`, `saved_views`, `users`, `roles`, `user_plants`, `audit_events`,
  `calculation_runs`.
- Material type → `material_category`. Use categories everywhere the UI spec says type.
- Proposal states:
  - `draft` → `pending_buyer` → `pending_manager` (only above threshold) → `approved`
  - `rejected` is reachable from either pending state and requires a reason code.
  - `approved` → `fulfilled`.

## Agent

- Loop: temperature 0, JSON response format, max 5 steps.
- Domo settings come from `.env` only (`DOMO_INSTANCE`, `DOMO_DEVELOPER_TOKEN`,
  `DOMO_MODEL_ID`, `DATABASE_URL`).
- Tools (validated JSON from engine services):
  - `get_daily_brief`
  - `get_inventory_overview`
  - `get_stock_position`
  - `get_shortage_horizon`
  - `get_material_risk_ranking`
  - `get_excess_inventory`
  - `get_expiring_lots`
  - `get_replenishment_options`
  - `get_transfer_options`
  - `simulate_shortage_impact`
  - `get_proposal_details`
  - `get_data_quality`
- Answers that rely on the scenario or an assumption must say so ("based on the planning
  scenario", "assuming no overlap between allocated and blocked").
- **Domo fallback:** if Domo fails, the brief uses a template with engine numbers, chat shows
  "AI unavailable", and the rest of the app keeps working.

## Layout

```
data/raw/            # inventory_dataset.zip as received — never modified
data/scenario/       # generated planning scenario
backend/app/
  ingest/            # ZIP/CSV readers, column mapping, as-of detection
  dq/                # data-quality gate
  engine/            # projections, shortages, proposals, transfers — pure, unit-tested
  reports/  agent/  api/  models/  schemas/  auth/
backend/seed/        # planning_scenario.py, tenant-isolation fixture (small 2nd tenant)
frontend/src/pages/  # per the UI Page Specification
```

## 3-day MVP

### Day 1: data and engine

1. Ingest the ZIP into PostgreSQL with the mapping above.
2. Load the assumptions table.
3. Run the DQ gate.
4. Generate the planning scenario.
5. Build usable stock, projection and shortage date.

Done when: the DQ report lists the dataset issues, and the shortage horizon shows materials in
every status.

### Day 2: decisions and agent

- Proposals with MOQ and actual lead time
- Approval states
- `calculation_runs`
- Daily report and brief
- Agent tools and Domo, with fallback

Done when: "which materials will go critical?" gets a correct, explained answer that names its
assumptions.

### Day 3: UI

MVP pages from the UI spec:
- Executive Overview
- Stock Explorer
- Material 360
- Shortage Horizon
- Proposals
- Proposal Detail
- Daily Brief
- Data Uploads
- Agent side panel

Done when: a walk-through from data upload → DQ findings → shortage → proposal → approval
works.

Demo order:
1. Upload the dataset.
2. Show the data-quality findings and assumptions.
3. Show the daily brief.
4. Show the shortage horizon.
5. Show a proposal.
6. Approve it.
7. Ask the agent "why?".

## Testing

- Every engine function has unit tests on hand-checked cases built from real rows.
- Required tests:
  - every DQ check fires on the real dataset
  - each assumption can be switched and changes the result
  - no cross-material quantity sums
  - tenant isolation
  - approval transitions
  - transfer never creates a source shortage
  - the app works with Domo disabled

## Working agreements

- Explain changes in plain language. Correctness over completeness.
- Keep the backend optimized: bulk loads, batch queries, no N+1.
- Ask before:
  - changing an assumption default
  - changing a formula
  - changing the column mapping
  - adding a dependency
  - touching auth or tenant scoping

## Decisions log

| # | Date | Decision | Why / source |
| --- | --- | --- | --- |
| D1 | 2026-11-11 | Status window: critical = below SS within LT; at risk = below SS later in the horizon; excess = above max for the whole protection window (LT + 7-day review); healthy = within [SS, max] across the window. Precedence stale > critical > at risk > excess > healthy. | Stage 0 instruction (replaces the 60-day excess/healthy test, under which no pair could be healthy) |
| D2 | 2026-11-11 | A pair with no shortage in the horizon that is above max on only part of the window is classed **healthy** (it fits neither literal excess nor healthy). | The four definitions leave this case uncovered; healthy is the non-alarm bucket. Affects 4 pairs on the real data |
| D3 | 2026-11-11 | Inventory Health % = share of material × plant pairs with a demand basis whose status is healthy. | Keeps the KPI consistent with the status labels (was: within band over the horizon) |
| D4 | 2026-11-11 | A19 `future_receipt_mode` added, default `open_qty_only`; A9 reworded. In `full_received_qty` mode every future-dated line (any status, incl. CLOSED) adds its received_qty on its receipt_date. DQ info line shows uncounted lines and ₹ value; quantities only per material. | Stage 0 instruction; rule 8 (no cross-material quantity sums) |
| D5 | 2026-11-11 | Supplier choice: approved (A11) → best on-time % (receipt ≤ promised, supplier × material; supplier overall if no receipts for that material) → shortest LT (actual, else supplier standard LT) → supplier id. | Stage 0 instruction; fallback for on-time % is ours |
| D6 | 2026-11-11 | A20 `lead_time_source` = actual \| master \| max (default max). "master" = `dim_material.lead_time_days`; actual = chosen supplier's mean actual LT rounded up. | Stage 0 instruction; CLAUDE.md "else master" means the material master |
| D7 | 2026-11-11 | App uses `DATABASE_URL` (Neon pooled); Alembic uses `DATABASE_URL_DIRECT`. | Stage 0 instruction |
| D8 | 2026-11-11 | Manager approval threshold = ₹10 lakh (`inventory_policies.manager_approval_threshold_inr`). | User choice |
| D9 | 2026-11-11 | `stock_balances` stores the as-of snapshot only (72 rows), so its row-count check compares with the latest-date rows of the CSV; `goods_receipts` compares with rows dated ≤ as-of. | Column mapping in this file |
| D10 | 2026-11-11 | Re-seeding updates assumption wording and defaults but never a tenant's current value. | Rule 6; keeps confirmed values |
| D11 | 2026-11-11 | Transfer sources: only pairs with status healthy or excess (no shortage in the horizon). Transferable = min(usable − own need over the destination LT − SS, min over the horizon of (projected − SS)); several destinations draw down the same source in shortage-date order. | "Never create a source shortage": the headroom cap keeps the source ≥ SS every day |
| D12 | 2026-11-11 | MOQ rounding: final qty = ceil(max(raw, MOQ)); no lot multiple exists in the data. Proposal says when MOQ exceeds the need (`moq_applied`). | CLAUDE.md "round up to MOQ" |
| D13 | 2026-11-11 | "Production orders at risk" / "orders affected" use the **stock-out** date (projected < 0, line stops), not the below-SS date. | Question 1 ("will any line stop"); below SS is a planning threshold, not a stop |
| D14 | 2026-11-11 | One `proposals` table for purchases and transfers (`kind`). | The UI shows them in one grid and one approval flow |
| D15 | 2026-11-11 | Each run deletes untouched drafts and regenerates them; drafts with approval history are kept; a material × plant × kind with a live proposal (draft / pending / approved) gets no new one. | Avoid duplicates across runs |
| D16 | 2026-11-11 | Proposals for every critical / at-risk pair whose gap > 0. needed_by = shortage date; order_by = shortage − LT (not before tomorrow); in time = yes (arrival ≤ shortage), expedite, or no (no supplier, A11). | UI spec Shortage Horizon "in time to replenish" |
| D17 | 2026-11-11 | Transitions: submit = replenishment A (inventory manager, buyer, procurement manager); approve at pending_buyer = buyer (L1); at pending_manager = procurement manager (L2); reject / send back = that step's approver, reason required (reject: code from NOT_NEEDED, WRONG_QTY, WRONG_SUPPLIER, BUDGET, DATA_ISSUE, TIMING, OTHER); override qty = buyer at pending_buyer with reason, re-routes level; fulfil = replenishment A. Bulk approve only level-1 proposals at pending_buyer. | UI spec permission matrix and Proposal Detail decision panel |
| D18 | 2026-11-11 | Demo auth: 9 seeded users (one per role + `buyer.ka` scoped to IN-KA-01), password `demo`, JWT HS256 (12 h) with tenant, role and plants; tenant only from the token. | Stage 1 instruction |
| D19 | 2026-11-11 | Tests write only to tenant TST-01 (API tests) and TEN-02 (2-material isolation fixture); ORG-01 demo data is only reloaded, never mutated by tests. | Keep the demo clean |
| D20 | 2026-11-11 | Excess value ₹ = (usable − max) × standard price for pairs with status excess. Expedite option is shown without cost or date (no data). | No max-stock or expedite data in the dataset |
| D21 | 2026-11-11 | Uploads accept ZIP or CSV, stored under `data/uploads/<timestamp>/` (never `data/raw/`); the run is synchronous (~15 s). | Rule 9 |
| D22 | 2026-11-11 | Per-run data (status, projection, PO lines, receipts, lead times, requirements, run rows, assumptions, meta) is cached in-process by (tenant, run_id), cleared and re-warmed after each upload and warmed at server start; the latest run id is cached 20 s. DB pool without pre-ping, recycled every 240 s. | 2-second page target with ~75 ms Neon round trips; tenant / plant filters still applied per request |
| D23 | 2026-11-11 | Saved grid views, column choice and density are stored per browser (localStorage); the `saved_views` table exists for the Phase-2 server version. | MVP scope |
| D24 | 2026-11-11 | `app.cli reset-proposals` (demo utility) deletes ORG-01 proposals + approval logs so the click-path demo / e2e test can be re-run; the next upload regenerates drafts. | Repeatable demo |
| D25 | 2026-11-11 | Domo call = `POST https://{DOMO_INSTANCE}.domo.com/api/ai/v1/text/generation` with `input`, `system`, optional `model` (empty → instance default) and `modelConfiguration.temperature = 0`. The documented API has no response-format flag, so JSON is enforced by the system prompt, parsed, with one repair retry. | Domo AI Services API docs (Context7) |
| D26 | 2026-11-11 | The intent router and per-tool deterministic templates ship in Stage 3 as the AI-down fallback: routable questions (incl. the five leadership questions) still get engine-number answers marked "AI unavailable"; others get "AI is unavailable right now". | Rule: the app must work with Domo disabled |
| D27 | 2026-11-11 | Grounding check is live from Stage 3: an LLM answer (or AI brief) containing a number or date absent from its tool results / facts is replaced by the template. | No-arithmetic rule (rule 1) |
| D28 | 2026-11-11 | Agent reads in a `SET TRANSACTION READ ONLY` session and has no write tool; a separate `agent_ro` Postgres role is not created yet (would add a secret and touch auth — ask first). | Rule 2; working agreement |
| D29 | 2026-11-11 | Streaming: Domo does not stream, so `/api/agent/chat/stream` streams the final answer in chunks (SSE). Tool results are cached by tenant + plants + role + run_id + tool + args (proposal details stay live). | Stage 3/4 instructions |
| D30 | 2026-11-11 | `DOMO_INSTANCE=gwc` per user; the smoke test returns HTTP 401 "Full authentication is required" — the token is not valid for that instance. Not retried against guessed instances (would send the token elsewhere). | User instruction; security |
| D31 | 2026-11-12 | Every run computes **both** demand sources. The default (A15) drives proposals, the brief and the agent; the other is stored alongside (`material_status` / `inventory_projections.demand_source`, `calculation_runs.kpis.by_source`) and shown **view-only** via a toggle on Executive Overview and Shortage Horizon. Proposals never follow the toggle. | Org spec names production orders as demand; user decision (option a) |
| D32 | 2026-11-12 | A15 default stays `scenario` until the organization confirms. On their production orders all 32 material × plant pairs with demand are critical (health 0%) and proposals would be ~110–145k units each, which would read as broken. Switching later is a config change only. | User decision after seeing the counts |
| D33 | 2026-11-12 | When the production-orders view is shown, a banner says proposals use the planning scenario and gives the engine's requirement ÷ usable stock per pair (run 37: median 19.2×, range 7.9–61× over 30 stocked pairs; 2 pairs have no stock). Shortage / overview agent tools and the brief carry the other source's counts, so answers state both without a toggle. The ratio is computed, never typed (rule 1). | User decision; corrected "10–20×" to the computed range |
| D34 | 2026-11-12 | Backlog due date = as-of + 1 (A21). | User decision |
| D35 | 2026-11-12 | Executive Overview KPI strip from the deck: days of inventory (usable ₹ ÷ daily demand ₹), excess value, stockout risk (pairs with stock-out within LT), schedule disruption (proxy: production orders at risk). Shown as "not measurable with this dataset": inventory turns, stockout hours, record accuracy, customer impact (A16). | Agent 09 brief success measures |
| D36 | 2026-11-12 | Domo instance = `gwcteq-partner` (supersedes D30). Smoke test OK: instance default model `domo.domo_ai.domogpt-large-v2.2:anthropic`, ~1.8 s; the brief is now AI-written. `DOMO_MODEL_ID` left empty (instance default). | User-supplied token and instance |
| D37 | 2026-11-12 | Test isolation: pytest (`tests/conftest.py`) and Playwright (`playwright.config.ts`, own backend on :8100) use `TEST_DATABASE_URL` (Neon test branch) only. Without it, database tests skip and Playwright refuses to start; equal to `DATABASE_URL` is an error. Tests never touch ORG-01 on main. | User instruction |
| D38 | 2026-11-12 | Inventory Copilot coordinator + 6 specialists, each with a short prompt and only its tools: Data Reconciliation (get_data_quality); Stock Monitoring (overview, stock position, brief); Shortage Forecast (shortage horizon, risk ranking); Replenishment (replenishment, transfer, proposal details); Excess and Obsolete (excess, expiring lots); **Supplier Delay (simulate_shortage_impact)**. Routing: decisive rules → keyword rules per clause → page context → one Domo classification call → coordinator with all 12 tools. Two-specialist questions run in parallel, then one combining call (grounded against both). Chosen specialist + method stored in `agent_run_logs.specialist`. | User spec listed 5 rows for 6 specialists and left simulate_shortage_impact unassigned; it answers leadership question 5, so it became the 6th |
| D39 | 2026-11-12 | Priority: agent work until it meets its targets. Deferred to a final compliance pass: Neon test branch run, guide .env names, guide endpoint shapes (/api/chat, /api/conversations), theme token names, agent_ro + get_schema / run_sql, per-user rate limiting, and the earlier decisions (app/db package exports, DOMO_MODEL explicit, langchain-core in requirements). The agent never had run_sql / get_schema, so nothing was removed. | User instruction |
| D40 | 2026-11-12 | Domo API as observed on gwcteq-partner: `reasoningConfig.reasoningEffort` accepted; `responseFormat` accepted only as `{"type":"JSON","jsonSchema":…}` and the schema is **not enforced** (enum ignored), so every reply is parsed and validated in code; a new random `sessionId` returns 404 (sessions must exist first; deferred with the chat endpoints); token usage comes from `modelProviderUsage` (now logged as real tokens, previously estimated); `domogpt-small-v2.1` is enabled. | Live probes; Context7 docs do not list responseFormat |
| D41 | 2026-11-12 | Domo calls never send `sessionId` (setup guide troubleshooting: remove sessionId on 409; a new id returns 404 here, D40). Conversation grouping stays in our own tables. | User instruction |
| D42 | 2026-11-12 | Grounding check v2 (`loop.ungrounded_numbers`): a number is grounded when it is a rendering of a tool value — rounded to the answer's own precision; INR crore / lakh only when the unit follows the number; a fraction as a percentage only when % follows; dates in any common format (ISO, 27-Nov-2026, 27 Nov 2026, Nov 27, November 27) must exist in the results. v1 (string renderings) is kept for the baseline so false positives can be recounted: a v1 rejection that v2 accepts is a false positive. | User instruction; baseline showed 14/30 answers replaced by the template |
