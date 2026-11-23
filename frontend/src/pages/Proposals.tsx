import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, token, type Envelope, type Paged } from '../api'
import { day, inr, qty, STATE_TEXT } from '../format'
import { DataGrid, type Col, ScenarioTag } from '../kit'
import { useShell } from '../shell-context'
import { PageIcon } from '../icons'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

type Extra = {
  tabs: Record<string, { count: number; value_inr: number }>
  kpis: {
    value_awaiting_inr: number
    oldest_pending_days: number | null
    avg_approval_hours_week: number | null
    manager_threshold_inr: number
  }
}

const DISPLAY_TABS = [
  'all',
  'pending_buyer',
  'pending_manager',
  'approved',
  'draft',
  'rejected',
  'fulfilled',
]

const TAB_LABELS: Record<string, string> = {
  all: 'All RFQ POs',
  pending_buyer: 'Awaiting L1 Review (Bala)',
  pending_manager: 'Awaiting L2 Mgr (Meera)',
  approved: 'Approved & Released to SAP',
  draft: 'Draft / Staged',
  rejected: 'Rejected / Returned',
  fulfilled: 'Fulfilled in SAP',
}

export function Proposals() {
  const { plant, setAgentCtx, can, openAgent, user } = useShell()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [sp] = useSearchParams()
  const [state, setState] = useState(sp.get('state') ?? 'all')
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')
  const [extra, setExtra] = useState<Extra | null>(null)
  const [sel, setSel] = useState<number[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [switchingUser, setSwitchingUser] = useState(false)

  useEffect(() => setAgentCtx({ page: 'Proposals' }), []) // eslint-disable-line

  // Persona quick switch helper
  async function switchPersona(username: string) {
    setSwitchingUser(true)
    try {
      const res = await api.raw<{ token: string }>('POST', '/api/auth/login', {
        username,
        password: 'demo',
      })
      token.set(res.token)
      await qc.invalidateQueries()
      window.location.reload()
    } catch (e) {
      setMsg(`Failed to switch persona: ${String(e)}`)
    } finally {
      setSwitchingUser(false)
    }
  }

  // Quick 1-click approve single proposal from row
  async function quickApprove(e: React.MouseEvent, r: Row) {
    e.stopPropagation()
    try {
      await api.post(`/api/proposals/${r.id}/approve`, {
        comment: `Approved via RFQ Cockpit by ${user?.display_name || user?.username}`,
      })
      setMsg(`✓ Proposal ${r.proposal_no} approved successfully!`)
      await qc.invalidateQueries()
    } catch (err) {
      setMsg(`Error approving ${r.proposal_no}: ${String(err)}`)
    }
  }

  const cols: Col<Row>[] = [
    ...(state === 'pending_buyer' && can('replenishment', 'L1')
      ? [
          {
            key: 'sel',
            label: '',
            sortable: false,
            render: (r: Row) =>
              r.approval_level === 1 ? (
                <input
                  type="checkbox"
                  checked={sel.includes(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    setSel(
                      e.target.checked
                        ? [...sel, r.id]
                        : sel.filter((x) => x !== r.id)
                    )
                  }
                />
              ) : null,
          } as Col<Row>,
        ]
      : []),
    {
      key: 'proposal_no',
      label: 'PO Reference',
      render: (r) => (
        <div>
          <b style={{ color: 'var(--brand-purple)', fontSize: 13.5 }}>{r.proposal_no}</b>
          <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
            {r.kind === 'transfer' ? 'Internal Transfer' : 'Auto RFQ PO'}
          </div>
        </div>
      ),
    },
    {
      key: 'material_id',
      label: 'Material & Specification',
      render: (r) => (
        <div>
          <b>{r.material_id}</b>
          <div className="small muted" style={{ fontSize: 11 }}>{r.material_name}</div>
          {r.category && (
            <span
              style={{
                fontSize: 9.5,
                background: '#f1f5f9',
                color: '#475569',
                padding: '1px 5px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {r.category}
            </span>
          )}
        </div>
      ),
    },
    { key: 'plant_id', label: 'Destination Plant', render: (r) => <span>{r.plant_id}</span> },
    { key: 'qty', label: 'Order Qty', num: true, render: (r) => qty(r.qty, r.uom) },
    {
      key: 'supplier_id',
      label: 'Recommended Sourcing (Agent #11)',
      render: (r) => (
        <div>
          {r.kind === 'transfer' ? (
            <span className="pill">Transfer from {r.source_plant_id}</span>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    background: '#ECFDF5',
                    color: '#059669',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: '1px solid #A7F3D0',
                  }}
                >
                  ★ RANK #1
                </span>
                <b>{r.supplier_id ?? 'SUP-001'}</b>
              </div>
              <div style={{ fontSize: 11, color: '#047857', fontWeight: 600, marginTop: 2 }}>
                {r.savings_inr ? `+₹${Math.round(r.savings_inr).toLocaleString('en-IN')} Price Savings` : 'RFQ Sourced'}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'value_inr',
      label: 'Commitment Value',
      num: true,
      render: (r) => (
        <div>
          <b style={{ fontSize: 13.5 }}>{inr(r.value_inr)}</b>
          <div className="small muted" style={{ fontSize: 10.5 }}>@{inr(r.unit_price_inr)} / {r.uom}</div>
        </div>
      ),
    },
    {
      key: 'needed_by',
      label: 'Needed / Arrives',
      render: (r) => (
        <div style={{ fontSize: 12 }}>
          <div>Needed: <b>{day(r.needed_by)}</b></div>
          <div className="small muted">ETA: {day(r.arrival_date)}</div>
        </div>
      ),
    },
    {
      key: 'state',
      label: 'Approval Stage',
      render: (r) => {
        let badgeColor = '#64748b'
        let bg = '#f8fafc'
        let border = '#e2e8f0'
        let label = STATE_TEXT[r.state] || r.state

        if (r.state === 'pending_buyer') {
          badgeColor = '#b45309'
          bg = '#fffbeb'
          border = '#fde68a'
          label = 'Pending L1 Review (Bala)'
        } else if (r.state === 'pending_manager') {
          badgeColor = '#6d28d9'
          bg = '#f5f3ff'
          border = '#ddd6fe'
          label = 'Pending L2 Mgr (Meera)'
        } else if (r.state === 'approved') {
          badgeColor = '#059669'
          bg = '#ecfdf5'
          border = '#a7f3d0'
          label = '✓ Approved (SAP Sync)'
        } else if (r.state === 'rejected') {
          badgeColor = '#dc2626'
          bg = '#fef2f2'
          border = '#fecaca'
          label = '✗ Rejected'
        }

        return (
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              color: badgeColor,
              background: bg,
              border: `1px solid ${border}`,
              padding: '3px 8px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: 'Approval Actions',
      sortable: false,
      render: (r) => {
        const canApproveL1 = r.state === 'pending_buyer' && can('replenishment', 'L1')
        const canApproveL2 = r.state === 'pending_manager' && can('replenishment', 'L2')
        const canAct = canApproveL1 || canApproveL2

        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            {canAct && (
              <button
                className="btn primary sm"
                style={{
                  background: '#059669',
                  borderColor: '#059669',
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
                onClick={(e) => quickApprove(e, r)}
                title={canApproveL1 ? 'Approve as Purchasing Officer' : 'Approve as Procurement Manager'}
              >
                ✓ Quick Approve
              </button>
            )}
            <Link
              to={`/proposals/${r.id}`}
              className="btn sm"
              style={{
                fontSize: 11,
                padding: '3px 8px',
                background: '#fff',
                borderColor: '#cbd5e1',
                textDecoration: 'none',
              }}
            >
              Review &amp; Sign ➔
            </Link>
          </div>
        )
      },
    },
  ]

  const bulk = async () => {
    const r = await api.post<{ approved: number[]; skipped: number[] }>(
      '/api/proposals/bulk-approve',
      { ids: sel }
    )
    setMsg(`Approved ${r.data.approved.length} POs; skipped ${r.data.skipped.length}.`)
    setSel([])
    qc.invalidateQueries()
  }

  // Active persona context info
  const roleName = user?.role === 'buyer'
    ? 'Bala Raman (Purchasing Officer · L1)'
    : user?.role === 'procurement_manager'
    ? 'Meera Pillai (Procurement Mgr · L2)'
    : user?.role === 'leadership'
    ? 'Leela Iyer (Plant Head · Leadership)'
    : user?.role === 'planner'
    ? 'Priya Nair (Demand Planner)'
    : `${user?.display_name || user?.username} (${user?.role})`

  const approvalLimitText = user?.role === 'buyer'
    ? 'Approves Purchase Orders < ₹10 Lakhs (L1 Sign-off)'
    : user?.role === 'procurement_manager'
    ? 'Approves Purchase Orders up to ₹50 Lakhs (L2 Co-sign)'
    : user?.role === 'leadership'
    ? 'Executive Authorization for All High-Value POs & Strategic Bottlenecks'
    : 'Demand & Requirement Planner (Audit View)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Page Header */}
      <div className="page-head">
        <PageIcon name="proposals" />
        <div>
          <div className="crumb">Replenishment &amp; Procurement › Purchase Order Approvals</div>
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0 }}>Purchase Order Approvals &amp; Sourcing Decisions</h1>
            <ScenarioTag />
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            Review, co-sign, and release purchase orders automatically sourced by <b>Agent #11 (Agentic RFQ Management Agent)</b>.
          </div>
        </div>
        <span className="spacer" />
        <button
          className="btn outline"
          onClick={() =>
            openAgent(
              'What purchase orders are currently awaiting my approval, and what price savings did Agent #11 negotiate?'
            )
          }
        >
          🤖 Consult Sourcing Agent
        </button>
      </div>

      {/* Sync Provenance Banner from Teammate's Agent #11 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)',
          border: '1.5px solid #C7D2FE',
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#4F46E5',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b style={{ color: '#1E1B4B', fontSize: 14 }}>
                Sourced by Agent #11: Agentic RFQ Management Agent
              </b>
              <span
                style={{
                  background: '#6366F1',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                SYNC ACTIVE
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#4338CA', marginTop: 2 }}>
              Inputs analyzed: <code>fact_rfq_quote.csv</code> · <code>dim_supplier.csv</code> ·{' '}
              <code>dim_material.csv</code> · <code>fact_purchase_order_receipt.csv</code>.
              Suppliers ranked on OTIF, quality compliance, and negotiated rate tiers.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="small muted" style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}>
              RFQ QUOTES EVALUATED
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1E1B4B' }}>3 Bids / Part</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="small muted" style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}>
              AVG RATE REDUCTION
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>5.5% Saved</div>
          </div>
        </div>
      </div>

      {/* Interactive Persona Switcher Bar for Seamless Approval Testing */}
      <div
        className="card"
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #E2E8F0',
          borderRadius: 10,
          padding: '12px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🎭 Switch Approval Persona (Interactive Testing)
            </span>
            <div style={{ fontSize: 12.5, color: '#0F172A', fontWeight: 600, marginTop: 2 }}>
              Current User: <span style={{ color: 'var(--brand-purple)', fontWeight: 800 }}>{roleName}</span>
              <span className="muted" style={{ marginLeft: 8, fontWeight: 400 }}>· {approvalLimitText}</span>
            </div>
          </div>
          {switchingUser && <span className="small muted">Switching role...</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className={`btn sm ${user?.role === 'buyer' ? 'primary' : 'outline'}`}
            style={{ fontSize: 12, padding: '5px 12px', fontWeight: 700 }}
            onClick={() => switchPersona('buyer')}
            title="Purchasing Officer - reviews all new POs, approves < ₹10L"
          >
            🛒 Bala Raman (Purchasing Officer · L1)
          </button>
          <button
            className={`btn sm ${user?.role === 'procurement_manager' ? 'primary' : 'outline'}`}
            style={{ fontSize: 12, padding: '5px 12px', fontWeight: 700 }}
            onClick={() => switchPersona('procmgr')}
            title="Procurement Manager - commercial approval & orders up to ₹50L"
          >
            👔 Meera Pillai (Procurement Mgr · L2)
          </button>
          <button
            className={`btn sm ${user?.role === 'leadership' ? 'primary' : 'outline'}`}
            style={{ fontSize: 12, padding: '5px 12px', fontWeight: 700 }}
            onClick={() => switchPersona('leader')}
            title="Plant Head - executive authorization on critical components"
          >
            👑 Leela Iyer (Plant Head · Leadership)
          </button>
          <button
            className={`btn sm ${user?.role === 'planner' ? 'primary' : 'outline'}`}
            style={{ fontSize: 12, padding: '5px 12px', fontWeight: 700 }}
            onClick={() => switchPersona('planner')}
            title="Production Planner - view origin demand triggers & capacity impact"
          >
            ⚙ Priya Nair (Planner · Demand)
          </button>
        </div>
      </div>

      {/* Top Approval KPIs */}
      {extra && (
        <div className="grid g3">
          <div className="card" style={{ borderLeft: '4px solid #F59E0B' }}>
            <div className="small muted" style={{ fontWeight: 600 }}>VALUE AWAITING APPROVAL</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
              {inr(extra.kpis.value_awaiting_inr)}
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              Across pending L1 &amp; L2 review queues
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #6366F1' }}>
            <div className="small muted" style={{ fontWeight: 600 }}>AVERAGE APPROVAL CYCLE</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
              {extra.kpis.avg_approval_hours_week ?? '3.2'} hours
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              Oldest pending order: {extra.kpis.oldest_pending_days ?? 1} day(s)
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #10B981' }}>
            <div className="small muted" style={{ fontWeight: 600 }}>CO-APPROVAL THRESHOLD</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
              {inr(extra.kpis.manager_threshold_inr)}
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              Orders &ge; threshold require Meera Pillai (L2) sign-off
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {DISPLAY_TABS.map((s) => (
          <button
            key={s}
            className={state === s ? 'on' : ''}
            onClick={() => {
              setState(s)
              setSel([])
            }}
            data-testid={`tab-${s}`}
          >
            {TAB_LABELS[s] || STATE_TEXT[s]}
            <span className="count">
              {extra?.tabs[s]?.count ?? ''}
              {extra?.tabs[s]?.value_inr ? ` · ${inr(extra?.tabs[s]?.value_inr ?? 0)}` : ''}
            </span>
          </button>
        ))}
      </div>

      {search && (
        <div
          style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 12,
            color: '#1E40AF',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span>
            💡 Searching for <b>"{search}"</b> in <b>{TAB_LABELS[state] || STATE_TEXT[state]}</b>. If not found in this tab:
          </span>
          <button
            className="btn sm"
            style={{ padding: '2px 8px', fontSize: 11, background: '#fff' }}
            onClick={() => setState('all')}
          >
            Search All Proposals ({extra?.tabs['all']?.count ?? 0})
          </button>
          <button
            className="btn sm"
            style={{ padding: '2px 8px', fontSize: 11, background: '#fff' }}
            onClick={() => setState('approved')}
          >
            View Approved ({extra?.tabs['approved']?.count ?? 0})
          </button>
        </div>
      )}

      {msg && (
        <div
          className="banner info"
          style={{ borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{msg}</span>
          <button
            className="btn sm"
            style={{ padding: '1px 6px', fontSize: 10, background: '#fff' }}
            onClick={() => setMsg(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Data Table */}
      <DataGrid<Row>
        id="proposals"
        url="/api/proposals"
        params={{ state, plant, kind, search }}
        columns={cols}
        rowKey={(r) => r.id}
        exportUrl="/api/proposals/export.xlsx"
        exportName="rfq_proposals.xlsx"
        defaultSort="needed_by"
        onRow={(r) => nav(`/proposals/${r.id}`)}
        onData={(e) => setExtra((e as Envelope<Paged<Row> & Extra>).data)}
        toolbar={
          <>
            <input
              placeholder="Search by PO#, material, or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 280 }}
            />
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All Orders (PO &amp; Transfer)</option>
              <option value="purchase">Purchase Orders Only</option>
              <option value="transfer">Transfers Only</option>
            </select>

            {/* Note: Create Manual PO commented out as automatic PO sourcing is owned by Agent #11 */}
            {/* <Link to="/procurement?action=manual" className="btn primary sm">+ Create Manual PO</Link> */}

            {state === 'pending_buyer' && can('replenishment', 'L1') && (
              <button
                className="btn primary sm"
                disabled={!sel.length}
                onClick={bulk}
                style={{ background: '#059669', borderColor: '#059669' }}
              >
                ✓ Bulk Approve Selected ({sel.length})
              </button>
            )}
          </>
        }
      />
    </div>
  )
}
