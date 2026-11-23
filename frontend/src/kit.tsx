// Shared kit: status label, scenario + assumption tags, KPI tile, page states, data grid.
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, download, qs, type Envelope, type Paged } from './api'
import { STATUS_TEXT } from './format'
import { Icon, type IconName } from './icons'
import { useShell } from './shell-context'

export function StatusLabel({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="muted">—</span>
  return <span className={`status ${status}`}>{STATUS_TEXT[status] ?? status}</span>
}

export function ScenarioTag({ show = true, source }: { show?: boolean; source?: string }) {
  const { meta } = useShell()
  if (!show || (source ?? meta?.demand_source) !== 'scenario') return null
  return <span className="pill scenario" title="Planning scenario – replace with the organization's plan (A15)">Planning scenario</span>
}

/** A value that depends on assumptions: dotted underline, hover shows the assumption ids and wording. */
export function Assumed({ ids, children }: { ids?: string[] | null; children: ReactNode }) {
  const { assumptions } = useShell()
  if (!ids || ids.length === 0) return <>{children}</>
  const title = ids.map((id) => `${id}: ${assumptions[id]?.description ?? ''}`).join('\n')
  return <span className="aid" title={title} data-assumptions={ids.join(',')}>{children}</span>
}

export function AssumptionIds({ ids }: { ids?: string[] | null }) {
  const { assumptions } = useShell()
  if (!ids?.length) return null
  return (
    <span className="small muted">
      {ids.map((id, i) => (
        <span key={id} className="aid" title={`${id}: ${assumptions[id]?.description ?? ''}`}>{id}{i < ids.length - 1 ? ', ' : ''}</span>
      ))}
    </span>
  )
}

export type Tone = 'purple' | 'blue' | 'red' | 'orange' | 'teal'
export function KpiTile(props: { label: string; value: ReactNode; delta?: ReactNode; deltaDir?: 'up' | 'down';
  tip: string; to?: string; runId?: number; assumptionIds?: string[]; scenario?: boolean; tone?: Tone; icon?: IconName;
  source?: string }) {
  const body = (
    <>
      <div className="kpi-top">
        {props.icon && <span className="kpi-icon"><Icon name={props.icon} size={30} stroke={1.6} /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="label">
            <span title={props.tip}>{props.label}</span>
            {props.scenario && <ScenarioTag source={props.source} />}
          </div>
          <div className="value"><Assumed ids={props.assumptionIds}>{props.value}</Assumed></div>
        </div>
      </div>
      <div className="kpi-foot">
        <div className={`delta ${props.deltaDir ?? ''}`}>{props.delta ?? <span>&nbsp;</span>}</div>
        {props.runId && <div className="small muted">run #{props.runId}</div>}
      </div>
    </>
  )
  const cls = `card kpi ${props.tone ? `tone-${props.tone}` : ''}`
  return props.to ? <Link to={props.to} className={cls} title={props.tip}>{body}</Link>
    : <div className={cls} title={props.tip}>{body}</div>
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="skel" style={{ height: h }} />
}

export function PageState({ error, loading, empty, children, emptyText = 'Nothing to show for these filters.' }:
  { error?: unknown; loading?: boolean; empty?: boolean; children?: ReactNode; emptyText?: string }) {
  if (loading) return <div className="grid"><Skeleton h={90} /><Skeleton h={260} /></div>
  if (error) {
    const st = error instanceof ApiError ? error.status : 0
    if (st === 403) return <div className="card state"><h3>No permission</h3><p>Your role or plant access does not include this view.</p></div>
    if (st === 404) return <div className="card state"><h3>No data yet</h3><p>{(error as Error).message}</p><Link to="/uploads">Go to Data Uploads</Link></div>
    return <div className="card state"><h3>Something went wrong</h3><p>{(error as Error).message}</p></div>
  }
  if (empty) return <div className="card state"><h3>Nothing here</h3><p>{emptyText}</p></div>
  return <>{children}</>
}

// ---------------- Data grid standard ----------------
export type Col<T> = { key: string; label: string; render?: (r: T) => ReactNode; num?: boolean; sortable?: boolean;
  hidden?: boolean; title?: string }

type GridProps<T> = {
  id: string                         // saved views / column chooser key
  url: string                        // endpoint returning Envelope<Paged<T> & extra>
  params: Record<string, string | number | undefined>
  columns: Col<T>[]
  exportUrl?: string
  exportName?: string
  onRow?: (r: T) => void
  rowKey: (r: T) => string | number
  defaultSort?: string
  defaultDir?: 'asc' | 'desc'
  pageSize?: number
  onData?: (env: Envelope<Paged<T> & Record<string, unknown>>) => void
  toolbar?: ReactNode
}

function loadPref<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}
function savePref(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

export function DataGrid<T>(p: GridProps<T>) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<string | undefined>(p.defaultSort)
  const [dir, setDir] = useState<'asc' | 'desc'>(p.defaultDir ?? 'asc')
  const [dense, setDense] = useState(() => loadPref(`dg.${p.id}.dense`, false))
  const [hidden, setHidden] = useState<string[]>(() => loadPref(`dg.${p.id}.hidden`, p.columns.filter((c) => c.hidden).map((c) => c.key)))
  const [chooser, setChooser] = useState(false)
  const paramKey = JSON.stringify(p.params)
  useEffect(() => setPage(1), [paramKey])
  const url = p.url + qs({ ...p.params, page, page_size: p.pageSize ?? 50, sort, dir })
  const q = useQuery({ queryKey: [url], queryFn: () => api.get<Paged<T> & Record<string, unknown>>(url), placeholderData: keepPreviousData })
  useEffect(() => { if (q.data && p.onData) p.onData(q.data) }, [q.data]) // eslint-disable-line
  const cols = useMemo(() => p.columns.filter((c) => !hidden.includes(c.key)), [p.columns, hidden])
  const data = q.data?.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const views = loadPref<Record<string, unknown>>(`dg.${p.id}.views`, {})

  const toggleSort = (k: string) => {
    if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir('asc') }
  }
  return (
    <div>
      <div className="dg-tools">
        {p.toolbar}
        <span className="spacer" />
        {data && <span className="small muted">{data.total.toLocaleString('en-IN')} rows</span>}
        <button className="btn sm" onClick={() => setChooser(!chooser)}>Columns</button>
        <button className="btn sm" onClick={() => { const d = !dense; setDense(d); savePref(`dg.${p.id}.dense`, d) }}>{dense ? 'Comfortable' : 'Compact'}</button>
        <select className="sm" value="" onChange={(e) => {
          const v = e.target.value
          if (v === '__save') {
            const name = window.prompt('Name this view')
            if (name) savePref(`dg.${p.id}.views`, { ...views, [name]: { sort, dir, hidden, params: p.params } })
          } else if (views[v]) {
            const vw = views[v] as { sort?: string; dir: 'asc' | 'desc'; hidden: string[] }
            setSort(vw.sort); setDir(vw.dir); setHidden(vw.hidden)
          }
        }}>
          <option value="">Saved views</option>
          {Object.keys(views).map((k) => <option key={k} value={k}>{k}</option>)}
          <option value="__save">Save current view…</option>
        </select>
        {p.exportUrl && <button className="btn sm" onClick={() => download(p.exportUrl! + qs(p.params), p.exportName ?? 'export.xlsx')}>Export .xlsx</button>}
      </div>
      {chooser && (
        <div className="card row small" style={{ marginBottom: 10 }}>
          {p.columns.map((c) => (
            <label key={c.key} className="row" style={{ gap: 4 }}>
              <input type="checkbox" checked={!hidden.includes(c.key)} onChange={(e) => {
                const h = e.target.checked ? hidden.filter((x) => x !== c.key) : [...hidden, c.key]
                setHidden(h); savePref(`dg.${p.id}.hidden`, h)
              }} />{c.label}
            </label>
          ))}
        </div>
      )}
      <PageState loading={q.isLoading} error={q.error} empty={!!data && data.total === 0}>
        <div className="dg-wrap">
          <table className={`dg ${dense ? 'compact' : ''}`}>
            <thead>
              <tr>{cols.map((c) => (
                <th key={c.key} className={c.num ? 'num' : ''} title={c.title}
                  onClick={() => c.sortable !== false && toggleSort(c.key)}>
                  {c.label}{sort === c.key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>))}</tr>
            </thead>
            <tbody>
              {data?.rows.map((r) => (
                <tr key={p.rowKey(r)} className={p.onRow ? 'click' : ''} onClick={() => p.onRow?.(r)}>
                  {cols.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>
                    {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '—')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dg-foot">
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </PageState>
    </div>
  )
}

// ---------------- Demand source view (D31: view-only, proposals always use the default) ----------------
export type DemandView = { source: string; default: string; is_default: boolean; available: string[]
  other: { source: string; status_counts: Record<string, number> } | null
  note_multiple?: { min: number; median: number; max: number; pairs: number; zero_stock_pairs: number } | null }

export const SOURCE_TEXT: Record<string, string> = {
  scenario: 'Planning scenario', production_orders: 'Your production orders',
}
const VIEW_KEY = 'inv.demandView'

/** The demand source to show, remembered per browser; undefined = the run's default. */
export function useDemandSource(): [string | undefined, (s: string) => void] {
  const { meta } = useShell()
  const [v, setV] = useState<string | undefined>(() => { try { return localStorage.getItem(VIEW_KEY) ?? undefined } catch { return undefined } })
  const set = (s: string) => { setV(s); try { localStorage.setItem(VIEW_KEY, s) } catch { /* ignore */ } }
  return [v && v !== meta?.demand_source ? v : undefined, set]
}

export function DemandToggle({ view, onChange }: { view?: DemandView; onChange: (s: string) => void }) {
  if (!view || view.available.length < 2) return null
  const order = [view.default, ...view.available.filter((x) => x !== view.default)]
  return (
    <div className="seg" role="group" aria-label="Demand source" data-testid="demand-toggle">
      {order.map((src) => (
        <button key={src} className={src === view.source ? 'on' : ''} onClick={() => onChange(src)}
          title={src === view.default ? 'Used for proposals, the brief and the agent' : 'View only — proposals do not change'}>
          {SOURCE_TEXT[src] ?? src}{src === view.default ? ' (default)' : ''}
        </button>
      ))}
    </div>
  )
}

export function DemandBanner({ view }: { view?: DemandView }) {
  if (!view || view.is_default) return null
  const m = view.note_multiple
  const oc = view.other?.status_counts
  const po = view.source === 'production_orders'
  return (
    <div className="banner warn" style={{ borderRadius: 10, border: '1px solid var(--st-at_risk)', marginBottom: 16 }} data-testid="demand-banner">
      <div>
        <b>Viewing {po ? 'your production orders, incl. overdue backlog (A21)' : (SOURCE_TEXT[view.source] ?? view.source).toLowerCase()}.</b>{' '}
        Proposals use the {(SOURCE_TEXT[view.default] ?? view.default).toLowerCase()}
        {po && m ? <>: open production orders need a median <b>{m.median}×</b> current usable stock (range {m.min}–{m.max}× across {m.pairs} material × plant pairs{m.zero_stock_pairs ? `; ${m.zero_stock_pairs} more have no stock` : ''}).</> : '.'}
        {oc && <span className="muted"> {SOURCE_TEXT[view.other!.source]}: {oc.critical} critical, {oc.at_risk} at risk, {oc.healthy} healthy.</span>}
      </div>
    </div>
  )
}
