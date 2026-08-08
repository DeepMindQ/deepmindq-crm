'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  if (hoursAgo < 1) return { bg: 'rgba(34,197,94,0.2)', text: '#22c55e', label: 'Fresh' }
  if (hoursAgo < 6) return { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', label: '< 6h' }
  if (hoursAgo < 24) return { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', label: '< 24h' }
  if (hoursAgo < 72) return { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: '< 3d' }
  if (hoursAgo < 168) return { bg: 'rgba(249,115,22,0.15)', text: '#f97316', label: '< 7d' }
  return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: '> 7d' }
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
