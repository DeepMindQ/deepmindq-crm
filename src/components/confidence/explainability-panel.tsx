'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Brain, Info, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'

interface Factor {
  name: string
  weight: number      // 0-1
  score: number       // 0-100
  description: string
  evidence?: string
}

export interface ExplainabilityPanelProps {
  overallScore: number
  overallConfidence: 'high' | 'medium' | 'low'
  factors: Factor[]
  modelVersion?: string
  lastTrained?: string
  className?: string
  onFactorClick?: (factor: Factor) => void
}

function getConfidenceColor(confidence: 'high' | 'medium' | 'low') {
  return tokens.confidence[confidence]
}

export function ExplainabilityPanel({
  overallScore, overallConfidence, factors, modelVersion, lastTrained, className, onFactorClick
}: ExplainabilityPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null)
  const confColor = getConfidenceColor(overallConfidence)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border overflow-hidden', className)}
      style={{ background: tokens.surface.card, borderColor: tokens.border.default }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${confColor.value}15` }}>
          <Brain className="w-4 h-4" style={{ color: confColor.value }} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>AI Reasoning</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${confColor.value}15`, color: confColor.value }}>
              {overallConfidence.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: tokens.text.secondary }}>
            {factors.length} factors · Score {overallScore}/100
          </p>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4" style={{ color: tokens.text.secondary }} />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              {/* Overall bar */}
              <div className="h-2 rounded-full overflow-hidden" style={{ background: tokens.surface.secondary }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: confColor.value }}
                  initial={{ width: 0 }}
                  animate={{ width: `${overallScore}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>

              {/* Factor breakdown */}
              <div className="space-y-1.5 pt-1">
                {factors.map((factor) => (
                  <div key={factor.name} className="rounded-lg border p-2.5" style={{ background: tokens.surface.secondary, borderColor: tokens.border.subtle }}>
                    <button
                      onClick={() => {
                        setExpandedFactor(expandedFactor === factor.name ? null : factor.name)
                        onFactorClick?.(factor)
                      }}
                      className="w-full flex items-center gap-2 text-left"
                    >
                      {expandedFactor === factor.name ? (
                        <ChevronDown className="w-3 h-3 shrink-0" style={{ color: tokens.text.secondary }} />
                      ) : (
                        <ChevronRight className="w-3 h-3 shrink-0" style={{ color: tokens.text.secondary }} />
                      )}
                      <span className="text-xs font-medium flex-1 truncate" style={{ color: tokens.text.primary }}>
                        {factor.name}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums" style={{ color: tokens.text.secondary }}>
                        {factor.score}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: tokens.surface.base, color: tokens.text.secondary }}>
                        w:{(factor.weight * 100).toFixed(0)}%
                      </span>
                    </button>

                    <AnimatePresence>
                      {expandedFactor === factor.name && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 pl-5 space-y-1.5">
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: tokens.surface.base }}>
                              <div className="h-full rounded-full transition-all" style={{
                                width: `${factor.score}%`,
                                background: factor.score >= 70 ? tokens.confidence.high.value : factor.score >= 45 ? tokens.confidence.medium.value : tokens.confidence.low.value,
                              }} />
                            </div>
                            <p className="text-[11px] leading-relaxed" style={{ color: tokens.text.secondary }}>
                              {factor.description}
                            </p>
                            {factor.evidence && (
                              <div className="flex items-start gap-1.5 mt-1">
                                <Info className="w-3 h-3 shrink-0 mt-0.5" style={{ color: tokens.domain.reasoning }} />
                                <p className="text-[10px]" style={{ color: tokens.text.muted }}>{factor.evidence}</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              {/* Metadata */}
              {(modelVersion || lastTrained) && (
                <div className="flex items-center gap-3 pt-2 mt-1 border-t" style={{ borderColor: tokens.border.subtle }}>
                  {modelVersion && (
                    <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                      <Sparkles className="w-3 h-3 inline mr-1" />Model v{modelVersion}
                    </span>
                  )}
                  {lastTrained && (
                    <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                      Trained {lastTrained}
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
