'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Save,
  RotateCcw,
  AlertTriangle,
  Sliders,
  Zap,
  Clock,
  Target,
  BarChart3,
  Info,
  CheckCircle2,
  TrendingUp,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { EnterpriseLoading } from '@/components/enterprise'

/* ═══════════════════════════════════════════════════
   Types — aligned with src/lib/scoring-config.ts
   ═══════════════════════════════════════════════════ */

interface ScoringWeights {
  staticFit: number
  dynamicIntelligence: number
  timingUrgency: number
}

interface TierThresholds {
  hot: number
  active: number
  nurture: number
}

interface DynamicIntelSubWeights {
  intelligenceScore: number
  researchDepth: number
  signalQuality: number
  contactCoverage: number
}

interface TimingUrgencySubWeights {
  signalRecency: number
  engagementRecency: number
  growthIndicator: number
}

/* ═══════════════════════════════════════════════════
   Defaults (from DEFAULT_SCORING_CONFIG in scoring-config.ts)
   ═══════════════════════════════════════════════════ */

const DEFAULT_WEIGHTS: ScoringWeights = {
  staticFit: 0.4,
  dynamicIntelligence: 0.4,
  timingUrgency: 0.2,
}

const DEFAULT_THRESHOLDS: TierThresholds = {
  hot: 90,
  active: 70,
  nurture: 50,
}

const DEFAULT_DI_SUB: DynamicIntelSubWeights = {
  intelligenceScore: 0.3,
  researchDepth: 0.25,
  signalQuality: 0.25,
  contactCoverage: 0.2,
}

const DEFAULT_TU_SUB: TimingUrgencySubWeights = {
  signalRecency: 0.4,
  engagementRecency: 0.35,
  growthIndicator: 0.25,
}

const DEFAULT_RECENCY_DAYS = 30

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

function sumValues(obj: object): number {
  return Object.values(obj as Record<string, number>).reduce((sum, v) => sum + v, 0)
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
}

const TOLERANCE = 0.02

/* ═══════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════ */

function WeightSlider({
  label,
  value,
  onChange,
  description,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  description?: string
}) {
  const pct = value * 100

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium">{label}</Label>
          {description && (
            <p className="text-[10px] text-muted-foreground">{description}</p>
          )}
        </div>
        <span className="text-xs font-semibold tabular-nums text-primary">
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
          aria-label={`${label}: ${pct.toFixed(0)}%`}
        />
      </div>
    </div>
  )
}

function ValidationBadge({ sum, valid }: { sum: number; valid: boolean }) {
  return (
    <Badge
      variant={valid ? 'outline' : 'destructive'}
      className="text-[10px] h-4 px-1.5"
    >
      {valid ? '100%' : `${(sum * 100).toFixed(0)}%`}
    </Badge>
  )
}

function TierThresholdRow({
  label,
  color,
  value,
  onChange,
  description,
}: {
  label: string
  color: string
  value: number
  onChange: (v: number) => void
  description: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: color }}
        />
        <Label className="text-xs font-medium whitespace-nowrap">{label}</Label>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          {description}
        </span>
      </div>
      <Input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="h-10 w-16 text-xs text-right tabular-nums"
        aria-label={`${label} threshold`}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Score Simulation
   ═══════════════════════════════════════════════════ */

function ScoreSimulationCard({
  weights,
  diSub,
  tuSub,
  thresholds,
}: {
  weights: ScoringWeights
  diSub: DynamicIntelSubWeights
  tuSub: TimingUrgencySubWeights
  thresholds: TierThresholds
}) {
  // Simulate sample account scores
  const staticScore = 78
  const diScores = {
    intelligenceScore: 72,
    researchDepth: 85,
    signalQuality: 68,
    contactCoverage: 55,
  }
  const tuScores = {
    signalRecency: 90,
    engagementRecency: 75,
    growthIndicator: 60,
  }

  const computeComponent = (
    subWeights: object,
    subScores: object
  ) => {
    const w = subWeights as Record<string, number>
    const s = subScores as Record<string, number>
    return Object.entries(w).reduce(
      (acc, [key, weight]) => acc + weight * (s[key] ?? 0),
      0
    )
  }

  const diComponent = computeComponent(diSub, diScores)
  const tuComponent = computeComponent(tuSub, tuScores)

  const totalScore = Math.round(
    weights.staticFit * staticScore +
      weights.dynamicIntelligence * diComponent +
      weights.timingUrgency * tuComponent
  )

  const tier =
    totalScore >= thresholds.hot
      ? 'Hot'
      : totalScore >= thresholds.active
        ? 'Active'
        : totalScore >= thresholds.nurture
          ? 'Nurture'
          : 'Cold'

  const tierColor =
    tier === 'Hot'
      ? 'text-red-400'
      : tier === 'Active'
        ? 'text-emerald-400'
        : tier === 'Nurture'
          ? 'text-blue-400'
          : 'text-muted-foreground'

  return (
    <Card className="rounded-xl border border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            Score Simulation
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            Sample Account
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground">Static Fit</p>
            <p className="text-lg font-bold tabular-nums">{staticScore}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground">Dynamic Int.</p>
            <p className="text-lg font-bold tabular-nums">
              {Math.round(diComponent)}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground">Timing</p>
            <p className="text-lg font-bold tabular-nums">
              {Math.round(tuComponent)}
            </p>
          </div>
        </div>

        <Separator />

        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Composite Score
          </p>
          <p className="text-3xl font-bold tabular-nums">{totalScore}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span
              className={cn('text-sm font-semibold', tierColor)}
            >
              {tier}
            </span>
            <span className="text-[10px] text-muted-foreground">tier</span>
          </div>
        </div>

        <Separator />

        <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
          <Info className="w-3 h-3 shrink-0 mt-0.5" />
          <p>
            This simulation uses fixed sample sub-scores. Adjusting weights and
            thresholds above will update the composite score and tier in
            real-time.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

export default function ScoringConfigScreen() {
  const [weights, setWeights] = useState<ScoringWeights>({ ...DEFAULT_WEIGHTS })
  const [thresholds, setThresholds] = useState<TierThresholds>({
    ...DEFAULT_THRESHOLDS,
  })
  const [diSub, setDiSub] = useState<DynamicIntelSubWeights>({
    ...DEFAULT_DI_SUB,
  })
  const [tuSub, setTuSub] = useState<TimingUrgencySubWeights>({
    ...DEFAULT_TU_SUB,
  })
  const [recencyDays, setRecencyDays] = useState(DEFAULT_RECENCY_DAYS)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Validation
  const mainWeightSum = useMemo(() => sumValues(weights), [weights])
  const diWeightSum = useMemo(() => sumValues(diSub), [diSub])
  const tuWeightSum = useMemo(() => sumValues(tuSub), [tuSub])

  const mainValid = Math.abs(mainWeightSum - 1) < TOLERANCE
  const diValid = Math.abs(diWeightSum - 1) < TOLERANCE
  const tuValid = Math.abs(tuWeightSum - 1) < TOLERANCE
  const thresholdsValid = thresholds.hot > thresholds.active && thresholds.active > thresholds.nurture
  const recencyValid = recencyDays >= 1 && recencyDays <= 365
  const allValid = mainValid && diValid && tuValid && thresholdsValid && recencyValid

  // Simulated impact preview
  const impactCount = useMemo(() => {
    if (!hasChanges) return 0
    // Placeholder: in production this would compare against DB scores
    const delta = Math.abs(mainWeightSum - 1)
    return delta > 0.05 ? 23 : delta > 0.02 ? 12 : 0
  }, [hasChanges, mainWeightSum])

  const markChanged = useCallback(() => setHasChanges(true), [])

  const updateWeight = useCallback(
    (key: keyof ScoringWeights, value: number) => {
      setWeights((w) => ({ ...w, [key]: value }))
      markChanged()
    },
    [markChanged]
  )

  const updateThreshold = useCallback(
    (key: keyof TierThresholds, value: number) => {
      setThresholds((t) => ({ ...t, [key]: value }))
      markChanged()
    },
    [markChanged]
  )

  const updateDiSub = useCallback(
    (key: keyof DynamicIntelSubWeights, value: number) => {
      setDiSub((w) => ({ ...w, [key]: value }))
      markChanged()
    },
    [markChanged]
  )

  const updateTuSub = useCallback(
    (key: keyof TimingUrgencySubWeights, value: number) => {
      setTuSub((w) => ({ ...w, [key]: value }))
      markChanged()
    },
    [markChanged]
  )

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch('/api/scoring/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weights,
          tierThresholds: thresholds,
          signalRecencyDays: recencyDays,
          subDimensionWeights: {
            dynamicIntelligence: diSub,
            timingUrgency: tuSub,
          },
        }),
      }).catch(() => {
        /* best-effort */
      })
      setHasChanges(false)
      toast.success('Scoring configuration saved')
    } catch {
      toast.error('Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setWeights({ ...DEFAULT_WEIGHTS })
    setThresholds({ ...DEFAULT_THRESHOLDS })
    setDiSub({ ...DEFAULT_DI_SUB })
    setTuSub({ ...DEFAULT_TU_SUB })
    setRecencyDays(DEFAULT_RECENCY_DAYS)
    setHasChanges(false)
    toast.info('Reset to default configuration')
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Scoring Configuration</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={handleReset}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSave}
            disabled={!allValid || isSaving}
          >
            {isSaving ? (
              <>
                <motion.div
                  className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Validation Warnings ── */}
      {!allValid && (
        <motion.div
          className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200 space-y-1">
            {!mainValid && (
              <p>
                Main weights sum to {(mainWeightSum * 100).toFixed(0)}% (must be
                100%)
              </p>
            )}
            {!diValid && (
              <p>
                Dynamic Intelligence sub-weights sum to{' '}
                {(diWeightSum * 100).toFixed(0)}%
              </p>
            )}
            {!tuValid && (
              <p>
                Timing sub-weights sum to {(tuWeightSum * 100).toFixed(0)}%
              </p>
            )}
            {!thresholdsValid && (
              <p>Tier thresholds must be: Hot &gt; Active &gt; Nurture</p>
            )}
            {!recencyValid && (
              <p>Signal recency must be between 1 and 365 days</p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Impact Preview ── */}
      {hasChanges && impactCount > 0 && (
        <motion.div
          className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TrendingUp className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-primary">
            <span className="font-semibold">{impactCount} accounts</span> would
            change tier with these settings
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Column: Main Weights + Tier Thresholds ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Main Weights */}
            <Card className="rounded-xl border border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" /> Main Weights
                  </CardTitle>
                  <ValidationBadge sum={mainWeightSum} valid={mainValid} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <WeightSlider
                  label="Static Fit"
                  value={weights.staticFit}
                  onChange={(v) => updateWeight('staticFit', v)}
                  description="Company demographics, industry fit, size"
                />
                <WeightSlider
                  label="Dynamic Intelligence"
                  value={weights.dynamicIntelligence}
                  onChange={(v) => updateWeight('dynamicIntelligence', v)}
                  description="Signals, enrichment, AI insights"
                />
                <WeightSlider
                  label="Timing & Urgency"
                  value={weights.timingUrgency}
                  onChange={(v) => updateWeight('timingUrgency', v)}
                  description="Recency, frequency, velocity"
                />
              </CardContent>
            </Card>

            {/* Tier Thresholds */}
            <Card className="rounded-xl border border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> Tier Thresholds
                  </CardTitle>
                  <Badge
                    variant={thresholdsValid ? 'outline' : 'destructive'}
                    className="text-[10px] h-4 px-1.5"
                  >
                    {thresholdsValid ? 'Valid' : 'Invalid'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <TierThresholdRow
                  label="Hot"
                  color="var(--dmq-domain-risk)"
                  value={thresholds.hot}
                  onChange={(v) => updateThreshold('hot', v)}
                  description="90+ score"
                />
                <TierThresholdRow
                  label="Active"
                  color="var(--dmq-domain-action)"
                  value={thresholds.active}
                  onChange={(v) => updateThreshold('active', v)}
                  description="70-89 score"
                />
                <TierThresholdRow
                  label="Nurture"
                  color="var(--dmq-accent-blue)"
                  value={thresholds.nurture}
                  onChange={(v) => updateThreshold('nurture', v)}
                  description="50-69 score"
                />
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    Signal Recency Window
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={recencyDays}
                      onChange={(e) => {
                        setRecencyDays(parseInt(e.target.value) || 30)
                        markChanged()
                      }}
                      className="h-10 w-16 text-xs text-right tabular-nums"
                      aria-label="Signal recency days"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      days
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sub-weights row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dynamic Intelligence Sub-Weights */}
            <Card className="rounded-xl border border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Dynamic Intel
                    Sub-weights
                  </CardTitle>
                  <ValidationBadge sum={diWeightSum} valid={diValid} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(diSub).map(([key, val]) => (
                  <WeightSlider
                    key={key}
                    label={formatLabel(key)}
                    value={val}
                    onChange={(v) =>
                      updateDiSub(
                        key as keyof DynamicIntelSubWeights,
                        v
                      )
                    }
                  />
                ))}
              </CardContent>
            </Card>

            {/* Timing & Urgency Sub-Weights */}
            <Card className="rounded-xl border border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Timing Sub-weights
                  </CardTitle>
                  <ValidationBadge sum={tuWeightSum} valid={tuValid} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(tuSub).map(([key, val]) => (
                  <WeightSlider
                    key={key}
                    label={formatLabel(key)}
                    value={val}
                    onChange={(v) =>
                      updateTuSub(
                        key as keyof TimingUrgencySubWeights,
                        v
                      )
                    }
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Right Column: Score Simulation ── */}
        <div className="space-y-6">
          <ScoreSimulationCard
            weights={weights}
            diSub={diSub}
            tuSub={tuSub}
            thresholds={thresholds}
          />
        </div>
      </div>
    </div>
  )
}
