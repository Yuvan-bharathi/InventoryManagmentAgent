import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { api } from '../api'
import { formatInr, formatQty } from '../format'
import { Icon } from '../icons'
import { useShell } from '../shell-context'

interface QualityData {
  summary: {
    total_inspections: number
    pass_count: number
    fail_count: number
    yield_pct: number
    hold_count: number
    rework_count: number
    scrap_count: number
    total_quarantined_value_inr: number
    quarantined_materials_count: number
  }
  by_stage: Array<{
    stage: string
    total: number
    fails: number
    fail_rate_pct: number
    holds: number
    reworks: number
    scraps: number
  }>
  by_defect: Array<{
    defect_code: string
    defect_name: string
    count: number
    severity: string
    default_disposition: string
  }>
  lots: Array<{
    inspection_id: string
    inspection_ts: string
    plant_id: string
    line_id: string
    station_id: string
    product_id: string
    serial_number: string
    production_order_id: string
    inspection_stage: string
    defect_code: string
    defect_name: string
    result: string
    severity: string
    measurement_value: number
    spec_min: number
    spec_max: number
    disposition: string
  }>
  quarantined_materials: Array<{
    material_id: string
    material_name: string
    material_category: string
    uom: string
    plant_id: string
    quality_hold_qty: number
    unit_cost_inr: number
    hold_value_inr: number
    warehouses: string
    status: string
  }>
}

export function QualityHold() {
  const { plant } = useShell()
  const [tab, setTab] = useState<'quarantine' | 'lots' | 'stages'>('quarantine')
  const [stageFilter, setStageFilter] = useState<string>('')
  const [dispFilter, setDispFilter] = useState<string>('')
  const [search, setSearch] = useState<string>('')

  const q = useQuery({
    queryKey: ['quality-overview', plant, stageFilter, dispFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (plant) params.set('plant_id', plant)
      if (stageFilter) params.set('stage', stageFilter)
      if (dispFilter) params.set('disposition', dispFilter)
      return api.get<QualityData>(`/api/quality?${params.toString()}`)
    },
    staleTime: 60_000,
  })

  const data = q.data?.data

  const filteredQuarantine = useMemo(() => {
    if (!data?.quarantined_materials) return []
    return data.quarantined_materials.filter((m) => {
      if (search) {
        const s = search.toLowerCase()
        return (
          m.material_id.toLowerCase().includes(s) ||
          m.material_name.toLowerCase().includes(s) ||
          m.material_category.toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [data?.quarantined_materials, search])

  const filteredLots = useMemo(() => {
    if (!data?.lots) return []
    return data.lots.filter((lot) => {
      if (search) {
        const s = search.toLowerCase()
        return (
          lot.inspection_id.toLowerCase().includes(s) ||
          lot.serial_number.toLowerCase().includes(s) ||
          lot.defect_name.toLowerCase().includes(s) ||
          lot.production_order_id.toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [data?.lots, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-head">
        <span className="page-icon solid">
          <Icon name="qc" size={28} />
        </span>
        <div>
          <div className="crumb">Warehouse &amp; Quality · QMS Telemetry</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            Quality Hold and Rejects
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            Quarantined inventory valuation, inspection defect log, rework routing, and scrap analysis.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {/* KPI Cards (5 in a single line) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid var(--st-critical)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="small muted" style={{ fontWeight: 600 }}>Active QC Hold</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '4px 0 2px' }}>
            {data ? data.summary.hold_count : '—'} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>lots</span>
          </div>
          <div className="small" style={{ color: 'var(--st-critical)', fontWeight: 600, fontSize: 12 }}>
            Requires usage disposition
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid var(--st-at_risk)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="small muted" style={{ fontWeight: 600 }}>Rework In-Progress</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '4px 0 2px' }}>
            {data ? data.summary.rework_count : '—'} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>lots</span>
          </div>
          <div className="small muted" style={{ fontSize: 12 }}>Routed to offline touch-up</div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="small muted" style={{ fontWeight: 600 }}>Scrapped Units</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '4px 0 2px' }}>
            {data ? data.summary.scrap_count : '—'} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>lots</span>
          </div>
          <div className="small muted" style={{ fontSize: 12 }}>Irrecoverable defect waste</div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid var(--accent)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="small muted" style={{ fontWeight: 600 }}>Value in Quarantine</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', margin: '4px 0 2px' }}>
            {data ? formatInr(data.summary.total_quarantined_value_inr) : '—'}
          </div>
          <div className="small muted" style={{ fontSize: 12 }}>
            Across {data?.summary.quarantined_materials_count ?? 0} SKUs
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid var(--ok)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="small muted" style={{ fontWeight: 600 }}>Inspection First-Pass Yield</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ok)', margin: '4px 0 2px' }}>
            {data ? `${data.summary.yield_pct}%` : '—'}
          </div>
          <div className="small muted" style={{ fontSize: 12 }}>
            {data ? `${data.summary.pass_count.toLocaleString()} of ${data.summary.total_inspections.toLocaleString()}` : ''}
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className={`btn ${tab === 'quarantine' ? 'primary' : 'outline'}`}
              onClick={() => setTab('quarantine')}
            >
              <Icon name="box" size={16} /> Quarantined Stock ({filteredQuarantine.length})
            </button>
            <button
              className={`btn ${tab === 'lots' ? 'primary' : 'outline'}`}
              onClick={() => setTab('lots')}
            >
              <Icon name="history" size={16} /> Non-Conformance Lots ({filteredLots.length})
            </button>
            <button
              className={`btn ${tab === 'stages' ? 'primary' : 'outline'}`}
              onClick={() => setTab('stages')}
            >
              <Icon name="chart" size={16} /> Stage &amp; Defect Pareto
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search SKU, lot or defect..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220, fontSize: 13 }}
            />
            {tab === 'lots' && (
              <>
                <select
                  value={dispFilter}
                  onChange={(e) => setDispFilter(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="">All Dispositions</option>
                  <option value="HOLD">HOLD</option>
                  <option value="REWORK">REWORK</option>
                  <option value="SCRAP">SCRAP</option>
                </select>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="">All Stages</option>
                  <option value="AOI">AOI</option>
                  <option value="SPI">SPI</option>
                  <option value="X-RAY">X-RAY</option>
                  <option value="DISPLAY">DISPLAY</option>
                  <option value="CAMERA">CAMERA</option>
                  <option value="PCBA_FUNCTIONAL">PCBA_FUNCTIONAL</option>
                  <option value="RF">RF</option>
                  <option value="FINAL_COSMETIC">FINAL_COSMETIC</option>
                  <option value="OQC">OQC</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Tab 1: Quarantined Stock */}
        {tab === 'quarantine' && (
          <div style={{ marginTop: 18, overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13.5 }}>
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Material Name</th>
                  <th>Category</th>
                  <th>Plant</th>
                  <th>Warehouses</th>
                  <th style={{ textAlign: 'right' }}>Hold Qty</th>
                  <th style={{ textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ textAlign: 'right' }}>Quarantined Value</th>
                  <th>Disposition Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuarantine.map((m) => (
                  <tr key={`${m.plant_id}-${m.material_id}`}>
                    <td>
                      <code>{m.material_id}</code>
                    </td>
                    <td style={{ fontWeight: 600 }}>{m.material_name}</td>
                    <td>
                      <span className="badge" style={{ background: 'var(--muted-fill)', color: 'var(--text)' }}>
                        {m.material_category}
                      </span>
                    </td>
                    <td>{m.plant_id}</td>
                    <td className="small muted">{m.warehouses}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--st-critical)' }}>
                      {formatQty(m.quality_hold_qty, m.uom)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatInr(m.unit_cost_inr)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                      {formatInr(m.hold_value_inr)}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#dc2626',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        QUARANTINED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Non-Conformance Inspection Lots */}
        {tab === 'lots' && (
          <div style={{ marginTop: 18, overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Inspection ID</th>
                  <th>Timestamp</th>
                  <th>Plant / Line</th>
                  <th>Serial Number</th>
                  <th>Stage</th>
                  <th>Defect</th>
                  <th>Severity</th>
                  <th>Result</th>
                  <th>Disposition</th>
                </tr>
              </thead>
              <tbody>
                {filteredLots.map((lot) => {
                  const dispColor =
                    lot.disposition === 'HOLD'
                      ? 'var(--brand-orange)'
                      : lot.disposition === 'REWORK'
                      ? 'var(--accent)'
                      : '#ef4444'
                  return (
                    <tr key={lot.inspection_id}>
                      <td>
                        <code>{lot.inspection_id}</code>
                      </td>
                      <td className="small muted">{lot.inspection_ts?.replace('T', ' ')}</td>
                      <td>
                        {lot.plant_id} · {lot.line_id}
                      </td>
                      <td>
                        <code>{lot.serial_number}</code>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                          {lot.inspection_stage}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{lot.defect_name}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: lot.severity === 'CRITICAL' ? '#ef4444' : 'var(--text)',
                          }}
                        >
                          {lot.severity}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#ef4444' }}>{lot.result}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: `${dispColor}18`,
                            color: dispColor,
                            border: `1px solid ${dispColor}40`,
                          }}
                        >
                          {lot.disposition}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Stage & Defect Pareto */}
        {tab === 'stages' && data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginTop: 18 }}>
            {/* Stage Pareto */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Inspection Stage Rejection Rate</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.by_stage.map((stg) => (
                  <div key={stg.stage} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700 }}>{stg.stage}</span>
                      <span style={{ fontWeight: 700, color: stg.fails > 0 ? '#ef4444' : 'var(--ok)' }}>
                        {stg.fail_rate_pct}% Fail Rate ({stg.fails} / {stg.total})
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--muted-fill)', borderRadius: 999, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, stg.fail_rate_pct * 10)}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--accent), #ef4444)',
                        }}
                      />
                    </div>
                    <div className="small muted" style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                      <span>Hold: <b>{stg.holds}</b></span>
                      <span>Rework: <b>{stg.reworks}</b></span>
                      <span>Scrap: <b>{stg.scraps}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Defect Pareto */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Top Root Defect Classifications</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.by_defect.map((df) => (
                  <div
                    key={df.defect_code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{df.defect_name}</div>
                      <div className="small muted" style={{ marginTop: 2 }}>
                        Code: <code>{df.defect_code}</code> · Default: <b>{df.default_disposition}</b>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{df.count}</span>
                      <div className="small" style={{ color: df.severity === 'CRITICAL' ? '#ef4444' : 'var(--muted)' }}>
                        {df.severity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

