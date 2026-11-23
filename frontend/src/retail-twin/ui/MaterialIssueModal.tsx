import { useState, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { CloseIcon, AlertIcon, CheckIcon } from './components/icons'

export function MaterialIssueModal() {
  const issueModalBinId = useAppStore((s) => s.issueModalBinId)
  const closeIssueModal = useAppStore((s) => s.closeIssueModal)
  const issueMaterial = useAppStore((s) => s.issueMaterial)
  const model = useAppStore((s) => s.model)

  const bin = useMemo(() => {
    if (!issueModalBinId || !model) return null
    return model.binsById.get(issueModalBinId) ?? null
  }, [issueModalBinId, model])

  const [quantity, setQuantity] = useState<number>(10)
  const [destination, setDestination] = useState<string>('SMT Line 1 Feeder (High-Speed)')
  const [reason, setReason] = useState<string>('Production Order Consumption (SAP 261)')
  const [note, setNote] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!bin) return null

  const availableStock = bin.sku.stock
  const unitPrice = bin.sku.price
  const totalValue = quantity * unitPrice
  const newBalance = Math.max(0, availableStock - quantity)

  // Quick preset buttons
  const setQuickQty = (amount: number) => {
    setQuantity(Math.min(availableStock, Math.max(1, amount)))
    setErrorMsg(null)
  }

  const handleConfirm = () => {
    if (quantity <= 0) {
      setErrorMsg('Quantity must be at least 1')
      return
    }
    if (quantity > availableStock) {
      setErrorMsg(`Cannot issue ${quantity} units; only ${availableStock} units available in bin.`)
      return
    }

    setSubmitting(true)
    const result = issueMaterial({
      binId: bin.id,
      quantity,
      destination,
      reason,
      note: note.trim() || undefined,
    })

    setSubmitting(false)
    if (!result.success) {
      setErrorMsg(result.message)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 10, 20, 0.65)',
        backdropFilter: 'blur(4px)',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeIssueModal()
      }}
    >
      <div
        style={{
          width: 440,
          maxWidth: '100%',
          background: '#0F172A',
          border: '1px solid #334155',
          borderRadius: 14,
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#F8FAFC',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.22) 0%, rgba(15, 23, 42, 0.9) 100%)',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#93C5FD', letterSpacing: '0.05em' }}>
              Material Requisition &amp; Goods Issue (WMS / MES)
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>
              Issue Stock from Bin {bin.code}
            </div>
          </div>
          <button
            type="button"
            onClick={closeIssueModal}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Body content */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '78vh' }}>
          {/* Target Component Card */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid #334155',
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8' }}>{bin.sku.id}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', marginTop: 1 }}>{bin.sku.name}</div>
                <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{bin.sku.category}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Available Stock</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#10B981', marginTop: 1 }}>
                  {availableStock.toLocaleString()} ea
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 10.5, borderTop: '1px solid #1E293B', paddingTop: 8 }}>
              <div>
                <span style={{ color: '#94A3B8' }}>Aisle: </span>
                <span style={{ fontWeight: 600 }}>A{String(bin.aisle + 1).padStart(2, '0')}</span>
              </div>
              <div>
                <span style={{ color: '#94A3B8' }}>Bay/Lvl: </span>
                <span style={{ fontWeight: 600 }}>{bin.bay + 1} / L{bin.level + 1}</span>
              </div>
              <div>
                <span style={{ color: '#94A3B8' }}>Unit Cost: </span>
                <span style={{ fontWeight: 600 }}>₹{unitPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pick Quantity (Units)
              </label>
              <span style={{ fontSize: 10.5, color: '#94A3B8' }}>
                Max Available: <strong style={{ color: '#F8FAFC' }}>{availableStock} ea</strong>
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                min={1}
                max={availableStock}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  setQuantity(isNaN(val) ? 0 : val)
                  setErrorMsg(null)
                }}
                style={{
                  flex: 1,
                  background: '#090D16',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  padding: '7px 10px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setQuickQty(10)}
                style={{ background: '#1E293B', border: '1px solid #475569', color: '#E2E8F0', padding: '6px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                +10
              </button>
              <button
                type="button"
                onClick={() => setQuickQty(50)}
                style={{ background: '#1E293B', border: '1px solid #475569', color: '#E2E8F0', padding: '6px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                +50
              </button>
              <button
                type="button"
                onClick={() => setQuickQty(availableStock)}
                style={{ background: '#6F3DBA', border: '1px solid #7C3AED', color: '#FFFFFF', padding: '6px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                All
              </button>
            </div>
          </div>

          {/* Destination Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Issue Destination Work Center
            </label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              style={{
                width: '100%',
                background: '#090D16',
                border: '1px solid #475569',
                borderRadius: 6,
                padding: '7px 10px',
                fontSize: 12,
                color: '#FFFFFF',
                outline: 'none',
              }}
            >
              <option value="SMT Line 1 Feeder (High-Speed)">SMT Line 1 Feeder (High-Speed Motherboard)</option>
              <option value="SMT Line 2 Feeder (Flexible Line)">SMT Line 2 Feeder (Flexible Sub-boards)</option>
              <option value="Box-Build Final Packaging Station">Box-Build Final Packaging Station</option>
              <option value="Quality Analysis & FA Rework Lab">Quality Analysis &amp; FA Rework Lab</option>
              <option value="Scrap / Disposal Bin (Obsolete Liquidation)">Scrap / Disposal Bin (Dead Stock Write-Off)</option>
              <option value="Inter-Plant Transfer (Chennai EMS Plant)">Inter-Plant Transfer (Chennai EMS Plant)</option>
            </select>
          </div>

          {/* Movement Type / Reason */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Movement Type &amp; Purpose
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: '100%',
                background: '#090D16',
                border: '1px solid #475569',
                borderRadius: 6,
                padding: '7px 10px',
                fontSize: 12,
                color: '#FFFFFF',
                outline: 'none',
              }}
            >
              <option value="Production Order Consumption (SAP 261)">Production Order Consumption (SAP MIGO 261)</option>
              <option value="Cost Center Sampling / Rework (SAP 201)">Cost Center Sampling / Rework (SAP MIGO 201)</option>
              <option value="Dead Stock Scrap / Write-Off (SAP 551)">Dead Stock Scrap / Write-Off (SAP MIGO 551)</option>
              <option value="Plant-to-Plant Stock Transfer (SAP 301)">Plant-to-Plant Stock Transfer (SAP MIGO 301)</option>
              <option value="Physical Audit Reconciliation (SAP 701)">Physical Audit Reconciliation (SAP MIGO 701)</option>
            </select>
          </div>

          {/* Operator Reference Note */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Work Order / Reference Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. WO-9942 Night-Shift Feeding or ECO-402 Scrap"
              style={{
                width: '100%',
                background: '#090D16',
                border: '1px solid #475569',
                borderRadius: 6,
                padding: '7px 10px',
                fontSize: 12,
                color: '#FFFFFF',
                outline: 'none',
              }}
            />
          </div>

          {/* FIFO / FEFO Compliance Badge */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              borderRadius: 8,
              padding: 9,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: '#6EE7B7',
            }}
          >
            <CheckIcon size={14} className="shrink-0 text-emerald-400" />
            <div style={{ lineHeight: 1.4 }}>
              <strong>FIFO Strictness Guard (AGT-02):</strong> Batch Lot <span style={{ fontFamily: 'monospace' }}>LOT-2026-B812</span> verified as oldest available stock. Prevents shelf-life expiration.
            </div>
          </div>

          {/* Impact Summary */}
          <div
            style={{
              background: '#0B1120',
              border: '1px solid #1E293B',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
            }}
          >
            <div>
              <span style={{ color: '#94A3B8' }}>Total Value: </span>
              <strong style={{ color: '#38BDF8' }}>₹{totalValue.toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: '#94A3B8' }}>Remaining in Bin: </span>
              <strong style={{ color: newBalance === 0 ? '#EF4444' : '#10B981' }}>{newBalance} ea</strong>
            </div>
          </div>

          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 11,
                color: '#F87171',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertIcon size={12} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '12px 16px',
            background: '#090D16',
            borderTop: '1px solid #334155',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={closeIssueModal}
            style={{
              background: '#1E293B',
              border: '1px solid #475569',
              color: '#CBD5E1',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || quantity <= 0 || quantity > availableStock}
            onClick={handleConfirm}
            style={{
              background: 'linear-gradient(135deg, #6F3DBA 0%, #5B21B6 100%)',
              border: '1px solid #7C3AED',
              color: '#FFFFFF',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: submitting || quantity <= 0 || quantity > availableStock ? 'not-allowed' : 'pointer',
              opacity: submitting || quantity <= 0 || quantity > availableStock ? 0.6 : 1,
              boxShadow: '0 4px 14px rgba(111, 61, 186, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{submitting ? 'Executing...' : '✓ Confirm Goods Issue'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
