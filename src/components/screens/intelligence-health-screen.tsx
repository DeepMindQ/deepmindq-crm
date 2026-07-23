'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Heart, AlertTriangle, RefreshCw, Shield,
  Clock, Uptime, Layers, CheckCircle2, XCircle, TrendingUp, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/enterprise/ErrorState';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface ConnectorHealth {
  connectorId: string;
  name: string;
  sourceType: string;
  healthScore: number;
  successRate: number;
  freshnessScore: number;
  qualityScore: number;
  status: 'active' | 'degraded' | 'failed';
}

interface SourceHealthResponse {
  connectors: ConnectorHealth[];
  summary: {
    total: number;
    active: number;
    degraded: number;
    failed: number;
    healthy: number;
    warning: number;
    critical: number;
  };
}

interface GovernanceReport {
  governanceScore: number;
  lastCalculated: string;
  policies: { name: string; status: string }[];
}

interface ProcessingTimelineItem {
  id: string;
  connectorId: string;
  connectorName: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  errorCount: number;
}

interface PipelineError {
  id: string;
  connectorId: string;
  connectorName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function healthColor(score: number): string {
  if (score >= 0.7) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (score >= 0.4) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function healthBarColor(score: number): string {
  if (score >= 0.7) return 'bg-emerald-500';
  if (score >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreLabel(score: number): string {
  if (score >= 0.7) return 'Healthy';
  if (score >= 0.4) return 'Warning';
  return 'Critical';
}

function severityConfig(severity: string) {
  switch (severity) {
    case 'critical': return { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle };
    case 'high': return { color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: AlertTriangle };
    case 'medium': return { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle };
    default: return { color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: AlertTriangle };
  }
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceHealthScreen() {
  const [healthData, setHealthData] = useState<SourceHealthResponse | null>(null);
  const [governance, setGovernance] = useState<GovernanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, govRes] = await Promise.all([
        fetch('/api/g-intel-acquisition/source-health'),
        fetch('/api/g-intel-acquisition/governance'),
      ]);
      if (!healthRes.ok) throw new Error(`Health API ${healthRes.status}`);
      const healthJson: SourceHealthResponse = await healthRes.json();
      setHealthData(healthJson);
      if (govRes.ok) setGovernance(await govRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load governance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRecalculate = async () => {
    setActionLoading('recalculate');
    try {
      const res = await fetch('/api/g-intel-acquisition/source-health', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recalculation failed');
    } finally { setActionLoading(null); }
  };

  const handleFlagStale = async () => {
    setActionLoading('flag');
    try {
      const res = await fetch('/api/g-intel-acquisition/source-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'flag_stale' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Flag stale sources failed');
    } finally { setActionLoading(null); }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (error && !healthData) return <ErrorState message={error} onRetry={fetchData} />;
  if (!healthData) return null;

  const { connectors, summary } = healthData;
  const totalForBar = summary.healthy + summary.warning + summary.critical;

  // Pipeline metrics (derived from connector data)
  const avgSuccessRate = connectors.length > 0
    ? connectors.reduce((s, c) => s + c.successRate, 0) / connectors.length
    : 0;
  const avgFreshness = connectors.length > 0
    ? connectors.reduce((s, c) => s + c.freshnessScore, 0) / connectors.length
    : 0;
  const totalErrors = connectors.reduce((s, c) => s + c.failureCount, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Pipeline Health</h2>
            <p className="text-sm text-slate-500">Monitor connector health, processing status, and pipeline errors</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleFlagStale} disabled={!!actionLoading}
            className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
            <AlertTriangle className="h-3.5 w-3.5" />
            Flag Stale
          </Button>
          <Button size="sm" onClick={handleRecalculate} disabled={!!actionLoading}
            className="gap-2 bg-blue-600 hover:bg-blue-700">
            <RefreshCw className={cn('h-3.5 w-3.5', actionLoading === 'recalculate' && 'animate-spin')} />
            Recalculate
          </Button>
        </div>
      </div>

      {/* ── Status Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Uptime', value: `${(avgSuccessRate * 100).toFixed(1)}%`, icon: Activity, color: avgSuccessRate >= 0.9 ? 'text-emerald-600' : 'text-amber-600', bg: avgSuccessRate >= 0.9 ? 'bg-emerald-50' : 'bg-amber-50' },
          { label: 'Queue Depth', value: connectors.filter(c => c.status === 'active').length.toString(), icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Error Rate', value: totalErrors.toString(), icon: AlertTriangle, color: totalErrors > 5 ? 'text-red-500' : 'text-emerald-600', bg: totalErrors > 5 ? 'bg-red-50' : 'bg-emerald-50' },
          { label: 'Data Freshness', value: `${(avgFreshness * 100).toFixed(0)}%`, icon: Clock, color: avgFreshness >= 0.7 ? 'text-emerald-600' : 'text-amber-600', bg: avgFreshness >= 0.7 ? 'bg-emerald-50' : 'bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', stat.bg)}>
                <stat.icon className={cn('h-4 w-4', stat.color)} />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{stat.label}</p>
            <p className={cn('text-2xl font-bold mt-0.5', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Health Distribution Bar ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Heart className="h-4 w-4 text-slate-400" />
          Health Distribution
        </h3>
        {totalForBar === 0 ? (
          <p className="text-sm text-slate-400">No connector health data available</p>
        ) : (
          <div className="space-y-3">
            <div className="flex h-5 rounded-full overflow-hidden bg-slate-100">
              {summary.healthy > 0 && (
                <div className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(summary.healthy / totalForBar) * 100}%` }} />
              )}
              {summary.warning > 0 && (
                <div className="bg-amber-500 transition-all duration-500"
                  style={{ width: `${(summary.warning / totalForBar) * 100}%` }} />
              )}
              {summary.critical > 0 && (
                <div className="bg-red-500 transition-all duration-500"
                  style={{ width: `${(summary.critical / totalForBar) * 100}%` }} />
              )}
            </div>
            <div className="flex items-center gap-6">
              {[
                { label: 'Healthy', count: summary.healthy, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
                { label: 'Warning', count: summary.warning, color: 'bg-amber-500', textColor: 'text-amber-700' },
                { label: 'Critical', count: summary.critical, color: 'bg-red-500', textColor: 'text-red-700' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <div className={cn('w-2.5 h-2.5 rounded-sm', item.color)} />
                  <span className="text-slate-500">{item.label}</span>
                  <span className={cn('font-semibold', item.textColor)}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Processing Timeline ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            Connector Health Details
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Connector', 'Type', 'Health', 'Success Rate', 'Freshness', 'Quality', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {connectors.map(c => (
                <tr key={c.connectorId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] bg-slate-50">{c.sourceType}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('text-[10px]', healthColor(c.healthScore))}>
                      {(c.healthScore * 100).toFixed(0)}% — {scoreLabel(c.healthScore)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={cn('h-full rounded-full', healthBarColor(c.successRate))}
                          style={{ width: `${c.successRate * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{(c.successRate * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium', c.freshnessScore >= 0.7 ? 'text-emerald-600' : c.freshnessScore >= 0.4 ? 'text-amber-600' : 'text-red-600')}>
                      {(c.freshnessScore * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium', c.qualityScore >= 0.7 ? 'text-emerald-600' : c.qualityScore >= 0.4 ? 'text-amber-600' : 'text-red-600')}>
                      {(c.qualityScore * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={
                      c.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      c.status === 'degraded' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }>
                      {c.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Error List (Failed connectors) ── */}
      {connectors.some(c => c.status === 'failed') && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 shadow-sm">
          <div className="p-4 border-b border-red-200">
            <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Errors & Failures
              <Badge className="bg-red-600 text-white text-[10px] ml-auto">
                {connectors.filter(c => c.status === 'failed').length}
              </Badge>
            </h3>
          </div>
          <div className="divide-y divide-red-100">
            {connectors.filter(c => c.status === 'failed').map(c => (
              <div key={c.connectorId} className="flex items-center gap-3 px-4 py-3">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-800">{c.name}</p>
                  {c.failureCount > 0 && (
                    <p className="text-xs text-red-600 mt-0.5">{c.failureCount} consecutive failures</p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-100 gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Governance Report ── */}
      {governance && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              Governance Report
            </h3>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <div className={cn(
                'text-3xl font-bold',
                governance.governanceScore >= 0.7 ? 'text-emerald-600' :
                governance.governanceScore >= 0.4 ? 'text-amber-600' : 'text-red-600'
              )}>
                {(governance.governanceScore * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-slate-400">
                Overall governance score · Last calculated {new Date(governance.lastCalculated).toLocaleString()}
              </div>
            </div>
            {governance.policies.length > 0 && (
              <div className="space-y-2">
                {governance.policies.map(p => (
                  <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-700">{p.name}</span>
                    <Badge variant="outline" className={
                      p.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      p.status === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-slate-50 text-slate-600 border-slate-200'
                    }>
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
