'use client';

import { useState, useMemo } from 'react';
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

// ── Types ──

type DateRange = '7d' | '30d' | '90d';

// ── Mock data generators ──

function generateSignalsOverTime(days: number) {
  const data = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const base = 40 + Math.sin(i * 0.3) * 20;
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      signals: Math.round(base + Math.random() * 30),
      processed: Math.round(base * 0.8 + Math.random() * 20),
      insights: Math.round(base * 0.3 + Math.random() * 10),
    });
  }
  return data;
}

const SIGNALS_BY_TYPE = [
  { type: 'Hiring', count: 342 },
  { type: 'Funding', count: 218 },
  { type: 'Product', count: 189 },
  { type: 'M&A', count: 67 },
  { type: 'Tech', count: 294 },
  { type: 'Financial', count: 156 },
  { type: 'Legal', count: 89 },
  { type: 'Social', count: 412 },
];

const INTELLIGENCE_SCORES = [
  { range: '0-10', count: 12 },
  { range: '11-20', count: 28 },
  { range: '21-30', count: 45 },
  { range: '31-40', count: 78 },
  { range: '41-50', count: 112 },
  { range: '51-60', count: 95 },
  { range: '61-70', count: 67 },
  { range: '71-80', count: 38 },
  { range: '81-90', count: 18 },
  { range: '91-100', count: 7 },
];

const TOP_INDUSTRIES = [
  { industry: 'Technology', score: 94 },
  { industry: 'Finance', score: 87 },
  { industry: 'Healthcare', score: 82 },
  { industry: 'Manufacturing', score: 76 },
  { industry: 'Retail', score: 71 },
  { industry: 'Energy', score: 65 },
  { industry: 'Aerospace', score: 58 },
  { industry: 'Media', score: 52 },
];

// ── Component ──

export default function Analytics() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [loading] = useState(false);

  const signalsTimeData = useMemo(() => {
    const daysMap: Record<DateRange, number> = { '7d': 7, '30d': 30, '90d': 90 };
    return generateSignalsOverTime(daysMap[dateRange]);
  }, [dateRange]);

  const stats = useMemo(() => {
    const total = signalsTimeData.reduce((s, d) => s + d.signals, 0);
    return {
      totalDataPoints: total.toLocaleString(),
      coverageScore: '94.2%',
      insightsGenerated: signalsTimeData.reduce((s, d) => s + d.insights, 0).toLocaleString(),
      avgProcessingTime: '1.2s',
    };
  }, [signalsTimeData]);

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

  if (loading) {
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
            <BarChart data={SIGNALS_BY_TYPE} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
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
            <BarChart
              data={INTELLIGENCE_SCORES}
              margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
            >
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
              data={TOP_INDUSTRIES}
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
