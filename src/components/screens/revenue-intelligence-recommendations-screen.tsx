'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/screen-states';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  Target,
  Shield,
  ArrowUpRight,
  XCircle,
  CheckCircle2,
  Filter,
  Zap,
  BarChart3,
  Users,
  RefreshCw,
  Clock,
} from 'lucide-react';

// ── Mock Data ──
type RecType = 'expand' | 'cross-sell' | 'upsell' | 'retain';

type RecCard = {
  id: string;
  title: string;
  type: RecType;
  account: string;
  impact: number;
  probability: number;
  timeline: string;
  evidenceCount: number;
  status: 'active' | 'dismissed';
};

// Card data now fetched from /api/recommendations

// ── Helpers ──
const typeConfig: Record<
  RecType,
  { bg: string; text: string; label: string; icon: React.ReactNode }
> = {
  expand: {
    bg: tokens.accent.ghost,
    text: tokens.accent.primary,
    label: 'Expand',
    icon: <ArrowUpRight className="w-4 h-4" />,
  },
  'cross-sell': {
    bg: tokens.confidence.high.bg,
    text: tokens.confidence.high.value,
    label: 'Cross-Sell',
    icon: <BarChart3 className="w-4 h-4" />,
  },
  upsell: {
    bg: tokens.gold.bgMedium,
    text: tokens.gold.dark,
    label: 'Upsell',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  retain: {
    bg: tokens.confidence.medium.bg,
    text: tokens.confidence.medium.value,
    label: 'Retain',
    icon: <Shield className="w-4 h-4" />,
  },
};

function fmt(val: number) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

// ── Component ──
export default function RevenueIntelligenceRecommendationsScreen() {
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<RecCard[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchRecs = useCallback(async () => {
    const { data, error } = await fetchApi<RecCard[]>('/api/recommendations');
    if (error) toast.error('Failed to load recommendations', { description: error });
    else if (data) setRecs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return recs;
    return recs.filter((r) => r.type === typeFilter);
  }, [recs, typeFilter]);

  const stats = useMemo(() => {
    const active = recs.filter((r) => r.status === 'active');
    const totalValue = active.reduce((s, r) => s + r.impact, 0);
    const expansion = active.filter((r) => r.type === 'expand').reduce((s, r) => s + r.impact, 0);
    const retention = active.filter((r) => r.type === 'retain').reduce((s, r) => s + r.impact, 0);
    const newRev = active
      .filter((r) => r.type === 'cross-sell' || r.type === 'upsell')
      .reduce((s, r) => s + r.impact, 0);
    return { totalValue, expansion, retention, newRev };
  }, [recs]);

  const handleDismiss = async (id: string) => {
    const { error } = await fetchApi(`/api/recommendations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' }),
    });
    if (error) toast.error('Failed to dismiss', { description: error });
    else
      setRecs((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'dismissed' as const } : r)),
      );
  };

  const handleAdopt = (id: string) => {
    setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'dismissed' as const } : r)));
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
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
            Revenue Recommendations
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            AI-identified revenue actions ranked by potential impact
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          style={{ color: tokens.accent.primary, borderColor: tokens.accent.primary }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Analysis
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Value',
            value: fmt(stats.totalValue),
            icon: DollarSign,
            color: tokens.confidence.high.value,
          },
          {
            label: 'Expansion',
            value: fmt(stats.expansion),
            icon: ArrowUpRight,
            color: tokens.accent.primary,
          },
          {
            label: 'Retention',
            value: fmt(stats.retention),
            icon: Shield,
            color: tokens.confidence.medium.value,
          },
          { label: 'New Revenue', value: fmt(stats.newRev), icon: Zap, color: tokens.gold.dark },
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4" style={{ color: tokens.text.muted }} />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="expand">Expand</SelectItem>
            <SelectItem value="cross-sell">Cross-Sell</SelectItem>
            <SelectItem value="upsell">Upsell</SelectItem>
            <SelectItem value="retain">Retain</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs ml-auto" style={{ color: tokens.text.muted }}>
          {filtered.filter((r) => r.status === 'active').length} active recommendations
        </span>
      </div>

      {/* Cards Grid */}
      {filtered.filter((r) => r.status === 'active').length === 0 ? (
        <EmptyState
          icon="lightbulb"
          title="No recommendations match your filters"
          description="Try adjusting the type filter"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered
            .filter((r) => r.status === 'active')
            .map((rec) => {
              const tc = typeConfig[rec.type];
              return (
                <Card key={rec.id} className="overflow-hidden">
                  <CardContent className="p-5">
                    {/* Type Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: tc.bg, color: tc.text }}
                      >
                        {tc.icon} {tc.label}
                      </span>
                      <span
                        className="text-xs flex items-center gap-1"
                        style={{ color: tokens.text.muted }}
                      >
                        <Clock className="w-3 h-3" /> {rec.timeline}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className="text-sm font-semibold mb-2"
                      style={{ color: tokens.text.primary }}
                    >
                      {rec.title}
                    </h3>

                    {/* Account */}
                    <p className="text-xs mb-4" style={{ color: tokens.text.secondary }}>
                      {rec.account}
                    </p>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div
                        className="text-center p-2 rounded-md"
                        style={{ backgroundColor: tokens.surfaceExtended }}
                      >
                        <p className="text-sm font-bold" style={{ color: tokens.text.primary }}>
                          {fmt(rec.impact)}
                        </p>
                        <p className="text-[10px]" style={{ color: tokens.text.muted }}>
                          Impact
                        </p>
                      </div>
                      <div
                        className="text-center p-2 rounded-md"
                        style={{ backgroundColor: tokens.surfaceExtended }}
                      >
                        <p
                          className="text-sm font-bold"
                          style={{
                            color:
                              rec.probability >= 70
                                ? tokens.confidence.high.value
                                : tokens.confidence.medium.value,
                          }}
                        >
                          {rec.probability}%
                        </p>
                        <p className="text-[10px]" style={{ color: tokens.text.muted }}>
                          Probability
                        </p>
                      </div>
                      <div
                        className="text-center p-2 rounded-md"
                        style={{ backgroundColor: tokens.surfaceExtended }}
                      >
                        <p className="text-sm font-bold" style={{ color: tokens.text.primary }}>
                          {rec.evidenceCount}
                        </p>
                        <p className="text-[10px]" style={{ color: tokens.text.muted }}>
                          Evidence
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 gap-1.5"
                        style={{ backgroundColor: tokens.confidence.high.value, color: '#fff' }}
                        onClick={() => handleAdopt(rec.id)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Adopt
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 gap-1.5"
                        onClick={() => handleDismiss(rec.id)}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Dismiss
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
