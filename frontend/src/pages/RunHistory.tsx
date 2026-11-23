// Run History: calculation runs (one per upload) and agent runs (every question, with its tool trace).
import { useQuery } from '@tanstack/react-query'
import { Fragment, useEffect, useState } from 'react'
import { api } from '../api'
import { day, inr, pct } from '../format'
import { PageState } from '../kit'
import { Icon, PageIcon } from '../icons'
import { useShell } from '../shell-context'

type CalcRun = { run_id: number; upload_id: number; as_of: string; started_at: string | null; duration_s: number | null; status: string;
  file_name: string; uploaded_by: string; issues_found: number | null; inventory_health_pct: number | null;
  critical_in_7_days: number | null; excess_value_inr: number | null }
type AgentRun = { id: number; username: string; run_id: number | null; question: string; route: string | null; status: string;
  domo_calls: number; latency_ms: number; tool_calls: { tool: string; ms: number }[]; answer: string | null; at: string | null }

const when = (s: string | null) => s ? `${day(s)} ${new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : '—'

export function RunHistory() {
  const { meta, setAgentCtx } = useShell()
  const [tab, setTab] = useState<'agent' | 'calc'>('agent')
  const [mine, setMine] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => setAgentCtx({ page: 'Run History' }), []) // eslint-disable-line
  const calc = useQuery({ queryKey: ['calc-runs'], queryFn: async () => (await api.raw<{ data: CalcRun[] }>('GET', '/api/runs')).data })
  const agent = useQuery({ queryKey: ['agent-runs', mine], queryFn: async () => (await api.raw<{ data: AgentRun[] }>('GET', `/api/agent/runs?mine=${mine}`)).data })

  return (
    <div>
      <div className="page-head">
        <PageIcon name="history" />
        <div><h1>Run History</h1><div className="muted">Every agent question and every calculation run, newest first.</div></div>
      </div>
      <div className="tabs">
        <button className={tab === 'agent' ? 'on' : ''} onClick={() => setTab('agent')}>Agent runs<span className="count">{agent.data?.length ?? ''}</span></button>
        <button className={tab === 'calc' ? 'on' : ''} onClick={() => setTab('calc')}>Calculation runs<span className="count">{calc.data?.length ?? ''}</span></button>
      </div>

      {tab === 'agent' ? (
        <div className="card">
          <div className="card-head"><h2>Agent runs</h2><span className="spacer" />
            <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Only mine</label></div>
          <PageState loading={agent.isLoading} error={agent.error} empty={agent.data?.length === 0} emptyText="No agent questions yet.">
            <div className="table-wrap">
              <table className="dg">
                <thead><tr><th>When</th><th>User</th><th style={{ minWidth: 280 }}>Question</th><th>Route</th><th>Tools</th><th className="num">AI calls</th><th className="num">Time</th><th>Status</th><th className="num">Run</th></tr></thead>
                <tbody>{agent.data?.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="click" onClick={() => setOpen(open === r.id ? null : r.id)}>
                      <td style={{ whiteSpace: 'nowrap' }}>{when(r.at)}</td>
                      <td>{r.username}</td>
                      <td>{r.question}</td>
                      <td><span className="pill">{r.route === 'router' ? 'Direct' : r.route ?? '—'}</span></td>
                      <td className="small">{r.tool_calls?.length ?? 0}</td>
                      <td className="num">{r.domo_calls}</td>
                      <td className="num">{(r.latency_ms / 1000).toFixed(1)} s</td>
                      <td><span className={`status ${r.status === 'ok' ? 'ok' : 'at_risk'}`}>{r.status}</span></td>
                      <td className="num">#{r.run_id ?? '—'}</td>
                    </tr>
                    {open === r.id && (
                      <tr><td colSpan={9} style={{ background: 'var(--surface-2)' }}>
                        <div className="small muted" style={{ marginBottom: 6 }}>
                          {(r.tool_calls ?? []).map((t, i) => <span key={i}>{i ? ' → ' : ''}<code>{t.tool}</code> ({t.ms} ms)</span>)}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{r.answer}</div>
                      </td></tr>
                    )}
                  </Fragment>
                ))}</tbody>
              </table>
            </div>
          </PageState>
        </div>
      ) : (
        <div className="card">
          <div className="card-head"><h2>Calculation runs</h2><span className="small muted">one per upload · KPIs as stored with the run</span></div>
          <PageState loading={calc.isLoading} error={calc.error} empty={calc.data?.length === 0} emptyText="No calculation runs yet.">
            <div className="table-wrap">
              <table className="dg">
                <thead><tr><th>Run</th><th>Started</th><th>Data as of</th><th>Files</th><th>By</th><th className="num">DQ issues</th>
                  <th className="num">Health</th><th className="num">Critical ≤ 7 d</th><th className="num">Excess value</th><th className="num">Duration</th><th>Status</th></tr></thead>
                <tbody>{calc.data?.map((r) => (
                  <tr key={r.run_id}>
                    <td><b>#{r.run_id}</b>{r.run_id === meta?.run_id && <span className="pill accent" style={{ marginLeft: 6 }}>current</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{when(r.started_at)}</td>
                    <td>{day(r.as_of)}</td>
                    <td className="small" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.file_name}>{r.file_name}</td>
                    <td>{r.uploaded_by}</td>
                    <td className="num">{r.issues_found ?? '—'}</td>
                    <td className="num">{pct(r.inventory_health_pct)}</td>
                    <td className="num">{r.critical_in_7_days ?? '—'}</td>
                    <td className="num">{inr(r.excess_value_inr)}</td>
                    <td className="num">{r.duration_s === null ? '—' : `${r.duration_s} s`}</td>
                    <td><span className={`status ${r.status === 'succeeded' ? 'ok' : 'at_risk'}`}>{r.status}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </PageState>
        </div>
      )}
      <div className="small muted" style={{ marginTop: 10 }}><Icon name="refresh" size={12} /> Numbers are refreshed per calculation run, not live.</div>
    </div>
  )
}
