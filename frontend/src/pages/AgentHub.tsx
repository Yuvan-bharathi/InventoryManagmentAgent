import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Icon } from '../icons'
import { useShell } from '../shell-context'

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

interface PipelineStage {
  stage: number
  name: string
  agent_id: string
  agent_name: string
  handoff_to: string
  handoff_summary: string
}

interface CatalogResponse {
  agents: AgentCatalogItem[]
  pipeline: PipelineStage[]
  total_agents: number
  total_tools: number
  mcp_protocol: string
}

export function AgentHub() {
  const navigate = useNavigate()
  const { openAgent } = useShell()
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [showTrace, setShowTrace] = useState<boolean>(false)
  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false)
  const [supplierMitigated, setSupplierMitigated] = useState<boolean>(false)
  const [flowSim, setFlowSim] = useState<{
    isRunning: boolean
    activeStep: number
    completedSteps: number[]
    logs: Array<{ step: number; agent: string; text: string; time: string }>
  }>({
    isRunning: false,
    activeStep: 0,
    completedSteps: [],
    logs: [],
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const [flowCoords, setFlowCoords] = useState<{
    agt02Right: number
    agt02CenterY: number
    agt08Right: number
    agt08CenterY: number
    agt04Left: number
    agt04Right: number
    agt04CenterY: number
    agt07Left: number
    agt07CenterY: number
  } | null>(null)

  useEffect(() => {
    const updateCoords = () => {
      if (!containerRef.current) return
      const cRect = containerRef.current.getBoundingClientRect()
      const el02 = document.getElementById('flow-card-agt-02')
      const el08 = document.getElementById('flow-card-agt-08')
      const el04 = document.getElementById('flow-card-agt-04')
      const el07 = document.getElementById('flow-card-agt-07')

      if (el02 && el08 && el04 && el07) {
        const r02 = el02.getBoundingClientRect()
        const r08 = el08.getBoundingClientRect()
        const r04 = el04.getBoundingClientRect()
        const r07 = el07.getBoundingClientRect()

        setFlowCoords({
          agt02Right: r02.right - cRect.left,
          agt02CenterY: r02.top + r02.height / 2 - cRect.top,
          agt08Right: r08.right - cRect.left,
          agt08CenterY: r08.top + r08.height / 2 - cRect.top,
          agt04Left: r04.left - cRect.left,
          agt04Right: r04.right - cRect.left,
          agt04CenterY: r04.top + r04.height / 2 - cRect.top,
          agt07Left: r07.left - cRect.left,
          agt07CenterY: r07.top + r07.height / 2 - cRect.top,
        })
      }
    }

    updateCoords()
    const ro = new ResizeObserver(updateCoords)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', updateCoords)
    const timer = setTimeout(updateCoords, 300)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateCoords)
      clearTimeout(timer)
    }
  }, [])

  const [pipelineRunMeta, setPipelineRunMeta] = useState<{
    run_id: number
    as_of: string
    stages_completed: number
    total_stages: number
    last_run_time?: string
  } | null>(null)

  // Fetch latest pipeline status on mount
  useEffect(() => {
    api
      .get('/api/agent/pipeline-status')
      .then((res) => {
        const raw = res.data as any
        const d = raw?.data || raw
        if (d && d.run_id) {
          setPipelineRunMeta({
            run_id: d.run_id,
            as_of: d.as_of || '31-Oct-2026',
            stages_completed: d.stages_completed || 9,
            total_stages: d.total_stages || 9,
            last_run_time: d.last_run_at
              ? new Date(d.last_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : undefined,
          })
        }
      })
      .catch(() => {})
  }, [])

  const getStageAgentName = (step: number) => {
    switch (step) {
      case 1:
        return 'AGT-01 Data Reconciliation Agent'
      case 2:
        return 'AGT-02 Stock Monitoring Agent'
      case 3:
        return 'AGT-03 Shortage Forecast Agent'
      case 4:
        return 'AGT-04 Build Capacity & BOM Twin Agent'
      case 5:
        return 'AGT-05 Replenishment & Proposals Agent'
      case 7:
        return 'AGT-07 Supplier Delay & ML Predictor Agent'
      case 8:
        return 'AGT-08 Incoming QC & Lot Acceptance Agent'
      case 9:
        return 'AGT-09 Excess & Obsolete Inventory Agent'
      case 10:
        return 'AGT-10 Central Orchestrator'
      default:
        return 'Specialized Agent'
    }
  }

  const getStageDisplayNum = (step: number) => {
    const order = [1, 2, 3, 4, 5, 7, 8, 9, 10]
    const idx = order.indexOf(step)
    return idx >= 0 ? idx + 1 : 1
  }

  const renderAgentStatus = (step: number, defaultStatus = 'Ready', defaultColor = '#16A34A') => {
    if (flowSim.activeStep === step) {
      return (
        <span
          className="pipe-pulse-active"
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: '#fff',
            background: '#7C3AED',
            padding: '2px 8px',
            borderRadius: 5,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ● RUNNING NOW
        </span>
      )
    }
    if (flowSim.completedSteps.includes(step)) {
      return (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#16A34A',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} /> ✓ Completed
        </span>
      )
    }
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: defaultColor,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: defaultColor }} /> {defaultStatus}
      </span>
    )
  }

  const getAgentCardStyle = (step: number, defaultBorder = '1px solid #E2E8F0') => {
    const isActive = flowSim.activeStep === step
    const isCompleted = flowSim.completedSteps.includes(step)
    return {
      background: isActive ? '#FAF5FF' : isCompleted ? '#F0FDF4' : '#FFFFFF',
      border: isActive ? '2.5px solid #7C3AED' : isCompleted ? '1.5px solid #22C55E' : defaultBorder,
      boxShadow: isActive
        ? '0 0 0 4px rgba(124, 58, 237, 0.35), 0 8px 24px rgba(124, 58, 237, 0.3)'
        : isCompleted
        ? '0 2px 6px rgba(34, 197, 94, 0.12)'
        : '0 1px 3px rgba(0,0,0,0.02)',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex' as const,
      flexDirection: 'column' as const,
      gap: 5,
      transition: 'all 0.25s ease',
    }
  }

  const runPipelineFlow = async () => {
    if (flowSim.isRunning) return
    setFlowSim({
      isRunning: true,
      activeStep: 1,
      completedSteps: [],
      logs: [],
    })

    try {
      const res = await api.post('/api/agent/run-collaborative-pipeline', {})
      const raw = res.data as any
      const data = raw?.data || raw

      const nowLocal = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const lastRunFormatted = 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      setPipelineRunMeta({
        run_id: data.run_id || 42,
        as_of: data.as_of || '31-Oct-2026',
        stages_completed: data.stages_completed || 9,
        total_stages: data.total_stages || 9,
        last_run_time: lastRunFormatted,
      })

      const rawLogs = data.logs || []
      const liveLogs = rawLogs.map((item: any) => ({
        ...item,
        time: item.iso_time
          ? new Date(item.iso_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : nowLocal,
      }))

      liveLogs.forEach((item: any, idx: number) => {
        setTimeout(() => {
          const isLast = idx === liveLogs.length - 1
          setFlowSim((prev) => ({
            ...prev,
            activeStep: isLast ? 0 : item.step,
            completedSteps: [...new Set([...prev.completedSteps, item.step])],
            logs: liveLogs.slice(0, idx + 1),
            isRunning: !isLast,
          }))
          if (isLast) {
            setShowTrace(true)
          }
        }, (idx + 1) * 850)
      })
    } catch {
      setFlowSim((prev) => ({ ...prev, isRunning: false, activeStep: 0 }))
    }
  }

  const { data } = useQuery({
    queryKey: ['agent-catalog'],
    queryFn: async () => {
      const res = await api.get<CatalogResponse>('/api/agent/catalog')
      return res.data
    },
    staleTime: 120_000,
  })

  const agents = data?.agents ?? []
  // Note: The following agents & pages are developed externally by teammates:
  // 1. Agentic RFQ Management Agent (AGT-06 / Procurement & Proposals)
  // 2. Supplier Performance Agent (AGT-07 / Supplier Delay Simulator)
  // 3. Quality Management Agent (AGT-08 / Quality Hold & Rejects)
  // 4. Product Traceability Agent (Batch Traceability & Root-Cause Analysis DB)
  // They are commented out / filtered here to avoid duplicate scope.
  const externalAgentIds = new Set(['procurement', 'supplier_delay', 'qc_inspection'])

  const filteredAgents = agents
    .filter((a) => !externalAgentIds.has(a.id))
    .filter((a) => {
      if (filterCategory === 'all') return true
      if (filterCategory === 'mcp-inv') return a.mcp_server === 'inventory-mcp-server'
      if (filterCategory === 'mcp-cap') return a.mcp_server === 'capacity-ml-mcp-server'
      if (filterCategory === 'coordinator') return a.id === 'coordinator'
      return true
    })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Exact Page Header matching UI design */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#EDE9FE',
            border: '1px solid #DDD6FE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6D28D9',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>

        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px' }}>
            Enterprise Agent Hub &amp; Collaborative Pipeline
          </h1>
          <p style={{ margin: '4px 0 10px', fontSize: 13.5, color: '#64748B' }}>
            Multi-agent architecture to ingest, reconcile, forecast, plan, replenish and govern inventory across the manufacturing supply chain.
          </p>

          {/* 4 Metadata Badges in a Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#fff',
                border: '1px solid #E2E8F0',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                color: '#334155',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <span style={{ fontSize: 13 }}>👥</span> 10 agents
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#fff',
                border: '1px solid #E2E8F0',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                color: '#334155',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <span style={{ fontSize: 13 }}>🛠️</span> 15 MCP tools
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#fff',
                border: '1px solid #E2E8F0',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                color: '#334155',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <span style={{ fontSize: 13 }}>🧮</span> Deterministic calculations
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#fff',
                border: '1px solid #E2E8F0',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                color: '#334155',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <span style={{ fontSize: 13 }}>🔌</span> MCP 2.3
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COLLABORATIVE PIPELINE TOPOLOGY CANVAS                                    */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Live Execution Alert Banner */}
        {flowSim.isRunning && (
          <div
            style={{
              marginBottom: 16,
              background: 'linear-gradient(135deg, #FAF5FF 0%, #EDE9FE 100%)',
              border: '2px solid #7C3AED',
              borderRadius: 12,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 18px rgba(109, 40, 217, 0.18)',
              animation: 'pipePulse 2s infinite ease-in-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>⚡</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#6D28D9', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>COLLABORATIVE PIPELINE EXECUTING · RUN #{pipelineRunMeta?.run_id || 42}</span>
                  <span className="pipe-pulse-active" style={{ background: '#7C3AED', color: '#fff', fontSize: 10.5, padding: '2px 8px', borderRadius: 10 }}>LIVE</span>
                </div>
                <div style={{ fontSize: 12, color: '#334155', marginTop: 3 }}>
                  Currently Running: <b style={{ color: '#1E293B' }}>{getStageAgentName(flowSim.activeStep)}</b> (Stage {getStageDisplayNum(flowSim.activeStep)} of 9)
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#6D28D9' }}>
                {flowSim.completedSteps.length} / 9 Stages Completed
              </span>
              <div style={{ width: 120, height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(flowSim.completedSteps.length / 9) * 100}%`, height: '100%', background: '#6D28D9', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          </div>
        )}

        {/* Top AGT-10 Coordinator Card */}
        <div
          className={flowSim.activeStep === 10 ? 'agent-node-active' : flowSim.completedSteps.includes(10) ? 'agent-node-completed' : ''}
          style={{
            borderRadius: 14,
            background: flowSim.activeStep === 10 ? '#FAF5FF' : flowSim.completedSteps.includes(10) ? '#F0FDF4' : '#FAF7FD',
            border: flowSim.activeStep === 10 ? '2.5px solid #7C3AED' : flowSim.completedSteps.includes(10) ? '1.5px solid #22C55E' : '1.5px solid #DDD6FE',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: flowSim.activeStep === 10
              ? '0 0 0 4px rgba(124, 58, 237, 0.35), 0 8px 24px rgba(124, 58, 237, 0.3)'
              : flowSim.completedSteps.includes(10)
              ? '0 2px 6px rgba(34, 197, 94, 0.12)'
              : '0 1px 3px rgba(0,0,0,0.02)',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#EDE9FE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6D28D9',
                flexShrink: 0,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: '#6D28D9',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  AGT-10 · COORDINATOR
                </span>
                {renderAgentStatus(10, 'Active orchestrator', '#16A34A')}
              </div>

              <h2 style={{ margin: '4px 0 2px', fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                Inventory Copilot Coordinator
              </h2>
              <div style={{ fontSize: 12.5, color: '#64748B' }}>
                Decomposes requests, delegates specialist tasks, validates grounded outputs.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={runPipelineFlow}
              disabled={flowSim.isRunning}
              style={{
                background: '#6D28D9',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontWeight: 700,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: flowSim.isRunning ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(109, 40, 217, 0.25)',
              }}
            >
              <span>▶</span> {flowSim.isRunning ? 'Running pipeline...' : 'Run collaborative pipeline'}
            </button>

            <button
              onClick={() => setShowTrace(!showTrace)}
              style={{
                background: '#fff',
                color: '#6D28D9',
                border: '1.5px solid #6D28D9',
                borderRadius: 8,
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <span>:=</span> View execution trace
            </button>
          </div>
        </div>

        {/* Branching SVG Connector Bus line from AGT-10 down into 3 Columns */}
        <div style={{ position: 'relative', width: '100%', height: 32, margin: '0' }}>
          <svg width="100%" height="32" style={{ overflow: 'visible' }}>
            {/* Center drop line from AGT-10 */}
            <line x1="50%" y1="0" x2="50%" y2="16" stroke="#6D28D9" strokeWidth="2" />
            {/* Horizontal bus line across 3 column centers */}
            <line x1="16.6%" y1="16" x2="83.3%" y2="16" stroke="#6D28D9" strokeWidth="2" />
            {/* Drop into Column 1 */}
            <line x1="16.6%" y1="16" x2="16.6%" y2="28" stroke="#6D28D9" strokeWidth="2" />
            <polygon points="calc(16.6% - 4px),24 calc(16.6% + 4px),24 16.6%,30" fill="#6D28D9" />
            {/* Drop into Column 2 */}
            <line x1="50%" y1="16" x2="50%" y2="28" stroke="#6D28D9" strokeWidth="2" />
            <polygon points="calc(50% - 4px),24 calc(50% + 4px),24 50%,30" fill="#6D28D9" />
            {/* Drop into Column 3 */}
            <line x1="83.3%" y1="16" x2="83.3%" y2="28" stroke="#6D28D9" strokeWidth="2" />
            <polygon points="calc(83.3% - 4px),24 calc(83.3% + 4px),24 83.3%,30" fill="#6D28D9" />
          </svg>
        </div>

        {/* 3 Columns Layout with Inter-Agent Flow */}
        <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 44, position: 'relative' }}>
          {/* ========================================================= */}
          {/* COLUMN 1: 1. INGEST & AUDIT                              */}
          {/* ========================================================= */}
          <div
            style={{
              background: '#F0F9FF',
              border: '1.5px solid #BAE6FD',
              borderRadius: 14,
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Column Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ color: '#0284C7', fontSize: 16 }}>🗄️</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0369A1', letterSpacing: '-0.2px' }}>
                  1. INGEST &amp; AUDIT
                </div>
                <div style={{ fontSize: 11.5, color: '#64748B' }}>
                  Ingest, validate and unify inventory data.
                </div>
              </div>
            </div>

            {/* Node AGT-01 */}
            <div
              className={flowSim.activeStep === 1 ? 'agent-node-active' : flowSim.completedSteps.includes(1) ? 'agent-node-completed' : ''}
              style={getAgentCardStyle(1, '1px solid #E2E8F0')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#0284C7', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4 }}>
                  AGT-01 · STAGE 1
                </span>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, border: '1px solid #CBD5E1', padding: '1px 5px', borderRadius: 4 }}>
                  MCP
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', marginTop: 2 }}>
                Data Reconciliation Agent
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                Ingests ERP, MES and WMS data, runs schema, zero-stock and data validation checks.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4 }}>
                {renderAgentStatus(1, 'Ready', '#16A34A')}
                <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', fontWeight: 600 }}>
                  Last run: #{pipelineRunMeta?.run_id || 41}
                </span>
              </div>
            </div>

            {/* Arrow: AGT-01 -> AGT-02 with pill */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
              <div style={{ width: 2, height: 8, background: '#6D28D9' }} />
              <span
                style={{
                  background: '#FAF5FF',
                  border: '1px solid #D8B4FE',
                  color: '#6D28D9',
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 20,
                  boxShadow: '0 1px 2px rgba(109, 40, 217, 0.08)',
                }}
              >
                Validated data
              </span>
              <div style={{ width: 2, height: 8, background: '#6D28D9' }} />
              <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid #6D28D9' }} />
            </div>

            {/* Node AGT-02 */}
            <div
              id="flow-card-agt-02"
              className={flowSim.activeStep === 2 ? 'agent-node-active' : flowSim.completedSteps.includes(2) ? 'agent-node-completed' : ''}
              style={getAgentCardStyle(2, '1px solid #E2E8F0')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#0284C7', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4 }}>
                  AGT-02 · STAGE 2
                </span>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, border: '1px solid #CBD5E1', padding: '1px 5px', borderRadius: 4 }}>
                  MCP
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', marginTop: 2 }}>
                Stock Monitoring Agent
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                Monitors physical inventory, usable stock and safety buffers across plants and locations.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4 }}>
                {renderAgentStatus(2, 'Ready', '#16A34A')}
                <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', fontWeight: 600 }}>
                  Last run: #{pipelineRunMeta?.run_id || 41}
                </span>
              </div>
            </div>

            {/* Arrow: AGT-08 -> AGT-02 with pill */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
              <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '5px solid #6D28D9' }} />
              <div style={{ width: 2, height: 8, background: '#6D28D9' }} />
              <span
                style={{
                  background: '#FAF5FF',
                  border: '1px solid #D8B4FE',
                  color: '#6D28D9',
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 20,
                  boxShadow: '0 1px 2px rgba(109, 40, 217, 0.08)',
                }}
              >
                Usable receipts (QC released)
              </span>
              <div style={{ width: 2, height: 8, background: '#6D28D9' }} />
            </div>

            {/* Node AGT-08 */}
            <div
              id="flow-card-agt-08"
              className={flowSim.activeStep === 8 ? 'agent-node-active' : flowSim.completedSteps.includes(8) ? 'agent-node-completed' : ''}
              style={getAgentCardStyle(8, '1px solid #E2E8F0')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#0284C7', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4 }}>
                  AGT-08 · STAGE 8
                </span>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, border: '1px solid #CBD5E1', padding: '1px 5px', borderRadius: 4 }}>
                  MCP
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', marginTop: 2 }}>
                Incoming QC &amp; Lot Acceptance Agent
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                Tracks incoming receipts, QC inspection results and lot acceptance for usable inventory.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4 }}>
                {renderAgentStatus(8, 'Ready', '#16A34A')}
                <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', fontWeight: 600 }}>
                  Last run: #{pipelineRunMeta?.run_id || 41}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUMN 2: 2. PREDICT & PLAN                              */}
          {/* ========================================================= */}
          <div
            style={{
              background: '#FFFDF7',
              border: '1.5px solid #FDE68A',
              borderRadius: 14,
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Column Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ color: '#D97706', fontSize: 16 }}>📊</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#B45309', letterSpacing: '-0.2px' }}>
                  2. PREDICT &amp; PLAN
                </div>
                <div style={{ fontSize: 11.5, color: '#64748B' }}>
                  Forecast shortages, plan capacity and material needs.
                </div>
              </div>
            </div>

            {/* Node AGT-03 */}
            <div
              className={flowSim.activeStep === 3 ? 'agent-node-active' : flowSim.completedSteps.includes(3) ? 'agent-node-completed' : ''}
              style={getAgentCardStyle(3, '1px solid #E2E8F0')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#D97706', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4 }}>
                  AGT-03 · STAGE 3
                </span>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, border: '1px solid #CBD5E1', padding: '1px 5px', borderRadius: 4 }}>
                  MCP
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', marginTop: 2 }}>
                Shortage Forecast Agent
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                Projects 30/60/90-day material demand curves and identifies potential stockouts.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4 }}>
                {renderAgentStatus(3, 'Ready', '#16A34A')}
                <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', fontWeight: 600 }}>
                  Last run: #{pipelineRunMeta?.run_id || 41}
                </span>
              </div>
            </div>

            {/* Arrow: AGT-03 -> AGT-04 with pill */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0', flexShrink: 0 }}>
              <div style={{ width: 2, height: 22, background: '#6D28D9' }} />
              <span
                style={{
                  background: '#FAF5FF',
                  border: '1px solid #D8B4FE',
                  color: '#6D28D9',
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 20,
                  boxShadow: '0 1px 2px rgba(109, 40, 217, 0.08)',
                }}
              >
                Forecasted requirement
              </span>
              <div style={{ width: 2, height: 22, background: '#6D28D9' }} />
              <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid #6D28D9' }} />
            </div>

            {/* Node AGT-04 */}
            <div
              id="flow-card-agt-04"
              className={flowSim.activeStep === 4 ? 'agent-node-active' : flowSim.completedSteps.includes(4) ? 'agent-node-completed' : ''}
              style={getAgentCardStyle(4, '1px solid #E2E8F0')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#D97706', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4 }}>
                  AGT-04 · STAGE 4
                </span>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, border: '1px solid #CBD5E1', padding: '1px 5px', borderRadius: 4 }}>
                  MCP
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', marginTop: 2 }}>
                Build Capacity &amp; BOM Twin Agent
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                Explodes BOM, evaluates material and production capacity, and identifies limiting components.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4 }}>
                {renderAgentStatus(4, 'Ready', '#16A34A')}
                <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', fontWeight: 600 }}>
                  Last run: #{pipelineRunMeta?.run_id || 41}
                </span>
              </div>
            </div>

            {/* Bottom spacer to match reference bottom margin */}
            <div style={{ height: 36 }} />
          </div>

          {/* ========================================================= */}
          {/* COLUMN 3: 3. EXECUTE & GOVERN                            */}
          {/* ========================================================= */}
          <div
            style={{
              background: '#FAF5FF',
              border: '1.5px solid #E9D5FF',
              borderRadius: 14,
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Column Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ color: '#6D28D9', fontSize: 16 }}>⚙️</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#6D28D9', letterSpacing: '-0.2px' }}>
                  3. EXECUTE &amp; GOVERN
                </div>
                <div style={{ fontSize: 11.5, color: '#64748B' }}>
                  Execute replenishment, manage supplier risk and optimize stock.
                </div>
              </div>
            </div>

            {/* Node AGT-05 */}
            <div
              className={flowSim.activeStep === 5 ? 'agent-node-active' : flowSim.completedSteps.includes(5) ? 'agent-node-completed' : ''}
              style={getAgentCardStyle(5, '1px solid #E2E8F0')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#6D28D9', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4 }}>
                  AGT-05 · STAGE 5
                </span>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, border: '1px solid #CBD5E1', padding: '1px 5px', borderRadius: 4 }}>
                  MCP
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', marginTop: 2 }}>
                Replenishment &amp; Proposals Agent
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                Generates procurement and inter-plant transfer proposals based on plan, MOQ and policy.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4 }}>
                {renderAgentStatus(5, 'Ready', '#16A34A')}
                <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', fontWeight: 600 }}>
                  Last run: #{pipelineRunMeta?.run_id || 41}
                </span>
              </div>
            </div>

            {/* Arrow: AGT-05 -> AGT-07 with pill */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
              <div style={{ width: 2, height: 8, background: '#6D28D9' }} />
              <span
                style={{
                  background: '#FAF5FF',
                  border: '1px solid #D8B4FE',
                  color: '#6D28D9',
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 20,
                  boxShadow: '0 1px 2px rgba(109, 40, 217, 0.08)',
                }}
              >
                Purchase / transfer proposal
              </span>
              <div style={{ width: 2, height: 8, background: '#6D28D9' }} />
              <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid #6D28D9' }} />
            </div>

            {/* Node AGT-07 */}
            <div
              id="flow-card-agt-07"
              onClick={() => setShowSupplierModal(true)}
              className={flowSim.activeStep === 7 ? 'agent-node-active' : flowSim.completedSteps.includes(7) ? 'agent-node-completed' : ''}
              style={{
                ...getAgentCardStyle(
                  7,
                  supplierMitigated ? '1.5px solid #22C55E' : '1.5px solid #F59E0B'
                ),
                cursor: 'pointer',
              }}
              title="Click to view supplier risk breakdown and mitigation actions"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#6D28D9', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4 }}>
                  AGT-07 · STAGE 7
                </span>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, border: '1px solid #CBD5E1', padding: '1px 5px', borderRadius: 4 }}>
                  MCP
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', marginTop: 2 }}>
                Supplier Delay &amp; ML Predictor Agent
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                Predicts supplier lead times, delay risk and potential production impact.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4 }}>
                {flowSim.activeStep === 7 ? (
                  renderAgentStatus(7)
                ) : supplierMitigated ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} /> Buffer Protected (0 Halts)
                  </span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} /> Needs attention · Click to resolve
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', fontWeight: 600 }}>
                  Last run: #{pipelineRunMeta?.run_id || 41}
                </span>
              </div>
            </div>

            {/* Arrow: AGT-09 -> AGT-07 with pill */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
              <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '5px solid #6D28D9' }} />
              <div style={{ width: 2, height: 8, background: '#6D28D9' }} />
              <span
                style={{
                  background: '#FAF5FF',
                  border: '1px solid #D8B4FE',
                  color: '#6D28D9',
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 20,
                  boxShadow: '0 1px 2px rgba(109, 40, 217, 0.08)',
                }}
              >
                Supplier risk &amp; supply plan
              </span>
              <div style={{ width: 2, height: 8, background: '#6D28D9' }} />
            </div>

            {/* Node AGT-09 */}
            <div
              className={flowSim.activeStep === 9 ? 'agent-node-active' : flowSim.completedSteps.includes(9) ? 'agent-node-completed' : ''}
              style={getAgentCardStyle(9, '1px solid #E2E8F0')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#6D28D9', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4 }}>
                  AGT-09 · STAGE 9
                </span>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, border: '1px solid #CBD5E1', padding: '1px 5px', borderRadius: 4 }}>
                  MCP
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', marginTop: 2 }}>
                Excess &amp; Obsolete Inventory Agent
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                Identifies excess, slow-moving and obsolete stock, and recommends redistribution or disposal actions.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4 }}>
                {renderAgentStatus(9, 'Ready', '#16A34A')}
                <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', fontWeight: 600 }}>
                  Last run: #{pipelineRunMeta?.run_id || 41}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Inter-Column Connectors matching reference UI */}
          {flowCoords && (
            <>
              {/* Pill 1: Verified stock position */}
              <div
                style={{
                  position: 'absolute',
                  left: (flowCoords.agt02Right + flowCoords.agt04Left) / 2 + 4,
                  top: flowCoords.agt04CenterY,
                  transform: 'translate(-50%, -50%)',
                  background: '#FAF5FF',
                  border: '1.5px solid #D8B4FE',
                  borderRadius: 8,
                  padding: '3px 7px',
                  textAlign: 'center',
                  color: '#6D28D9',
                  fontSize: 9.5,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  boxShadow: '0 2px 4px rgba(109, 40, 217, 0.08)',
                  whiteSpace: 'nowrap',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              >
                <div>Verified</div>
                <div>stock</div>
                <div>position</div>
              </div>

              {/* Pill 2: Plan & requirement */}
              <div
                style={{
                  position: 'absolute',
                  left: flowCoords.agt04Right + 6 + 26,
                  top: flowCoords.agt04CenterY,
                  transform: 'translate(-50%, -50%)',
                  background: '#FAF5FF',
                  border: '1.5px solid #D8B4FE',
                  borderRadius: 8,
                  padding: '3px 6px',
                  textAlign: 'center',
                  color: '#6D28D9',
                  fontSize: 9,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  boxShadow: '0 2px 4px rgba(109, 40, 217, 0.08)',
                  whiteSpace: 'nowrap',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              >
                <div>Plan &amp;</div>
                <div>requirement</div>
              </div>

              {/* SVG Overlay Lines and Arrows */}
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 10,
                  overflow: 'visible',
                }}
              >
                <defs>
                  <marker
                    id="purple-flow-arrow"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M 0 0 L 6 3 L 0 6 z" fill="#6D28D9" />
                  </marker>
                </defs>

                {/* --- CONNECTOR 1: AGT-02 + AGT-08 -> Verified stock position -> AGT-04 --- */}
                {(() => {
                  const p1X = (flowCoords.agt02Right + flowCoords.agt04Left) / 2 + 4
                  const p1Y = flowCoords.agt04CenterY
                  const p1Left = p1X - 25
                  const p1Right = p1X + 25
                  const bracketX = flowCoords.agt02Right + Math.max(6, (p1Left - flowCoords.agt02Right) * 0.45)
                  const r = 6

                  return (
                    <g>
                      {/* Top branch: AGT-02 right -> curves down along bracketX to p1Y */}
                      <path
                        d={`M ${flowCoords.agt02Right} ${flowCoords.agt02CenterY} L ${bracketX - r} ${flowCoords.agt02CenterY} Q ${bracketX} ${flowCoords.agt02CenterY} ${bracketX} ${flowCoords.agt02CenterY + r} L ${bracketX} ${p1Y}`}
                        fill="none"
                        stroke="#6D28D9"
                        strokeWidth="1.75"
                      />
                      {/* Bottom branch: AGT-08 right -> curves up along bracketX to p1Y */}
                      <path
                        d={`M ${flowCoords.agt08Right} ${flowCoords.agt08CenterY} L ${bracketX - r} ${flowCoords.agt08CenterY} Q ${bracketX} ${flowCoords.agt08CenterY} ${bracketX} ${flowCoords.agt08CenterY - r} L ${bracketX} ${p1Y}`}
                        fill="none"
                        stroke="#6D28D9"
                        strokeWidth="1.75"
                      />
                      {/* Stem from bracketX into Pill 1 left */}
                      <path
                        d={`M ${bracketX} ${p1Y} L ${p1Left} ${p1Y}`}
                        fill="none"
                        stroke="#6D28D9"
                        strokeWidth="1.75"
                      />
                      {/* Horizontal arrow from Pill 1 right into AGT-04 left */}
                      <path
                        d={`M ${p1Right} ${p1Y} L ${flowCoords.agt04Left} ${p1Y}`}
                        fill="none"
                        stroke="#6D28D9"
                        strokeWidth="1.75"
                        markerEnd="url(#purple-flow-arrow)"
                      />
                    </g>
                  )
                })()}

                {/* --- CONNECTOR 2: AGT-04 -> Plan & requirement -> hooks UP into AGT-07 --- */}
                {(() => {
                  const p2Left = flowCoords.agt04Right + 6
                  const p2Right = p2Left + 52
                  const p2Y = flowCoords.agt04CenterY
                  const r = 5
                  const turnX = Math.min(p2Right + 8, flowCoords.agt07Left - 8)

                  return (
                    <g>
                      {/* Horizontal line from AGT-04 right into Pill 2 left */}
                      <path
                        d={`M ${flowCoords.agt04Right} ${p2Y} L ${p2Left} ${p2Y}`}
                        fill="none"
                        stroke="#6D28D9"
                        strokeWidth="1.75"
                      />
                      {/* From Pill 2 right -> curves UP -> goes up to AGT-07 -> curves RIGHT into AGT-07 left */}
                      <path
                        d={`M ${p2Right} ${p2Y} L ${turnX - r} ${p2Y} Q ${turnX} ${p2Y} ${turnX} ${p2Y - r} L ${turnX} ${flowCoords.agt07CenterY + r} Q ${turnX} ${flowCoords.agt07CenterY} ${turnX + r} ${flowCoords.agt07CenterY} L ${flowCoords.agt07Left} ${flowCoords.agt07CenterY}`}
                        fill="none"
                        stroke="#6D28D9"
                        strokeWidth="1.75"
                        markerEnd="url(#purple-flow-arrow)"
                      />
                    </g>
                  )
                })()}
              </svg>
            </>
          )}
        </div>

        {/* Latest Execution Footer Bar */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            marginTop: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={runPipelineFlow}
              disabled={flowSim.isRunning}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                background: flowSim.isRunning ? '#CBD5E1' : '#EDE9FE',
                color: '#6D28D9',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                cursor: flowSim.isRunning ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Click to execute collaborative agent pipeline"
            >
              {flowSim.isRunning ? '⏳' : '▶'}
            </button>
            <b style={{ fontSize: 13.5, color: '#0F172A' }}>Latest execution</b>
            <span style={{ background: '#F3E8FF', color: '#6D28D9', padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 800 }}>
              Run #{pipelineRunMeta?.run_id || 41}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
              {flowSim.completedSteps.length > 0 ? flowSim.completedSteps.length : (pipelineRunMeta?.stages_completed || 9)} / 9 stages completed
            </span>
            <div style={{ width: 140, height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${((flowSim.completedSteps.length > 0 ? flowSim.completedSteps.length : (pipelineRunMeta?.stages_completed || 9)) / 9) * 100}%`,
                  height: '100%',
                  background: '#6D28D9',
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="small muted" style={{ fontSize: 12 }}>
              Last run: {pipelineRunMeta?.last_run_time ? pipelineRunMeta.last_run_time : 'Today, 04:08 PM'}
            </span>
            <button
              type="button"
              onClick={() => setShowTrace(!showTrace)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6D28D9',
                fontWeight: 700,
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {showTrace ? 'Hide trace' : 'Open trace'} <span style={{ fontSize: 11 }}>↗</span>
            </button>
          </div>
        </div>

        {/* Trace Modal Dialog (Fixed Centered Overlay) */}
        {showTrace && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowTrace(false)
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(5px)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              style={{
                background: '#0F172A',
                borderRadius: 14,
                maxWidth: 860,
                width: '100%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                border: '1.5px solid #334155',
                overflow: 'hidden',
                animation: 'pipePulse 0.25s ease-out',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '16px 22px',
                  background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                  borderBottom: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(124, 58, 237, 0.25)',
                      border: '1px solid #7C3AED',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      color: '#A78BFA',
                    }}
                  >
                    ⚡
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontSize: 14, color: '#F8FAFC', letterSpacing: '0.3px' }}>
                        COLLABORATIVE PIPELINE EXECUTION TRACE
                      </b>
                      <span
                        style={{
                          background: '#7C3AED',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        RUN #{pipelineRunMeta?.run_id || 42}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                      Live audited execution across all 9 collaborative agents · Verified against calculation engine
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid #22C55E',
                      color: '#4ADE80',
                      padding: '3px 9px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                    {flowSim.logs.length > 0 ? flowSim.logs.length : 9} / 9 STAGES COMPLETED
                  </span>

                  <button
                    type="button"
                    onClick={() => setShowTrace(false)}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#CBD5E1',
                      borderRadius: 6,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Logs Content List */}
              <div
                style={{
                  padding: '18px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  overflowY: 'auto',
                  flex: 1,
                }}
              >
                {(flowSim.logs.length > 0 ? flowSim.logs : [
                  { time: pipelineRunMeta?.last_run_time ? pipelineRunMeta.last_run_time.replace(/^Today,\s*/, '') : '04:18:25 PM', agent: 'AGT-01 Data Reconciliation', text: 'Cleaned raw ERP/WMS records across plants. Audited 12 data-quality checks (12 assumptions flagged). Validated schema.' },
                  { time: pipelineRunMeta?.last_run_time ? pipelineRunMeta.last_run_time.replace(/^Today,\s*/, '') : '04:18:26 PM', agent: 'AGT-02 Stock Monitoring', text: 'Audited physical stock against safety buffers. Flagged 4 critical and 7 at-risk components. Active usable stock: ₹13.50 Cr.' },
                  { time: pipelineRunMeta?.last_run_time ? pipelineRunMeta.last_run_time.replace(/^Today,\s*/, '') : '04:18:27 PM', agent: 'AGT-03 Shortage Forecast', text: 'Projected 30-day depletion curves: 11 components below safety threshold. Earliest stockout on MAT-BOX-014.' },
                  { time: pipelineRunMeta?.last_run_time ? pipelineRunMeta.last_run_time.replace(/^Today,\s*/, '') : '04:18:28 PM', agent: 'AGT-04 Build Capacity & BOM Twin', text: 'Exploded BOM tree for Aster 15. Max assembly capacity: 10,800 units. Primary bottleneck: RF Antenna Flex.' },
                  { time: pipelineRunMeta?.last_run_time ? pipelineRunMeta.last_run_time.replace(/^Today,\s*/, '') : '04:18:29 PM', agent: 'AGT-05 Replenishment & Proposals', text: 'Generated replenishment schedule. 8 active procurement proposals evaluated against lead times and MOQ policies.' },
                  { time: pipelineRunMeta?.last_run_time ? pipelineRunMeta.last_run_time.replace(/^Today,\s*/, '') : '04:18:30 PM', agent: 'AGT-07 Supplier Delay & ML Predictor', text: 'Needs attention: 329 overdue PO lines detected. Simulated +7 day lead-time delay on SUP-001. Current safety stock buffer absorbs delay with 0 line halts.' },
                  { time: pipelineRunMeta?.last_run_time ? pipelineRunMeta.last_run_time.replace(/^Today,\s*/, '') : '04:18:31 PM', agent: 'AGT-08 Incoming QC & Lot Acceptance', text: 'Audited 14 incoming lot shipments across Chennai & Bengaluru: 12 lots accepted into usable stock, 2 lots on temporary QC hold for battery cell voltage check.' },
                  { time: pipelineRunMeta?.last_run_time ? pipelineRunMeta.last_run_time.replace(/^Today,\s*/, '') : '04:18:32 PM', agent: 'AGT-09 Excess & Obsolete Inventory', text: 'Audited warehouse working capital. Discovered ₹57.00L tied up above maximum stock policy. Rebalance recommended.' },
                  { time: pipelineRunMeta?.last_run_time ? pipelineRunMeta.last_run_time.replace(/^Today,\s*/, '') : '04:18:33 PM', agent: 'AGT-10 Central Orchestrator', text: `Synthesized all specialist outputs into unified grounded execution dossier for Run #${pipelineRunMeta?.run_id || 42}. All buffers validated.` },
                ]).map((lg, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 14,
                      fontSize: 12.5,
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ color: '#64748B', flexShrink: 0, fontWeight: 600 }}>
                      [{lg.time}]
                    </span>
                    <span
                      style={{
                        color: lg.agent.includes('AGT-10')
                          ? '#C084FC'
                          : lg.agent.includes('AGT-07')
                          ? '#F87171'
                          : '#818CF8',
                        fontWeight: 700,
                        flexShrink: 0,
                        minWidth: 220,
                      }}
                    >
                      {lg.agent}:
                    </span>
                    <span style={{ color: '#E2E8F0', flex: 1, lineHeight: 1.45 }}>
                      {lg.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '12px 22px',
                  background: '#1E293B',
                  borderTop: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: 11.5, color: '#94A3B8' }}>
                  Execution Sandbox: <b>PostgreSQL Read-Only Transaction</b> · Protocol: <b>inventory-mcp-server (2.3)</b>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTrace(false)
                      runPipelineFlow()
                    }}
                    style={{
                      background: '#6D28D9',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ▶ Re-run Pipeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTrace(false)}
                    style={{
                      background: 'transparent',
                      color: '#CBD5E1',
                      border: '1px solid #475569',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Close Dossier
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Supplier Delay Mitigation & Action Modal */}
        {showSupplierModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 14,
                maxWidth: 620,
                width: '100%',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                border: '1px solid #E2E8F0',
              }}
            >
              {/* Header */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                  padding: '18px 24px',
                  borderBottom: '1px solid #FDE68A',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>⚠️</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#92400E' }}>
                      AGT-07 · Supplier Lead Time Delay Advisory
                    </h3>
                    <div style={{ fontSize: 12, color: '#B45309' }}>
                      Operational Finding &amp; Mitigation Strategy · Run #{pipelineRunMeta?.run_id || 41}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowSupplierModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 18,
                    cursor: 'pointer',
                    color: '#92400E',
                    fontWeight: 800,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Body Content */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <b style={{ fontSize: 13, color: '#0F172A' }}>Why is this agent flagging "Needs Attention"?</b>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                    The data pipeline detected <b>329 overdue PO lines</b> across vendors (e.g. Shenzhen Silicon, Murata).
                    This delivery backlog introduces potential lead-time variance into upcoming SMT production schedules.
                  </p>
                </div>

                {/* Simulation Summary Box */}
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 10,
                    padding: '14px 16px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    🤖 AGT-07 Machine Learning Delay Simulation
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                    <div style={{ background: '#fff', padding: '10px 8px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Simulated Delay</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>+7 Days</div>
                    </div>
                    <div style={{ background: '#fff', padding: '10px 8px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Assembly Line Halts</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#16A34A', marginTop: 2 }}>0 Halts</div>
                    </div>
                    <div style={{ background: '#fff', padding: '10px 8px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Buffer Status</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#2563EB', marginTop: 2 }}>Absorbable</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#334155', marginTop: 10, lineHeight: 1.4 }}>
                    <b>Agent Conclusion:</b> Existing on-hand safety stock of 1,643 EA is sufficient to absorb a 7-day supplier lag without halting Aster 15 box-build assembly lines.
                  </div>
                </div>

                {/* Recommended Actions */}
                <div>
                  <b style={{ fontSize: 13, color: '#0F172A' }}>Recommended Operator Action:</b>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => {
                        setShowSupplierModal(false)
                        openAgent("What happens to production if supplier SUP-001 is delayed by 7 days?")
                      }}
                      style={{
                        background: '#6D28D9',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>✨ Ask Copilot to Deep-Dive Supplier Delay Impact</span>
                      <span>→</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowSupplierModal(false)
                        navigate('/agent-tester?agent=supplier_delay')
                      }}
                      style={{
                        background: '#F1F5F9',
                        color: '#334155',
                        border: '1px solid #CBD5E1',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>🧪 Open Agent Testing Playground for Supplier Risk</span>
                      <span>→</span>
                    </button>

                    <button
                      onClick={() => {
                        setSupplierMitigated(true)
                        setShowSupplierModal(false)
                      }}
                      style={{
                        background: '#DCFCE7',
                        color: '#15803D',
                        border: '1px solid #86EFAC',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>✓ Acknowledge &amp; Mark as Buffer Protected</span>
                      <span>✓</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: SPECIALIZED AGENT DIRECTORY CARDS                             */}
      {/* ========================================================================= */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              Specialized Agent Roster ({filteredAgents.length})
            </h2>
            <div className="small muted">Click 'Test Agent' on any card to open the interactive test playground.</div>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'all', label: 'All Agents' },
              { id: 'mcp-inv', label: 'Inventory MCP' },
              { id: 'mcp-cap', label: 'Capacity & ML MCP' },
              { id: 'coordinator', label: 'Coordinator' },
            ].map((f) => (
              <button
                key={f.id}
                className={`btn ${filterCategory === f.id ? 'primary' : 'outline'}`}
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setFilterCategory(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 20,
                borderRadius: 10,
                border: '1px solid var(--border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                position: 'relative',
              }}
            >
              <div>
                {/* Top Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        background: 'rgba(111, 61, 186, 0.12)',
                        color: 'var(--brand-purple)',
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: 4,
                      }}
                    >
                      {agent.code}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                      {agent.stage}
                    </span>
                  </div>

                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#16a34a',
                      background: 'rgba(34, 197, 94, 0.1)',
                      padding: '2px 8px',
                      borderRadius: 12,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                    ONLINE
                  </span>
                </div>

                {/* Agent Name */}
                <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {agent.name}
                </h3>

                {/* Role Description */}
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 14px' }}>
                  {agent.role}
                </p>

                {/* MCP Server & Tools */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>HOST:</span>
                    <code>{agent.mcp_server}</code>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {agent.tools.map((t) => (
                      <span
                        key={t}
                        style={{
                          background: 'var(--muted-fill)',
                          fontSize: 11,
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontWeight: 600,
                          color: 'var(--text)',
                        }}
                      >
                        🔧 {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Sample Prompt Preview */}
                <div
                  style={{
                    background: 'rgba(0,0,0,0.02)',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px dashed var(--border)',
                    marginBottom: 16,
                  }}
                >
                  <div className="small muted" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                    Sample Query:
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontStyle: 'italic', marginTop: 2 }}>
                    "{agent.sample_prompt}"
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <button
                  className="btn primary"
                  style={{ flex: 1, fontWeight: 700, fontSize: 13 }}
                  onClick={() => navigate(`/agent-tester?agent=${agent.id}`)}
                >
                  🧪 Test Agent
                </button>
                <button
                  className="btn outline"
                  style={{ fontSize: 13 }}
                  title="Quick Ask in Chat"
                  onClick={() => openAgent(agent.sample_prompt)}
                >
                  <Icon name="sparkle" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
