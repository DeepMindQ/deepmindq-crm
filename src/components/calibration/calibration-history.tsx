'use client'

import { Scale, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

interface CalibrationEvent {
  id: string
  previousScore: number
  newScore: number
  reason: string
  calibratedAt: Date
  calibrator: 'ai' | 'manual'
}

interface CalibrationHistoryProps {
  events: CalibrationEvent[]
  className?: string
}

export function CalibrationHistory({ events, className }: CalibrationHistoryProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {events.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No calibration history</p>
      )}
      {events.map((event, i) => {
        const delta = event.newScore - event.previousScore
        const isUp = delta > 0
        const isDown = delta < 0
        const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus

        return (
          <div key={event.id} className="flex items-start gap-3 py-2">
            <div className="shrink-0 mt-0.5 w-6 h-6 rounded-md flex items-center justify-center bg-muted">
              <Icon className={cn('w-3 h-3', isUp && 'text-green-400', isDown && 'text-red-400', !isUp && !isDown && 'text-muted-foreground')} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{event.previousScore} → {event.newScore}</span>
                {delta !== 0 && (
                  <span className={cn('text-[10px] font-medium', isUp ? 'text-green-400' : 'text-red-400')}>
                    ({isUp ? '+' : ''}{delta})
                  </span>
                )}
                {event.calibrator === 'ai' && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">AI</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.reason}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatTimeAgo(event.calibratedAt)}
            </span>
          </div>
        )
      })}
    </div>
  )
}