'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckSquare, Square, Play, XCircle, AlertTriangle, CheckCircle2, Loader2, BarChart3, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'

type EntityType = 'company' | 'contact' | 'opportunity'
type BatchAction = 'enrich' | 'rescore' | 'export' | 'tag' | 'archive' | 'delete'
type BatchStatus = 'idle' | 'confirming' | 'running' | 'complete' | 'error'

interface BatchItem {
  id: string
  name: string
  selected: boolean
  subtitle?: string
}

interface BatchResult {
  success: number
  failed: number
  skipped: number
  errors: string[]
}

interface BatchOperation {
  id: BatchAction
  label: string
  description: string
  icon: typeof Play
  color: string
  destructive: boolean
  confirmRequired: boolean
}

interface BatchOperationsPanelProps {
  entityType: EntityType
  items: BatchItem[]
  className?: string
  onExecute?: (action: BatchAction, selectedIds: string[]) => Promise<BatchResult>
  onSelectionChange?: (selectedIds: string[]) => void
}

const OPERATIONS: Record<BatchAction, BatchOperation> = {
  enrich: { id: 'enrich', label: 'Enrich Data', description: 'Fetch latest data from external sources', icon: BarChart3, color: tokens.domain.enrichment, destructive: false, confirmRequired: false },
  rescore: { id: 'rescore', label: 'Rescore', description: 'Recalculate intelligence scores', icon: Loader2, color: tokens.domain.signal, destructive: false, confirmRequired: false },
  export: { id: 'export', label: 'Export', description: 'Download selected items as CSV', icon: ArrowRight, color: tokens.domain.action, destructive: false, confirmRequired: false },
  tag: { id: 'tag', label: 'Add Tag', description: 'Apply a tag to all selected items', icon: CheckSquare, color: tokens.confidence.medium.value, destructive: false, confirmRequired: true },
  archive: { id: 'archive', label: 'Archive', description: 'Move selected items to archive', icon: CheckSquare, color: tokens.text.secondary, destructive: false, confirmRequired: true },
  delete: { id: 'delete', label: 'Delete', description: 'Permanently remove selected items', icon: XCircle, color: tokens.priority.critical.value, destructive: true, confirmRequired: true },
}

export function BatchOperationsPanel({ entityType, items, className, onExecute, onSelectionChange }: BatchOperationsPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<BatchStatus>('idle')
  const [activeOp, setActiveOp] = useState<BatchAction | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)

  const selectedItems = useMemo(() => items.filter(i => selectedIds.has(i.id)), [items, selectedIds])

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(i => i.id)))
    }
  }

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) { next.delete(id) } else { next.add(id) }
    setSelectedIds(next)
    onSelectionChange?.([...next])
  }

  const handleExecute = async (action: BatchAction) => {
    const op = OPERATIONS[action]
    if (op.confirmRequired && status !== 'confirming') {
      setStatus('confirming')
      setActiveOp(action)
      return
    }

    setStatus('running')
    setActiveOp(action)

    try {
      const res = await onExecute?.(action, [...selectedIds])
      setResult(res || { success: selectedItems.length, failed: 0, skipped: 0, errors: [] })
      setStatus('complete')
    } catch {
      setResult({ success: 0, failed: selectedItems.length, skipped: 0, errors: ['Operation failed'] })
      setStatus('error')
    }
  }

  const handleCancel = () => {
    setStatus('idle')
    setActiveOp(null)
    setResult(null)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Selection bar */}
      <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ background: tokens.surface.card, borderColor: selectedIds.size > 0 ? tokens.domain.signal : tokens.border.default }}>
        <div className="flex items-center gap-3">
          <button onClick={toggleAll} className="p-0.5">
            {selectedIds.size === items.length && items.length > 0 ? (
              <CheckSquare className="w-4 h-4" style={{ color: tokens.domain.signal }} />
            ) : (
              <Square className="w-4 h-4" style={{ color: tokens.text.muted }} />
            )}
          </button>
          <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>
            {selectedIds.size > 0 ? `${selectedIds.size} of ${items.length} selected` : `Select ${entityType}s`}
          </span>
        </div>
        {selectedIds.size > 0 && (
          <button onClick={() => { setSelectedIds(new Set()); handleCancel() }} className="text-[10px]" style={{ color: tokens.text.secondary }}>Clear selection</button>
        )}
      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto rounded-xl border divide-y" style={{ borderColor: tokens.border.default, ['--tw-divide-color' as string]: tokens.border.subtle } as React.CSSProperties}>
          {items.map(item => (
            <div key={item.id} className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]', selectedIds.has(item.id) && 'bg-white/[0.02]')}>
              <button onClick={() => toggleItem(item.id)}>
                {selectedIds.has(item.id) ? (
                  <CheckSquare className="w-4 h-4" style={{ color: tokens.domain.signal }} />
                ) : (
                  <Square className="w-4 h-4" style={{ color: tokens.text.muted }} />
                )}
              </button>
              <span className="text-xs font-medium flex-1 truncate" style={{ color: tokens.text.primary }}>{item.name}</span>
              {item.subtitle && <span className="text-[10px] truncate" style={{ color: tokens.text.secondary }}>{item.subtitle}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Operations */}
      {selectedIds.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold" style={{ color: tokens.text.secondary }}>Batch Operations</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {(Object.values(OPERATIONS) as BatchOperation[]).map(op => {
              const isActive = activeOp === op.id
              return (
                <button
                  key={op.id}
                  onClick={() => handleExecute(op.id)}
                  disabled={status === 'running'}
                  className={cn('flex items-center gap-2 p-3 rounded-xl border text-left transition-colors', isActive && 'ring-1')}
                  style={{
                    background: tokens.surface.card,
                    borderColor: isActive ? op.color : tokens.border.default,
                    opacity: status === 'running' && !isActive ? 0.5 : 1,
                    ...(isActive ? { ['--tw-ring-color' as string]: op.color } as React.CSSProperties : {}),
                  }}
                >
                  <op.icon className="w-4 h-4 shrink-0" style={{ color: op.color }} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold truncate" style={{ color: tokens.text.primary }}>{op.label}</p>
                    <p className="text-[9px] truncate" style={{ color: tokens.text.secondary }}>{op.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Status/Result */}
      <AnimatePresence>
        {status === 'confirming' && activeOp && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: `${OPERATIONS[activeOp].color}08`, borderColor: `${OPERATIONS[activeOp].color}30` }}>
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: OPERATIONS[activeOp].color }} />
            <span className="text-xs flex-1" style={{ color: tokens.text.primary }}>
              Confirm: {OPERATIONS[activeOp].label} on {selectedIds.size} items?
            </span>
            <button onClick={handleCancel} className="text-[10px] px-2 py-1 rounded border" style={{ color: tokens.text.secondary, borderColor: tokens.border.default }}>Cancel</button>
            <button onClick={() => handleExecute(activeOp)} className="text-[10px] font-semibold px-3 py-1 rounded-lg" style={{ background: OPERATIONS[activeOp].color, color: '#fff' }}>Confirm</button>
          </motion.div>
        )}

        {status === 'running' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: tokens.domain.signal }} />
            <span className="text-xs" style={{ color: tokens.text.primary }}>Processing {selectedIds.size} items...</span>
          </motion.div>
        )}

        {result && (status === 'complete' || status === 'error') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 rounded-xl border" style={{ background: status === 'complete' ? `${tokens.confidence.high.value}08` : `${tokens.priority.critical.value}08`, borderColor: status === 'complete' ? `${tokens.confidence.high.value}30` : `${tokens.priority.critical.value}30` }}>
            <div className="flex items-center gap-2 mb-1">
              {status === 'complete'
                ? <CheckCircle2 className="w-4 h-4" style={{ color: tokens.confidence.high.value }} />
                : <XCircle className="w-4 h-4" style={{ color: tokens.priority.critical.value }} />}
              <span className="text-xs font-semibold" style={{ color: tokens.text.primary }}>
                {status === 'complete' ? 'Complete' : 'Failed'}
              </span>
            </div>
            <p className="text-[11px]" style={{ color: tokens.text.secondary }}>
              {result.success} succeeded, {result.failed} failed, {result.skipped} skipped
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-[10px]" style={{ color: tokens.priority.critical.value }}>• {err}</li>
                ))}
              </ul>
            )}
            <button onClick={handleCancel} className="text-[10px] mt-2 underline" style={{ color: tokens.text.secondary }}>Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
