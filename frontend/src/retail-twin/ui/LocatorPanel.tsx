import { useMemo, useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { cx } from './components/primitives'
import { LocationIcon } from './components/icons'
import { velocityHex } from '../scene/theme'
import type { VelocityTier } from '../warehouse/types'

export function LocatorPanel() {
  const model = useAppStore((s) => s.model)
  const deadStockHighlight = useAppStore((s) => s.deadStockHighlight)
  const toggleDeadStockHighlight = useAppStore((s) => s.toggleDeadStockHighlight)
  const locateBin = useAppStore((s) => s.locateBin)
  const openIssueModal = useAppStore((s) => s.openIssueModal)
  const theme = useAppStore((s) => s.theme)
  const selection = useAppStore((s) => s.selection)
  const customTourBinIds = useAppStore((s) => s.customTourBinIds)
  const toggleTourBin = useAppStore((s) => s.toggleTourBin)
  const clearTourBins = useAppStore((s) => s.clearTourBins)
  const dispatchCustomPickTour = useAppStore((s) => s.dispatchCustomPickTour)

  const [query, setQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'dead'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [visibleCount, setVisibleCount] = useState<number>(35)

  useEffect(() => {
    setVisibleCount(35)
  }, [query, filterMode, selectedCategory])

  const VELOCITY_HEX = velocityHex(theme)

  // Aggregate materials and their bin placements across the warehouse
  const materials = useMemo(() => {
    if (!model) return []
    const map = new Map<
      string,
      {
        skuId: string
        name: string
        category: string
        price: number
        velocity: VelocityTier
        totalStock: number
        bins: {
          id: string
          code: string
          stock: number
          replenPoint: number
          aisle: number
          bay: number
          level: number
        }[]
        isDeadStock: boolean
        idleDays: number
        recommendation: string
      }
    >()

    // Deterministic recommendation generator based on SKU category / id
    const getDeadStockRecommendation = (id: string, cat: string) => {
      if (cat.includes('SMT Consumable')) return 'Priority consumption on SMT Line 2 before shelf-life expires'
      if (cat.includes('Mechanical') || id.includes('GLS') || id.includes('SCR')) return 'Alternate BOM reallocation or scrap write-off (ECO-402)'
      if (cat.includes('Passive') || id.includes('REEL') || id.includes('CAP')) return 'Inter-plant transfer to Chennai EMS plant (shortage offset)'
      return 'Initiate supplier return to vendor (RTV) or liquidation'
    }

    for (const [binId, bin] of model.binsById) {
      const sku = bin.sku
      const existing = map.get(sku.id)
      const binItem = {
        id: binId,
        code: bin.code,
        stock: sku.stock,
        replenPoint: sku.replenPoint,
        aisle: bin.aisle + 1,
        bay: bin.bay + 1,
        level: bin.level + 1,
      }

      if (existing) {
        existing.totalStock += sku.stock
        existing.bins.push(binItem)
      } else {
        const isDead = sku.velocity === 'slow'
        // Deterministic idle days based on SKU hash
        const charCodeSum = sku.id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0)
        const idleDays = isDead ? 90 + (charCodeSum % 120) : 12 + (charCodeSum % 25)

        map.set(sku.id, {
          skuId: sku.id,
          name: sku.name,
          category: sku.category,
          price: sku.price,
          velocity: sku.velocity,
          totalStock: sku.stock,
          bins: [binItem],
          isDeadStock: isDead,
          idleDays,
          recommendation: getDeadStockRecommendation(sku.id, sku.category),
        })
      }
    }

    return Array.from(map.values())
  }, [model])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const m of materials) set.add(m.category)
    return ['All', ...Array.from(set).sort()]
  }, [materials])

  // Filtered list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return materials.filter((m) => {
      if (filterMode === 'dead' && !m.isDeadStock) return false
      if (selectedCategory !== 'All' && m.category !== selectedCategory) return false
      if (!q) return true
      return (
        m.skuId.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.bins.some((b) => b.code.toLowerCase().includes(q))
      )
    })
  }, [materials, query, filterMode, selectedCategory])

  const deadStockCount = useMemo(() => {
    return materials.filter((m) => m.isDeadStock).length
  }, [materials])

  const deadStockCapital = useMemo(() => {
    return materials
      .filter((m) => m.isDeadStock)
      .reduce((sum, m) => sum + m.totalStock * m.price, 0)
  }, [materials])

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto p-2.5">
      {/* AGT-09 Excess & Obsolete / Dead Stock Hero Spotlight */}
      <div
        style={{
          background: deadStockHighlight
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(245, 158, 11, 0.12) 100%)'
            : '#0F172A',
          border: deadStockHighlight ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid #334155',
          borderRadius: 10,
          padding: 10,
          color: '#F8FAFC',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: deadStockHighlight ? '#EF4444' : '#F59E0B',
                boxShadow: deadStockHighlight ? '0 0 8px #EF4444' : 'none',
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F8FAFC', letterSpacing: '0.04em' }}>
              AGT-09 · DEAD STOCK AGENT
            </span>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              background: deadStockHighlight ? 'rgba(239, 68, 68, 0.25)' : '#1E293B',
              color: deadStockHighlight ? '#F87171' : '#94A3B8',
              border: '1px solid #334155',
            }}
          >
            {deadStockHighlight ? '3D BEAM ACTIVE' : 'STANDBY'}
          </span>
        </div>

        <div className="mt-2 text-[11px] leading-relaxed" style={{ color: '#94A3B8' }}>
          Identifies stagnant stock (&gt;90d idle), obsolete BOM revisions, and locked working capital in high-bay racks.
        </div>

        {/* Telemetry metrics */}
        <div className="mt-2.5 grid grid-cols-2 gap-2 text-center">
          <div style={{ background: '#090D16', padding: '6px 4px', borderRadius: 6, border: '1px solid #1E293B' }}>
            <div style={{ fontSize: 9.5, color: '#94A3B8', textTransform: 'uppercase' }}>Dead / Slow SKUs</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', marginTop: 1 }}>{deadStockCount} Materials</div>
          </div>
          <div style={{ background: '#090D16', padding: '6px 4px', borderRadius: 6, border: '1px solid #1E293B' }}>
            <div style={{ fontSize: 9.5, color: '#94A3B8', textTransform: 'uppercase' }}>Locked Capital</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', marginTop: 1 }}>
              ₹{(deadStockCapital / 100000).toFixed(2)} Lakhs
            </div>
          </div>
        </div>

        {/* 3D Heatmap Toggle Button */}
        <button
          type="button"
          onClick={toggleDeadStockHighlight}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer"
          style={{
            background: deadStockHighlight
              ? 'linear-gradient(135deg, #DC2626 0%, #B45309 100%)'
              : 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
            color: '#FFFFFF',
            border: deadStockHighlight ? '1px solid #EF4444' : '1px solid #475569',
            boxShadow: deadStockHighlight ? '0 0 14px rgba(239, 68, 68, 0.4)' : 'none',
          }}
        >
          <span>{deadStockHighlight ? '★ Clear Dead Stock Spotlight' : '⚡ Spotlight Dead Stock in 3D'}</span>
        </button>
      </div>

      {/* Filter Tabs: All Materials vs Dead Stock Only */}
      <div className="flex gap-1 rounded-lg bg-ink-900 p-1 border border-ink-800">
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={cx(
            'flex-1 rounded-md py-1 text-center text-[11px] font-semibold transition-colors',
            filterMode === 'all'
              ? 'bg-ink-750 text-ink-100 shadow-sm'
              : 'text-ink-400 hover:text-ink-200',
          )}
        >
          All Components ({materials.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('dead')}
          className={cx(
            'flex-1 rounded-md py-1 text-center text-[11px] font-semibold transition-colors flex items-center justify-center gap-1',
            filterMode === 'dead'
              ? 'bg-crit/25 text-crit border border-crit/40 shadow-sm'
              : 'text-ink-400 hover:text-crit',
          )}
        >
          <span>Dead Stock Only ({deadStockCount})</span>
        </button>
      </div>

      {/* Search Input */}
      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by part ID, name, or bin..."
          className="w-full rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-xs text-ink-100 placeholder-ink-400 focus:border-accent focus:outline-none"
        />
      </div>

      {/* Category Filter Horizontal Scroll */}
      <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] no-scrollbar">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setSelectedCategory(c)}
            className={cx(
              'shrink-0 rounded-full px-2 py-0.5 font-medium transition-colors border',
              selectedCategory === c
                ? 'bg-accent/20 text-accent-soft border-accent/40'
                : 'bg-ink-900 text-ink-400 border-ink-800 hover:bg-ink-850 hover:text-ink-200',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Custom Multi-Component Pick Queue Card */}
      <div
        style={{
          background: customTourBinIds.length > 0
            ? 'linear-gradient(135deg, rgba(111, 61, 186, 0.25) 0%, rgba(30, 27, 75, 0.95) 100%)'
            : 'rgba(111, 61, 186, 0.08)',
          border: customTourBinIds.length > 0 ? '2px solid #8B5CF6' : '1px dashed rgba(111, 61, 186, 0.45)',
          borderRadius: 10,
          padding: 10,
          boxShadow: customTourBinIds.length > 0 ? '0 4px 16px rgba(111, 61, 186, 0.35)' : 'none',
          marginBottom: 8,
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 13 }}>🛒</span>
            <span className="text-xs font-bold text-ink-100">
              Custom Multi-Item Pick Queue {customTourBinIds.length > 0 ? `(${customTourBinIds.length})` : '(0 selected)'}
            </span>
          </div>
          {customTourBinIds.length > 0 && (
            <button
              type="button"
              onClick={clearTourBins}
              className="text-[10px] text-ink-400 hover:text-ink-200 underline cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>

        {customTourBinIds.length === 0 ? (
          <div className="text-[10px] text-ink-300 leading-normal">
            Click the purple <span className="font-bold text-accent-soft">+ Queue</span> button on any component below (or click any shelf in 3D) to build a custom pick list and dispatch an operator in 3D.
          </div>
        ) : (
          <>
            <div className="text-[10.5px] text-ink-300 mb-2">
              Selected components queued for warehouse operator collection:
            </div>

            {/* Selected Chips */}
            <div className="flex flex-wrap gap-1 mb-2.5 max-h-24 overflow-y-auto no-scrollbar">
              {customTourBinIds.map((binId) => {
                const bin = model?.binsById.get(binId)
                const skuId = bin?.sku.id ?? binId
                return (
                  <div
                    key={binId}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-ink-850 text-ink-200 border border-ink-700"
                  >
                    <span className="font-mono font-bold text-accent-soft">{skuId}</span>
                    <span className="text-ink-400">({bin?.code ?? 'Bin'})</span>
                    <button
                      type="button"
                      onClick={() => toggleTourBin(binId)}
                      className="hover:text-red-400 ml-0.5 text-[9px] font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Action Button: Dispatch Picker */}
            <button
              type="button"
              onClick={dispatchCustomPickTour}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer shadow-md"
              style={{
                background: 'linear-gradient(135deg, #6F3DBA 0%, #4F46E5 100%)',
                color: '#FFFFFF',
                border: 'none',
              }}
            >
              <span>▶ Dispatch Operator to Pick {customTourBinIds.length} Items</span>
            </button>
          </>
        )}
      </div>

      {/* Component List */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between text-[10px] text-ink-400 px-1">
          <span>{filtered.length} matching items</span>
          <span>Click to fly &amp; inspect</span>
        </div>

        {filtered.length === 0 ? (
          <div className="panel p-4 text-center text-xs text-ink-400">
            No components match the criteria.
          </div>
        ) : (
          <>
            {filtered.slice(0, visibleCount).map((mat) => {
              const primaryBin = mat.bins[0]
              const isSelected = selection?.kind === 'bin' && mat.bins.some((b) => b.id === selection.id)

              return (
                <div
                  key={mat.skuId}
                  onClick={() => primaryBin && locateBin(primaryBin.id)}
                  className="cursor-pointer hover:shadow-md"
                  style={{
                    background: isSelected ? 'rgba(111, 61, 186, 0.12)' : 'rgb(var(--ink-900))',
                    border: isSelected
                      ? '1.5px solid #6f3dba'
                      : mat.isDeadStock
                      ? '1px solid rgba(245, 158, 11, 0.35)'
                      : '1px solid rgb(var(--ink-750))',
                    borderRadius: 8,
                    padding: 9,
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 10px rgba(111, 61, 186, 0.2)' : 'none',
                  }}
                >
                  {/* Header row: ID, Category & Velocity Badge */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-ink-100">{mat.skuId}</span>
                        <span
                          className="rounded px-1.5 py-0.2 text-[9px] font-medium"
                          style={{ background: 'rgba(255, 255, 255, 0.06)', color: 'rgb(var(--ink-300))' }}
                        >
                          {mat.category}
                        </span>
                        {mat.isDeadStock && (
                          <span className="rounded bg-crit/20 border border-crit/40 px-1.5 py-0.2 text-[9px] font-semibold text-crit">
                            DEAD STOCK ({mat.idleDays}d IDLE)
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] font-medium text-ink-200" title={mat.name}>
                        {mat.name}
                      </div>
                    </div>

                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                      style={{
                        background: `${VELOCITY_HEX[mat.velocity]}22`,
                        color: VELOCITY_HEX[mat.velocity],
                        border: `1px solid ${VELOCITY_HEX[mat.velocity]}44`,
                      }}
                    >
                      {mat.velocity === 'fast' ? 'Tier A' : mat.velocity === 'medium' ? 'Tier B' : 'Tier C'}
                    </span>
                  </div>

                  {/* Placement details: Coordinates, Stock & Unit Price */}
                  <div className="mt-2 grid grid-cols-2 gap-1 rounded bg-ink-950/60 p-1.5 text-[10px]">
                    <div>
                      <span className="text-ink-400">Location: </span>
                      <span className="font-mono font-semibold text-ink-100">{primaryBin?.code ?? 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-ink-400">Position: </span>
                      <span className="text-ink-200">
                        A{primaryBin?.aisle} · B{primaryBin?.bay} · L{primaryBin?.level}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-400">Total Stock: </span>
                      <span className="font-bold text-ink-100">{mat.totalStock.toLocaleString()} ea</span>
                    </div>
                    <div>
                      <span className="text-ink-400">Valuation: </span>
                      <span className="text-ink-200">₹{(mat.totalStock * mat.price).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* AGT-09 Recommendation snippet for Dead Stock */}
                  {mat.isDeadStock && (
                    <div className="mt-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-1.5 text-[9.5px] text-amber-300">
                      <span className="font-semibold">AGT-09 Recommendation: </span>
                      {mat.recommendation}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => primaryBin && locateBin(primaryBin.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded bg-ink-750 hover:bg-ink-700 py-1 text-[10.5px] font-semibold text-ink-100 transition-colors"
                      style={{
                        border: '1px solid var(--border, #E2E8F0)',
                      }}
                    >
                      <LocationIcon size={11} className="text-accent" />
                      <span>Fly to Bin</span>
                    </button>
                    {primaryBin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleTourBin(primaryBin.id)
                        }}
                        className="flex items-center justify-center gap-1 rounded py-1 px-2.5 text-[10.5px] font-bold transition-all shadow-sm cursor-pointer"
                        style={{
                          background: customTourBinIds.includes(primaryBin.id) ? '#6F3DBA' : 'rgba(111, 61, 186, 0.15)',
                          color: customTourBinIds.includes(primaryBin.id) ? '#FFFFFF' : '#8B5CF6',
                          border: customTourBinIds.includes(primaryBin.id) ? '1px solid #5B21B6' : '1px solid rgba(111, 61, 186, 0.45)',
                        }}
                        title={customTourBinIds.includes(primaryBin.id) ? 'Remove from custom pick tour' : 'Add to custom pick tour'}
                      >
                        <span>{customTourBinIds.includes(primaryBin.id) ? '✓ Queued' : '+ Queue'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (primaryBin) openIssueModal(primaryBin.id)
                      }}
                      className="flex flex-1 items-center justify-center gap-1 rounded bg-accent/20 hover:bg-accent/30 border border-accent/40 py-1 text-[10.5px] font-semibold text-accent-soft transition-colors"
                      style={{
                        background: 'rgba(111, 61, 186, 0.12)',
                        borderColor: 'rgba(111, 61, 186, 0.35)',
                        color: '#6F3DBA',
                      }}
                    >
                      <span>📦 Issue / Pick</span>
                    </button>
                  </div>
                </div>
              )
            })}

            {filtered.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(filtered.length, prev + 40))}
                className="w-full rounded-lg py-2 text-xs font-semibold mt-2 transition-colors cursor-pointer"
                style={{
                  background: 'rgba(111, 61, 186, 0.08)',
                  border: '1px solid rgba(111, 61, 186, 0.3)',
                  color: '#6F3DBA',
                }}
              >
                Load more components ({visibleCount} of {filtered.length}) ↓
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
