'use client'

import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens';

interface ScoreGaugeProps {
  score: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
  className?: string
}

export function ScoreGauge({ score, size = 'md', showLabel = true, label, className }: ScoreGaugeProps) {
  const sizeMap = { sm: 40, md: 56, lg: 72 }
  const fontSizeMap = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' }
  const strokeMap = { sm: 2, md: 2.5, lg: 3 }
  const px = sizeMap[size]
  const radius = (px - strokeMap[size] * 2) / 2
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference

  const color = score >= 80 ? tokens.domain.action : score >= 60 ? tokens.accent.DEFAULT : score >= 40 ? tokens.domain.reasoning : tokens.domain.risk
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Low'

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: px, height: px }}>
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${px} ${px}`}>
          <circle cx={px/2} cy={px/2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeMap[size]} className="text-muted/30" />
          <circle
            cx={px/2} cy={px/2} r={radius} fill="none"
            stroke={color}
            strokeWidth={strokeMap[size]}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold tabular-nums', fontSizeMap[size])} style={{ color }}>
            {score}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-[10px] text-muted-foreground mt-1">{label || scoreLabel}</span>
      )}
    </div>
  )
}
