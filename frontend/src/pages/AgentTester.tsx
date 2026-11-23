import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { PageIcon } from '../icons'
import { MarkdownView } from '../components/MarkdownView'

interface AgentCatalogItem {
  id: string
  code: string
  name: string
  stage: string
  role: string
  tools: string[]
  mcp_server: string
  icon: string
  status: string
  sample_prompt: string
  default_material?: string | null
}

interface TestAgentResult {
  agent_id: string
  question: string
  context: Record<string, any>
  answer: string
  status: string
  latency_ms: number
  route: string
  specialists: string[]
  tool_trace: Array<{
    tool: string
    args?: Record<string, any>
    res?: Record<string, any>
  }>
  assumptions: string[]
  cites: Array<{
    type: string
    id: string
    label: string
    url: string
  }>
  mcp_executed: boolean
}

const MATERIALS_DROPDOWN = [
  { id: 'MAT-SOC-001', name: 'Snapdragon 8 Gen 2 SoC (TRAY)', uom: 'EA' },
  { id: 'MAT-PCB-004', name: '6-layer High-Density Main PCB (BOX)', uom: 'EA' },
  { id: 'MAT-DSP-005', name: '6.5in AMOLED Display Module (BOX)', uom: 'EA' },
  { id: 'MAT-BAT-006', name: '5000mAh Li-ion Battery (CARTON)', uom: 'EA' },
  { id: 'MAT-CAM-007', name: 'Rear Camera Module 50MP Sony (TRAY)', uom: 'EA' },
  { id: 'MAT-MEM-002', name: 'LPDDR5 Memory IC 8GB (REEL)', uom: 'EA' },
  { id: 'MAT-NAND-003', name: 'UFS 3.1 Flash Storage IC (REEL)', uom: 'EA' },
  { id: 'MAT-PASTE-017', name: 'Lead-Free Solder Paste SAC305 (JAR)', uom: 'KG' },
  { id: 'MAT-ADH-018', name: 'Thermal Conductive Adhesive (CARTON)', uom: 'KG' },
  { id: 'MAT-HSG-009', name: 'Aluminium Mid-frame CNC Chassis (BOX)', uom: 'EA' },
  { id: 'MAT-GLS-010', name: 'Cover Glass Corning Gorilla (CARTON)', uom: 'EA' },
  { id: 'MAT-ANT-012', name: 'RF Antenna Flex 5G Sub-6 (BAG)', uom: 'EA' },
  { id: 'MAT-BOX-014', name: 'Retail Packaging Box Eco Edition (BOX)', uom: 'EA' },
]

const SUPPLIERS_DROPDOWN = [
  { id: 'SUP-001', name: 'SUP-001 · Shenzhen Silicon Systems' },
  { id: 'SUP-002', name: 'SUP-002 · Korea Memory Tech' },
  { id: 'SUP-003', name: 'SUP-003 · Taiwan PCB Works' },
  { id: 'SUP-004', name: 'SUP-004 · Chennai Display Components' },
  { id: 'SUP-005', name: 'SUP-005 · VoltCell Energy' },
  { id: 'SUP-006', name: 'SUP-006 · OptiCam Modules' },
  { id: 'SUP-007', name: 'SUP-007 · Precision Enclosures' },
  { id: 'SUP-008', name: 'SUP-008 · Global Pack Solutions' },
  { id: 'SUP-009', name: 'SUP-009 · RF Connect Systems' },
  { id: 'SUP-010', name: 'SUP-010 · SolderPro Materials' },
]

const PRODUCTS_DROPDOWN = [
  { id: 'SPH-A15-128', name: 'Aster 15 (128GB Standard)' },
  { id: 'SPH-A15-256', name: 'Aster 15 (256GB High-Cap)' },
  { id: 'SPH-PRO-256', name: 'Aster Pro 256GB (Flagship)' },
]

interface AgentConfig {
  relevantParams: Array<'plant' | 'material' | 'product' | 'horizon' | 'supplier' | 'quantity'>
  generatePrompt: (p: {
    plant: string
    plantName: string
    material: string
    materialName: string
    product: string
    productName: string
    horizon: number
    supplier: string
    supplierName: string
    quantity: number
  }) => string
  scenarios: Array<{
    label: string
    getPrompt: (p: {
      plant: string
      plantName: string
      material: string
      materialName: string
      product: string
      productName: string
      horizon: number
      supplier: string
      supplierName: string
      quantity: number
    }) => string
    overrides?: {
      material?: string
      product?: string
      horizon?: number
      supplier?: string
      quantity?: number
    }
  }>
}

const AGENT_CONFIGS: Record<string, AgentConfig> = {
  data_reconciliation: {
    relevantParams: ['plant'],
    generatePrompt: (p) =>
      `Verify ERP snapshot integrity, validate inventory assumption tags (A1-A20), and audit cycle count variances at ${p.plant}.`,
    scenarios: [
      {
        label: 'Audit Assumptions (A1-A20)',
        getPrompt: (p) =>
          `Audit all active assumption tags (A1-A20) and verify if any policy inputs are violated at ${p.plant}.`,
      },
      {
        label: 'Reconcile ERP Balances',
        getPrompt: (p) =>
          `Reconcile raw material on-hand balances between SAP S/4HANA and MES records for ${p.plant}.`,
      },
      {
        label: 'Cycle Count Variance Audit',
        getPrompt: (p) =>
          `Audit physical cycle count discrepancies and reconciliation variances against system records at ${p.plant}.`,
      },
    ],
  },
  stock_monitoring: {
    relevantParams: ['plant', 'material'],
    generatePrompt: (p) =>
      `What is our current stock position, usable balance, and days of cover for ${p.material} (${p.materialName}) at ${p.plant}?`,
    scenarios: [
      {
        label: 'Days of Cover Analysis',
        getPrompt: (p) =>
          `What is our current stock position and days of cover for ${p.material} at ${p.plant}?`,
      },
      {
        label: 'Safety Stock Buffer Health',
        getPrompt: (p) =>
          `Check safety stock buffer headroom and stockout warning status for ${p.material} at ${p.plant}.`,
      },
      {
        label: 'Plant Inventory Valuation (INR)',
        getPrompt: (p) =>
          `Calculate the total inventory valuation in INR and current cover status for active components at ${p.plant}.`,
      },
    ],
  },
  shortage_forecast: {
    relevantParams: ['plant', 'horizon', 'material'],
    generatePrompt: (p) =>
      `Which materials will go below safety stock within the next ${p.horizon} days at ${p.plant}, and what is the shortage gap for ${p.material}?`,
    scenarios: [
      {
        label: '30-Day Critical Shortages',
        overrides: { horizon: 30 },
        getPrompt: (p) =>
          `Which materials will go below safety stock within the next 30 days at ${p.plant}?`,
      },
      {
        label: 'Component Stockout Gap',
        getPrompt: (p) =>
          `What is the projected shortage gap and stockout date for ${p.material} over the next ${p.horizon} days at ${p.plant}?`,
      },
      {
        label: 'Assembly Line Stoppage Risk',
        getPrompt: (p) =>
          `Rank all critical components by line stoppage risk and customer order impact over the next ${p.horizon} days at ${p.plant}.`,
      },
    ],
  },
  build_capacity: {
    relevantParams: ['plant', 'product', 'material', 'quantity'],
    generatePrompt: (p) =>
      `How many finished units of ${p.product} (${p.productName}) can ${p.plant} build today, and what is the limiting component?`,
    scenarios: [
      {
        label: 'Gross vs Protected Capacity',
        getPrompt: (p) =>
          `How many finished units of ${p.product} can ${p.plant} build today, comparing gross stock vs safety-stock-protected capacity?`,
      },
      {
        label: 'Packaging Pack Exploder',
        overrides: { material: 'MAT-PCB-004', quantity: 2000 },
        getPrompt: (p) =>
          `How many phones can 20 boxes of ${p.material} build after factoring in BOM scrap and packaging conversions at ${p.plant}?`,
      },
      {
        label: 'Bottleneck Component Gap',
        getPrompt: (p) =>
          `What is the exact component gap on the primary bottleneck preventing ${p.quantity} units of ${p.product} at ${p.plant}?`,
      },
    ],
  },
  replenishment: {
    relevantParams: ['plant', 'material', 'horizon', 'quantity'],
    generatePrompt: (p) =>
      `What replenishment and transfer options are available for ${p.material} (${p.materialName}) to cover the next ${p.horizon} days at ${p.plant}?`,
    scenarios: [
      {
        label: 'Inter-Plant Transfer (BLR <-> MAA)',
        getPrompt: (p) =>
          `Can ${p.material} be transferred from the other plant to cover the ${p.horizon}-day gap without creating a shortage?`,
      },
      {
        label: 'Reorder Point & MOQ Batching',
        getPrompt: (p) =>
          `What is the recommended purchase order quantity for ${p.material} factoring in supplier MOQ and lead time at ${p.plant}?`,
      },
      {
        label: 'Draft PO Proposal Generation',
        getPrompt: (p) =>
          `Generate replenishment proposals for ${p.material} to cover the projected gap over the next ${p.horizon} days at ${p.plant}.`,
      },
    ],
  },
  supplier_delay: {
    relevantParams: ['plant', 'supplier', 'material'],
    generatePrompt: (p) =>
      `If supplier ${p.supplier} (${p.supplierName.split('·')[1]?.trim() || p.supplier}) is delayed by 7 days for ${p.material}, which phone production lines will stop at ${p.plant}?`,
    scenarios: [
      {
        label: '7-Day Supplier Disruption',
        overrides: { supplier: 'SUP-006' },
        getPrompt: (p) =>
          `If supplier ${p.supplier} is delayed by 7 days, which phone production lines will stop at ${p.plant}?`,
      },
      {
        label: '14-Day Logistics Risk',
        getPrompt: (p) =>
          `Simulate a 14-day delivery delay from ${p.supplier} for ${p.material} and estimate total lost finished goods at ${p.plant}.`,
      },
      {
        label: 'Alternative Supplier Relief',
        getPrompt: (p) =>
          `Which alternative suppliers can deliver ${p.material} to ${p.plant} if ${p.supplier} experiences shipping delays?`,
      },
    ],
  },
  qc_inspection: {
    relevantParams: ['plant', 'material'],
    generatePrompt: (p) =>
      `What are the latest incoming quality findings, lot rejection rates, and defect risks for ${p.material} (${p.materialName}) at ${p.plant}?`,
    scenarios: [
      {
        label: 'Incoming Lot Rejection Risk',
        getPrompt: (p) =>
          `What are the incoming lot inspection pass rates and defect risks for ${p.material} arriving at ${p.plant}?`,
      },
      {
        label: 'SMT Line Scrap Drift',
        getPrompt: (p) =>
          `Predict production scrap drift and solder defect rates for ${p.material} based on historical inspection telemetry at ${p.plant}.`,
      },
      {
        label: 'Quarantine & Quality Holds',
        getPrompt: (p) =>
          `Identify all material lots currently under quarantine hold or pending inspection release at ${p.plant}.`,
      },
    ],
  },
  excess_obsolete: {
    relevantParams: ['plant', 'horizon', 'material'],
    generatePrompt: (p) =>
      `How much cash is tied up in excess stock above maximum levels, and which lots of ${p.material} expire within ${p.horizon} days at ${p.plant}?`,
    scenarios: [
      {
        label: 'Excess Above Max Stock',
        getPrompt: (p) =>
          `How much cash is tied up in excess stock above maximum policy levels across all materials at ${p.plant}?`,
      },
      {
        label: 'Shelf-Life Expiry Risk',
        getPrompt: (p) =>
          `Which lots of ${p.material} and chemical consumables are expiring within the next ${p.horizon} days at ${p.plant}?`,
      },
      {
        label: 'Dead Stock Liquidation',
        getPrompt: (p) =>
          `Identify dead stock with zero consumption over 90 days and recommend inter-plant transfer or vendor return options for ${p.plant}.`,
      },
    ],
  },
  coordinator: {
    relevantParams: ['plant', 'horizon'],
    generatePrompt: (p) =>
      `Provide a comprehensive operational summary: line stoppage risks, capacity limits, and approved purchase orders across plants including ${p.plant}.`,
    scenarios: [
      {
        label: 'Executive Operational Brief',
        getPrompt: (p) =>
          `Provide an executive operational summary: line stoppage risks, capacity limits, and approved purchase orders for ${p.plant}.`,
      },
      {
        label: 'End-to-End Pipeline Health',
        getPrompt: (p) =>
          `Audit the entire supply chain pipeline from raw material ingestion through shortage risk to finished goods dispatch at ${p.plant}.`,
      },
      {
        label: 'Bottleneck Escalation Plan',
        getPrompt: (p) =>
          `Synthesize cross-agent recommendations to unblock production and achieve the monthly build target at ${p.plant}.`,
      },
    ],
  },
}

export function AgentTester() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Default to shortage_forecast (procurement agent is handled externally by Agent #11)
  const initialAgent = searchParams.get('agent') || 'shortage_forecast'

  // Form State
  const [selectedAgentId, setSelectedAgentId] = useState<string>(initialAgent)
  const [selectedPlant, setSelectedPlant] = useState<string>('IN-KA-01')
  const [selectedMaterial, setSelectedMaterial] = useState<string>('MAT-PCB-004')
  const [selectedProduct, setSelectedProduct] = useState<string>('SPH-A15-128')
  const [selectedHorizon, setSelectedHorizon] = useState<number>(30)
  const [selectedSupplier, setSelectedSupplier] = useState<string>('SUP-006')
  const [testQuantity, setTestQuantity] = useState<number>(2000)
  const [customQuestion, setCustomQuestion] = useState<string>('')

  // Execution State
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<TestAgentResult | null>(null)
  const [rawPayloadVisible, setRawPayloadVisible] = useState<boolean>(false)

  // Load Agent Catalog (excluding procurement handled externally by Agent #11)
  const { data: catalogData } = useQuery({
    queryKey: ['agent-catalog'],
    queryFn: async () => (await api.get<{ agents: AgentCatalogItem[] }>('/api/agent/catalog')).data,
    staleTime: 300_000,
  })

  // Filter out procurement agent (handled externally by Agent #11)
  const agents = (catalogData?.agents ?? []).filter((a) => a.id !== 'procurement')
  const currentAgent = agents.find((a) => a.id === selectedAgentId) || agents[0]

  // Active parameter descriptors
  const plantName = selectedPlant === 'IN-KA-01' ? 'IN-KA-01 (Bengaluru)' : 'IN-TN-01 (Chennai)'
  const materialObj = MATERIALS_DROPDOWN.find((m) => m.id === selectedMaterial) || MATERIALS_DROPDOWN[0]
  const materialName = materialObj.name
  const productObj = PRODUCTS_DROPDOWN.find((p) => p.id === selectedProduct) || PRODUCTS_DROPDOWN[0]
  const productName = productObj.name
  const supplierObj = SUPPLIERS_DROPDOWN.find((s) => s.id === selectedSupplier) || SUPPLIERS_DROPDOWN[0]
  const supplierName = supplierObj.name

  const currentParams = useMemo(
    () => ({
      plant: selectedPlant,
      plantName,
      material: selectedMaterial,
      materialName,
      product: selectedProduct,
      productName,
      horizon: selectedHorizon,
      supplier: selectedSupplier,
      supplierName,
      quantity: testQuantity,
    }),
    [
      selectedPlant,
      plantName,
      selectedMaterial,
      materialName,
      selectedProduct,
      productName,
      selectedHorizon,
      selectedSupplier,
      supplierName,
      testQuantity,
    ]
  )

  const activeConfig = AGENT_CONFIGS[selectedAgentId] || AGENT_CONFIGS['shortage_forecast']

  // Update prompt whenever agent changes
  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId)
    setSearchParams({ agent: agentId })
    const targetAgent = agents.find((a) => a.id === agentId)
    const cfg = AGENT_CONFIGS[agentId]

    let newMat = selectedMaterial
    if (targetAgent?.default_material) {
      newMat = targetAgent.default_material
      setSelectedMaterial(newMat)
    }

    const updatedParams = {
      ...currentParams,
      material: newMat,
      materialName: MATERIALS_DROPDOWN.find((m) => m.id === newMat)?.name || newMat,
    }

    if (cfg) {
      setCustomQuestion(cfg.generatePrompt(updatedParams))
    } else if (targetAgent) {
      setCustomQuestion(targetAgent.sample_prompt)
    }
  }

  // Initial prompt setup on mount
  useEffect(() => {
    if (currentAgent && !customQuestion) {
      if (currentAgent.default_material) {
        setSelectedMaterial(currentAgent.default_material)
      }
      if (activeConfig) {
        setCustomQuestion(activeConfig.generatePrompt(currentParams))
      } else {
        setCustomQuestion(currentAgent.sample_prompt)
      }
    }
  }, [currentAgent]) // eslint-disable-line

  // Handle Preset Scenario click
  const handleApplyScenario = (scenario: (typeof activeConfig.scenarios)[0]) => {
    if (scenario.overrides) {
      if (scenario.overrides.material) setSelectedMaterial(scenario.overrides.material)
      if (scenario.overrides.product) setSelectedProduct(scenario.overrides.product)
      if (scenario.overrides.horizon) setSelectedHorizon(scenario.overrides.horizon)
      if (scenario.overrides.supplier) setSelectedSupplier(scenario.overrides.supplier)
      if (scenario.overrides.quantity) setTestQuantity(scenario.overrides.quantity)
    }

    const mergedParams = {
      ...currentParams,
      ...(scenario.overrides?.material ? {
        material: scenario.overrides.material,
        materialName: MATERIALS_DROPDOWN.find((m) => m.id === scenario.overrides?.material)?.name || scenario.overrides.material
      } : {}),
      ...(scenario.overrides?.product ? {
        product: scenario.overrides.product,
        productName: PRODUCTS_DROPDOWN.find((p) => p.id === scenario.overrides?.product)?.name || scenario.overrides.product
      } : {}),
      ...(scenario.overrides?.horizon ? { horizon: scenario.overrides.horizon } : {}),
      ...(scenario.overrides?.supplier ? {
        supplier: scenario.overrides.supplier,
        supplierName: SUPPLIERS_DROPDOWN.find((s) => s.id === scenario.overrides?.supplier)?.name || scenario.overrides.supplier
      } : {}),
      ...(scenario.overrides?.quantity ? { quantity: scenario.overrides.quantity } : {}),
    }

    setCustomQuestion(scenario.getPrompt(mergedParams))
  }

  // Regenerate prompt with currently selected dropdown values
  const handleRefreshPromptFromParams = () => {
    if (activeConfig) {
      setCustomQuestion(activeConfig.generatePrompt(currentParams))
    }
  }

  // Run Agent Test
  const handleRunTest = async () => {
    if (!customQuestion.trim()) return
    setIsRunning(true)
    try {
      const res = await api.post<TestAgentResult>('/api/agent/test-specialist', {
        agent_id: selectedAgentId,
        question: customQuestion,
        plant_id: selectedPlant,
        material_id: selectedMaterial,
        product_id: selectedProduct,
        quantity: testQuantity,
        horizon: selectedHorizon,
        supplier_id: selectedSupplier,
      })
      setTestResult(res.data)
    } catch (err) {
      console.error('Agent test failed:', err)
    } finally {
      setIsRunning(false)
    }
  }

  const isParamRelevant = (param: 'plant' | 'material' | 'product' | 'horizon' | 'supplier' | 'quantity') =>
    activeConfig.relevantParams.includes(param)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-head">
        <PageIcon name="sparkle" />
        <div>
          <div className="crumb">
            <Link to="/agents" style={{ color: 'var(--brand-purple)', textDecoration: 'none' }}>
              ← Back to Agent Hub &amp; Pipeline
            </Link>
            {' · Agent Playground'}
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            Specialized Agent Testing Playground
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            Directly test any specialized supply chain agent. Selecting an agent dynamically adapts the prompt, parameters, and scenario presets.
          </p>
        </div>
      </div>

      {/* Agent Selector Card */}
      <div
        className="card"
        style={{
          padding: 18,
          border: '2px solid var(--brand-purple)',
          background: 'linear-gradient(180deg, rgba(111, 61, 186, 0.04), transparent)',
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ flex: '1 1 320px' }}>
            <label className="small muted" style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
              Select Agent to Test (Prompt &amp; Presets Adapt Automatically)
            </label>
            <select
              value={selectedAgentId}
              onChange={(e) => handleSelectAgent(e.target.value)}
              style={{ width: '100%', fontSize: 15, fontWeight: 700, padding: '8px 12px' }}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name} ({a.stage})
                </option>
              ))}
            </select>
          </div>

          {currentAgent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  MCP Host: <code>{currentAgent.mcp_server}</code>
                </div>
                <div className="small muted">
                  Tools: {currentAgent.tools.join(', ')}
                </div>
              </div>
              <span
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#16a34a',
                  fontWeight: 800,
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 16,
                }}
              >
                ● ACTIVE
              </span>
            </div>
          )}
        </div>

        {currentAgent && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <b>Agent Role:</b> {currentAgent.role}
          </div>
        )}
      </div>

      {/* Grid: Left Input Controls, Right Live Output */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        {/* ========================================================================= */}
        {/* LEFT COLUMN: TEST PARAMETERS & DROPDOWNS                                 */}
        {/* ========================================================================= */}
        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                🛠️ Test Parameters &amp; Dropdowns
              </h2>
              <div className="small muted">
                Highlighted inputs feed directly into <b>{currentAgent?.name}</b>
              </div>
            </div>
            <button
              className="btn outline"
              style={{ fontSize: 11, padding: '3px 8px', fontWeight: 600 }}
              onClick={handleRefreshPromptFromParams}
              title="Sync prompt text with currently selected dropdown values"
            >
              🔄 Sync Prompt
            </button>
          </div>

          {/* Dropdown 1: Plant */}
          <div style={{ opacity: isParamRelevant('plant') ? 1 : 0.65 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="small muted" style={{ fontWeight: 600 }}>
                Target Plant
              </label>
              {isParamRelevant('plant') && (
                <span style={{ fontSize: 10, color: 'var(--brand-purple)', fontWeight: 700 }}>
                  ● Used by {currentAgent?.code}
                </span>
              )}
            </div>
            <select
              value={selectedPlant}
              onChange={(e) => {
                setSelectedPlant(e.target.value)
              }}
              style={{
                width: '100%',
                fontWeight: 600,
                border: isParamRelevant('plant') ? '1.5px solid var(--brand-purple)' : undefined,
              }}
            >
              <option value="IN-KA-01">IN-KA-01 (Bengaluru Assembly Plant)</option>
              <option value="IN-TN-01">IN-TN-01 (Chennai Manufacturing Facility)</option>
            </select>
          </div>

          {/* Dropdown 2: Material */}
          <div style={{ opacity: isParamRelevant('material') ? 1 : 0.65 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="small muted" style={{ fontWeight: 600 }}>
                Target Material
              </label>
              {isParamRelevant('material') && (
                <span style={{ fontSize: 10, color: 'var(--brand-purple)', fontWeight: 700 }}>
                  ● Used by {currentAgent?.code}
                </span>
              )}
            </div>
            <select
              value={selectedMaterial}
              onChange={(e) => {
                setSelectedMaterial(e.target.value)
              }}
              style={{
                width: '100%',
                fontWeight: 600,
                border: isParamRelevant('material') ? '1.5px solid var(--brand-purple)' : undefined,
              }}
            >
              {MATERIALS_DROPDOWN.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} · {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown 3 & 4 in two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ opacity: isParamRelevant('product') ? 1 : 0.65 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="small muted" style={{ fontWeight: 600 }}>
                  Finished Product
                </label>
                {isParamRelevant('product') && (
                  <span style={{ fontSize: 10, color: 'var(--brand-purple)', fontWeight: 700 }}>
                    ● Used
                  </span>
                )}
              </div>
              <select
                value={selectedProduct}
                onChange={(e) => {
                  setSelectedProduct(e.target.value)
                }}
                style={{
                  width: '100%',
                  fontWeight: 600,
                  border: isParamRelevant('product') ? '1.5px solid var(--brand-purple)' : undefined,
                }}
              >
                {PRODUCTS_DROPDOWN.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ opacity: isParamRelevant('horizon') ? 1 : 0.65 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="small muted" style={{ fontWeight: 600 }}>
                  Planning Horizon
                </label>
                {isParamRelevant('horizon') && (
                  <span style={{ fontSize: 10, color: 'var(--brand-purple)', fontWeight: 700 }}>
                    ● Used
                  </span>
                )}
              </div>
              <select
                value={selectedHorizon}
                onChange={(e) => {
                  setSelectedHorizon(Number(e.target.value))
                }}
                style={{
                  width: '100%',
                  fontWeight: 600,
                  border: isParamRelevant('horizon') ? '1.5px solid var(--brand-purple)' : undefined,
                }}
              >
                <option value={30}>30 Days (Immediate Risk)</option>
                <option value={60}>60 Days (Tactical Buffer)</option>
                <option value={90}>90 Days (Quarterly Plan)</option>
              </select>
            </div>
          </div>

          {/* Dropdown 5 & Quantity in two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
            <div style={{ opacity: isParamRelevant('supplier') ? 1 : 0.65 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="small muted" style={{ fontWeight: 600 }}>
                  Supplier (for Delays/Risk)
                </label>
                {isParamRelevant('supplier') && (
                  <span style={{ fontSize: 10, color: 'var(--brand-purple)', fontWeight: 700 }}>
                    ● Used
                  </span>
                )}
              </div>
              <select
                value={selectedSupplier}
                onChange={(e) => {
                  setSelectedSupplier(e.target.value)
                }}
                style={{
                  width: '100%',
                  fontWeight: 600,
                  border: isParamRelevant('supplier') ? '1.5px solid var(--brand-purple)' : undefined,
                }}
              >
                {SUPPLIERS_DROPDOWN.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ opacity: isParamRelevant('quantity') ? 1 : 0.65 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="small muted" style={{ fontWeight: 600 }}>
                  Test Quantity
                </label>
                {isParamRelevant('quantity') && (
                  <span style={{ fontSize: 10, color: 'var(--brand-purple)', fontWeight: 700 }}>
                    ● Used
                  </span>
                )}
              </div>
              <input
                type="number"
                min={1}
                max={50000}
                value={testQuantity}
                onChange={(e) => {
                  setTestQuantity(Number(e.target.value))
                }}
                style={{
                  width: '100%',
                  fontWeight: 700,
                  border: isParamRelevant('quantity') ? '1.5px solid var(--brand-purple)' : undefined,
                }}
              />
            </div>
          </div>

          {/* Agent-Specific Scenario Preset Chips */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="small muted" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
                🎯 {currentAgent?.code} Scenario Presets (Click to Load Prompt):
              </label>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {activeConfig.scenarios.map((sc, i) => (
                <button
                  key={i}
                  type="button"
                  className="btn outline"
                  style={{
                    fontSize: 11.5,
                    padding: '4px 10px',
                    borderRadius: 16,
                    fontWeight: 700,
                    background: '#F8FAFC',
                    borderColor: 'var(--brand-purple)',
                    color: 'var(--brand-purple)',
                  }}
                  onClick={() => handleApplyScenario(sc)}
                >
                  ⚡ {sc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question / Prompt Box */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="small muted" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
                Agent Prompt / Question (Auto-Generated for {currentAgent?.code})
              </label>
              <button
                type="button"
                className="btn sm outline"
                style={{ fontSize: 10, padding: '1px 6px' }}
                onClick={() => setCustomQuestion(activeConfig.generatePrompt(currentParams))}
              >
                Reset to Default
              </button>
            </div>
            <textarea
              rows={3}
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="Enter question or instruction for the agent..."
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13.5,
                lineHeight: 1.5,
                borderRadius: 6,
                border: '1.5px solid var(--brand-purple)',
                fontFamily: 'inherit',
                background: '#FDFAFF',
              }}
            />
          </div>

          {/* Run Button */}
          <button
            className="btn primary"
            style={{
              height: 44,
              fontWeight: 800,
              fontSize: 14.5,
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              borderColor: '#4F46E5',
            }}
            disabled={isRunning || !customQuestion.trim()}
            onClick={handleRunTest}
          >
            {isRunning ? 'Executing Agent Pipeline via MCP...' : `⚡ Test ${currentAgent?.name || 'Agent'}`}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: LIVE AGENT EXECUTION TRACE & OUTPUT                         */}
        {/* ========================================================================= */}
        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              ⚡ MCP Live Execution &amp; Grounded Output
            </h2>
            {testResult && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#16a34a',
                  background: 'rgba(34, 197, 94, 0.1)',
                  padding: '3px 8px',
                  borderRadius: 12,
                }}
              >
                ⏱ {testResult.latency_ms} ms · MCP Executed
              </span>
            )}
          </div>

          {!testResult && !isRunning && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                color: 'var(--muted)',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 44 }}>🧪</span>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
                Playground Ready for {currentAgent?.name}
              </div>
              <p style={{ maxWidth: 380, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                Select a scenario preset chip on the left, inspect the tailored agent prompt, and click{' '}
                <b>Test {currentAgent?.name}</b> to view live MCP execution traces and responses.
              </p>
            </div>
          )}

          {isRunning && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: '3px solid rgba(111, 61, 186, 0.2)',
                  borderTopColor: 'var(--brand-purple)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>
                Dispatching MCP Tool Execution...
              </div>
              <div className="small muted">
                Executing tools on <code>{currentAgent?.mcp_server}</code>
              </div>
            </div>
          )}

          {testResult && !isRunning && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Tool Execution Trace Box */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                  🔌 Model Context Protocol (MCP) Execution Trace
                </div>
                {testResult.tool_trace.length === 0 ? (
                  <div className="small muted">Deterministic direct calculation used.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {testResult.tool_trace.map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#fff',
                          border: '1px solid #E2E8F0',
                          borderRadius: 6,
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span>
                          <code>{t.tool}</code>
                        </div>
                        <span className="small muted">MCP Call #{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agent Grounded Answer */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                  🤖 Agent Grounded Response
                </div>
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 16,
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    maxHeight: 320,
                    overflowY: 'auto',
                  }}
                >
                  <MarkdownView content={testResult.answer} />
                </div>
              </div>

              {/* Assumptions & Citations */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {testResult.assumptions.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    <b>Assumption Tags:</b> {testResult.assumptions.join(', ')}
                  </div>
                )}
                {testResult.cites.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    <b>Citations:</b> {testResult.cites.map((c) => c.label).join(', ')}
                  </div>
                )}
              </div>

              {/* Toggle Raw JSON */}
              <div>
                <button
                  className="btn outline sm"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => setRawPayloadVisible(!rawPayloadVisible)}
                >
                  {rawPayloadVisible ? 'Hide Raw MCP Payload' : 'View Raw MCP Payload'}
                </button>
                {rawPayloadVisible && (
                  <pre
                    style={{
                      marginTop: 8,
                      background: '#1E293B',
                      color: '#F8FAFC',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 11,
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}
                  >
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
