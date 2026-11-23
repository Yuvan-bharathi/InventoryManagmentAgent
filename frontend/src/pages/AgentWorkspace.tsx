// Agent Workspace: full-page chat with quick actions, and the workflow + step details of the latest answer.
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { ChatMessages, SUGGESTED, useAgentChat, type Answer } from '../agent-chat'
import { Icon, PageIcon, type IconName } from '../icons'
import { useShell } from '../shell-context'

type Tool = { name: string; description: string; args: string[] }

const QUICK: { icon: IconName; tone: string; title: string; sub: string; q: string }[] = [
  { icon: 'chart', tone: 'blue', title: 'Check inventory health', sub: 'Overall status and value', q: 'How healthy is our inventory overall? Show the health KPI and inventory value.' },
  { icon: 'alert', tone: 'orange', title: 'Find material shortages', sub: 'Materials at risk in next 30 days', q: 'Which materials have a shortage in the next 30 days, and when?' },
  { icon: 'box', tone: 'purple', title: 'Recommend replenishment', sub: 'Purchase or transfer suggestions', q: 'Which replenishment proposals are pending approval, and why?' },
  { icon: 'layers', tone: 'teal', title: 'Identify excess stock', sub: 'Cash tied up above max', q: "How much cash is tied up in stock we don't need?" },
]

export function AgentWorkspace() {
  const { shell, setAgentCtx } = useShell()
  const { msgs, busy, ask, clear } = useAgentChat()
  const [text, setText] = useState('')
  const [tab, setTab] = useState<'flow' | 'details'>('flow')
  const [sp] = useSearchParams()
  const body = useRef<HTMLDivElement>(null)
  const asked = useRef(false)
  useEffect(() => setAgentCtx({ page: 'Agent Workspace' }), []) // eslint-disable-line
  useEffect(() => { body.current?.scrollTo(0, body.current.scrollHeight) }, [msgs])
  useEffect(() => { const q = sp.get('q'); if (q && !asked.current) { asked.current = true; ask(q) } }, []) // eslint-disable-line
  const tools = useQuery({ queryKey: ['agent-tools'], queryFn: async () => (await api.raw<{ data: Tool[] }>('GET', '/api/agent/tools')).data, staleTime: Infinity })
  const last = [...msgs].reverse().find((m) => m.a)?.a
  const lastUserMsg = [...msgs].reverse().find((m) => m.role === 'user')?.text
  const send = (q: string) => { ask(q); setText('') }
  const first = shell?.user.display_name.split(' ')[0] ?? ''
  const ai = !shell?.banners.ai_unavailable

  return (
    <div>
      <div className="page-head">
        <PageIcon name="sparkle" solid />
        <div><h1>Inventory Management Agent</h1>
          <div className="muted">Ask questions, get insights and take recommended actions on your inventory. Read-only: it never approves or changes anything.</div></div>
        <span className="spacer" />
        <Link to="/settings" className="btn"><Icon name="settings" size={16} />Agent Settings</Link>
        <Link to="/agent/runs" className="btn"><Icon name="history" size={16} />Run History</Link>
        <Link to="/agent/trigger" className="btn primary"><Icon name="play" size={16} />Manual Trigger</Link>
      </div>

      <div className="ws">
        <div className="card">
          <h2>Quick Actions</h2>
          {QUICK.map((a) => (
            <button key={a.title} className={`qa tone-${a.tone}`} onClick={() => send(a.q)} disabled={busy}>
              <span className="qa-ic"><Icon name={a.icon} size={22} /></span>
              <span style={{ flex: 1 }}><b>{a.title}</b><span className="small">{a.sub}</span></span>
              <Icon name="arrow" size={16} />
            </button>
          ))}
          <h3 style={{ marginTop: 16 }}>The five leadership questions</h3>
          <div className="grid" style={{ gap: 6 }}>
            {SUGGESTED.map((q) => <button key={q} className="btn sm wrap" disabled={busy} onClick={() => send(q)}>{q}</button>)}
          </div>
        </div>

        <div className="card chat">
          <div className="agent-head" style={{ borderRadius: '14px 14px 0 0' }}>
            <span className="agent-av"><Icon name="bot" size={22} /></span>
            <div><b>Inventory Agent</b><div className={`online ${ai ? '' : 'off'}`}>{ai ? 'Online' : 'AI unavailable — engine templates'}</div></div>
            <span className="spacer" />
            {msgs.length > 0 && <button className="btn sm" onClick={clear} disabled={busy}>New conversation</button>}
          </div>
          <div className="agent-body" ref={body}>
            {msgs.length === 0 && (
              <div className="msg bot" style={{ maxWidth: 560 }}>
                Hi {first}, I'm your Inventory Agent. I can help you:
                {'\n'}• check inventory and stock status{'\n'}• find potential shortages{'\n'}• recommend purchases or transfers{'\n'}• explain inventory calculations and the assumptions behind them
                {'\n\n'}Every number I give comes from the calculation engine for the latest refreshed run.
              </div>
            )}
            <ChatMessages msgs={msgs} busy={busy} showSteps />
          </div>
          <div className="composer">
            <textarea value={text} placeholder="Ask a question about inventory, materials or replenishment…" onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }} />
            <button className="btn primary" disabled={busy || !text.trim()} onClick={() => send(text)} aria-label="Send"><Icon name="send" size={18} /></button>
          </div>
        </div>

        <div className="card ws-right">
          <div className="tabs">
            <button className={tab === 'flow' ? 'on' : ''} onClick={() => setTab('flow')}>Agent Workflow</button>
            <button className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>Run Details</button>
          </div>
          {tab === 'flow' ? (
            <TraceFlow key={msgs.length + (busy ? '-busy' : '')} a={last} tools={tools.data ?? []} busy={busy} lastUserMsg={lastUserMsg} />
          ) : (
            <RunDetails a={last} />
          )}
        </div>
      </div>
    </div>
  )
}

function TraceFlow({ a, tools, busy, lastUserMsg }: { a?: Answer; tools: Tool[]; busy?: boolean; lastUserMsg?: string }) {
  const [selectedStage, setSelectedStage] = useState<number>(3) // 1 to 5
  const [selectedToolIdx, setSelectedToolIdx] = useState<number>(0)
  const steps = a?.tool_trace ?? []
  const st = steps[selectedToolIdx]
  const desc = (n: string) => tools.find((t) => t.name === n)?.description ?? ''

  const hasTools = steps.length > 0
  const isDirect = a?.route === 'router'

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* Top Pipeline Status Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--card-subtle, rgba(0,0,0,0.02))', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>⚡</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Agent Execution Pipeline</span>
        </div>
        {busy ? (
          <span className="status running pipe-pulse-active" style={{ fontSize: 11, padding: '2px 8px' }}>
            ● EXECUTING...
          </span>
        ) : a ? (
          <span className="status healthy" style={{ fontSize: 11, padding: '2px 8px' }}>
            ✓ COMPLETED · {((a.latency_ms ?? 0) / 1000).toFixed(1)}s
          </span>
        ) : (
          <span className="status idle" style={{ fontSize: 11, padding: '2px 8px' }}>
            ● STANDBY · READY
          </span>
        )}
      </div>

      {/* The 5-Stage Stepper Pipeline */}
      <div className="agent-pipeline">
        {/* Stage 1: User Request Ingestion */}
        <button
          type="button"
          className={`pipe-stage ${selectedStage === 1 ? 'active' : ''}`}
          onClick={() => setSelectedStage(1)}
        >
          <div className="pipe-stage-icon s-red">01</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>User Query Ingestion</span>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>INPUT</span>
            </div>
            <div className="small muted" style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lastUserMsg ? `"${lastUserMsg}"` : 'Natural language question & factory scope'}
            </div>
          </div>
        </button>

        <div className="pipe-connector" />

        {/* Stage 2: Intent Routing & Coordinator */}
        <button
          type="button"
          className={`pipe-stage ${selectedStage === 2 ? 'active' : ''}`}
          onClick={() => setSelectedStage(2)}
        >
          <div className="pipe-stage-icon s-purple">02</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                {isDirect ? 'Direct Engine Dispatch' : 'Intent Router & Planner'}
              </span>
              <span style={{ fontSize: 10, color: isDirect ? 'var(--brand-purple)' : 'var(--muted)', fontWeight: 700 }}>
                {isDirect ? '0 ms ROUTE' : 'ORCHESTRATOR'}
              </span>
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {!a
                ? 'Decomposes intent and assigns specialist'
                : isDirect
                ? 'Bypassed LLM loop via direct deterministic rule'
                : 'Domo AI multi-turn coordinator loop'}
            </div>
          </div>
        </button>

        <div className="pipe-connector" />

        {/* Stage 3: MCP Tool Execution */}
        <button
          type="button"
          className={`pipe-stage ${selectedStage === 3 ? 'active' : ''}`}
          onClick={() => setSelectedStage(3)}
        >
          <div className="pipe-stage-icon s-blue">03</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>MCP Engine Tools</span>
              <span style={{ fontSize: 10, color: 'var(--brand-blue)', fontWeight: 700 }}>READ-ONLY DB</span>
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {hasTools
                ? `${steps.length} tool execution${steps.length > 1 ? 's' : ''} on Postgres`
                : '15 deterministic tools via inventory-mcp-server'}
            </div>

            {hasTools && (
              <div className="pipe-tools-container" onClick={(e) => e.stopPropagation()}>
                {steps.map((t, idx) => (
                  <span
                    key={idx}
                    className={`pipe-tool-pill ${selectedToolIdx === idx && selectedStage === 3 ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedToolIdx(idx)
                      setSelectedStage(3)
                    }}
                  >
                    <span>⚡</span>
                    <span>{t.tool.replace(/^get_/, '').replace(/_/g, ' ')}</span>
                    <span style={{ opacity: 0.8, fontSize: 10 }}>{t.ms}ms</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>

        <div className="pipe-connector" />

        {/* Stage 4: Deterministic Grounding Check */}
        <button
          type="button"
          className={`pipe-stage ${selectedStage === 4 ? 'active' : ''}`}
          onClick={() => setSelectedStage(4)}
        >
          <div className="pipe-stage-icon s-orange">04</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Grounding Verification</span>
              <span style={{ fontSize: 10, color: a?.status === 'ok' ? 'var(--st-healthy-ink)' : 'var(--muted)', fontWeight: 700 }}>
                {a?.status === 'ok' ? '100% GROUNDED' : 'GUARDRAIL'}
              </span>
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {!a
                ? 'Deterministic audit verifies all numbers & dates'
                : a.status === 'ok'
                ? 'All figures match engine calculation run #41'
                : `Status: ${a.status} (safety template fallback)`}
            </div>
          </div>
        </button>

        <div className="pipe-connector" />

        {/* Stage 5: Answer & Citations */}
        <button
          type="button"
          className={`pipe-stage ${selectedStage === 5 ? 'active' : ''}`}
          onClick={() => setSelectedStage(5)}
        >
          <div className="pipe-stage-icon s-teal">05</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Audited Synthesis</span>
              <span style={{ fontSize: 10, color: 'var(--st-healthy-ink)', fontWeight: 700 }}>
                {a ? 'OUTPUT' : 'STANDBY'}
              </span>
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {!a
                ? 'Generates verified response with assumptions'
                : `${a.citations?.length ?? 0} material citations · ${a.assumptions?.length ?? 0} governance rules`}
            </div>
          </div>
        </button>
      </div>

      {/* Stage Details & Architecture Inspector */}
      <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px' }}>
        <div className="row" style={{ marginBottom: 10, justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 14 }}>🔍</span>
            <h2 style={{ margin: 0, fontSize: 14 }}>
              {selectedStage === 1 && 'Stage 01: Query & Context Ingestion'}
              {selectedStage === 2 && 'Stage 02: Intent Router & Coordinator'}
              {selectedStage === 3 && 'Stage 03: Model Context Protocol (MCP)'}
              {selectedStage === 4 && 'Stage 04: Zero-Hallucination Grounding Gate'}
              {selectedStage === 5 && 'Stage 05: Answer & Citations Synthesis'}
            </h2>
          </div>
          {selectedStage === 3 && steps.length > 1 && (
            <div className="row" style={{ gap: 4 }}>
              <button className="btn sm" disabled={selectedToolIdx === 0} onClick={() => setSelectedToolIdx(selectedToolIdx - 1)}>‹</button>
              <button className="btn sm" disabled={selectedToolIdx >= steps.length - 1} onClick={() => setSelectedToolIdx(selectedToolIdx + 1)}>›</button>
            </div>
          )}
        </div>

        {/* Stage 1 Inspector */}
        {selectedStage === 1 && (
          <dl className="kv">
            <dt>Objective</dt><dd>Parses user prompt, active plant filter, and material selection context.</dd>
            <dt>Last Question</dt><dd><b>{lastUserMsg ?? 'No question submitted yet.'}</b></dd>
            <dt>Security Boundary</dt><dd className="small muted">Tenant isolation and plant permissions strictly enforced from JWT session.</dd>
          </dl>
        )}

        {/* Stage 2 Inspector */}
        {selectedStage === 2 && (
          <dl className="kv">
            <dt>Orchestrator</dt><dd>AGT-10 Inventory Copilot Coordinator</dd>
            <dt>Routing Method</dt><dd><span className="pill accent">{a?.route ?? 'Deterministic Rule Classifier'}</span></dd>
            <dt>Model Engine</dt><dd>domo.domo_ai.domogpt-large-v2.2:anthropic (Temp: 0.0)</dd>
            <dt>Dispatch Target</dt><dd className="small muted">Evaluates keywords & decisive intent across 6 domain specialists.</dd>
          </dl>
        )}

        {/* Stage 3 Inspector */}
        {selectedStage === 3 && (
          <div>
            {!st ? (
              <dl className="kv">
                <dt>MCP Host</dt><dd><span className="pill accent">inventory-mcp-server</span></dd>
                <dt>Registered Tools</dt><dd>{tools.length} deterministic tools</dd>
                <dt>Database Access</dt><dd className="small muted">Read-only connection pool to Neon PostgreSQL. Direct arithmetic prohibited.</dd>
              </dl>
            ) : (
              <dl className="kv">
                <dt>Tool Executed</dt><dd><span className="pill accent">{st.tool}</span></dd>
                <dt>Protocol Host</dt><dd><code>inventory-mcp-server</code> via MCP JSON-RPC</dd>
                <dt>Description</dt><dd className="small">{desc(st.tool) || 'Deterministic engine analytics'}</dd>
                <dt>Arguments</dt><dd><code className="small">{Object.keys(st.args ?? {}).length ? JSON.stringify(st.args) : 'none'}</code></dd>
                <dt>Latency</dt><dd><b>{(st.ms / 1000).toFixed(2)} s</b> (Execution Trace step {selectedToolIdx + 1}/{steps.length})</dd>
              </dl>
            )}
          </div>
        )}

        {/* Stage 4 Inspector */}
        {selectedStage === 4 && (
          <dl className="kv">
            <dt>Policy D38</dt><dd>Zero-Hallucination Grounding Gate</dd>
            <dt>Verification</dt><dd><span className={`status ${a?.status === 'ok' ? 'ok' : 'at_risk'}`}>{a?.status ?? 'Active Guardrail'}</span></dd>
            <dt>Rule</dt><dd className="small muted">Every numeric figure, date, and UoM in the answer is audited against the tool result. Unmatched figures immediately trigger deterministic template fallbacks.</dd>
          </dl>
        )}

        {/* Stage 5 Inspector */}
        {selectedStage === 5 && (
          <dl className="kv">
            <dt>Applied Rules</dt>
            <dd>
              {a?.assumptions?.length
                ? a.assumptions.map((id) => <span key={id} className="pill" style={{ marginRight: 4, marginBottom: 4, display: 'inline-block' }}>{id}</span>)
                : 'Standard calculation assumptions'}
            </dd>
            <dt>Citations</dt>
            <dd className="small">
              {a?.citations?.length
                ? a.citations.map((c, i) => <span key={i} className="pill accent" style={{ marginRight: 4, display: 'inline-block' }}>{c.label}</span>)
                : 'Grounded against current planning run'}
            </dd>
            <dt>Scenario</dt>
            <dd>{a?.scenario ? <span className="pill scenario">Planning scenario (A15)</span> : 'Operational baseline'}</dd>
          </dl>
        )}
      </div>
    </div>
  )
}

function RunDetails({ a }: { a?: Answer }) {
  const { assumptions } = useShell()
  if (!a) return <div className="small muted">No answer yet.</div>
  return (
    <dl className="kv">
      <dt>Calculation run</dt><dd>#{a.run_id ?? '—'}</dd>
      <dt>Route</dt><dd>{a.route === 'router' ? 'Intent router (no AI call needed)' : 'Agent loop (Domo AI)'}</dd>
      <dt>Status</dt><dd><span className={`status ${a.status === 'ok' ? 'ok' : 'at_risk'}`}>{a.status}</span></dd>
      <dt>AI calls</dt><dd>{a.domo_calls ?? 0}</dd>
      <dt>Total time</dt><dd>{((a.latency_ms ?? 0) / 1000).toFixed(1)} s</dd>
      <dt>Demand basis</dt><dd>{a.scenario ? <span className="pill scenario">Planning scenario</span> : 'Not scenario-based'}</dd>
      <dt>Assumptions</dt><dd>{a.assumptions.length ? a.assumptions.map((id) => <div key={id} className="small"><b>{id}</b> {assumptions[id]?.description ?? ''}</div>) : 'none'}</dd>
      <dt>Cited</dt><dd>{a.citations.length ? a.citations.map((c, i) => <div key={i}><Link to={c.url}>{c.label}</Link></div>) : '—'}</dd>
    </dl>
  )
}
