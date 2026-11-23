import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { Icon, PageIcon } from '../icons'

interface ConnectorItem {
  id: string
  name: string
  subtitle: string
  status: string
  status_badge: string
  status_color: string
  description: string
  endpoint: string
  connection_string: string
  mapped_records: string
  latency_ms: number
  protocol: string
  host?: string
  port?: number
  database?: string
  username?: string
  ssl_mode?: string
  pool_size?: number
}

interface ConnectorsResponse {
  kpis: {
    customer_orders: number
    customers: number
    products: number
    raw_inventory_items: number
    production_orders: number
    shipment_milestones: number
  }
  active_core: string
  active_count: number
  connectors: ConnectorItem[]
}

const CONNECTOR_PRESETS: Record<string, Partial<ConnectorItem>> = {
  'postgresql-neon': {
    id: 'postgresql-neon',
    name: 'PostgreSQL / Neon Cloud Store',
    subtitle: 'Analytical Data Warehouse',
    protocol: 'PostgreSQL',
    description: 'High-concurrency PostgreSQL data store with SSL connection pooling and analytical replica tables.',
    host: 'ep-manufacturing-360.neon.tech',
    port: 5432,
    database: 'neondb',
    username: 'neondb_owner',
    ssl_mode: 'require',
    pool_size: 25,
    connection_string: 'postgresql://neondb_owner:password@ep-manufacturing-360.neon.tech:5432/neondb?sslmode=require',
  },
  'sap-s4hana': {
    id: 'sap-s4hana',
    name: 'SAP S/4HANA (Enterprise ERP)',
    subtitle: 'Commercial & Sales Orders',
    protocol: 'OData / REST',
    description: 'B2B customer accounts, sales orders, credit lines, payment terms, and commercial invoicing.',
    host: 'gateway.sap.corp',
    port: 443,
    database: 'API_SALES_ORDER',
    username: 'erp_service',
    ssl_mode: 'require',
    pool_size: 15,
    connection_string: 'https://erp-service:password@gateway.sap.corp:443/odata/API_SALES_ORDER',
  },
  'siemens-opcenter': {
    id: 'siemens-opcenter',
    name: 'Siemens Opcenter MES',
    subtitle: 'Manufacturing Execution Floor',
    protocol: 'OPC-UA / TCP',
    description: 'Plant production orders, work center line capacity, line throughput, and dispatching.',
    host: 'floor-gw.corp',
    port: 4840,
    database: 'PROD_LINE_01',
    username: 'mes_worker',
    ssl_mode: 'prefer',
    pool_size: 10,
    connection_string: 'opc.tcp://mes-worker:password@floor-gw.corp:4840/PROD_LINE_01',
  },
  'sap-ewm': {
    id: 'sap-ewm',
    name: 'SAP EWM / Manhattan WMS',
    subtitle: 'Warehouse & Staging Facilities',
    protocol: 'REST / HTTPS',
    description: 'Raw material storage, packaging cartons, staging bays, and dispatch loading docks.',
    host: 'wms-hub.corp.internal',
    port: 8443,
    database: 'RM-WH-01',
    username: 'wms_admin',
    ssl_mode: 'require',
    pool_size: 20,
    connection_string: 'https://wms-admin:password@wms-hub.corp.internal:8443/v2/inventory',
  },
  'blue-yonder-tms': {
    id: 'blue-yonder-tms',
    name: 'Blue Yonder TMS',
    subtitle: 'Logistics, Carriers & Tracking',
    protocol: 'EDI / REST',
    description: 'Carrier contracts, EDI 214 shipment milestone feeds, route transit days, and vehicle assignments.',
    host: 'logistics-gw.blueyonder.corp',
    port: 443,
    database: 'EDI_214_LIVE',
    username: 'tms_agent',
    ssl_mode: 'require',
    pool_size: 12,
    connection_string: 'https://tms-agent:password@logistics-gw.blueyonder.corp:443/api/v1/shipments',
  },
  'veeva-trackvia': {
    id: 'veeva-trackvia',
    name: 'Veeva / TrackVia QMS',
    subtitle: 'Quality Certifications & Inspection',
    protocol: 'REST / HTTPS',
    description: 'Incoming component inspection, quality hold releases, and ISO manufacturing certs.',
    host: 'mfg360.quality-cloud.corp',
    port: 443,
    database: 'QA-CENTRAL-LAB-01',
    username: 'qms_auditor',
    ssl_mode: 'require',
    pool_size: 10,
    connection_string: 'https://qms-auditor:password@mfg360.quality-cloud.corp:443/api/inspections',
  },
  'ptc-windchill': {
    id: 'ptc-windchill',
    name: 'PTC Windchill PLM',
    subtitle: 'Engineering & Bill of Materials',
    protocol: 'REST / OData',
    description: 'Active product BOM configurations, engineering revision approvals, and component lifecycles.',
    host: 'windchill.engineering.corp',
    port: 443,
    database: 'ASTER_SERIES_VAULT_2026',
    username: 'bom_sync',
    ssl_mode: 'require',
    pool_size: 10,
    connection_string: 'https://bom-sync:password@windchill.engineering.corp:443/rest/v1/structures',
  },
  'generic-db': {
    id: 'custom-database',
    name: 'Custom Database Connection',
    subtitle: 'Relational or Document Store',
    protocol: 'PostgreSQL / MySQL / Oracle / MongoDB',
    description: 'Custom external database integration via direct connection string URI.',
    host: 'custom-db-cluster.internal',
    port: 5432,
    database: 'production_db',
    username: 'app_user',
    ssl_mode: 'require',
    pool_size: 20,
    connection_string: 'postgresql://app_user:password@custom-db-cluster.internal:5432/production_db?sslmode=require',
  },
}

export function Connectors() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'grid' | 'form'>('grid')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Form State
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('postgresql-neon')
  const [inputMethod, setInputMethod] = useState<'string' | 'fields'>('string')
  const [connString, setConnString] = useState<string>(CONNECTOR_PRESETS['postgresql-neon'].connection_string || '')
  const [formHost, setFormHost] = useState<string>(CONNECTOR_PRESETS['postgresql-neon'].host || '')
  const [formPort, setFormPort] = useState<number>(CONNECTOR_PRESETS['postgresql-neon'].port || 5432)
  const [formDb, setFormDb] = useState<string>(CONNECTOR_PRESETS['postgresql-neon'].database || '')
  const [formUser, setFormUser] = useState<string>(CONNECTOR_PRESETS['postgresql-neon'].username || '')
  const [formPassword, setFormPassword] = useState<string>('••••••••••••')
  const [formSsl, setFormSsl] = useState<string>(CONNECTOR_PRESETS['postgresql-neon'].ssl_mode || 'require')
  const [formPool, setFormPool] = useState<number>(CONNECTOR_PRESETS['postgresql-neon'].pool_size || 25)

  // Ping Testing State
  const [testingPingId, setTestingPingId] = useState<string | null>(null)
  const [pingResult, setPingResult] = useState<{ id: string; latency_ms: number; message: string } | null>(null)
  const [isTestingForm, setIsTestingForm] = useState<boolean>(false)
  const [formTestSuccess, setFormTestSuccess] = useState<{ latency_ms: number; message: string } | null>(null)

  // Query: Get All Connectors & KPIs
  const { data: resp } = useQuery({
    queryKey: ['system-connectors'],
    queryFn: async () => (await api.get<ConnectorsResponse>('/api/connectors')).data,
    staleTime: 60_000,
  })

  const connectors = resp?.connectors ?? []
  const kpis = resp?.kpis ?? {
    customer_orders: 1564,
    customers: 4,
    products: 3,
    raw_inventory_items: 6624,
    production_orders: 450,
    shipment_milestones: 1000,
  }

  // Parse connection string into fields automatically
  const handleConnStringChange = (val: string) => {
    setConnString(val)
    if (val.includes('://')) {
      try {
        const u = new URL(val)
        if (u.hostname) setFormHost(u.hostname)
        if (u.port) setFormPort(Number(u.port))
        if (u.pathname && u.pathname.length > 1) setFormDb(u.pathname.replace(/^\//, ''))
        if (u.username) setFormUser(u.username)
        if (u.password) setFormPassword(u.password)
        const ssl = u.searchParams.get('sslmode') || u.searchParams.get('ssl')
        if (ssl) setFormSsl(ssl)
      } catch {
        // partial string parsing
      }
    }
  }

  // Handle Preset Selection
  const handleSelectPreset = (key: string) => {
    setSelectedPresetKey(key)
    const preset = CONNECTOR_PRESETS[key] || CONNECTOR_PRESETS['postgresql-neon']
    setConnString(preset.connection_string || '')
    setFormHost(preset.host || '')
    setFormPort(preset.port || 5432)
    setFormDb(preset.database || '')
    setFormUser(preset.username || '')
    setFormSsl(preset.ssl_mode || 'require')
    setFormPool(preset.pool_size || 25)
    setFormTestSuccess(null)
  }

  // Open configuration for a specific connector
  const handleConfigureConnector = (c: ConnectorItem) => {
    const matchingKey = Object.keys(CONNECTOR_PRESETS).find(k => k === c.id) || 'postgresql-neon'
    setSelectedPresetKey(matchingKey)
    setConnString(c.connection_string || '')
    setFormHost(c.host || 'ep-manufacturing-360.neon.tech')
    setFormPort(c.port || 5432)
    setFormDb(c.database || 'neondb')
    setFormUser(c.username || 'neondb_owner')
    setFormSsl(c.ssl_mode || 'require')
    setFormPool(c.pool_size || 25)
    setFormTestSuccess(null)
    setViewMode('form')
  }

  // Test Ping from Card
  const handleTestPing = async (c: ConnectorItem) => {
    setTestingPingId(c.id)
    try {
      const res = await api.post<{ status: string; latency_ms: number; message: string }>('/api/connectors/test', {
        connector_type: c.id,
        host: c.host,
        port: c.port,
        database: c.database,
      })
      setPingResult({ id: c.id, latency_ms: res.data.latency_ms, message: res.data.message })
      showToast(`✓ Ping to ${c.name} successful (${res.data.latency_ms}ms latency)`)
    } catch {
      showToast(`Ping failed for ${c.name}`)
    } finally {
      setTestingPingId(null)
    }
  }

  // Test Connection from Form
  const handleTestFormConnection = async () => {
    setIsTestingForm(true)
    setFormTestSuccess(null)
    try {
      const res = await api.post<{ status: string; latency_ms: number; message: string }>('/api/connectors/test', {
        connection_string: connString,
        host: formHost,
        port: formPort,
        database: formDb,
        username: formUser,
        ssl_mode: formSsl,
        pool_size: formPool,
      })
      setFormTestSuccess({ latency_ms: res.data.latency_ms, message: res.data.message })
      showToast(`✓ Test connection successful! ${res.data.latency_ms}ms latency`)
    } catch {
      showToast('Connection test failed. Check endpoint parameters.')
    } finally {
      setIsTestingForm(false)
    }
  }

  // Save Connector from Form
  const handleSaveConnector = async () => {
    const preset = CONNECTOR_PRESETS[selectedPresetKey] || CONNECTOR_PRESETS['postgresql-neon']
    try {
      await api.post('/api/connectors/save', {
        id: preset.id,
        name: preset.name,
        connector_type: preset.protocol || 'PostgreSQL',
        connection_string: connString,
        host: formHost,
        port: formPort,
        database: formDb,
        username: formUser,
        ssl_mode: formSsl,
        pool_size: formPool,
        status: 'CONNECTED',
      })
      queryClient.invalidateQueries({ queryKey: ['system-connectors'] })
      showToast(`✓ Database connector for ${preset.name} saved and activated!`)
      setViewMode('grid')
    } catch {
      showToast('Failed to save connector configuration.')
    }
  }

  // Sync All Data Mutation
  const syncMutation = useMutation({
    mutationFn: () => api.post('/api/connectors/sync', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-connectors'] })
      showToast('✓ All 8 active enterprise system connectors synchronized successfully!')
    },
  })

  // Seed Benchmark Mutation
  const seedMutation = useMutation({
    mutationFn: () => api.post('/api/connectors/seed', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-connectors'] })
      showToast('✓ Benchmark datasets seeded into PostgreSQL tables!')
    },
  })

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13.5,
            fontWeight: 600,
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <span>⚡</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="page-head">
        <PageIcon name="plug" />
        <div>
          <div className="crumb">
            <span style={{ color: 'var(--brand-purple)', fontWeight: 700 }}>Workspace</span>
            {' / '}
            <span>Connectors</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <span
              style={{
                background: 'rgba(111, 61, 186, 0.1)',
                color: 'var(--brand-purple)',
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.06em',
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              • ENTERPRISE INTEGRATION HUB
            </span>
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            {viewMode === 'grid' ? 'Connected Databases & System Sources' : 'System Connectors & Data Sync'}
          </h1>
        </div>
        <span className="spacer" />

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {viewMode === 'form' ? (
            <>
              <span
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#16a34a',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
                Store: Connected (PostgreSQL / Neon)
              </span>
              <button className="btn outline" onClick={() => setViewMode('grid')}>
                ← Back to Connectors
              </button>
            </>
          ) : (
            <>
              <button
                className="btn outline"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
                style={{ fontWeight: 600 }}
              >
                <Icon name="refresh" size={16} />
                {syncMutation.isPending ? 'Synchronizing...' : 'Synchronize All Data'}
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  handleSelectPreset('generic-db')
                  setViewMode('form')
                }}
                style={{ fontWeight: 700 }}
              >
                + Add Connector
              </button>
            </>
          )}
        </div>
      </div>

      {/* Top KPI Cards (Always visible) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
              CUSTOMER ORDERS
            </span>
            <span style={{ fontSize: 15 }}>📦</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>
            {kpis.customer_orders.toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
              CUSTOMERS
            </span>
            <span style={{ fontSize: 15 }}>🏢</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>
            {kpis.customers}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
              PRODUCTS
            </span>
            <span style={{ fontSize: 15 }}>📦</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>
            {kpis.products}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
              RAW INVENTORY ITEMS
            </span>
            <span style={{ fontSize: 15 }}>🗄️</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>
            {kpis.raw_inventory_items.toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
              PRODUCTION ORDERS
            </span>
            <span style={{ fontSize: 15 }}>⚙️</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>
            {kpis.production_orders.toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="small muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
              SHIPMENT MILESTONES
            </span>
            <span style={{ fontSize: 15 }}>📈</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>
            {kpis.shipment_milestones.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: CONNECTORS GRID VIEW                                              */}
      {/* ========================================================================= */}
      {viewMode === 'grid' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section Subheading */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🗄️</span>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                Connected Enterprise Databases &amp; External Feeds ({connectors.length} Active)
              </h2>
            </div>
            <div className="small muted" style={{ fontStyle: 'italic' }}>
              PostgreSQL Operational Analytical Core
            </div>
          </div>

          {/* Connectors Grid (3 Columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
            {connectors.map((c) => {
              const isPingTesting = testingPingId === c.id
              const hasPing = pingResult?.id === c.id

              return (
                <div
                  key={c.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 20,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div>
                    {/* Top Row: Icon + Name + Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: c.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(111, 61, 186, 0.1)',
                            color: c.status === 'ACTIVE' ? '#16a34a' : 'var(--brand-purple)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                          }}
                        >
                          {c.id.includes('postgres') || c.id.includes('db') ? '🗄️' : c.id.includes('sap') ? '🏢' : c.id.includes('siemens') ? '⚙️' : c.id.includes('wms') ? '📦' : c.id.includes('tms') ? '🚚' : c.id.includes('qms') ? '🛡️' : '📄'}
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                            {c.name}
                          </h3>
                          <div className="small muted" style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>
                            {c.subtitle}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: c.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.12)' : c.status === 'READY' ? 'rgba(111, 61, 186, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                          color: c.status === 'ACTIVE' ? '#16a34a' : c.status === 'READY' ? 'var(--brand-purple)' : '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.status === 'ACTIVE' ? '#22c55e' : '#3b82f6' }} />
                        {c.status_badge || c.status}
                      </span>
                    </div>

                    {/* Description */}
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45, margin: '10px 0 14px' }}>
                      {c.description}
                    </p>

                    {/* Protocol & Mapped records gray box */}
                    <div
                      style={{
                        background: 'var(--muted-fill)',
                        padding: '10px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 5,
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <span className="small muted" style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em' }}>
                          PROTOCOL / ENDPOINT:
                        </span>
                        <div style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text)', marginTop: 1, wordBreak: 'break-all' }}>
                          {c.endpoint}
                        </div>
                      </div>

                      <div style={{ marginTop: 2 }}>
                        <span className="small muted" style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em' }}>
                          MAPPED RECORDS:
                        </span>
                        <div style={{ fontSize: 11.5, color: 'var(--text)', marginTop: 1 }}>
                          {c.mapped_records}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer with Latency and Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                      <span>⚡</span>
                      <span>{hasPing ? `${pingResult.latency_ms}ms latency` : `${c.latency_ms || 42}ms latency`}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn outline"
                        style={{ fontSize: 12, padding: '4px 10px', fontWeight: 600 }}
                        disabled={isPingTesting}
                        onClick={() => handleTestPing(c)}
                      >
                        {isPingTesting ? 'Pinging...' : 'Test Ping'}
                      </button>
                      <button
                        className="btn primary"
                        style={{ fontSize: 12, padding: '4px 12px', fontWeight: 700 }}
                        onClick={() => handleConfigureConnector(c)}
                      >
                        ⚙️ Configure
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* 9th Card: Add Another Connector */}
            <div
              className="card"
              onClick={() => {
                handleSelectPreset('generic-db')
                setViewMode('form')
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 30,
                borderRadius: 12,
                border: '2px dashed rgba(111, 61, 186, 0.35)',
                background: 'rgba(111, 61, 186, 0.02)',
                textAlign: 'center',
                cursor: 'pointer',
                minHeight: 280,
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(111, 61, 186, 0.12)',
                  color: 'var(--brand-purple)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                +
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                Add Another Connector
              </h3>
              <p className="muted small" style={{ maxWidth: 280, margin: '0 0 16px', lineHeight: 1.4 }}>
                Connect new ERP, MES, WMS, TMS, PLM databases, or custom REST webhooks.
              </p>
              <button
                className="btn primary"
                style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 16px' }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectPreset('generic-db')
                  setViewMode('form')
                }}
              >
                Open Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SELECTOR CONNECTOR & CONNECTION STRING FORM (Screenshot 3)        */}
      {/* ========================================================================= */}
      {viewMode === 'form' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(460px, 1.4fr) minmax(320px, 1fr)', gap: 20 }}>
          {/* ================= LEFT COLUMN: FORM ================= */}
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🔌</span>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                  1. Select Connector
                </h2>
              </div>
              <div className="small muted" style={{ marginTop: 2 }}>
                Choose source integration or database protocol
              </div>
            </div>

            {/* Dropdown: Source Connector Type */}
            <div>
              <label className="small muted" style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
                Source Connector Type *
              </label>
              <select
                value={selectedPresetKey}
                onChange={(e) => handleSelectPreset(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, fontWeight: 600 }}
              >
                <option value="postgresql-neon">PostgreSQL / Neon Cloud Store — [Analytical Data Warehouse]</option>
                <option value="sap-s4hana">SAP S/4HANA (Enterprise ERP) — [Commercial &amp; Sales Orders]</option>
                <option value="siemens-opcenter">Siemens Opcenter MES — [Manufacturing Execution Floor]</option>
                <option value="sap-ewm">SAP EWM / Manhattan WMS — [Warehouse &amp; Staging Facilities]</option>
                <option value="blue-yonder-tms">Blue Yonder TMS — [Logistics, Carriers &amp; Tracking]</option>
                <option value="veeva-trackvia">Veeva / TrackVia QMS — [Quality Certifications &amp; Inspection]</option>
                <option value="ptc-windchill">PTC Windchill PLM — [Engineering &amp; Bill of Materials]</option>
                <option value="generic-db">Custom PostgreSQL / MySQL / MongoDB / Oracle Connection String</option>
              </select>
            </div>

            <div className="small muted" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
              {CONNECTOR_PRESETS[selectedPresetKey]?.description || 'High-concurrency PostgreSQL data store with SSL connection pooling.'}
            </div>

            {/* Input Method Switcher (Connection String URI vs Individual Fields) */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="small muted" style={{ fontWeight: 800, fontSize: 11, letterSpacing: '0.04em' }}>
                  CONNECTION PARAMETERS (6 REQUIRED FIELDS)
                </span>
                <div style={{ display: 'flex', gap: 4, background: 'var(--muted-fill)', padding: 2, borderRadius: 6 }}>
                  <button
                    type="button"
                    style={{
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 4,
                      border: 'none',
                      background: inputMethod === 'string' ? 'var(--brand-purple)' : 'transparent',
                      color: inputMethod === 'string' ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setInputMethod('string')}
                  >
                    🔗 Connection String URI
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 4,
                      border: 'none',
                      background: inputMethod === 'fields' ? 'var(--brand-purple)' : 'transparent',
                      color: inputMethod === 'fields' ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setInputMethod('fields')}
                  >
                    📋 Individual Fields
                  </button>
                </div>
              </div>

              {/* Direct Connection String Input */}
              {inputMethod === 'string' ? (
                <div style={{ marginBottom: 16 }}>
                  <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Database Connection String (URI format) *
                  </label>
                  <textarea
                    rows={3}
                    value={connString}
                    onChange={(e) => handleConnStringChange(e.target.value)}
                    placeholder="postgresql://username:password@host:port/database?sslmode=require"
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: 12.5,
                      padding: 10,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                    }}
                  />
                  <div className="small muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Supports <code>postgresql://</code>, <code>mysql://</code>, <code>mongodb+srv://</code>, <code>oracle://</code>, or <code>https://</code> APIs.
                  </div>
                </div>
              ) : null}

              {/* Form Fields: Host & Port */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Host / Endpoint
                  </label>
                  <input
                    type="text"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    placeholder="ep-manufacturing-360.neon.tech"
                    style={{ width: '100%', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Port
                  </label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(Number(e.target.value))}
                    placeholder="5432"
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Form Fields: Database Name, Username & Password */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Database Name
                  </label>
                  <input
                    type="text"
                    value={formDb}
                    onChange={(e) => setFormDb(e.target.value)}
                    placeholder="neondb"
                    style={{ width: '100%', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={formUser}
                    onChange={(e) => setFormUser(e.target.value)}
                    placeholder="neondb_owner"
                    style={{ width: '100%', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Password / Token
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{ width: '100%', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Form Fields: SSL Mode & Connection Pool Size */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    SSL Mode
                  </label>
                  <select
                    value={formSsl}
                    onChange={(e) => setFormSsl(e.target.value)}
                    style={{ width: '100%', fontWeight: 600 }}
                  >
                    <option value="require">require (Encrypted SSL)</option>
                    <option value="prefer">prefer (Attempt SSL)</option>
                    <option value="disable">disable (Unencrypted)</option>
                    <option value="verify-full">verify-full (Strict Root CA)</option>
                  </select>
                </div>
                <div>
                  <label className="small muted" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    Connection Pool Size
                  </label>
                  <input
                    type="number"
                    value={formPool}
                    onChange={(e) => setFormPool(Number(e.target.value))}
                    placeholder="25"
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Ping Test Result Banner */}
              {formTestSuccess && (
                <div
                  style={{
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid #22c55e',
                    padding: '10px 14px',
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    color: '#16a34a',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>✓</span>
                  <span>{formTestSuccess.message} ({formTestSuccess.latency_ms}ms response)</span>
                </div>
              )}

              {/* Action Buttons: Test Connection & Connect */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn outline"
                  style={{ flex: 1, height: 40, fontWeight: 700 }}
                  disabled={isTestingForm}
                  onClick={handleTestFormConnection}
                >
                  ⚡ {isTestingForm ? 'Testing Ping...' : 'Test Connection'}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  style={{ flex: 1.5, height: 40, fontWeight: 700 }}
                  onClick={handleSaveConnector}
                >
                  Connect {CONNECTOR_PRESETS[selectedPresetKey]?.protocol || 'Database'}
                </button>
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN: DATASET SEED & SYNC (Screenshot 3) ================= */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Card 1: Seed Manufacturing Datasets */}
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>📄</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    Seed Manufacturing Datasets
                  </h3>
                  <div className="small muted">
                    Load or re-seed the full benchmark datasets directly into PostgreSQL
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '12px 0 16px' }}>
                Loads 1,500 customer orders, 6,624 raw inventory records, 450 production orders, and 1,000 shipment milestones into the analytical operational store.
              </p>

              <button
                className="btn primary"
                style={{ width: '100%', height: 38, fontWeight: 700, fontSize: 13 }}
                disabled={seedMutation.isPending}
                onClick={() => seedMutation.mutate()}
              >
                📄 {seedMutation.isPending ? 'Seeding Benchmark Data...' : 'Seed Benchmark Data'}
              </button>
            </div>

            {/* Card 2: Synchronize Current System */}
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>🔄</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    Synchronize Current System
                  </h3>
                  <div className="small muted">
                    Run live monitoring cycle &amp; invalidate stale cache.
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '12px 0 16px' }}>
                Triggers Agent background surveillance across active customer orders, refreshes delivery milestone tracking, and updates operational KPI caches.
              </p>

              <button
                className="btn outline"
                style={{ width: '100%', height: 38, fontWeight: 700, fontSize: 13 }}
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
              >
                🔄 {syncMutation.isPending ? 'Synchronizing System...' : 'Synchronize System Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
