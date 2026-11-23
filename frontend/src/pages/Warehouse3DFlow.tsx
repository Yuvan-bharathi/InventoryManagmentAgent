import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { App as RetailTwinApp } from '../retail-twin/ui/App'
import '../retail-twin/index.css'

export function Warehouse3DFlow() {
  useEffect(() => {
    // Set title for the 3D twin flow
    document.title = '3D Digital Twin Flow — Multi-Floor Facility'
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', background: '#F1F5F9' }}>
      {/* Top Banner Navigation Header */}
      <div
        style={{
          height: 46,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'rgba(255, 255, 255, 0.98)',
          borderBottom: '1px solid #CBD5E1',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/images/GWC Logo new 2.png"
            alt="GWC Logo"
            style={{ width: 26, height: 26, objectFit: 'contain' }}
          />
          <Link
            to="/digital-twin"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#2563EB',
              fontWeight: 700,
              fontSize: 12,
              textDecoration: 'none',
              padding: '4px 10px',
              borderRadius: 6,
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
            }}
          >
            ← Return to Inventory Dashboard
          </Link>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
            🏬 Cloned Retail Twin Engine: Multi-Tier Mezzanine &amp; Pick Module
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pill" style={{ background: '#DCFCE7', color: '#15803D', fontSize: 11, fontWeight: 700 }}>
            LIVE 60 FPS ACCELERATED
          </span>
        </div>
      </div>

      {/* Cloned Retail Digital Twin Application Viewport */}
      <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', overflow: 'hidden' }}>
        <RetailTwinApp />
      </div>
    </div>
  )
}

