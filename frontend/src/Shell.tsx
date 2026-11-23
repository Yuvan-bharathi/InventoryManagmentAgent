import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, token, type Meta } from './api'
import { AgentPanel } from './AgentPanel'
import { Icon, type IconName } from './icons'
import { ShellContext, type AgentCtx, type Assumption, type ShellMeta, type ShellState } from './shell-context'

type Item = {
  to: string
  label: string
  icon: IconName
  badge?: 'proposals'
  end?: boolean
  match?: RegExp
}

type NavGroup = {
  title: string
  items: Item[]
}

const GROUPS: NavGroup[] = [
  {
    title: 'AI Agents',
    items: [
      { to: '/agents', label: 'Agent Hub & Pipeline', icon: 'bot' },
      { to: '/agent-tester', label: 'Agent Testing Playground', icon: 'sparkle' },
      { to: '/agent', label: 'Ask the Inventory Agent', icon: 'workflow', end: true },
      { to: '/agent/runs', label: 'AI Agent Activity Log', icon: 'history' },
    ],
  },
  {
    title: 'Monitor',
    items: [
      { to: '/overview', label: 'Inventory Health Dashboard', icon: 'home' },
      { to: '/stock', label: 'Stock on Hand', icon: 'stock' },
      { to: '/material', label: 'Material Details', icon: 'material' },
      { to: '/digital-twin', label: 'Shelf and Location Map', icon: 'twin' },
    ],
  },
  {
    title: 'Plan',
    items: [
      { to: '/shortages', label: 'Shortage Forecast', icon: 'shortage' },
      { to: '/capacity', label: 'Build Capacity Calculator', icon: 'calculator' },
      // { to: '/simulation', label: 'Supplier Delay Simulator', icon: 'simulator' }, // Handled externally by teammate: Use Case #10 (Supplier Performance Agent)
    ],
  },
  {
    title: 'Act',
    items: [
      // { to: '/procurement', label: 'Smart Procurement & RFQ', icon: 'cart' }, // Handled externally by teammate: Use Case #11 (Agentic RFQ Management Agent)
      // { to: '/proposals', label: 'Purchase Order Approvals', icon: 'proposals', badge: 'proposals', end: true }, // Handled externally by teammate: Use Case #11 (Agentic RFQ Management Agent)
      // { to: '/proposal', label: 'PO Review & Digital Sign-off', icon: 'check', match: /^\/proposals?\/[^/]+|^\/proposal$/ }, // Handled externally by teammate: Use Case #11 (Agentic RFQ Management Agent)
      { to: '/dead-stock', label: 'Dead and Slow-Moving Stock', icon: 'deadstock' },
    ],
  },
  {
    title: 'Warehouse',
    items: [
      // { to: '/quality', label: 'Quality Hold and Rejects', icon: 'qc' }, // Handled externally by teammate: Use Case #5 (Quality Management Agent)
      { to: '/receiving', label: 'Goods Receiving', icon: 'box' },
      { to: '/cycle-counts', label: 'Cycle Counts and Routine Checks', icon: 'repeat' },
      { to: '/dispatch', label: 'Finished Goods and Dispatch', icon: 'truck' },
      // { to: '/traceability', label: 'Batch Traceability', icon: 'traceability' }, // Handled externally by teammate: Use Case #8 (Product Traceability Agent - Batch Traceability & Root-Cause Analysis DB)
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: '/brief', label: 'Daily Inventory Report', icon: 'brief' },
    ],
  },
  {
    title: 'Data & Connectors',
    items: [
      { to: '/connectors', label: 'Connected Databases & Feeds', icon: 'plug' },
      { to: '/uploads', label: 'Data Import and Quality Check', icon: 'upload' },
    ],
  },
]

const CRUMBS: [RegExp, string[]][] = [
  [/^\/home$/, ['Home: Inventory at a Glance']],
  [/^\/overview/, ['Monitor', 'Inventory Health Dashboard']],
  [/^\/stock/, ['Monitor', 'Stock on Hand']],
  [/^\/material/, ['Monitor', 'Material Details']],
  [/^\/digital-twin/, ['Monitor', 'Shelf and Location Map (3D Digital Twin)']],
  [/^\/warehouse-3d/, ['Monitor', '3D Facility Flow']],
  [/^\/shortages/, ['Plan', 'Shortage Forecast']],
  [/^\/capacity/, ['Plan', 'Build Capacity Calculator']],
  [/^\/simulation/, ['Plan', 'Supplier Delay Simulator']],
  [/^\/procurement/, ['Act', 'Smart Procurement & RFQ Comparison']],
  [/^\/proposals\/./, ['Act', 'Purchase and Transfer Requests', 'Request Review and Approval']],
  [/^\/proposals?$/, ['Act', 'Purchase and Transfer Requests']],
  [/^\/proposal$/, ['Act', 'Request Review and Approval']],
  [/^\/dead-stock/, ['Act', 'Dead and Slow-Moving Stock']],
  [/^\/quality/, ['Warehouse', 'Quality Hold and Rejects']],
  [/^\/receiving/, ['Warehouse', 'Goods Receiving']],
  [/^\/cycle-counts/, ['Warehouse', 'Cycle Counts and Routine Checks']],
  [/^\/dispatch/, ['Warehouse', 'Finished Goods and Dispatch']],
  [/^\/traceability/, ['Warehouse', 'Batch Traceability']],
  [/^\/brief/, ['Reports', 'Daily Inventory Report']],
  [/^\/agents/, ['AI Agents', 'Enterprise Agent Hub & Pipeline']],
  [/^\/agent-tester/, ['AI Agents', 'Agent Testing Playground']],
  [/^\/agent\/runs/, ['AI Agents', 'AI Agent Activity Log']],
  [/^\/agent\/workflow/, ['AI Agents', 'Agent Workflow']],
  [/^\/agent\/trigger/, ['AI Agents', 'Manual Trigger']],
  [/^\/agent/, ['AI Agents', 'Ask the Inventory Agent']],
  [/^\/uploads/, ['Data & Connectors', 'Data Import and Quality Check']],
  [/^\/connectors/, ['Data & Connectors', 'Connected Databases & System Sources']],
  [/^\/settings/, ['Settings']],
]

export function Shell() {
  const loc = useLocation()
  const [plant, setPlantState] = useState<string>(() => {
    try {
      return localStorage.getItem('inv.plant') ?? ''
    } catch {
      return ''
    }
  })
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentQ, setAgentQ] = useState<string | undefined>()
  const [agentCtx, setAgentCtx] = useState<AgentCtx>({ page: 'overview' })
  const [collapsed, setCollapsed] = useState(false)

  const metaQ = useQuery({
    queryKey: ['meta'],
    queryFn: () => api.get<ShellMeta>('/api/meta'),
    enabled: !!token.get(),
    staleTime: 30_000,
  })
  const asmQ = useQuery({
    queryKey: ['assumptions'],
    queryFn: () => api.get<Assumption[]>('/api/assumptions'),
    enabled: !!token.get() && !!metaQ.data?.meta?.run_id,
    staleTime: 300_000,
  })

  const assumptions = useMemo(
    () => Object.fromEntries((asmQ.data?.data ?? []).map((a) => [a.id, a])),
    [asmQ.data]
  )

  if (!token.get()) return <Navigate to="/login" replace state={{ from: loc.pathname }} />

  const shell = metaQ.data?.data ?? null
  const meta: Meta | null = metaQ.data?.meta && 'run_id' in metaQ.data.meta ? metaQ.data.meta : null
  const setPlant = (p: string) => {
    setPlantState(p)
    try {
      localStorage.setItem('inv.plant', p)
    } catch {
      /* ignore */
    }
  }

  const defaultPlants = [
    { plant_id: 'IN-KA-01', plant_name: 'Bengaluru Electronics Plant' },
    { plant_id: 'IN-TN-01', plant_name: 'Chennai Manufacturing' },
  ]
  const plantOptions = (shell?.plants && shell.plants.length > 0) ? shell.plants : defaultPlants

  const state: ShellState = {
    user: shell?.user ?? null,
    shell,
    meta,
    plant: shell && plant && !shell.user.plants.includes(plant) ? '' : plant,
    setPlant,
    assumptions,
    agentCtx,
    setAgentCtx,
    openAgent: (q) => {
      setAgentQ(q)
      setAgentOpen(true)
    },
    can: (mod, perm) => !!shell?.permissions[mod]?.includes(perm),
    logout: () => {
      token.set(null)
      window.location.assign('/login')
    },
  }

  const onAgentPage = loc.pathname.startsWith('/agent')

  const renderLink = (it: Item) => (
    <NavLink
      key={it.to}
      to={it.to}
      end={it.end}
      title={it.label}
      className={({ isActive }) => ((it.match ? it.match.test(loc.pathname) : isActive) ? 'active' : '')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: collapsed ? 0 : '8px 12px',
        width: collapsed ? 46 : '100%',
        height: collapsed ? 46 : 'auto',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 10,
        margin: '2px 0',
      }}
    >
      <Icon name={it.icon} size={collapsed ? 22 : 18} stroke={collapsed ? 2.0 : 1.8} />
      {!collapsed && (
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13.5,
            fontWeight: 500,
            flex: 1,
          }}
        >
          {it.label}
        </span>
      )}
      {!collapsed && it.badge === 'proposals' && !!shell?.badges.proposals && (
        <span className="badge">{shell.badges.proposals}</span>
      )}
    </NavLink>
  )

  return (
    <ShellContext.Provider value={state}>
      <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
        <aside className="side" style={{ scrollbarGutter: 'stable' }}>
          {/* Brand */}
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 6px 14px' }}>
            <img
              src="/images/gwc white logo new 2.png"
              alt="Global We Connect"
              style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
            />
            {!collapsed && (
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  Inventory Agent
                </div>
                <small
                  style={{
                    display: 'block',
                    fontWeight: 500,
                    fontSize: 11,
                    color: 'var(--side-text)',
                    opacity: 0.85,
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Global We Connect{shell?.tenant_name ? ` · ${shell.tenant_name}` : ''}
                </small>
              </div>
            )}
          </div>

          <nav className="nav" style={{ flex: 1 }}>
            {/* Home: Inventory at a Glance */}
            <div style={{ marginBottom: 6 }}>
              {renderLink({
                to: '/home',
                label: 'Home: Inventory at a Glance',
                icon: 'home',
                end: true,
              })}
            </div>

            {/* Navigation Groups */}
            {GROUPS.map((grp) => {
              const isAgents = grp.title === 'AI Agents'
              return (
                <div
                  key={grp.title}
                  style={{
                    marginBottom: isAgents ? 12 : 8,
                    ...(isAgents && !collapsed
                      ? {
                          background: 'linear-gradient(135deg, rgba(111, 61, 186, 0.22) 0%, rgba(77, 142, 235, 0.12) 100%)',
                          border: '1px solid rgba(168, 85, 247, 0.38)',
                          borderRadius: 12,
                          padding: '6px 5px 8px',
                          boxShadow: '0 2px 10px rgba(111, 61, 186, 0.18)',
                        }
                      : {}),
                    ...(isAgents && collapsed
                      ? {
                          background: 'rgba(111, 61, 186, 0.25)',
                          borderRadius: 12,
                          padding: '4px 0',
                          border: '1px solid rgba(168, 85, 247, 0.35)',
                        }
                      : {}),
                  }}
                >
                  {!collapsed ? (
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: isAgents ? 800 : 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: isAgents ? '#E9D5FF' : 'var(--side-text)',
                        opacity: isAgents ? 1 : 0.6,
                        padding: isAgents ? '4px 6px 6px' : '10px 10px 4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {isAgents && <span style={{ fontSize: 11 }}>⚡</span>}
                        {grp.title}
                      </span>
                      {isAgents && (
                        <span
                          style={{
                            fontSize: 8,
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, #7C3AED, #2563EB)',
                            color: '#ffffff',
                            letterSpacing: '0.04em',
                            boxShadow: '0 1px 4px rgba(124, 58, 237, 0.4)',
                          }}
                        >
                          MESH ACTIVE
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px auto', width: 32 }} />
                  )}
                  {grp.items.map((it) => renderLink(it))}
                </div>
              )
            })}

            <div className="nav-sep" style={{ margin: '10px 0' }} />
            {renderLink({ to: '/settings', label: 'Settings', icon: 'settings' })}
          </nav>

          <span className="spacer" />
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} style={{ marginTop: 12 }}>
            {collapsed ? '»' : '« Collapse Sidebar'}
          </button>
        </aside>

        <div className="main">
          <header className="header">
            <Crumbs path={loc.pathname} />
            <span className="spacer" />
            <select
              aria-label="Plant"
              className="pill-select"
              value={state.plant || ''}
              onChange={(e) => setPlant(e.target.value)}
            >
              <option value="">Plant: All plants</option>
              {plantOptions.map((p) => (
                <option key={p.plant_id} value={p.plant_id}>
                  {p.plant_name} ({p.plant_id})
                </option>
              ))}
            </select>
            {meta && (
              <span className="refresh" data-testid="refresh-badge" title={`Run #${meta.run_id}`}>
                <span style={{ color: 'var(--ok)', display: 'inline-flex' }}>
                  <Icon name="refresh" size={15} stroke={2.2} />
                </span>
                Refreshed run #{meta.run_id}
              </span>
            )}
            <Notifications shell={shell} />
            {shell && <UserMenu shell={shell} onLogout={state.logout} />}
          </header>
          <Banners shell={shell} />
          <main className="content">
            <Outlet />
          </main>

          {!agentOpen && !onAgentPage && (
            <button
              className="agent-fab"
              onClick={() => setAgentOpen(true)}
              aria-label="Ask Agent"
              title="Ask Agent"
            >
              <span className="agent-fab-icon">
                <Icon name="bot" size={20} stroke={2.0} />
              </span>
              <span className="agent-fab-label">Ask Agent</span>
            </button>
          )}
        </div>
      </div>

      {agentOpen && (
        <AgentPanel initialQuestion={agentQ} onClose={() => { setAgentOpen(false); setAgentQ(undefined) }} />
      )}
    </ShellContext.Provider>
  )
}

function Crumbs({ path }: { path: string }) {
  const parts = CRUMBS.find(([re]) => re.test(path))?.[1] ?? ['Inventory Agent']
  return (
    <div className="hcrumb">
      <Link to="/home" style={{ display: 'inline-flex' }} aria-label="Home">
        <Icon name="home" size={16} />
      </Link>
      <Link to="/home">Home</Link>
      {parts.map((p, i) => (
        <span key={p} className={`row ${i < parts.length - 1 ? 'crumb-mid' : ''}`} style={{ gap: 8 }}>
          <span>›</span>
          {i === parts.length - 1 ? <b>{p}</b> : <span>{p}</span>}
        </span>
      ))}
    </div>
  )
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const on = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [open, close])
  return ref
}

function Notifications({ shell }: { shell: ShellMeta | null }) {
  const [open, setOpen] = useState(false)
  const ref = useOutside(open, () => setOpen(false))
  const nav = useNavigate()
  const items: { text: string; to: string }[] = []
  if (shell?.badges.proposals) {
    items.push({ text: `${shell.badges.proposals} proposal(s) waiting for approval`, to: '/proposals?state=pending_buyer' })
  }
  if (shell?.banners.dq_failed) {
    items.push({ text: 'A data-quality check failed', to: '/uploads' })
  }
  if (shell?.banners.ai_unavailable) {
    items.push({ text: 'AI unavailable — template answers in use', to: '/settings' })
  }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Notifications" title="Notifications">
        <Icon name="bell" size={18} />
        {items.length > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="menu">
          {items.length === 0 && <div className="small muted" style={{ padding: 10 }}>Nothing needs your attention.</div>}
          {items.map((it) => (
            <button key={it.text} className="menu-item" onClick={() => { setOpen(false); nav(it.to) }}>
              {it.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserMenu({ shell, onLogout }: { shell: ShellMeta; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useOutside(open, () => setOpen(false))

  async function switchPersona(username: string) {
    try {
      const r = await api.raw<{ token: string }>('POST', '/api/auth/login', { username, password: 'demo' })
      token.set(r.token)
      setOpen(false)
      window.location.reload()
    } catch {
      // ignore
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="user-badge" onClick={() => setOpen(!open)} aria-haspopup="menu">
        <span className="user-avatar">{shell.user.display_name.charAt(0)}</span>
        <b className="user-name">{shell.user.display_name.split(' ')[0]}</b>
        <span className="pill sm" style={{ fontSize: 10, background: '#EDE9FE', color: '#6D28D9', marginLeft: 4 }}>
          {shell.user.role_name.split(' ')[0]}
        </span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="menu" role="menu" style={{ minWidth: 260 }}>
          <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <b>{shell.user.display_name}</b>
            <div className="small muted">
              {shell.user.role_name} · {shell.user.plants.join(', ')}
            </div>
          </div>
          <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.04em' }}>
            SWITCH PERSONA (APPROVAL TESTING)
          </div>
          <button className="menu-item" onClick={() => switchPersona('buyer')}>
            🛒 Bala Raman (Purchasing Officer · L1)
          </button>
          <button className="menu-item" onClick={() => switchPersona('procmgr')}>
            👔 Meera Pillai (Procurement Mgr · L2)
          </button>
          <button className="menu-item" onClick={() => switchPersona('leader')}>
            👑 Leela Iyer (Plant Head · Leadership)
          </button>
          <button className="menu-item" onClick={() => switchPersona('planner')}>
            ⚙️ Priya Nair (Planner · Demand)
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <Link className="menu-item" to="/settings" onClick={() => setOpen(false)}>
            Settings
          </Link>
          <button className="menu-item" onClick={onLogout}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function Banners({ shell }: { shell: ShellMeta | null }) {
  if (!shell) return null
  const out: ReactNode[] = []
  if (shell.banners.no_data) {
    out.push(
      <div key="nd" className="banner warn">
        No calculation run yet. <Link to="/uploads">Upload the dataset</Link>.
      </div>
    )
  }
  if (shell.banners.dq_failed) {
    out.push(
      <div key="dq" className="banner err">
        A data-quality check failed and rows were excluded. <Link to="/uploads">See the validation report</Link>
      </div>
    )
  }
  if (shell.banners.ai_unavailable) {
    out.push(
      <div key="ai" className="banner info" data-testid="banner-ai">
        AI unavailable — briefs use the template with engine numbers; everything else works.{' '}
        <span className="muted small">({shell.banners.ai_reason})</span>
      </div>
    )
  }
  return <>{out}</>
}
