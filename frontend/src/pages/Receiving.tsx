import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { day, inr, qty } from '../format'
import { PageIcon } from '../icons'
import { useShell } from '../shell-context'

interface ReceiptItem {
  po_id: string
  po_line: number
  supplier_id: string
  supplier_name: string
  material_id: string
  material_name: string
  category: string
  plant_id: string
  uom: string
  po_date: string
  promised_date: string
  receipt_date: string
  ordered_qty: number
  received_qty: number
  fulfillment_pct: number
  unit_price_inr: number
  total_val_inr: number
  po_status: string
  incoterm: string
  lot_id: string
  on_time: boolean
  qc_status: string
  putaway_bin: string
}

interface ReceivingResponse {
  kpis: {
    total_receipts: number
    on_time_pct: number
    fulfillment_accuracy_pct: number
    discrepancies_count: number
    open_inbound_pos: number
    pending_qc_lots: number
  }
  records: ReceiptItem[]
  total_records: number
  page: number
  page_size: number
}

export function Receiving() {
  const { plant, openAgent } = useShell()
  const qc = useQueryClient()

  // Filters
  const [selectedPlant, setSelectedPlant] = useState<string>(plant || 'all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // New Receipt Form State
  const [formPo, setFormPo] = useState<string>('POC-000010')
  const [formMaterial, setFormMaterial] = useState<string>('MAT-PCB-004')
  const [formPlant, setFormPlant] = useState<string>('IN-KA-01')
  const [formQty, setFormQty] = useState<number>(1000)
  const [formCarrier, setFormCarrier] = useState<string>('BLR-EXP-9921')
  const [formDeliveryNote, setFormDeliveryNote] = useState<string>('DN-2026-8812')
  const [formQcRouting, setFormQcRouting] = useState<string>('auto_hold')

  // Fetch Data
  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouse-receiving', selectedPlant, selectedStatus, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedPlant && selectedPlant !== 'all') params.append('plant_id', selectedPlant)
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus)
      if (search) params.append('search', search)
      params.append('page_size', '80')

      const res = await api.get<ReceivingResponse>(`/api/warehouse/receiving?${params.toString()}`)
      return res.data
    },
    staleTime: 60_000,
  })

  const kpis = data?.kpis
  const records = data?.records ?? []

  const handleReceiveShipment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await api.post<{ success: boolean; message: string; receipt: ReceiptItem }>(
        '/api/warehouse/receiving/receive',
        {
          po_id: formPo,
          po_line: 1,
          material_id: formMaterial,
          plant_id: formPlant,
          received_qty: formQty,
          carrier_tracking: formCarrier,
          delivery_note: formDeliveryNote,
          qc_routing: formQcRouting,
        }
      )
      setToastMsg(`✓ ${res.data.message}`)
      setIsModalOpen(false)
      await qc.invalidateQueries()
    } catch (err) {
      setToastMsg(`Error recording delivery: ${String(err)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="page-head">
        <PageIcon name="box" />
        <div>
          <div className="crumb">Warehouse Operations › Goods Receiving &amp; Inbound Dock</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            Goods Receiving &amp; Dock Inbound Log
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            Real-time receipt reconciliation linking PO lines from <code>fact_purchase_order_receipt.csv</code> to warehouse lots, staging bays, and QC inspection gates.
          </p>
        </div>
        <span className="spacer" />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn primary"
            style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
              borderColor: '#4F46E5',
              fontWeight: 700,
            }}
            onClick={() => setIsModalOpen(true)}
          >
            + Receive Inbound Delivery
          </button>
          <button
            className="btn outline"
            onClick={() =>
              openAgent(
                'What open PO shipments are arriving today at IN-KA-01 and which items have partial delivery shortages?'
              )
            }
          >
            🤖 Ask Warehouse Copilot
          </button>
        </div>
      </div>

      {toastMsg && (
        <div
          className="banner info"
          style={{
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{toastMsg}</span>
          <button
            className="btn sm"
            style={{ padding: '2px 8px', fontSize: 11, background: '#fff' }}
            onClick={() => setToastMsg(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Dock KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #4F46E5', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 112 }}>
          <div className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
            TOTAL INBOUND RECEIPTS
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1E1B4B', marginTop: 4 }}>
            {kpis?.total_receipts?.toLocaleString('en-IN') ?? '1,300'} Orders
          </div>
          <div className="small muted" style={{ marginTop: 2, fontSize: 12 }}>
            Sourced across Bengaluru &amp; Chennai
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #10B981', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 112 }}>
          <div className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
            ON-TIME DOCK ARRIVAL (OTIF)
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#059669', marginTop: 4 }}>
            {kpis?.on_time_pct ?? 94.2}%
          </div>
          <div className="small muted" style={{ marginTop: 2, fontSize: 12 }}>
            Arrived on or before promised delivery date
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #F59E0B', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 112 }}>
          <div className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
            QUANTITY ACCURACY RATE
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
            {kpis?.fulfillment_accuracy_pct ?? 98.4}%
          </div>
          <div className="small muted" style={{ marginTop: 2, fontSize: 12 }}>
            {kpis?.discrepancies_count ?? 128} orders with short / partial supply
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #8B5CF6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 112 }}>
          <div className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
            INBOUND PIPELINE
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#6D28D9', marginTop: 4 }}>
            {kpis?.open_inbound_pos ?? 132} Open / Partial
          </div>
          <div className="small muted" style={{ marginTop: 2, fontSize: 12 }}>
            {kpis?.pending_qc_lots ?? 14} lots pending QC release
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
          <input
            placeholder="Search PO#, material code, supplier, or lot ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, minWidth: 200, maxWidth: 320, padding: '7px 12px' }}
          />
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            style={{ padding: '7px 10px', fontWeight: 600, flexShrink: 0 }}
          >
            <option value="all">All Receiving Plants</option>
            <option value="IN-KA-01">IN-KA-01 (Bengaluru Assembly)</option>
            <option value="IN-TN-01">IN-TN-01 (Chennai Facility)</option>
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ padding: '7px 10px', fontWeight: 600, flexShrink: 0 }}
          >
            <option value="all">All PO Statuses</option>
            <option value="CLOSED">Full Receipt (Closed)</option>
            <option value="PARTIAL">Partial Receipt (Under-delivery)</option>
            <option value="OPEN">Open (Awaiting Delivery)</option>
          </select>
        </div>

        <div className="small muted" style={{ fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Showing {records.length} of {data?.total_records ?? 1300} recorded receipts
        </div>
      </div>

      {/* Receipts Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }} className="muted">
            Loading goods receipts stream...
          </div>
        ) : error ? (
          <div style={{ padding: 30, color: 'var(--red)', textAlign: 'center' }}>
            Failed to load receipts data.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="dg compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>PO Reference</th>
                  <th>Receipt Date</th>
                  <th>Supplier / Vendor</th>
                  <th>Material &amp; Category</th>
                  <th>Plant</th>
                  <th className="num">Ordered Qty</th>
                  <th className="num">Received Qty</th>
                  <th>Fulfillment Status</th>
                  <th className="num">Value (INR)</th>
                  <th>Assigned Lot ID</th>
                  <th>QC Routing</th>
                  <th>Staging Bay</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={`${r.po_id}-${r.po_line}-${idx}`}>
                    <td>
                      <b>{r.po_id}</b>
                      <span className="muted small" style={{ marginLeft: 4 }}>
                        L{r.po_line}
                      </span>
                    </td>
                    <td>
                      <div>{day(r.receipt_date)}</div>
                      <div className="small muted" style={{ fontSize: 10 }}>
                        {r.on_time ? (
                          <span style={{ color: '#059669', fontWeight: 700 }}>✓ On Time</span>
                        ) : (
                          <span style={{ color: '#D97706', fontWeight: 700 }}>Late vs {day(r.promised_date)}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>{r.supplier_id}</div>
                      <div className="small muted" style={{ fontSize: 10.5 }}>
                        {r.supplier_name}
                      </div>
                    </td>
                    <td>
                      <b>{r.material_id}</b>
                      <div className="small muted" style={{ fontSize: 11 }}>
                        {r.material_name}
                      </div>
                    </td>
                    <td>{r.plant_id}</td>
                    <td className="num">{qty(r.ordered_qty, r.uom)}</td>
                    <td className="num">
                      <b>{qty(r.received_qty, r.uom)}</b>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background:
                              r.po_status === 'CLOSED'
                                ? '#ECFDF5'
                                : r.po_status === 'PARTIAL'
                                ? '#FFFBEB'
                                : '#F1F5F9',
                            color:
                              r.po_status === 'CLOSED'
                                ? '#059669'
                                : r.po_status === 'PARTIAL'
                                ? '#B45309'
                                : '#475569',
                          }}
                        >
                          {r.po_status === 'CLOSED'
                            ? '100% FULL'
                            : r.po_status === 'PARTIAL'
                            ? `${r.fulfillment_pct}% PARTIAL`
                            : 'OPEN'}
                        </span>
                      </div>
                    </td>
                    <td className="num">
                      <b>{inr(r.total_val_inr)}</b>
                    </td>
                    <td>
                      <code style={{ fontSize: 11, background: '#F1F5F9', padding: '2px 5px', borderRadius: 4 }}>
                        {r.lot_id}
                      </code>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: r.qc_status.includes('Passed') ? '#059669' : '#D97706',
                        }}
                      >
                        {r.qc_status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>
                        {r.putaway_bin}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inbound Delivery Receipt Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 540,
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                📦 Receive Inbound Dock Shipment
              </h2>
              <button
                className="btn sm outline"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '2px 8px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReceiveShipment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                  Purchase Order Reference
                </label>
                <input
                  value={formPo}
                  onChange={(e) => setFormPo(e.target.value)}
                  placeholder="e.g. POC-000010"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                    Material Received
                  </label>
                  <select
                    value={formMaterial}
                    onChange={(e) => setFormMaterial(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="MAT-PCB-004">MAT-PCB-004 · 6-layer Main PCB</option>
                    <option value="MAT-BAT-006">MAT-BAT-006 · 5000mAh Battery</option>
                    <option value="MAT-DSP-005">MAT-DSP-005 · AMOLED Display</option>
                    <option value="MAT-CAM-007">MAT-CAM-007 · Rear Camera</option>
                    <option value="MAT-WIRE-019">MAT-WIRE-019 · Solder Wire</option>
                    <option value="MAT-PASTE-017">MAT-PASTE-017 · Solder Paste</option>
                  </select>
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                    Receiving Plant
                  </label>
                  <select
                    value={formPlant}
                    onChange={(e) => setFormPlant(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="IN-KA-01">IN-KA-01 (Bengaluru)</option>
                    <option value="IN-TN-01">IN-TN-01 (Chennai)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                    Physical Received Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formQty}
                    onChange={(e) => setFormQty(Number(e.target.value))}
                    required
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                    Delivery Note / Invoice #
                  </label>
                  <input
                    value={formDeliveryNote}
                    onChange={(e) => setFormDeliveryNote(e.target.value)}
                    placeholder="DN-2026-001"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                    Carrier Tracking / Waybill
                  </label>
                  <input
                    value={formCarrier}
                    onChange={(e) => setFormCarrier(e.target.value)}
                    placeholder="EXP-99120"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                    QC Inspection Routing
                  </label>
                  <select
                    value={formQcRouting}
                    onChange={(e) => setFormQcRouting(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="auto_hold">Quarantine &amp; Hold for QC (#QA-Hold)</option>
                    <option value="auto_putaway">Direct Putaway to Warehouse Bin</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={isSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                    borderColor: '#4F46E5',
                    fontWeight: 700,
                  }}
                >
                  {isSubmitting ? 'Recording Receipt...' : 'Confirm Dock Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
