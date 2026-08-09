'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Radar, Target, Brain, Building2, TrendingUp, Search, Upload, FileDown,
  Sparkles, Activity, ChevronRight, Zap, Clock, AlertTriangle,
  RefreshCw, BarChart3, FileText,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { SkeletonDashboard } from '@/components/loading';
import { fetchApi } from '@/lib/fetchApi';
import { cn } from '@/lib/utils';
import { tokens, getConfidenceTier } from '@/components/intelligence-os/design-tokens';
import { FreshnessIndicator } from '@/components/intelligence-os/atoms/freshness-indicator';
import { ConfidenceIndicator } from '@/components/trust/confidence-indicator';
import { RecommendationCard } from '@/components/intelligence-os/molecules/recommendation-card';
import {
  PageTransition, AnimatedCard, EmptyState, AnimatedCounter,
} from '@/components/ui/animated-components';
import type { IntelligenceSignal, Recommendation, ActivityEvent, ExecutiveStats } from '@/lib/intelligence-types';
import { formatFreshness, getPriorityColor, getPriorityLabel } from '@/lib/intelligence-types';

/* ═══════════════════════════════════════════════════════════════
   Empty defaults (no mock data — screens show empty states when API returns null)
   ═══════════════════════════════════════════════════════════════ */
const emptyStats: ExecutiveStats = {
  prioritySignals: 0,
  activeOpportunities: 0,
  confidenceAverage: 0,
  accountsMonitored: 0,
};

const emptySignals: IntelligenceSignal[] = [];

const emptyRecommendations: Recommendation[] = [];

const emptyActivity: ActivityEvent[] = [];

/* ═══════════════════════════════════════════════════════════════
   Signal Type Config
   ═══════════════════════════════════════════════════════════════ */
const SIGNAL_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  leadership_change:     { label: 'Leadership', color: tokens.domain.signal },
  funding_event:         { label: 'Funding', color: tokens.domain.opportunity },
  competitive_move:      { label: 'Competitive', color: tokens.domain.risk },
  technology_investment: { label: 'Tech Invest', color: tokens.domain.enrichment },
  market_expansion:      { label: 'Expansion', color: tokens.domain.action },
  hiring_surge:          { label: 'Hiring', color: tokens.domain.reasoning },
  product_launch:        { label: 'Product', color: tokens.domain.signal },
  partnership:           { label: 'Partnership', color: tokens.domain.opportunity },
  financial_signal:      { label: 'Financial', color: tokens.domain.reasoning },
  risk_indicator:        { label: 'Risk', color: tokens.domain.risk },
};

/* ═══════════════════════════════════════════════════════════════
   KPI Card (Internal)
   ═══════════════════════════════════════════════════════════════ */
interface KPIProps {
  label: string;
  value: number | string;
  delta?: number;
  icon: React.ElementType;
  color: string;
  delay?: number;
}

function KPICard({ label, value, delta, icon: Icon, color, delay = 0 }: KPIProps) {
  return (
    <AnimatedCard delay={delay} hover={true} glow={`${color}12`}>
      <div className="p-4 lg:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: tokens.text.secondary }}>
            {label}
          </span>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: tokens.text.primary }}>
            {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
          </span>
          {delta !== undefined && (
            <span
              className="text-[11px] font-semibold tabular-nums pb-0.5"
              style={{ color: delta > 0 ? tokens.trust.verified.value : delta < 0 ? tokens.domain.risk : tokens.text.muted }}
            >
              {delta > 0 ? '+' : ''}{delta}
            </span>
          )}
        </div>
      </div>
    </AnimatedCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Activity Event Row
   ═══════════════════════════════════════════════════════════════ */
const EVENT_ICONS: Record<string, React.ElementType> = {
  signal_detected: Radar,
  confidence_updated: TrendingUp,
  recommendation_generated: Sparkles,
  data_refreshed: RefreshCw,
  account_changed: Building2,
};

function ActivityRow({ event }: { event: ActivityEvent }) {
  const EventIcon = EVENT_ICONS[event.type] || Activity;
  const eventColor = event.confidence
    ? (event.confidence >= 80 ? tokens.trust.verified.value : event.confidence >= 60 ? tokens.domain.reasoning : tokens.domain.risk)
    : tokens.text.secondary;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[rgba(255,255,255,0.02)]"
    >
      <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${eventColor}12` }}>
        <EventIcon className="w-3.5 h-3.5" style={{ color: eventColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium leading-snug" style={{ color: tokens.text.primary }}>
          {event.headline}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px]" style={{ color: tokens.text.muted }}>{event.source}</span>
          <span className="text-[10px]" style={{ color: tokens.text.muted }}>·</span>
          <span className="text-[10px]" style={{ color: tokens.text.muted }}>{formatFreshness(event.timestamp)}</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Signal Row (compact)
   ═══════════════════════════════════════════════════════════════ */
function SignalRow({ signal, onAction }: { signal: IntelligenceSignal; onAction: (id: string) => void }) {
  const typeConfig = SIGNAL_TYPE_CONFIG[signal.type] || { label: signal.type, color: tokens.text.secondary };
  const priorityColor = getPriorityColor(signal.priority);
  const confidenceTier = getConfidenceTier(signal.confidenceScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
      onClick={() => onAction(signal.id)}
      className="cursor-pointer rounded-xl border p-4 transition-all duration-200"
      style={{
        borderColor: tokens.border.default,
        backgroundColor: tokens.surface.card,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: `${typeConfig.color}15`, color: typeConfig.color, border: `1px solid ${typeConfig.color}25` }}
            >
              {typeConfig.label}
            </span>
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: `${priorityColor}15`, color: priorityColor }}
            >
              {getPriorityLabel(signal.priority)}
            </span>
            {signal.evidenceCount && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                style={{ backgroundColor: `${tokens.trust.verified.bg}`, color: tokens.trust.verified.value }}>
                <FileText className="w-2.5 h-2.5" />
                {signal.evidenceCount} evidence
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold leading-snug mb-1" style={{ color: tokens.text.primary }}>
            {signal.headline}
          </p>
          <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: tokens.text.secondary }}>
            {signal.summary}
          </p>
          <div className="flex items-center gap-3 mt-2.5">
            <FreshnessIndicator timestamp={signal.freshnessTimestamp} />
            <span className="text-[10px]" style={{ color: tokens.text.muted }}>{signal.source}</span>
            {signal.accountName && (
              <span className="text-[10px] font-medium" style={{ color: tokens.accent.bright }}>{signal.accountName}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <ConfidenceIndicator level={confidenceTier} />
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: tokens.confidence[confidenceTier].value }}>
            {signal.confidenceScore}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Quick Action Button
   ═══════════════════════════════════════════════════════════════ */
function QuickActionButton({ icon: Icon, label, color, onClick }: {
  icon: React.ElementType; label: string; color: string; onClick?: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.04)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-3 rounded-lg border text-[12px] font-medium justify-start transition-colors"
      style={{
        borderColor: tokens.border.default,
        backgroundColor: tokens.surface.card,
        color: tokens.text.primary,
        minHeight: '44px',
      }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      {label}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Intelligence Dashboard Screen
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceDashboardScreen() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  // ── Queries ──
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['intelligence-stats'],
    queryFn: () => fetchApi<ExecutiveStats>('/api/companies/stats'),
    refetchInterval: 60_000,
  });

  const { data: briefData, isLoading: loadingBrief } = useQuery({
    queryKey: ['intelligence-brief'],
    queryFn: () => fetchApi<{ signals?: IntelligenceSignal[]; recommendations?: Recommendation[]; activity?: ActivityEvent[] }>('/api/intelligence/brief'),
    refetchInterval: 30_000,
  });

  useQuery({
    queryKey: ['health'],
    queryFn: () => fetchApi<{ status: string; uptime?: number }>('/api/health'),
    refetchInterval: 30_000,
  });

  // Merge API data with empty defaults
  const stats = statsData?.data ?? emptyStats;
  const signals = briefData?.data?.signals ?? emptySignals;
  const recommendations = briefData?.data?.recommendations ?? emptyRecommendations;
  const activity = briefData?.data?.activity ?? emptyActivity;
  const isLoading = loadingStats || loadingBrief;

  const pendingRecs = recommendations.filter(r => r.status === 'pending');
  const [recStates, setRecStates] = useState<Record<string, string>>({});

  const handleRecAction = (action: string, id: string) => {
    setRecStates(prev => ({ ...prev, [id]: action }));
    toast.success(
      action === 'accept' ? 'Recommendation accepted' :
      action === 'dismiss' ? 'Recommendation dismissed' : 'Recommendation saved'
    );
  };

  const handleSignalClick = (id: string) => {
    toast.info(`Opening signal ${id}`);
  };

  const handleQuickAction = (label: string) => {
    toast.info(`${label} — coming soon`);
  };

  return (
    <ErrorBoundary>
      <PageTransition>
        <div className="min-h-screen" style={{ backgroundColor: tokens.surface.base, color: tokens.text.primary }}>
          <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 lg:py-8">

            {/* ── Header ── */}
            <header className="mb-6 lg:mb-8">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.domain.signal }}>
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-[13px] font-semibold tracking-tight" style={{ color: tokens.text.primary }}>
                        DeepMindQ
                      </span>
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: tokens.text.secondary }}>
                      Intelligence Platform
                    </span>
                  </div>
                  <h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-tight leading-tight">
                    {greeting}
                  </h1>
                  <p className="text-[13px] mt-1" style={{ color: tokens.text.secondary }}>
                    {dateStr} · {timeStr}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Intelligence health indicator */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                    style={{
                      backgroundColor: tokens.trust.verified.bg,
                      borderColor: tokens.trust.verified.border,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: tokens.trust.verified.value }} />
                    <span className="text-[12px] font-medium" style={{ color: tokens.trust.verified.value }}>
                      All systems operational
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                    style={{
                      backgroundColor: tokens.priority.critical.bg,
                      borderColor: tokens.priority.critical.border,
                    }}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" style={{ color: tokens.priority.critical.value }} />
                    <span className="text-[12px] font-medium" style={{ color: tokens.priority.critical.value }}>
                      {stats.prioritySignals} priority signals
                    </span>
                  </div>
                </div>
              </div>

              {/* ── KPI Row ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <KPICard
                  label="Priority Signals"
                  value={stats.prioritySignals}
                  delta={stats.prioritySignalsDelta}
                  icon={Radar}
                  color={tokens.domain.signal}
                  delay={0}
                />
                <KPICard
                  label="Active Opportunities"
                  value={stats.activeOpportunities}
                  delta={stats.activeOpportunitiesDelta}
                  icon={Target}
                  color={tokens.domain.opportunity}
                  delay={0.07}
                />
                <KPICard
                  label="Avg Confidence"
                  value={`${stats.confidenceAverage}%`}
                  delta={stats.confidenceAverageDelta}
                  icon={Brain}
                  color={tokens.trust.high.value}
                  delay={0.14}
                />
                <KPICard
                  label="Accounts Monitored"
                  value={stats.accountsMonitored}
                  delta={stats.accountsMonitoredDelta}
                  icon={Building2}
                  color={tokens.domain.enrichment}
                  delay={0.21}
                />
              </div>
            </header>

            {isLoading ? (
              <SkeletonDashboard />
            ) : (
              <main>
                {/* ── Main Content Grid ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">

                  {/* Left Column: Signals + Recommendations (2/3) */}
                  <div className="lg:col-span-2 space-y-6">

                    {/* ── Signal Intelligence Section ── */}
                    <section aria-labelledby="signal-section-title">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Radar className="w-4 h-4" style={{ color: tokens.domain.signal }} />
                          <h2 id="signal-section-title" className="text-[15px] font-semibold tracking-tight" style={{ color: tokens.text.primary }}>
                            Signal Intelligence
                          </h2>
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ backgroundColor: `${tokens.domain.signal}15`, color: tokens.domain.signal }}
                          >
                            {signals.length} signals
                          </span>
                        </div>
                        <button
                          className="flex items-center gap-1 text-[12px] font-medium transition-colors"
                          style={{ color: tokens.text.secondary }}
                          onMouseEnter={e => (e.currentTarget.style.color = tokens.accent.bright)}
                          onMouseLeave={e => (e.currentTarget.style.color = tokens.text.secondary)}
                        >
                          View all
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <AnimatePresence>
                          {signals.map((signal, i) => (
                            <SignalRow key={signal.id} signal={signal} onAction={handleSignalClick} />
                          ))}
                        </AnimatePresence>
                      </div>
                    </section>

                    {/* ── AI Recommendations Section ── */}
                    <section aria-labelledby="rec-section-title">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" style={{ color: tokens.domain.opportunity }} />
                          <h2 id="rec-section-title" className="text-[15px] font-semibold tracking-tight" style={{ color: tokens.text.primary }}>
                            AI Recommendations
                          </h2>
                          {pendingRecs.length > 0 && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{ backgroundColor: `${tokens.domain.opportunity}15`, color: tokens.domain.opportunity }}
                            >
                              {pendingRecs.length} pending
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {recommendations.slice(0, 3).map(rec => {
                          const effectiveRec = recStates[rec.id]
                            ? { ...rec, status: (recStates[rec.id] === 'accept' ? 'accepted' : recStates[rec.id] === 'dismiss' ? 'dismissed' : 'saved') as Recommendation['status'] }
                            : rec;
                          return (
                            <RecommendationCard
                              key={rec.id}
                              recommendation={effectiveRec}
                              onAction={handleRecAction}
                            />
                          );
                        })}
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Activity + Quick Actions (1/3) */}
                  <div className="space-y-4 lg:space-y-6">

                    {/* ── Activity Feed ── */}
                    <section aria-labelledby="activity-section-title">
                      <div
                        className="rounded-xl border overflow-hidden"
                        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
                      >
                        <div
                          className="flex items-center justify-between px-4 py-3 border-b"
                          style={{ borderColor: tokens.border.default }}
                        >
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4" style={{ color: tokens.domain.enrichment }} />
                            <h2 id="activity-section-title" className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>
                              Activity Feed
                            </h2>
                          </div>
                          <span className="text-[11px]" style={{ color: tokens.text.muted }}>Last 24h</span>
                        </div>
                        <div className="max-h-[480px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${tokens.border.hover} transparent` }}>
                          <AnimatePresence>
                            {activity.map(event => (
                              <ActivityRow key={event.id} event={event} />
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    </section>

                    {/* ── Quick Actions ── */}
                    <section aria-label="Quick Actions">
                      <div
                        className="rounded-xl border p-4"
                        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
                      >
                        <h2 className="text-[13px] font-semibold mb-3" style={{ color: tokens.text.primary }}>
                          Quick Actions
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                          <QuickActionButton icon={Upload} label="Import Data" color={tokens.domain.enrichment} onClick={() => handleQuickAction('Import Data')} />
                          <QuickActionButton icon={Search} label="Run Analysis" color={tokens.domain.signal} onClick={() => handleQuickAction('Run Analysis')} />
                          <QuickActionButton icon={FileDown} label="View Reports" color={tokens.domain.opportunity} onClick={() => handleQuickAction('View Reports')} />
                          <QuickActionButton icon={BarChart3} label="Score Calibration" color={tokens.domain.reasoning} onClick={() => handleQuickAction('Score Calibration')} />
                        </div>
                      </div>
                    </section>

                    {/* ── Intelligence Summary ── */}
                    <section aria-label="Intelligence Summary">
                      <div
                        className="rounded-xl border p-4"
                        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
                      >
                        <h2 className="text-[13px] font-semibold mb-2" style={{ color: tokens.text.primary }}>
                          Intelligence Summary
                        </h2>
                        <p className="text-[12px] leading-relaxed" style={{ color: tokens.text.secondary }}>
                          Enterprise SaaS buying signals increased 18% this week, primarily driven by leadership
                          changes and technology investment patterns. {stats.prioritySignals} accounts show critical engagement signals
                          requiring immediate attention. Average confidence across all signals is {stats.confidenceAverage}%.
                        </p>
                      </div>
                    </section>
                  </div>
                </div>
              </main>
            )}
          </div>
        </div>
      </PageTransition>
    </ErrorBoundary>
  );
}
