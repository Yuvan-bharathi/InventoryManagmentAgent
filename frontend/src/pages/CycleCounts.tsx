import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { day, inr, qty } from '../format'
import { PageIcon } from '../icons'
import { useShell } from '../shell-context'

interface CycleCountItem {
  count_id: string
  count_date: string
  plant_id: string
  material_id: string
  material_name: string
  category: string
  uom: string
  system_qty: number
  counted_qty: number
  variance_qty: number
  variance_pct: number
  variance_inr: number
  status: string
  abc_class: string
  bin_location: string
  auditor: string
  notes?: string
}

interface CycleCountsResponse {
  kpis: {
    ira_accuracy_pct: number
    total_audits_performed: number
    high_discrepancies_count: number
    net_variance_inr: number
    scheduled_this_week: number
    reconciled_pct: number
  }
  records: CycleCountItem[]
  total_records: number
  page: number
  page_size: number
}

export function CycleCounts() {
  const { plant, openAgent } = useShell()
  const qc = useQueryClient()

  // Filters
  const [selectedPlant, setSelectedPlant] = useState<string>(plant || 'all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // New Count Form State
  const [formPlant, setFormPlant] = useState<string>('IN-KA-01')
  const [formMaterial, setFormMaterial] = useState<string>('MAT-PCB-004')
  const [formCountedQty, setFormCountedQty] = useState<number>(14130)
  const [formBin, setFormBin] = useState<string>('A-04-RACK-02')
  const [formNotes, setFormNotes] = useState<string>('Routine weekly audit. Blind double-count verified.')

  // Fetch Data
  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouse-cycle-counts', selectedPlant, selectedStatus, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedPlant && selectedPlant !== 'all') params.append('plant_id', selectedPlant)
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus)
      if (search) params.append('search', search)
      params.append('page_size', '60')

      const res = await api.get<CycleCountsResponse>(`/api/warehouse/cycle-counts?${params.toString()}`)
      return res.data
    },
    staleTime: 60_000,
  })

  const kpis = data?.kpis
  const records = data?.records ?? []

  const handleRecordCount = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await api.post<{ success: boolean; message: string; count: CycleCountItem }>(
        '/api/warehouse/cycle-counts/record',
        {
          plant_id: formPlant,
          material_id: formMaterial,
          counted_qty: formCountedQty,
          bin_location: formBin,
          auditor_notes: formNotes,
        }
      )
      setToastMsg(`✓ ${res.data.message}`)
      setIsModalOpen(false)
      await qc.invalidateQueries()
    } catch (err) {
      setToastMsg(`Error recording count: ${String(err)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="page-head">
        <PageIcon name="repeat" />
        <div>
          <div className="crumb">Warehouse Operations › Cycle Counts &amp; Physical Audits</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            Cycle Counts &amp; Inventory Record Accuracy (IRA)
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            Blind physical counting, variance reconciliation, and ABC velocity scheduling sourced from <code>fact_cycle_count.csv</code>.
          </p>
        </div>
        <span className="spacer" />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn primary"
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              borderColor: '#059669',
              fontWeight: 700,
            }}
            onClick={() => setIsModalOpen(true)}
          >
            + Record Physical Count
          </button>
          <button
            className="btn outline"
            onClick={() =>
              openAgent(
                'What is our current Inventory Record Accuracy (IRA) and which material bins have recurring physical count discrepancies?'
              )
            }
          >
            🤖 Consult Audit Agent
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

      {/* Top IRA KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #10B981', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 112 }}>
          <div className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
            RECORD ACCURACY (IRA)
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#059669', marginTop: 4 }}>
            {kpis?.ira_accuracy_pct ?? 98.6}% Match
          </div>
          <div className="small muted" style={{ marginTop: 2, fontSize: 12 }}>
            Within ±1.0% allowable tolerance threshold
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #4F46E5', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 112 }}>
          <div className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
            AUDITS PERFORMED
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1E1B4B', marginTop: 4 }}>
            {kpis?.total_audits_performed ?? 474} Audits
          </div>
          <div className="small muted" style={{ marginTop: 2, fontSize: 12 }}>
            Conducted by Stores &amp; Internal Audit
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #F59E0B', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 112 }}>
          <div className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
            HIGH VARIANCE ALERTS
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
            {kpis?.high_discrepancies_count ?? 12} Bins
          </div>
          <div className="small muted" style={{ marginTop: 2, fontSize: 12 }}>
            Discrepancies &gt; 2% requiring recount sign-off
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #8B5CF6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 112 }}>
          <div className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
            NET DISCREPANCY IMPACT
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#6D28D9', marginTop: 4 }}>
            {inr(kpis?.net_variance_inr ?? 142500)}
          </div>
          <div className="small muted" style={{ marginTop: 2, fontSize: 12 }}>
            {kpis?.reconciled_pct ?? 99.1}% reconciled to ledger
          </div>
        </div>
      </div>

      {/* ABC Velocity Schedule Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
          borderRadius: 10,
          padding: '14px 18px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: 6 }}>
          📅 ABC Inventory Velocity Cycle Scheduling Policy
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <b style={{ color: '#059669', fontSize: 13 }}>Class A · High Value &amp; Bottlenecks</b>
            <div className="small muted" style={{ marginTop: 2 }}>
              6-layer PCBs, SoCs, AMOLED Displays · <b>Weekly Cycle (100% Blind Audit)</b>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <b style={{ color: '#4F46E5', fontSize: 13 }}>Class B · Semi-Critical Assemblies</b>
            <div className="small muted" style={{ marginTop: 2 }}>
              Camera Modules, 5000mAh Batteries, Memory ICs · <b>Bi-Weekly Cycle</b>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <b style={{ color: '#64748B', fontSize: 13 }}>Class C · Bulk Hardware &amp; Adhesives</b>
            <div className="small muted" style={{ marginTop: 2 }}>
              Solder Wire, Adhesives, Screw Sets, Packaging · <b>Monthly Sampling</b>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
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
            placeholder="Search material code, plant, bin, or count ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, minWidth: 200, maxWidth: 320, padding: '7px 12px' }}
          />
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            style={{ padding: '7px 10px', fontWeight: 600, flexShrink: 0 }}
          >
            <option value="all">All Audited Plants</option>
            <option value="IN-KA-01">IN-KA-01 (Bengaluru Facility)</option>
            <option value="IN-TN-01">IN-TN-01 (Chennai Facility)</option>
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ padding: '7px 10px', fontWeight: 600, flexShrink: 0 }}
          >
            <option value="all">All Audit Statuses</option>
            <option value="ACCURATE">Accurate Matches (Within ±1%)</option>
            <option value="DISCREPANCY">Discrepant Records (&gt;1% Variance)</option>
          </select>
        </div>

        <div className="small muted" style={{ fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Showing {records.length} of {data?.total_records ?? 474} audit count logs
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }} className="muted">
            Loading physical count records...
          </div>
        ) : error ? (
          <div style={{ padding: 30, color: 'var(--red)', textAlign: 'center' }}>
            Failed to load cycle count logs.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="dg compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Audit Reference</th>
                  <th>Count Date</th>
                  <th>Plant &amp; Bin</th>
                  <th>Material Code &amp; Name</th>
                  <th>ABC Tier</th>
                  <th className="num">System Qty</th>
                  <th className="num">Counted Qty</th>
                  <th className="num">Variance (Units)</th>
                  <th className="num">Variance (%)</th>
                  <th className="num">Impact (INR)</th>
                  <th>Audit Result Status</th>
                  <th>Auditor</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => {
                  const isMatch = Math.abs(r.variance_pct) <= 1.0
                  const isHighVar = Math.abs(r.variance_pct) > 2.0

                  return (
                    <tr key={`${r.count_id}-${idx}`}>
                      <td>
                        <b>{r.count_id}</b>
                      </td>
                      <td>{day(r.count_date)}</td>
                      <td>
                        <b>{r.plant_id}</b>
                        <div className="small muted" style={{ fontSize: 10.5 }}>
                          {r.bin_location}
                        </div>
                      </td>
                      <td>
                        <b>{r.material_id}</b>
                        <div className="small muted" style={{ fontSize: 11 }}>
                          {r.material_name}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: r.abc_class.includes('Class A')
                              ? '#ECFDF5'
                              : r.abc_class.includes('Class B')
                              ? '#EEF2FF'
                              : '#F1F5F9',
                            color: r.abc_class.includes('Class A')
                              ? '#065F46'
                              : r.abc_class.includes('Class B')
                              ? '#3730A3'
                              : '#475569',
                            fontWeight: 700,
                          }}
                        >
                          {r.abc_class.split('·')[0].trim()}
                        </span>
                      </td>
                      <td className="num">{qty(r.system_qty, r.uom)}</td>
                      <td className="num">
                        <b>{qty(r.counted_qty, r.uom)}</b>
                      </td>
                      <td
                        className="num"
                        style={{
                          fontWeight: 700,
                          color: isMatch ? '#059669' : isHighVar ? '#DC2626' : '#D97706',
                        }}
                      >
                        {r.variance_qty > 0 ? `+${r.variance_qty}` : r.variance_qty} {r.uom}
                      </td>
                      <td
                        className="num"
                        style={{
                          fontWeight: 700,
                          color: isMatch ? '#059669' : isHighVar ? '#DC2626' : '#D97706',
                        }}
                      >
                        {r.variance_pct > 0 ? `+${r.variance_pct}%` : `${r.variance_pct}%`}
                      </td>
                      <td className="num">
                        <b>{inr(r.variance_inr)}</b>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: isMatch ? '#059669' : isHighVar ? '#DC2626' : '#D97706',
                          }}
                        >
                          {isMatch ? '✓ Verified Accurate' : isHighVar ? '⚠️ High Discrepancy' : 'Minor Variance'}
                        </span>
                      </td>
                      <td className="small muted">{r.auditor}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Physical Count Modal */}
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
              maxWidth: 520,
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                📋 Record Physical Cycle Count
              </h2>
              <button
                className="btn sm outline"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '2px 8px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordCount} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                    Material Audited
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
                    Warehouse Facility
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
                    Physical Counted Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formCountedQty}
                    onChange={(e) => setFormCountedQty(Number(e.target.value))}
                    required
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                    Bin / Mezzanine Location
                  </label>
                  <input
                    value={formBin}
                    onChange={(e) => setFormBin(e.target.value)}
                    placeholder="A-04-RACK-02"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                  Auditor Notes &amp; Verification Remarks
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Routine blind count performed. Dual-check confirmed."
                  style={{ width: '100%', padding: '8px 10px' }}
                />
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
                    background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                    borderColor: '#059669',
                    fontWeight: 700,
                  }}
                >
                  {isSubmitting ? 'Recording Audit...' : 'Submit Physical Count'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
