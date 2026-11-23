import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { WarehouseScene } from '../scene/WarehouseScene'
import { VELOCITY_LABEL, channelHex, dockFlowHex, velocityHex } from '../scene/theme'
import { DOCK_FLOW_LABEL } from '../simulation/dockActivity'
import { useAppStore } from '../store/useAppStore'
import { useDockState } from './useDockActivity'
import { Bar, cx } from './components/primitives'
import { AlertIcon, CloseIcon, LocationIcon, SnapBackIcon } from './components/icons'
import {
  PARCEL_STAGE_LABEL,
  PHASE_LABEL,
  PHASE_TONE,
  metres,
  mmss,
  pct,
  shortDuration,
} from './format'

/** Keeps a dragged card from being pushed off the edge of the viewport. */
const EDGE_MARGIN = 8

/**
 * Click-to-inspect popover.
 *
 * By default the card tracks the projected screen position of the selected
 * object by writing a CSS transform inside an animation frame — never through
 * React state — so following a moving picker costs nothing per frame.
 *
 * Drag it and it detaches: it stays where you put it, a dashed leader keeps
 * pointing at whatever it is describing, and the position survives clicking
 * from one object to the next. Handy when the card would otherwise sit on top
 * of the thing you are trying to look at.
 */
export function Inspector({ sceneRef }: { sceneRef: RefObject<WarehouseScene | null> }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const leaderRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<SVGLineElement>(null)
  const haloRef = useRef<SVGLineElement>(null)
  const dotRef = useRef<SVGCircleElement>(null)
  const pulseRef = useRef<SVGCircleElement>(null)
  /**
   * Detached position in container pixels. A ref, not state: the frame loop
   * reads it every frame and a drag must not re-render the card 60 times a second.
   */
  const posRef = useRef<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const [detached, setDetached] = useState(false)
  const selection = useAppStore((s) => s.selection)
  const model = useAppStore((s) => s.model)
  const metrics = useAppStore((s) => s.metrics)
  const setSelection = useAppStore((s) => s.setSelection)
  const theme = useAppStore((s) => s.theme)
  const openIssueModal = useAppStore((s) => s.openIssueModal)
  const customTourBinIds = useAppStore((s) => s.customTourBinIds)
  const toggleTourBin = useAppStore((s) => s.toggleTourBin)
  const VELOCITY_HEX = velocityHex(theme)
  const CHANNEL_HEX = channelHex(theme)
  const FLOW_HEX = dockFlowHex(theme)
  const dock = useDockState(selection?.kind === 'dock' ? selection.id : null)

  useEffect(() => {
    if (!selection) return
    let raf = 0
    const track = () => {
      raf = requestAnimationFrame(track)
      const scene = sceneRef.current
      const card = cardRef.current
      const inner = innerRef.current
      if (!scene || !card || !inner) return

      const world = scene.selectionWorldPosition()
      const anchor = world ? scene.project(world) : null
      const free = posRef.current

      if (leaderRef.current) leaderRef.current.style.display = 'none'

      if (free) {
        // Parked by the operator: stay put, and let the leader do the pointing.
        card.style.opacity = '1'
        card.style.transform = `translate3d(${Math.round(free.x)}px, ${Math.round(free.y)}px, 0)`
        inner.style.transform = 'none'
        const w = inner.offsetWidth || 256
        const h = inner.offsetHeight || 300
        drawLink(anchor, { left: free.x, top: free.y, right: free.x + w, bottom: free.y + h })
        return
      }

      if (!anchor || !anchor.visible) {
        card.style.opacity = '0'
        hideLink()
        return
      }
      card.style.opacity = '1'

      const container = card.parentElement
      const rect = container ? container.getBoundingClientRect() : null
      const width = inner.offsetWidth || 256
      const height = inner.offsetHeight || 300
      const sceneW = rect?.width || 1200
      const sceneH = rect?.height || 700

      // Offset the card horizontally away from the target so it doesn't cover the shelf/bin
      let cardX: number
      if (anchor.x < sceneW * 0.45) {
        // Shelf is on the left side: position card to the right of the shelf
        cardX = Math.min(sceneW - width - 20, anchor.x + 130)
      } else if (anchor.x > sceneW * 0.55) {
        // Shelf is on the right side: position card to the left of the shelf
        cardX = Math.max(20, anchor.x - width - 130)
      } else {
        // Center aisle: position card to the right side
        cardX = Math.min(sceneW - width - 20, anchor.x + 120)
      }

      // Vertical positioning: vertically aligned with anchor, clamped within view
      const bottomLimit = sceneH - 64 // leave room for bottom controls
      let cardY = Math.max(20, Math.min(bottomLimit - height, anchor.y - height / 2))

      card.style.transform = `translate3d(${Math.round(cardX)}px, ${Math.round(cardY)}px, 0)`
      inner.style.transform = 'none'

      drawLink(anchor, {
        left: cardX,
        top: cardY,
        right: cardX + width,
        bottom: cardY + height,
      })
    }

    /** Glowing tether line + beacon dot connecting target bin to inspection card */
    const drawLink = (
      anchor: { x: number; y: number; visible: boolean } | null,
      cardBounds: { left: number; top: number; right: number; bottom: number },
    ) => {
      const line = lineRef.current
      const halo = haloRef.current
      const dot = dotRef.current
      const pulse = pulseRef.current
      if (!line || !halo || !dot) return
      if (!anchor || !anchor.visible) {
        hideLink()
        return
      }

      // Find the closest point on the card border to the anchor
      const attachX = Math.max(cardBounds.left, Math.min(cardBounds.right, anchor.x))
      const attachY = Math.max(cardBounds.top, Math.min(cardBounds.bottom, anchor.y))

      for (const el of [halo, line]) {
        el.style.display = ''
        el.setAttribute('x1', String(attachX))
        el.setAttribute('y1', String(attachY))
        el.setAttribute('x2', String(anchor.x))
        el.setAttribute('y2', String(anchor.y))
      }
      dot.style.display = ''
      dot.setAttribute('cx', String(anchor.x))
      dot.setAttribute('cy', String(anchor.y))

      if (pulse) {
        pulse.style.display = ''
        pulse.setAttribute('cx', String(anchor.x))
        pulse.setAttribute('cy', String(anchor.y))
      }
    }

    const hideLink = () => {
      for (const el of [haloRef.current, lineRef.current, dotRef.current, pulseRef.current]) {
        if (el) el.style.display = 'none'
      }
    }

    raf = requestAnimationFrame(track)
    return () => cancelAnimationFrame(raf)
  }, [selection, sceneRef])

  // ── dragging ────────────────────────────────────────────────────────────────

  const onDragMove = useCallback((event: globalThis.PointerEvent) => {
    const grab = dragRef.current
    const card = cardRef.current
    const inner = innerRef.current
    const container = card?.parentElement
    if (!grab || !card || !inner || !container) return

    const rect = container.getBoundingClientRect()
    const maxX = rect.width - inner.offsetWidth - EDGE_MARGIN
    const maxY = rect.height - inner.offsetHeight - EDGE_MARGIN
    posRef.current = {
      x: Math.min(Math.max(EDGE_MARGIN, event.clientX - rect.left - grab.dx), Math.max(EDGE_MARGIN, maxX)),
      y: Math.min(Math.max(EDGE_MARGIN, event.clientY - rect.top - grab.dy), Math.max(EDGE_MARGIN, maxY)),
    }
  }, [])

  const onDragEnd = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
    window.removeEventListener('pointercancel', onDragEnd)
  }, [onDragMove])

  const onDragStart = (event: PointerEvent<HTMLDivElement>) => {
    // Buttons inside the card keep working; only the card body is a handle.
    if ((event.target as HTMLElement).closest('button')) return
    const inner = innerRef.current
    const container = cardRef.current?.parentElement
    if (!inner || !container) return
    event.preventDefault()

    const rect = container.getBoundingClientRect()
    const card = inner.getBoundingClientRect()
    // Grabbing an anchored card converts its current on-screen spot into a
    // free position, so it does not jump when the drag starts.
    posRef.current = { x: card.left - rect.left, y: card.top - rect.top }
    dragRef.current = { dx: event.clientX - card.left, dy: event.clientY - card.top }
    setDetached(true)
    // Capture so the release lands on the card, never on the canvas underneath —
    // otherwise finishing a drag over the scene can re-pick whatever is there.
    event.currentTarget.setPointerCapture?.(event.pointerId)

    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
    window.addEventListener('pointercancel', onDragEnd)
  }

  useEffect(() => onDragEnd, [onDragEnd])

  const reattach = () => {
    posRef.current = null
    setDetached(false)
  }

  // Escape clears the selection — expected behaviour for an overlay card.
  useEffect(() => {
    if (!selection) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, setSelection])

  if (!selection || !model) return null

  const bin = selection.kind === 'bin' ? model.binsById.get(selection.id) : null
  const agent = selection.kind === 'agent' ? metrics?.agents.find((a) => a.id === selection.id) : null
  const parcel =
    selection.kind === 'parcel' ? metrics?.parcels.find((p) => p.id === selection.id) : null
  if (!bin && !agent && !parcel && !dock) return null
  const currentTask = agent?.tasks?.find((t) => t.status === 'current')
  const needsReplen = bin ? bin.sku.stock <= bin.sku.replenPoint : false
  const transit = parcel
    ? (parcel.stage === 'staged' ? parcel.stagedAt : (metrics?.time ?? 0)) - parcel.packedAt
    : 0

  return (
    <>
      {/*
        Leader from a parked card back to whatever it is describing.

        Drawn twice: a wide stroke in the chrome colour, then the accent line on
        top. The halo is what makes it readable — a thin line on its own vanishes
        against a wall of multicoloured bins. Dashed on purpose, so it can never
        be mistaken for a pick path or a putaway route, which are solid ribbons
        on the floor.
      */}
      <svg
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        style={{ position: 'absolute', inset: 0, zIndex: 10, width: '100%', height: '100%', pointerEvents: 'none' }}
        aria-hidden
      >
        <line
          ref={haloRef}
          stroke="#FFFFFF"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.95"
          style={{ display: 'none' }}
        />
        <line
          ref={lineRef}
          stroke="#6F3DBA"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          strokeLinecap="round"
          style={{ display: 'none' }}
        />
        {/* Pulsing halo around target bin */}
        <circle
          ref={pulseRef}
          r="9"
          fill="rgba(111, 61, 186, 0.22)"
          stroke="#6F3DBA"
          strokeWidth="1.5"
          style={{ display: 'none' }}
        />
        {/* Solid pin dot on target bin */}
        <circle
          ref={dotRef}
          r="4.5"
          fill="#6F3DBA"
          stroke="#FFFFFF"
          strokeWidth="2"
          style={{ display: 'none' }}
        />
      </svg>

      <div
        ref={cardRef}
        className="pointer-events-none absolute left-0 top-0 z-20 transition-opacity duration-150"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 20,
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        <div
          ref={innerRef}
          className="pointer-events-auto flex flex-col"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            transform: 'translate(-50%, calc(-100% - 14px))',
          }}
        >
          <div
            onPointerDown={onDragStart}
            className="panel-float w-[256px] animate-fade-in cursor-grab select-none p-3 active:cursor-grabbing"
            style={{
              width: 256,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 180px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: 12,
              padding: 12,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
              color: '#1E293B',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="mini-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em' }}>
                  {bin ? 'Storage location' : parcel ? 'Package / Parcel' : dock ? 'Dock door' : 'Machine / AGV'}
                </div>
                <div className="truncate font-mono text-sm font-semibold text-ink-100" style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                  {bin ? bin.code : parcel ? parcel.ref : dock ? dock.label : (agent?.label ?? 'Machine AGV')}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {detached && (
                  <button
                    type="button"
                    onClick={reattach}
                    className="btn btn-icon text-ink-400"
                    title="Snap back to the object"
                    aria-label="Snap card back to the object"
                  >
                    <SnapBackIcon size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelection(null)}
                  className="btn btn-icon text-ink-400"
                  title="Close (Esc)"
                  aria-label="Close inspector"
                >
                  <CloseIcon size={11} />
                </button>
              </div>
            </div>

            <div className="divider" style={{ height: 1, background: '#E2E8F0', margin: '8px 0' }} />

            {bin ? (
              <div className="space-y-2.5">
                <div>
                  <div className="text-xs font-medium leading-snug text-ink-100">{bin.sku.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-400">
                    <span className="font-mono">{bin.sku.id}</span>
                    <span className="text-ink-600">·</span>
                    <span>{bin.sku.category}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: VELOCITY_HEX[bin.sku.velocity] }}
                  />
                  <span className="text-[10.5px] font-medium text-ink-200">
                    {VELOCITY_LABEL[bin.sku.velocity]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
                  <Row label="On hand" value={`${bin.sku.stock.toLocaleString()} ea`} />
                  <Row label="Replen point" value={`${bin.sku.replenPoint.toLocaleString()} ea`} />
                  <Row label="Aisle" value={`A${String(bin.aisle + 1).padStart(2, '0')} · ${bin.side === 'L' ? 'left' : 'right'}`} />
                  <Row label="Bay / level" value={`${bin.bay + 1} / L${bin.level + 1}`} />
                  <Row label="Typical qty" value={`${bin.sku.unitsPerLine} per line`} />
                  <Row label="Unit price" value={`₹${bin.sku.price.toFixed(2)}`} />
                </div>

                {/* Visual Shelf Location & Route Guide */}
                <div
                  style={{
                    background: 'rgba(111, 61, 186, 0.08)',
                    border: '1px solid rgba(111, 61, 186, 0.25)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: '#6F3DBA', letterSpacing: '0.04em' }}>
                      📍 Exact Shelf Location
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        background: '#6F3DBA',
                        color: '#FFFFFF',
                        padding: '1px 6px',
                        borderRadius: 4,
                      }}
                    >
                      Aisle {bin.aisle + 1} · Bay {bin.bay + 1}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>Shelf {bin.level >= 4 ? `Reserve Tier R${bin.level - 3} (Mezzanine)` : `Level L${bin.level + 1} (${bin.level === 0 ? 'Bottom Ground' : bin.level === 1 ? 'Knee Level' : bin.level === 2 ? 'Waist Level (Golden Zone)' : 'Top Eye Level'})`}</span>
                    <span style={{ fontSize: 10, color: '#64748B' }}>· Slot {String.fromCharCode(65 + bin.slot)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>➔</span>
                    <span>Follow floor ribbon: Enter Aisle {bin.aisle + 1} → Bay {bin.bay + 1} → Shelf L{bin.level + 1} on {bin.side === 'L' ? 'Left' : 'Right'}</span>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-ink-400">
                    <span>Stock vs opening</span>
                    <span className="font-mono tabular-nums text-ink-200">
                      {bin.sku.stock.toLocaleString()} / {bin.sku.stockInitial.toLocaleString()}
                    </span>
                  </div>
                  <Bar
                    value={bin.sku.stockInitial > 0 ? bin.sku.stock / bin.sku.stockInitial : 0}
                    color={needsReplen ? 'var(--viz-critical)' : VELOCITY_HEX[bin.sku.velocity]}
                  />
                  {needsReplen && (
                    <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-crit/45 bg-crit/10 px-1.5 py-1 text-[9.5px] font-medium text-crit">
                      <AlertIcon size={10} className="shrink-0" />
                      At or below replen point — flagged for top-up
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #E2E8F0', display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => toggleTourBin(bin.id)}
                    style={{
                      flex: 1.1,
                      background: customTourBinIds.includes(bin.id) ? '#6F3DBA' : '#EDE9FE',
                      border: customTourBinIds.includes(bin.id) ? '1px solid #5B21B6' : '1px solid #C4B5FD',
                      borderRadius: 6,
                      color: customTourBinIds.includes(bin.id) ? '#FFFFFF' : '#6F3DBA',
                      padding: '6px 8px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      boxShadow: customTourBinIds.includes(bin.id) ? '0 2px 6px rgba(111, 61, 186, 0.3)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{customTourBinIds.includes(bin.id) ? '✓ In Pick Queue' : '🛒 + Add to Queue'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openIssueModal(bin.id)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      color: '#FFFFFF',
                      padding: '6px 8px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <span>📦 Issue / Take</span>
                  </button>
                </div>
              </div>
            ) : dock ? (
              /*
                The door, both ways round.

                Outbound is always shown because a door always has a sorter lane
                assigned to it, whether or not anything is on the pad. Goods-in is
                only shown when there is a trailer against this door, since an
                empty inbound block on every door would read as a fault.
              */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: FLOW_HEX[dock.flow] }}
                  >
                    {DOCK_FLOW_LABEL[dock.flow]}
                  </span>
                  {dock.inboundQueue > 0 && (
                    <span className="chip !text-[9px]">
                      {dock.inboundQueue} booked in
                    </span>
                  )}
                </div>

                <p className="text-[10.5px] leading-snug text-ink-200">{dock.headline}</p>
                <Bar value={dock.progress} color={FLOW_HEX[dock.flow]} />

                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-ink-400">
                    <span>Trailer load</span>
                    <span className="font-mono tabular-nums text-ink-200">
                      {dock.outbound.staged}/{dock.outbound.capacity} parcels
                    </span>
                  </div>
                  <Bar
                    value={dock.outbound.load}
                    color={dock.outbound.full ? 'var(--viz-critical)' : FLOW_HEX.outbound}
                  />
                  <div className="mt-1 text-[9.5px] text-ink-400">
                    {dock.outbound.staged === 0
                      ? 'Pad clear — nothing waiting to load.'
                      : dock.outbound.full
                        ? 'Full load — the trailer seals on the next step.'
                        : `${dock.outbound.stagedCartons} cartons on the pad · seals in ${shortDuration(dock.outbound.sealIn ?? 0)}.`}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
                  <Row label="On the belt" value={`${dock.outbound.enRoute} parcels`} />
                  <Row label="Shipped" value={`${dock.outbound.dispatched} parcels`} />
                  <Row label="Trailers away" value={String(dock.outbound.trailers)} />
                  <Row label="Cartons away" value={String(dock.outbound.cartons)} />
                </div>

                {dock.outbound.channels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {dock.outbound.channels.map((channel) => (
                      <span
                        key={channel}
                        className="chip !normal-case !tracking-normal !text-[9px]"
                        style={{
                          color: CHANNEL_HEX[channel],
                          borderColor: `${CHANNEL_HEX[channel]}55`,
                        }}
                      >
                        {channel}
                      </span>
                    ))}
                  </div>
                )}

                {dock.inbound && (
                  <div className="rounded-md border border-ink-700 bg-ink-850/60 px-2 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                        Goods in
                      </span>
                      <span className="font-mono text-[9.5px] text-ink-300">
                        {dock.inbound.ref}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-ink-200">
                      {dock.inbound.supplier}
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                      <Row
                        label="Lines counted"
                        value={`${dock.inbound.linesCounted}/${dock.inbound.lines}`}
                      />
                      <Row
                        label="Units counted"
                        value={`${dock.inbound.unitsCounted}/${dock.inbound.unitsAdvised}`}
                      />
                      <Row label="Put away" value={`${dock.inbound.unitsStored} ea`} />
                      <Row label="On the pallet" value={`${dock.inbound.unitsToPutAway} ea`} />
                    </div>
                    <div className="mt-1.5">
                      <Bar value={dock.inbound.progress} color={FLOW_HEX.inbound} />
                    </div>
                    <div className="mt-1 text-[9.5px] text-ink-400">
                      {dock.inbound.atDoor
                        ? `Trailer on the door ${shortDuration(dock.inbound.dwell)} — counting in progress.`
                        : 'Counted in; the putaway is being walked on the floor.'}
                    </div>
                  </div>
                )}
              </div>
            ) : parcel ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cx(
                      'text-xs font-semibold',
                      parcel.blocked
                        ? 'text-[var(--viz-critical)]'
                        : parcel.stage === 'staged'
                          ? 'text-[var(--viz-good)]'
                          : 'text-[var(--viz-series-1)]',
                    )}
                  >
                    {parcel.blocked ? 'Held at merge' : PARCEL_STAGE_LABEL[parcel.stage]}
                  </span>
                  <span className="chip !text-[9px]">
                    {parcel.manual ? 'Hand-trucked' : 'Conveyed'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: CHANNEL_HEX[parcel.channel] }}
                  />
                  <span className="text-[10.5px] font-medium text-ink-200">{parcel.channel}</span>
                  {parcel.priority === 'express' && (
                    <span className="chip !px-1 !py-0 !text-[8px] !text-[var(--viz-warning)]">
                      express
                    </span>
                  )}
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-ink-400">
                    <span>
                      {parcel.stationLabel} → {parcel.dockLabel}
                    </span>
                    <span className="font-mono tabular-nums text-ink-200">
                      {Math.round(parcel.arc)} / {Math.round(parcel.pathLength)} m
                    </span>
                  </div>
                  <Bar
                    value={parcel.pathLength > 0 ? parcel.arc / parcel.pathLength : 1}
                    color={parcel.blocked ? 'var(--viz-critical)' : CHANNEL_HEX[parcel.channel]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
                  <Row label="Cartons" value={`${parcel.cartons}`} />
                  <Row label="Weight" value={`${parcel.weightKg} kg`} />
                  <Row label="Packed at" value={mmss(parcel.packedAt)} />
                  <Row
                    label={parcel.stage === 'staged' ? 'Transit took' : 'In transit'}
                    value={shortDuration(transit)}
                  />
                </div>

                {parcel.stage === 'staged' && (
                  <div className="rounded-md border border-ink-700 bg-ink-850/60 px-2 py-1.5 text-[10px] leading-snug text-ink-200">
                    Stacked in slot {parcel.stackIndex + 1} at {parcel.dockLabel}, waiting for the
                    trailer to seal.
                  </div>
                )}
              </div>
            ) : agent ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={cx('text-xs font-semibold', PHASE_TONE[agent.phase] ?? 'text-ink-400')}>
                    {PHASE_LABEL[agent.phase] ?? agent.phase}
                  </span>
                  <span className="chip !text-[9px]">{KIND_LABEL[agent.kind] ?? agent.kind}</span>
                </div>

                {/* What this picker has been sent to do, right now. The full
                    tour lives in the pick-task panel on the right rail; the card
                    only ever carries the instruction in hand. */}
                {currentTask && (
                  <button
                    type="button"
                    onClick={() => setSelection({ kind: 'bin', id: currentTask.binId })}
                    className="w-full rounded-md border border-ink-700 bg-ink-850/60 px-2 py-1.5 text-left transition-colors hover:border-ink-600 hover:bg-ink-750/60"
                    title="Show this location"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-[9px] uppercase tracking-wider text-ink-400">
                      <span>Now picking</span>
                      <span>
                        stop {currentTask.sequence}/{agent.tasks?.length ?? 1}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <LocationIcon size={11} className="shrink-0 text-ink-400" />
                      <span className="truncate font-mono text-[11.5px] font-semibold text-ink-100">
                        {currentTask.code}
                      </span>
                      <span className="flex-1" />
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-200">
                        {currentTask.qty} ea
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[9.5px] text-ink-400">
                      {currentTask.skuName}
                    </div>
                  </button>
                )}

                <div className="flex flex-wrap gap-1">
                  {(agent.orderRefs?.length ?? 0) > 0 ? (
                    agent.orderRefs.map((ref) => (
                      <span
                        key={ref}
                        className="chip font-mono"
                        style={{ color: agent.color, borderColor: `${agent.color}55` }}
                      >
                        {ref}
                      </span>
                    ))
                  ) : (
                    <span className="chip">unassigned</span>
                  )}
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-ink-400">
                    <span>Load</span>
                    <span className="font-mono tabular-nums text-ink-200">
                      {agent.linesLoaded ?? 0}/{agent.capacityLines ?? 0} lines
                    </span>
                  </div>
                  <Bar
                    value={agent.capacityLines > 0 ? (agent.linesLoaded ?? 0) / agent.capacityLines : 0}
                    color={agent.color}
                  />
                </div>

                {(agent.routeStops ?? 0) > 0 && (
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] text-ink-400">
                      <span>
                        Pick {agent.stopsDone ?? 0} of {agent.routeStops}
                      </span>
                      <span className="font-mono tabular-nums">{pct(agent.progress ?? 0)} of route</span>
                    </div>
                    <Bar value={agent.progress ?? 0} color={agent.color} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
                  <Row label="Distance" value={metres(agent.distance ?? 0)} />
                  <Row label="Lines picked" value={String(agent.picks ?? 0)} />
                  <Row label="Orders done" value={String(agent.orders ?? 0)} />
                  <Row label="Avg / order" value={(agent.orders ?? 0) > 0 ? mmss(agent.avgOrderTime) : '—'} />
                  <Row label="Utilisation" value={pct(agent.utilisation ?? 0)} />
                  <Row label="Congestion" value={String(agent.congestionEvents ?? 0)} />
                  <Row label="Re-routes" value={String(agent.reroutes ?? 0)} />
                  <Row label="Short picks" value={String(agent.shortPicks ?? 0)} />
                </div>

                {agent.thoughts?.[0] && (
                  <div className="rounded-md border border-ink-700 bg-ink-850/60 px-2 py-1.5">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                      Last decision
                    </div>
                    <p className="mt-0.5 text-[10px] leading-snug text-ink-200">
                      {agent.thoughts[0].text}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          {/* Short stub leader, used only while the card is anchored. */}
          <div
            ref={leaderRef}
            className="mx-auto h-4 w-px shrink-0 bg-gradient-to-b from-ink-500 to-transparent"
          />
        </div>
      </div>
    </>
  )
}

const KIND_LABEL: Record<string, string> = {
  person: 'Hand tote',
  cart: 'Pick cart',
  palletJack: 'Pallet truck',
  amr: 'AMR robot',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-ink-400">{label}</div>
      <div className="truncate font-mono tabular-nums text-ink-100">{value}</div>
    </div>
  )
}
