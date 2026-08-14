'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/screen-states';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Activity, TrendingUp, TrendingDown, Target, Zap, Users, DollarSign,
  ArrowRight, BarChart3, Brain, Shield, AlertTriangle, CheckCircle2,
  Sparkles, FileSearch, Megaphone, RefreshCw, Eye,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Mock Data ──
const signalActivityData = [
  { date: 'Mon', signals: 42, processed: 38 },
  { date: 'Tue', signals: 58, processed: 52 },
  { date: 'Wed', signals: 35, processed: 33 },
  { date: 'Thu', signals: 71, processed: 65 },
  { date: 'Fri', signals: 89, processed: 82 },
  { date: 'Sat', signals: 28, processed: 27 },
  { date: 'Sun', signals: 45, processed: 41 },
];

const topAccounts = [
  { id: '1', name: 'Acme Corp', industry: 'Enterprise SaaS', score: 94, trend: 'up' as const, arr: '$2.4M', signals: 12 },
  { id: '2', name: 'NovaTech', industry: 'FinTech', score: 91, trend: 'up' as const, arr: '$1.8M', signals: 9 },
  { id: '3', name: 'Pinnacle Health', industry: 'Healthcare', score: 87, trend: 'down' as const, arr: '$3.1M', signals: 15 },
  { id: '4', name: 'Quantum Dynamics', industry: 'Manufacturing', score: 85, trend: 'up' as const, arr: '$980K', signals: 7 },
  { id: '5', name: 'SkyBridge Labs', industry: 'AI/ML', score: 82, trend: 'up' as const, arr: '$1.2M', signals: 11 },
];

const recentInsights = [
  { id: '1', title: 'Acme Corp expanding engineering team — 15 new roles posted', type: 'growth' as const, time: '12m ago', account: 'Acme Corp', confidence: 92 },
  { id: '2', title: 'NovaTech CTO published article on cloud migration strategy', type: 'intent' as const, time: '34m ago', account: 'NovaTech', confidence: 88 },
  { id: '3', title: 'Pinnacle Health renewed compliance certification — upsell window', type: 'opportunity' as const, time: '1h ago', account: 'Pinnacle Health', confidence: 79 },
  { id: '4', title: 'Quantum Dynamics reduced headcount by 8% — risk alert', type: 'risk' as const, time: '2h ago', account: 'Quantum Dynamics', confidence: 95 },
  { id: '5', title: 'SkyBridge Labs secured Series C funding ($45M)', type: 'growth' as const, time: '3h ago', account: 'SkyBridge Labs', confidence: 97 },
];

const kpiCards = [
  { label: 'Active Signals', value: '342', change: '+12.5%', trend: 'up' as const, icon: Activity, color: tokens.accent.primary },
  { label: 'AI Recommendations', value: '89', change: '+8.3%', trend: 'up' as const, icon: Brain, color: tokens.domain.reasoning },
  { label: 'Avg. Confidence', value: '87.4%', change: '+2.1%', trend: 'up' as const, icon: Target, color: tokens.confidence.high.value },
  { label: 'Pipeline Value', value: '$12.8M', change: '+15.2%', trend: 'up' as const, icon: DollarSign, color: tokens.gold.dark },
  { label: 'Active Accounts', value: '156', change: '-2.4%', trend: 'down' as const, icon: Users, color: tokens.accent.primary },
  { label: 'Win Rate', value: '34.2%', change: '+4.7%', trend: 'up' as const, icon: Zap, color: '#059669' },
];

const healthChecks = [
  { name: 'Signal Pipeline', status: 'healthy' as const, detail: 'Processing normally' },
  { name: 'AI Engine', status: 'healthy' as const, detail: 'Last model update: 2h ago' },
  { name: 'Data Enrichment', status: 'degraded' as const, detail: '3 sources delayed' },
  { name: 'Recommendation Engine', status: 'healthy' as const, detail: '89 active recommendations' },
];

// ── Helpers ──
function ConfidenceDot({ score }: { score: number }) {
  const color = score >= 85 ? tokens.confidence.high.value : score >= 70 ? tokens.confidence.medium.value : tokens.confidence.low.value;
  return <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />;
}

function InsightTypeBadge({ type }: { type: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    growth: { bg: tokens.confidence.high.bg, text: tokens.confidence.high.value, label: 'Growth' },
    intent: { bg: tokens.accent.ghost, text: tokens.accent.primary, label: 'Intent' },
    opportunity: { bg: tokens.gold.bgMedium, text: tokens.gold.dark, label: 'Opportunity' },
    risk: { bg: tokens.confidence.low.bg, text: tokens.confidence.low.value, label: 'Risk' },
  };
  const style = map[type] || map.growth;
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: style.bg, color: style.text }}>
      {style.label}
    </span>
  );
}

// ── Component ──
export function MainIntelligenceDashboard() {
  const [loading, setLoading] = useState(true);

  // Simulate loading
  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Intelligence Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Real-time intelligence operations overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" className="gap-2" style={{ backgroundColor: tokens.accent.primary, color: '#fff' }}>
            <Sparkles className="w-3.5 h-3.5" /> Run Analysis
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="py-4 gap-3">
              <CardContent className="p-4 pb-0">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${kpi.color}15` }}>
                    <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium" style={{ color: kpi.trend === 'up' ? tokens.confidence.high.value : tokens.confidence.low.value }}>
                    {kpi.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {kpi.change}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>{kpi.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: tokens.text.secondary }}>{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart + Top Accounts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Signals Activity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>Signal Activity</CardTitle>
            <CardDescription>Signals detected vs processed this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={signalActivityData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="signalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={tokens.accent.primary} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={tokens.accent.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="processedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={tokens.confidence.high.value} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={tokens.confidence.high.value} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} opacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke={tokens.text.muted} />
                  <YAxis tick={{ fontSize: 12 }} stroke={tokens.text.muted} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tokens.surface.card,
                      border: `1px solid ${tokens.border.default}`,
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  />
                  <Area type="monotone" dataKey="signals" stroke={tokens.accent.primary} strokeWidth={2} fill="url(#signalGrad)" name="Detected" />
                  <Area type="monotone" dataKey="processed" stroke={tokens.confidence.high.value} strokeWidth={2} fill="url(#processedGrad)" name="Processed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Accounts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>Top Accounts</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" style={{ color: tokens.accent.primary }}>
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {topAccounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer hover:bg-muted/50" style={{ border: `1px solid ${tokens.borderFaint}` }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: tokens.text.primary }}>{acc.name}</p>
                    <p className="text-xs" style={{ color: tokens.text.muted }}>{acc.industry} · {acc.arr}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge variant="outline" className="text-xs font-semibold px-1.5 py-0" style={{ borderColor: tokens.confidence.high.border, color: tokens.confidence.high.value }}>
                      {acc.score}
                    </Badge>
                    {acc.trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" style={{ color: tokens.confidence.high.value }} /> : <TrendingDown className="w-3.5 h-3.5" style={{ color: tokens.confidence.low.value }} />}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights + Quick Actions + Health Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Insights Feed */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>Recent Insights</CardTitle>
              <Badge variant="secondary" className="text-xs">{recentInsights.length} new</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentInsights.map((insight) => (
                <div key={insight.id} className="p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50" style={{ border: `1px solid ${tokens.borderFaint}` }}>
                  <div className="flex items-start gap-2">
                    <ConfidenceDot score={insight.confidence} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug" style={{ color: tokens.text.primary }}>{insight.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <InsightTypeBadge type={insight.type} />
                        <span className="text-[11px]" style={{ color: tokens.text.muted }}>{insight.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions + Intelligence Health */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: FileSearch, label: 'Search Intelligence', color: tokens.accent.primary },
                  { icon: Megaphone, label: 'View Recommendations', color: tokens.domain.reasoning },
                  { icon: BarChart3, label: 'Pipeline Report', color: tokens.gold.dark },
                  { icon: Eye, label: 'Account Insights', color: '#059669' },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.label}
                      variant="outline"
                      className="h-auto py-4 flex-col gap-2 rounded-xl"
                      style={{ borderColor: tokens.border.default }}
                    >
                      <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${action.color}12` }}>
                        <Icon className="w-4 h-4" style={{ color: action.color }} />
                      </div>
                      <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>{action.label}</span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Intelligence Health Summary */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>Intelligence Health</CardTitle>
                <Badge variant="secondary" className="text-xs gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tokens.confidence.medium.value }} /> 1 Issue
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {healthChecks.map((check) => (
                  <div key={check.name} className="flex items-center gap-3 p-3 rounded-lg" style={{ border: `1px solid ${tokens.borderFaint}` }}>
                    {check.status === 'healthy' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: tokens.confidence.high.value }} />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: tokens.confidence.medium.value }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{check.name}</p>
                      <p className="text-xs" style={{ color: tokens.text.muted }}>{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
