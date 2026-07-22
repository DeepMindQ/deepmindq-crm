'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, Shield, Brain, Activity, Zap,
  Layers, Clock, RefreshCw, Loader2, AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ──────────────────────────────────────────
interface OverviewData {
  totalObjects: number;
  knowledgeEntries: number;
  activeAlerts: number;
  avgConfidence: number;
  coverageScore: number;
  activity24h: number;
}

interface TrendPoint {
  date: string;
  count: number;
}

interface ConfidenceBucket {
  range: string;
  min?: number;
  max?: number;
  count: number;
}

interface CoverageCategory {
  category: string;
  count: number;
}

interface SourcePerformance {
  name: string;
  type: string;
  healthScore: number;
  totalRecords: number;
  avgConfidence: number;
  lastRun: string | null;
}

interface ActivityItem {
  type: 'timeline' | 'alert' | 'inbox';
  title: string;
  timestamp: string;
}

// ─── Helpers ────────────────────────────────────────
function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = Math.abs(now - then);
  const isFuture = then > now;
  const prefix = isFuture ? 'in ' : '';
  const suffix = isFuture ? '' : ' ago';
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${prefix}${minutes}m${suffix}`;
  if (hours < 24) return `${prefix}${hours}h${suffix}`;
  return `${prefix}${days}d${suffix}`;
}

function healthBadgeColor(score: number): string {
  if (score >= 0.7) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (score >= 0.4) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function coverageColor(pct: number): string {
  if (pct > 75) return 'text-emerald-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-600';
}

const CONFIDENCE_BUCKETS = [
  { range: '0.0–0.2', min: 0, max: 0.2, color: 'bg-red-400' },
  { range: '0.2–0.4', min: 0.2, max: 0.4, color: 'bg-orange-400' },
  { range: '0.4–0.6', min: 0.4, max: 0.6, color: 'bg-yellow-400' },
  { range: '0.6–0.8', min: 0.6, max: 0.8, color: 'bg-lime-400' },
  { range: '0.8–1.0', min: 0.8, max: 1.0, color: 'bg-emerald-400' },
];

const ACTIVITY_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  timeline: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Timeline' },
  alert:   { color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Alert' },
  inbox:   { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Inbox' },
};

// ─── Component ──────────────────────────────────────
export default function IntelligenceAnalyticsScreen() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceBucket[]>([]);
  const [coverage, setCoverage] = useState<CoverageCategory[]>([]);
  const [sourcePerf, setSourcePerf] = useState<SourcePerformance[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setSectionErrors({});

    const endpoints = [
      { key: 'overview',   url: '/api/g-intel-acquisition/analytics/overview' },
      { key: 'trends',     url: '/api/g-intel-acquisition/analytics/trends?days=30' },
      { key: 'confidence', url: '/api/g-intel-acquisition/analytics/confidence-distribution' },
      { key: 'coverage',   url: '/api/g-intel-acquisition/analytics/knowledge-coverage' },
      { key: 'sourcePerf', url: '/api/g-intel-acquisition/analytics/source-performance' },
      { key: 'activity',   url: '/api/g-intel-acquisition/analytics/activity-feed?limit=10' },
    ];

    const results = await Promise.allSettled(
      endpoints.map(e => fetch(e.url).then(r => {
        if (!r.ok) throw new Error(`${e.key} returned ${r.status}`);
        return r.json();
      }))
    );

    results.forEach((res, i) => {
      const key = endpoints[i].key;
      if (res.status === 'fulfilled') {
        const data = res.value;
        switch (key) {
          case 'overview':   setOverview(data); break;
          case 'trends':     setTrends(Array.isArray(data) ? data : data.trends ?? []); break;
          case 'confidence': setConfidence(Array.isArray(data) ? data : data.buckets ?? []); break;
          case 'coverage':   setCoverage(Array.isArray(data) ? data : data.categories ?? []); break;
          case 'sourcePerf': setSourcePerf(Array.isArray(data) ? data : data.sources ?? []); break;
          case 'activity':   setActivityFeed(Array.isArray(data) ? data : data.items ?? []); break;
        }
      } else {
        setSectionErrors(prev => ({ ...prev, [key]: res.reason?.message ?? 'Failed' }));
      }
    });

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Loading skeleton ─────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Intelligence Analytics</h1>
        </div>
        <p className="text-muted-foreground text-sm">Loading analytics...</p>
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  const maxTrendCount = Math.max(1, ...trends.map(t => t.count));
  const maxConfCount = Math.max(1, ...confidence.map(b => b.count));
  const maxCoverageCount = Math.max(1, ...coverage.map(c => c.count));
  const overallPct = (overview?.coverageScore ?? 0) * 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Intelligence Analytics</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchAll(true)} disabled={refreshing}>
          {refreshing
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <RefreshCw className="h-4 w-4 mr-1.5" />
          }
          Refresh
        </Button>
      </div>

      {/* 6 Stat Cards */}
      {!sectionErrors.overview && overview && (
        <div className="grid grid-cols-6 gap-4">
          {[
            { label: 'Total Objects', value: overview.totalObjects.toLocaleString(), Icon: Layers, color: 'text-blue-600' },
            { label: 'Knowledge Entries', value: overview.knowledgeEntries.toLocaleString(), Icon: Brain, color: 'text-violet-600' },
            { label: 'Active Alerts', value: overview.activeAlerts.toLocaleString(), Icon: AlertTriangle, color: 'text-orange-600' },
            { label: 'Avg Confidence', value: `${(overview.avgConfidence * 100).toFixed(1)}%`, Icon: Shield, color: overview.avgConfidence >= 0.7 ? 'text-emerald-600' : overview.avgConfidence >= 0.4 ? 'text-amber-600' : 'text-red-600' },
            { label: 'Coverage Score', value: `${overallPct.toFixed(1)}%`, Icon: TrendingUp, color: coverageColor(overallPct) },
            { label: 'Activity (24h)', value: overview.activity24h.toLocaleString(), Icon: Zap, color: 'text-sky-600' },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="pt-0 pb-0">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <stat.Icon className={`h-4 w-4 ${stat.color}`} />
                  {stat.label}
                </div>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {sectionErrors.overview && (
        <Card><CardContent className="py-4 text-center text-destructive text-sm">Failed to load overview</CardContent></Card>
      )}

      {/* Acquisition Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Acquisition Trends
          </CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {sectionErrors.trends ? (
            <div className="py-8 text-center text-destructive text-sm">Failed to load trends</div>
          ) : trends.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No acquisition data</div>
          ) : (
            <div className="flex items-end gap-[2px] h-48">
              {trends.map((point, i) => {
                const heightPct = (point.count / maxTrendCount) * 100;
                const dateLabel = new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                    <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {point.count}
                    </span>
                    <div
                      className="w-full bg-sky-500 rounded-t-sm hover:bg-sky-400 transition-colors cursor-default"
                      style={{ height: `${heightPct}%` }}
                      title={`${dateLabel}: ${point.count} records`}
                    />
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                      {new Date(point.date).getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confidence Distribution + Knowledge Coverage */}
      <div className="grid grid-cols-2 gap-4">
        {/* Confidence Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Confidence Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sectionErrors.confidence ? (
              <div className="py-8 text-center text-destructive text-sm">Failed to load</div>
            ) : confidence.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No confidence data</div>
            ) : (
              <div className="space-y-3">
                {CONFIDENCE_BUCKETS.map(bucket => {
                  const matched = confidence.find(
                    b => b.range === bucket.range
                      || (b.min !== undefined && b.max !== undefined && b.min === bucket.min && b.max === bucket.max)
                  );
                  const count = matched?.count ?? 0;
                  const widthPct = (count / maxConfCount) * 100;
                  return (
                    <div key={bucket.range} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-12 text-right shrink-0">{bucket.range}</span>
                      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${bucket.color} rounded-full transition-all`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Knowledge Coverage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Knowledge Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sectionErrors.coverage ? (
              <div className="py-8 text-center text-destructive text-sm">Failed to load</div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <span className={`text-4xl font-bold ${coverageColor(overallPct)}`}>
                    {overallPct.toFixed(1)}%
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">Overall Coverage</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {coverage.map(cat => {
                    const isGap = cat.count === 0;
                    const barPct = (cat.count / maxCoverageCount) * 100;
                    return (
                      <div
                        key={cat.category}
                        className={`p-2 rounded-lg border text-center ${isGap ? 'border-red-300 bg-red-50/50' : 'border-border bg-muted/30'}`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs font-medium truncate">{cat.category}</span>
                          {isGap && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-red-600 border-red-300">
                              Gap
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-bold block my-1">{cat.count}</span>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isGap ? 'bg-red-400' : 'bg-emerald-500'}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Source Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Source Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sectionErrors.sourcePerf ? (
            <div className="py-8 text-center text-destructive text-sm">Failed to load</div>
          ) : sourcePerf.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No source performance data</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connector Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Avg Confidence</TableHead>
                  <TableHead>Last Run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourcePerf.map((src, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{src.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{src.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={healthBadgeColor(src.healthScore)}>
                        {(src.healthScore * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{src.totalRecords.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{(src.avgConfidence * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{relativeTime(src.lastRun)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Activity Feed
          </CardTitle>
          <CardDescription>Latest intelligence activity</CardDescription>
        </CardHeader>
        <CardContent>
          {sectionErrors.activity ? (
            <div className="py-8 text-center text-destructive text-sm">Failed to load</div>
          ) : activityFeed.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No recent activity</div>
          ) : (
            <div className="space-y-2">
              {activityFeed.map((item, i) => {
                const config = ACTIVITY_TYPE_CONFIG[item.type] ?? ACTIVITY_TYPE_CONFIG.timeline;
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <Badge variant="outline" className={config.color}>
                      {config.label}
                    </Badge>
                    <span className="text-sm flex-1">{item.title}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{relativeTime(item.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}