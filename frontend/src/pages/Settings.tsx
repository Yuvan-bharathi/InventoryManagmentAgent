// Settings: appearance (per browser), agent status, and read-only views of policies and assumptions.
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '../api'
import { Icon, PageIcon } from '../icons'
import { useShell } from '../shell-context'
import { useTheme } from '../theme'

const fmt = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k} = ${JSON.stringify(x)}`).join(', ') : String(v))

export function Settings() {
  const { shell, assumptions, setAgentCtx } = useShell()
  const [theme, setTheme] = useTheme()
  useEffect(() => setAgentCtx({ page: 'Settings' }), []) // eslint-disable-line
  const pol = useQuery({ queryKey: ['policies'], queryFn: async () => (await api.raw<{ data: { key: string; value: unknown }[] }>('GET', '/api/policies')).data })
  const status = useQuery({ queryKey: ['agent-status'], queryFn: () => api.raw<{ available: boolean; reason: string | null }>('GET', '/api/agent/status') })
  const asm = Object.values(assumptions)

  return (
    <div>
      <div className="page-head">
        <PageIcon name="settings" />
        <div><h1>Settings</h1><div className="muted">Appearance, agent status, and the policies and assumptions every calculation uses.</div></div>
      </div>

      <div className="grid g3" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2>Appearance</h2>
          <div className="small muted" style={{ marginBottom: 10 }}>Saved in this browser.</div>
          <div className="row">
            <button className={`btn ${theme === 'light' ? 'primary' : ''}`} onClick={() => setTheme('light')}><Icon name="sun" size={16} />Light</button>
            <button className={`btn ${theme === 'dark' ? 'primary' : ''}`} onClick={() => setTheme('dark')}><Icon name="moon" size={16} />Dark</button>
          </div>
        </div>
        <div className="card">
          <h2>Agent</h2>
          <dl className="kv">
            <dt>Domo AI</dt><dd>{status.data ? <span className={`online ${status.data.available ? '' : 'off'}`}>{status.data.available ? 'Available' : 'Unavailable'}</span> : '…'}</dd>
            {status.data?.reason && <><dt>Reason</dt><dd className="small">{status.data.reason}</dd></>}
            <dt>Mode</dt><dd className="small">Read-only, temperature 0, max 5 tool steps</dd>
            <dt>Fallback</dt><dd className="small">Engine templates when AI is down</dd>
          </dl>
        </div>
        <div className="card">
          <h2>Your access</h2>
          {shell && <dl className="kv">
            <dt>User</dt><dd>{shell.user.display_name}</dd>
            <dt>Role</dt><dd>{shell.user.role_name}</dd>
            <dt>Plants</dt><dd>{shell.user.plants.join(', ')}</dd>
            <dt>Organization</dt><dd>{shell.tenant_name}</dd>
          </dl>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Inventory policies</h2><span className="small muted">read-only · stored in configuration, not in code</span></div>
        <div className="table-wrap">
          <table className="dg compact">
            <thead><tr><th>Policy</th><th>Value</th></tr></thead>
            <tbody>{pol.data?.map((p) => <tr key={p.key}><td><code>{p.key}</code></td><td>{fmt(p.value)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Assumptions</h2><span className="pill scenario">awaiting confirmation from the organization</span></div>
        <div className="table-wrap">
          <table className="dg compact">
            <thead><tr><th>ID</th><th style={{ minWidth: 320 }}>Assumption</th><th>Current</th><th>Default</th><th>Status</th></tr></thead>
            <tbody>{asm.map((a) => (
              <tr key={a.id}><td><b>{a.id}</b></td><td>{a.description}</td><td className="small">{fmt(a.current)}</td><td className="small muted">{fmt(a.default)}</td>
                <td><span className="pill">{a.status}</span></td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
