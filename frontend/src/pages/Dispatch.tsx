import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, qs } from '../api'
import { formatInr, formatQty } from '../format'
import { useShell } from '../shell-context'

interface DispatchSummary {
  total_shipments: number
  total_units_dispatched: number
  delivered_count: number
  in_transit_count: number
  delayed_count: number
  on_time_delivery_rate: number
  avg_vehicle_utilization: number
  total_freight_cost_inr: number
}

interface CarrierStat {
  carrier: string
  shipments_count: number
  delivered_count: number
  delayed_count: number
  in_transit_count: number
  on_time_pct: number
  avg_utilization_pct: number
  total_units: number
  total_freight_inr: number
  primary_modes: string[]
}

interface ModeStat {
  vehicle_type: string
  display_name: string
  shipments_count: number
  total_units: number
  avg_utilization_pct: number
  total_freight_inr: number
}

interface ShipmentRow {
  shipment_id: string
  customer_order_id: string
  customer_name: string
  product_id: string
  product_name: string
  carrier: string
  vehicle_type: string
  vehicle_type_label: string
  dispatch_date: string
  planned_eta: string
  actual_delivery_date: string
  shipment_qty: number
  freight_cost_inr: number
  vehicle_utilization_pct: number
  pod_status: string
  shipment_status: string
  is_delayed: boolean
  destination_country: string
  channel: string
}

interface DispatchResponse {
  summary: DispatchSummary
  carrier_performance: CarrierStat[]
  mode_breakdown: ModeStat[]
  recent_shipments: ShipmentRow[]
}

export function Dispatch() {
  const { plant, openAgent } = useShell()
  const [tab, setTab] = useState<'shipments' | 'carriers' | 'modes'>('shipments')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL')
  const [modeFilter, setModeFilter] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')

  const { data, isLoading, error } = useQuery<{ data: DispatchResponse }>({
    queryKey: ['dispatch-overview', plant, statusFilter, carrierFilter, modeFilter],
    queryFn: () =>
      api.get<any>(
        '/api/dispatch' +
          qs({
            plant_id: plant,
            status: statusFilter,
            carrier: carrierFilter,
            vehicle_type: modeFilter,
            limit: 150,
          }),
      ),
  })

  const dispatchData = data?.data
  const summary = dispatchData?.summary
  const carriers = dispatchData?.carrier_performance ?? []
  const modes = dispatchData?.mode_breakdown ?? []
  const shipments = dispatchData?.recent_shipments ?? []

  const filteredShipments = shipments.filter((s) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      s.shipment_id.toLowerCase().includes(term) ||
      s.customer_order_id.toLowerCase().includes(term) ||
      s.customer_name.toLowerCase().includes(term) ||
      s.carrier.toLowerCase().includes(term) ||
      s.product_id.toLowerCase().includes(term)
    )
  })

  return (
    <div>
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="crumb">Warehouse › Outbound Logistics &amp; Distribution</div>
          <div className="row" style={{ gap: 8 }}>
            <h1>Finished Goods &amp; Dispatch</h1>
            <span className="pill" style={{ background: '#E0F2FE', color: '#0369A1', fontWeight: 700 }}>
              LIVE TELEMETRY
            </span>
          </div>
          <div className="muted">
            Tracking outbound customer shipments, carrier on-time delivery rates (OTIF), transport modes, and container stuffing.
          </div>
        </div>
        <span className="spacer" />
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn sm"
            onClick={() => openAgent('Which shipments are currently delayed or past their planned ETA?')}
          >
            Ask: Delayed Shipments?
          </button>
          <button
            className="btn sm"
            onClick={() => openAgent('What is our carrier on-time performance across Delhivery, DHL, BlueDart, and Safexpress?')}
          >
            Ask: Carrier Scorecard?
          </button>
          <button
            className="btn sm primary"
            onClick={() => openAgent('Which transport modes have the highest vehicle utilization and what is our average freight cost?')}
          >
            Ask: Freight Efficiency?
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid g4" style={{ marginBottom: 18 }}>
          <div className="card kpi">
            <div className="label">Total Outbound Shipments</div>
            <div className="value" style={{ color: 'var(--brand-purple)' }}>
              {summary.total_shipments?.toLocaleString('en-IN') ?? '0'}
            </div>
            <div className="kpi-foot">
              {summary.total_units_dispatched?.toLocaleString('en-IN')} units dispatched
            </div>
          </div>

          <div className="card kpi">
            <div className="label">On-Time Delivery Rate (OTIF)</div>
            <div
              className="value"
              style={{
                color: summary.on_time_delivery_rate >= 80 ? '#15803D' : summary.on_time_delivery_rate >= 60 ? '#D97706' : '#DC2626',
              }}
            >
              {summary.on_time_delivery_rate}%
            </div>
            <div className="kpi-foot">Delivered on or before planned ETA</div>
          </div>

          <div className="card kpi">
            <div className="label">In-Transit Shipments</div>
            <div className="value" style={{ color: '#2563EB' }}>
              {summary.in_transit_count}
            </div>
            <div className="kpi-foot">{summary.delayed_count} delayed milestones flagged</div>
          </div>

          <div className="card kpi">
            <div className="label">Avg Vehicle Utilization</div>
            <div className="value" style={{ color: '#0D9488' }}>
              {summary.avg_vehicle_utilization}%
            </div>
            <div className="kpi-foot">Total freight: {formatInr(summary.total_freight_cost_inr)}</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={tab === 'shipments' ? 'on' : ''} onClick={() => setTab('shipments')}>
          1. Shipment Milestones ({shipments.length})
        </button>
        <button className={tab === 'carriers' ? 'on' : ''} onClick={() => setTab('carriers')}>
          2. Carrier SLA Scorecard ({carriers.length})
        </button>
        <button className={tab === 'modes' ? 'on' : ''} onClick={() => setTab('modes')}>
          3. Vehicle Modes &amp; Container Stuffing ({modes.length})
        </button>
      </div>

      {isLoading && <div className="muted" style={{ padding: 24, textAlign: 'center' }}>Loading dispatch telemetry...</div>}
      {error && <div className="card error" style={{ padding: 16, color: 'var(--red)' }}>Failed to load dispatch data.</div>}

      {/* TAB 1: Shipment Milestones Table */}
      {tab === 'shipments' && !isLoading && (
        <div className="card" style={{ padding: 16 }}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="small muted">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
              >
                <option value="ALL">All Statuses</option>
                <option value="DELIVERED">Delivered</option>
                <option value="IN_TRANSIT">In-Transit</option>
                <option value="DELAYED">Delayed</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="small muted">Carrier:</span>
              <select
                value={carrierFilter}
                onChange={(e) => setCarrierFilter(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
              >
                <option value="ALL">All Carriers</option>
                <option value="DHL">DHL Express</option>
                <option value="BlueDart">BlueDart</option>
                <option value="Delhivery">Delhivery</option>
                <option value="Safexpress">Safexpress</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="small muted">Vehicle Mode:</span>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
              >
                <option value="ALL">All Modes</option>
                <option value="AIR_CARGO">Air Cargo Express</option>
                <option value="32FT_TRUCK">32ft Heavy Container Truck</option>
                <option value="20FT_TRUCK">20ft Medium Cargo Truck</option>
                <option value="VAN">Local Sprinter Van</option>
              </select>
            </div>

            <span className="spacer" />

            <input
              type="text"
              placeholder="Search shipment, order, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                fontSize: 12,
                minWidth: 240,
              }}
            />
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Shipment ID</th>
                  <th>Customer &amp; Order</th>
                  <th>Product</th>
                  <th>Carrier &amp; Mode</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Utilization</th>
                  <th>Dispatch Date</th>
                  <th>Planned ETA</th>
                  <th>Status</th>
                  <th>POD</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.map((s) => (
                  <tr key={s.shipment_id}>
                    <td>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--brand-purple)' }}>
                        {s.shipment_id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.customer_name}</div>
                      <div className="small muted">{s.customer_order_id} · {s.destination_country}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.product_name}</div>
                      <div className="small muted">{s.product_id}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: s.carrier === 'DHL' ? '#EAB308' : s.carrier === 'BlueDart' ? '#2563EB' : s.carrier === 'Delhivery' ? '#DC2626' : '#059669',
                          }}
                        />
                        {s.carrier}
                      </div>
                      <div className="small muted">{s.vehicle_type_label}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {formatQty(s.shipment_qty)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: s.vehicle_utilization_pct >= 80 ? '#15803D' : s.vehicle_utilization_pct >= 60 ? '#D97706' : '#DC2626',
                        }}
                      >
                        {s.vehicle_utilization_pct}%
                      </span>
                    </td>
                    <td className="small muted">{s.dispatch_date}</td>
                    <td className="small">
                      <span style={{ color: s.is_delayed ? 'var(--red)' : 'inherit', fontWeight: s.is_delayed ? 700 : 400 }}>
                        {s.planned_eta}
                      </span>
                      {s.actual_delivery_date !== 'In Transit' && (
                        <div className="muted" style={{ fontSize: 10 }}>Delivered: {s.actual_delivery_date}</div>
                      )}
                    </td>
                    <td>
                      <span
                        className="pill"
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background:
                            s.shipment_status === 'DELIVERED'
                              ? '#DCFCE7'
                              : s.shipment_status === 'DELAYED'
                              ? '#FEE2E2'
                              : '#DBEAFE',
                          color:
                            s.shipment_status === 'DELIVERED'
                              ? '#15803D'
                              : s.shipment_status === 'DELAYED'
                              ? '#DC2626'
                              : '#1E40AF',
                        }}
                      >
                        {s.shipment_status}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background:
                            s.pod_status === 'RECEIVED'
                              ? '#ECFDF5'
                              : s.pod_status === 'EXCEPTION'
                              ? '#FEF2F2'
                              : '#F8FAFC',
                          color:
                            s.pod_status === 'RECEIVED'
                              ? '#047857'
                              : s.pod_status === 'EXCEPTION'
                              ? '#B91C1C'
                              : '#64748B',
                        }}
                      >
                        {s.pod_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Carrier SLA Scorecard */}
      {tab === 'carriers' && !isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {carriers.map((c) => (
            <div key={c.carrier} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background:
                        c.carrier === 'DHL'
                          ? '#EAB308'
                          : c.carrier === 'BlueDart'
                          ? '#2563EB'
                          : c.carrier === 'Delhivery'
                          ? '#DC2626'
                          : '#059669',
                    }}
                  />
                  {c.carrier}
                </h3>
                <span
                  className="pill"
                  style={{
                    background: c.on_time_pct >= 80 ? '#DCFCE7' : c.on_time_pct >= 60 ? '#FEF3C7' : '#FEE2E2',
                    color: c.on_time_pct >= 80 ? '#15803D' : c.on_time_pct >= 60 ? '#D97706' : '#DC2626',
                    fontWeight: 700,
                  }}
                >
                  {c.on_time_pct}% OTIF
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                  <div className="small muted">Total Shipments</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-purple)' }}>{c.shipments_count}</div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{c.delivered_count} delivered</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                  <div className="small muted">Delayed Deliveries</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.delayed_count > 0 ? '#DC2626' : '#15803D' }}>
                    {c.delayed_count}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{c.in_transit_count} in transit</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                  <div className="small muted">Dispatched Volume</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{formatQty(c.total_units)}</div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>Units loaded</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                  <div className="small muted">Avg Vehicle Fill</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0D9488' }}>{c.avg_utilization_pct}%</div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>Capacity factor</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="small muted">Total Freight Spend:</span>
                <span style={{ fontWeight: 700, color: 'var(--brand-purple)' }}>{formatInr(c.total_freight_inr)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Vehicle Modes & Stuffing */}
      {tab === 'modes' && !isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {modes.map((m) => (
            <div key={m.vehicle_type} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>{m.display_name}</h3>
                <span className="pill" style={{ background: '#F1F5F9', color: '#334155', fontWeight: 700 }}>
                  {m.vehicle_type}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                  <div className="small muted">Trips Dispatched</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-purple)' }}>{m.shipments_count}</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                  <div className="small muted">Payload Loaded</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{formatQty(m.total_units)}</div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                  <span className="muted">Average Container Stuffing:</span>
                  <span style={{ fontWeight: 700 }}>{m.avg_utilization_pct}%</span>
                </div>
                <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${m.avg_utilization_pct}%`,
                      background: m.avg_utilization_pct >= 80 ? '#15803D' : m.avg_utilization_pct >= 60 ? '#D97706' : '#2563EB',
                    }}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="small muted">Total Freight Cost:</span>
                <span style={{ fontWeight: 700 }}>{formatInr(m.total_freight_inr)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
