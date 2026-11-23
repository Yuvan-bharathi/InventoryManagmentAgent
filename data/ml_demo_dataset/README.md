# ML demo dataset: Agent 09 Inventory Intelligence Engine

Synthetic, internally consistent data for training and testing the build-capacity and incoming-material forecasts. It is built on the organization's real master data (materials, products, BOM, plants, suppliers, prices, lead times) because the organization's transaction files cannot train these models: their daily snapshots are not a continuous history, and they contain no incoming QC, no material-issue records and no future production plan.

**This is synthetic data.** Load it as its own tenant, `ML-DEMO`, never into the organization's tenant `ORG-01`. Never present its figures as the organization's numbers, and never claim a model "discovered" a pattern listed under Planted patterns: those were put there on purpose.

## Period

| Part | Dates | Use |
| --- | --- | --- |
| History | 1 May 2025 to 31 Oct 2026 (18 months) | Train and backtest models; load into the app |
| Future plan | 1 Nov 2026 to 29 Jan 2027 (90 days) | Forecast against it |
| Holdout | Same 90 days, with what actually happened | Score forecasts after the fact; do not load into the app |

As-of date: 31 October 2026, the same as the organization's data.

## How it was made

One day-by-day simulation of both plants, so every table agrees with every other:

1. A seasonal production plan (Sundays off; festive build-up August to October; dip in January and February; slow growth).
2. Production limited by the parts actually usable that day; shortfalls recorded with the limiting part.
3. Material issued per the BOM, with actual losses that vary around the standard.
4. Weekly reorder review: purchase orders in real pack sizes, safety stock sized by supplier risk.
5. Suppliers deliver early, late or in two shipments, following the delay patterns below.
6. Every receipt sits in QC hold for 1 to 3 days; incoming inspection by sample (125 pieces or 13 inner packs); rejected quantity returned after 7 days.
7. Daily stock snapshot; weekly cycle counts.

Fixed random seed: running `tools/generate_ml_data.py` gives the same files every time.

## Files

### data/ (load into tenant ML-DEMO)

| File | Rows | What it holds | Feeds |
| --- | --- | --- | --- |
| `dim_material_extended.csv` | 19 | The 18 organization materials plus synthetic `MAT-WIRE-019` Solder Wire | All |
| `material_packaging_conversions.csv` | 19 | Purchase pack → inner pack → base unit, e.g. solder wire BOX = 10 COIL × 0.1 kg | Receipt-to-capacity calculator |
| `bom_process_parameters.csv` | 57 | Quantity per finished unit and standard loss, per product and material | Capacity, demand, scrap drift |
| `supplier_material_assignment.csv` | 20 | Which supplier supplies which material (NAND dual-sourced 70/30) | Delay model |
| `fact_po_line.csv` | 982 | Purchase orders: dates, promised date, packs, quantity, price | Delay and fill models |
| `fact_goods_receipt.csv` | 1,106 | Receipts with lot, expiry, packs and shipment number (partials = 2 shipments) | Delay, fill, capacity |
| `fact_incoming_inspection.csv` | 1,101 | Incoming QC per receipt: sample, defects, accepted, rejected, result | QC pass-rate model |
| `fact_material_issue.csv` | 17,499 | Daily issues per material: standard vs actual quantity | Scrap drift, consumption forecast |
| `fact_production_daily.csv` | 2,826 | Planned vs good units per plant and product; units lost to material and the limiting part | Demand, capacity validation |
| `fact_production_plan_future.csv` | 462 | Planned units for the next 90 days | Capacity forecast |
| `fact_inventory_daily.csv` | 20,862 | Daily usable, QC hold, blocked, on hand and on order, per plant and material | Projections, record accuracy |
| `fact_cycle_count.csv` | 474 | Weekly counts: system vs counted quantity | Record accuracy |

### holdout/ (score forecasts only)

`holdout_goods_receipt.csv` (35 receipts for orders open on 31 Oct), `holdout_incoming_inspection.csv` (155), `holdout_production_daily.csv` (462), `holdout_material_issue.csv` (2,869), `holdout_inventory_daily.csv` (3,420).

### tools/

`generate_ml_data.py` rebuilds everything (`ORG_DATA` = folder with the organization CSVs, `OUT_DIR` = output folder). `delay_features.py` builds delay-model features without leakage. `validate_ml_data.py` re-runs the checks below.

## Planted patterns (the ground truth)

| Pattern | Rule in the generator | What a model should learn |
| --- | --- | --- |
| Supplier risk | Base delay 1 / 3 / 5 days for low / medium / high risk; noise 1.5 / 3.5 / 5 days | Supplier-level reliability |
| Lunar New Year | China +12 days, Vietnam +6 days for promised dates late January to February | Seasonal import delays |
| Monsoon | Indian suppliers +3 days, July to September | Domestic seasonality |
| Typhoon season | Taiwan, Japan, South Korea +2 days, August to September | Regional seasonality |
| Inland plant | Imports to Bengaluru +2 days (cleared at Chennai port) | Plant effect |
| Order size | +1.5 days per doubling above two weeks of demand | Size effect |
| Quarter-end | Indian suppliers +2 days in the last week of each quarter | Calendar effect |
| Supplier trends | Packaging supplier SUP-008 worsens through 2026; battery supplier SUP-005 improves | Recent-performance features |
| Disruptions | 4% of orders +10 to 20 days | Heavy tail, ranges not points |
| Partial deliveries | 10% / 20% / 35% of orders by risk tier; balance 5 to 15 days later | Partial-receipt handling |
| Short delivery | 5% of orders (15% for high risk) arrive at 95 to 99% | Fill rate |
| Incoming QC | Defect rate 0.2% / 0.5% / 1.2% by tier; whole-lot reject 0.5% / 1.5% / 3% | QC pass rate |
| Packaging defects | SUP-008 defect rate ×4 and +6 days delay, March to April 2026 | Supplier incident |
| Solder paste drift | Bengaluru paste loss rises from 8% to 12% from 1 June 2026 | Scrap drift detection |
| Memory price | Memory and storage IC prices +8% from 1 March 2026 | Price change scenario |

## Assumptions carried from the application

| ID | Assumption | Value |
| --- | --- | --- |
| A22 | Solder paste per phone (not in the organization's BOM) | 0.5 g (Aster 15), 0.6 g (Aster Pro); 8% standard loss |
| A23 | Thermal adhesive per phone (not in the BOM) | 0.3 g; 5% standard loss |
| A24 | Audio and connector parts have no category supplier in the master | Assigned to SUP-009 RF Connect Systems |
| A25 | Solder wire is a synthetic material added for the boxes-of-coils example | 0.2 g per phone; 10% standard loss |

The organization's own stock policies (for example 3,600 kg safety stock of solder paste) do not match the consumption scale, so the generator sizes its own reorder points and safety stock from demand and supplier risk.

## Validation results (from `tools/validate_ml_data.py`)

| Check | Result |
| --- | --- |
| Stock reconciles with receipts and issues, every day | Max error 0.0001 |
| Plan attainment | Bengaluru 94.9%, Chennai 93.6% |
| Lunar New Year (China supplier, February vs rest) | 23.7 vs 7.4 days late |
| Imports to Bengaluru vs Chennai | 5.7 vs 3.9 days late |
| Solder paste actual/standard at Bengaluru, before vs after June 2026 | 1.000 vs 1.039 |
| Incoming QC results | 708 accepted, 382 accepted after screening, 11 lots rejected |
| Delivery-delay model, 3 rolling time windows | Ridge regression error 2.52 to 2.72 days vs 2.80 to 3.08 for the supplier average: **11.7% better** |

An off-the-shelf tree model on raw columns did worse than the supplier average; the gain comes from domain features (inland imports, order size, calendar flags, each supplier's recent record). Likely-range forecasts covered 72 to 76% of outcomes against an 80% target, so they need a calibration step before use.

## Worked examples for the capacity calculator

| Received | Conversion | Standard use | Units this receipt alone supports |
| --- | --- | --- | --- |
| 20 boxes of solder wire | 20 × 10 coils × 0.1 kg = 20 kg | 0.2 g × 1.10 per phone | 90,909 phones |
| 1 case of solder paste | 10 jars × 0.5 kg = 5 kg | 0.5 g × 1.08 per Aster 15 | 9,259 phones |
| 10 boxes of main PCB | 10 × 10 panels × 5 boards = 500 | 1 × 1.005 per phone | 497 phones |

What a receipt adds to the plant is a different number: plant capacity is the lowest across all parts, so a receipt of a part that is not the bottleneck adds nothing until the limiting part is replenished.

## Models this supports

| Model | Training files | Target |
| --- | --- | --- |
| Delivery delay (range) | `fact_po_line`, `fact_goods_receipt`, supplier master | First-shipment receipt date minus promised date |
| Quantity received | `fact_po_line`, `fact_goods_receipt` | Received ÷ ordered; chance of a partial |
| Incoming QC pass rate | `fact_incoming_inspection` | Accepted ÷ received, per supplier and material |
| Actual usage per unit | `fact_material_issue` | Issued ÷ standard; drift alerts |
| Consumption forecast | `fact_production_daily`, `fact_material_issue`, future plan | Daily issue per material and plant |
| Build-capacity forecast | All of the above + `material_packaging_conversions`, `bom_process_parameters` | Units buildable per day, likely and cautious |

Score every model on time-based windows, against a simple baseline, before it goes live; then score its 90-day forecasts against `holdout/`.
