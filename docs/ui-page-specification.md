# Inventory Management – UI Page Specification

Nov 11, 2026 · @Suman

## Purpose and principles

The Inventory application has 26 pages in 8 modules, specified here page by page: what each page is for, who uses it, its sections, the data each section shows, and the table or service it comes from. Eight pages form the 3-day MVP; the rest follow in later phases on the same data model (see Build phasing).

Each page is specified the same way: a line with purpose, users and priority, then a table of sections with the data they show and its source, then filters and actions. Field names match the database and the Excel contract in Build Plan v2.1.

Six principles apply to every page:

- Exceptions first. The top of every page shows what needs a decision; full data sits below. A plant head should know what to do within 10 seconds.

- Every number explains itself. Clicking any figure opens its inputs and the calculation run it came from.

- Drill down, never dead-end. Company → plant → material → lot → movement; every row opens its detail page.

- Refreshed, not live. Every page shows the last refresh time and warns when data is stale.

- Act where you look. Proposals, transfers and escalations start from the page where the problem is seen, and always go to approval.

- The agent is everywhere. An assistant side panel on every page knows the page and the selected item.

## Information architecture

The left navigation follows the order people work in: see the situation (Home), check the stock (Inventory), look ahead (Planning), act (Replenishment, Optimization), review (Insights), and keep the data and settings right (Data, Administration).

sitemap · 8 modules, 26 pages

Filled dots mark the eight MVP pages; every other page is designed now and built in later phases on the same data.

## Global shell and shared standards

Every page sits in the same shell and uses the same components, so the 26 pages are built from a small kit rather than one by one.

| Element | What it contains |
| --- | --- |
| Header | Tenant name, plant selector (All plants or one), global search (material, lot, PO, production order), refresh badge ("Data refreshed 08:42 today · run #148"), notifications, user and role |
| Left navigation | The 8 modules with their pages; collapsible; badge counts on My Work, Proposals and Data Quality |
| Banners | Stale data (no upload today or file past its staleness limit), data-quality failure, AI unavailable; each links to its cause |
| Agent side panel | Opens from any page; knows the page, the plant filter and the selected row; answers with links to the items it cites |
| Breadcrumb | Module › page › item, for drill-down navigation |

Status labels. One set everywhere, always shown as colour plus text:

| Label | Meaning |
| --- | --- |
| Critical | Projected below safety stock within the replenishment lead time |
| At risk | Projected below safety stock later in the planning horizon |
| Healthy | Projected between safety stock and maximum stock |
| Excess | Above maximum stock, or days of cover above the policy limit |
| Stale | Data missing or older than its staleness limit; no judgement made |

Data grid standard. Every list uses one grid: server-side paging, sorting and filtering; column chooser; saved views; export to .xlsx of the filtered rows; sticky header; row click opens the detail page; density toggle.

KPI tile standard. Value, change versus the previous run, a definition tooltip, the run it came from, and a click-through to the filtered list behind it.

Formats. Currency in ₹ with lakh and crore grouping; quantities always with their UoM; dates as 11-Nov-2026; times in IST.

Page states. Every page designs for loading (skeleton), empty, stale, data-quality failed, AI unavailable and no permission.

Performance target. Each page loads in under 2 seconds on demo data; totals are calculated on the server, never in the browser.

## Roles and permissions

Eight roles see the same data model, scoped to the plants they are assigned to; each lands on the page that matches its daily job.

| Role | Daily job | Lands on |
| --- | --- | --- |
| Leadership / Plant head | Decide on risks, cash and escalations | Executive Overview |
| Inventory manager | Keep stock healthy and records accurate | My Work |
| Production planner | Keep lines supplied; resolve allocation conflicts | Shortage Horizon |
| Buyer | Raise and approve replenishment (level 1) | Proposals |
| Procurement manager | Approve proposals above the value threshold (level 2) | Proposals |
| Stores / warehouse | Upload daily files; handle lots, QC holds and transfers | Data Uploads |
| Data admin | Data quality, master data views, policies | Data Quality |
| System admin | Users, roles, plant access, audit | Users and Roles |

Permissions by module (V = view, A = act, L1 / L2 = approve at that level, — = hidden):

| Module | Leadership | Inv. manager | Planner | Buyer | Proc. manager | Stores | Data admin | Sys admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | V | A | A | A | A | A | V | V |
| Inventory | V | A | V | V | V | A | V | V |
| Planning | V | A | A | V | V | V | V | V |
| Replenishment | V | A | V | A, L1 | A, L2 | V | V | V |
| Optimization | V | A | V | A | V | V | V | V |
| Insights | V | V | V | V | V | V | V | V |
| Data | V | V | V | V | V | A | A | A |
| Administration | — | V | — | — | — | — | A | A |

Policy changes need the data admin role and take effect from the next calculation run; every permission check is enforced in the backend, never only by hiding buttons.

## 1. Home

### 1.1 Executive Overview

Purpose: answer the five leadership questions in one screen. Users: leadership, plant heads, managers. Priority: MVP.

| Section | Data shown | Source |
| --- | --- | --- |
| Daily brief card | AI summary (shortages, cash, expiry, approvals, overdue POs, data freshness); generated time; run number; "template" tag when Domo was unavailable | daily_briefs |
| KPI tiles (8) | Inventory Health %; total inventory value ₹; materials critical in 7 days; production orders at risk; excess value ₹; expiring in 30 days ₹; pending approvals (count and ₹); overdue PO lines | inventory_projections, shortage_alerts, excess_inventory, material_lots, proposals, purchase_orders |
| Shortage strip | Count of materials going critical per day for the next 14 days | shortage_alerts |
| Needs attention | Top 10 actions: priority, item, issue, impact (orders, ₹), act-by date, one action button | All alert and proposal tables, ranked by the engine |
| Inventory value mix | Value by material type (RM / PKG / WIP / FG) and by plant | stock_balances × materials.standard_cost |
| Health trend | Health % and days of inventory over 30 runs | calculation_runs history |
| Plant comparison | Plant, health %, value, critical count, excess ₹, approvals pending, data freshness | Aggregates per plant |

Filters: plant, material type. Actions: open any tile's list, download the daily stock report (.xlsx), ask the agent.

### 1.2 My Work

Purpose: one inbox of everything waiting for the signed-in user. Users: all roles. Priority: Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| Approvals awaiting me | Proposal, material, quantity, value, needed-by date, age, level (L1 / L2) | Proposals in a pending state for my role and plants |
| Alerts for my role | Type (shortage, QC hold, overdue PO, variance, expiry), item, severity, raised at, status | Alert tables filtered by role |
| My recent decisions | What I approved, rejected or acknowledged in the last 30 days | approval_logs, alert_actions |
| Saved views | My saved filters on any grid | saved_views |

Actions: approve or reject in place, acknowledge or snooze an alert with a comment, assign to a colleague.

## 2. Inventory

### 2.1 Stock Explorer

Purpose: one trusted view of all stock, replacing the plant's Excel sheets. Users: inventory manager, stores, planners. Priority: MVP.

| Section | Data shown | Source |
| --- | --- | --- |
| Summary strip | Quantity and value for on-hand, usable, allocated, blocked, QC hold, in transit | stock_balances, reservations |
| Stock grid | Material code, description, type, ABC, plant, location, UoM, on-hand, allocated, blocked, QC hold, in transit, usable, safety stock, max stock, days of cover, status label, stock value ₹, last movement date | stock_balances, materials, inventory_projections |
| Group-by | Plant, location, material type or ABC class, with subtotals | Same, aggregated |

Filters: plant, location, type, ABC, status, supplier, text search. Actions: open Material 360, export, save view, ask the agent about the selection.

### 2.2 Material 360

Purpose: everything about one material at one plant, and what to do about it. Users: all operational roles. Priority: MVP (Overview, Demand and Supply tabs); other tabs Phase 2.

| Tab | Data shown | Source |
| --- | --- | --- |
| Header (always visible) | Code, description, type, UoM, ABC, shelf life, standard cost, preferred supplier, status label, open proposal if any | materials, approved_vendors, proposals |
| Overview | Stock breakdown bar (usable / allocated / blocked / QC / in transit); usable, days of cover, ROP, safety stock, max, shortage date; projection chart for 60 days with safety–max band, receipt markers and requirement bars; recommendation card (PO or transfer) with every calculation input | inventory_projections, shortage_alerts, proposals |
| Stock by location and lot | Location, lot, quantity, status, status since, expiry date, days to expiry | stock_balances, material_lots |
| Demand | Requirements by production order (order, product, required, reserved, unreserved, date, priority); 12-month consumption with forecast line | production_plans, bom, reservations, consumption_history |
| Supply | Open PO lines (PO, line, supplier, ordered, received, open, promised date, days overdue); receipts history; promised vs actual lead time per supplier | purchase_orders, goods_receipts, approved_vendors |
| Where used | Parent items in the BOM and their planned production | bom, production_plans |
| History | Movements, variances, proposals and decisions for this material | inventory_movements, stock_variances, approval_logs |

Actions: create replenishment or transfer proposal (shows the calculation before submitting), ask the agent "why", export.

### 2.3 Lots and Expiry

Purpose: stop shelf-life write-offs. Users: inventory manager, stores. Priority: Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| KPI tiles | Value expiring in 30, 60 and 90 days; expired stock still on hand | material_lots, stock_balances |
| Expiry grid | Lot, material, plant, location, quantity, manufacture date, expiry date, days to expiry, projected use before expiry, quantity at risk, value at risk, FEFO rank, suggested action | material_lots, inventory_projections |

Actions: propose transfer to a plant that can use it in time, propose disposition (goes to approval), export.

### 2.4 QC Hold Monitor

Purpose: find stock stuck in quality inspection, especially where it causes a shortage. Users: inventory manager, planners, stores. Priority: Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| KPI tiles | Quantity and value in QC hold; lots over the age limit; shortages caused by QC hold | stock_balances, shortage_alerts |
| QC grid | Lot, material, plant, quantity, status since, days in QC, age limit, linked shortage date, receipt reference | stock_balances, goods_receipts, inventory_policies |

Actions: escalate to quality (recorded with comment), export.

### 2.5 Movements Ledger

Purpose: a searchable record of every stock movement. Users: inventory manager, data admin. Priority: Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| Totals | Receipts, issues, transfers out and in, adjustments for the selected period | inventory_movements |
| Ledger grid | Date, material, plant, location, movement type, quantity, UoM, reference, upload, large-adjustment flag | inventory_movements, uploads |

Filters: date range, movement type, plant, material, reference.

### 2.6 Stock Reconciliation

Purpose: measure and improve inventory record accuracy, a deck KPI. Users: inventory manager, data admin. Priority: Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| KPI tiles | Record accuracy % (materials within tolerance ÷ all), variance value ₹, large adjustments this week | stock_variances |
| Variance grid | Material, plant, previous snapshot, net movements, expected quantity, new snapshot, variance quantity and %, variance value, tolerance, status, run | stock_variances, calculation_runs |

Actions: mark reviewed with a comment, export for cycle count.

## 3. Planning

### 3.1 Shortage Horizon

Purpose: see every coming shortage early enough to act, and whether there is still time to replenish. Users: planners, buyers, inventory manager. Priority: MVP.

| Section | Data shown | Source |
| --- | --- | --- |
| Heat map | Materials (rows) × next 30 days (columns), each cell coloured by projected status; daily or weekly view | inventory_projections |
| Shortage grid | Material, plant, type, usable now, shortage date, days until shortage, shortage quantity, lead time (promised and actual), in time to replenish (yes / expedite / no), orders affected, recommended action, proposal status | shortage_alerts, approved_vendors, goods_receipts, proposals |

Filters: horizon (7, 14, 30, 60 days), plant, type, status. Actions: create proposal, open Material 360, ask the agent for options.

### 3.2 Production Impact

Purpose: show which production orders are at risk and settle conflicts over scarce material. Users: planners, plant head. Priority: Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| Orders at risk | Production order, product, plant, planned date, quantity, priority, short materials (count), worst material and its shortage date, quantity at risk, status (blocked / at risk / clear); customer and due date when provided | production_plans, bom, inventory_projections |
| Allocation conflicts | Material, plant, usable stock, total requirement, gap, competing orders ranked by priority, suggested sequence | Engine allocation check |

Actions: record the planner's decision on a conflict (the plan itself is not changed by the system), notify buyer, export.

### 3.3 What-If Simulation

Purpose: answer "if this goes wrong, what breaks?" before it happens. Users: planners, buyers, plant head. Priority: Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| Scenario input | Type: supplier delay (supplier, days), PO line delay (line, days), demand change (product or order, %); plant scope | User input |
| Before vs after | New shortages, changed shortage dates, orders newly at risk, value at risk | Engine simulation, shortage_simulations |
| Affected materials | Projection chart per material with baseline and scenario lines | Engine simulation |
| Mitigations | Transfer, expedite or alternate approved supplier, each with quantity, arrival date and cost | Engine options |

Actions: save and name the scenario, create proposals from a mitigation, ask the agent to summarise.

## 4. Replenishment

### 4.1 Proposals

Purpose: the worklist of every purchase and transfer proposal, from draft to fulfilment. Users: buyers, procurement manager, inventory manager. Priority: MVP.

| Section | Data shown | Source |
| --- | --- | --- |
| State tabs | Draft · Pending buyer · Pending manager · Approved · Rejected · Fulfilled, each with count and value ₹ | replenishment_proposals, transfer_proposals |
| KPI tiles | Value awaiting approval, oldest pending age, average approval time this week | Proposals, approval_logs |
| Proposal grid | Proposal number, type (PO / transfer), material, plant, quantity, UoM, supplier or source plant, unit price, value ₹, needed-by date, shortage date, state, approval level, age, run | Proposals, calculation_runs |

Filters: state, plant, supplier, value range, needed-by. Actions: open detail, submit drafts, bulk approve (only below the manager threshold), export.

### 4.2 Proposal Detail

Purpose: everything an approver needs to decide on one proposal without opening another screen. Users: buyers, procurement manager. Priority: MVP.

| Section | Data shown | Source |
| --- | --- | --- |
| Header and stepper | Number, state, value, approval path: Draft → Buyer → Manager (if needed) → Approved → Fulfilled | Proposal |
| Why | Shortage date, quantity short, affected production orders, small projection chart | shortage_alerts, inventory_projections |
| Calculation | Average daily usage, variability, lead time (promised and actual), review period, safety stock, target, projected stock at arrival, raw quantity, MOQ, lot multiple, shelf-life cap, final quantity | Inputs stored with the proposal |
| Options compared | Purchase vs transfer vs expedite: quantity, arrival date, cost ₹, effect on the source plant | Engine options |
| Supplier | Approved vendor, MOQ, lead time promised vs actual, open POs with this supplier | approved_vendors, goods_receipts, purchase_orders |
| Decision panel | Approve, reject with reason code, send back with comment, change quantity (recorded as an override with reason) | Backend approval endpoints |
| Audit timeline | Every state change: who, when, comment, run | approval_logs |

Actions: the decisions above, ask the agent to explain, download as PDF for records.

### 4.3 Transfers

Purpose: use surplus at one plant before buying for another. Users: inventory manager, planners, stores. Priority: Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| Plant matrix | From-plant × to-plant grid of suggested transfer value | transfer_proposals |
| Suggestion grid | Material, from plant, to plant, transferable quantity, needed quantity, need date, source status after transfer, lots and expiry, saving vs purchase ₹, state | Engine transfer check, material_lots |

Transferable quantity = source usable stock − its own projected need − its safety stock, so a transfer never creates a shortage at the source.

Actions: create transfer proposal, mark shipped and received (stores).

### 4.4 PO Tracker

Purpose: see which purchase orders are late or partly received and what each delay affects. Users: buyers, inventory manager. Priority: Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| KPI tiles | Open PO lines, overdue lines and value, partly received lines, average delay of actual vs promised lead time | purchase_orders, goods_receipts |
| PO line grid | PO, line, supplier, material, ordered, received, open, PO date, promised date, days overdue, linked shortage date, status | purchase_orders, goods_receipts, shortage_alerts |
| Lead time by supplier | Supplier, material, promised lead time, actual average, gap, on-time receipts % | goods_receipts, approved_vendors |

Actions: draft a supplier reminder email with the agent (the buyer sends it), export.

Lead-time figures here only feed inventory projections; supplier scorecards belong to the Supplier Performance agent (10).

## 5. Optimization

### 5.1 Excess and Obsolete

Purpose: find the cash tied up in stock that will not be used, and decide what to do with it. Users: inventory manager, leadership, buyers. Priority: Phase 2 (P1 in the MVP if time allows).

| Section | Data shown | Source |
| --- | --- | --- |
| KPI tiles | Excess value, slow-moving value, obsolete value, each as % of total inventory value | excess_inventory |
| Ageing chart | Value by days since last movement: 0–90, 91–180, 181–365, over 365; split by material type | inventory_movements, stock_balances |
| Excess grid | Material, plant, on-hand, max stock, excess quantity, excess value ₹, days of cover, last movement date, demand in horizon, class (excess / slow-moving / obsolete), suggested disposition (transfer to plant X / hold / review for write-off) | excess_inventory, inventory_projections |

Actions: create transfer proposal, propose disposition (goes to approval; the system never writes stock off), stop open POs for excess items (flag to buyer), export.

## 6. Insights

### 6.1 Daily Brief and Reports

Purpose: replace the plant's hand-made daily reports, the confirmed pain point. Users: all roles. Priority: MVP (today's brief and daily stock report); report library Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| Today's brief | Full brief with sections: shortages, production at risk, cash in excess, expiry, overdue POs, approvals, data freshness; AI or template version | daily_briefs |
| Brief history | Briefs by date, with the run they came from | daily_briefs, calculation_runs |
| Report library | Daily stock report, shortage report, excess report, expiry report, PO status report, variance report; each as .xlsx or PDF from a chosen run | Engine output tables |

Actions: download, email to a list (Phase 2), ask the agent about any line of the brief.

### 6.2 KPI Analytics

Purpose: track the six deck KPIs and the time saved by automation. Users: leadership, inventory manager. Priority: Phase 3.

| KPI | Definition shown in the tooltip | Source |
| --- | --- | --- |
| Inventory turns | Consumption value over a period ÷ average inventory value | consumption_history, stock_balances |
| Days of inventory | Inventory value ÷ average daily consumption value | Same |
| Stockout days | Days a required material had zero usable stock (daily data gives days, not hours) | inventory_projections history |
| Excess value | Value above maximum stock or the days-of-cover limit | excess_inventory |
| Schedule disruption | Production orders flagged at risk because of material, per week | shortage_alerts history |
| Record accuracy | Materials within variance tolerance ÷ all materials | stock_variances |
| Approval turnaround | Time from submission to decision | approval_logs |

Each KPI shows a trend over runs and a split by plant and material type.

### 6.3 Agent Workspace

Purpose: full-screen conversations with the agent, with its working visible. Users: all roles. Priority: MVP as the side panel; full page Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| Conversations | Past conversations by date and title | Agent store |
| Chat | Answers with links to the materials, orders and proposals they cite, and the run they used | Agent tools |
| Tool trace | Each step: tool, inputs, result summary, time taken | agent_run_logs |
| Suggested questions | The five leadership questions plus questions for the current plant | Static plus engine alerts |

The agent can draft text and open proposals for review, but cannot approve, change data or release anything.

## 7. Data

### 7.1 Data Uploads

Purpose: the front door: get the plant's daily Excel files in, checked and calculated. Users: stores, data admin. Priority: MVP.

| Section | Data shown | Source |
| --- | --- | --- |
| File slots | The ten files, each marked required or optional, with last upload time, row count, status, and a template download | uploads |
| Progress | Validating → loading → calculating → brief ready, with time per step | uploads, calculation_runs |
| Validation report | Per file: rows accepted, rows rejected; error table with file, row, column, value and reason | upload_errors |
| Upload history | Upload number, date, user, files, status, run started | uploads, calculation_runs |

Actions: upload, download error rows as .xlsx to fix and re-upload, re-run a calculation (data admin).

### 7.2 Data Quality

Purpose: show how trustworthy today's numbers are and what to fix. Users: data admin, inventory manager. Priority: Phase 2 (the MVP shows checks inside the upload report).

| Section | Data shown | Source |
| --- | --- | --- |
| Scorecard | Each check (UoM, staleness, lead time, BOM, lot status, expiry date, duplicates, reconciliation) as pass / warn / fail, per file, with trend over uploads | Data-quality results per run |
| Freshness | Per file: last snapshot date, staleness limit, status | uploads, inventory_policies |
| Issue list | Check, severity, material and plant, detail, first seen, status (open / resolved) | Data-quality results |

Actions: mark an issue resolved with a comment, export.

### 7.3 Calculation Runs

Purpose: trace any number back to the files and run that produced it. Users: data admin, system admin. Priority: Phase 2.

| Section | Data shown | Source |
| --- | --- | --- |
| Run list | Run number, triggering upload, start, end, duration, status, data-quality summary, outputs (shortages, proposals), brief type (AI / template) | calculation_runs |
| Run detail | Uploads used, step log, errors | calculation_runs, uploads |
| Compare runs | Shortages added and cleared between two runs | Engine output by run_id |

## 8. Administration

### 8.1 Master Data

Purpose: read-only views of the reference data that the calculations depend on. Users: data admin, inventory manager. Priority: Phase 3.

| View | Data shown | Source |
| --- | --- | --- |
| Materials | Code, description, type, UoM, ABC, shelf life, standard cost, safety stock, max stock, active flag | materials |
| Suppliers and approved vendors | Supplier, material, lead time, MOQ, lot multiple, approved flag | suppliers, approved_vendors |
| BOM | Expandable tree from finished good to raw material and packaging | bom |
| Plants and locations | Plant, storage locations, tenant | plants, storage_locations |

In the MVP, master data changes only through the Excel upload.

### 8.2 Inventory Policies

Purpose: set the thresholds the engine uses, by tenant, plant, material type or single material. Users: data admin. Priority: Phase 3 (seeded values in the MVP).

| Setting | Used for |
| --- | --- |
| Service level (z), review period | Safety stock and order quantity |
| Planning horizon, active window (90 days) | Projections and Inventory Health |
| Excess days-of-cover limit, slow-moving days | Excess and obsolete classification |
| QC age limit, variance tolerance, large-adjustment limit | QC-hold ageing and reconciliation |
| Staleness limit per file | Freshness warnings |
| Manager approval threshold ₹ | Approval routing |

Every change records who, when, old and new value, and applies from the next calculation run.

### 8.3 Users and Roles

Purpose: control who sees and does what. Users: system admin. Priority: Phase 3.

Shows users, their roles, assigned plants and last login; actions are invite, change role, change plant access and deactivate.

### 8.4 Audit Log

Purpose: a complete record for compliance and investigation. Users: system admin, leadership. Priority: Phase 3.

Shows every event (upload, calculation run, proposal state change, override, policy change, role change, login) with user, time, item and before/after values; filter by type, user and date; export.

## Data contract additions

Specifying the pages exposed gaps in the v2.1 Excel contract and schema: without cost and price columns, no page can show a ₹ value. These need adding to Build Plan v2.1 and CLAUDE.md before the seed generator is written.

| Addition | Where | Needed by |
| --- | --- | --- |
| standard_cost, currency | Material_Master.xlsx | Every ₹ value: inventory value, excess, expiry at risk, KPIs |
| unit_price | Purchase_Orders.xlsx | Proposal value, approval threshold routing, PO Tracker |
| customer, due_date (optional) | Production_Plan.xlsx | Customer impact on Production Impact and What-If |
| alert_actions table | Database | Acknowledge, snooze and assign on My Work |
| saved_views table | Database | Saved grid views |
| users, roles, user_plants tables | Database | Roles, plant scoping, landing page |
| audit_events table | Database | Audit Log beyond approvals |
| dq_results table | Database | Data Quality scorecard and issue list |

## Build phasing

The 3-day MVP builds 8 pages plus the agent side panel; all 26 are designed now so the MVP grows without rework.

| Phase | Pages |
| --- | --- |
| MVP (3 days) | 1.1 Executive Overview, 2.1 Stock Explorer, 2.2 Material 360 (Overview, Demand, Supply tabs), 3.1 Shortage Horizon, 4.1 Proposals, 4.2 Proposal Detail, 6.1 Daily Brief (today's brief and daily stock report), 7.1 Data Uploads, agent side panel |
| Phase 2 | 1.2 My Work, 2.3 Lots and Expiry, 2.4 QC Hold Monitor, 2.5 Movements Ledger, 2.6 Stock Reconciliation, 3.2 Production Impact, 3.3 What-If Simulation, 4.3 Transfers, 4.4 PO Tracker, 5.1 Excess and Obsolete, 6.1 report library, 6.3 Agent Workspace page, 7.2 Data Quality, 7.3 Calculation Runs |
| Phase 3 | 6.2 KPI Analytics, 8.1 Master Data, 8.2 Inventory Policies, 8.3 Users and Roles, 8.4 Audit Log |

Day 3 build order: shell and shared grid, Executive Overview, Proposals and Proposal Detail, Material 360, Shortage Horizon, Stock Explorer, Data Uploads, Daily Brief, agent side panel. The shared grid and KPI tile come first because six of the eight MVP pages are built from them.

