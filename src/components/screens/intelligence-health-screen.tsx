'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Heart, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ─── Types ──────────────────────────────────────────
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

// ─── Helpers ────────────────────────────────────────
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

// ─── Component ──────────────────────────────────────
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
      if (govRes.ok) {
        const govJson: GovernanceReport = await govRes.json();
        setGovernance(govJson);
      }
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
    } finally {
      setActionLoading(null);
    }
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
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Loading / Error States ───
  if (loading && !healthData) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        <span className="ml-3 text-gray-500">Loading source governance data...</span>
      </div>
    );
  }

  if (error && !healthData) {
    return (
      <div className="flex items-center justify-center h-96 text-red-500">
        <AlertTriangle className="w-5 h-5 mr-2" />
        {error}
      </div>
    );
  }

  if (!healthData) return null;

  const { connectors, summary } = healthData;
  const totalForBar = summary.healthy + summary.warning + summary.critical;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Source Governance</h1>
            <p className="text-sm text-gray-500">Monitor connector health, data quality, and governance metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFlagStale}
            disabled={!!actionLoading}
            className="gap-2"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {actionLoading === 'flag' ? 'Flagging...' : 'Flag Stale Sources'}
          </Button>
          <Button
            size="sm"
            onClick={handleRecalculate}
            disabled={!!actionLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'recalculate' ? 'animate-spin' : ''}`} />
            {actionLoading === 'recalculate' ? 'Recalculating...' : 'Recalculate All'}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Total Connectors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{summary.total}</div>
            <div className="mt-1 text-xs text-gray-400">{summary.active} active sources</div>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500 flex items-center gap-2">
              <Heart className="w-3.5 h-3.5" /> Healthy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{summary.healthy}</div>
            <div className="mt-1 text-xs text-gray-400">{totalForBar > 0 ? Math.round((summary.healthy / totalForBar) * 100) : 0}% of total</div>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" /> Degraded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{summary.degraded}</div>
            <div className="mt-1 text-xs text-gray-400">{summary.warning} in warning zone</div>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" /> Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{summary.failed}</div>
            <div className="mt-1 text-xs text-gray-400">{summary.critical} critical status</div>
          </CardContent>
        </Card>
      </div>

      {/* Health Distribution Bar */}
      <Card className="border-gray-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-800">Health Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {totalForBar === 0 ? (
            <p className="text-sm text-gray-400">No connector health data available</p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-6 rounded-md overflow-hidden bg-gray-100">
                {summary.healthy > 0 && (
                  <div
                    className="bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(summary.healthy / totalForBar) * 100}%` }}
                  />
                )}
                {summary.warning > 0 && (
                  <div
                    className="bg-amber-500 transition-all duration-500"
                    style={{ width: `${(summary.warning / totalForBar) * 100}%` }}
                  />
                )}
                {summary.critical > 0 && (
                  <div
                    className="bg-red-500 transition-all duration-500"
                    style={{ width: `${(summary.critical / totalForBar) * 100}%` }}
                  />
                )}
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span className="text-gray-600">Healthy (≥0.7)</span>
                  <span className="font-semibold text-emerald-700">{summary.healthy}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-sm bg-amber-500" />
                  <span className="text-gray-600">Warning (0.4–0.7)</span>
                  <span className="font-semibold text-amber-700">{summary.warning}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-sm bg-red-500" />
                  <span className="text-gray-600">Critical (&lt;0.4)</span>
                  <span className="font-semibold text-red-700">{summary.critical}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connector Health Table */}
      <Card className="border-gray-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-800">Connector Health Details</CardTitle>
        </CardHeader>
        <CardContent>
          {connectors.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No connectors found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Connector</th>
                    <th className="pb-2 font-medium">Source Type</th>
                    <th className="pb-2 font-medium">Health Score</th>
                    <th className="pb-2 font-medium">Success Rate</th>
                    <th className="pb-2 font-medium">Freshness</th>
                    <th className="pb-2 font-medium">Quality</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {connectors.map((c) => (
                    <tr key={c.connectorId} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 text-gray-800 font-medium">{c.name}</td>
                      <td className="py-2.5 text-gray-500">{c.sourceType}</td>
                      <td className="py-2.5">
                        <Badge variant="outline" className={healthColor(c.healthScore)}>
                          {(c.healthScore * 100).toFixed(0)}% — {scoreLabel(c.healthScore)}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full ${healthBarColor(c.successRate)}`} style={{ width: `${c.successRate * 100}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{(c.successRate * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span className={`text-xs font-medium ${c.freshnessScore >= 0.7 ? 'text-emerald-600' : c.freshnessScore >= 0.4 ? 'text-amber-600' : 'text-red-600'}`}>
                          {(c.freshnessScore * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className={`text-xs font-medium ${c.qualityScore >= 0.7 ? 'text-emerald-600' : c.qualityScore >= 0.4 ? 'text-amber-600' : 'text-red-600'}`}>
                          {(c.qualityScore * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant="outline"
                          className={
                            c.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            c.status === 'degraded' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }
                        >
                          {c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Governance Report Summary */}
      {governance && (
        <Card className="border-gray-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Governance Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-2xl font-bold text-gray-900">{(governance.governanceScore * 100).toFixed(0)}%</div>
              <div className="text-xs text-gray-400">Overall governance score · Last calculated {new Date(governance.lastCalculated).toLocaleString()}</div>
            </div>
            {governance.policies.length > 0 && (
              <div className="space-y-2">
                {governance.policies.map((p) => (
                  <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{p.name}</span>
                    <Badge variant="outline" className={
                      p.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      p.status === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-gray-50 text-gray-600 border-gray-200'
                    }>
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}