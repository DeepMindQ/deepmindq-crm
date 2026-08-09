'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface TierConfig {
  name: string
  color: string
  bg: string
  border: string
  description: string
  threshold: number
}

const TIERS: Record<string, TierConfig> = {
  hot: { name: 'Hot', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', description: 'High-priority account with active buying signals', threshold: 80 },
  warm: { name: 'Warm', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', description: 'Account showing engagement and potential interest', threshold: 60 },
  nurture: { name: 'Nurture', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', description: 'Account for long-term relationship building', threshold: 40 },
  cold: { name: 'Cold', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)', description: 'Low-engagement account requiring reactivation', threshold: 0 },
}

interface AccountTierBadgeProps {
  tier: string
  score?: number
  showScore?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function AccountTierBadge({ tier, score, showScore = false, size = 'md', className }: AccountTierBadgeProps) {
  const config = TIERS[tier.toLowerCase()] || TIERS.cold
  const sizeClasses = size === 'sm' ? 'text-[10px] h-4 px-1.5' : 'text-xs h-5 px-2'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(sizeClasses, 'font-semibold gap-1', className)}
          style={{ 
            background: config.bg, 
            color: config.color, 
            borderColor: config.border 
          }}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', size === 'sm' ? 'w-1 h-1' : '')} style={{ background: config.color }} />
          {config.name}
          {showScore && score !== undefined && (
            <span className="tabular-nums opacity-75">{score}</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs font-medium">{config.name} Tier</p>
        <p className="text-xs text-muted-foreground">{config.description}</p>
        {config.threshold > 0 && <p className="text-[10px] text-muted-foreground mt-1">Score threshold: {config.threshold}+</p>}
      </TooltipContent>
    </Tooltip>
  )
}

// Helper to determine tier from score
export function getTierFromScore(score: number): string {
  if (score >= 80) return 'hot'
  if (score >= 60) return 'warm'
  if (score >= 40) return 'nurture'
  return 'cold'
}
