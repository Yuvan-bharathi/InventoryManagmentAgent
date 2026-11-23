import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ControlPanel } from './ControlPanel'
import { HistoryPanel } from './HistoryPanel'
import { InboundPanel } from './InboundPanel'
import { LocatorPanel } from './LocatorPanel'
import { MaterialIssueModal } from './MaterialIssueModal'
import { MetricsPanel } from './MetricsPanel'
import { Minimap } from './Minimap'
import { OutboundPanel } from './OutboundPanel'
import { SceneView } from './SceneView'
import { SectionNav } from './SectionNav'
import { SimulationControls } from './SimulationControls'
import { Toasts } from './Toasts'
import { TopBar } from './TopBar'
import { ViewControls } from './ViewControls'
import { cx } from './components/primitives'
import { applyTheme } from './theme'

export function App({ embedded = false }: { embedded?: boolean } = {}) {
  const boot = useAppStore((s) => s.boot)
  const status = useAppStore((s) => s.status)
  const error = useAppStore((s) => s.error)
  const leftOpen = useAppStore((s) => s.leftOpen)
  const rightOpen = useAppStore((s) => s.rightOpen)
  const toggle = useAppStore((s) => s.toggle)
  const theme = useAppStore((s) => s.theme)
  const section = useAppStore((s) => s.section)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).__RETAIL_TWIN_STORE__ = useAppStore
    }
    void boot()
  }, [boot])

  // Keep the document in sync so the CSS token set matches the store on load.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Keyboard shortcuts a demo operator will reach for.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const state = useAppStore.getState()
      if (e.code === 'Space') {
        e.preventDefault()
        state.metrics?.running ? state.pause() : state.start()
      } else if (e.key === '[') toggle('leftOpen')
      else if (e.key === ']') toggle('rightOpen')
      else if (e.key === 'm') toggle('minimapOpen')
      else if (e.key === '1') state.setCameraPreset('overview')
      else if (e.key === '2') state.setCameraPreset('top')
      else if (e.key === '3') state.setCameraPreset('aisle')
      else if (e.key === '4') state.setCameraPreset('pack')
      else if (e.key === '5') state.setCameraPreset('dock')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  if (status === 'error') {
    return (
      <div className="grid h-full place-items-center bg-ink-950 p-8">
        <div className="panel max-w-md p-6 text-center">
          <div className="text-lg font-semibold text-[var(--viz-critical)]">Failed to initialise</div>
          <p className="mt-2 text-xs leading-relaxed text-ink-300">{error}</p>
          <button type="button" onClick={() => void boot()} className="btn btn-primary mt-4">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="retail-twin-scope flex h-full flex-col bg-ink-950"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {!embedded && <TopBar />}

      <div
        className="relative flex min-h-0 flex-1 overflow-hidden"
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          width: '100%',
          height: '100%',
        }}
      >
        {/* Left Drawer: WMS transport & simulation control panel */}
        <aside
          className={cx(
            'rail rail-left z-30 flex flex-col transition-transform duration-300 ease-out',
            leftOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full pointer-events-none',
          )}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: 340,
            maxWidth: '85vw',
            zIndex: 35,
            background: 'rgb(var(--ink-950))',
            borderRight: '1px solid rgb(var(--ink-700))',
            boxShadow: leftOpen ? '4px 0 28px rgba(0, 0, 0, 0.22)' : 'none',
            transform: leftOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden',
          }}
          inert={!leftOpen ? true : undefined}
        >
          {/* Drawer Header with Title & Explicit Close Button */}
          <div
            style={{
              height: 42,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgb(var(--ink-900))',
              borderBottom: '1px solid rgb(var(--ink-700))',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgb(var(--ink-100))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                WMS Controls &amp; Simulation
              </span>
            </div>
            <button
              type="button"
              onClick={() => toggle('leftOpen')}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgb(var(--ink-400))',
                fontSize: 14,
                padding: '4px 8px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontWeight: 600,
              }}
              title="Close Panel ([)"
            >
              ✕ Close
            </button>
          </div>

          <div className="flex h-full w-[340px] flex-col" style={{ width: 340, height: 'calc(100% - 42px)', overflowY: 'auto' }}>
            <div className="shrink-0 p-3 pb-1.5">
              <div className="panel overflow-hidden">
                <SimulationControls />
                <SectionNav />
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {section === 'inbound' ? (
                <InboundPanel />
              ) : section === 'outbound' ? (
                <OutboundPanel />
              ) : section === 'history' ? (
                <HistoryPanel />
              ) : section === 'locator' ? (
                <LocatorPanel />
              ) : (
                <ControlPanel />
              )}
            </div>
          </div>
        </aside>

        {/* Centre: 3D viewport with floating overlays */}
        <main
          className="relative min-w-0 flex-1"
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            width: leftOpen ? 'calc(100% - 340px)' : '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginLeft: leftOpen ? 340 : 0,
            transition: 'margin-left 0.28s cubic-bezier(0.16, 1, 0.3, 1), width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <SceneView />

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
          >
            <div
              className="pointer-events-auto absolute bottom-4 left-4"
              style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                pointerEvents: 'auto',
                zIndex: 20,
              }}
            >
              <ViewControls />
            </div>
            <div
              className="pointer-events-auto absolute bottom-4 right-4"
              style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                pointerEvents: 'auto',
                zIndex: 20,
              }}
            >
              <Minimap />
            </div>
          </div>

          <MaterialIssueModal />
          <Toasts />
        </main>

        {/* Right Drawer: Live Metrics & Comparison Rail */}
        <aside
          className={cx(
            'rail rail-right z-30 flex flex-col transition-transform duration-300 ease-out',
            rightOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full pointer-events-none',
          )}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 340,
            maxWidth: '85vw',
            zIndex: 35,
            background: 'rgb(var(--ink-950))',
            borderLeft: '1px solid rgb(var(--ink-700))',
            boxShadow: rightOpen ? '-4px 0 28px rgba(0, 0, 0, 0.22)' : 'none',
            transform: rightOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden',
          }}
          inert={!rightOpen ? true : undefined}
        >
          <div
            style={{
              height: 42,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgb(var(--ink-900))',
              borderBottom: '1px solid rgb(var(--ink-700))',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgb(var(--ink-100))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shift Metrics &amp; SLAs
              </span>
            </div>
            <button
              type="button"
              onClick={() => toggle('rightOpen')}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgb(var(--ink-400))',
                fontSize: 14,
                padding: '4px 8px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontWeight: 600,
              }}
              title="Close Metrics (])"
            >
              ✕ Close
            </button>
          </div>
          <div className="h-full w-[340px]" style={{ width: 340, height: 'calc(100% - 42px)', overflowY: 'auto' }}>
            <MetricsPanel />
          </div>
        </aside>
      </div>
    </div>
  )
}
