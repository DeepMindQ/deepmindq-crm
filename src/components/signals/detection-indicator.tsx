'use client'

import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens';

interface DetectionIndicatorProps {
  active: boolean
  type: 'signal' | 'enrichment' | 'monitoring' | 'scoring'
  count?: number
  className?: string
}

const INDICATOR_COLORS = {
  signal: { active: tokens.accent.DEFAULT, inactive: tokens.border.default },
  enrichment: { active: tokens.domain.enrichment, inactive: tokens.border.default },
  monitoring: { active: tokens.domain.action, inactive: tokens.border.default },
  scoring: { active: tokens.domain.reasoning, inactive: tokens.border.default },
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
