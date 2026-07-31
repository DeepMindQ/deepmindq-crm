'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Zap, Activity, Target, Building2, Clock, Radio,
  Shield, Cpu, HeartPulse, RefreshCw, ArrowUpRight,
  AlertTriangle, TrendingUp, BarChart3, FileText,
  ChevronRight, Globe,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import {
  PageTransition,
  AnimatedCounter,
  StaggerGrid,
  StaggerItem,
  PulseDot,
} from '@/components/ui/animated-components';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { LoadingState } from '@/components/enterprise/LoadingState';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface CommandCenterProps {
  navigateTo?: (screen: string, companyId?: string) => void;
}

interface KPIs {
  totalAccounts: number;
  activeSignals: number;
  avgIntelligenceScore: number;
  pendingActions: number;
}

interface RecentSignal {
  id: string;
  companyId: string;
  companyName: string;
  signalType: string;
  title: string;
  severity: string;
  impact: string;
  confidence: number;
  createdAt: string;
}

interface TopOpportunity {
  id: string;
  companyId: string;
  companyName: string;
  industry: string | null;
  title: string;
  score: number;
  confidence: number;
  priority: string;
  status: string;
  createdAt: string;
}

interface EngineStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
}

interface SystemHealth {
  engines: EngineStatus[];
  aiStatus: 'available' | 'degraded' | 'unavailable';
}

interface IntelligenceFeedItem {
  id: string;
  companyId: string;
  eventType: string;
  title: string;
  description: string;
  createdAt: string;
}

interface MorningBrief {
  greeting: string;
  executiveSummary: string;
  topTargets: unknown[];
  newIntelligence: unknown[];
  actionsDue: unknown[];
}

interface CommandCenterData {
  kpis: KPIs;
  recentSignals: RecentSignal[];
  topOpportunities: TopOpportunity[];
  systemHealth: SystemHealth;
  intelligenceFeed: IntelligenceFeedItem[];
  morningBrief?: MorningBrief;
}

interface ApiResponse {
  success: boolean;
  data: CommandCenterData;
  meta: { endpoint: string; durationMs: number };
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const POLL_INTERVAL = 30_000;

const SEVERITY_STYLES: Record<string, { variant: 'destructive' | 'secondary' | 'outline' | 'default'; className: string }> = {
  critical: { variant: 'destructive', className: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' },
  high: { variant: 'destructive', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30' },
  medium: { variant: 'secondary', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30' },
  low: { variant: 'secondary', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/30' },
};

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const ENGINE_STATUS_COLORS: Record<string, string> = {
  healthy: 'bg-emerald-500 shadow-emerald-500/50',
  degraded: 'bg-amber-500 shadow-amber-500/50',
  unhealthy: 'bg-red-500 shadow-red-500/50',
};

const ENGINE_STATUS_LABEL: Record<string, string> = {
  healthy: 'Operational',
  degraded: 'Degraded',
  unhealthy: 'Down',
};

const AI_STATUS_STYLES: Record<string, { dotColor: string; label: string; textColor: string }> = {
  available: { dotColor: 'bg-emerald-500 shadow-emerald-500/50', label: 'AI Online', textColor: 'text-emerald-400' },
  degraded: { dotColor: 'bg-amber-500 shadow-amber-500/50', label: 'AI Degraded', textColor: 'text-amber-400' },
  unavailable: { dotColor: 'bg-red-500 shadow-red-500/50', label: 'AI Offline', textColor: 'text-red-400' },
};

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function formatTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

/** Morning Brief — AI-generated executive summary card */
function MorningBriefCard({ brief }: { brief: MorningBrief }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="border-slate-700/50 bg-slate-800/80 backdrop-blur-md overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-blue-500/5 pointer-events-none" />
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold text-slate-100">
                {brief.greeting || 'Morning Brief'}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-0.5">
                AI-generated intelligence summary
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-slate-300 leading-relaxed">
            {brief.executiveSummary}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** Single KPI card with animated counter */
function KPICard({
  label,
  value,
  icon: Icon,
  color,
  delay,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <Card className="border-slate-700/50 bg-slate-800/80 backdrop-blur-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                {label}
              </p>
              <p className="text-3xl font-bold tabular-nums" style={{ color }}>
                <AnimatedCounter value={value} />
              </p>
            </div>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${color}15` }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** KPI Skeleton placeholder */
function KPISkeleton() {
  return (
    <Card className="border-slate-700/50 bg-slate-800/80">
      <CardContent className="p-5">
        <Skeleton className="h-3 w-24 rounded bg-slate-700 mb-3" />
        <Skeleton className="h-8 w-16 rounded bg-slate-700" />
      </CardContent>
    </Card>
  );
}

/** Recent Signals Feed — scrollable list with severity badges */
function RecentSignalsFeed({
  signals,
  onNavigate,
}: {
  signals: RecentSignal[];
  onNavigate?: (screen: string, companyId?: string) => void;
}) {
  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Radio className="w-8 h-8 text-slate-600 mb-2" />
        <p className="text-sm text-slate-500">No active signals</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-96">
      <div className="space-y-1.5 pr-3">
        {signals.map((signal, i) => {
          const severityStyle = SEVERITY_STYLES[signal.severity] || SEVERITY_STYLES.low;
          return (
            <motion.div
              key={signal.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className={`group flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                signal.severity === 'critical'
                  ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10'
                  : 'border-slate-700/30 bg-slate-800/40 hover:bg-slate-700/40'
              }`}
              onClick={() => onNavigate?.('company-detail', signal.companyId)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge
                    variant={severityStyle.variant}
                    className={`text-[10px] px-1.5 py-0 h-5 font-medium ${severityStyle.className}`}
                  >
                    {signal.severity}
                  </Badge>
                  <span className="text-xs text-slate-500">{signal.signalType}</span>
                </div>
                <p className="text-sm font-medium text-slate-200 truncate group-hover:text-slate-100 transition-colors">
                  {signal.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-400 truncate">{signal.companyName}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <ConfidenceBar value={signal.confidence} size="sm" className="w-16" />
                <span className="text-[10px] text-slate-500">{formatTimeAgo(signal.createdAt)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

/** Intelligence Feed — timeline of recent events */
function IntelligenceFeedPanel({
  feed,
  onNavigate,
}: {
  feed: IntelligenceFeedItem[];
  onNavigate?: (screen: string, companyId?: string) => void;
}) {
  if (feed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Globe className="w-8 h-8 text-slate-600 mb-2" />
        <p className="text-sm text-slate-500">No recent intelligence</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-80">
      <div className="space-y-0.5 pr-3">
        {feed.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: i * 0.03 }}
            className="group flex gap-3 py-2.5 cursor-pointer"
            onClick={() => onNavigate?.('company-detail', item.companyId)}
          >
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-slate-600 mt-1.5 shrink-0 ring-2 ring-slate-800" />
              {i < feed.length - 1 && <div className="w-px flex-1 bg-slate-700/50 mt-1" />}
            </div>
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-slate-400 border-slate-600/50">
                  {item.eventType}
                </Badge>
                <span className="text-[10px] text-slate-500">{formatTimeAgo(item.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-300 group-hover:text-slate-100 truncate transition-colors">
                {item.title}
              </p>
              {item.description && (
                <p className="text-xs text-slate-500 truncate mt-0.5">{item.description}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}

/** Top Opportunities Table */
function OpportunitiesTable({
  opportunities,
  onNavigate,
}: {
  opportunities: TopOpportunity[];
  onNavigate?: (screen: string, companyId?: string) => void;
}) {
  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Target className="w-8 h-8 text-slate-600 mb-2" />
        <p className="text-sm text-slate-500">No opportunities</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-96">
      <div className="space-y-2 pr-3">
        {opportunities.map((opp, i) => (
          <motion.div
            key={opp.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            className="group flex items-center gap-3 p-3 rounded-lg border border-slate-700/30 bg-slate-800/40 hover:bg-slate-700/40 transition-colors cursor-pointer"
            onClick={() => onNavigate?.('company-detail', opp.companyId)}
          >
            {/* Score ring */}
            <div className="w-11 h-11 rounded-full border-2 border-slate-600 flex items-center justify-center shrink-0 group-hover:border-amber-500/50 transition-colors">
              <span className="text-sm font-bold tabular-nums text-slate-200">{opp.score}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-slate-200 truncate group-hover:text-slate-100 transition-colors">
                  {opp.companyName}
                </p>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${
                    PRIORITY_STYLES[opp.priority] || PRIORITY_STYLES.medium
                  }`}
                >
                  {opp.priority}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 truncate">{opp.title}</p>
              <div className="flex items-center gap-3 mt-1">
                {opp.industry && (
                  <span className="text-[11px] text-slate-500">{opp.industry}</span>
                )}
                <span className="text-[11px] text-slate-500 capitalize">{opp.status.replace(/_/g, ' ')}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <ConfidenceBar value={opp.confidence} size="sm" className="w-14" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}

/** System Health Panel — engine status dots + AI status */
function SystemHealthPanel({ health }: { health: SystemHealth }) {
  const healthyCount = health.engines.filter(e => e.status === 'healthy').length;
  const aiStyle = AI_STATUS_STYLES[health.aiStatus] || AI_STATUS_STYLES.unavailable;

  return (
    <div className="space-y-4">
      {/* AI Status banner */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-700/30 bg-slate-800/40">
        <span className={`w-2.5 h-2.5 rounded-full ${aiStyle.dotColor} shadow-sm`} />
        <span className={`text-sm font-medium ${aiStyle.textColor}`}>{aiStyle.label}</span>
        <span className="text-xs text-slate-500 ml-auto">24h governance</span>
      </div>

      <Separator className="bg-slate-700/30" />

      {/* Engine grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Engines</span>
          <span className="text-xs text-slate-500">
            {healthyCount}/{health.engines.length} operational
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {health.engines.map((engine) => (
            <div
              key={engine.name}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-700/30 bg-slate-800/40"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 shadow-sm ${ENGINE_STATUS_COLORS[engine.status]}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">{engine.name}</p>
                <p className="text-[10px] text-slate-500">{ENGINE_STATUS_LABEL[engine.status]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** System Health skeleton */
function SystemHealthSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-lg bg-slate-700" />
      <Separator className="bg-slate-700/30" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg bg-slate-700" />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function CommandCenterScreen({ navigateTo }: CommandCenterProps) {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitRetry, setRateLimitRetry] = useState(0);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInsights = useCallback(async (isPoll = false) => {
    // Don't overlay loading state on polling fetches
    if (!isPoll) setLoading(true);
    setError(null);
    setRateLimited(false);

    const { data: responseData, error: fetchError } = await fetchApi<ApiResponse>(
      '/api/command-center/insights',
    );

    if (fetchError) {
      if (fetchError.includes('429') || fetchError.includes('Rate limit')) {
        setRateLimited(true);
        setRateLimitRetry(30); // Default 30s retry
        setError(null);
      } else {
        setError(fetchError);
      }
      setLoading(false);
      return;
    }

    if (responseData && responseData.success && responseData.data) {
      setData(responseData.data);
      setLastFetched(new Date());
    } else {
      setError('Unexpected response format from command center API.');
    }

    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchInsights(false);

    // Start polling every 30s
    pollRef.current = setInterval(() => {
      fetchInsights(true);
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchInsights]);

  // Rate limit countdown timer
  useEffect(() => {
    if (!rateLimited || rateLimitRetry <= 0) return;

    retryTimerRef.current = setTimeout(() => {
      setRateLimitRetry(prev => {
        if (prev <= 1) {
          setRateLimited(false);
          fetchInsights(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [rateLimited, rateLimitRetry, fetchInsights]);

  const handleRefresh = useCallback(() => {
    if (rateLimited) return;
    fetchInsights(false);
  }, [fetchInsights, rateLimited]);

  /* ── Render: Error ── */
  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-6 lg:p-8">
        <ErrorState
          title="Command Center Unavailable"
          message={error}
          onRetry={handleRefresh}
          className="bg-slate-900 rounded-xl border border-slate-800"
        />
      </div>
    );
  }

  /* ── Render: Loading (first load) ── */
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-6 lg:p-8">
        <PageTransition>
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-7 w-48 rounded bg-slate-800" />
                <Skeleton className="h-4 w-64 rounded bg-slate-800" />
              </div>
              <Skeleton className="h-9 w-24 rounded-lg bg-slate-800" />
            </div>
            {/* KPI skeleton grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <KPISkeleton key={i} />
              ))}
            </div>
            {/* Main content skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <LoadingState message="Loading signals…" lines={4} className="rounded-xl border border-slate-800 bg-slate-900" />
                <LoadingState message="Loading feed…" lines={3} className="rounded-xl border border-slate-800 bg-slate-900" />
              </div>
              <div className="space-y-6">
                <LoadingState message="Loading opportunities…" lines={5} className="rounded-xl border border-slate-800 bg-slate-900" />
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                  <SystemHealthSkeleton />
                </div>
              </div>
            </div>
          </div>
        </PageTransition>
      </div>
    );
  }

  if (!data) return null;

  /* ── Render: Main Dashboard ── */
  return (
    <div className="min-h-screen bg-slate-950">
      <PageTransition>
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-blue-500/10 border border-amber-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                  Command Center
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <PulseDot color="var(--color-gold)" />
                  <span className="text-xs text-slate-500">
                    Live Intelligence Feed
                    {lastFetched && (
                      <> · Updated {formatTimeAgo(lastFetched.toISOString())}</>
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {rateLimited && (
                <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 bg-amber-500/10">
                  <Clock className="w-3 h-3 mr-1" />
                  Retry in {rateLimitRetry}s
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading || rateLimited}
                className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100 bg-slate-800/50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </motion.div>

          {/* ── Morning Brief (optional) ── */}
          <AnimatePresence>
            {data.morningBrief && data.morningBrief.executiveSummary && (
              <MorningBriefCard brief={data.morningBrief} />
            )}
          </AnimatePresence>

          {/* ── KPI Grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total Accounts"
              value={data.kpis.totalAccounts}
              icon={Building2}
              color="#E8C860"
              delay={0.05}
            />
            <KPICard
              label="Active Signals"
              value={data.kpis.activeSignals}
              icon={Radio}
              color="#F87171"
              delay={0.1}
            />
            <KPICard
              label="Avg. Intel Score"
              value={data.kpis.avgIntelligenceScore}
              icon={TrendingUp}
              color="#34D399"
              delay={0.15}
            />
            <KPICard
              label="Pending Actions"
              value={data.kpis.pendingActions}
              icon={Target}
              color="#60A5FA"
              delay={0.2}
            />
          </div>

          {/* ── Main Content: 2-Column Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <StaggerGrid className="space-y-6" stagger={0.08} delay={0.15}>
              {/* Recent Signals */}
              <StaggerItem>
                <Card className="border-slate-700/50 bg-slate-800/80 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-red-400" />
                        <CardTitle className="text-sm font-semibold text-slate-200">
                          Recent Signals
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600/50">
                        {data.recentSignals.length} active
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <RecentSignalsFeed signals={data.recentSignals} onNavigate={navigateTo} />
                  </CardContent>
                </Card>
              </StaggerItem>

              {/* Intelligence Feed */}
              <StaggerItem>
                <Card className="border-slate-700/50 bg-slate-800/80 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-blue-400" />
                        <CardTitle className="text-sm font-semibold text-slate-200">
                          Intelligence Feed
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600/50">
                        {data.intelligenceFeed.length} events
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <IntelligenceFeedPanel feed={data.intelligenceFeed} onNavigate={navigateTo} />
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerGrid>

            {/* Right Column */}
            <StaggerGrid className="space-y-6" stagger={0.08} delay={0.25}>
              {/* Top Opportunities */}
              <StaggerItem>
                <Card className="border-slate-700/50 bg-slate-800/80 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Target className="w-4 h-4 text-amber-400" />
                        <CardTitle className="text-sm font-semibold text-slate-200">
                          Top Opportunities
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600/50">
                        {data.topOpportunities.length} targets
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <OpportunitiesTable opportunities={data.topOpportunities} onNavigate={navigateTo} />
                  </CardContent>
                </Card>
              </StaggerItem>

              {/* System Health */}
              <StaggerItem>
                <Card className="border-slate-700/50 bg-slate-800/80 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                      <CardTitle className="text-sm font-semibold text-slate-200">
                        System Health
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <SystemHealthPanel health={data.systemHealth} />
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerGrid>
          </div>

          {/* ── Error banner (non-blocking, shown below content) ── */}
          <AnimatePresence>
            {error && data && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-sm text-amber-300">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    className="ml-auto text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Retry
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PageTransition>
    </div>
  );
}
