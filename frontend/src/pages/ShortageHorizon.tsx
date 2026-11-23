import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Envelope, Paged } from '../api'
import { day, qty, shortDay, STATE_TEXT, STATUS_TEXT } from '../format'
import { Assumed, DataGrid, DemandBanner, DemandToggle, ScenarioTag, StatusLabel, useDemandSource, type Col, type DemandView } from '../kit'
import { useShell } from '../shell-context'
import { PageIcon } from '../icons'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Heat = { material_id: string; plant_id: string; status: string; cells: { date: string; status: string; qty: number }[] }

export function ShortageHorizon() {
  const { plant, shell, setAgentCtx, openAgent } = useShell()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [horizon, setHorizon] = useState(Number(sp.get('horizon') ?? 30))
  const [status, setStatus] = useState(sp.get('status') ?? '')
  const [category, setCategory] = useState('')
  const [view, setView] = useState<'daily' | 'weekly'>('daily')
  const [heat, setHeat] = useState<Heat[]>([])
  const [source, setSource] = useDemandSource()
  const [dv, setDv] = useState<DemandView | undefined>()
  useEffect(() => setAgentCtx({ page: 'Shortage Horizon' }), []) // eslint-disable-line

  const cols: Col<Row>[] = [
    { key: 'material_id', label: 'Material', render: (r) => <><b>{r.material_id}</b><div className="small muted">{r.material_name}</div></> },
    { key: 'plant_id', label: 'Plant' },
    { key: 'material_category', label: 'Category' },
    { key: 'status', label: 'Status', render: (r) => <Assumed ids={r.assumption_ids}><StatusLabel status={r.status} /></Assumed> },
    { key: 'usable_qty', label: 'Usable now', num: true, render: (r) => qty(r.usable_qty, r.uom) },
    { key: 'shortage_date', label: 'Shortage date', render: (r) => <Assumed ids={[dv?.source === 'production_orders' ? 'A21' : 'A15', 'A19', 'A20']}>{day(r.shortage_date)}</Assumed> },
    { key: 'days_to_shortage', label: 'Days', num: true },
    { key: 'shortage_qty', label: 'Shortage qty', num: true, render: (r) => qty(r.shortage_qty, r.uom), title: 'Safety stock minus the lowest projected stock' },
    { key: 'lt_days', label: 'Lead time', render: (r) => <Assumed ids={['A18', 'A20']}>{r.lt_days} d <span className="small muted">(master {r.master_lt_days ?? '—'}, {r.lt_source})</span></Assumed> },
    { key: 'in_time', label: 'In time?', render: (r) => <span className={`status ${r.in_time === 'yes' ? 'healthy' : r.in_time === 'expedite' ? 'at_risk' : 'critical'}`}>{r.in_time === 'yes' ? 'Yes' : r.in_time === 'expedite' ? 'Expedite' : 'No'}</span> },
    { key: 'stockout_date', label: 'Stock-out', render: (r) => day(r.stockout_date) },
    { key: 'orders_affected', label: 'Orders affected', num: true },
    { key: 'recommended_action', label: 'Recommended action' },
    { key: 'proposal_state', label: 'Proposal', render: (r) => r.proposal_id ? <Link to={`/proposals/${r.proposal_id}`} onClick={(e) => e.stopPropagation()}>{r.proposal_no} · {STATE_TEXT[r.proposal_state]}</Link> : '—' },
  ]
  const days = heat[0]?.cells.map((c) => c.date) ?? []
  return (
    <div>
      <div className="page-head"><PageIcon name="shortage" />
        <div><div className="crumb">Planning › Shortage Horizon</div>
          <div className="row"><h1>Shortage Horizon</h1><ScenarioTag source={dv?.source} /></div>
          <div className="muted">Every coming shortage, and whether there is still time to replenish.</div></div>
        <span className="spacer" />
        <DemandToggle view={dv} onChange={setSource} />
        <button className="btn" onClick={() => openAgent('Which materials will go critical, and what are the options?')}>Ask the agent for options</button>
      </div>
      <DemandBanner view={dv} />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row"><h2>Heat map · next {Math.min(horizon, 30)} days</h2><span className="spacer" />
          <select value={view} onChange={(e) => setView(e.target.value as 'daily' | 'weekly')}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="heat"><thead><tr><td className="lbl" />{days.map((d) => <td key={d} className="lbl small muted" style={{ writingMode: view === 'daily' ? 'vertical-rl' : undefined, height: view === 'daily' ? 44 : undefined }}>{view === 'daily' ? shortDay(d) : d}</td>)}</tr></thead>
            <tbody>{heat.map((h) => <tr key={h.material_id + h.plant_id}>
              <td className="lbl"><Link to={`/material/${h.material_id}?plant=${h.plant_id}`}>{h.material_id}</Link> <span className="small muted">{h.plant_id}</span></td>
              {h.cells.map((c) => <td key={c.date} className={`c-${c.status}`} title={`${h.material_id} ${h.plant_id} ${c.date}: ${STATUS_TEXT[c.status]} · projected ${c.qty.toLocaleString('en-IN')}`} />)}
            </tr>)}</tbody></table>
        </div>
        <div className="row small" style={{ marginTop: 8 }}>{['critical', 'at_risk', 'excess', 'healthy'].map((s) => <span key={s} className="row" style={{ gap: 4 }}><span className={`c-${s}`} style={{ width: 12, height: 12, display: 'inline-block' }} />{STATUS_TEXT[s]}</span>)}
          <span className="muted">Cell = projected stock that day vs safety stock and max (A14).</span></div>
      </div>
      <DataGrid<Row> id="shortages" url="/api/shortages" params={{ horizon, plant, category, status, view, source }} columns={cols}
        rowKey={(r) => r.material_id + r.plant_id} exportUrl="/api/shortages/export.xlsx" exportName="shortages.xlsx"
        defaultSort="days_to_shortage" onRow={(r) => nav(`/material/${r.material_id}?plant=${r.plant_id}`)}
        onData={(e) => { const x = (e as Envelope<Paged<Row> & { heatmap: Heat[]; demand_view: DemandView }>).data; setHeat(x.heatmap); setDv(x.demand_view) }}
        toolbar={<>
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>{[7, 14, 30, 60].map((h) => <option key={h} value={h}>Horizon: {h} days</option>)}</select>
          <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{shell?.categories.map((c) => <option key={c}>{c}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Critical + at risk</option><option value="critical">Critical</option><option value="at_risk">At risk</option></select>
        </>} />
    </div>
  )
}
