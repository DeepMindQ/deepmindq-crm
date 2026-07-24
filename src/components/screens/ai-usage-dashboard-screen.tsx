'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  DollarSign,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Thermometer,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

/* ── Types ── */

interface FeatureStats {
  calls: number;
  cost: number;
  tokens: number;
  avgConfidence: number;
  passRate: number;
}

interface ModelStats {
  calls: number;
  cost: number;
  tokens: number;
}

interface DailyTrend {
  date: string;
  calls: number;
  cost: number;
  passRate: number;
}

interface RecentFailure {
  id: string;
  generationType: string;
  createdAt: string;
  governanceChecks: string;
  outputSummary: string | null;
}

interface ReliabilityStats {
  uptimePercent: number;
  avgProcessingQuality: number;
  dataFreshnessPercent: number;
}

interface UsageStats {
  totalCalls: number;
  totalCost: number;
  totalTokens: number;
  avgConfidence: number;
  avgFreshness: number;
  governancePassRate: number;
  failedGenerations: number;
  byFeature: Record<string, FeatureStats>;
  byModel: Record<string, ModelStats>;
  dailyTrend: DailyTrend[];
  recentFailures: RecentFailure[];
  reliability: ReliabilityStats;
}

/* ── Helpers ── */

function getConfidenceColor(val: number): string {
  if (val >= 75) return 'text-emerald-600 bg-emerald-50';
  if (val >= 50) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function getPassRateColor(val: number): string {
  if (val >= 95) return 'text-emerald-600';
  if (val >= 80) return 'text-amber-600';
  return 'text-red-600';
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/* ── Component ── */

export default function AIUsageDashboardScreen() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [showFailures, setShowFailures] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/usage?days=${days}`);
      if (res.ok) {
        const json = await res.json();
        setStats(json.data?.stats ?? json.stats ?? null);
      } else {
        toast.error('Failed to load AI usage data');
      }
    } catch (err) {
      console.error('Failed to fetch usage stats:', err);
      toast.error('Network error loading usage data');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
            <Zap className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">AI Usage Dashboard</h2>
            <p className="text-sm text-gray-500">Token consumption, cost tracking &amp; reliability metrics</p>
          </div>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* ── Primary KPI Row ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-gray-500">
                  <Activity className="h-3.5 w-3.5 text-blue-600" />
                  Total Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalCalls)}</p>
                <p className="text-xs text-gray-400">Last {days} days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-gray-500">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  Est. Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">${stats.totalCost.toFixed(2)}</p>
                <p className="text-xs text-gray-400">Model-based pricing</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-gray-500">
                  <BarChart3 className="h-3.5 w-3.5 text-violet-600" />
                  Total Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalTokens)}</p>
                <p className="text-xs text-gray-400">Est. from output size</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-gray-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Gov. Pass Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${getPassRateColor(stats.governancePassRate)}`}>
                  {stats.governancePassRate}%
                </p>
                <p className="text-xs text-gray-400">{stats.failedGenerations} failures</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-gray-500">
                  <Thermometer className="h-3.5 w-3.5 text-blue-600" />
                  Avg Confidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${stats.avgConfidence >= 70 ? 'text-emerald-600' : stats.avgConfidence >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {stats.avgConfidence}%
                </p>
                <p className="text-xs text-gray-400">Research quality</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-gray-500">
                  <Clock className="h-3.5 w-3.5 text-violet-600" />
                  Data Freshness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${stats.avgFreshness >= 70 ? 'text-emerald-600' : stats.avgFreshness >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {stats.avgFreshness}%
                </p>
                <p className="text-xs text-gray-400">Source recency</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Breakdown: By Feature + By Model ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Feature */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Usage by Feature</CardTitle>
                <CardDescription className="text-xs">Calls, cost, and governance pass rate per AI feature</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.byFeature).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No usage data yet</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {Object.entries(stats.byFeature)
                      .sort((a, b) => b[1].calls - a[1].calls)
                      .map(([feature, data]) => (
                        <div key={feature} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs shrink-0">{feature}</Badge>
                              <span className={`text-xs font-medium ${getPassRateColor(data.passRate)}`}>
                                {data.passRate}% pass
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500">{data.calls} calls</span>
                              <span className="text-xs text-gray-400">{formatNumber(data.tokens)} tokens</span>
                              <span className="text-xs text-gray-400">conf: {data.avgConfidence}%</span>
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-sm font-semibold">${data.cost.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Model */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Usage by Model</CardTitle>
                <CardDescription className="text-xs">Token consumption and cost per LLM model</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.byModel).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No usage data yet</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {Object.entries(stats.byModel)
                      .sort((a, b) => b[1].calls - a[1].calls)
                      .map(([model, data]) => (
                        <div key={model} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex-1 min-w-0">
                            <Badge variant="secondary" className="text-xs font-mono truncate max-w-full">{model}</Badge>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500">{data.calls} calls</span>
                              <span className="text-xs text-gray-400">{formatNumber(data.tokens)} tokens</span>
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-sm font-semibold">${data.cost.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Daily Trend ── */}
          {stats.dailyTrend.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Daily Trend (Last {Math.min(stats.dailyTrend.length, 30)} days)
                </CardTitle>
                <CardDescription className="text-xs">API call volume over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1 h-40 min-w-max px-2">
                    {stats.dailyTrend.slice(-30).map((day, i) => {
                      const maxCalls = Math.max(...stats.dailyTrend.slice(-30).map(d => d.calls), 1);
                      const heightPercent = (day.calls / maxCalls) * 100;
                      const passColor = day.passRate >= 95 ? 'bg-emerald-400' : day.passRate >= 80 ? 'bg-amber-400' : 'bg-red-400';
                      return (
                        <div key={i} className="flex flex-col items-center gap-0.5 min-w-[24px]">
                          <span className="text-[10px] text-gray-500 font-medium">{day.calls}</span>
                          <div
                            className={`w-5 ${passColor} rounded-t transition-all`}
                            style={{ height: `${Math.max(heightPercent, 3)}%` }}
                          />
                          <span className="text-[9px] text-gray-400 -rotate-45 text-nowrap">
                            {day.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-2 border-t">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-emerald-400" />
                    <span className="text-[10px] text-gray-500">≥95% pass rate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-amber-400" />
                    <span className="text-[10px] text-gray-500">80-94% pass rate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-red-400" />
                    <span className="text-[10px] text-gray-500">&lt;80% pass rate</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Recent Failures ── */}
          {stats.recentFailures.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <CardTitle className="text-sm font-semibold text-red-700">
                      Recent Governance Failures ({stats.recentFailures.length})
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFailures(!showFailures)}
                    className="text-xs"
                  >
                    {showFailures ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {showFailures ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>
              {showFailures && (
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {stats.recentFailures.map((f) => (
                      <div key={f.id} className="p-3 bg-red-50 rounded-lg text-sm">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs text-red-700 border-red-200">
                            {f.generationType}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {new Date(f.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {f.outputSummary && (
                          <p className="text-xs text-gray-600 mt-1">{f.outputSummary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* ── Reliability Summary ── */}
          <Card className="bg-slate-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Reliability Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white rounded-lg">
                  <ShieldCheck className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                  <p className="text-lg font-bold text-gray-900">{stats.reliability.uptimePercent}%</p>
                  <p className="text-xs text-gray-500">AI Pipeline Uptime</p>
                  <p className="text-[10px] text-gray-400 mt-1">Governance pass rate</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <Thermometer className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-lg font-bold text-gray-900">{stats.reliability.avgProcessingQuality}%</p>
                  <p className="text-xs text-gray-500">Avg. Processing Quality</p>
                  <p className="text-[10px] text-gray-400 mt-1">Research confidence score</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <Clock className="h-6 w-6 text-violet-600 mx-auto mb-2" />
                  <p className="text-lg font-bold text-gray-900">{stats.reliability.dataFreshnessPercent}%</p>
                  <p className="text-xs text-gray-500">Data Freshness</p>
                  <p className="text-[10px] text-gray-400 mt-1">Source recency score</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No Usage Data</h3>
            <p className="text-sm text-gray-400 mt-1">
              Generate AI insights to see usage statistics here.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              The dashboard tracks every AI call: account briefs, signal analysis, lead scoring, enrichment, and more.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
