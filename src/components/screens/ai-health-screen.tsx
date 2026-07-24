'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Activity,
  Target,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Timer,
  TrendingUp,
  BarChart3,
  Shield,
  RefreshCw,
  Eye,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  PageTransition,
  AnimatedCard,
  StatCard,
  AnimatedCounter,
  AnimatedBar,
  SectionHeader,
  StaggerGrid,
  StaggerItem,
  PulseDot,
  EmptyState,
} from '@/components/ui/animated-components';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

interface Overview {
  totalInsights: number;
  activeInsights: number;
  expiredInsights: number;
  recentInsights: number;
  approvalRate: number;
}

interface Quality {
  avgConfidence: number;
  avgImpact: number;
  highUrgencyCount: number;
  expiringSoon: number;
}

interface TypeBreakdown {
  type: string;
  count: number;
  avgConfidence: number;
  avgImpact: number;
}

interface RouteUsage {
  route: string;
  count: number;
}

interface AIHealthData {
  overview: Overview;
  quality: Quality;
  byType: TypeBreakdown[];
  usageByRoute: RouteUsage[];
}

/* ═══════════════════════════════════════════════════
   Type Color Map
   ═══════════════════════════════════════════════════ */

const TYPE_COLORS: Record<string, { bar: string; bg: string; text: string; dot: string }> = {
  SIGNAL:        { bar: '#3B82F6', bg: 'rgba(59,130,246,0.10)',  text: 'text-blue-400',     dot: 'bg-blue-500'   },
  RISK:          { bar: '#EF4444', bg: 'rgba(239,68,68,0.10)',   text: 'text-red-400',      dot: 'bg-red-500'    },
  OPPORTUNITY:   { bar: '#10B981', bg: 'rgba(16,185,129,0.10)',  text: 'text-emerald-400',  dot: 'bg-emerald-500' },
  RECOMMENDATION:{ bar: '#A855F7', bg: 'rgba(168,85,247,0.10)',  text: 'text-purple-400',   dot: 'bg-purple-500'  },
  SCORING:       { bar: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  text: 'text-amber-400',    dot: 'bg-amber-500'   },
  FORECAST:      { bar: '#06B6D4', bg: 'rgba(6,182,212,0.10)',   text: 'text-cyan-400',     dot: 'bg-cyan-500'    },
};

const DEFAULT_TYPE_COLOR = { bar: '#6B7280', bg: 'rgba(107,114,128,0.10)', text: 'text-gray-400', dot: 'bg-gray-500' };

function getTypeColor(type: string) {
  return TYPE_COLORS[type.toUpperCase()] ?? DEFAULT_TYPE_COLOR;
}

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

function pct(val: number, max = 100): number {
  return max > 0 ? Math.round((val / max) * 100) : 0;
}

function formatRoute(route: string): string {
  if (!route) return 'Unknown';
  return route.replace(/^\/api\/ai\//, '').replace(/\//g, ' → ');
}

/* ═══════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════ */

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

export default function AIHealthScreen({
  navigateTo,
}: {
  navigateTo?: (screen: string) => void;
}) {
  const [data, setData] = useState<AIHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/health');
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="p-6" style={{ background: 'var(--color-bg-dark, #0f1117)' }}>
        <LoadingSkeleton />
      </div>
    );
  }

  /* ── Error ── */
  if (error && !data) {
    return (
      <div className="p-6" style={{ background: 'var(--color-bg-dark, #0f1117)' }}>
        <EmptyState
          icon={AlertTriangle}
          title="Unable to load AI health data"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={fetchHealth} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) return null;

  const { overview, quality, byType, usageByRoute } = data;
  const maxTypeCount = byType.length > 0 ? Math.max(...byType.map(t => t.count)) : 1;
  const maxRouteCount = usageByRoute.length > 0 ? Math.max(...usageByRoute.map(r => r.count)) : 1;

  /* ── Stat Card configs ── */
  const statCards = [
    {
      label: 'Active Insights',
      value: overview.activeInsights,
      icon: Eye,
      color: 'var(--color-gold)',
    },
    {
      label: 'Avg Confidence',
      value: `${Math.round(quality.avgConfidence * 10)}%`,
      icon: Target,
      color: quality.avgConfidence >= 0.7 ? '#10B981' : quality.avgConfidence >= 0.4 ? '#F59E0B' : '#EF4444',
    },
    {
      label: 'Avg Impact Score',
      value: `${Math.round(quality.avgImpact * 10)}%`,
      icon: TrendingUp,
      color: quality.avgImpact >= 0.7 ? '#06B6D4' : quality.avgImpact >= 0.4 ? '#A855F7' : '#6B7280',
    },
    {
      label: 'Approval Rate',
      value: `${overview.approvalRate}%`,
      icon: CheckCircle2,
      color: overview.approvalRate >= 80 ? '#10B981' : overview.approvalRate >= 50 ? '#F59E0B' : '#EF4444',
    },
  ];

  return (
    <div className="p-4 sm:p-6" style={{ minHeight: '100vh' }}>
    <PageTransition>
      <div className="space-y-6">

        {/* ═══════════════════════════════════════════
            Header
            ═══════════════════════════════════════════ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))',
                border: '1px solid rgba(212, 175, 55, 0.25)',
              }}
            >
              <Brain className="h-5 w-5" style={{ color: 'var(--color-gold)' }} />
            </motion.div>
            <div>
              <h2
                className="text-xl font-bold tracking-tight"
                style={{
                  color: 'var(--color-gold-bright, #E8C860)',
                }}
              >
                AI Intelligence Health
              </h2>
              <p className="text-sm text-muted-foreground">
                Monitor AI quality, performance, and trust metrics
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* ═══════════════════════════════════════════
            Top Stats Row
            ═══════════════════════════════════════════ */}
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.08}>
          {statCards.map((stat) => (
            <StaggerItem key={stat.label}>
              <StatCard
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
              />
            </StaggerItem>
          ))}
        </StaggerGrid>

        {/* ═══════════════════════════════════════════
            Quality Metrics + System Alerts (2-col)
            ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Insights by Type ── */}
          <AnimatedCard delay={0.15}>
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: 'var(--color-gold)' }} />
                  Insights by Type
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribution across AI insight categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                {byType.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Sparkles className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No insights generated yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      AI insights will appear here once signals are processed
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {byType.map((item, idx) => {
                      const colors = getTypeColor(item.type);
                      return (
                        <motion.div
                          key={item.type}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.2 + idx * 0.06 }}
                          className="group"
                        >
                          <div className="flex items-center gap-3">
                            {/* Type name */}
                            <div className="w-28 sm:w-32 shrink-0 flex items-center gap-2">
                              <div
                                className={cn('w-2 h-2 rounded-full', colors.dot)}
                                style={{ boxShadow: `0 0 6px ${colors.bar}80` }}
                              />
                              <span className={cn('text-xs font-medium', colors.text)}>
                                {item.type}
                              </span>
                            </div>

                            {/* Bar */}
                            <div className="flex-1 h-6 rounded-md overflow-hidden relative"
                              style={{ background: 'rgba(255,255,255,0.04)' }}
                            >
                              <motion.div
                                className="h-full rounded-md relative"
                                style={{ background: `linear-gradient(90deg, ${colors.bar}CC, ${colors.bar}88)` }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct(item.count, maxTypeCount)}%` }}
                                transition={{ duration: 0.8, delay: 0.3 + idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <div
                                  className="absolute inset-0 rounded-md opacity-40"
                                  style={{ boxShadow: `0 0 10px ${colors.bar}60` }}
                                />
                              </motion.div>
                            </div>

                            {/* Count + confidence */}
                            <div className="w-16 sm:w-20 shrink-0 text-right">
                              <span className="text-xs font-bold text-foreground">
                                {item.count}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1">
                                {Math.round(item.avgConfidence * 100)}%
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Legend row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-border/50 mt-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mr-1">Legend:</span>
                      {Object.entries(TYPE_COLORS).map(([type, c]) => (
                        <div key={type} className="flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full', c.dot)} />
                          <span className={cn('text-[10px]', c.text)}>{type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </AnimatedCard>

          {/* ── System Alerts ── */}
          <AnimatedCard delay={0.2}>
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" style={{ color: 'var(--color-gold)' }} />
                  System Alerts
                </CardTitle>
                <CardDescription className="text-xs">
                  Urgent insights, expiry warnings, and recent activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* High Urgency */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: quality.highUrgencyCount > 0
                        ? 'rgba(239, 68, 68, 0.08)'
                        : 'rgba(16, 185, 129, 0.05)',
                      border: `1px solid ${quality.highUrgencyCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.1)'}`,
                    }}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        quality.highUrgencyCount > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10',
                      )}
                    >
                      <AlertTriangle
                        className={cn(
                          'h-4 w-4',
                          quality.highUrgencyCount > 0 ? 'text-red-400' : 'text-emerald-400',
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground">High Urgency</p>
                        {quality.highUrgencyCount > 0 && <PulseDot color="#EF4444" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {quality.highUrgencyCount > 0
                          ? `${quality.highUrgencyCount} insight${quality.highUrgencyCount !== 1 ? 's' : ''} require immediate attention`
                          : 'No high-urgency insights'}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] shrink-0',
                        quality.highUrgencyCount > 0
                          ? 'border-red-500/20 bg-red-500/10 text-red-400'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
                      )}
                    >
                      {quality.highUrgencyCount}
                    </Badge>
                  </motion.div>

                  {/* Expiring Soon */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: quality.expiringSoon > 0
                        ? 'rgba(245, 158, 11, 0.08)'
                        : 'rgba(16, 185, 129, 0.05)',
                      border: `1px solid ${quality.expiringSoon > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.1)'}`,
                    }}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        quality.expiringSoon > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
                      )}
                    >
                      <Timer
                        className={cn(
                          'h-4 w-4',
                          quality.expiringSoon > 0 ? 'text-amber-400' : 'text-emerald-400',
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground">Expiring Soon</p>
                        {quality.expiringSoon > 0 && <PulseDot color="#F59E0B" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {quality.expiringSoon > 0
                          ? `${quality.expiringSoon} insight${quality.expiringSoon !== 1 ? 's' : ''} expiring within 24h`
                          : 'No insights expiring soon'}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] shrink-0',
                        quality.expiringSoon > 0
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
                      )}
                    >
                      {quality.expiringSoon}
                    </Badge>
                  </motion.div>

                  {/* Recent Insights */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: 'rgba(59, 130, 246, 0.06)',
                      border: '1px solid rgba(59, 130, 246, 0.1)',
                    }}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                      <Clock className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Recent Activity</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {overview.recentInsights} insight{overview.recentInsights !== 1 ? 's' : ''} generated in the last 7 days
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0 border-blue-500/20 bg-blue-500/10 text-blue-400"
                    >
                      {overview.recentInsights}
                    </Badge>
                  </motion.div>

                  {/* Total / Expired summary */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.45 }}
                    className="grid grid-cols-3 gap-3"
                  >
                    <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-lg font-bold text-foreground">
                        <AnimatedCounter value={overview.totalInsights} />
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)' }}>
                      <p className="text-lg font-bold" style={{ color: 'var(--color-gold)' }}>
                        <AnimatedCounter value={overview.activeInsights} />
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active</p>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-lg font-bold text-muted-foreground">
                        <AnimatedCounter value={overview.expiredInsights} />
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Expired</p>
                    </div>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </div>

        {/* ═══════════════════════════════════════════
            Usage by Route
            ═══════════════════════════════════════════ */}
        <AnimatedCard delay={0.25}>
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: 'var(--color-gold)' }} />
                Usage by Route
              </CardTitle>
              <CardDescription className="text-xs">
                API routes generating the most AI insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageByRoute.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No route usage data yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Insights generated through AI routes will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {usageByRoute
                    .sort((a, b) => b.count - a.count)
                    .map((item, idx) => {
                      const widthPct = pct(item.count, maxRouteCount);
                      const isTop = idx === 0;
                      return (
                        <motion.div
                          key={item.route}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.3 + idx * 0.04 }}
                          className="flex items-center gap-3 group"
                        >
                          {/* Rank */}
                          <div className="w-5 shrink-0 text-center">
                            <span
                              className={cn(
                                'text-[10px] font-bold',
                                isTop ? '' : 'text-muted-foreground',
                              )}
                              style={isTop ? { color: 'var(--color-gold)' } : undefined}
                            >
                              {idx + 1}
                            </span>
                          </div>

                          {/* Route name */}
                          <div className="w-36 sm:w-48 shrink-0">
                            <span className="text-xs font-mono text-foreground/80 truncate block">
                              {formatRoute(item.route)}
                            </span>
                          </div>

                          {/* Bar */}
                          <div className="flex-1 h-5 rounded-md overflow-hidden relative"
                            style={{ background: 'rgba(255,255,255,0.04)' }}
                          >
                            <motion.div
                              className="h-full rounded-md"
                              style={{
                                background: isTop
                                  ? 'linear-gradient(90deg, var(--color-gold), rgba(212,175,55,0.7))'
                                  : 'linear-gradient(90deg, rgba(107,114,128,0.5), rgba(107,114,128,0.3))',
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ duration: 0.7, delay: 0.35 + idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
                            />
                          </div>

                          {/* Count */}
                          <div className="w-12 shrink-0 text-right">
                            <span className={cn('text-xs font-bold', isTop ? '' : 'text-muted-foreground')}
                              style={isTop ? { color: 'var(--color-gold)' } : undefined}
                            >
                              {item.count}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedCard>

        {/* ═══════════════════════════════════════════
            Quality Trust Summary Bar
            ═══════════════════════════════════════════ */}
        <AnimatedCard delay={0.3}>
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4" style={{ color: 'var(--color-gold)' }} />
                AI Quality Trust Indicators
              </CardTitle>
              <CardDescription className="text-xs">
                Confidence and impact score averages for active insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Confidence Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Target className="h-3 w-3" style={{ color: 'var(--color-gold)' }} />
                      Confidence
                    </span>
                    <span
                      className={cn(
                        'text-sm font-bold',
                        quality.avgConfidence >= 0.7 ? 'text-emerald-400' :
                        quality.avgConfidence >= 0.4 ? 'text-amber-400' : 'text-red-400',
                      )}
                    >
                      {Math.round(quality.avgConfidence * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: quality.avgConfidence >= 0.7
                          ? 'linear-gradient(90deg, #10B981, #34D399)'
                          : quality.avgConfidence >= 0.4
                          ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                          : 'linear-gradient(90deg, #EF4444, #F87171)',
                        boxShadow: quality.avgConfidence >= 0.7
                          ? '0 0 8px rgba(16,185,129,0.4)'
                          : 'none',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(quality.avgConfidence * 100)}%` }}
                      transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    {quality.avgConfidence >= 0.8 ? 'Excellent — high trust in AI outputs' :
                     quality.avgConfidence >= 0.6 ? 'Good — reliable AI performance' :
                     quality.avgConfidence >= 0.4 ? 'Fair — review recommended' :
                     'Low — significant human review needed'}
                  </p>
                </div>

                {/* Impact Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3" style={{ color: 'var(--color-gold)' }} />
                      Impact Score
                    </span>
                    <span
                      className={cn(
                        'text-sm font-bold',
                        quality.avgImpact >= 0.7 ? 'text-cyan-400' :
                        quality.avgImpact >= 0.4 ? 'text-purple-400' : 'text-muted-foreground',
                      )}
                    >
                      {Math.round(quality.avgImpact * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: quality.avgImpact >= 0.7
                          ? 'linear-gradient(90deg, #06B6D4, #22D3EE)'
                          : quality.avgImpact >= 0.4
                          ? 'linear-gradient(90deg, #A855F7, #C084FC)'
                          : 'linear-gradient(90deg, #6B7280, #9CA3AF)',
                        boxShadow: quality.avgImpact >= 0.7
                          ? '0 0 8px rgba(6,182,212,0.4)'
                          : 'none',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(quality.avgImpact * 100)}%` }}
                      transition={{ duration: 1, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    {quality.avgImpact >= 0.8 ? 'High — insights driving significant decisions' :
                     quality.avgImpact >= 0.6 ? 'Moderate — meaningful business impact' :
                     quality.avgImpact >= 0.4 ? 'Low — insights need deeper analysis' :
                     'Minimal — consider refining AI prompts'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>

      </div>
    </PageTransition>
    </div>
  );
}
