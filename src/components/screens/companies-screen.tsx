'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import { fetchApi } from '@/lib/fetchApi';
import { useAppStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Activity,
  BrainCircuit,
  TrendingUp,
  ArrowUpDown,
  Upload,
  ExternalLink,
  CircleDot,
  Pause,
  Clock,
} from 'lucide-react';

type SortKey = 'name' | 'intelligenceScore' | 'updatedAt';
type SortDir = 'asc' | 'desc';

interface Organization {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  intelligenceScore: number | null;
  trackingStatus: string;
  lastSignalAt: string | null;
  updatedAt: string;
  signalCount: number;
}

interface ApiResponse {
  data: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/* ─── Helpers ─── */

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getScoreColor(score: number | null): { color: string; bg: string } {
  if (score == null) return { color: tokens.text.muted, bg: tokens.neutral['100'] };
  if (score >= 80) return { color: tokens.confidence.high.value, bg: tokens.confidence.high.bg };
  if (score >= 50)
    return { color: tokens.confidence.medium.value, bg: tokens.confidence.medium.bg };
  return { color: tokens.confidence.low.value, bg: tokens.confidence.low.bg };
}

function getStatusConfig(status: string): {
  label: string;
  color: string;
  bg: string;
  icon: typeof CircleDot;
} {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        color: tokens.confidence.high.value,
        bg: tokens.confidence.high.bg,
        icon: Activity,
      };
    case 'paused':
      return {
        label: 'Paused',
        color: tokens.confidence.medium.value,
        bg: tokens.confidence.medium.bg,
        icon: Pause,
      };
    case 'inactive':
    default:
      return {
        label: 'Inactive',
        color: tokens.text.muted,
        bg: tokens.neutral['100'],
        icon: Clock,
      };
  }
}

/* ─── Stat Card ─── */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl transition-all"
      style={{
        background: tokens.surface.card,
        border: `1px solid ${tokens.border.default}`,
      }}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
        style={{ background: `${accent}15`, color: accent }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
          {label}
        </p>
        <p
          className="text-xl font-bold tracking-tight mt-0.5"
          style={{ color: tokens.text.primary }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Score Bar ─── */

function ScoreBar({ score }: { score: number | null }) {
  const { color, bg } = getScoreColor(score);
  const displayScore = score ?? 0;
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg text-xs font-bold"
        style={{ background: bg, color }}
      >
        {score != null ? score : '—'}
      </div>
      <div className="flex-1 min-w-0 max-w-[80px]">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: tokens.border.default }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${displayScore}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Status Badge ─── */

function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);
  const StatusIcon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: config.bg, color: config.color }}
    >
      <StatusIcon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

/* ─── Empty State ─── */

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div
        className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
        style={{ background: `${tokens.accent.primary}12` }}
      >
        <Building2 className="w-8 h-8" style={{ color: tokens.accent.primary }} />
      </div>
      <h3 className="text-base font-semibold mb-1.5" style={{ color: tokens.text.primary }}>
        No organizations yet
      </h3>
      <p className="text-sm text-center max-w-sm mb-6" style={{ color: tokens.text.secondary }}>
        Start building your intelligence database by importing organizations. You can import from
        CSV, connect a CRM, or add them manually.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={onImport}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: tokens.accent.primary,
            color: tokens.text.inverse,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = tokens.accent.hover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = tokens.accent.primary;
          }}
        >
          <Upload className="w-4 h-4" />
          Import Organizations
        </button>
        <button
          onClick={onImport}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            border: `1px solid ${tokens.border.default}`,
            color: tokens.text.secondary,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = tokens.surface.secondary;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          Connect CRM
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Companies Screen
   ═══════════════════════════════════════════════════ */

export default function Companies() {
  const { setActiveView, setSelectedCompanyId } = useAppStore();

  // ── Data state ──
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Sort state ──
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await fetchApi<ApiResponse>('/api/organizations', {
      params: { limit: 200 },
    });

    if (fetchError || !data) {
      setError(fetchError || 'Failed to load organizations');
      setLoading(false);
      return;
    }

    setOrganizations(data.data);
    setTotalCount(data.pagination.total);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Client-side sort ──
  const sortedData = useMemo(() => {
    const sorted = [...organizations];
    sorted.sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortKey) {
        case 'name':
          aVal = a.name?.toLowerCase() ?? '';
          bVal = b.name?.toLowerCase() ?? '';
          break;
        case 'intelligenceScore':
          aVal = a.intelligenceScore ?? 0;
          bVal = b.intelligenceScore ?? 0;
          break;
        case 'updatedAt':
        default:
          aVal = a.updatedAt ?? '';
          bVal = b.updatedAt ?? '';
          break;
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [organizations, sortKey, sortDir]);

  // ── Computed stats ──
  const stats = useMemo(() => {
    const total = totalCount;
    const active = organizations.filter((o) => o.trackingStatus === 'active').length;
    const scored = organizations.filter((o) => o.intelligenceScore != null);
    const avgScore =
      scored.length > 0
        ? Math.round(scored.reduce((sum, o) => sum + (o.intelligenceScore ?? 0), 0) / scored.length)
        : 0;

    return { total, active, avgScore };
  }, [organizations, totalCount]);

  // ── Handlers ──
  const handleSort = useCallback(
    (key: string) => {
      if (key === sortKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key as SortKey);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  const handleRowClick = useCallback(
    (row: Record<string, unknown>) => {
      const org = row as unknown as Organization;
      setSelectedCompanyId(org.id);
      setActiveView('company-detail');
    },
    [setSelectedCompanyId, setActiveView],
  );

  const handleImport = useCallback(() => {
    setActiveView('import');
  }, [setActiveView]);

  // ── Table columns ──
  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Name',
        sortable: true,
        render: (_value: unknown, row: Record<string, unknown>) => {
          const org = row as unknown as Organization;
          return (
            <div className="flex items-center gap-3 min-w-[180px]">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 text-xs font-bold"
                style={{
                  background: `${tokens.accent.primary}15`,
                  color: tokens.accent.primary,
                }}
              >
                {org.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: tokens.text.primary }}
                >
                  {org.name}
                </p>
                {org.domain && (
                  <p className="text-xs truncate" style={{ color: tokens.text.muted }}>
                    {org.domain}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: 'domain',
        label: 'Domain',
        render: (value: unknown) => {
          const domain = value as string | null;
          if (!domain) return <span style={{ color: tokens.text.muted }}>—</span>;
          return (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-mono"
              style={{ color: tokens.text.secondary }}
            >
              <ExternalLink className="w-3 h-3 shrink-0" style={{ color: tokens.text.muted }} />
              {domain}
            </span>
          );
        },
      },
      {
        key: 'industry',
        label: 'Industry',
        render: (value: unknown) => {
          const industry = value as string | null;
          if (!industry) return <span style={{ color: tokens.text.muted }}>—</span>;
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{
                background: tokens.surfaceExtended,
                color: tokens.text.secondary,
              }}
            >
              {industry}
            </span>
          );
        },
      },
      {
        key: 'intelligenceScore',
        label: 'Intel Score',
        sortable: true,
        render: (value: unknown) => <ScoreBar score={value as number | null} />,
      },
      {
        key: 'signalCount',
        label: 'Signals',
        render: (value: unknown) => {
          const count = value as number;
          return (
            <span
              className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-xs font-bold"
              style={{
                background: count > 0 ? `${tokens.domain.opportunity}15` : tokens.surfaceExtended,
                color: count > 0 ? tokens.domain.opportunity : tokens.text.muted,
              }}
            >
              {count}
            </span>
          );
        },
      },
      {
        key: 'trackingStatus',
        label: 'Status',
        render: (value: unknown) => <StatusBadge status={value as string} />,
      },
      {
        key: 'updatedAt',
        label: 'Last Updated',
        sortable: true,
        render: (value: unknown) => (
          <span className="text-xs" style={{ color: tokens.text.secondary }}>
            {formatRelativeDate(value as string | null)}
          </span>
        ),
      },
    ],
    [],
  );

  // ── Transform data for DataTable ──
  const tableData = useMemo(
    () => sortedData.map((o) => ({ ...o })) as Record<string, unknown>[],
    [sortedData],
  );

  // ── Loading skeleton for stats ──
  const statsSkeleton = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{
            background: tokens.surface.card,
            border: `1px solid ${tokens.border.default}`,
          }}
        >
          <Skeleton
            className="w-10 h-10 rounded-lg shrink-0"
            style={{ background: tokens.border.default }}
          />
          <div className="flex-1">
            <Skeleton
              className="h-3 w-20 mb-2 rounded"
              style={{ background: tokens.border.default }}
            />
            <Skeleton className="h-6 w-16 rounded" style={{ background: tokens.border.default }} />
          </div>
        </div>
      ))}
    </div>
  );

  // ── Error state ──
  if (error && !loading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: `${tokens.confidence.low.bg}` }}
          >
            <Building2 className="w-8 h-8" style={{ color: tokens.confidence.low.value }} />
          </div>
          <h3 className="text-base font-semibold mb-1.5" style={{ color: tokens.text.primary }}>
            Failed to load organizations
          </h3>
          <p className="text-sm text-center max-w-sm mb-6" style={{ color: tokens.text.secondary }}>
            {error}
          </p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: tokens.accent.primary,
              color: tokens.text.inverse,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = tokens.accent.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = tokens.accent.primary;
            }}
          >
            <ArrowUpDown className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state (no data, not loading) ──
  if (!loading && organizations.length === 0) {
    return (
      <div className="p-6">
        <EmptyState onImport={handleImport} />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Organizations
          </h1>
          <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>
            Track intelligence signals across your target accounts
          </p>
        </div>
        <button
          onClick={handleImport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0"
          style={{
            background: tokens.accent.primary,
            color: tokens.text.inverse,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = tokens.accent.hover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = tokens.accent.primary;
          }}
        >
          <Upload className="w-4 h-4" />
          Add Organization
        </button>
      </div>

      {/* ── Stats Cards ── */}
      {loading ? (
        statsSkeleton
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={Building2}
            label="Total Organizations"
            value={stats.total.toLocaleString()}
            sub={`${stats.active} actively tracked`}
            accent={tokens.accent.primary}
          />
          <StatCard
            icon={Activity}
            label="Active Tracking"
            value={stats.active.toLocaleString()}
            sub={
              stats.total > 0
                ? `${Math.round((stats.active / stats.total) * 100)}% of total`
                : undefined
            }
            accent={tokens.confidence.high.value}
          />
          <StatCard
            icon={BrainCircuit}
            label="Avg Intelligence Score"
            value={stats.avgScore}
            sub="Across scored organizations"
            accent={tokens.domain.reasoning}
          />
        </div>
      )}

      {/* ── Sort Indicators ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>
          Sort by:
        </span>
        {(
          [
            { key: 'updatedAt', label: 'Last Updated' },
            { key: 'intelligenceScore', label: 'Intel Score' },
            { key: 'name', label: 'Name' },
          ] as const
        ).map((opt) => {
          const isActive = sortKey === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: isActive ? `${tokens.accent.primary}15` : 'transparent',
                color: isActive ? tokens.accent.primary : tokens.text.secondary,
                border: isActive
                  ? `1px solid ${tokens.accent.primary}30`
                  : `1px solid ${tokens.border.default}`,
              }}
            >
              {opt.label}
              <ArrowUpDown className="w-3 h-3" />
              {isActive && (
                <span className="text-[10px] font-bold uppercase ml-0.5">
                  {sortDir === 'asc' ? 'ASC' : 'DESC'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={tableData}
        onRowClick={handleRowClick}
        onSort={handleSort}
        sortKey={sortKey}
        sortDir={sortDir}
        loading={loading}
        filterable
        filterPlaceholder="Search organizations by name, domain, industry…"
        exportable
        exportFilename="organizations-export"
        pageSize={25}
        emptyMessage="No organizations match your criteria"
      />

      {/* ── Footer hint ── */}
      {!loading && organizations.length > 0 && (
        <div
          className="flex items-center justify-between px-1 text-xs"
          style={{ color: tokens.text.muted }}
        >
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              Click any row to view organization details and intelligence brief
            </span>
          </div>
          <span>{stats.total} organizations in database</span>
        </div>
      )}
    </div>
  );
}
