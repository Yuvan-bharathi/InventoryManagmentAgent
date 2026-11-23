// Proposal Detail entry from the sidebar: pick a live proposal (pending first, then drafts) to open its detail page.
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, qs, type Paged } from '../api'
import { day, inr, qty, STATE_TEXT } from '../format'
import { PageState } from '../kit'
import { PageIcon } from '../icons'
import { useShell } from '../shell-context'

type R = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export function ProposalPicker() {
  const nav = useNavigate()
  const { plant, setAgentCtx } = useShell()
  useEffect(() => setAgentCtx({ page: 'Proposal Detail' }), []) // eslint-disable-line
  const q = useQuery({ queryKey: ['proposal-pick', plant], queryFn: () =>
    api.get<Paged<R>>('/api/proposals' + qs({ state: 'pending_buyer,pending_manager,draft', plant, page_size: 60, sort: 'needed_by' })) })
  const rows = q.data?.data.rows ?? []
  const order = (r: R) => (r.state === 'draft' ? 1 : 0)
  return (
    <div>
      <div className="page-head"><PageIcon name="proposal" />
        <div><h1>Proposal Detail</h1>
          <div className="muted">Pick a proposal to see its calculation, timeline and decision panel. Pending approvals first.</div></div></div>
      <PageState loading={q.isLoading} error={q.error} empty={rows.length === 0} emptyText="No draft or pending proposals.">
        <div className="grid g3">{[...rows].sort((a, b) => order(a) - order(b)).map((r) => (
          <button key={r.id} className="card kpi" onClick={() => nav(`/proposals/${r.id}`)}>
            <div className="row" style={{ gap: 8 }}>
              <b>{r.proposal_no}</b><span className="pill">{r.kind === 'transfer' ? 'Transfer' : 'PO'}</span>
              <span className="spacer" /><span className={`pill ${r.state === 'draft' ? '' : 'accent'}`}>{STATE_TEXT[r.state]}</span>
            </div>
            <div className="small muted" style={{ margin: '6px 0' }}>{r.material_id} · {r.material_name} · {r.plant_id}</div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{inr(r.value_inr)}</span>
              <span className="small muted">{qty(r.qty, r.uom)} · needed by {day(r.needed_by)}</span>
            </div>
          </button>))}</div>
      </PageState>
    </div>
  )
}
