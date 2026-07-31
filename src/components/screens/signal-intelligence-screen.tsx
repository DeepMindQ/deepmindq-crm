'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Radar, Activity, TrendingUp, DollarSign, Cpu, Crown,
  Building2, Clock, ChevronRight, RefreshCw, Filter, X, Search,
  ArrowRight, LucideIcon, ShieldAlert, Shield, ShieldCheck,
  FileText, CheckCircle2, Loader2, Target,
} from 'lucide-react';
import { PageTransition, EmptyState } from '@/components/ui/animated-components';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { ErrorState } from '@/components/enterprise/ErrorState';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   Types — aligned with CompanySignal schema + T8 API contract
   ═══════════════════════════════════════════════════════════════ */
interface SignalCapabilityMatch {
  id: string;
  matchScore: number;
  reason: string;
  businessProblem?: string;
  expectedOutcome?: string;
  salesAngle?: string;
  capability: { id: string; title: string; category?: string | null };
}

interface SignalItem {
  id: string;
  signalType: string;
  title: string;
  description?: string | null;
  companyName?: string;
  companyId: string;
  company?: { id: string; normalizedName: string; website?: string | null };
  severity: string;
  impact: string;
  confidence: number;
  meaningCategory?: string | null;
  signalDate?: string | null;
  extractedAt: string;
  source?: string | null;
  sourceUrl?: string | null;
  businessImpact?: string | null;
  recommendedAction?: string | null;
  timingWindow?: string | null;
  status: string;
  isRead: boolean;
  signalCapabilityMatches?: SignalCapabilityMatch[];
}

interface SignalsResponse {
  signals: SignalItem[];
  evidenceCounts: Record<string, number>;
  categories: string[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/* ═══════════════════════════════════════════════════════════════
   Evidence Record type — mirrors Evidence model fields returned
   by GET /api/signals/[id]/evidence
   ═══════════════════════════════════════════════════════════════ */
interface EvidenceRecord {
  id: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceName: string | null;
  snippet: string;
  extractedField: string | null;
  extractedValue: string | null;
  relevanceScore: number;
  confidence: number;
  sourceDate: string | null;
  sourceQualityTier: string;
  status: string;
  createdAt: string;
}

/* ═══════════════════════════════════════════════════════════════
   Severity / Type / Meaning Config — per T8 spec enums
   ═══════════════════════════════════════════════════════════════ */
const severityConfig: Record<string, {
  label: string; icon: LucideIcon; badge: string; order: number;
}> = {
  critical: { label: 'Critical', icon: ShieldAlert,   badge: 'bg-red-100 text-red-800 border-red-200',      order: 0 },
  high:     { label: 'High',     icon: Shield,         badge: 'bg-amber-100 text-amber-800 border-amber-200', order: 1 },
  medium:   { label: 'Medium',   icon: ShieldCheck,    badge: 'bg-blue-100 text-blue-800 border-blue-200',    order: 2 },
  low:      { label: 'Low',      icon: Shield,         badge: 'bg-slate-100 text-slate-700 border-slate-200', order: 3 },
};

const typeConfig: Record<string, { icon: LucideIcon; label: string }> = {
  funding:             { icon: DollarSign,   label: 'Funding' },
  hiring:              { icon: Activity,     label: 'Hiring' },
  leadership_change:   { icon: Crown,        label: 'Leadership' },
  leadership:          { icon: Crown,        label: 'Leadership' },
  tech_change:         { icon: Cpu,          label: 'Technology' },
  technology:          { icon: Cpu,          label: 'Technology' },
  news:                { icon: FileText,     label: 'News' },
  mention:             { icon: FileText,     label: 'Mention' },
  partnership:         { icon: TrendingUp,   label: 'Partnership' },
  expansion:           { icon: TrendingUp,   label: 'Expansion' },
  people_change:       { icon: Activity,     label: 'People Change' },
  internal_memory:     { icon: FileText,     label: 'Internal Memory' },
};

const meaningCategoryConfig: Record<string, { label: string; color: string }> = {
  budget_available:      { label: 'Budget Available',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  leadership_openness:   { label: 'Leadership Open',       color: 'bg-violet-100 text-violet-700 border-violet-200' },
  tech_dissatisfaction:  { label: 'Tech Dissatisfaction',  color: 'bg-red-100 text-red-700 border-red-200' },
  growth_pressure:       { label: 'Growth Pressure',       color: 'bg-amber-100 text-amber-700 border-amber-200' },
  compliance_requirement:{ label: 'Compliance Need',       color: 'bg-blue-100 text-blue-700 border-blue-200' },
  vendor_evaluation:    { label: 'Vendor Evaluation',      color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
};

const impactConfig: Record<string, { label: string; color: string }> = {
  high:   { label: 'High',   color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Med',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

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

function getConfidenceLabel(conf: number | undefined): string {
  if (conf === undefined) return '—';
  if (conf >= 80) return 'High';
  if (conf >= 60) return 'Medium';
  return 'Low';
}

/* ═══════════════════════════════════════════════════════════════
   Evidence Detail Side Panel — T8: "Click signal → evidence detail panel"
   Opens as a right-side panel when a signal row is clicked.
   ═══════════════════════════════════════════════════════════════ */
function EvidenceDetailPanel({ signal, evidenceCount, onClose }: {
  signal: SignalItem;
  evidenceCount: number;
  onClose: () => void;
}) {
  const { data: evidenceRaw, isLoading: evidenceLoading } = useQuery({
    queryKey: ['signal-evidence', signal.id],
    queryFn: () =>
      fetch(`/api/signals/${signal.id}/evidence`)
        .then(r => { if (!r.ok) throw new Error('Failed to fetch evidence'); return r.json(); }),
    staleTime: 30000,
    retry: false,
    enabled: true,
  });
  const evidenceData = unwrap<{ evidence: EvidenceRecord[]; signalId: string }>(evidenceRaw);
  const evidenceRecords: EvidenceRecord[] = evidenceData?.evidence ?? [];

  const sevCfg = severityConfig[signal.severity] ?? severityConfig.low;
  const meaningCfg = signal.meaningCategory ? meaningCategoryConfig[signal.meaningCategory] : null;
  const typeCfg = typeConfig[signal.signalType] ?? { icon: Activity, label: signal.signalType };
  const TypeIcon = typeCfg.icon;
  const impactCfg = impactConfig[signal.impact] ?? impactConfig.medium;

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Signal Detail
          </span>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>
        <h3 className="text-sm font-bold text-slate-900 leading-snug">{signal.title}</h3>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Type badge */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-slate-50 text-slate-600 border-slate-200">
            <TypeIcon className="h-3 w-3" />
            {typeCfg.label}
          </span>
          {/* Severity badge — T8: color-coded */}
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', sevCfg.badge)}>
            {sevCfg.label}
          </span>
          {/* Impact */}
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', impactCfg.color)}>
            {impactCfg.label} Impact
          </span>
          {/* Meaning */}
          {meaningCfg && (
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', meaningCfg.color)}>
              {meaningCfg.label}
            </span>
          )}
        </div>
        {signal.description && (
          <p className="text-xs text-slate-600 leading-relaxed mt-2">{signal.description}</p>
        )}
      </div>

      {/* Panel body — scrollable */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 flex flex-col gap-3">

          {/* ── Evidence List: Actual Evidence records backing this signal ── */}
          <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="h-3 w-3 text-blue-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                Supporting Evidence
              </span>
              <Badge variant="secondary" className="text-[10px] ml-1">{evidenceRecords.length}</Badge>
            </div>

            {evidenceLoading && (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                <span className="text-xs text-slate-400">Loading evidence records...</span>
              </div>
            )}

            {!evidenceLoading && evidenceRecords.length === 0 && (
              <div className="py-2">
                <p className="text-xs text-slate-400">
                  {evidenceCount > 0
                    ? `${evidenceCount} evidence record(s) referenced but not yet resolved.`
                    : 'No evidence records are linked to this signal.'}
                </p>
                {signal.sourceUrl && (
                  <a
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  >
                    {signal.sourceUrl.length > 60 ? signal.sourceUrl.slice(0, 60) + '...' : signal.sourceUrl}
                  </a>
                )}
              </div>
            )}

            {!evidenceLoading && evidenceRecords.length > 0 && (
              <div className="flex flex-col gap-2">
                {evidenceRecords.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-md bg-white border border-slate-100 p-2.5 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {ev.sourceTitle || ev.sourceName || 'Untitled Evidence'}
                        </p>
                        {ev.sourceName && ev.sourceTitle && (
                          <p className="text-[10px] text-slate-400">{ev.sourceName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase border',
                          ev.sourceQualityTier === 'premium'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : ev.sourceQualityTier === 'low'
                              ? 'bg-slate-50 text-slate-500 border-slate-200'
                              : 'bg-blue-50 text-blue-600 border-blue-200'
                        )}>
                          {ev.sourceQualityTier}
                        </span>
                        <span className="text-[10px] font-bold tabular-nums text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                          {Math.round(ev.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">{ev.snippet}</p>
                    {ev.extractedField && ev.extractedValue && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">{ev.extractedField}:</span>
                        <span className="text-[11px] font-semibold text-slate-700">{ev.extractedValue}</span>
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      {ev.sourceUrl && (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline transition-colors truncate max-w-[200px]"
                        >
                          {ev.sourceUrl.length > 40 ? ev.sourceUrl.slice(0, 40) + '...' : ev.sourceUrl}
                        </a>
                      )}
                      {ev.sourceDate && (
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {formatTimeAgo(ev.sourceDate)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Business Impact */}
          {signal.businessImpact && (
            <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Business Impact</span>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">{signal.businessImpact}</p>
            </div>
          )}

          {/* Recommended Action */}
          {signal.recommendedAction && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Recommended Action</span>
              <p className="text-xs text-slate-700 font-medium leading-relaxed mt-1">{signal.recommendedAction}</p>
            </div>
          )}

          {/* ── Signal-to-Capability Match Display — T8 exit criteria ── */}
          <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="h-3 w-3 text-blue-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                Signal-to-Capability Matches
              </span>
              {signal.signalCapabilityMatches && (
                <Badge variant="secondary" className="text-[10px] ml-1">{signal.signalCapabilityMatches.length}</Badge>
              )}
            </div>
            {!signal.signalCapabilityMatches || signal.signalCapabilityMatches.length === 0 ? (
              <p className="text-xs text-slate-500">No capability matches yet for this signal.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {signal.signalCapabilityMatches.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 rounded-md bg-white border border-slate-100 p-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-800 truncate">{m.capability.title}</span>
                        <span className="text-[10px] font-bold tabular-nums text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {Math.round(m.matchScore * 100)}%
                        </span>
                      </div>
                      {m.reason && (
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{m.reason}</p>
                      )}
                      {m.salesAngle && (
                        <div className="mt-1.5 flex items-start gap-1">
                          <ArrowRight className="h-2.5 w-2.5 text-blue-500 mt-0.5 shrink-0" />
                          <span className="text-[11px] text-blue-600 font-medium leading-relaxed">{m.salesAngle}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Screen Component
   ═══════════════════════════════════════════════════════════════ */
interface SignalIntelligenceProps {
  navigateTo?: (screen: string, companyId?: string) => void;
}

export default function SignalIntelligenceScreen({ navigateTo }: SignalIntelligenceProps) {
  /* ── Server-side filtering state — T8 API contract supports:
     ?companyId={id}&type=funding&severity=high&status=active&meaningCategory=X&page=N ── */
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [meaningFilter, setMeaningFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Selected signal for evidence detail side panel
  const [selectedSignal, setSelectedSignal] = useState<SignalItem | null>(null);

  // Build API URL with server-side filter params per T8 API contract
  const apiParams = useMemo(() => {
    const params = new URLSearchParams();
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (meaningFilter !== 'all') params.set('meaningCategory', meaningFilter);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `/api/signals?${qs}` : '/api/signals';
  }, [typeFilter, severityFilter, statusFilter, meaningFilter, page]);

  /* ── Data fetching with useQuery — T8 API contract ── */
  const { data: raw, isLoading, error: fetchError, refetch: fetchSignals } = useQuery({
    queryKey: ['signals', typeFilter, severityFilter, statusFilter, meaningFilter, page],
    queryFn: () =>
      fetch(apiParams)
        .then(r => { if (!r.ok) throw new Error('Failed to fetch signals'); return r.json(); }),
    staleTime: 15000,
    retry: false,
  });
  const data = unwrap<SignalsResponse>(raw) ?? null;
  const loading = isLoading;
  const error = fetchError?.message || null;

  const signals = data?.signals ?? [];
  const evidenceCounts = data?.evidenceCounts ?? {};
  const categories = data?.categories ?? [];
  const pagination = data?.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 };

  // Client-side search filter (on top of server-side filtering)
  const searchLower = search.toLowerCase();
  const filteredSignals = search
    ? signals.filter(s =>
        s.company?.normalizedName?.toLowerCase().includes(searchLower) ||
        s.title.toLowerCase().includes(searchLower) ||
        s.description?.toLowerCase().includes(searchLower) ||
        s.signalType.toLowerCase().includes(searchLower)
      )
    : signals;

  const handleViewCompany = (companyId: string) => {
    navigateTo?.('company-detail', companyId);
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
    setMeaningFilter('all');
    setPage(1);
    setSearch('');
  };

  const activeFilterCount = [
    typeFilter !== 'all' ? 1 : 0,
    severityFilter !== 'all' ? 1 : 0,
    statusFilter !== 'all' ? 1 : 0,
    meaningFilter !== 'all' ? 1 : 0,
    search ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleRowClick = (signal: SignalItem) => {
    setSelectedSignal(prev => prev?.id === signal.id ? null : signal);
  };

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [typeFilter, severityFilter, statusFilter, meaningFilter]);

  return (
    <PageTransition>
      <div className="h-full flex flex-col gap-0 overflow-hidden">
        {/* ═══════════════════════════════════════════════════
           Section 1: Signal Intelligence Header
           ═══════════════════════════════════════════════════ */}
        <div className="flex-shrink-0 px-4 sm:px-6 pt-6 pb-2">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200/50">
                <Radar className="h-5.5 w-5.5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Signal Intelligence</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI-detected buying signals, evidence, and capability matches across your accounts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {data && signals.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-400 mr-1">
                    {pagination.total} signals
                  </span>
                  {pagination.totalPages > 1 && (
                    <span className="text-[11px] text-slate-400">
                      Page {pagination.page}/{pagination.totalPages}
                    </span>
                  )}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchSignals()}
                disabled={loading}
                className="h-8 gap-1.5 text-xs"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
           Section 2: Filters — T8: Meaning category filter + Severity badge filter
           Server-side: type, severity, status, meaningCategory, page
           ═══════════════════════════════════════════════════ */}
        {data && signals.length > 0 && (
          <div className="flex-shrink-0 px-4 sm:px-6 pt-2 pb-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              {/* Search */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search signals..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm bg-slate-50 border-slate-200"
                  />
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Type filter — server-side */}
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  >
                    <option value="all">All Types</option>
                    <option value="funding">Funding</option>
                    <option value="hiring">Hiring</option>
                    <option value="leadership_change">Leadership Change</option>
                    <option value="leadership">Leadership</option>
                    <option value="tech_change">Tech Change</option>
                    <option value="technology">Technology</option>
                    <option value="news">News</option>
                    <option value="mention">Mention</option>
                    <option value="partnership">Partnership</option>
                    <option value="expansion">Expansion</option>
                    <option value="people_change">People Change</option>
                    <option value="internal_memory">Internal Memory</option>
                  </select>

                  {/* Severity filter — server-side — T8: "Severity badge (color-coded)" */}
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  {/* Status filter — server-side */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  >
                    <option value="all">All Statuses</option>
                    <option value="detected">Detected</option>
                    <option value="validated">Validated</option>
                    <option value="active">Active</option>
                    <option value="aging">Aging</option>
                    <option value="expired">Expired</option>
                    <option value="archived">Archived</option>
                  </select>

                  {/* Meaning category filter — T8: "Meaning category filter (budget_available, leadership_openness, etc.)" */}
                  <select
                    value={meaningFilter}
                    onChange={(e) => setMeaningFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  >
                    <option value="all">All Meanings</option>
                    {Object.entries(meaningCategoryConfig)
                      .filter(([k]) => categories.includes(k))
                      .map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                  </select>

                  {/* Active filter indicator */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
           Section 3: Signal Table — T8: "Signal table: Title, Type, Severity, Impact, Confidence, Meaning, Date"
           Uses shadcn/ui Table component — consistent with companies-screen.tsx (Ticket 6)
           ═══════════════════════════════════════════════════ */}
        <div className="flex-1 min-h-0 px-4 sm:px-6 pb-6">
          {error && (
            <ErrorState
              title="Signal Intelligence Error"
              message={error}
              onRetry={() => fetchSignals()}
              className="mb-4"
            />
          )}

          {loading && !data ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : !data || signals.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={Radar}
                title="No signals detected yet"
                description="Signals are generated from our intelligence pipeline when company data is enriched. Import companies and run research to start detecting buying signals, technology changes, leadership moves, funding events, and more."
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
          ) : filteredSignals.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={Filter}
                title="No signals match your filters"
                description="Try adjusting your filter criteria to see more signals."
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5">
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="flex gap-4 h-[calc(100vh-300px)]">
              {/* Main table area */}
              <div className={cn('flex-1 min-w-0 overflow-hidden', selectedSignal ? 'border-r border-slate-200' : '')}>
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        {/* T8 columns: Title, Type, Severity, Impact, Confidence, Meaning, Date */}
                        <TableHead className="w-[300px] text-xs font-semibold text-slate-500">Title</TableHead>
                        <TableHead className="w-[100px] text-xs font-semibold text-slate-500">Type</TableHead>
                        <TableHead className="w-[90px] text-xs font-semibold text-slate-500">Severity</TableHead>
                        <TableHead className="w-[90px] text-xs font-semibold text-slate-500">Impact</TableHead>
                        <TableHead className="w-[140px] text-xs font-semibold text-slate-500">Confidence</TableHead>
                        <TableHead className="w-[130px] text-xs font-semibold text-slate-500">Meaning</TableHead>
                        <TableHead className="w-[90px] text-xs font-semibold text-slate-500">Date</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSignals.map((signal) => {
                        const sevCfg = severityConfig[signal.severity] ?? severityConfig.low;
                        const SevIcon = sevCfg.icon;
                        const typeCfg = typeConfig[signal.signalType] ?? { icon: Activity, label: signal.signalType };
                        const TypeIcon = typeCfg.icon;
                        const impactCfg = impactConfig[signal.impact] ?? impactConfig.medium;
                        const meaningCfg = signal.meaningCategory ? meaningCategoryConfig[signal.meaningCategory] : null;
                        const confPct = Math.round((signal.confidence ?? 0) * 100);
                        const isSelected = selectedSignal?.id === signal.id;

                        return (
                          <TableRow
                            key={signal.id}
                            className={cn(
                              'cursor-pointer transition-colors',
                              isSelected ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/50'
                            )}
                            onClick={() => handleRowClick(signal)}
                          >
                            {/* Title — T8 column 1 */}
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-semibold text-slate-900 truncate">{signal.title}</span>
                                {signal.company?.normalizedName && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleViewCompany(signal.companyId); }}
                                    className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline transition-colors text-left"
                                  >
                                    {signal.company.normalizedName}
                                  </button>
                                )}
                              </div>
                            </TableCell>

                            {/* Type — T8 column 2 */}
                            <TableCell>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-slate-50 text-slate-600 border-slate-200">
                                <TypeIcon className="h-3 w-3" />
                                {typeCfg.label}
                              </span>
                            </TableCell>

                            {/* Severity — T8 column 3 + "Severity badge (color-coded)" */}
                            <TableCell>
                              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', sevCfg.badge)}>
                                <SevIcon className="h-2.5 w-2.5" />
                                {sevCfg.label}
                              </span>
                            </TableCell>

                            {/* Impact — T8 column 4 */}
                            <TableCell>
                              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', impactCfg.color)}>
                                {impactCfg.label}
                              </span>
                            </TableCell>

                            {/* Confidence — T8 column 5 */}
                            <TableCell>
                              <ConfidenceBar value={confPct} label={getConfidenceLabel(confPct)} size="sm" />
                            </TableCell>

                            {/* Meaning — T8 column 6 */}
                            <TableCell>
                              {meaningCfg ? (
                                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', meaningCfg.color)}>
                                  {meaningCfg.label}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">—</span>
                              )}
                            </TableCell>

                            {/* Date — T8 column 7 */}
                            <TableCell>
                              <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                                {signal.signalDate ? formatTimeAgo(signal.signalDate) : formatTimeAgo(signal.extractedAt)}
                              </span>
                            </TableCell>

                            {/* Evidence count + action */}
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {(evidenceCounts[signal.id] ?? 0) > 0 && (
                                  <Badge variant="secondary" className="text-[10px] tabular-nums">
                                    {evidenceCounts[signal.id]} ev
                                  </Badge>
                                )}
                                <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', isSelected && 'rotate-90 text-blue-500')} />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] text-slate-500">
                      Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] px-2.5"
                        disabled={pagination.page <= 1}
                        onClick={() => setPage(p => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] px-2.5"
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => setPage(p => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Evidence Detail Side Panel — T8: "Click signal → evidence detail panel" ── */}
              {selectedSignal && (
                <div className="w-[420px] flex-shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <EvidenceDetailPanel
                    signal={selectedSignal}
                    evidenceCount={evidenceCounts[selectedSignal.id] ?? 0}
                    onClose={() => setSelectedSignal(null)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
