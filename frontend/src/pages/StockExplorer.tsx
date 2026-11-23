import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Envelope, Paged } from '../api'
import { inr, num, qty } from '../format'
import { Assumed, DataGrid, StatusLabel, type Col, ScenarioTag } from '../kit'
import { useShell } from '../shell-context'
import { PageIcon } from '../icons'

type Row = Record<string, string | number | null | string[]> & { material_id: string; plant_id: string; uom: string;
  assumption_ids: string[]; status: string }
type Summary = Record<string, number | string>

export function StockExplorer() {
  const { plant, shell, setAgentCtx } = useShell()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [category, setCategory] = useState(sp.get('category') ?? '')
  const [status, setStatus] = useState(sp.get('status') ?? '')
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<'material' | 'location'>('material')
  const [summary, setSummary] = useState<Summary>({})
  useEffect(() => setAgentCtx({ page: 'Stock Explorer' }), []) // eslint-disable-line

  const q = (k: string) => (r: Row) => qty(r[k] as number, r.uom)
  const cols: Col<Row>[] = [
    { key: 'material_id', label: 'Material', render: (r) => <><b>{r.material_id}</b><div className="small muted">{String(r.material_name)}</div></> },
    { key: 'material_category', label: 'Category' },
    { key: 'plant_id', label: 'Plant' },
    ...(level === 'location' ? [{ key: 'warehouse_id', label: 'Location' } as Col<Row>, { key: 'lot_id', label: 'Lot', hidden: true } as Col<Row>] : []),
    { key: 'on_hand_qty', label: 'On hand', num: true, render: q('on_hand_qty') },
    { key: 'allocated_qty', label: 'Allocated', num: true, render: q('allocated_qty') },
    { key: 'blocked_qty', label: 'Blocked', num: true, render: q('blocked_qty') },
    { key: 'quality_hold_qty', label: 'QC hold', num: true, render: q('quality_hold_qty') },
    { key: 'in_transit_qty', label: 'In transit', num: true, render: (r) => <Assumed ids={['A7']}>{qty(r.in_transit_qty as number, r.uom)}</Assumed> },
    { key: 'usable_qty', label: 'Usable', num: true, render: (r) => <Assumed ids={['A3', 'A4', 'A6']}><b>{qty(r.usable_qty as number, r.uom)}</b></Assumed> },
    ...(level === 'material' ? [
      { key: 'ss_qty', label: 'Safety stock', num: true, render: (r: Row) => <Assumed ids={['A5']}>{qty(r.ss_qty as number, r.uom)}</Assumed> },
      { key: 'max_qty', label: 'Max stock', num: true, render: (r: Row) => <Assumed ids={['A14', 'A15']}>{qty(r.max_qty as number, r.uom)}</Assumed> },
      { key: 'days_of_cover', label: 'Days of cover', num: true, render: (r: Row) => <Assumed ids={['A15']}>{num(r.days_of_cover as number, 1)}</Assumed> },
    ] as Col<Row>[] : [{ key: 'expiry_date', label: 'Expiry' } as Col<Row>]),
    { key: 'status', label: 'Status', render: (r) => <Assumed ids={r.assumption_ids}><StatusLabel status={r.status} /></Assumed> },
    { key: 'usable_value_inr', label: 'Usable value', num: true, render: (r) => inr(r.usable_value_inr as number) },
    { key: 'on_hand_value_inr', label: 'Stock value', num: true, render: (r) => inr(r.on_hand_value_inr as number) },
  ]
  const params = { plant, category, status, search, level }
  return (
    <div>
      <div className="page-head"><PageIcon name="stock" />
        <div><div className="crumb">Inventory › Stock Explorer</div><div className="row"><h1>Stock Explorer</h1><ScenarioTag /></div>
          <div className="muted">One trusted view of all stock at the as-of date.</div></div>
      </div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        {[['on_hand', 'On hand'], ['usable', 'Usable'], ['allocated', 'Allocated'], ['blocked', 'Blocked'], ['quality_hold', 'QC hold'], ['in_transit', 'In transit']].map(([k, l]) => (
          <div key={k} className="card"><div className="small muted">{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{inr(summary[`${k}_value_inr`] as number)}</div>
            <div className="small muted">{summary[`${k}_qty`] !== undefined ? qty(summary[`${k}_qty`] as number, summary.uom as string) : 'Quantities shown for one material only (mixed UoM)'}</div>
          </div>))}
      </div>
      <DataGrid<Row> id={`stock-${level}`} url="/api/stock" params={params} columns={cols}
        rowKey={(r) => `${r.material_id}|${r.plant_id}|${r.warehouse_id ?? ''}|${r.lot_id ?? ''}`}
        exportUrl="/api/stock/export.xlsx" exportName="stock.xlsx" defaultSort="material_id"
        onRow={(r) => nav(`/material/${r.material_id}?plant=${r.plant_id}`)}
        onData={(e) => setSummary((e as Envelope<Paged<Row> & { summary: Summary }>).data.summary)}
        toolbar={<>
          <input placeholder="Search material" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>
            {shell?.categories.map((c) => <option key={c}>{c}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>
            <option value="critical">Critical</option><option value="at_risk">At risk</option><option value="excess">Excess</option>
            <option value="healthy">Healthy</option><option value="stale">Stale</option></select>
          <select value={level} onChange={(e) => setLevel(e.target.value as 'material' | 'location')}>
            <option value="material">By material × plant</option><option value="location">By location and lot</option></select>
        </>} />
    </div>
  )
}
