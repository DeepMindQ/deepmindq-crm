'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Layers,
  Sliders,
  Thermometer,
  Save,
  Building2,
  Users,
  Zap,
  Target,
  DollarSign,
  BarChart3,
  Briefcase,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ── Types ──
type WizardStep = 1 | 2 | 3 | 4;

const allDimensions = [
  {
    id: 'industry',
    name: 'Industry Fit',
    description: 'Match against target industries',
    icon: <Building2 className="w-4 h-4" />,
    defaultWeight: 20,
  },
  {
    id: 'size',
    name: 'Company Size',
    description: 'Revenue & employee alignment',
    icon: <Users className="w-4 h-4" />,
    defaultWeight: 15,
  },
  {
    id: 'tech',
    name: 'Technology Match',
    description: 'Stack compatibility',
    icon: <Layers className="w-4 h-4" />,
    defaultWeight: 20,
  },
  {
    id: 'signal',
    name: 'Signal Strength',
    description: 'Volume & quality of signals',
    icon: <Zap className="w-4 h-4" />,
    defaultWeight: 25,
  },
  {
    id: 'engagement',
    name: 'Engagement Level',
    description: 'Interaction frequency & depth',
    icon: <Target className="w-4 h-4" />,
    defaultWeight: 10,
  },
  {
    id: 'revenue',
    name: 'Revenue Potential',
    description: 'Deal size & expansion',
    icon: <DollarSign className="w-4 h-4" />,
    defaultWeight: 10,
  },
  {
    id: 'market',
    name: 'Market Position',
    description: 'Market share & growth',
    icon: <BarChart3 className="w-4 h-4" />,
    defaultWeight: 0,
  },
  {
    id: 'firmo',
    name: 'Firmographics',
    description: 'Company attributes match',
    icon: <Briefcase className="w-4 h-4" />,
    defaultWeight: 0,
  },
];

const stepConfig: Record<
  WizardStep,
  { title: string; description: string; icon: React.ReactNode }
> = {
  1: {
    title: 'Select Dimensions',
    description: 'Choose which scoring dimensions to include',
    icon: <Layers className="w-4 h-4" />,
  },
  2: {
    title: 'Set Weights',
    description: 'Adjust the relative importance of each dimension',
    icon: <Sliders className="w-4 h-4" />,
  },
  3: {
    title: 'Configure Thresholds',
    description: 'Define Hot, Warm, and Cold score ranges',
    icon: <Thermometer className="w-4 h-4" />,
  },
  4: {
    title: 'Review & Save',
    description: 'Preview your scoring model configuration',
    icon: <Save className="w-4 h-4" />,
  },
};

const barColors = [
  tokens.confidence.low.value,
  tokens.confidence.low.value,
  tokens.confidence.medium.value,
  tokens.confidence.high.value,
  tokens.confidence.high.value,
];

// ── Component ──
export function ScoringConfigWizard() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(['industry', 'size', 'tech', 'signal', 'engagement', 'revenue']),
  );
  const [weights, setWeights] = useState<Record<string, number>>({
    industry: 20,
    size: 15,
    tech: 20,
    signal: 25,
    engagement: 10,
    revenue: 10,
  });
  const [thresholds, setThresholds] = useState({ hot: 70, warm: 40 });
  const [complete, setComplete] = useState(false);

  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const toggleDimension = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const updateWeight = useCallback((id: string, val: number) => {
    setWeights((prev) => ({ ...prev, [id]: val }));
  }, []);

  const totalWeight = useMemo(() => {
    let sum = 0;
    for (const id of selectedIds) sum += weights[id] || 0;
    return sum;
  }, [selectedIds, weights]);

  const activeDimensions = useMemo(
    () => allDimensions.filter((d) => selectedIds.has(d.id)),
    [selectedIds],
  );

  // Mock distribution data
  const distribution = useMemo(() => {
    return [
      { range: '0-20', count: 15 },
      { range: '21-40', count: 45 },
      { range: '41-60', count: 120 },
      { range: '61-80', count: 200 },
      { range: '81-100', count: 180 },
    ];
  }, []);

  const canNext = useMemo(() => {
    if (step === 1) return selectedIds.size >= 2;
    if (step === 2) return totalWeight === 100;
    if (step === 3) return thresholds.hot > thresholds.warm;
    return true;
  }, [step, selectedIds, totalWeight, thresholds]);

  const handleSave = useCallback(() => {
    setComplete(true);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3 w-full max-w-lg" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (complete) {
    return (
      <div className="p-4 md:p-6">
        <div className="max-w-lg mx-auto text-center py-16">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${tokens.confidence.high.value}15` }}
          >
            <Check className="w-8 h-8" style={{ color: tokens.confidence.high.value }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: tokens.text.primary }}>
            Scoring Model Saved
          </h2>
          <p className="text-sm mb-6" style={{ color: tokens.text.secondary }}>
            Your scoring model with {activeDimensions.length} dimensions has been saved and will be
            applied to all accounts.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setComplete(false);
              setStep(1);
            }}
          >
            Configure Another Model
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
          Scoring Setup Wizard
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          Configure your account scoring model step by step
        </p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex-1">
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: tokens.neutral['100'] }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: s <= step ? '100%' : '0%',
                  backgroundColor: s <= step ? tokens.accent.primary : tokens.neutral['100'],
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px]" style={{ color: tokens.text.muted }}>
        {([1, 2, 3, 4] as WizardStep[]).map((s) => (
          <span
            key={s}
            style={{ color: s <= step ? tokens.text.primary : tokens.text.muted }}
            className={s === step ? 'font-semibold' : ''}
          >
            {stepConfig[s].title}
          </span>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-md"
              style={{
                backgroundColor: `${tokens.accent.primary}12`,
                color: tokens.accent.primary,
              }}
            >
              {stepConfig[step].icon}
            </div>
            <div>
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                {stepConfig[step].title}
              </CardTitle>
              <CardDescription>{stepConfig[step].description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Step 1: Select Dimensions */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allDimensions.map((dim) => {
                const selected = selectedIds.has(dim.id);
                return (
                  <label
                    key={dim.id}
                    className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all ${selected ? 'ring-2' : ''}`}
                    style={
                      {
                        border: `1px solid ${selected ? tokens.accent.primary : tokens.borderFaint}`,
                        backgroundColor: selected ? tokens.accent.ghost : 'transparent',
                        '--tw-ring-color': selected ? tokens.accent.primary : undefined,
                      } as React.CSSProperties
                    }
                  >
                    <Checkbox checked={selected} onCheckedChange={() => toggleDimension(dim.id)} />
                    <div
                      className="p-2 rounded-md"
                      style={{
                        backgroundColor: `${tokens.accent.primary}12`,
                        color: tokens.accent.primary,
                      }}
                    >
                      {dim.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                        {dim.name}
                      </p>
                      <p className="text-xs" style={{ color: tokens.text.muted }}>
                        {dim.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Step 2: Set Weights */}
          {step === 2 && (
            <div className="space-y-6">
              {activeDimensions.map((dim) => (
                <div key={dim.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-1.5 rounded-md"
                        style={{
                          backgroundColor: `${tokens.accent.primary}12`,
                          color: tokens.accent.primary,
                        }}
                      >
                        {dim.icon}
                      </div>
                      <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                        {dim.name}
                      </span>
                    </div>
                    <span className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                      {weights[dim.id] || 0}%
                    </span>
                  </div>
                  <Slider
                    value={[weights[dim.id] || 0]}
                    onValueChange={(v) => updateWeight(dim.id, v[0])}
                    min={0}
                    max={50}
                    step={1}
                  />
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                  Total Weight
                </span>
                <span
                  className="text-lg font-bold"
                  style={{
                    color:
                      totalWeight === 100
                        ? tokens.confidence.high.value
                        : tokens.confidence.medium.value,
                  }}
                >
                  {totalWeight}%
                </span>
              </div>
              {totalWeight !== 100 && (
                <p className="text-xs" style={{ color: tokens.confidence.medium.value }}>
                  Weights must total exactly 100% to proceed.
                </p>
              )}
            </div>
          )}

          {/* Step 3: Configure Thresholds */}
          {step === 3 && (
            <div className="space-y-8 max-w-lg">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                      Hot Threshold
                    </p>
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      Accounts scoring above this are prioritized
                    </p>
                  </div>
                  <span
                    className="text-lg font-bold"
                    style={{ color: tokens.confidence.high.value }}
                  >
                    {thresholds.hot}
                  </span>
                </div>
                <Slider
                  value={[thresholds.hot]}
                  onValueChange={(v) => setThresholds((p) => ({ ...p, hot: v[0] }))}
                  min={thresholds.warm + 10}
                  max={95}
                  step={5}
                />
                <div
                  className="flex justify-between text-[10px] mt-1"
                  style={{ color: tokens.text.muted }}
                >
                  <span>{thresholds.warm + 10}</span>
                  <span>95</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                      Warm Threshold
                    </p>
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      Accounts scoring above this show potential
                    </p>
                  </div>
                  <span
                    className="text-lg font-bold"
                    style={{ color: tokens.confidence.medium.value }}
                  >
                    {thresholds.warm}
                  </span>
                </div>
                <Slider
                  value={[thresholds.warm]}
                  onValueChange={(v) => setThresholds((p) => ({ ...p, warm: v[0] }))}
                  min={5}
                  max={thresholds.hot - 10}
                  step={5}
                />
                <div
                  className="flex justify-between text-[10px] mt-1"
                  style={{ color: tokens.text.muted }}
                >
                  <span>5</span>
                  <span>{thresholds.hot - 10}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <div
                  className="flex-1 p-3 rounded-lg text-center"
                  style={{
                    backgroundColor: `${tokens.confidence.high.value}15`,
                    border: `1px solid ${tokens.confidence.high.border}`,
                  }}
                >
                  <p
                    className="text-xs font-medium"
                    style={{ color: tokens.confidence.high.value }}
                  >
                    Hot
                  </p>
                  <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                    {thresholds.hot}–100
                  </p>
                </div>
                <div
                  className="flex-1 p-3 rounded-lg text-center"
                  style={{
                    backgroundColor: `${tokens.confidence.medium.value}15`,
                    border: `1px solid ${tokens.confidence.medium.border}`,
                  }}
                >
                  <p
                    className="text-xs font-medium"
                    style={{ color: tokens.confidence.medium.value }}
                  >
                    Warm
                  </p>
                  <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                    {thresholds.warm}–{thresholds.hot - 1}
                  </p>
                </div>
                <div
                  className="flex-1 p-3 rounded-lg text-center"
                  style={{
                    backgroundColor: `${tokens.confidence.low.value}15`,
                    border: `1px solid ${tokens.confidence.low.border}`,
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: tokens.confidence.low.value }}>
                    Cold
                  </p>
                  <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                    0–{thresholds.warm - 1}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Save */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3" style={{ color: tokens.text.primary }}>
                  Selected Dimensions & Weights
                </h4>
                <div className="space-y-2">
                  {activeDimensions.map((dim) => (
                    <div
                      key={dim.id}
                      className="flex items-center justify-between p-2.5 rounded-lg"
                      style={{ border: `1px solid ${tokens.borderFaint}` }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="p-1.5 rounded-md"
                          style={{
                            backgroundColor: `${tokens.accent.primary}12`,
                            color: tokens.accent.primary,
                          }}
                        >
                          {dim.icon}
                        </div>
                        <span className="text-sm" style={{ color: tokens.text.primary }}>
                          {dim.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: tokens.text.primary }}>
                        {weights[dim.id]}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-3" style={{ color: tokens.text.primary }}>
                  Score Thresholds
                </h4>
                <div className="flex gap-2">
                  <div
                    className="flex-1 p-3 rounded-lg text-center"
                    style={{ backgroundColor: `${tokens.confidence.high.value}15` }}
                  >
                    <p className="text-xs" style={{ color: tokens.confidence.high.value }}>
                      Hot: {thresholds.hot}+
                    </p>
                  </div>
                  <div
                    className="flex-1 p-3 rounded-lg text-center"
                    style={{ backgroundColor: `${tokens.confidence.medium.value}15` }}
                  >
                    <p className="text-xs" style={{ color: tokens.confidence.medium.value }}>
                      Warm: {thresholds.warm}–{thresholds.hot - 1}
                    </p>
                  </div>
                  <div
                    className="flex-1 p-3 rounded-lg text-center"
                    style={{ backgroundColor: `${tokens.confidence.low.value}15` }}
                  >
                    <p className="text-xs" style={{ color: tokens.confidence.low.value }}>
                      Cold: 0–{thresholds.warm - 1}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-3" style={{ color: tokens.text.primary }}>
                  Score Distribution Preview
                </h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={distribution}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={tokens.border.default}
                        opacity={0.5}
                      />
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke={tokens.text.muted} />
                      <YAxis tick={{ fontSize: 11 }} stroke={tokens.text.muted} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: tokens.surface.card,
                          border: `1px solid ${tokens.border.default}`,
                          borderRadius: '8px',
                          fontSize: '13px',
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {distribution.map((_, i) => (
                          <Cell key={i} fill={barColors[i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={step === 1}
          onClick={() => setStep((s) => (s - 1) as WizardStep)}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Button>
        <span className="text-xs" style={{ color: tokens.text.muted }}>
          Step {step} of 4
        </span>
        {step < 4 ? (
          <Button
            size="sm"
            className="gap-2"
            style={{
              backgroundColor: canNext ? tokens.accent.primary : tokens.text.muted,
              color: canNext ? '#fff' : '#fff',
              opacity: canNext ? 1 : 0.5,
            }}
            disabled={!canNext}
            onClick={() => setStep((s) => (s + 1) as WizardStep)}
          >
            Next <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="gap-2"
            style={{ backgroundColor: tokens.confidence.high.value, color: '#fff' }}
            onClick={handleSave}
          >
            <Save className="w-3.5 h-3.5" /> Save Model
          </Button>
        )}
      </div>
    </div>
  );
}
