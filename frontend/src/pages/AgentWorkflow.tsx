// Agent Workflow: how the agent answers (router / loop / tools / grounding) and how a calculation run is produced.
import { useQuery } from '@tanstack/react-query'
import { Fragment, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Icon, PageIcon, type IconName } from '../icons'
import { useShell } from '../shell-context'

type Tool = { name: string; description: string; args: string[] }

const ANSWER: { icon: IconName; tone: string; title: string; text: string }[] = [
  { icon: 'sparkle', tone: 'red', title: 'User request', text: 'Question plus context: page, plant filter and the selected material or proposal.' },
  { icon: 'route', tone: 'purple', title: 'Plan & route', text: 'Routable questions (incl. the five leadership questions) go straight to the right tool. Others enter the agent loop: Domo AI picks one tool per step, temperature 0, at most 5 steps.' },
  { icon: 'db', tone: 'blue', title: 'Engine tools (read-only)', text: 'Each tool returns validated JSON computed by the deterministic engine for the latest run. The agent never does inventory arithmetic and has no write tool.' },
  { icon: 'shield', tone: 'orange', title: 'Grounding check', text: 'Any number or date in the AI answer that is not in the tool results replaces the answer with the engine template.' },
  { icon: 'check', tone: 'teal', title: 'Answer', text: 'Cites the materials and proposals it used and names the assumptions and the planning scenario where they apply.' },
]

const PIPELINE: { icon: IconName; title: string; text: string }[] = [
  { icon: 'upload', title: 'Upload', text: 'ZIP or CSVs; raw files are never modified' },
  { icon: 'shield', title: 'Data-quality gate', text: '12 checks; errors exclude rows' },
  { icon: 'chart', title: 'Planning scenario', text: 'Fills the missing forward plan (A15)' },
  { icon: 'gear', title: 'Engine', text: 'Usable stock, projection, shortage date, status' },
  { icon: 'proposals', title: 'Proposals', text: 'Drafts with MOQ and lead time; need approval' },
  { icon: 'brief', title: 'Daily brief', text: 'AI text, or template if AI is down' },
]

export function AgentWorkflow() {
  const { setAgentCtx } = useShell()
  useEffect(() => setAgentCtx({ page: 'Agent Workflow' }), []) // eslint-disable-line
  const tools = useQuery({ queryKey: ['agent-tools'], queryFn: async () => (await api.raw<{ data: Tool[] }>('GET', '/api/agent/tools')).data, staleTime: Infinity })
  const status = useQuery({ queryKey: ['agent-status'], queryFn: () => api.raw<{ available: boolean; reason: string | null }>('GET', '/api/agent/status') })

  return (
    <div>
      <div className="page-head">
        <PageIcon name="workflow" />
        <div><h1>Agent Workflow</h1>
          <div className="muted">How the Inventory Agent answers a question, and how each refreshed calculation run is produced.</div></div>
        <span className="spacer" />
        {status.data && <span className={`online ${status.data.available ? '' : 'off'}`}>{status.data.available ? 'Domo AI available' : `AI unavailable · ${status.data.reason ?? ''}`}</span>}
        <Link to="/agent" className="btn primary"><Icon name="sparkle" size={16} />Open Agent Workspace</Link>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2>Answering a question</h2>
          <div className="flow" style={{ alignItems: 'stretch' }}>
            {ANSWER.map((s, i) => (
              <Fragment key={s.title}>
                {i > 0 && <span className="fline" style={{ alignSelf: 'center' }} />}
                <div className={`fnode n-${s.tone}`} style={{ justifyContent: 'flex-start', textAlign: 'left', alignItems: 'flex-start', gap: 12, padding: '12px 14px' }}>
                  <span style={{ marginTop: 2 }}><Icon name={s.icon} size={18} /></span>
                  <div><div>{i + 1}. {s.title}</div><div className="small" style={{ fontWeight: 500, color: 'var(--text)', marginTop: 3 }}>{s.text}</div></div>
                </div>
              </Fragment>
            ))}
          </div>
          <div className="small muted" style={{ marginTop: 12 }}>
            If Domo AI fails, routable questions still get engine-number answers marked "AI unavailable"; the rest of the app keeps working.
          </div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <h2>Producing a calculation run</h2>
            <div className="grid" style={{ gap: 8 }}>
              {PIPELINE.map((s, i) => (
                <div key={s.title} className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                  <span className="check" style={{ width: 26, height: 26, fontSize: 12 }}>{i + 1}</span>
                  <span className="kpi-icon" style={{ width: 28, height: 28 }}><Icon name={s.icon} size={20} /></span>
                  <div><b>{s.title}</b> <span className="small muted">— {s.text}</span></div>
                </div>
              ))}
            </div>
            <div className="small muted" style={{ marginTop: 12 }}>Runs on every upload (<Link to="/uploads">Data Uploads</Link>). Numbers are refreshed per run, not live. See <Link to="/agent/runs">Run History</Link>.</div>
          </div>
          <div className="card">
            <h2>Guardrails</h2>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Read-only database session; the agent has no write tool.</li>
              <li>Nothing is executed automatically — every proposal needs the purchasing officer, plus a manager above the threshold.</li>
              <li>Tenant and plant access come from your sign-in, never from the question.</li>
              <li>No quantity totals across materials (mixed units); totals are in ₹ only.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Tools the agent can use</h2><span className="pill accent">{tools.data?.length ?? 0} read-only tools</span></div>
        <div className="table-wrap">
          <table className="dg">
            <thead><tr><th>Tool</th><th>What it returns</th><th>Arguments</th></tr></thead>
            <tbody>{tools.data?.map((t) => (
              <tr key={t.name}><td><code>{t.name}</code></td><td>{t.description}</td><td className="small muted">{t.args.join(', ') || 'none'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
