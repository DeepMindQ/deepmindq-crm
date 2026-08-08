'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Info, BarChart3 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ScoreDimension {
  name: string
  key: string
  score: number // 0-100
  weight: number // 0-1
  maxScore: number
  description: string
  subDimensions?: SubDimension[]
}

interface SubDimension {
  name: string
  score: number
  weight: number
  description: string
  evidence?: string
}

interface ScoreBreakdownProps {
  totalScore: number
  dimensions: ScoreDimension[]
  previousScore?: number
  tier?: { name: string; color: string; threshold: number }
  showWeights?: boolean
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Low'
}

export function ScoreBreakdown({
  totalScore,
  dimensions,
  previousScore,
  tier,
  showWeights = false,
  className
}: ScoreBreakdownProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null)
  const scoreDelta = previousScore !== undefined ? totalScore - previousScore : undefined

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Score Breakdown</h3>
          </div>
          <div className="flex items-center gap-2">
            {tier && (
              <Badge className="text-[10px] h-5" style={{ background: tier.color + '20', color: tier.color, border: `1px solid ${tier.color}40` }}>
                {tier.name}
              </Badge>
            )}
            {scoreDelta !== undefined && (
              <span className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                scoreDelta > 0 && 'text-green-400',
                scoreDelta < 0 && 'text-red-400',
                scoreDelta === 0 && 'text-muted-foreground'
              )}>
                {scoreDelta > 0 ? <TrendingUp className="w-3 h-3" /> : scoreDelta < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                {scoreDelta > 0 ? '+' : ''}{scoreDelta}
              </span>
            )}
          </div>
        </div>

        {/* Overall score gauge */}
        <div className="mt-3 flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke={getScoreColor(totalScore)}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${(totalScore / 100) * 97.4} 97.4`}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold tabular-nums" style={{ color: getScoreColor(totalScore) }}>
                {totalScore}
              </span>
            </div>
          </div>
          <div>
            <span className="text-sm font-medium" style={{ color: getScoreColor(totalScore) }}>
              {getScoreLabel(totalScore)}
            </span>
            <p className="text-xs text-muted-foreground">
              {dimensions.length} dimensions scored
            </p>
          </div>
        </div>
      </div>

      {/* Dimensions list */}
      <div className="divide-y divide-border">
        {dimensions.map((dim) => {
          const isExpanded = expandedDimension === dim.key

          return (
            <div key={dim.key}>
              <button
                onClick={() => setExpandedDimension(isExpanded ? null : dim.key)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                aria-expanded={isExpanded}
              >
                {/* Dimension name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{dim.name}</span>
                    {showWeights && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {(dim.weight * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{dim.description}</p>
                </div>

                {/* Score bar */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-20">
                    <Progress value={dim.score} className="h-1.5" />
                  </div>
                  <span className="text-sm font-semibold tabular-nums w-8 text-right" style={{ color: getScoreColor(dim.score) }}>
                    {dim.score}
                  </span>
                  {dim.subDimensions && dim.subDimensions.length > 0 && (
                    isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Sub-dimensions */}
              <AnimatePresence>
                {isExpanded && dim.subDimensions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 pl-8 space-y-2">
                      {dim.subDimensions.map((sub, si) => (
                        <motion.div
                          key={sub.name}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: si * 0.03 }}
                          className="flex items-center justify-between py-1.5"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{sub.name}</span>
                              <span className="text-[10px] text-muted-foreground">{(sub.weight * 100).toFixed(0)}%</span>
                            </div>
                            {sub.evidence && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3 h-3 text-muted-foreground inline ml-1 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <p className="text-xs">{sub.evidence}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-12">
                              <Progress value={sub.score} className="h-1" />
                            </div>
                            <span className="text-xs font-medium tabular-nums w-6 text-right" style={{ color: getScoreColor(sub.score) }}>
                              {sub.score}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
