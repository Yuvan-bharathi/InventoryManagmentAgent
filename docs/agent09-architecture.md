# Agent 09 Inventory Management – Four-Component Architecture
Nov 12, 2026 · @Suman
## Purpose
Agent 09 keeps every material a phone plant needs available, without locking cash in stock it does not need. It is built as four components, not as a chatbot on a database: a data pipeline (Input), a calculation and business-rules layer (Processing), screens for each role (Presentation), and an AI layer that analyses, predicts, detects, recommends and automates on top of the processed data (AI Intelligence).
The design works for any manufacturing plant through a configurable industry profile (see Beyond phone assembly). The reference domain for the demo is mobile phone manufacturing: 2 plants (Chennai IN-TN-01, Bengaluru IN-KA-01), 3 phone models built from a 16-part bill of materials, 18 materials, 10 suppliers, and ₹36.8 Cr of stock as of 31-Oct-2026.
Every item in this document carries one of three statuses: Built (working in the application today), Planned (designed, works with the data we have), or Needs data (designed, waits for a file the organization has not supplied). The same four-part structure is the template for the other 19 agents (last section).
## Business context
Inventory decides whether a phone plant can build: one missing part out of 16 stops the line, while every part bought too early is cash sitting on a shelf.
### Why inventory matters in a phone plant
Every part is needed. A phone needs all 16 BOM parts (processor, memory, storage, PCB, display, battery, cameras, speaker, antenna, connector, packaging and more); the scarcest one decides how many phones can be built.
Parts take weeks to arrive. Supplier lead times run from 5 to 35 days, so shortages must be seen weeks before they happen.
Stock is cash. ₹36.8 Cr sits in stock today; excess and obsolete parts are money that cannot be used elsewhere.
Two plants, one pool. Chennai and Bengaluru share suppliers and parts, so one plant's surplus can cover the other's shortage.
### How plants manage inventory today

| Activity | How it is done today | Status |
| Stock records | Excel sheets, updated by hand | Confirmed |
| Daily stock report | Built by hand every day | Confirmed |
| Team workload | Spread across counting, supplier follow-ups, reporting and approvals | Confirmed |
| Receiving raw material | Goods received against the PO, lot labelled, sent to QC | Typical, to validate |
| Shelf allocation | Storekeeper picks a free shelf from memory or a whiteboard | Typical, to validate |
| Finding empty shelves | Walking the aisles | Typical, to validate |
| Routine checks | Periodic full counts; QC inspection per lot | Typical, to validate |
| Shortage check | Planner compares the plan with stock by hand | Typical, to validate |
| Purchase approval | Email | Typical, to validate |
| QC rejects | Separate register; QC decides hold, rework or scrap | Typical, to validate |
| Export dispatch | Packed and documented separately from domestic | Typical, to validate |

Activity
How it is done today
Status
Stock records
Excel sheets, updated by hand
Confirmed
Daily stock report
Built by hand every day
Confirmed
Team workload
Spread across counting, supplier follow-ups, reporting and approvals
Confirmed
Receiving raw material
Goods received against the PO, lot labelled, sent to QC
Typical, to validate
Shelf allocation
Storekeeper picks a free shelf from memory or a whiteboard
Typical, to validate
Finding empty shelves
Walking the aisles
Typical, to validate
Routine checks
Periodic full counts; QC inspection per lot
Typical, to validate
Shortage check
Planner compares the plan with stock by hand
Typical, to validate
Purchase approval
Email
Typical, to validate
QC rejects
Separate register; QC decides hold, rework or scrap
Typical, to validate
Export dispatch
Packed and documented separately from domestic
Typical, to validate
### Problems this causes
Shortages are found when the line asks for the part, not weeks ahead.
Excess, slow-moving and obsolete stock lock cash without anyone seeing the total.
Stock is hard to find: misplaced lots, unseen empty shelves, double orders.
The system's numbers drift from the shelf, so nobody fully trusts them.
Stock waiting for QC looks available and hides real shortages.
Approvals wait in email; leaders wait for reports that are already old.
### Where the agent and automation help

| Problem | What the application does | Status |
| Manual Excel records and daily reports | Loads the plant's files, checks them, and produces the daily report and a written brief automatically | Built |
| Shortages found late | Projects stock 60 days ahead per material and plant; flags the shortage date and the production orders hit | Built |
| Cash locked in stock | Lists excess and obsolete stock with ₹ value and a suggested action | Built (page being finished) |
| QC holds hide shortages | Counts only usable stock; flags QC holds that cause a shortage | Built; ageing Planned |
| Slow approvals | Proposals with full reasoning, two-level approval, audit trail | Built |
| Buying while the other plant has surplus | Checks transfers before purchases | Built |
| Stock hard to find | Shelf map, empty-shelf view, shelf allocation suggestions | Needs data (shelf master) |
| Records drift from the shelf | Cycle-count schedule and variance tracking | Planned |
| “How many phones can we build?” | Capacity calculator from boxes received to phones, with the limiting part | Planned |

Problem
What the application does
Status
Manual Excel records and daily reports
Loads the plant's files, checks them, and produces the daily report and a written brief automatically
Built
Shortages found late
Projects stock 60 days ahead per material and plant; flags the shortage date and the production orders hit
Built
Cash locked in stock
Lists excess and obsolete stock with ₹ value and a suggested action
Built (page being finished)
QC holds hide shortages
Counts only usable stock; flags QC holds that cause a shortage
Built; ageing Planned
Slow approvals
Proposals with full reasoning, two-level approval, audit trail
Built
Buying while the other plant has surplus
Checks transfers before purchases
Built
Stock hard to find
Shelf map, empty-shelf view, shelf allocation suggestions
Needs data (shelf master)
Records drift from the shelf
Cycle-count schedule and variance tracking
Planned
“How many phones can we build?”
Capacity calculator from boxes received to phones, with the limiting part
Planned
## Scope: stock categories and warehouse operations
Agent 09 covers seven stock categories and eight warehouse operations; raw materials are fully built, while shelves, finished goods and export wait for files the organization has not yet supplied.
### Stock categories

| Category | Phone-plant example | How the application handles it | Data today | Status |
| Raw materials | Processor, PCB, display, battery | Usable stock, shortage dates, purchase and transfer proposals | Stock snapshot, 1,300 PO lines | Built |
| Packaging | Retail box | Same as raw materials | In the BOM | Built |
| Consumables | Solder paste, thermal adhesive (KG) | Stock and shelf life tracked; demand once usage per phone is known | In stock; not in the BOM | Needs data |
| Work in progress | Assembled boards on the line | Shown per production order | No WIP stock file | Needs data |
| Finished goods | Packed phones by batch, serial and shelf | Stock by batch and shelf, ready-to-ship view | Serial numbers and 1,000 shipments only | Needs data |
| QC hold and rejects | Units that fail inspection | Queue by disposition (hold, rework, scrap); never counted as usable | 561 failures with disposition | Planned |
| Export goods | Phones for overseas orders | Separate staging, documents and shipment tracking | No export orders: all 4 customers are in India | Needs data |

Category
Phone-plant example
How the application handles it
Data today
Status
Raw materials
Processor, PCB, display, battery
Usable stock, shortage dates, purchase and transfer proposals
Stock snapshot, 1,300 PO lines
Built
Packaging
Retail box
Same as raw materials
In the BOM
Built
Consumables
Solder paste, thermal adhesive (KG)
Stock and shelf life tracked; demand once usage per phone is known
In stock; not in the BOM
Needs data
Work in progress
Assembled boards on the line
Shown per production order
No WIP stock file
Needs data
Finished goods
Packed phones by batch, serial and shelf
Stock by batch and shelf, ready-to-ship view
Serial numbers and 1,000 shipments only
Needs data
QC hold and rejects
Units that fail inspection
Queue by disposition (hold, rework, scrap); never counted as usable
561 failures with disposition
Planned
Export goods
Phones for overseas orders
Separate staging, documents and shipment tracking
No export orders: all 4 customers are in India
Needs data
### Live, slow-moving and dead stock

| Class | Rule (thresholds configurable) | What the application does | Status |
| Live | Has demand in the next 60 days | Normal replenishment | Built |
| Slow-moving | Stock covers far more days than the limit, or no movement for 90+ days | Stop new orders, suggest a transfer | Cover rule Built; movement rule Needs data |
| Dead or obsolete | No demand in the horizon and no movement for 180+ days, or replaced by an engineering change | Disposition proposal for approval; never an automatic write-off | Engineering-change rule Built; movement rule Needs data |

Class
Rule (thresholds configurable)
What the application does
Status
Live
Has demand in the next 60 days
Normal replenishment
Built
Slow-moving
Stock covers far more days than the limit, or no movement for 90+ days
Stop new orders, suggest a transfer
Cover rule Built; movement rule Needs data
Dead or obsolete
No demand in the horizon and no movement for 180+ days, or replaced by an engineering change
Disposition proposal for approval; never an automatic write-off
Engineering-change rule Built; movement rule Needs data
The movement rules need a continuous stock history; the supplied snapshots are independent days, so today dead stock is found through demand and engineering changes.
### Warehouse operations

| Operation | What it means | How the application handles it | Status |
| Receiving | Goods arrive against a PO line | Match to PO line, record lot, check quantity, handle partial receipts, send to QC | Needs data (goods-receipt file) |
| Shelf data | Every shelf's ID, zone, capacity and storage conditions | Shelf master | Needs data |
| Empty shelves | Shelves holding nothing | Occupancy map and empty-shelf list | Needs data |
| Shelf allocation | Choosing where a received lot is stored | Suggested shelf by the rules below; storekeeper confirms | Needs data |
| Picking and issue | Sending material to the line | Pick list against the production order, oldest lot first | Planned |
| Routine checks | Cycle counts, QC, data checks | Count schedule by importance; variance goes to approval | Planned |
| Product and material data | Master data for parts and phones | Quality checks on every upload; read-only views | Checks Built; views Planned |
| Dispatch | Domestic and export shipments | Finished-goods pick, staging, shipment tracking | Domestic Planned; export Needs data |

Operation
What it means
How the application handles it
Status
Receiving
Goods arrive against a PO line
Match to PO line, record lot, check quantity, handle partial receipts, send to QC
Needs data (goods-receipt file)
Shelf data
Every shelf's ID, zone, capacity and storage conditions
Shelf master
Needs data
Empty shelves
Shelves holding nothing
Occupancy map and empty-shelf list
Needs data
Shelf allocation
Choosing where a received lot is stored
Suggested shelf by the rules below; storekeeper confirms
Needs data
Picking and issue
Sending material to the line
Pick list against the production order, oldest lot first
Planned
Routine checks
Cycle counts, QC, data checks
Count schedule by importance; variance goes to approval
Planned
Product and material data
Master data for parts and phones
Quality checks on every upload; read-only views
Checks Built; views Planned
Dispatch
Domestic and export shipments
Finished-goods pick, staging, shipment tracking
Domestic Planned; export Needs data
### Shelf allocation rules (typical, to validate with the plant)
Zone by material type: static-safe shelves for chips and boards, cold storage for solder paste, a separate store for adhesives, a quarantine zone for QC holds, a staging bay for export.
Fast-moving parts closest to the line.
One lot per shelf; oldest or soonest-expiring lot picked first.
Never above the shelf's capacity.
### Routine checks
Cycle counts: high-value parts monthly, medium quarterly, low twice a year (defaults, configurable); a count outside tolerance triggers a recount, then an adjustment proposal for approval.
QC: an inspection queue, with an alert when stock sits in QC hold too long.
Data: 12 quality checks on every upload, plus a freshness warning when files are late.
## Beyond phone assembly: one design for any plant
The same Agent 09 serves any manufacturing plant, from electronics to vehicles to steel, because what differs between industries is configured per plant, not coded. Phone assembly stays the reference demo because that is the dataset we have; each other industry is switched on by its profile and validated with that plant.
### What changes by industry

| Industry | What they stock | Units and tracking | Where it is stored | Special handling |
| Electronics assembly (phones, laptops) | Components, PCBs, packaging, consumables | Pieces, reels; lot and serial | Shelves, bins, static-safe and dry cabinets | Moisture-sensitive parts, solder paste kept cold |
| Electronics components (PCB, chips, display modules) | Substrates, chemicals, gases, precious metals | Pieces, sheets, litres, grams; lot | Cleanroom stores, gas cabinets | Chemical shelf life, hazardous storage, precious-metal accounting |
| Automotive and auto components | Sheet steel, castings, forgings, bought-out parts, paint | Pieces, kg, sets; lot, vehicle or part serial | Racks, line-side supermarkets, yards | Just-in-time and kanban, parts delivered in build sequence, returnable packaging |
| Small parts and sub-assembly (appliances, switchgear, fasteners) | Bought-out components, sub-assemblies, fasteners, packaging | Pieces, boxes, bulk by weight; lot or none | Bins, kanban racks, line-side supermarkets | High mix, multi-level bills of materials, kanban and two-bin replenishment |
| Parts manufacturing (machining, stamping, injection moulding) | Bars, sheets, coils, resin; semi-finished parts between operations | kg, metres, sheets, pieces; heat number or lot | Racks, yards, WIP areas by operation | Yield and scrap per operation, material at subcontractors, dies and tooling |
| Steel and metals | Iron ore, coal, scrap, alloys; coils, plates, billets | Tonnes; heat number, coil ID | Open yards, bays, silos | Bulk stock measured by survey or weighbridge, coil weight to length, scrap recycled |
| Chemicals and process | Raw chemicals, intermediates, solvents | kg, litres, tonnes; batch | Tanks, drums, hazardous stores | Recipe with yield, co-products and by-products, tank-level readings |
| Pharma and food | Active ingredients, excipients, packaging | kg; batch with expiry | Cold rooms, quarantine zones | Release only after QC, earliest expiry first, recall traceability |
| Heavy engineering and machining | Plates, bars, castings, bought-outs, tools | Pieces, kg, metres; heat number, serial | Racks, yards | Project-specific stock, long lead times, cut-length remnants |

Industry
What they stock
Units and tracking
Where it is stored
Special handling
Electronics assembly (phones, laptops)
Components, PCBs, packaging, consumables
Pieces, reels; lot and serial
Shelves, bins, static-safe and dry cabinets
Moisture-sensitive parts, solder paste kept cold
Electronics components (PCB, chips, display modules)
Substrates, chemicals, gases, precious metals
Pieces, sheets, litres, grams; lot
Cleanroom stores, gas cabinets
Chemical shelf life, hazardous storage, precious-metal accounting
Automotive and auto components
Sheet steel, castings, forgings, bought-out parts, paint
Pieces, kg, sets; lot, vehicle or part serial
Racks, line-side supermarkets, yards
Just-in-time and kanban, parts delivered in build sequence, returnable packaging
Small parts and sub-assembly (appliances, switchgear, fasteners)
Bought-out components, sub-assemblies, fasteners, packaging
Pieces, boxes, bulk by weight; lot or none
Bins, kanban racks, line-side supermarkets
High mix, multi-level bills of materials, kanban and two-bin replenishment
Parts manufacturing (machining, stamping, injection moulding)
Bars, sheets, coils, resin; semi-finished parts between operations
kg, metres, sheets, pieces; heat number or lot
Racks, yards, WIP areas by operation
Yield and scrap per operation, material at subcontractors, dies and tooling
Steel and metals
Iron ore, coal, scrap, alloys; coils, plates, billets
Tonnes; heat number, coil ID
Open yards, bays, silos
Bulk stock measured by survey or weighbridge, coil weight to length, scrap recycled
Chemicals and process
Raw chemicals, intermediates, solvents
kg, litres, tonnes; batch
Tanks, drums, hazardous stores
Recipe with yield, co-products and by-products, tank-level readings
Pharma and food
Active ingredients, excipients, packaging
kg; batch with expiry
Cold rooms, quarantine zones
Release only after QC, earliest expiry first, recall traceability
Heavy engineering and machining
Plates, bars, castings, bought-outs, tools
Pieces, kg, metres; heat number, serial
Racks, yards
Project-specific stock, long lead times, cut-length remnants
### Stock types common to every plant

| Stock type | What it is | How the application handles it |
| Maintenance spares and tools | Spare parts and tooling that keep machines running | Own reorder rules by machine criticality; linked to the maintenance agent |
| Consignment stock | Supplier-owned stock held in our plant | Shown separately; not counted as our cash until used |
| Subcontract stock | Our material at a vendor for processing | Tracked by vendor; due-back dates |
| Returnable packaging | Trays, crates, pallets owed back to suppliers or customers | Count and due-back balance |
| Scrap, rework and by-products | Rejected or secondary output | Separate classes with recovery value |
| Customer-owned stock | Material supplied by the customer | Never used for other orders |
| Inter-plant transit | Stock moving between our plants | Counted once, at the receiving plant on arrival |

Stock type
What it is
How the application handles it
Maintenance spares and tools
Spare parts and tooling that keep machines running
Own reorder rules by machine criticality; linked to the maintenance agent
Consignment stock
Supplier-owned stock held in our plant
Shown separately; not counted as our cash until used
Subcontract stock
Our material at a vendor for processing
Tracked by vendor; due-back dates
Returnable packaging
Trays, crates, pallets owed back to suppliers or customers
Count and due-back balance
Scrap, rework and by-products
Rejected or secondary output
Separate classes with recovery value
Customer-owned stock
Material supplied by the customer
Never used for other orders
Inter-plant transit
Stock moving between our plants
Counted once, at the receiving plant on arrival
### The industry profile: what is configured per plant
Material classes: the plant's own list (for example ore, coil, slab, finished coil, scrap), not a fixed raw-material / finished-goods split.
Tracking level per material: none, lot, batch, serial, heat number or coil ID.
Units and conversions: count, weight, length, volume or area, with conversions per material (coil kg to metres, drum to litres, reel to pieces, box to coils).
Requirements model: a bill of materials for assembly, or a recipe with yield and co-products for process plants.
Storage model: shelf, bin, rack, yard zone, tank, silo or cold room, each with its own capacity unit.
Replenishment policy per class: plan-driven (production plan × bill of materials), reorder point, min-max, kanban or two-bin, just-in-time call-off in build sequence, or make-to-order.
Quality rules: release after QC, quarantine, shelf life, recall.
Counting method: cycle count, stockpile survey, tank gauge or weighbridge.
### What stays the same
The four components, the 12-stage pipeline, the approval workflow, the guardrails and the agent are identical in every plant. Only the profile and the source systems change, so the agent answers each plant's version of the same questions: “How many cars can we build from current stock?”, “How many tonnes can we roll before ore runs out?”, “Which batches expire before use?”
## Agent 09 within the 20-agent platform
Agent 09 owns the stock itself: how much, where, in what status, and what to buy or move. Decisions that belong to a neighbouring agent are handed over, not duplicated: QC verdicts to Quality (05), genealogy to Traceability (08), shipments and export documents to Logistics (12).

| Agent | Gives Agent 09 | Gets from Agent 09 |
| 01 Production Planning | Production plan and material call-offs | Material availability and shortage dates, before the plan is released |
| 04 Predictive Maintenance | Forecast spare-part needs | Spares stock and reorder status |
| 05 Quality Management | Inspection results and hold, rework or scrap decisions | Quantities on QC hold and their age |
| 07 Engineering Change | Revision cut-in dates and affected parts | Stock and open orders hit by each change |
| 08 Product Traceability | Lot-to-product genealogy | Lot, location and status of each batch |
| 10 Supplier Performance | On-time and quality record per supplier | Receipts, delays and short deliveries |
| 11 RFQ Management | Quotes and new sources | Demand and quantity needs for parts to re-source |
| 12 Logistics and Dispatch | Shipment plans, export documents, delivery status | Finished goods ready, reserved and staged by order, domestic or export |
| 16 Manufacturing Cost | Valuation rules | Stock value, excess and write-off exposure |
| 18 Customer Order Management | Order commitments and priorities | Finished-goods availability per order |
| 19 Digital Twin | Plant and line scenarios | Stock positions for simulation |
| 20 Executive Decision Intelligence | Leadership priorities | Inventory KPIs and risks for the cross-plant view |

Agent
Gives Agent 09
Gets from Agent 09
01 Production Planning
Production plan and material call-offs
Material availability and shortage dates, before the plan is released
04 Predictive Maintenance
Forecast spare-part needs
Spares stock and reorder status
05 Quality Management
Inspection results and hold, rework or scrap decisions
Quantities on QC hold and their age
07 Engineering Change
Revision cut-in dates and affected parts
Stock and open orders hit by each change
08 Product Traceability
Lot-to-product genealogy
Lot, location and status of each batch
10 Supplier Performance
On-time and quality record per supplier
Receipts, delays and short deliveries
11 RFQ Management
Quotes and new sources
Demand and quantity needs for parts to re-source
12 Logistics and Dispatch
Shipment plans, export documents, delivery status
Finished goods ready, reserved and staged by order, domestic or export
16 Manufacturing Cost
Valuation rules
Stock value, excess and write-off exposure
18 Customer Order Management
Order commitments and priorities
Finished-goods availability per order
19 Digital Twin
Plant and line scenarios
Stock positions for simulation
20 Executive Decision Intelligence
Leadership priorities
Inventory KPIs and risks for the cross-plant view
## Architecture overview
Data from six source applications is checked and calculated before anyone sees it; the AI layer reads the processed results, never the raw tables, and writes answers, briefs and draft requests that people approve.
architecture · 4 components
Read left to right for the data pipeline, then down to the AI layer that sits on top of it.
## 1. Input
Agent 09 reads 13 of the organization's files, from six source applications; eight more inputs are needed to cover shelves, finished goods, export and packaging. Today the files arrive as a ZIP of CSV exports; later the same columns come through each system's API.
### Source-neutral data contract
The application reads a fixed set of business entities, whatever the plant's systems are; each source is mapped to them once. SAP S/4HANA is shown as the most common source; the mobile dataset is the reference used in the demo.

| Entity | Key fields | SAP S/4HANA tables | Reference dataset |
| Material master | material, class, base unit, tracking level, shelf life, cost | MARA, MARC, MBEW | dim_material ,  dim_product |
| Units and pack conversions | material, alternative unit, factor | MARM | Not supplied |
| Bill of materials or recipe | parent, component, quantity, scrap or yield, valid from and to | STKO, STPO | fact_bom_component |
| Plants and storage | plant, storage location, bin or zone | T001W, T001L, warehouse bins | dim_plant , warehouse codes |
| Stock | material, location, lot or serial, status, quantity | MARD, MCHB, warehouse stock | fact_inventory_daily_snapshot |
| Stock movements | date, movement type, quantity, reference | MATDOC | Not supplied |
| Purchase orders and receipts | PO, line, supplier, quantities, dates | EKKO, EKPO, EKET, EKBE | fact_purchase_order_receipt |
| Production orders and reservations | order, product, quantity, dates, components reserved | AFKO, AFPO, RESB | fact_production_order |
| Quality results | inspection lot, result, usage decision | QALS, QAVE | fact_quality_inspection |
| Sales orders and deliveries | order, customer, ship-to country, quantities | VBAK, VBAP, LIKP, LIPS | fact_customer_order ,  fact_shipment_milestone |
| Suppliers and sources | supplier, approved materials | LFA1, EINA, EORD | dim_supplier |

Entity
Key fields
SAP S/4HANA tables
Reference dataset
Material master
material, class, base unit, tracking level, shelf life, cost
MARA, MARC, MBEW
dim_material, dim_product
Units and pack conversions
material, alternative unit, factor
MARM
Not supplied
Bill of materials or recipe
parent, component, quantity, scrap or yield, valid from and to
STKO, STPO
fact_bom_component
Plants and storage
plant, storage location, bin or zone
T001W, T001L, warehouse bins
dim_plant, warehouse codes
Stock
material, location, lot or serial, status, quantity
MARD, MCHB, warehouse stock
fact_inventory_daily_snapshot
Stock movements
date, movement type, quantity, reference
MATDOC
Not supplied
Purchase orders and receipts
PO, line, supplier, quantities, dates
EKKO, EKPO, EKET, EKBE
fact_purchase_order_receipt
Production orders and reservations
order, product, quantity, dates, components reserved
AFKO, AFPO, RESB
fact_production_order
Quality results
inspection lot, result, usage decision
QALS, QAVE
fact_quality_inspection
Sales orders and deliveries
order, customer, ship-to country, quantities
VBAK, VBAP, LIKP, LIPS
fact_customer_order, fact_shipment_milestone
Suppliers and sources
supplier, approved materials
LFA1, EINA, EORD
dim_supplier
### Data in use

| Source application | File (table) | Key columns used | Used for | Status |
| ERP: material master | dim_material | material_id, material_name, material_category, uom, standard_price_inr, lead_time_days, safety_stock_qty, moq, shelf_life_days | Parts, cost, policies | Built |
| ERP: suppliers | dim_supplier | supplier_id, material_category, approved_status, standard_lead_time_days, risk_tier | Approved vendors | Built |
| ERP: purchasing | fact_purchase_order_receipt | po_id, po_line, supplier_id, material_id, plant_id, po_date, promised_date, receipt_date, ordered_qty, received_qty, unit_price_inr, po_status | Open supply, actual lead time, delay forecast | Built |
| ERP: plants | dim_plant | plant_id, plant_name, state, currency | Plant scoping | Built |
| WMS: stock | fact_inventory_daily_snapshot | snapshot_date, plant_id, material_id, warehouse_id, lot_id, on_hand_qty, allocated_qty, blocked_qty, quality_hold_qty, in_transit_qty, unit_cost_inr, expiry_date | Stock position | Built |
| PLM: bill of materials | fact_bom_component | product_id, material_id, component_qty, scrap_factor, revision, effective_from, effective_to | Requirements, capacity | Built |
| PLM: engineering changes | fact_engineering_change | part_id, product_id, cut_in_date, affected_inventory_qty, implementation_status | Obsolete risk | Built |
| PLM: products | dim_product | product_id, product_name, model_revision | Phone models | Built |
| MES / planning: orders | fact_production_order | production_order_id, plant_id, product_id, order_qty, planned_start, due_date, order_status | Demand | Built |
| MES: genealogy | fact_product_genealogy_event | serial_number, production_order_id, material_id, material_lot_id, event_type | Batch traceability | Planned |
| QMS: inspections | fact_quality_inspection | inspection_id, serial_number, inspection_stage, result, disposition, defect_code | QC hold and rejects | Planned |
| Logistics: shipments | fact_shipment_milestone | shipment_id, customer_order_id, warehouse_id, dispatch_date, shipment_qty, shipment_status | Dispatch tracking | Planned |
| Sales: orders and customers | fact_customer_order ,  dim_customer | customer_order_id, customer_id, product_id, order_qty, requested_delivery_date, country | Customer impact, export | Needs data (no link to production orders) |

Source application
File (table)
Key columns used
Used for
Status
ERP: material master
dim_material
material_id, material_name, material_category, uom, standard_price_inr, lead_time_days, safety_stock_qty, moq, shelf_life_days
Parts, cost, policies
Built
ERP: suppliers
dim_supplier
supplier_id, material_category, approved_status, standard_lead_time_days, risk_tier
Approved vendors
Built
ERP: purchasing
fact_purchase_order_receipt
po_id, po_line, supplier_id, material_id, plant_id, po_date, promised_date, receipt_date, ordered_qty, received_qty, unit_price_inr, po_status
Open supply, actual lead time, delay forecast
Built
ERP: plants
dim_plant
plant_id, plant_name, state, currency
Plant scoping
Built
WMS: stock
fact_inventory_daily_snapshot
snapshot_date, plant_id, material_id, warehouse_id, lot_id, on_hand_qty, allocated_qty, blocked_qty, quality_hold_qty, in_transit_qty, unit_cost_inr, expiry_date
Stock position
Built
PLM: bill of materials
fact_bom_component
product_id, material_id, component_qty, scrap_factor, revision, effective_from, effective_to
Requirements, capacity
Built
PLM: engineering changes
fact_engineering_change
part_id, product_id, cut_in_date, affected_inventory_qty, implementation_status
Obsolete risk
Built
PLM: products
dim_product
product_id, product_name, model_revision
Phone models
Built
MES / planning: orders
fact_production_order
production_order_id, plant_id, product_id, order_qty, planned_start, due_date, order_status
Demand
Built
MES: genealogy
fact_product_genealogy_event
serial_number, production_order_id, material_id, material_lot_id, event_type
Batch traceability
Planned
QMS: inspections
fact_quality_inspection
inspection_id, serial_number, inspection_stage, result, disposition, defect_code
QC hold and rejects
Planned
Logistics: shipments
fact_shipment_milestone
shipment_id, customer_order_id, warehouse_id, dispatch_date, shipment_qty, shipment_status
Dispatch tracking
Planned
Sales: orders and customers
fact_customer_order, dim_customer
customer_order_id, customer_id, product_id, order_qty, requested_delivery_date, country
Customer impact, export
Needs data (no link to production orders)
### Data still needed

| Input | Columns | Unlocks |
| Shelf master | shelf_id, plant_id, warehouse_id, zone, capacity, storage_condition | Shelf map, empty shelves, allocation |
| Stock by shelf | shelf_id, lot_id, material_id or product_id, quantity | Where each lot sits |
| Goods receipts | po_id, po_line, lot_id, received_date, received_qty | Receiving, lot-to-PO trace, partial receipts |
| Finished-goods stock | product_id, batch_id, serial range, shelf_id, quantity, status | Finished goods and dispatch |
| Export orders | customer_order_id, destination_country, incoterm, export flag | Export handling |
| Packaging conversions | material_id, purchase_uom, base_uom, conversion_factor | Boxes received to phones |
| Consumable usage | product_id, material_id, quantity per phone | Solder and adhesive demand |
| Cycle-count results | count_date, shelf_id, lot_id, counted_qty | Record accuracy |

Input
Columns
Unlocks
Shelf master
shelf_id, plant_id, warehouse_id, zone, capacity, storage_condition
Shelf map, empty shelves, allocation
Stock by shelf
shelf_id, lot_id, material_id or product_id, quantity
Where each lot sits
Goods receipts
po_id, po_line, lot_id, received_date, received_qty
Receiving, lot-to-PO trace, partial receipts
Finished-goods stock
product_id, batch_id, serial range, shelf_id, quantity, status
Finished goods and dispatch
Export orders
customer_order_id, destination_country, incoterm, export flag
Export handling
Packaging conversions
material_id, purchase_uom, base_uom, conversion_factor
Boxes received to phones
Consumable usage
product_id, material_id, quantity per phone
Solder and adhesive demand
Cycle-count results
count_date, shelf_id, lot_id, counted_qty
Record accuracy
Our own configuration also feeds Processing: inventory policies (thresholds, approval limit), the 21 named assumptions, and user roles.
### APIs

| Direction | API | Purpose | Status |
| In | File upload (ZIP or CSV) | Load files, run quality checks, start a calculation run | Built |
| In | SAP S/4HANA OData, MES and WMS APIs | Replace file uploads with scheduled pulls | Planned |
| Out | Read APIs per page (stock, shortages, proposals, excess, brief) | Feed the screens, with paging, filters and Excel export | Built |
| Workflow | Proposal actions (submit, approve, reject, fulfil) | Approval with role checks and audit | Built |
| Agent | POST /api/chat ,  GET /api/conversations  (setup guide) | Questions to the agent | Built |
| Agent | Domo AI Text Generation | Language model behind the agent | Built |

Direction
API
Purpose
Status
In
File upload (ZIP or CSV)
Load files, run quality checks, start a calculation run
Built
In
SAP S/4HANA OData, MES and WMS APIs
Replace file uploads with scheduled pulls
Planned
Out
Read APIs per page (stock, shortages, proposals, excess, brief)
Feed the screens, with paging, filters and Excel export
Built
Workflow
Proposal actions (submit, approve, reject, fulfil)
Approval with role checks and audit
Built
Agent
POST /api/chat, GET /api/conversations (setup guide)
Questions to the agent
Built
Agent
Domo AI Text Generation
Language model behind the agent
Built
## 2. Processing
Every upload runs the same 12-stage pipeline in tested Python and SQL; the language model never calculates a number, and every result keeps its inputs and run number.
### Pipeline stages

| # | Stage | What happens | Output | Status |
| 1 | Ingest | ZIP or CSV loaded; raw files kept unchanged | Raw store,  uploads | Built |
| 2 | Validate | 12 data-quality checks (units, stale data, broken links, mismatched suppliers, duplicates) | dq_results | Built |
| 3 | Standardise | Plant, warehouse and lot mapping; unit checks; packaging conversion to base units | Clean master and stock tables | Built; packaging Planned |
| 4 | Stock position | Usable stock per material, plant, warehouse and lot | stock_balances | Built |
| 5 | Demand | Production orders (overdue backlog due tomorrow) or the labelled planning scenario, × BOM with scrap | Requirements by day | Built |
| 6 | Supply | Open PO quantity on promised dates, in-transit stock, actual lead time per supplier | Receipts by day | Built |
| 7 | Projection and status | 60-day stock projection; critical, at risk, healthy, excess | inventory_projections ,  shortage_alerts | Built |
| 8 | Classification | Live, slow-moving, dead; obsolete through engineering changes; shelf life | excess_inventory | Built (demand and engineering-change rules) |
| 9 | Replenishment | Reorder point, safety stock, order quantity, minimum order, approved supplier, transfer first | Draft proposals | Built |
| 10 | Capacity | Phones that can be built per plant; the limiting part | Capacity results | Planned |
| 11 | Warehouse rules | Shelf suggestion, empty shelves, cycle-count schedule | Shelf and count tasks | Needs data / Planned |
| 12 | Workflow and KPIs | Approval states, audit trail, KPI values per run | approval_logs ,  calculation_runs | Built |

#
Stage
What happens
Output
Status
1
Ingest
ZIP or CSV loaded; raw files kept unchanged
Raw store, uploads
Built
2
Validate
12 data-quality checks (units, stale data, broken links, mismatched suppliers, duplicates)
dq_results
Built
3
Standardise
Plant, warehouse and lot mapping; unit checks; packaging conversion to base units
Clean master and stock tables
Built; packaging Planned
4
Stock position
Usable stock per material, plant, warehouse and lot
stock_balances
Built
5
Demand
Production orders (overdue backlog due tomorrow) or the labelled planning scenario, × BOM with scrap
Requirements by day
Built
6
Supply
Open PO quantity on promised dates, in-transit stock, actual lead time per supplier
Receipts by day
Built
7
Projection and status
60-day stock projection; critical, at risk, healthy, excess
inventory_projections, shortage_alerts
Built
8
Classification
Live, slow-moving, dead; obsolete through engineering changes; shelf life
excess_inventory
Built (demand and engineering-change rules)
9
Replenishment
Reorder point, safety stock, order quantity, minimum order, approved supplier, transfer first
Draft proposals
Built
10
Capacity
Phones that can be built per plant; the limiting part
Capacity results
Planned
11
Warehouse rules
Shelf suggestion, empty shelves, cycle-count schedule
Shelf and count tasks
Needs data / Planned
12
Workflow and KPIs
Approval states, audit trail, KPI values per run
approval_logs, calculation_runs
Built
### Key calculations
Usable stock, the starting point for everything:
\text{Usable} = \text{On hand} - \text{Allocated} - \text{Blocked} - \text{QC hold}
Projected stock on each day d:
\text{Projected}_d = \text{Usable} + \text{In transit} + \text{PO receipts}_{\le d} - \text{Requirements}_{\le d}
Order quantity, then rounded up to the minimum order quantity:
\text{Qty} = \min\big(SS + \bar{u} \times (LT + R),\ \text{Max}\big) - \text{Projected}_{\text{arrival}}
Phones that can be built, over every part of the BOM:
\text{Capacity} = \min_i \left\lfloor \frac{\text{Usable}_i \times \text{conversion}_i}{\text{qty per phone}_i \times (1 + \text{scrap}_i)} \right\rfloor
On real stock this gives 2,087 phones at Bengaluru, limited by the main PCB.
### Business rules
No purchase order is released and no stock is changed without approval: the buyer for every proposal, plus the procurement manager above ₹10 lakh.
Proposals respect minimum order quantity, approved suppliers, shelf life and lot status.
A transfer is offered only if it leaves the sending plant above its own safety stock.
Quantities are never added across materials (units differ: EA, KG, SET); totals are in ₹.
Each open question about the data runs on a named, switchable assumption (A1–A21) shown wherever it is used.
Data is “refreshed”, never “live”: every screen shows when the data is from.
### Data model

| Layer | Tables | Holds |
| Raw | Files as received | The organization's exports, never changed |
| Master | materials ,  products ,  bom ,  suppliers ,  plants ,  storage_locations  (+ shelves, conversions when supplied) | Reference data |
| Transactions | stock_balances ,  purchase_orders ,  goods_receipts ,  production_plans ,  reservations ,  inventory_movements | What happened |
| Intelligence | inventory_projections ,  shortage_alerts ,  excess_inventory ,  daily_briefs , capacity results | What the engine calculated |
| Workflow | replenishment_proposals ,  transfer_proposals ,  approval_logs | Decisions and their audit |
| Governance | calculation_runs ,  dq_results ,  assumptions ,  agent_run_logs | Traceability of every number and answer |

Layer
Tables
Holds
Raw
Files as received
The organization's exports, never changed
Master
materials, products, bom, suppliers, plants, storage_locations (+ shelves, conversions when supplied)
Reference data
Transactions
stock_balances, purchase_orders, goods_receipts, production_plans, reservations, inventory_movements
What happened
Intelligence
inventory_projections, shortage_alerts, excess_inventory, daily_briefs, capacity results
What the engine calculated
Workflow
replenishment_proposals, transfer_proposals, approval_logs
Decisions and their audit
Governance
calculation_runs, dq_results, assumptions, agent_run_logs
Traceability of every number and answer
For plants beyond phone assembly, the model adds: industry_profiles (one per plant), material_classes, unit conversions per material, storage_types and storage locations with their capacity unit (shelf, rack, yard, tank, silo), recipes with yield, co-products and by-products, tracking attributes (batch, serial, heat number, coil ID), and stock ownership (own, consignment, subcontract, customer-owned).
## 3. Presentation
The application has 20 pages in six groups that follow the work: understand, monitor, plan, act, run the warehouse, report. Each page is named for the question it answers; a new Home page explains inventory and the application before anyone opens a dashboard.
### Home: Inventory at a Glance (new landing page)

| Section | What it shows |
| Headline | “Every material for every order, without locking cash”, with the data date and its age |
| How inventory flows here | Receive → QC → shelf → issue to line → build → pack → dispatch (domestic or export), each step linked to its page |
| Today at a glance | The five leadership questions, each with today's answer (critical parts, excess ₹, obsolete parts, approvals waiting, supplier delays) and a link |
| What this application does | One tile per capability: stock on hand, shortage forecast, purchase and transfer requests, dead stock, build capacity, warehouse operations, daily report, the agent |
| Your work | Role-based: approvals for buyers, receiving and counts for stores, at-risk orders for planners |
| Can I trust the numbers? | Last upload, data-quality issues, assumptions awaiting confirmation |
| Ask the Inventory Agent | A question box with suggested questions |

Section
What it shows
Headline
“Every material for every order, without locking cash”, with the data date and its age
How inventory flows here
Receive → QC → shelf → issue to line → build → pack → dispatch (domestic or export), each step linked to its page
Today at a glance
The five leadership questions, each with today's answer (critical parts, excess ₹, obsolete parts, approvals waiting, supplier delays) and a link
What this application does
One tile per capability: stock on hand, shortage forecast, purchase and transfer requests, dead stock, build capacity, warehouse operations, daily report, the agent
Your work
Role-based: approvals for buyers, receiving and counts for stores, at-risk orders for planners
Can I trust the numbers?
Last upload, data-quality issues, assumptions awaiting confirmation
Ask the Inventory Agent
A question box with suggested questions
### Pages and their names

| Group | Page name | Was called | Answers | Main users | Status |
| Home | Home: Inventory at a Glance | — | What is going on and where do I go? | Everyone | Planned |
| Monitor | Inventory Health Dashboard | Executive Overview | How healthy is stock, by plant, in ₹? | Leadership | Built |
| Monitor | Stock on Hand | Stock Explorer | What is usable, where, and in what status? | Everyone | Built |
| Monitor | Material Details | Material 360 | Everything about one part | Everyone | Built |
| Monitor | Storage and Location Map | — | Which shelves, racks, yards or tanks are full or empty; where each lot sits | Stores | Needs data |
| Plan | Shortage Forecast | Shortage Horizon | What runs short, and when? | Planners, buyers | Built |
| Plan | Build Capacity Calculator | — | How many phones can we build, and what limits it? | Planners, leadership | Planned |
| Plan | Supplier Delay Simulator | What-If | What breaks if a supplier is late? | Planners | Planned |
| Act | Purchase and Transfer Requests | Proposals | What needs ordering or moving? | Buyers | Built |
| Act | Request Review and Approval | Proposal Detail | Why this quantity, and do I approve? | Buyer, manager | Built |
| Act | Dead and Slow-Moving Stock | Excess and Obsolete | Where is cash stuck, and what do we do? | Inventory manager | Built (finishing) |
| Warehouse | Goods Receiving | — | What arrived against which PO? | Stores | Needs data |
| Warehouse | Quality Hold and Rejects | — | What is on hold, in rework or scrapped? | QC, stores | Planned |
| Warehouse | Cycle Counts and Routine Checks | — | What do we count today; where do records differ? | Stores | Planned |
| Warehouse | Finished Goods and Dispatch | — | What is ready to ship, domestic and export? | Logistics | Planned; export Needs data |
| Warehouse | Batch Traceability | — | Where did this PO, lot, batch or serial go? | QC, stores | Planned |
| Reports | Daily Inventory Report | Daily Brief | Today's summary, as text and Excel | Everyone | Built |
| Reports | Ask the Inventory Agent | Agent side panel | Any question, on any page | Everyone | Built |
| Reports | AI Agent Activity Log | Agent Activity | What did each agent do on the last run? | Everyone | Built (finishing) |
| Data | Data Import and Quality Check | Data Uploads | Did today's files arrive, and are they clean? | Data admin | Built |

Group
Page name
Was called
Answers
Main users
Status
Home
Home: Inventory at a Glance
—
What is going on and where do I go?
Everyone
Planned
Monitor
Inventory Health Dashboard
Executive Overview
How healthy is stock, by plant, in ₹?
Leadership
Built
Monitor
Stock on Hand
Stock Explorer
What is usable, where, and in what status?
Everyone
Built
Monitor
Material Details
Material 360
Everything about one part
Everyone
Built
Monitor
Storage and Location Map
—
Which shelves, racks, yards or tanks are full or empty; where each lot sits
Stores
Needs data
Plan
Shortage Forecast
Shortage Horizon
What runs short, and when?
Planners, buyers
Built
Plan
Build Capacity Calculator
—
How many phones can we build, and what limits it?
Planners, leadership
Planned
Plan
Supplier Delay Simulator
What-If
What breaks if a supplier is late?
Planners
Planned
Act
Purchase and Transfer Requests
Proposals
What needs ordering or moving?
Buyers
Built
Act
Request Review and Approval
Proposal Detail
Why this quantity, and do I approve?
Buyer, manager
Built
Act
Dead and Slow-Moving Stock
Excess and Obsolete
Where is cash stuck, and what do we do?
Inventory manager
Built (finishing)
Warehouse
Goods Receiving
—
What arrived against which PO?
Stores
Needs data
Warehouse
Quality Hold and Rejects
—
What is on hold, in rework or scrapped?
QC, stores
Planned
Warehouse
Cycle Counts and Routine Checks
—
What do we count today; where do records differ?
Stores
Planned
Warehouse
Finished Goods and Dispatch
—
What is ready to ship, domestic and export?
Logistics
Planned; export Needs data
Warehouse
Batch Traceability
—
Where did this PO, lot, batch or serial go?
QC, stores
Planned
Reports
Daily Inventory Report
Daily Brief
Today's summary, as text and Excel
Everyone
Built
Reports
Ask the Inventory Agent
Agent side panel
Any question, on any page
Everyone
Built
Reports
AI Agent Activity Log
Agent Activity
What did each agent do on the last run?
Everyone
Built (finishing)
Data
Data Import and Quality Check
Data Uploads
Did today's files arrive, and are they clean?
Data admin
Built
### KPIs

| KPI | Source | Status |
| Days of inventory | Usable ₹ ÷ daily demand ₹ | Built |
| Excess value | Engine classification | Built |
| Stockout hours | Shown as stock-out risk within lead time (proxy) | Built as proxy |
| Schedule disruption | Shown as production orders at risk (proxy) | Built as proxy |
| Inventory turns | Needs continuous consumption history | Needs data |
| Inventory record accuracy | Needs cycle-count results | Needs data |
| Inventory health % | Materials within safety and maximum stock | Built |
| Shelf occupancy %, receiving-to-shelf time, QC hold age, export on-time | Warehouse files | Needs data / Planned |

KPI
Source
Status
Days of inventory
Usable ₹ ÷ daily demand ₹
Built
Excess value
Engine classification
Built
Stockout hours
Shown as stock-out risk within lead time (proxy)
Built as proxy
Schedule disruption
Shown as production orders at risk (proxy)
Built as proxy
Inventory turns
Needs continuous consumption history
Needs data
Inventory record accuracy
Needs cycle-count results
Needs data
Inventory health %
Materials within safety and maximum stock
Built
Shelf occupancy %, receiving-to-shelf time, QC hold age, export on-time
Warehouse files
Needs data / Planned
### Reports and alerts

| Output | Trigger or schedule | Who gets it | Status |
| Daily inventory report (Excel) and written brief | Every upload | Everyone | Built |
| Critical shortage alert | A part goes below safety stock within its lead time | Planner, buyer | Built |
| Approval waiting | A request waits for a decision | Buyer, manager | Built |
| Overdue PO line | Promised date passed, quantity still open | Buyer | Planned |
| QC hold too long | Stock in QC hold past the limit | QC, stores | Planned |
| New dead or obsolete stock | Engineering change or no demand | Inventory manager | Built (finishing) |
| Count variance | Counted quantity outside tolerance | Inventory manager | Planned |
| Stale data | No upload today, or a file past its limit | Data admin | Built |

Output
Trigger or schedule
Who gets it
Status
Daily inventory report (Excel) and written brief
Every upload
Everyone
Built
Critical shortage alert
A part goes below safety stock within its lead time
Planner, buyer
Built
Approval waiting
A request waits for a decision
Buyer, manager
Built
Overdue PO line
Promised date passed, quantity still open
Buyer
Planned
QC hold too long
Stock in QC hold past the limit
QC, stores
Planned
New dead or obsolete stock
Engineering change or no demand
Inventory manager
Built (finishing)
Count variance
Counted quantity outside tolerance
Inventory manager
Planned
Stale data
No upload today, or a file past its limit
Data admin
Built
## 4. AI Intelligence
The AI layer sits on top of the processed data: rules and statistics find and predict, machine learning forecasts where history allows, and the language model (Domo AI) explains, summarises and drafts. It recommends; people approve.

| Capability | What Agent 09 does | Method | Status |
| Analyse | Why a part is short; where cash is stuck; stock health by plant and category | Engine results, explained by the language model | Built |
| Predict | Shortage date per part and plant | Deterministic 60-day projection | Built |
|  | Supplier delivery delay, as a range | Gradient boosting on 1,069 received PO lines: average error 7.9 days vs 8.6 for a simple average | Planned |
|  | Quantity that will actually arrive | Fill rate by supplier and part (95.9% on average today) | Planned |
|  | Phones that can be built | Capacity over the whole BOM | Planned |
|  | Material consumption for 30, 60, 90 days | Time-series machine learning | Needs data (continuous history) |
| Detect | Data problems before any calculation | 12 rule-based checks | Built |
|  | Shortages hidden by stock waiting for QC | Usable-stock rule | Built |
|  | Parts made obsolete by engineering changes | Engineering-change match | Built |
|  | Unusual adjustments and count variances | Statistical outlier checks | Planned |
|  | Fast-moving parts on far or empty shelves | Usage ranking against the shelf map | Needs data |
| Recommend | Order quantity, supplier and order-by date | Reorder rules, minimum order, approved supplier, best on-time record | Built |
|  | Transfer between plants instead of buying | Surplus check that protects the sending plant | Built |
|  | Expedite: whether a normal order still arrives in time | Lead time against shortage date | Built |
|  | What to do with dead stock (transfer, stop POs, review) | Classification rules | Built (finishing) |
|  | Which shelf to put a received lot on | Zone, usage and capacity rules | Needs data |
|  | Which parts to count today | Value and variance ranking | Planned |
| Automate | Daily report and written brief after every upload | Engine numbers + Domo AI; fixed-wording fallback | Built |
|  | Draft purchase and transfer requests after every run | Replenishment rules | Built |
|  | Route requests to buyer, then manager above ₹10 lakh | Approval workflow | Built |
|  | Supplier reminder emails, drafted for the buyer to send | Language model | Planned |
|  | Alerts for shortages, approvals, stale data | Rules | Built |

Capability
What Agent 09 does
Method
Status
Analyse
Why a part is short; where cash is stuck; stock health by plant and category
Engine results, explained by the language model
Built
Predict
Shortage date per part and plant
Deterministic 60-day projection
Built
Supplier delivery delay, as a range
Gradient boosting on 1,069 received PO lines: average error 7.9 days vs 8.6 for a simple average
Planned
Quantity that will actually arrive
Fill rate by supplier and part (95.9% on average today)
Planned
Phones that can be built
Capacity over the whole BOM
Planned
Material consumption for 30, 60, 90 days
Time-series machine learning
Needs data (continuous history)
Detect
Data problems before any calculation
12 rule-based checks
Built
Shortages hidden by stock waiting for QC
Usable-stock rule
Built
Parts made obsolete by engineering changes
Engineering-change match
Built
Unusual adjustments and count variances
Statistical outlier checks
Planned
Fast-moving parts on far or empty shelves
Usage ranking against the shelf map
Needs data
Recommend
Order quantity, supplier and order-by date
Reorder rules, minimum order, approved supplier, best on-time record
Built
Transfer between plants instead of buying
Surplus check that protects the sending plant
Built
Expedite: whether a normal order still arrives in time
Lead time against shortage date
Built
What to do with dead stock (transfer, stop POs, review)
Classification rules
Built (finishing)
Which shelf to put a received lot on
Zone, usage and capacity rules
Needs data
Which parts to count today
Value and variance ranking
Planned
Automate
Daily report and written brief after every upload
Engine numbers + Domo AI; fixed-wording fallback
Built
Draft purchase and transfer requests after every run
Replenishment rules
Built
Route requests to buyer, then manager above ₹10 lakh
Approval workflow
Built
Supplier reminder emails, drafted for the buyer to send
Language model
Planned
Alerts for shortages, approvals, stale data
Rules
Built
### The agents
A coordinator, the Inventory Copilot, routes each question to one of six specialists, each with its own short prompt and two or three tools: Data Reconciliation, Stock Monitoring, Shortage Forecast, Replenishment, Excess and Obsolete, and Supplier Delay. Two more are planned: Warehouse Operations (receiving, shelves, counts) and Build Capacity.
### Guardrails
The agent never calculates or invents a number; an automatic check confirms that every number in an answer appears in the tool results.
It reads through a read-only database role and cannot approve, release or change anything.
Every answer names the data date and any assumption or planning scenario it relies on.
A forecast model goes live only if it beats a simple average in a time-based backtest.
The agent is being evaluated on 30 questions with known answers; targets are at least 27 correct, no invented numbers, and 95% of answers within 15 seconds.
## Data readiness
Raw-material inventory runs end to end on today's data; the warehouse-side features need the eight inputs listed under Input, and six answers from the organization decide how the numbers read.

| Question for the organization | Why it matters |
| Plan against open production orders or a forward plan? | Open orders need a median 19.2× usable stock, so every part reads critical |
| Are the ₹137 Cr of future-dated receipts stock, expected supply, or neither? | Changes shortage and excess results |
| Which suppliers are approved for each part, including Audio and Connector? | 89% of PO lines use a supplier outside the part's category |
| Do allocated, blocked and QC-hold quantities overlap? Which safety stock is official? | Defines usable stock |
| Is one BOM for all three phone models intended? Solder usage per phone? | Capacity and consumable demand |
| Can customer orders be linked to production orders? | Unlocks customer impact, two Agent 09 requirements |

Question for the organization
Why it matters
Plan against open production orders or a forward plan?
Open orders need a median 19.2× usable stock, so every part reads critical
Are the ₹137 Cr of future-dated receipts stock, expected supply, or neither?
Changes shortage and excess results
Which suppliers are approved for each part, including Audio and Connector?
89% of PO lines use a supplier outside the part's category
Do allocated, blocked and QC-hold quantities overlap? Which safety stock is official?
Defines usable stock
Is one BOM for all three phone models intended? Solder usage per phone?
Capacity and consumable demand
Can customer orders be linked to production orders?
Unlocks customer impact, two Agent 09 requirements
## Template for the other agents
Each of the 20 agents is documented with the same four components and the same three statuses; the questions below are the template, with Agent 09's answer as the worked example.

| Component | Questions every agent answers | Agent 09 in one line |
| 1. Input | Which data, from which application, which tables, columns and APIs? What is missing? | 13 files from ERP, WMS, PLM, MES, QMS and logistics; 8 inputs still needed |
| 2. Processing | Which transformations, calculations, business rules and data model? | 12-stage pipeline: usable stock, 60-day projection, reorder rules, approvals |
| 3. Presentation | Which pages, dashboards, KPIs, reports and alerts, for which users? | 20 pages in six groups, from Home to Data Import, plus daily report and alerts |
| 4. AI Intelligence | What does it analyse, predict, detect, recommend and automate, and with what guardrails? | Explains shortages, forecasts supplier delays, drafts requests; people approve |

Component
Questions every agent answers
Agent 09 in one line
1. Input
Which data, from which application, which tables, columns and APIs? What is missing?
13 files from ERP, WMS, PLM, MES, QMS and logistics; 8 inputs still needed
2. Processing
Which transformations, calculations, business rules and data model?
12-stage pipeline: usable stock, 60-day projection, reorder rules, approvals
3. Presentation
Which pages, dashboards, KPIs, reports and alerts, for which users?
20 pages in six groups, from Home to Data Import, plus daily report and alerts
4. AI Intelligence
What does it analyse, predict, detect, recommend and automate, and with what guardrails?
Explains shortages, forecasts supplier delays, drafts requests; people approve
Using the same mobile-manufacturing reference data across agents lets them share tables: the BOM, plants and production orders used here are the same ones the planning, quality and supplier agents read.
