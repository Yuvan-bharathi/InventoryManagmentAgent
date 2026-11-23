import { useQuery, useMutation } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, qs } from '../api'
import { inr, pct } from '../format'
import { PageState } from '../kit'
import { useShell } from '../shell-context'
import { App as RetailTwinApp } from '../retail-twin/ui/App'
import '../retail-twin/index.css'

export function DigitalTwin() {
  const { plant, setAgentCtx, openAgent } = useShell()
  const [tab, setTab] = useState<'layout' | 'capacity' | 'forecast' | 'packaging' | 'simulation'>('layout')
  const [selectedZone, setSelectedZone] = useState<string>('final_assembly')
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [horizon, setHorizon] = useState<number>(30)
  const [twinExpanded, setTwinExpanded] = useState<boolean>(false)

  // Packaging converter state
  const [pkgMat, setPkgMat] = useState('RM-SOLDER')
  const [pkgUom, setPkgUom] = useState('BOX')
  const [pkgQty, setPkgQty] = useState(20)
  const [pkgQcLoss, setPkgQcLoss] = useState(5.0)
  const [pkgUnitCost, setPkgUnitCost] = useState(250)

  // What-if simulation state
  const [simVolumeDelta, setSimVolumeDelta] = useState(20)
  const [simScrapDelta, setSimScrapDelta] = useState(5)
  const [simDelayDays, setSimDelayDays] = useState(5)
  const [simReceiptRate, setSimReceiptRate] = useState(100)
  const [simMode, setSimMode] = useState<'volume' | 'delay'>('volume')

  useEffect(() => {
    setAgentCtx({ page: 'Digital Twin' })
  }, []) // eslint-disable-line

  // 1. Digital Twin Overview & Zones
  const overviewQ = useQuery({
    queryKey: ['digital-twin-overview', plant],
    queryFn: () => api.get<any>('/api/digital-twin/overview' + qs({ plant_id: plant })),
  })

  // 2. Production Capacity & BOM
  const capacityQ = useQuery({
    queryKey: ['production-capacity', plant, selectedProduct],
    queryFn: () => api.get<any>('/api/forecast/production-capacity' + qs({ plant_id: plant, product_id: selectedProduct })),
    enabled: tab === 'capacity',
  })

  // 3. Demand Forecast (30, 60, 90 days)
  const forecastQ = useQuery({
    queryKey: ['demand-forecast', plant, horizon],
    queryFn: () => api.get<any>('/api/forecast/material-demand' + qs({ plant_id: plant, horizon })),
    enabled: tab === 'forecast',
  })

  // 4. Packaging Conversion Mutation
  const convertMut = useMutation({
    mutationFn: (body: any) => api.post<any>('/api/materials/convert', body),
  })

  // 5. Simulation Mutations
  const simProdMut = useMutation({
    mutationFn: (body: any) => api.post<any>('/api/simulations/production', body),
  })
  const simDelayMut = useMutation({
    mutationFn: (body: any) => api.post<any>('/api/simulations/supplier-delay', body),
  })

  // Initial trigger for converter
  useEffect(() => {
    if (tab === 'packaging') {
      convertMut.mutate({
        material_code: pkgMat,
        package_uom: pkgUom,
        package_qty: pkgQty,
        qc_loss_pct: pkgQcLoss,
        unit_cost_inr: pkgUnitCost,
      })
    }
  }, [tab, pkgMat, pkgUom, pkgQty, pkgQcLoss, pkgUnitCost])

  // Trigger simulation
  useEffect(() => {
    if (tab === 'simulation') {
      if (simMode === 'volume') {
        simProdMut.mutate({
          plant_id: plant,
          volume_change_pct: simVolumeDelta,
          scrap_change_pct: simScrapDelta,
        })
      } else {
        simDelayMut.mutate({
          plant_id: plant,
          delay_days: simDelayDays,
          receipt_rate_pct: simReceiptRate,
        })
      }
    }
  }, [tab, simMode, simVolumeDelta, simScrapDelta, simDelayDays, simReceiptRate, plant])

  const rawTwin: any = overviewQ.data
  const twin = rawTwin?.data?.plant_id ? rawTwin.data : (rawTwin?.plant_id ? rawTwin : rawTwin?.data)

  const rawCap: any = capacityQ.data
  const cap = rawCap?.data?.products ? rawCap.data : (rawCap?.products ? rawCap : rawCap?.data)

  const rawForecast: any = forecastQ.data
  const forecast: any[] = Array.isArray(rawForecast?.data)
    ? rawForecast.data
    : Array.isArray(rawForecast)
    ? rawForecast
    : []

  const rawConv: any = convertMut.data
  const convResult = rawConv?.data?.usable_base_qty !== undefined ? rawConv.data : (rawConv?.usable_base_qty !== undefined ? rawConv : rawConv?.data)

  const rawSim: any = simMode === 'volume' ? simProdMut.data : simDelayMut.data
  const simResult = rawSim?.data?.scenario_type ? rawSim.data : (rawSim?.scenario_type ? rawSim : rawSim?.data)

  return (
    <div>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <div className="crumb">Planning › Manufacturing Intelligence</div>
          <div className="row" style={{ gap: 8 }}>
            <h1>Digital Twin & Intelligence Engine</h1>
            <span className="pill" style={{ background: '#FFF2E8', color: '#D66A36', fontWeight: 700 }}>LIVE ENGINE</span>
          </div>
          <div className="muted">
            Multi-product, multi-plant manufacturing simulation, BOM capacity modeling, and 30/60/90-day material forecasting.
          </div>
        </div>
        <span className="spacer" />
        <div className="row" style={{ gap: 8 }}>
          <Link
            to="/warehouse-3d"
            className="btn sm"
            style={{
              background: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            🏢 Full 3D Plant & Warehouse Flow ↗
          </Link>
          <button className="btn sm" onClick={() => openAgent("How many finished products can we manufacture with the materials currently available?")}>
            Ask: Buildable Products?
          </button>
          <button className="btn sm" onClick={() => openAgent("Which material will become the production bottleneck?")}>
            Ask: Bottlenecks?
          </button>
          <button className="btn sm primary" onClick={() => openAgent("What happens if production demand increases by 20% or supplier is delayed by 5 days?")}>
            Ask: What-If Simulation?
          </button>
        </div>
      </div>

      {/* KPI Tiles Strip */}
      {twin && (
        <div className="grid g4" style={{ marginBottom: 18 }}>
          <div className="card kpi">
            <div className="label">Total Buildable Finished Units</div>
            <div className="value" style={{ color: 'var(--orange)' }}>
              {twin.production_capacity?.summary?.total_buildable_units?.toLocaleString('en-IN') ?? '0'}
            </div>
            <div className="kpi-foot">Across all active phone models</div>
          </div>
          <div className="card kpi">
            <div className="label">Primary Bottleneck Component</div>
            <div className="value" style={{ fontSize: 20, color: 'var(--red)' }}>
              {twin.bottlenecks?.[0]?.material_id ?? 'None'}
            </div>
            <div className="kpi-foot" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {twin.bottlenecks?.[0]?.material_name ?? 'All materials balanced'}
            </div>
          </div>
          <div className="card kpi">
            <div className="label">Critical Materials (30d Horizon)</div>
            <div className="value" style={{ color: twin.critical_materials?.length ? 'var(--red)' : '#2E7D32' }}>
              {twin.critical_materials?.length ?? 0}
            </div>
            <div className="kpi-foot">Materials with closing stock &lt; 0</div>
          </div>
          <div className="card kpi">
            <div className="label">Overdue Inbound Shipments</div>
            <div className="value" style={{ color: twin.supplier_alerts?.length ? 'var(--soft-orange)' : '#2E7D32' }}>
              {twin.supplier_alerts?.length ?? 0} POs
            </div>
            <div className="kpi-foot">Delayed supplier deliveries</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="tabs">
        <button className={tab === 'layout' ? 'on' : ''} onClick={() => setTab('layout')}>
          1. 3D Warehouse & Plant Twin
        </button>
        <button className={tab === 'capacity' ? 'on' : ''} onClick={() => setTab('capacity')}>
          2. BOM & Production Capacity
        </button>
        <button className={tab === 'forecast' ? 'on' : ''} onClick={() => setTab('forecast')}>
          3. 30 / 60 / 90d Demand Forecast
        </button>
        <button className={tab === 'packaging' ? 'on' : ''} onClick={() => setTab('packaging')}>
          4. Packaging & UOM Intelligence
        </button>
        <button className={tab === 'simulation' ? 'on' : ''} onClick={() => setTab('simulation')}>
          5. What-If Scenario Lab
        </button>
      </div>

      <PageState loading={overviewQ.isLoading || capacityQ.isLoading} error={overviewQ.error || capacityQ.error}>
        {/* ========================================================================= */}
        {/* TAB 1: Plant Layout & Visual Telemetry                                   */}
        {/* ========================================================================= */}
        {tab === 'layout' && twin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* 3D Warehouse Interior Twin Viewport */}
            <div className="card" style={{ padding: 16 }}>
              <div className="card-head" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <span>Interactive 3D Warehouse & Plant Interior Digital Twin</span>
                    <span className="pill" style={{ background: '#E8F5E9', color: '#2E7D32', fontSize: 11, fontWeight: 700 }}>
                      MULTI-FLOOR WAREHOUSE-3D
                    </span>
                    <span className="pill" style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: 10, fontWeight: 600 }}>
                      60 FPS ACCELERATED
                    </span>
                  </h2>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    Full multi-tier mezzanine pick module with 6 double-depth aisles, elevated storage stands, takeaway conveyors, active AGVs, and inbound/outbound simulation.
                  </div>
                </div>

                {/* Viewport Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setTwinExpanded(!twinExpanded)}
                    className="btn sm"
                    title={twinExpanded ? 'Collapse height to 720px' : 'Expand height to 920px'}
                  >
                    {twinExpanded ? '▲ Compact' : '▼ Expand View'}
                  </button>

                  <Link
                    to="/warehouse-3d"
                    className="btn sm"
                    style={{
                      background: '#1F2937',
                      color: '#FFFFFF',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 600,
                    }}
                    title="Launch dedicated full-window 3D view"
                  >
                    ⛶ Fullscreen Flow ↗
                  </Link>
                </div>
              </div>

              {/* Viewport Canvas Host */}
              <div
                style={{
                  width: '100%',
                  height: twinExpanded ? 920 : 720,
                  borderRadius: 10,
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  background: '#F8FAFC',
                  transition: 'height 0.25s ease',
                }}
              >
                <RetailTwinApp embedded />
              </div>
            </div>

            <div className="digital-twin-floor-layout">
            {/* Visual Plant Floor Schematic */}
            <div className="card" style={{ minWidth: 0, overflow: 'hidden', padding: 0 }}>
              <div className="card-head" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                      {twin.plant_name} ({twin.plant_id}) — Digital Twin Floor Plan
                    </h2>
                    <span className="pill" style={{ background: '#F3E8FF', color: '#6B21A8', fontWeight: 700, fontSize: 11 }}>
                      6 LIVE STAGES
                    </span>
                  </div>
                  <div className="small muted" style={{ marginTop: 2 }}>
                    Interactive manufacturing telemetry, throughput utilization & material flow routing
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {twin.zones.some((z: any) => z.status === 'BOTTLENECK_ALERT') ? (
                    <span className="pill" style={{ background: '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', display: 'inline-block', boxShadow: '0 0 6px rgba(220,38,38,0.6)' }} />
                      1 BOTTLENECK CONSTRAINT ACTIVE
                    </span>
                  ) : (
                    <span className="pill" style={{ background: '#ECFDF5', color: '#059669', fontWeight: 700, fontSize: 11 }}>
                      ✓ ALL STAGES BALANCED
                    </span>
                  )}
                  <span className="pill" style={{ background: '#F1F5F9', color: '#475569', fontSize: 10, fontWeight: 600 }}>
                    LIVE TELEMETRY
                  </span>
                </div>
              </div>

              {/* Schematic Map & Stage Flow */}
              <div style={{ padding: '12px 18px 18px 18px' }}>
                {/* Interactive Sequential Flow Bar */}
                <div style={{ marginBottom: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Manufacturing WIP Pipeline:
                      </span>
                      <span className="pill" style={{ background: '#DCFCE7', color: '#166534', fontWeight: 700, fontSize: 10, padding: '2px 8px' }}>
                        CONTINUOUS PULL
                      </span>
                    </div>
                    <span className="small muted" style={{ fontSize: 11 }}>
                      Click any pipeline stage below to focus telemetry
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                    {[
                      { id: 'inbound_dock', label: '1. Inbound Dock', icon: '🚚' },
                      { id: 'rm_storage', label: '2. RM Storage', icon: '🏬' },
                      { id: 'smt_lines', label: '3. SMT PCB', icon: '⚡' },
                      { id: 'final_assembly', label: '4. Box Assembly', icon: '🔧', isAlert: true },
                      { id: 'testing_qc', label: '5. Burn-In & QA', icon: '🔬' },
                      { id: 'fg_packaging', label: '6. FG Packaging', icon: '📦' },
                    ].map((step, idx) => {
                      const isSel = selectedZone === step.id
                      return (
                        <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => setSelectedZone(step.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: isSel ? 700 : 600,
                              background: isSel ? '#6F3DBA' : step.isAlert ? '#FEF2F2' : '#FFFFFF',
                              color: isSel ? '#FFFFFF' : step.isAlert ? '#B91C1C' : '#334155',
                              border: `1px solid ${isSel ? '#6F3DBA' : step.isAlert ? '#FCA5A5' : '#CBD5E1'}`,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              boxShadow: isSel ? '0 2px 8px rgba(111, 61, 186, 0.25)' : 'none',
                            }}
                          >
                            <span>{step.icon}</span>
                            <span>{step.label}</span>
                            {step.isAlert && (
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isSel ? '#FFD54F' : '#EF4444' }} />
                            )}
                          </button>
                          {idx < 5 && (
                            <span style={{ color: '#94A3B8', fontWeight: 700, fontSize: 13, userSelect: 'none' }}>→</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 6 Zone Telemetry Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  {twin.zones.map((zone: any) => {
                    const isSelected = selectedZone === zone.id
                    const isAlert = zone.status === 'BOTTLENECK_ALERT' || zone.overdue_pos > 0 || zone.critical_skus > 0
                    const zoneIcons: Record<string, { icon: string; stage: string; tag: string }> = {
                      inbound_dock: { icon: '🚚', stage: 'STAGE 01', tag: 'DOCKS 01-04' },
                      rm_storage: { icon: '🏬', stage: 'STAGE 02', tag: 'AISLES A01-A06' },
                      smt_lines: { icon: '⚡', stage: 'STAGE 03', tag: 'LINES 1-4' },
                      final_assembly: { icon: '🔧', stage: 'STAGE 04', tag: 'LINES 5-8' },
                      testing_qc: { icon: '🔬', stage: 'STAGE 05', tag: 'BURN-IN BAY' },
                      fg_packaging: { icon: '📦', stage: 'STAGE 06', tag: 'OUTBOUND PACK' },
                    }
                    const meta = zoneIcons[zone.id] || { icon: '⚙️', stage: 'ZONE', tag: 'FLOOR' }

                    // Progress bar color based on utilization
                    const utilColor = zone.throughput_utilization > 85 ? '#EF4444' : zone.throughput_utilization > 75 ? '#F59E0B' : '#10B981'

                    return (
                      <div
                        key={zone.id}
                        onClick={() => setSelectedZone(zone.id)}
                        style={{
                          background: isSelected ? '#FAF5FF' : '#FFFFFF',
                          border: `2px solid ${isSelected ? '#6F3DBA' : isAlert ? '#FCA5A5' : '#E2E8F0'}`,
                          borderRadius: 10,
                          padding: 16,
                          cursor: 'pointer',
                          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                          boxShadow: isSelected
                            ? '0 6px 18px rgba(111, 61, 186, 0.18)'
                            : '0 1px 3px rgba(0, 0, 0, 0.04)',
                          transform: isSelected ? 'translateY(-2px)' : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div>
                          {/* Card Top: Stage Tag & Status Badge */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>
                              {meta.stage} · {meta.tag}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: zone.status === 'BOTTLENECK_ALERT' ? '#FEE2E2' : zone.status === 'OPTIMAL' ? '#ECFDF5' : '#EFF6FF',
                                color: zone.status === 'BOTTLENECK_ALERT' ? '#DC2626' : zone.status === 'OPTIMAL' ? '#059669' : '#2563EB',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {zone.status === 'BOTTLENECK_ALERT' && (
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#DC2626' }} />
                              )}
                              {zone.status}
                            </span>
                          </div>

                          {/* Zone Title */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 18 }}>{meta.icon}</span>
                            <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', lineHeight: 1.25 }}>
                              {zone.name}
                            </span>
                          </div>

                          {/* Key Zone Metrics */}
                          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
                            {zone.id === 'inbound_dock' && (
                              <div>
                                <span style={{ fontWeight: 600 }}>{zone.open_deliveries} Inbound POs</span>
                                <span style={{ color: '#DC2626', fontWeight: 600 }}> ({zone.overdue_pos} delayed)</span>
                              </div>
                            )}
                            {zone.id === 'rm_storage' && (
                              <div>
                                <span style={{ fontWeight: 600 }}>{zone.total_skus} Materials</span>
                                <span style={{ color: '#D97706', fontWeight: 600 }}> ({zone.critical_skus} critical)</span>
                              </div>
                            )}
                            {zone.id === 'smt_lines' && (
                              <div>
                                <span style={{ fontWeight: 600 }}>{zone.line_speed_uph} Units / Hour</span>
                                <div style={{ fontSize: 11, color: '#64748B' }}>SMT Lines 1-4 Active</div>
                              </div>
                            )}
                            {zone.id === 'final_assembly' && (
                              <div>
                                <span style={{ fontWeight: 700, color: '#DC2626' }}>Limiting: {zone.limiting_material}</span>
                                <div style={{ fontSize: 11, color: '#475569' }}>Cap: {zone.capacity_units?.toLocaleString('en-IN')} units</div>
                              </div>
                            )}
                            {zone.id === 'testing_qc' && (
                              <div>
                                <span style={{ fontWeight: 600, color: '#059669' }}>Yield: {zone.yield_rate_pct}% First-Pass</span>
                                <div style={{ fontSize: 11, color: '#64748B' }}>Burn-In Testing Active</div>
                              </div>
                            )}
                            {zone.id === 'fg_packaging' && (
                              <div>
                                <span style={{ fontWeight: 600, color: '#2563EB' }}>Ready: {zone.supported_output?.toLocaleString('en-IN')} units</span>
                                <div style={{ fontSize: 11, color: '#64748B' }}>Outbound Dispatch Staged</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar & Footer */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Throughput Load</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: utilColor }}>{zone.throughput_utilization}%</span>
                          </div>
                          <div style={{ width: '100%', background: '#E2E8F0', height: 6, borderRadius: 999, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${zone.throughput_utilization}%`,
                                height: '100%',
                                background: utilColor,
                                borderRadius: 999,
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>

                          {isSelected && (
                            <div style={{ marginTop: 8, textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: '#6F3DBA' }}>
                              ● INSPECTING ZONE TELEMETRY
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Zone Telemetry Inspector */}
            <div className="card" style={{ minWidth: 0, overflow: 'hidden', padding: 0 }}>
              <div className="card-head" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Zone Telemetry Inspector</h2>
                  <span className="pill" style={{ background: '#EDE9FE', color: '#6D28D9', fontWeight: 700, fontSize: 11 }}>
                    REAL-TIME
                  </span>
                </div>
              </div>

              {(() => {
                const z = twin.zones.find((x: any) => x.id === selectedZone) || twin.zones[0]
                const zoneMeta: Record<string, { icon: string; stage: string; desc: string }> = {
                  inbound_dock: { icon: '🚚', stage: 'STAGE 01', desc: 'Inbound dock scheduling, receiving, and incoming material quality clearance.' },
                  rm_storage: { icon: '🏬', stage: 'STAGE 02', desc: 'High-bay pallet storage, bin slotting, and safety stock reserve buffers.' },
                  smt_lines: { icon: '⚡', stage: 'STAGE 03', desc: 'High-speed surface mount placement of micro-components onto bare PCBs.' },
                  final_assembly: { icon: '🔧', stage: 'STAGE 04', desc: 'Box-build mechanical assembly, display bonding, and battery integration.' },
                  testing_qc: { icon: '🔬', stage: 'STAGE 05', desc: 'Automated RF, acoustic, display, camera calibration, and 12-hour burn-in.' },
                  fg_packaging: { icon: '📦', stage: 'STAGE 06', desc: 'IMEI serialization, retail boxing, tamper sealing, and pallet dispatch staging.' },
                }
                const currentMeta = zoneMeta[z.id] || { icon: '⚙️', stage: 'ZONE', desc: 'Manufacturing zone telemetry.' }

                return (
                  <div style={{ padding: '12px 18px 18px 18px' }}>
                    {/* Zone Header Banner */}
                    <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#6F3DBA' }}>{currentMeta.stage}</span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: z.status === 'BOTTLENECK_ALERT' ? '#FEE2E2' : '#ECFDF5',
                            color: z.status === 'BOTTLENECK_ALERT' ? '#DC2626' : '#059669',
                          }}
                        >
                          {z.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{currentMeta.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{z.name}</div>
                          <div className="small muted" style={{ fontSize: 11 }}>Zone Identifier: <code>{z.id}</code></div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                        {currentMeta.desc}
                      </div>
                    </div>

                    {/* 4-Tile Telemetry KPI Matrix */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Throughput Load</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: z.throughput_utilization > 85 ? '#EF4444' : '#0F172A', marginTop: 2 }}>
                          {z.throughput_utilization}%
                        </div>
                        <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                          {z.throughput_utilization > 85 ? 'Throttled / Heavy Load' : 'Normal Operating Band'}
                        </div>
                      </div>

                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Supported Capacity</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                          {z.capacity_units ? `${z.capacity_units.toLocaleString('en-IN')} units` : z.supported_output ? `${z.supported_output.toLocaleString('en-IN')} units` : '450 UPH'}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Max Output Supported</div>
                      </div>

                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Limiting Material</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: z.limiting_material ? '#DC2626' : '#059669', marginTop: 3, wordBreak: 'break-word' }}>
                          {z.limiting_material || 'None (Buffer OK)'}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>BOM Constraint</div>
                      </div>

                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Supply / Quality Health</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                          {z.overdue_pos !== undefined ? `${z.overdue_pos} Delayed POs` : z.critical_skus !== undefined ? `${z.critical_skus} Critical SKUs` : z.yield_rate_pct !== undefined ? `${z.yield_rate_pct}% Yield` : 'Nominal'}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Stage Health Indicator</div>
                      </div>
                    </div>

                    {/* Operational Diagnostics Box */}
                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: '#B45309', marginBottom: 4 }}>
                        <span>⚠️ Operational Diagnosis & Root Cause</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.45 }}>
                        {z.id === 'final_assembly' && (
                          <span>
                            Main box assembly lines 5-8 are throttled by <b>6-layer Main PCB</b>. Even though SMT lines have produced sufficient circuit boards, mechanical sub-assembly is restricted to <b>{z.capacity_units?.toLocaleString('en-IN')} units</b> before safety stock is fully consumed.
                          </span>
                        )}
                        {z.id === 'inbound_dock' && (
                          <span>
                            Receiving dock has <b>{z.overdue_pos} purchase orders overdue</b> from tier-1 suppliers. Display and RF antenna shipments are at risk of starving upstream assembly buffers if dock unloading is delayed past 24 hours.
                          </span>
                        )}
                        {z.id === 'rm_storage' && (
                          <span>
                            Warehouse holds {z.total_skus} active components. <b>{z.critical_skus} components</b> have breached their mandatory minimum safety buffer. Automated replenishment purchase order drafts are recommended.
                          </span>
                        )}
                        {z.id === 'smt_lines' && (
                          <span>
                            SMT assembly lines 1-4 are running smoothly at 450 units/hour. Feeder reject rate is well within acceptable tolerance (&lt;0.5%) with balanced component flow.
                          </span>
                        )}
                        {z.id === 'testing_qc' && (
                          <span>
                            Functional testing & burn-in stages are operating at 98.4% first-pass yield. Calibration chambers are fully operational with zero batch defect spikes.
                          </span>
                        )}
                        {z.id === 'fg_packaging' && (
                          <span>
                            Finished goods packaging has <b>{z.supported_output?.toLocaleString('en-IN')} handsets</b> boxed, serialized, and palletized, ready for carrier dispatch.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actionable AI Recommendations & Direct Triggers */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
                        Actionable AI Proposals & Mitigation Shortcuts:
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {z.id === 'final_assembly' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAgent(`Draft an urgent purchase order expedite notice for ${z.limiting_material} to alleviate the final assembly line bottleneck.`)}
                              className="btn sm"
                              style={{
                                background: '#6F3DBA',
                                color: '#FFFFFF',
                                border: 'none',
                                fontWeight: 700,
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 6,
                              }}
                            >
                              <span>⚡ Expedite PO for {z.limiting_material}</span>
                              <span style={{ fontSize: 11, opacity: 0.9 }}>Ask Agent ↗</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openAgent("Propose an inter-plant stock transfer from Chennai plant (IN-TN-01) to Bengaluru plant (IN-KA-01) for 6-layer Main PCB.")}
                              className="btn sm"
                              style={{
                                background: '#FFFFFF',
                                color: '#1E293B',
                                border: '1px solid #CBD5E1',
                                fontWeight: 600,
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 6,
                              }}
                            >
                              <span>🔄 Propose Inter-Plant Transfer from Chennai</span>
                              <span style={{ fontSize: 11, color: '#64748B' }}>Action ↗</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setTab('capacity')}
                              className="btn sm"
                              style={{
                                background: '#F8FAFC',
                                color: '#475569',
                                border: '1px solid #E2E8F0',
                                fontWeight: 600,
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 6,
                              }}
                            >
                              <span>📊 Open 16-Component BOM Capacity Analysis</span>
                              <span style={{ fontSize: 11, color: '#64748B' }}>Tab 2 ↗</span>
                            </button>
                          </>
                        )}

                        {z.id === 'inbound_dock' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAgent("Show all overdue inbound purchase orders with supplier delay risk scores.")}
                              className="btn sm"
                              style={{
                                background: '#6F3DBA',
                                color: '#FFFFFF',
                                border: 'none',
                                fontWeight: 700,
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 6,
                              }}
                            >
                              <span>🚚 Review Overdue Supplier Deliveries</span>
                              <span style={{ fontSize: 11, opacity: 0.9 }}>Ask Agent ↗</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => { setTab('simulation'); setSimMode('delay'); }}
                              className="btn sm"
                              style={{
                                background: '#FFFFFF',
                                color: '#1E293B',
                                border: '1px solid #CBD5E1',
                                fontWeight: 600,
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 6,
                              }}
                            >
                              <span>🧪 Test Supplier Delay in What-If Lab</span>
                              <span style={{ fontSize: 11, color: '#64748B' }}>Tab 5 ↗</span>
                            </button>
                          </>
                        )}

                        {z.id === 'rm_storage' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAgent("Generate automated replenishment purchase order drafts for the 3 critical stock items falling below safety stock.")}
                              className="btn sm"
                              style={{
                                background: '#6F3DBA',
                                color: '#FFFFFF',
                                border: 'none',
                                fontWeight: 700,
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 6,
                              }}
                            >
                              <span>📦 Draft Replenishment for Critical SKUs</span>
                              <span style={{ fontSize: 11, opacity: 0.9 }}>Ask Agent ↗</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setTab('forecast')}
                              className="btn sm"
                              style={{
                                background: '#FFFFFF',
                                color: '#1E293B',
                                border: '1px solid #CBD5E1',
                                fontWeight: 600,
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 6,
                              }}
                            >
                              <span>📈 View 30/60/90-Day Material Forecast</span>
                              <span style={{ fontSize: 11, color: '#64748B' }}>Tab 3 ↗</span>
                            </button>
                          </>
                        )}

                        {(z.id === 'smt_lines' || z.id === 'testing_qc' || z.id === 'fg_packaging') && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAgent(`Analyze throughput and operational efficiency for ${z.name}.`)}
                              className="btn sm"
                              style={{
                                background: '#6F3DBA',
                                color: '#FFFFFF',
                                border: 'none',
                                fontWeight: 700,
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 6,
                              }}
                            >
                              <span>⚡ Analyze Line Performance & Balance</span>
                              <span style={{ fontSize: 11, opacity: 0.9 }}>Ask Agent ↗</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BOM & Production Capacity (Module B)                             */}
        {/* ========================================================================= */}
        {tab === 'capacity' && cap && (
          <div className="grid">
            {/* Filter and Summary */}
            <div className="card">
              <div className="row" style={{ gap: 14 }}>
                <span style={{ fontWeight: 600 }}>Select Finished Product:</span>
                <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
                  <option value="">All Finished Products (Portfolio)</option>
                  {cap.products.map((p: any) => (
                    <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.product_id})</option>
                  ))}
                </select>
                <span className="spacer" />
                <span className="small muted">
                  Formula: <code>Capacity = ⌊UsableStock / AdjustedQtyPerUnit⌋</code> · Bottleneck = <code>min(Capacities)</code>
                </span>
              </div>
            </div>

            {/* Product Cards */}
            <div className="grid g3">
              {cap.products.map((p: any) => (
                <div key={p.product_id} className="card" style={{ borderTop: '4px solid var(--orange)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{p.product_name}</h3>
                      <div className="small muted">{p.product_id}</div>
                    </div>
                    <span className="pill" style={{ background: '#FAF0E6', color: '#D66A36', fontWeight: 700 }}>
                      {p.max_production_capacity.toLocaleString('en-IN')} Units
                    </span>
                  </div>
                  <div style={{ margin: '14px 0', padding: 10, background: 'var(--surface)', borderRadius: 6 }}>
                    <div className="small muted">Limiting Bottleneck Material:</div>
                    <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 13 }}>
                      {p.bottleneck_material} ({p.bottleneck_material_id})
                    </div>
                  </div>
                  <div className="small muted">
                    Includes {p.components.length} BOM components adjusted for scrap allowance.
                  </div>
                </div>
              ))}
            </div>

            {/* Component Requirements Breakdown Table */}
            <div className="card">
              <div className="card-head">
                <h2>BOM Component Capacity & Surplus Stock Breakdown</h2>
                <span className="spacer" />
                <span className="small muted">Sorted by bottleneck constraint</span>
              </div>
              <div className="table-wrap">
                <table className="dg">
                  <thead>
                    <tr>
                      <th>Material Component</th>
                      <th>Category</th>
                      <th className="num">Usable Stock</th>
                      <th className="num">Qty / Product</th>
                      <th className="num">Scrap Factor</th>
                      <th className="num">Supported Capacity</th>
                      <th className="num">Required for Max</th>
                      <th className="num">Surplus Stock</th>
                      <th style={{ textAlign: 'center' }}>Constraint Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cap.products[0]?.components.map((c: any) => (
                      <tr key={c.material_id} style={{ background: c.is_bottleneck ? '#FDF4F3' : 'transparent' }}>
                        <td>
                          <b>{c.material_id}</b>
                          <div className="small muted">{c.material_name}</div>
                        </td>
                        <td>{c.category}</td>
                        <td className="num"><b>{c.usable_stock.toLocaleString('en-IN')} {c.uom}</b></td>
                        <td className="num">{c.qty_per_product} {c.uom}</td>
                        <td className="num">{pct(c.scrap_factor * 100)}</td>
                        <td className="num">
                          <b style={{ color: c.is_bottleneck ? 'var(--red)' : 'var(--text)' }}>
                            {c.supported_capacity.toLocaleString('en-IN')}
                          </b>
                        </td>
                        <td className="num">{c.required_for_capacity?.toLocaleString('en-IN')} {c.uom}</td>
                        <td className="num">
                          <span style={{ color: c.surplus_qty > 0 ? '#2E7D32' : 'var(--muted)' }}>
                            {c.surplus_qty?.toLocaleString('en-IN')} {c.uom}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {c.is_bottleneck ? (
                            <span className="status critical" style={{ fontSize: 11, padding: '2px 8px' }}>LIMITING BOTTLENECK</span>
                          ) : (
                            <span className="status healthy" style={{ fontSize: 11, padding: '2px 8px' }}>SURPLUS AVAILABLE</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: 30 / 60 / 90 Days Material Demand Forecast (Module C & D)        */}
        {/* ========================================================================= */}
        {tab === 'forecast' && (
          <div className="grid">
            <div className="card">
              <div className="row" style={{ gap: 12 }}>
                <span style={{ fontWeight: 600 }}>Select Planning Horizon:</span>
                <div className="stepper" style={{ gap: 6 }}>
                  <button className={`btn sm ${horizon === 30 ? 'primary' : ''}`} onClick={() => setHorizon(30)}>
                    30 Days · Near-term Planning
                  </button>
                  <button className={`btn sm ${horizon === 60 ? 'primary' : ''}`} onClick={() => setHorizon(60)}>
                    60 Days · Procurement Planning
                  </button>
                  <button className={`btn sm ${horizon === 90 ? 'primary' : ''}`} onClick={() => setHorizon(90)}>
                    90 Days · Strategic Planning
                  </button>
                </div>
                <span className="spacer" />
                <span className="pill scenario">Hybrid: BOM-based + Run-rate Moving Average</span>
              </div>
            </div>

            {/* Forecast Chart */}
            <div className="card">
              <div className="card-head">
                <h2>Material Demand Requirement vs. Projected Usable Stock ({horizon} Days)</h2>
              </div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecast.slice(0, 10)} margin={{ top: 10, right: 15, left: 10, bottom: 25 }}>
                    <XAxis dataKey="material_id" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="forecast_demand_qty" name="Forecast Demand" fill="#D66A36" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="usable_stock_qty" name="Current Usable Stock" fill="#8C7D72" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="incoming_po_qty" name="Incoming PO Supply" fill="#D98754" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Forecast Details Table */}
            <div className="card">
              <div className="card-head">
                <h2>{horizon}-Day Material Replenishment & Shortage Horizon Table</h2>
                <span className="spacer" />
                <span className="small muted">{forecast.length} materials analyzed</span>
              </div>
              <div className="table-wrap">
                <table className="dg">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Category</th>
                      <th className="num">Daily Burn</th>
                      <th className="num">Forecast Demand</th>
                      <th className="num">Usable Now</th>
                      <th className="num">Incoming Supply</th>
                      <th className="num">Projected Closing</th>
                      <th className="num">Days Cover</th>
                      <th>Shortage Date</th>
                      <th className="num">Reorder Quantity</th>
                      <th>Forecast Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.map((f: any) => (
                      <tr key={f.material_id} style={{ background: f.status === 'CRITICAL' ? '#FDF5F4' : 'transparent' }}>
                        <td>
                          <b>{f.material_id}</b>
                          <div className="small muted">{f.material_name}</div>
                        </td>
                        <td>{f.category}</td>
                        <td className="num">{f.daily_consumption_rate} {f.uom}/d</td>
                        <td className="num"><b>{f.forecast_demand_qty?.toLocaleString('en-IN')}</b></td>
                        <td className="num">{f.usable_stock_qty?.toLocaleString('en-IN')}</td>
                        <td className="num">{f.incoming_po_qty?.toLocaleString('en-IN')}</td>
                        <td className="num">
                          <b style={{ color: f.projected_closing_qty < 0 ? 'var(--red)' : '#2E7D32' }}>
                            {f.projected_closing_qty?.toLocaleString('en-IN')}
                          </b>
                        </td>
                        <td className="num">{f.days_of_cover} d</td>
                        <td>
                          {f.shortage_date ? (
                            <span className="status critical" style={{ fontSize: 11, padding: '2px 8px' }}>{f.shortage_date}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td className="num">
                          {f.recommended_reorder_qty > 0 ? (
                            <b>{f.recommended_reorder_qty?.toLocaleString('en-IN')} {f.uom}</b>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className="pill">{f.confidence}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: Material & Packaging Intelligence (Module A)                      */}
        {/* ========================================================================= */}
        {tab === 'packaging' && (
          <div className="grid g2">
            {/* Input Config Card */}
            <div className="card">
              <div className="card-head">
                <h2>Packaging & UOM Conversion Sandbox</h2>
              </div>
              <div className="muted small" style={{ marginBottom: 16 }}>
                Translates incoming bulk packaging units (boxes, cartons, drums, reels) into manufacturing base units with QC loss deductions.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Material Identifier</label>
                  <select value={pkgMat} onChange={(e) => setPkgMat(e.target.value)} style={{ width: '100%' }}>
                    <option value="RM-SOLDER">RM-SOLDER (Solder Paste / Wire)</option>
                    <option value="MAT-BOX-014">MAT-BOX-014 (Retail Packaging Box)</option>
                    <option value="MAT-SCR-016">MAT-SCR-016 (Precision Screws Set)</option>
                    <option value="MAT-GLS-010">MAT-GLS-010 (Front Cover Glass)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Packaging Unit (Purchase UOM)</label>
                    <select value={pkgUom} onChange={(e) => setPkgUom(e.target.value)} style={{ width: '100%' }}>
                      <option value="BOX">BOX</option>
                      <option value="CARTON">CARTON</option>
                      <option value="DRUM">DRUM</option>
                      <option value="REEL">REEL</option>
                      <option value="PACK">PACK</option>
                    </select>
                  </div>
                  <div>
                    <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Received Packaging Quantity</label>
                    <input type="number" value={pkgQty} onChange={(e) => setPkgQty(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>QC Rejection / Scrap Loss (%)</label>
                    <input type="number" step="0.5" value={pkgQcLoss} onChange={(e) => setPkgQcLoss(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Standard Cost per Base Unit (₹)</label>
                    <input type="number" value={pkgUnitCost} onChange={(e) => setPkgUnitCost(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20, padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: 12.5 }}>
                <b>Acceptance Criterion Example:</b> 20 boxes × 10 coils = 200 coils × 100g = 20,000g (less 5% loss = 19,000g usable) → supports <b>9,500 finished phones</b> at 2g/unit.
              </div>
            </div>

            {/* Calculated Conversion Output Card */}
            <div className="card" style={{ borderTop: '4px solid var(--orange)' }}>
              <div className="card-head">
                <h2>Conversion & Capacity Output</h2>
                <span className="spacer" />
                <span className="pill" style={{ background: '#E8F5E9', color: '#2E7D32', fontWeight: 600 }}>AUDITED TRACE</span>
              </div>

              {convResult && (
                <div>
                  <div style={{ padding: 14, background: '#FAF7F3', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 18 }}>
                    <div className="small muted">Deterministic Audit String:</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginTop: 4 }}>
                      {convResult.audit_trace}
                    </div>
                  </div>

                  <div className="kv" style={{ fontSize: 14 }}>
                    <dt>Received Packaging</dt>
                    <dd><b>{convResult.input_package_qty} {convResult.package_uom}</b></dd>

                    <dt>Conversion Ratio</dt>
                    <dd>1 {convResult.package_uom} = {convResult.conversion_factor} {convResult.base_uom}</dd>

                    <dt>Total Gross Base Quantity</dt>
                    <dd>{convResult.total_received_base_qty?.toLocaleString('en-IN')} {convResult.base_uom}</dd>

                    <dt>QC Rejection Loss ({convResult.qc_loss_pct}%)</dt>
                    <dd style={{ color: 'var(--red)' }}>- {convResult.rejected_qty?.toLocaleString('en-IN')} {convResult.base_uom}</dd>

                    <dt>Net Usable Base Quantity</dt>
                    <dd><b style={{ color: '#2E7D32', fontSize: 18 }}>{convResult.usable_base_qty?.toLocaleString('en-IN')} {convResult.base_uom}</b></dd>

                    <dt>Weight Equivalent</dt>
                    <dd>{convResult.usable_weight?.toLocaleString('en-IN')} {convResult.weight_uom}</dd>

                    <dt>Valuation in INR</dt>
                    <dd><b style={{ color: 'var(--orange)' }}>{inr(convResult.total_value_inr)}</b></dd>
                  </div>

                  <div style={{ marginTop: 22, padding: 14, background: '#FFF8F4', border: '1px dashed var(--soft-orange)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 700, color: 'var(--orange)', marginBottom: 4 }}>Production Capacity Supported:</div>
                    <div className="small">
                      This received delivery provides usable material to manufacture approximately{' '}
                      <b>{Math.floor(convResult.usable_base_qty / 2).toLocaleString('en-IN')} units</b> of Aster 15.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: What-If Scenario Simulation Lab (Module E)                         */}
        {/* ========================================================================= */}
        {tab === 'simulation' && (
          <div className="grid g3">
            {/* Simulation Parameter Controls */}
            <div className="card">
              <div className="card-head">
                <h2>Simulation Controls</h2>
              </div>
              <div className="muted small" style={{ marginBottom: 16 }}>
                Simulate manufacturing stressors to test line resiliency and procurement buffers.
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                <button className={`btn sm ${simMode === 'volume' ? 'primary' : ''}`} onClick={() => setSimMode('volume')} style={{ flex: 1 }}>
                  Production Stress
                </button>
                <button className={`btn sm ${simMode === 'delay' ? 'primary' : ''}`} onClick={() => setSimMode('delay')} style={{ flex: 1 }}>
                  Supplier Delay
                </button>
              </div>

              {simMode === 'volume' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="small" style={{ fontWeight: 600 }}>Production Volume Shift:</span>
                      <span style={{ fontWeight: 700, color: 'var(--orange)' }}>{simVolumeDelta > 0 ? `+${simVolumeDelta}%` : `${simVolumeDelta}%`}</span>
                    </div>
                    <input type="range" min="-50" max="50" step="5" value={simVolumeDelta} onChange={(e) => setSimVolumeDelta(Number(e.target.value))} style={{ width: '100%' }} />
                    <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>-50% Cut</span><span>Nominal</span><span>+50% Surge</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="small" style={{ fontWeight: 600 }}>Scrap Rate / Consumption Delta:</span>
                      <span style={{ fontWeight: 700, color: 'var(--red)' }}>+{simScrapDelta}%</span>
                    </div>
                    <input type="range" min="0" max="30" step="1" value={simScrapDelta} onChange={(e) => setSimScrapDelta(Number(e.target.value))} style={{ width: '100%' }} />
                    <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>0% Normal</span><span>+15% Solder</span><span>+30% Severe</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="small" style={{ fontWeight: 600 }}>Supplier Lead Time Delay:</span>
                      <span style={{ fontWeight: 700, color: 'var(--red)' }}>+{simDelayDays} Days</span>
                    </div>
                    <input type="range" min="1" max="30" step="1" value={simDelayDays} onChange={(e) => setSimDelayDays(Number(e.target.value))} style={{ width: '100%' }} />
                    <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>+1 Day</span><span>+15 Days</span><span>+30 Days</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="small" style={{ fontWeight: 600 }}>Shipment Receipt Rate:</span>
                      <span style={{ fontWeight: 700, color: 'var(--soft-orange)' }}>{simReceiptRate}%</span>
                    </div>
                    <input type="range" min="20" max="100" step="10" value={simReceiptRate} onChange={(e) => setSimReceiptRate(Number(e.target.value))} style={{ width: '100%' }} />
                    <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>20% Partial</span><span>60%</span><span>100% Full</span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 24 }}>
                <button
                  className="btn primary"
                  style={{ width: '100%' }}
                  onClick={() => openAgent(
                    simMode === 'volume'
                      ? `What happens if production demand increases by ${simVolumeDelta}% and scrap by ${simScrapDelta}%?`
                      : `If supplier deliveries are delayed by ${simDelayDays} days at ${simReceiptRate}% fulfillment, what lines stop?`
                  )}
                >
                  Ask Agent to Evaluate Impact
                </button>
              </div>
            </div>

            {/* Simulation Results Comparison */}
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-head">
                <h2>Baseline vs. Simulated Impact Analysis</h2>
                <span className="spacer" />
                <span className="pill scenario">Dynamic Simulation Engine</span>
              </div>

              {simResult && (
                <div>
                  <div style={{ padding: 14, background: '#FAF7F3', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 18 }}>
                    <div className="small muted">Strategic Recommendation:</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', marginTop: 4 }}>
                      {simResult.recommendation}
                    </div>
                  </div>

                  {simMode === 'volume' && simResult.baseline && (
                    <div className="grid g3" style={{ marginBottom: 18 }}>
                      <div className="card" style={{ background: '#FBF9F7' }}>
                        <div className="small muted">Baseline Buildable Capacity</div>
                        <div style={{ fontSize: 22, fontWeight: 700 }}>
                          {simResult.baseline.total_buildable_units?.toLocaleString('en-IN')} units
                        </div>
                      </div>
                      <div className="card" style={{ background: '#FBF9F7' }}>
                        <div className="small muted">Simulated Capacity</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--orange)' }}>
                          {simResult.simulated.total_buildable_units?.toLocaleString('en-IN')} units
                        </div>
                      </div>
                      <div className="card" style={{ background: '#FBF9F7' }}>
                        <div className="small muted">Critical Shortage Count</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--red)' }}>
                          {simResult.simulated.critical_materials_count} Materials
                        </div>
                      </div>
                    </div>
                  )}

                  {simMode === 'delay' && simResult.impact_summary && (
                    <div className="grid g3" style={{ marginBottom: 18 }}>
                      <div className="card" style={{ background: '#FBF9F7' }}>
                        <div className="small muted">Line-Stop Risks</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>
                          {simResult.impact_summary.line_stop_risk_count} Events
                        </div>
                      </div>
                      <div className="card" style={{ background: '#FBF9F7' }}>
                        <div className="small muted">Critical Shortages Triggered</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--soft-orange)' }}>
                          {simResult.impact_summary.critical_shortages_triggered}
                        </div>
                      </div>
                      <div className="card" style={{ background: '#FBF9F7' }}>
                        <div className="small muted">Risk Severity</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>
                          {simResult.impact_summary.severity}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>Vulnerable Materials Under Current Simulation:</div>
                  <div className="table-wrap">
                    <table className="dg compact">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Category</th>
                          {simMode === 'volume' ? (
                            <>
                              <th className="num">Baseline Demand</th>
                              <th className="num">Simulated Demand</th>
                              <th className="num">Delta Demand</th>
                              <th>Simulated Status</th>
                            </>
                          ) : (
                            <>
                              <th className="num">Usable Stock</th>
                              <th className="num">Days Until Empty</th>
                              <th className="num">Delayed PO Qty</th>
                              <th>Line Stop Risk</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {simResult.affected_materials?.slice(0, 8).map((m_: any) => (
                          <tr key={m_.material_id}>
                            <td><b>{m_.material_id}</b> <span className="small muted">{m_.material_name}</span></td>
                            <td>{m_.category}</td>
                            {simMode === 'volume' ? (
                              <>
                                <td className="num">{m_.baseline_demand?.toLocaleString('en-IN')} {m_.uom}</td>
                                <td className="num"><b>{m_.simulated_demand?.toLocaleString('en-IN')} {m_.uom}</b></td>
                                <td className="num" style={{ color: 'var(--red)' }}>+{m_.demand_increase?.toLocaleString('en-IN')} {m_.uom}</td>
                                <td>
                                  <span className={`status ${m_.simulated_status === 'CRITICAL' ? 'critical' : 'at_risk'}`}>
                                    {m_.simulated_status}
                                  </span>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="num">{m_.usable_stock?.toLocaleString('en-IN')} {m_.uom}</td>
                                <td className="num"><b>{m_.days_until_empty} days</b></td>
                                <td className="num">{m_.delayed_po_qty?.toLocaleString('en-IN')} {m_.uom}</td>
                                <td>
                                  <span className="status critical">{m_.line_stop_risk} RISK</span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </PageState>
    </div>
  )
}
