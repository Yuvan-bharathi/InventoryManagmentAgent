import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FourComponentFramework } from './FourComponentFramework'

export interface ArchComponent {
  id: string
  name: string
  shortName?: string
  layer: 'sources' | 'ingestion' | 'datalayer' | 'backend' | 'agents' | 'outputs' | 'pages' | 'governance'
  subgroup?: string
  icon: string
  status: 'Connected' | 'Active' | 'Running' | 'Available' | 'Completed' | 'Planned'
  statusColor?: string
  purpose: string
  inputData: string[]
  upstream: string[]
  processing: string[]
  outputPayload: string[]
  downstream: string[]
  frontendPages: { name: string; path: string }[]
  latency?: string
  lastSync?: string
  liveMetric?: string
  accentColor: string
  badgeBg: string
}

export const ARCHITECTURE_COMPONENTS: Record<string, ArchComponent> = {
  // Layer 1: Sources
  'src-sap': {
    id: 'src-sap',
    name: 'SAP ERP (ECC / S4HANA)',
    shortName: 'ERP (SAP)',
    layer: 'sources',
    icon: '🏢',
    status: 'Connected',
    statusColor: '#0284C7',
    purpose: 'Core Enterprise Resource Planning system providing procurement purchase orders, vendor master records, and standard BOM schemas.',
    inputData: ['Procurement PO records', 'Vendor Master Data', 'Standard Plant Bill of Materials'],
    upstream: ['SAP S/4HANA Enterprise Connector', 'Scheduled Nightly Batch Sync'],
    processing: [
      'Extracts PO creation headers & commitment line items',
      'Synchronizes standard purchasing lead times and supplier contracts',
      'Generates daily CSV snapshots for downstream ingestion'
    ],
    outputPayload: ['fact_purchase_order_receipt.csv', 'dim_supplier.csv', 'dim_material.csv'],
    downstream: ['ing-connectors', 'ing-schema', 'db-master'],
    frontendPages: [
      { name: 'Connected Databases', path: '/connectors' },
      { name: 'Purchase Order Approvals', path: '/proposals' },
      { name: 'Stock on Hand', path: '/stock' }
    ],
    latency: '18ms',
    lastSync: '31-Oct-2026, 10:24 AM',
    liveMetric: '1,302 PO lines · 2 plants',
    accentColor: '#0284C7',
    badgeBg: '#E0F2FE'
  },
  'src-mes': {
    id: 'src-mes',
    name: 'Manufacturing Execution System (MES)',
    shortName: 'MES',
    layer: 'sources',
    icon: '🏭',
    status: 'Connected',
    statusColor: '#0284C7',
    purpose: 'Shop floor execution tracker monitoring active assembly lines, work-in-progress (WIP), and hourly component consumption.',
    inputData: ['SMT Line pick-and-place logs', 'Line work order status', 'Active build run-rates'],
    upstream: ['Shop Floor OPC-UA Gateway', 'MES Event Bus'],
    processing: [
      'Captures real-time component consumption at pick-and-place feeders',
      'Tracks WIP lot progression across SMT, Testing, and Box-Build',
      'Logs scrapped units and rework routing'
    ],
    outputPayload: ['fact_production_wip.csv', 'line_consumption_events'],
    downstream: ['ing-connectors', 'db-movements', 'agt-04'],
    frontendPages: [
      { name: 'Build Capacity Calculator', path: '/capacity' },
      { name: 'Shelf and Location Map', path: '/digital-twin' }
    ],
    latency: '8ms',
    lastSync: '31-Oct-2026, 10:24 AM',
    liveMetric: '850 units active WIP',
    accentColor: '#0284C7',
    badgeBg: '#E0F2FE'
  },
  'src-wms': {
    id: 'src-wms',
    name: 'Warehouse Management System (WMS)',
    shortName: 'WMS',
    layer: 'sources',
    icon: '📦',
    status: 'Connected',
    statusColor: '#0284C7',
    purpose: 'Warehouse inventory tracker managing physical bin locations, pallet movements, staging bays, and cycle count logs.',
    inputData: ['Bin coordinate mappings (Row/Rack/Shelf/Bin)', 'Warehouse lot balances', 'Pallet putaway scans'],
    upstream: ['Barcode / RFID Scanner Handhelds', 'WMS Database Sync'],
    processing: [
      'Records physical receipt staging and location assignment',
      'Aggregates stock quantities across 4 plant warehouse zones',
      'Flags negative balances and location mismatches'
    ],
    outputPayload: ['fact_stock_level.csv', 'fact_cycle_count.csv', 'dim_warehouse.csv'],
    downstream: ['ing-connectors', 'ing-reconcile', 'db-inventory'],
    frontendPages: [
      { name: 'Shelf and Location Map', path: '/digital-twin' },
      { name: 'Cycle Counts and Routines', path: '/cycle-counts' },
      { name: 'Stock on Hand', path: '/stock' }
    ],
    latency: '12ms',
    lastSync: '31-Oct-2026, 10:24 AM',
    liveMetric: '6,624 inventory records',
    accentColor: '#0284C7',
    badgeBg: '#E0F2FE'
  },
  'src-qms': {
    id: 'src-qms',
    name: 'Quality Management System (QMS)',
    shortName: 'QMS',
    layer: 'sources',
    icon: '🔬',
    status: 'Connected',
    statusColor: '#0284C7',
    purpose: 'Quality assurance and dock gatekeeper recording incoming inspection results, non-conformance reports, and scrap lot decisions.',
    inputData: ['Certificate of Analysis (CoA) docs', 'Inspection defect logs', 'Quarantine lot tags'],
    upstream: ['QA Laboratory Information System (LIMS)', 'Dock Inspection Terminals'],
    processing: [
      'Tracks First-Pass Yield (96.46% benchmark)',
      'Segregates quarantine lots (103 lots held, ₹21.80L)',
      'Issues disposition orders: Accepted, Rework, or Scrapped'
    ],
    outputPayload: ['fact_quality_inspection.csv', 'lot_disposition_status'],
    downstream: ['ing-qc', 'agt-08', 'db-qc'],
    frontendPages: [
      { name: 'Quality Hold and Rejects', path: '/quality' },
      { name: 'Goods Receiving', path: '/receiving' },
      { name: 'Batch Traceability', path: '/traceability' }
    ],
    latency: '15ms',
    lastSync: '31-Oct-2026, 10:24 AM',
    liveMetric: '103 quarantined lots · ₹21.80L',
    accentColor: '#0284C7',
    badgeBg: '#E0F2FE'
  },
  'src-rfq': {
    id: 'src-rfq',
    name: 'Supplier Portal & RFQ Engine',
    shortName: 'Supplier / RFQ',
    layer: 'sources',
    icon: '🤝',
    status: 'Connected',
    statusColor: '#0284C7',
    purpose: 'Vendor collaboration system for live quotation tracking, supplier lead time promises, and ASN (Advance Shipping Notice) updates.',
    inputData: ['Supplier price quotes', 'Contracted Minimum Order Quantities (MOQ)', 'Advance shipping notices'],
    upstream: ['B2B EDI Gateway', 'Supplier Portal Webhooks'],
    processing: [
      'Monitors supplier lead time promises vs actual dock arrivals',
      'Tracks tier-1 vendor reliability scores (Shenzhen Silicon, Murata, etc.)',
      'Syncs active MOQ price break brackets'
    ],
    outputPayload: ['fact_supplier_lead_time.csv', 'supplier_quotations'],
    downstream: ['agt-07', 'agt-05', 'db-supplier'],
    frontendPages: [
      { name: 'Supplier Delay Simulator', path: '/simulation' },
      { name: 'Purchase Order Approvals', path: '/proposals' }
    ],
    latency: '45ms',
    lastSync: '31-Oct-2026, 10:24 AM',
    liveMetric: '42 active suppliers',
    accentColor: '#0284C7',
    badgeBg: '#E0F2FE'
  },
  'src-excel': {
    id: 'src-excel',
    name: 'Manual File Uploads & CSV Sheets',
    shortName: 'Excel / CSV',
    layer: 'sources',
    icon: '📊',
    status: 'Connected',
    statusColor: '#10B981',
    purpose: 'Ad-hoc planner data imports supporting custom forecast revisions, emergency buffer overrides, and physical cycle recount sheets.',
    inputData: ['Multi-tab Excel workbooks', 'Raw CSV uploads', 'Override configuration files'],
    upstream: ['Web Portal Drag-and-Drop', 'Data Import & Quality (/uploads)'],
    processing: [
      'Automatic column header mapping and type inference',
      'Validates file structure against canonical database schemas',
      'Sanitizes invalid characters and whitespace'
    ],
    outputPayload: ['sanitized_upload_batches', 'schema_validation_reports'],
    downstream: ['ing-connectors', 'ing-schema', 'agt-01'],
    frontendPages: [
      { name: 'Data Import and Quality', path: '/uploads' },
      { name: 'Connected Databases', path: '/connectors' }
    ],
    latency: '22ms',
    lastSync: '31-Oct-2026, 10:24 AM',
    liveMetric: '14 tables loaded',
    accentColor: '#10B981',
    badgeBg: '#DCFCE7'
  },

  // Layer 2: Ingestion & Validation
  'ing-connectors': {
    id: 'ing-connectors',
    name: 'Database & File Connectors',
    shortName: 'Connectors (API / File)',
    layer: 'ingestion',
    icon: '🔌',
    status: 'Running',
    statusColor: '#059669',
    purpose: 'Unified data ingestion pipeline polling external enterprise systems, receiving webhooks, and reading scheduled sync batches.',
    inputData: ['Raw API payloads', 'CSV directory files', 'SQL CDC event streams'],
    upstream: ['src-sap', 'src-mes', 'src-wms', 'src-qms', 'src-rfq', 'src-excel'],
    processing: [
      'Decrypts and parses incoming payloads',
      'Enforces connection pool throttling and retry backoff',
      'Logs transaction receipts with run execution IDs'
    ],
    outputPayload: ['unparsed_batch_records', 'ingestion_telemetry_stream'],
    downstream: ['ing-schema', 'ing-reconcile'],
    frontendPages: [
      { name: 'Connected Databases', path: '/connectors' },
      { name: 'Data Import and Quality', path: '/uploads' }
    ],
    latency: '14ms',
    lastSync: 'Run #41 (31-Oct-2026)',
    liveMetric: '100% connector uptime',
    accentColor: '#059669',
    badgeBg: '#D1FAE5'
  },
  'ing-schema': {
    id: 'ing-schema',
    name: 'Schema & Data Validation Engine',
    shortName: 'Schema & Data Validation',
    layer: 'ingestion',
    icon: '🛡️',
    status: 'Active',
    statusColor: '#059669',
    purpose: '5-tier schema verification enforcing strict data types, required foreign keys, non-null constraints, and date validity.',
    inputData: ['Ingested raw batches', 'Canonical schema definition models'],
    upstream: ['ing-connectors'],
    processing: [
      'Pydantic schema type enforcement and constraint evaluation',
      'Foreign key referential integrity checks (Material Code -> Master SKU)',
      'Dates standardization to ISO 8601 UTC'
    ],
    outputPayload: ['schema_verified_records', 'validation_error_log'],
    downstream: ['ing-duplicate', 'ing-uom'],
    frontendPages: [
      { name: 'Data Import and Quality', path: '/uploads' }
    ],
    latency: '6ms',
    lastSync: 'Run #41',
    liveMetric: '0 schema mismatch errors',
    accentColor: '#059669',
    badgeBg: '#D1FAE5'
  },
  'ing-duplicate': {
    id: 'ing-duplicate',
    name: 'Duplicate & Conflict Detection',
    shortName: 'Duplicate Detection',
    layer: 'ingestion',
    icon: '🔍',
    status: 'Active',
    statusColor: '#059669',
    purpose: 'Identifies conflicting double-booked transactions, duplicate PO receipts, and simultaneous bin allocation collisions.',
    inputData: ['Schema-verified records', 'Historical transaction ledgers'],
    upstream: ['ing-schema'],
    processing: [
      'Deduplicates simultaneous receipt postings across dock shifts',
      'Resolves last-write-wins timestamps on lot movement logs',
      'Flags duplicate SKU definitions across plant master lists'
    ],
    outputPayload: ['deduplicated_dataset'],
    downstream: ['ing-uom'],
    frontendPages: [
      { name: 'Data Import and Quality', path: '/uploads' }
    ],
    latency: '11ms',
    lastSync: 'Run #41',
    liveMetric: '4 duplicates purged',
    accentColor: '#059669',
    badgeBg: '#D1FAE5'
  },
  'ing-uom': {
    id: 'ing-uom',
    name: 'Unit of Measure (UOM) Normalization',
    shortName: 'UOM Normalization',
    layer: 'ingestion',
    icon: '⚖️',
    status: 'Active',
    statusColor: '#059669',
    purpose: 'Normalizes disparate physical units across suppliers and shop floor (e.g. reels to units, grams to kg, meters to rolls).',
    inputData: ['Raw unit strings (KG, EA, REEL, MTR, BOX)', 'SKU conversion factor table'],
    upstream: ['ing-duplicate'],
    processing: [
      'Converts Reel quantities to Individual Eaches for SMD chips',
      'Normalizes solder paste weight to standardized KG units',
      'Applies packaging rounding multipliers'
    ],
    outputPayload: ['uom_standardized_records'],
    downstream: ['ing-reconcile'],
    frontendPages: [
      { name: 'Material Details', path: '/material' }
    ],
    latency: '4ms',
    lastSync: 'Run #41',
    liveMetric: '100% UOM aligned (EA/KG)',
    accentColor: '#059669',
    badgeBg: '#D1FAE5'
  },
  'ing-reconcile': {
    id: 'ing-reconcile',
    name: 'Data Reconciliation (AGT-01)',
    shortName: 'Data Reconciliation',
    layer: 'ingestion',
    icon: '🔄',
    status: 'Active',
    statusColor: '#059669',
    purpose: 'Autonomous reconciliation agent detecting negative balances, phantom stockouts, and ledger variances between ERP and WMS.',
    inputData: ['ERP stock ledger', 'WMS physical bin scan balances', 'Plant BOM tree'],
    upstream: ['ing-uom', 'src-wms', 'src-sap'],
    processing: [
      'Cross-checks ERP balances against physical WMS inventory records',
      'Eliminates ghost stock in decommissioned storage bins',
      'Generates 5-tier reconciliation health score'
    ],
    outputPayload: ['6,624 validated clean stock records', 'reconciliation_audit_report'],
    downstream: ['db-inventory', 'agt-02'],
    frontendPages: [
      { name: 'Agent Hub & Pipeline', path: '/agents' },
      { name: 'Data Import and Quality', path: '/uploads' }
    ],
    latency: '24ms',
    lastSync: 'Run #41',
    liveMetric: '6,624 clean records · ₹36.80 Cr',
    accentColor: '#059669',
    badgeBg: '#D1FAE5'
  },
  'ing-qc': {
    id: 'ing-qc',
    name: 'Incoming QC & Lot Gate (AGT-08)',
    shortName: 'QC / Lot Validation',
    layer: 'ingestion',
    icon: '📋',
    status: 'Active',
    statusColor: '#059669',
    purpose: 'Quarantine gatekeeper validating inspection release certificates before newly arrived inventory is marked as usable stock.',
    inputData: ['Dock receipts (1,302 orders)', 'Inspection defect logs', 'Certificate of Analysis'],
    upstream: ['src-qms', 'src-wms'],
    processing: [
      'Isolates 103 quarantined lots (valued at ₹21.80L) from production allocation',
      'Releases 1,287 lots that passed 100% inspection into usable bin stock',
      'Routes 97 rework lots to offline touch-up and marks 82 scrap lots'
    ],
    outputPayload: ['1,287 released usable warehouse lots', 'quarantine_hold_register'],
    downstream: ['db-qc', 'agt-02'],
    frontendPages: [
      { name: 'Quality Hold and Rejects', path: '/quality' },
      { name: 'Goods Receiving', path: '/receiving' }
    ],
    latency: '19ms',
    lastSync: 'Run #41',
    liveMetric: '103 on hold · 1,287 released',
    accentColor: '#059669',
    badgeBg: '#D1FAE5'
  },

  // Layer 3: Application Data Layer
  'db-master': {
    id: 'db-master',
    name: 'Master Data Store',
    shortName: 'Master Data',
    layer: 'datalayer',
    icon: '🗄️',
    status: 'Available',
    statusColor: '#7C3AED',
    purpose: 'Authoritative database records for Materials, Categories, Plants (IN-KA-01, IN-TN-01), Storage Locations, and Suppliers.',
    inputData: ['dim_material', 'dim_supplier', 'dim_plant', 'dim_warehouse'],
    upstream: ['ing-reconcile', 'src-sap'],
    processing: [
      'Maintains primary keys and SKU attributes (ABC Velocity, Unit Costs)',
      'Stores plant manufacturing capabilities and warehouse capacities',
      'Indexes vendor contracts, minimum order quantities, and delivery lead times'
    ],
    outputPayload: ['relational_entity_graph', 'cached_dimension_tables'],
    downstream: ['agt-02', 'agt-03', 'agt-04', 'agt-05'],
    frontendPages: [
      { name: 'Material Details', path: '/material' },
      { name: 'Stock on Hand', path: '/stock' }
    ],
    latency: '3ms',
    lastSync: 'PostgreSQL Relational Storage',
    liveMetric: '30 SKUs · 42 Suppliers',
    accentColor: '#7C3AED',
    badgeBg: '#EDE9FE'
  },
  'db-inventory': {
    id: 'db-inventory',
    name: 'Inventory Balances & Movements',
    shortName: 'Inventory & Movements',
    layer: 'datalayer',
    icon: '📊',
    status: 'Available',
    statusColor: '#7C3AED',
    purpose: 'Real-time transactional ledger tracking on-hand stock, reserved WIP, safety stock thresholds, and stock transfers.',
    inputData: ['fact_stock_level', 'fact_inventory_movement', 'fact_cycle_count'],
    upstream: ['ing-reconcile', 'src-wms'],
    processing: [
      'Calculates usable stock = on_hand - reserved - quarantine',
      'Maintains safety buffer targets (30-day min buffer)',
      'Records continuous audit logs of bin-to-bin transfers'
    ],
    outputPayload: ['usable_stock_snapshots', 'inventory_movement_history'],
    downstream: ['agt-02', 'agt-03', 'agt-09'],
    frontendPages: [
      { name: 'Stock on Hand', path: '/stock' },
      { name: 'Inventory Health Dashboard', path: '/overview' }
    ],
    latency: '4ms',
    lastSync: 'PostgreSQL / In-Memory Index',
    liveMetric: '₹36.80 Cr Active Stock',
    accentColor: '#7C3AED',
    badgeBg: '#EDE9FE'
  },
  'db-bom': {
    id: 'db-bom',
    name: 'BOM & Production Plans',
    shortName: 'BOM & Production Plans',
    layer: 'datalayer',
    icon: '🧩',
    status: 'Available',
    statusColor: '#7C3AED',
    purpose: 'Multi-level hierarchical BOM relationships (Aster 15, Aster 15 Pro) and scheduled production run targets.',
    inputData: ['dim_bom', 'fact_production_plan', 'fact_customer_order'],
    upstream: ['src-sap', 'src-mes'],
    processing: [
      'Stores parent-to-child component ratios and scrap allowance percentages',
      'Indexes planned production runs across Bengaluru & Chennai plants',
      'Links finished goods demand to component consumption schedules'
    ],
    outputPayload: ['exploded_bom_hierarchy', 'planned_build_schedule'],
    downstream: ['agt-04', 'agt-03'],
    frontendPages: [
      { name: 'Build Capacity Calculator', path: '/capacity' },
      { name: 'Shortage Forecast', path: '/shortages' }
    ],
    latency: '5ms',
    lastSync: 'PostgreSQL Tables',
    liveMetric: '16 components / finished device',
    accentColor: '#7C3AED',
    badgeBg: '#EDE9FE'
  },
  'db-supplier': {
    id: 'db-supplier',
    name: 'Supplier & PO History',
    shortName: 'Supplier & PO History',
    layer: 'datalayer',
    icon: '📜',
    status: 'Available',
    statusColor: '#7C3AED',
    purpose: 'Historical purchase orders, supplier fulfillment logs, lead time deviations, and contracted pricing brackets.',
    inputData: ['fact_purchase_order', 'fact_supplier_delay_log'],
    upstream: ['src-sap', 'src-rfq'],
    processing: [
      'Calculates supplier On-Time In-Full (OTIF) scorecards',
      'Maintains lead-time variance distributions for ML disruption simulations',
      'Tracks open PO lines awaiting delivery'
    ],
    outputPayload: ['supplier_historical_performance', 'open_po_commitments'],
    downstream: ['agt-07', 'agt-05'],
    frontendPages: [
      { name: 'Supplier Delay Simulator', path: '/simulation' },
      { name: 'Purchase Order Approvals', path: '/proposals' }
    ],
    latency: '4ms',
    lastSync: 'PostgreSQL Relational Ledger',
    liveMetric: '1,302 PO lines · 37.8% OTIF',
    accentColor: '#7C3AED',
    badgeBg: '#EDE9FE'
  },
  'db-qc': {
    id: 'db-qc',
    name: 'QC & Lot Inspection Records',
    shortName: 'QC & Lot Records',
    layer: 'datalayer',
    icon: '🏷️',
    status: 'Available',
    statusColor: '#7C3AED',
    purpose: 'Complete genealogy of warehouse lots, inspection test pass/fail outcomes, quarantine durations, and scrap dispositions.',
    inputData: ['fact_quality_inspection', 'fact_lot_trace'],
    upstream: ['ing-qc', 'src-qms'],
    processing: [
      'Maintains lot traceability from dock receiving to assembly line',
      'Tracks warranty and vendor RMA returns for defect Pareto analysis',
      'Records formal QA inspector digital sign-off events'
    ],
    outputPayload: ['lot_traceability_graph', 'defect_pareto_distribution'],
    downstream: ['agt-08', 'agt-02'],
    frontendPages: [
      { name: 'Quality Hold and Rejects', path: '/quality' },
      { name: 'Batch Traceability', path: '/traceability' }
    ],
    latency: '3ms',
    lastSync: 'PostgreSQL Relational Store',
    liveMetric: '103 lots held · 96.46% yield',
    accentColor: '#7C3AED',
    badgeBg: '#EDE9FE'
  },
  'db-audit': {
    id: 'db-audit',
    name: 'Agent Execution & Audit Logs',
    shortName: 'Agent Results & Audit Logs',
    layer: 'datalayer',
    icon: '📝',
    status: 'Available',
    statusColor: '#7C3AED',
    purpose: 'Persistent ledger of every autonomous agent decision, MCP tool invocation trace, proposal state transition, and user action.',
    inputData: ['agent_mesh_run_events', 'user_approval_audit_trail', 'mcp_tool_execution_logs'],
    upstream: ['agt-10', 'gov-actions'],
    processing: [
      'Cryptographically verifies approval state transitions',
      'Stores deterministic mathematical proofs for all agent recommendations',
      'Maintains chronological pipeline run history (Run #01 through Run #41)'
    ],
    outputPayload: ['audit_history_records', 'compliance_verification_trace'],
    downstream: ['agt-10', 'out-audit'],
    frontendPages: [
      { name: 'AI Agent Activity Log', path: '/agent/runs' },
      { name: 'Agent Hub & Pipeline', path: '/agents' }
    ],
    latency: '2ms',
    lastSync: 'PostgreSQL Append-Only Log',
    liveMetric: 'Run #41 Completed',
    accentColor: '#7C3AED',
    badgeBg: '#EDE9FE'
  },

  // Layer 4: Backend Processing & AI Agent Layer
  'agt-10': {
    id: 'agt-10',
    name: 'AGT-10: Central Orchestrator & Copilot',
    shortName: 'AGT-10 · Orchestrator',
    layer: 'agents',
    icon: '🧠',
    status: 'Active',
    statusColor: '#6D28D9',
    purpose: 'Central multi-agent coordinator that receives user prompts, decomposes complex operational requests, queries specialist agents via MCP tools, and synthesizes unified answers.',
    inputData: ['User inquiries via /agent', 'Unified pipeline trigger commands', 'Outputs from AGT-01 through AGT-09'],
    upstream: ['agt-01', 'agt-02', 'agt-03', 'agt-04', 'agt-05', 'agt-07', 'agt-08', 'agt-09'],
    processing: [
      'Deconstructs management queries into sub-tasks',
      'Orchestrates sequential and parallel MCP agent tool executions',
      'Enforces 100% arithmetic grounding and validates citations before outputting',
      'Generates executive decision dossiers for one-click release'
    ],
    outputPayload: ['Unified managerial briefings', 'Approved pipeline execution states', 'Natural language agent responses'],
    downstream: ['out-approvals', 'out-audit', 'page-agent'],
    frontendPages: [
      { name: 'Ask the Inventory Agent', path: '/agent' },
      { name: 'Agent Hub & Pipeline', path: '/agents' },
      { name: 'Daily Inventory Report', path: '/brief' }
    ],
    latency: '110ms',
    lastSync: 'Continuous Mesh Active',
    liveMetric: '15 MCP Tools Registered',
    accentColor: '#6D28D9',
    badgeBg: '#EDE9FE'
  },
  'agt-01': {
    id: 'agt-01',
    name: 'AGT-01: Data Reconciliation Agent',
    shortName: 'AGT-01 · Data Reconciler',
    layer: 'agents',
    icon: '🧹',
    status: 'Active',
    statusColor: '#0284C7',
    purpose: 'Runs automated 5-tier reconciliation audits across ERP, MES, and WMS raw tables to eliminate phantom stockouts and synchronize lot balances.',
    inputData: ['Raw ERP POs & stock balances', 'WMS bin coordinate records', 'Physical cycle counts'],
    upstream: ['db-master', 'db-inventory'],
    processing: [
      'Eliminates zero-stock phantom records',
      'Resolves warehouse-to-ledger mismatches',
      'Passes 100% verified clean stock positions to AGT-02'
    ],
    outputPayload: ['6,624 clean stock records', 'reconciliation_variance_log'],
    downstream: ['agt-02'],
    frontendPages: [
      { name: 'Agent Hub & Pipeline', path: '/agents' },
      { name: 'Data Import and Quality', path: '/uploads' }
    ],
    latency: '35ms',
    lastSync: 'Run #41',
    liveMetric: '6,624 records verified',
    accentColor: '#0284C7',
    badgeBg: '#E0F2FE'
  },
  'agt-02': {
    id: 'agt-02',
    name: 'AGT-02: Stock Monitoring Agent',
    shortName: 'AGT-02 · Stock Monitor',
    layer: 'agents',
    icon: '📡',
    status: 'Running',
    statusColor: '#059669',
    purpose: 'Continuous surveillance of physical inventory, usable stock, and safety buffers across Bengaluru (IN-KA-01) and Chennai (IN-TN-01) facilities.',
    inputData: ['Clean stock dataset from AGT-01', 'Released lots from AGT-08', 'Configured safety stock policies'],
    upstream: ['agt-01', 'agt-08', 'db-inventory'],
    processing: [
      'Calculates usable stock excluding quarantine holds',
      'Compares active balances against safety buffer limits',
      'Flags low-stock SKUs and automatically triggers AGT-03 forecasting'
    ],
    outputPayload: ['Verified stock position', 'Low-stock item alerts'],
    downstream: ['agt-03', 'agt-04'],
    frontendPages: [
      { name: 'Stock on Hand', path: '/stock' },
      { name: 'Inventory Health Dashboard', path: '/overview' }
    ],
    latency: '22ms',
    lastSync: 'Continuous (Run #41)',
    liveMetric: '₹36.80 Cr Active Stock',
    accentColor: '#059669',
    badgeBg: '#D1FAE5'
  },
  'agt-03': {
    id: 'agt-03',
    name: 'AGT-03: Shortage Forecast Agent',
    shortName: 'AGT-03 · Shortage Forecast',
    layer: 'agents',
    icon: '📉',
    status: 'Active',
    statusColor: '#D97706',
    purpose: 'Projects non-linear 30, 60, and 90-day material demand curves; calculates projected stock-out dates for critical components before assembly lines halt.',
    inputData: ['Usable stock positions from AGT-02', 'Customer delivery commitments', 'Historical consumption velocity'],
    upstream: ['agt-02', 'db-bom'],
    processing: [
      'Calculates daily run-rate burn trajectory',
      'Pinpoints exact line-stoppage stockout dates (e.g. MAT-PCB-004 on Day 18)',
      'Assigns component criticality rankings (A/B/C velocity)'
    ],
    outputPayload: ['Forecasted requirement', 'Critical stockout dates'],
    downstream: ['agt-04'],
    frontendPages: [
      { name: 'Shortage Forecast', path: '/shortages' },
      { name: 'Material Details', path: '/material' }
    ],
    latency: '48ms',
    lastSync: 'Run #41',
    liveMetric: '8 parts critical in 7 days',
    accentColor: '#D97706',
    badgeBg: '#FEF3C7'
  },
  'agt-04': {
    id: 'agt-04',
    name: 'AGT-04: Build Capacity & BOM Twin Agent',
    shortName: 'AGT-04 · BOM Twin & Cap.',
    layer: 'agents',
    icon: '⚙️',
    status: 'Active',
    statusColor: '#B45309',
    purpose: 'Deterministic BOM twin exploder: maps multi-level components to finished smartphones (Aster 15, Aster 15 Pro) and calculates maximum assembly capacity before lines halt.',
    inputData: ['Verified stock position from AGT-02 & AGT-08', 'Stockout dates from AGT-03', '16-component BOM definition'],
    upstream: ['agt-02', 'agt-03', 'agt-08', 'db-bom'],
    processing: [
      'Performs deterministic BOM explosion per finished SKU',
      'Identifies limiting bottleneck component (Aster 15 capped at 850 units due to PCB bottleneck)',
      'Calculates net component shortage quantities (1,150 units needed to hit 2,000 target)'
    ],
    outputPayload: ['Plan & requirement', 'Finished device assembly ceiling', 'Net shortage shortfall'],
    downstream: ['agt-05', 'agt-07'],
    frontendPages: [
      { name: 'Build Capacity Calculator', path: '/capacity' },
      { name: 'Shelf and Location Map', path: '/digital-twin' }
    ],
    latency: '38ms',
    lastSync: 'Run #41',
    liveMetric: 'Aster 15 capped at 850 units',
    accentColor: '#B45309',
    badgeBg: '#FEF3C7'
  },
  'agt-05': {
    id: 'agt-05',
    name: 'AGT-05: Replenishment & Proposals Agent',
    shortName: 'AGT-05 · Replenishment',
    layer: 'agents',
    icon: '🛒',
    status: 'Active',
    statusColor: '#7C3AED',
    purpose: 'Generates automated Purchase Order drafts and inter-plant transfer proposals using supplier MOQ rounding, reorder points, and lead-time safety buffers.',
    inputData: ['Net shortfall gaps from AGT-04', 'Supplier MOQs and pricing tiers', 'Plant reorder points'],
    upstream: ['agt-04', 'db-supplier'],
    processing: [
      'Applies supplier Minimum Order Quantity (MOQ) rounding (e.g. 1,150 deficit rounded to 2,000 MOQ)',
      'Calculates total estimated procurement cost and payment terms',
      'Drafts formal PO proposal (PO-2026-0038) with digital approval routing'
    ],
    outputPayload: ['Purchase / transfer proposals', 'Draft PO-2026-0038'],
    downstream: ['agt-07', 'agt-10'],
    frontendPages: [
      { name: 'Purchase Order Approvals', path: '/proposals' },
      { name: 'PO Review & Digital Sign-off', path: '/procurement' }
    ],
    latency: '52ms',
    lastSync: 'Run #41',
    liveMetric: 'Drafted PO-2026-0038 (₹13.60L)',
    accentColor: '#7C3AED',
    badgeBg: '#EDE9FE'
  },
  'agt-07': {
    id: 'agt-07',
    name: 'AGT-07: Supplier Delay & ML Predictor Agent',
    shortName: 'AGT-07 · Supplier Delay ML',
    layer: 'agents',
    icon: '⚡',
    status: 'Active',
    statusColor: '#C026D3',
    purpose: 'Random Forest ML-powered lead time disruption simulator: predicts supplier delivery delays, evaluates stockout risks, and stress-tests whether proposals absorb delays with 0 line halts.',
    inputData: ['Plan & requirement from AGT-04', 'PO proposals from AGT-05', 'Historical vendor lead-time delay distributions'],
    upstream: ['agt-04', 'agt-05', 'db-supplier'],
    processing: [
      'Simulates supplier lead time disruptions (+7-day vendor delay)',
      'Stress-tests safety stock buffer resilience',
      'Confirms factory line halts remain at 0 with proposed PO delivery'
    ],
    outputPayload: ['Supplier risk & supply plan', 'Lead time disruption simulation score'],
    downstream: ['agt-09', 'agt-10'],
    frontendPages: [
      { name: 'Supplier Delay Simulator', path: '/simulation' },
      { name: 'Purchase Order Approvals', path: '/proposals' }
    ],
    latency: '64ms',
    lastSync: 'Run #41',
    liveMetric: '+7 days delay absorbed (0 halts)',
    accentColor: '#C026D3',
    badgeBg: '#FAE8FF'
  },
  'agt-08': {
    id: 'agt-08',
    name: 'AGT-08: Incoming QC & Lot Acceptance Agent',
    shortName: 'AGT-08 · Incoming QC Gate',
    layer: 'agents',
    icon: '✅',
    status: 'Active',
    statusColor: '#10B981',
    purpose: 'Dock receiving gatekeeper: audits inspection certificates, triggers quarantine holds, and routes rework vs scrap to guarantee only 100% compliant parts reach production.',
    inputData: ['Dock inbound receipts from 1,302 PO orders', 'QA inspection defect logs', 'Certificate of Analysis'],
    upstream: ['src-qms', 'src-wms'],
    processing: [
      'Enforces quarantine hold on 103 defect lots (₹21.80L)',
      'Releases 1,287 certified lots into usable bin stock',
      'Updates AGT-02 with usable stock numbers'
    ],
    outputPayload: ['Usable receipts (QC released)', 'Quarantine hold list'],
    downstream: ['agt-02', 'agt-04'],
    frontendPages: [
      { name: 'Quality Hold and Rejects', path: '/quality' },
      { name: 'Goods Receiving', path: '/receiving' }
    ],
    latency: '26ms',
    lastSync: 'Run #41',
    liveMetric: '1,287 released · 103 held',
    accentColor: '#10B981',
    badgeBg: '#DCFCE7'
  },
  'agt-09': {
    id: 'agt-09',
    name: 'AGT-09: Excess & Obsolete (E&O) Inventory Agent',
    shortName: 'AGT-09 · Excess & Obsolete',
    layer: 'agents',
    icon: '♻️',
    status: 'Active',
    statusColor: '#0D9488',
    purpose: 'Identifies non-moving and aged SKUs (>90 days without consumption), calculates carrying cost liabilities, and recommends redistribution, supplier return, or write-down actions.',
    inputData: ['Inventory aging data from db-inventory', 'Historical consumption velocity', 'Supplier return-to-vendor policies'],
    upstream: ['agt-07', 'db-inventory'],
    processing: [
      'Calculates excess holding cost drag (₹4.20 Cr excess identified)',
      'Recommends inter-plant stock transfer from IN-TN-01 to IN-KA-01',
      'Balances working capital vs stockout risk'
    ],
    outputPayload: ['E&O redistribution recommendations', 'Carrying cost reduction plan'],
    downstream: ['agt-10'],
    frontendPages: [
      { name: 'Dead and Slow-Moving Stock', path: '/dead-stock' },
      { name: 'Inventory Health Dashboard', path: '/overview' }
    ],
    latency: '41ms',
    lastSync: 'Run #41',
    liveMetric: '₹4.20 Cr excess flagged',
    accentColor: '#0D9488',
    badgeBg: '#CCFBF1'
  },

  // Layer 5: Output & Workflow Layer
  'out-shortage': {
    id: 'out-shortage',
    name: 'Shortage & Depletion Projections',
    shortName: 'Shortage & Depletion Results',
    layer: 'outputs',
    icon: '📉',
    status: 'Available',
    statusColor: '#EA580C',
    purpose: 'Grounded predictions of component stockout milestones, days of supply remaining, and line shutdown risk metrics.',
    inputData: ['Outputs from AGT-03 and AGT-02'],
    upstream: ['agt-03', 'agt-02'],
    processing: ['Ranks 30 critical components by stockout date', 'Generates 30/60/90-day depletion curve vectors'],
    outputPayload: ['critical_shortage_list', 'run_rate_forecast_json'],
    downstream: ['page-shortages', 'page-overview'],
    frontendPages: [
      { name: 'Shortage Forecast', path: '/shortages' },
      { name: 'Material Details', path: '/material' },
      { name: 'Inventory Health Dashboard', path: '/overview' }
    ],
    latency: '4ms',
    lastSync: 'Run #41',
    liveMetric: '8 parts critical in 7 days',
    accentColor: '#EA580C',
    badgeBg: '#FFEDD5'
  },
  'out-capacity': {
    id: 'out-capacity',
    name: 'Capacity & Build Limit Calculations',
    shortName: 'Capacity & Build Plan',
    layer: 'outputs',
    icon: '🏭',
    status: 'Available',
    statusColor: '#B45309',
    purpose: 'Finished goods assembly ceiling calculations identifying limiting components and production fulfillment percentages.',
    inputData: ['Outputs from AGT-04 and db-bom'],
    upstream: ['agt-04'],
    processing: ['Computes max build count per finished device', 'Generates sensitivity analysis sliders'],
    outputPayload: ['build_capacity_ceiling_json', 'bottleneck_component_breakdown'],
    downstream: ['page-capacity', 'page-digital-twin'],
    frontendPages: [
      { name: 'Build Capacity Calculator', path: '/capacity' },
      { name: 'Shelf and Location Map', path: '/digital-twin' }
    ],
    latency: '5ms',
    lastSync: 'Run #41',
    liveMetric: 'Aster 15 limit: 850 units',
    accentColor: '#B45309',
    badgeBg: '#FEF3C7'
  },
  'out-proposals': {
    id: 'out-proposals',
    name: 'PO & Inter-Plant Transfer Proposals',
    shortName: 'PO & Transfer Proposals',
    layer: 'outputs',
    icon: '📑',
    status: 'Available',
    statusColor: '#7C3AED',
    purpose: 'Automated procurement and stock transfer proposals ready for procurement officer review and tiered managerial approval.',
    inputData: ['Outputs from AGT-05 and AGT-07'],
    upstream: ['agt-05', 'agt-07'],
    processing: ['Validates supplier MOQs and pricing', 'Determines approval threshold levels (<₹5L, <₹25L, >₹25L)'],
    outputPayload: ['draft_po_proposals_json', 'transfer_requisitions'],
    downstream: ['page-proposals', 'page-procurement', 'gov-actions'],
    frontendPages: [
      { name: 'Purchase Order Approvals', path: '/proposals' },
      { name: 'PO Review & Digital Sign-off', path: '/procurement' }
    ],
    latency: '6ms',
    lastSync: 'Run #41',
    liveMetric: '12 active proposals · ₹84.20L',
    accentColor: '#7C3AED',
    badgeBg: '#EDE9FE'
  },
  'out-supplier': {
    id: 'out-supplier',
    name: 'Supplier Disruption & Risk Scores',
    shortName: 'Supplier Risk & Delay',
    layer: 'outputs',
    icon: '⚡',
    status: 'Available',
    statusColor: '#C026D3',
    purpose: 'ML lead time disruption scores and safety stock buffer stress-test simulations across all contracted vendors.',
    inputData: ['Outputs from AGT-07 and db-supplier'],
    upstream: ['agt-07'],
    processing: ['Generates interactive Monte Carlo delay curves', 'Predicts production line halt probability'],
    outputPayload: ['supplier_risk_matrix', 'lead_time_simulation_results'],
    downstream: ['page-simulation'],
    frontendPages: [
      { name: 'Supplier Delay Simulator', path: '/simulation' }
    ],
    latency: '8ms',
    lastSync: 'Run #41',
    liveMetric: '37.8% OTIF · 42 vendors',
    accentColor: '#C026D3',
    badgeBg: '#FAE8FF'
  },
  'out-excess': {
    id: 'out-excess',
    name: 'Excess & Obsolete Inventory Alerts',
    shortName: 'Excess & Obsolete Alerts',
    layer: 'outputs',
    icon: '⚠️',
    status: 'Available',
    statusColor: '#0D9488',
    purpose: 'Categorized E&O reports highlighting capital locked in slow-moving stock and actionable disposition recommendations.',
    inputData: ['Outputs from AGT-09 and db-inventory'],
    upstream: ['agt-09'],
    processing: ['Classifies inventory into Aging brackets (>90d, >180d, >365d)', 'Calculates scrap write-down impact'],
    outputPayload: ['dead_stock_catalog', 'redistribution_recommendations'],
    downstream: ['page-dead-stock'],
    frontendPages: [
      { name: 'Dead and Slow-Moving Stock', path: '/dead-stock' },
      { name: 'Inventory Health Dashboard', path: '/overview' }
    ],
    latency: '6ms',
    lastSync: 'Run #41',
    liveMetric: '₹4.20 Cr excess capital',
    accentColor: '#0D9488',
    badgeBg: '#CCFBF1'
  },
  'out-approvals': {
    id: 'out-approvals',
    name: 'Approval Workflows & Digital Sign-off',
    shortName: 'Approval Workflows',
    layer: 'outputs',
    icon: '✍️',
    status: 'Available',
    statusColor: '#059669',
    purpose: 'Multi-tiered governance workflows requiring Procurement Officer, Warehouse Manager, and VP approval for purchase release.',
    inputData: ['Outputs from AGT-05, AGT-10, and user actions'],
    upstream: ['agt-05', 'agt-10', 'gov-actions'],
    processing: ['Enforces role-based permission matrix', 'Captures digital signature hashes with timestamp'],
    outputPayload: ['approved_po_releases', 'signed_procurement_contracts'],
    downstream: ['gov-actions', 'db-audit', 'src-sap'],
    frontendPages: [
      { name: 'PO Review & Digital Sign-off', path: '/procurement' },
      { name: 'Purchase Order Approvals', path: '/proposals' }
    ],
    latency: '12ms',
    lastSync: 'Run #41',
    liveMetric: 'Tiered 3-level governance',
    accentColor: '#059669',
    badgeBg: '#D1FAE5'
  },
  'out-audit': {
    id: 'out-audit',
    name: 'Audit Trail & Compliance Log',
    shortName: 'Notifications & Audit Trail',
    layer: 'outputs',
    icon: '📜',
    status: 'Available',
    statusColor: '#4F46E5',
    purpose: 'Chronological timeline of all pipeline runs, agent tool calls, approval decisions, and inventory balance adjustments.',
    inputData: ['Outputs from db-audit and all agents'],
    upstream: ['db-audit', 'agt-10'],
    processing: ['Streams real-time event logs to UI', 'Maintains immutable audit records for regulatory compliance'],
    outputPayload: ['audit_event_feed', 'compliance_verification_tokens'],
    downstream: ['page-activity', 'page-agents'],
    frontendPages: [
      { name: 'AI Agent Activity Log', path: '/agent/runs' },
      { name: 'Daily Inventory Report', path: '/brief' }
    ],
    latency: '3ms',
    lastSync: 'Run #41 Completed',
    liveMetric: '41 logged mesh runs',
    accentColor: '#4F46E5',
    badgeBg: '#EEF2FF'
  },

  // Layer 6: Frontend Pages (Key sample mapped)
  'page-overview': {
    id: 'page-overview',
    name: 'Inventory Health Dashboard',
    shortName: 'Health Dashboard',
    layer: 'pages',
    icon: '📊',
    status: 'Available',
    statusColor: '#6366F1',
    purpose: 'Executive control tower displaying aggregate stock valuation (₹36.80 Cr), usable percentage, critical stockout alerts, and plant benchmarks.',
    inputData: ['db-inventory', 'out-shortage', 'out-excess'],
    upstream: ['out-shortage', 'out-excess', 'agt-02'],
    processing: ['Aggregates plant-wide KPIs', 'Renders interactive risk distribution charts'],
    outputPayload: ['Executive visual briefing', 'Plant filter controls'],
    downstream: ['gov-actions'],
    frontendPages: [{ name: 'Inventory Health Dashboard', path: '/overview' }],
    accentColor: '#6366F1',
    badgeBg: '#EEF2FF'
  },
  'page-stock': {
    id: 'page-stock',
    name: 'Stock on Hand Explorer',
    shortName: 'Stock on Hand',
    layer: 'pages',
    icon: '📦',
    status: 'Available',
    statusColor: '#6366F1',
    purpose: 'Granular SKU-by-SKU inventory explorer with real-time warehouse location filtering, batch breakdown, and safety stock variance.',
    inputData: ['db-inventory', 'db-master', 'agt-02'],
    upstream: ['agt-02', 'db-inventory'],
    processing: ['Real-time search across 6,624 inventory records', 'Multi-attribute filtering by Plant, Category, Status'],
    outputPayload: ['Interactive SKU table', 'Batch allocation view'],
    downstream: ['gov-actions'],
    frontendPages: [{ name: 'Stock on Hand', path: '/stock' }],
    accentColor: '#6366F1',
    badgeBg: '#EEF2FF'
  },
  'page-shortages': {
    id: 'page-shortages',
    name: 'Shortage Forecast & Depletion',
    shortName: 'Shortage Forecast',
    layer: 'pages',
    icon: '📉',
    status: 'Available',
    statusColor: '#6366F1',
    purpose: 'Detailed 30, 60, and 90-day depletion timeline tracking critical line-stoppage dates, daily consumption velocity, and buffer coverage.',
    inputData: ['out-shortage', 'agt-03'],
    upstream: ['out-shortage', 'agt-03'],
    processing: ['Plots non-linear stock depletion trajectories', 'Highlights zero-stock critical dates (e.g. Day 18)'],
    outputPayload: ['Interactive shortage curves', 'Component risk ranking'],
    downstream: ['gov-actions'],
    frontendPages: [{ name: 'Shortage Forecast', path: '/shortages' }],
    accentColor: '#6366F1',
    badgeBg: '#EEF2FF'
  },
  'page-capacity': {
    id: 'page-capacity',
    name: 'Build Capacity Calculator',
    shortName: 'Build Capacity Calculator',
    layer: 'pages',
    icon: '⚙️',
    status: 'Available',
    statusColor: '#6366F1',
    purpose: 'Interactive BOM twin calculator: shows maximum finished smartphones assembleable with current stock and identifies bottleneck components.',
    inputData: ['out-capacity', 'agt-04'],
    upstream: ['out-capacity', 'agt-04'],
    processing: ['Simulates what-if production builds', 'Calculates component shortfall required to hit custom build targets'],
    outputPayload: ['Build ceiling metrics', 'Component limiting analysis'],
    downstream: ['gov-actions'],
    frontendPages: [{ name: 'Build Capacity Calculator', path: '/capacity' }],
    accentColor: '#6366F1',
    badgeBg: '#EEF2FF'
  },
  'page-simulation': {
    id: 'page-simulation',
    name: 'Supplier Delay Simulator',
    shortName: 'Supplier Delay Simulator',
    layer: 'pages',
    icon: '⚡',
    status: 'Available',
    statusColor: '#6366F1',
    purpose: 'Interactive supplier lead-time simulator: stress-tests supply chains against +3 to +30 day delivery delays using Random Forest ML.',
    inputData: ['out-supplier', 'agt-07'],
    upstream: ['out-supplier', 'agt-07'],
    processing: ['Adjusts vendor delay sliders', 'Evaluates buffer resilience and potential production line halt days'],
    outputPayload: ['Disruption resilience report', 'Mitigation recommendations'],
    downstream: ['gov-actions'],
    frontendPages: [{ name: 'Supplier Delay Simulator', path: '/simulation' }],
    accentColor: '#6366F1',
    badgeBg: '#EEF2FF'
  },
  'page-proposals': {
    id: 'page-proposals',
    name: 'Purchase Order Approvals',
    shortName: 'Purchase Order Approvals',
    layer: 'pages',
    icon: '📑',
    status: 'Available',
    statusColor: '#6366F1',
    purpose: 'Procurement proposal command center: review automated PO drafts, examine supplier MOQ justifications, and approve or reject requisitions.',
    inputData: ['out-proposals', 'agt-05'],
    upstream: ['out-proposals', 'agt-05'],
    processing: ['Displays 12 active proposals', 'Handles one-click digital approval and budget authorization'],
    outputPayload: ['Approved purchase orders', 'PO status transitions'],
    downstream: ['gov-actions'],
    frontendPages: [{ name: 'Purchase Order Approvals', path: '/proposals' }],
    accentColor: '#6366F1',
    badgeBg: '#EEF2FF'
  },
  'page-quality': {
    id: 'page-quality',
    name: 'Quality Hold and Rejects',
    shortName: 'Quality Hold and Rejects',
    layer: 'pages',
    icon: '🔬',
    status: 'Available',
    statusColor: '#6366F1',
    purpose: 'Quarantined inventory valuation (₹21.80L), inspection defect log, rework routing (97 lots), and scrap disposal tracking (82 lots).',
    inputData: ['db-qc', 'agt-08'],
    upstream: ['db-qc', 'agt-08'],
    processing: ['Monitors First-Pass Yield (96.46%)', 'Routes lots to offline touch-up or supplier RMA return'],
    outputPayload: ['Quarantine release authorizations', 'Scrap write-offs'],
    downstream: ['gov-actions'],
    frontendPages: [{ name: 'Quality Hold and Rejects', path: '/quality' }],
    accentColor: '#6366F1',
    badgeBg: '#EEF2FF'
  },
  'page-dead-stock': {
    id: 'page-dead-stock',
    name: 'Dead and Slow-Moving Stock',
    shortName: 'Dead & Slow-Moving Stock',
    layer: 'pages',
    icon: '⚠️',
    status: 'Available',
    statusColor: '#6366F1',
    purpose: 'Inventory aging analytics: identifies aged materials (>90 days), calculates carrying costs, and executes inventory redistribution or disposal.',
    inputData: ['out-excess', 'agt-09'],
    upstream: ['out-excess', 'agt-09'],
    processing: ['Categorizes items by turnover velocity', 'Recommends inter-plant stock rebalancing transfers'],
    outputPayload: ['Stock transfer requisitions', 'E&O write-down requests'],
    downstream: ['gov-actions'],
    frontendPages: [{ name: 'Dead and Slow-Moving Stock', path: '/dead-stock' }],
    accentColor: '#6366F1',
    badgeBg: '#EEF2FF'
  },
  'page-agent': {
    id: 'page-agent',
    name: 'Ask the Inventory Agent (Chat & Copilot)',
    shortName: 'Ask the Inventory Agent',
    layer: 'pages',
    icon: '🤖',
    status: 'Available',
    statusColor: '#6D28D9',
    purpose: 'Natural language conversational interface powered by AGT-10 Central Orchestrator: ask any question about stock, shortages, suppliers, or POs.',
    inputData: ['agt-10', 'mcp_registered_tools'],
    upstream: ['agt-10'],
    processing: ['Streams grounded natural language responses', 'Executes live multi-agent tool calls in real-time'],
    outputPayload: ['Managerial answers', 'Direct link citations'],
    downstream: ['gov-actions'],
    frontendPages: [{ name: 'Ask the Inventory Agent', path: '/agent' }],
    accentColor: '#6D28D9',
    badgeBg: '#EDE9FE'
  },

  // Layer 7: User Governance Loop
  'gov-actions': {
    id: 'gov-actions',
    name: '7. User Interaction & Governance Loop',
    shortName: 'User Governance Loop',
    layer: 'governance',
    icon: '👥',
    status: 'Active',
    statusColor: '#6D28D9',
    purpose: 'Closed-loop enterprise governance: human stakeholders (Procurement, Warehouse, Managers, Admins) review agent recommendations, provide digital sign-offs, and trigger backend ERP/WMS mutations.',
    inputData: ['Proposal approvals', 'Receipt confirmations', 'Cycle recount adjustments', 'Digital signature tokens'],
    upstream: ['page-proposals', 'page-overview', 'page-quality', 'page-agent'],
    processing: [
      'Validates multi-tiered authorization thresholds',
      'Applies digital cryptographic signature',
      'Dispatches confirmed POs to SAP ERP and updates local PostgreSQL state',
      'Records audit trail in db-audit'
    ],
    outputPayload: ['Executed PO orders', 'Inventory balance updates', 'Signed audit certificates'],
    downstream: ['src-sap', 'src-wms', 'db-inventory', 'db-audit'],
    frontendPages: [
      { name: 'Purchase Order Approvals', path: '/proposals' },
      { name: 'PO Review & Digital Sign-off', path: '/procurement' },
      { name: 'Goods Receiving', path: '/receiving' },
      { name: 'Cycle Counts and Routines', path: '/cycle-counts' }
    ],
    latency: '15ms mutation',
    lastSync: 'Continuous Governance Loop',
    liveMetric: 'Human-in-the-Loop Sign-off',
    accentColor: '#6D28D9',
    badgeBg: '#EDE9FE'
  }
}

// All 22 Application Pages definition for the matrix view
export const ALL_APPLICATION_PAGES = [
  { name: 'Home: Inventory at a Glance', path: '/home', category: 'Monitor', agent: 'All Mesh', output: 'Complete System Control Tower', status: 'Active' },
  { name: 'Inventory Health Dashboard', path: '/overview', category: 'Monitor', agent: 'AGT-02 / AGT-09', output: 'Stock valuation & health score', status: 'Active' },
  { name: 'Stock on Hand', path: '/stock', category: 'Monitor', agent: 'AGT-02 (Stock)', output: 'Physical inventory by SKU & plant', status: 'Active' },
  { name: 'Material Details', path: '/material', category: 'Monitor', agent: 'AGT-01 / AGT-03', output: 'SKU 360 profile, velocity & UOM', status: 'Active' },
  { name: 'Shelf and Location Map', path: '/digital-twin', category: 'Monitor', agent: 'AGT-04 / WMS', output: '3D warehouse racks & bin coordinates', status: 'Active' },
  { name: 'Shortage Forecast', path: '/shortages', category: 'Plan', agent: 'AGT-03 (Shortage)', output: '30/60/90-day depletion curves & stockout dates', status: 'Active' },
  { name: 'Build Capacity Calculator', path: '/capacity', category: 'Plan', agent: 'AGT-04 (BOM Twin)', output: 'Finished phone assembly ceiling & bottlenecks', status: 'Active' },
  { name: 'Supplier Delay Simulator', path: '/simulation', category: 'Plan', agent: 'AGT-07 (Delay ML)', output: 'Lead time disruption simulation & ML risk', status: 'Active' },
  { name: 'Purchase Order Approvals', path: '/proposals', category: 'Act', agent: 'AGT-05 (Replenish)', output: 'MOQ-rounded purchase & transfer proposals', status: 'Active' },
  { name: 'PO Review & Digital Sign-off', path: '/procurement', category: 'Act', agent: 'AGT-05 / AGT-10', output: 'Multi-tiered managerial contract sign-off', status: 'Active' },
  { name: 'Dead and Slow-Moving Stock', path: '/dead-stock', category: 'Act', agent: 'AGT-09 (E&O)', output: 'Aged inventory (>90d) & write-down actions', status: 'Active' },
  { name: 'Quality Hold and Rejects', path: '/quality', category: 'Warehouse', agent: 'AGT-08 (QC Gate)', output: 'Quarantined lots valuation & rework routing', status: 'Active' },
  { name: 'Goods Receiving', path: '/receiving', category: 'Warehouse', agent: 'AGT-08 / WMS', output: 'Real-time dock PO receipt reconciliation', status: 'Active' },
  { name: 'Cycle Counts and Routines', path: '/cycle-counts', category: 'Warehouse', agent: 'AGT-01 (Reconcile)', output: 'ABC velocity blind audits & inventory accuracy', status: 'Active' },
  { name: 'Finished Goods and Dispatch', path: '/dispatch', category: 'Warehouse', agent: 'AGT-04 / MES', output: 'Box-build staging & customer shipping lots', status: 'Active' },
  { name: 'Batch Traceability', path: '/traceability', category: 'Warehouse', agent: 'AGT-08 / QMS', output: 'End-to-end lot genealogy & vendor tracking', status: 'Active' },
  { name: 'Daily Inventory Report', path: '/brief', category: 'Reports', agent: 'AGT-10 (Orchestrator)', output: 'Daily executive briefing & line halt summary', status: 'Active' },
  { name: 'Agent Hub & Pipeline', path: '/agents', category: 'AI Agents', agent: 'AGT-10 & 6 Specialists (7 Agents)', output: 'Inter-agent collaborative mesh & trace viewer', status: 'Active' },
  { name: 'Agent Testing Playground', path: '/agent-tester', category: 'AI Agents', agent: 'AGT-01 to AGT-10', output: 'Interactive prompt & MCP execution simulator', status: 'Active' },
  { name: 'Ask the Inventory Agent', path: '/agent', category: 'AI Agents', agent: 'AGT-10 (Copilot)', output: 'Natural language chat with arithmetic grounding', status: 'Active' },
  { name: 'AI Agent Activity Log', path: '/agent/runs', category: 'AI Agents', agent: 'Mesh Telemetry', output: 'Chronological MCP tool execution history', status: 'Active' },
  { name: 'Connected Databases & APIs', path: '/connectors', category: 'Data & Connectors', agent: 'Ingestion Engine', output: 'ERP, MES, WMS connection status & schema health', status: 'Active' },
  { name: 'Data Import and Quality', path: '/uploads', category: 'Data & Connectors', agent: 'AGT-01 (Reconcile)', output: 'Manual CSV file uploads & 5-tier schema check', status: 'Active' },
  { name: 'Settings & Configurations', path: '/settings', category: 'Settings', agent: 'Admin Engine', output: 'Thresholds, plants, users, and safety buffers', status: 'Active' }
]

export function ApplicationArchitecture() {
  const [selectedId, setSelectedId] = useState<string>('agt-03')
  const [activeMainTab, setActiveMainTab] = useState<'architecture' | 'collaboration' | 'blueprint' | 'matrix'>('architecture')
  const [activeBottomTab, setActiveBottomTab] = useState<'flow' | 'mapping' | 'agents' | 'status'>('flow')
  const [drawerSubTab, setDrawerSubTab] = useState<'overview' | 'flow' | 'outputs' | 'pages'>('overview')
  const [filterLayer, setFilterLayer] = useState<string>('all')
  const [archLayout, setArchLayout] = useState<'uniform' | 'columns'>('uniform')

  const selectedComp = ARCHITECTURE_COMPONENTS[selectedId] || ARCHITECTURE_COMPONENTS['agt-03']

  // Lineage detection for dynamic highlighting
  const isHighlighted = (id: string) => {
    if (selectedId === id) return 'selected'
    if (selectedComp.upstream.includes(id)) return 'upstream'
    if (selectedComp.downstream.includes(id)) return 'downstream'
    return 'neutral'
  }

  return (
    <div
      style={{
        borderRadius: 14,
        background: '#ffffff',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        overflow: 'hidden',
        fontSize: 11,
      }}
    >
      {/* 1. Header & Main Mode Switcher */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          borderBottom: '1px solid #F1F5F9',
          paddingBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #6D28D9 0%, #4F46E5 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(109, 40, 217, 0.25)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                Inventory Intelligence – Application Architecture &amp; End-to-End Data Flow
              </h2>
            </div>
            <p style={{ margin: '1px 0 0', fontSize: 10.5, color: '#64748B' }}>
              Complete system view: from data sources to AI agents, workflows and the application pages that deliver insights.
            </p>
          </div>
        </div>

        {/* 3 Top View Switcher Buttons */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveMainTab('architecture')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
              border: activeMainTab === 'architecture' ? 'none' : '1px solid #E2E8F0',
              background: activeMainTab === 'architecture' ? '#6D28D9' : '#fff',
              color: activeMainTab === 'architecture' ? '#fff' : '#475569',
              boxShadow: activeMainTab === 'architecture' ? '0 1px 4px rgba(109, 40, 217, 0.25)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📊</span> Architecture &amp; Data Flow
          </button>

          <Link
            to="/agents"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 10.5,
              fontWeight: 700,
              textDecoration: 'none',
              border: '1px solid #E2E8F0',
              background: '#fff',
              color: '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🤖</span> Agent Collaboration
          </Link>

          <button
            onClick={() => setActiveMainTab('blueprint')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
              border: activeMainTab === 'blueprint' ? 'none' : '1px solid #BAE6FD',
              background: activeMainTab === 'blueprint' ? '#0284C7' : '#F0F9FF',
              color: activeMainTab === 'blueprint' ? '#fff' : '#0369A1',
              boxShadow: activeMainTab === 'blueprint' ? '0 1px 4px rgba(2, 132, 199, 0.25)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🎯</span> 4-Component Framework
          </button>

          <button
            onClick={() => setActiveMainTab('matrix')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
              border: activeMainTab === 'matrix' ? 'none' : '1px solid #E2E8F0',
              background: activeMainTab === 'matrix' ? '#6D28D9' : '#fff',
              color: activeMainTab === 'matrix' ? '#fff' : '#475569',
              boxShadow: activeMainTab === 'matrix' ? '0 1px 4px rgba(109, 40, 217, 0.25)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🗺️</span> Output-to-Page Mapping
          </button>
        </div>
      </div>

      {/* 2. Compact Status Telemetry Bar (6 Chips in Single Row) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 6,
          background: '#F8FAFC',
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#0284C7' }}>🗄️</span>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0F172A' }}>6 Data Sources</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#16A34A' }} /> Connected
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#10B981' }}>⚙️</span>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0F172A' }}>7 AI Agents</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#16A34A' }} /> Active Mesh
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#6366F1' }}>⚡</span>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0F172A' }}>15 Services</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#16A34A' }} /> Running
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#7C3AED' }}>🖥️</span>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0F172A' }}>22 App Pages</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#16A34A' }} /> Available
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#64748B' }}>🕒</span>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>Last Data Sync</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1E293B' }}>31-Oct-2026, 10:24 AM</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#16A34A' }}>✅</span>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>Pipeline Status</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#15803D' }}>Completed (Run #41)</div>
          </div>
        </div>
      </div>

      {/* 3. Main Architecture View vs Matrix View */}
      {activeMainTab === 'architecture' && (
        <>
          {/* Layer Filter Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginRight: 3 }}>
              Filter Layers:
            </span>
            {[
              { id: 'all', label: 'All Layers' },
              { id: 'sources', label: '1. Sources' },
              { id: 'ingestion', label: '2. Ingestion' },
              { id: 'datalayer', label: '3. Data Layer' },
              { id: 'agents', label: '4. AI Agents' },
              { id: 'outputs', label: '5. Workflows' },
              { id: 'pages', label: '6. Pages' },
              { id: 'governance', label: '7. Governance' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterLayer(f.id)}
                style={{
                  fontSize: 9.5,
                  fontWeight: filterLayer === f.id ? 800 : 600,
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: filterLayer === f.id ? '1px solid #6D28D9' : '1px solid #E2E8F0',
                  background: filterLayer === f.id ? '#EDE9FE' : '#fff',
                  color: filterLayer === f.id ? '#6D28D9' : '#64748B',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                }}
              >
                {f.label}
              </button>
            ))}
            <span className="spacer" />
            <span style={{ fontSize: 9.5, color: '#94A3B8', fontStyle: 'italic' }}>
              💡 Click any node to inspect inputs, logic, and output handoffs
            </span>
          </div>

          {/* Format View Toggle: Uniform Enterprise Pipeline vs Detailed Columns */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Architecture Format:
              </span>
              <button
                type="button"
                onClick={() => setArchLayout('uniform')}
                style={{
                  fontSize: 9.5,
                  fontWeight: archLayout === 'uniform' ? 800 : 600,
                  padding: '3px 9px',
                  borderRadius: 5,
                  background: archLayout === 'uniform' ? '#4A148C' : '#FFFFFF',
                  color: archLayout === 'uniform' ? '#FFFFFF' : '#475569',
                  border: `1px solid ${archLayout === 'uniform' ? '#4A148C' : '#CBD5E1'}`,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: archLayout === 'uniform' ? '0 1px 4px rgba(74, 20, 140, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>🏢</span> Uniform Enterprise Pipeline Format
              </button>
              <button
                type="button"
                onClick={() => setArchLayout('columns')}
                style={{
                  fontSize: 9.5,
                  fontWeight: archLayout === 'columns' ? 800 : 600,
                  padding: '3px 9px',
                  borderRadius: 5,
                  background: archLayout === 'columns' ? '#4A148C' : '#FFFFFF',
                  color: archLayout === 'columns' ? '#FFFFFF' : '#475569',
                  border: `1px solid ${archLayout === 'columns' ? '#4A148C' : '#CBD5E1'}`,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: archLayout === 'columns' ? '0 1px 4px rgba(74, 20, 140, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>📊</span> Detailed Component Columns
              </button>
            </div>
            <span style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>
              💡 Click any stage or box to inspect inputs, live latency &amp; data lineage
            </span>
          </div>

          {archLayout === 'uniform' ? (
            <div
              style={{
                position: 'relative',
                borderRadius: 12,
                border: '1.5px solid #CBD5E1',
                background: '#FFFFFF',
                padding: '12px 14px',
                overflowX: 'auto',
                width: '100%',
                boxSizing: 'border-box',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {/* Top Corporate Branding Header: GWC DATA.AI */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 16px',
                  background: '#FAFAFD',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {/* Left: Plant Telemetry Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#334155' }}>
                    Plant Integration: <b>Connected (IN-KA-01 &amp; IN-TN-01)</b>
                  </span>
                </div>

                {/* Center: GWC DATA.AI Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="6" cy="18" r="3.5" fill="#4A148C" />
                    <circle cx="18" cy="18" r="3" fill="#D97706" />
                    <circle cx="12" cy="5" r="3.5" fill="#6D28D9" />
                    <line x1="6" y1="18" x2="12" y2="5" stroke="#6D28D9" strokeWidth="2" />
                    <line x1="18" y1="18" x2="12" y2="5" stroke="#D97706" strokeWidth="2" />
                    <line x1="6" y1="18" x2="18" y2="18" stroke="#4A148C" strokeWidth="2" />
                  </svg>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.04em', color: '#311B92', lineHeight: 1.1 }}>
                      GWC DATA.AI
                    </div>
                    <div style={{ fontSize: 7, fontWeight: 800, color: '#D97706', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                      SOLUTION MATTERS
                    </div>
                  </div>
                </div>

                {/* Right: Automated Run Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#4A148C', background: '#EDE9FE', padding: '2px 8px', borderRadius: 4 }}>
                    Automated Pipeline · 10-Min Sync
                  </span>
                </div>
              </div>

              {/* Main Horizontal Flow Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 8,
                  minWidth: 1040,
                  width: '100%',
                }}
              >
                {/* 1. SOURCE SYSTEM */}
                <div
                  style={{
                    flex: '0 0 200px',
                    borderRadius: 10,
                    border: '1.5px solid #EF4444',
                    background: '#FFFFFF',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      background: '#C62828',
                      color: '#FFFFFF',
                      padding: '5px 8px',
                      fontSize: 9,
                      fontWeight: 800,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                  >
                    1. SOURCE SYSTEMS – Plant &amp; Enterprise
                  </div>

                  <div style={{ padding: 6, display: 'flex', gap: 6, flex: 1 }}>
                    {/* Left shop floor column */}
                    <div
                      style={{
                        flex: '0 0 75px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-around',
                        gap: 6,
                        borderRight: '1px solid #E2E8F0',
                        paddingRight: 4,
                      }}
                    >
                      <div
                        onClick={() => setSelectedId('src-mes')}
                        style={{
                          cursor: 'pointer',
                          textAlign: 'center',
                          padding: '4px 2px',
                          borderRadius: 4,
                          background: selectedId === 'src-mes' ? '#FEE2E2' : '#F8FAFC',
                          border: selectedId === 'src-mes' ? '1px solid #EF4444' : '1px solid #E2E8F0',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ fontSize: 13 }}>📄</div>
                        <div style={{ fontSize: 7.5, fontWeight: 700, color: '#C62828', lineHeight: 1.15 }}>MECPL MES System</div>
                      </div>

                      <div
                        onClick={() => setSelectedId('src-wms')}
                        style={{
                          cursor: 'pointer',
                          textAlign: 'center',
                          padding: '4px 2px',
                          borderRadius: 4,
                          background: selectedId === 'src-wms' ? '#FEE2E2' : '#F8FAFC',
                          border: selectedId === 'src-wms' ? '1px solid #EF4444' : '1px solid #E2E8F0',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ fontSize: 13 }}>🏭</div>
                        <div style={{ fontSize: 7.5, fontWeight: 700, color: '#C62828', lineHeight: 1.15 }}>Shop Floor</div>
                      </div>
                    </div>

                    {/* Right connectors sub-card */}
                    <div
                      style={{
                        flex: 1,
                        background: '#F0F4F8',
                        borderRadius: 6,
                        padding: '4px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        justifyContent: 'space-around',
                      }}
                    >
                      <div
                        onClick={() => setSelectedId('src-mes')}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 4px',
                          background: selectedId === 'src-mes' ? '#FEE2E2' : '#FFFFFF',
                          borderRadius: 4,
                          border: '1px solid #CBD5E1',
                        }}
                      >
                        <span style={{ fontSize: 11 }}>☁️</span>
                        <div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: '#0F172A' }}>API</div>
                          <div style={{ fontSize: 6.5, color: '#64748B' }}>(MES/Plant Data)</div>
                        </div>
                      </div>

                      <div
                        onClick={() => setSelectedId('src-excel')}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 4px',
                          background: selectedId === 'src-excel' ? '#DCFCE7' : '#FFFFFF',
                          borderRadius: 4,
                          border: '1px solid #CBD5E1',
                        }}
                      >
                        <span style={{ fontSize: 11 }}>📊</span>
                        <div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: '#15803D' }}>Excel</div>
                          <div style={{ fontSize: 6.5, color: '#64748B' }}>(Manual/Reference)</div>
                        </div>
                      </div>

                      <div
                        onClick={() => setSelectedId('src-qms')}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 4px',
                          background: selectedId === 'src-qms' ? '#EDE9FE' : '#FFFFFF',
                          borderRadius: 4,
                          border: '1px solid #CBD5E1',
                        }}
                      >
                        <span style={{ fontSize: 11 }}>⚙️</span>
                        <div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: '#6D28D9' }}>CMMS / QMS</div>
                          <div style={{ fontSize: 6.5, color: '#64748B' }}>(Maintenance Data)</div>
                        </div>
                      </div>

                      <div
                        onClick={() => setSelectedId('src-sap')}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 4px',
                          background: selectedId === 'src-sap' ? '#E0F2FE' : '#FFFFFF',
                          borderRadius: 4,
                          border: '1px solid #CBD5E1',
                        }}
                      >
                        <span style={{ fontSize: 11 }}>🏢</span>
                        <div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: '#0284C7' }}>SAP ERP</div>
                          <div style={{ fontSize: 6.5, color: '#64748B' }}>(PO &amp; Vendor Data)</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow 1 -> 2 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A148C', fontSize: 13, fontWeight: 900 }}>
                  ➔
                </div>

                {/* 2. INTERMEDIATE SYSTEM */}
                <div
                  onClick={() => setSelectedId('ing-connectors')}
                  style={{
                    flex: '0 0 145px',
                    borderRadius: 10,
                    border: selectedId === 'ing-connectors' ? '2px solid #4A148C' : '1.5px solid #8B5CF6',
                    background: '#FFFFFF',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      background: '#4A148C',
                      color: '#FFFFFF',
                      padding: '5px 6px',
                      fontSize: 8.5,
                      fontWeight: 800,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                  >
                    2. INTERMEDIATE SYSTEM
                  </div>

                  <div style={{ padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 24 }}>🖥️</div>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: '#0F172A' }}>Plant Integration Gateway Server</div>
                      <div
                        style={{
                          marginTop: 4,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#EDE9FE',
                          color: '#4A148C',
                          fontSize: 8,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                        }}
                      >
                        IP: 10.244.101.228
                      </div>
                    </div>
                    <div style={{ fontSize: 7, color: '#64748B', lineHeight: 1.3, marginTop: 2 }}>
                      Secure Gateway · REST, OPC-UA &amp; ODBC Ingress
                    </div>
                  </div>
                </div>

                {/* Arrow 2 -> 3 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A148C', fontSize: 13, fontWeight: 900 }}>
                  ➔
                </div>

                {/* 3, 4, 5, 6: GWC DATA.AI – Automated Pipeline & Multi-Agent Engine */}
                <div
                  style={{
                    flex: '1 1 480px',
                    borderRadius: 10,
                    border: '1.5px solid #6D28D9',
                    background: '#FFFFFF',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 420,
                  }}
                >
                  <div
                    style={{
                      background: '#4A148C',
                      color: '#FFFFFF',
                      padding: '5px 10px',
                      fontSize: 9.5,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    <span>⚙️</span> GWC DATA.AI – Automated Data &amp; Multi-Agent Pipeline
                  </div>

                  <div style={{ padding: 6, display: 'flex', alignItems: 'stretch', gap: 6, flex: 1 }}>
                    {/* Sub-box 3: ETL in Python */}
                    <div
                      onClick={() => setSelectedId('ing-reconcile')}
                      style={{
                        flex: 1,
                        background: selectedId === 'ing-reconcile' ? '#FAF5FF' : '#F8FAFC',
                        borderRadius: 6,
                        border: selectedId === 'ing-reconcile' ? '1.5px solid #6D28D9' : '1px solid #E2E8F0',
                        padding: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#4A148C', color: '#fff', fontSize: 8.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                          <span style={{ fontSize: 8.5, fontWeight: 800, color: '#0F172A' }}>ETL in Python</span>
                        </div>
                        <div style={{ textAlign: 'center', margin: '4px 0', fontSize: 16 }}>🐍</div>
                        <ul style={{ margin: 0, paddingLeft: 12, fontSize: 7, color: '#475569', lineHeight: 1.35 }}>
                          <li>Extract data from API, Excel &amp; CMMS</li>
                          <li>Validate, transform &amp; normalize UOMs</li>
                          <li>Calculate 60d net stock matrices</li>
                        </ul>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', color: '#6D28D9', fontSize: 10, fontWeight: 900 }}>➔</div>

                    {/* Sub-box 4: Windows Scheduler */}
                    <div
                      onClick={() => setSelectedId('db-movements')}
                      style={{
                        flex: 1,
                        background: selectedId === 'db-movements' ? '#FAF5FF' : '#F8FAFC',
                        borderRadius: 6,
                        border: selectedId === 'db-movements' ? '1.5px solid #6D28D9' : '1px solid #E2E8F0',
                        padding: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#4A148C', color: '#fff', fontSize: 8.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>4</span>
                          <span style={{ fontSize: 8.5, fontWeight: 800, color: '#0F172A' }}>Windows Scheduler</span>
                        </div>
                        <div style={{ textAlign: 'center', margin: '4px 0', fontSize: 16 }}>⏱️</div>
                        <ul style={{ margin: 0, paddingLeft: 12, fontSize: 7, color: '#475569', lineHeight: 1.35 }}>
                          <li>Schedule Python job in Task Scheduler</li>
                          <li>Run automatically every 10 minutes</li>
                          <li>Event-driven triggers on stock moves</li>
                        </ul>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', color: '#6D28D9', fontSize: 10, fontWeight: 900 }}>➔</div>

                    {/* Sub-box 5: SQL Database */}
                    <div
                      onClick={() => setSelectedId('db-projections')}
                      style={{
                        flex: 1,
                        background: selectedId === 'db-projections' ? '#FAF5FF' : '#F8FAFC',
                        borderRadius: 6,
                        border: selectedId === 'db-projections' ? '1.5px solid #6D28D9' : '1px solid #E2E8F0',
                        padding: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#4A148C', color: '#fff', fontSize: 8.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>5</span>
                          <span style={{ fontSize: 8.5, fontWeight: 800, color: '#0F172A' }}>SQL Database</span>
                        </div>
                        <div style={{ textAlign: 'center', margin: '4px 0', fontSize: 16 }}>🗄️</div>
                        <ul style={{ margin: 0, paddingLeft: 12, fontSize: 7, color: '#475569', lineHeight: 1.35 }}>
                          <li>Store processed data in SQL Server</li>
                          <li>Live PO receipts &amp; movement ledger</li>
                          <li>Sub-100ms in-memory cache</li>
                        </ul>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', color: '#6D28D9', fontSize: 10, fontWeight: 900 }}>➔</div>

                    {/* Sub-box 6: Autonomous AI Agent Mesh */}
                    <div
                      onClick={() => setSelectedId('agt-10')}
                      style={{
                        flex: 1.15,
                        background: selectedId === 'agt-10' ? '#FAF5FF' : '#F5F3FF',
                        borderRadius: 6,
                        border: selectedId === 'agt-10' ? '1.5px solid #6D28D9' : '1px solid #DDD6FE',
                        padding: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#6D28D9', color: '#fff', fontSize: 8.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>6</span>
                          <span style={{ fontSize: 8.5, fontWeight: 800, color: '#5B21B6' }}>Autonomous AI Agents</span>
                        </div>
                        <div style={{ textAlign: 'center', margin: '4px 0', fontSize: 16 }}>🤖</div>
                        <ul style={{ margin: 0, paddingLeft: 12, fontSize: 7, color: '#4C1D95', lineHeight: 1.35 }}>
                          <li><b>AGT-10 Orchestrator</b> &amp; MCP Tools</li>
                          <li><b>AGT-01 to 05</b>: Stock, Shortage, BOM</li>
                          <li>Zero-hallucination arithmetic gate</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow 3 -> 4 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A148C', fontSize: 13, fontWeight: 900 }}>
                  ➔
                </div>

                {/* 7. DECISION WORKFLOWS */}
                <div
                  onClick={() => setSelectedId('out-shortage')}
                  style={{
                    flex: '0 0 150px',
                    borderRadius: 10,
                    border: selectedId === 'out-shortage' ? '2px solid #4A148C' : '1.5px solid #8B5CF6',
                    background: '#FFFFFF',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      background: '#4A148C',
                      color: '#FFFFFF',
                      padding: '5px 6px',
                      fontSize: 8.5,
                      fontWeight: 800,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                  >
                    7. DECISION WORKFLOWS
                  </div>

                  <div style={{ padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 24 }}>💻</div>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: '#0F172A' }}>Agent Co-Pilot &amp; Actions</div>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 12, fontSize: 7, color: '#475569', lineHeight: 1.35, textAlign: 'left' }}>
                      <li>Shortage &amp; stockout warnings</li>
                      <li>Capacity &amp; BOM allocations</li>
                      <li>What-if scenario simulations</li>
                    </ul>
                  </div>
                </div>

                {/* Arrow 4 -> 5 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A148C', fontSize: 13, fontWeight: 900 }}>
                  ➔
                </div>

                {/* 8. OUTPUT / CONSUMPTION */}
                <div
                  style={{
                    flex: '0 0 190px',
                    borderRadius: 10,
                    border: '1.5px solid #EF4444',
                    background: '#FFFFFF',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      background: '#C62828',
                      color: '#FFFFFF',
                      padding: '5px 8px',
                      fontSize: 8.5,
                      fontWeight: 800,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                  >
                    8. OUTPUT / CONSUMPTION
                  </div>

                  <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4, flex: 1, justifyContent: 'space-around' }}>
                    <div
                      onClick={() => setSelectedId('pg-overview')}
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 6px',
                        background: selectedId === 'pg-overview' ? '#BAE6FD' : '#F0F9FF',
                        borderRadius: 4,
                        border: '1px solid #BAE6FD',
                      }}
                    >
                      <span style={{ fontSize: 11 }}>☁️</span>
                      <div>
                        <div style={{ fontSize: 8, fontWeight: 800, color: '#0284C7' }}>22-Page Web App &amp; 3D Twin</div>
                        <div style={{ fontSize: 6.5, color: '#64748B' }}>(Publish &amp; Share, Plant Floor)</div>
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedId('pg-shortages')}
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 6px',
                        background: selectedId === 'pg-shortages' ? '#A7F3D0' : '#ECFDF5',
                        borderRadius: 4,
                        border: '1px solid #A7F3D0',
                      }}
                    >
                      <span style={{ fontSize: 11 }}>📑</span>
                      <div>
                        <div style={{ fontSize: 8, fontWeight: 800, color: '#15803D' }}>Reports &amp; Analysis</div>
                        <div style={{ fontSize: 6.5, color: '#64748B' }}>(Dashboard, KPI Reports, Trends)</div>
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedId('gov-actions')}
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 6px',
                        background: selectedId === 'gov-actions' ? '#DDD6FE' : '#FAF5FF',
                        borderRadius: 4,
                        border: '1px solid #DDD6FE',
                      }}
                    >
                      <span style={{ fontSize: 11 }}>👥</span>
                      <div>
                        <div style={{ fontSize: 8, fontWeight: 800, color: '#6D28D9' }}>Business Users &amp; Sign-off</div>
                        <div style={{ fontSize: 6.5, color: '#64748B' }}>(View, Analyze, Approve / Reject)</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Closed-Loop Return Feedback Bar */}
              <div
                onClick={() => setSelectedId('gov-actions')}
                style={{
                  marginTop: 10,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'linear-gradient(90deg, #FEF2F2 0%, #FAF5FF 50%, #FEF2F2 100%)',
                  border: '1.5px dashed #C62828',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#C62828' }}>↺</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#C62828' }}>
                    CLOSED-LOOP GOVERNANCE &amp; ERP WRITEBACK:
                  </span>
                  <span style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>
                    Human-in-the-loop sign-off on agent proposals triggers automated SAP PO generation &amp; stock ledger reconciliation
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 8, fontWeight: 800, background: '#16A34A', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>APPROVE</span>
                  <span style={{ fontSize: 8, fontWeight: 800, background: '#DC2626', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>REJECT</span>
                  <span style={{ fontSize: 8, fontWeight: 800, background: '#4A148C', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>ERP WRITEBACK</span>
                </div>
              </div>
            </div>
          ) : (
            /* 4. Complete 7-Layer Architecture Diagram Canvas */
            <div
              style={{
                position: 'relative',
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                background: '#FAFAFD',
                padding: '8px 6px',
                overflowX: 'auto',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
            {/* The 6 Main Columns Grid - pure responsive fr units to avoid overflowing on 14" screen */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.05fr) 10px minmax(0, 1.15fr) 10px minmax(0, 1.15fr) 10px minmax(0, 2.35fr) 10px minmax(0, 1.15fr) 10px minmax(0, 1.15fr)',
                alignItems: 'stretch',
                gap: 0,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {/* Column 1: 1. External Data Sources */}
              <div
                style={{
                  background: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  borderRadius: 8,
                  padding: '5px 5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minWidth: 0,
                  overflow: 'hidden',
                  opacity: filterLayer === 'all' || filterLayer === 'sources' ? 1 : 0.35,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                  <span style={{ fontSize: 10, color: '#0284C7' }}>🗄️</span>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: '#0369A1', textTransform: 'uppercase' }}>
                    1. Sources
                  </div>
                </div>

                {[
                  { id: 'src-sap', name: 'ERP (SAP)', tag: 'SAP', color: '#0284C7' },
                  { id: 'src-mes', name: 'MES', tag: 'SMT', color: '#0891B2' },
                  { id: 'src-wms', name: 'WMS', tag: 'BIN', color: '#0284C7' },
                  { id: 'src-qms', name: 'QMS', tag: 'QC', color: '#0284C7' },
                  { id: 'src-rfq', name: 'Supplier / RFQ', tag: 'B2B', color: '#0284C7' },
                  { id: 'src-excel', name: 'Excel / CSV', tag: 'FILE', color: '#10B981' },
                ].map((item) => {
                  const state = isHighlighted(item.id)
                  const isSel = selectedId === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        padding: '3px 5px',
                        borderRadius: 4,
                        background: isSel ? '#0284C7' : state === 'upstream' ? '#BAE6FD' : '#ffffff',
                        color: isSel ? '#ffffff' : '#0F172A',
                        border: isSel ? '1px solid #0284C7' : '1px solid #E0F2FE',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        fontSize: 9,
                        fontWeight: 700,
                        boxShadow: isSel ? '0 1px 3px rgba(2, 132, 199, 0.25)' : 'none',
                        transition: 'all 0.12s ease',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: 7.5,
                          fontWeight: 800,
                          background: isSel ? '#ffffff' : item.color,
                          color: isSel ? '#0284C7' : '#ffffff',
                          padding: '1px 3px',
                          borderRadius: 2,
                          marginLeft: 3,
                          flexShrink: 0,
                        }}
                      >
                        {item.tag}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Arrow 1 -> 2 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6D28D9', fontSize: 10, fontWeight: 900 }}>
                ➔
              </div>

              {/* Column 2: 2. Data Ingestion & Validation */}
              <div
                style={{
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: 8,
                  padding: '5px 5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minWidth: 0,
                  overflow: 'hidden',
                  opacity: filterLayer === 'all' || filterLayer === 'ingestion' ? 1 : 0.35,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                  <span style={{ fontSize: 10, color: '#059669' }}>🔄</span>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                    2. Ingestion
                  </div>
                </div>

                {[
                  { id: 'ing-connectors', name: 'Connectors (API / File)' },
                  { id: 'ing-schema', name: 'Schema & Validation' },
                  { id: 'ing-duplicate', name: 'Duplicate Detection' },
                  { id: 'ing-uom', name: 'UOM Normalization' },
                  { id: 'ing-reconcile', name: 'Data Reconciliation' },
                  { id: 'ing-qc', name: 'QC / Lot Validation' },
                ].map((item) => {
                  const state = isHighlighted(item.id)
                  const isSel = selectedId === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        padding: '3px 5px',
                        borderRadius: 4,
                        background: isSel ? '#059669' : state === 'upstream' ? '#A7F3D0' : '#ffffff',
                        color: isSel ? '#ffffff' : '#0F172A',
                        border: isSel ? '1px solid #059669' : '1px solid #D1FAE5',
                        cursor: 'pointer',
                        fontSize: 8.5,
                        fontWeight: 700,
                        boxShadow: isSel ? '0 1px 3px rgba(5, 150, 105, 0.25)' : 'none',
                        transition: 'all 0.12s ease',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                      }}
                    >
                      {item.name}
                    </div>
                  )
                })}

                {/* Sub-badge AGT-01 · AGT-08 */}
                <div
                  style={{
                    marginTop: 'auto',
                    padding: '2px 4px',
                    borderRadius: 3,
                    background: '#D1FAE5',
                    color: '#065F46',
                    fontSize: 7.5,
                    fontWeight: 800,
                    textAlign: 'center',
                    border: '1px solid #6EE7B7',
                  }}
                >
                  AGT-01 · AGT-08
                </div>
              </div>

              {/* Arrow 2 -> 3 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6D28D9', fontSize: 10, fontWeight: 900 }}>
                ➔
              </div>

              {/* Column 3: 3. Application Data Layer */}
              <div
                style={{
                  background: '#F5F3FF',
                  border: '1px solid #DDD6FE',
                  borderRadius: 8,
                  padding: '5px 5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minWidth: 0,
                  overflow: 'hidden',
                  opacity: filterLayer === 'all' || filterLayer === 'datalayer' ? 1 : 0.35,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                  <span style={{ fontSize: 10, color: '#7C3AED' }}>🗄️</span>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: '#6D28D9', textTransform: 'uppercase' }}>
                    3. Data Layer
                  </div>
                </div>

                {[
                  { id: 'db-master', name: 'Master Data' },
                  { id: 'db-inventory', name: 'Inventory & Movements' },
                  { id: 'db-bom', name: 'BOM & Prod Plans' },
                  { id: 'db-supplier', name: 'Supplier & PO History' },
                  { id: 'db-qc', name: 'QC & Lot Records' },
                  { id: 'db-audit', name: 'Agent Results & Logs' },
                ].map((item) => {
                  const state = isHighlighted(item.id)
                  const isSel = selectedId === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        padding: '3px 5px',
                        borderRadius: 4,
                        background: isSel ? '#7C3AED' : state === 'upstream' ? '#DDD6FE' : '#ffffff',
                        color: isSel ? '#ffffff' : '#0F172A',
                        border: isSel ? '1px solid #7C3AED' : '1px solid #EDE9FE',
                        cursor: 'pointer',
                        fontSize: 8.5,
                        fontWeight: 700,
                        boxShadow: isSel ? '0 1px 3px rgba(124, 58, 237, 0.25)' : 'none',
                        transition: 'all 0.12s ease',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                      }}
                    >
                      {item.name}
                    </div>
                  )
                })}

                <div
                  style={{
                    marginTop: 'auto',
                    padding: '2px 4px',
                    borderRadius: 3,
                    background: '#EDE9FE',
                    color: '#5B21B6',
                    fontSize: 7.5,
                    fontWeight: 800,
                    textAlign: 'center',
                    border: '1px solid #C4B5FD',
                  }}
                >
                  PostgreSQL · Relational
                </div>
              </div>

              {/* Arrow 3 -> 4 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6D28D9', fontSize: 10, fontWeight: 900 }}>
                ➔
              </div>

              {/* Column 4: 4. Backend Processing & AI Agent Layer (Balanced 4x2 sub-grid) */}
              <div
                style={{
                  background: '#FAF5FF',
                  border: '1.5px solid #C4B5FD',
                  borderRadius: 8,
                  padding: '5px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  minWidth: 0,
                  overflow: 'hidden',
                  opacity: filterLayer === 'all' || filterLayer === 'agents' || filterLayer === 'backend' ? 1 : 0.35,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E9D5FF', paddingBottom: 2 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: '#5B21B6', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span>🧠</span> 4. Backend &amp; AI Agents
                  </div>
                  <span style={{ fontSize: 7.5, fontWeight: 700, color: '#6D28D9' }}>
                    FastAPI · 15 Services · MCP Mesh
                  </span>
                </div>

                {/* Top Orchestrator Card (AGT-10) */}
                <div
                  onClick={() => setSelectedId('agt-10')}
                  style={{
                    padding: '4px 6px',
                    borderRadius: 5,
                    background: selectedId === 'agt-10' ? '#5B21B6' : '#6D28D9',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(109, 40, 217, 0.2)',
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 11 }}>🧠</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        AGT-10 · Central Orchestrator
                      </div>
                      <div style={{ fontSize: 7.5, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Decomposes queries, calls MCP tools, unifies outputs
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 7.5, fontWeight: 800, background: '#A78BFA', padding: '1px 4px', borderRadius: 2, flexShrink: 0, marginLeft: 3 }}>
                    Host
                  </span>
                </div>

                {/* Balanced 2-Column Grid (3 agents left, 3 agents right = 6 specialists + AGT-10 Host = 7 Core Agents) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 3 }}>
                  {/* Left Subcolumn: 3 agents */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    {[
                      { id: 'agt-01', name: 'AGT-01 Reconcile', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
                      { id: 'agt-02', name: 'AGT-02 Stock Monitor', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
                      { id: 'agt-03', name: 'AGT-03 Shortage', color: '#D97706', bg: '#FFFDF7', border: '#FDE68A' },
                    ].map((agent) => {
                      const isSel = selectedId === agent.id
                      const state = isHighlighted(agent.id)
                      return (
                        <div
                          key={agent.id}
                          onClick={() => setSelectedId(agent.id)}
                          style={{
                            padding: '3px 4px',
                            borderRadius: 4,
                            background: isSel ? agent.color : state === 'upstream' || state === 'downstream' ? agent.bg : '#ffffff',
                            color: isSel ? '#ffffff' : '#0F172A',
                            border: isSel ? `1px solid ${agent.color}` : `1px solid ${agent.border}`,
                            cursor: 'pointer',
                            fontSize: 8,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: isSel ? `0 1px 3px ${agent.color}40` : 'none',
                            transition: 'all 0.12s ease',
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                            {agent.name}
                          </span>
                          <span
                            style={{
                              fontSize: 6.5,
                              fontWeight: 800,
                              padding: '1px 3px',
                              borderRadius: 2,
                              background: isSel ? '#ffffff' : agent.color,
                              color: isSel ? agent.color : '#ffffff',
                              flexShrink: 0,
                              marginLeft: 2,
                            }}
                          >
                            MCP
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Right Subcolumn: 3 agents */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    {[
                      { id: 'agt-04', name: 'AGT-04 BOM Twin', color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
                      { id: 'agt-05', name: 'AGT-05 Replenish', color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
                      { id: 'agt-09', name: 'AGT-09 E&O Stock', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
                    ].map((agent) => {
                      const isSel = selectedId === agent.id
                      const state = isHighlighted(agent.id)
                      return (
                        <div
                          key={agent.id}
                          onClick={() => setSelectedId(agent.id)}
                          style={{
                            padding: '3px 4px',
                            borderRadius: 4,
                            background: isSel ? agent.color : state === 'upstream' || state === 'downstream' ? agent.bg : '#ffffff',
                            color: isSel ? '#ffffff' : '#0F172A',
                            border: isSel ? `1px solid ${agent.color}` : `1px solid ${agent.border}`,
                            cursor: 'pointer',
                            fontSize: 8,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: isSel ? `0 1px 3px ${agent.color}40` : 'none',
                            transition: 'all 0.12s ease',
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                            {agent.name}
                          </span>
                          <span
                            style={{
                              fontSize: 6.5,
                              fontWeight: 800,
                              padding: '1px 3px',
                              borderRadius: 2,
                              background: isSel ? '#ffffff' : agent.color,
                              color: isSel ? agent.color : '#ffffff',
                              flexShrink: 0,
                              marginLeft: 2,
                            }}
                          >
                            MCP
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Teammate Telemetry Connectors */}
                <div style={{ marginTop: 3, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 3 }}>
                  {[
                    { id: 'agt-07', name: 'AGT-07 Delay (Ext)', color: '#C026D3', bg: '#FDF4FF', border: '#F5D0FE' },
                    { id: 'agt-08', name: 'AGT-08 QC (Ext)', color: '#10B981', bg: '#F0FDF4', border: '#BBF7D0' },
                  ].map((agent) => {
                    const isSel = selectedId === agent.id
                    const state = isHighlighted(agent.id)
                    return (
                      <div
                        key={agent.id}
                        onClick={() => setSelectedId(agent.id)}
                        style={{
                          padding: '2px 4px',
                          borderRadius: 4,
                          background: isSel ? agent.color : state === 'upstream' || state === 'downstream' ? agent.bg : '#ffffff',
                          color: isSel ? '#ffffff' : '#64748B',
                          border: isSel ? `1px solid ${agent.color}` : `1px dashed ${agent.border}`,
                          cursor: 'pointer',
                          fontSize: 7.5,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: isSel ? `0 1px 3px ${agent.color}40` : 'none',
                          transition: 'all 0.12s ease',
                          minWidth: 0,
                          overflow: 'hidden',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                          {agent.name}
                        </span>
                        <span
                          style={{
                            fontSize: 6,
                            fontWeight: 700,
                            padding: '0.5px 2px',
                            borderRadius: 2,
                            background: isSel ? '#ffffff' : '#E2E8F0',
                            color: isSel ? agent.color : '#64748B',
                            flexShrink: 0,
                            marginLeft: 1,
                          }}
                        >
                          DB
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Bottom strip */}
                <div
                  style={{
                    padding: '2px 4px',
                    borderRadius: 3,
                    background: '#EDE9FE',
                    color: '#6D28D9',
                    fontSize: 7.5,
                    fontWeight: 700,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Deterministic Engine · ML Forecasting · MCP Tool Registry
                </div>
              </div>

              {/* Arrow 4 -> 5 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6D28D9', fontSize: 10, fontWeight: 900 }}>
                ➔
              </div>

              {/* Column 5: 5. Output & Workflow */}
              <div
                style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: 8,
                  padding: '5px 5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minWidth: 0,
                  overflow: 'hidden',
                  opacity: filterLayer === 'all' || filterLayer === 'outputs' ? 1 : 0.35,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                  <span style={{ fontSize: 10, color: '#D97706' }}>📋</span>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: '#B45309', textTransform: 'uppercase' }}>
                    5. Workflows
                  </div>
                </div>

                {[
                  { id: 'out-shortage', name: 'Shortage & Depletion' },
                  { id: 'out-capacity', name: 'Capacity & Build Plan' },
                  { id: 'out-proposals', name: 'PO & Proposals' },
                  { id: 'out-supplier', name: 'Supplier Risk & Delay' },
                  { id: 'out-excess', name: 'Excess & Obsolete' },
                  { id: 'out-approvals', name: 'Approval Workflows' },
                  { id: 'out-audit', name: 'Audit & Compliance' },
                ].map((item) => {
                  const state = isHighlighted(item.id)
                  const isSel = selectedId === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        padding: '3px 5px',
                        borderRadius: 4,
                        background: isSel ? '#D97706' : state === 'downstream' ? '#FEF3C7' : '#ffffff',
                        color: isSel ? '#ffffff' : '#0F172A',
                        border: isSel ? '1px solid #D97706' : '1px solid #FDE68A',
                        cursor: 'pointer',
                        fontSize: 8.5,
                        fontWeight: 700,
                        boxShadow: isSel ? '0 1px 3px rgba(217, 119, 6, 0.25)' : 'none',
                        transition: 'all 0.12s ease',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                      }}
                    >
                      {item.name}
                    </div>
                  )
                })}
              </div>

              {/* Arrow 5 -> 6 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6D28D9', fontSize: 10, fontWeight: 900 }}>
                ➔
              </div>

              {/* Column 6: 6. Frontend Application Pages */}
              <div
                style={{
                  background: '#EEF2FF',
                  border: '1px solid #C7D2FE',
                  borderRadius: 8,
                  padding: '5px 5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minWidth: 0,
                  overflow: 'hidden',
                  opacity: filterLayer === 'all' || filterLayer === 'pages' ? 1 : 0.35,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                  <span style={{ fontSize: 10, color: '#4F46E5' }}>🖥️</span>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: '#3730A3', textTransform: 'uppercase' }}>
                    6. App Pages
                  </div>
                </div>

                {[
                  { id: 'page-overview', name: 'Health Dashboard', path: '/overview' },
                  { id: 'page-stock', name: 'Stock on Hand', path: '/stock' },
                  { id: 'page-shortages', name: 'Shortage Forecast', path: '/shortages' },
                  { id: 'page-capacity', name: 'Build Capacity', path: '/capacity' },
                  { id: 'page-simulation', name: 'Supplier Delay', path: '/simulation' },
                  { id: 'page-proposals', name: 'PO Approvals', path: '/proposals' },
                  { id: 'page-quality', name: 'Quality Hold', path: '/quality' },
                  { id: 'page-dead-stock', name: 'Dead Stock', path: '/dead-stock' },
                ].map((item) => {
                  const state = isHighlighted(item.id)
                  const isSel = selectedId === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        padding: '3px 5px',
                        borderRadius: 4,
                        background: isSel ? '#4F46E5' : state === 'downstream' ? '#E0E7FF' : '#ffffff',
                        color: isSel ? '#ffffff' : '#0F172A',
                        border: isSel ? '1px solid #4F46E5' : '1px solid #C7D2FE',
                        cursor: 'pointer',
                        fontSize: 8.5,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: isSel ? '0 1px 3px rgba(79, 70, 229, 0.25)' : 'none',
                        transition: 'all 0.12s ease',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                        {item.name}
                      </span>
                      <Link
                        to={item.path}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: 8.5,
                          color: isSel ? '#fff' : '#6366F1',
                          textDecoration: 'none',
                          marginLeft: 2,
                          flexShrink: 0,
                        }}
                      >
                        ↗
                      </Link>
                    </div>
                  )
                })}

                <button
                  onClick={() => setActiveMainTab('matrix')}
                  style={{
                    marginTop: 'auto',
                    padding: '2px 4px',
                    borderRadius: 3,
                    background: '#C7D2FE',
                    color: '#312E81',
                    fontSize: 7.5,
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  ... +14 more →
                </button>
              </div>
            </div>

            {/* 7. Bottom Governance & Closed-Loop Bar */}
            <div
              onClick={() => setSelectedId('gov-actions')}
              style={{
                marginTop: 6,
                padding: '5px 8px',
                borderRadius: 6,
                background: selectedId === 'gov-actions' ? '#6D28D9' : 'linear-gradient(90deg, #FAF5FF 0%, #EDE9FE 50%, #FAF5FF 100%)',
                color: selectedId === 'gov-actions' ? '#ffffff' : '#0F172A',
                border: selectedId === 'gov-actions' ? '1.5px solid #5B21B6' : '1px dashed #A78BFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 800, background: '#6D28D9', color: '#fff', padding: '1px 6px', borderRadius: 3 }}>
                  7. Governance
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: selectedId === 'gov-actions' ? '#EDE9FE' : '#4C1D95' }}>
                  Procurement · Warehouse · Inventory Planner · Executive Leadership
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: selectedId === 'gov-actions' ? '#EDE9FE' : '#6D28D9' }}>
                <span>Actions:</span>
                <span style={{ background: '#fff', color: '#6D28D9', padding: '1px 4px', borderRadius: 3, border: '1px solid #DDD6FE' }}>Review</span>
                <span style={{ background: '#fff', color: '#15803D', padding: '1px 4px', borderRadius: 3, border: '1px solid #BBF7D0' }}>Approve</span>
                <span style={{ background: '#fff', color: '#B91C1C', padding: '1px 4px', borderRadius: 3, border: '1px solid #FECACA' }}>Reject</span>
                <span style={{ background: '#fff', color: '#4338CA', padding: '1px 4px', borderRadius: 3, border: '1px solid #C7D2FE' }}>Sign-off</span>
                <span style={{ background: '#fff', color: '#0369A1', padding: '1px 4px', borderRadius: 3, border: '1px solid #BAE6FD' }}>Reconcile</span>
              </div>

              <div style={{ fontSize: 8.5, color: selectedId === 'gov-actions' ? '#DDD6FE' : '#6B21A8', fontStyle: 'italic' }}>
                ↺ Loops back into Backend APIs &amp; Audit Logs
              </div>
            </div>
          </div>
          )}

          {/* 5. Lower Dual-Panel: Left Active Sub-Tabs & Right Selected Component Inspection Drawer */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1.15fr)',
              gap: 8,
              marginTop: 2,
            }}
          >
            {/* Left Sub-Panel */}
            <div
              style={{
                borderRadius: 10,
                background: '#ffffff',
                border: '1px solid #E2E8F0',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Lower Sub-Tabs */}
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #F1F5F9', paddingBottom: 4 }}>
                {[
                  { id: 'flow', label: '📊 End-to-End Flow' },
                  { id: 'mapping', label: '🗺️ Key Output → Page' },
                  { id: 'agents', label: '🤖 Agent Mesh' },
                  { id: 'status', label: '⚙️ Telemetry' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveBottomTab(t.id as any)}
                    style={{
                      fontSize: 9.5,
                      fontWeight: activeBottomTab === t.id ? 800 : 600,
                      padding: '3px 7px',
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      background: activeBottomTab === t.id ? '#EDE9FE' : 'transparent',
                      color: activeBottomTab === t.id ? '#6D28D9' : '#64748B',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sub-view: End-to-End Data Flow Stepper */}
              {activeBottomTab === 'flow' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.35 }}>
                    Track how data moves through application layers and converts raw ERP/WMS entries into executive sign-offs:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 4 }}>
                    {[
                      { step: '1. Sources', desc: 'ERP, MES, WMS, QMS, RFQ', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
                      { step: '2. Ingestion', desc: 'Schema checks, UOM, Cleanse', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
                      { step: '3. Data Layer', desc: 'PostgreSQL, Master Data', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
                      { step: '4. AI Agents', desc: 'AGT-01 to AGT-10 Mesh', color: '#6D28D9', bg: '#FAF5FF', border: '#C4B5FD' },
                      { step: '5. Workflows', desc: 'Proposals, Limits, Delays', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                      { step: '6. Frontend', desc: '22 Real-Time App Pages', color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
                    ].map((s) => (
                      <div
                        key={s.step}
                        style={{
                          padding: '4px 6px',
                          borderRadius: 6,
                          background: s.bg,
                          border: `1px solid ${s.border}`,
                          fontSize: 8.5,
                        }}
                      >
                        <div style={{ fontWeight: 800, color: s.color, marginBottom: 1 }}>{s.step}</div>
                        <div style={{ color: '#64748B', fontSize: 8 }}>{s.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* Output to Page Mapping Preview */}
                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 6 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
                      Key Output → Frontend Page Handoffs:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {[
                        { from: 'Stock Monitoring (AGT-02)', to: 'Stock on Hand, Health Dashboard', path: '/stock' },
                        { from: 'Shortage Forecast (AGT-03)', to: 'Shortage Forecast, Material Details', path: '/shortages' },
                        { from: 'BOM Twin & Capacity (AGT-04)', to: 'Build Capacity Calculator', path: '/capacity' },
                        { from: 'Replenishment (AGT-05)', to: 'Purchase Order Approvals', path: '/proposals' },
                        { from: 'Supplier Delay ML (AGT-07)', to: 'Supplier Delay Simulator', path: '/simulation' },
                        { from: 'Incoming QC Gate (AGT-08)', to: 'Quality Hold & Rejects, Receiving', path: '/quality' },
                      ].map((m, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '3px 5px',
                            background: '#F8FAFC',
                            borderRadius: 4,
                            border: '1px solid #E2E8F0',
                            fontSize: 8.5,
                          }}
                        >
                          <span style={{ fontWeight: 700, color: '#334155' }}>{m.from}</span>
                          <span style={{ color: '#6D28D9', fontWeight: 600 }}>→ {m.to}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-view: Key Output to Page Mapping */}
              {activeBottomTab === 'mapping' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                  <div style={{ fontSize: 9.5, color: '#64748B' }}>
                    Direct routing of autonomous agent computations into user interfaces:
                  </div>
                  {[
                    { agent: 'AGT-01 Data Reconciliation', output: 'Clean Stock & Lot Validation', page: 'Data Import and Quality', path: '/uploads' },
                    { agent: 'AGT-02 Stock Monitoring', output: 'Usable Stock vs Safety Stock', page: 'Stock on Hand & Health Dashboard', path: '/stock' },
                    { agent: 'AGT-03 Shortage Forecast', output: '30/60/90-Day Depletion Curves', page: 'Shortage Forecast', path: '/shortages' },
                    { agent: 'AGT-04 Build Capacity & BOM Twin', output: 'Finished Goods Build Ceiling', page: 'Build Capacity Calculator', path: '/capacity' },
                    { agent: 'AGT-05 Replenishment Proposals', output: 'Automated Purchase Orders', page: 'Purchase Order Approvals', path: '/proposals' },
                    { agent: 'AGT-07 Supplier Delay & ML', output: 'Lead Time Disruption Stress-Test', page: 'Supplier Delay Simulator', path: '/simulation' },
                    { agent: 'AGT-08 Incoming QC & Lot Acceptance', output: 'Quarantine Holds & Lot Releases', page: 'Quality Hold and Rejects', path: '/quality' },
                    { agent: 'AGT-09 Excess & Obsolete Inventory', output: 'Carrying Costs & Transfers', page: 'Dead and Slow-Moving Stock', path: '/dead-stock' },
                    { agent: 'AGT-10 Central Orchestrator', output: 'Unified Managerial Decision Dossier', page: 'Ask the Inventory Agent', path: '/agent' },
                  ].map((row, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '3px 6px',
                        borderRadius: 4,
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        fontSize: 9,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>{row.agent}</span>
                      <span style={{ color: '#475569' }}>{row.output}</span>
                      <Link
                        to={row.path}
                        style={{ color: '#6D28D9', fontWeight: 700, textDecoration: 'none' }}
                      >
                        {row.page} ↗
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-view: Agent Mesh Pipeline */}
              {activeBottomTab === 'agents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 9.5, color: '#64748B' }}>
                    Sequential data handoff contract across the 9 specialized agents:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 180, overflowY: 'auto' }}>
                    {[
                      { step: '1. Ingest', from: 'AGT-01 + AGT-08', to: 'AGT-02', payload: '6,624 clean records + 1,287 QC released lots' },
                      { step: '2. Monitor', from: 'AGT-02', to: 'AGT-03', payload: 'Low-stock item alerts (MAT-PCB-004)' },
                      { step: '3. Forecast', from: 'AGT-03', to: 'AGT-04', payload: 'Stockout dates (Day 18 line stoppage)' },
                      { step: '4. Allocate', from: 'AGT-04', to: 'AGT-05', payload: 'BOM Twin capacity (850 Aster 15 limit; 1,150 unit deficit)' },
                      { step: '5. Draft PO', from: 'AGT-05', to: 'AGT-07', payload: 'PO-2026-0038 for 2,000 units (MOQ rounded)' },
                      { step: '6. Stress-test', from: 'AGT-07', to: 'AGT-10', payload: '+7-day delay simulated; 0 line halts confirmed' },
                      { step: '7. Orchestrate', from: 'AGT-10', to: 'Leadership', payload: 'Executive Intelligence Dossier ready for digital release' },
                    ].map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '3px 6px',
                          background: '#F8FAFC',
                          borderRadius: 4,
                          border: '1px solid #E2E8F0',
                          fontSize: 8.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ fontWeight: 800, color: '#6D28D9' }}>{step.step}: {step.from} ➔ {step.to}</span>
                        <span style={{ color: '#475569' }}>{step.payload}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-view: Component Telemetry */}
              {activeBottomTab === 'status' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 180, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr 1.2fr', padding: '2px 5px', background: '#F1F5F9', borderRadius: 3, fontSize: 8.5, fontWeight: 800, color: '#475569' }}>
                    <span>COMPONENT</span>
                    <span>STATUS</span>
                    <span>LATENCY</span>
                    <span>FRESHNESS</span>
                  </div>
                  {Object.values(ARCHITECTURE_COMPONENTS).slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 0.8fr 0.8fr 1.2fr',
                        padding: '3px 5px',
                        borderBottom: '1px solid #F1F5F9',
                        fontSize: 8.5,
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>{c.shortName || c.name}</span>
                      <span style={{ color: '#16A34A', fontWeight: 700 }}>● {c.status}</span>
                      <span style={{ color: '#64748B' }}>{c.latency || '5ms'}</span>
                      <span style={{ color: '#64748B', fontSize: 8 }}>{c.lastSync || 'Run #41'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Inspection Drawer for Selected Component */}
            <div
              style={{
                borderRadius: 10,
                background: selectedComp.badgeBg || '#F5F3FF',
                border: `1.5px solid ${selectedComp.accentColor}50`,
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                transition: 'all 0.2s ease',
              }}
            >
              {/* Drawer Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${selectedComp.accentColor}30`, paddingBottom: 4 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12 }}>{selectedComp.icon}</span>
                    <h3 style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: '#0F172A' }}>
                      {selectedComp.name}
                    </h3>
                  </div>
                  <div style={{ fontSize: 8.5, color: '#64748B', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#16A34A', fontWeight: 700 }}>● {selectedComp.status}</span>
                    <span>Sync: {selectedComp.lastSync || 'Run #41'}</span>
                    {selectedComp.latency && <span>Latency: {selectedComp.latency}</span>}
                  </div>
                </div>

                {selectedComp.liveMetric && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      background: '#ffffff',
                      color: selectedComp.accentColor,
                      border: `1px solid ${selectedComp.accentColor}`,
                      padding: '1px 5px',
                      borderRadius: 3,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedComp.liveMetric}
                  </span>
                )}
              </div>

              {/* Subtabs for Drawer */}
              <div style={{ display: 'flex', gap: 3 }}>
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'flow', label: 'Data & Flow' },
                  { id: 'outputs', label: 'Outputs' },
                  { id: 'pages', label: 'Pages' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setDrawerSubTab(st.id as any)}
                    style={{
                      fontSize: 8.5,
                      fontWeight: drawerSubTab === st.id ? 800 : 600,
                      padding: '2px 6px',
                      borderRadius: 3,
                      border: 'none',
                      cursor: 'pointer',
                      background: drawerSubTab === st.id ? selectedComp.accentColor : '#ffffff',
                      color: drawerSubTab === st.id ? '#ffffff' : '#475569',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Subtab Content: Overview */}
              {drawerSubTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 9 }}>
                  <div style={{ color: '#334155', lineHeight: 1.35 }}>
                    <b>Purpose:</b> {selectedComp.purpose}
                  </div>

                  <div style={{ background: '#ffffff', padding: '4px 6px', borderRadius: 4, border: '1px solid #E2E8F0' }}>
                    <b style={{ color: '#0F172A', fontSize: 8.5 }}>Processing &amp; Calculation Engine:</b>
                    <ul style={{ margin: '2px 0 0', paddingLeft: 14, color: '#475569', fontSize: 8.5, lineHeight: 1.3 }}>
                      {selectedComp.processing.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Subtab Content: Data & Flow */}
              {drawerSubTab === 'flow' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 9 }}>
                  <div>
                    <b style={{ fontSize: 8.5, color: '#0F172A' }}>📥 Ingested Inputs:</b>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                      {selectedComp.inputData.map((inp, idx) => (
                        <span key={idx} style={{ background: '#fff', border: '1px solid #CBD5E1', padding: '1px 5px', borderRadius: 3, fontSize: 8 }}>
                          {inp}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <b style={{ fontSize: 8.5, color: '#0F172A' }}>🔗 Upstream Dependencies:</b>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                      {selectedComp.upstream.map((up, idx) => (
                        <span
                          key={idx}
                          onClick={() => ARCHITECTURE_COMPONENTS[up] && setSelectedId(up)}
                          style={{
                            background: ARCHITECTURE_COMPONENTS[up] ? '#EDE9FE' : '#F1F5F9',
                            color: ARCHITECTURE_COMPONENTS[up] ? '#6D28D9' : '#475569',
                            border: '1px solid #DDD6FE',
                            padding: '1px 5px',
                            borderRadius: 3,
                            fontSize: 8,
                            fontWeight: 700,
                            cursor: ARCHITECTURE_COMPONENTS[up] ? 'pointer' : 'default',
                          }}
                        >
                          {ARCHITECTURE_COMPONENTS[up]?.shortName || up}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <b style={{ fontSize: 8.5, color: '#0F172A' }}>📤 Downstream Consumers:</b>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                      {selectedComp.downstream.map((down, idx) => (
                        <span
                          key={idx}
                          onClick={() => ARCHITECTURE_COMPONENTS[down] && setSelectedId(down)}
                          style={{
                            background: ARCHITECTURE_COMPONENTS[down] ? '#ECFDF5' : '#F1F5F9',
                            color: ARCHITECTURE_COMPONENTS[down] ? '#059669' : '#475569',
                            border: '1px solid #A7F3D0',
                            padding: '1px 5px',
                            borderRadius: 3,
                            fontSize: 8,
                            fontWeight: 700,
                            cursor: ARCHITECTURE_COMPONENTS[down] ? 'pointer' : 'default',
                          }}
                        >
                          {ARCHITECTURE_COMPONENTS[down]?.shortName || down}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab Content: Outputs */}
              {drawerSubTab === 'outputs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 9 }}>
                  <b style={{ fontSize: 8.5, color: '#0F172A' }}>📤 Output Payload Handoff:</b>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {selectedComp.outputPayload.map((out, idx) => (
                      <div key={idx} style={{ background: '#ffffff', border: '1px solid #E2E8F0', padding: '3px 5px', borderRadius: 4, fontSize: 8.5, color: '#334155' }}>
                        • {out}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtab Content: Pages */}
              {drawerSubTab === 'pages' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 9 }}>
                  <b style={{ fontSize: 8.5, color: '#0F172A' }}>🖥️ Displayed in Application Pages:</b>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {selectedComp.frontendPages.map((pg, idx) => (
                      <Link
                        key={idx}
                        to={pg.path}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#ffffff',
                          border: '1px solid #CBD5E1',
                          padding: '3px 6px',
                          borderRadius: 4,
                          textDecoration: 'none',
                          color: '#4338CA',
                          fontSize: 8.5,
                          fontWeight: 700,
                        }}
                      >
                        <span>{pg.name}</span>
                        <span>Open ↗</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 6. Complete Output-to-Page Mapping Matrix View */}
      {activeMainTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                Complete Application Output-to-Page Dependency Matrix (22 Pages)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B' }}>
                Verified mapping showing how each autonomous agent output and database stream is surfaced across the frontend.
              </p>
            </div>
            <button
              onClick={() => setActiveMainTab('architecture')}
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: '#EDE9FE',
                color: '#6D28D9',
                border: '1px solid #C4B5FD',
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              ← Back to Architecture Canvas
            </button>
          </div>

          <div
            style={{
              maxHeight: 480,
              overflowY: 'auto',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontSize: 10, textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 10px' }}>Frontend Page</th>
                  <th style={{ padding: '8px 10px' }}>Category</th>
                  <th style={{ padding: '8px 10px' }}>Owning Agent / Layer</th>
                  <th style={{ padding: '8px 10px' }}>Key Grounded Output Delivered</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {ALL_APPLICATION_PAGES.map((row, idx) => (
                  <tr
                    key={row.path}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      background: idx % 2 === 0 ? '#ffffff' : '#FAFAFD',
                    }}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0F172A' }}>
                      {row.name}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: '#EDE9FE',
                          color: '#6D28D9',
                        }}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#334155' }}>
                      {row.agent}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#64748B' }}>
                      {row.output}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <Link
                        to={row.path}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#4F46E5',
                          textDecoration: 'none',
                          background: '#EEF2FF',
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: '1px solid #C7D2FE',
                        }}
                      >
                        Visit Page ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Four-Component Manufacturing AI Agent Blueprint View */}
      {activeMainTab === 'blueprint' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
            <button
              onClick={() => setActiveMainTab('architecture')}
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: '#F0F9FF',
                color: '#0284C7',
                border: '1px solid #BAE6FD',
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              ← Back to Architecture Canvas
            </button>
          </div>
          <FourComponentFramework />
        </div>
      )}
    </div>
  )
}
