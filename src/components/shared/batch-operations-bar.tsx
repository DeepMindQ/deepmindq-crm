'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2,
  Archive,
  Mail,
  Tag,
  Download,
  MoreHorizontal,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

interface BatchAction {
  id: string
  label: string
  icon: React.ElementType
  variant?: 'default' | 'destructive'
  onExecute: (selectedIds: Set<string>) => Promise<void> | void
}

interface BatchOperationResult {
  actionId: string
  status: 'pending' | 'running' | 'success' | 'error'
  affectedCount: number
  message?: string
}

interface BatchOperationsBarProps {
  selectedIds: Set<string>
  totalCount: number
  actions: BatchAction[]
  onSelectAll: () => void
  onClearSelection: () => void
  isLoading?: boolean
  className?: string
}

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

export function BatchOperationsBar({
  selectedIds,
  totalCount,
  actions,
  onSelectAll,
  onClearSelection,
  isLoading,
  className,
}: BatchOperationsBarProps) {
  const [results, setResults] = useState<BatchOperationResult[]>([])
  const [executingAction, setExecutingAction] = useState<string | null>(null)

  const isAllSelected =
    selectedIds.size === totalCount && totalCount > 0

  const handleAction = useCallback(
    async (action: BatchAction) => {
      if (selectedIds.size === 0) return
      setExecutingAction(action.id)
      setResults((prev) => [
        ...prev,
        {
          actionId: action.id,
          status: 'running',
          affectedCount: selectedIds.size,
        },
      ])

      try {
        await action.onExecute(selectedIds)
        setResults((prev) =>
          prev.map((r) =>
            r.actionId === action.id
              ? {
                  ...r,
                  status: 'success' as const,
                  message: `Completed for ${selectedIds.size} items`,
                }
              : r
          )
        )
      } catch {
        setResults((prev) =>
          prev.map((r) =>
            r.actionId === action.id
              ? {
                  ...r,
                  status: 'error' as const,
                  message: 'Operation failed',
                }
              : r
          )
        )
      } finally {
        setExecutingAction(null)
      }
    },
    [selectedIds]
  )

  const canSelectAll = !isLoading && totalCount > 0

  return (
    <AnimatePresence>
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'sticky top-16 z-20 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card shadow-lg',
            className
          )}
          role="toolbar"
          aria-label="Batch operations"
        >
          {/* Selection count */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs h-6 px-2 bg-primary/10 text-primary border-primary/20 font-semibold"
            >
              {selectedIds.size} selected
            </Badge>
            {canSelectAll && (
              <button
                onClick={isAllSelected ? onClearSelection : onSelectAll}
                className="text-[10px] text-primary hover:text-primary/80 underline decoration-dotted"
              >
                {isAllSelected ? 'Clear' : 'Select all'}
              </button>
            )}
          </div>

          <div className="w-px h-5 bg-border" />

          {/* Primary actions (first 3) */}
          <div className="flex items-center gap-1">
            {actions.slice(0, 3).map((action) => {
              const Icon = action.icon
              const isRunning = executingAction === action.id
              return (
                <Button
                  key={action.id}
                  variant={
                    action.variant === 'destructive' ? 'destructive' : 'outline'
                  }
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  disabled={isRunning || selectedIds.size === 0}
                  onClick={() => handleAction(action)}
                >
                  {isRunning ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                  {action.label}
                </Button>
              )
            })}

            {/* More actions dropdown */}
            {actions.length > 3 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1">
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {actions.slice(3).map((action) => {
                    const Icon = action.icon
                    return (
                      <DropdownMenuItem
                        key={action.id}
                        onClick={() => handleAction(action)}
                        disabled={selectedIds.size === 0}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {action.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Results feedback */}
          <div className="flex items-center gap-1.5">
            {results.slice(-3).map((result) => (
              <motion.div
                key={result.actionId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              >
                {result.status === 'running' && (
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                )}
                {result.status === 'success' && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                )}
                {result.status === 'error' && (
                  <XCircle className="w-3 h-3 text-red-400" />
                )}
                <span
                  className={
                    result.status === 'success'
                      ? 'text-emerald-400'
                      : result.status === 'error'
                        ? 'text-red-400'
                        : 'text-primary'
                  }
                >
                  {result.message}
                </span>
              </motion.div>
            ))}

            {/* Clear selection */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClearSelection}
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
