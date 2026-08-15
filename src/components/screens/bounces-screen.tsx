'use client';

import { useState, useMemo, useEffect } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { DataTable, type Column } from '@/components/enterprise/DataTable';
import { AlertTriangle, XCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchApi } from '@/lib/fetchApi';

// ── Types ──
interface Bounce {
  id: string;
  email: string;
  company: string;
  bounceType: 'hard' | 'soft' | 'spam';
  reason: string;
  bouncedAt: string;
  status: 'unresolved' | 'resolved';
}

type BounceTypeFilter = 'all' | 'hard' | 'soft' | 'spam';

const BOUNCE_TYPE_CONFIG: Record<
  Bounce['bounceType'],
  { label: string; color: string; bg: string; icon: typeof XCircle }
> = {
  hard: { label: 'Hard', color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
  soft: { label: 'Soft', color: '#D97706', bg: '#FEF3C7', icon: AlertTriangle },
  spam: { label: 'Spam', color: '#7C3AED', bg: '#EDE9FE', icon: ShieldAlert },
};

const STATUS_COLORS = {
  unresolved: { color: '#D97706', bg: '#FEF3C7' },
  resolved: { color: '#16A34A', bg: '#DCFCE7' },
};

// ── Component ──
export default function Bounces() {
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<BounceTypeFilter>('all');
  const [bounces, setBounces] = useState<Bounce[]>([]);

  useEffect(() => {
    fetchApi<Bounce[]>('/api/bounces')
      .then(({ data }) => {
        if (data) setBounces(data);
      })
      .catch(() => {
        toast.error('Failed to load bounces');
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  const filteredData = useMemo(() => {
    if (typeFilter === 'all') return bounces;
    return bounces.filter((b) => b.bounceType === typeFilter);
  }, [bounces, typeFilter]);

  const stats = useMemo(() => {
    const total = bounces.length;
    const hard = bounces.filter((b) => b.bounceType === 'hard').length;
    const bounceRate = '2.4%';
    return { total, hard, bounceRate };
  }, [bounces]);
  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  const columns: Column[] = useMemo(
    () => [
      { key: 'email', label: 'Email', sortable: true },
      { key: 'company', label: 'Company', sortable: true },
      {
        key: 'bounceType',
        label: 'Bounce Type',
        sortable: true,
        render: (value: unknown) => {
          const bt = value as Bounce['bounceType'];
          const cfg = BOUNCE_TYPE_CONFIG[bt];
          const Icon = cfg.icon;
          return (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
          );
        },
      },
      { key: 'reason', label: 'Reason' },
      { key: 'bouncedAt', label: 'Bounced At', sortable: true },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (value: unknown) => {
          const status = value as Bounce['status'];
          const cfg = STATUS_COLORS[status];
          return (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {status === 'resolved' && <CheckCircle2 className="w-3 h-3" />}
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          );
        },
      },
    ],
    [],
  );

  const typeFilters: { key: BounceTypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'hard', label: 'Hard' },
    { key: 'soft', label: 'Soft' },
    { key: 'spam', label: 'Spam' },
  ];

  if (isLoading) {
    return (
      <div
        className="p-6 space-y-6"
        style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: border }} />
          ))}
        </div>
        <div className="h-96 rounded-xl animate-pulse" style={{ background: border }} />
      </div>
    );
  }

  return (
    <div
      className="p-6 space-y-6"
      style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
    >
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
          Email Bounces
        </h1>
        <p className="text-sm mt-1" style={{ color: textSecondary }}>
          Track and resolve bounced email deliveries
        </p>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Bounces', value: stats.total, icon: AlertTriangle, color: '#D97706' },
          { label: 'Hard Bounces', value: stats.hard, icon: XCircle, color: '#DC2626' },
          { label: 'Bounce Rate', value: stats.bounceRate, icon: ShieldAlert, color: '#7C3AED' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${stat.color}15` }}
              >
                <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs truncate" style={{ color: textMuted }}>
                  {stat.label}
                </p>
                <p className="text-lg font-bold" style={{ color: textPrimary }}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bounce Type Filters ── */}
      <div
        className="flex items-center gap-1.5 p-1 rounded-lg w-fit"
        style={{ background: tokens.surface.secondary, border: `1px solid ${border}` }}
      >
        {typeFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: typeFilter === f.key ? tokens.accent.primary : 'transparent',
              color: typeFilter === f.key ? tokens.flat.white : textSecondary,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={filteredData as unknown as Record<string, unknown>[]}
        filterable
        filterPlaceholder="Search bounces..."
        exportable
        exportFilename="email-bounces"
        emptyMessage="No bounces found"
      />
    </div>
  );
}
