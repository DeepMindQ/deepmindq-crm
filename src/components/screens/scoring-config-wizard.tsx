'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sliders, Save, RotateCcw, AlertTriangle, ChevronDown, ChevronRight, Target, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'
import { useMutation } from '@/lib/realtime-hooks'

interface WeightConfig {
  id: string
  label: string
  description: string
  weight: number
  min: number
  max: number
  category: string
}

interface TierThreshold {
  tier: string
  label: string
  color: string
  minScore: number
}

interface ScoringConfigWizardProps {
  className?: string
  onSave?: (config: { weights: WeightConfig[]; tiers: TierThreshold[] }) => void
  onReset?: () => void
}

const DEFAULT_WEIGHTS: WeightConfig[] = [
  { id: 'staticFit', label: 'Static Fit', description: 'ICP match (industry, size, geography)', weight: 35, min: 0, max: 100, category: 'Fit' },
  { id: 'dynamicIntel', label: 'Dynamic Intelligence', description: 'AI signals, engagement, intent data', weight: 40, min: 0, max: 100, category: 'Intelligence' },
  { id: 'timingUrgency', label: 'Timing & Urgency', description: 'Recency, window of opportunity', weight: 25, min: 0, max: 100, category: 'Timing' },
  { id: 'intelligenceScore', label: 'Intelligence Score', description: 'Overall research depth score', weight: 50, min: 0, max: 100, category: 'Intelligence' },
  { id: 'researchDepth', label: 'Research Depth', description: 'Quality and breadth of data', weight: 30, min: 0, max: 100, category: 'Intelligence' },
  { id: 'signalQuality', label: 'Signal Quality', description: 'Number and recency of signals', weight: 20, min: 0, max: 100, category: 'Intelligence' },
]

const DEFAULT_TIERS: TierThreshold[] = [
  { tier: 'hot', label: 'Hot', color: tokens.confidence.high.value, minScore: 90 },
  { tier: 'warm', label: 'Active', color: tokens.confidence.medium.value, minScore: 70 },
  { tier: 'nurture', label: 'Nurture', color: tokens.priority.medium.value, minScore: 50 },
  { tier: 'cold', label: 'Cold', color: tokens.priority.low.value, minScore: 0 },
]

export function ScoringConfigWizard({ className, onSave, onReset }: ScoringConfigWizardProps) {
  const [weights, setWeights] = useState<WeightConfig[]>(DEFAULT_WEIGHTS)
  const [tiers, setTiers] = useState<TierThreshold[]>(DEFAULT_TIERS)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const saveConfigMutation = useMutation({
    endpoint: '/api/scoring/config',
    method: 'PUT',
  })

  const resetConfigMutation = useMutation({
    endpoint: '/api/scoring/config/reset',
    method: 'POST',
  })

  const categories = useMemo(() => [...new Set(weights.map(w => w.category))], [weights])

  const updateWeight = useCallback((id: string, newWeight: number) => {
    setWeights(prev => prev.map(w => w.id === id ? { ...w, weight: Math.min(Math.max(newWeight, w.min), w.max) } : w))
    setHasChanges(true)
  }, [])

  const updateTier = useCallback((tierId: string, minScore: number) => {
    setTiers(prev => prev.map(t => t.tier === tierId ? { ...t, minScore: Math.min(Math.max(minScore, 0), 100) } : t))
    setHasChanges(true)
  }, [])

  const handleReset = async () => {
    await resetConfigMutation.mutate()
    setWeights(DEFAULT_WEIGHTS)
    setTiers(DEFAULT_TIERS)
    setHasChanges(false)
    onReset?.()
  }

  const handleSave = async () => {
    await saveConfigMutation.mutate({ weights, tiers })
    onSave?.({ weights, tiers })
    setHasChanges(false)
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5" style={{ color: tokens.domain.signal }} />
          <h2 className="text-lg font-bold" style={{ color: tokens.text.primary }}>Scoring Configuration</h2>
          {hasChanges && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full animate-pulse" style={{ background: `${tokens.domain.reasoning}15`, color: tokens.domain.reasoning }}>Unsaved</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} disabled={resetConfigMutation.loading} className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg hover:bg-white/5 border transition-colors" style={{ color: tokens.text.secondary, borderColor: tokens.border.default, opacity: resetConfigMutation.loading ? 0.5 : 1 }}>
            {resetConfigMutation.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}Reset
          </button>
          <button onClick={handleSave} disabled={!hasChanges || saveConfigMutation.loading} className={cn('flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors', (!hasChanges || saveConfigMutation.loading) && 'opacity-50')} style={{ background: tokens.domain.signal, color: '#fff' }}>
            {saveConfigMutation.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Save
          </button>
        </div>
      </div>

      {/* Tier Thresholds */}
      <div className="rounded-xl border p-4" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: tokens.text.primary }}>
          <Target className="w-4 h-4" style={{ color: tokens.domain.opportunity }} />Tier Thresholds
        </h3>
        <div className="space-y-3">
          {tiers.map(tier => (
            <div key={tier.tier} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: tier.color }} />
              <span className="text-xs font-medium w-20" style={{ color: tokens.text.primary }}>{tier.label}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: tokens.surface.secondary }}>
                <div className="h-full rounded-full" style={{ width: `${tier.minScore}%`, background: tier.color }} />
              </div>
              <input
                type="number"
                min={0}
                max={100}
                value={tier.minScore}
                onChange={e => updateTier(tier.tier, parseInt(e.target.value) || 0)}
                className="w-14 h-7 text-center text-[11px] rounded border bg-transparent outline-none"
                style={{ borderColor: tokens.border.default, color: tokens.text.primary }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Weight Configuration */}
      <div className="rounded-xl border p-4" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: tokens.text.primary }}>
          <Sliders className="w-4 h-4" style={{ color: tokens.domain.signal }} />Scoring Weights
        </h3>
        <div className="space-y-1">
          {categories.map(cat => {
            const catWeights = weights.filter(w => w.category === cat)
            const catTotal = catWeights.reduce((s, w) => s + w.weight, 0)
            const isExpanded = activeCategory === cat

            return (
              <div key={cat}>
                <button onClick={() => setActiveCategory(isExpanded ? null : cat)} className="w-full flex items-center gap-2 py-2 text-left">
                  {isExpanded ? <ChevronDown className="w-3 h-3" style={{ color: tokens.text.muted }} /> : <ChevronRight className="w-3 h-3" style={{ color: tokens.text.muted }} />}
                  <span className="text-xs font-semibold flex-1" style={{ color: tokens.text.primary }}>{cat}</span>
                  <span className={cn('text-[10px] tabular-nums', catTotal !== 100 && 'font-bold')} style={{ color: catTotal === 100 ? tokens.text.muted : tokens.domain.risk }}>
                    {catTotal}%
                  </span>
                  {catTotal !== 100 && <AlertTriangle className="w-3 h-3" style={{ color: tokens.domain.risk }} />}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-5 space-y-3 pb-2">
                      {catWeights.map(w => (
                        <div key={w.id}>
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="text-[11px] font-medium" style={{ color: tokens.text.primary }}>{w.label}</span>
                              <p className="text-[10px]" style={{ color: tokens.text.muted }}>{w.description}</p>
                            </div>
                            <span className="text-sm font-mono font-bold tabular-nums w-8 text-right" style={{ color: tokens.text.primary }}>{w.weight}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={w.min}
                              max={w.max}
                              value={w.weight}
                              onChange={e => updateWeight(w.id, parseInt(e.target.value))}
                              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                              style={{ background: tokens.surface.secondary, accentColor: tokens.domain.signal }}
                            />
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
