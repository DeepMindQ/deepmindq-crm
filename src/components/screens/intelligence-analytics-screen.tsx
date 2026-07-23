'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, Shield, Brain, Activity, Zap,
  Layers, Clock, RefreshCw, Loader2, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { LoadingState } from '@/components/enterprise/LoadingState';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { EmptyState } from '@/components/shared/design-system';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
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
  { range: '0-20%', min: 0, max: 0.2, color: '#EF4444' },
  { range: '20-40%', min: 0.2, max: 0.4, color: '#F97316' },
  { range: '40-60%', min: 0.4, max: 0.6, color: '#F59E0B' },
  { range: '60-80%', min: 0.6, max: 0.8, color: '#84CC16' },
  { range: '80-100%', min: 0.8, max: 1.0, color: '#10B981' },
];

const DONUT_COLORS = ['#2563EB', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#06B6D4'];

const ACTIVITY_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  timeline: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Timeline' },
  alert:   { color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Alert' },
  inbox:   { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Inbox' },
};

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-700">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
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
    if (isRefresh) setRefreshing(true); else setLoading(true);
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

    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAll().catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const overallPct = (overview?.coverageScore ?? 0) * 100;

  // Prepare chart data
  const confidenceChartData = CONFIDENCE_BUCKETS.map(bucket => {
    const matched = confidence.find(b =>
      b.range === bucket.range || (b.min !== undefined && b.max !== undefined && b.min === bucket.min && b.max === bucket.max)
    );
    return { name: bucket.range, count: matched?.count ?? 0, fill: bucket.color };
  });

  const coverageChartData = coverage.map(cat => ({ name: cat.category, value: cat.count }));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Intelligence Analytics</h2>
            <p className="text-sm text-slate-500">Quality metrics, trends, and source performance</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchAll(true)} disabled={refreshing}
          className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      {sectionErrors.overview ? (
        <ErrorState message="Failed to load overview data" onRetry={() => fetchAll(true)} />
      ) : overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Objects', value: overview.totalObjects.toLocaleString(), Icon: Layers, color: 'text-blue-600' },
            { label: 'Knowledge', value: overview.knowledgeEntries.toLocaleString(), Icon: Brain, color: 'text-violet-600' },
            { label: 'Active Alerts', value: overview.activeAlerts.toLocaleString(), Icon: AlertTriangle, color: 'text-orange-600' },
            { label: 'Avg Confidence', value: `${(overview.avgConfidence * 100).toFixed(1)}%`, Icon: Shield, color: overview.avgConfidence >= 0.7 ? 'text-emerald-600' : 'text-amber-600' },
            { label: 'Coverage', value: `${overallPct.toFixed(1)}%`, Icon: TrendingUp, color: coverageColor(overallPct) },
            { label: 'Activity (24h)', value: overview.activity24h.toLocaleString(), Icon: Zap, color: 'text-sky-600' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <stat.Icon className={cn('h-4 w-4', stat.color)} />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{stat.label}</p>
              <p className={cn('text-xl font-bold mt-0.5', stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Acquisition Trends (Line Chart) ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Acquisition Trends</h3>
            <Badge variant="outline" className="text-[10px] bg-slate-50">Last 30 days</Badge>
          </div>
        </div>
        <div className="p-4">
          {sectionErrors.trends ? (
            <ErrorState message="Failed to load trends" />
          ) : trends.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No trend data" description="Acquisition trend data will appear here." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trends} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickFormatter={(v: string) => new Date(v).getDate().toString()} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <Tooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2}
                  dot={false} activeDot={{ r: 4, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Confidence Distribution + Coverage By Entity Type ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Confidence Distribution (Bar Chart) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">Confidence Distribution</h3>
            </div>
          </div>
          <div className="p-4">
            {sectionErrors.confidence ? (
              <ErrorState message="Failed to load" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={confidenceChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {confidenceChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Coverage by Entity Type (Donut Chart) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">Coverage by Entity Type</h3>
              </div>
              <Badge variant="outline" className={cn('text-xs', overallPct > 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
                {overallPct.toFixed(1)}% overall
              </Badge>
            </div>
          </div>
          <div className="p-4">
            {sectionErrors.coverage ? (
              <ErrorState message="Failed to load" />
            ) : coverage.length === 0 ? (
              <EmptyState icon={Layers} title="No coverage data" description="Coverage data will populate as intelligence is acquired." />
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={coverageChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {coverageChartData.map((_, idx) => (
                        <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {coverageChartData.map((cat, idx) => (
                    <div key={cat.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                      <span className="text-slate-600 flex-1 truncate">{cat.name}</span>
                      <span className="font-semibold text-slate-700">{cat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Source Reliability (Horizontal Bar) ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Source Reliability</h3>
          </div>
        </div>
        <div className="p-4">
          {sectionErrors.sourcePerf ? (
            <ErrorState message="Failed to load" />
          ) : sourcePerf.length === 0 ? (
            <EmptyState icon={Activity} title="No source data" description="Source performance data will appear here." />
          ) : (
            <div className="space-y-3">
              {sourcePerf.map((src) => {
                const relPct = Math.round(src.healthScore * 100);
                return (
                  <div key={src.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">{src.name}</span>
                        <Badge variant="outline" className="text-[10px] bg-slate-50">{src.type}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{relativeTime(src.lastRun)}</span>
                        <Badge variant="outline" className={cn('text-[10px]', healthBadgeColor(src.healthScore))}>
                          {relPct}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          src.healthScore >= 0.7 ? 'bg-emerald-500' : src.healthScore >= 0.4 ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        style={{ width: `${relPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Activity Feed ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Activity Feed</h3>
            <Badge variant="outline" className="text-[10px] bg-slate-50">Latest</Badge>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {sectionErrors.activity ? (
            <div className="p-4"><ErrorState message="Failed to load" /></div>
          ) : activityFeed.length === 0 ? (
            <div className="p-8"><EmptyState icon={Clock} title="No recent activity" description="Recent intelligence activity will appear here." /></div>
          ) : (
            activityFeed.map((item, i) => {
              const config = ACTIVITY_TYPE_CONFIG[item.type] ?? ACTIVITY_TYPE_CONFIG.timeline;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <Badge variant="outline" className={cn('text-[10px]', config.color)}>{config.label}</Badge>
                  <span className="text-sm flex-1 text-slate-700">{item.title}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{relativeTime(item.timestamp)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
