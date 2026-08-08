'use client';

import { useState, useCallback } from 'react';
import {
  Radar, Target, Brain, Building2,
  TrendingUp, Search, Upload, FileDown,
  Sparkles, Activity, ChevronRight, Zap,
} from 'lucide-react';
import { IntelligenceBriefingCard } from '@/components/intelligence-os/molecules/intelligence-briefing-card';
import { RecommendationCard } from '@/components/intelligence-os/molecules/recommendation-card';
import { ActivityFeed } from '@/components/intelligence-os/molecules/activity-feed';
import { useRealtimeData, useMutation } from '@/lib/realtime-hooks';
import type {
  IntelligenceSignal, Recommendation, ActivityEvent, ExecutiveStats,
} from '@/lib/intelligence-types';

/* ═══════════════════════════════════════════════════════════════
   API Response Unwrapper
   All API routes wrap responses in { success, data, timestamp }.
   useRealtimeData receives the full JSON — we unwrap .data in transforms.
   ═══════════════════════════════════════════════════════════════ */
function unwrapData<T>(json: any): T {
  return json?.data ?? json;
}

/* ═══════════════════════════════════════════════════════════════
   1. Dashboard Stats Hook → ExecutiveStats
   GET /api/dashboard returns { success, data: { contactsByStatus, totalCompanies, ... } }
   We map to ExecutiveStats shape used by the UI.
   ═══════════════════════════════════════════════════════════════ */
function useExecutiveStats() {
  return useRealtimeData<ExecutiveStats>({
    endpoint: '/api/dashboard',
    interval: 30000,
    transform: (json) => {
      const d = unwrapData<any>(json);
      return {
        prioritySignals: d.aiSignalsToday ?? d.queuePending ?? 0,
        activeOpportunities: d.activeOpportunities ?? 0,
        confidenceAverage: d.intelligenceScore ?? 0,
        accountsMonitored: d.totalCompanies ?? 0,
        prioritySignalsDelta: undefined,
        activeOpportunitiesDelta: undefined,
        confidenceAverageDelta: undefined,
        accountsMonitoredDelta: undefined,
      };
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   2. Signals Hook → IntelligenceSignal[]
   GET /api/signals returns { success, data: { signals: CompanySignal[], evidenceCounts, ... } }
   We map CompanySignal (Prisma model) → IntelligenceSignal (UI type).
   ═══════════════════════════════════════════════════════════════ */
function useIntelligenceSignals() {
  return useRealtimeData<IntelligenceSignal[]>({
    endpoint: '/api/signals?status=active&limit=20',
    interval: 20000,
    transform: (json) => {
      const d = unwrapData<any>(json);
      const signals: any[] = d.signals ?? d ?? [];
      const evidenceCounts: Record<string, number> = d.evidenceCounts ?? {};

      return signals.map((s: any) => {
        const confidence = s.confidence != null
          ? Math.round(s.confidence * 100)
          : s.signalValidation?.confidenceScore ?? 50;

        // Map Prisma SignalType to UI SignalType
        const typeMap: Record<string, IntelligenceSignal['type']> = {
          funding: 'funding_event',
          funding_event: 'funding_event',
          hiring: 'hiring_surge',
          hiring_surge: 'hiring_surge',
          leadership_change: 'leadership_change',
          leadership: 'leadership_change',
          tech_change: 'technology_investment',
          technology: 'technology_investment',
          technology_investment: 'technology_investment',
          news: 'competitive_move',
          mention: 'competitive_move',
          partnership: 'partnership',
          expansion: 'market_expansion',
          market_expansion: 'market_expansion',
          product_launch: 'product_launch',
          financial_signal: 'financial_signal',
          competitive_move: 'competitive_move',
          risk_indicator: 'risk_indicator',
          people_change: 'leadership_change',
          internal_memory: 'leadership_change',
        };

        // Map Prisma SignalSeverity to UI PriorityLevel
        const priorityMap: Record<string, IntelligenceSignal['priority']> = {
          critical: 'critical',
          high: 'high',
          medium: 'medium',
          low: 'low',
        };

        return {
          id: s.id,
          type: typeMap[s.signalType] ?? 'competitive_move',
          headline: s.title ?? s.signalType ?? 'Signal detected',
          summary: s.description ?? '',
          confidenceScore: confidence,
          freshnessTimestamp: s.signalDate ?? s.extractedAt ?? s.createdAt ?? new Date().toISOString(),
          source: s.source ?? 'System',
          priority: priorityMap[s.severity] ?? 'medium',
          reasoning: s.signalValidation?.reason ?? s.businessImpact ?? s.recommendedAction ?? '',
          status: 'active' as const,
          accountId: s.companyId,
          accountName: s.company?.normalizedName ?? s.company?.rawName,
          evidenceAvailable: (evidenceCounts[s.id] ?? 0) > 0,
          evidenceCount: evidenceCounts[s.id] ?? s.signalValidation?.evidenceCount ?? 0,
          tags: [s.signalType, s.meaningCategory, s.severity].filter(Boolean) as string[],
        };
      });
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   3. Recommendations Hook → Recommendation[]
   GET /api/recommendations returns { success, data: { recommendations: AccountRecommendation[], summary } }
   We map AccountRecommendation → Recommendation (UI type).
   ═══════════════════════════════════════════════════════════════ */
function useAIRecommendations() {
  return useRealtimeData<Recommendation[]>({
    endpoint: '/api/recommendations?limit=10',
    interval: 30000,
    transform: (json) => {
      const d = unwrapData<any>(json);
      const recs: any[] = d.recommendations ?? d ?? [];

      return recs.map((r: any, idx: number) => {
        // Determine actionType from recommended action content
        const actionText = r.recommendedAction?.text ?? '';
        let actionType: Recommendation['actionType'] = 'review';
        if (/schedule|call|meeting|outreach/i.test(actionText)) actionType = 'schedule';
        else if (/save|monitor|watch/i.test(actionText)) actionType = 'save';
        else if (/export|report/i.test(actionText)) actionType = 'export';
        else if (/review|evaluate|assess/i.test(actionText)) actionType = 'review';
        else if (/monitor/i.test(actionText)) actionType = 'monitor';

        return {
          id: r.companyId ?? `rec-${idx}`,
          title: `Prioritize ${r.companyName ?? 'account'} outreach`,
          description: r.recommendedAction?.text ?? r.whyThisAccount ?? '',
          confidence: r.confidenceScore ?? r.opportunityScore ?? 0,
          reasoning: ((r.reasons ?? []).map((reason: any) => reason.text).join(' ') || r.whyThisAccount) ?? '',
          actionType,
          status: 'pending' as const,
          signalId: r.topOpportunity?.id,
          accountId: r.companyId,
          accountName: r.companyName,
          createdAt: r.generatedAt ?? new Date().toISOString(),
        };
      });
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   4. Activity Feed Hook → ActivityEvent[]
   GET /api/timeline returns { success, data: CompanyTimelineEvent[] }
   We map timeline events → ActivityEvent (UI type).
   ═══════════════════════════════════════════════════════════════ */
function useActivityFeed() {
  return useRealtimeData<ActivityEvent[]>({
    endpoint: '/api/timeline?limit=25',
    interval: 30000,
    transform: (json) => {
      const events: any[] = Array.isArray(json?.data) ? json.data
        : Array.isArray(json) ? json
        : [];

      return events.map((evt: any, idx: number) => {
        const eventType = evt.eventType ?? 'data_refreshed';
        const typeMap: Record<string, ActivityEvent['type']> = {
          signal_detected: 'signal_detected',
          signal_created: 'signal_detected',
          confidence_updated: 'confidence_updated',
          score_updated: 'confidence_updated',
          recommendation_generated: 'recommendation_generated',
          data_refreshed: 'data_refreshed',
          enrichment_completed: 'data_refreshed',
          account_changed: 'account_changed',
          company_updated: 'account_changed',
          contact_added: 'account_changed',
          intelligence_generated: 'recommendation_generated',
          email_sent: 'account_changed',
          email_reply: 'signal_detected',
        };

        // Infer trust level from event type
        const trustMap: Record<string, ActivityEvent['trustLevel']> = {
          signal_detected: 'high',
          confidence_updated: 'verified',
          recommendation_generated: 'high',
          data_refreshed: 'medium',
          account_changed: 'medium',
        };

        return {
          id: evt.id ?? `evt-${idx}`,
          type: typeMap[eventType] ?? 'data_refreshed',
          headline: evt.title ?? evt.eventType ?? 'Activity event',
          description: evt.description ?? '',
          timestamp: evt.createdAt ?? new Date().toISOString(),
          source: evt.company?.rawName ?? 'System',
          trustLevel: trustMap[typeMap[eventType]] ?? 'medium',
        };
      });
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   Skeleton Component — shown while data is loading
   ═══════════════════════════════════════════════════════════════ */
function SkeletonPulse({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-[var(--border)] ${className}`} />
  );
}

function StatCardSkeleton() {
  return (
    <div className="dmq-glass-card p-4 lg:p-5">
      <div className="flex items-center justify-between mb-2">
        <SkeletonPulse className="h-3 w-24" />
        <SkeletonPulse className="h-8 w-8 rounded-lg" />
      </div>
      <div className="flex items-end gap-2">
        <SkeletonPulse className="h-7 w-16" />
        <SkeletonPulse className="h-3 w-8" />
      </div>
    </div>
  );
}

function SignalCardSkeleton() {
  return (
    <div className="dmq-glass-card p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <SkeletonPulse className="h-5 w-5" />
          <SkeletonPulse className="h-4 w-48" />
        </div>
        <SkeletonPulse className="h-3 w-full" />
        <SkeletonPulse className="h-3 w-3/4" />
        <div className="flex gap-2 pt-1">
          <SkeletonPulse className="h-6 w-16 rounded-full" />
          <SkeletonPulse className="h-6 w-20 rounded-full" />
          <SkeletonPulse className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function RecommendationCardSkeleton() {
  return (
    <div className="dmq-glass-card p-4">
      <div className="space-y-2">
        <SkeletonPulse className="h-4 w-56" />
        <SkeletonPulse className="h-3 w-full" />
        <SkeletonPulse className="h-3 w-5/6" />
        <div className="flex gap-2 pt-2">
          <SkeletonPulse className="h-8 w-20 rounded-lg" />
          <SkeletonPulse className="h-8 w-20 rounded-lg" />
          <SkeletonPulse className="h-8 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="p-4 space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3">
          <SkeletonPulse className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <SkeletonPulse className="h-3 w-full" />
            <SkeletonPulse className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Empty State Component
   ═══════════════════════════════════════════════════════════════ */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="dmq-glass-card p-8 text-center">
      <p className="text-[13px] text-[var(--primary-dim)]">{message}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Error Banner Component
   ═══════════════════════════════════════════════════════════════ */
function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="dmq-glass-card p-4 border-[var(--risk-red)]/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--risk-red)]" />
          <p className="text-[12px] text-[var(--risk-red)]">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-[11px] font-medium text-[var(--primary-dim)] hover:text-[var(--accent)] transition-colors px-2 py-1"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Stat Card Component ── */
function ExecutiveStatCard({
  icon: Icon,
  label,
  value,
  delta,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  delta?: number;
  color: string;
}) {
  return (
    <div className="dmq-glass-card p-4 lg:p-5 transition-all duration-200 hover:border-[var(--border-light)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--primary-dim)]">
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
        <span className="text-2xl font-bold text-[var(--primary)] tabular-nums tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {delta !== undefined && (
          <span
            className={`text-[11px] font-semibold tabular-nums pb-0.5 ${
              delta > 0 ? 'text-[var(--success-green)]' : delta < 0 ? 'text-[var(--risk-red)]' : 'text-[var(--primary-dim)]'
            }`}
          >
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Intelligence Hub Screen
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceHubScreen() {
  // ── Real API Data Hooks ──
  const stats = useExecutiveStats();
  const signals = useIntelligenceSignals();
  const recommendations = useAIRecommendations();
  const activity = useActivityFeed();

  // ── Signal Action Mutation (PATCH /api/signals/{id} or POST to timeline) ──
  const signalActionMutation = useMutation<any, { signalId: string; action: string; companyId?: string }>({
    endpoint: '/api/signals/operational',
    method: 'POST',
  });

  // ── Recommendation Accept/Dismiss Mutation ──
  const recommendationActionMutation = useMutation<any, { recommendationId: string; action: string }>({
    endpoint: '/api/recommendations',
    method: 'PATCH',
  });

  // ── Local optimistic state for recommendations (overlay on top of API data) ──
  const [localRecStatus, setLocalRecStatus] = useState<Record<string, Recommendation['status']>>({});

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  // ── Derived data with local overrides ──
  const statsData = stats.data;
  const signalsData = signals.data ?? [];
  const rawRecs = recommendations.data ?? [];
  const recommendationsData = rawRecs.map((r) => ({
    ...r,
    status: localRecStatus[r.id] ?? r.status,
  }));
  const activityData = activity.data ?? [];

  const pendingRecommendations = recommendationsData.filter((r) => r.status === 'pending');

  // ── Handlers ──
  const handleRecommendationAction = useCallback(async (action: string, id: string) => {
    // Optimistic local update
    const newStatus: Recommendation['status'] =
      action === 'accept' ? 'accepted' : action === 'dismiss' ? 'dismissed' : 'saved';
    setLocalRecStatus((prev) => ({ ...prev, [id]: newStatus }));

    // Fire-and-forget API call
    try {
      await recommendationActionMutation.mutate({ recommendationId: id, action });
    } catch {
      // Revert on error
      setLocalRecStatus((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [recommendationActionMutation]);

  const handleSignalAction = useCallback(async (action: string, signalId: string) => {
    // Find the signal to get its companyId
    const signal = signalsData.find((s) => s.id === signalId);
    try {
      await signalActionMutation.mutate({
        signalId,
        action,
        companyId: signal?.accountId,
      });
      // Refetch signals to get updated state
      signals.refetch();
    } catch (err) {
      console.error('Signal action failed:', err);
    }
  }, [signalActionMutation, signalsData, signals]);

  // ── Render ──
  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ color: 'var(--primary)' }}>
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 lg:py-8">
        
        {/* ── Header ── */}
        <header className="mb-6 lg:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--signal-blue)] flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[13px] font-semibold tracking-tight">DeepMindQ</span>
                </div>
                <span className="text-[11px] font-medium text-[var(--primary-dim)]">
                  Intelligence Platform
                </span>
              </div>
              <h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-tight leading-tight">
                {greeting}
              </h1>
              <p className="text-[var(--primary-dim)] text-[13px] mt-1">
                {dateStr} · {timeStr}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {stats.loading ? (
                <SkeletonPulse className="h-8 w-40 rounded-lg" />
              ) : statsData ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--success-green-low)] border border-[var(--trust-verified-border)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--trust-verified)] animate-pulse" />
                  <span className="text-[12px] font-medium text-[var(--trust-verified)]">
                    {statsData.prioritySignals} priority signals
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Executive Stats Row ── */}
          {stats.loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : stats.error ? (
            <ErrorBanner
                  message="Failed to load dashboard stats"
                  onRetry={stats.refetch}
                />
          ) : statsData ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <ExecutiveStatCard
                icon={Radar}
                label="Priority Signals"
                value={statsData.prioritySignals}
                delta={statsData.prioritySignalsDelta}
                color="var(--signal-blue)"
              />
              <ExecutiveStatCard
                icon={Target}
                label="Active Opportunities"
                value={statsData.activeOpportunities}
                delta={statsData.activeOpportunitiesDelta}
                color="var(--opportunity-purple)"
              />
              <ExecutiveStatCard
                icon={Brain}
                label="Confidence Avg"
                value={`${statsData.confidenceAverage}%`}
                delta={statsData.confidenceAverageDelta}
                color="var(--trust-high)"
              />
              <ExecutiveStatCard
                icon={Building2}
                label="Accounts Monitored"
                value={statsData.accountsMonitored}
                delta={statsData.accountsMonitoredDelta}
                color="var(--enrichment-cyan)"
              />
            </div>
          ) : null}
        </header>

        {/* ── Main Content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          
          {/* Left Column: Signals + Recommendations (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* ── Signal Intelligence Section ── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Radar className="w-4 h-4 text-[var(--signal-blue)]" />
                  <h2 className="text-[15px] font-semibold tracking-tight">Signal Intelligence</h2>
                  {!signals.loading && signalsData.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--signal-blue-low)] text-[var(--signal-blue)]">
                      {signalsData.length} signals
                    </span>
                  )}
                </div>
                <button className="flex items-center gap-1 text-[12px] font-medium text-[var(--primary-dim)] hover:text-[var(--accent)] transition-colors min-h-[44px] px-2">
                  View all
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {signals.loading ? (
                <div className="space-y-3">
                  <SignalCardSkeleton />
                  <SignalCardSkeleton />
                  <SignalCardSkeleton />
                </div>
              ) : signals.error ? (
                <ErrorBanner
                  message="Failed to load signals"
                  onRetry={signals.refetch}
                />
              ) : signalsData.length === 0 ? (
                <EmptyState message="No intelligence signals detected yet. Signals will appear here as the system monitors your accounts." />
              ) : (
                <div className="space-y-3">
                  {signalsData.map((signal) => (
                    <IntelligenceBriefingCard
                      key={signal.id}
                      signal={signal}
                      onAction={handleSignalAction}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Recommendations Section ── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--opportunity-purple)]" />
                  <h2 className="text-[15px] font-semibold tracking-tight">AI Recommendations</h2>
                  {!recommendations.loading && pendingRecommendations.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--opportunity-purple-low)] text-[var(--opportunity-purple)]">
                      {pendingRecommendations.length} pending
                    </span>
                  )}
                </div>
              </div>

              {recommendations.loading ? (
                <div className="space-y-3">
                  <RecommendationCardSkeleton />
                  <RecommendationCardSkeleton />
                  <RecommendationCardSkeleton />
                </div>
              ) : recommendations.error ? (
                <ErrorBanner
                  message="Failed to load recommendations"
                  onRetry={recommendations.refetch}
                />
              ) : recommendationsData.length === 0 ? (
                <EmptyState message="No AI recommendations available yet. Recommendations will appear as the system analyzes your accounts and signals." />
              ) : (
                <div className="space-y-3">
                  {recommendationsData.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      recommendation={rec}
                      onAction={handleRecommendationAction}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Activity + Quick Actions (1/3 width) */}
          <div className="space-y-4 lg:space-y-6">
            
            {/* ── Activity Feed ── */}
            <section className="dmq-glass-card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--enrichment-cyan)]" />
                  <h2 className="text-[13px] font-semibold">Activity Feed</h2>
                </div>
                <span className="text-[11px] text-[var(--primary-dim)]">Last 24h</span>
              </div>
              {activity.loading ? (
                <ActivitySkeleton />
              ) : activity.error ? (
                <div className="p-4">
                  <ErrorBanner
                    message="Failed to load activity"
                    onRetry={activity.refetch}
                  />
                </div>
              ) : activityData.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-[12px] text-[var(--primary-dim)]">No recent activity</p>
                </div>
              ) : (
                <div className="max-h-[480px] overflow-y-auto">
                  <ActivityFeed events={activityData} />
                </div>
              )}
            </section>

            {/* ── Quick Actions ── */}
            <section className="dmq-glass-card p-4">
              <h2 className="text-[13px] font-semibold mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Search, label: 'New Analysis', color: 'var(--signal-blue)' },
                  { icon: Upload, label: 'Import Accounts', color: 'var(--enrichment-cyan)' },
                  { icon: TrendingUp, label: 'Configure Sources', color: 'var(--success-green)' },
                  { icon: FileDown, label: 'Export Report', color: 'var(--warning-amber)' },
                ].map(({ icon: Icon, label, color }) => (
                  <button
                    key={label}
                    className="flex items-center gap-2.5 px-3 py-3 rounded-lg border border-[var(--border)] text-[12px] font-medium text-[var(--primary)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-light)] transition-colors min-h-[44px] justify-start"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* ── Intelligence Summary ── */}
            <section className="dmq-glass-card p-4">
              <h2 className="text-[13px] font-semibold mb-2">Intelligence Summary</h2>
              {stats.loading ? (
                <div className="space-y-2">
                  <SkeletonPulse className="h-3 w-full" />
                  <SkeletonPulse className="h-3 w-5/6" />
                  <SkeletonPulse className="h-3 w-4/6" />
                </div>
              ) : statsData ? (
                <p className="text-[12px] text-[var(--primary-dim)] leading-relaxed">
                  Monitoring {statsData.accountsMonitored} accounts with {statsData.prioritySignals} priority signals.
                  {statsData.activeOpportunities > 0
                    ? ` ${statsData.activeOpportunities} active opportunity${statsData.activeOpportunities > 1 ? 'ies' : 'y'} identified.`
                    : ' No active opportunities at this time.'}
                  {' '}Average confidence: {statsData.confidenceAverage}%.
                </p>
              ) : (
                <p className="text-[12px] text-[var(--primary-dim)]">Unable to load intelligence summary.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
