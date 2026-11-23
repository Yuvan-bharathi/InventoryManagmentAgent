// Agent side panel: sends page, plant filter and selected item as context; renders cited links and the tool trace.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChatMessages, SUGGESTED, useAgentChat } from './agent-chat'
import { Icon } from './icons'
import { useShell } from './shell-context'

export function AgentPanel({ onClose, initialQuestion }: { onClose: () => void; initialQuestion?: string }) {
  const { agentCtx, plant, shell } = useShell()
  const { msgs, busy, ask } = useAgentChat()
  const [text, setText] = useState('')
  const body = useRef<HTMLDivElement>(null)
  const asked = useRef(false)
  const send = (q: string) => { ask(q); setText('') }

  useEffect(() => { if (initialQuestion && !asked.current) { asked.current = true; ask(initialQuestion) } }, [initialQuestion]) // eslint-disable-line
  useEffect(() => { body.current?.scrollTo(0, body.current.scrollHeight) }, [msgs])

  return (
    <aside className="agent" data-testid="agent-panel">
      <div className="agent-head">
        <span className="agent-av"><Icon name="bot" size={22} /></span>
        <div>
          <b>Inventory Agent</b>
          <div className={`online ${shell?.banners.ai_unavailable ? 'off' : ''}`}>{shell?.banners.ai_unavailable ? 'AI unavailable' : 'Online'}</div>
        </div>
        <span className="spacer" />
        <Link to="/agent" className="btn sm ghost" onClick={onClose} title="Open Agent Workspace">Expand</Link>
        <button className="btn sm" onClick={onClose}>Close</button>
      </div>
      <div className="small muted" style={{ padding: '8px 16px 0' }}>
        <span className="pill">{agentCtx.page}{agentCtx.item ? ` · ${agentCtx.item.label ?? agentCtx.item.id}` : ''}{plant ? ` · ${plant}` : ''}</span>
      </div>
      <div className="agent-body" ref={body}>
        {shell?.banners.ai_unavailable && <div className="banner info" style={{ borderRadius: 8 }}>AI unavailable — answers use engine numbers only where possible.</div>}
        {msgs.length === 0 && (
          <div className="small muted">
            <p>Ask about stock, shortages, proposals or data quality. The agent reads engine results only; it cannot approve or change anything.</p>
            {SUGGESTED.map((q) => <div key={q}><button className="btn sm wrap" style={{ margin: '3px 0' }} onClick={() => send(q)}>{q}</button></div>)}
          </div>
        )}
        <ChatMessages msgs={msgs} busy={busy} onNavigate={onClose} />
      </div>
      <div className="agent-foot">
        <textarea value={text} placeholder="Ask a question…" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }} />
        <button className="btn primary" disabled={busy} onClick={() => send(text)}>Send</button>
      </div>
    </aside>
  )
}
