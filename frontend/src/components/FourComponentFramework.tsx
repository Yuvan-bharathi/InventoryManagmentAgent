import { useState } from 'react'
import { Link } from 'react-router-dom'

export interface AgentFourPillars {
  id: string
  code: string
  title: string
  tagline: string
  role: string
  accentColor: string
  badgeBg: string
  borderColor: string
  icon: string
  inputs: {
    sourceApps: string[]
    tables: string[]
    columns: string[]
    apis: string[]
    dataHygiene: string[]
  }
  processing: {
    deterministicFormulas: string[]
    businessRules: string[]
    dataModels: string[]
  }
  presentation: {
    pages: { name: string; path: string }[]
    kpis: string[]
    alerts: string[]
  }
  aiIntelligence: {
    analyse: string
    predict: string
    detect: string
    recommend: string
    automate: string
    guardrails: string
  }
}

export const FOUR_COMPONENT_AGENTS: AgentFourPillars[] = [
  {
    id: 'agt-01',
    code: 'AGT-01',
    title: 'Data Reconciliation & Ingestion Agent',
    tagline: 'Source-neutral ERP/WMS/MES ingest & 12 pre-flight data quality rules',
    role: 'Data Engineering & Hygiene',
    accentColor: '#0284C7',
    badgeBg: '#E0F2FE',
    borderColor: '#BAE6FD',
    icon: '🔄',
    inputs: {
      sourceApps: ['SAP ERP (MM/PP)', 'Blue Yonder WMS', 'Siemens Opcenter MES'],
      tables: ['dim_material', 'fact_inventory_daily_snapshot', 'fact_purchase_order_receipt', 'dim_supplier'],
      columns: [
        'material_id, standard_cost_inr, safety_stock_qty, moq, uom',
        'plant_id, on_hand_qty, allocated_qty, blocked_qty, qc_hold_qty',
        'po_id, po_line, promised_date, ordered_qty, unit_price_inr'
      ],
      apis: ['POST /api/uploads/csv', 'GET /api/connectors/health', 'GET /api/erp/inventory/snapshot'],
      dataHygiene: [
        '12 automated pre-flight data audits before calculation runs',
        'Zero-stock and negative balance anomaly quarantine',
        'Multi-currency normalization (USD/EUR → INR) at daily FX rate',
        'Reel-to-unit and box-to-piece UOM standardization (A2)'
      ]
    },
    processing: {
      deterministicFormulas: [
        'Data Completeness Rate = (Valid Rows ÷ Total Ingested Rows) × 100',
        'Ledger Variance (INR) = |ERP On-Hand − WMS Physical Count| × Standard Cost',
        'Currency Normalization: Cost_INR = Quoted_FX × FX_Spot_Rate'
      ],
      businessRules: [
        'A1: Independent snapshots treated as state points, not continuous flows',
        'A2: Raw component conversions strictly follow engineering master units',
        'Fatal DQ failure halts downstream calculation pipeline (Zero dirty-data propagation)'
      ],
      dataModels: ['Analytical Staging Mart (clean_inventory_staging)', 'Audit Exception Ledger (dq_violations)']
    },
    presentation: {
      pages: [
        { name: 'Data Import & Quality Check', path: '/uploads' },
        { name: 'Connected Databases & Feeds', path: '/connectors' },
        { name: 'Cycle Counts & Routines', path: '/cycle-counts' }
      ],
      kpis: ['Data Freshness (Hours)', 'DQ Rule Violations (Count)', 'Ingested Records (6,624)', 'Schema Health (100%)'],
      alerts: ['Stale ERP file upload warning (>24h)', 'Negative stock balance detected on bin', 'Unmapped SKU code flag']
    },
    aiIntelligence: {
      analyse: 'Correlates ERP ledger variances with specific shop floor shift changeovers and unrecorded drop-damage.',
      predict: 'Predicts incoming batch sync delays based on ERP interface queue congestion and server latency.',
      detect: 'Detects phantom inventory records, orphaned lot numbers, and overlapping QC-hold buckets.',
      recommend: 'Recommends automated credit/debit ledger reconciliation or manual storekeeper cycle recounts.',
      automate: 'Automatically triggers the 12-stage Calculation Run engine upon clean file delivery.',
      guardrails: 'Strictly read-only database role (agent_ro); cannot overwrite ERP physical inventory records.'
    }
  },
  {
    id: 'agt-02',
    code: 'AGT-02',
    title: 'Stock Monitoring & Continuous Health Agent',
    tagline: 'Continuous physical balance audits, safety buffers & working capital exposure',
    role: 'Physical Stock Governance',
    accentColor: '#059669',
    badgeBg: '#ECFDF5',
    borderColor: '#A7F3D0',
    icon: '📦',
    inputs: {
      sourceApps: ['Blue Yonder WMS', 'SAP MM', 'Storage Master'],
      tables: ['fact_inventory_daily_snapshot', 'dim_material', 'dim_plant', 'fact_quality_inspection'],
      columns: [
        'snapshot_date, plant_id, material_id, on_hand_qty, allocated_qty, blocked_qty, qc_hold_qty',
        'standard_cost_inr, safety_stock_qty, max_stock_qty, category'
      ],
      apis: ['GET /api/inventory/overview', 'GET /api/inventory/stock-position/{plant_id}', 'GET /api/stock-summary'],
      dataHygiene: [
        'Excludes blocked and QC-hold lots from usable stock pools',
        'Reconciles dual-plant balances between Chennai (IN-TN-01) and Bengaluru (IN-KA-01)',
        'Filters out expired batch lots before computing Days of Cover'
      ]
    },
    processing: {
      deterministicFormulas: [
        'Usable Stock = max(0, On Hand − (Allocated + Blocked + QC Hold))',
        'Total Inventory Valuation (INR) = Σ (On Hand Qty × Standard Cost)',
        'Days of Cover = Usable Stock ÷ Average Daily Consumption',
        'Health % = (Count of Materials within Safe Buffer Bands ÷ Total Materials) × 100'
      ],
      businessRules: [
        'Critical Buffer Rule: Days of Cover < 7 days triggers immediate Critical Alert',
        'At-Risk Buffer Rule: Usable stock below safety stock threshold',
        'Healthy Buffer Rule: Safety Stock ≤ Usable Stock ≤ Max Policy Stock'
      ],
      dataModels: ['fact_material_status (Unified daily plant-SKU balances)', 'dim_plant_hierarchy']
    },
    presentation: {
      pages: [
        { name: 'Inventory Health Dashboard', path: '/overview' },
        { name: 'Stock on Hand Explorer', path: '/stock' },
        { name: 'Material 360 Details', path: '/material' }
      ],
      kpis: ['Inventory Health % (Benchmark: ≥80%)', 'Total Stock Value (₹18.07 Cr)', 'Critical SKUs (<7 Days)', 'Days of Cover (17 Days)'],
      alerts: ['Buffer breach on SMT lines', 'Excess capital locked in inactive packaging', 'Plant health drop below benchmark']
    },
    aiIntelligence: {
      analyse: 'Decomposes capital distribution across 11 material categories (Semiconductors, Displays, Acoustics).',
      predict: 'Forecasts end-of-quarter holding costs and working capital drag based on current run-rates.',
      detect: 'Detects silent stock erosions where fast-moving SMT components deplete faster than ERP consumption logs.',
      recommend: 'Recommends inter-plant inventory transfers when one plant has surplus and the other faces critical shortage.',
      automate: 'Generates daily morning operations brief delivered to stores superintendents.',
      guardrails: 'Every number rendered is verified against deterministic SQL facts via Grounding Gate.'
    }
  },
  {
    id: 'agt-03',
    code: 'AGT-03',
    title: 'Shortage Forecast & Depletion Curve Agent',
    tagline: '30/60/90-day forward demand projections & line halt prevention',
    role: 'Predictive Supply Planning',
    accentColor: '#D97706',
    badgeBg: '#FFFBEB',
    borderColor: '#FDE68A',
    icon: '⚠️',
    inputs: {
      sourceApps: ['SAP PP/MM', 'Siemens Opcenter MES', 'Purchasing PO Book'],
      tables: ['fact_inventory_daily_snapshot', 'fact_production_order', 'fact_bom_component', 'fact_purchase_order_receipt'],
      columns: [
        'usable_stock_qty, material_id, plant_id',
        'order_id, planned_qty, start_date, due_date, line_id',
        'component_qty_per_unit, scrap_factor_pct',
        'po_id, promised_date, ordered_qty, po_status'
      ],
      apis: ['GET /api/inventory/shortage-horizon', 'GET /api/inventory/demand-forecast'],
      dataHygiene: [
        'Tolerates lead-time volatility and filters cancelled PO lines',
        'Netting confirmed PO receipts strictly on promised arrival dates',
        'Compounding scrap rate multipliers per SMT feeder station'
      ]
    },
    processing: {
      deterministicFormulas: [
        'Projected Stock(t) = Projected Stock(t-1) + Confirmed Receipts(t) − Planned Consumption(t)',
        'Stockout Horizon: Earliest date where Projected Stock(t) ≤ 0',
        'Buffer Breach Horizon: Earliest date where Projected Stock(t) < Safety Stock',
        'Stockout Hours = (Gross Required − Usable Stock) ÷ Hourly Line Rate'
      ],
      businessRules: [
        'A18: Forward planning scenario utilizes smoothed master production schedule',
        'A21: Production order horizon maps open work orders directly to confirmed SMT line dates',
        'Shortage severity ranking prioritized by line stoppage financial impact'
      ],
      dataModels: ['fact_inventory_projection (60-day daily forward ledger)', 'dim_shortage_severity']
    },
    presentation: {
      pages: [
        { name: 'Shortage Forecast Horizon', path: '/shortages' },
        { name: 'Material 360 Depletion View', path: '/material' },
        { name: 'Daily Inventory Report', path: '/brief' }
      ],
      kpis: ['Earliest Stockout Date (e.g. 23-Nov)', 'Production Orders at Risk (180 Orders)', 'Critical Shortages (7 Items)', 'Shortfall Value (₹ Lakhs)'],
      alerts: ['Line halt countdown alert (<72 hours)', 'Safety buffer breached on Aster 15 Pro display', 'Delayed PO triggers line stoppage']
    },
    aiIntelligence: {
      analyse: 'Correlates supplier delivery variance against production schedule density to assess risk.',
      predict: 'Forecasts the exact shift when SMT Line 01 will halt if component delivery is delayed by even 48 hours.',
      detect: 'Detects simultaneous multi-component depletion on shared parts (e.g. LPDDR5 RAM shared across models).',
      recommend: 'Recommends optimal purchase order placement date (T_order = T_breach − Supplier Lead Time).',
      automate: 'Dispatches structured shortage requirement payloads to the Replenishment Agent (AGT-05).',
      guardrails: 'Calculations run in deterministic C++/Python math engine; AI is strictly forbidden from estimating numbers.'
    }
  },
  {
    id: 'agt-04',
    code: 'AGT-04',
    title: 'Build Capacity & BOM Twin Agent',
    tagline: '16-component BOM explosion, limiting bottleneck identification & assembly ceilings',
    role: 'Digital Twin & Capacity',
    accentColor: '#B45309',
    badgeBg: '#FFFDF7',
    borderColor: '#FCD34D',
    icon: '📱',
    inputs: {
      sourceApps: ['PTC Windchill PLM', 'Siemens Opcenter MES', 'WMS Usable Balances'],
      tables: ['dim_product', 'fact_bom_component', 'fact_inventory_daily_snapshot', 'fact_work_center'],
      columns: [
        'product_id (SPH-A15-128, SPH-PRO-256), model_name',
        'material_id, component_qty_per_unit, scrap_factor_pct, assembly_stage',
        'usable_stock_qty, plant_id'
      ],
      apis: ['GET /api/inventory/build-capacity', 'POST /api/inventory/capacity-simulation'],
      dataHygiene: [
        'Validates 100% BOM parent-child integrity across 16 component parts',
        'Accounts for station scrap loss (0.1% to 0.5%) per sub-assembly tier',
        'Enforces inner-pack to unit multiplier conversions'
      ]
    },
    processing: {
      deterministicFormulas: [
        'Required Qty per Phone = BOM Qty × (1 + Scrap Factor)',
        'Gross Buildable Handsets = min_i [ floor(Usable Stock_i ÷ Required Qty_i) ]',
        'Protected Buildable Handsets = min_i [ floor(max(0, Usable Stock_i − Safety Stock_i) ÷ Required Qty_i) ]',
        'Limiting Bottleneck SKU = argmin_i [ Usable Stock_i ÷ Required Qty_i ]'
      ],
      businessRules: [
        'Zero-defect kitting rule: Handset assembly cannot start without all 16 BOM parts available',
        'Safety stock protection rule: Protected capacity drops to 0 if any single part is below safety buffer',
        'Target volume shortfall formula: Shortfall = max(0, (Target − Capacity) × Adjusted Req)'
      ],
      dataModels: ['fact_bom_twin (Recursive product tree)', 'dim_line_capacity_constraints']
    },
    presentation: {
      pages: [
        { name: 'Build Capacity Calculator', path: '/capacity' },
        { name: '3D Shelf & Digital Twin', path: '/digital-twin' },
        { name: '3D Facility Flow', path: '/warehouse-3d' }
      ],
      kpis: ['Gross Buildable Aster 15 (2,087 Handsets)', 'Protected Units (0 Units)', 'Primary Bottleneck (MAT-PCB-004)', 'Target Shortfall (+7,953 EA)'],
      alerts: ['Kitting imbalance alert (High SoC stock vs low PCB stock)', 'Assembly ceiling restricted by ₹12 antenna cable']
    },
    aiIntelligence: {
      analyse: 'Analyzes kit balance across shared sub-assemblies (e.g. Aster 15 Standard vs Pro model components).',
      predict: 'Predicts plant capacity uplift when a pending receipt of the bottleneck component clears dock receiving.',
      detect: 'Detects stranded capital where ₹15 Cr of chipsets sit idle because a ₹150 speaker module is stockout.',
      recommend: 'Recommends optimal production mix re-allocation to maximize revenue from currently available parts.',
      automate: 'Translates target production volume gaps into exact purchase requisition lines.',
      guardrails: 'BOM explosion formulas are locked to engineering master data; scrap multipliers cannot be overridden by AI.'
    }
  },
  {
    id: 'agt-05',
    code: 'AGT-05',
    title: 'Replenishment & Purchase Proposals Agent',
    tagline: 'Automated MOQ-rounded purchase orders & 2-tier approval workflows',
    role: 'Procurement Automation',
    accentColor: '#7C3AED',
    badgeBg: '#FAF5FF',
    borderColor: '#E9D5FF',
    icon: '📝',
    inputs: {
      sourceApps: ['SAP S/4HANA Purchasing', 'Vendor Contracts', 'Inter-Plant Transit Master'],
      tables: ['dim_material', 'dim_supplier', 'fact_inventory_daily_snapshot', 'fact_purchase_order_receipt'],
      columns: [
        'reorder_point_qty, safety_stock_qty, moq, supplier_lead_time_days',
        'supplier_id, supplier_name, approved_status, payment_terms, unit_cost_inr',
        'usable_stock_qty, plant_id'
      ],
      apis: ['GET /api/procurement/proposals', 'POST /api/procurement/proposals/approve', 'POST /api/procurement/proposals/reject'],
      dataHygiene: [
        'Validates vendor active certification before routing draft POs',
        'Rounds order quantities up to standard supplier pack and pallet sizes',
        'Checks dual-plant surplus before triggering external purchases'
      ]
    },
    processing: {
      deterministicFormulas: [
        'Net Shortage = max(0, Gross Demand + Safety Stock − (Usable Stock + Confirmed POs))',
        'Order Quantity = ceil(max(Net Shortage, MOQ) ÷ Pack Size) × Pack Size',
        'Total Order Value (INR) = Order Quantity × Quoted Landed Unit Price'
      ],
      businessRules: [
        'Inter-Plant Priority: If alternate plant has >21 days buffer headroom, create Transfer Order before external PO',
        'Tier 1 Approval: Buyer release for PO value < ₹10,00,000',
        'Tier 2 Co-Sign: Procurement Manager approval mandatory for PO value ≥ ₹10,00,000'
      ],
      dataModels: ['fact_replenishment_proposal', 'dim_approval_hierarchy_matrix']
    },
    presentation: {
      pages: [
        { name: 'Purchase Order Approvals', path: '/proposals' },
        { name: 'Request Review & Approval', path: '/proposal' },
        { name: 'Smart Procurement & RFQ', path: '/procurement' }
      ],
      kpis: ['Pending Proposals (8 Proposals)', 'Pending Value (₹2.37 Lakhs)', 'Inter-Plant Transfer Feasibility (100%)', 'Avg Approval SLA (2.4h)'],
      alerts: ['Expedite required on critical connector', 'Managerial sign-off pending on high-value chipset order']
    },
    aiIntelligence: {
      analyse: 'Evaluates supplier quantity price discount tiers against incremental warehouse holding cost.',
      predict: 'Predicts delivery buffer consumption if an order is placed today vs at standard reorder point.',
      detect: 'Detects duplicate purchase recommendations when an in-transit order is already on water/road.',
      recommend: 'Recommends whether to purchase from primary vendor, secondary dual-source, or initiate plant transfer.',
      automate: 'Drafts complete purchase order schemas in SAP ERP with itemized justification memos.',
      guardrails: 'Strictly cannot execute purchase orders autonomously; human buyer authorization is non-negotiable.'
    }
  },
  {
    id: 'agt-06',
    code: 'AGT-06',
    title: 'Smart Procurement & RFQ Comparison Agent',
    tagline: 'Multi-criteria supplier quote scoring, OTIF tracking & commercial optimization',
    role: 'Strategic Sourcing',
    accentColor: '#4F46E5',
    badgeBg: '#EEF2FF',
    borderColor: '#C7D2FE',
    icon: '⚖️',
    inputs: {
      sourceApps: ['Supplier Quotation Portal', 'SAP S/4HANA Purchasing', 'QMS Vendor Scorecard'],
      tables: ['fact_rfq_quote', 'dim_supplier', 'fact_purchase_order_receipt', 'fact_quality_inspection'],
      columns: [
        'rfq_id, material_id, supplier_id, quoted_unit_price_inr, moq, lead_time_days, quote_valid_days, technical_compliance',
        'approved_status, risk_tier, payment_terms, actual_receipt_date, promised_date'
      ],
      apis: ['GET /api/procurement/rfq/compare/{material_id}', 'POST /api/procurement/rfq/draft-po'],
      dataHygiene: [
        'Filters out quotations past validity date (>30 days old)',
        'Mandatory gate: Supplier must be certified (approved_status = TRUE)',
        'Normalizes payment terms (e.g. NET 30 vs NET 60 cash discounts)'
      ]
    },
    processing: {
      deterministicFormulas: [
        'S_price = (min_k(Price_k) ÷ Price_j) × 100',
        'S_delivery = (min_k(LeadTime_k) ÷ LeadTime_j) × 100',
        'S_OTIF = (On-Time Completed PO Receipts ÷ Total Completed PO Receipts) × 100',
        'Composite Score = 0.35(S_price) + 0.25(S_delivery) + 0.20(S_OTIF) + 0.15(S_quality) + 0.05(S_MOQ)'
      ],
      businessRules: [
        'Technical compliance is a non-negotiable binary gate: Non-compliant quotes are excluded from matrix',
        'Single-source threshold: Critical parts must have at least 2 qualified suppliers in active roster',
        'Supplier risk weighting configurable by Chief Procurement Officer'
      ],
      dataModels: ['fact_rfq_quote_matrix', 'dim_supplier_scorecard_history']
    },
    presentation: {
      pages: [
        { name: 'Smart Procurement & RFQ Comparison', path: '/procurement' },
        { name: 'Purchase Order Approvals', path: '/proposals' },
        { name: 'Material 360 Details', path: '/material' }
      ],
      kpis: ['Best-Value Supplier Rank (#1)', 'Potential Cost Savings (₹14.2 Lakhs)', 'Supplier Historical OTIF (94.2%)', 'Quoted Lead Time (12 Days)'],
      alerts: ['Price outlier detected (>15% above historical moving avg)', 'Vendor lead time drift warning']
    },
    aiIntelligence: {
      analyse: 'Compares real-time vendor quotes against 6-month historical moving averages and global market indices.',
      predict: 'Predicts supplier fulfillment risk based on seasonal delivery bottlenecks and port congestion.',
      detect: 'Detects vendor price inflation creep and unannounced minimum order quantity increases.',
      recommend: 'Recommends optimal order split between low-cost overseas supplier and fast domestic buffer vendor.',
      automate: 'Populates side-by-side quote comparison cards (Kkonnect.io style) with 1-click Draft PO creation.',
      guardrails: 'Agent cannot negotiate contractual prices or sign vendor agreements without human sign-off.'
    }
  },
  {
    id: 'agt-07',
    code: 'AGT-07',
    title: 'Supplier Delay & ML Disruption Simulation Agent',
    tagline: 'Lead-time disruption stress testing (+7d/+14d), buffer absorption & line halt risk',
    role: 'Supply Chain Risk Simulation',
    accentColor: '#C026D3',
    badgeBg: '#FDF4FF',
    borderColor: '#F5D0FE',
    icon: '🔮',
    inputs: {
      sourceApps: ['TMS Logistics', 'Carrier GPS Tracking', 'Historical PO Receipt Ledger'],
      tables: ['fact_purchase_order_receipt', 'dim_supplier', 'fact_production_order', 'fact_inventory_daily_snapshot'],
      columns: [
        'po_id, supplier_id, material_id, promised_date, receipt_date, ordered_qty',
        'mean_delay_days, variance_delay, on_time_rate_pct',
        'planned_qty, start_date, usable_stock_qty'
      ],
      apis: ['POST /api/simulation/run-stress-test', 'GET /api/simulation/supplier-risk-profiles'],
      dataHygiene: [
        'Normalizes transit milestone timestamps across 4 domestic carriers',
        'Filters out weather force-majeure anomalies from standard baseline drift',
        'Weights recent 90-day vendor deliveries higher than 1-year historical logs'
      ]
    },
    processing: {
      deterministicFormulas: [
        'Historical Lead Time Delay Distribution: L ~ Normal(μ, σ²)',
        'Buffer Absorption (Days) = (Usable Stock − Safety Stock) ÷ Daily Consumption',
        'Line Halt Probability = P(Simulated Delay > Buffer Absorption Days)',
        'Downtime Cost (INR) = Line Stoppage Hours × Factory Overhead Rate'
      ],
      businessRules: [
        'Delay simulation allows operator to test disruption sliders from +3 to +30 days',
        'If delay exceeds safety buffer absorption, system must flag impacted customer orders',
        'Air-freight expedite rule: Triggered when downtime penalties exceed freight premium'
      ],
      dataModels: ['fact_lead_time_simulation_run', 'dim_carrier_sla_performance']
    },
    presentation: {
      pages: [
        { name: 'Supplier Delay Simulator', path: '/simulation' },
        { name: 'Finished Goods & Dispatch', path: '/dispatch' },
        { name: 'Agent Testing Playground', path: '/agent-tester' }
      ],
      kpis: ['Simulated Line Halts (0 Halts at +7d)', 'Buffer Headroom (11 Days)', 'Delayed Orders at Risk (0 Orders)', 'Expedite Savings (₹ Cr)'],
      alerts: ['Buffer collapse warning on camera module', 'Supplier delay exceeds line restart threshold']
    },
    aiIntelligence: {
      analyse: 'Analyzes carrier lane choke points and customs clearance bottlenecks at Chennai & Bengaluru air cargo.',
      predict: 'Predicts vendor shipment delivery delay using LightGBM / regression on historical vendor reliability.',
      detect: 'Detects creeping delivery date push-backs where suppliers revise delivery dates by 2–3 days repeatedly.',
      recommend: 'Recommends triggering emergency air-freight charter or dual-source buffer activation.',
      automate: 'Drafts proactive schedule revision warnings to master line balancing planners.',
      guardrails: 'Simulations run in isolated sandbox memory; master production schedules remain untouched.'
    }
  },
  {
    id: 'agt-08',
    code: 'AGT-08',
    title: 'Incoming QC & Lot Acceptance Agent',
    tagline: 'Dock lot inspection, defect Pareto tracking, quarantine segregation & RMA',
    role: 'Quality & Quarantine Governance',
    accentColor: '#10B981',
    badgeBg: '#F0FDF4',
    borderColor: '#BBF7D0',
    icon: '🔬',
    inputs: {
      sourceApps: ['QMS (ETQ Reliance)', 'AOI Automated Optical Inspection', 'Dock Receiving Log'],
      tables: ['fact_quality_inspection', 'dim_defect_catalog', 'fact_goods_receipt', 'dim_material'],
      columns: [
        'inspection_id, lot_id, material_id, plant_id, inspect_date, sample_size, rejected_qty, pass_fail_status, disposition',
        'defect_code, defect_name, severity_level, category'
      ],
      apis: ['GET /api/quality/inspections/pending', 'POST /api/quality/disposition/execute', 'GET /api/warehouse/receiving'],
      dataHygiene: [
        'Zero-trust quarantine: All incoming raw material lots locked in QC-Hold by default',
        'Compulsory sample size validation per ISO 2859-1 AQL standards',
        'Mandatory defect code taxonomy mapping across SMT and Mechanical lots'
      ]
    },
    processing: {
      deterministicFormulas: [
        'Lot Acceptance Rate (%) = (Accepted Lots ÷ Total Inspected Lots) × 100',
        'Defect Rate (PPM) = (Defective Units ÷ Total Sampled Units) × 1,000,000',
        'First Pass Yield (FPY) = Π (Pass Units_k ÷ Tested Units_k)',
        'Quarantine Capital (INR) = Σ (Quarantined Qty × Standard Cost)'
      ],
      businessRules: [
        'Safety-critical rule: If defect rate exceeds 3.0% on battery or glass, automatically freeze entire warehouse lot',
        'QC Aging Rule: Inspection lots sitting in QC-Hold >72 hours trigger plant quality escalation',
        'Quarantined stock is strictly netted to 0 usable availability across MRP and Copilot'
      ],
      dataModels: ['fact_quality_disposition_ledger', 'dim_vendor_defect_pareto']
    },
    presentation: {
      pages: [
        { name: 'Quality Hold & Rejects', path: '/quality' },
        { name: 'Goods Receiving', path: '/receiving' },
        { name: 'Batch Traceability', path: '/traceability' }
      ],
      kpis: ['Quarantined Value (₹56.4 Lakhs)', 'Incoming Defect Rate (184 PPM)', 'Lot Acceptance Rate (98.2%)', 'Avg Inspection Dwell (14.2h)'],
      alerts: ['Critical lot failure alert (Battery cell defect)', 'Quarantine holding capacity warning']
    },
    aiIntelligence: {
      analyse: 'Clusters defect symptom codes to determine root cause (e.g. solder bridging vs component warping).',
      predict: 'Predicts final assembly yield drops if a borderline component lot is conditionally released.',
      detect: 'Detects vendor quality degradation trends across successive incoming wafer batches.',
      recommend: 'Recommends MRB disposition: Return to Vendor (RTV), in-house rework, or scrap claim.',
      automate: 'Automatically locks suspect warehouse bins in WMS the moment a failure is logged on receiving dock.',
      guardrails: 'AI cannot unblock a quarantined lot; physical release requires cryptographic token from certified QC auditor.'
    }
  },
  {
    id: 'agt-09',
    code: 'AGT-09',
    title: 'Excess & Obsolete (E&O) Inventory Agent',
    tagline: 'Capital locked above max stock, shelf-life degradation & scrap disposal actions',
    role: 'Working Capital Recovery',
    accentColor: '#0D9488',
    badgeBg: '#F0FDFA',
    borderColor: '#99F6E4',
    icon: '⏳',
    inputs: {
      sourceApps: ['Blue Yonder WMS', 'ERP Cost Accounting', 'PTC Windchill PLM ECOs'],
      tables: ['fact_inventory_daily_snapshot', 'dim_material', 'fact_eco_change', 'fact_cycle_count'],
      columns: [
        'material_id, on_hand_qty, unit_cost_inr, lot_manufacture_date, plant_id',
        'max_stock_qty, shelf_life_days, standard_cost_inr',
        'eco_id, replaced_material_id, cut_in_date, disposition_rule'
      ],
      apis: ['GET /api/inventory/excess-obsolete', 'POST /api/inventory/disposition/proposal'],
      dataHygiene: [
        'Calculates true shelf-life expiration from lot manufacturing date',
        'Reconciles engineering change phase-in / phase-out effectivity cut-in dates',
        'Excludes reserved customer consignment stock from excess calculations'
      ]
    },
    processing: {
      deterministicFormulas: [
        'Excess Qty = max(0, Usable Stock − Max Stock Policy)',
        'Excess Capital Exposure (INR) = Excess Qty × Standard Cost',
        'Days to Expiration = Expiry Date − Current Date',
        'Holding Cost Drag = Excess Capital × Annual Carrying Rate (22%)'
      ],
      businessRules: [
        'Dead Stock Rule: No movement for >180 days AND zero future demand in 60-day horizon',
        'Slow-Moving Rule: Days of cover >3× maximum allowable buffer policy',
        'Zero automatic write-down: Every disposal or scrap proposal requires Finance Controller authorization'
      ],
      dataModels: ['fact_excess_obsolete_ledger', 'dim_aging_brackets (30/60/90/180+ days)']
    },
    presentation: {
      pages: [
        { name: 'Dead & Slow-Moving Stock', path: '/dead-stock' },
        { name: 'Inventory Health Dashboard', path: '/overview' },
        { name: 'Shelf and Location Map', path: '/digital-twin' }
      ],
      kpis: ['Excess Capital Locked (₹57.08 Lakhs)', 'Expiring in 30 Days (₹1.8 Lakhs)', 'Slow-Moving SKUs (4 Items)', 'Carrying Cost Burden (₹12.5L/yr)'],
      alerts: ['Solder paste approaching 90-day cold storage expiry', 'Stranded stock from discontinued Aster 14 ECO']
    },
    aiIntelligence: {
      analyse: 'Quantifies holding cost drag against potential salvage liquidation value.',
      predict: 'Predicts financial write-down impact across coming two quarters if excess inventory is not rebalanced.',
      detect: 'Detects stranded raw materials orphaned by engineering change orders (ECO cut-ins).',
      recommend: 'Recommends inter-plant transfer to high-demand plant, supplier buy-back return, or bundled rework.',
      automate: 'Drafts disposition manifests and financial write-off packets for Controller approval.',
      guardrails: 'Cannot approve inventory disposals or ledger write-downs; requires finance executive signature.'
    }
  },
  {
    id: 'agt-10',
    code: 'AGT-10',
    title: 'Inventory Copilot & Central Orchestrator',
    tagline: 'Query routing, multi-agent mesh orchestration & zero-hallucination Grounding Gate',
    role: 'Central Intelligence & Dispatch',
    accentColor: '#6D28D9',
    badgeBg: '#FAF5FF',
    borderColor: '#C4B5FD',
    icon: '🤖',
    inputs: {
      sourceApps: ['Executive User Prompts', 'Agent Run Telemetry Mesh', 'Registered MCP Engine Tools'],
      tables: ['Structured outputs from AGT-01 through AGT-09', 'agent_run_logs', 'dim_assumptions (A1–A21)'],
      columns: [
        'run_id, stage, agent_name, status, execution_time_ms, facts_grounded',
        'prompt_text, user_tenant_id, user_role, authorized_plants'
      ],
      apis: ['POST /api/agent/chat/stream', 'POST /api/agent/collaborative-run', 'GET /api/agent/pipeline-status'],
      dataHygiene: [
        'Tenant context isolation and plant authorization checks (IN-TN-01 vs IN-KA-01)',
        'Assumption tagging: Every response states active data date and assumption IDs (A1–A21)',
        'Zero-hallucination regex audit comparing every number against SQL engine memory'
      ]
    },
    processing: {
      deterministicFormulas: [
        'Grounding Match Rate = (Count of Verified Output Numbers ÷ Total Numbers in Draft) × 100',
        'Execution Latency (ms) = t_stream_end − t_prompt_received',
        'Pipeline Completion = (Completed Stages ÷ Total Pipeline Stages [9]) × 100'
      ],
      businessRules: [
        'Grounding Verification Gate: If any numerical assertion does not exist in engine facts, trigger deterministic template fallback',
        'Read-only enforcement: The copilot cannot alter database tables or execute transactions',
        'Collaborative Mesh Order: 9 stages execute sequentially with full execution trace logging'
      ],
      dataModels: ['agent_collaborative_trace_ledger', 'dim_grounded_fact_store']
    },
    presentation: {
      pages: [
        { name: 'Ask the Inventory Agent', path: '/agent' },
        { name: 'Agent Hub & Pipeline', path: '/agents' },
        { name: 'Agent Testing Playground', path: '/agent-tester' },
        { name: 'Daily Inventory Report', path: '/brief' }
      ],
      kpis: ['Grounding Verification Score (100%)', 'Pipeline Stages (9/9 Stages Completed)', 'Active Specialists (7 Agents Online)', 'Collaborative Run ID (#42)'],
      alerts: ['Grounding mismatch fallback triggered', 'Collaborative pipeline run completed successfully']
    },
    aiIntelligence: {
      analyse: 'Synthesizes cross-agent telemetry into concise managerial action plans for operations heads.',
      predict: 'Explains complex forward-looking inventory trade-offs in clear, natural business English.',
      detect: 'Detects contradictions or conflicts between independent agent proposals before presenting to users.',
      recommend: 'Delivers prioritized action items with direct deep-links to approval workbenches.',
      automate: 'Orchestrates the entire 9-stage multi-agent collaborative pipeline run on demand or schedule.',
      guardrails: 'Grounding Verification Gate rejects all ungrounded numerical hallucination; zero unverified stats.'
    }
  }
]

export function FourComponentFramework() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('agt-04')
  const currentAgent = FOUR_COMPONENT_AGENTS.find((a) => a.id === selectedAgentId) || FOUR_COMPONENT_AGENTS[3]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Banner: Core Architectural Principle */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
          borderRadius: 10,
          padding: '14px 18px',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(30, 27, 75, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ maxWidth: 860 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🏛️</span>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#A5B4FC' }}>
              The Four-Component Manufacturing AI Agent Architecture
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                background: '#4338CA',
                color: '#E0E7FF',
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid #6366F1',
              }}
            >
              Enterprise Standard v3.2
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: '#E0E7FF', lineHeight: 1.45 }}>
            <b>Core Architectural Principle:</b> An AI agent should <u>never</u> simply be a chatbot connected to a database.
            Every manufacturing agent must possess an end-to-end <b>Data Pipeline (Input)</b>, deterministic <b>Calculations &amp; Business Rules (Processing)</b>,
            operational <b>Cockpits &amp; Alerts (Presentation)</b>, and governed <b>Cognitive Reasoning &amp; Guardrails (AI Intelligence)</b>.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 10.5,
            color: '#E0E7FF',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div><b>Reference Domain:</b> Mobile Phone Manufacturing</div>
          <div><b>Target Products:</b> Aster 15 (128GB) &amp; Aster 15 Pro (256GB)</div>
          <div><b>Assembly Facilities:</b> IN-TN-01 (Chennai SMT) · IN-KA-01 (Bengaluru Final)</div>
        </div>
      </div>

      {/* Horizontal Agent Selector Roster */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Select Agent Specification to Inspect:
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {FOUR_COMPONENT_AGENTS.map((agent) => {
            const isSelected = agent.id === selectedAgentId
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  border: isSelected ? `2px solid ${agent.accentColor}` : '1px solid #E2E8F0',
                  background: isSelected ? agent.badgeBg : '#ffffff',
                  color: isSelected ? agent.accentColor : '#334155',
                  boxShadow: isSelected ? `0 2px 6px ${agent.accentColor}25` : 'none',
                  fontSize: 10.5,
                  fontWeight: isSelected ? 800 : 600,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s ease',
                  flexShrink: 0,
                }}
              >
                <span>{agent.icon}</span>
                <span>{agent.code}</span>
                <span style={{ opacity: isSelected ? 1 : 0.7, fontSize: 9.5 }}>· {agent.role}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Agent Header Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 10,
          border: `1px solid ${currentAgent.borderColor}`,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: currentAgent.badgeBg,
              color: currentAgent.accentColor,
              border: `1px solid ${currentAgent.borderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {currentAgent.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  background: currentAgent.accentColor,
                  color: '#ffffff',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                {currentAgent.code}
              </span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                {currentAgent.title}
              </h3>
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              {currentAgent.tagline}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {currentAgent.presentation.pages.map((pg, idx) => (
            <Link
              key={idx}
              to={pg.path}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: currentAgent.accentColor,
                background: currentAgent.badgeBg,
                border: `1px solid ${currentAgent.borderColor}`,
                padding: '4px 8px',
                borderRadius: 5,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{pg.name}</span>
              <span>↗</span>
            </Link>
          ))}
        </div>
      </div>

      {/* The 4 Core Component Pillars (2x2 Grid or 4-Column Responsive Layout) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {/* Pillar 1: Input Layer */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #BAE6FD',
            borderTop: '4px solid #0284C7',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>📥</span>
              <b style={{ fontSize: 12.5, fontWeight: 800, color: '#0369A1', textTransform: 'uppercase' }}>
                1. Input Layer
              </b>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, background: '#E0F2FE', color: '#0369A1', padding: '2px 6px', borderRadius: 3 }}>
              Data Pipeline &amp; Ingestion
            </span>
          </div>

          <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <b style={{ color: '#0F172A', display: 'block', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>
                🏢 Source Applications:
              </b>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {currentAgent.inputs.sourceApps.map((app, idx) => (
                  <span key={idx} style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0284C7', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
                    {app}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <b style={{ color: '#0F172A', display: 'block', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>
                🗄️ Tables &amp; Schemas:
              </b>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {currentAgent.inputs.tables.map((tbl, idx) => (
                  <code key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1px 4px', borderRadius: 3, fontSize: 9.5, color: '#334155' }}>
                    {tbl}
                  </code>
                ))}
              </div>
            </div>

            <div>
              <b style={{ color: '#0F172A', display: 'block', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>
                📋 Key Attributes / Columns:
              </b>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 4, padding: '4px 6px', fontSize: 9, color: '#475569', lineHeight: 1.35, maxHeight: 60, overflowY: 'auto' }}>
                {currentAgent.inputs.columns.join(' · ')}
              </div>
            </div>

            <div>
              <b style={{ color: '#0F172A', display: 'block', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>
                🛡️ 12-Rule Data Hygiene:
              </b>
              <ul style={{ margin: 0, paddingLeft: 14, color: '#475569', fontSize: 9.5, lineHeight: 1.35 }}>
                {currentAgent.inputs.dataHygiene.map((dh, idx) => (
                  <li key={idx}>{dh}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Pillar 2: Processing Layer */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #A7F3D0',
            borderTop: '4px solid #059669',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 6px rgba(5, 150, 105, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>⚙️</span>
              <b style={{ fontSize: 12.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                2. Processing Layer
              </b>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, background: '#ECFDF5', color: '#047857', padding: '2px 6px', borderRadius: 3 }}>
              Deterministic Engine &amp; BI
            </span>
          </div>

          <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <b style={{ color: '#0F172A', display: 'block', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>
                📐 Deterministic Formulas:
              </b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {currentAgent.processing.deterministicFormulas.map((form, idx) => (
                  <div key={idx} style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '3px 6px', borderRadius: 4, fontSize: 9.5, color: '#065F46', fontFamily: 'monospace' }}>
                    {form}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <b style={{ color: '#0F172A', display: 'block', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>
                📜 Business Rules (A1–A21):
              </b>
              <ul style={{ margin: 0, paddingLeft: 14, color: '#475569', fontSize: 9.5, lineHeight: 1.35 }}>
                {currentAgent.processing.businessRules.map((br, idx) => (
                  <li key={idx}>{br}</li>
                ))}
              </ul>
            </div>

            <div>
              <b style={{ color: '#0F172A', display: 'block', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>
                📊 Analytical Data Marts:
              </b>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {currentAgent.processing.dataModels.map((dm, idx) => (
                  <span key={idx} style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#334155', padding: '1px 5px', borderRadius: 3, fontSize: 9.5, fontWeight: 600 }}>
                    {dm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pillar 3: Presentation Layer */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #FDE68A',
            borderTop: '4px solid #D97706',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 6px rgba(217, 119, 6, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>📊</span>
              <b style={{ fontSize: 12.5, fontWeight: 800, color: '#B45309', textTransform: 'uppercase' }}>
                3. Presentation Layer
              </b>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, background: '#FFFBEB', color: '#B45309', padding: '2px 6px', borderRadius: 3 }}>
              Operational Cockpits &amp; Alerts
            </span>
          </div>

          <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <b style={{ color: '#0F172A', display: 'block', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>
                🖥️ Delivered Application Pages:
              </b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {currentAgent.presentation.pages.map((pg, idx) => (
                  <Link
                    key={idx}
                    to={pg.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#FFFDF7',
                      border: '1px solid #FDE68A',
                      padding: '3px 6px',
                      borderRadius: 4,
                      textDecoration: 'none',
                      color: '#92400E',
                      fontSize: 9.5,
                      fontWeight: 700,
                    }}
                  >
                    <span>{pg.name}</span>
                    <span>Open ↗</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <b style={{ color: '#0F172A', display: 'block', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>
                📈 Monitored KPIs:
              </b>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {currentAgent.presentation.kpis.map((kpi, idx) => (
                  <span key={idx} style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#78350F', padding: '2px 6px', borderRadius: 3, fontSize: 9.5, fontWeight: 700 }}>
                    {kpi}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <b style={{ color: '#0F172A', display: 'block', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>
                🚨 Real-Time Operational Alerts:
              </b>
              <ul style={{ margin: 0, paddingLeft: 14, color: '#475569', fontSize: 9.5, lineHeight: 1.35 }}>
                {currentAgent.presentation.alerts.map((al, idx) => (
                  <li key={idx}>{al}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Pillar 4: AI Intelligence Layer */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #DDD6FE',
            borderTop: '4px solid #7C3AED',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 6px rgba(124, 58, 237, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>🧠</span>
              <b style={{ fontSize: 12.5, fontWeight: 800, color: '#6D28D9', textTransform: 'uppercase' }}>
                4. AI Intelligence Layer
              </b>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, background: '#FAF5FF', color: '#6D28D9', padding: '2px 6px', borderRadius: 3 }}>
              Cognitive Models &amp; Guardrails
            </span>
          </div>

          <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ background: '#FAF5FF', padding: '4px 6px', borderRadius: 4, border: '1px solid #EDE9FE' }}>
              <b style={{ color: '#6D28D9' }}>🔍 Analyse: </b>
              <span style={{ color: '#334155' }}>{currentAgent.aiIntelligence.analyse}</span>
            </div>

            <div style={{ background: '#FAF5FF', padding: '4px 6px', borderRadius: 4, border: '1px solid #EDE9FE' }}>
              <b style={{ color: '#6D28D9' }}>🔮 Predict: </b>
              <span style={{ color: '#334155' }}>{currentAgent.aiIntelligence.predict}</span>
            </div>

            <div style={{ background: '#FAF5FF', padding: '4px 6px', borderRadius: 4, border: '1px solid #EDE9FE' }}>
              <b style={{ color: '#6D28D9' }}>⚠️ Detect: </b>
              <span style={{ color: '#334155' }}>{currentAgent.aiIntelligence.detect}</span>
            </div>

            <div style={{ background: '#FAF5FF', padding: '4px 6px', borderRadius: 4, border: '1px solid #EDE9FE' }}>
              <b style={{ color: '#6D28D9' }}>💡 Recommend: </b>
              <span style={{ color: '#334155' }}>{currentAgent.aiIntelligence.recommend}</span>
            </div>

            <div style={{ background: '#FAF5FF', padding: '4px 6px', borderRadius: 4, border: '1px solid #EDE9FE' }}>
              <b style={{ color: '#6D28D9' }}>⚡ Automate: </b>
              <span style={{ color: '#334155' }}>{currentAgent.aiIntelligence.automate}</span>
            </div>

            <div style={{ background: '#FEF2F2', padding: '4px 6px', borderRadius: 4, border: '1px solid #FECACA' }}>
              <b style={{ color: '#B91C1C' }}>🛡️ Strict Guardrails: </b>
              <span style={{ color: '#7F1D1D' }}>{currentAgent.aiIntelligence.guardrails}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
