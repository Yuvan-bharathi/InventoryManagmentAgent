// Formats from the UI spec: ₹ with lakh / crore, quantities with UoM, dates as 11-Nov-2026.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function inr(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  const a = Math.abs(v), sign = v < 0 ? '-' : ''
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(digits)} Cr`
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(digits)} lakh`
  return `${sign}₹${Math.round(a).toLocaleString('en-IN')}`
}

export function qty(v: number | null | undefined, uom?: string | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return `${Math.round(v).toLocaleString('en-IN')}${uom ? ' ' + uom : ''}`
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function day(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, dd] = d.slice(0, 10).split('-')
  return `${dd}-${MONTHS[Number(m) - 1]}-${y}`
}

export function shortDay(d: string | null | undefined): string {
  if (!d) return '—'
  const [, m, dd] = d.slice(0, 10).split('-')
  return `${dd}-${MONTHS[Number(m) - 1]}`
}

export function pct(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined ? '—' : `${v.toFixed(digits)}%`
}

export const STATUS_TEXT: Record<string, string> = {
  critical: 'Critical', at_risk: 'At risk', excess: 'Excess', healthy: 'Healthy', stale: 'Stale',
}
export const STATE_TEXT: Record<string, string> = {
  all: 'All Proposals',
  draft: 'Draft',
  pending_buyer: 'Purchasing Review',
  pending_manager: 'Management Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  fulfilled: 'Fulfilled',
}

export const formatInr = inr
export const formatQty = qty

