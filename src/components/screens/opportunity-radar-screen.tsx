'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radar, Target, Building2, Sparkles, ChevronRight,
  RefreshCw, Filter, X, Search, ArrowRight,
  CheckCircle2, XCircle, Loader2, AlertCircle,
  Flame, TrendingUp, Minus, Eye, MessageSquare,
  LucideIcon,
} from 'lucide-react';
import { PageTransition, EmptyState } from '@/components/ui/animated-components';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/error-boundary';

/* ═══════════════════════════════════════════════════════════════
   Types — aligned with OpportunityRecommendation schema + T9 API contract
   ═══════════════════════════════════════════════════════════════ */

interface CapabilityMatchNested {
  id: string;
  matchScore: number;
  reason: string;
  salesAngle?: string | null;
  capability: { id: string; title: string; category?: string | null };
}

interface OpportunityItem {
  id: string;
  companyId: string;
  signalId: string;
  capabilityMatchId: string;
  opportunityTitle: string;
  businessTrigger: string;
  whyNow: string;
  businessProblem: string;
  recommendedCapability: string;
  recommendedStakeholders: string;
  suggestedConversation: string;
  evidenceIds: string;
  confidenceScore: number;
  freshnessScore: number;
  matchScore: number;
  opportunityScore: number;
  priority: string;
  status: string;
  rejectionReason?: string | null;
  rejectionFeedback?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; normalizedName: string; industry?: string | null; sizeRange?: string | null };
  signal?: { id: string; signalType: string; title: string; severity: string };
  capabilityMatch?: CapabilityMatchNested;
}

interface Stats {
  total: number;
  byPriority: { high: number; medium: number; low: number };
  byStatus: Record<string, number>;
}

interface OpportunitiesResponse {
  opportunities: OpportunityItem[];
  stats: Stats;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/* ═══════════════════════════════════════════════════════════════
   Priority / Status / Severity Config — per T9 spec enums
   ═══════════════════════════════════════════════════════════════ */

const priorityConfig: Record<string, {
  label: string; icon: LucideIcon; color: string; badge: string; order: number;
}> = {
  high:   { label: 'High',   icon: Flame,      badge: 'bg-red-100 text-red-700 border-red-200',      color: 'text-red-600',   order: 0 },
  medium: { label: 'Medium', icon: TrendingUp,  badge: 'bg-amber-100 text-amber-700 border-amber-200', color: 'text-amber-600', order: 1 },
  low:    { label: 'Low',    icon: Minus,       badge: 'bg-slate-100 text-slate-600 border-slate-200', color: 'text-slate-500', order: 2 },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending_review: { label: 'Pending Review', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  accepted:       { label: 'Accepted',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:       { label: 'Rejected',       color: 'bg-red-100 text-red-700 border-red-200' },
  monitored:      { label: 'Monitored',      color: 'bg-violet-100 text-violet-700 border-violet-200' },
};

const REJECTION_REASONS = [
  { value: 'WRONG_TIMING', label: 'Wrong Timing' },
  { value: 'EXISTING_RELATIONSHIP', label: 'Existing Relationship' },
  { value: 'NOT_RELEVANT', label: 'Not Relevant' },
  { value: 'LOW_CONFIDENCE', label: 'Low Confidence' },
  { value: 'NO_BUDGET', label: 'No Budget' },
  { value: 'OTHER', label: 'Other' },
];

/* ═══════════════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════════════ */

function unwrap<T>(raw: unknown): T | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (obj.success === true && obj.data !== undefined) return obj.data as T;
  if (Array.isArray(raw) || !('success' in obj)) return raw as T;
  return undefined;
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════
   Reject Modal — T9: "Accept/Reject buttons with feedback form"
   ═══════════════════════════════════════════════════════════════ */

function RejectModal({ opportunity, onConfirm, onCancel }: {
  opportunity: OpportunityItem;
  onConfirm: (reason: string, feedback: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
            <XCircle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Reject Opportunity</h3>
            <p className="text-xs text-slate-500">{opportunity.opportunityTitle}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Rejection Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300"
            >
              <option value="">Select a reason...</option>
              {REJECTION_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Additional Feedback</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Optional: provide additional context..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={onCancel} className="h-10 text-xs min-h-[44px]">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(reason, feedback)}
            disabled={!reason}
            className="h-10 text-xs bg-red-600 hover:bg-red-700 text-white"
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Stats Bar — shows byPriority and byStatus counts
   ═══════════════════════════════════════════════════════════════ */

function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
        <Target className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[11px] font-semibold text-slate-700">{stats.total}</span>
        <span className="text-[10px] text-slate-400">total</span>
      </div>
      {Object.entries(stats.byPriority).map(([key, count]) => {
        const cfg = priorityConfig[key];
        if (!cfg) return null;
        const Icon = cfg.icon;
        return (
          <div key={key} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white">
            <Icon className={cn('h-3 w-3', cfg.color)} />
            <span className="text-[11px] font-semibold text-slate-700">{count}</span>
            <span className="text-[10px] text-slate-400">{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Opportunity Card — T9: "Opportunity cards: Company, Trigger,
   Capability, Score, Priority, Why Now"
   ═══════════════════════════════════════════════════════════════ */

function OpportunityCard({ opportunity, onAccept, onReject, onViewCompany }: {
  opportunity: OpportunityItem;
  onAccept: (id: string) => void;
  onReject: (opp: OpportunityItem) => void;
  onViewCompany: (companyId: string) => void;
}) {
  const prioCfg = priorityConfig[opportunity.priority] ?? priorityConfig.medium;
  const statusCfg = statusConfig[opportunity.status];
  const PrioIcon = prioCfg.icon;
  const scorePct = opportunity.opportunityScore;

  const isPending = opportunity.status === 'pending_review';
  const isAccepted = opportunity.status === 'accepted';
  const isRejected = opportunity.status === 'rejected';

  return (
    <div className={cn(
      'rounded-xl border bg-white transition-all hover:shadow-md',
      isAccepted ? 'border-emerald-200' : isRejected ? 'border-red-100 opacity-70' : 'border-slate-200',
    )}>
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Company — T9 field 1 */}
            <button
              onClick={() => onViewCompany(opportunity.companyId)}
              className="flex items-center gap-1.5 text-left group mb-1"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                {opportunity.company?.normalizedName ?? 'Unknown Company'}
              </span>
              {opportunity.company?.industry && (
                <span className="text-[10px] text-slate-400 hidden sm:inline">{opportunity.company.industry}</span>
              )}
            </button>

            {/* Title */}
            <h3 className="text-xs font-semibold text-slate-700 leading-snug line-clamp-2">
              {opportunity.opportunityTitle}
            </h3>
          </div>

          {/* Priority badge — T9 field 5 */}
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0',
            prioCfg.badge,
          )}>
            <PrioIcon className="h-2.5 w-2.5" />
            {prioCfg.label}
          </span>
        </div>

        {/* Status badge */}
        {statusCfg && (
          <div className="mt-2">
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', statusCfg.color)}>
              {statusCfg.label}
            </span>
            {isRejected && opportunity.rejectionReason && (
              <span className="ml-2 text-[10px] text-red-500">
                ({opportunity.rejectionReason.replace(/_/g, ' ').toLowerCase()})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card body — key fields */}
      <div className="px-4 pb-3 space-y-2.5">
        {/* Score — T9 field 4 */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ConfidenceBar value={scorePct} label={scorePct >= 70 ? 'High' : scorePct >= 40 ? 'Medium' : 'Low'} size="sm" />
          </div>
          <span className="text-lg font-bold tabular-nums text-slate-900">{scorePct}</span>
        </div>

        {/* Trigger — T9 field 2 */}
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trigger</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
            {opportunity.businessTrigger}
          </p>
        </div>

        {/* Capability — T9 field 3 */}
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <Target className="h-3 w-3 text-blue-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recommended Capability</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
            {opportunity.recommendedCapability}
          </p>
        </div>

        {/* Why Now — T9 field 6 */}
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <ArrowRight className="h-3 w-3 text-emerald-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Why Now</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
            {opportunity.whyNow}
          </p>
        </div>
      </div>

      {/* Card footer — Accept/Reject buttons + metadata */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span>{formatTimeAgo(opportunity.createdAt)}</span>
            {opportunity.signal && (
              <>
                <span>·</span>
                <span className="capitalize">{opportunity.signal.signalType.replace(/_/g, ' ')}</span>
              </>
            )}
          </div>

          {/* T9: Accept/Reject buttons — only for pending_review */}
          {isPending && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject(opportunity)}
                className="h-10 text-[11px] px-2.5 text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => onAccept(opportunity.id)}
                className="h-10 text-[11px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Accept
              </Button>
            </div>
          )}

          {isAccepted && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              Pursuit Created
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Screen Component — Ticket 9: Opportunity Radar Screen (P0)
   ═══════════════════════════════════════════════════════════════ */

interface OpportunityRadarProps {
  navigateTo?: (screen: string, companyId?: string) => void;
}

export default function OpportunityRadarScreen({ navigateTo }: OpportunityRadarProps) {
  const queryClient = useQueryClient();

  /* ── Filter state — T9 API contract: ?status=X&priority=high&page=N ── */
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<OpportunityItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectFeedback, setRejectFeedback] = useState('');

  /* ── Build API URL with server-side filter params ── */
  const apiParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `/api/ai/opportunities?${qs}` : '/api/ai/opportunities';
  }, [statusFilter, priorityFilter, page]);

  /* ── Data fetching with useQuery ── */
  const { data: raw, isLoading, error: fetchError, refetch } = useQuery({
    queryKey: ['opportunities', statusFilter, priorityFilter, page],
    queryFn: () =>
      fetch(apiParams)
        .then(r => { if (!r.ok) throw new Error('Failed to fetch opportunities'); return r.json(); }),
    staleTime: 15000,
    retry: false,
  });
  const data = unwrap<OpportunitiesResponse>(raw) ?? null;
  const loading = isLoading;
  const error = fetchError?.message || null;

  const opportunities = data?.opportunities ?? [];
  const stats = data?.stats ?? { total: 0, byPriority: { high: 0, medium: 0, low: 0 }, byStatus: {} };
  const pagination = data?.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 };

  // Client-side search filter
  const searchLower = search.toLowerCase();
  const filtered = search
    ? opportunities.filter(o =>
        o.company?.normalizedName?.toLowerCase().includes(searchLower) ||
        o.opportunityTitle.toLowerCase().includes(searchLower) ||
        o.recommendedCapability.toLowerCase().includes(searchLower) ||
        o.businessTrigger.toLowerCase().includes(searchLower)
      )
    : opportunities;

  /* ── Accept mutation ── */
  const acceptMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/ai/opportunities/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackDecision: 'confirmed_accurate',
          feedbackReason: 'Accepted via Opportunity Radar',
        }),
      }).then(r => { if (!r.ok) throw new Error('Accept failed'); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });

  /* ── Reject mutation ── */
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason, feedback }: { id: string; reason: string; feedback: string }) =>
      fetch(`/api/ai/opportunities/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, feedback }),
      }).then(r => { if (!r.ok) throw new Error('Reject failed'); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setRejectTarget(null);
    },
  });

  const handleAccept = (id: string) => {
    acceptMutation.mutate(id);
  };

  const handleReject = (opp: OpportunityItem) => {
    setRejectTarget(opp);
  };

  const handleRejectConfirm = (reason: string, feedback: string) => {
    if (!rejectTarget) return;
    rejectMutation.mutate({ id: rejectTarget.id, reason, feedback });
  };

  const handleViewCompany = (companyId: string) => {
    // T9: "Click → navigate to Company Profile Q5" (5Q workspace)
    navigateTo?.('company-profile', companyId);
  };

  const clearFilters = () => {
    setStatusFilter('pending_review');
    setPriorityFilter('all');
    setPage(1);
    setSearch('');
  };

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [statusFilter, priorityFilter]);

  return (
    <ErrorBoundary>
      <PageTransition>
        <div className="h-full flex flex-col gap-0 overflow-hidden">
        {/* ═══════════════════════════════════════════════════
           Section 1: Header
           ═══════════════════════════════════════════════════ */}
        <div className="flex-shrink-0 px-4 sm:px-6 pt-6 pb-2">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200/50">
                <Radar className="h-5.5 w-5.5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Opportunity Radar</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI-detected opportunities matched to your capabilities, prioritized by score
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {data && <StatsBar stats={stats} />}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={loading}
                className="h-10 gap-1.5 text-xs"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
           Section 2: Filters — T9: "Priority filter, Status filter"
           ═══════════════════════════════════════════════════ */}
        <div className="flex-shrink-0 px-4 sm:px-6 pt-2 pb-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search opportunities..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 text-sm bg-slate-50 border-slate-200"
                />
              </div>

              {/* Status filter — T9: "Status filter (pending_review, accepted, rejected, monitored)" */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
              >
                <option value="all">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="monitored">Monitored</option>
              </select>

              {/* Priority filter — T9: "Priority filter (high, medium, low)" */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {/* Clear filters */}
              {(statusFilter !== 'pending_review' || priorityFilter !== 'all' || search) && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-2.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px]"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
           Section 3: Opportunity Cards
           ═══════════════════════════════════════════════════ */}
        <div className="flex-1 min-h-0 px-4 sm:px-6 pb-6 overflow-y-auto">
          {error && (
            <ErrorState
              title="Opportunity Radar Error"
              message={error}
              onRetry={() => refetch()}
              className="mb-4"
            />
          )}

          {loading && !data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-xl" />
              ))}
            </div>
          ) : !data || opportunities.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-[300px]">
              <EmptyState
                icon={Radar}
                title="No opportunities detected yet"
                description="Opportunities are generated when buying signals are matched to your capabilities. Import companies, run research, and ensure capabilities are configured to start seeing opportunities."
                action={
                  navigateTo && (
                    <Button onClick={() => navigateTo('import')} size="sm" className="gap-1.5">
                      Import Companies
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )
                }
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-[300px]">
              <EmptyState
                icon={Filter}
                title="No opportunities match your filters"
                description="Try adjusting your filter criteria to see more opportunities."
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5">
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {/* Cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onViewCompany={handleViewCompany}
                  />
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[11px] text-slate-500">
                    Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[11px] px-2.5 min-h-[44px]"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[11px] px-2.5 min-h-[44px]"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          opportunity={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
        />
      )}
      </PageTransition>
    </ErrorBoundary>
  );
}
