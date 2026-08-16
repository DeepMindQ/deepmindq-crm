'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { DataTable, type Column } from '@/components/enterprise/DataTable';
import { Users, UserPlus, Sparkles, Target, Upload } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──
interface Lead {
  id: string;
  company: string;
  contact: string;
  email: string;
  source: string;
  score: number;
  status: 'new' | 'contacted' | 'qualified' | 'disqualified';
  created: string;
}

type StatusFilter = 'all' | 'new' | 'contacted' | 'qualified' | 'disqualified';

// ── Mock Data ──
const MOCK_LEADS: Lead[] = [
  {
    id: 'l1',
    company: 'Acme Corp',
    contact: 'Sarah Chen',
    email: 'sarah.chen@acmecorp.com',
    source: 'LinkedIn',
    score: 87,
    status: 'qualified',
    created: '2025-01-15',
  },
  {
    id: 'l2',
    company: 'TechNova Inc',
    contact: 'James Wilson',
    email: 'jwilson@technova.io',
    source: 'Website',
    score: 72,
    status: 'new',
    created: '2025-01-18',
  },
  {
    id: 'l3',
    company: 'DataFlow Systems',
    contact: 'Maria Garcia',
    email: 'm.garcia@dataflow.com',
    source: 'Referral',
    score: 94,
    status: 'qualified',
    created: '2025-01-10',
  },
  {
    id: 'l4',
    company: 'CloudPeak',
    contact: 'David Kim',
    email: 'dkim@cloudpeak.co',
    source: 'Outreach',
    score: 45,
    status: 'contacted',
    created: '2025-01-20',
  },
  {
    id: 'l5',
    company: 'Vertex AI',
    contact: 'Emily Zhang',
    email: 'emily.z@vertexai.com',
    source: 'Conference',
    score: 63,
    status: 'new',
    created: '2025-01-22',
  },
  {
    id: 'l6',
    company: 'Synthetica',
    contact: 'Michael Brown',
    email: 'mbrown@synthetica.dev',
    source: 'LinkedIn',
    score: 28,
    status: 'disqualified',
    created: '2025-01-08',
  },
  {
    id: 'l7',
    company: 'NexGen Robotics',
    contact: 'Priya Patel',
    email: 'priya@nexgenrobotics.com',
    source: 'Website',
    score: 81,
    status: 'contacted',
    created: '2025-01-19',
  },
  {
    id: 'l8',
    company: 'QuantumLeap',
    contact: 'Alex Rivera',
    email: 'arivera@quantumleap.io',
    source: 'Partner',
    score: 56,
    status: 'new',
    created: '2025-01-21',
  },
  {
    id: 'l9',
    company: 'BioGenesis Labs',
    contact: 'Rachel Thompson',
    email: 'rthompson@biogenesis.com',
    source: 'Outreach',
    score: 91,
    status: 'qualified',
    created: '2025-01-12',
  },
  {
    id: 'l10',
    company: 'Stellar Dynamics',
    contact: "Kevin O'Brien",
    email: 'kobrien@stellardynamics.co',
    source: 'Referral',
    score: 39,
    status: 'disqualified',
    created: '2025-01-05',
  },
];

const STATUS_CONFIG: Record<Lead['status'], { label: string; color: string; bg: string }> = {
  new: { label: 'New', color: '#2563EB', bg: '#DBEAFE' },
  contacted: { label: 'Contacted', color: '#D97706', bg: '#FEF3C7' },
  qualified: { label: 'Qualified', color: '#16A34A', bg: '#DCFCE7' },
  disqualified: { label: 'Disqualified', color: '#DC2626', bg: '#FEE2E2' },
};

// ── Component ──
export default function Leads() {
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  const filteredData = useMemo(() => {
    if (statusFilter === 'all') return MOCK_LEADS;
    return MOCK_LEADS.filter((l) => l.status === statusFilter);
  }, [statusFilter]);

  const stats = useMemo(() => {
    const total = MOCK_LEADS.length;
    const newCount = MOCK_LEADS.filter((l) => l.status === 'new').length;
    const qualifiedCount = MOCK_LEADS.filter((l) => l.status === 'qualified').length;
    const conversionRate = total > 0 ? ((qualifiedCount / total) * 100).toFixed(1) : '0.0';
    return { total, newCount, qualifiedCount, conversionRate };
  }, []);

  const handleImport = useCallback(() => {
    toast.info('Import wizard would open here');
  }, []);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  const columns: Column[] = useMemo(
    () => [
      { key: 'company', label: 'Company', sortable: true },
      { key: 'contact', label: 'Contact', sortable: true },
      { key: 'email', label: 'Email' },
      { key: 'source', label: 'Source', sortable: true },
      {
        key: 'score',
        label: 'Score',
        sortable: true,
        render: (value: unknown) => {
          const score = value as number;
          const color = score >= 70 ? '#16A34A' : score >= 40 ? '#D97706' : '#DC2626';
          return (
            <div className="flex items-center gap-2">
              <div
                className="w-16 h-1.5 rounded-full overflow-hidden"
                style={{ background: tokens.border.default }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${score}%`, background: color }}
                />
              </div>
              <span className="text-xs font-medium" style={{ color }}>
                {score}
              </span>
            </div>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (value: unknown) => {
          const status = value as Lead['status'];
          const cfg = STATUS_CONFIG[status];
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
          );
        },
      },
      { key: 'created', label: 'Created', sortable: true },
    ],
    [],
  );

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'qualified', label: 'Qualified' },
    { key: 'disqualified', label: 'Disqualified' },
  ];

  if (isLoading) {
    return (
      <div
        className="p-6 space-y-6"
        style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
            Leads
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Manage and track your sales pipeline leads
          </p>
        </div>
        <button
          onClick={handleImport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors hover:opacity-90"
          style={{ background: tokens.accent.primary, color: tokens.flat.white }}
        >
          <Upload className="h-3.5 w-3.5" />
          Import Leads
        </button>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: stats.total, icon: Users, color: tokens.accent.primary },
          { label: 'New Leads', value: stats.newCount, icon: UserPlus, color: '#2563EB' },
          { label: 'Qualified', value: stats.qualifiedCount, icon: Sparkles, color: '#16A34A' },
          {
            label: 'Conversion Rate',
            value: `${stats.conversionRate}%`,
            icon: Target,
            color: '#D97706',
          },
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

      {/* ── Status Filters ── */}
      <div
        className="flex items-center gap-1.5 p-1 rounded-lg w-fit"
        style={{ background: tokens.surface.secondary, border: `1px solid ${border}` }}
      >
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: statusFilter === f.key ? tokens.accent.primary : 'transparent',
              color: statusFilter === f.key ? tokens.flat.white : textSecondary,
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
        filterPlaceholder="Search leads..."
        exportable
        exportFilename="leads-export"
        emptyMessage="No leads match your filters"
      />
    </div>
  );
}
