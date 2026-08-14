'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { fetchApi } from '@/lib/fetchApi';
import {
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Server,
  Gauge,
  Coins,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ──
interface ProviderHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  tokensUsed: number;
  rateLimitRemaining: number;
  rateLimitTotal: number;
  errorRate: number;
  models: string[];
}

// ── Mock Data ──
const MOCK_PROVIDERS: ProviderHealth[] = [
  {
    name: 'NVIDIA',
    status: 'healthy',
    latency: 245,
    tokensUsed: 1245000,
    rateLimitRemaining: 8755,
    rateLimitTotal: 10000,
    errorRate: 0.3,
    models: ['llama-3.1-70b', 'mixtral-8x22b'],
  },
  {
    name: 'Fireworks',
    status: 'healthy',
    latency: 189,
    tokensUsed: 892000,
    rateLimitRemaining: 5420,
    rateLimitTotal: 10000,
    errorRate: 0.8,
    models: ['llama-3.1-8b', 'qwen-2.5-72b'],
  },
  {
    name: 'Groq',
    status: 'degraded',
    latency: 520,
    tokensUsed: 567000,
    rateLimitRemaining: 1200,
    rateLimitTotal: 5000,
    errorRate: 3.2,
    models: ['llama-3.1-70b', 'mixtral-8x7b'],
  },
  {
    name: 'Gemini',
    status: 'healthy',
    latency: 312,
    tokensUsed: 2100000,
    rateLimitRemaining: 42000,
    rateLimitTotal: 60000,
    errorRate: 0.1,
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  },
];

const MOCK_TOKEN_USAGE = [
  { day: 'Mon', tokens: 125000, cost: 6.25 },
  { day: 'Tue', tokens: 148000, cost: 7.40 },
  { day: 'Wed', tokens: 132000, cost: 6.60 },
  { day: 'Thu', tokens: 189000, cost: 9.45 },
  { day: 'Fri', tokens: 167000, cost: 8.35 },
  { day: 'Sat', tokens: 78000, cost: 3.90 },
  { day: 'Sun', tokens: 54000, cost: 2.70 },
];

const MOCK_MODEL_USAGE = [
  { name: 'Gemini 1.5 Pro', value: 42, color: '#2563EB' },
  { name: 'Llama 3.1 70B', value: 28, color: '#7C3AED' },
  { name: 'Mixtral 8x22B', value: 15, color: '#059669' },
  { name: 'Qwen 2.5 72B', value: 10, color: '#D97706' },
  { name: 'Other', value: 5, color: '#6B7280' },
];

// ── Helpers ──
function getStatusConfig(status: string) {
  switch (status) {
    case 'healthy':
      return { color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle2, label: 'Healthy' };
    case 'degraded':
      return { color: '#D97706', bg: '#FEF3C7', icon: AlertTriangle, label: 'Degraded' };
    case 'down':
      return { color: '#DC2626', bg: '#FEE2E2', icon: XCircle, label: 'Down' };
    default:
      return { color: '#6B7280', bg: '#F3F4F6', icon: AlertTriangle, label: 'Unknown' };
  }
}

function getOverallHealth(providers: ProviderHealth[]): number {
  const weights = providers.map((p) => {
    let w = 0;
    if (p.status === 'healthy') w = 100;
    else if (p.status === 'degraded') w = 50;
    else w = 0;
    w -= p.errorRate * 5;
    w -= p.latency > 400 ? 10 : 0;
    return Math.max(0, Math.min(100, w));
  });
  return Math.round(weights.reduce((a, b) => a + b, 0) / weights.length);
}

// ── Component ──
export default function AiHealth() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [tokenUsage, setTokenUsage] = useState(MOCK_TOKEN_USAGE);
  const [modelUsage, setModelUsage] = useState(MOCK_MODEL_USAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHealth() {
      setLoading(true);
      try {
        // Try fetching real data
        const aiResult = await fetchApi<ProviderHealth[]>('/api/health/ai');
        const healthResult = await fetchApi('/api/health');

        if (aiResult.data && Array.isArray(aiResult.data)) {
          setProviders(aiResult.data);
        } else {
          setProviders(MOCK_PROVIDERS);
        }
        // Use mock data for charts as fallback (API may not have chart data)
        setTokenUsage(MOCK_TOKEN_USAGE);
        setModelUsage(MOCK_MODEL_USAGE);
      } catch {
        // Fallback to mock data
        setProviders(MOCK_PROVIDERS);
        setTokenUsage(MOCK_TOKEN_USAGE);
        setModelUsage(MOCK_MODEL_USAGE);
      } finally {
        setLoading(false);
      }
    }
    loadHealth();
  }, []);

  const overallHealth = getOverallHealth(providers);
  const totalTokens = providers.reduce((s, p) => s + p.tokensUsed, 0);
  const avgLatency = providers.length
    ? Math.round(providers.reduce((s, p) => s + p.latency, 0) / providers.length)
    : 0;
  const avgErrorRate = providers.length
    ? (providers.reduce((s, p) => s + p.errorRate, 0) / providers.length).toFixed(1)
    : '0';

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl p-6 text-center" style={{ background: tokens.confidence.low.bg, border: `1px solid ${tokens.confidence.low.border}` }}>
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" style={{ color: tokens.confidence.low.value }} />
          <p className="text-sm font-medium" style={{ color: tokens.confidence.low.value }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: tokens.text.primary }}>
            <Activity className="h-6 w-6" style={{ color: tokens.accent.primary }} />
            AI System Health
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Monitor AI provider status, latency, and resource utilization
          </p>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" style={{ background: tokens.border.default }} />
            ))
          : [
              { label: 'Overall Health', value: `${overallHealth}%`, icon: Gauge, color: overallHealth >= 80 ? '#16A34A' : overallHealth >= 60 ? '#D97706' : '#DC2626', bg: overallHealth >= 80 ? '#DCFCE7' : overallHealth >= 60 ? '#FEF3C7' : '#FEE2E2' },
              { label: 'Total Tokens Used', value: (totalTokens / 1000000).toFixed(1) + 'M', icon: Coins, color: tokens.accent.primary, bg: tokens.accent.ghost },
              { label: 'Avg Latency', value: `${avgLatency}ms`, icon: Clock, color: tokens.domain.reasoning, bg: tokens.domain.bg },
              { label: 'Avg Error Rate', value: `${avgErrorRate}%`, icon: AlertTriangle, color: parseFloat(avgErrorRate) > 2 ? '#DC2626' : '#16A34A', bg: parseFloat(avgErrorRate) > 2 ? '#FEE2E2' : '#DCFCE7' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-4"
                style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: tokens.text.muted }}>{stat.label}</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: tokens.text.primary }}>{stat.value}</p>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ background: stat.bg }}>
                    <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* ── Provider Cards ── */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: tokens.text.primary }}>Provider Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" style={{ background: tokens.border.default }} />
              ))
            : providers.map((provider) => {
                const statusCfg = getStatusConfig(provider.status);
                const StatusIcon = statusCfg.icon;
                const ratePercent = Math.round((provider.rateLimitRemaining / provider.rateLimitTotal) * 100);
                return (
                  <div
                    key={provider.name}
                    className="rounded-xl p-5"
                    style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2" style={{ background: tokens.neutral['100'] }}>
                          <Server className="h-5 w-5" style={{ color: tokens.text.secondary }} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{provider.name}</h3>
                          <p className="text-xs" style={{ color: tokens.text.muted }}>
                            {provider.models.join(', ')}
                          </p>
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ color: statusCfg.color, background: statusCfg.bg }}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: tokens.text.muted }}>Latency</p>
                        <p className="text-lg font-bold mt-0.5 tabular-nums" style={{ color: provider.latency > 400 ? '#DC2626' : tokens.text.primary }}>
                          {provider.latency}ms
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: tokens.text.muted }}>Tokens Used</p>
                        <p className="text-lg font-bold mt-0.5 tabular-nums" style={{ color: tokens.text.primary }}>
                          {(provider.tokensUsed / 1000).toFixed(0)}K
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: tokens.text.muted }}>Error Rate</p>
                        <p className="text-lg font-bold mt-0.5 tabular-nums" style={{ color: provider.errorRate > 2 ? '#DC2626' : '#16A34A' }}>
                          {provider.errorRate}%
                        </p>
                      </div>
                    </div>

                    {/* Rate Limit Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: tokens.text.muted }}>Rate Limit</p>
                        <p className="text-[10px] tabular-nums" style={{ color: tokens.text.secondary }}>
                          {provider.rateLimitRemaining.toLocaleString()} / {provider.rateLimitTotal.toLocaleString()}
                        </p>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: tokens.border.default }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${ratePercent}%`,
                            background: ratePercent > 50 ? '#16A34A' : ratePercent > 20 ? '#D97706' : '#DC2626',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Token Usage Bar Chart */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
        >
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: tokens.text.primary }}>
            <BarChart3 className="h-4 w-4" style={{ color: tokens.accent.primary }} />
            Token Usage (Last 7 Days)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tokenUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
                <XAxis dataKey="day" tick={{ fill: tokens.text.muted, fontSize: 12 }} axisLine={{ stroke: tokens.border.default }} />
                <YAxis tick={{ fill: tokens.text.muted, fontSize: 12 }} axisLine={{ stroke: tokens.border.default }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{
                    background: tokens.surface.card,
                    border: `1px solid ${tokens.border.default}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} tokens`, 'Usage']}
                />
                <Bar dataKey="tokens" fill={tokens.accent.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Usage Donut */}
        <div
          className="rounded-xl p-5"
          style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
        >
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: tokens.text.primary }}>
            <Zap className="h-4 w-4" style={{ color: tokens.accent.primary }} />
            Model Usage Breakdown
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={modelUsage}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {modelUsage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: tokens.surface.card,
                    border: `1px solid ${tokens.border.default}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Share']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {modelUsage.map((model) => (
              <div key={model.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: model.color }} />
                  <span style={{ color: tokens.text.secondary }}>{model.name}</span>
                </div>
                <span className="font-medium tabular-nums" style={{ color: tokens.text.primary }}>{model.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error Rate Tracking ── */}
      <div
        className="rounded-xl p-5"
        style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: tokens.text.primary }}>Error Rate Tracking</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.border.default}` }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: tokens.text.muted }}>Provider</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: tokens.text.muted }}>Error Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: tokens.text.muted }}>Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: tokens.text.muted }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => {
                const isHigh = p.errorRate > 2;
                return (
                  <tr key={p.name} style={{ borderBottom: `1px solid ${tokens.border.default}` }}>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: tokens.text.primary }}>{p.name}</td>
                    <td className="px-4 py-3 text-sm tabular-nums" style={{ color: isHigh ? '#DC2626' : '#16A34A' }}>{p.errorRate}%</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          color: getStatusConfig(p.status).color,
                          background: getStatusConfig(p.status).bg,
                        }}
                      >
                        {getStatusConfig(p.status).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: tokens.text.muted }}>
                      {isHigh ? '↑ Increasing' : '→ Stable'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
