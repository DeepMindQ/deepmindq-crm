'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Activity, Brain, AlertTriangle, BarChart3, Filter, RefreshCw } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';

// ─── Types ───────────────────────────────────────────────────────────────

interface ReasoningHistoryEntry {
  id: string;
  triggerSource: string;
  insightsGenerated: number;
  reasoningMethod: string;
  modelUsed: string | null;
  durationMs: number | null;
  hadNewInsights: boolean;
  createdAt: string;
}

interface ReasoningStats {
  totalSessions: number;
  sessionsToday: number;
  sessionsThisWeek: number;
  avgDurationMs: number;
  topTriggerSources: Array<{ triggerSource: string; count: number }>;
  llmVsTemplateRatio: { llm: number; template: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function getMethodBadge(method: string) {
  const map: Record<string, { bg: string; color: string }> = {
    llm: { bg: tokens.domain.bg, color: tokens.domain.value },
    template: { bg: tokens.confidence.high.bg, color: tokens.confidence.high.value },
    hybrid: { bg: tokens.gold.bgMedium, color: tokens.gold.dark },
    unknown: { bg: tokens.confidence.medium.bg, color: tokens.confidence.medium.value },
  };
  const style = map[method] || map.unknown;
  return (
    <Badge
      className="uppercase text-[10px] font-bold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {method}
    </Badge>
  );
}

function getTriggerBadge(trigger: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    manual: { bg: tokens.domain.bg, color: tokens.domain.value, label: 'Manual' },
    signal_created: {
      bg: tokens.confidence.high.bg,
      color: tokens.confidence.high.value,
      label: 'Signal',
    },
    ingestion_complete: { bg: tokens.gold.bgMedium, color: tokens.gold.dark, label: 'Ingestion' },
    scheduled: { bg: tokens.accent.subtle, color: tokens.accent.primary, label: 'Cron' },
    pipeline: {
      bg: tokens.confidence.medium.bg,
      color: tokens.confidence.medium.value,
      label: 'Pipeline',
    },
  };
  const info = map[trigger] || {
    bg: tokens.confidence.low.bg,
    color: tokens.confidence.low.value,
    label: trigger,
  };
  return (
    <Badge
      className="uppercase text-[10px] font-bold"
      style={{ backgroundColor: info.bg, color: info.color }}
    >
      {info.label}
    </Badge>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '-';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export default function IntelligenceReasoning() {
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [history, setHistory] = useState<ReasoningHistoryEntry[]>([]);
  const [stats, setStats] = useState<ReasoningStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch reasoning stats
      setStatsLoading(true);
      const statsRes = await fetchApi<ReasoningStats>('/api/reasoning/stats');
      if (statsRes.data && !statsRes.error) {
        setStats(statsRes.data);
      }
      setStatsLoading(false);

      // Fetch reasoning history — use all organizations via stats
      // We get the history from the stats endpoint since reasoning is per-org
      // For the table, we show the trigger-level data from stats
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reasoning data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Also fetch all recent reasoning memories for the table
  useEffect(() => {
    async function fetchHistory() {
      try {
        // Fetch all organizations first, then get reasoning history for each
        const orgsRes = await fetchApi<Array<{ id: string }>>('/api/organizations?limit=50');
        if (!orgsRes.error && Array.isArray(orgsRes.data)) {
          const orgIds = orgsRes.data.map((o) => o.id);
          // Fetch history for up to 10 orgs (to avoid too many requests)
          const batch = orgIds.slice(0, 10);
          const allHistory: ReasoningHistoryEntry[] = [];
          await Promise.allSettled(
            batch.map(async (orgId) => {
              try {
                const res = await fetchApi<ReasoningHistoryEntry[]>(
                  `/api/reasoning/history/${orgId}?limit=5`,
                );
                if (!res.error && Array.isArray(res.data)) {
                  allHistory.push(...res.data);
                }
              } catch {
                // Skip failed orgs
              }
            }),
          );
          // Sort by createdAt desc
          allHistory.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setHistory(allHistory);
        }
      } catch {
        // History fetch is best-effort
      }
    }
    fetchHistory();
  }, []);

  const filteredRuns = useMemo(() => {
    return history.filter((r) => {
      if (methodFilter !== 'all' && r.reasoningMethod !== methodFilter) return false;
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          r.triggerSource.toLowerCase().includes(searchLower) ||
          r.reasoningMethod.toLowerCase().includes(searchLower) ||
          (r.modelUsed || '').toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [methodFilter, search, history]);

  const handleRefresh = () => {
    fetchData();
  };

  const computedStats = useMemo(() => {
    if (stats) {
      return {
        runsToday: stats.sessionsToday,
        avgDuration: formatDuration(stats.avgDurationMs),
        modelsUsed:
          stats.llmVsTemplateRatio.llm > 0
            ? stats.llmVsTemplateRatio.llm + 1
            : stats.llmVsTemplateRatio.template > 0
              ? 1
              : 0,
        errors: history.filter((h) => !h.hadNewInsights && h.insightsGenerated === 0).length,
      };
    }
    return { runsToday: 0, avgDuration: '-', modelsUsed: 0, errors: 0 };
  }, [stats, history]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Intelligence Reasoning Engine
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Monitor AI reasoning sessions, trigger sources, and persistent memory recall
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Reasoning Sessions',
            value: computedStats.runsToday,
            icon: Brain,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Avg Duration',
            value: computedStats.avgDuration,
            icon: BarChart3,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Total Sessions',
            value: stats?.totalSessions ?? 0,
            icon: Activity,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'Sessions This Week',
            value: stats?.sessionsThisWeek ?? 0,
            icon: AlertTriangle,
            color:
              (stats?.sessionsThisWeek ?? 0 > 0)
                ? tokens.confidence.high.value
                : tokens.confidence.low.value,
            bg:
              (stats?.sessionsThisWeek ?? 0 > 0)
                ? tokens.confidence.high.bg
                : tokens.confidence.low.bg,
          },
        ].map((stat) => (
          <Card key={stat.label} className="gap-4 py-4">
            <CardContent className="flex items-center gap-4">
              <div
                className="flex items-center justify-center size-10 rounded-lg"
                style={{ backgroundColor: stat.bg }}
              >
                <stat.icon className="size-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  {stat.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trigger Source Distribution */}
      {stats && stats.topTriggerSources.length > 0 && (
        <Card className="gap-4 py-4">
          <CardContent>
            <p className="text-xs font-medium mb-3" style={{ color: tokens.text.secondary }}>
              Trigger Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.topTriggerSources.map((ts) => (
                <div key={ts.triggerSource} className="flex items-center gap-2">
                  {getTriggerBadge(ts.triggerSource)}
                  <span className="text-xs font-mono" style={{ color: tokens.text.secondary }}>
                    {ts.count}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3">
              <span className="text-xs" style={{ color: tokens.text.muted }}>
                LLM: {stats.llmVsTemplateRatio.llm} sessions
              </span>
              <span className="text-xs" style={{ color: tokens.text.muted }}>
                Template: {stats.llmVsTemplateRatio.template} sessions
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="gap-4 py-4">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
              style={{ color: tokens.text.muted }}
            />
            <Input
              placeholder="Search by trigger, method, model..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filter by method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="llm">LLM</SelectItem>
              <SelectItem value="template">Template</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs" style={{ color: tokens.text.muted }}>
            {filteredRuns.length} of {history.length} sessions
          </span>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Card className="gap-4 py-4 border-destructive/50">
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card className="gap-0 py-0 overflow-hidden">
        <CardContent className="p-0 max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                <TableHead className="w-[100px]">Trigger</TableHead>
                <TableHead className="w-[90px]">Method</TableHead>
                <TableHead className="w-[120px]">Model</TableHead>
                <TableHead className="w-[80px]">Insights</TableHead>
                <TableHead className="w-[90px]">Duration</TableHead>
                <TableHead className="w-[100px]">New?</TableHead>
                <TableHead className="w-[140px]">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div
                      className="flex items-center justify-center gap-2"
                      style={{ color: tokens.text.muted }}
                    >
                      <RefreshCw className="size-4 animate-spin" />
                      Loading reasoning sessions...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRuns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center"
                    style={{ color: tokens.text.muted }}
                  >
                    {history.length === 0
                      ? 'No reasoning sessions recorded yet. Reasoning is triggered automatically by signal detection, data ingestion, and scheduled cron jobs.'
                      : 'No reasoning sessions match the current filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRuns.map((run) => (
                  <TableRow key={run.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>{getTriggerBadge(run.triggerSource)}</TableCell>
                    <TableCell>{getMethodBadge(run.reasoningMethod)}</TableCell>
                    <TableCell className="text-xs" style={{ color: tokens.text.secondary }}>
                      {run.modelUsed || '-'}
                    </TableCell>
                    <TableCell className="text-xs font-mono" style={{ color: tokens.text.primary }}>
                      {run.insightsGenerated}
                    </TableCell>
                    <TableCell
                      className="text-xs font-mono"
                      style={{ color: tokens.text.secondary }}
                    >
                      {formatDuration(run.durationMs)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={run.hadNewInsights ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {run.hadNewInsights ? 'Yes' : 'Dedup'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs" style={{ color: tokens.text.muted }}>
                      {formatDate(run.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
