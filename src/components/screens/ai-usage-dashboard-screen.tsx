'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Loader2,
  Sparkles,
  Brain,
  CheckCircle2,
  ArrowRight,
  Lightbulb,
  Clock,
  DollarSign,
  BarChart3,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

/* ── Types ── */

interface EnhancedBriefData {
  id: string;
  summary: string;
  aiNarrative: string | null;
  aiKeyTakeaways: string[];
  aiStrategicImplications: Array<{
    implication: string;
    impact: string;
    action: string;
  }>;
  themes: string[];
  risks: Array<{ risk: string; severity: string; evidence: string }>;
  recommendations: Array<{ action: string; priority: string; rationale: string }>;
  confidence: number;
  generatedBy: string;
  aiModelUsed: string | null;
  generatedAt: string;
}

interface UsageStats {
  totalCalls: number;
  totalCost: number;
  totalTokens: number;
  byFeature: Record<string, { calls: number; cost: number; tokens: number }>;
  byModel: Record<string, { calls: number; cost: number; tokens: number }>;
  dailyTrend: Array<{ date: string; calls: number; cost: number }>;
}

/* ── Helpers ── */

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.75) return 'text-emerald-600';
  if (confidence >= 0.5) return 'text-amber-600';
  return 'text-red-600';
}

/* ── Component ── */

export default function AIUsageDashboardScreen() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/g-ai-copilot/usage/stats?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch usage stats:', err);
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <DollarSign className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">AI Usage Dashboard</h2>
            <p className="text-sm text-gray-500">Token consumption and cost tracking</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Total API Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCalls.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Last {days} days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Estimated Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">${stats.totalCost.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Based on model pricing</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-violet-600" />
                  Total Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTokens.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Prompt + Completion</p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown by Feature */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">By Feature</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.byFeature).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No usage data yet</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(stats.byFeature).map(([feature, data]) => (
                      <div key={feature} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <Badge variant="outline" className="text-xs">{feature}</Badge>
                          <p className="text-xs text-gray-500 mt-1">{data.calls} calls</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">${data.cost.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">{data.tokens.toLocaleString()} tokens</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">By Model</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.byModel).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No usage data yet</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(stats.byModel).map(([model, data]) => (
                      <div key={model} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <Badge variant="secondary" className="text-xs font-mono">{model}</Badge>
                          <p className="text-xs text-gray-500 mt-1">{data.calls} calls</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">${data.cost.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">{data.tokens.toLocaleString()} tokens</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Daily Trend */}
          {stats.dailyTrend.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Daily Trend (Last {Math.min(stats.dailyTrend.length, 14)} days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1 h-32 min-w-max px-2">
                    {stats.dailyTrend.slice(-14).map((day, i) => {
                      const maxCalls = Math.max(...stats.dailyTrend.slice(-14).map(d => d.calls), 1);
                      const heightPercent = (day.calls / maxCalls) * 100;
                      return (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500">{day.calls}</span>
                          <div
                            className="w-6 bg-violet-400 rounded-t transition-all"
                            style={{ height: `${Math.max(heightPercent, 2)}%` }}
                          />
                          <span className="text-xs text-gray-400 rotate-45 text-nowrap">
                            {day.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No Usage Data</h3>
            <p className="text-sm text-gray-400 mt-1">Generate AI insights to see usage statistics here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
