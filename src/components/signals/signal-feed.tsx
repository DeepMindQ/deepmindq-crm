'use client'

import { useState, useMemo } from 'react'
import { SignalCard, type Signal } from './signal-card'
import { DetectionIndicator } from './detection-indicator'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SignalFeedProps {
  signals: Signal[]
  className?: string
}

export function SignalFeed({ signals, className }: SignalFeedProps) {
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [filter, setFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'time' | 'severity' | 'confidence'>('time')

  const filtered = useMemo(() => {
    let result = filter === 'all' ? signals : signals.filter(s => s.severity === filter)
    if (sortBy === 'severity') {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
      result = [...result].sort((a, b) => order[a.severity] - order[b.severity])
    } else if (sortBy === 'confidence') {
      result = [...result].sort((a, b) => b.confidence - a.confidence)
    }
    return result
  }, [signals, filter, sortBy])

  const activeSignals = signals.length
  const criticalCount = signals.filter(s => s.severity === 'critical').length

  return (
    <div className={cn('space-y-4', className)}>
      {/* Status bar */}
      <div className="flex items-center gap-4">
        <DetectionIndicator active={activeSignals > 0} type="signal" count={activeSignals} />
        <span className="text-xs text-muted-foreground">{activeSignals} unread signals</span>
        {criticalCount > 0 && <span className="text-xs font-medium text-red-400">{criticalCount} critical</span>}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-28 text-xs" aria-label="Filter by severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'time' | 'severity' | 'confidence')}>
            <SelectTrigger className="h-8 w-28 text-xs" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">Latest</SelectItem>
              <SelectItem value="severity">Severity</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center border border-border rounded-lg">
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setView('list')}
            aria-label="List view"
            aria-pressed={view === 'list'}
          >
            <List className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setView('grid')}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Signal cards */}
      <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-3'}>
        {filtered.map(signal => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <p className="text-sm text-muted-foreground">No signals match your filters</p>
        </div>
      )}
    </div>
  )
}
