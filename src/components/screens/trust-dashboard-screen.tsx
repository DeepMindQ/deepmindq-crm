/* ═══════════════════════════════════════════════════════════
   AI Trust Dashboard — Phase 3 M5 Build
   
   Platform-wide TRUST visualization: scores, sources,
   confidence distribution, freshness, lineage coverage,
   and actionable recommendations.
   ═══════════════════════════════════════════════════════════ */

'use client';

import { useTrustDashboard } from '@/lib/realtime-hooks';
import {
  PageTransition,
  AnimatedCounter,
  StaggerGrid,
  StaggerItem,
  SectionHeader,
  AnimatedBar,
  GlassPanel,
  EmptyState,
} from '@/components/ui/animated-components';
import { TrustScoreBadge } from '@/components/trust/trust-score-badge';
import { ConfidenceIndicator } from '@/components/trust/confidence-indicator';
import { TrustBreakdownChart } from '@/components/trust/trust-breakdown-chart';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import {
  Shield,
  AlertTriangle,
  Clock,
  Link2,
  Lightbulb,
  TrendingUp,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

interface TrustDashboardResponse {
  overallTrustScore: number;
  trustGrade: string;
  sourceBreakdown: { source: string; count: number; avgScore: number }[];
  confidenceDistribution: { high: number; medium: number; low: number };
  freshnessStats: { fresh: number; stale: number; unknown: number };
  topIssues: { field: string; issue: string; severity: string }[];
  lineageCoverage: { totalFields: number; fieldsWithLineage: number; coveragePercent: number };
}

// ─── Component ──────────────────────────────────────────────────

export default function TrustDashboardScreen() {
  const { selectedCompanyId, setActiveView } = useAppStore();

  const { data, loading: isLoading, error, refetch } = useTrustDashboard(5 * 60_000);
  const isFetching = isLoading;

  // ─── Loading skeleton ──
  if (isLoading) return <TrustDashboardSkeleton />;

  // ─── Error state ──
  if (error || !data) {
    return (
      <EmptyState
        icon={Shield}
        title="Trust Dashboard Unavailable"
        description={error?.message || 'Unable to load TRUST metrics. Try refreshing.'}
        action={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        }
      />
    );
  }

  const {
    overallTrustScore,
    trustGrade,
    sourceBreakdown,
    confidenceDistribution,
    freshnessStats,
    topIssues,
    lineageCoverage,
  } = data;

  const totalEvidence = confidenceDistribution.high + confidenceDistribution.medium + confidenceDistribution.low;

  // Generate recommendations from data
  const recommendations = generateRecommendations(data);

  return (
    <PageTransition className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">AI Trust Dashboard</h1>
            <p className="text-sm text-muted-foreground">Transparency, Reliability, Understandability, Source, Traceability</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="self-start flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent/50 transition"
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <StaggerGrid className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Overall Score (hero) ── */}
        <StaggerItem className="lg:col-span-1">
          <GlassPanel className="p-6 flex flex-col items-center justify-center text-center h-full">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">Overall TRUST Score</p>
            <TrustScoreBadge score={overallTrustScore} grade={trustGrade} size="lg" />
            <p className="text-sm text-muted-foreground mt-4 max-w-[200px]">
              {overallTrustScore >= 85
                ? 'Platform data quality is excellent'
                : overallTrustScore >= 70
                ? 'Good data quality with room for improvement'
                : overallTrustScore >= 55
                ? 'Moderate — consider enriching sources'
                : 'Needs attention — multiple quality issues detected'}
            </p>
          </GlassPanel>
        </StaggerItem>

        {/* ── Source Breakdown + Confidence ── */}
        <StaggerItem className="lg:col-span-2">
          <GlassPanel className="p-6 h-full">
            <TrustBreakdownChart
              sourceBreakdown={sourceBreakdown}
              confidenceDistribution={confidenceDistribution}
            />
          </GlassPanel>
        </StaggerItem>
      </StaggerGrid>

      {/* ── Stat cards: Freshness, Confidence, Lineage ── */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StaggerItem>
          <FreshnessCard stats={freshnessStats} total={totalEvidence} />
        </StaggerItem>
        <StaggerItem>
          <ConfidenceSummary distribution={confidenceDistribution} total={totalEvidence} />
        </StaggerItem>
        <StaggerItem>
          <LineageCard coverage={lineageCoverage} />
        </StaggerItem>
      </StaggerGrid>

      {/* ── Bottom row: Issues + Recommendations ── */}
      <StaggerGrid className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StaggerItem>
          <TopIssuesCard issues={topIssues} />
        </StaggerItem>
        <StaggerItem>
          <RecommendationsCard recommendations={recommendations} />
        </StaggerItem>
      </StaggerGrid>

      {/* ── Company drill-down CTA ── */}
      {selectedCompanyId && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setActiveView('company-trust-detail')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/5 transition"
          >
            <ArrowRight className="w-4 h-4" />
            View Company Trust Detail
          </button>
        </div>
      )}
    </PageTransition>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function FreshnessCard({ stats, total }: { stats: TrustDashboardResponse['freshnessStats']; total: number }) {
  const freshPct = total > 0 ? Math.round((stats.fresh / total) * 100) : 0;
  return (
    <GlassPanel className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Data Freshness</h3>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">Fresh (&lt;30d)</span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            <AnimatedCounter value={stats.fresh} /> <span className="text-xs font-normal text-muted-foreground">({freshPct}%)</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs text-muted-foreground">Stale (30-90d)</span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            <AnimatedCounter value={stats.stale} />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-muted-foreground">Aged (&gt;90d)</span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
            <AnimatedCounter value={stats.unknown} />
          </span>
        </div>
      </div>
    </GlassPanel>
  );
}

function ConfidenceSummary({ distribution, total }: { distribution: TrustDashboardResponse['confidenceDistribution']; total: number }) {
  const highPct = total > 0 ? Math.round((distribution.high / total) * 100) : 0;
  return (
    <GlassPanel className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-sky-500" />
        <h3 className="text-sm font-semibold text-foreground">Confidence Overview</h3>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <ConfidenceIndicator level="high" label="High confidence" />
          <span className="text-sm font-semibold tabular-nums">
            <AnimatedCounter value={distribution.high} />
            <span className="text-xs font-normal text-muted-foreground ml-1">({highPct}%)</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <ConfidenceIndicator level="medium" label="Medium" />
          <span className="text-sm font-semibold tabular-nums">
            <AnimatedCounter value={distribution.medium} />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <ConfidenceIndicator level="low" label="Low" />
          <span className="text-sm font-semibold tabular-nums">
            <AnimatedCounter value={distribution.low} />
          </span>
        </div>
      </div>
    </GlassPanel>
  );
}

function LineageCard({ coverage }: { coverage: TrustDashboardResponse['lineageCoverage'] }) {
  return (
    <GlassPanel className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-4 h-4 text-violet-500" />
        <h3 className="text-sm font-semibold text-foreground">Lineage Coverage</h3>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-center py-2">
          <span className="text-3xl font-bold tabular-nums">
            <AnimatedCounter value={coverage.coveragePercent} />
            <span className="text-lg text-muted-foreground">%</span>
          </span>
        </div>
        <AnimatedBar
          value={coverage.fieldsWithLineage}
          max={coverage.totalFields || 1}
          color={coverage.coveragePercent >= 80 ? 'var(--dmq-emerald)' : coverage.coveragePercent >= 50 ? 'var(--dmq-domain-reasoning)' : 'var(--dmq-domain-risk)'}
        />
        <p className="text-xs text-muted-foreground text-center">
          {coverage.fieldsWithLineage} of {coverage.totalFields} fields tracked
        </p>
      </div>
    </GlassPanel>
  );
}

function TopIssuesCard({ issues }: { issues: TrustDashboardResponse['topIssues'] }) {
  if (issues.length === 0) {
    return (
      <GlassPanel className="p-5">
        <SectionHeader title="Top Issues" />
        <p className="text-sm text-muted-foreground text-center py-6">No critical issues detected. All data within acceptable thresholds.</p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-5">
      <SectionHeader title="Top Issues" subtitle="Fields requiring attention" />
      <div className="space-y-2.5 max-h-64 overflow-y-auto">
        {issues.map((issue, i) => (
          <div
            key={`${issue.field}-${i}`}
            className={
              'flex items-start gap-3 p-3 rounded-lg border ' +
              (issue.severity === 'high'
                ? 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5'
                : 'border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5')
            }
          >
            <AlertTriangle className={
              'w-4 h-4 mt-0.5 shrink-0 ' +
              (issue.severity === 'high' ? 'text-red-500' : 'text-amber-500')
            } />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground capitalize">{issue.field.replace(/_/g, ' ')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{issue.issue}</p>
            </div>
            <Badge
              variant={issue.severity === 'high' ? 'destructive' : 'secondary'}
              className="shrink-0 text-[10px]"
            >
              {issue.severity}
            </Badge>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function RecommendationsCard({ recommendations }: { recommendations: string[] }) {
  return (
    <GlassPanel className="p-5">
      <SectionHeader title="Recommendations" subtitle="Data quality improvement actions" />
      <div className="space-y-3">
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No recommendations at this time.</p>
        ) : (
          recommendations.map((rec, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20"
            >
              <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
              <p className="text-xs text-foreground leading-relaxed">{rec}</p>
            </div>
          ))
        )}
      </div>
    </GlassPanel>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function generateRecommendations(data: TrustDashboardResponse): string[] {
  const recs: string[] = [];
  const { confidenceDistribution, freshnessStats, lineageCoverage, sourceBreakdown, overallTrustScore } = data;

  const total = confidenceDistribution.high + confidenceDistribution.medium + confidenceDistribution.low;
  const lowPct = total > 0 ? (confidenceDistribution.low / total) * 100 : 0;
  const stalePct = total > 0 ? ((freshnessStats.stale + freshnessStats.unknown) / total) * 100 : 0;

  if (lowPct > 30) {
    recs.push(`High proportion of low-confidence data (${Math.round(lowPct)}%). Consider adding verified API sources (Clearbit, Apollo) for key fields.`);
  }
  if (stalePct > 40) {
    recs.push('Significant data staleness detected. Schedule regular re-enrichment cycles to maintain data freshness.');
  }
  if (lineageCoverage.coveragePercent < 50) {
    recs.push('Lineage coverage is below 50%. Enable lineage tracking on data pipelines to improve transparency and auditability.');
  }
  const hasVerifiedApi = sourceBreakdown.some((s) => s.source === 'verified_api');
  const hasAiInference = sourceBreakdown.some((s) => s.source === 'ai_inference');
  if (!hasVerifiedApi && total > 0) {
    recs.push('No verified API data sources detected. Connecting external data providers will significantly improve TRUST scores.');
  }
  if (hasAiInference) {
    const aiSource = sourceBreakdown.find((s) => s.source === 'ai_inference');
    const aiPct = total > 0 ? ((aiSource?.count || 0) / total) * 100 : 0;
    if (aiPct > 50) {
      recs.push(`AI inference makes up ${Math.round(aiPct)}% of data. Cross-reference AI outputs with verified sources to improve reliability.`);
    }
  }
  if (overallTrustScore >= 85) {
    recs.push('Data quality is strong. Focus on maintaining freshness and expanding lineage coverage to new fields.');
  }
  if (recs.length === 0) {
    recs.push('TRUST metrics look healthy. Continue monitoring for changes in data quality patterns.');
  }

  return recs;
}

// ─── Loading Skeleton ────────────────────────────────────────────

function TrustDashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
