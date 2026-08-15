'use client';

import { useState, useMemo, useEffect } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Database, Target, Lightbulb, Zap } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';

// ── Types ──

type DateRange = '7d' | '30d' | '90d';

interface StatsOverview {
  totalDataPoints?: number;
  coverageScore?: string;
  insightsGenerated?: number;
  avgProcessingTime?: string;
  signalsOverTime?: { date: string; signals: number; processed: number; insights: number }[];
  signalsByType?: { type: string; count: number }[];
  intelligenceScores?: { range: string; count: number }[];
  topIndustries?: { industry: string; score: number }[];
}

// ── Component ──

export default function Analytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [overview, setOverview] = useState<StatsOverview | null>(null);

  useEffect(() => {
    async function loadOverview() {
      setIsLoading(true);
      const { data, error } = await fetchApi<StatsOverview>('/api/stats/overview');
      if (error) {
        toast.error('Failed to load analytics', { description: error });
      } else if (data) {
        setOverview(data);
      }
      setIsLoading(false);
    }
    loadOverview();
  }, []);

  const signalsTimeData = overview?.signalsOverTime ?? [];
  const signalsByType = overview?.signalsByType ?? [];
  const intelligenceScores = overview?.intelligenceScores ?? [];
  const topIndustries = overview?.topIndustries ?? [];

  const stats = useMemo(() => {
    if (overview) {
      return {
        totalDataPoints: (overview.totalDataPoints ?? 0).toLocaleString(),
        coverageScore: overview.coverageScore ?? '—',
        insightsGenerated: (overview.insightsGenerated ?? 0).toLocaleString(),
        avgProcessingTime: overview.avgProcessingTime ?? '—',
      };
    }
    const total = signalsTimeData.reduce((s, d) => s + d.signals, 0);
    return {
      totalDataPoints: total.toLocaleString(),
      coverageScore: '—',
      insightsGenerated: signalsTimeData.reduce((s, d) => s + d.insights, 0).toLocaleString(),
      avgProcessingTime: '—',
    };
  }, [overview, signalsTimeData]);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;
  const chartGrid = '#1e293b';
  const chartTick = tokens.text.muted;

  const RANGES: { key: DateRange; label: string }[] = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
  ];

  const CustomTooltipStyle: React.CSSProperties = {
    background: '#1e293b',
    border: `1px solid ${border}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: textPrimary,
  };

  if (isLoading) {
    return (
      <div
        className="p-6 space-y-6"
        style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: border }} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 rounded-xl animate-pulse" style={{ background: border }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-6 space-y-6"
      style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
            Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Intelligence signal trends and performance metrics
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 p-1 rounded-lg"
          style={{ background: tokens.surface.secondary, border: `1px solid ${border}` }}
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setDateRange(r.key)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: dateRange === r.key ? tokens.accent.primary : 'transparent',
                color: dateRange === r.key ? tokens.flat.white : textSecondary,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Data Points',
            value: stats.totalDataPoints,
            icon: Database,
            color: tokens.accent.primary,
          },
          { label: 'Coverage Score', value: stats.coverageScore, icon: Target, color: '#059669' },
          {
            label: 'Insights Generated',
            value: stats.insightsGenerated,
            icon: Lightbulb,
            color: '#D97706',
          },
          {
            label: 'Avg Processing Time',
            value: stats.avgProcessingTime,
            icon: Zap,
            color: '#7C3AED',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${stat.color}15` }}
              >
                <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs truncate" style={{ color: textMuted }}>
                  {stat.label}
                </p>
                <p className="text-lg font-bold" style={{ color: textPrimary }}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 1: Signals Over Time */}
        <div
          className="rounded-xl p-5"
          style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
            Signals Over Time
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={signalsTimeData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="gradSignals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={tokens.accent.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={tokens.accent.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradProcessed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis
                dataKey="date"
                tick={{ fill: chartTick, fontSize: 11 }}
                axisLine={{ stroke: chartGrid }}
                tickLine={false}
                interval={dateRange === '90d' ? 14 : dateRange === '30d' ? 4 : 0}
              />
              <YAxis tick={{ fill: chartTick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip contentStyle={CustomTooltipStyle} />
              <Area
                type="monotone"
                dataKey="signals"
                stroke={tokens.accent.primary}
                fill="url(#gradSignals)"
                strokeWidth={2}
                name="Detected"
              />
              <Area
                type="monotone"
                dataKey="processed"
                stroke="#059669"
                fill="url(#gradProcessed)"
                strokeWidth={2}
                name="Processed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Panel 2: Signals by Type */}
        <div
          className="rounded-xl p-5"
          style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
            Signals by Type
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={signalsByType} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis
                dataKey="type"
                tick={{ fill: chartTick, fontSize: 11 }}
                axisLine={{ stroke: chartGrid }}
                tickLine={false}
              />
              <YAxis tick={{ fill: chartTick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip contentStyle={CustomTooltipStyle} />
              <Bar
                dataKey="count"
                fill={tokens.accent.primary}
                radius={[4, 4, 0, 0]}
                name="Signals"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Panel 3: Intelligence Score Distribution */}
        <div
          className="rounded-xl p-5"
          style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
            Intelligence Score Distribution
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={intelligenceScores} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis
                dataKey="range"
                tick={{ fill: chartTick, fontSize: 11 }}
                axisLine={{ stroke: chartGrid }}
                tickLine={false}
              />
              <YAxis tick={{ fill: chartTick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip contentStyle={CustomTooltipStyle} />
              <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} name="Companies" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Panel 4: Top Industries (horizontal) */}
        <div
          className="rounded-xl p-5"
          style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
            Top Industries by Intelligence Score
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={topIndustries}
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 5, left: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: chartTick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="industry"
                tick={{ fill: chartTick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={85}
              />
              <RechartsTooltip contentStyle={CustomTooltipStyle} />
              <Bar dataKey="score" fill="#059669" radius={[0, 4, 4, 0]} name="Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
