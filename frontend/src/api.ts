// API client: bearer token, JSON envelope { data, meta }, errors with status.
export type Meta = {
  as_of: string
  data_age_days: number
  run_id: number
  assumption_ids: string[]
  demand_source: string
  stale: boolean
}
export type Envelope<T> = { data: T; meta: Meta }
export type Paged<T> = { rows: T[]; total: number; page: number; page_size: number }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const TOKEN_KEY = 'inv.token'
export const token = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t: string | null) => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } },
}

async function request<T>(method: string, url: string, body?: unknown, isForm = false): Promise<T> {
  const headers: Record<string, string> = {}
  const t = token.get()
  if (t) headers.Authorization = `Bearer ${t}`
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  const r = await fetch(url, { method, headers, body: isForm ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body) })
  if (r.status === 401 && t) { token.set(null); window.location.assign('/login') }
  if (!r.ok) {
    let msg = r.statusText
    try { const j = await r.json(); msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail) } catch { /* ignore */ }
    throw new ApiError(r.status, msg)
  }
  return r.json() as Promise<T>
}

export const api = {
  get: <T>(url: string) => request<Envelope<T>>('GET', url),
  post: <T>(url: string, body?: unknown) => request<Envelope<T>>('POST', url, body),
  raw: <T>(method: string, url: string, body?: unknown) => request<T>(method, url, body),
  upload: <T>(url: string, form: FormData) => request<Envelope<T>>('POST', url, form, true),
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)) })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export async function download(url: string, filename: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token.get() ?? ''}` } })
  if (!r.ok) throw new ApiError(r.status, r.statusText)
  const blob = await r.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
