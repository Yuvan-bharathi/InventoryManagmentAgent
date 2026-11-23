# CLAUDE.md — Inventory Management Agent (Agent 09) · v2.1

Agent 09 of the Manufacturing Agentic AI Platform, built for one core manufacturing company
in a 3-day MVP. The plant keeps inventory in **Excel** and makes reports **by hand every day**.
The app ingests those Excel files and produces the outputs below, so leads can decide fast:
- validated stock
- shortage dates
- replenishment proposals with approvals
- an automatic daily report and 9 a.m. brief

Full plan: "Inventory Management Agent – Build Plan v2.1" (Claude Doc). This file is the working
summary for coding. If code and this file disagree, ask before changing either.

## The five questions the product must answer

1. Will any line stop this week because of a material?
2. How much cash is tied up in stock we don't need?
3. What is about to expire or become waste?
4. What is waiting for my approval, and why?
5. If a supplier is late, what breaks?

## Stack

- Frontend: React + Vite (extends the setup guide's chat app: conversations, theme, tool trace)
- Backend: FastAPI, SQLAlchemy, Alembic migrations, Python 3.11+; openpyxl/pandas for Excel
- Agent: LangChain JSON-action loop calling Domo AI Text Generation (no native tool calling)
- Database: PostgreSQL
- Dev machine: Windows 11, Git Bash and CMD

## Non-negotiable rules

1. **The LLM never does inventory arithmetic.** Every quantity, date, value and score comes
   from the deterministic engine in `backend/app/engine/`. The agent only explains, ranks,
   answers and drafts text from tool results.
2. **The LLM never writes to the database.** The agent uses the read-only `agent_ro` role.
   Uploads, proposals and approvals go through FastAPI endpoints with fixed logic.
3. **Nothing is executed automatically.** The system never releases a PO, adjusts stock,
   moves a transfer or writes off stock. A person approves:
   - the buyer, for every proposal;
   - plus a manager, above the tenant's value threshold.
4. **Tenant identity comes only from the authenticated session.** Never accept `tenant_id`
   as a tool argument or request parameter. Enforce it in every backend query from Day 1.
   Full RLS hardening comes after the demo.
5. **Every recommendation is explainable.** Store the calculation inputs with each result:
   - demand
   - usable stock
   - lead time (promised and actual)
   - MOQ
   - safety stock
   - constraints applied
6. **Thresholds live in `inventory_policies`, never hard-coded.**
7. **Say "refreshed", never "live" or "real-time".** Every screen and the brief show the
   last refresh time and a stale-data warning when applicable.

## Excel ingestion (front door of the system)

Upload → data-quality gate → load valid rows → calculation run → brief regenerated.

Each upload returns a validation report: rows accepted, rows rejected with reasons. Rejected
rows never load.

| File | Key columns |
| --- | --- |
| `Material_Master.xlsx` | material_code, description, type (RM/PKG/WIP/FG), uom, shelf_life_days, safety_stock, max_stock, abc_class |
| `Current_Stock.xlsx` | plant, location, material_code, lot, quantity, status (available/blocked/qc_hold/in_transit), status_since, snapshot_date |
| `Lots.xlsx` (optional) | lot, material_code, mfg_date, expiry_date |
| `Inventory_Movements.xlsx` | date, material_code, plant, movement_type (receipt/issue/transfer_out/transfer_in/adjustment), quantity, reference |
| `Production_Plan.xlsx` | order_no, product_code, plant, quantity, planned_date, priority |
| `BOM_Master.xlsx` | parent_code, component_code, qty_per, uom |
| `Purchase_Orders.xlsx` | po_no, line, material_code, supplier, po_date, ordered_qty, open_qty, promised_date, status |
| `Goods_Receipts.xlsx` (optional) | po_no, line, received_date, received_qty |
| `Supplier_Master.xlsx` | supplier, material_code, lead_time_days, moq, lot_multiple, approved |
| `Reservations.xlsx` (optional) | order_no, material_code, plant, reserved_qty |

Ten files in total: seven required, three optional.

Missing data degrades gracefully, never silently:
- No `Reservations.xlsx`: allocated = 0 and all requirements count as unreserved.
- No `Goods_Receipts.xlsx`: actual lead time is not calculated; use promised lead time,
  flagged `lead_time_verified = false`.
- No `Lots.xlsx`: shelf-life checks are flagged incomplete.
- Missing BOM: fall back to the history forecast, with `confidence = 'low'`.

## Domain rules

### Stock

- Usable = On-hand − Allocated − Blocked − QC-hold
- Safety stock is a planning threshold. Never subtract it as a quantity.
- `reservations` is the single source of truth. Allocated is always derived from open
  reservations and is never stored as a separate column.
- In-transit = transfers shipped (`transfer_out`) but not yet received (`transfer_in`).
  It counts on the expected arrival date.
- Open PO quantity is **on order**, not in-transit. It counts on its promised date.
  Never add the two together.

### Projection

- Projected(d) = Usable + in-transit and PO receipts up to d − unreserved requirements up to d
- Subtract only the unreserved part of requirements.
  Example: on-hand 1000, allocated 200, requirement 500 with 200 reserved → 1000 − 200 − 300 = 500.
- Shortage date = first day projected stock is below safety stock.

### Lead time

- Actual lead time = first `received_date` − `po_date`, per supplier and material, from
  `Goods_Receipts.xlsx`.
- One PO line can have several receipts (partial receipts). A line closes when total
  `received_qty` reaches `ordered_qty`.
- When the actual lead time is longer than the promised one, projections use the actual figure.

### Forecasting

- Inside the planned horizon: production plan × BOM.
- Beyond it: seasonal moving average of consumption, built from issue movements.

### Replenishment

- ROP = average daily usage × lead time + safety stock
- SS = z × σ(daily usage) × √(lead time)
- Target = min(SS + avg daily usage × (lead time + review period), max stock).
- Qty = Target − projected stock on the arrival date.
- Round Qty up to MOQ or lot multiple.
- Reduce Qty if part of it would expire before use.
- Approved vendors only.
- When MOQ exceeds the need, say so.

### Transfers

- Check transfers before proposing a PO.
- Surplus at the source = its usable stock − its own projected need − its safety stock.
- Never fix one plant by creating a shortage at another.

### Allocation conflicts

- Flag when production orders need more of a material than usable stock covers.
- Rank the orders by plan priority. The planner decides.

### Classification

- Excess: above max stock, or days of cover above the policy limit.
- Slow-moving: no movement for N days.
- Shelf-life risk: a lot expires before its projected consumption date.

### Reconciliation

- The uploaded stock snapshot is the truth for usable stock.
- Each upload checks, per material and plant:
  previous snapshot + movements in between = new snapshot.
- Differences beyond the tolerance in `inventory_policies` go to `stock_variances`.
- Adjustment movements above a threshold are flagged.

### QC-hold ageing

- Flag stock in `qc_hold` longer than the policy limit, using `status_since`.
- Link it to any shortage it causes.

### Inventory Health %

- Counted per material × plant.
- Active = the material had stock or demand in the last 90 days.
- Healthy = projected stock stays within [safety stock, max stock] over the configured
  horizon. With no max stock set, staying above safety stock is enough.
- Health % = healthy active ÷ total active × 100.

## Data-quality gate

| Check | Behaviour |
| --- | --- |
| Missing required column / wrong type | Reject file with message |
| UoM mismatch | Flag incompatible units |
| Stale stock snapshot | Mark data as stale |
| Missing supplier lead time | Flag incomplete master data |
| Missing BOM | Flag; history forecast, low confidence |
| Invalid lot status | Exclude from usable stock |
| Missing expiry date | Flag shelf-life check incomplete |
| Duplicate transaction | Detect; do not double count |
| Balances do not reconcile with movements | Flag material and plant |

When a critical check fails, return the affected records and the reason. Never produce a
silent or partial recommendation.

## Database

Every tenant-owned table has `tenant_id`; plant-specific tables also have `plant_id`.

| Category | Tables |
| --- | --- |
| Organization | `tenants`, `plants`, `storage_locations` |
| Material master | `materials`, `material_lots`, `uom_conversions` |
| Procurement | `suppliers`, `approved_vendors`, `purchase_orders`, `goods_receipts` |
| Production | `bom`, `production_plans`, `reservations`, `consumption_history` |
| Inventory | `stock_balances`, `inventory_movements`, `stock_variances` |
| Ingestion | `uploads` (file, user, time, status), `upload_errors` (row, column, reason) |
| Configuration | `inventory_policies` |
| Intelligence | `calculation_runs`, `inventory_projections`, `shortage_alerts`, `excess_inventory`, `daily_briefs` |
| Recommendations | `replenishment_proposals`, `transfer_proposals` |
| Simulation | `shortage_simulations` |
| Governance | `approval_logs`, `agent_run_logs` |

- Schema changes only through Alembic migrations.
- `calculation_runs` records each run: upload_id, started_at, finished_at, status, and a
  data-quality summary. Every output row and proposal carries `run_id`, so any number
  traces back to its files.
- Proposal states:
  - `draft` → `pending_buyer` → `pending_manager` (only above threshold) → `approved`
  - `rejected` is reachable from either pending state and requires a reason code.
  - `approved` → `fulfilled`.
- Every transition is written to `approval_logs`.

## Synthetic data

- Generators live in `backend/seed/`, use a fixed random seed, and **write all ten `.xlsx`
  files in the plant format above**.
- Load them through the real upload endpoint. Never insert straight into the database.
- Scale: 2 tenants, 2–3 plants each, all four material types, 12 months of movements,
  8–12 weeks of forward plan and open POs.
- **Generate each fact once:**
  1. Generate movements first.
  2. Build `consumption_history` from issue movements.
  3. Build stock balances from opening stock plus movements.
  4. Check with a validation query that they reconcile.
- Planted scenarios, each with a known expected result:
  - shortage below safety stock
  - delayed PO
  - supplier whose actual lead time > promised
  - partial receipt on a PO line
  - snapshot variance beyond tolerance
  - large stock adjustment
  - QC hold older than the limit
  - QC hold hiding a shortage
  - existing reservation (no double count)
  - allocation conflict
  - excess
  - no movement
  - expiring lot
  - transfer surplus
  - MOQ > need
  - production impact
  - UoM mismatch
  - stale snapshot
  - bad rows in an upload
  - proposals below and above the threshold
  - cross-tenant access

## Agent

- Loop: the guide's JSON-action loop, temperature 0, `responseFormat` JSON, max 5 steps.
- Domo settings come from `.env` only. Never commit tokens. Variables:
  - `DOMO_INSTANCE`
  - `DOMO_DEVELOPER_TOKEN`
  - `DOMO_MODEL_ID` (still to confirm in the Domo AI Playground)
  - `DATABASE_URL`
- Tools return validated JSON (Pydantic) from engine services, never model-written SQL:
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
- `get_schema` / `run_sql` are a read-only fallback only.
- Daily brief: after each calculation run, one Domo call turns engine output into a short
  summary covering:
  - shortages
  - excess value
  - expiring lots
  - overdue POs
  - pending approvals
  - data freshness
  Store it in `daily_briefs`. Numbers in the brief must come from the engine output.
- Brief timing:
  - It regenerates after each upload; there is no scheduler in the MVP.
  - At 9 a.m. the app shows the latest brief.
  - If nothing was uploaded that day, show a stale warning.
- **Domo fallback:**
  - If a Domo call fails or times out, dashboards and proposals keep working, because the
    numbers come from the engine.
  - The brief falls back to a template filled with engine numbers.
  - Chat shows "AI is unavailable right now".
  - Never block the UI on Domo.
- Log every run to `agent_run_logs`: question, tool calls, data-quality status, Domo latency
  and usage.

## Suggested layout

```
backend/
  app/
    api/        # routers: uploads, inventory, proposals, approvals, briefs, chat
    ingest/     # Excel readers, column mapping, per-file validation
    dq/         # data-quality gate
    engine/     # deterministic calculations — pure functions, fully unit-tested
    reports/    # daily stock report (xlsx/pdf) from engine output
    agent/      # LangChain loop, Domo client, tools
    models/     # SQLAlchemy models
    schemas/    # Pydantic models
    auth/       # session, tenant context, roles
  alembic/
  seed/         # synthetic .xlsx generators + scenario definitions
  tests/
frontend/
  src/pages/    # Upload, Overview, MaterialDetail, Proposals, Risk, Transfers, AgentWorkspace
```

## Current phase: 3-day MVP

### P0 (must ship)

- Excel upload + validation report
- Unified stock view with last-refresh time
- Calculation run tracking (`run_id` on every output)
- Partial goods receipts
- Domo fallback (the demo must survive Domo being down)
- Daily stock report + 9 a.m. AI brief
- Shortage horizon with affected production orders
- Replenishment proposal + buyer/manager approval

### P1 (only after the day's P0 work is done)

- Excess and expiry list with value
- Transfer suggestion
- Allocation conflicts
- Actual vs promised lead time
- QC-hold ageing
- Stock adjustment variance
- Supplier-delay simulation

### Day 1: data and calculations

- Synthetic `.xlsx` files (all ten)
- Core tables and migrations
- Upload and validation
- Usable stock, projection and shortage date

Done when: upload the files and see correct shortage dates for the planted cases.

### Day 2: decisions and agent

- Replenishment proposals and approval states
- Calculation run tracking and the Domo fallback
- Daily report and brief
- Agent tools and the Domo loop

Done when: ask "which lines are at risk this week?" and get a correct, explained answer.

### Day 3: screens and demo

- Pages: Upload, Overview (with brief), Material Detail, Proposals
- P1 items if time allows
- Demo script

Done when: a full walk-through from upload to approved proposal works.

Demo order:
1. Upload the daily files.
2. Show the validation report.
3. Show the automatic daily report and brief (the confirmed pain).
4. Show the shortage horizon.
5. Show the proposal.
6. Approve it.
7. Ask the agent "why?"

### Out of scope now

- Material substitution
- Cycle-count scheduling
- Advanced forecasting
- ERP/MES integration
- Hand-offs to the Supplier Performance (10) and RFQ (11) agents

## Testing

- Every engine function has unit tests against hand-calculated cases. Planted scenarios are
  the fixtures.
- Required tests:
  - upload rejects bad rows
  - tenant isolation
  - approval transitions
  - the reservation double-count case
  - transfer surplus never creates a source shortage
  - partial receipts close a PO line correctly
  - in-transit and on-order are never double counted
  - the app works with Domo disabled
- Agent eval: start with the five leadership questions plus scenario questions with known
  answers. Grow to 30–50 after the demo.

## Working agreements

- Explain changes in plain language. Correctness over completeness.
- Keep the backend optimized: batch queries, no N+1, bulk inserts for uploads, cache
  read-heavy endpoints where safe.
- Ask before:
  - adding a dependency
  - changing a formula above
  - changing the Excel column contract
  - touching auth or tenant scoping

### Synthetic dataset development rule

- Use the generated `Inventory_Synthetic_Dataset_v2.1.zip` for initial development and testing.
- Keep Tenant Alpha and Tenant Beta in separate upload contexts.
- Never mix tenant data or hardcode tenant identity from uploaded Excel columns.
- Load synthetic files through the actual Excel upload and validation workflow.
- Do not insert synthetic records directly into production tables.
- Preserve all planted scenarios and their expected outcomes as test fixtures.
- When actual company Excel files arrive, inspect and map their columns, units, status codes and movement conventions before replacing the synthetic input.
- Never assume synthetic data represents actual company inventory.
- Keep the calculation engine independent of the dataset source.