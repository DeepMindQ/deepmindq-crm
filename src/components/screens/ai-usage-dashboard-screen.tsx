'use client';

import { useState, useMemo, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { Coins, Phone, Clock, DollarSign, BarChart3, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DataTable, type Column } from '@/components/enterprise/DataTable';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

// ── Types ──
interface ApiCallRecord {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  tokens: number;
  latency: number;
  status: 'success' | 'error' | 'timeout';
}

// ── Mock Data ──
const MOCK_USAGE_OVER_TIME = [
  { date: 'Jan 9', calls: 342, tokens: 125000, cost: 6.25 },
  { date: 'Jan 10', calls: 398, tokens: 148000, cost: 7.4 },
  { date: 'Jan 11', calls: 367, tokens: 132000, cost: 6.6 },
  { date: 'Jan 12', calls: 478, tokens: 189000, cost: 9.45 },
  { date: 'Jan 13', calls: 421, tokens: 167000, cost: 8.35 },
  { date: 'Jan 14', calls: 234, tokens: 78000, cost: 3.9 },
  { date: 'Jan 15', calls: 189, tokens: 54000, cost: 2.7 },
  { date: 'Jan 16', calls: 412, tokens: 156000, cost: 7.8 },
  { date: 'Jan 17', calls: 467, tokens: 178000, cost: 8.9 },
  { date: 'Jan 18', calls: 389, tokens: 145000, cost: 7.25 },
  { date: 'Jan 19', calls: 298, tokens: 112000, cost: 5.6 },
  { date: 'Jan 20', calls: 156, tokens: 48000, cost: 2.4 },
  { date: 'Jan 21', calls: 445, tokens: 172000, cost: 8.6 },
  { date: 'Jan 22', calls: 501, tokens: 195000, cost: 9.75 },
];

const MOCK_TOKENS_BY_PROVIDER = [
  { provider: 'NVIDIA', tokens: 1245000 },
  { provider: 'Fireworks', tokens: 892000 },
  { provider: 'Groq', tokens: 567000 },
  { provider: 'Gemini', tokens: 2100000 },
];

const MOCK_COST_BY_MODEL = [
  { model: 'Gemini 1.5 Pro', cost: 124.5 },
  { model: 'Gemini 1.5 Flash', cost: 42.3 },
  { model: 'Llama 3.1 70B', cost: 98.7 },
  { model: 'Mixtral 8x22B', cost: 56.2 },
  { model: 'Qwen 2.5 72B', cost: 38.9 },
  { model: 'Llama 3.1 8B', cost: 12.4 },
  { model: 'Mixtral 8x7B', cost: 8.6 },
];

const MOCK_RECENT_CALLS: ApiCallRecord[] = [
  {
    id: 'call-001',
    timestamp: '2025-01-22T14:32:00Z',
    provider: 'Gemini',
    model: 'gemini-1.5-pro',
    tokens: 2340,
    latency: 312,
    status: 'success',
  },
  {
    id: 'call-002',
    timestamp: '2025-01-22T14:31:00Z',
    provider: 'NVIDIA',
    model: 'llama-3.1-70b',
    tokens: 4521,
    latency: 245,
    status: 'success',
  },
  {
    id: 'call-003',
    timestamp: '2025-01-22T14:30:00Z',
    provider: 'Groq',
    model: 'llama-3.1-70b',
    tokens: 1890,
    latency: 520,
    status: 'timeout',
  },
  {
    id: 'call-004',
    timestamp: '2025-01-22T14:29:00Z',
    provider: 'Fireworks',
    model: 'qwen-2.5-72b',
    tokens: 3102,
    latency: 189,
    status: 'success',
  },
  {
    id: 'call-005',
    timestamp: '2025-01-22T14:28:00Z',
    provider: 'Gemini',
    model: 'gemini-1.5-flash',
    tokens: 890,
    latency: 145,
    status: 'success',
  },
  {
    id: 'call-006',
    timestamp: '2025-01-22T14:27:00Z',
    provider: 'NVIDIA',
    model: 'mixtral-8x22b',
    tokens: 5670,
    latency: 380,
    status: 'error',
  },
  {
    id: 'call-007',
    timestamp: '2025-01-22T14:26:00Z',
    provider: 'Fireworks',
    model: 'llama-3.1-8b',
    tokens: 445,
    latency: 78,
    status: 'success',
  },
  {
    id: 'call-008',
    timestamp: '2025-01-22T14:25:00Z',
    provider: 'Gemini',
    model: 'gemini-1.5-pro',
    tokens: 6780,
    latency: 410,
    status: 'success',
  },
  {
    id: 'call-009',
    timestamp: '2025-01-22T14:24:00Z',
    provider: 'Groq',
    model: 'mixtral-8x7b',
    tokens: 1230,
    latency: 95,
    status: 'success',
  },
  {
    id: 'call-010',
    timestamp: '2025-01-22T14:23:00Z',
    provider: 'NVIDIA',
    model: 'llama-3.1-70b',
    tokens: 3890,
    latency: 267,
    status: 'success',
  },
];

const PROVIDER_COLORS: Record<string, string> = {
  NVIDIA: '#16A34A',
  Fireworks: '#F97316',
  Groq: '#EAB308',
  Gemini: '#2563EB',
};

// ── Component ──
export default function AiUsageDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d'>('14d');

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  const stats = useMemo(() => {
    const totalTokens = MOCK_USAGE_OVER_TIME.reduce((s, d) => s + d.tokens, 0);
    const totalCalls = MOCK_USAGE_OVER_TIME.reduce((s, d) => s + d.calls, 0);
    const totalCost = MOCK_USAGE_OVER_TIME.reduce((s, d) => s + d.cost, 0);
    const avgResponseTime = 265; // mock average
    return { totalTokens, totalCalls, avgResponseTime, totalCost };
  }, []);

  const columns: Column[] = useMemo(
    () => [
      {
        key: 'timestamp',
        label: 'Time',
        render: (_, row) => {
          const d = new Date(row.timestamp as string);
          return (
            <span className="text-xs tabular-nums" style={{ color: tokens.text.secondary }}>
              {d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          );
        },
      },
      {
        key: 'provider',
        label: 'Provider',
        render: (_, row) => {
          const color = PROVIDER_COLORS[row.provider as string] || tokens.text.primary;
          return (
            <span className="text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span style={{ color: tokens.text.primary }}>{row.provider as string}</span>
            </span>
          );
        },
      },
      {
        key: 'model',
        label: 'Model',
        render: (_, row) => (
          <span className="text-xs font-mono" style={{ color: tokens.text.secondary }}>
            {row.model as string}
          </span>
        ),
      },
      {
        key: 'tokens',
        label: 'Tokens',
        sortable: true,
        render: (_, row) => (
          <span className="text-sm tabular-nums" style={{ color: tokens.text.primary }}>
            {(row.tokens as number).toLocaleString()}
          </span>
        ),
      },
      {
        key: 'latency',
        label: 'Latency',
        sortable: true,
        render: (_, row) => {
          const lat = row.latency as number;
          return (
            <span
              className="text-sm tabular-nums"
              style={{ color: lat > 400 ? '#DC2626' : lat > 300 ? '#D97706' : '#16A34A' }}
            >
              {lat}ms
            </span>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        render: (_, row) => {
          const status = row.status as string;
          if (status === 'success') {
            return (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ color: '#16A34A', background: '#DCFCE7' }}
              >
                <CheckCircle2 className="h-3 w-3" /> Success
              </span>
            );
          }
          if (status === 'error') {
            return (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ color: '#DC2626', background: '#FEE2E2' }}
              >
                <XCircle className="h-3 w-3" /> Error
              </span>
            );
          }
          return (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ color: '#D97706', background: '#FEF3C7' }}
            >
              <Loader2 className="h-3 w-3" /> Timeout
            </span>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold flex items-center gap-2"
            style={{ color: tokens.text.primary }}
          >
            <BarChart3 className="h-6 w-6" style={{ color: tokens.accent.primary }} />
            AI Usage Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Comprehensive AI usage analytics and cost tracking
          </p>
        </div>
        <div
          className="flex items-center gap-1 rounded-lg p-1"
          style={{
            background: tokens.surface.secondary,
            border: `1px solid ${tokens.border.default}`,
          }}
        >
          {(['7d', '14d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: dateRange === range ? tokens.accent.primary : 'transparent',
                color: dateRange === range ? tokens.flat.white : tokens.text.secondary,
              }}
            >
              {range === '7d' ? '7 Days' : range === '14d' ? '14 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Tokens Used',
            value: (stats.totalTokens / 1000000).toFixed(1) + 'M',
            icon: Coins,
            color: tokens.accent.primary,
            bg: tokens.accent.ghost,
          },
          {
            label: 'Total API Calls',
            value: stats.totalCalls.toLocaleString(),
            icon: Phone,
            color: tokens.domain.opportunity,
            bg: '#ECFDF5',
          },
          {
            label: 'Avg Response Time',
            value: `${stats.avgResponseTime}ms`,
            icon: Clock,
            color: tokens.domain.reasoning,
            bg: tokens.domain.bg,
          },
          {
            label: 'Cost Estimate',
            value: `$${stats.totalCost.toFixed(2)}`,
            icon: DollarSign,
            color: tokens.priority.medium,
            bg: tokens.gold.bgMedium,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4"
            style={{
              background: tokens.surface.card,
              border: `1px solid ${tokens.border.default}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: tokens.text.muted }}
                >
                  {stat.label}
                </p>
                <p
                  className="text-2xl font-bold mt-1 tabular-nums"
                  style={{ color: tokens.text.primary }}
                >
                  {stat.value}
                </p>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: stat.bg }}>
                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Usage Over Time */}
        <div
          className="rounded-xl p-5"
          style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
        >
          <h2
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: tokens.text.primary }}
          >
            <TrendingUp className="h-4 w-4" style={{ color: tokens.accent.primary }} />
            Usage Over Time
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_USAGE_OVER_TIME}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: tokens.text.muted, fontSize: 11 }}
                  axisLine={{ stroke: tokens.border.default }}
                />
                <YAxis
                  tick={{ fill: tokens.text.muted, fontSize: 11 }}
                  axisLine={{ stroke: tokens.border.default }}
                />
                <Tooltip
                  contentStyle={{
                    background: tokens.surface.card,
                    border: `1px solid ${tokens.border.default}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="calls"
                  stroke={tokens.accent.primary}
                  strokeWidth={2}
                  dot={false}
                  name="API Calls"
                />
                <Line
                  type="monotone"
                  dataKey="tokens"
                  stroke={tokens.domain.reasoning}
                  strokeWidth={2}
                  dot={false}
                  name="Tokens"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tokens by Provider */}
        <div
          className="rounded-xl p-5"
          style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
        >
          <h2
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: tokens.text.primary }}
          >
            <Coins className="h-4 w-4" style={{ color: tokens.accent.primary }} />
            Tokens by Provider
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_TOKENS_BY_PROVIDER} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
                <XAxis
                  type="number"
                  tick={{ fill: tokens.text.muted, fontSize: 11 }}
                  axisLine={{ stroke: tokens.border.default }}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                />
                <YAxis
                  type="category"
                  dataKey="provider"
                  tick={{ fill: tokens.text.secondary, fontSize: 12 }}
                  axisLine={{ stroke: tokens.border.default }}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    background: tokens.surface.card,
                    border: `1px solid ${tokens.border.default}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [value.toLocaleString() + ' tokens', 'Tokens']}
                />
                <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
                  {MOCK_TOKENS_BY_PROVIDER.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PROVIDER_COLORS[entry.provider] || tokens.accent.primary}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Cost by Model ── */}
      <div
        className="rounded-xl p-5"
        style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
      >
        <h2
          className="text-sm font-semibold mb-4 flex items-center gap-2"
          style={{ color: tokens.text.primary }}
        >
          <DollarSign className="h-4 w-4" style={{ color: tokens.priority.medium }} />
          Cost by Model
        </h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_COST_BY_MODEL}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
              <XAxis
                dataKey="model"
                tick={{ fill: tokens.text.muted, fontSize: 10 }}
                axisLine={{ stroke: tokens.border.default }}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: tokens.text.muted, fontSize: 11 }}
                axisLine={{ stroke: tokens.border.default }}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: tokens.surface.card,
                  border: `1px solid ${tokens.border.default}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
              />
              <Bar dataKey="cost" fill={tokens.priority.medium} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent API Calls Table ── */}
      <DataTable
        columns={columns}
        data={MOCK_RECENT_CALLS.map((c) => ({
          id: c.id,
          timestamp: c.timestamp,
          provider: c.provider,
          model: c.model,
          tokens: c.tokens,
          latency: c.latency,
          status: c.status,
        }))}
        title="Recent API Calls"
        filterable
        filterPlaceholder="Search calls..."
        exportable
        exportFilename="ai-usage-calls"
      />
    </div>
  );
}
