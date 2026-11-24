import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useShell } from '../shell-context'
import { AXIS, TIP } from '../theme'

// ─── Inventory Filter Types & Interfaces ───────────────────────────────────

type HorizonOption = 'as_of' | '14d' | '30d' | '60d' | '90d'

interface FilterState {
  horizon: HorizonOption
  plant: string
  warehouse: string
  category: string
  status: string
  productModel: string
  activeAct: 'all' | 'working_capital' | 'line_stop' | 'supplier_delays' | 'quality_expiry' | 'proposals'
}

// ─── Real Domain Master Data (Electronics Manufacturing / Smartphone BOM) ──

interface MaterialItem {
  id: string
  name: string
  category: string
  plant: string
  warehouse: string
  uom: string
  unitCost: number
  onHandQty: number
  usableQty: number
  safetyStockQty: number
  daysOfCover: number
  stockValueLakhs: number
  status: 'critical' | 'at_risk' | 'healthy' | 'excess' | 'qc_hold'
  supplierId: string
  supplierName: string
  ordersAffected: number
  proposedAction: string
  proposalId?: string
  stockoutDay: number
}

const INVENTORY_MASTER: MaterialItem[] = [
  {
    id: 'MAT-PCB-004',
    name: '6-layer Main PCB',
    category: 'PCB',
    plant: 'IN-KA-01',
    warehouse: 'RM-WH-01',
    uom: 'EA',
    unitCost: 680,
    onHandQty: 1420,
    usableQty: 1420,
    safetyStockQty: 4500,
    daysOfCover: 18,
    stockValueLakhs: 9.65,
    status: 'critical',
    supplierId: 'SUP-003',
    supplierName: 'Taiwan PCB Works',
    ordersAffected: 24000,
    proposedAction: 'AGT-05: Expedite PO-8821 (+18d lead time slip) & Transfer 1,200 EA from Chennai',
    proposalId: 'PRP-2026-081',
    stockoutDay: 18,
  },
  {
    id: 'MAT-SOC-001',
    name: 'Application Processor SoC',
    category: 'SEMICONDUCTOR',
    plant: 'IN-KA-01',
    warehouse: 'SMT-KIT-01',
    uom: 'EA',
    unitCost: 4200,
    onHandQty: 1850,
    usableQty: 1650,
    safetyStockQty: 2500,
    daysOfCover: 21,
    stockValueLakhs: 77.7,
    status: 'critical',
    supplierId: 'SUP-001',
    supplierName: 'Shenzhen Silicon Systems',
    ordersAffected: 18500,
    proposedAction: 'AGT-05: Air-freight 1,000 EA from Shenzhen Buffer Hub',
    proposalId: 'PRP-2026-084',
    stockoutDay: 21,
  },
  {
    id: 'MAT-CAM-007',
    name: 'Rear Camera Module (50MP)',
    category: 'CAMERA',
    plant: 'IN-TN-01',
    warehouse: 'RM-WH-01',
    uom: 'EA',
    unitCost: 720,
    onHandQty: 2980,
    usableQty: 2480,
    safetyStockQty: 4964,
    daysOfCover: 24,
    stockValueLakhs: 21.45,
    status: 'critical',
    supplierId: 'SUP-006',
    supplierName: 'OptiCam Modules',
    ordersAffected: 12000,
    proposedAction: 'AGT-05: Split release PO-8902 with 2nd source vendor',
    proposalId: 'PRP-2026-089',
    stockoutDay: 24,
  },
  {
    id: 'MAT-PASTE-017',
    name: 'Solder Paste SAC305 (T4)',
    category: 'CONSUMABLE',
    plant: 'IN-TN-01',
    warehouse: 'RM-WH-01',
    uom: 'KG',
    unitCost: 6200,
    onHandQty: 480,
    usableQty: 180,
    safetyStockQty: 350,
    daysOfCover: 12,
    stockValueLakhs: 29.76,
    status: 'qc_hold',
    supplierId: 'SUP-010',
    supplierName: 'SolderPro Materials',
    ordersAffected: 8500,
    proposedAction: 'AGT-01: Expedite QC moisture test release on 300 KG lot',
    proposalId: 'PRP-2026-092',
    stockoutDay: 12,
  },
  {
    id: 'MAT-DSP-005',
    name: '6.5in 120Hz AMOLED Display',
    category: 'DISPLAY',
    plant: 'IN-KA-01',
    warehouse: 'WIP-WH-01',
    uom: 'EA',
    unitCost: 1650,
    onHandQty: 5400,
    usableQty: 4800,
    safetyStockQty: 4639,
    daysOfCover: 32,
    stockValueLakhs: 89.1,
    status: 'at_risk',
    supplierId: 'SUP-004',
    supplierName: 'Chennai Display Components',
    ordersAffected: 6200,
    proposedAction: 'AGT-04: Reallocate 600 EA buffer from Aster 15 Lite to Pro line',
    proposalId: 'PRP-2026-076',
    stockoutDay: 32,
  },
  {
    id: 'MAT-MEM-002',
    name: '12GB LPDDR5 Memory IC',
    category: 'SEMICONDUCTOR',
    plant: 'IN-TN-01',
    warehouse: 'SMT-KIT-01',
    uom: 'EA',
    unitCost: 1100,
    onHandQty: 8200,
    usableQty: 7900,
    safetyStockQty: 4967,
    daysOfCover: 44,
    stockValueLakhs: 90.2,
    status: 'healthy',
    supplierId: 'SUP-002',
    supplierName: 'Korea Memory Tech',
    ordersAffected: 0,
    proposedAction: 'Healthy stock position. PO delivery on schedule.',
    stockoutDay: 44,
  },
  {
    id: 'MAT-NAND-003',
    name: '256GB UFS 3.1 Storage IC',
    category: 'SEMICONDUCTOR',
    plant: 'IN-KA-01',
    warehouse: 'SMT-KIT-01',
    uom: 'EA',
    unitCost: 950,
    onHandQty: 6800,
    usableQty: 6500,
    safetyStockQty: 3956,
    daysOfCover: 48,
    stockValueLakhs: 64.6,
    status: 'healthy',
    supplierId: 'SUP-002',
    supplierName: 'Korea Memory Tech',
    ordersAffected: 0,
    proposedAction: 'Optimal stock buffer maintaining 48-day coverage.',
    stockoutDay: 48,
  },
  {
    id: 'MAT-BAT-006',
    name: '5000mAh Li-ion Battery Pack',
    category: 'BATTERY',
    plant: 'IN-KA-01',
    warehouse: 'RM-WH-01',
    uom: 'EA',
    unitCost: 820,
    onHandQty: 7400,
    usableQty: 7100,
    safetyStockQty: 2128,
    daysOfCover: 52,
    stockValueLakhs: 60.68,
    status: 'healthy',
    supplierId: 'SUP-005',
    supplierName: 'VoltCell Energy',
    ordersAffected: 0,
    proposedAction: 'Stable inventory. Weekly inbound truck shipments active.',
    stockoutDay: 52,
  },
  {
    id: 'MAT-HSG-009',
    name: 'Aluminium CNC Mid-frame',
    category: 'MECHANICAL',
    plant: 'IN-TN-01',
    warehouse: 'RM-WH-01',
    uom: 'EA',
    unitCost: 310,
    onHandQty: 18400,
    usableQty: 18400,
    safetyStockQty: 553,
    daysOfCover: 115,
    stockValueLakhs: 57.04,
    status: 'excess',
    supplierId: 'SUP-007',
    supplierName: 'Precision Enclosures',
    ordersAffected: 0,
    proposedAction: 'AGT-06: Pause scheduled PO release & reschedule to Q1 2027',
    proposalId: 'PRP-2026-065',
    stockoutDay: 115,
  },
  {
    id: 'MAT-GLS-010',
    name: 'Corning Gorilla Glass Victus',
    category: 'MECHANICAL',
    plant: 'IN-KA-01',
    warehouse: 'RM-WH-01',
    uom: 'EA',
    unitCost: 190,
    onHandQty: 14200,
    usableQty: 14200,
    safetyStockQty: 3962,
    daysOfCover: 94,
    stockValueLakhs: 26.98,
    status: 'excess',
    supplierId: 'SUP-007',
    supplierName: 'Precision Enclosures',
    ordersAffected: 0,
    proposedAction: 'AGT-06: Liquidate 4,000 EA excess to secondary service hub',
    proposalId: 'PRP-2026-068',
    stockoutDay: 94,
  },
  {
    id: 'MAT-ANT-012',
    name: '5G RF Antenna Flex Array',
    category: 'RF',
    plant: 'IN-TN-01',
    warehouse: 'RM-WH-01',
    uom: 'EA',
    unitCost: 55,
    onHandQty: 9200,
    usableQty: 8900,
    safetyStockQty: 3257,
    daysOfCover: 58,
    stockValueLakhs: 5.06,
    status: 'healthy',
    supplierId: 'SUP-009',
    supplierName: 'RF Connect Systems',
    ordersAffected: 0,
    proposedAction: 'Adequate stock with low unit cost.',
    stockoutDay: 58,
  },
  {
    id: 'MAT-ADH-018',
    name: 'Thermal Interface Adhesive 3W',
    category: 'CONSUMABLE',
    plant: 'IN-KA-01',
    warehouse: 'RM-WH-01',
    uom: 'KG',
    unitCost: 1800,
    onHandQty: 620,
    usableQty: 340,
    safetyStockQty: 400,
    daysOfCover: 28,
    stockValueLakhs: 11.16,
    status: 'qc_hold',
    supplierId: 'SUP-010',
    supplierName: 'SolderPro Materials',
    ordersAffected: 3200,
    proposedAction: 'AGT-01: Re-inspect cold-chain temperature logger before release',
    proposalId: 'PRP-2026-095',
    stockoutDay: 28,
  },
]

// ─── Supplier Performance Data (Inbound Delivery & Lead-Time Variance) ───

const SUPPLIER_INBOUND_DATA = [
  { supplier: 'Taiwan PCB Works', onTime: 12, delayed: 9, avgSlipDays: 18, risk: 'HIGH', category: 'PCB' },
  { supplier: 'Shenzhen Silicon', onTime: 18, delayed: 8, avgSlipDays: 14, risk: 'HIGH', category: 'SEMICONDUCTOR' },
  { supplier: 'OptiCam Modules', onTime: 16, delayed: 7, avgSlipDays: 12, risk: 'MEDIUM', category: 'CAMERA' },
  { supplier: 'VoltCell Energy', onTime: 19, delayed: 5, avgSlipDays: 6, risk: 'MEDIUM', category: 'BATTERY' },
  { supplier: 'Chennai Display', onTime: 20, delayed: 4, avgSlipDays: 5, risk: 'LOW', category: 'DISPLAY' },
  { supplier: 'Korea Memory Tech', onTime: 24, delayed: 3, avgSlipDays: 4, risk: 'LOW', category: 'SEMICONDUCTOR' },
]

// ─── 90-Day Aggregate Stock Depletion Run-Rate Data ────────────────────────

const DEPLETION_TREND_DATA = [
  { week: 'W-0 (Oct 31)', stockValue: 68.42, safetyThreshold: 18.5, baselineBurn: 68.42 },
  { week: 'W+1 (Nov 07)', stockValue: 61.2, safetyThreshold: 18.5, baselineBurn: 62.1 },
  { week: 'W+2 (Nov 14)', stockValue: 53.8, safetyThreshold: 18.5, baselineBurn: 55.4 },
  { week: 'W+3 (Nov 21)', stockValue: 44.1, safetyThreshold: 18.5, baselineBurn: 48.2 },
  { week: 'W+4 (Nov 28)', stockValue: 36.5, safetyThreshold: 18.5, baselineBurn: 41.0 },
  { week: 'W+6 (Dec 12)', stockValue: 24.8, safetyThreshold: 18.5, baselineBurn: 29.5 },
  { week: 'W+8 (Dec 26)', stockValue: 17.2, safetyThreshold: 18.5, baselineBurn: 20.1 },
  { week: 'W+10 (Jan 09)', stockValue: 12.4, safetyThreshold: 18.5, baselineBurn: 14.8 },
  { week: 'W+12 (Jan 23)', stockValue: 8.9, safetyThreshold: 18.5, baselineBurn: 10.2 },
]

// ─── Plant Line Fill Rate Adherence Data ───────────────────────────────────

const PLANT_FILL_RATE_DATA = [
  { week: 'W-7', bengaluruLine: 91.2, chennaiLine: 89.4, benchmark: 98.0 },
  { week: 'W-6', bengaluruLine: 92.4, chennaiLine: 90.1, benchmark: 98.0 },
  { week: 'W-5', bengaluruLine: 93.1, chennaiLine: 91.5, benchmark: 98.0 },
  { week: 'W-4', bengaluruLine: 94.6, chennaiLine: 92.8, benchmark: 98.0 },
  { week: 'W-3', bengaluruLine: 95.2, chennaiLine: 93.4, benchmark: 98.0 },
  { week: 'W-2', bengaluruLine: 95.8, chennaiLine: 94.2, benchmark: 98.0 },
  { week: 'W-1', bengaluruLine: 96.4, chennaiLine: 95.1, benchmark: 98.0 },
  { week: 'Current', bengaluruLine: 96.8, chennaiLine: 95.6, benchmark: 98.0 },
]

// ─── Daily Warehouse Inflow (GRN) vs Shop-Floor BOM Consumption ───────────

const DAILY_FLOW_DATA = [
  { day: 'Oct 18', inboundGRN: 42, shopFloorBurn: 45 },
  { day: 'Oct 20', inboundGRN: 51, shopFloorBurn: 48 },
  { day: 'Oct 22', inboundGRN: 38, shopFloorBurn: 52 },
  { day: 'Oct 24', inboundGRN: 64, shopFloorBurn: 50 },
  { day: 'Oct 26', inboundGRN: 45, shopFloorBurn: 54 },
  { day: 'Oct 28', inboundGRN: 58, shopFloorBurn: 53 },
  { day: 'Oct 30', inboundGRN: 49, shopFloorBurn: 55 },
  { day: 'Oct 31', inboundGRN: 54, shopFloorBurn: 52 },
]

export function Overview() {
  const { plant: shellPlant, setPlant: setShellPlant } = useShell()

  // ─── State Filter Engine ────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>({
    horizon: 'as_of',
    plant: shellPlant || '',
    warehouse: '',
    category: '',
    status: '',
    productModel: '',
    activeAct: 'all',
  })

  // View state for Chart 4: Days of Supply Matrix
  const [matrixView, setMatrixView] = useState<'bars' | 'matrix'>('bars')
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'shortage' | 'healthy' | 'excess'>('all')

  // Synchronize shell plant with local filter
  useEffect(() => {
    if (shellPlant && shellPlant !== filters.plant) {
      setFilters((prev) => ({ ...prev, plant: shellPlant }))
    }
  }, [shellPlant])

  const handlePlantChange = (p: string) => {
    setFilters((prev) => ({ ...prev, plant: p }))
    setShellPlant(p)
  }

  // ─── Filter Logic ───────────────────────────────────────────────────────
  const filteredMaterials = useMemo(() => {
    return INVENTORY_MASTER.filter((m) => {
      if (filters.plant && m.plant !== filters.plant) return false
      if (filters.warehouse && m.warehouse !== filters.warehouse) return false
      if (filters.category && m.category !== filters.category) return false
      if (filters.status && m.status !== filters.status) return false
      if (filters.activeAct === 'line_stop' && m.status !== 'critical') return false
      if (filters.activeAct === 'quality_expiry' && m.status !== 'qc_hold') return false
      if (filters.activeAct === 'working_capital' && m.status !== 'excess') return false
      return true
    })
  }, [filters])

  // Aggregate Metrics based on filtered items
  const totalStockValueCr = useMemo(() => {
    const sumLakhs = filteredMaterials.reduce((acc, curr) => acc + curr.stockValueLakhs, 0)
    return (sumLakhs / 100).toFixed(2)
  }, [filteredMaterials])

  const criticalCount = useMemo(() => {
    return filteredMaterials.filter((m) => m.status === 'critical').length
  }, [filteredMaterials])

  const qcHoldValueLakhs = useMemo(() => {
    return filteredMaterials
      .filter((m) => m.status === 'qc_hold')
      .reduce((acc, curr) => acc + curr.stockValueLakhs, 0)
      .toFixed(1)
  }, [filteredMaterials])

  const excessValueCr = useMemo(() => {
    const sumLakhs = filteredMaterials
      .filter((m) => m.status === 'excess')
      .reduce((acc, curr) => acc + curr.stockValueLakhs, 0)
    return (sumLakhs / 100).toFixed(2)
  }, [filteredMaterials])

  // ─── Donut Chart Slices (Valuation by Stock Health) ───────────────────────
  const healthDistributionData = useMemo(() => {
    let healthyVal = 0
    let excessVal = 0
    let criticalVal = 0
    let atRiskVal = 0
    let qcVal = 0

    filteredMaterials.forEach((m) => {
      if (m.status === 'healthy') healthyVal += m.stockValueLakhs
      else if (m.status === 'excess') excessVal += m.stockValueLakhs
      else if (m.status === 'critical') criticalVal += m.stockValueLakhs
      else if (m.status === 'at_risk') atRiskVal += m.stockValueLakhs
      else if (m.status === 'qc_hold') qcVal += m.stockValueLakhs
    })

    return [
      { name: 'Healthy Buffer (15–60d)', value: Number((healthyVal / 100).toFixed(2)), color: '#10b981' },
      { name: 'Excess & Obsolete (>60d)', value: Number((excessVal / 100).toFixed(2)), color: '#8b5cf6' },
      { name: 'Critical Shortage (<7d)', value: Number((criticalVal / 100).toFixed(2)), color: '#ef4444' },
      { name: 'At-Risk Buffer (8–14d)', value: Number((atRiskVal / 100).toFixed(2)), color: '#f59e0b' },
      { name: 'Quality Hold / Blocked', value: Number((qcVal / 100).toFixed(2)), color: '#06b6d4' },
    ].filter((d) => d.value > 0)
  }, [filteredMaterials])

  // ─── Supply Duration & Capital Matrix Data ─────────────────────────────
  const supplyMatrixData = useMemo(() => {
    let list = filteredMaterials.map((m) => {
      let tier: 'shortage' | 'at_risk' | 'healthy' | 'excess' = 'healthy'
      let tierLabel = 'Optimal Buffer'
      let color = '#10b981'
      if (m.daysOfCover < 20) {
        tier = 'shortage'
        tierLabel = 'Critical Shortage (<20d)'
        color = '#ef4444'
      } else if (m.daysOfCover <= 35) {
        tier = 'at_risk'
        tierLabel = 'Tight Buffer (20–35d)'
        color = '#f59e0b'
      } else if (m.daysOfCover > 60) {
        tier = 'excess'
        tierLabel = 'Trapped Capital (>60d)'
        color = '#8b5cf6'
      }
      return {
        name: m.name.length > 20 ? m.name.slice(0, 18) + '…' : m.name,
        fullName: m.name,
        id: m.id,
        category: m.category,
        daysOfCover: m.daysOfCover,
        stockValueLakhs: m.stockValueLakhs,
        unitCost: m.unitCost,
        tier,
        tierLabel,
        color,
        status: m.status,
        proposedAction: m.proposedAction,
      }
    })

    if (matrixFilter === 'shortage') list = list.filter((d) => d.daysOfCover <= 35)
    else if (matrixFilter === 'healthy') list = list.filter((d) => d.daysOfCover > 35 && d.daysOfCover <= 60)
    else if (matrixFilter === 'excess') list = list.filter((d) => d.daysOfCover > 60)

    return list.sort((a, b) => a.daysOfCover - b.daysOfCover).slice(0, 7)
  }, [filteredMaterials, matrixFilter])

  const matrixQuadrants = useMemo(() => {
    const shortage = filteredMaterials.filter((m) => m.daysOfCover < 20)
    const atRisk = filteredMaterials.filter((m) => m.daysOfCover >= 20 && m.daysOfCover <= 35)
    const healthy = filteredMaterials.filter((m) => m.daysOfCover > 35 && m.daysOfCover <= 60)
    const excess = filteredMaterials.filter((m) => m.daysOfCover > 60)

    const sumVal = (arr: typeof filteredMaterials) => arr.reduce((acc, m) => acc + m.stockValueLakhs, 0).toFixed(1)

    return {
      shortage: { items: shortage, totalValue: sumVal(shortage) },
      atRisk: { items: atRisk, totalValue: sumVal(atRisk) },
      healthy: { items: healthy, totalValue: sumVal(healthy) },
      excess: { items: excess, totalValue: sumVal(excess) },
    }
  }, [filteredMaterials])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      {/* ── Top Header Title ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span>Inventory Management</span>
            <span>/</span>
            <span style={{ color: '#111827', fontWeight: 600 }}>Executive 360 Overview</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
            Inventory Posture & Multi-Plant Control Tower
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Refreshed run #41 · Data as of 31-Oct-2026 · Electronics Manufacturing BOM & Multi-Tier SMT/Box-Build
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            to="/home"
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              color: '#374151',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            ← System Architecture
          </Link>
          <Link
            to="/shortages"
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
            }}
          >
            Shortage Horizon Matrix →
          </Link>
        </div>
      </div>

      {/* ── 1. INVENTORY MANAGEMENT FILTER ENGINE ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '18px 22px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Inventory Operational Filter Engine
            </span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>•</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Deterministic filtering across 18 active smartphone BOM components
            </span>
          </div>

          {/* Horizon Toggle Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', padding: 3, borderRadius: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', padding: '0 8px', textTransform: 'uppercase' }}>
              Horizon:
            </span>
            {(
              [
                ['as_of', 'Latest Run (Oct 31)'],
                ['14d', '14-Day Tactical'],
                ['30d', '30-Day Operational'],
                ['60d', '60-Day Forward'],
                ['90d', '90-Day Quarter'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilters((f) => ({ ...f, horizon: val }))}
                style={{
                  padding: '5px 11px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: filters.horizon === val ? 700 : 500,
                  background: filters.horizon === val ? '#ffffff' : 'transparent',
                  color: filters.horizon === val ? '#7c3aed' : '#4b5563',
                  boxShadow: filters.horizon === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Pure Inventory Dropdowns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            paddingTop: 4,
          }}
        >
          {/* Filter 1: Plant */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Manufacturing Facility (Plant)
            </label>
            <select
              value={filters.plant}
              onChange={(e) => handlePlantChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                fontWeight: 600,
                color: '#1f2937',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="">All Plants (Bengaluru IN-KA-01 + Chennai IN-TN-01)</option>
              <option value="IN-KA-01">IN-KA-01 · Bengaluru Box-Build Plant</option>
              <option value="IN-TN-01">IN-TN-01 · Chennai SMT Assembly Plant</option>
            </select>
          </div>

          {/* Filter 2: Warehouse Location */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Storage Location / Warehouse
            </label>
            <select
              value={filters.warehouse}
              onChange={(e) => setFilters((f) => ({ ...f, warehouse: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                fontWeight: 600,
                color: '#1f2937',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="">All Warehouses (Raw, SMT, WIP, FG)</option>
              <option value="RM-WH-01">RM-WH-01 · Raw Materials Warehouse</option>
              <option value="SMT-KIT-01">SMT-KIT-01 · SMT Component Kitting Area</option>
              <option value="WIP-WH-01">WIP-WH-01 · WIP Sub-Assembly Staging</option>
              <option value="FG-WH-01">FG-WH-01 · Finished Goods Vault</option>
            </select>
          </div>

          {/* Filter 3: Material Category */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Material Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                fontWeight: 600,
                color: '#1f2937',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="">All Categories (18 Materials)</option>
              <option value="SEMICONDUCTOR">SEMICONDUCTOR · Processors & Memory ICs</option>
              <option value="PCB">PCB · 6-Layer Main PCB & Substrates</option>
              <option value="DISPLAY">DISPLAY · 6.5in 120Hz AMOLED Screens</option>
              <option value="BATTERY">BATTERY · 5000mAh Li-ion Packs</option>
              <option value="CAMERA">CAMERA · 50MP Rear & Front Modules</option>
              <option value="MECHANICAL">MECHANICAL · Mid-frame, Glass & Screws</option>
              <option value="CONSUMABLE">CONSUMABLE · Solder Paste & Thermal Adhesives</option>
              <option value="RF">RF · 5G Antenna Arrays</option>
            </select>
          </div>

          {/* Filter 4: Stock Health Status */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Inventory Health Condition
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                fontWeight: 600,
                color: '#1f2937',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="">All Health Conditions (Full Inventory)</option>
              <option value="critical">🔴 Critical Shortage (&lt;7 Days of Cover)</option>
              <option value="at_risk">🟡 At-Risk Buffer (8–14 Days)</option>
              <option value="healthy">🟢 Healthy Coverage (15–60 Days)</option>
              <option value="excess">🟣 Excess &amp; Obsolete (&gt;60 Days Idle)</option>
              <option value="qc_hold">⚠️ Quality Hold &amp; Quarantine</option>
            </select>
          </div>
        </div>

        {/* Filter status strip & Reset action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            <span>
              Active Filter:{' '}
              <b>
                {filters.plant ? filters.plant : 'Both Plants'} •{' '}
                {filters.warehouse ? filters.warehouse : 'All Warehouses'} •{' '}
                {filters.category ? filters.category : 'All Categories'} •{' '}
                {filters.status ? filters.status.toUpperCase() : 'All Statuses'}
              </b>{' '}
              ({filteredMaterials.length} of {INVENTORY_MASTER.length} materials matching)
            </span>
          </div>

          {(filters.plant || filters.warehouse || filters.category || filters.status || filters.activeAct !== 'all') && (
            <button
              onClick={() =>
                setFilters({
                  horizon: 'as_of',
                  plant: '',
                  warehouse: '',
                  category: '',
                  status: '',
                  productModel: '',
                  activeAct: 'all',
                })
              }
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* ── 2. THE 5-ACT INVENTORY STORYLINE (CLICKABLE KPI TILES) ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            5-Act Inventory Storyline · The 5 Core Questions Answered
          </div>
          <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>
            Click any Act card below to spotlight that operational stage
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          {/* Act 1: Working Capital */}
          <div
            onClick={() =>
              setFilters((f) => ({
                ...f,
                activeAct: f.activeAct === 'working_capital' ? 'all' : 'working_capital',
              }))
            }
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '16px 18px',
              border: filters.activeAct === 'working_capital' ? '2px solid #7c3aed' : '1px solid #e5e7eb',
              boxShadow: filters.activeAct === 'working_capital' ? '0 4px 12px rgba(124, 58, 237, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', letterSpacing: '0.05em' }}>
                ACT 01 · WORKING CAPITAL
              </span>
              <span style={{ fontSize: 10, background: '#f5f3ff', color: '#7c3aed', padding: '2px 7px', borderRadius: 12, fontWeight: 700 }}>
                CASH IN STOCK
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              ₹{totalStockValueCr} Cr
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Total On-Hand Valuation across {filteredMaterials.length} materials
            </div>
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>₹42.8 Cr Usable</span>
              <span style={{ color: '#d1d5db' }}>•</span>
              <span style={{ color: '#8b5cf6' }}>₹{excessValueCr} Cr E&amp;O</span>
            </div>
          </div>

          {/* Act 2: Line Stop Risk */}
          <div
            onClick={() =>
              setFilters((f) => ({
                ...f,
                activeAct: f.activeAct === 'line_stop' ? 'all' : 'line_stop',
              }))
            }
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '16px 18px',
              border: filters.activeAct === 'line_stop' ? '2px solid #ef4444' : '1px solid #e5e7eb',
              boxShadow: filters.activeAct === 'line_stop' ? '0 4px 12px rgba(239, 68, 68, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '0.05em' }}>
                ACT 02 · LINE-STOP RISK
              </span>
              <span style={{ fontSize: 10, background: '#fef2f2', color: '#ef4444', padding: '2px 7px', borderRadius: 12, fontWeight: 700 }}>
                &lt;7D SHORTAGE
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {criticalCount} Critical Parts
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Immediate production halt hazard on Aster 15 &amp; Pro
            </div>
            <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 8 }}>
              6-Layer PCB Day 18 · 24,000 Phones at Risk
            </div>
          </div>

          {/* Act 3: Supplier PO Delays */}
          <div
            onClick={() =>
              setFilters((f) => ({
                ...f,
                activeAct: f.activeAct === 'supplier_delays' ? 'all' : 'supplier_delays',
              }))
            }
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '16px 18px',
              border: filters.activeAct === 'supplier_delays' ? '2px solid #f59e0b' : '1px solid #e5e7eb',
              boxShadow: filters.activeAct === 'supplier_delays' ? '0 4px 12px rgba(245, 158, 11, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', letterSpacing: '0.05em' }}>
                ACT 03 · SUPPLIER PO DELAYS
              </span>
              <span style={{ fontSize: 10, background: '#fffbeb', color: '#d97706', padding: '2px 7px', borderRadius: 12, fontWeight: 700 }}>
                10 SUPPLIERS
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              14 Delayed PO Lines
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Inbound supplier delivery slippage (+4d to +18d)
            </div>
            <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600, marginTop: 8 }}>
              Taiwan PCB Works (+18d) · Shenzhen Silicon (+14d)
            </div>
          </div>

          {/* Act 4: Quality & Expiry */}
          <div
            onClick={() =>
              setFilters((f) => ({
                ...f,
                activeAct: f.activeAct === 'quality_expiry' ? 'all' : 'quality_expiry',
              }))
            }
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '16px 18px',
              border: filters.activeAct === 'quality_expiry' ? '2px solid #06b6d4' : '1px solid #e5e7eb',
              boxShadow: filters.activeAct === 'quality_expiry' ? '0 4px 12px rgba(6, 182, 212, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', letterSpacing: '0.05em' }}>
                ACT 04 · QUALITY &amp; EXPIRY
              </span>
              <span style={{ fontSize: 10, background: '#ecfeff', color: '#0891b2', padding: '2px 7px', borderRadius: 12, fontWeight: 700 }}>
                QC QUARANTINE
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0891b2', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              ₹{qcHoldValueLakhs} Lakhs
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Trapped in QC Hold &amp; 180-day shelf-life aging
            </div>
            <div style={{ fontSize: 11, color: '#0e7490', fontWeight: 600, marginTop: 8 }}>
              Solder Paste SAC305 (300 KG) &amp; Thermal Adhesive
            </div>
          </div>

          {/* Act 5: Agent Mitigation */}
          <div
            onClick={() =>
              setFilters((f) => ({
                ...f,
                activeAct: f.activeAct === 'proposals' ? 'all' : 'proposals',
              }))
            }
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '16px 18px',
              border: filters.activeAct === 'proposals' ? '2px solid #10b981' : '1px solid #e5e7eb',
              boxShadow: filters.activeAct === 'proposals' ? '0 4px 12px rgba(16, 185, 129, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', letterSpacing: '0.05em' }}>
                ACT 05 · AI AGENT ACTIONS
              </span>
              <span style={{ fontSize: 10, background: '#ecfdf5', color: '#059669', padding: '2px 7px', borderRadius: 12, fontWeight: 700 }}>
                6 PROPOSALS
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              ₹8.24 Cr Mitigated
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Automated PO expedites, stock transfers &amp; write-offs
            </div>
            <div style={{ fontSize: 11, color: '#047857', fontWeight: 600, marginTop: 8 }}>
              4 Pending Buyer Sign-Off · 2 Manager Escalations
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. ROW 1 CHARTS: INVENTORY HEALTH & 90-DAY DEPLETION HORIZON ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 16 }}>
        {/* Chart 1: Donut Chart */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '20px 22px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                Inventory Valuation by Health Condition
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Financial capital breakdown across healthy buffers, critical shortages, E&amp;O and QC hold
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, background: '#f5f3ff', color: '#7c3aed', padding: '3px 8px', borderRadius: 6 }}>
              DONUT
            </span>
          </div>

          <div style={{ height: 260, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={healthDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {healthDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `₹${Number(val ?? 0).toFixed(2)} Cr`,
                    name ?? '',
                  ]}
                  contentStyle={TIP}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Donut Center Display */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>₹{totalStockValueCr} Cr</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                Total Stock
              </div>
            </div>
          </div>

          {/* Slices Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 }}>
            {healthDistributionData.map((d) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4b5563' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }}></span>
                <span>{d.name}</span>
                <span style={{ fontWeight: 700, color: '#111827' }}>₹{d.value} Cr</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: 90-Day Material Depletion Run-Rate (Area Chart) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '20px 22px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                90-Day Aggregate Stock Depletion Run-Rate
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Projected stock drawdown against factory Safety Stock Threshold (₹18.5 Cr buffer breach on Day 22)
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, background: '#f5f3ff', color: '#7c3aed', padding: '3px 8px', borderRadius: 6 }}>
              AREA TREND
            </span>
          </div>

          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DEPLETION_TREND_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="depletionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tick={AXIS} tickLine={false} />
                <YAxis tick={AXIS} tickLine={false} tickFormatter={(v) => `₹${v}Cr`} domain={[0, 80]} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val ?? 0).toFixed(1)} Cr`, 'Stock Value']}
                  contentStyle={TIP}
                />
                <ReferenceLine y={18.5} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Safety Threshold (₹18.5Cr)', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
                <Area type="monotone" dataKey="stockValue" stroke="#7c3aed" strokeWidth={2.5} fillOpacity={1} fill="url(#depletionGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11, color: '#6b7280' }}>
            <span>Starting Stock: <b>₹68.42 Cr</b> (Oct 31)</span>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠️ Critical Inbound Replenishment Required by Nov 21</span>
          </div>
        </div>
      </div>

      {/* ── 4. ROW 2 & 3: 4 ANALYTICAL CHARTS (2×2 GRID) — 100% INVENTORY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 16 }}>
        {/* Chart 3: Supplier Inbound Reliability & Lead-Time Slippages (Bar Chart) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '20px 22px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                Supplier Inbound Delivery Reliability &amp; Delays
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                On-Time vs Delayed Inbound Purchase Order lots across 6 core approved component vendors
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 6 }}>
              SUPPLIER BAR
            </span>
          </div>

          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SUPPLIER_INBOUND_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="supplier" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
                <YAxis tick={AXIS} tickLine={false} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `${val} POs`,
                    name === 'onTime' ? 'On-Time Lots' : 'Delayed Lots',
                  ]}
                  contentStyle={TIP}
                />
                <Bar dataKey="onTime" name="On-Time Receipts" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delayed" name="Delayed Deliveries" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11 }}>
            <span style={{ color: '#4b5563' }}>
              Highest Slippage Risk: <b style={{ color: '#ef4444' }}>Taiwan PCB Works (+18 Days Delay)</b>
            </span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>Top Reliability: Korea Memory Tech (88.9%)</span>
          </div>
        </div>

        {/* Chart 4: Days of Supply & Capital Valuation Matrix (Ranked Bars & 4-Quadrant View) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '20px 22px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                Days of Supply &amp; Capital Valuation Matrix
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Critical Shortages (&lt;20d) vs Balanced Buffer (20–60d) vs Trapped Capital (&gt;60d)
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* View Switcher: Bars vs 4-Quadrant Matrix */}
              <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 7, padding: 2 }}>
                <button
                  type="button"
                  onClick={() => setMatrixView('bars')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 5,
                    border: 'none',
                    background: matrixView === 'bars' ? '#ffffff' : 'transparent',
                    color: matrixView === 'bars' ? '#111827' : '#6b7280',
                    fontWeight: matrixView === 'bars' ? 700 : 500,
                    fontSize: 11,
                    cursor: 'pointer',
                    boxShadow: matrixView === 'bars' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>📊</span> Ranked Bars
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixView('matrix')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 5,
                    border: 'none',
                    background: matrixView === 'matrix' ? '#ffffff' : 'transparent',
                    color: matrixView === 'matrix' ? '#111827' : '#6b7280',
                    fontWeight: matrixView === 'matrix' ? 700 : 500,
                    fontSize: 11,
                    cursor: 'pointer',
                    boxShadow: matrixView === 'matrix' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>⊞</span> 4-Quadrant Grid
                </button>
              </div>

              <span style={{ fontSize: 10, fontWeight: 700, background: '#f5f3ff', color: '#7c3aed', padding: '3px 8px', borderRadius: 6 }}>
                EXPOSURE MATRIX
              </span>
            </div>
          </div>

          {/* Quick Filter Pill Buttons (Active in Bars View) */}
          {matrixView === 'bars' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Filter Tier:</span>
              {[
                { id: 'all', label: 'All SKUs' },
                { id: 'shortage', label: '🔴 Shortage & Tight (≤35d)' },
                { id: 'healthy', label: '🟢 Optimal (36–60d)' },
                { id: 'excess', label: '🟣 Trapped Capital (>60d)' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMatrixFilter(f.id as any)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 5,
                    border: matrixFilter === f.id ? '1px solid #7c3aed' : '1px solid #e5e7eb',
                    background: matrixFilter === f.id ? '#f5f3ff' : '#ffffff',
                    color: matrixFilter === f.id ? '#7c3aed' : '#4b5563',
                    fontSize: 10.5,
                    fontWeight: matrixFilter === f.id ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Content View: Ranked Horizontal Bars */}
          {matrixView === 'bars' ? (
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={supplyMatrixData}
                  layout="vertical"
                  margin={{ top: 5, right: 35, left: 10, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 130]}
                    unit="d"
                    tick={AXIS}
                    label={{ value: 'Days of Cover (DoH)', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: '#9ca3af' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={135}
                    tick={{ fontSize: 10.5, fill: '#374151', fontWeight: 600 }}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div style={{ ...TIP, padding: '10px 12px', minWidth: 220 }}>
                          <div style={{ fontWeight: 700, color: '#111827', fontSize: 12.5 }}>{d.fullName}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>ID: {d.id} • {d.category}</div>
                          <div style={{ fontSize: 12, color: d.color, fontWeight: 700 }}>
                            Days of Supply: {d.daysOfCover} days ({d.tierLabel})
                          </div>
                          <div style={{ fontSize: 12, color: '#111827', marginTop: 2 }}>
                            Stock Valuation: <b>₹{d.stockValueLakhs} Lakhs</b>
                          </div>
                          <div style={{ fontSize: 11, color: '#4b5563' }}>Unit Price: ₹{d.unitCost} / EA</div>
                          {d.proposedAction && (
                            <div style={{ fontSize: 11, color: '#6d28d9', marginTop: 6, borderTop: '1px solid #e5e7eb', paddingTop: 4 }}>
                              <b>AI Recommendation:</b> {d.proposedAction}
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                  <ReferenceLine x={20} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Shortage (<20d)', fill: '#ef4444', fontSize: 9, position: 'top' }} />
                  <ReferenceLine x={60} stroke="#8b5cf6" strokeDasharray="3 3" label={{ value: 'Excess (>60d)', fill: '#8b5cf6', fontSize: 9, position: 'top' }} />
                  <Bar dataKey="daysOfCover" radius={[0, 4, 4, 0]}>
                    {supplyMatrixData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            /* Content View: 4-Quadrant Decision Grid */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, height: 250, boxSizing: 'border-box' }}>
              {/* Q1: Shortage & Line-Stop Risk */}
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>🔴 Critical Shortage (&lt;20d)</span>
                    <span style={{ fontSize: 10, background: '#fee2e2', color: '#b91c1c', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      {matrixQuadrants.shortage.items.length} SKUs
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 5 }}>
                    Line-Stop Exposure: <b style={{ color: '#dc2626' }}>₹{matrixQuadrants.shortage.totalValue}L</b>
                  </div>
                  {matrixQuadrants.shortage.items.slice(0, 2).map((item) => (
                    <div key={item.id} style={{ fontSize: 10.5, fontWeight: 600, color: '#1f2937', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 125 }}>{item.name}</span>
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>{item.daysOfCover}d</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9.5, color: '#b91c1c', fontWeight: 600, borderTop: '1px dashed #fca5a5', paddingTop: 4 }}>
                  ⚡ Action: Expedite PO &amp; Transfer Buffer
                </div>
              </div>

              {/* Q2: Trapped Capital & Excess */}
              <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '9px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#7e22ce' }}>🟣 Trapped Capital (&gt;60d)</span>
                    <span style={{ fontSize: 10, background: '#f3e8ff', color: '#6b21a8', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      {matrixQuadrants.excess.items.length} SKUs
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 5 }}>
                    Tied-up Working Capital: <b style={{ color: '#7e22ce' }}>₹{matrixQuadrants.excess.totalValue}L</b>
                  </div>
                  {matrixQuadrants.excess.items.slice(0, 2).map((item) => (
                    <div key={item.id} style={{ fontSize: 10.5, fontWeight: 600, color: '#1f2937', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 125 }}>{item.name}</span>
                      <span style={{ color: '#7e22ce', fontWeight: 700 }}>{item.daysOfCover}d</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9.5, color: '#6b21a8', fontWeight: 600, borderTop: '1px dashed #d8b4fe', paddingTop: 4 }}>
                  ⚡ Action: Pause PO Release / Reschedule Q1
                </div>
              </div>

              {/* Q3: Tight Watchlist Buffer */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '9px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#b45309' }}>🟡 Tight Watchlist (20–35d)</span>
                    <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      {matrixQuadrants.atRisk.items.length} SKUs
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 5 }}>
                    At-Risk Buffer: <b style={{ color: '#b45309' }}>₹{matrixQuadrants.atRisk.totalValue}L</b>
                  </div>
                  {matrixQuadrants.atRisk.items.slice(0, 2).map((item) => (
                    <div key={item.id} style={{ fontSize: 10.5, fontWeight: 600, color: '#1f2937', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 125 }}>{item.name}</span>
                      <span style={{ color: '#b45309', fontWeight: 700 }}>{item.daysOfCover}d</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9.5, color: '#92400e', fontWeight: 600, borderTop: '1px dashed #fcd34d', paddingTop: 4 }}>
                  ⚡ Action: Rebalance Inter-Plant Allocation
                </div>
              </div>

              {/* Q4: Optimal Balance */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '9px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#15803d' }}>🟢 Optimal Buffer (35–60d)</span>
                    <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      {matrixQuadrants.healthy.items.length} SKUs
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 5 }}>
                    Healthy Active Stock: <b style={{ color: '#15803d' }}>₹{matrixQuadrants.healthy.totalValue}L</b>
                  </div>
                  {matrixQuadrants.healthy.items.slice(0, 2).map((item) => (
                    <div key={item.id} style={{ fontSize: 10.5, fontWeight: 600, color: '#1f2937', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 125 }}>{item.name}</span>
                      <span style={{ color: '#15803d', fontWeight: 700 }}>{item.daysOfCover}d</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9.5, color: '#166534', fontWeight: 600, borderTop: '1px dashed #86efac', paddingTop: 4 }}>
                  ✓ Smooth Flow: Inbound Shipments on Schedule
                </div>
              </div>
            </div>
          )}

          {/* Footer Metrics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 11, flexWrap: 'wrap', gap: 6, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>🔴 Critical: 6-Layer Main PCB (18d, ₹9.65L)</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>🟢 Optimal: LPDDR5 Memory (44d, ₹90.2L)</span>
            <span style={{ color: '#8b5cf6', fontWeight: 600 }}>🟣 Trapped: Mid-frame (115d, ₹57.04L)</span>
          </div>
        </div>

        {/* Chart 5: Plant Line Fill Rate & Schedule Adherence (Line Chart) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '20px 22px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                Plant Schedule Adherence &amp; BOM Line Fill Rate
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Tracking shop-floor material availability for Bengaluru Assembly vs Chennai SMT lines
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, background: '#eff6ff', color: '#3b82f6', padding: '3px 8px', borderRadius: 6 }}>
              LINE TREND
            </span>
          </div>

          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={PLANT_FILL_RATE_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="week" tick={AXIS} tickLine={false} />
                <YAxis tick={AXIS} tickLine={false} domain={[85, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `${val}%`,
                    name === 'bengaluruLine'
                      ? 'IN-KA-01 Bengaluru Line Fill'
                      : name === 'chennaiLine'
                      ? 'IN-TN-01 Chennai Line Fill'
                      : '98% Manufacturing SLA',
                  ]}
                  contentStyle={TIP}
                />
                <ReferenceLine y={98.0} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target 98.0% SLA', fill: '#f59e0b', fontSize: 10 }} />
                <Line type="monotone" dataKey="bengaluruLine" name="Bengaluru Plant" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="chennaiLine" name="Chennai Plant" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11 }}>
            <span style={{ color: '#7c3aed', fontWeight: 600 }}>Bengaluru Fill Rate: 96.8%</span>
            <span style={{ color: '#06b6d4', fontWeight: 600 }}>Chennai Fill Rate: 95.6%</span>
          </div>
        </div>

        {/* Chart 6: Daily Warehouse Inflow vs Shop-Floor BOM Consumption (TimeSeries) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '20px 22px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                Daily Warehouse Inflow (GRN) vs BOM Consumption Velocity
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Dock receiving throughput (GRN Pallets) keeping pace with manufacturing kit consumption
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', padding: '3px 8px', borderRadius: 6 }}>
              VELOCITY
            </span>
          </div>

          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DAILY_FLOW_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={AXIS} tickLine={false} />
                <YAxis tick={AXIS} tickLine={false} />
                <Tooltip contentStyle={TIP} />
                <Area type="monotone" dataKey="inboundGRN" name="Warehouse GRN Inbound (Pallets)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#inflowGrad)" />
                <Area type="monotone" dataKey="shopFloorBurn" name="Shop-Floor Kit Burn Rate" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#burnGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11, color: '#4b5563' }}>
            <span>Dock Receipts: <b>54 Pallets / Day</b></span>
            <span>Assembly Line Consumption: <b>52 Pallets / Day</b> (Balanced Flow)</span>
          </div>
        </div>
      </div>

      {/* ── 5. BOTTOM SECTION: CRITICAL NEEDS ATTENTION & AGENT MITIGATIONS ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '20px 22px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️ Immediate Attention Required: Critical Shortages &amp; Agent Proposals</span>
              <span style={{ fontSize: 11, background: '#fef2f2', color: '#ef4444', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                {filteredMaterials.filter((m) => m.status === 'critical' || m.status === 'qc_hold').length} Line Risks
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Active component constraints that will halt smartphone assembly lines unless replenished or resolved
            </div>
          </div>

          <Link
            to="/shortages"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#7c3aed',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Open Full Shortage Horizon →
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '10px 12px' }}>Material ID &amp; Name</th>
                <th style={{ padding: '10px 12px' }}>Category</th>
                <th style={{ padding: '10px 12px' }}>Facility</th>
                <th style={{ padding: '10px 12px' }}>Stock Position</th>
                <th style={{ padding: '10px 12px' }}>Days to Stockout</th>
                <th style={{ padding: '10px 12px' }}>Production Impact</th>
                <th style={{ padding: '10px 12px' }}>Autonomous AI Agent Action</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials
                .filter((m) => m.status === 'critical' || m.status === 'qc_hold' || m.status === 'at_risk')
                .map((m) => {
                  const isCritical = m.status === 'critical'
                  const isQc = m.status === 'qc_hold'
                  return (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: isCritical ? '#fffdfd' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: 600, color: '#111827' }}>
                        <Link to={`/materials/${m.id}`} style={{ color: '#111827', textDecoration: 'none' }}>
                          <span style={{ color: '#7c3aed', fontWeight: 700 }}>{m.id}</span>
                          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>{m.name}</div>
                        </Link>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#f3f4f6', color: '#4b5563', padding: '2px 6px', borderRadius: 4 }}>
                          {m.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#4b5563' }}>
                        <div>{m.plant}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{m.warehouse}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600, color: isCritical ? '#ef4444' : '#111827' }}>
                          {m.usableQty.toLocaleString()} {m.uom}
                        </div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>Safety Stock: {m.safetyStockQty.toLocaleString()}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontWeight: 700,
                            fontSize: 11,
                            background: isCritical ? '#fef2f2' : isQc ? '#ecfeff' : '#fffbeb',
                            color: isCritical ? '#dc2626' : isQc ? '#0891b2' : '#d97706',
                          }}
                        >
                          {isCritical ? `🔴 Day ${m.stockoutDay}` : isQc ? '⚠️ QC Quarantine' : `🟡 Day ${m.stockoutDay}`}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#4b5563' }}>
                        <b style={{ color: '#111827' }}>{m.ordersAffected.toLocaleString()}</b> units Aster 15
                      </td>
                      <td style={{ padding: '12px', color: '#374151', fontSize: 11, maxWidth: 280 }}>
                        {m.proposedAction}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {m.proposalId ? (
                          <Link
                            to={`/proposals/${m.proposalId}`}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              background: '#f5f3ff',
                              color: '#7c3aed',
                              fontWeight: 700,
                              fontSize: 11,
                              textDecoration: 'none',
                              display: 'inline-block',
                              border: '1px solid #e9d5ff',
                            }}
                          >
                            Review Proposal →
                          </Link>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
