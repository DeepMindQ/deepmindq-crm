'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

interface BatchSelectHeaderProps {
  selectedCount: number
  totalCount: number
  isAllSelected: boolean
  isIndeterminate: boolean
  onSelectAll: () => void
  onClearSelection: () => void
  className?: string
}

/* ═══════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════ */

export function BatchSelectHeader({
  selectedCount,
  totalCount,
  isAllSelected,
  isIndeterminate,
  onSelectAll,
  onClearSelection,
  className,
}: BatchSelectHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Checkbox
        checked={isIndeterminate ? 'indeterminate' : isAllSelected}
        onCheckedChange={(checked) =>
          checked ? onSelectAll() : onClearSelection()
        }
        aria-label={
          selectedCount > 0
            ? `${selectedCount} of ${totalCount} selected`
            : `Select all ${totalCount} items`
        }
      />
      {selectedCount > 0 && (
        <span className="text-xs text-primary font-medium">
          {selectedCount} selected
        </span>
      )}
    </div>
  )
}
