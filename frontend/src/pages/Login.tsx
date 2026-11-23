import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, token } from '../api'

interface Persona {
  username: string
  name: string
  role: string
  icon: string
  badge: string
  badgeColor: string
  desc: string
}

const PERSONAS: Persona[] = [
  {
    username: 'buyer',
    name: 'Bala Raman',
    role: 'Purchasing Officer / Sourcing Lead',
    icon: '🛒',
    badge: 'Draft & L1 Approvals',
    badgeColor: '#10B981',
    desc: 'Creates & edits draft POs, selects suppliers from RFQ comparisons, approves orders < ₹10 Lakhs.',
  },
  {
    username: 'procmgr',
    name: 'Meera Pillai',
    role: 'Procurement Manager',
    icon: '👔',
    badge: 'L2 Co-Approval',
    badgeColor: '#6366F1',
    desc: 'Reviews high-value purchase orders (≥ ₹10 Lakhs), authorizes vendor contracts & budget releases.',
  },
  {
    username: 'leader',
    name: 'Leela Iyer',
    role: 'Plant Head / Leadership',
    icon: '👑',
    badge: 'Executive Oversight',
    badgeColor: '#8B5CF6',
    desc: 'Complete cross-plant visibility (IN-TN-01 & IN-KA-01), executive decision sign-off & KPI monitoring.',
  },
  {
    username: 'planner',
    name: 'Priya Nair',
    role: 'Production Planner',
    icon: '⚙️',
    badge: 'Planning & Demand',
    badgeColor: '#EC4899',
    desc: 'Analyzes BOM shortage horizons, simulates supplier delays, and triggers replenishment requests.',
  },
  {
    username: 'stores',
    name: 'Sanjay Rao',
    role: 'Stores & Warehouse Lead',
    icon: '📦',
    badge: 'Receiving & QC',
    badgeColor: '#F59E0B',
    desc: 'Manages incoming dock goods receipts, inspection lots, quality hold releases & cycle counts.',
  },
]

export function Login() {
  const nav = useNavigate()
  const [username, setU] = useState('buyer')
  const [password, setP] = useState('demo')
  const [err, setErr] = useState<string | null>(null)
  const [loadingUser, setLoadingUser] = useState<string | null>(null)

  async function loginAs(user: string, pw = 'demo') {
    setErr(null)
    setLoadingUser(user)
    try {
      const r = await api.raw<{ token: string; user: { lands_on: string } }>(
        'POST',
        '/api/auth/login',
        { username: user, password: pw }
      )
      token.set(r.token)
      nav('/home', { replace: true })
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setLoadingUser(null)
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    loginAs(username, password)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '1fr 1.35fr',
        }}
      >
        {/* Left Column: Form & Brand */}
        <div
          style={{
            padding: '36px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRight: '1px solid #E2E8F0',
          }}
        >
          <div>
            {/* Brand Logo Header */}
            <div style={{ marginBottom: 24, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 20,
                  }}
                >
                  G
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.04em', color: '#0F172A' }}>
                    GLOBAL WE CONNECT
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6366F1', letterSpacing: '0.06em' }}>
                    MANUFACTURING AI PLATFORM
                  </div>
                </div>
              </div>
              <h1 style={{ fontSize: 21, fontWeight: 800, margin: '14px 0 4px', color: '#1E293B' }}>
                Inventory Agent
              </h1>
              <p style={{ margin: 0, fontSize: 12.5, color: '#64748B', lineHeight: 1.4 }}>
                Autonomous Replenishment &amp; Smart Procurement Twin (Agent 09)
              </p>
            </div>

            {/* Manual Form */}
            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Select Persona / Username
                </label>
                <select
                  value={username}
                  onChange={(e) => setU(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: 13,
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    background: '#F8FAFC',
                    fontWeight: 600,
                    color: '#1E293B',
                    outline: 'none',
                  }}
                >
                  <option value="buyer">Bala Raman (Purchasing Officer / Sourcing Lead)</option>
                  <option value="procmgr">Meera Pillai (Procurement Manager - L2 Approver)</option>
                  <option value="leader">Leela Iyer (Plant Head / Executive Leadership)</option>
                  <option value="planner">Priya Nair (Production Planner)</option>
                  <option value="stores">Sanjay Rao (Stores / Warehouse Manager)</option>
                  <option value="buyer.ka">Kiran Gowda (Plant Purchasing Officer - Bengaluru IN-KA-01)</option>
                </select>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setP(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: 13,
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    background: '#F8FAFC',
                    color: '#1E293B',
                    outline: 'none',
                  }}
                />
              </div>

              {err && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: '#FEF2F2',
                    border: '1px solid #F87171',
                    color: '#B91C1C',
                    fontSize: 12,
                    marginBottom: 14,
                  }}
                >
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={!!loadingUser}
                style={{
                  width: '100%',
                  padding: '11px',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                }}
              >
                {loadingUser === username ? 'Signing in...' : `Sign in as ${username}`}
              </button>
            </form>
          </div>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #F1F5F9', fontSize: 11, color: '#94A3B8' }}>
            Demo credential for all personas: Password is <strong>demo</strong>
          </div>
        </div>

        {/* Right Column: 1-Click Persona Cards */}
        <div
          style={{
            padding: '32px 28px',
            background: '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🚀 1-Click Role Login</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              Choose a manufacturing persona below to test role-specific workflows &amp; approvals:
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, flex: 1 }}>
            {PERSONAS.map((p) => (
              <div
                key={p.username}
                onClick={() => loginAs(p.username)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#7C3AED'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E2E8F0'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ fontSize: 24 }}>{p.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>{p.name}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: `${p.badgeColor}15`,
                        color: p.badgeColor,
                      }}
                    >
                      {p.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6366F1' }}>{p.role}</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 1.3 }}>{p.desc}</div>
                </div>
                <button
                  type="button"
                  style={{
                    background: '#F1F5F9',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {loadingUser === p.username ? '...' : 'Login →'}
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              background: '#EEF2FF',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 11,
              color: '#4338CA',
              lineHeight: 1.4,
            }}
          >
            <strong>💡 Governance Tip:</strong> To approve purchase orders or proposals, sign in as{' '}
            <strong>Bala Raman (Purchasing Officer)</strong> for Level 1 (&lt; ₹10L) or{' '}
            <strong>Meera Pillai (Procurement Manager)</strong> for Level 2 (&ge; ₹10L).
          </div>
        </div>
      </div>
    </div>
  )
}
