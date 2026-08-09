'use client'

import { OpportunityCard } from './opportunity-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { LayoutGrid, List } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Opportunity {
  id: string
  title: string
  description: string
  companyName: string
  tier: string
  score: number
  probability: number
  estimatedValue?: string
  nextAction?: string
  contacts?: { name: string; role: string }[]
  source?: string
  isNew?: boolean
}

interface OpportunityGridProps {
  opportunities: Opportunity[]
  onOpportunityClick?: (id: string) => void
  className?: string
}

export function OpportunityGrid({ opportunities, onOpportunityClick, className }: OpportunityGridProps) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'score' | 'probability' | 'value'>('score')

  const sorted = [...opportunities].sort((a, b) => {
    if (sortBy === 'score') return b.score - a.score
    if (sortBy === 'probability') return b.probability - a.probability
    return 0
  })

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{opportunities.length} opportunities</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={setSortBy as (v: string) => void}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">By Score</SelectItem>
              <SelectItem value="probability">By Win %</SelectItem>
              <SelectItem value="value">By Value</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center border border-border rounded-lg">
            <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setView('grid')}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setView('list')}>
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Grid/List */}
      <div className={cn(
        view === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
          : 'space-y-3'
      )}>
        {sorted.map(opp => (
          <OpportunityCard
            key={opp.id}
            {...opp}
            onClick={onOpportunityClick ? () => onOpportunityClick(opp.id) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
