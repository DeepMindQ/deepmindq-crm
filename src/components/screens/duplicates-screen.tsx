'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { DataTable, type Column } from '@/components/enterprise/DataTable';
import { Copy, GitMerge, EyeOff, Layers, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──
interface DuplicateGroup {
  id: string;
  field: 'email' | 'domain' | 'name';
  values: string;
  sourceRecords: number;
  confidence: number;
  status: 'unreviewed' | 'merged' | 'ignored';
}

// ── Mock Data ──
const MOCK_DUPLICATES: DuplicateGroup[] = [
  { id: 'd1', field: 'email', values: 'sarah.chen@acme.com / s.chen@acmecorp.com', sourceRecords: 3, confidence: 97, status: 'unreviewed' },
  { id: 'd2', field: 'domain', values: 'technova.io / technova.com / tech-nova.com', sourceRecords: 8, confidence: 82, status: 'unreviewed' },
  { id: 'd3', field: 'name', values: 'James Wilson / Jim Wilson / J. Wilson', sourceRecords: 2, confidence: 91, status: 'unreviewed' },
  { id: 'd4', field: 'email', values: 'maria.garcia@dataflow.com / mgarcia@dataflow.io', sourceRecords: 2, confidence: 94, status: 'merged' },
  { id: 'd5', field: 'domain', values: 'cloudpeak.co / cloud-peak.com', sourceRecords: 5, confidence: 76, status: 'unreviewed' },
  { id: 'd6', field: 'name', values: 'Emily Zhang / Em Zhang', sourceRecords: 2, confidence: 88, status: 'ignored' },
  { id: 'd7', field: 'email', values: 'dkim@cloudpeak.co / david.kim@cloudpeak.co', sourceRecords: 2, confidence: 95, status: 'unreviewed' },
  { id: 'd8', field: 'domain', values: 'nexgenrobotics.com / nex-gen-robotics.com', sourceRecords: 4, confidence: 73, status: 'merged' },
];

const FIELD_CONFIG: Record<DuplicateGroup['field'], { label: string; color: string; bg: string }> = {
  email: { label: 'Email', color: '#2563EB', bg: '#DBEAFE' },
  domain: { label: 'Domain', color: '#7C3AED', bg: '#EDE9FE' },
  name: { label: 'Name', color: '#D97706', bg: '#FEF3C7' },
};

const STATUS_CONFIG: Record<DuplicateGroup['status'], { label: string; color: string; bg: string }> = {
  unreviewed: { label: 'Unreviewed', color: '#D97706', bg: '#FEF3C7' },
  merged: { label: 'Merged', color: '#16A34A', bg: '#DCFCE7' },
  ignored: { label: 'Ignored', color: '#6B7280', bg: '#F3F4F6' },
};

// ── Component ──
export default function Duplicates() {
  const [data, setData] = useState(MOCK_DUPLICATES);
  const [loading] = useState(false);

  const stats = useMemo(() => {
    const total = data.length;
    const unreviewed = data.filter((d) => d.status === 'unreviewed').length;
    const mergedToday = data.filter((d) => d.status === 'merged').length;
    return { total, unreviewed, mergedToday };
  }, [data]);

  const handleMerge = useCallback((id: string) => {
    setData((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'merged' as const } : d)));
    toast.success('Duplicate group merged successfully');
  }, []);

  const handleIgnore = useCallback((id: string) => {
    setData((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'ignored' as const } : d)));
    toast.info('Duplicate group ignored');
  }, []);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  const columns: Column[] = useMemo(
    () => [
      {
        key: 'field',
        label: 'Field',
        sortable: true,
        render: (value: unknown) => {
          const field = value as DuplicateGroup['field'];
          const cfg = FIELD_CONFIG[field];
          return (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
          );
        },
      },
      { key: 'values', label: 'Values', render: (value: unknown) => (
        <span className="text-xs" style={{ color: textSecondary }}>{value as string}</span>
      )},
      { key: 'sourceRecords', label: 'Source Records', sortable: true, render: (value: unknown) => (
        <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: textPrimary }}>
          <Layers className="w-3 h-3" style={{ color: textMuted }} />
          {value as number}
        </span>
      )},
      {
        key: 'confidence',
        label: 'Confidence',
        sortable: true,
        render: (value: unknown) => {
          const score = value as number;
          const color = score >= 90 ? '#16A34A' : score >= 75 ? '#D97706' : '#DC2626';
          return (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: tokens.border.default }}>
                <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
              </div>
              <span className="text-xs font-medium" style={{ color }}>{score}%</span>
            </div>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (value: unknown) => {
          const status = value as DuplicateGroup['status'];
          const cfg = STATUS_CONFIG[status];
          const Icon = status === 'merged' ? CheckCircle2 : status === 'ignored' ? EyeOff : Clock;
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
      {
        key: 'actions',
        label: '',
        render: (_value: unknown, row: Record<string, unknown>) => {
          const r = row as unknown as DuplicateGroup;
          if (r.status !== 'unreviewed') return null;
          return (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleMerge(r.id); }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:opacity-80"
                style={{ background: '#DCFCE7', color: '#16A34A' }}
                title="Merge"
              >
                <GitMerge className="w-3 h-3" />
                Merge
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleIgnore(r.id); }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:opacity-80"
                style={{ background: '#F3F4F6', color: '#6B7280' }}
                title="Ignore"
              >
                <EyeOff className="w-3 h-3" />
                Ignore
              </button>
            </div>
          );
        },
      },
    ],
    [handleMerge, handleIgnore, textMuted, textSecondary]
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6" style={{ background: '#0a0e17', minHeight: '100%' }}>
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
    <div className="p-6 space-y-6" style={{ background: '#0a0e17', minHeight: '100%' }}>
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: textPrimary }}>Duplicate Detection</h1>
        <p className="text-sm mt-1" style={{ color: textSecondary }}>Find and merge duplicate records in your database</p>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Groups', value: stats.total, icon: Copy, color: tokens.accent.primary },
          { label: 'Unreviewed', value: stats.unreviewed, icon: Clock, color: '#D97706' },
          { label: 'Merged Today', value: stats.mergedToday, icon: CheckCircle2, color: '#16A34A' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs truncate" style={{ color: textMuted }}>{stat.label}</p>
                <p className="text-lg font-bold" style={{ color: textPrimary }}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        filterable
        filterPlaceholder="Search duplicates..."
        exportable
        exportFilename="duplicate-groups"
        emptyMessage="No duplicate groups found"
      />
    </div>
  );
}
