'use client';

import { useState, useMemo, useEffect } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { DataTable, type Column } from '@/components/enterprise/DataTable';
import { DollarSign, TrendingUp, Target, Percent } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

// ── Types ──
interface TopPerformer {
  id: string;
  name: string;
  deals: number;
  revenue: string;
  winRate: number;
}

// ── Mock Data ──
const REVENUE_TREND = [
  { month: 'Aug', revenue: 285000, target: 300000 },
  { month: 'Sep', revenue: 312000, target: 310000 },
  { month: 'Oct', revenue: 298000, target: 320000 },
  { month: 'Nov', revenue: 345000, target: 330000 },
  { month: 'Dec', revenue: 378000, target: 340000 },
  { month: 'Jan', revenue: 412000, target: 350000 },
];

const DEAL_STAGE_CONVERSION = [
  { stage: 'Lead', count: 1000 },
  { stage: 'Qualified', count: 620 },
  { stage: 'Proposal', count: 380 },
  { stage: 'Negotiation', count: 210 },
  { stage: 'Closed Won', count: 124 },
];

const REP_PERFORMANCE = [
  { name: 'Sarah Chen', amount: 142000 },
  { name: 'James Wilson', amount: 128000 },
  { name: 'Maria Garcia', amount: 115000 },
  { name: 'David Kim', amount: 98400 },
  { name: 'Emily Zhang', amount: 91200 },
  { name: 'Michael Brown', amount: 78600 },
];

const TOP_PERFORMERS: TopPerformer[] = [
  { id: 'tp1', name: 'Sarah Chen', deals: 18, revenue: '$142,000', winRate: 42 },
  { id: 'tp2', name: 'James Wilson', deals: 15, revenue: '$128,000', winRate: 38 },
  { id: 'tp3', name: 'Maria Garcia', deals: 14, revenue: '$115,000', winRate: 35 },
  { id: 'tp4', name: 'David Kim', deals: 12, revenue: '$98,400', winRate: 31 },
  { id: 'tp5', name: 'Emily Zhang', deals: 11, revenue: '$91,200', winRate: 29 },
];

// ── Component ──
export default function RevOps() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  const stats = useMemo(() => {
    const mrr = '$412K';
    const arr = '$4.94M';
    const pipelineCoverage = '3.2x';
    const winRate = '31.2%';
    return { mrr, arr, pipelineCoverage, winRate };
  }, []);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;
  const chartGrid = '#1e293b';
  const chartTick = tokens.text.muted;

  const CustomTooltipStyle: React.CSSProperties = {
    background: '#1e293b',
    border: `1px solid ${border}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: textPrimary,
  };

  const perfColumns: Column[] = useMemo(
    () => [
      { key: 'name', label: 'Rep', sortable: true },
      { key: 'deals', label: 'Deals', sortable: true },
      { key: 'revenue', label: 'Revenue', sortable: true },
      {
        key: 'winRate',
        label: 'Win Rate',
        sortable: true,
        render: (value: unknown) => {
          const rate = value as number;
          const color = rate >= 35 ? '#16A34A' : rate >= 30 ? '#D97706' : '#DC2626';
          return (
            <div className="flex items-center gap-2">
              <div
                className="w-16 h-1.5 rounded-full overflow-hidden"
                style={{ background: tokens.border.default }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${rate}%`, background: color }}
                />
              </div>
              <span className="text-xs font-medium" style={{ color }}>
                {rate}%
              </span>
            </div>
          );
        },
      },
    ],
    [],
  );

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
          {Array.from({ length: 3 }).map((_, i) => (
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
      <div>
        <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
          Revenue Operations
        </h1>
        <p className="text-sm mt-1" style={{ color: textSecondary }}>
          Pipeline metrics, revenue trends, and rep performance
        </p>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'MRR', value: stats.mrr, icon: DollarSign, color: '#16A34A' },
          { label: 'ARR', value: stats.arr, icon: TrendingUp, color: tokens.accent.primary },
          {
            label: 'Pipeline Coverage',
            value: stats.pipelineCoverage,
            icon: Target,
            color: '#7C3AED',
          },
          { label: 'Win Rate', value: stats.winRate, icon: Percent, color: '#D97706' },
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

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Trend Line Chart */}
        <div
          className="rounded-xl p-5"
          style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
            Revenue Trend
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={REVENUE_TREND} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis
                dataKey="month"
                tick={{ fill: chartTick, fontSize: 11 }}
                axisLine={{ stroke: chartGrid }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: chartTick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
              />
              <RechartsTooltip
                contentStyle={CustomTooltipStyle}
                formatter={(v: number) => [`$${(v / 1000).toFixed(0)}K`, undefined]}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={tokens.accent.primary}
                strokeWidth={2}
                dot={{ fill: tokens.accent.primary, r: 4 }}
                name="Revenue"
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#6B7280"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="Target"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Deal Stage Conversion Funnel Bar Chart */}
        <div
          className="rounded-xl p-5"
          style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
            Deal Stage Conversion
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={DEAL_STAGE_CONVERSION}
              margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis
                dataKey="stage"
                tick={{ fill: chartTick, fontSize: 11 }}
                axisLine={{ stroke: chartGrid }}
                tickLine={false}
              />
              <YAxis tick={{ fill: chartTick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip contentStyle={CustomTooltipStyle} />
              <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} name="Deals" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts Row 2: Rep Performance + Top Performers Table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rep Performance Horizontal Bar Chart */}
        <div
          className="rounded-xl p-5"
          style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
            Rep Performance
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={REP_PERFORMANCE}
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 5, left: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: chartTick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: chartTick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <RechartsTooltip
                contentStyle={CustomTooltipStyle}
                formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="amount" fill="#059669" radius={[0, 4, 4, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Performers Table */}
        <DataTable
          columns={perfColumns}
          data={TOP_PERFORMERS as unknown as Record<string, unknown>[]}
          title="Top Performers"
          emptyMessage="No performance data"
        />
      </div>
    </div>
  );
}
