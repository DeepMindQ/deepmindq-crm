'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { fetchApi } from '@/lib/fetchApi';
import { DataTable } from '@/components/enterprise/DataTable';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertTriangle, Brain, TrendingUp } from 'lucide-react';
import {
  SignalDetailPanel,
  SignalFilters,
  SIGNAL_TYPE_LABELS,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  formatRelativeTime,
  type Signal,
  type SignalOrganization,
} from './signal-intelligence';

// ── Badge Components (used in table columns) ──

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
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
    value >= 75
      ? tokens.confidence.high.value
      : value >= 50
        ? tokens.confidence.medium.value
        : tokens.confidence.low.value;
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
      <span
        className="text-xs font-medium tabular-nums"
        style={{ color: barColor, minWidth: '28px', textAlign: 'right' }}
      >
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
      style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
            {label}
          </span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: tokens.text.primary }}>
            {value}
          </span>
          {sub && (
            <span className="text-xs" style={{ color: tokens.text.muted }}>
              {sub}
            </span>
          )}
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

// ── Main Screen ──

export default function SignalIntelligence() {
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const res = await fetchApi<Signal[]>('/api/signals', { params: { limit: 200 } });
      if (cancelled) return;
      if (res.error) setError(res.error);
      else if (res.data) setSignals(res.data);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSignals = useMemo(() => {
    let result = [...signals];
    if (typeFilter !== 'all') result = result.filter((s) => s.signalType === typeFilter);
    if (severityFilter !== 'all') result = result.filter((s) => s.severity === severityFilter);
    if (statusFilter !== 'all') result = result.filter((s) => s.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) => s.title.toLowerCase().includes(q) || s.organization?.name?.toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      const aVal = a[sortKey as keyof Signal];
      const bVal = b[sortKey as keyof Signal];
      if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal;
      else if (aVal instanceof Date && bVal instanceof Date) cmp = aVal.getTime() - bVal.getTime();
      else if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [signals, typeFilter, severityFilter, statusFilter, searchQuery, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = signals.length;
    const critical = signals.filter((s) => s.severity === 'critical').length;
    const analyzed = signals.filter((s) => s.status === 'analyzed').length;
    const withConfidence = signals.filter((s) => s.confidenceScore != null);
    const avgConfidence =
      withConfidence.length > 0
        ? withConfidence.reduce((sum, s) => sum + (s.confidenceScore ?? 0), 0) /
          withConfidence.length
        : 0;
    return { total, critical, analyzed, avgConfidence };
  }, [signals]);

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
              <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                {org.name}
              </span>
              {org.industry && (
                <span className="text-xs" style={{ color: tokens.text.muted }}>
                  {org.industry}
                </span>
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
          <span
            className="text-xs font-medium whitespace-nowrap"
            style={{ color: tokens.text.secondary }}
          >
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
          <span
            className="text-xs tabular-nums whitespace-nowrap"
            style={{ color: tokens.text.muted }}
          >
            {val ? formatRelativeTime(String(val)) : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  const clearFilters = useCallback(() => {
    setTypeFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
  }, []);

  return (
    <main
      className="flex flex-col gap-5 p-6"
      style={{ background: tokens.surface.secondary, minHeight: '100%' }}
    >
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
              sub={
                stats.total > 0
                  ? `${((stats.critical / stats.total) * 100).toFixed(0)}% of all signals`
                  : undefined
              }
              color={SEVERITY_CONFIG.critical.color}
            />
            <StatCard
              icon={Brain}
              label="Analyzed"
              value={stats.analyzed}
              sub={
                stats.total > 0
                  ? `${((stats.analyzed / stats.total) * 100).toFixed(0)}% analyzed`
                  : undefined
              }
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

      <SignalFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        severityFilter={severityFilter}
        onSeverityFilterChange={setSeverityFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onClearFilters={clearFilters}
      />

      {error && !loading && (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl"
          style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
        >
          <AlertTriangle className="w-8 h-8" style={{ color: SEVERITY_CONFIG.critical.color }} />
          <p className="text-sm" style={{ color: tokens.text.secondary }}>
            Failed to load signals: {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: tokens.accent.DEFAULT, color: tokens.text.inverse }}
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

      <SignalDetailPanel signal={selectedSignal} open={detailOpen} onOpenChange={setDetailOpen} />
    </main>
  );
}
