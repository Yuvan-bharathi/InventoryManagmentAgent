import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, qs } from '../api'
import { Icon } from '../icons'
import { useShell } from '../shell-context'

interface ShortageItem {
  material_id: string
  material_name: string
  category: string
  plant_id: string
  usable_stock: number
  required_qty: number
  shortage_qty: number
  safety_stock: number
  stockout_days: number
  urgency: string
  standard_cost_inr: number
}

interface SupplierSubScores {
  price: number
  lead_time: number
  otif: number
  quality: number
  moq: number
}

interface SupplierOption {
  supplier_id: string
  supplier_name: string
  country: string
  unit_price_inr: number
  landed_unit_price_inr: number
  order_qty: number
  total_material_cost_inr: number
  total_landed_cost_inr: number
  lead_time_days: number
  moq: number
  on_time_rate_pct: number
  quality_acceptance_pct: number
  payment_terms: string
  incoterm: string
  historical_avg_price: number
  historical_min_price: number
  historical_orders_count: number
  price_trend: string
  technical_compliance: string
  approved_status: string
  sub_scores: SupplierSubScores
  recommendation_score: number
  rank: number
  is_recommended: boolean
}

interface QuoteCompareResponse {
  material_id: string
  material_name: string
  category: string
  required_qty: number
  plant_id: string
  standard_cost_inr: number
  recommendation_rationale: string
  recommended_supplier: SupplierOption
  suppliers: SupplierOption[]
}

interface DraftPO {
  proposal_id?: number
  draft_id: string
  material_id: string
  material_name: string
  supplier_id: string
  supplier_name: string
  order_qty: number
  unit_price_inr: number
  total_value_inr: number
  plant_id: string
  need_by_date: string
  payment_terms: string
  incoterm: string
  approval_level: string
  status: string
  created_date: string
}

interface ProcurementOverviewResponse {
  kpis: {
    active_shortages_count: number
    critical_shortages_count: number
    draft_pos_count: number
    pending_approvals_count: number
    total_draft_value_inr: number
    high_delivery_risks_count: number
    potential_cost_savings_inr: number
  }
  draft_pos: DraftPO[]
  active_shortages: ShortageItem[]
}

export function Procurement() {
  const { plant, openAgent } = useShell()
  const qc = useQueryClient()

  const [selectedMaterial, setSelectedMaterial] = useState<string>('MAT-CAM-007')
  const [requiredQty, setRequiredQty] = useState<number>(20)
  const [sortBy, setSortBy] = useState<'score' | 'price_low' | 'price_high' | 'lead_time'>('score')
  const [activeDraftModal, setActiveDraftModal] = useState<SupplierOption | null>(null)
  const [poCreatedSuccess, setPoCreatedSuccess] = useState<string | null>(null)

  // Editable Draft PO state
  const [modalQty, setModalQty] = useState<number>(20)
  const [modalPrice, setModalPrice] = useState<number>(684)
  const [modalNeedBy, setModalNeedBy] = useState<string>('2026-11-25')
  const [modalTerms, setModalTerms] = useState<string>('NET 45')
  const [modalIncoterm, setModalIncoterm] = useState<string>('FOB')
  const [modalNotes, setModalNotes] = useState<string>('')
  const [isSubmittingPo, setIsSubmittingPo] = useState<boolean>(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [createdPoResult, setCreatedPoResult] = useState<{ id: number; proposal_no: string } | null>(null)

  // Manual PO Requisition State
  const [sp] = useSearchParams()
  const [isManualPoOpen, setIsManualPoOpen] = useState<boolean>(false)
  const [manualStep, setManualStep] = useState<1 | 2 | 3>(1)
  const [manualMaterial, setManualMaterial] = useState<string>('MAT-BAT-006')
  const [manualPlant, setManualPlant] = useState<string>('IN-TN-01')
  const [manualQty, setManualQty] = useState<number>(100)
  const [manualNeedBy, setManualNeedBy] = useState<string>('2026-12-05')
  const [manualNotes, setManualNotes] = useState<string>('Manual procurement requisition for buffer inventory')
  const [isManualAiLoading, setIsManualAiLoading] = useState<boolean>(false)
  const [manualCompare, setManualCompare] = useState<QuoteCompareResponse | null>(null)
  const [manualSupplier, setManualSupplier] = useState<SupplierOption | null>(null)
  const [manualAgreedPrice, setManualAgreedPrice] = useState<number>(345)
  const [manualIncoterm, setManualIncoterm] = useState<string>('FOB')
  const [manualTerms, setManualTerms] = useState<string>('NET 45')
  const [manualError, setManualError] = useState<string | null>(null)
  const [isSubmittingManual, setIsSubmittingManual] = useState<boolean>(false)

  // Load catalog materials for manual creation
  const { data: materialsData } = useQuery<{ data: Array<{ material_id: string; material_name: string; category: string; uom: string; standard_cost_inr: number }> }>({
    queryKey: ['procurement-materials'],
    queryFn: () => api.get<any>('/api/procurement/materials'),
  })

  useEffect(() => {
    if (sp.get('action') === 'manual') {
      setIsManualPoOpen(true)
      setManualStep(1)
    }
  }, [sp])

  // 1. Load Overview KPIs and Shortages
  const { data: overviewData } = useQuery<{ data: ProcurementOverviewResponse }>({
    queryKey: ['procurement-overview', plant],
    queryFn: () => api.get<any>('/api/procurement/overview' + qs({ plant_id: plant })),
  })

  // 2. Load Quote Comparison for selected material
  const { data: compareData, isLoading: isCompareLoading } = useQuery<{ data: QuoteCompareResponse }>({
    queryKey: ['procurement-compare', selectedMaterial, requiredQty, plant],
    queryFn: () =>
      api.get<any>(
        '/api/procurement/compare' +
          qs({
            material_id: selectedMaterial,
            required_qty: requiredQty,
            plant_id: plant,
          }),
      ),
  })

  const rawOverview = overviewData as any
  const overview: ProcurementOverviewResponse | undefined = rawOverview?.data?.kpis ? rawOverview.data : rawOverview?.kpis ? rawOverview : rawOverview?.data

  const rawCompare = compareData as any
  const compare: QuoteCompareResponse | undefined = rawCompare?.data?.suppliers ? rawCompare.data : rawCompare?.suppliers ? rawCompare : rawCompare?.data

  const shortages = overview?.active_shortages ?? []
  const kpis = overview?.kpis
  const draftPos = overview?.draft_pos ?? []

  // Suppliers sorted according to user selection
  const suppliers = [...(compare?.suppliers ?? [])].sort((a, b) => {
    if (sortBy === 'score') return b.recommendation_score - a.recommendation_score
    if (sortBy === 'price_low') return a.total_landed_cost_inr - b.total_landed_cost_inr
    if (sortBy === 'price_high') return b.total_landed_cost_inr - a.total_landed_cost_inr
    if (sortBy === 'lead_time') return a.lead_time_days - b.lead_time_days
    return 0
  })

  const handleSelectShortage = (item: ShortageItem) => {
    setSelectedMaterial(item.material_id)
    setRequiredQty(item.shortage_qty)
    setPoCreatedSuccess(null)
  }

  const handleCreatePo = (supp: SupplierOption) => {
    setActiveDraftModal(supp)
    setModalQty(supp.order_qty || requiredQty || 20)
    setModalPrice(supp.unit_price_inr || 684)
    setModalNeedBy('2026-11-25')
    setModalTerms(supp.payment_terms || 'NET 45')
    setModalIncoterm(supp.incoterm || 'FOB')
    setModalNotes(`Procurement PO initiated for line shortage in ${plant || 'IN-TN-01'}`)
    setCreatedPoResult(null)
    setModalError(null)
  }

  const handleConfirmPo = async () => {
    if (!activeDraftModal) return
    setIsSubmittingPo(true)
    setModalError(null)
    try {
      const res = await api.raw<{ ok: boolean; proposal_id: number; proposal_no: string; message: string }>(
        'POST',
        '/api/procurement/draft-po',
        {
          material_id: selectedMaterial,
          supplier_id: activeDraftModal.supplier_id,
          order_qty: Number(modalQty),
          unit_price_inr: Number(modalPrice),
          plant_id: plant || 'IN-TN-01',
          need_by_date: modalNeedBy,
          incoterm: modalIncoterm,
          payment_terms: modalTerms,
          notes: modalNotes,
          route_to_approval: true,
        }
      )
      setCreatedPoResult({ id: res.proposal_id, proposal_no: res.proposal_no })
      setPoCreatedSuccess(
        `Draft PO ${res.proposal_no} generated successfully for ${activeDraftModal.supplier_name} (${modalQty} units @ ₹${Number(modalPrice).toLocaleString('en-IN')}) and routed to the approval queue!`
      )
      setActiveDraftModal(null)
      qc.invalidateQueries({ queryKey: ['procurement-overview'] })
      qc.invalidateQueries({ queryKey: ['proposals'] })
    } catch (err: any) {
      setModalError(err?.message || String(err))
    } finally {
      setIsSubmittingPo(false)
    }
  }

  const handleOpenManualPo = () => {
    setIsManualPoOpen(true)
    setManualStep(1)
    setManualError(null)
    setManualCompare(null)
    setManualSupplier(null)
  }

  const handleSelectManualMaterial = (mId: string) => {
    setManualMaterial(mId)
    const m = materialsData?.data?.find((x) => x.material_id === mId)
    if (m?.standard_cost_inr) {
      setManualAgreedPrice(m.standard_cost_inr)
    }
  }

  const handleTriggerManualAi = async () => {
    setIsManualAiLoading(true)
    setManualError(null)
    try {
      const res = await api.get<any>(
        '/api/procurement/compare' +
          qs({
            material_id: manualMaterial,
            required_qty: manualQty,
            plant_id: manualPlant,
          })
      )
      const compareObj: QuoteCompareResponse = (res as any)?.data?.suppliers ? (res as any).data : ((res as any)?.data || res)
      setManualCompare(compareObj)
      const best = compareObj.recommended_supplier || compareObj.suppliers?.[0]
      setManualSupplier(best)
      if (best) {
        setManualAgreedPrice(best.unit_price_inr)
        setManualIncoterm(best.incoterm || 'FOB')
        setManualTerms(best.payment_terms || 'NET 45')
      }
      setManualStep(2)
    } catch (err: any) {
      setManualError('Failed to analyze suppliers: ' + (err?.message || err))
    } finally {
      setIsManualAiLoading(false)
    }
  }

  const handleSelectManualSupplier = (supp: SupplierOption) => {
    setManualSupplier(supp)
    setManualAgreedPrice(supp.unit_price_inr)
    setManualIncoterm(supp.incoterm || 'FOB')
    setManualTerms(supp.payment_terms || 'NET 45')
  }

  const handleConfirmManualPo = async () => {
    if (!manualSupplier) return
    setIsSubmittingManual(true)
    setManualError(null)
    try {
      const res = await api.raw<{ ok: boolean; proposal_id: number; proposal_no: string; message: string }>(
        'POST',
        '/api/procurement/draft-po',
        {
          material_id: manualMaterial,
          supplier_id: manualSupplier.supplier_id,
          order_qty: Number(manualQty),
          unit_price_inr: Number(manualAgreedPrice),
          plant_id: manualPlant,
          need_by_date: manualNeedBy,
          incoterm: manualIncoterm,
          payment_terms: manualTerms,
          notes: manualNotes,
          route_to_approval: true,
          created_via: 'manual_procurement',
        }
      )
      setCreatedPoResult({ id: res.proposal_id, proposal_no: res.proposal_no })
      setPoCreatedSuccess(
        `Manual PO ${res.proposal_no} generated successfully for ${manualSupplier.supplier_name} (${manualQty} units @ ₹${Number(manualAgreedPrice).toLocaleString('en-IN')}) and routed to the approval queue!`
      )
      setIsManualPoOpen(false)
      setManualStep(1)
      qc.invalidateQueries({ queryKey: ['procurement-overview'] })
      qc.invalidateQueries({ queryKey: ['proposals'] })
    } catch (err: any) {
      setManualError(err?.message || String(err))
    } finally {
      setIsSubmittingManual(false)
    }
  }

  const formatInr = (val?: number) => {
    if (val === undefined || val === null) return '₹0'
    return '₹' + Number(val).toLocaleString('en-IN')
  }

  return (
    <div>
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="crumb">Act › Supplier Intelligence &amp; Smart Procurement</div>
          <div className="row" style={{ gap: 8 }}>
            <h1>Smart Procurement &amp; Quote Comparison</h1>
            <span className="pill" style={{ background: '#DCFCE7', color: '#15803D', fontWeight: 700 }}>
              BEST-VALUE SELECTION
            </span>
          </div>
          <div className="muted">
            Evaluating multi-attribute quotations across approved suppliers based on landed price, delivery speed, historical OTIF, and material quality.
          </div>
        </div>
        <span className="spacer" />
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn sm"
            onClick={() => openAgent(`Which supplier offers the lowest price for ${selectedMaterial}?`)}
          >
            Ask: Lowest Price?
          </button>
          <button
            className="btn sm"
            onClick={() => openAgent(`Which supplier offers the best overall value for ${selectedMaterial}?`)}
          >
            Ask: Best Value Supplier?
          </button>
          <button
            className="btn sm primary"
            onClick={() => openAgent(`Which supplier has the highest on-time delivery reliability?`)}
          >
            Ask: Delivery Reliability?
          </button>
          <button
            className="btn primary"
            onClick={handleOpenManualPo}
            style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
              borderColor: '#4F46E5',
              fontWeight: 700,
              padding: '6px 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
            }}
          >
            <span>+ Create Manual PO</span>
          </button>
        </div>
      </div>

      {/* Floating Toast Notification for Created Draft PO */}
      {poCreatedSuccess && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 24,
            right: 28,
            zIndex: 99999,
            maxWidth: 520,
            width: 'calc(100vw - 56px)',
            background: '#FFFFFF',
            border: '2px solid #10B981',
            borderRadius: 12,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#D1FAE5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="check" size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#065F46', marginBottom: 3 }}>
                Draft Purchase Order Generated!
              </div>
              <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.45, fontWeight: 500 }}>
                {poCreatedSuccess}
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                Registered in system and routed to Purchasing Review queue.
              </div>
            </div>
            <button
              onClick={() => setPoCreatedSuccess(null)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: '#94A3B8',
                padding: '2px 6px',
                borderRadius: 4,
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
          {createdPoResult && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
              <button
                className="btn sm"
                style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#475569' }}
                onClick={() => setPoCreatedSuccess(null)}
              >
                Dismiss
              </button>
              <Link
                to={`/proposals/${createdPoResult.id}`}
                className="btn sm"
                style={{
                  background: '#059669',
                  color: '#fff',
                  borderColor: '#059669',
                  fontWeight: 700,
                  padding: '7px 14px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 6,
                }}
              >
                <span>👉 Open Proposal in Approval Queue ({createdPoResult.proposal_no}) →</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* SECTION A: Procurement Overview KPIs */}
      {kpis && (
        <div className="grid g4" style={{ marginBottom: 18 }}>
          <div className="card kpi">
            <div className="label">Active Material Shortages</div>
            <div className="value" style={{ color: 'var(--brand-purple)' }}>
              {kpis.active_shortages_count}
            </div>
            <div className="kpi-foot" style={{ color: '#DC2626', fontWeight: 600 }}>
              {kpis.critical_shortages_count} critical line-stop risks
            </div>
          </div>

          <div className="card kpi">
            <div className="label">Draft POs in Queue</div>
            <div className="value" style={{ color: '#0369A1' }}>
              {kpis.draft_pos_count}
            </div>
            <div className="kpi-foot">{kpis.pending_approvals_count} awaiting manager approval</div>
          </div>

          <div className="card kpi">
            <div className="label">Total Draft Value</div>
            <div className="value" style={{ color: '#D97706' }}>
              {formatInr(kpis.total_draft_value_inr)}
            </div>
            <div className="kpi-foot">Committed for current replenishment run</div>
          </div>

          <div className="card kpi">
            <div className="label">Potential Cost Savings</div>
            <div className="value" style={{ color: '#15803D' }}>
              {formatInr(kpis.potential_cost_savings_inr)}
            </div>
            <div className="kpi-foot">Identified via best-value vendor selection</div>
          </div>
        </div>
      )}

      {/* SECTION B: Material Shortage Requests Queue */}
      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              Material Shortage Requests Queue
            </h3>
            <span className="small muted">
              Select a shortage below to compare approved supplier quotations and landed costs
            </span>
          </div>
          <span className="pill" style={{ background: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
            {shortages.length} Items Needing Procurement
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th>Material ID &amp; Name</th>
                <th>Category</th>
                <th>Plant</th>
                <th>Usable Stock</th>
                <th>Requirement</th>
                <th>Net Shortage</th>
                <th>Stockout Window</th>
                <th>Urgency</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {shortages.map((s) => {
                const isSelected = selectedMaterial === s.material_id
                return (
                  <tr
                    key={s.material_id + s.plant_id}
                    style={{
                      background: isSelected ? 'rgba(99, 102, 241, 0.06)' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleSelectShortage(s)}
                  >
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--brand-purple)' }}>{s.material_id}</div>
                      <div className="small muted">{s.material_name}</div>
                    </td>
                    <td>
                      <span className="pill sm" style={{ fontSize: 11 }}>{s.category}</span>
                    </td>
                    <td>{s.plant_id}</td>
                    <td style={{ fontWeight: 600 }}>{s.usable_stock.toLocaleString('en-IN')}</td>
                    <td>{s.required_qty.toLocaleString('en-IN')}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#DC2626' }}>
                        +{s.shortage_qty.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{s.stockout_days} days</span>
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          background: s.urgency === 'CRITICAL' ? '#FEE2E2' : '#FEF3C7',
                          color: s.urgency === 'CRITICAL' ? '#DC2626' : '#D97706',
                        }}
                      >
                        {s.urgency === 'CRITICAL' ? '🔴 Critical' : '🟡 At Risk'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={`btn sm ${isSelected ? 'primary' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectShortage(s)
                        }}
                      >
                        {isSelected ? 'Active Selection' : 'Compare Quotes'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION C: Side-by-Side Quote Comparison (Kkonnect.io Style) */}
      <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div className="crumb" style={{ marginBottom: 4 }}>
              Active RFQ Comparison › {selectedMaterial}
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Quote Comparison: {compare?.material_name || selectedMaterial}
            </h2>
            <div className="small muted">
              Comparing 5 approved suppliers for net shortage requirement of <strong>{requiredQty} units</strong>
            </div>
          </div>

          {/* Sort Controls (Matching Kkonnect.io filter bar) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="small muted">Sort by:</span>
            <button
              className={`btn sm ${sortBy === 'score' ? 'primary' : ''}`}
              onClick={() => setSortBy('score')}
            >
              ★ Best Value Score
            </button>
            <button
              className={`btn sm ${sortBy === 'price_low' ? 'primary' : ''}`}
              onClick={() => setSortBy('price_low')}
            >
              Cost: Low to High
            </button>
            <button
              className={`btn sm ${sortBy === 'lead_time' ? 'primary' : ''}`}
              onClick={() => setSortBy('lead_time')}
            >
              Timeline / Speed
            </button>
          </div>
        </div>

        {/* AI Rationale Banner */}
        {compare?.recommendation_rationale && (
          <div
            style={{
              background: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 22 }}>🤖</span>
            <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
              <strong>AI Recommendation Engine:</strong> {compare.recommendation_rationale}
            </div>
          </div>
        )}

        {isCompareLoading && (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>
            Analyzing supplier quotations, historical lead times, and quality metrics...
          </div>
        )}

        {/* Horizontal Matrix Comparison Table */}
        {!isCompareLoading && suppliers.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: 13,
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              {/* Header: Supplier Card Columns */}
              <thead>
                <tr>
                  <th
                    style={{
                      background: '#F8FAFC',
                      padding: 16,
                      width: 220,
                      borderBottom: '2px solid var(--border)',
                      textAlign: 'left',
                      fontWeight: 700,
                      color: 'var(--muted)',
                    }}
                  >
                    EVALUATION METRIC
                  </th>
                  {suppliers.map((s) => (
                    <th
                      key={s.supplier_id}
                      style={{
                        background: s.is_recommended ? '#F0FDF4' : '#FAFAFA',
                        padding: 16,
                        borderBottom: '2px solid var(--border)',
                        borderLeft: '1px solid var(--border)',
                        textAlign: 'center',
                        verticalAlign: 'top',
                        position: 'relative',
                      }}
                    >
                      {s.is_recommended && (
                        <div
                          style={{
                            background: '#15803D',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: 4,
                            display: 'inline-block',
                            marginBottom: 6,
                          }}
                        >
                          ★ Recommended (Best Value)
                        </div>
                      )}
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                        {s.supplier_name}
                      </div>
                      <div className="small muted" style={{ marginBottom: 12 }}>
                        {s.country}
                      </div>

                      {/* Primary Action Button */}
                      {s.is_recommended ? (
                        <button
                          className="btn sm primary"
                          style={{ width: '100%', background: '#15803D', borderColor: '#15803D', fontWeight: 700 }}
                          onClick={() => handleCreatePo(s)}
                        >
                          🛒 Create Draft PO
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            className="btn sm"
                            style={{ flex: 1, fontSize: 11 }}
                            onClick={() => handleCreatePo(s)}
                          >
                            Shortlist
                          </button>
                          <button
                            className="btn sm"
                            style={{ opacity: 0.6, fontSize: 11 }}
                            onClick={() => alert(`Supplier ${s.supplier_name} marked as rejected for this RFQ.`)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Data Rows */}
              <tbody>
                {/* 1. Timeline / Delivery Lead Time */}
                <tr>
                  <td style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                    Delivery Timeline
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: '1px solid var(--border)',
                        fontWeight: 700,
                        color: s.lead_time_days <= 10 ? '#15803D' : '#D97706',
                      }}
                    >
                      {s.lead_time_days} Days
                    </td>
                  ))}
                </tr>

                {/* 2. Payment Terms */}
                <tr>
                  <td style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                    Payment Terms
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: '1px solid var(--border)',
                        fontSize: 12,
                      }}
                    >
                      {s.payment_terms}
                    </td>
                  ))}
                </tr>

                {/* 3. Incoterms */}
                <tr>
                  <td style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                    Incoterms
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: '1px solid var(--border)',
                        fontSize: 12,
                      }}
                    >
                      <span className="pill sm">{s.incoterm}</span>
                    </td>
                  ))}
                </tr>

                {/* 4. Total Amount */}
                <tr style={{ background: '#F8FAFC' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
                    Total Landed Cost
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: '1px solid var(--border)',
                        fontWeight: 700,
                        fontSize: 16,
                        color: s.is_recommended ? '#15803D' : 'var(--text)',
                      }}
                    >
                      {formatInr(s.total_landed_cost_inr)}
                    </td>
                  ))}
                </tr>

                {/* Cost Breakdown Sub-Header */}
                <tr style={{ background: '#EEF2FF' }}>
                  <td
                    colSpan={suppliers.length + 1}
                    style={{ padding: '8px 16px', fontWeight: 700, fontSize: 11, color: '#4F46E5', textTransform: 'uppercase' }}
                  >
                    Cost &amp; Line-Item Breakdown
                  </td>
                </tr>

                {/* Line Item Name */}
                <tr>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                    Component Description
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontSize: 11.5 }}
                    >
                      {compare?.material_name}
                    </td>
                  ))}
                </tr>

                {/* Order Quantity */}
                <tr>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                    Order Quantity
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontWeight: 600 }}
                    >
                      {s.order_qty} units {s.order_qty > requiredQty && <span className="small muted">(MOQ applied)</span>}
                    </td>
                  ))}
                </tr>

                {/* Unit Price (Quoted) */}
                <tr>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                    Quoted Unit Price (INR)
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontWeight: 700 }}
                    >
                      {formatInr(s.unit_price_inr)}
                    </td>
                  ))}
                </tr>

                {/* Performance Metrics Sub-Header */}
                <tr style={{ background: '#F1F5F9' }}>
                  <td
                    colSpan={suppliers.length + 1}
                    style={{ padding: '8px 16px', fontWeight: 700, fontSize: 11, color: '#475569', textTransform: 'uppercase' }}
                  >
                    Historical Supplier Performance &amp; Reliability
                  </td>
                </tr>

                {/* Historical OTIF */}
                <tr>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                    On-Time Delivery (OTIF)
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontWeight: 700 }}
                    >
                      <span
                        style={{
                          color: s.on_time_rate_pct >= 95 ? '#15803D' : s.on_time_rate_pct >= 90 ? '#D97706' : '#DC2626',
                        }}
                      >
                        {s.on_time_rate_pct}%
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Quality Acceptance */}
                <tr>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                    Quality Acceptance Rate
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontWeight: 600 }}
                    >
                      {s.quality_acceptance_pct}%
                    </td>
                  ))}
                </tr>

                {/* Historical Price Comparison */}
                <tr>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                    Historical Avg Price
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontSize: 12 }}
                    >
                      {formatInr(s.historical_avg_price)}
                      <div className="small muted">
                        {s.price_trend === 'DECREASING' ? '📉 Lower than avg' : s.price_trend === 'INCREASING' ? '📈 Higher than avg' : '≈ On par'}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Recommendation Score Row */}
                <tr style={{ background: '#FAF5FF' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--brand-purple)' }}>
                    Recommendation Score
                  </td>
                  {suppliers.map((s) => (
                    <td
                      key={s.supplier_id}
                      style={{
                        padding: '14px 16px',
                        textAlign: 'center',
                        borderLeft: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.is_recommended ? '#15803D' : 'var(--text)' }}>
                        {s.recommendation_score} / 100
                      </div>
                      <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${s.recommendation_score}%`,
                            background: s.is_recommended ? '#15803D' : 'var(--brand-purple)',
                          }}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION E: Draft PO Queue & Tracking Stepper */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              Purchase Order Lifecycle &amp; Approvals
            </h3>
            <span className="small muted">
              Track agent-generated draft purchase orders from creation to verified goods receipt
            </span>
          </div>
          <Link to="/proposals" className="btn sm">
            View All Proposals &amp; Requests ↗
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th>PO Draft ID</th>
                <th>Material</th>
                <th>Supplier</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Value</th>
                <th>Need By Date</th>
                <th>Approval Tier</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {draftPos.map((po) => (
                <tr key={po.draft_id}>
                  <td style={{ fontWeight: 700, color: 'var(--brand-purple)' }}>
                    {po.proposal_id ? (
                      <Link to={`/proposals/${po.proposal_id}`} style={{ color: 'var(--brand-purple)', textDecoration: 'none' }}>
                        {po.draft_id} ↗
                      </Link>
                    ) : (
                      po.draft_id
                    )}
                  </td>
                  <td>
                    <div>{po.material_name}</div>
                    <span className="small muted">{po.material_id}</span>
                  </td>
                  <td>{po.supplier_name}</td>
                  <td style={{ fontWeight: 600 }}>{po.order_qty.toLocaleString('en-IN')}</td>
                  <td>{formatInr(po.unit_price_inr)}</td>
                  <td style={{ fontWeight: 700 }}>{formatInr(po.total_value_inr)}</td>
                  <td>{po.need_by_date}</td>
                  <td>
                    <span className="pill sm" style={{ fontSize: 11 }}>
                      {po.approval_level}
                    </span>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        background: po.status === 'APPROVED' ? '#DCFCE7' : '#FEF3C7',
                        color: po.status === 'APPROVED' ? '#15803D' : '#D97706',
                      }}
                    >
                      {po.status === 'APPROVED' ? '✓ Approved' : '⏳ Pending Approval'}
                    </span>
                  </td>
                  <td>
                    {po.proposal_id ? (
                      <Link
                        to={`/proposals/${po.proposal_id}`}
                        className="btn sm"
                        style={{ fontSize: 11, padding: '3px 8px', textDecoration: 'none' }}
                      >
                        Review &amp; Approve ↗
                      </Link>
                    ) : (
                      <Link
                        to="/proposals"
                        className="btn sm"
                        style={{ fontSize: 11, padding: '3px 8px', textDecoration: 'none' }}
                      >
                        Queue ↗
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION D: PO Drafting Modal / Drawer (Fully Editable) */}
      {activeDraftModal && (() => {
        const liveTotalValue = modalQty * modalPrice
        const isHighValue = liveTotalValue >= 1000000
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 99,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setActiveDraftModal(null)}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: 620,
                padding: 24,
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                position: 'relative',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                    Generate &amp; Customize Draft Purchase Order
                  </h3>
                  <span className="small muted">
                    Modify quantity, agreed unit price, or delivery terms before routing for approvals
                  </span>
                </div>
                <button className="btn sm" onClick={() => setActiveDraftModal(null)}>
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16, fontSize: 13 }}>
                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Selected Supplier:
                  </label>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{activeDraftModal.supplier_name}</div>
                  <div className="small muted">{activeDraftModal.country} ({activeDraftModal.supplier_id})</div>
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Target Manufacturing Plant:
                  </label>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{plant || 'IN-TN-01 (Chennai Assembly)'}</div>
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Component Material:
                  </label>
                  <div style={{ fontWeight: 700 }}>{compare?.material_name}</div>
                  <div className="small muted">{selectedMaterial}</div>
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Order Quantity (Editable):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={modalQty}
                    onChange={(e) => setModalQty(Math.max(1, Number(e.target.value)))}
                    style={{ width: '100%', padding: '6px 10px', fontSize: 14, fontWeight: 700, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Agreed Unit Price (INR, Editable):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={modalPrice}
                    onChange={(e) => setModalPrice(Math.max(0, Number(e.target.value)))}
                    style={{ width: '100%', padding: '6px 10px', fontSize: 14, fontWeight: 700, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Need-By Arrival Date:
                  </label>
                  <input
                    type="date"
                    value={modalNeedBy}
                    onChange={(e) => setModalNeedBy(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Incoterms / Freight:
                  </label>
                  <select
                    value={modalIncoterm}
                    onChange={(e) => setModalIncoterm(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                  >
                    <option value="FOB">FOB (Free On Board - Port of Origin)</option>
                    <option value="DDP">DDP (Delivered Duty Paid - Plant Dock)</option>
                    <option value="EXW">EXW (Ex Works - Supplier Factory)</option>
                    <option value="CIF">CIF (Cost, Insurance &amp; Freight)</option>
                  </select>
                </div>

                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Commercial Payment Terms:
                  </label>
                  <select
                    value={modalTerms}
                    onChange={(e) => setModalTerms(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                  >
                    <option value="NET 30">NET 30 Days Credit</option>
                    <option value="NET 45">NET 45 Days Credit</option>
                    <option value="NET 60">NET 60 Days Credit</option>
                    <option value="50% Advance">50% Advance / Balance on Inspection</option>
                  </select>
                </div>
              </div>

              {/* Total Purchase Calculation */}
              <div
                style={{
                  background: '#F1F5F9',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span className="small muted">Calculated Total Purchase Value:</span>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {modalQty} units &times; {formatInr(modalPrice)}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-purple)' }}>
                  {formatInr(liveTotalValue)}
                </div>
              </div>

              {/* Governance & Approval Tier Note */}
              <div
                style={{
                  background: isHighValue ? '#FFFBEB' : '#F0FDF4',
                  border: isHighValue ? '1px solid #FCD34D' : '1px solid #86EFAC',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  marginBottom: 20,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4, color: isHighValue ? '#92400E' : '#166534' }}>
                  {isHighValue ? '⚠️ Level 2 Approval Required (High Value Order)' : '✓ Level 1 Approval (Standard Purchasing)'}
                </div>
                {isHighValue ? (
                  <span style={{ color: '#92400E' }}>
                    Order value &ge; ₹10 Lakhs. Requires Purchasing Officer review and Procurement Manager co-approval before release to ERP.
                  </span>
                ) : (
                  <span style={{ color: '#166534' }}>
                    Order value &lt; ₹10 Lakhs. Single-level Purchasing Officer approval threshold satisfies full corporate purchasing policy.
                  </span>
                )}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 18 }}>
                <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>
                  Internal Notes &amp; Routing Justification:
                </label>
                <input
                  type="text"
                  placeholder="e.g., Line stop risk mitigation; best-value supplier per AI scoring"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                />
              </div>

              {/* Error feedback if any */}
              {modalError && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #F87171',
                    color: '#991B1B',
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    marginBottom: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>⚠️</span>
                  <span>{modalError}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <button className="btn" onClick={() => setActiveDraftModal(null)} disabled={isSubmittingPo}>
                  Cancel
                </button>
                <button
                  className="btn primary"
                  onClick={handleConfirmPo}
                  disabled={isSubmittingPo || modalQty <= 0 || modalPrice <= 0}
                  style={{ background: '#15803D', borderColor: '#15803D', fontWeight: 700, padding: '8px 18px' }}
                >
                  {isSubmittingPo ? 'Routing to Queue...' : `✓ Confirm & Route Draft PO (${formatInr(liveTotalValue)})`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ========================================================================= */}
      {/* MANUAL PO CREATION & AI DEALER RECOMMENDATION MODAL                       */}
      {/* ========================================================================= */}
      {isManualPoOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingManual) setIsManualPoOpen(false)
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: manualStep === 2 ? 960 : 680,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              position: 'relative',
              maxHeight: '92vh',
              overflowY: 'auto',
              borderRadius: 12,
              border: '1.5px solid var(--border)',
            }}
          >
            {/* Header & Steps */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div className="crumb" style={{ marginBottom: 4 }}>
                  Manual Procurement Requisition · Step {manualStep} of 3
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  Create Manual Purchase Order &amp; AI Sourcing
                </h2>
                <div className="small muted" style={{ marginTop: 2 }}>
                  Create ad-hoc purchase requests and ask the AI agent to evaluate and recommend the best approved vendor.
                </div>
              </div>
              <button
                className="btn sm"
                disabled={isSubmittingManual}
                onClick={() => setIsManualPoOpen(false)}
                style={{ fontSize: 16, padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {/* Stepper Nav */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 20,
                borderBottom: '1px solid var(--border)',
                paddingBottom: 12,
              }}
            >
              {[
                { step: 1, label: '1. Material & Demand' },
                { step: 2, label: '2. AI Supplier Recommendation' },
                { step: 3, label: '3. Commercial Terms & Confirm' },
              ].map((s) => (
                <div
                  key={s.step}
                  onClick={() => {
                    if (s.step === 1) setManualStep(1)
                    else if (s.step === 2 && manualCompare) setManualStep(2)
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: s.step === 1 || (s.step === 2 && manualCompare) ? 'pointer' : 'default',
                    background: manualStep === s.step ? 'var(--brand-purple)' : '#F1F5F9',
                    color: manualStep === s.step ? '#fff' : '#64748B',
                  }}
                >
                  {s.label}
                </div>
              ))}
            </div>

            {/* ERROR BANNER */}
            {manualError && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #F87171',
                  color: '#991B1B',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>⚠️</span>
                <span>{manualError}</span>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 1: MATERIAL & DEMAND SETUP                                          */}
            {/* ========================================================================= */}
            {manualStep === 1 && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      Select Component Material:
                    </label>
                    <select
                      value={manualMaterial}
                      onChange={(e) => handleSelectManualMaterial(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: 13,
                        borderRadius: 8,
                        border: '1.5px solid #CBD5E1',
                        background: '#F8FAFC',
                        fontWeight: 600,
                      }}
                    >
                      {materialsData?.data?.map((m) => (
                        <option key={m.material_id} value={m.material_id}>
                          {m.material_id} — {m.material_name} ({m.category} · Standard Cost: ₹{m.standard_cost_inr.toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Destination Plant:
                      </label>
                      <select
                        value={manualPlant}
                        onChange={(e) => setManualPlant(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          fontSize: 13,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          fontWeight: 500,
                        }}
                      >
                        <option value="IN-TN-01">IN-TN-01 (Chennai Mobile Assembly)</option>
                        <option value="IN-KA-01">IN-KA-01 (Bengaluru Electronics)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Order Quantity (Units):
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={manualQty}
                        onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: 14,
                          fontWeight: 700,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Required Arrival Date:
                      </label>
                      <input
                        type="date"
                        value={manualNeedBy}
                        onChange={(e) => setManualNeedBy(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: 13,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Requisition Reason / Notes:
                      </label>
                      <input
                        type="text"
                        value={manualNotes}
                        onChange={(e) => setManualNotes(e.target.value)}
                        placeholder="e.g. Buffer stock replenishment for line ramp-up"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: 13,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#EEF2FF',
                    border: '1px solid #C7D2FE',
                    borderRadius: 10,
                    padding: '14px 18px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: '#312E81', fontSize: 13 }}>
                      ✨ AI Sourcing &amp; Dealer Intelligence
                    </div>
                    <div className="small" style={{ color: '#4338CA', marginTop: 2 }}>
                      The AI agent will analyze approved vendors on price, OTIF %, quality score, and lead times to recommend the best supplier.
                    </div>
                  </div>
                  <button
                    className="btn primary"
                    onClick={handleTriggerManualAi}
                    disabled={isManualAiLoading || manualQty <= 0}
                    style={{
                      background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)',
                      fontWeight: 700,
                      padding: '10px 18px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(67, 56, 202, 0.25)',
                    }}
                  >
                    {isManualAiLoading ? 'Analyzing Vendors...' : '✨ Ask Agent to Recommend Best Supplier'}
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 2: AI SUPPLIER RECOMMENDATION & SELECTION                           */}
            {/* ========================================================================= */}
            {manualStep === 2 && manualCompare && (
              <div>
                {/* AI Recommendation Summary */}
                <div
                  style={{
                    background: '#ECFDF5',
                    border: '1.5px solid #10B981',
                    borderRadius: 10,
                    padding: '14px 18px',
                    marginBottom: 18,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                  }}
                >
                  <div style={{ fontSize: 26, lineHeight: 1 }}>🤖</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, color: '#065F46', fontSize: 14 }}>
                        AI Recommendation: {manualCompare.recommended_supplier?.supplier_name}
                      </span>
                      <span
                        className="pill"
                        style={{ background: '#10B981', color: '#fff', fontWeight: 700, fontSize: 11 }}
                      >
                        SCORE {manualCompare.recommended_supplier?.recommendation_score}/100
                      </span>
                    </div>
                    <div className="small" style={{ color: '#047857', lineHeight: 1.45 }}>
                      {manualCompare.recommendation_rationale ||
                        `${manualCompare.recommended_supplier?.supplier_name} offers the best overall purchasing value balancing landed price, fastest delivery (${manualCompare.recommended_supplier?.lead_time_days} days), and ${manualCompare.recommended_supplier?.on_time_rate_pct}% on-time performance.`}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#334155' }}>
                  Approved Suppliers Comparison ({manualCompare.suppliers.length} vendors evaluated):
                </div>

                {/* Supplier Comparison Cards Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {manualCompare.suppliers.map((s) => {
                    const isSelected = manualSupplier?.supplier_id === s.supplier_id
                    const isBest = manualCompare.recommended_supplier?.supplier_id === s.supplier_id
                    return (
                      <div
                        key={s.supplier_id}
                        onClick={() => handleSelectManualSupplier(s)}
                        style={{
                          border: isSelected ? '2px solid var(--brand-purple)' : '1px solid var(--border)',
                          background: isSelected ? '#FAF5FF' : '#FFFFFF',
                          borderRadius: 10,
                          padding: 12,
                          cursor: 'pointer',
                          transition: 'all .15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          position: 'relative',
                        }}
                      >
                        {isBest && (
                          <div
                            style={{
                              position: 'absolute',
                              top: -9,
                              right: 8,
                              background: '#15803D',
                              color: '#fff',
                              fontSize: 9,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 4,
                              letterSpacing: '0.04em',
                            }}
                          >
                            ★ RECOMMENDED
                          </div>
                        )}
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', marginBottom: 2 }}>
                          {s.supplier_name}
                        </div>
                        <div className="small muted" style={{ fontSize: 11, marginBottom: 8 }}>
                          {s.country} ({s.supplier_id})
                        </div>

                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-purple)', marginBottom: 8 }}>
                          ₹{Number(s.unit_price_inr).toLocaleString('en-IN')}
                          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}> / unit</span>
                        </div>

                        <div style={{ fontSize: 11, display: 'grid', gap: 4, marginBottom: 12, borderTop: '1px solid #F1F5F9', paddingTop: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="muted">Lead Time:</span>
                            <b>{s.lead_time_days} days</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="muted">OTIF %:</span>
                            <b style={{ color: s.on_time_rate_pct >= 90 ? '#15803D' : '#D97706' }}>{s.on_time_rate_pct}%</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="muted">Quality:</span>
                            <b>{s.quality_acceptance_pct}%</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="muted">Total Landed:</span>
                            <b>₹{Math.round(s.total_landed_cost_inr).toLocaleString('en-IN')}</b>
                          </div>
                        </div>

                        <button
                          className={`btn sm ${isSelected ? 'primary' : ''}`}
                          style={{
                            marginTop: 'auto',
                            width: '100%',
                            fontSize: 11,
                            padding: '5px 8px',
                            fontWeight: 700,
                          }}
                        >
                          {isSelected ? '✓ Selected' : 'Select Vendor'}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <button className="btn" onClick={() => setManualStep(1)}>
                    ← Back to Requirements
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => setManualStep(3)}
                    disabled={!manualSupplier}
                    style={{
                      background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)',
                      fontWeight: 700,
                      padding: '8px 18px',
                    }}
                  >
                    Proceed to Commercial Terms (Selected: {manualSupplier?.supplier_name}) →
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 3: COMMERCIAL TERMS & CONFIRMATION                                  */}
            {/* ========================================================================= */}
            {manualStep === 3 && manualSupplier && (() => {
              const totalVal = manualQty * manualAgreedPrice
              const isHigh = totalVal >= 1_000_000
              return (
                <div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 14,
                      background: '#F8FAFC',
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      marginBottom: 16,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <span className="small muted">Selected Vendor:</span>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#1E293B' }}>
                        {manualSupplier.supplier_name}
                      </div>
                      <div className="small muted">{manualSupplier.country} ({manualSupplier.supplier_id})</div>
                    </div>
                    <div>
                      <span className="small muted">Delivery Plant:</span>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#1E293B' }}>
                        {manualPlant === 'IN-TN-01' ? 'IN-TN-01 (Chennai Assembly)' : 'IN-KA-01 (Bengaluru Electronics)'}
                      </div>
                      <div className="small muted">Standard Lead Time: {manualSupplier.lead_time_days} days</div>
                    </div>
                  </div>

                  {/* Commercial Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Order Quantity:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={manualQty}
                        onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', fontWeight: 600 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Agreed Unit Price (INR):
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={manualAgreedPrice}
                        onChange={(e) => setManualAgreedPrice(Math.max(0.01, parseFloat(e.target.value) || 0))}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', fontWeight: 600 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Incoterms / Freight:
                      </label>
                      <select
                        value={manualIncoterm}
                        onChange={(e) => setManualIncoterm(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                      >
                        <option value="FOB">FOB (Free On Board - Port of Origin)</option>
                        <option value="DDP">DDP (Delivered Duty Paid - Factory Dock)</option>
                        <option value="CIF">CIF (Cost, Insurance &amp; Freight)</option>
                        <option value="EXW">EXW (Ex Works - Supplier Warehouse)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Payment Terms:
                      </label>
                      <select
                        value={manualTerms}
                        onChange={(e) => setManualTerms(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                      >
                        <option value="NET 30">NET 30 Days Credit</option>
                        <option value="NET 45">NET 45 Days Credit</option>
                        <option value="NET 60">NET 60 Days Credit</option>
                        <option value="50% Advance">50% Advance, 50% on BL</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      Routing Notes &amp; Procurement Justification:
                    </label>
                    <input
                      type="text"
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="e.g. Line buffer safety stock replenishment; vendor approved by AI recommendation engine"
                      style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>

                  {/* Calculated Value Card */}
                  <div
                    style={{
                      background: '#F1F5F9',
                      borderRadius: 8,
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <span className="small muted">Total Purchase Value:</span>
                      <div className="small muted">{manualQty} units × ₹{manualAgreedPrice.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-purple)' }}>
                      ₹{Math.round(totalVal).toLocaleString('en-IN')}
                    </div>
                  </div>

                  {/* Governance Notice */}
                  <div
                    style={{
                      background: isHigh ? '#FEF3C7' : '#DCFCE7',
                      border: `1.5px solid ${isHigh ? '#F59E0B' : '#10B981'}`,
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 12,
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ fontWeight: 800, color: isHigh ? '#92400E' : '#166534', marginBottom: 2 }}>
                      {isHigh ? '⚠️ Level 2 Approval Required (High Value Order ≥ ₹10 Lakhs)' : '✓ Level 1 Approval (Standard Purchasing < ₹10 Lakhs)'}
                    </div>
                    <div style={{ color: isHigh ? '#78350F' : '#14532D' }}>
                      {isHigh
                        ? 'Requires Purchasing Officer review and Procurement Manager co-approval before release to ERP.'
                        : 'Single-level Purchasing Officer approval threshold satisfies full corporate purchasing policy.'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <button className="btn" onClick={() => setManualStep(2)} disabled={isSubmittingManual}>
                      ← Back to Vendors
                    </button>
                    <button
                      className="btn primary"
                      onClick={handleConfirmManualPo}
                      disabled={isSubmittingManual || manualQty <= 0 || manualAgreedPrice <= 0}
                      style={{
                        background: '#15803D',
                        borderColor: '#15803D',
                        fontWeight: 700,
                        padding: '10px 20px',
                        boxShadow: '0 4px 12px rgba(21, 128, 61, 0.25)',
                      }}
                    >
                      {isSubmittingManual ? 'Submitting to Queue...' : `✓ Confirm & Route Manual PO (₹${Math.round(totalVal).toLocaleString('en-IN')})`}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

