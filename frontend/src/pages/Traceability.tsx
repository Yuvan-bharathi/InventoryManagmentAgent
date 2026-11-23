import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, qs } from '../api'
import { useShell } from '../shell-context'

interface GenealogySummary {
  total_genealogy_events: number
  tracked_phone_serials: number
  active_component_lots: number
  production_orders: number
  traceability_completeness_pct: number
}

interface QueryMetadata {
  search_target: string
  mode: string
  material_id?: string
  material_name?: string
  category?: string
  supplier_id?: string
  supplier_name?: string
  total_impacted_units?: number
  plants_affected?: string[]
  shipped_count?: number
  in_factory_count?: number
  product_id?: string
  production_order_id?: string
  plant_id?: string
  total_components_traced?: number
  suppliers_involved?: string[]
  total_events?: number
  unique_serials?: number
}

interface GenealogyEvent {
  event_id: string
  event_ts: string
  plant_id: string
  serial_number: string
  production_order_id: string
  product_id: string
  material_id: string
  material_name: string
  material_lot_id: string
  supplier_name: string
  station_id: string
  operation_sequence: number
  event_type: string
  source_system: string
  genealogy_complete: boolean
}

interface ExampleChip {
  lot_id?: string
  material?: string
  serial_number?: string
  product?: string
  po_id?: string
  desc?: string
}

interface TraceabilityResponse {
  summary: GenealogySummary
  query: {
    type: string
    id: string
    metadata: QueryMetadata
  }
  results: GenealogyEvent[]
  examples: {
    lots: ExampleChip[]
    serials: ExampleChip[]
    orders: ExampleChip[]
  }
}

export function Traceability() {
  const { plant, openAgent } = useShell()
  const [queryType, setQueryType] = useState<'lot' | 'serial' | 'order'>('lot')
  const [searchId, setSearchId] = useState<string>('LOT-016-260911-4')
  const [activeQuery, setActiveQuery] = useState<{ type: string; id: string }>({
    type: 'lot',
    id: 'LOT-016-260911-4',
  })

  const { data, isLoading, error } = useQuery<{ data: TraceabilityResponse }>({
    queryKey: ['traceability-overview', plant, activeQuery.type, activeQuery.id],
    queryFn: () =>
      api.get<any>(
        '/api/traceability' +
          qs({
            plant_id: plant,
            query_type: activeQuery.type,
            query_id: activeQuery.id,
          }),
      ),
  })

  const traceData = data?.data
  const summary = traceData?.summary
  const metadata = traceData?.query?.metadata
  const events = traceData?.results ?? []
  const examples = traceData?.examples

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchId.trim()) return
    setActiveQuery({ type: queryType, id: searchId.trim() })
  }

  const handleSelectExample = (type: 'lot' | 'serial' | 'order', id: string) => {
    setQueryType(type)
    setSearchId(id)
    setActiveQuery({ type, id })
  }

  return (
    <div>
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="crumb">Warehouse › Component Genealogy &amp; Recall Analysis</div>
          <div className="row" style={{ gap: 8 }}>
            <h1>Batch Traceability &amp; Root-Cause Analysis</h1>
            <span className="pill" style={{ background: '#F3E8FF', color: '#7E22CE', fontWeight: 700 }}>
              MES GENEALOGY LINK
            </span>
          </div>
          <div className="muted">
            Two-way traceability between raw material supplier lots, production orders, factory assembly stations, and customer serial numbers.
          </div>
        </div>
        <span className="spacer" />
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn sm"
            onClick={() =>
              openAgent(
                `If supplier lot ${activeQuery.id} is defective, what is the complete recall blast radius across active phone serial numbers?`,
              )
            }
          >
            Ask: Recall Blast Radius?
          </button>
          <button
            className="btn sm"
            onClick={() =>
              openAgent(
                'Trace the backward bill of materials genealogy and component lots for phone serial SN260998972516.',
              )
            }
          >
            Ask: Serial Root Cause?
          </button>
          <button
            className="btn sm primary"
            onClick={() =>
              openAgent(
                'Which supplier lots were consumed in production order PO-000127 and were any quality hold defects detected?',
              )
            }
          >
            Ask: Production Order Genealogy?
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid g4" style={{ marginBottom: 18 }}>
          <div className="card kpi">
            <div className="label">Total Genealogy Events</div>
            <div className="value" style={{ color: 'var(--brand-purple)' }}>
              {summary.total_genealogy_events?.toLocaleString('en-IN') ?? '0'}
            </div>
            <div className="kpi-foot">Full MES operation audit log</div>
          </div>

          <div className="card kpi">
            <div className="label">Tracked Phone Serials</div>
            <div className="value" style={{ color: '#2563EB' }}>
              {summary.tracked_phone_serials?.toLocaleString('en-IN') ?? '0'}
            </div>
            <div className="kpi-foot">Individually serialized handsets</div>
          </div>

          <div className="card kpi">
            <div className="label">Active Component Lots</div>
            <div className="value" style={{ color: '#0D9488' }}>
              {summary.active_component_lots?.toLocaleString('en-IN') ?? '0'}
            </div>
            <div className="kpi-foot">{summary.production_orders} production orders indexed</div>
          </div>

          <div className="card kpi">
            <div className="label">Genealogy Completeness</div>
            <div className="value" style={{ color: '#15803D' }}>
              {summary.traceability_completeness_pct}%
            </div>
            <div className="kpi-foot">100% verified parent-child linkage</div>
          </div>
        </div>
      )}

      {/* Search & Mode Bar */}
      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Traceability Direction:</span>
          <div className="segmented" style={{ display: 'inline-flex', background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => {
                setQueryType('lot')
                setSearchId('LOT-016-260911-4')
              }}
              className={queryType === 'lot' ? 'btn sm primary' : 'btn sm'}
              style={{ borderRadius: 6, fontSize: 12, fontWeight: 600 }}
            >
              Forward Trace (by Supplier Lot ID)
            </button>
            <button
              type="button"
              onClick={() => {
                setQueryType('serial')
                setSearchId('SN260998972516')
              }}
              className={queryType === 'serial' ? 'btn sm primary' : 'btn sm'}
              style={{ borderRadius: 6, fontSize: 12, fontWeight: 600 }}
            >
              Backward Trace (by Phone Serial / IMEI)
            </button>
            <button
              type="button"
              onClick={() => {
                setQueryType('order')
                setSearchId('PO-000127')
              }}
              className={queryType === 'order' ? 'btn sm primary' : 'btn sm'}
              style={{ borderRadius: 6, fontSize: 12, fontWeight: 600 }}
            >
              Batch Trace (by Production Order)
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', position: 'relative' }}>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder={
                queryType === 'lot'
                  ? 'Enter Material Lot ID (e.g. LOT-016-260911-4)...'
                  : queryType === 'serial'
                  ? 'Enter Phone Serial / IMEI (e.g. SN260998972516)...'
                  : 'Enter Production Order ID (e.g. PO-000127)...'
              }
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '2px solid var(--border)',
                fontSize: 14,
                fontFamily: 'monospace',
                fontWeight: 600,
              }}
            />
          </div>
          <button type="submit" className="btn primary" style={{ padding: '10px 20px', fontWeight: 700 }}>
            🔍 Trace &amp; Analyze Lineage
          </button>
        </form>

        {/* Quick Example Chips */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="small muted">Quick Examples:</span>
          {queryType === 'lot' &&
            examples?.lots?.map((ex) => (
              <button
                key={ex.lot_id}
                type="button"
                onClick={() => ex.lot_id && handleSelectExample('lot', ex.lot_id)}
                className="pill"
                style={{
                  cursor: 'pointer',
                  background: activeQuery.id === ex.lot_id ? '#EFF6FF' : '#F8FAFC',
                  color: activeQuery.id === ex.lot_id ? '#1D4ED8' : '#475569',
                  border: activeQuery.id === ex.lot_id ? '1px solid #93C5FD' : '1px solid #E2E8F0',
                  fontWeight: 600,
                }}
              >
                {ex.lot_id} ({ex.material?.split('(')[0].trim()})
              </button>
            ))}

          {queryType === 'serial' &&
            examples?.serials?.map((ex) => (
              <button
                key={ex.serial_number}
                type="button"
                onClick={() => ex.serial_number && handleSelectExample('serial', ex.serial_number)}
                className="pill"
                style={{
                  cursor: 'pointer',
                  background: activeQuery.id === ex.serial_number ? '#EFF6FF' : '#F8FAFC',
                  color: activeQuery.id === ex.serial_number ? '#1D4ED8' : '#475569',
                  border: activeQuery.id === ex.serial_number ? '1px solid #93C5FD' : '1px solid #E2E8F0',
                  fontWeight: 600,
                }}
              >
                {ex.serial_number} ({ex.product})
              </button>
            ))}

          {queryType === 'order' &&
            examples?.orders?.map((ex) => (
              <button
                key={ex.po_id}
                type="button"
                onClick={() => ex.po_id && handleSelectExample('order', ex.po_id)}
                className="pill"
                style={{
                  cursor: 'pointer',
                  background: activeQuery.id === ex.po_id ? '#EFF6FF' : '#F8FAFC',
                  color: activeQuery.id === ex.po_id ? '#1D4ED8' : '#475569',
                  border: activeQuery.id === ex.po_id ? '1px solid #93C5FD' : '1px solid #E2E8F0',
                  fontWeight: 600,
                }}
              >
                {ex.po_id}
              </button>
            ))}
        </div>
      </div>

      {isLoading && <div className="muted" style={{ padding: 24, textAlign: 'center' }}>Tracing component genealogy tree...</div>}
      {error && <div className="card error" style={{ padding: 16, color: 'var(--red)' }}>Failed to load traceability data.</div>}

      {/* Query Target Detail Card */}
      {metadata && !isLoading && (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 18,
            borderLeft: `4px solid ${metadata.mode === 'FORWARD_RECALL_TRACE' ? '#D97706' : '#2563EB'}`,
            background: metadata.mode === 'FORWARD_RECALL_TRACE' ? '#FFFBEB' : '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span
                  className="pill"
                  style={{
                    background: metadata.mode === 'FORWARD_RECALL_TRACE' ? '#FEF3C7' : '#DBEAFE',
                    color: metadata.mode === 'FORWARD_RECALL_TRACE' ? '#92400E' : '#1E40AF',
                    fontWeight: 800,
                  }}
                >
                  {metadata.mode}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>
                  {metadata.search_target}
                </span>
              </div>

              {metadata.mode === 'FORWARD_RECALL_TRACE' && (
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                  <strong>{metadata.material_name}</strong> ({metadata.material_id}) · Category: {metadata.category}
                  <br />
                  Supplier: <strong>{metadata.supplier_name}</strong> ({metadata.supplier_id})
                </div>
              )}

              {metadata.mode === 'BACKWARD_ROOT_CAUSE_TRACE' && (
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                  Phone Model: <strong>{metadata.product_id}</strong> · Manufacturing Order:{' '}
                  <strong>{metadata.production_order_id}</strong> · Factory: {metadata.plant_id}
                </div>
              )}

              {metadata.mode === 'PRODUCTION_ORDER_BATCH_TRACE' && (
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                  Production Order: <strong>{metadata.production_order_id}</strong> · Product Target:{' '}
                  <strong>{metadata.product_id}</strong> · Plant: {metadata.plant_id}
                </div>
              )}
            </div>

            {/* Impact / Recall Stats */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {metadata.mode === 'FORWARD_RECALL_TRACE' && (
                <>
                  <div style={{ background: '#FFFFFF', padding: '8px 14px', borderRadius: 8, border: '1px solid #FCD34D' }}>
                    <div className="small muted">Impacted Handsets</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#B45309' }}>
                      {metadata.total_impacted_units}
                    </div>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div className="small muted">Shipped to Customers</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: metadata.shipped_count ? '#DC2626' : '#15803D' }}>
                      {metadata.shipped_count}
                    </div>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div className="small muted">In-Factory Quarantine</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#2563EB' }}>
                      {metadata.in_factory_count}
                    </div>
                  </div>
                </>
              )}

              {metadata.mode === 'BACKWARD_ROOT_CAUSE_TRACE' && (
                <div style={{ background: '#FFFFFF', padding: '8px 14px', borderRadius: 8, border: '1px solid #BFDBFE' }}>
                  <div className="small muted">Components Traced</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1E40AF' }}>
                    {metadata.total_components_traced} parts
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Genealogy Events Lineage Table */}
      {!isLoading && events.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>
              Genealogy Audit Events ({events.length})
            </h3>
            <span className="small muted">Sequenced by Manufacturing Routing &amp; Station</span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Seq</th>
                  <th>Event ID &amp; Time</th>
                  <th>Phone Serial Number</th>
                  <th>Component Material</th>
                  <th>Material Lot ID</th>
                  <th>Supplier</th>
                  <th>Station</th>
                  <th>Event Type</th>
                  <th>MES Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, idx) => (
                  <tr key={ev.event_id || idx}>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 24,
                          height: 24,
                          lineHeight: '24px',
                          textAlign: 'center',
                          borderRadius: '50%',
                          background: '#F1F5F9',
                          fontWeight: 700,
                          fontSize: 11,
                          color: '#475569',
                        }}
                      >
                        {ev.operation_sequence || idx + 1}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{ev.event_id}</div>
                      <div className="small muted">{ev.event_ts}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--brand-purple)' }}>
                        {ev.serial_number}
                      </div>
                      <div className="small muted">{ev.product_id} · {ev.production_order_id}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{ev.material_name}</div>
                      <div className="small muted">{ev.material_id}</div>
                    </td>
                    <td>
                      <span
                        className="pill"
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          background: activeQuery.id === ev.material_lot_id ? '#FEF3C7' : '#F1F5F9',
                          color: activeQuery.id === ev.material_lot_id ? '#92400E' : '#334155',
                        }}
                      >
                        {ev.material_lot_id}
                      </span>
                    </td>
                    <td className="small">{ev.supplier_name}</td>
                    <td>
                      <span className="small" style={{ fontWeight: 600, color: '#0369A1' }}>
                        {ev.station_id}
                      </span>
                      <div className="small muted">{ev.plant_id}</div>
                    </td>
                    <td>
                      <span
                        className="pill"
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background:
                            ev.event_type === 'SHIP'
                              ? '#DCFCE7'
                              : ev.event_type === 'REWORK'
                              ? '#FEE2E2'
                              : ev.event_type === 'INSPECTION'
                              ? '#FEF3C7'
                              : '#E0F2FE',
                          color:
                            ev.event_type === 'SHIP'
                              ? '#15803D'
                              : ev.event_type === 'REWORK'
                              ? '#DC2626'
                              : ev.event_type === 'INSPECTION'
                              ? '#D97706'
                              : '#0284C7',
                        }}
                      >
                        {ev.event_type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>
                        ✓ {ev.source_system} Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
