import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { formatQty } from '../format'
import { Icon } from '../icons'
import { useShell } from '../shell-context'
import { Link } from 'react-router-dom'

interface SupplierPrediction {
  po_number?: string
  purchase_order_id?: string
  po_line?: number
  line_number?: number
  plant_id: string
  supplier_id: string
  supplier_name: string
  material_id: string
  material_name: string
  promised_date: string
  predicted_delivery_date: string
  delay_days?: number
  predicted_delay_days?: number
  is_overdue: boolean
  late_risk?: string
  delivery_risk_level?: string
  open_qty: number
}

interface AffectedMaterial {
  material_id: string
  material_name: string
  category: string
  uom: string
  usable_stock: number
  daily_burn_rate: number
  days_until_empty: number
  delayed_po_qty: number
  effective_incoming_qty: number
  delay_days: number
  shortage_accelerated_by_days: number
  line_stop_risk: string
}

interface SimulationResult {
  scenario_type?: string
  parameters?: {
    supplier_id: string
    delay_days: number
    receipt_rate_pct: number
    plant_id: string
  }
  impact_summary?: {
    line_stop_risk_count: number
    critical_shortages_triggered: number
    severity: string
  }
  affected_materials?: AffectedMaterial[]
  recommendation?: string
  impacted_production_orders?: number
  impacted_units?: number
  estimated_downtime_hours?: number
  revenue_at_risk_inr?: number
}

export function SupplierDelaySimulator() {
  const { plant } = useShell()
  const [selectedSupplier, setSelectedSupplier] = useState<string>('SUP-001')
  const [delayDays, setDelayDays] = useState<number>(7)
  const [receiptRate, setReceiptRate] = useState<number>(100)
  const [simResult, setSimResult] = useState<SimulationResult | null>(null)

  const supQ = useQuery({
    queryKey: ['supplier-predictions', plant],
    queryFn: () => {
      const p = new URLSearchParams()
      if (plant) p.set('plant_id', plant)
      return api.get<SupplierPrediction[]>(`/api/forecast/supplier-delivery?${p.toString()}`)
    },
    staleTime: 60_000,
  })

  const predictions = supQ.data?.data ?? []

  const simMutation = useMutation({
    mutationFn: (body: { supplier_id: string; delay_days: number; receipt_rate_pct: number; plant_id?: string }) =>
      api.post<SimulationResult>('/api/simulations/supplier-delay', body),
    onSuccess: (res) => {
      setSimResult(res.data)
    },
  })

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault()
    simMutation.mutate({
      supplier_id: selectedSupplier,
      delay_days: delayDays,
      receipt_rate_pct: receiptRate,
      plant_id: plant || undefined,
    })
  }

  const lineStopCount = simResult?.impact_summary?.line_stop_risk_count ?? simResult?.impacted_production_orders ?? 0
  const criticalCount = simResult?.impact_summary?.critical_shortages_triggered ?? simResult?.affected_materials?.length ?? 0
  const severity = simResult?.impact_summary?.severity ?? (lineStopCount > 0 ? 'CRITICAL' : 'MANAGEABLE')
  const estimatedDowntime = simResult?.estimated_downtime_hours ?? (lineStopCount * delayDays * 8)
  const estimatedUnits = simResult?.impacted_units ?? (lineStopCount * 450 * Math.max(1, delayDays))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-head">
        <span className="page-icon solid">
          <Icon name="simulator" size={28} />
        </span>
        <div>
          <div className="crumb">Plan · Scenario Modeling</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            Supplier Delay Simulator
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            Simulate vendor delivery delays, evaluate assembly line impact, and calculate production downtime.
          </p>
        </div>
      </div>

      {/* Interactive Simulation Controls */}
      <div
        className="card"
        style={{
          padding: 22,
          background: 'linear-gradient(135deg, rgba(111, 61, 186, 0.05), rgba(245, 138, 58, 0.06))',
        }}
      >
        <form onSubmit={handleSimulate}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                Target Vendor / Supplier
              </label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                style={{ width: '100%', fontWeight: 600 }}
              >
                <option value="SUP-001">SUP-001 · Apex Semiconductor Ltd</option>
                <option value="SUP-002">SUP-002 · Bharat Display Tech</option>
                <option value="SUP-003">SUP-003 · Pacific Memory Corp</option>
                <option value="SUP-004">SUP-004 · FastLine Logistics</option>
                <option value="SUP-005">SUP-005 · ElectroPack Global</option>
              </select>
            </div>

            <div>
              <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                Simulated Delivery Delay (+Days)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  max={45}
                  value={delayDays}
                  onChange={(e) => setDelayDays(Number(e.target.value))}
                  style={{ width: '100%', fontWeight: 700 }}
                />
                <span className="small muted">days</span>
              </div>
            </div>

            <div>
              <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                Fulfillment Delivery Rate (%)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={10}
                  max={100}
                  step={5}
                  value={receiptRate}
                  onChange={(e) => setReceiptRate(Number(e.target.value))}
                  style={{ width: '100%', fontWeight: 700 }}
                />
                <span className="small muted">%</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <button
                type="submit"
                className="btn warm"
                style={{ width: '100%', height: 40, fontWeight: 700 }}
                disabled={simMutation.isPending}
              >
                <Icon name="play" size={16} />{' '}
                {simMutation.isPending ? 'Simulating...' : 'Run Delay Simulation'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Simulation Result Callout */}
      {simResult && (
        <div
          className="card"
          style={{
            padding: 22,
            borderLeft: `4px solid ${severity === 'CRITICAL' ? '#ef4444' : 'var(--brand-orange)'}`,
            background: 'linear-gradient(135deg, rgba(245, 138, 58, 0.08), transparent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              Simulation Outcome: +{simResult.parameters?.delay_days ?? delayDays} Days Delay on {simResult.parameters?.supplier_id ?? selectedSupplier}
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 999,
                background: severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 138, 58, 0.15)',
                color: severity === 'CRITICAL' ? '#ef4444' : 'var(--brand-orange)',
              }}
            >
              {severity} RISK
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <div className="small muted">Potential Line Stoppages</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--st-critical)', marginTop: 2 }}>
                {lineStopCount} lines
              </div>
            </div>
            <div>
              <div className="small muted">Critical Shortages Triggered</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                {criticalCount} materials
              </div>
            </div>
            <div>
              <div className="small muted">Estimated Assembly Downtime</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-orange)', marginTop: 2 }}>
                {estimatedDowntime} hours
              </div>
            </div>
            <div>
              <div className="small muted">Estimated Output Disruption</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
                {estimatedUnits.toLocaleString()} units
              </div>
            </div>
          </div>

          {simResult.recommendation && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 14px',
                background: 'var(--card)',
                borderRadius: 10,
                border: '1px solid var(--border)',
                fontSize: 13.5,
                lineHeight: 1.45,
                color: 'var(--text)',
              }}
            >
              <b>Actionable Recommendation: </b>
              {simResult.recommendation}
            </div>
          )}

          {/* Affected Materials Table */}
          {simResult.affected_materials && simResult.affected_materials.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>
                Materials Triggering Imminent Assembly Line Stops:
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Material Code</th>
                      <th>Material Name</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Usable Stock</th>
                      <th style={{ textAlign: 'right' }}>Daily Burn</th>
                      <th style={{ textAlign: 'right' }}>Days Until Empty</th>
                      <th>Line Stop Risk</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simResult.affected_materials.map((mat) => (
                      <tr key={mat.material_id}>
                        <td><code>{mat.material_id}</code></td>
                        <td style={{ fontWeight: 600 }}>{mat.material_name}</td>
                        <td>{mat.category}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatQty(mat.usable_stock, mat.uom)}</td>
                        <td style={{ textAlign: 'right' }}>{mat.daily_burn_rate} {mat.uom}/d</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: mat.days_until_empty <= 3 ? '#ef4444' : 'var(--brand-orange)' }}>
                          {mat.days_until_empty} days
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: mat.line_stop_risk === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 138, 58, 0.15)',
                              color: mat.line_stop_risk === 'HIGH' ? '#ef4444' : 'var(--brand-orange)',
                            }}
                          >
                            {mat.line_stop_risk}
                          </span>
                        </td>
                        <td>
                          <Link to="/proposals" className="btn sm primary">
                            Expedite PO
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Open PO Delivery Tracking Table */}
      <div className="card" style={{ padding: 20 }}>
        <div className="card-head" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Live Open Purchase Order Delivery Telemetry
            </h3>
            <p className="muted small" style={{ margin: '3px 0 0' }}>
              Vendor promised dates vs. machine-learning predicted arrival horizons
            </p>
          </div>
          <div className="small muted">
            Tracking <b>{predictions.length}</b> Open PO Lines
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: 13.5 }}>
            <thead>
              <tr>
                <th>PO Line</th>
                <th>Supplier</th>
                <th>Material</th>
                <th style={{ textAlign: 'right' }}>Open Qty</th>
                <th>Promised Date</th>
                <th>Predicted Arrival</th>
                <th style={{ textAlign: 'right' }}>Est. Delay</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {predictions.slice(0, 25).map((p, idx) => {
                const poNum = p.po_number || p.purchase_order_id || `PO-${idx + 1}`
                const poLine = p.po_line || p.line_number || 1
                const delay = p.delay_days ?? p.predicted_delay_days ?? 0
                const risk = p.late_risk || p.delivery_risk_level || 'LOW'

                return (
                  <tr key={`${poNum}-${poLine}-${idx}`}>
                    <td>
                      <code>{poNum} #{poLine}</code>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.supplier_name}</td>
                    <td>{p.material_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {Number(p.open_qty || 0).toLocaleString()}
                    </td>
                    <td>{p.promised_date || '—'}</td>
                    <td style={{ fontWeight: p.is_overdue ? 700 : 400, color: p.is_overdue ? '#ef4444' : 'inherit' }}>
                      {p.predicted_delivery_date || '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: delay > 0 ? '#ef4444' : 'var(--ok)' }}>
                      {delay > 0 ? `+${delay}d` : 'On Time'}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: risk === 'HIGH' || risk === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: risk === 'HIGH' || risk === 'CRITICAL' ? '#ef4444' : 'var(--ok)',
                        }}
                      >
                        {risk}
                      </span>
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
