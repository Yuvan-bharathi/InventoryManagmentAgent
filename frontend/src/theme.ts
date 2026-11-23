// Light theme (setup-guide §9): enforce light theme across the application.
import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'inv.theme'

/** Apply before first paint so the page never flashes the wrong theme. */
export function applyStoredTheme() {
  document.documentElement.dataset.theme = 'light'
  document.documentElement.style.colorScheme = 'light'
  try {
    localStorage.setItem(KEY, 'light')
    localStorage.setItem('picktwin.theme', 'light')
  } catch {}
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>('light')
  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
    document.documentElement.style.colorScheme = 'light'
    try {
      localStorage.setItem(KEY, 'light')
      localStorage.setItem('picktwin.theme', 'light')
    } catch { /* ignore */ }
  }, [theme])
  return [theme, () => setTheme('light')]
}

/** Chart colours as CSS variables, so charts switch with the theme. */
export const CHART = ['var(--chart-c3)', 'var(--chart-c1)', 'var(--chart-c2)', 'var(--chart-c4)', 'var(--chart-c5)',
  'var(--chart-c6)', 'var(--chart-c7)', 'var(--chart-c8)']
export const AXIS = { fontSize: 11, fill: 'var(--chart-axis)' }
export const TIP = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }
