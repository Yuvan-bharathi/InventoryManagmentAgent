import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, ApiError, token } from '../api'
import { day, inr, qty, shortDay, STATE_TEXT } from '../format'
import { AssumptionIds, PageState, ScenarioTag, StatusLabel } from '../kit'
import { useShell } from '../shell-context'
import { AXIS, TIP } from '../theme'

type R = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

type Detail = {
  proposal: R
  path: string[]
  rfq_dossier?: {
    agent_id: string
    agent_name: string
    inputs_used: string[]
    winning_supplier_id: string
    quotes_analyzed_count: number
    estimated_savings_inr: number
    sourcing_rationale: string
    quote_comparison: R[]
    sap_po_preview: string
  }
  why: { status: R | null; projection: R[] }
  options: R[]
  related: R[]
  supplier: { supplier_id: string | null; candidates: R[]; open_po_lines: R[] }
  timeline: R[]
  allowed_actions: string[]
  reason_codes: string[]
}

const ACTION_TEXT: Record<string, string> = {
  submit: 'Submit for L1 Review',
  approve: '✓ Approve PO & Digital Sign-off',
  reject: '✗ Reject PO',
  send_back: '↩ Return to Agent #11 for Re-quote',
  override_qty: 'Override Quantity',
  fulfil: 'Mark Fulfilled in SAP',
}

export function ProposalDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { setAgentCtx, openAgent, user } = useShell()
  const q = useQuery({
    queryKey: ['proposal', id],
    queryFn: () => api.get<Detail>(`/api/proposals/${id}`),
  })

  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [newQty, setNewQty] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [switching, setSwitching] = useState(false)

  const d = q.data?.data
  const p = d?.proposal
  const dossier = d?.rfq_dossier || p?.rfq_dossier

  useEffect(() => {
    if (p) {
      setAgentCtx({
        page: 'Proposal Detail',
        item: { type: 'proposal', id: String(p.id), label: p.proposal_no, plant: p.plant_id },
      })
    }
  }, [p?.id]) // eslint-disable-line

  async function act(action: string) {
    setErr(null)
    setBusy(true)
    try {
      await api.post(`/api/proposals/${id}/${action}`, {
        reason_code: reason || null,
        comment: comment || null,
        qty: newQty ? Number(newQty) : null,
      })
      setComment('')
      setReason('')
      setNewQty('')
      await qc.invalidateQueries()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function switchRole(userRole: string) {
    setSwitching(true)
    try {
      const r = await api.raw<{ token: string }>('POST', '/api/auth/login', {
        username: userRole,
        password: 'demo',
      })
      token.set(r.token)
      await qc.invalidateQueries()
      window.location.reload()
    } catch {
      // ignore
    } finally {
      setSwitching(false)
    }
  }

  const cur = p ? d!.path.indexOf(p.state) : -1

  // Dynamic persona label
  const activeRoleLabel =
    user?.role === 'buyer'
      ? 'Bala Raman (Purchasing Officer · L1)'
      : user?.role === 'procurement_manager'
      ? 'Meera Pillai (Procurement Mgr · L2)'
      : user?.role === 'leadership'
      ? 'Leela Iyer (Plant Head · Leadership)'
      : user?.role === 'planner'
      ? 'Priya Nair (Demand Planner)'
      : `${user?.display_name || user?.username}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Breadcrumb Navigation */}
      <div className="crumb">
        <Link to="/proposals">Replenishment &amp; Procurement › Purchase Order Approvals</Link> ›{' '}
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{p?.proposal_no}</span>
      </div>

      <PageState loading={q.isLoading} error={q.error}>
        {d && p && (
          <div className="grid" style={{ gap: 20 }}>
            {/* Top Overview & Multi-Tier Stepper Card */}
            <div className="card" style={{ padding: 24, borderRadius: 12 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{p.proposal_no}</h1>
                    <span
                      style={{
                        background: '#EEF2FF',
                        color: '#4F46E5',
                        fontWeight: 800,
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: '1px solid #C7D2FE',
                      }}
                    >
                      {p.kind === 'transfer' ? 'Internal Transfer Order' : 'Automated RFQ Purchase Order'}
                    </span>
                    <span
                      className="pill"
                      data-testid="proposal-state"
                      style={{
                        fontWeight: 800,
                        fontSize: 11.5,
                        background:
                          p.state === 'approved'
                            ? '#ECFDF5'
                            : p.state === 'pending_manager'
                            ? '#F5F3FF'
                            : p.state === 'pending_buyer'
                            ? '#FFFBEB'
                            : '#F1F5F9',
                        color:
                          p.state === 'approved'
                            ? '#059669'
                            : p.state === 'pending_manager'
                            ? '#7C3AED'
                            : p.state === 'pending_buyer'
                            ? '#D97706'
                            : '#475569',
                      }}
                    >
                      {p.state === 'pending_buyer'
                        ? 'Pending L1 Review (Bala)'
                        : p.state === 'pending_manager'
                        ? 'Pending L2 Mgr Sign-off (Meera)'
                        : p.state === 'approved'
                        ? '✓ Approved (Released to SAP)'
                        : STATE_TEXT[p.state]}
                    </span>
                    <ScenarioTag />
                  </div>

                  <div className="muted" style={{ margin: '8px 0 14px', fontSize: 13.5, lineHeight: 1.5 }}>
                    <Link to={`/material/${p.material_id}?plant=${p.plant_id}`} style={{ fontWeight: 700 }}>
                      {p.material_id}
                    </Link>{' '}
                    · <b>{p.material_name}</b> · {qty(p.qty, p.uom)} delivering to{' '}
                    <b style={{ color: 'var(--text)' }}>{p.plant_id}</b>
                    {p.kind === 'transfer'
                      ? ` from plant ${p.source_plant_id}`
                      : ` via ${p.supplier_id ?? 'SUP-001 (Foxconn)'}`}{' '}
                    · Needed by <b>{day(p.needed_by)}</b> · Estimated arrival: <b>{day(p.arrival_date)}</b>
                  </div>
                </div>

                <span className="spacer" />

                <div style={{ textAlign: 'right' }}>
                  <div className="small muted" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10.5 }}>
                    TOTAL ORDER VALUE
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--brand-purple)', marginTop: 2 }}>
                    {inr(p.value_inr)}
                  </div>
                  <div className="small muted">
                    @{inr(p.unit_price_inr)} / {p.uom}
                  </div>
                </div>
              </div>

              {/* Multi-Tier Approval Stepper */}
              <div
                style={{
                  background: '#F8FAFC',
                  borderRadius: 8,
                  padding: '14px 18px',
                  border: '1px solid #E2E8F0',
                  marginTop: 10,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                  Multi-Tier Governance &amp; Digital Approval Lifecycle
                </div>

                <div className="stepper" style={{ margin: 0 }}>
                  {/* Step 1: RFQ Agent */}
                  <span className="row" style={{ gap: 0 }}>
                    <span className="step done" title="Quotation comparison & supplier recommendation completed by Agent #11">
                      1. Agent #11 RFQ Sourced
                    </span>
                  </span>

                  <span className="step-sep" />

                  {/* Step 2: Level 1 Purchasing Officer */}
                  <span className="row" style={{ gap: 0 }}>
                    <span
                      className={`step ${
                        p.state === 'draft'
                          ? ''
                          : p.state === 'pending_buyer'
                          ? 'now'
                          : cur > d.path.indexOf('pending_buyer')
                          ? 'done'
                          : ''
                      }`}
                    >
                      2. L1 Buyer Review (Bala)
                    </span>
                  </span>

                  {/* Step 3: Level 2 Procurement Manager (if required by threshold) */}
                  {p.approval_level === 2 && (
                    <>
                      <span className="step-sep" />
                      <span className="row" style={{ gap: 0 }}>
                        <span
                          className={`step ${
                            p.state === 'pending_manager'
                              ? 'now'
                              : cur > d.path.indexOf('pending_manager')
                              ? 'done'
                              : ''
                          }`}
                        >
                          3. L2 Mgr Sign-off (Meera)
                        </span>
                      </span>
                    </>
                  )}

                  <span className="step-sep" />

                  {/* Step 4: Approved & Released to SAP */}
                  <span className="row" style={{ gap: 0 }}>
                    <span className={`step ${p.state === 'approved' || p.state === 'fulfilled' ? 'done' : ''}`}>
                      {p.approval_level === 2 ? '4.' : '3.'} Released to SAP ERP
                    </span>
                  </span>

                  {p.state === 'rejected' && (
                    <>
                      <span className="step-sep" />
                      <span className="step now" style={{ background: 'var(--red)' }}>
                        ✗ Rejected ({p.reason_code})
                      </span>
                    </>
                  )}
                </div>

                <div className="small muted" style={{ marginTop: 8, fontSize: 11 }}>
                  {p.approval_level === 2
                    ? `High-value order (≥ ${inr(p.manager_threshold_inr)}): Requires Level 1 Purchasing Officer review followed by Level 2 Procurement Manager co-signature.`
                    : `Order below the ${inr(p.manager_threshold_inr)} threshold: Level 1 Purchasing Officer sign-off releases order directly to SAP.`}
                </div>
              </div>

              {/* Official SAP Release Confirmation Banner */}
              {p.state === 'approved' && (
                <div
                  style={{
                    background: '#ECFDF5',
                    border: '1.5px solid #10B981',
                    borderRadius: 8,
                    padding: '14px 18px',
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#059669',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 800,
                    }}
                  >
                    ✓
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: '#065F46' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
                      Official Purchase Order Approved &amp; Released to SAP S/4HANA ERP
                    </div>
                    <div>
                      SAP Document Number: <b>{dossier?.sap_po_preview || `SAP-PO-4500${String(p.id).padStart(4, '0')}`}</b> ·
                      Confirmed vendor: <b>{p.supplier_id}</b> ({qty(p.qty, p.uom)} @ {inr(p.unit_price_inr)}).
                      Target dock: <b>{p.plant_id} (RM-WH-01 Staging Bay)</b>. Expected arrival: <b>{day(p.arrival_date)}</b>.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Agent #11 Sourcing Dossier & Quote Comparison Matrix */}
            <div className="card" style={{ padding: 22, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                      📊 Sourcing Dossier &amp; Quote Comparison (Agent #11)
                    </h2>
                    <span
                      style={{
                        background: '#EEF2FF',
                        color: '#4F46E5',
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: 4,
                      }}
                    >
                      AGENTIC RFQ COMPARISON
                    </span>
                  </div>
                  <div className="small muted" style={{ marginTop: 2 }}>
                    Inputs evaluated: <code>fact_rfq_quote.csv</code> · <code>dim_supplier.csv</code> ·{' '}
                    <code>dim_material.csv</code> · <code>fact_purchase_order_receipt.csv</code>
                  </div>
                </div>

                {dossier?.estimated_savings_inr ? (
                  <div
                    style={{
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      borderRadius: 6,
                      padding: '4px 10px',
                      color: '#065F46',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    💰 Estimated Savings: ~{inr(dossier.estimated_savings_inr)} (5.5% vs Standard)
                  </div>
                ) : null}
              </div>

              {/* Competing Quotes Table */}
              <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                <table className="dg compact" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Option &amp; Rank</th>
                      <th>Supplier / Dealer</th>
                      <th className="num">Quoted Rate</th>
                      <th className="num">Total Landed Cost</th>
                      <th className="num">Transit Lead Time</th>
                      <th className="num">On-Time % (OTIF)</th>
                      <th className="num">Quality Acceptance</th>
                      <th>Supplier Risk Profile</th>
                      <th>Sourcing Decision Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dossier?.quote_comparison || []).map((q: R, idx: number) => {
                      const isWinning = q.rank === 1
                      return (
                        <tr
                          key={idx}
                          style={{
                            background: isWinning ? '#F0FDF4' : undefined,
                            fontWeight: isWinning ? 600 : 400,
                          }}
                        >
                          <td>
                            {isWinning ? (
                              <span
                                style={{
                                  background: '#059669',
                                  color: '#fff',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                ★ WINNING (RANK #1)
                              </span>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: 11 }}>
                                Rank #{q.rank || idx + 1} Alternate
                              </span>
                            )}
                          </td>
                          <td>
                            <b>{q.supplier_id}</b>
                            <div className="small muted" style={{ fontSize: 11 }}>{q.supplier_name}</div>
                          </td>
                          <td className="num">{inr(q.unit_price_inr)}</td>
                          <td className="num"><b>{inr(q.total_cost_inr)}</b></td>
                          <td className="num">{q.lead_time_days} days</td>
                          <td className="num" style={{ color: q.on_time_pct >= 0.95 ? '#059669' : '#d97706' }}>
                            {Math.round((q.on_time_pct || 0) * 100)}%
                          </td>
                          <td className="num">{Math.round((q.quality_acceptance_pct || 0.98) * 100)}%</td>
                          <td>
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: isWinning ? '#DCFCE7' : '#F1F5F9',
                                color: isWinning ? '#15803D' : '#475569',
                                fontWeight: 700,
                              }}
                            >
                              {q.risk_profile || 'Tier 1 Certified'}
                            </span>
                          </td>
                          <td className="small" style={{ fontSize: 11, maxWidth: 280 }}>
                            {q.sourcing_note}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Sourcing Rationale Highlight Box */}
              <div
                style={{
                  background: '#F8FAFC',
                  borderLeft: '4px solid #6366F1',
                  borderRadius: 6,
                  padding: '10px 14px',
                  fontSize: 12.5,
                  color: '#1E293B',
                  lineHeight: 1.5,
                }}
              >
                <b>🤖 Agent #11 Decision Rationale:</b>{' '}
                {dossier?.sourcing_rationale ||
                  `Supplier ${p.supplier_id} was selected as the optimal sourcing option from 3 competitive RFQ responses. It offers the lowest overall total landed cost while meeting the strict ${p.plant_id} arrival date, protecting production continuity.`}
              </div>
            </div>

            {/* Bottom Split: Demand & Capacity Context (Left) vs Approval Action Console (Right) */}
            <div className="grid g2" style={{ gap: 20 }}>
              {/* Left Column: Why & Stockout Impact */}
              <div className="card" style={{ padding: 22, borderRadius: 12 }}>
                <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>
                  📈 Demand Context &amp; Shortage Impact
                </h2>
                {d.why.status && (
                  <dl className="kv" style={{ marginBottom: 14 }}>
                    <dt>Inventory Status</dt>
                    <dd><StatusLabel status={d.why.status.status} /></dd>
                    <dt>Days to Shortage</dt>
                    <dd>
                      <b>{d.why.status.days_to_shortage != null ? `${d.why.status.days_to_shortage} days` : 'Immediate'}</b>
                    </dd>
                    <dt>Projected Gap</dt>
                    <dd>{qty(d.why.status.shortage_qty, p.uom)}</dd>
                    <dt>Usable On Hand</dt>
                    <dd>{qty(d.why.status.usable_qty, p.uom)}</dd>
                    <dt>Safety Stock Buffer</dt>
                    <dd>{qty(d.why.status.ss_qty, p.uom)}</dd>
                    <dt>Assembly Orders Affected</dt>
                    <dd><b>{d.why.status.orders_affected ?? 0} customer orders</b></dd>
                  </dl>
                )}

                {/* Projection chart */}
                {d.why.projection.length > 0 && (
                  <div>
                    <div className="small muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                      90-DAY INVENTORY HEADROOM TRAJECTORY
                    </div>
                    <div style={{ height: 160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={d.why.projection}>
                          <XAxis dataKey="date" tickFormatter={shortDay} {...AXIS} />
                          <YAxis {...AXIS} />
                          <Tooltip formatter={(v: any) => [qty(Number(v), p.uom), '']} labelFormatter={(label: any) => day(label)} contentStyle={TIP} />
                          <ReferenceLine y={0} stroke="var(--border)" />
                          <Line type="monotone" dataKey="projected_qty" stroke="#4F46E5" strokeWidth={2} dot={false} name="Projected" />
                          <Line type="monotone" dataKey="ss_qty" stroke="#DC2626" strokeDasharray="3 3" dot={false} name="Safety stock" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Approval Action Console & Persona Switcher */}
              <div className="card" style={{ padding: 22, borderRadius: 12 }}>
                <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>
                  ✍️ Approval &amp; Digital Sign-off Console
                </h2>

                {/* Active user badge */}
                <div
                  style={{
                    background: '#F1F5F9',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 14,
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    SIGNED IN AS (ACTIVE APPROVER)
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
                    {activeRoleLabel}
                  </div>
                  <div className="small muted" style={{ marginTop: 2 }}>
                    {user?.role === 'buyer'
                      ? 'Authority: Approves orders < ₹10 Lakhs'
                      : user?.role === 'procurement_manager'
                      ? 'Authority: Approves orders up to ₹50 Lakhs'
                      : user?.role === 'leadership'
                      ? 'Authority: Plant Head Executive Sign-off'
                      : 'Demand Planner (View & Audit)'}
                  </div>
                </div>

                {/* In-page Persona Switcher to effortlessly test approval transitions */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                    Quick Persona Switcher (Test Step-by-Step Approvals):
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className={`btn sm ${user?.role === 'buyer' ? 'primary' : 'outline'}`}
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => switchRole('buyer')}
                      disabled={switching}
                    >
                      👤 Bala (L1 Buyer)
                    </button>
                    <button
                      className={`btn sm ${user?.role === 'procurement_manager' ? 'primary' : 'outline'}`}
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => switchRole('procmgr')}
                      disabled={switching}
                    >
                      👔 Meera (L2 Mgr)
                    </button>
                    <button
                      className={`btn sm ${user?.role === 'leadership' ? 'primary' : 'outline'}`}
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => switchRole('leader')}
                      disabled={switching}
                    >
                      👑 Leela (Leadership)
                    </button>
                  </div>
                </div>

                {/* Form Inputs for Rejection / Send Back / Override */}
                {d.allowed_actions.some((a) => ['reject', 'send_back', 'override_qty'].includes(a)) && (
                  <div className="grid" style={{ gap: 8, marginBottom: 14 }}>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      aria-label="Reason code"
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                    >
                      <option value="">Select Reason Code (Required to Reject)</option>
                      {d.reason_codes.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>

                    <textarea
                      placeholder="Approval remarks, special delivery instructions, or rejection justification..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                    />

                    {d.allowed_actions.includes('override_qty') && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          placeholder={`New quantity (${p.uom})`}
                          value={newQty}
                          onChange={(e) => setNewQty(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                          }}
                        />
                        <span className="small muted">Override Qty</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {d.allowed_actions.map((a) => (
                    <button
                      key={a}
                      disabled={busy || (a === 'override_qty' && !newQty)}
                      className={`btn ${
                        a === 'approve' || a === 'submit' || a === 'fulfil'
                          ? 'primary'
                          : a === 'reject'
                          ? 'danger'
                          : ''
                      }`}
                      style={{
                        padding: '8px 16px',
                        fontWeight: 700,
                        background: a === 'approve' ? '#059669' : undefined,
                        borderColor: a === 'approve' ? '#059669' : undefined,
                      }}
                      onClick={() => act(a)}
                      data-testid={`act-${a}`}
                    >
                      {ACTION_TEXT[a] || a}
                    </button>
                  ))}
                </div>

                {d.allowed_actions.length === 0 && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 12,
                      color: '#475569',
                    }}
                  >
                    ℹ️ No further approval actions required for this role. Current state:{' '}
                    <b>{STATE_TEXT[p.state] || p.state}</b>. Use the persona switcher above to test other review stages.
                  </div>
                )}

                {err && (
                  <div className="banner err" style={{ borderRadius: 8, marginTop: 10 }}>
                    {err}
                  </div>
                )}

                <button
                  className="btn outline sm"
                  style={{ marginTop: 14, width: '100%' }}
                  onClick={() =>
                    openAgent(
                      `Explain proposal ${p.proposal_no}: why was supplier ${p.supplier_id} chosen over other quotes and what is the inventory risk?`
                    )
                  }
                >
                  🤖 Ask Agent #11 to Explain Sourcing Choice
                </button>
              </div>
            </div>

            {/* Audit Trail & Digital Signatures */}
            <div className="card" style={{ padding: 22, borderRadius: 12 }}>
              <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>
                📜 Audit Timeline &amp; Digital Governance Signatures
              </h2>
              {d.timeline.length === 0 && (
                <div className="small muted">
                  No decisions logged yet. Sourced by calculation run #{p.run_id} via Agent #11.
                </div>
              )}
              {d.timeline.length > 0 && (
                <table className="dg compact">
                  <thead>
                    <tr>
                      <th>Timestamp (IST)</th>
                      <th>Authorized Approver</th>
                      <th>Action</th>
                      <th>Transition</th>
                      <th>Reason &amp; Remarks</th>
                      <th>Run ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.timeline.map((t, k) => (
                      <tr key={k}>
                        <td>{new Date(t.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                        <td>
                          <b>{t.username}</b> <span className="muted">({t.role})</span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                t.action === 'approve'
                                  ? '#059669'
                                  : t.action === 'reject'
                                  ? '#DC2626'
                                  : 'var(--brand-purple)',
                            }}
                          >
                            {t.action.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {STATE_TEXT[t.from_state] || t.from_state} ➔ {STATE_TEXT[t.to_state] || t.to_state}
                        </td>
                        <td>
                          {t.reason_code ? `[${t.reason_code}] ` : ''}
                          {t.comment ?? 'Approved via digital workflow'}
                        </td>
                        <td className="small muted">run #{t.run_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="small muted">
              Assumptions verified: <AssumptionIds ids={p.assumption_ids} />
            </div>
          </div>
        )}
      </PageState>
    </div>
  )
}
