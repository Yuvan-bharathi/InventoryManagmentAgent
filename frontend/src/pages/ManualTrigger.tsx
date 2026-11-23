// Manual Trigger: run the four-step inventory agent workflow on demand (read-only questions, each logged in Run History),
// or recalculate by uploading the dataset again.
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { askOnce, type Answer } from '../agent-chat'
import { day } from '../format'
import { Icon, PageIcon, type IconName } from '../icons'
import { useShell } from '../shell-context'

type StepDef = { key: string; icon: IconName; title: string; q: string }
const STEPS: StepDef[] = [
  { key: 'stock', icon: 'layers', title: 'Analyse stock', q: 'How healthy is our inventory overall? Show the health KPI and inventory value.' },
  { key: 'demand', icon: 'chart', title: 'Check demand', q: 'Which materials have a shortage in the next 30 days, and when?' },
  { key: 'risk', icon: 'alert', title: 'Identify risks', q: 'Will any line stop because of a material?' },
  { key: 'act', icon: 'sparkle', title: 'Recommend actions', q: 'What is waiting for my approval, and why?' },
]
type Res = { state: 'idle' | 'running' | 'done' | 'error'; a?: Answer; err?: string; ms?: number }

export function ManualTrigger() {
  const { meta, plant, can, setAgentCtx } = useShell()
  const qc = useQueryClient()
  const [sp] = useSearchParams()
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(STEPS.map((s) => [s.key, true])))
  const [res, setRes] = useState<Record<string, Res>>({})
  const [running, setRunning] = useState(false)
  const started = useRef(false)
  useEffect(() => setAgentCtx({ page: 'Manual Trigger' }), []) // eslint-disable-line

  async function run() {
    if (running) return
    setRunning(true)
    setRes(Object.fromEntries(STEPS.filter((s) => on[s.key]).map((s) => [s.key, { state: 'idle' } as Res])))
    for (const s of STEPS.filter((x) => on[x.key])) {
      setRes((r) => ({ ...r, [s.key]: { state: 'running' } }))
      const t0 = performance.now()
      try {
        const a = await askOnce(s.q, { page: 'Manual Trigger', plant: plant || null, item: null })
        setRes((r) => ({ ...r, [s.key]: { state: 'done', a, ms: performance.now() - t0 } }))
      } catch (e) {
        setRes((r) => ({ ...r, [s.key]: { state: 'error', err: (e as Error).message, ms: performance.now() - t0 } }))
      }
    }
    setRunning(false)
    qc.invalidateQueries({ queryKey: ['agent-runs'] })
  }
  useEffect(() => { if (sp.get('run') === '1' && !started.current) { started.current = true; run() } }, []) // eslint-disable-line

  return (
    <div>
      <div className="page-head">
        <PageIcon name="play" />
        <div><h1>Manual Trigger</h1>
          <div className="muted">Run the inventory agent workflow now. It only reads results of run #{meta?.run_id ?? '—'} (data as of {day(meta?.as_of)}); nothing is approved or changed.</div></div>
      </div>

      <div className="grid g3" style={{ alignItems: 'start' }}>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-head">
            <h2>Run Inventory Agent Workflow</h2><span className="spacer" />
            {plant && <span className="pill">{plant}</span>}
            <button className="btn primary" onClick={run} disabled={running || !STEPS.some((s) => on[s.key])} data-testid="run-workflow">
              <Icon name="play" size={16} />{running ? 'Running…' : 'Run Agent'}</button>
          </div>
          <div className="grid" style={{ gap: 12 }}>
            {STEPS.map((s, i) => {
              const r = res[s.key]
              return (
                <div key={s.key} className="card" style={{ padding: '14px 16px', boxShadow: 'none', background: 'var(--surface-2)' }}>
                  <div className="row" style={{ gap: 10 }}>
                    <input type="checkbox" checked={on[s.key]} disabled={running} onChange={(e) => setOn({ ...on, [s.key]: e.target.checked })} aria-label={s.title} />
                    <span className="kpi-icon" style={{ width: 28, height: 28 }}><Icon name={s.icon} size={20} /></span>
                    <b>{i + 1}. {s.title}</b>
                    <span className="small muted" style={{ flex: 1 }}>“{s.q}”</span>
                    <StepState r={r} />
                  </div>
                  {r?.a && (
                    <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.55 }}>
                      {r.a.answer}
                      <div className="trace">
                        {r.a.citations.length > 0 && <div>Cites: {r.a.citations.slice(0, 8).map((c, j) => <span key={j}>{j ? ', ' : ''}<Link to={c.url}>{c.label}</Link></span>)}</div>}
                        {(r.a.assumptions.length > 0 || r.a.scenario) && <div>Based on {r.a.scenario ? 'the planning scenario; ' : ''}{r.a.assumptions.length ? `assumptions ${r.a.assumptions.join(', ')}` : ''}</div>}
                        <div>{r.a.tool_trace.map((t) => t.tool).join(' → ')} · {r.a.domo_calls ?? 0} AI call(s)</div>
                      </div>
                    </div>
                  )}
                  {r?.err && <div className="small" style={{ color: 'var(--st-critical-ink)', marginTop: 8 }}>AI is unavailable right now. ({r.err})</div>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <h2>Recalculate inventory</h2>
            <p className="small muted" style={{ marginTop: 0 }}>A calculation run (data-quality gate → planning scenario → engine → proposals → brief) starts when the dataset is uploaded. Upload today's files to refresh the numbers.</p>
            {can('data', 'A') ? <Link to="/uploads" className="btn outline"><Icon name="upload" size={16} />Go to Data Uploads</Link>
              : <div className="small muted">Your role can view runs but not upload data.</div>}
          </div>
          <div className="card">
            <h2>Where results go</h2>
            <p className="small muted" style={{ margin: 0 }}>Every step is logged with its tool calls and timing. See <Link to="/agent/runs">Run History</Link>, or continue the conversation in the <Link to="/agent">Agent Workspace</Link>.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepState({ r }: { r?: Res }) {
  if (!r) return null
  if (r.state === 'idle') return <span className="pill">Queued</span>
  if (r.state === 'running') return <span className="pill accent">Running…</span>
  if (r.state === 'error') return <span className="status critical">Failed</span>
  return <span className={`status ${r.a?.status === 'ok' ? 'ok' : 'at_risk'}`}>{r.a?.status === 'ok' ? 'Done' : r.a?.status} · {((r.ms ?? 0) / 1000).toFixed(1)} s</span>
}
