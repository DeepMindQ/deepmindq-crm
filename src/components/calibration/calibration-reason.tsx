'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Brain, Scale, TrendingUp, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface CalibrationFactor {
  name: string
  weight: number
  rawScore: number
  calibratedScore: number
  reason: string
  source?: string
}

interface CalibrationReasonProps {
  originalScore: number
  calibratedScore: number
  factors: CalibrationFactor[]
  overallReason: string
  confidence: number
  calibratedAt?: Date
  showDetails?: boolean
  className?: string
}

export function CalibrationReason({
  originalScore,
  calibratedScore,
  factors,
  overallReason,
  confidence,
  calibratedAt,
  showDetails: initialDetails = false,
  className
}: CalibrationReasonProps) {
  const [isExpanded, setIsExpanded] = useState(initialDetails)
  const scoreDelta = calibratedScore - originalScore
  const isUp = scoreDelta > 0
  const isDown = scoreDelta < 0

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {/* Header - Summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        aria-expanded={isExpanded}
        aria-controls="calibration-details"
      >
        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <Scale className="w-4 h-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Score Calibration</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              <Brain className="w-2.5 h-2.5 mr-0.5" />
              AI Adjusted
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{overallReason}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Score change */}
          <div className="text-right">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground line-through">{originalScore}</span>
              <span className={cn(
                'text-sm font-bold',
                isUp && 'text-green-400',
                isDown && 'text-red-400',
                !isUp && !isDown && 'text-foreground'
              )}>
                {calibratedScore}
              </span>
              {isUp && <TrendingUp className="w-3 h-3 text-green-400" />}
            </div>
            {scoreDelta !== 0 && (
              <span className={cn('text-[10px] font-medium', isUp ? 'text-green-400' : 'text-red-400')}>
                {isUp ? '+' : ''}{scoreDelta}
              </span>
            )}
          </div>

          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id="calibration-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              {/* Confidence indicator */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Calibration Confidence</span>
                <div className="flex items-center gap-2">
                  <Progress value={confidence} className="w-20 h-1.5" />
                  <span className="text-xs font-medium tabular-nums">{confidence}%</span>
                </div>
              </div>

              {/* Factor breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contributing Factors</span>
                {factors.map((factor, i) => (
                  <motion.div
                    key={factor.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{factor.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                          Weight: {(factor.weight * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{factor.rawScore}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-xs font-semibold">{factor.calibratedScore}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{factor.reason}</p>
                    {factor.source && (
                      <div className="flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{factor.source}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {calibratedAt && (
                <p className="text-[10px] text-muted-foreground pt-1">
                  Calibrated on {calibratedAt.toLocaleDateString()} at {calibratedAt.toLocaleTimeString()}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
