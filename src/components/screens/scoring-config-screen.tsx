'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Sliders,
  Save,
  RotateCcw,
  BarChart3,
  Calendar,
  Users,
  Target,
  Layers,
  Zap,
  Building2,
  DollarSign,
  TrendingUp,
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

// ── Mock Data ──
type Dimension = {
  id: string;
  name: string;
  description: string;
  weight: number;
  icon: React.ReactNode;
};

const defaultDimensions: Dimension[] = [
  {
    id: 'industry',
    name: 'Industry Fit',
    description: 'How well the account matches target industries',
    weight: 20,
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    id: 'size',
    name: 'Company Size',
    description: 'Revenue and employee count alignment with ICP',
    weight: 15,
    icon: <Users className="w-4 h-4" />,
  },
  {
    id: 'tech',
    name: 'Technology Match',
    description: 'Technology stack compatibility and integration potential',
    weight: 20,
    icon: <Layers className="w-4 h-4" />,
  },
  {
    id: 'signal',
    name: 'Signal Strength',
    description: 'Volume and quality of detected intelligence signals',
    weight: 25,
    icon: <Zap className="w-4 h-4" />,
  },
  {
    id: 'engagement',
    name: 'Engagement Level',
    description: 'Interaction frequency and depth across touchpoints',
    weight: 10,
    icon: <Target className="w-4 h-4" />,
  },
  {
    id: 'revenue',
    name: 'Revenue Potential',
    description: 'Estimated deal size and expansion opportunity',
    weight: 10,
    icon: <DollarSign className="w-4 h-4" />,
  },
];

// Mock score distribution preview
const generateDistribution = (dims: Dimension[]) => {
  const labels = ['0-20', '21-40', '41-60', '61-80', '81-100'];
  // Generate slightly different distribution based on weights
  const signalWeight = dims.find((d) => d.id === 'signal')?.weight || 25;
  const techWeight = dims.find((d) => d.id === 'tech')?.weight || 20;
  return labels.map((label, i) => ({
    range: label,
    count: Math.round(
      (i === 0 ? 15 : i === 1 ? 45 : i === 2 ? 120 : i === 3 ? 200 : 180) +
        (signalWeight - 25) * (4 - i) * 2 +
        (techWeight - 20) * (3 - i) * 1.5,
    ),
  }));
};

const barColors = [
  tokens.confidence.low.value,
  tokens.confidence.low.value,
  tokens.confidence.medium.value,
  tokens.confidence.high.value,
  tokens.confidence.high.value,
];

// ── Component ──
export default function ScoringConfigScreen() {
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState(defaultDimensions);
  const [saved, setSaved] = useState(false);

  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const totalWeight = useMemo(() => dimensions.reduce((s, d) => s + d.weight, 0), [dimensions]);
  const distribution = useMemo(() => generateDistribution(dimensions), [dimensions]);

  const handleWeightChange = useCallback((id: string, newWeight: number) => {
    setDimensions((prev) => prev.map((d) => (d.id === id ? { ...d, weight: newWeight } : d)));
    setSaved(false);
  }, []);

  const handleReset = useCallback(() => {
    setDimensions(defaultDimensions);
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Scoring Configuration
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Configure and tune the account scoring model dimensions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button
            size="sm"
            className="gap-2"
            style={{
              backgroundColor: saved ? tokens.confidence.high.value : tokens.accent.primary,
              color: '#fff',
            }}
            onClick={handleSave}
          >
            <Save className="w-3.5 h-3.5" /> {saved ? 'Saved ✓' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Total Dimensions',
            value: `${dimensions.length}`,
            icon: Sliders,
            color: tokens.accent.primary,
          },
          {
            label: 'Last Recalibrated',
            value: 'Jan 15, 2025',
            icon: Calendar,
            color: tokens.domain.reasoning,
          },
          {
            label: 'Accounts Scored',
            value: '560',
            icon: BarChart3,
            color: tokens.confidence.high.value,
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="py-4 gap-2">
              <CardContent className="p-4 pb-0">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                  <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>
                    {s.label}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                  {s.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Weight Warning */}
      {totalWeight !== 100 && (
        <div
          className="p-3 rounded-lg flex items-center gap-2"
          style={{
            backgroundColor: `${tokens.confidence.medium.value}12`,
            border: `1px solid ${tokens.confidence.medium.border}`,
          }}
        >
          <span className="text-sm font-medium" style={{ color: tokens.confidence.medium.value }}>
            ⚠
          </span>
          <span className="text-sm" style={{ color: tokens.confidence.medium.value }}>
            Total weight is {totalWeight}% — should equal 100% for accurate scoring.
          </span>
        </div>
      )}

      {/* Dimensions + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Dimensions Sliders */}
        <div className="lg:col-span-3 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                Scoring Dimensions
              </CardTitle>
              <CardDescription>
                Adjust the weight of each dimension in the scoring model
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {dimensions.map((dim) => (
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
                      <div>
                        <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                          {dim.name}
                        </p>
                        <p className="text-[11px]" style={{ color: tokens.text.muted }}>
                          {dim.description}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-lg font-bold min-w-[48px] text-right"
                      style={{ color: tokens.text.primary }}
                    >
                      {dim.weight}%
                    </span>
                  </div>
                  <Slider
                    value={[dim.weight]}
                    onValueChange={(v) => handleWeightChange(dim.id, v[0])}
                    min={0}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                  Total Weight
                </span>
                <span
                  className={`text-lg font-bold ${totalWeight === 100 ? '' : ''}`}
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
            </CardContent>
          </Card>
        </div>

        {/* Score Distribution Preview */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                Score Distribution Preview
              </CardTitle>
              <CardDescription>
                How account scores would change with current weights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
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
              <div
                className="mt-4 flex items-center justify-center gap-4 text-[11px]"
                style={{ color: tokens.text.muted }}
              >
                <span className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: tokens.confidence.low.value }}
                  />{' '}
                  Cold (0-40)
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: tokens.confidence.medium.value }}
                  />{' '}
                  Warm (41-60)
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: tokens.confidence.high.value }}
                  />{' '}
                  Hot (61-100)
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
