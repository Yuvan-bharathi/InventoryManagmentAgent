import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Area, Bar, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type Paged } from '../api'
import { day, inr, num, qty, shortDay, STATE_TEXT } from '../format'
import { Assumed, AssumptionIds, PageState, ScenarioTag, StatusLabel } from '../kit'
import { useShell } from '../shell-context'
import { AXIS, TIP } from '../theme'
import { PageIcon } from '../icons'

type R = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type M360 = { header: R; position: R; projection: R[]; locations: R[]; requirements: R[]; open_po_lines: R[];
  receipts: R[]; supplier_lead_times: R[]; engineering_changes: R[] }

export function MaterialPicker() {
  const nav = useNavigate()
  const { plant } = useShell()
  const q = useQuery({ queryKey: ['stock-pick', plant], queryFn: () => api.get<Paged<R>>(`/api/stock?page_size=500&sort=status${plant ? `&plant=${plant}` : ''}`) })
  return (
    <div>
      <div className="page-head"><PageIcon name="material" /><div><div className="crumb">Inventory › Material 360</div><h1>Material 360</h1>
        <div className="muted">Pick a material and plant.</div></div></div>
      <PageState loading={q.isLoading} error={q.error}>
        <div className="grid g4">{q.data?.data.rows.map((r) => (
          <button key={r.material_id + r.plant_id} className="card kpi" style={{ textAlign: 'left' }} onClick={() => nav(`/material/${r.material_id}?plant=${r.plant_id}`)}>
            <div className="row"><b>{r.material_id}</b><span className="spacer" /><StatusLabel status={r.status} /></div>
            <div className="small muted">{r.material_name} · {r.plant_id}</div>
          </button>))}</div>
      </PageState>
    </div>
  )
}

export function Material360() {
  const { materialId } = useParams()
  const [sp, setSp] = useSearchParams()
  const { plant: globalPlant, shell, setAgentCtx, openAgent } = useShell()
  const plant = sp.get('plant') || globalPlant || shell?.plants[0]?.plant_id || ''
  const [tab, setTab] = useState<'overview' | 'demand' | 'supply'>('overview')
  const q = useQuery({ queryKey: ['m360', materialId, plant], enabled: !!plant,
    queryFn: () => api.get<M360>(`/api/materials/${materialId}?plant=${plant}`) })
  useEffect(() => setAgentCtx({ page: 'Material 360', item: { type: 'material', id: materialId!, plant, label: `${materialId} @ ${plant}` } }), [materialId, plant]) // eslint-disable-line
  const d = q.data?.data
  const h = d?.header, p = d?.position, u = h?.uom
  return (
    <div>
      <div className="crumb"><Link to="/stock">Inventory</Link> › <Link to="/material">Material 360</Link> › {materialId}</div>
      <PageState loading={q.isLoading} error={q.error}>
        {d && h && p && (
          <div className="grid">
            <div className="card row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="row"><h1>{h.material_id}</h1><StatusLabel status={h.status} /><ScenarioTag /></div>
                <div className="muted">{h.material_name} · {h.category} · {u} · shelf life {h.shelf_life_days || '—'} days</div>
              </div>
              <span className="spacer" />
              <dl className="kv">
                <dt>Plant</dt><dd><select value={plant} onChange={(e) => setSp({ plant: e.target.value })}>{shell?.plants.map((x) => <option key={x.plant_id}>{x.plant_id}</option>)}</select></dd>
                <dt>Standard cost</dt><dd>{inr(h.standard_price_inr)} / {u}</dd>
                <dt>Preferred supplier</dt><dd><Assumed ids={['A11', 'A20']}>{h.preferred_supplier_id ?? 'To be assigned (A11)'}</Assumed></dd>
                <dt>Open proposal</dt><dd>{h.open_proposal ? <Link to={`/proposals/${h.open_proposal.id}`}>{h.open_proposal.proposal_no} · {STATE_TEXT[h.open_proposal.state]}</Link> : '—'}</dd>
              </dl>
              <div className="grid" style={{ gap: 6 }}>
                {h.open_proposal && <Link className="btn primary" to={`/proposals/${h.open_proposal.id}`}>Review proposal</Link>}
                <button className="btn" onClick={() => openAgent(`Why is ${h.material_id} at ${plant} ${String(h.status).replace('_', ' ')}?`)}>Ask the agent why</button>
              </div>
            </div>
            <div className="tabs">
              {(['overview', 'demand', 'supply'] as const).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
            </div>
            {tab === 'overview' && <OverviewTab d={d} u={u} />}
            {tab === 'demand' && <DemandTab d={d} u={u} />}
            {tab === 'supply' && <SupplyTab d={d} u={u} />}
            <div className="small muted">Assumptions: <AssumptionIds ids={q.data?.meta.assumption_ids} /></div>
          </div>
        )}
      </PageState>
    </div>
  )
}

function OverviewTab({ d, u }: { d: M360; u: string }) {
  const p = d.position
  const parts = [['Usable', p.usable_qty, 'var(--brand-purple)'], ['Allocated', p.allocated_qty, 'var(--brand-blue)'], ['Blocked', p.blocked_qty, 'var(--st-critical)'],
    ['QC hold', p.quality_hold_qty, 'var(--brand-orange)'], ['In transit', p.in_transit_qty, 'var(--cyan)']] as [string, number, string][]
  const tot = parts.reduce((a, x) => a + (x[1] || 0), 0) || 1
  const rop = (p.ss_qty ?? 0) + (p.daily_demand_qty ?? 0) * (p.lt_days ?? 0)
  const data = d.projection.map((r) => ({ ...r, label: shortDay(r.date), band: [p.ss_qty, p.max_qty] }))
  return (
    <div className="grid g3">
      <div className="card" style={{ gridColumn: 'span 2' }}>
        <div className="row"><h2>Projection · {d.projection.length} days</h2><ScenarioTag /></div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 10 }} interval={6} stroke="var(--chart-grid)" /><YAxis width={60} tick={AXIS} stroke="var(--chart-grid)" />
            <Tooltip formatter={(v) => (Array.isArray(v) ? v.map((x) => num(Number(x))).join(' – ') : num(Number(v)))} contentStyle={TIP} />
            <Area dataKey="band" name="Safety–max band" fill="var(--chart-band)" stroke="none" />
            <Bar dataKey="requirement" name="Requirement" fill="var(--chart-c1)" fillOpacity={0.45} />
            <Bar dataKey="po_receipts" name="PO receipts" fill="var(--brand-orange)" />
            <Line dataKey="projected_qty" name="Projected" stroke="var(--brand-purple)" strokeWidth={2} dot={false} />
            <ReferenceLine y={0} stroke="var(--st-critical)" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="small muted">Band = safety stock to max (max derived, A14). Bars: requirements (planning scenario) and expected PO receipts (A8–A10, A19).</div>
      </div>
      <div className="card">
        <h2>Position</h2>
        <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 8 }}>
          {parts.map(([l, v, c]) => <div key={l} title={`${l}: ${qty(v, u)}`} style={{ width: `${(100 * (v || 0)) / tot}%`, background: c }} />)}</div>
        <div className="small row">{parts.map(([l, v, c]) => <span key={l} className="row" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: c, borderRadius: 2 }} />{l} {qty(v, u)}</span>)}</div>
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>Usable</dt><dd><Assumed ids={['A3', 'A6']}>{qty(p.usable_qty, u)}</Assumed></dd>
          <dt>Days of cover</dt><dd><Assumed ids={['A15']}>{num(p.days_of_cover, 1)}</Assumed></dd>
          <dt>Safety stock</dt><dd><Assumed ids={['A5']}>{qty(p.ss_qty, u)}</Assumed></dd>
          <dt>Reorder point</dt><dd title="SS + daily demand × lead time">{qty(rop, u)}</dd>
          <dt>Max stock</dt><dd><Assumed ids={['A14']}>{qty(p.max_qty, u)}</Assumed></dd>
          <dt>Lead time</dt><dd><Assumed ids={['A18', 'A20']}>{p.lt_days} days ({p.lt_source}; master {p.master_lt_days})</Assumed></dd>
          <dt>Shortage date</dt><dd><Assumed ids={p.assumption_ids}>{day(p.shortage_date)}{p.days_to_shortage != null ? ` (day ${p.days_to_shortage})` : ''}</Assumed></dd>
          <dt>Stock-out date</dt><dd>{day(p.stockout_date)}</dd>
          <dt>Orders affected</dt><dd>{p.orders_affected}</dd>
          <dt>Daily demand</dt><dd><Assumed ids={['A15']}>{qty(p.daily_demand_qty, u)}</Assumed></dd>
        </dl>
      </div>
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h2>Stock by location and lot</h2>
        <table className="dg compact"><thead><tr><th>Location</th><th>Lot</th><th className="num">On hand</th><th className="num">Allocated</th><th className="num">Blocked</th><th className="num">QC hold</th><th className="num">In transit</th><th>Status (ignored, A4)</th><th>Expiry</th></tr></thead>
          <tbody>{d.locations.map((l) => <tr key={l.id}><td>{l.warehouse_id}</td><td>{l.lot_id}</td><td className="num">{qty(+l.on_hand_qty, u)}</td>
            <td className="num">{qty(+l.allocated_qty, u)}</td><td className="num">{qty(+l.blocked_qty, u)}</td><td className="num">{qty(+l.quality_hold_qty, u)}</td>
            <td className="num">{qty(+l.in_transit_qty, u)}</td><td>{l.inventory_status}</td><td>{day(l.expiry_date)}</td></tr>)}</tbody></table>
      </div>
      {d.engineering_changes.length > 0 && <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h2>Engineering changes on this part ({d.engineering_changes.length})</h2>
        <table className="dg compact"><thead><tr><th>Change</th><th>Type</th><th>Product</th><th>Revision</th><th>Cut-in</th><th>Status</th></tr></thead>
          <tbody>{d.engineering_changes.slice(0, 8).map((e) => <tr key={e.id}><td>{e.change_request_id}</td><td>{e.change_type}</td><td>{e.product_id}</td>
            <td>{e.old_revision} → {e.new_revision}</td><td>{day(e.cut_in_date)}</td><td>{e.implementation_status}</td></tr>)}</tbody></table></div>}
    </div>
  )
}

function DemandTab({ d, u }: { d: M360; u: string }) {
  return (
    <div className="card">
      <div className="row"><h2>Requirements by production order</h2><ScenarioTag /><span className="spacer" />
        <span className="small muted">{d.requirements.length} orders · BOM qty per includes scrap · no reservations in the data</span></div>
      <div className="dg-wrap"><table className="dg compact"><thead><tr><th>Order</th><th>Product</th><th>Date</th><th>Priority</th><th className="num">Required</th><th className="num">Reserved</th><th className="num">Unreserved</th></tr></thead>
        <tbody>{d.requirements.map((r) => <tr key={r.production_order_id}><td>{r.production_order_id}</td><td>{r.product_id}</td><td>{day(r.date)}</td><td>{r.priority}</td>
          <td className="num">{qty(r.required_qty, u)}</td><td className="num">{qty(r.reserved_qty, u)}</td><td className="num">{qty(r.unreserved_qty, u)}</td></tr>)}</tbody></table></div>
    </div>
  )
}

function SupplyTab({ d, u }: { d: M360; u: string }) {
  return (
    <div className="grid">
      <div className="card">
        <h2>Open PO lines <AssumptionIds ids={['A8', 'A9', 'A10', 'A19']} /></h2>
        <div className="dg-wrap"><table className="dg compact"><thead><tr><th>PO</th><th>Line</th><th>Supplier</th><th className="num">Ordered</th><th className="num">Received</th><th className="num">Open</th><th>Promised</th><th className="num">Days overdue</th><th>Expected</th><th>Basis</th></tr></thead>
          <tbody>{d.open_po_lines.map((r) => <tr key={r.id}><td>{r.po_id}</td><td>{r.po_line}</td><td>{r.supplier_id}</td><td className="num">{qty(+r.ordered_qty, u)}</td>
            <td className="num">{qty(+r.received_qty, u)}</td><td className="num"><b>{qty(+r.open_qty, u)}</b></td><td>{day(r.promised_date)}</td>
            <td className="num">{r.days_overdue || ''}</td><td>{day(r.expected_date)}</td><td className="small muted">{r.date_basis}</td></tr>)}</tbody></table></div>
      </div>
      <div className="grid g2">
        <div className="card">
          <h2>Approved suppliers: promised vs actual lead time</h2>
          <table className="dg compact"><thead><tr><th>Rank</th><th>Supplier</th><th className="num">On time</th><th className="num">Promised LT</th><th className="num">Actual LT</th><th className="num">Receipts</th></tr></thead>
            <tbody>{d.supplier_lead_times.map((r) => <tr key={r.id}><td>{r.rank}</td><td>{r.supplier_id}</td>
              <td className="num" title={r.on_time_basis}>{r.on_time_pct == null ? '—' : `${Math.round(100 * r.on_time_pct)}%`}</td>
              <td className="num">{r.promised_lt_days == null ? `${r.standard_lt_days} (std)` : num(+r.promised_lt_days, 1)}</td>
              <td className="num">{r.actual_lt_days == null ? '—' : num(+r.actual_lt_days, 1)}</td><td className="num">{r.receipts ?? 0}</td></tr>)}</tbody></table>
          {d.supplier_lead_times.length === 0 && <div className="small muted">No approved supplier for this category (A11): supplier to be assigned.</div>}
        </div>
        <div className="card">
          <h2>Receipts history</h2>
          <div className="dg-wrap" style={{ maxHeight: 280 }}><table className="dg compact"><thead><tr><th>Received</th><th>PO</th><th>Supplier</th><th className="num">Qty</th><th className="num">Actual LT</th></tr></thead>
            <tbody>{d.receipts.map((r) => <tr key={r.id}><td>{day(r.received_date)}</td><td>{r.po_id}</td><td>{r.supplier_id}</td><td className="num">{qty(+r.received_qty, u)}</td><td className="num">{r.actual_lt_days} d</td></tr>)}</tbody></table></div>
        </div>
      </div>
    </div>
  )
}
