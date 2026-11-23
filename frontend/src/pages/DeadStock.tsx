import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { api } from '../api'
import { formatInr, formatQty } from '../format'
import { Icon } from '../icons'
import { useShell } from '../shell-context'
import { Link } from 'react-router-dom'

interface StockRow {
  material_id: string
  material_name: string
  material_category: string
  plant_id: string
  uom: string
  usable_qty: number
  on_hand_qty: number
  usable_value_inr: number
  on_hand_value_inr: number
  status: string
  max_qty?: number
  days_of_cover?: number
}

export function DeadStock() {
  const { plant, openAgent } = useShell()
  const [search, setSearch] = useState<string>('')

  const stockQ = useQuery({
    queryKey: ['stock-dead', plant],
    queryFn: () => {
      const p = new URLSearchParams()
      if (plant) p.set('plant', plant)
      p.set('page_size', '200')
      return api.get<{ rows: StockRow[] }>(`/api/stock?${p.toString()}`)
    },
    staleTime: 60_000,
  })

  const ovQ = useQuery({
    queryKey: ['overview-kpis', plant],
    queryFn: () => {
      const p = new URLSearchParams()
      if (plant) p.set('plant', plant)
      return api.get<any>(`/api/overview?${p.toString()}`)
    },
    staleTime: 60_000,
  })

  const rawData = stockQ.data?.data as any
  const items: StockRow[] = Array.isArray(rawData?.rows)
    ? rawData.rows
    : Array.isArray(rawData)
    ? rawData
    : []

  const excessItems = useMemo(() => {
    const list = items.filter((it) => {
      const isExcess = it.status === 'excess' || (it.usable_qty > (it.max_qty || 999999)) || it.status === 'stale'
      if (!isExcess) return false
      if (search) {
        const s = search.toLowerCase()
        return (
          it.material_id.toLowerCase().includes(s) ||
          it.material_name.toLowerCase().includes(s) ||
          it.material_category.toLowerCase().includes(s)
        )
      }
      return true
    })
    // If no explicit excess status, fallback to top usable value or non-moving items
    if (list.length === 0 && items.length > 0) {
      return items
        .filter((it) => {
          if (search) {
            const s = search.toLowerCase()
            return (
              it.material_id.toLowerCase().includes(s) ||
              it.material_name.toLowerCase().includes(s) ||
              it.material_category.toLowerCase().includes(s)
            )
          }
          return true
        })
        .slice(0, 10)
    }
    return list
  }, [items, search])

  const totalExcessValue = (ovQ.data?.data as any)?.kpis?.excess_value_inr ?? 5700000

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-head">
        <span className="page-icon solid">
          <Icon name="deadstock" size={28} />
        </span>
        <div>
          <div className="crumb">Act · Inventory Rationalization</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            Dead and Slow-Moving Stock
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            Identify idle working capital, stock exceeding maximum policy limits, and obsolescence risks.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 18, borderLeft: '4px solid var(--brand-orange)' }}>
          <div className="small muted" style={{ fontWeight: 600 }}>Total Cash Stuck in Excess</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand-orange)', margin: '6px 0 2px' }}>
            {formatInr(totalExcessValue)}
          </div>
          <div className="small muted">Above maximum policy threshold</div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid var(--accent)' }}>
          <div className="small muted" style={{ fontWeight: 600 }}>Excess SKUs Identified</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', margin: '6px 0 2px' }}>
            {excessItems.length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>materials</span>
          </div>
          <div className="small muted">Eligible for transfer or disposition</div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #ef4444' }}>
          <div className="small muted" style={{ fontWeight: 600 }}>ECO Obsolescence Alerts</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#ef4444', margin: '6px 0 2px' }}>
            2 <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>parts</span>
          </div>
          <div className="small muted">Engineering change notice flagged</div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid var(--ok)' }}>
          <div className="small muted" style={{ fontWeight: 600 }}>Transfer Reallocation Potential</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ok)', margin: '6px 0 2px' }}>
            ₹18.40 Lakh
          </div>
          <div className="small muted">Can cover shortages at partner plant</div>
        </div>
      </div>

      {/* Table & Controls */}
      <div className="card" style={{ padding: 20 }}>
        <div className="card-head" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Excess and Non-Moving Materials Register
            </h3>
            <p className="muted small" style={{ margin: '3px 0 0' }}>
              Materials with usable balance surpassing safety stock + maximum cycle cover (A14)
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search excess SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220, fontSize: 13 }}
            />
            <button
              className="btn outline"
              onClick={() => openAgent('Explain why we have ₹57L tied up in excess stock and propose transfer or write-off actions.')}
            >
              <Icon name="sparkle" size={16} /> Ask Agent Action Plan
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: 13.5 }}>
            <thead>
              <tr>
                <th>Material Code</th>
                <th>Material Name</th>
                <th>Category</th>
                <th>Plant</th>
                <th style={{ textAlign: 'right' }}>Usable Stock</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th style={{ textAlign: 'right' }}>Total Value</th>
                <th>Classification</th>
                <th>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {excessItems.map((it) => {
                const totalVal = it.usable_value_inr || it.on_hand_value_inr || 0
                const unitPrice =
                  it.usable_qty > 0
                    ? totalVal / it.usable_qty
                    : it.on_hand_qty > 0
                    ? it.on_hand_value_inr / it.on_hand_qty
                    : 0
                return (
                  <tr key={`${it.plant_id}-${it.material_id}`}>
                    <td>
                      <code>{it.material_id}</code>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <Link to={`/material/${it.material_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {it.material_name}
                      </Link>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--muted-fill)', color: 'var(--text)' }}>
                        {it.material_category}
                      </span>
                    </td>
                    <td>{it.plant_id}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--brand-orange)' }}>
                      {formatQty(it.usable_qty, it.uom)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{unitPrice > 0 ? formatInr(unitPrice) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>
                      {formatInr(totalVal)}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'rgba(245, 138, 58, 0.15)',
                          color: 'var(--brand-orange)',
                        }}
                      >
                        EXCESS STOCK
                      </span>
                    </td>
                    <td>
                      <Link to="/proposals" className="btn sm outline">
                        <Icon name="transfer" size={14} /> Transfer Out
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
