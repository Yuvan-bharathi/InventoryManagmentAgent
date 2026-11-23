// Shared agent chat: SSE streaming to /api/agent/chat/stream, message list, answer trace.
// Used by the side panel and the Agent Workspace page.
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { token, API_BASE } from './api'
import { useShell } from './shell-context'
import { MarkdownView } from './components/MarkdownView'

export type Citation = { type: string; id: string; label: string; url: string }
export type Step = { tool: string; args: Record<string, unknown>; ms: number; summary?: string; error?: string }
export type Answer = { answer: string; citations: Citation[]; assumptions: string[]; scenario: boolean; status: string;
  route?: string; tool_trace: Step[]; run_id?: number; domo_calls?: number; latency_ms?: number }
export type Msg = { role: 'user' | 'bot'; text: string; a?: Answer; at: number }

export const SUGGESTED = [
  'Will any line stop because of a material?',
  "How much cash is tied up in stock we don't need?",
  'What is about to expire or become waste?',
  'What is waiting for my approval, and why?',
  'If a supplier is late, what breaks?',
]

/** One question, no UI: used by the Manual Trigger workflow run. */
export async function askOnce(question: string, context: Record<string, unknown>): Promise<Answer> {
  const r = await fetch(`${API_BASE}/api/agent/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.get()}` },
    body: JSON.stringify({ question, context }),
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json() as Promise<Answer>
}

export function useAgentChat() {
  const { agentCtx, plant } = useShell()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  async function ask(q: string) {
    if (!q.trim() || busyRef.current) return
    busyRef.current = true
    setMsgs((m) => [...m, { role: 'user', text: q, at: Date.now() }, { role: 'bot', text: '', at: Date.now() }])
    setBusy(true)
    try {
      const r = await fetch(`${API_BASE}/api/agent/chat/stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.get()}` },
        body: JSON.stringify({ question: q, context: { page: agentCtx.page, plant: plant || null, item: agentCtx.item ?? null } }),
      })
      if (!r.ok || !r.body) throw new Error(r.status === 404 ? 'AI unavailable right now' : `${r.status} ${r.statusText}`)
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2)
          const line = chunk.replace(/^data: /, '')
          if (!line) continue
          const ev = JSON.parse(line) as { type: string; text?: string; result?: Answer }
          setMsgs((m) => {
            const c = [...m]; const last = { ...c[c.length - 1] }
            if (ev.type === 'delta') last.text += ev.text ?? ''
            if (ev.type === 'final' && ev.result) { last.a = ev.result; last.text = ev.result.answer; last.at = Date.now() }
            c[c.length - 1] = last; return c
          })
        }
      }
    } catch (e) {
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: 'bot', text: `AI is unavailable right now. (${(e as Error).message})`, at: Date.now() }; return c })
    } finally { busyRef.current = false; setBusy(false) }
  }
  return { msgs, busy, ask, clear: () => setMsgs([]) }
}

const time = (t: number) => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

export function ChatMessages({ msgs, busy, onNavigate, showSteps = false }:
  { msgs: Msg[]; busy: boolean; onNavigate?: () => void; showSteps?: boolean }) {
  return (
    <>
      {msgs.map((m, i) => (
        <div key={i} className={`msg ${m.role}`} data-testid={m.role === 'bot' ? 'bot-msg' : undefined}>
          {m.role === 'bot' ? (
            m.text ? (
              <MarkdownView content={m.text} />
            ) : busy && i === msgs.length - 1 ? (
              <div className="agent-thinking">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span style={{ marginLeft: 6 }}>Analyzing live inventory data…</span>
              </div>
            ) : null
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
          )}
          {m.a && <AnswerMeta a={m.a} onNavigate={onNavigate} showSteps={showSteps} />}
          {showSteps && <div className="small muted" style={{ marginTop: 6, textAlign: 'right', fontSize: 11 }}>{time(m.at)}</div>}
        </div>
      ))}
    </>
  )
}

function AnswerMeta({ a, onNavigate, showSteps }: { a: Answer; onNavigate?: () => void; showSteps: boolean }) {
  const [showAssumptions, setShowAssumptions] = useState(false)

  return (
    <div className="agent-meta-trace">
      {/* 1. Quick Access Citation Pills */}
      {a.citations && a.citations.length > 0 && (
        <div className="agent-citations-section">
          <div className="agent-citations-label">📍 Quick Material Links:</div>
          <div className="agent-citation-pills">
            {a.citations.map((c, j) => (
              <Link key={j} to={c.url} onClick={onNavigate} className="agent-citation-pill">
                <span>{c.label}</span>
                <span className="pill-arrow">↗</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 2. Assumptions & Scenario Disclosure */}
      {(a.assumptions.length > 0 || a.scenario) && (
        <div className="agent-assumptions-box">
          <button
            type="button"
            className="agent-assumptions-toggle"
            onClick={() => setShowAssumptions(!showAssumptions)}
          >
            <span>ℹ️ Calculation Context: <strong>{a.scenario ? 'Planning Scenario (A21)' : 'Default Plan'}</strong></span>
            {a.assumptions.length > 0 && (
              <span className="pill sm" style={{ fontSize: 10, padding: '2px 6px', fontWeight: 600 }}>
                {a.assumptions.length} assumptions applied {showAssumptions ? '▲' : '▼'}
              </span>
            )}
          </button>
          {showAssumptions && (
            <div className="agent-assumptions-content">
              <strong>Governing Engine Assumptions:</strong>
              <div style={{ marginTop: 4 }}>{a.assumptions.join(' · ')}</div>
            </div>
          )}
        </div>
      )}

      {/* 3. Workflow Steps */}
      {showSteps && a.tool_trace.length > 0 ? (
        <details className="steps-box" open>
          <summary>
            <span>Agent Execution Workflow ({a.tool_trace.length} step{a.tool_trace.length > 1 ? 's' : ''})</span>
            <span className="spacer" />
            <span className="muted">{( (a.latency_ms ?? 0) / 1000).toFixed(1)} s latency</span>
          </summary>
          <ol>
            {a.tool_trace.map((t, j) => (
              <li key={j}>
                <span className={`check ${t.error ? 'err' : ''}`}>{t.error ? '!' : '✓'}</span>
                <span style={{ flex: 1, fontWeight: 500 }}>{j + 1}. {t.tool}</span>
                <span className="muted">{(t.ms / 1000).toFixed(2)} s</span>
              </li>
            ))}
          </ol>
        </details>
      ) : (
        <div className="small muted" style={{ marginTop: 6, fontSize: 11 }}>
          {a.route === 'router' ? 'Direct Engine Dispatch' : 'Autonomous Agent Loop'} · {a.tool_trace.map((t) => `${t.tool} (${t.ms} ms)`).join(' → ')} · {((a.latency_ms ?? 0) / 1000).toFixed(1)} s
        </div>
      )}

      {/* 4. Verification / Grounding Status */}
      {a.status && (
        <div className="agent-status-tag">
          {a.status === 'ok' ? (
            <span className="pill sm" style={{ background: '#DCFCE7', color: '#15803D', fontWeight: 600 }}>
              ✓ Deterministic Grounding Verified
            </span>
          ) : a.status === 'grounding_fallback' ? (
            <span className="pill sm" style={{ background: '#EFF6FF', color: '#1D4ED8', fontWeight: 600 }}>
              🛡️ Verified Calculation Engine Template (Deterministic)
            </span>
          ) : (
            <span className="pill sm" style={{ background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
              ⚠️ Engine Status: {a.status}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
