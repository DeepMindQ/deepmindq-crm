'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import { fetchApi } from '@/lib/fetchApi';
import { useAppStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Crown,
  Mail,
  Building2,
  ArrowRight,
  Upload,
  Search,
  Filter,
  FileDown,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────

interface Person {
  id: string;
  fullName: string;
  email: string | null;
  title: string | null;
  role: string;
  department: string | null;
  seniority: string | null;
  linkedInUrl: string | null;
  notes: string | null;
  organizationId: string | null;
  organization?: { id: string; name: string } | null;
  source: string | null;
  firstSeenAt: string;
  updatedAt: string;
}

// ── Role badge colors ──────────────────────────────────

const ROLE_BADGES: Record<string, { bg: string; color: string; border: string }> = {
  executive:       { bg: '#F3E8FF', color: '#7C3AED', border: '#DDD6FE' },
  vice_president:  { bg: '#DBEAFE', color: '#2563EB', border: '#BFDBFE' },
  director:        { bg: '#E0E7FF', color: '#4F46E5', border: '#C7D2FE' },
  manager:         { bg: '#CCFBF1', color: '#0D9488', border: '#99F6E4' },
  individual:      { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
  advisor:         { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  partner:         { bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' },
  unknown:         { bg: '#F3F4F6', color: '#9CA3AF', border: '#E5E7EB' },
};

function formatRole(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function RoleBadge({ role }: { role: string }) {
  const style = ROLE_BADGES[role] ?? ROLE_BADGES.unknown;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      {formatRole(role)}
    </span>
  );
}

// ── Stat card ──────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: tokens.surface.card,
        border: `1px solid ${tokens.border.default}`,
      }}
    >
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg"
        style={{ background: `${accent}15` }}
      >
        <Icon className="w-4.5 h-4.5" style={{ color: accent }} />
      </div>
      <div>
        <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
          {label}
        </p>
        <p className="text-lg font-bold leading-tight" style={{ color: tokens.text.primary }}>
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────

type FetchState = 'loading' | 'ready' | 'not_found' | 'error';

export default function Contacts() {
  const [people, setPeople] = useState<Person[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search + filter
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Sort
  const [sortKey, setSortKey] = useState<string>('fullName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const setActiveView = useAppStore((s) => s.setActiveView);
  const setSelectedContactId = useAppStore((s) => s.setSelectedContactId);

  // ── Fetch people on mount ──
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetchApi<Person[]>('/api/people');
        if (cancelled) return;

        if (res.error && res.error.includes('404')) {
          setFetchState('not_found');
          return;
        }

        if (res.error) {
          // If the response text indicates a 404-like error, treat as not found
          if (res.error.includes('404') || res.error.includes('Not Found')) {
            setFetchState('not_found');
          } else {
            setFetchState('error');
            setErrorMsg(res.error);
          }
          return;
        }

        setPeople(res.data ?? []);
        setFetchState('ready');
      } catch {
        if (!cancelled) {
          setFetchState('error');
          setErrorMsg('Failed to load contacts');
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Filter + search ──
  const filteredPeople = useMemo(() => {
    let result = people;

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter((p) => p.role === roleFilter);
    }

    // Text search across name, email, title, department
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => {
        const haystack = [
          p.fullName,
          p.email,
          p.title,
          p.department,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return result;
  }, [people, roleFilter, search]);

  // ── Sort ──
  const sortedPeople = useMemo(() => {
    const arr = [...filteredPeople];
    arr.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortKey] ?? '';
      const bVal = (b as unknown as Record<string, unknown>)[sortKey] ?? '';
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredPeople, sortKey, sortDir]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = people.length;
    const executives = people.filter((p) => p.role === 'executive').length;
    const withEmail = people.filter((p) => !!p.email).length;
    const orgs = new Set(people.map((p) => p.organizationId).filter(Boolean)).size;
    return { total, executives, withEmail, orgs };
  }, [people]);

  // ── Handlers ──
  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const handleRowClick = useCallback(
    (row: Record<string, unknown>) => {
      const id = row.id as string;
      setSelectedContactId(id);
      setActiveView('contact-detail');
    },
    [setSelectedContactId, setActiveView],
  );

  const handleExport = useCallback(() => {
    if (sortedPeople.length === 0) return;
    const headers = ['Name', 'Email', 'Title', 'Role', 'Department', 'Organization', 'Seniority', 'Source'];
    const rows = sortedPeople.map((p) => [
      p.fullName,
      p.email ?? '',
      p.title ?? '',
      formatRole(p.role),
      p.department ?? '',
      p.organization?.name ?? '',
      p.seniority ?? '',
      p.source ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""') }"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedPeople]);

  // ── Table columns ──
  const columns = useMemo(
    () => [
      {
        key: 'fullName',
        label: 'Name',
        sortable: true,
        render: (_val: unknown, row: Record<string, unknown>) => (
          <span className="font-medium" style={{ color: tokens.text.primary }}>
            {String(row.fullName ?? '')}
          </span>
        ),
      },
      {
        key: 'email',
        label: 'Email',
        sortable: true,
        render: (val: unknown) =>
          val ? (
            <span className="flex items-center gap-1.5">
              <Mail className="w-3 h-3 shrink-0" style={{ color: tokens.text.muted }} />
              <span className="truncate" style={{ color: tokens.text.secondary, maxWidth: 200, display: 'inline-block' }}>
                {String(val)}
              </span>
            </span>
          ) : (
            <span style={{ color: tokens.text.muted }}>—</span>
          ),
      },
      {
        key: 'title',
        label: 'Title',
        sortable: true,
        render: (val: unknown) => (
          <span className="truncate" style={{ color: tokens.text.secondary, maxWidth: 220, display: 'inline-block' }}>
            {val ? String(val) : '—'}
          </span>
        ),
      },
      {
        key: 'role',
        label: 'Role',
        sortable: true,
        render: (val: unknown) => <RoleBadge role={String(val ?? 'unknown')} />,
      },
      {
        key: 'department',
        label: 'Department',
        sortable: true,
        render: (val: unknown) => (
          <span style={{ color: tokens.text.secondary }}>
            {val ? String(val) : '—'}
          </span>
        ),
      },
      {
        key: 'organization',
        label: 'Organization',
        sortable: true,
        render: (_val: unknown, row: Record<string, unknown>) => {
          const org = row.organization as { name: string } | null;
          if (!org?.name) {
            return <span style={{ color: tokens.text.muted }}>—</span>;
          }
          return (
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3 shrink-0" style={{ color: tokens.text.muted }} />
              <span className="truncate" style={{ color: tokens.text.secondary, maxWidth: 180, display: 'inline-block' }}>
                {org.name}
              </span>
            </span>
          );
        },
      },
      {
        key: 'seniority',
        label: 'Seniority',
        sortable: true,
        render: (val: unknown) => (
          <span style={{ color: tokens.text.secondary }}>
            {val ? String(val) : '—'}
          </span>
        ),
      },
      {
        key: 'source',
        label: 'Source',
        sortable: true,
        render: (val: unknown) => (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs"
            style={{
              background: tokens.surfaceExtended,
              color: tokens.text.secondary,
            }}
          >
            {val ? String(val) : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  // ── Render: Loading ──
  if (fetchState === 'loading') {
    return (
      <div className="p-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40 rounded" style={{ background: tokens.border.default }} />
            <Skeleton className="h-4 w-64 rounded" style={{ background: tokens.border.default }} />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" style={{ background: tokens.border.default }} />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" style={{ background: tokens.border.default }} />
          ))}
        </div>

        {/* Table skeleton */}
        <Skeleton className="h-96 rounded-xl" style={{ background: tokens.border.default }} />
      </div>
    );
  }

  // ── Render: API not found ──
  if (fetchState === 'not_found') {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: tokens.text.primary }}>
              Contacts
            </h1>
            <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
              People and decision-makers across your target accounts
            </p>
          </div>
        </div>

        <div
          className="flex flex-col items-center justify-center py-20 px-6 rounded-xl text-center"
          style={{
            background: tokens.surface.card,
            border: `1px solid ${tokens.border.default}`,
          }}
        >
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: `${tokens.accent.primary}15` }}
          >
            <Users className="w-8 h-8" style={{ color: tokens.accent.primary }} />
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: tokens.text.primary }}>
            Contacts will be available when data is imported
          </h2>
          <p className="text-sm max-w-md mb-6" style={{ color: tokens.text.secondary }}>
            Import your CRM data, CSV files, or connect an enrichment source to populate
            your contacts directory with people and decision-makers.
          </p>
          <button
            onClick={() => setActiveView('import')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors hover:opacity-90"
            style={{ background: tokens.accent.primary, color: tokens.flat.white }}
          >
            <Upload className="w-4 h-4" />
            Go to Import
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Error ──
  if (fetchState === 'error') {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: tokens.text.primary }}>
              Contacts
            </h1>
            <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
              People and decision-makers across your target accounts
            </p>
          </div>
        </div>
        <div
          className="flex flex-col items-center justify-center py-20 px-6 rounded-xl text-center"
          style={{
            background: tokens.surface.card,
            border: `1px solid ${tokens.confidence.low.border}`,
          }}
        >
          <p className="text-sm" style={{ color: tokens.confidence.low.value }}>
            {errorMsg ?? 'An unexpected error occurred while loading contacts.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Render: Data loaded ──
  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: tokens.text.primary }}>
            Contacts
          </h1>
          <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>
            People and decision-makers across your target accounts
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors hover:opacity-90 self-start"
          style={{ background: tokens.accent.dim, color: tokens.flat.white }}
        >
          <FileDown className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Contacts" value={stats.total} accent={tokens.accent.primary} />
        <StatCard icon={Crown} label="Executives" value={stats.executives} accent="#7C3AED" />
        <StatCard icon={Mail} label="With Email" value={stats.withEmail} accent="#0D9488" />
        <StatCard icon={Building2} label="Organizations" value={stats.orgs} accent="#D97706" />
      </div>

      {/* ── Filters ── */}
      <div
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-xl"
        style={{
          background: tokens.surface.card,
          border: `1px solid ${tokens.border.default}`,
        }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: tokens.text.muted }} />
          <Input
            placeholder="Search by name, email, title, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
            style={{
              background: '#0d1117',
              border: `1px solid ${tokens.border.default}`,
              color: tokens.text.primary,
            }}
          />
        </div>

        {/* Role filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 shrink-0" style={{ color: tokens.text.muted }} />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger
              className="h-9 w-[180px] text-sm"
              style={{
                background: '#0d1117',
                border: `1px solid ${tokens.border.default}`,
                color: tokens.text.primary,
              }}
            >
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent
              style={{
                background: tokens.surface.card,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <SelectItem value="all" style={{ color: tokens.text.primary }}>
                All Roles
              </SelectItem>
              {Object.keys(ROLE_BADGES).map((role) => (
                <SelectItem key={role} value={role} style={{ color: tokens.text.primary }}>
                  {formatRole(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Result count */}
        <span className="text-xs whitespace-nowrap self-center" style={{ color: tokens.text.muted }}>
          {filteredPeople.length} contact{filteredPeople.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={sortedPeople as unknown as Record<string, unknown>[]}
        onRowClick={handleRowClick}
        onSort={handleSort}
        sortKey={sortKey}
        sortDir={sortDir}
        pageSize={20}
        emptyMessage="No contacts found matching your criteria"
      />
    </div>
  );
}
