'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { tokens } from '@/components/intelligence-os/design-tokens';
import { cn } from '@/lib/utils'

export interface FreshnessEntry {
  source: string
  type: string
  lastUpdated: Date
  recordCount: number
  staleThreshold?: number
}

interface FreshnessHeatmapProps {
  entries: FreshnessEntry[]
  className?: string
}

function getFreshnessColor(hoursAgo: number): { bg: string; text: string; label: string } {
  if (hoursAgo < 1) return { bg: tokens.trust.verified.border, text: tokens.domain.action, label: 'Fresh' }
  if (hoursAgo < 6) return { bg: tokens.trust.verified.bg, text: tokens.domain.action, label: '< 6h' }
  if (hoursAgo < 24) return { bg: tokens.accent.subtle, text: tokens.accent.DEFAULT, label: '< 24h' }
  if (hoursAgo < 72) return { bg: tokens.confidence.medium.bg, text: tokens.domain.reasoning, label: '< 3d' }
  if (hoursAgo < 168) return { bg: tokens.trust.low.bg, text: tokens.trust.low.value, label: '< 7d' }
  return { bg: tokens.confidence.low.bg, text: tokens.domain.risk, label: '> 7d' }
}

export function FreshnessHeatmap({ entries, className }: FreshnessHeatmapProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Data Freshness</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {entries.map(entry => {
            const hoursAgo = (Date.now() - entry.lastUpdated.getTime()) / (1000 * 60 * 60)
            const fresh = getFreshnessColor(hoursAgo)
            return (
              <Tooltip key={entry.source}>
                <TooltipTrigger asChild>
                  <div
                    className="rounded-lg p-3 text-center border border-border hover:border-primary/30 transition-colors cursor-default"
                    style={{ background: fresh.bg }}
                  >
                    <div
                      className="w-full aspect-square rounded-md flex items-center justify-center mb-2"
                      style={{ background: fresh.text + '20', border: `1px solid ${fresh.text}40` }}
                    >
                      <span className="text-lg font-bold" style={{ color: fresh.text }}>
                        {fresh.label.charAt(0)}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-foreground line-clamp-1 block">
                      {entry.source}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {entry.recordCount.toLocaleString()} records
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs font-medium">{entry.source}</p>
                  <p className="text-xs text-muted-foreground">Last updated: {entry.lastUpdated.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Age: {Math.round(hoursAgo)}h ago</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </div>
  )
}
