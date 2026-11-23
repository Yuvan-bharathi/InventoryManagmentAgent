import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api'
import { day } from '../format'
import { PageState } from '../kit'
import { useShell, type Assumption } from '../shell-context'
import { PageIcon } from '../icons'

type F = { file: string; required: boolean; rows: number | null; accepted: number | null; rejected: number | null; status: string }
type DQ = { check_id: string; name: string; severity: string; fired: boolean; affected_count: number; message: string;
  assumption_id: string | null; sample: Record<string, unknown>[] }
type Report = { upload: { id: number; file_name: string; uploaded_by: string; uploaded_at: string; run_id: number | null };
  files: F[]; dq: DQ[]; issues_found: number; steps?: { step: string; ms: number }[]; run_id?: number }
type Hist = { id: number; file_name: string; uploaded_by: string; uploaded_at: string; status: string; run_id: number | null; issues_found: number | null }

const SEV: Record<string, string> = { error: 'critical', blocked: 'critical', warning: 'at_risk', info: 'stale' }

export function DataUploads() {
  const { setAgentCtx, can, meta } = useShell()
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Report | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => setAgentCtx({ page: 'Data Uploads' }), []) // eslint-disable-line
  const latest = useQuery({ queryKey: ['dq'], queryFn: () => api.get<Report>('/api/dq'), enabled: !!meta })
  const hist = useQuery({ queryKey: ['uploads'], queryFn: () => api.get<Hist[]>('/api/uploads') })
  const asm = useQuery({ queryKey: ['assumptions'], queryFn: () => api.get<Assumption[]>('/api/assumptions'), enabled: !!meta })
  useEffect(() => { if (!busy) return; const t0 = Date.now(); const h = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500); return () => clearInterval(h) }, [busy])

  async function upload(files: FileList | null) {
    if (!files?.length) return
    const fd = new FormData(); Array.from(files).forEach((f) => fd.append('files', f))
    setBusy(true); setErr(null)
    try { const r = await api.upload<Report>('/api/uploads', fd); setFresh(r.data); await qc.invalidateQueries() }
    catch (e) { setErr(e instanceof ApiError ? e.message : String(e)) }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  const rep = fresh ?? latest.data?.data
  return (
    <div>
      <div className="page-head"><PageIcon name="upload" />
        <div><div className="crumb">Data › Data Uploads</div><h1>Data Uploads</h1>
          <div className="muted">The front door: files in, checked, calculated. Upload the dataset as a ZIP (or the CSVs).</div></div>
        <span className="spacer" />
        {can('data', 'A') ? <>
          <input ref={input} type="file" accept=".zip,.csv" multiple hidden onChange={(e) => upload(e.target.files)} data-testid="upload-input" />
          <button className="btn primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Working…' : 'Upload dataset'}</button>
        </> : <span className="small muted">Your role can view uploads; stores and data admins upload.</span>}
      </div>
      {busy && <div className="card" style={{ marginBottom: 14 }}>
        <div className="stepper">{['Validating', 'Loading', 'Calculating', 'Brief ready'].map((s, k) => <span key={s} className="row" style={{ gap: 0 }}>{k > 0 && <span className="step-sep" />}
          <span className={`step ${k <= Math.min(3, Math.floor(elapsed / 4)) ? 'now' : ''}`}>{s}</span></span>)}</div>
        <div className="small muted" style={{ marginTop: 8 }}>{elapsed}s — the whole run usually takes 10–20 s.</div></div>}
      {err && <div className="banner err" style={{ borderRadius: 8, marginBottom: 14 }}>{err}</div>}
      <PageState loading={latest.isLoading && !!meta} error={meta ? latest.error : null}>
        {rep && <div className="grid">
          <div className="card" data-testid="dq-summary">
            <div className="row"><h2>{rep.issues_found} issues found in the dataset before any calculation</h2><span className="spacer" />
              <span className="small muted">Upload #{rep.upload.id} · {rep.upload.uploaded_by} · run #{rep.upload.run_id}</span>
              {fresh?.steps && <span className="small muted">· {fresh.steps.map((s) => `${s.step} ${(s.ms / 1000).toFixed(1)} s`).join(' · ')}</span>}</div>
            <table className="dg">
              <thead><tr><th>Severity</th><th>Check</th><th className="num">Affected</th><th>Finding</th><th>Assumption</th></tr></thead>
              <tbody>{rep.dq.map((d) => <Fragment key={d.check_id}>
                <tr key={d.check_id} className="click" onClick={() => setOpen(open === d.check_id ? null : d.check_id)} style={{ opacity: d.fired ? 1 : 0.55 }}>
                  <td><span className={`status ${SEV[d.severity]}`}>{d.fired ? d.severity : 'pass'}</span></td><td><b>{d.name}</b></td>
                  <td className="num">{d.affected_count.toLocaleString('en-IN')}</td><td>{d.message}</td>
                  <td>{d.assumption_id && <span className="aid" title={asm.data?.data.find((a) => a.id === d.assumption_id)?.description}>{d.assumption_id}</span>}</td></tr>
                {open === d.check_id && d.sample.length > 0 && <tr key={d.check_id + 's'}><td colSpan={5}>
                  <table className="dg compact"><thead><tr>{Object.keys(d.sample[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                    <tbody>{d.sample.map((s, i) => <tr key={i}>{Object.values(s).map((v, j) => <td key={j}>{String(v ?? '')}</td>)}</tr>)}</tbody></table></td></tr>}
              </Fragment>)}</tbody></table>
          </div>
          <div className="grid g2">
            <div className="card"><h2>File slots</h2>
              <table className="dg compact"><thead><tr><th>File</th><th></th><th className="num">Rows</th><th className="num">Accepted</th><th className="num">Rejected</th><th>Status</th></tr></thead>
                <tbody>{rep.files.map((f) => <tr key={f.file}><td>{f.file}</td><td className="small muted">{f.required ? 'required' : 'optional'}</td>
                  <td className="num">{f.rows?.toLocaleString('en-IN') ?? '—'}</td><td className="num">{f.accepted?.toLocaleString('en-IN') ?? '—'}</td>
                  <td className="num">{f.rejected ?? '—'}</td><td><span className={`status ${f.status === 'loaded' ? 'healthy' : f.status === 'missing' ? 'stale' : 'at_risk'}`}>{f.status}</span></td></tr>)}</tbody></table>
              <div className="small muted" style={{ marginTop: 6 }}>Only the latest snapshot date is loaded as current stock (A1); history is used by the continuity check only.</div></div>
            <div className="card"><h2>Upload history</h2>
              <table className="dg compact"><thead><tr><th>#</th><th>When</th><th>User</th><th>Run</th><th className="num">Issues</th></tr></thead>
                <tbody>{hist.data?.data.map((h) => <tr key={h.id}><td>{h.id}</td><td>{new Date(h.uploaded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                  <td>{h.uploaded_by}</td><td>{h.run_id ? `#${h.run_id}` : '—'}</td><td className="num">{h.issues_found ?? '—'}</td></tr>)}</tbody></table></div>
          </div>
          <div className="card" data-testid="assumptions">
            <div className="row"><h2>Assumptions · awaiting confirmation from the organization</h2><span className="spacer" /><Link to="/overview">Go to the brief and overview</Link></div>
            <table className="dg compact"><thead><tr><th>ID</th><th>Assumption</th><th>Current value</th><th>Question for the organization</th><th>Status</th></tr></thead>
              <tbody>{asm.data?.data.map((a) => <tr key={a.id}><td><b>{a.id}</b></td><td>{a.description}</td>
                <td className="small">{Object.entries(a.current).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(', ') || '—'}</td>
                <td className="small muted">{a.owner_question}</td><td><span className="pill">{a.status}</span></td></tr>)}</tbody></table>
          </div>
          <div className="small muted">Data as of {day(meta?.as_of)}.</div>
        </div>}
      </PageState>
    </div>
  )
}
