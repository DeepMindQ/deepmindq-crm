'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getConfidenceTier, tokens } from '@/components/intelligence-os/design-tokens'

export interface ConfidenceBadgeEnrichedProps {
  score: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  tooltip?: string // explanation text
  className?: string
}

export function ConfidenceBadgeEnriched({ score, size = 'md', showLabel = true, tooltip, className }: ConfidenceBadgeEnrichedProps) {
  const tier = getConfidenceTier(score)
  const tierConfig = tokens.confidence[tier]
  const sizeClasses = { sm: 'text-[10px] h-4 px-1.5 gap-1', md: 'text-xs h-5 px-2 gap-1.5', lg: 'text-sm h-6 px-2.5 gap-2' }
  const dotSizes = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' }

  const badge = (
    <Badge
      variant="outline"
      className={cn(sizeClasses[size], 'font-semibold', className)}
      style={{ background: tierConfig.bg, color: tierConfig.value, borderColor: tierConfig.border }}
      aria-label={`Confidence: ${tierConfig.label} (${score})`}
    >
      <span className={cn('rounded-full shrink-0', dotSizes[size])} style={{ background: tierConfig.value }} />
      {showLabel && <span>{tierConfig.label}</span>}
      <span className="tabular-nums font-bold">{score}</span>
    </Badge>
  )

  if (!tooltip) return badge
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  )
}
