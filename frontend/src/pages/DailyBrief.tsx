import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, download } from '../api'
import { day, inr } from '../format'
import { AssumptionIds, PageState, ScenarioTag } from '../kit'
import { PageIcon } from '../icons'
import { useShell } from '../shell-context'

type B = { id: number; run_id: number; kind: string; text: string; facts: Record<string, any>; model_id?: string | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  created_at: string; error?: string | null }
type BriefResp = { brief: B | null; history: { id: number; run_id: number; kind: string; created_at: string }[] }

export function DailyBrief() {
  const { setAgentCtx, openAgent, meta } = useShell()
  const [pick, setPick] = useState<number | null>(null)
  useEffect(() => setAgentCtx({ page: 'Daily Brief' }), []) // eslint-disable-line
  const q = useQuery({ queryKey: ['brief'], queryFn: () => api.get<BriefResp>('/api/brief') })
  const old = useQuery({ queryKey: ['brief', pick], enabled: pick !== null, queryFn: () => api.get<B>(`/api/brief/${pick}`) })
  const b = pick !== null ? old.data?.data : q.data?.data.brief
  const f = b?.facts
  return (
    <div>
      <div className="page-head"><PageIcon name="brief" />
        <div><div className="crumb">Insights › Daily Brief & Reports</div><h1>Daily Brief</h1>
          <div className="muted">Replaces the hand-made daily report. Every number comes from the calculation engine.</div></div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => download('/api/reports/daily-stock.xlsx', `daily_stock_report_run${meta?.run_id}.xlsx`)}>Download daily stock report (.xlsx)</button>
      </div>
      <PageState loading={q.isLoading} error={q.error} empty={!q.data?.data.brief} emptyText="No brief yet — upload the dataset.">
        <div className="grid g3">
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="row"><h2>{pick ? 'Brief' : "Today's brief"}</h2><span className="pill" data-testid="brief-kind">{b?.kind === 'ai' ? `AI · ${b.model_id ?? ''}` : 'Template (engine numbers)'}</span>
              <ScenarioTag /><span className="spacer" /><span className="small muted">run #{b?.run_id} · {b && new Date(b.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span></div>
            {b?.error && <div className="banner info" style={{ borderRadius: 8, margin: '8px 0' }}>AI unavailable when this brief was made — template used. <span className="small muted">{b.error}</span></div>}
            <pre className="brief">{b?.text}</pre>
            <div className="row" style={{ marginTop: 12 }}>
              {['Will any line stop because of a material?', 'What is waiting for my approval, and why?'].map((x) => <button key={x} className="btn sm" onClick={() => openAgent(x)}>{x}</button>)}
            </div>
          </div>
          <div className="grid">
            {f && <div className="card"><h2>Numbers behind the brief</h2><dl className="kv">
              <dt>Data as of</dt><dd>{day(f.as_of)}</dd>
              <dt>Critical · at risk</dt><dd>{f.status_counts?.critical} · {f.status_counts?.at_risk}</dd>
              <dt>Orders at risk (14 d)</dt><dd>{f.production_orders_at_risk_14d}</dd>
              <dt>Excess value</dt><dd>{inr(f.excess_value_inr)}</dd>
              <dt>Expiring 30 d</dt><dd>{inr(f.expiring_30d_value_inr)}</dd>
              <dt>Overdue PO lines</dt><dd>{f.overdue_po_lines} / {f.open_po_lines}</dd>
              <dt>Health</dt><dd>{f.inventory_health_pct}%</dd>
              <dt>DQ issues</dt><dd>{f.dq_issues}</dd></dl>
              <div className="small muted" style={{ marginTop: 8 }}>Assumptions: <AssumptionIds ids={q.data?.meta.assumption_ids} /></div></div>}
            <div className="card"><h2>Brief history</h2>
              <table className="dg compact"><tbody>{q.data?.data.history.map((h) => <tr key={h.id} className="click" onClick={() => setPick(h.id === q.data?.data.brief?.id ? null : h.id)}>
                <td>{new Date(h.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td><td>run #{h.run_id}</td><td><span className="pill">{h.kind}</span></td></tr>)}</tbody></table></div>
          </div>
        </div>
      </PageState>
    </div>
  )
}
