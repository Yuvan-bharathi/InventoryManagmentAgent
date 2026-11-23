import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../icons'

export interface ComingSoonProps {
  title: string
  group: string
  icon: IconName
  answers: string
  mainUsers: string
  dataNeeded: string
  dataSources: string[]
  plannedCapabilities: string[]
}

export function ComingSoon({
  title,
  group,
  icon,
  answers,
  mainUsers,
  dataNeeded,
  dataSources,
  plannedCapabilities,
}: ComingSoonProps) {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-head">
        <span className="page-icon solid">
          <Icon name={icon} size={28} />
        </span>
        <div>
          <div className="crumb">{group} · Next in Architecture Roadmap</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{title}</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            {answers}
          </p>
        </div>
      </div>

      {/* Coming Next Status Hero Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(111, 61, 186, 0.06), rgba(245, 138, 58, 0.08))',
          border: '1px solid rgba(111, 61, 186, 0.25)',
          padding: 24,
          borderRadius: 16,
          display: 'flex',
          gap: 20,
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'var(--brand-orange)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(245, 138, 58, 0.35)',
          }}
        >
          <Icon name="clock" size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'rgba(245, 138, 58, 0.15)',
                color: 'var(--brand-orange)',
                padding: '3px 10px',
                borderRadius: 999,
              }}
            >
              Coming Next
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
              Primary Audience: <b style={{ color: 'var(--text)' }}>{mainUsers}</b>
            </span>
          </div>
          <h3 style={{ margin: '10px 0 6px', fontSize: 17, color: 'var(--text)', fontWeight: 700 }}>
            Waiting for organization data contract feed
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
            <b>Data still needed: </b>
            <span style={{ color: '#c2410c', fontWeight: 600 }}>{dataNeeded}</span>
          </p>
        </div>
      </div>

      {/* Two Column details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="card-head" style={{ marginBottom: 14 }}>
            <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
              <Icon name="db" size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Target ERP &amp; QMS Data Feeds</h3>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, color: 'var(--text)' }}>
            {dataSources.map((ds, idx) => (
              <li key={idx} style={{ lineHeight: 1.4 }}>
                <code>{ds}</code>
              </li>
            ))}
          </ul>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="card-head" style={{ marginBottom: 14 }}>
            <span style={{ color: 'var(--brand-purple)', display: 'inline-flex' }}>
              <Icon name="sparkle" size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Planned Automation &amp; Capabilities</h3>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, color: 'var(--text)' }}>
            {plannedCapabilities.map((cap, idx) => (
              <li key={idx} style={{ lineHeight: 1.4 }}>
                {cap}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Navigation footer */}
      <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          To test active live features, navigate back to the home hub or open active modules.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/home" className="btn primary">
            <Icon name="home" size={16} /> Return to Home Hub
          </Link>
          <Link to="/uploads" className="btn outline">
            <Icon name="upload" size={16} /> Data Import &amp; Quality Check
          </Link>
        </div>
      </div>
    </div>
  )
}

