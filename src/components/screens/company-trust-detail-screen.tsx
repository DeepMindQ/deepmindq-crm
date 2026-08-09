/* ═══════════════════════════════════════════════════════════
   Company Trust Detail — Per-company TRUST breakdown
   
   Field-by-field trust table, lineage timeline, source
   indicators, confidence badges, and recommendations.
   ═══════════════════════════════════════════════════════════ */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  PageTransition,
  StaggerGrid,
  StaggerItem,
  SectionHeader,
  GlassPanel,
  EmptyState,
} from '@/components/ui/animated-components';
import { TrustScoreBadge } from '@/components/trust/trust-score-badge';
import { ConfidenceIndicator } from '@/components/trust/confidence-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import type { DataLineageRecord } from '@/lib/data-lineage-service';
import {
  Shield,
  ArrowLeft,
  RefreshCw,
  Clock,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Link2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

interface FieldTrustInfo {
  source: string;
  confidence: string;
  lastUpdated: string;
  ageDays: number;
}

interface CompanyTrustResponse {
  companyId: string;
  companyName: string;
  trustScore: number;
  trustGrade: string;
  fieldTrust: Record<string, FieldTrustInfo>;
  lineageRecords: DataLineageRecord[];
  recommendations: string[];
}

// ─── Source Colors ───────────────────────────────────────────────

const SOURCE_STYLES: Record<string, { badge: string; label: string }> = {
  verified_api: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30', label: 'Verified API' },
  customer_data: { badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400 border-sky-200 dark:border-sky-500/30', label: 'Customer Data' },
  internal_document: { badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 border-violet-200 dark:border-violet-500/30', label: 'Internal Doc' },
  web_intelligence: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-200 dark:border-amber-500/30', label: 'Web Intel' },
  platform_computed: { badge: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400 border-teal-200 dark:border-teal-500/30', label: 'Computed' },
  ai_inference: { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-orange-200 dark:border-orange-500/30', label: 'AI Inference' },
};

const DEFAULT_SOURCE_STYLE = { badge: 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400 border-gray-200 dark:border-gray-500/30', label: 'Unknown' };

// ─── Component ──────────────────────────────────────────────────

export default function CompanyTrustDetailScreen() {
  const { selectedCompanyId, setActiveView } = useAppStore();

  const { data, isLoading, error, refetch, isFetching } = useQuery<CompanyTrustResponse>({
    queryKey: ['company-trust', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) throw new Error('No company selected');
      const res = await fetch(`/api/trust/company/${selectedCompanyId}`);
      if (!res.ok) throw new Error('Failed to load company trust data');
      return res.json();
    },
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  });

  // ─── No company selected ──
  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={Shield}
        title="No Company Selected"
        description="Select a company from the Company Intelligence screen to view its TRUST details."
        action={
          <button
            onClick={() => setActiveView('accounts')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            Browse Companies
          </button>
        }
      />
    );
  }

  // ─── Loading skeleton ──
  if (isLoading) return <CompanyTrustSkeleton />;

  // ─── Error state ──
  if (error || !data) {
    return (
      <EmptyState
        icon={Shield}
        title="Trust Detail Unavailable"
        description={error?.message || 'Unable to load company TRUST data.'}
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

  const { companyName, trustScore, trustGrade, fieldTrust, lineageRecords, recommendations } = data;
  const fields = Object.entries(fieldTrust);

  return (
    <PageTransition className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('trust-dashboard')}
            className="p-2 rounded-lg border border-border hover:bg-accent/50 transition"
            aria-label="Back to Trust Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">{companyName}</h1>
            <p className="text-sm text-muted-foreground">Company Trust Profile</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TrustScoreBadge score={trustScore} grade={trustGrade} size="md" />
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent/50 transition"
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <StaggerGrid className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Field Trust Table (3 cols) ── */}
        <StaggerItem className="lg:col-span-3">
          <GlassPanel className="p-5">
            <SectionHeader
              title="Field Trust Breakdown"
              subtitle={`${fields.length} fields tracked`}
            />
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No field-level trust data available for this company.</p>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Field</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confidence</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Age</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fields.map(([fieldName, info]) => {
                      const sourceStyle = SOURCE_STYLES[info.source] || DEFAULT_SOURCE_STYLE;
                      const isStale = info.ageDays > 30;
                      return (
                        <tr key={fieldName} className="hover:bg-accent/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-foreground capitalize">
                            {fieldName.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={
                              'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ' +
                              sourceStyle.badge
                            }>
                              {sourceStyle.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <ConfidenceIndicator
                              level={info.confidence as 'high' | 'medium' | 'low'}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              {isStale ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                              <span className={
                                'text-xs tabular-nums ' +
                                (isStale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')
                              }>
                                {info.ageDays}d
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-muted-foreground">
                            {new Date(info.lastUpdated).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassPanel>
        </StaggerItem>

        {/* ── Right Column: Lineage + Recommendations (2 cols) ── */}
        <StaggerItem className="lg:col-span-2 space-y-6">
          {/* Lineage Timeline */}
          <GlassPanel className="p-5">
            <SectionHeader
              title="Data Lineage"
              subtitle={`${lineageRecords.length} events`}
            />
            {lineageRecords.length === 0 ? (
              <div className="text-center py-8">
                <Link2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No lineage records found for this company.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {lineageRecords.map((record) => (
                  <LineageEvent key={record.id} record={record} />
                ))}
              </div>
            )}
          </GlassPanel>

          {/* Recommendations */}
          <GlassPanel className="p-5">
            <SectionHeader title="Recommendations" />
            <div className="space-y-2.5">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/60 dark:border-emerald-500/20"
                >
                  <FileText className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                  <p className="text-xs text-foreground leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </StaggerItem>
      </StaggerGrid>
    </PageTransition>
  );
}

// ─── Lineage Event Component ─────────────────────────────────────

function LineageEvent({ record }: { record: DataLineageRecord }) {
  const eventColors: Record<string, string> = {
    acquired: 'bg-emerald-500',
    processed: 'bg-sky-500',
    enriched: 'bg-violet-500',
    computed: 'bg-teal-500',
    verified: 'bg-emerald-400',
    corrected: 'bg-amber-500',
    deprecated: 'bg-gray-400',
    rejected: 'bg-red-500',
  };

  const dotColor = eventColors[record.event] || 'bg-gray-400';

  return (
    <div className="flex items-start gap-3 group">
      <div className="flex flex-col items-center mt-1.5">
        <span className={
          'w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-background ' + dotColor
        } />
        <div className="w-px h-full min-h-[2rem] bg-border" />
      </div>
      <div className="min-w-0 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground capitalize">
            {record.field.replace(/_/g, ' ')}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {record.event}
          </Badge>
          <span className={
            'text-[10px] px-1.5 py-0 rounded border ' +
            (SOURCE_STYLES[record.source]?.badge || DEFAULT_SOURCE_STYLE.badge)
          }>
            {record.provider}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{record.description}</p>
        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          {new Date(record.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────

function CompanyTrustSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Skeleton className="h-96 rounded-xl lg:col-span-3" />
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}