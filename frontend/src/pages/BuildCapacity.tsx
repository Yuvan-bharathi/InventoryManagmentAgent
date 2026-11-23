import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { api } from '../api'
import { formatQty, inr } from '../format'
import { Icon } from '../icons'
import { useShell } from '../shell-context'
import { Link } from 'react-router-dom'

interface ComponentCapacity {
  material_id: string
  material_name: string
  category: string
  uom: string
  usable_stock: number
  safety_stock_qty?: number
  net_usable_after_ss?: number
  is_below_safety_stock?: boolean
  qty_per_product: number
  scrap_factor: number
  adjusted_req_per_unit: number
  supported_capacity: number
  protected_capacity?: number
}

interface ProductCapacity {
  product_id: string
  product_name: string
  max_production_capacity: number
  protected_production_capacity?: number
  parts_below_ss_count?: number
  bottleneck_material: string
  bottleneck_material_id: string
  components: ComponentCapacity[]
}

interface CapacityResponse {
  products: ProductCapacity[]
  summary: {
    total_buildable_units: number
    total_protected_units?: number
    product_count: number
    bottlenecks: Array<{
      product_id: string
      product_name: string
      material_id: string
      material_name: string
      limiting_capacity: number
      usable_stock: number
      uom: string
    }>
  }
}

interface PackagingConversion {
  material_id: string
  material_name: string
  purchase_uom: string
  inner_uom: string
  inners_per_purchase: number
  base_qty_per_inner: number
  base_uom: string
  base_qty_per_purchase: number
  std_use_per_phone: number
  std_loss_pct: number
  assumption: string
}

interface SimulateReceiptResult {
  plant_id: string
  product_id: string
  receipt_input: {
    material_id: string
    material_name: string
    pack_quantity: number
    pack_type: string
    inners_per_pack?: number
    inner_uom?: string
    inner_breakdown: string
    base_quantity: number
    base_uom: string
    consumption_standard: string
    assumption_id?: string
  }
  capacity_from_receipt_alone: number
  baseline_plant_capacity: {
    gross_capacity: number
    protected_capacity: number
    bottleneck_material_id: string
    bottleneck_material_name: string
  }
  new_simulated_capacity: {
    gross_capacity: number
    bottleneck_material_id: string
    bottleneck_material_name: string
  }
  effective_capacity_added_to_plant: number
  leadership_takeaway: string
  next_bottleneck_to_buy?: {
    material_id: string
    material_name: string
    current_supported_capacity: number
    quantity_to_buy_to_match_receipt: number
    uom: string
  }
}

// Brand-specific material specifications for backcase & chassis fabrication
export interface BrandMaterialSpec {
  brandName: string
  modelCode: string
  chassisType: string
  alGrade: string
  alRawKgPerUnit: number
  alNetKgPerUnit: number
  alChipKgPerUnit: number
  glassType: string
  glassKgPerUnit: number
  plasticType: string
  plasticKgPerUnit: number
  cncMinutesPerUnit: number
  defaultStockOnHand: number
  stockLocation: string
}

export const BRAND_SPECS: Record<string, BrandMaterialSpec> = {
  'SPH-A15-256': {
    brandName: 'Aster 15 Pro (Flagship)',
    modelCode: 'SPH-A15-256',
    chassisType: 'Aerospace Grade 7075-T6 Unibody CNC',
    alGrade: 'Aluminium 7075-T6 Billet (High-Strength Aircraft Alloy)',
    alRawKgPerUnit: 0.235, // 235g raw billet bar
    alNetKgPerUnit: 0.068, // 68g net frame
    alChipKgPerUnit: 0.167, // 167g recyclable chips
    glassType: 'Corning Gorilla Glass Victus 2 / Ceramic Shield',
    glassKgPerUnit: 0.048, // 48g panel
    plasticType: 'Liquid Crystal Polymer (LCP) High-Freq Antenna Inserts',
    plasticKgPerUnit: 0.014, // 14g
    cncMinutesPerUnit: 5.2,
    defaultStockOnHand: 15,
    stockLocation: 'WH-FIN-01 · Bay C-4 (Finished Goods Buffer)',
  },
  'SPH-A15-128': {
    brandName: 'Aster 15 (Standard)',
    modelCode: 'SPH-A15-128',
    chassisType: 'Anodized 6063-T6 Aviation Aluminum Frame',
    alGrade: 'Aluminium 6063 Extrusion Bar (Precision Machining Alloy)',
    alRawKgPerUnit: 0.210, // 210g raw bar
    alNetKgPerUnit: 0.062, // 62g net frame
    alChipKgPerUnit: 0.148, // 148g recyclable chips
    glassType: 'Corning Gorilla Glass 5 Tempered Substrate',
    glassKgPerUnit: 0.042, // 42g panel
    plasticType: 'High-Precision Polycarbonate (PC) Antenna Brackets',
    plasticKgPerUnit: 0.016, // 16g
    cncMinutesPerUnit: 4.5,
    defaultStockOnHand: 35,
    stockLocation: 'WH-FIN-01 · Bay A-2 (Finished Goods Buffer)',
  },
  'SPH-A15-64': {
    brandName: 'Aster 15 Lite (Value)',
    modelCode: 'SPH-A15-64',
    chassisType: 'High-Impact Polycarbonate / ABS with Al Heat Core',
    alGrade: 'Stamped Aluminium 5052 Internal Heat-Spreader Core',
    alRawKgPerUnit: 0.045, // 45g internal plate
    alNetKgPerUnit: 0.042,
    alChipKgPerUnit: 0.003,
    glassType: 'PMMA Hard-Coated Optical Composite Glass Panel',
    glassKgPerUnit: 0.032, // 32g
    plasticType: 'High-Impact PC/ABS Injection Resin Pellets',
    plasticKgPerUnit: 0.075, // 75g resin
    cncMinutesPerUnit: 1.8,
    defaultStockOnHand: 60,
    stockLocation: 'WH-FIN-02 · Pallet P-8 (Value Buffer)',
  },
  'SUB-HSG-BACKCASE': {
    brandName: 'Universal Backcase Sub-Assembly',
    modelCode: 'SUB-HSG-BACKCASE',
    chassisType: 'Universal 6063 CNC Chassis + Glass Sub-Assembly',
    alGrade: 'Aluminium 6063-T5 CNC Billet Bar (Universal Part)',
    alRawKgPerUnit: 0.215, // 215g raw billet
    alNetKgPerUnit: 0.064, // 64g net frame
    alChipKgPerUnit: 0.151, // 151g recyclable chips
    glassType: 'Aluminosilicate Gorilla Glass Back Panel',
    glassKgPerUnit: 0.044, // 44g
    plasticType: 'Polycarbonate Carrier & Antenna Gaskets',
    plasticKgPerUnit: 0.015, // 15g
    cncMinutesPerUnit: 4.5,
    defaultStockOnHand: 20,
    stockLocation: 'WH-MECH-02 · Bin B-12 (Mechanical WIP Buffer)',
  },
}

export function BuildCapacity() {
  const { plant, openAgent } = useShell()
  const effectivePlant = plant || 'IN-KA-01'

  // Form Inputs (Staged State - user selects filters first)
  const [formProduct, setFormProduct] = useState<string>('SUB-HSG-BACKCASE')
  const [formVolume, setFormVolume] = useState<number>(100)
  const [formStockOnHand, setFormStockOnHand] = useState<number>(20)
  const [formScope, setFormScope] = useState<'all' | 'mechanical' | 'smt' | 'box_build'>('all')
  const [formScrap, setFormScrap] = useState<number>(1.0)

  // Applied Forecast State (Calculated & Displayed ONLY after clicking Run)
  const [appliedProduct, setAppliedProduct] = useState<string>('SUB-HSG-BACKCASE')
  const [appliedVolume, setAppliedVolume] = useState<number>(100)
  const [appliedStockOnHand, setAppliedStockOnHand] = useState<number>(20)
  const [appliedScope, setAppliedScope] = useState<'all' | 'mechanical' | 'smt' | 'box_build'>('all')
  const [appliedScrap, setAppliedScrap] = useState<number>(1.0)
  const [isRunningForecast, setIsRunningForecast] = useState<boolean>(false)

  // Core Capacity Model State (synchronized when forecast is run)
  const [selectedProduct, setSelectedProduct] = useState<string>('SUB-HSG-BACKCASE')
  const [targetVolume, setTargetVolume] = useState<number>(100)
  const [scrapMultiplier, setScrapMultiplier] = useState<number>(1.0)

  // Check if user changed any filter but has not clicked Run yet
  const isFilterDirty =
    formProduct !== appliedProduct ||
    formVolume !== appliedVolume ||
    formStockOnHand !== appliedStockOnHand ||
    formScope !== appliedScope ||
    formScrap !== appliedScrap

  // Receipt-to-Capacity Calculator State
  const [simMaterial, setSimMaterial] = useState<string>('MAT-WIRE-019')
  const [simQuantity, setSimQuantity] = useState<number>(20)
  const [simPackType, setSimPackType] = useState<string>('BOX')
  const [simInnersPerPack, setSimInnersPerPack] = useState<number>(10)
  const [isSimulating, setIsSimulating] = useState<boolean>(false)
  const [simResult, setSimResult] = useState<SimulateReceiptResult | null>(null)

  // Query 1: Standard Capacity Data
  const q = useQuery({
    queryKey: ['production-capacity', effectivePlant, scrapMultiplier],
    queryFn: () => {
      const params = new URLSearchParams()
      if (effectivePlant) params.set('plant_id', effectivePlant)
      if (scrapMultiplier !== 1.0) params.set('scrap_multiplier', String(scrapMultiplier))
      return api.get<CapacityResponse>(`/api/production/capacity?${params.toString()}`)
    },
    staleTime: 60_000,
  })

  // Query 2: Packaging Conversions
  const qConv = useQuery({
    queryKey: ['packaging-conversions'],
    queryFn: () => api.get<PackagingConversion[]>('/api/production/packaging-conversions'),
    staleTime: 300_000,
  })

  const conversions: PackagingConversion[] = qConv.data?.data ?? []
  const data = q.data?.data
  const products = data?.products ?? []

  const currentProduct = useMemo(() => {
    return products.find((p) => p.product_id === selectedProduct) ?? products[0]
  }, [products, selectedProduct])

  const currentConv = useMemo(() => {
    return conversions.find((c) => c.material_id === simMaterial)
  }, [conversions, simMaterial])

  // Automatically update pack type and inner count when material changes
  useEffect(() => {
    if (currentConv) {
      setSimPackType(currentConv.purchase_uom)
      setSimInnersPerPack(currentConv.inners_per_purchase || 10)
    }
  }, [currentConv])

  // Run simulation calculation
  const handleSimulate = async (matId?: string, qty?: number, pack?: string, inners?: number) => {
    const targetMat = matId || simMaterial
    const targetQty = qty !== undefined ? qty : simQuantity
    const targetPack = pack || simPackType
    const targetInners = inners !== undefined ? inners : simInnersPerPack

    setIsSimulating(true)
    try {
      const res = await api.post<SimulateReceiptResult>('/api/production/simulate-receipt', {
        plant_id: effectivePlant,
        product_id: selectedProduct,
        material_id: targetMat,
        pack_quantity: targetQty,
        pack_type: targetPack,
        inners_per_pack: targetInners,
      })
      setSimResult(res.data)
    } catch (err) {
      console.error('Simulation error:', err)
    } finally {
      setIsSimulating(false)
    }
  }

  // Pre-load default simulation on mount or plant change
  useEffect(() => {
    handleSimulate('MAT-WIRE-019', 20, 'BOX', 10)
  }, [effectivePlant, selectedProduct])

  // Sort components: bottleneck first, then by supported capacity ascending
  const sortedComponents = useMemo(() => {
    if (!currentProduct?.components) return []
    return [...currentProduct.components].sort((a, b) => a.supported_capacity - b.supported_capacity)
  }, [currentProduct])

  const bottleneck = sortedComponents[0]
  const targetShortfall = bottleneck && targetVolume > bottleneck.supported_capacity
    ? Math.ceil((targetVolume - bottleneck.supported_capacity) * bottleneck.adjusted_req_per_unit)
    : 0

  const plantNameDisplay = effectivePlant === 'IN-KA-01' ? 'IN-KA-01 (Bengaluru)' : effectivePlant === 'IN-TN-01' ? 'IN-TN-01 (Chennai)' : 'All Plants'

  // Forecast Execution Handler (Called when user clicks "Run" button)
  const handleRunForecast = () => {
    setIsRunningForecast(true)
    setTimeout(() => {
      setAppliedProduct(formProduct)
      setAppliedVolume(formVolume)
      setAppliedStockOnHand(formStockOnHand)
      setAppliedScope(formScope)
      setAppliedScrap(formScrap)
      setSelectedProduct(formProduct)
      setTargetVolume(formVolume)
      setScrapMultiplier(formScrap)
      setIsRunningForecast(false)
    }, 250)
  }

  // Quick Preset Handler (Applies volume and runs forecast)
  const handleSelectPreset = (vol: number) => {
    setFormVolume(vol)
    setIsRunningForecast(true)
    setTimeout(() => {
      setAppliedProduct(formProduct)
      setAppliedVolume(vol)
      setAppliedStockOnHand(formStockOnHand)
      setAppliedScope(formScope)
      setAppliedScrap(formScrap)
      setSelectedProduct(formProduct)
      setTargetVolume(vol)
      setScrapMultiplier(formScrap)
      setIsRunningForecast(false)
    }, 200)
  }

  // Quick Stock On Hand Scenario Handler
  const handleSelectStockPreset = (stock: number) => {
    setFormStockOnHand(stock)
    setIsRunningForecast(true)
    setTimeout(() => {
      setAppliedProduct(formProduct)
      setAppliedVolume(formVolume)
      setAppliedStockOnHand(stock)
      setAppliedScope(formScope)
      setAppliedScrap(formScrap)
      setSelectedProduct(formProduct)
      setTargetVolume(formVolume)
      setScrapMultiplier(formScrap)
      setIsRunningForecast(false)
    }, 200)
  }

  // Dynamic Target Product Selection Handler (Automatically updates stock on hand based on chosen product)
  const handleProductChange = (newProductId: string) => {
    setFormProduct(newProductId)
    const spec = BRAND_SPECS[newProductId] || BRAND_SPECS['SUB-HSG-BACKCASE']
    const newStock = spec.defaultStockOnHand
    setFormStockOnHand(newStock)
  }

  // Pre-calculated metrics for the 4 Forecaster cards based on APPLIED filters
  const isMechOnly = appliedScope === 'mechanical' || appliedProduct === 'SUB-HSG-BACKCASE'
  const isSmtOnly = appliedScope === 'smt'

  // Brand specification and Net CNC Cut metrics
  const activeBrandSpec = BRAND_SPECS[appliedProduct] || BRAND_SPECS['SUB-HSG-BACKCASE']
  const netCutUnits = Math.max(0, appliedVolume - appliedStockOnHand)
  const netCutWithScrap = Math.ceil(netCutUnits * 1.005 * appliedScrap)

  // Physical Raw Materials in KG for cutting the net shortfall:
  const alRawKg = netCutWithScrap * activeBrandSpec.alRawKgPerUnit
  const glassKg = netCutWithScrap * activeBrandSpec.glassKgPerUnit
  const plasticKg = netCutWithScrap * activeBrandSpec.plasticKgPerUnit
  const alChipKg = netCutWithScrap * activeBrandSpec.alChipKgPerUnit
  const cncHours = (netCutWithScrap * activeBrandSpec.cncMinutesPerUnit) / 60

  const solderPasteKg = isMechOnly ? 0 : appliedVolume * 0.0005 * 1.08 * appliedScrap
  const solderWireKg = isMechOnly ? 0 : appliedVolume * 0.0002 * 1.10 * appliedScrap
  const thermalAdhKg = appliedVolume * 0.0003 * 1.05 * appliedScrap
  const totalSolderAlloyKg = solderPasteKg + solderWireKg

  const ramChipsNeeded = isMechOnly ? 0 : Math.ceil(appliedVolume * 1.005 * appliedScrap)
  const socChipsNeeded = isMechOnly ? 0 : Math.ceil(appliedVolume * 1.005 * appliedScrap)
  const nandChipsNeeded = isMechOnly ? 0 : Math.ceil(appliedVolume * 1.005 * appliedScrap)

  const midFrameNeeded = isSmtOnly ? 0 : Math.ceil(appliedVolume * 1.005 * appliedScrap)

  const unitCost = appliedProduct === 'SUB-HSG-BACKCASE' ? 2150 : 11099
  const totalBOMCost = Math.round(appliedVolume * unitCost * appliedScrap)
  const isFeasible = appliedProduct === 'SUB-HSG-BACKCASE' ? appliedVolume <= 18400 : appliedVolume <= 1300

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-head">
        <span className="page-icon solid">
          <Icon name="calculator" size={28} />
        </span>
        <div>
          <div className="crumb">Planning · Bill of Materials &amp; Production Capacity</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            Build Capacity &amp; Receipt-to-Capacity Calculator
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            Deterministic capacity engine for {plantNameDisplay}. Compares usable gross stock, safety-stock-protected capacity, and packaging conversions.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PRODUCTION PLAN & ASSEMBLY MATERIAL FORECASTER (Interactive Simulator) */}
      {/* ========================================================================= */}
      <div
        className="card"
        style={{
          padding: 22,
          borderRadius: 14,
          border: '2px solid rgba(124, 58, 237, 0.35)',
          background: 'linear-gradient(180deg, rgba(124, 58, 237, 0.04) 0%, #ffffff 100%)',
          boxShadow: '0 4px 16px rgba(124, 58, 237, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* Top Header: Title on Left, AI Button on Far Right End */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#7c3aed', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                BATCH SIMULATOR
              </span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>
                🎯 Production Plan &amp; Assembly Material Forecaster
              </h2>
            </div>
            <button
              className="btn outline"
              onClick={() =>
                openAgent(
                  `Forecast material requirements for assembling ${targetVolume} units of ${selectedProduct} at ${effectivePlant}. How much solder paste (kg), solder wire (kg), and RAM (units) are required?`
                )
              }
              style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="sparkle" size={16} /> Ask AI Capacity Forecaster
            </button>
          </div>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
            Enter target finished product and planned production batch (e.g. 100 mobiles) to forecast exact soldering consumables (in KG), RAM chips, backcase components, and BOM shortfall.
          </p>
        </div>

        {/* Form Inputs & Run Button Row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 12,
            background: '#ffffff',
            padding: '16px 18px',
            borderRadius: 10,
            border: isFilterDirty ? '1.5px solid #a78bfa' : '1px solid #e5e7eb',
            boxShadow: isFilterDirty ? '0 0 10px rgba(124, 58, 237, 0.08)' : 'none',
            transition: 'border 0.2s ease',
          }}
        >
          {/* Input 1: Product to Assemble / Manufacture */}
          <div style={{ flex: '1 1 220px', minWidth: 190, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ height: 28, display: 'flex', alignItems: 'flex-end', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.25 }}>
              Target Product / Sub-Assembly
            </label>
            <select
              value={formProduct}
              onChange={(e) => handleProductChange(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                fontWeight: 600,
                color: '#111827',
                background: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="SPH-A15-256">SPH-A15-256 · Aster 15 Pro (High-Performance)</option>
              <option value="SPH-A15-128">SPH-A15-128 · Aster 15 (Flagship Smartphone)</option>
              <option value="SPH-A15-64">SPH-A15-64 · Aster 15 Lite (Value Edition)</option>
              <option value="SUB-HSG-BACKCASE">SUB-HSG-BACKCASE · Backcase &amp; Chassis Sub-Assembly (Mechanical Work Center)</option>
            </select>
          </div>

          {/* Input 2: Planned Production Volume */}
          <div style={{ flex: '1 1 150px', minWidth: 140, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ height: 28, display: 'flex', alignItems: 'flex-end', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.25 }}>
              Planned Assembly Volume
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, boxSizing: 'border-box' }}>
              <input
                type="number"
                min={1}
                max={500000}
                value={formVolume}
                onChange={(e) => setFormVolume(Math.max(1, Number(e.target.value)))}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#7c3aed',
                  background: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap' }}>mobiles</span>
            </div>
          </div>

          {/* Input 3: Finished Stock on Hand */}
          <div style={{ flex: '1 1 150px', minWidth: 140, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ height: 28, display: 'flex', alignItems: 'flex-end', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.25 }}>
              Stock on Hand (Buffer)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, boxSizing: 'border-box' }}>
              <input
                type="number"
                min={0}
                max={500000}
                value={formStockOnHand}
                onChange={(e) => setFormStockOnHand(Math.max(0, Number(e.target.value)))}
                title={`Buffer stock at ${(BRAND_SPECS[formProduct] || BRAND_SPECS['SUB-HSG-BACKCASE']).stockLocation}`}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #10b981',
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#059669',
                  background: '#f0fdf4',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#059669', whiteSpace: 'nowrap' }}>in stock</span>
            </div>
          </div>

          {/* Input 4: Assembly Scope */}
          <div style={{ flex: '1 1 200px', minWidth: 180, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ height: 28, display: 'flex', alignItems: 'flex-end', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.25 }}>
              Assembly &amp; MFG Scope
            </label>
            <select
              value={formScope}
              onChange={(e) => setFormScope(e.target.value as any)}
              style={{
                width: '100%',
                height: 38,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                fontWeight: 600,
                color: '#111827',
                background: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="all">Full Box-Build Assembly (All 3 Stages)</option>
              <option value="mechanical">Stage 1: Mechanical Backcase &amp; Chassis Only</option>
              <option value="smt">Stage 2: SMT Motherboard Assembly Only</option>
              <option value="box_build">Stage 3: Final Box-Build &amp; Packaging</option>
            </select>
          </div>

          {/* Input 5: Scrap Multiplier */}
          <div style={{ flex: '1 1 170px', minWidth: 150, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ height: 28, display: 'flex', alignItems: 'flex-end', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.25 }}>
              Assembly Scrap Allowance
            </label>
            <select
              value={formScrap}
              onChange={(e) => setFormScrap(Number(e.target.value))}
              style={{
                width: '100%',
                height: 38,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                fontWeight: 600,
                color: '#111827',
                background: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value={1.0}>1.0x (Standard BOM Scrap)</option>
              <option value={1.1}>1.1x (+10% Scrap Allowance)</option>
              <option value={1.25}>1.25x (+25% Stress Scrap)</option>
            </select>
          </div>

          {/* Run Button - Placed directly on the right perfectly aligned */}
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ height: 28, marginBottom: 6 }} />
            <button
              type="button"
              onClick={handleRunForecast}
              disabled={isRunningForecast}
              style={{
                height: 38,
                padding: '0 20px',
                borderRadius: 8,
                background: isFilterDirty
                  ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                  : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                cursor: isRunningForecast ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                boxShadow: isFilterDirty
                  ? '0 2px 10px rgba(124, 58, 237, 0.45)'
                  : '0 2px 6px rgba(124, 58, 237, 0.3)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box',
              }}
              title="Click to calculate and display metrics for chosen filters"
            >
              {isRunningForecast ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 14,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span>Calculating...</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Run</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Batch Presets & Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Quick Batch Presets:</span>
            {[
              [100, '⚡ 100 Mobiles (Batch Run)'],
              [250, '⚡ 250 Mobiles'],
              [500, '⚡ 500 Mobiles'],
              [1000, '⚡ 1,000 Mobiles'],
              [5000, '⚡ 5,000 Mobiles'],
            ].map(([vol, label]) => (
              <button
                key={vol}
                type="button"
                onClick={() => handleSelectPreset(Number(vol))}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: formVolume === vol ? '1px solid #7c3aed' : '1px solid #e5e7eb',
                  background: formVolume === vol ? '#f5f3ff' : '#ffffff',
                  color: formVolume === vol ? '#7c3aed' : '#374151',
                  fontSize: 12,
                  fontWeight: formVolume === vol ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {isFilterDirty ? (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>⚠️ Filters changed</span>
              <span style={{ fontWeight: 500 }}>— Click <b>Run</b> to recalculate metrics</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>✓ Metrics calculated for {appliedVolume.toLocaleString()} units</span>
            </div>
          )}
        </div>

        {/* 4 Forecast Results Dashboard Cards (Calculated on Run) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {/* Card 1: Soldering & Chemical Consumables */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>
                🔬 Soldering &amp; Chemicals
              </span>
              <span style={{ fontSize: 10, background: '#f5f3ff', color: '#7c3aed', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                KG &amp; GRAMS
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '4px 0' }}>
              {totalSolderAlloyKg.toFixed(3)} KG
            </div>
            <div className="small muted" style={{ fontSize: 11, marginBottom: 8 }}>
              {isMechOnly ? 'Consumes structural adhesive only' : `Total Solder Alloy for ${appliedVolume.toLocaleString()} units`}
            </div>
            <div style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
              <div>• <b>MAT-PASTE-017</b> Solder Paste: <b>{solderPasteKg.toFixed(3)} KG</b> ({isMechOnly ? 'N/A' : `${(solderPasteKg * 1000).toFixed(1)}g · ~${Math.ceil(solderPasteKg / 0.5)} Jar`})</div>
              <div>• <b>MAT-WIRE-019</b> Solder Wire: <b>{solderWireKg.toFixed(3)} KG</b> ({isMechOnly ? 'N/A' : `${(solderWireKg * 1000).toFixed(1)}g · ~${Math.ceil(solderWireKg / 0.1)} Coil`})</div>
              <div>• <b>MAT-ADH-018</b> Thermal Adhesive: <b>{thermalAdhKg.toFixed(3)} KG</b> ({(thermalAdhKg * 1000).toFixed(1)}g · ~{Math.ceil(thermalAdhKg / 0.03)} Syringe)</div>
            </div>
          </div>

          {/* Card 2: Active Silicon & RAM */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
                🧠 RAM &amp; Core Silicon
              </span>
              <span style={{ fontSize: 10, background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                UNITS &amp; REELS
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '4px 0' }}>
              {isMechOnly ? '0 RAM Chips' : `${ramChipsNeeded.toLocaleString()} RAM Chips`}
            </div>
            <div className="small muted" style={{ fontSize: 11, marginBottom: 8 }}>
              {isMechOnly ? 'SMT Stage Only (Stage 2)' : `${(ramChipsNeeded / 2000).toFixed(3)} REEL (2,000 chips/reel)`}
            </div>
            <div style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
              <div>• <b>MAT-MEM-002</b> LPDDR5 RAM: <b>{ramChipsNeeded.toLocaleString()} EA</b> (₹{Math.round(ramChipsNeeded * 1100).toLocaleString('en-IN')})</div>
              <div>• <b>MAT-SOC-001</b> Processor SoC: <b>{socChipsNeeded.toLocaleString()} EA</b> ({(socChipsNeeded / 100).toFixed(2)} Trays of 100)</div>
              <div>• <b>MAT-NAND-003</b> Flash Storage: <b>{nandChipsNeeded.toLocaleString()} EA</b> ({(nandChipsNeeded / 1000).toFixed(3)} Reel of 1k)</div>
            </div>
          </div>

          {/* Card 3: Backcase & Chassis Manufacturing */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
                🛡️ Backcase &amp; Chassis
              </span>
              <span style={{ fontSize: 10, background: '#fffbeb', color: '#d97706', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                {appliedStockOnHand > 0 ? `NET CUT (${netCutUnits} EA)` : 'UNITS & CARTONS'}
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '4px 0' }}>
              {isSmtOnly ? '0 Mid-Frames' : `${netCutWithScrap.toLocaleString()} Mid-Frames to Cut`}
            </div>
            <div className="small muted" style={{ fontSize: 11, marginBottom: 8 }}>
              {appliedStockOnHand > 0
                ? `Target: ${appliedVolume} EA · Existing Stock: ${appliedStockOnHand} EA (Deducted)`
                : `${(midFrameNeeded / 60).toFixed(2)} CARTONS (60 units/carton)`}
            </div>
            <div style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 3.5, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
              <div>• ⚙️ <b>Raw Aluminium</b>: <b>{alRawKg.toFixed(2)} KG</b> ({activeBrandSpec.alGrade.split(' ')[0]} · {(activeBrandSpec.alRawKgPerUnit * 1000).toFixed(0)}g/ea)</div>
              <div>• 🪟 <b>Raw Glass</b>: <b>{glassKg.toFixed(2)} KG</b> ({activeBrandSpec.glassType.split(' ')[0]} · {(activeBrandSpec.glassKgPerUnit * 1000).toFixed(0)}g/ea)</div>
              <div>• 🧪 <b>Polycarbonate / Plastic</b>: <b>{plasticKg.toFixed(2)} KG</b> ({(activeBrandSpec.plasticKgPerUnit * 1000).toFixed(0)}g/ea)</div>
              <div>• ♻️ <b>Recyclable Swarf Chips</b>: <b>{alChipKg.toFixed(2)} KG</b> Al scrap</div>
              <div>• ⏱️ <b>CNC Cutting Time</b>: <b>{cncHours.toFixed(1)} Hours</b> ({Math.round(cncHours * 60)} min)</div>
            </div>
          </div>

          {/* Card 4: Feasibility & Batch Valuation */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                📊 Feasibility &amp; Cost
              </span>
              <span style={{ fontSize: 10, background: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                BATCH OUTCOME
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: isFeasible ? '#059669' : '#dc2626', margin: '4px 0' }}>
              {isFeasible ? '🟢 100% Feasible' : `⚠️ PCB Shortfall (-${(appliedVolume - 1300).toLocaleString()})`}
            </div>
            <div className="small muted" style={{ fontSize: 11, marginBottom: 8 }}>
              Total BOM Kit Cost: <b>{inr(totalBOMCost)}</b>
            </div>
            <div style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
              <div>• Per-Unit Material Cost: <b>₹{unitCost.toLocaleString('en-IN')} / unit</b></div>
              <div>• Plant Floor Turnaround: <b>{appliedVolume <= 100 ? '~7.5 Hours (1 Shift)' : `${(appliedVolume / 12.5).toFixed(1)} Hours`}</b></div>
              <div>• SMT Solder Reflow Time: <b>{(isMechOnly ? 0 : appliedVolume * 0.75).toFixed(0)} minutes</b></div>
              <div>• Backcase CNC Time: <b>{(isSmtOnly ? 0 : appliedVolume * 4.5).toFixed(0)} minutes</b></div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MECHANICAL WORK CENTER: RAW MATERIAL EXTRUSION & CNC CUTTING BREAKDOWN     */}
        {/* ========================================================================= */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            padding: 18,
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🏭</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111827' }}>
                  Mechanical Work Center · Raw Material Extrusion &amp; CNC Cutting Plan (Net Requirements)
                </h3>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>
                  Deterministic conversion of finished chassis shortfall into raw billet KG, glass substrate, structural resin, and CNC machine hours across brands.
                </p>
              </div>
            </div>
            {/* Quick Stock On Hand Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>Test Stock Buffers:</span>
              {[
                [0, 'Stock: 0 (Cut 100)'],
                [20, 'Stock: 20 (Cut 80)'],
                [50, 'Stock: 50 (Cut 50)'],
                [100, 'Stock: 100 (Covered)'],
              ].map(([stockVal, label]) => (
                <button
                  key={stockVal}
                  type="button"
                  onClick={() => handleSelectStockPreset(Number(stockVal))}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 5,
                    border: appliedStockOnHand === stockVal ? '1px solid #059669' : '1px solid #e5e7eb',
                    background: appliedStockOnHand === stockVal ? '#ecfdf5' : '#ffffff',
                    color: appliedStockOnHand === stockVal ? '#059669' : '#4b5563',
                    fontSize: 11,
                    fontWeight: appliedStockOnHand === stockVal ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Net Requirements Logic Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              background: '#f8fafc',
              padding: 14,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>1. Target Demand</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{appliedVolume.toLocaleString()} EA</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Gross finished requirement</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>2. Finished Stock on Hand</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>- {appliedStockOnHand.toLocaleString()} EA</div>
              <div style={{ fontSize: 11, color: '#059669' }}>Usable buffer available</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>3. Net Shortfall to Machine</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>= {netCutUnits.toLocaleString()} EA</div>
              <div style={{ fontSize: 11, color: '#7c3aed' }}>+ process scrap = <b>{netCutWithScrap} units</b></div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>4. Active Brand Spec</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#d97706', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeBrandSpec.brandName}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{activeBrandSpec.chassisType}</div>
            </div>
          </div>

          {/* Brand Comparison Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Product / Brand Variant</th>
                  <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Chassis Tech &amp; Grade</th>
                  <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Raw Aluminium (KG)</th>
                  <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Raw Glass (KG)</th>
                  <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Plastic/Resin (KG)</th>
                  <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>CNC Swarf Recovery</th>
                  <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>CNC Run Time</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(BRAND_SPECS).map(([code, spec]) => {
                  const isCurrent = code === appliedProduct || (appliedProduct === 'SUB-HSG-BACKCASE' && code === 'SUB-HSG-BACKCASE')
                  const reqAl = netCutWithScrap * spec.alRawKgPerUnit
                  const reqGlass = netCutWithScrap * spec.glassKgPerUnit
                  const reqPlastic = netCutWithScrap * spec.plasticKgPerUnit
                  const reqSwarf = netCutWithScrap * spec.alChipKgPerUnit
                  const reqHours = (netCutWithScrap * spec.cncMinutesPerUnit) / 60

                  return (
                    <tr
                      key={code}
                      onClick={() => handleProductChange(code)}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: isCurrent ? 'rgba(124, 58, 237, 0.06)' : '#ffffff',
                        fontWeight: isCurrent ? 700 : 400,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      title={`Click to select ${spec.brandName} and auto-load its stock on hand (${spec.defaultStockOnHand} EA)`}
                    >
                      <td style={{ padding: '10px 10px', color: isCurrent ? '#7c3aed' : '#1e293b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isCurrent && <span style={{ color: '#7c3aed', fontSize: 13 }}>▶</span>}
                          <div>
                            <div>{spec.brandName}</div>
                            <div className="muted" style={{ fontSize: 10.5, fontWeight: 500 }}><code>{spec.modelCode}</code></div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', color: '#334155', maxWidth: 180 }}>
                        <div style={{ fontSize: 11.5 }}>{spec.alGrade.split('(')[0]}</div>
                        <div className="muted" style={{ fontSize: 10.5 }}>{spec.glassType.split('/')[0]}</div>
                      </td>
                      <td style={{ padding: '10px 10px', color: '#0f172a' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{reqAl.toFixed(2)} KG</div>
                        <div className="muted" style={{ fontSize: 10.5 }}>{(spec.alRawKgPerUnit * 1000).toFixed(0)}g / unit</div>
                      </td>
                      <td style={{ padding: '10px 10px', color: '#0f172a' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{reqGlass.toFixed(2)} KG</div>
                        <div className="muted" style={{ fontSize: 10.5 }}>{(spec.glassKgPerUnit * 1000).toFixed(0)}g / panel</div>
                      </td>
                      <td style={{ padding: '10px 10px', color: '#0f172a' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706' }}>{reqPlastic.toFixed(2)} KG</div>
                        <div className="muted" style={{ fontSize: 10.5 }}>{(spec.plasticKgPerUnit * 1000).toFixed(0)}g / unit</div>
                      </td>
                      <td style={{ padding: '10px 10px', color: '#0f172a' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>{reqSwarf.toFixed(2)} KG</div>
                        <div className="muted" style={{ fontSize: 10.5 }}>Recyclable swarf</div>
                      </td>
                      <td style={{ padding: '10px 10px', color: '#0f172a' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>{reqHours.toFixed(1)} Hours</div>
                        <div className="muted" style={{ fontSize: 10.5 }}>{Math.round(reqHours * 60)} min CNC</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Operational Takeaway Footnote */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: 12,
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              💡 <b>Shopfloor Efficiency:</b> By utilizing <b>{appliedStockOnHand} units</b> of existing stock, the plant avoids ordering <b>{(appliedStockOnHand * activeBrandSpec.alRawKgPerUnit).toFixed(2)} KG</b> of excess raw aluminium, saving <b>{((appliedStockOnHand * activeBrandSpec.cncMinutesPerUnit) / 60).toFixed(1)} CNC machine hours</b> and preventing inventory accumulation.
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>
              ✓ Net Bill of Materials Auto-Synchronized
            </div>
          </div>
        </div>
      </div>

      {/* Top Executive KPI Cards: Gross vs Protected Capacity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Gross Production Capacity */}
        <div className="card" style={{ padding: 20, borderLeft: '4px solid var(--accent)' }}>
          <div className="small muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Gross Production Capacity
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 4px' }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)' }}>
              {currentProduct?.max_production_capacity?.toLocaleString() ?? 0}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>units</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Limiting Part:</span>
            <span style={{ fontWeight: 700, color: '#ef4444' }}>
              {currentProduct?.bottleneck_material || 'None'}
            </span>
            <code>{currentProduct?.bottleneck_material_id}</code>
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Physical unconstrained capacity supported by usable stock.
          </div>
        </div>

        {/* Safety-Stock-Protected Capacity */}
        <div
          className="card"
          style={{
            padding: 20,
            borderLeft: `4px solid ${(currentProduct?.protected_production_capacity ?? 0) === 0 ? '#ef4444' : 'var(--ok)'}`,
            background: (currentProduct?.protected_production_capacity ?? 0) === 0 ? 'rgba(239, 68, 68, 0.04)' : undefined,
          }}
        >
          <div className="small muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Safety-Stock-Protected Capacity
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 4px' }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: (currentProduct?.protected_production_capacity ?? 0) === 0 ? '#ef4444' : 'var(--ok)',
              }}
            >
              {currentProduct?.protected_production_capacity?.toLocaleString() ?? 0}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>units</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#ef4444' }}>
            ⚠️ {currentProduct?.parts_below_ss_count ?? 0} BOM parts currently below safety stock
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Zero-risk capacity strictly preserving safety buffers. (Currently 0 buffer remaining).
          </div>
        </div>

        {/* Target Production Volume & Shortfall */}
        <div className="card" style={{ padding: 20, borderLeft: '4px solid var(--brand-orange)' }}>
          <div className="small muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Target Volume &amp; Shortfall
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 4px' }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: targetShortfall > 0 ? '#ef4444' : 'var(--ok)' }}>
              {targetShortfall > 0 ? `-${targetShortfall.toLocaleString()}` : '0'}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{bottleneck?.uom || 'units'} shortfall</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text)' }}>
            Target: <b>{targetVolume.toLocaleString()} units</b> · Assembly scrap: <b>{(scrapMultiplier * 100).toFixed(0)}%</b>
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Expedite gap needed on <b>{bottleneck?.material_name}</b> to achieve production plan.
          </div>
        </div>
      </div>

      {/* Target Volume & Scrap Simulation Toolbar */}
      <div
        className="card"
        style={{
          padding: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: 'linear-gradient(135deg, rgba(111, 61, 186, 0.04), rgba(245, 138, 58, 0.05))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
              Target Production Volume
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                min={1}
                max={50000}
                step={50}
                value={targetVolume}
                onChange={(e) => setTargetVolume(Number(e.target.value))}
                style={{ width: 140, fontWeight: 700, fontSize: 14 }}
              />
              <span className="small muted">units</span>
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 14 }}>
            <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
              Assembly Scrap Multiplier
            </label>
            <select
              value={scrapMultiplier}
              onChange={(e) => setScrapMultiplier(Number(e.target.value))}
              style={{ fontWeight: 600, fontSize: 13 }}
            >
              <option value={1.0}>1.0x (Standard BOM Scrap)</option>
              <option value={1.1}>1.1x (+10% Scrap Stress)</option>
              <option value={1.25}>1.25x (+25% Scrap Stress)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn outline"
            onClick={() =>
              openAgent(
                `Explain the build capacity for ${currentProduct?.product_name || 'Aster 15'} at ${effectivePlant}. Why is safety-stock-protected capacity 0, and what purchase order lifts the bottleneck?`
              )
            }
          >
            <Icon name="sparkle" size={16} /> Ask Capacity Agent
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RECEIPT-TO-CAPACITY CALCULATOR (Deterministic Pack Conversion Engine)     */}
      {/* ========================================================================= */}
      <div
        className="card"
        style={{
          padding: 24,
          border: '2px solid rgba(111, 61, 186, 0.3)',
          background: 'linear-gradient(180deg, rgba(111, 61, 186, 0.03), transparent)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'var(--brand-purple)', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                DETERMINISTIC CONVERSION
              </span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                📦 Receipt-to-Capacity Calculator &amp; Packaging Conversion
              </h2>
            </div>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
              "How many phones can 20 boxes of solder wire make?" Converts purchase packs (Boxes, Cases, Coils, Reels) into standard base UoM, calculates receipt-alone potential, and measures actual capacity added to {plantNameDisplay}.
            </p>
          </div>
        </div>

        {/* Quick Scenario Preset Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <span className="small muted" style={{ fontWeight: 700 }}>One-Click Test Scenarios:</span>
          <button
            className="btn outline"
            style={{ fontSize: 12, padding: '4px 10px', borderColor: 'var(--brand-purple)', color: 'var(--brand-purple)', fontWeight: 600 }}
            onClick={() => {
              setSimMaterial('MAT-WIRE-019')
              setSimQuantity(20)
              setSimPackType('BOX')
              setSimInnersPerPack(10)
              handleSimulate('MAT-WIRE-019', 20, 'BOX', 10)
            }}
          >
            ⚡ 20 Boxes Solder Wire (10 coils/box = 90k units)
          </button>
          <button
            className="btn outline"
            style={{ fontSize: 12, padding: '4px 10px', borderColor: '#8b5cf6', color: '#7c3aed', fontWeight: 600 }}
            onClick={() => {
              setSimMaterial('MAT-WIRE-019')
              setSimQuantity(20)
              setSimPackType('BOX')
              setSimInnersPerPack(8)
              handleSimulate('MAT-WIRE-019', 20, 'BOX', 8)
            }}
          >
            ⚡ 20 Boxes Solder Wire (8 coils/box = 72k units)
          </button>
          <button
            className="btn outline"
            style={{ fontSize: 12, padding: '4px 10px', borderColor: '#22c55e', color: '#16a34a', fontWeight: 600 }}
            onClick={() => {
              setSimMaterial('MAT-PCB-004')
              setSimQuantity(10)
              setSimPackType('BOX')
              setSimInnersPerPack(10)
              handleSimulate('MAT-PCB-004', 10, 'BOX', 10)
            }}
          >
            ⚡ 10 Boxes Main PCB (Replenishes Bottleneck!)
          </button>
          <button
            className="btn outline"
            style={{ fontSize: 12, padding: '4px 10px', borderColor: 'var(--brand-orange)', color: 'var(--brand-orange)', fontWeight: 600 }}
            onClick={() => {
              setSimMaterial('MAT-PASTE-017')
              setSimQuantity(5)
              setSimPackType('CASE')
              setSimInnersPerPack(10)
              handleSimulate('MAT-PASTE-017', 5, 'CASE', 10)
            }}
          >
            ⚡ 5 Cases Solder Paste (Jars → KG conversion)
          </button>
        </div>

        {/* Simulation Input Controls - Horizontally Aligned */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 12,
            background: 'var(--card)',
            padding: '16px 18px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            marginBottom: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          {/* Column 1: Material Received */}
          <div style={{ flex: '2 1 240px', minWidth: 220, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ height: 26, display: 'flex', alignItems: 'flex-end', fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #4b5563)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Material Received
            </label>
            <select
              value={simMaterial}
              onChange={(e) => setSimMaterial(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontWeight: 600,
                fontSize: 13,
                boxSizing: 'border-box',
                background: 'var(--card)',
                outline: 'none',
              }}
            >
              {conversions.map((c) => (
                <option key={c.material_id} value={c.material_id}>
                  {c.material_id} · {c.material_name} ({c.purchase_uom})
                </option>
              ))}
            </select>
          </div>

          {/* Column 2: Quantity Received */}
          <div style={{ flex: '1 1 140px', minWidth: 120, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ height: 26, display: 'flex', alignItems: 'flex-end', fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #4b5563)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Packs / Boxes Received
            </label>
            <input
              type="number"
              min={1}
              max={10000}
              value={simQuantity}
              onChange={(e) => setSimQuantity(Math.max(1, Number(e.target.value)))}
              style={{
                width: '100%',
                height: 38,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontWeight: 700,
                fontSize: 14,
                boxSizing: 'border-box',
                background: 'var(--card)',
                outline: 'none',
              }}
            />
          </div>

          {/* Column 3: Purchase Packaging UoM */}
          <div style={{ flex: '1 1 120px', minWidth: 110, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ height: 26, display: 'flex', alignItems: 'flex-end', fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #4b5563)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Packaging UoM
            </label>
            <input
              type="text"
              readOnly
              value={simPackType}
              style={{
                width: '100%',
                height: 38,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontWeight: 700,
                fontSize: 14,
                background: 'var(--muted-fill)',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {/* Column 4: Items / Products per Pack with Stepper */}
          <div style={{ flex: '1.2 1 170px', minWidth: 160, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ height: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #4b5563)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                Items per {simPackType || 'Pack'}
              </label>
              <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>
                Def: {currentConv?.inners_per_purchase ?? 10} {currentConv?.inner_uom ?? 'units'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, boxSizing: 'border-box' }}>
              <button
                type="button"
                className="btn outline"
                style={{ padding: '0 12px', height: 38, fontWeight: 800, fontSize: 16, borderRadius: 8, boxSizing: 'border-box' }}
                onClick={() => setSimInnersPerPack((prev) => Math.max(1, prev - 1))}
                disabled={simInnersPerPack <= 1}
                title="Decrease count per pack"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={100000}
                value={simInnersPerPack}
                onChange={(e) => setSimInnersPerPack(Math.max(1, Number(e.target.value)))}
                style={{
                  width: '100%',
                  height: 38,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  padding: '0 6px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  boxSizing: 'border-box',
                  background: 'var(--card)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                className="btn outline"
                style={{ padding: '0 12px', height: 38, fontWeight: 800, fontSize: 16, borderRadius: 8, boxSizing: 'border-box' }}
                onClick={() => setSimInnersPerPack((prev) => prev + 1)}
                title="Increase count per pack"
              >
                +
              </button>
            </div>
          </div>

          {/* Column 5: Calculate Button */}
          <div style={{ flex: '1.2 1 180px', minWidth: 170, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ height: 26, marginBottom: 6 }} />
            <button
              className="btn primary"
              style={{
                width: '100%',
                height: 38,
                fontWeight: 700,
                borderRadius: 8,
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
              disabled={isSimulating}
              onClick={() => handleSimulate()}
            >
              {isSimulating ? 'Calculating...' : '⚡ Calculate Capacity Impact'}
            </button>
          </div>
        </div>

        {/* Simulation Output Cards: Receipt Alone vs Actual Plant Added */}
        {simResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {/* Box 1: Receipt Alone Potential */}
              <div
                style={{
                  padding: 18,
                  borderRadius: 10,
                  border: '1px solid rgba(111, 61, 186, 0.25)',
                  background: 'rgba(111, 61, 186, 0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="small muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                    1. Receipt Conversion &amp; Potential
                  </span>
                  <span style={{ background: 'var(--brand-purple)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                    STANDALONE
                  </span>
                </div>
                <div style={{ margin: '10px 0 6px' }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--brand-purple)' }}>
                    {simResult.capacity_from_receipt_alone.toLocaleString()}
                  </div>
                  <div className="small muted">Phones Supported by Receipt Alone</div>
                </div>

                <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div>
                    <b>Input:</b> {simResult.receipt_input.pack_quantity} {simResult.receipt_input.pack_type} of {simResult.receipt_input.material_name}{' '}
                    <span style={{ fontSize: 11, background: 'rgba(111, 61, 186, 0.15)', color: 'var(--brand-purple)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                      {simResult.receipt_input.inners_per_pack ?? 10} {simResult.receipt_input.inner_uom || 'units'}/{simResult.receipt_input.pack_type}
                    </span>
                  </div>
                  <div><b>Conversion Chain:</b> {simResult.receipt_input.inner_breakdown} = <b>{simResult.receipt_input.base_quantity} {simResult.receipt_input.base_uom}</b></div>
                  <div><b>Consumption:</b> {simResult.receipt_input.consumption_standard}</div>
                </div>
              </div>

              {/* Box 2: Effective Capacity Added to Plant (The Leadership View) */}
              <div
                style={{
                  padding: 18,
                  borderRadius: 10,
                  border: `2px solid ${simResult.effective_capacity_added_to_plant === 0 ? '#ef4444' : '#22c55e'}`,
                  background: simResult.effective_capacity_added_to_plant === 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(34, 197, 94, 0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="small muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                    2. Capacity Added to Plant (Leadership View)
                  </span>
                  <span
                    style={{
                      background: simResult.effective_capacity_added_to_plant === 0 ? '#ef4444' : '#22c55e',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {simResult.effective_capacity_added_to_plant === 0 ? '0 PHONES ADDED' : `+${simResult.effective_capacity_added_to_plant.toLocaleString()} PHONES UNLOCKED`}
                  </span>
                </div>
                <div style={{ margin: '10px 0 6px' }}>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: simResult.effective_capacity_added_to_plant === 0 ? '#ef4444' : '#16a34a',
                    }}
                  >
                    {simResult.effective_capacity_added_to_plant === 0
                      ? '0 phones'
                      : `+${simResult.effective_capacity_added_to_plant.toLocaleString()} phones`}
                  </div>
                  <div className="small muted">
                    Plant Capacity: <b>{simResult.baseline_plant_capacity.gross_capacity.toLocaleString()}</b> →{' '}
                    <b>{simResult.new_simulated_capacity.gross_capacity.toLocaleString()} units</b>
                  </div>
                </div>

                <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div><b>Limiting Bottleneck:</b> {simResult.new_simulated_capacity.bottleneck_material_name} (<code>{simResult.new_simulated_capacity.bottleneck_material_id}</code>)</div>
                  {simResult.next_bottleneck_to_buy && simResult.next_bottleneck_to_buy.quantity_to_buy_to_match_receipt > 0 && (
                    <div style={{ color: '#ef4444', fontWeight: 600 }}>
                      👉 Buy Next: <b>{simResult.next_bottleneck_to_buy.quantity_to_buy_to_match_receipt.toLocaleString()} {simResult.next_bottleneck_to_buy.uom}</b> of {simResult.next_bottleneck_to_buy.material_name} to lift the line ceiling!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Executive Takeaway Banner */}
            <div
              style={{
                background: simResult.effective_capacity_added_to_plant === 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.1)',
                padding: '14px 18px',
                borderRadius: 8,
                border: `1px solid ${simResult.effective_capacity_added_to_plant === 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 22 }}>
                {simResult.effective_capacity_added_to_plant === 0 ? '💡' : '🎉'}
              </span>
              <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
                <b>Executive Finding: </b>
                {simResult.leadership_takeaway}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Selection Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {products.map((p) => {
          const isSelected = p.product_id === selectedProduct
          return (
            <div
              key={p.product_id}
              onClick={() => setSelectedProduct(p.product_id)}
              className="card"
              style={{
                padding: 18,
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--brand-purple)' : '1px solid var(--border)',
                background: isSelected ? 'rgba(111, 61, 186, 0.05)' : 'var(--card)',
                transition: 'all .15s ease',
                position: 'relative',
              }}
            >
              {isSelected && (
                <span
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'var(--brand-purple)',
                    color: '#fff',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    textTransform: 'uppercase',
                  }}
                >
                  Selected
                </span>
              )}
              <div className="small muted" style={{ fontWeight: 600 }}>
                {p.product_id}
              </div>
              <h3 style={{ margin: '4px 0 10px', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                {p.product_name}
              </h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
                    {p.max_production_capacity.toLocaleString()}
                  </div>
                  <div className="small muted">Gross Buildable Units</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: (p.protected_production_capacity ?? 0) === 0 ? '#ef4444' : 'var(--ok)' }}>
                    {p.protected_production_capacity?.toLocaleString() ?? 0}
                  </div>
                  <div className="small muted">Protected Units</div>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: 12,
                }}
              >
                <span style={{ color: '#ef4444', fontWeight: 700 }}>Bottleneck: </span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{p.bottleneck_material}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 16-Part BOM Explosion Table with Safety Stock Protection */}
      <div className="card" style={{ padding: 20 }}>
        <div className="card-head" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              16-Component BOM Capacity &amp; Safety Stock Analysis · {currentProduct?.product_name}
            </h3>
            <p className="muted small" style={{ margin: '3px 0 0' }}>
              Gross Capacity = floor(Usable ÷ Req/unit) · Protected Capacity = floor(max(0, Usable − Safety Stock) ÷ Req/unit)
            </p>
          </div>
          <div className="small muted">
            Showing <b>{sortedComponents.length}</b> BOM components
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th>Component Code</th>
                <th>Component Description</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Req / Phone</th>
                <th style={{ textAlign: 'right' }}>Scrap</th>
                <th style={{ textAlign: 'right' }}>Usable Stock</th>
                <th style={{ textAlign: 'right' }}>Safety Stock</th>
                <th style={{ textAlign: 'right' }}>Gross Phones</th>
                <th style={{ textAlign: 'right' }}>Protected Phones</th>
                <th>Buffer Health</th>
                <th style={{ textAlign: 'right' }}>Target Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {sortedComponents.map((comp, idx) => {
                const isBottleneck = idx === 0
                const isBelowSS = comp.is_below_safety_stock ?? (comp.usable_stock < (comp.safety_stock_qty || 0))
                const shortfall = targetVolume > comp.supported_capacity
                  ? Math.ceil((targetVolume - comp.supported_capacity) * comp.adjusted_req_per_unit)
                  : 0

                return (
                  <tr
                    key={comp.material_id}
                    style={{
                      background: isBottleneck ? 'rgba(239, 68, 68, 0.04)' : undefined,
                    }}
                  >
                    <td>
                      <code>{comp.material_id}</code>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <Link to={`/material/${comp.material_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {comp.material_name}
                      </Link>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--muted-fill)', color: 'var(--text)' }}>
                        {comp.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{comp.qty_per_product} {comp.uom}</td>
                    <td style={{ textAlign: 'right' }}>{(comp.scrap_factor * 100).toFixed(1)}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatQty(comp.usable_stock, comp.uom)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                      {comp.safety_stock_qty !== undefined ? formatQty(comp.safety_stock_qty, comp.uom) : '—'}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: 13.5,
                        color: isBottleneck ? '#ef4444' : 'var(--text)',
                      }}
                    >
                      {comp.supported_capacity.toLocaleString()}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: 13.5,
                        color: isBelowSS ? '#ef4444' : 'var(--ok)',
                      }}
                    >
                      {comp.protected_capacity !== undefined ? comp.protected_capacity.toLocaleString() : '—'}
                    </td>
                    <td>
                      {isBottleneck ? (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          BOTTLENECK
                        </span>
                      ) : isBelowSS ? (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                          }}
                        >
                          BELOW SS
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(34, 197, 94, 0.12)',
                            color: 'var(--ok)',
                          }}
                        >
                          BUFFER OK
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: shortfall > 0 ? 700 : 400, color: shortfall > 0 ? '#ef4444' : 'var(--muted)' }}>
                      {shortfall > 0 ? `+${shortfall.toLocaleString()} ${comp.uom}` : 'Covered'}
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
