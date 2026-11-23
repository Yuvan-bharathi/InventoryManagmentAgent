# Inventory Management Agent – Build Plan v2.1

Nov 10, 2026 · @Suman

## Purpose and scope

The agent balances material availability against working capital for raw material, WIP, packaging and finished goods. It is Agent 09 of the 20-agent Manufacturing Agentic AI Platform, and is built on the team's standard agent stack (React, FastAPI, LangChain, Domo AI Services, PostgreSQL).

The deck (slide 9) gives it five jobs:

- Monitor stock in all its states: on-hand, allocated, blocked, quality-held, in-transit and safety stock.

- Forecast consumption from the production plan × BOM, consumption history and seasonality.

- Flag shortages, excess, slow-moving, obsolete and shelf-life-risk items.

- Recommend reorder points, replenishment quantities, transfers and expedite priorities.

- Simulate what a shortage does to production orders and customer commitments.

| Deck item | What it covers |
| --- | --- |
| Outputs | Shortage horizon, replenishment proposals, excess/obsolete list, transfer recommendations, material risk dashboard |
| KPIs | Inventory turns, days of inventory, stockout hours, excess value, schedule disruption, inventory record accuracy |
| Source systems | SAP/ERP inventory and PO, MES consumption, WMS, production plan, supplier lead times, SQL Server, Excel stock files |
| Hard controls | No automatic PO release or stock adjustment without approval; respect MOQ, shelf life, approved vendors, lot controls and finance valuation rules |

## Business problem and automation scope

The wider goal is one application, built in 3 days, that lets the core company's leads make quick, well-informed decisions. For inventory, that means answering five questions fast:

- Will any line stop this week because of a material?

- How much cash is tied up in stock we don't need?

- What is about to expire or become waste?

- What is waiting for my approval, and why?

- If a supplier is late, what breaks?

What we know versus what we assume. Only the first three rows below are confirmed by the plant; the rest are common manufacturing problems to validate, and are never presented to leadership as facts about their plant.

| Finding | Status |
| --- | --- |
| Inventory is kept in Excel | Confirmed |
| Inventory reports are made by hand every day | Confirmed |
| Team time is spread across counting, supplier follow-ups, reporting and approvals | Confirmed |
| Shortages are found late, by comparing stock with the plan by hand | Hypothesis |
| Excess, slow-moving and expiring stock goes unnoticed | Hypothesis |
| Plants or stores can't easily see each other's stock | Hypothesis |
| Purchase approvals get stuck in email | Hypothesis |
| Stock records drift from physical stock | Hypothesis |

Because daily manual reporting is the confirmed pain, the demo opens with it: the plant's daily Excel goes in, and the daily stock report and 9 a.m. brief come out automatically. Shortage prediction and replenishment are the step up from there.

Three levels of automation:

| Level | What falls here |
| --- | --- |
| Fully automated | Excel ingestion and validation, stock consolidation, projections, shortage / excess / expiry detection, overdue POs, QC-hold ageing, daily report and brief |
| Automated up to a recommendation (a person approves) | Purchase proposals, transfers, excess disposition, safety stock and reorder point changes, supplier reminder emails |
| Stays human | Physical counts, QC accept/reject, supplier negotiation, write-offs, final purchase release |

Wording rule: the data is refreshed from uploaded files, not live. Every screen shows when the data was last refreshed and whether it is stale.

## Changes to the setup guide's design

The setup guide builds a general "chat with your database" agent; it is a good base, but four things change for inventory work.

| Guide default | Change for this agent | Why |
| --- | --- | --- |
| The LLM writes SQL and reasons over the results | Projected stock, shortage dates and reorder quantities are calculated in plain Python/SQL with unit tests; the LLM explains, ranks, answers and drafts | These numbers must be exactly right every time; this is the most important design decision |
| Raw run_sql tool, max 5 tool calls | Purpose-built tools such as get_shortage_horizon(plant, days); run_sql kept only for ad-hoc questions | Multi-join SQL from the model is slow and unreliable within 5 Domo calls |
| Read-only agent_ro role only | Keep agent_ro; add normal FastAPI endpoints with fixed logic for saving proposals and approvals | The model must never write to the database |
| No tenant concept | tenant_id and plant_id on every table and filtered in every tool | The deck describes a multi-tenant enterprise platform |

Everything else in the guide stays: the JSON-action loop, the Domo Text Generation wrapper, temperature 0 with responseFormat, the React theme, and the hardening checklist.

## Architecture

The agent runs in two modes. In the calculation run, triggered after each successful upload, the engine refreshes every number with no LLM involved, then one Domo call writes the daily brief. In chat mode, planners and buyers ask questions through the guide's JSON-action loop.

- Run tracking. Every calculation run is recorded in calculation_runs (upload, start and end time, status, data-quality summary), and every output row and proposal carries its run_id, so any number can be traced to the files it came from.

- Brief timing. The brief regenerates after each upload. At 9 a.m. the app shows the latest brief, with a stale warning if nothing was uploaded that day; no scheduler is needed for the demo.

- Domo fallback. If Domo is unavailable, dashboards and proposals keep working because the numbers come from the engine; the brief falls back to a template filled with engine numbers, and chat shows that the AI is unavailable.

architecture · 5 layers, 2 modes

The agent reads through business-specific tools that return validated JSON; only the engine and the approval endpoints write. Tenant identity always comes from the logged-in user's session, never from a tool argument the LLM fills in.

| Tool | What it returns |
| --- | --- |
| get_daily_brief | The day's summary: shortages, excess value, expiring lots, pending approvals, data freshness |
| get_inventory_overview | Health %, stock value, shortage count, excess value |
| get_stock_position | Usable, allocated, blocked, QC-hold and in-transit stock for a material |
| get_shortage_horizon | Materials projected to fall below safety stock, with the date |
| get_material_risk_ranking | Materials ranked by line-stoppage risk, customer impact, value and lead time |
| get_excess_inventory | Excess, slow-moving and obsolete items, with their value |
| get_expiring_lots | Lots that expire before projected use |
| get_replenishment_options | Approved suppliers, lead times, MOQ and proposed quantity |
| get_transfer_options | Surplus usable stock at other plants or locations |
| simulate_shortage_impact | Production orders affected by a supplier delay |
| get_proposal_details | The calculation inputs behind a proposal |
| get_schema, run_sql (from the guide) | Ad-hoc read-only queries, fallback only |

## Core calculations

All inventory numbers come from a deterministic Python/SQL engine, never from the LLM, and every result stores the inputs it used so a planner can check it.

Usable stock is physical stock that can be used today:

\text{Usable} = \text{On-hand} - \text{Allocated} - \text{Blocked} - \text{QC-hold}

Safety stock is a planning threshold, not a quantity to subtract.

Reservation rule. The reservations table is the single source of truth. Allocated stock is always calculated as the sum of open reservations and is never stored separately, so the same quantity can never be deducted twice.

Projected stock, for each material, plant and day:

\text{Projected}_d = \text{Usable} + \text{In-transit and PO receipts}_{\le d} - \text{Unreserved requirements}_{\le d}

Only the unreserved part of production requirements is subtracted. Example: on-hand 1,000, allocated 200, requirement 500 of which 200 is already reserved gives 1,000 − 200 − 300 = 500, not 300.

In-transit versus on order. In-transit is stock in a transfer that has been shipped but not yet received, and it counts on its expected arrival date. Open PO quantity is on order, not in transit, and counts on its promised date. The two are never added together.

Shortage date is the first day projected stock drops below safety stock.

Forecasting:

- Inside the planned horizon: production plan × BOM.

- Beyond the planned horizon: seasonal moving average of consumption history.

- Material with no BOM: flagged, falls back to the history-based forecast, and the result is marked lower confidence.

Reorder point and safety stock:

\text{ROP} = \bar{u} \times LT + SS \qquad SS = z \times \sigma_u \times \sqrt{LT}

Here ū is average daily usage, σ is the standard deviation of daily usage, LT is lead time in days, and z sets the service level.

Order quantity:

\text{Target} = \min\big(SS + \bar{u} \times (LT + R),\ \text{Max stock}\big) \qquad \text{Qty} = \text{Target} - \text{Projected}_{\text{arrival}}

R is the review period in days. The quantity is rounded up to the MOQ or lot multiple, reduced if part of it would expire before use, and sourced only from approved vendors. When the MOQ exceeds the need, the proposal says so.

Reconciliation. The uploaded stock snapshot is the truth for usable stock. Each upload checks previous snapshot + movements in between = new snapshot, per material and plant. Differences beyond a tolerance in inventory_policies are recorded as variances, and large adjustment movements are flagged.

QC-hold ageing. Stock whose status has been QC hold for longer than the policy limit is flagged, together with any shortage it is causing.

Classification rules:

- Excess: stock above the maximum, or days of cover above an agreed limit.

- Slow-moving or obsolete: no movement for N days, or no future demand.

- Shelf-life risk: a lot expires before its projected consumption date.

Transfers are checked before purchases: surplus usable stock at another plant or location, respecting lot status and quality.

Allocation conflicts are flagged when several production orders need more of a material than usable stock covers; orders are ranked by plan priority for the planner to decide.

Actual lead time per supplier and material is calculated from received versus promised PO dates. Shortage projections use the actual figure when it is longer than the promised one.

Risk ranking scores each at-risk material on line-stoppage risk, customer impact, value and replenishment lead time.

Shortage simulation answers "what if supplier A is 5 days late?" with the affected materials, new shortage dates, affected production orders and quantities, and transfer options.

All thresholds live in inventory_policies per tenant and plant, not in code.

## Excel ingestion

Excel stays the plant's input; the system does not replace it on day one. Users upload the daily files, the data-quality gate validates them, valid rows load into PostgreSQL, and a calculation run follows each successful upload. Each upload shows a validation report: rows accepted, rows rejected and why.

| File | Key columns |
| --- | --- |
| Material_Master.xlsx | Material code, description, type (RM / PKG / WIP / FG), UoM, shelf life, safety stock, max stock, ABC class |
| Current_Stock.xlsx | Plant, location, material, lot, quantity, status (available / blocked / QC hold / in transit), status since, snapshot date |
| Lots.xlsx (optional) | Lot, material, manufacture date, expiry date |
| Inventory_Movements.xlsx | Date, material, plant, movement type (receipt / issue / transfer out / transfer in / adjustment), quantity, reference |
| Production_Plan.xlsx | Order number, product, plant, quantity, planned date, priority |
| BOM_Master.xlsx | Parent, component, quantity per, UoM |
| Purchase_Orders.xlsx | PO number, line, material, supplier, PO date, ordered quantity, open quantity, promised date, status |
| Goods_Receipts.xlsx (optional) | PO number, line, received date, received quantity |
| Supplier_Master.xlsx | Supplier, material, lead time, MOQ, lot multiple, approved flag |
| Reservations.xlsx (optional) | Order number, material, plant, reserved quantity |

Missing data degrades gracefully, never silently:

- No Reservations.xlsx: allocated is 0 and all requirements count as unreserved.

- No Goods_Receipts.xlsx: actual lead time is not calculated and promised lead time is used, flagged as unverified.

- No Lots.xlsx: shelf-life checks are flagged as incomplete.

- Missing BOM: history-based forecast, marked lower confidence.

One PO line can have several receipts; a line is closed when received quantity reaches ordered quantity.

## Data model (PostgreSQL)

Every tenant-owned table carries tenant_id, and plant-specific tables carry plant_id. Isolation is enforced by PostgreSQL row-level security and backend authorization, never by filters the AI supplies.

| Category | Tables |
| --- | --- |
| Organization | tenants, plants, storage_locations |
| Material master | materials, material_lots, uom_conversions |
| Procurement | suppliers, approved_vendors, purchase_orders, goods_receipts |
| Production | bom, production_plans, reservations, consumption_history |
| Inventory | stock_balances, inventory_movements, stock_variances |
| Ingestion | uploads, upload_errors |
| Configuration | inventory_policies (safety stock, max stock, thresholds, tolerances, approval limit) |
| Intelligence | calculation_runs, inventory_projections, shortage_alerts, excess_inventory, daily_briefs |
| Recommendations | replenishment_proposals, transfer_proposals |
| Simulation | shortage_simulations |
| Governance | approval_logs, agent_run_logs |

The agent's agent_ro role gets SELECT only. Writes to proposal and approval tables go only through backend endpoints.

## Synthetic data plan

The demo runs on cooked data generated by Python scripts with a fixed random seed. The scripts write all ten Excel files in the plant's format, and the data goes in through the same upload path a real plant would use, so the demo shows the real flow and test cases can still be checked by hand. The sizes below are proposed starting points.

| Area | What the scripts generate |
| --- | --- |
| Tenants and plants | 2 tenants (to prove isolation), each with 2–3 plants and several storage locations |
| Materials and lots | All four types (RM, PKG, WIP, FG) with UoM, shelf life, ABC class; lots with manufacture and expiry dates |
| BOMs | Finished goods built from WIP, WIP built from raw material and packaging |
| Suppliers | Approved vendors per material, with lead time, MOQ and lot multiple |
| Movements | 12 months of receipts, issues, transfers and adjustments, with seasonality and noise |
| Forward data | Production plan, reservations and open POs for the next 8–12 weeks |

Generate each fact once. Movements are generated first; consumption_history is built from issue-to-production movements, and stock_balances from opening stock plus movements. A validation query checks that balances reconcile with movements.

Planted scenarios, each with a known expected outcome:

| Scenario | Expected outcome |
| --- | --- |
| Stock below safety stock | Shortage alert with correct date |
| Delayed supplier delivery | Updated shortage projection |
| QC-held stock hides a shortage | Correct usable-stock calculation |
| Reservation already exists | No double-counting |
| Excess stock | Excess quantity and value identified |
| No movement for a long period | Slow-moving alert |
| Lot expiring before use | Shelf-life warning |
| Surplus at another plant | Transfer proposal |
| MOQ exceeds requirement | MOQ-compliant proposal with explanation |
| Shortage hits production | Affected production orders identified |
| UoM mismatch | Data-quality failure |
| Stale stock snapshot | Data-freshness warning |
| Proposal below threshold | Buyer approval only |
| Proposal above threshold | Buyer and manager approval |
| Cross-tenant access | Access denied |

## Data-quality gate

The gate runs before every calculation run. If a critical check fails, the agent reports the affected records and says why results are blocked or limited, instead of giving misleading recommendations.

| Check | Behaviour |
| --- | --- |
| UoM mismatch | Flag incompatible units |
| Stale stock snapshot | Mark data as stale |
| Missing supplier lead time | Flag incomplete master data |
| Missing BOM | Flag; use history-based forecast, marked lower confidence |
| Invalid lot status | Exclude from usable stock |
| Missing expiry date | Flag shelf-life check as incomplete |
| Duplicate transaction | Detect and prevent double counting |
| Balances do not reconcile with movements | Flag the material and plant |

## Approval workflow and controls

The agent only proposes; a buyer or planner approves every purchase or transfer, and nothing is released to ERP automatically.

Each proposal moves through these states:

- Draft: created by the calculation engine.

- Pending buyer: passed business-rule checks (MOQ, approved vendor, shelf life, lot controls).

- Pending manager: only when the value is above the tenant's threshold.

- Approved or Rejected: rejection is possible from either pending state and needs a reason code.

- Fulfilled: the PO or transfer is confirmed and the receipt is tracked.

Every transition is written to approval_logs.

Two patterns carry over from the RetailPilot replenishment design:

- Transfer before purchase. Move stock from a plant or location with surplus to one with forecast need; raise a PO only when every location needs its own stock.

- Value-based approval levels. Proposals under a value threshold need one approver; larger ones need a second level. The threshold sits in inventory_policies.

Other controls:

- The LLM never writes to the database; proposals and approvals go through fixed FastAPI endpoints.

- Users see only their own tenant and plants (JWT or SSO, per the guide's hardening checklist).

- Every proposal shows the calculation inputs behind it, so the approver can see why.

## User interface

The UI extends the guide's React app (chat, conversation list, theme switching, tool trace) with seven pages. The reference screenshots are design direction, not the final specification. Every page shows the last refresh time.

| Page | What it shows | Visual reference |
| --- | --- | --- |
| 0. Data Upload | Upload the daily Excel files; validation report with accepted and rejected rows | — |
| 1. Inventory Overview | 9 a.m. brief, health tiles (at risk, out of stock, overstocked, healthy), stock value, excess value, daily stock report download | Forstock stock-health tiles |
| 2. Material Detail & Projection | Projected stock line, reorder point, expected receipts, suggested replenishment and its inputs | Intuendi stock evolution chart |
| 3. Proposals & Approvals | Proposal status, buyer and manager approval, expiring items | Procurement app status tiles |
| 4. Monitoring & Risk Ranking | Risk-labelled table by material and plant, % below reorder point, production impact | Power BI risk diagnostic |
| 5. Transfers & Excess | Transfers in and out by location, stock value by location, excess and obsolete items | Transfer / cost analysis screens |
| 6. AI Agent Workspace | Chat, step-by-step tool trace, explanations and recommendations | AI agent activity panel |

Three of the references are retail designs, so every page uses manufacturing terms:

- Sales → consumption; no sales → no movement.

- Products → materials, typed RM, PKG, WIP or FG.

- Warehouses → plants and storage locations.

- Lot status, expiry and affected production orders shown where relevant.

Inventory Health % = active materials within stock limits ÷ total active materials × 100, counted per material and plant. Active means the material had stock or demand in the last 90 days. A material is within limits when its projected stock stays between safety stock and maximum stock over the planning horizon; with no maximum set, staying above safety stock is enough.

## 3-day MVP plan

The MVP comes first and covers the P0 items; P1 items go in only if the day's P0 work is finished.

| Priority | Capability |
| --- | --- |
| P0 | Excel upload with validation report (data-quality gate) |
| P0 | Unified stock view with last-refresh time |
| P0 | Automated daily stock report and 9 a.m. AI brief |
| P0 | Shortage horizon with affected production orders |
| P0 | Replenishment proposal with buyer and manager approval |
| P1 | Excess and expiry list with value |
| P1 | Transfer suggestion, allocation conflicts, actual vs promised lead time |
| P1 | Supplier-delay simulation |

| Day | Build | End-of-day check |
| --- | --- | --- |
| Day 1: data and calculations | Synthetic .xlsx files; core tables and migrations; upload and validation; usable stock, projection and shortage date | Upload the files and see correct shortage dates for the planted cases |
| Day 2: decisions and agent | Replenishment and approval states; daily report and brief; agent tools and Domo loop | Ask the agent which lines are at risk and get a correct, explained answer |
| Day 3: screens and demo | Upload, Overview, Material Detail and Proposals pages; P1 items if time; demo script | Full walk-through from upload to approved proposal |

Tenant isolation is enforced in backend queries from Day 1; full row-level-security hardening follows the demo.

## Delivery phases

After the 3-day MVP, the full build runs in nine phases, and each one ends with a gate that can be checked before the next starts. Durations are not set yet; they depend on the answers to the open questions below.

delivery roadmap · 9 phases with exit gates

The data-quality gate and calculation engine (phases 3 and 4) come before the agent layer, so the agent's tools always have tested numbers to return.

## Decisions

This register is the agreed v2 baseline; the architecture is fixed and work moves to implementation.

| v2 change | Decision |
| --- | --- |
| Data source | The plant keeps inventory in Excel; eight daily input files, uploaded and validated |
| Synthetic data | Generated as those eight .xlsx files and loaded through the upload path |
| Wording | "Refreshed", never "live"; last-refresh time on every screen |
| Demo opening | Automated daily stock report and 9 a.m. brief (the confirmed pain) |
| Approval states | Draft, pending buyer, pending manager (above threshold), approved or rejected, fulfilled |
| New P1 features | Allocation conflicts; actual vs promised lead time |
| Deferred | Material substitution, cycle-count scheduling, advanced forecasting, ERP integration |

v2.1 corrections, resolved before Day 1 coding:

| v2.1 change | Decision |
| --- | --- |
| Excel contract | Ten files: adds optional Reservations.xlsx and Goods_Receipts.xlsx; Purchase_Orders.xlsx gains PO date, line and open quantity; Current_Stock.xlsx gains in-transit status and status-since date |
| Reconciliation | Snapshot is the truth; previous snapshot + movements must match the new one within tolerance; differences become variances |
| In-transit | Shipped, unreceived transfers only; open PO quantity is on order and kept separate |
| Order quantity | Target from safety stock, demand over lead time plus review period, capped at max; minus projected stock at arrival; rounded to MOQ |
| Inventory Health | Per material and plant; active = stock or demand in the last 90 days |
| Brief timing | Regenerated after each upload; stale warning if no upload that day |
| New P0 | Calculation run tracking, partial receipts, Domo fallback |
| New P1 | QC-hold ageing, stock adjustment variance |

The full register, including decisions carried over from v1:

| Topic | Decision |
| --- | --- |
| Tenancy | Multi-tenant from day one; PostgreSQL row-level security; tenant identity from the authenticated session |
| Inventory types | RM, PKG, WIP and FG; material types in a config table |
| Data | Synthetic: 2 tenants, 12 months, Python seed scripts with a fixed seed, planted scenarios |
| Calculations | Deterministic Python/SQL; the LLM never does inventory arithmetic |
| Reservations | reservations is the source of truth; allocated is derived, never stored |
| Forecasting | Plan × BOM inside the planned horizon; seasonal moving average beyond it |
| Data quality | Mandatory gate before every calculation run |
| AI | LangChain JSON-action loop + Domo AI, temperature 0, max 5 steps |
| Stack | React + Vite, FastAPI, SQLAlchemy + Alembic, PostgreSQL |
| Approvers | Buyer approves every proposal; plant or procurement manager also approves above a per-tenant value threshold |
| Inventory Health % | Active materials within projected stock limits ÷ total active materials |
| Agent hand-offs | None in this phase (Supplier Performance and RFQ agents later) |
| Evaluation | 30–50 questions with known answers, expanded as the agent grows |
| Domo access | Developer token available; kept in the backend .env only |
| Next deliverable | Database Design & Synthetic Data Specification |

Still open:

- ☐ Confirm the Domo model ID enabled for Text Generation in the Playground (the guide's example is domo.domo_ai.domogpt-small-v2.1:anthropic).

- ☐ Confirm the Domo usage quota, to set per-user rate limits.

