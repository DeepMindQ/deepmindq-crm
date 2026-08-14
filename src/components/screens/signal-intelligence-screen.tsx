'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { fetchApi } from '@/lib/fetchApi';
import { DataTable } from '@/components/enterprise/DataTable';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  AlertTriangle,
  Brain,
  TrendingUp,
  ExternalLink,
  Globe,
  FileText,
  Clock,
  XCircle,
} from 'lucide-react';

// ── Types ──

interface SignalEvidence {
  id: string;
  claim: string;
  sourceType: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceDate: string | null;
  excerpt: string | null;
  reliability: string;
}

interface SignalOrganization {
  name: string;
  domain: string | null;
  industry: string | null;
}

interface Signal {
  id: string;
  organizationId: string;
  organization: SignalOrganization;
  signalType: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  confidenceScore: number | null;
  impactScore: number | null;
  detectedAt: string;
  eventDate: string | null;
  source: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  analyzedAt: string | null;
  evidence: SignalEvidence[];
}

// ── Constants ──

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  hiring_change: 'Hiring Change',
  leadership_change: 'Leadership Change',
  technology_change: 'Technology Change',
  funding_event: 'Funding Event',
  market_expansion: 'Market Expansion',
  partnership: 'Partnership',
  competitor_move: 'Competitor Move',
  financial_indicator: 'Financial Indicator',
  product_launch: 'Product Launch',
  regulatory: 'Regulatory',
  customer_signal: 'Customer Signal',
  social_mention: 'Social Mention',
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
  high: { label: 'High', color: '#EA580C', bg: '#FFEDD5', border: '#FED7AA' },
  medium: { label: 'Medium', color: '#CA8A04', bg: '#FEF9C3', border: '#FDE68A' },
  low: { label: 'Low', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; strikethrough?: boolean }> = {
  detected: { label: 'Detected', color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
  validated: { label: 'Validated', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
  analyzed: { label: 'Analyzed', color: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE' },
  acted_upon: { label: 'Acted Upon', color: '#059669', bg: '#D1FAE5', border: '#A7F3D0' },
  expired: { label: 'Expired', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' },
  dismissed: { label: 'Dismissed', color: '#9CA3AF', bg: '#F9FAFB', border: '#F3F4F6', strikethrough: true },
};

// ── Helpers ──

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

// ── Badge Components ──

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {severity === 'critical' && <AlertTriangle className="w-3 h-3 mr-1" />}
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.detected;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        textDecoration: cfg.strikethrough ? 'line-through' : 'none',
      }}
    >
      {cfg.label}
    </span>
  );
}

function ConfidenceBar({ score }: { score: number | null }) {
  const value = score ?? 0;
  const barColor =
    value >= 75 ? tokens.confidence.high.value :
    value >= 50 ? tokens.confidence.medium.value :
    tokens.confidence.low.value;

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: tokens.surfaceExtended }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: barColor }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums" style={{ color: barColor, minWidth: '28px', textAlign: 'right' }}>
        {value > 0 ? value.toFixed(0) : '—'}
      </span>
    </div>
  );
}

// ── Stat Card ──

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4 transition-colors"
      style={{
        background: tokens.surface.card,
        border: `1px solid ${tokens.border.default}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>{label}</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: tokens.text.primary }}>{value}</span>
          {sub && <span className="text-xs" style={{ color: tokens.text.muted }}>{sub}</span>}
        </div>
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{ background: `${color}15`, color }}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-3 w-20 rounded" style={{ background: tokens.border.default }} />
          <Skeleton className="h-7 w-12 rounded" style={{ background: tokens.border.default }} />
        </div>
        <Skeleton className="w-9 h-9 rounded-lg" style={{ background: tokens.border.default }} />
      </div>
    </div>
  );
}

// ── Signal Detail Slide-Over ──

function SignalDetailPanel({
  signal,
  open,
  onOpenChange,
}: {
  signal: Signal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!signal) return null;

  const sevCfg = SEVERITY_CONFIG[signal.severity] ?? SEVERITY_CONFIG.medium;
  const statCfg = STATUS_CONFIG[signal.status] ?? STATUS_CONFIG.detected;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-hidden p-0"
        style={{
          background: tokens.surface.card,
          borderLeft: `1px solid ${tokens.border.default}`,
        }}
      >
        <SheetHeader className="p-5 pb-0" style={{ borderBottom: `1px solid ${tokens.border.default}` }}>
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={signal.severity} />
            <StatusBadge status={signal.status} />
          </div>
          <SheetTitle className="text-base font-semibold leading-snug" style={{ color: tokens.text.primary }}>
            {signal.title}
          </SheetTitle>
          <SheetDescription className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Detected {formatRelativeTime(signal.detectedAt)}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-180px)]">
          <div className="p-5 flex flex-col gap-5">

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                Organization
              </span>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 shrink-0" style={{ color: tokens.text.secondary }} />
                <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                  {signal.organization.name}
                </span>
              </div>
              {(signal.organization.domain || signal.organization.industry) && (
                <div className="flex items-center gap-3 ml-6">
                  {signal.organization.domain && (
                    <a
                      href={`https://${signal.organization.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs hover:underline"
                      style={{ color: tokens.accent.DEFAULT }}
                    >
                      {signal.organization.domain}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {signal.organization.industry && (
                    <span className="text-xs" style={{ color: tokens.text.muted }}>
                      {signal.organization.industry}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                Signal Type
              </span>
              <span className="text-sm" style={{ color: tokens.text.primary }}>
                {SIGNAL_TYPE_LABELS[signal.signalType] ?? signal.signalType}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-lg p-3"
                style={{ background: tokens.surfaceExtended, border: `1px solid ${tokens.border.default}` }}
              >
                <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>Confidence</span>
                <div className="mt-1">
                  <ConfidenceBar score={signal.confidenceScore} />
                </div>
              </div>
              <div
                className="rounded-lg p-3"
                style={{ background: tokens.surfaceExtended, border: `1px solid ${tokens.border.default}` }}
              >
                <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>Impact Score</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    className="text-lg font-bold tabular-nums"
                    style={{
                      color: (signal.impactScore ?? 0) >= 70 ? tokens.confidence.high.value :
                             (signal.impactScore ?? 0) >= 40 ? tokens.confidence.medium.value :
                             tokens.confidence.low.value
                    }}
                  >
                    {signal.impactScore != null ? signal.impactScore.toFixed(0) : '—'}
                  </span>
                  <span className="text-xs" style={{ color: tokens.text.muted }}>/ 100</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                Description
              </span>
              <p className="text-sm leading-relaxed" style={{ color: tokens.text.secondary }}>
                {signal.description}
              </p>
            </div>

            {(signal.sourceUrl || signal.sourceLabel) && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                  Source
                </span>
                {signal.sourceUrl ? (
                  <a
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm hover:underline break-all"
                    style={{ color: tokens.accent.DEFAULT }}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {signal.sourceLabel || signal.sourceUrl}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-sm" style={{ color: tokens.text.secondary }}>
                    {signal.sourceLabel}
                  </span>
                )}
              </div>
            )}

            {signal.eventDate && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                  Event Date
                </span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: tokens.text.secondary }} />
                  <span className="text-sm" style={{ color: tokens.text.secondary }}>
                    {formatDate(signal.eventDate)}
                  </span>
                </div>
              </div>
            )}

            {signal.evidence.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                  Evidence ({signal.evidence.length})
                </span>
                <div className="flex flex-col gap-2">
                  {signal.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-lg p-3 transition-colors"
                      style={{
                        background: tokens.surface.secondary,
                        border: `1px solid ${tokens.border.default}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          {ev.sourceTitle && (
                            <span className="text-xs font-semibold truncate" style={{ color: tokens.text.primary }}>
                              {ev.sourceTitle}
                            </span>
                          )}
                          <p className="text-xs leading-relaxed line-clamp-3" style={{ color: tokens.text.secondary }}>
                            {ev.excerpt || ev.claim}
                          </p>
                        </div>
                        <span
                          className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            color: ev.reliability === 'verified' ? tokens.trust.verified : tokens.text.muted,
                            background: ev.reliability === 'verified' ? tokens.trust.high.bg : tokens.surfaceExtended,
                          }}
                        >
                          {ev.reliability}
                        </span>
                      </div>
                      {ev.sourceUrl && (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] mt-1.5 hover:underline"
                          style={{ color: tokens.accent.dim }}
                        >
                          View source
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Screen ──

export default function SignalIntelligence() {
  // ── State ──
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sortKey, setSortKey] = useState<string>('detectedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Fetch Signals ──
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const res = await fetchApi<Signal[]>('/api/signals', {
        params: { limit: 200 },
      });
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setSignals(res.data);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Filtering & Sorting ──
  const filteredSignals = useMemo(() => {
    let result = [...signals];

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter((s) => s.signalType === typeFilter);
    }

    // Severity filter
    if (severityFilter !== 'all') {
      result = result.filter((s) => s.severity === severityFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.organization?.name?.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      const aVal = a[sortKey as keyof Signal];
      const bVal = b[sortKey as keyof Signal];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (aVal instanceof Date && bVal instanceof Date) {
        cmp = aVal.getTime() - bVal.getTime();
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [signals, typeFilter, severityFilter, statusFilter, searchQuery, sortKey, sortDir]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = signals.length;
    const critical = signals.filter((s) => s.severity === 'critical').length;
    const analyzed = signals.filter((s) => s.status === 'analyzed').length;
    const withConfidence = signals.filter((s) => s.confidenceScore != null);
    const avgConfidence =
      withConfidence.length > 0
        ? withConfidence.reduce((sum, s) => sum + (s.confidenceScore ?? 0), 0) / withConfidence.length
        : 0;

    return { total, critical, analyzed, avgConfidence };
  }, [signals]);

  // ── Handlers ──
  const handleRowClick = useCallback((row: Record<string, unknown>) => {
    setSelectedSignal(row as unknown as Signal);
    setDetailOpen(true);
  }, []);

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('desc');
      return key;
    });
  }, []);

  // ── Table Columns ──
  const columns = useMemo(
    () => [
      {
        key: 'title',
        label: 'Title',
        sortable: true,
        render: (_val: unknown, row: Record<string, unknown>) => (
          <div className="flex flex-col gap-0.5 min-w-[200px]">
            <span
              className="text-sm font-medium leading-snug line-clamp-2"
              style={{ color: tokens.text.primary }}
            >
              {String(row.title)}
            </span>
          </div>
        ),
      },
      {
        key: 'organization',
        label: 'Organization',
        sortable: true,
        render: (_val: unknown, row: Record<string, unknown>) => {
          const org = row.organization as SignalOrganization | undefined;
          if (!org) return <span style={{ color: tokens.text.muted }}>—</span>;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>{org.name}</span>
              {org.industry && (
                <span className="text-xs" style={{ color: tokens.text.muted }}>{org.industry}</span>
              )}
            </div>
          );
        },
      },
      {
        key: 'signalType',
        label: 'Type',
        sortable: true,
        render: (val) => (
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: tokens.text.secondary }}>
            {SIGNAL_TYPE_LABELS[String(val)] ?? String(val)}
          </span>
        ),
      },
      {
        key: 'severity',
        label: 'Severity',
        sortable: true,
        render: (val) => <SeverityBadge severity={String(val)} />,
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (val) => <StatusBadge status={String(val)} />,
      },
      {
        key: 'confidenceScore',
        label: 'Confidence',
        sortable: true,
        render: (val) => <ConfidenceBar score={val as number | null} />,
      },
      {
        key: 'detectedAt',
        label: 'Detected At',
        sortable: true,
        render: (val) => (
          <span className="text-xs tabular-nums whitespace-nowrap" style={{ color: tokens.text.muted }}>
            {val ? formatRelativeTime(String(val)) : '—'}
          </span>
        ),
      },
    ],
    []
  );

  // ── Render ──
  return (
    <main className="flex flex-col gap-5 p-6" style={{ background: tokens.surface.secondary, minHeight: '100%' }}>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: `${tokens.accent.DEFAULT}15`, color: tokens.accent.DEFAULT }}
          >
            <Activity className="w-4 h-4" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: tokens.text.primary }}>
            Signal Intelligence
          </h1>
        </div>
        <p className="text-sm ml-[42px]" style={{ color: tokens.text.secondary }}>
          Real-time business signals detected across your tracked organizations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={Activity}
              label="Total Signals"
              value={stats.total}
              sub="All tracked organizations"
              color={tokens.accent.DEFAULT}
            />
            <StatCard
              icon={AlertTriangle}
              label="Critical"
              value={stats.critical}
              sub={stats.total > 0 ? `${((stats.critical / stats.total) * 100).toFixed(0)}% of all signals` : undefined}
              color={SEVERITY_CONFIG.critical.color}
            />
            <StatCard
              icon={Brain}
              label="Analyzed"
              value={stats.analyzed}
              sub={stats.total > 0 ? `${((stats.analyzed / stats.total) * 100).toFixed(0)}% analyzed` : undefined}
              color={STATUS_CONFIG.analyzed.color}
            />
            <StatCard
              icon={TrendingUp}
              label="Avg Confidence"
              value={stats.avgConfidence > 0 ? `${stats.avgConfidence.toFixed(1)}%` : '—'}
              sub="Across all signals"
              color={tokens.confidence.high.value}
            />
          </>
        )}
      </div>

      <div
        className="flex flex-wrap items-center gap-3 rounded-xl p-3"
        style={{
          background: tokens.surface.card,
          border: `1px solid ${tokens.border.default}`,
        }}
      >

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            placeholder="Search by title or organization…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg text-xs outline-none transition-colors"
            style={{
              background: '#0d1117',
              border: `1px solid ${tokens.border.default}`,
              color: tokens.text.primary,
            }}
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: tokens.text.muted }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-70"
              style={{ color: tokens.text.muted }}
              aria-label="Clear search"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger
            size="sm"
            className="w-[170px]"
            style={{
              background: '#0d1117',
              border: `1px solid ${tokens.border.default}`,
              color: tokens.text.primary,
            }}
          >
            <SelectValue placeholder="Signal Type" />
          </SelectTrigger>
          <SelectContent
            style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
          >
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(SIGNAL_TYPE_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val} style={{ color: tokens.text.primary }}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger
            size="sm"
            className="w-[140px]"
            style={{
              background: '#0d1117',
              border: `1px solid ${tokens.border.default}`,
              color: tokens.text.primary,
            }}
          >
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent
            style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
          >
            <SelectItem value="all" style={{ color: tokens.text.primary }}>All Severity</SelectItem>
            {Object.entries(SEVERITY_CONFIG).map(([val, cfg]) => (
              <SelectItem key={val} value={val} style={{ color: cfg.color }}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            size="sm"
            className="w-[150px]"
            style={{
              background: '#0d1117',
              border: `1px solid ${tokens.border.default}`,
              color: tokens.text.primary,
            }}
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent
            style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
          >
            <SelectItem value="all" style={{ color: tokens.text.primary }}>All Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
              <SelectItem key={val} value={val} style={{ color: cfg.color }}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(typeFilter !== 'all' || severityFilter !== 'all' || statusFilter !== 'all') && (
          <button
            onClick={() => {
              setTypeFilter('all');
              setSeverityFilter('all');
              setStatusFilter('all');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
            style={{
              background: `${tokens.text.muted}15`,
              color: tokens.text.secondary,
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && !loading && (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl"
          style={{
            background: tokens.surface.card,
            border: `1px solid ${tokens.border.default}`,
          }}
        >
          <AlertTriangle className="w-8 h-8" style={{ color: SEVERITY_CONFIG.critical.color }} />
          <p className="text-sm" style={{ color: tokens.text.secondary }}>
            Failed to load signals: {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: tokens.accent.DEFAULT, color: tokens.flat.white }}
          >
            Retry
          </button>
        </div>
      )}

      {!error && (
        <DataTable
          columns={columns}
          data={filteredSignals as unknown as Record<string, unknown>[]}
          onRowClick={handleRowClick}
          onSort={handleSort}
          sortKey={sortKey}
          sortDir={sortDir}
          loading={loading}
          emptyMessage="No signals detected yet. Signals will appear here once the intelligence engine detects activity across your tracked organizations."
          exportable
          exportFilename="signals-export"
          filterable={false}
        />
      )}

      <SignalDetailPanel
        signal={selectedSignal}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </main>
  );
}
