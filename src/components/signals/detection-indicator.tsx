'use client'

import { cn } from '@/lib/utils'

interface DetectionIndicatorProps {
  active: boolean
  type: 'signal' | 'enrichment' | 'monitoring' | 'scoring'
  count?: number
  className?: string
}

const INDICATOR_COLORS = {
  signal: { active: '#3b82f6', inactive: '#1e2535' },
  enrichment: { active: '#06b6d4', inactive: '#1e2535' },
  monitoring: { active: '#22c55e', inactive: '#1e2535' },
  scoring: { active: '#f59e0b', inactive: '#1e2535' },
}

export function DetectionIndicator({ active, type, count, className }: DetectionIndicatorProps) {
  const color = active ? INDICATOR_COLORS[type].active : INDICATOR_COLORS[type].inactive

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="status"
      aria-label={`${type} ${active ? 'active' : 'inactive'}${count ? `, ${count} detected` : ''}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {active && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-75"
            style={{ background: color }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2.5 w-2.5"
          style={{
            background: color,
            boxShadow: active ? `0 0 6px ${color}` : 'none',
          }}
        />
      </span>
      {count !== undefined && (
        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{count}</span>
      )}
    </div>
  )
}
