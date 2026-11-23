// App-wide state: signed-in user, plant filter, run meta, assumptions, agent context.
import { createContext, useContext } from 'react'
import type { Meta } from './api'

export type User = { username: string; display_name: string; tenant_id: string; role: string; role_name: string;
  lands_on: string; plants: string[] }
export type Assumption = { id: string; description: string; default: Record<string, unknown>;
  current: Record<string, unknown>; owner_question: string; status: string }
export type ShellMeta = {
  user: User; tenant_name: string; plants: { plant_id: string; plant_name: string }[]; categories: string[]
  banners: { stale: boolean; dq_failed: boolean; ai_unavailable: boolean; ai_reason?: string | null; no_data: boolean }
  badges: { proposals: number | null }; permissions: Record<string, string[]>
}
export type AgentCtx = { page: string; item?: { type: string; id: string; label?: string; plant?: string } | null }

export type ShellState = {
  user: User | null
  shell: ShellMeta | null
  meta: Meta | null
  plant: string
  setPlant: (p: string) => void
  assumptions: Record<string, Assumption>
  agentCtx: AgentCtx
  setAgentCtx: (c: AgentCtx) => void
  openAgent: (question?: string) => void
  can: (module: string, perm: string) => boolean
  logout: () => void
}

export const ShellContext = createContext<ShellState | null>(null)

export function useShell(): ShellState {
  const s = useContext(ShellContext)
  if (!s) throw new Error('ShellContext missing')
  return s
}
