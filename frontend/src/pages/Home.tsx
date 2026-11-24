import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  renderArchitectureIcon,
  renderProblemIcon,
  IconPipelineHeader,
  IconTargetProblems,
} from '../components/ArchitectureIcons'

// ─── Data Types & Definitions ──────────────────────────────────────────

export interface ArchitectureNode {
  id: string
  title: string
  shortCode?: string
  subtitle: string
  stageId: string
  stageLabel: string
  stageNumber: number
  badgeText: string
  badgeColor: string
  badgeBg: string
  borderColor: string
  icon: string
  purpose: string
  protocols: string
  databaseTables: string
  executionFlow: string[]
  primaryProblemId?: string
}

export interface ProblemCategory {
  id: string
  code: string
  title: string
  subtitle: string
  bg: string
  textColor: string
  borderColor: string
  icon: string
  solvedByNodeId: string
  impactMetric: string
  resolutionAction: string
}

export interface HeatmapCell {
  percent: number
  orders: number
  status: 'overdue' | 'imminent' | 'ontrack' | 'ahead' | 'future'
  notes?: string
}

export interface HeatmapRow {
  accountName: string
  subtext: string
  cells: {
    [windowId: string]: HeatmapCell
  }
}

// ─── Real System Pipeline Nodes (Matching Our True Inventory Architecture) ────

export const ARCHITECTURE_NODES: Record<string, ArchitectureNode> = {
  // ── Stage 1: Data Sources ──
  'src-sap': {
    id: 'src-sap',
    title: 'ERP (SAP S/4HANA)',
    shortCode: 'SAP',
    subtitle: 'OData · Purchase Orders · BOM',
    stageId: 'stage-1',
    stageLabel: '1. DATA SOURCES',
    stageNumber: 1,
    badgeText: 'ENTERPRISE SOURCE · COMMERCIAL & PO DATA',
    badgeColor: '#0284C7',
    badgeBg: '#E0F2FE',
    borderColor: '#BAE6FD',
    icon: '🏢',
    purpose:
      'Core Enterprise Resource Planning system providing procurement purchase orders, vendor master records, payment terms, and commercial customer sales contracts.',
    protocols: 'SAP OData v4 · RFC / BAPI · MMS Material Master API · EDI 850 / 855',
    databaseTables:
      'fact_customer_order, dim_customer, dim_product, dim_material, fact_inventory_daily_snapshot',
    executionFlow: [
      'Ingests customer purchase order demand lines across Tier-1 accounts (Retailer North, MobileMart, Global Devices, Digital Bazaar).',
      'Validates commercial credit limits, contractual pricing, and payment terms in SAP S/4HANA.',
      'Synchronizes 16-component BOM definitions for Aster 15 and Aster 15 Pro smartphone production.',
      'Transfers open supplier purchase order delivery schedules (1,302 PO lines) into the ingestion staging tables.',
    ],
    primaryProblemId: 'prob-delays',
  },
  'src-mes': {
    id: 'src-mes',
    title: 'MES (Siemens Opcenter)',
    shortCode: 'MES',
    subtitle: 'SMT Assembly Lines 1–8',
    stageId: 'stage-1',
    stageLabel: '1. DATA SOURCES',
    stageNumber: 1,
    badgeText: 'SHOP-FLOOR SOURCE · SURFACE MOUNT TELEMETRY',
    badgeColor: '#059669',
    badgeBg: '#D1FAE5',
    borderColor: '#A7F3D0',
    icon: '🏭',
    purpose:
      'Manufacturing Execution System tracking surface-mount (SMT) pick-and-place lines 1–4 (450 units/hr) and final box-build mechanical assembly lines 5–8 at Bengaluru (IN-KA-01) and Chennai (IN-TN-01).',
    protocols: 'OPC-UA · MQTT Broker (Port 1883) · Siemens SIMATIC IT API · Industrial IoT Webhooks',
    databaseTables:
      'fact_shopfloor_wip, dim_machine, fact_line_capacity, fact_feeder_consumption, dim_plant',
    executionFlow: [
      'Captures live feeder pick rates and chip placement cycle times across high-speed SMT lines 1–4.',
      'Tracks WIP buffer queues between PCB surface mounting and final mechanical box assembly.',
      'Detects line throttling when component buffers fall below critical 2-hour consumption limits.',
      'Publishes operational telemetry (91% SMT pace vs 88% final assembly bottleneck limit).',
    ],
    primaryProblemId: 'prob-bottlenecks',
  },
  'src-wms': {
    id: 'src-wms',
    title: 'WMS (Digital Twin)',
    shortCode: 'WMS',
    subtitle: '3,840 Bins · Aisles A01–A08',
    stageId: 'stage-1',
    stageLabel: '1. DATA SOURCES',
    stageNumber: 1,
    badgeText: 'WAREHOUSE SOURCE · 3D PHYSICAL STORAGE',
    badgeColor: '#7C3AED',
    badgeBg: '#EDE9FE',
    borderColor: '#DDD6FE',
    icon: '📦',
    purpose:
      'Real-time physical warehouse storage tracking 3,840 bins across Aisles A01–A08, high-bay pallet racks, and the 2nd-floor mezzanine reserve bulk retrieval area.',
    protocols: 'WMS REST Webhooks · 3D Spatial Geometry · Barcode Scanners · Putaway Routing API',
    databaseTables:
      'fact_bin_occupancy, fact_stock_on_hand, fact_pick_events, fact_cycle_counts',
    executionFlow: [
      'Maintains exact XYZ coordinate locations for all 16 smartphone components across high-bay racks.',
      'Records putaway movements, replenishment drops, and picking cart paths in real-time.',
      'Differentiates ground-floor pick faces (L1–L3) from mezzanine reserve bulk tiers (L4+).',
      'Provides physical stock-on-hand validation directly to AGT-01 Data Reconciliation Agent.',
    ],
    primaryProblemId: 'prob-phantom',
  },
  'src-excel': {
    id: 'src-excel',
    title: 'Excel & Manual Files',
    shortCode: 'XLS',
    subtitle: 'Uploads · BOM Overrides · Plans',
    stageId: 'stage-1',
    stageLabel: '1. DATA SOURCES',
    stageNumber: 1,
    badgeText: 'SPREADSHEET SOURCE · AD-HOC DATA & MANUAL UPLOADS',
    badgeColor: '#16A34A',
    badgeBg: '#DCFCE7',
    borderColor: '#BBF7D0',
    icon: '📊',
    purpose:
      'Departmental offline workbooks, manual BOM updates, supplier quotation sheets, and daily offline production planning templates uploaded by purchasing and store teams.',
    protocols: 'Excel (.xlsx, .xls) · CSV · Drag-and-Drop Ingestion · Multipart File Uploads',
    databaseTables:
      'uploads, dq_result_rows, fact_production_order_plan, assumptions.json',
    executionFlow: [
      'Parses multi-tab Excel workbooks containing component BOM revisions and custom planning schedules.',
      'Executes deterministic Data Quality (DQ) checks: null detection, duplicate key checks, and unit mapping.',
      'Flags unlinked material SKUs, missing lead times, or invalid dates before staging into PostgreSQL.',
      'Enables operational teams to inject scenario forecasts and manual production runs directly into the agent mesh.',
    ],
    primaryProblemId: 'prob-blindspots',
  },

  // ── Stage 2: Ingestion & Data Layer ──
  'ing-fastapi': {
    id: 'ing-fastapi',
    title: 'FastAPI Gateway',
    shortCode: 'API',
    subtitle: 'Port 8000 · Async Normalizer',
    stageId: 'stage-2',
    stageLabel: '2. INGESTION & DB',
    stageNumber: 2,
    badgeText: 'API GATEWAY · ASYNC INGESTION & SSE',
    badgeColor: '#2563EB',
    badgeBg: '#DBEAFE',
    borderColor: '#BFDBFE',
    icon: '⚡',
    purpose:
      'High-throughput asynchronous normalization gateway that ingests heterogeneous ERP, MES, and WMS streams, validates schemas, and pushes real-time Server-Sent Events (SSE).',
    protocols: 'FastAPI AsyncIO · Server-Sent Events (SSE) · Pydantic v2 · JSONSchema Validation',
    databaseTables: 'stg_raw_telemetry, system_metrics, agent_audit_logs, fact_event_stream',
    executionFlow: [
      'Ingests concurrent payloads from SAP OData, Siemens MES webhooks, and WMS bin updates.',
      'Normalizes disparate unit-of-measure (UOM) definitions (reels vs units vs master cartons).',
      'Validates incoming data integrity using strict Pydantic models with sub-second error interception.',
      'Broadcasts live event streams to connected AI agents and the UI dashboard with <48ms latency.',
    ],
    primaryProblemId: 'prob-phantom',
  },
  'ing-postgres': {
    id: 'ing-postgres',
    title: 'PostgreSQL 16 DB',
    shortCode: 'SQL',
    subtitle: '6 Normalized Schemas',
    stageId: 'stage-2',
    stageLabel: '2. INGESTION & DB',
    stageNumber: 2,
    badgeText: 'RELATIONAL CORE · DETERMINISTIC DATA LAYER',
    badgeColor: '#4338CA',
    badgeBg: '#EEF2FF',
    borderColor: '#C7D2FE',
    icon: '🗄️',
    purpose:
      'ACID-compliant relational database serving as the single source of truth for all inventory balances, production plans, BOM structures, and agent decision dossiers.',
    protocols: 'PostgreSQL 16 Connection Pool · Neon DB · Row-Level Security · Read-Only Replicas',
    databaseTables:
      'fact_customer_order, fact_inventory_daily_snapshot, dim_material, dim_bom, commitment_proposals',
    executionFlow: [
      'Persists verified historical inventory snapshots across Bengaluru and Chennai plant facilities.',
      'Stores relational multi-tier BOM exploding trees across finished smartphones and raw components.',
      'Maintains immutable cryptographic audit logs for every human and autonomous agent action.',
      'Serves parameterized SQL query tools directly to AGT-10 and specialized cognitive agents.',
    ],
    primaryProblemId: 'prob-blindspots',
  },

  // ── Stage 3: AI Agent Mesh (Active Agents 1–7; Commented/Secondary start from 8) ──
  'agt-07': {
    id: 'agt-07',
    title: 'AGT-07: Central Orchestrator',
    shortCode: 'AGT-07',
    subtitle: 'Query Decomposer · MCP Registry',
    stageId: 'stage-3',
    stageLabel: '3. AI AGENT MESH',
    stageNumber: 3,
    badgeText: 'CENTRAL MESH COORDINATOR & COPILOT',
    badgeColor: '#6D28D9',
    badgeBg: '#EDE9FE',
    borderColor: '#DDD6FE',
    icon: '🧠',
    purpose:
      'Central multi-agent orchestrator that receives operator queries, decomposes complex supply chain tasks, executes specialist agent tools via MCP, and synthesizes unified briefings.',
    protocols: 'MCP Tool Protocol · ReAct Thought-Action Loop · LLM Agentic Router · SSE Stream',
    databaseTables:
      'agent_audit_logs, system_metrics, fact_customer_order, commitment_proposals',
    executionFlow: [
      'Deconstructs management queries into sub-tasks (e.g. shortage impact vs line capacity).',
      'Orchestrates parallel and sequential tool invocations across AGT-01 through AGT-06.',
      'Enforces 100% arithmetic grounding and validates numerical citations before responding.',
      'Generates executive decision dossiers for one-click human review and sign-off.',
    ],
    primaryProblemId: 'prob-blindspots',
  },
  'agt-01': {
    id: 'agt-01',
    title: 'AGT-01: Data Reconciler',
    shortCode: 'AGT-01',
    subtitle: 'ERP / MES / WMS Sync',
    stageId: 'stage-3',
    stageLabel: '3. AI AGENT MESH',
    stageNumber: 3,
    badgeText: 'AUTOMATED AUDIT & RECONCILIATION AGENT',
    badgeColor: '#0284C7',
    badgeBg: '#E0F2FE',
    borderColor: '#BAE6FD',
    icon: '🧹',
    purpose:
      'Runs automated 5-tier reconciliation audits across ERP, MES, and WMS raw tables to eliminate phantom stockouts, resolve inventory drift, and verify usable lots.',
    protocols: 'Automated Batch Sync · Cross-Table Reconciliation Engine · Variance Logger',
    databaseTables: 'fact_inventory_daily_snapshot, dim_material, reconciliation_variance_log',
    executionFlow: [
      'Audits 6,624 raw inventory records across ERP ledger balances and physical WMS bins.',
      'Identifies and isolates zero-stock phantom records causing artificial stockout panic.',
      'Resolves warehouse-to-ledger mismatches using physical barcode cycle count telemetry.',
      'Passes 100% verified, clean stock positions to AGT-02 Stock Monitoring Agent.',
    ],
    primaryProblemId: 'prob-phantom',
  },
  'agt-02': {
    id: 'agt-02',
    title: 'AGT-02: Stock Monitor',
    shortCode: 'AGT-02',
    subtitle: 'Usable Buffers & Policies',
    stageId: 'stage-3',
    stageLabel: '3. AI AGENT MESH',
    stageNumber: 3,
    badgeText: 'REAL-TIME STOCK HEALTH AGENT',
    badgeColor: '#059669',
    badgeBg: '#D1FAE5',
    borderColor: '#A7F3D0',
    icon: '📡',
    purpose:
      'Continuous 24/7 surveillance over ₹36.80 Cr of active physical inventory, usable stock balances, and dynamic safety buffers across Bengaluru and Chennai plants.',
    protocols: 'Event-Driven Threshold Triggers · Usable Stock Calculator · Safety Buffer Rules',
    databaseTables: 'fact_stock_on_hand, dim_plant, dim_material, fact_qc_holds',
    executionFlow: [
      'Calculates net usable inventory by subtracting 103 QC quarantine lots from total on-hand stock.',
      'Monitors real-time stock levels against configured safety stock policies and minimum reorder points.',
      'Detects depletion velocity across Tier-A active semiconductor components.',
      'Automatically triggers AGT-03 Shortage Forecasting when stock drops within critical 14-day windows.',
    ],
    primaryProblemId: 'prob-delays',
  },
  'agt-03': {
    id: 'agt-03',
    title: 'AGT-03: Shortage Forecast',
    shortCode: 'AGT-03',
    subtitle: 'Stockout Dates & Curves',
    stageId: 'stage-3',
    stageLabel: '3. AI AGENT MESH',
    stageNumber: 3,
    badgeText: 'NON-LINEAR PREDICTIVE SHORTAGE AGENT',
    badgeColor: '#D97706',
    badgeBg: '#FEF3C7',
    borderColor: '#FDE68A',
    icon: '📉',
    purpose:
      'Projects non-linear 30, 60, and 90-day material demand curves; calculates projected stockout dates for critical components before manufacturing assembly lines halt.',
    protocols: 'Non-Linear Run-Rate Forecasting · Criticality Scoring (ABC/XYZ) · Depletion Vectors',
    databaseTables: 'fact_material_demand, dim_material, fact_customer_order',
    executionFlow: [
      'Calculates daily run-rate burn trajectory based on scheduled factory work orders.',
      'Pinpoints exact line-stoppage stockout dates (e.g. 6-layer Main PCB reaching zero stock on Day 18).',
      'Identifies 8 critical parts facing stockout within 7 days across plant operations.',
      'Feeds net shortage requirement vectors directly into AGT-04 BOM Twin and AGT-05 Replenishment.',
    ],
    primaryProblemId: 'prob-shortages',
  },
  'agt-04': {
    id: 'agt-04',
    title: 'AGT-04: BOM Twin & Capacity',
    shortCode: 'AGT-04',
    subtitle: 'Bottleneck Limit: 6,261 Units',
    stageId: 'stage-3',
    stageLabel: '3. AI AGENT MESH',
    stageNumber: 3,
    badgeText: 'BOM DIGITAL TWIN & CONSTRAINT SOLVER',
    badgeColor: '#B45309',
    badgeBg: '#FFFBEB',
    borderColor: '#FCD34D',
    icon: '⚙️',
    purpose:
      'Deterministic Bill of Materials (BOM) twin exploder: maps multi-level components to finished smartphones and calculates maximum build capacity before assembly lines halt.',
    protocols: 'Multi-Level BOM Graph Explosion · Constraint Solver · Assembly Capacity Modeling',
    databaseTables: 'dim_bom, dim_product, fact_line_capacity, fact_stock_on_hand',
    executionFlow: [
      'Explodes 16 component BOM hierarchies across Aster 15 128GB and 256GB smartphones.',
      'Identifies the primary limiting constraint (6-layer Main PCB restricting production to 6,261 units).',
      'Calculates exact net component deficits needed to hit full factory target demand.',
      'Evaluates alternative component substitutions and inter-plant rebalancing options.',
    ],
    primaryProblemId: 'prob-bottlenecks',
  },
  'agt-05': {
    id: 'agt-05',
    title: 'AGT-05: Replenishment',
    shortCode: 'AGT-05',
    subtitle: 'PO Drafts & MOQ Rounding',
    stageId: 'stage-3',
    stageLabel: '3. AI AGENT MESH',
    stageNumber: 3,
    badgeText: 'AUTONOMOUS REPLENISHMENT & PROPOSALS AGENT',
    badgeColor: '#7C3AED',
    badgeBg: '#FAF5FF',
    borderColor: '#E9D5FF',
    icon: '🛒',
    purpose:
      'Generates automated purchase order drafts and inter-plant stock transfer proposals applying supplier MOQs, quantity price breaks, and lead time buffers.',
    protocols: 'MOQ Rounding Algorithm · Procurement Proposal Generator · ERP Draft Creator',
    databaseTables: 'commitment_proposals, dim_supplier, dim_material, fact_supplier_po',
    executionFlow: [
      'Rounds component deficits to supplier Minimum Order Quantities (e.g. 1,150 deficit rounded to 2,000 MOQ).',
      'Calculates total estimated procurement cost, payment terms, and landed tax implications.',
      'Generates formal draft proposals (e.g. PO-2026-0038 for ₹13.60L with Murata Electronics).',
      'Routes synthesized proposals to the Human Approval Gate for buyer review.',
    ],
    primaryProblemId: 'prob-delays',
  },
  'agt-06': {
    id: 'agt-06',
    title: 'AGT-06: E&O Dead Stock',
    shortCode: 'AGT-06',
    subtitle: '₹4.20 Cr Excess · >90d Idle',
    stageId: 'stage-3',
    stageLabel: '3. AI AGENT MESH',
    stageNumber: 3,
    badgeText: 'WORKING CAPITAL & DEAD STOCK AGENT',
    badgeColor: '#0D9488',
    badgeBg: '#F0FDFA',
    borderColor: '#99F6E4',
    icon: '♻️',
    purpose:
      'Identifies stagnant inventory (>90 days idle), flags obsolete BOM revisions, and calculates locked working capital to recommend supplier returns or inter-plant transfers.',
    protocols: 'Inventory Aging Analysis · Carrying Cost Depreciation Model · Return-to-Vendor Hooks',
    databaseTables: 'fact_inventory_daily_snapshot, dim_material, fact_dead_stock_actions',
    executionFlow: [
      'Scans high-bay warehouse bins for items with 0 consumption over the past 90 days.',
      'Identifies ₹4.20 Cr in excess holding cost drag across 2,240 dead/slow-moving SKUs.',
      'Highlights dead stock bins in the 3D Digital Twin with an active visual spotlight.',
      'Proposes inter-plant transfers from Chennai surplus to Bengaluru to offset new procurement costs.',
    ],
    primaryProblemId: 'prob-deadstock',
  },

  // ── Other Commented / Secondary Agents (Start from 8) ──
  // AGT-08: Incoming QC & Lot Acceptance Agent (Dock quarantine holds & certificate audits)
  // AGT-09: Supplier Delay & ML Predictor Agent (Random Forest lead time disruption simulator)

  // ── Stage 4: Workflows & Governance ──
  'gov-workflows': {
    id: 'gov-workflows',
    title: 'Feasibility & Capacity',
    shortCode: 'FLOW',
    subtitle: '7-Dept BOM Simulation',
    stageId: 'stage-4',
    stageLabel: '4. WORKFLOWS & GOV',
    stageNumber: 4,
    badgeText: 'OPERATIONAL WORKFLOW ENGINE',
    badgeColor: '#0284C7',
    badgeBg: '#E0F2FE',
    borderColor: '#BAE6FD',
    icon: '🔀',
    purpose:
      'Automated multi-department workflow engine orchestrating shortage forecasting, capacity simulation, and supplier delivery risk assessments into unified decision pipelines.',
    protocols: 'State-Machine Orchestration · Workflow DAG · Event Sourcing · Audit Logging',
    databaseTables: 'commitment_proposals, fact_line_capacity, fact_customer_order',
    executionFlow: [
      'Triggers sequential 7-department feasibility audits across sales orders and production schedules.',
      'Aggregates capacity limits, component shortages, and supplier delays into a unified dossier.',
      'Evaluates delivery date feasibility across 4 Tier-1 customer delivery windows.',
      'Prepares executable sign-off requests for the Human Governance Gate.',
    ],
    primaryProblemId: 'prob-bottlenecks',
  },
  'gov-approval': {
    id: 'gov-approval',
    title: 'Human Approval Gate',
    shortCode: 'GOV',
    subtitle: 'Buyer · Planner · Stores',
    stageId: 'stage-4',
    stageLabel: '4. WORKFLOWS & GOV',
    stageNumber: 4,
    badgeText: 'MANDATORY HUMAN GOVERNANCE GATE',
    badgeColor: '#D97706',
    badgeBg: '#FEF3C7',
    borderColor: '#FDE68A',
    icon: '🛡️',
    purpose:
      'Prevents autonomous AI agents from committing financial resources without human oversight. Enforces mandatory human commercial approval before releasing purchase orders or altering plant lines.',
    protocols: 'Role-Based Access Control (RBAC) · Segregation of Duties (SoD) · Cryptographic Signature',
    databaseTables: 'commitment_proposals, users, audit_logs, fact_customer_order',
    executionFlow: [
      'Receives synthesized proposals from AGT-05 (draft PO number, vendor, price, required delivery date).',
      'Enforces strict role permissions: only authorized Buyers or Plant Leadership can click "Approve".',
      'Records authorized user ID, timestamp, and digital signature permanently in Neon PostgreSQL audit logs.',
      'Unlocks downstream closed-loop execution and transmits approved POs to SAP ERP.',
    ],
    primaryProblemId: 'prob-slabreaches',
  },

  // ── Stage 5: Closed-Loop Execution ──
  'act-po': {
    id: 'act-po',
    title: 'PO Release & Transfers',
    shortCode: 'EXEC',
    subtitle: 'SAP ERP & Inter-Plant Transfer',
    stageId: 'stage-5',
    stageLabel: '5. CLOSED-LOOP',
    stageNumber: 5,
    badgeText: 'CLOSED-LOOP AUTOMATED EXECUTION',
    badgeColor: '#059669',
    badgeBg: '#D1FAE5',
    borderColor: '#A7F3D0',
    icon: '🚚',
    purpose:
      'Automated execution engine that releases approved POs into SAP ERP and authorizes Chennai-to-Bengaluru stock transfers to protect assembly line continuity.',
    protocols: 'SAP BAPI PO Creation · Inter-Plant Transfer Order API · WMS Staging Trigger',
    databaseTables: 'fact_supplier_po, fact_interplant_transfer, audit_logs',
    executionFlow: [
      'Transmits approved PO-2026-0038 directly into SAP S/4HANA via secure RFC/BAPI connection.',
      'Authorizes transfer of 1,200 6-layer Main PCB units from Chennai surplus buffer to Bengaluru high-bay storage.',
      'Generates bill of lading and customs transit manifests for interstate logistics.',
      'Restores factory build capacity from 6,261 units back to full target output with 0 line halts.',
    ],
    primaryProblemId: 'prob-shortages',
  },
  'act-alert': {
    id: 'act-alert',
    title: 'Dual Alert Routing',
    shortCode: 'NOTIFY',
    subtitle: 'Plant Ops & CS Escalations',
    stageId: 'stage-5',
    stageLabel: '5. CLOSED-LOOP',
    stageNumber: 5,
    badgeText: 'TARGETED ALERT DISPATCH ENGINE',
    badgeColor: '#D97706',
    badgeBg: '#FEF3C7',
    borderColor: '#FDE68A',
    icon: '✉️',
    purpose:
      'Dispatches targeted notifications to ensure plant supervisors receive actionable technical instructions while customer service receives commercial delivery impact summaries.',
    protocols: 'Ethereal / Gmail SMTP · Transactional HTML Notification Engine · Slack / Teams Webhooks',
    databaseTables: 'email_notification_logs, risk_alerts, fact_customer_order',
    executionFlow: [
      'Segregates notifications: Plant Ops receives technical PO expediting steps; CS receives customer OTIF impact summaries.',
      'Deduplicates alert triggers to prevent notification fatigue among factory managers.',
      'Automates 3-day escalation reminders if flagged component shortages remain unmitigated.',
      'Logs immutable delivery timestamps and recipient email receipts in PostgreSQL.',
    ],
    primaryProblemId: 'prob-delays',
  },
  'act-twin': {
    id: 'act-twin',
    title: '3D Twin & OTIF Portal',
    shortCode: 'TWIN',
    subtitle: 'Pick Simulation & Milestones',
    stageId: 'stage-5',
    stageLabel: '5. CLOSED-LOOP',
    stageNumber: 5,
    badgeText: '3D DIGITAL TWIN & REAL-TIME DASHBOARD',
    badgeColor: '#2563EB',
    badgeBg: '#DBEAFE',
    borderColor: '#BFDBFE',
    icon: '🖥️',
    purpose:
      'Interactive 3D digital twin of the Bengaluru high-bay warehouse simulating operator pick tours, conveyor movements, and real-time customer OTIF delivery milestone tracking.',
    protocols: 'Three.js 3D WebGL · WebSocket Live Frame Sync · OTIF Realization Metric API',
    databaseTables: 'fact_pick_tours, fact_dispatch_milestones, fact_customer_otif',
    executionFlow: [
      'Visualizes physical placement of all 3,840 bins across Aisles A01–A08 with interactive camera fly-to.',
      'Simulates operator collection routes and carton drops on the automated conveyor belt in 3D.',
      'Tracks order delivery progress across 4 customer accounts and 5 critical shipping horizons.',
      'Enables one-click drill down from macro factory KPIs to individual shelf bin coordinates.',
    ],
    primaryProblemId: 'prob-slabreaches',
  },
}

// Backwards compatibility aliases
ARCHITECTURE_NODES['agt-10'] = ARCHITECTURE_NODES['agt-07']
ARCHITECTURE_NODES['agt-09'] = ARCHITECTURE_NODES['agt-06']

// ─── 5 Core Problems Solved by Agents (Matching Real Operational Risks) ───────

export const CORE_PROBLEMS: ProblemCategory[] = [
  {
    id: 'prob-shortages',
    code: '01',
    title: 'LINE SHORTAGES',
    subtitle: 'Critical Assembly Depletion',
    bg: '#FEE2E2',
    textColor: '#DC2626',
    borderColor: '#FCA5A5',
    icon: '📉',
    solvedByNodeId: 'agt-03',
    impactMetric: '8 parts critical in 7 days identified',
    resolutionAction: 'AGT-03 calculates stockout dates; AGT-05 generates POs & Chennai transfers',
  },
  {
    id: 'prob-bottlenecks',
    code: '02',
    title: 'BOTTLENECKS',
    subtitle: '6-Layer Main PCB Throttling',
    bg: '#FEF3C7',
    textColor: '#D97706',
    borderColor: '#FCD34D',
    icon: '⚙️',
    solvedByNodeId: 'agt-04',
    impactMetric: '6,261 unit ceiling diagnosed on Lines 5–8',
    resolutionAction: 'AGT-04 BOM Twin identifies constraint; triggers 1,200-unit inter-plant transfer',
  },
  {
    id: 'prob-delays',
    code: '03',
    title: 'SUPPLIER DELAYS',
    subtitle: '79 Delayed Inbound POs',
    bg: '#EDE9FE',
    textColor: '#7C3AED',
    borderColor: '#C4B5FD',
    icon: '⏱️',
    solvedByNodeId: 'agt-05',
    impactMetric: '79 delayed POs flagged; ₹13.60L expedited',
    resolutionAction: 'Automated MOQ rounding & PO-2026-0038 draft release to prevent line starvation',
  },
  {
    id: 'prob-deadstock',
    code: '04',
    title: 'LOCKED CAPITAL',
    subtitle: '₹4.20 Cr E&O Dead Stock',
    bg: '#E0F2FE',
    textColor: '#0284C7',
    borderColor: '#BAE6FD',
    icon: '♻️',
    solvedByNodeId: 'agt-06',
    impactMetric: '₹4.20 Cr excess flagged across 2,240 SKUs',
    resolutionAction: 'AGT-06 spotlights dead stock in 3D & routes inter-plant redistribution',
  },
  {
    id: 'prob-phantom',
    code: '05',
    title: 'PHANTOM DRIFT',
    subtitle: 'ERP vs WMS Drift Mismatch',
    bg: '#FEE2E2',
    textColor: '#EF4444',
    borderColor: '#FCA5A5',
    icon: '🧹',
    solvedByNodeId: 'agt-01',
    impactMetric: '6,624 records audited; 100% clean balances',
    resolutionAction: 'AGT-01 runs 5-tier reconciliation across ERP and WMS to eliminate ledger ghost stock',
  },
]

// ─── 16-Part BOM Stockout & Depletion Horizon Heatmap Models ───────────────────

export interface BOMHeatmapCell {
  percent: number
  quantity: string
  status: 'critical' | 'reorder' | 'healthy' | 'deadstock' | 'empty'
  notes?: string
  action?: string
}

export interface BOMHeatmapRow {
  componentName: string
  partNumber: string
  subtext: string
  criticality: 'critical' | 'reorder' | 'healthy' | 'deadstock'
  cells: {
    d07: BOMHeatmapCell
    d14: BOMHeatmapCell
    d30: BOMHeatmapCell
    d60: BOMHeatmapCell
    d90: BOMHeatmapCell
  }
}

export const BOM_HORIZONS = [
  { id: 'd07', label: 'D 01–07', sub: 'Critical Halt', isAlert: true },
  { id: 'd14', label: 'D 08–14', sub: 'Reorder SLA', isPriority: true },
  { id: 'd30', label: 'D 15–30', sub: 'Line Buffer' },
  { id: 'd60', label: 'D 31–60', sub: 'Adequate Run' },
  { id: 'd90', label: 'D 60+', sub: 'E&O Dead Stock', isDeadStock: true },
]

export const BOM_HEATMAP_ROWS: BOMHeatmapRow[] = [
  {
    componentName: '6-Layer Main PCB',
    partNumber: 'MAT-PCB-004',
    subtext: 'Bengaluru SMT 1–4 · Capped 850u',
    criticality: 'critical',
    cells: {
      d07: { percent: 18, quantity: '150 u', status: 'critical', notes: 'Severe line throttling on SMT lines 1–4.' },
      d14: { percent: 10, quantity: '80 u', status: 'critical', notes: 'Buffer reaches emergency 2-hour threshold.' },
      d30: { percent: 0, quantity: '0 u', status: 'critical', notes: 'ZERO STOCK on Day 18 halts Box-Build lines at 850 units.', action: 'AGT-04 initiated 1,200u transfer from Chennai + AGT-05 drafted PO-2026-0038.' },
      d60: { percent: 0, quantity: '—', status: 'empty' },
      d90: { percent: 0, quantity: '—', status: 'empty' },
    },
  },
  {
    componentName: 'Sony IMX 50MP Sensor',
    partNumber: 'CAM-SNY-050',
    subtext: 'Rear Primary Camera Module',
    criticality: 'reorder',
    cells: {
      d07: { percent: 99, quantity: '480 u', status: 'healthy', notes: 'Feeder pick rates 100% on SMT Line 2.' },
      d14: { percent: 65, quantity: '320 u', status: 'reorder', notes: 'Reaches reorder safety buffer on Day 12.' },
      d30: { percent: 40, quantity: '200 u', status: 'reorder', notes: 'Below 30-day target buffer.', action: 'AGT-05 auto-drafted replenishment proposal with Murata.' },
      d60: { percent: 15, quantity: '75 u', status: 'reorder', notes: 'Lead time buffer required.' },
      d90: { percent: 0, quantity: '—', status: 'empty' },
    },
  },
  {
    componentName: 'Snapdragon 8G3 AP',
    partNumber: 'SEM-SD-8G3',
    subtext: '4nm Application Processor',
    criticality: 'healthy',
    cells: {
      d07: { percent: 100, quantity: '500 u', status: 'healthy', notes: 'Full stock available in High-Bay Aisle A01.' },
      d14: { percent: 95, quantity: '475 u', status: 'healthy', notes: 'Optimal consumption pace.' },
      d30: { percent: 88, quantity: '440 u', status: 'healthy', notes: 'Sufficient buffer across work orders.' },
      d60: { percent: 75, quantity: '375 u', status: 'healthy', notes: '2,400 total units on-hand.' },
      d90: { percent: 30, quantity: '150 u', status: 'healthy', notes: 'Surplus safe through Q4.' },
    },
  },
  {
    componentName: '6.5" AMOLED 120Hz',
    partNumber: 'DIS-AMO-065',
    subtext: 'Samsung Display · L09 Bay',
    criticality: 'healthy',
    cells: {
      d07: { percent: 100, quantity: '450 u', status: 'healthy', notes: 'Tested and released by AGT-08 QC.' },
      d14: { percent: 90, quantity: '410 u', status: 'healthy', notes: 'Buffer covers next 45 days.' },
      d30: { percent: 78, quantity: '350 u', status: 'healthy', notes: 'Assembly requirements verified.' },
      d60: { percent: 60, quantity: '270 u', status: 'healthy', notes: 'Vendor delivery on schedule.' },
      d90: { percent: 0, quantity: '—', status: 'empty' },
    },
  },
  {
    componentName: '5000mAh Li-Po Cell',
    partNumber: 'BAT-LIP-500',
    subtext: 'Sunwoda Fast-Charge Pack',
    criticality: 'healthy',
    cells: {
      d07: { percent: 100, quantity: '480 u', status: 'healthy', notes: 'Certified lots in ground-floor bin.' },
      d14: { percent: 92, quantity: '440 u', status: 'healthy', notes: 'Safe operational buffer.' },
      d30: { percent: 82, quantity: '390 u', status: 'healthy', notes: 'WIP queue healthy.' },
      d60: { percent: 65, quantity: '310 u', status: 'healthy', notes: 'Adequate stock level.' },
      d90: { percent: 0, quantity: '—', status: 'empty' },
    },
  },
  {
    componentName: 'Murata 0603 EMI Filter',
    partNumber: 'PAS-EMI-060',
    subtext: 'Aisle A04 · >90d Inactive',
    criticality: 'deadstock',
    cells: {
      d07: { percent: 100, quantity: '12k u', status: 'healthy', notes: 'Over-allocated in warehouse.' },
      d14: { percent: 100, quantity: '12k u', status: 'healthy', notes: 'No consumption in past 90 days.' },
      d30: { percent: 100, quantity: '12k u', status: 'healthy', notes: 'Zero demand on active BOM.' },
      d60: { percent: 100, quantity: '12k u', status: 'healthy', notes: 'Depreciation liability accumulating.' },
      d90: { percent: 100, quantity: '₹4.2M', status: 'deadstock', notes: '₹4.20 Cr locked capital flagged by AGT-06.', action: 'AGT-06 spotlights bins in 3D & routes inter-plant redistribution to Chennai.' },
    },
  },
]

// ─── Main Home Component ───────────────────────────────────────────────

export function Home() {
  const nav = useNavigate()
  const [selectedNodeId, setSelectedNodeId] = useState<string>('agt-04')
  const [highlightedProblemId, setHighlightedProblemId] = useState<string | null>('prob-bottlenecks')
  const [selectedBOMCell, setSelectedBOMCell] = useState<{
    component: string
    windowLabel: string
    cell: BOMHeatmapCell
  } | null>({
    component: '6-Layer Main PCB (MAT-PCB-004)',
    windowLabel: 'D 15–30 (Buffer Limit)',
    cell: {
      percent: 0,
      quantity: '0 u',
      status: 'critical',
      notes: 'ZERO STOCK on Day 18 halts Box-Build lines at 850 units.',
      action: 'AGT-04 initiated 1,200u transfer from Chennai + AGT-05 drafted PO-2026-0038.',
    },
  })

  const selectedNode = ARCHITECTURE_NODES[selectedNodeId] || ARCHITECTURE_NODES['agt-04']

  // Handle problem selection: highlight problem and automatically inspect the resolving node
  const handleSelectProblem = (problem: ProblemCategory) => {
    setHighlightedProblemId(problem.id)
    if (problem.solvedByNodeId && ARCHITECTURE_NODES[problem.solvedByNodeId]) {
      setSelectedNodeId(problem.solvedByNodeId)
    }
  }

  // Get cell color style based on status
  const getBOMCellBg = (status: BOMHeatmapCell['status']) => {
    switch (status) {
      case 'critical':
        return { bg: '#FEE2E2', border: '#FCA5A5', text: '#DC2626' }
      case 'reorder':
        return { bg: '#FEF3C7', border: '#FCD34D', text: '#D97706' }
      case 'healthy':
        return { bg: '#DCFCE7', border: '#86EFAC', text: '#15803D' }
      case 'deadstock':
        return { bg: '#FAF5FF', border: '#C4B5FD', text: '#7C3AED' }
      default:
        return { bg: '#F8FAFC', border: '#E2E8F0', text: '#94A3B8' }
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
        maxWidth: 1680,
        margin: '0 auto',
        padding: '2px 0 24px',
        color: '#1E293B',
      }}
    >
      {/* ── Top Header Breadcrumbs & Quick Controls ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '2px 4px 6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Inventory Intelligence</span>
          <span style={{ color: '#CBD5E1' }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
            System Architecture &amp; Agent Mesh
          </span>
          <span
            style={{
              marginLeft: 6,
              background: '#F1F5F9',
              color: '#475569',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 20,
              border: '1px solid #E2E8F0',
            }}
          >
            Run #41 · 7 Specialized Agents Active
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Quick Search */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              padding: '4px 10px',
              gap: 6,
              width: 250,
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <span style={{ fontSize: 12, color: '#94A3B8' }}>🔍</span>
            <input
              type="text"
              placeholder="Search orders, components, or agents..."
              style={{
                border: 'none',
                outline: 'none',
                fontSize: 11,
                width: '100%',
                background: 'transparent',
                color: '#1E293B',
              }}
            />
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: '#64748B',
                background: '#F1F5F9',
                padding: '1px 5px',
                borderRadius: 4,
                border: '1px solid #E2E8F0',
              }}
            >
              ⌘K
            </span>
          </div>

          <button
            type="button"
            onClick={() => nav('/overview')}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            <span>📊</span>
            <span>View Full Overview</span>
          </button>

          <span
            style={{
              background: '#FAF5FF',
              color: '#7C3AED',
              border: '1px solid #DDD6FE',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            ADMIN
          </span>
        </div>
      </div>

      {/* ── Top Row: System Architecture Pipeline (Expanded ~80%) & Problems Solved (Compact 235px) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 235px',
          gap: 16,
        }}
      >
        {/* ════════════════════════════════════════════════════════════════
            CARD 1 (TOP-LEFT): Real System Architecture Pipeline
        ════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Card Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: '#EDE9FE',
                  color: '#6F3DBA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconPipelineHeader size={18} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
                  System Architecture Pipeline
                </h2>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>
                  True multi-agent inventory flow from enterprise sources to closed-loop dispatch
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#7C3AED',
                background: '#FAF5FF',
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid #DDD6FE',
              }}
            >
              Click any card to inspect details ˅
            </span>
          </div>

          {/* 5-Stage Architecture Horizontal Flow */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(110px, 1fr) auto minmax(100px, 0.9fr) auto minmax(280px, 2.7fr) auto minmax(110px, 1fr) auto minmax(115px, 1.05fr)',
              alignItems: 'stretch',
              gap: 4,
            }}
          >
            {/* ── STAGE 1: DATA SOURCES ── */}
            <div
              style={{
                background: '#FFF5F5',
                border: '1.5px solid #FCA5A5',
                borderRadius: 10,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  background: '#991B1B',
                  color: '#FFFFFF',
                  padding: '5px 8px',
                  textAlign: 'center',
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                <div>1. DATA SOURCES</div>
                <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.85 }}>Enterprise Silos</div>
              </div>
              <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['src-sap']}
                  isSelected={selectedNodeId === 'src-sap'}
                  onSelect={() => setSelectedNodeId('src-sap')}
                  fillVertical
                />
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['src-mes']}
                  isSelected={selectedNodeId === 'src-mes'}
                  onSelect={() => setSelectedNodeId('src-mes')}
                  fillVertical
                />
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['src-wms']}
                  isSelected={selectedNodeId === 'src-wms'}
                  onSelect={() => setSelectedNodeId('src-wms')}
                  fillVertical
                />
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['src-excel']}
                  isSelected={selectedNodeId === 'src-excel'}
                  onSelect={() => setSelectedNodeId('src-excel')}
                  fillVertical
                />
              </div>
            </div>

            <StageArrow />

            {/* ── STAGE 2: INGESTION & DATA LAYER ── */}
            <div
              style={{
                background: '#EFF6FF',
                border: '1.5px solid #93C5FD',
                borderRadius: 10,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  background: '#1D4ED8',
                  color: '#FFFFFF',
                  padding: '5px 8px',
                  textAlign: 'center',
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                <div>2. INGESTION &amp; DB</div>
                <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.85 }}>FastAPI + Postgres 16</div>
              </div>
              <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['ing-fastapi']}
                  isSelected={selectedNodeId === 'ing-fastapi'}
                  onSelect={() => setSelectedNodeId('ing-fastapi')}
                  fillVertical
                />
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['ing-postgres']}
                  isSelected={selectedNodeId === 'ing-postgres'}
                  onSelect={() => setSelectedNodeId('ing-postgres')}
                  fillVertical
                />
              </div>
            </div>

            <StageArrow />

            {/* ── STAGE 3: AI AGENT MESH (Active Agents 1–7) ── */}
            <div
              style={{
                background: '#FAF5FF',
                border: '1.5px solid #C4B5FD',
                borderRadius: 10,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  background: '#5B21B6',
                  color: '#FFFFFF',
                  padding: '5px 8px',
                  textAlign: 'center',
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                <div>3. AI AGENT MESH</div>
                <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.85 }}>
                  Orchestrator + 6 Specialist Agents
                </div>
              </div>
              <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                {/* Central Orchestrator across top */}
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['agt-07']}
                  isSelected={selectedNodeId === 'agt-07'}
                  onSelect={() => setSelectedNodeId('agt-07')}
                  isHighlightPrimary
                  hideCodePrefix
                />

                {/* 6 Specialist Agents in 2 equal-width columns */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, minWidth: 0, flex: 1 }}>
                  <PipelineSubCard
                    node={ARCHITECTURE_NODES['agt-01']}
                    isSelected={selectedNodeId === 'agt-01'}
                    onSelect={() => setSelectedNodeId('agt-01')}
                    compact
                    hideCodePrefix
                    fillVertical
                  />
                  <PipelineSubCard
                    node={ARCHITECTURE_NODES['agt-02']}
                    isSelected={selectedNodeId === 'agt-02'}
                    onSelect={() => setSelectedNodeId('agt-02')}
                    compact
                    hideCodePrefix
                    fillVertical
                  />
                  <PipelineSubCard
                    node={ARCHITECTURE_NODES['agt-03']}
                    isSelected={selectedNodeId === 'agt-03'}
                    onSelect={() => setSelectedNodeId('agt-03')}
                    compact
                    hideCodePrefix
                    fillVertical
                  />
                  <PipelineSubCard
                    node={ARCHITECTURE_NODES['agt-04']}
                    isSelected={selectedNodeId === 'agt-04'}
                    onSelect={() => setSelectedNodeId('agt-04')}
                    compact
                    hideCodePrefix
                    fillVertical
                  />
                  <PipelineSubCard
                    node={ARCHITECTURE_NODES['agt-05']}
                    isSelected={selectedNodeId === 'agt-05'}
                    onSelect={() => setSelectedNodeId('agt-05')}
                    compact
                    hideCodePrefix
                    fillVertical
                  />
                  <PipelineSubCard
                    node={ARCHITECTURE_NODES['agt-06']}
                    isSelected={selectedNodeId === 'agt-06'}
                    onSelect={() => setSelectedNodeId('agt-06')}
                    compact
                    hideCodePrefix
                    fillVertical
                  />
                </div>
              </div>
            </div>

            <StageArrow />

            {/* ── STAGE 4: WORKFLOWS & GOVERNANCE ── */}
            <div
              style={{
                background: '#EFF6FF',
                border: '1.5px solid #93C5FD',
                borderRadius: 10,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  background: '#1E40AF',
                  color: '#FFFFFF',
                  padding: '5px 8px',
                  textAlign: 'center',
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                <div>4. GOVERNANCE</div>
                <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.85 }}>Human Sign-Off Gate</div>
              </div>
              <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['gov-workflows']}
                  isSelected={selectedNodeId === 'gov-workflows'}
                  onSelect={() => setSelectedNodeId('gov-workflows')}
                  fillVertical
                />
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['gov-approval']}
                  isSelected={selectedNodeId === 'gov-approval'}
                  onSelect={() => setSelectedNodeId('gov-approval')}
                  fillVertical
                />
              </div>
            </div>

            <StageArrow />

            {/* ── STAGE 5: CLOSED-LOOP EXECUTION ── */}
            <div
              style={{
                background: '#FFF5F5',
                border: '1.5px solid #FCA5A5',
                borderRadius: 10,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  background: '#831843',
                  color: '#FFFFFF',
                  padding: '5px 8px',
                  textAlign: 'center',
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                <div>5. CLOSED-LOOP</div>
                <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.85 }}>Execution &amp; Twin</div>
              </div>
              <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['act-po']}
                  isSelected={selectedNodeId === 'act-po'}
                  onSelect={() => setSelectedNodeId('act-po')}
                  fillVertical
                />
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['act-alert']}
                  isSelected={selectedNodeId === 'act-alert'}
                  onSelect={() => setSelectedNodeId('act-alert')}
                  fillVertical
                />
                <PipelineSubCard
                  node={ARCHITECTURE_NODES['act-twin']}
                  isSelected={selectedNodeId === 'act-twin'}
                  onSelect={() => setSelectedNodeId('act-twin')}
                  fillVertical
                />
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            CARD 2 (TOP-RIGHT): 5 Core Operational Problems Solved (Compact 235px)
        ════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            padding: 12,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {/* Card Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconTargetProblems size={16} />
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
                Problems Solved
              </h2>
            </div>
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 800,
                color: '#EF4444',
                background: '#FEE2E2',
                padding: '2px 5px',
                borderRadius: 16,
                border: '1px solid #FECACA',
                whiteSpace: 'nowrap',
              }}
            >
              5 PROBLEMS
            </span>
          </div>

          <div style={{ fontSize: 9.5, color: '#64748B', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Click problem to spotlight resolving agent:
          </div>

          {/* 5 Problem Strips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
            {CORE_PROBLEMS.map((problem) => {
              const isHighlighted =
                highlightedProblemId === problem.id || selectedNode.primaryProblemId === problem.id
              return (
                <div
                  key={problem.id}
                  onClick={() => handleSelectProblem(problem)}
                  style={{
                    background: problem.bg,
                    border: isHighlighted ? `2px solid ${problem.textColor}` : `1px solid ${problem.borderColor}`,
                    borderRadius: 7,
                    padding: '5px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    cursor: 'pointer',
                    transform: isHighlighted ? 'scale(1.01)' : 'none',
                    boxShadow: isHighlighted ? `0 2px 8px ${problem.textColor}33` : 'none',
                    transition: 'all 0.15s ease',
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        fontSize: 10.5,
                        color: problem.textColor,
                        flexShrink: 0,
                      }}
                    >
                      {problem.code}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: problem.textColor,
                          letterSpacing: '0.01em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {problem.title}
                      </div>
                      <div
                        style={{
                          fontSize: 8,
                          color: '#475569',
                          marginTop: 1,
                          lineHeight: 1.15,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={problem.subtitle}
                      >
                        {problem.subtitle}
                      </div>
                    </div>
                  </div>

                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 16, height: 16 }}>
                    {renderProblemIcon(problem.id, 14) || problem.icon}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Drill Down Inspector (56%) & Customer Delivery Heatmap (44%) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1.05fr)',
          gap: 16,
        }}
      >
        {/* ════════════════════════════════════════════════════════════════
            CARD 3 (BOTTOM-LEFT): Selected Card Drill Down Inspector
        ════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Card Title & Subgroup Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              borderBottom: '1px solid #F1F5F9',
              paddingBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: selectedNode.badgeBg || '#F1F5F9',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${selectedNode.borderColor || '#E2E8F0'}`,
                  flexShrink: 0,
                }}
              >
                {renderArchitectureIcon(selectedNode.id, 20) || selectedNode.icon}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                  {selectedNode.title}
                </h3>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                  {selectedNode.subtitle} · Stage {selectedNode.stageNumber} ({selectedNode.stageLabel})
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: selectedNode.badgeColor,
                background: selectedNode.badgeBg,
                padding: '3px 8px',
                borderRadius: 6,
                border: `1px solid ${selectedNode.borderColor}`,
                letterSpacing: '0.03em',
              }}
            >
              {selectedNode.badgeText}
            </span>
          </div>

          {/* Operational Description */}
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.55,
              color: '#334155',
              fontWeight: 450,
            }}
          >
            {selectedNode.purpose}
          </p>

          {/* Protocols and Database Tables Boxes */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '8px 10px',
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                PROTOCOLS / INTERFACES
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#0F172A',
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                {selectedNode.protocols}
              </div>
            </div>

            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '8px 10px',
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                DATABASE TABLES &amp; SCHEMAS
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#4338CA',
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                {selectedNode.databaseTables}
              </div>
            </div>
          </div>

          {/* Execution Logic & Operational Flow */}
          <div style={{ marginTop: 2 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: '#0F172A',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>⚙️</span>
              <span>Execution Logic &amp; Operational Flow:</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedNode.executionFlow.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    fontSize: 11,
                    lineHeight: 1.45,
                    color: '#334155',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: '#6F3DBA',
                      background: '#EDE9FE',
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            CARD 4 (BOTTOM-RIGHT): 16-Part BOM Stockout & Depletion Horizon Heatmap
        ════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📉</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>
                    16-Part BOM Stockout &amp; Depletion Heatmap
                  </h3>
                  <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 1 }}>
                    Run-rate burn trajectories projected by AGT-03 Shortage Forecast &amp; AGT-06 E&amp;O Agent
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#7C3AED',
                    background: '#FAF5FF',
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid #DDD6FE',
                  }}
                >
                  16 COMPONENTS × 5 HORIZONS
                </span>
                <Link
                  to="/shortages"
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#6D28D9',
                    background: '#FFFFFF',
                    padding: '2px 7px',
                    borderRadius: 5,
                    border: '1px solid #C4B5FD',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span>Forecast</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            {/* Heatmap Matrix Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th
                      style={{
                        padding: '7px 10px',
                        textAlign: 'left',
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: '#64748B',
                        width: '32%',
                      }}
                    >
                      BOM COMPONENT &amp; PART #
                    </th>
                    {BOM_HORIZONS.map((h) => (
                      <th
                        key={h.id}
                        style={{
                          padding: '6px 4px',
                          textAlign: 'center',
                          fontSize: 9.5,
                          fontWeight: 700,
                          color: h.isAlert ? '#DC2626' : h.isPriority ? '#D97706' : h.isDeadStock ? '#7C3AED' : '#475569',
                          background: h.isAlert ? '#FEF2F2' : h.isPriority ? '#FFFBEB' : h.isDeadStock ? '#FAF5FF' : 'transparent',
                          borderLeft: '1px solid #E2E8F0',
                        }}
                      >
                        <div>{h.label}</div>
                        <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.85 }}>{h.sub}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BOM_HEATMAP_ROWS.map((row, rIdx) => (
                    <tr
                      key={row.partNumber}
                      style={{
                        borderBottom: rIdx < BOM_HEATMAP_ROWS.length - 1 ? '1px solid #F1F5F9' : 'none',
                      }}
                    >
                      <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background:
                                row.criticality === 'critical'
                                  ? '#EF4444'
                                  : row.criticality === 'reorder'
                                    ? '#F59E0B'
                                    : row.criticality === 'deadstock'
                                      ? '#7C3AED'
                                      : '#22C55E',
                            }}
                          />
                          <div style={{ fontWeight: 700, fontSize: 10.5, color: '#0F172A' }}>
                            {row.componentName}
                          </div>
                        </div>
                        <div style={{ fontSize: 8.5, color: '#94A3B8', marginLeft: 12 }}>
                          {row.subtext}
                        </div>
                      </td>

                      {BOM_HORIZONS.map((h) => {
                        const cell = row.cells[h.id as keyof typeof row.cells]
                        const isSelected =
                          selectedBOMCell?.component.includes(row.componentName) &&
                          selectedBOMCell?.windowLabel.includes(h.label)

                        if (!cell || cell.status === 'empty') {
                          return (
                            <td
                              key={h.id}
                              style={{
                                padding: '5px 4px',
                                textAlign: 'center',
                                borderLeft: '1px solid #E2E8F0',
                                color: '#CBD5E1',
                                fontSize: 10,
                              }}
                            >
                              —
                            </td>
                          )
                        }

                        const cellStyle = getBOMCellBg(cell.status)
                        return (
                          <td
                            key={h.id}
                            onClick={() =>
                              setSelectedBOMCell({
                                component: `${row.componentName} (${row.partNumber})`,
                                windowLabel: `${h.label} (${h.sub})`,
                                cell,
                              })
                            }
                            style={{
                              padding: '5px 4px',
                              textAlign: 'center',
                              borderLeft: '1px solid #E2E8F0',
                              cursor: 'pointer',
                              background: cellStyle.bg,
                              borderTop: isSelected ? '2px solid #7C3AED' : 'none',
                              borderBottom: isSelected ? '2px solid #7C3AED' : 'none',
                              boxShadow: isSelected ? 'inset 0 0 0 1px #7C3AED' : 'none',
                              transition: 'all 0.1s ease',
                            }}
                            title={`Click to inspect ${row.componentName} - ${h.label}`}
                          >
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 10.5,
                                color: cellStyle.text,
                                lineHeight: 1.1,
                              }}
                            >
                              {cell.percent}%
                            </div>
                            <div
                              style={{
                                fontSize: 8,
                                color: cellStyle.text,
                                opacity: 0.9,
                                marginTop: 1,
                                fontWeight: 600,
                              }}
                            >
                              {cell.quantity}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Selected Cell Detail Callout */}
            {selectedBOMCell && (
              <div
                style={{
                  marginTop: 8,
                  padding: '7px 10px',
                  background: '#F8FAFC',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 800, color: '#0F172A' }}>
                    {selectedBOMCell.component} [{selectedBOMCell.windowLabel}]:
                  </span>{' '}
                  <span style={{ color: '#475569' }}>
                    Remaining: <b>{selectedBOMCell.cell.quantity} ({selectedBOMCell.cell.percent}% buffer)</b>.{' '}
                    {selectedBOMCell.cell.notes && (
                      <span style={{ color: selectedBOMCell.cell.status === 'critical' ? '#DC2626' : '#D97706', fontWeight: 600 }}>
                        {selectedBOMCell.cell.notes}{' '}
                      </span>
                    )}
                    {selectedBOMCell.cell.action && (
                      <span style={{ color: '#6D28D9', fontWeight: 700 }}>
                        Action: {selectedBOMCell.cell.action}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footer Legend Bar */}
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 9.5,
              color: '#64748B',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FEE2E2', border: '1px solid #FCA5A5' }} />
                <span>&lt;7d Stockout Risk</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FEF3C7', border: '1px solid #FCD34D' }} />
                <span>8–14d Reorder SLA</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#DCFCE7', border: '1px solid #86EFAC' }} />
                <span>15–60d Healthy Buffer</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FAF5FF', border: '1px solid #C4B5FD' }} />
                <span>&gt;60d E&amp;O Dead Stock</span>
              </span>
            </div>
            <span style={{ color: '#94A3B8' }}>Click any cell to inspect trajectory</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-Component Helpers ─────────────────────────────────────────────

function PipelineSubCard({
  node,
  isSelected,
  onSelect,
  compact = false,
  isHighlightPrimary = false,
  hideCodePrefix = false,
  fillVertical = false,
}: {
  node: ArchitectureNode
  isSelected: boolean
  onSelect: () => void
  compact?: boolean
  isHighlightPrimary?: boolean
  hideCodePrefix?: boolean
  fillVertical?: boolean
}) {
  const displayTitle = hideCodePrefix
    ? node.title.replace(/^AGT-\d+:\s*/, '')
    : node.title

  const customIcon = renderArchitectureIcon(node.id, compact ? 16 : 18)

  return (
    <div
      onClick={onSelect}
      style={{
        flex: fillVertical ? 1 : 'none',
        minWidth: 0,
        background: isHighlightPrimary ? 'linear-gradient(135deg, #FAF5FF 0%, #F5F3FF 100%)' : '#FFFFFF',
        border: isSelected
          ? '2px solid #7C3AED'
          : isHighlightPrimary
            ? '1.5px solid #DDD6FE'
            : '1px solid #E2E8F0',
        borderRadius: 8,
        padding: compact ? '4px 6px' : '6px 8px',
        cursor: 'pointer',
        boxShadow: isSelected
          ? '0 0 10px rgba(124, 58, 237, 0.28)'
          : isHighlightPrimary
            ? '0 1px 3px rgba(124, 58, 237, 0.1)'
            : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 6 : 8,
        transition: 'all 0.15s ease',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: compact ? 18 : 20,
          height: compact ? 18 : 20,
          flexShrink: 0,
        }}
      >
        {customIcon || node.icon}
      </span>
      <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: compact ? 9.5 : 10,
            fontWeight: 800,
            color: isHighlightPrimary ? '#5B21B6' : '#0F172A',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={node.title}
        >
          {displayTitle}
        </div>
        <div
          style={{
            fontSize: compact ? 7.5 : 8,
            color: '#64748B',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={node.subtitle}
        >
          {node.subtitle}
        </div>
      </div>
    </div>
  )
}

function StageArrow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: 800,
      }}
    >
      →
    </div>
  )
}
