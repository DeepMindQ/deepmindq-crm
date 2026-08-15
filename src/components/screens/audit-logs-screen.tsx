'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import { FileText, Shield, Activity } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';

// ── Types ──

type AuditAction = 'login' | 'create' | 'update' | 'delete' | 'export';

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: AuditAction;
  resource: string;
  ipAddress: string;
  details: string;
}

const ACTION_CONFIG: Record<AuditAction, { color: string; bg: string; border: string }> = {
  login: { color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' },
  create: { color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
  update: { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  delete: { color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
  export: { color: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE' },
};

// ── Helpers ──

const ALL_ACTIONS: AuditAction[] = ['login', 'create', 'update', 'delete', 'export'];

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ── Component ──

export function AuditLogsScreen() {
  const [actionFilter, setActionFilter] = useState<AuditAction | 'All'>('All');
  const [sortKey, setSortKey] = useState<string>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    fetchApi<AuditLog[]>('/api/audit-logs')
      .then(({ data }) => {
        if (data) setLogs(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = [...logs];
    if (actionFilter !== 'All') result = result.filter((l) => l.action === actionFilter);
    result.sort((a, b) => {
      const aVal = a[sortKey as keyof AuditLog];
      const bVal = b[sortKey as keyof AuditLog];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return result;
  }, [actionFilter, sortKey, sortDir, logs]);

  const stats = useMemo(() => {
    const total = logs.length;
    const byAction = ALL_ACTIONS.reduce<Record<string, number>>((acc, a) => {
      acc[a] = logs.filter((l) => l.action === a).length;
      return acc;
    }, {});
    return { total, ...byAction };
  }, [logs]);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  const columns = useMemo(
    () => [
      {
        key: 'timestamp',
        label: 'Timestamp',
        sortable: true,
        render: (v: unknown) => (
          <span className="text-xs tabular-nums" style={{ color: tokens.text.secondary }}>
            {formatTimestamp(v as string)}
          </span>
        ),
      },
      {
        key: 'user',
        label: 'User',
        sortable: true,
        render: (v: unknown) => <span className="font-medium text-sm">{v as string}</span>,
      },
      {
        key: 'action',
        label: 'Action',
        sortable: true,
        render: (v: unknown) => {
          const action = v as AuditAction;
          const cfg = ACTION_CONFIG[action];
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold capitalize"
              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
            >
              {action}
            </span>
          );
        },
      },
      {
        key: 'resource',
        label: 'Resource',
        sortable: true,
        render: (v: unknown) => (
          <span className="text-xs" style={{ color: tokens.text.secondary }}>
            {v as string}
          </span>
        ),
      },
      {
        key: 'ipAddress',
        label: 'IP Address',
        sortable: true,
        render: (v: unknown) => (
          <code
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: tokens.surface.secondary, color: tokens.text.muted }}
          >
            {v as string}
          </code>
        ),
      },
      {
        key: 'details',
        label: 'Details',
        render: (v: unknown) => (
          <span
            className="text-xs max-w-xs truncate block"
            style={{ color: tokens.text.muted }}
            title={v as string}
          >
            {v as string}
          </span>
        ),
      },
    ],
    [],
  );

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  return (
    <div
      className="p-6 space-y-6"
      style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
            Audit Logs
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Track all system actions and user activity
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['All', ...ALL_ACTIONS] as const).map((action) => {
            const cfg = action !== 'All' ? ACTION_CONFIG[action as AuditAction] : null;
            const isActive = actionFilter === action;
            return (
              <button
                key={action}
                onClick={() => setActionFilter(action as AuditAction | 'All')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                style={{
                  background: isActive ? (cfg ? cfg.color : tokens.accent.primary) : 'transparent',
                  color: isActive ? tokens.flat.white : textSecondary,
                  border: `1px solid ${isActive ? (cfg ? cfg.color : tokens.accent.primary) : border}`,
                }}
              >
                {action}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, color: tokens.accent.primary },
          {
            label: 'Logins',
            value: (stats as Record<string, number>).login ?? 0,
            color: ACTION_CONFIG.login.color,
          },
          {
            label: 'Creates',
            value: (stats as Record<string, number>).create ?? 0,
            color: ACTION_CONFIG.create.color,
          },
          {
            label: 'Updates',
            value: (stats as Record<string, number>).update ?? 0,
            color: ACTION_CONFIG.update.color,
          },
          {
            label: 'Deletes',
            value: (stats as Record<string, number>)['delete'] ?? 0,
            color: ACTION_CONFIG['delete'].color,
          },
          {
            label: 'Exports',
            value: (stats as Record<string, number>).export ?? 0,
            color: ACTION_CONFIG.export.color,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg p-3 text-center"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <p className="text-lg font-bold" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="text-xs" style={{ color: textMuted }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={filtered as unknown as Record<string, unknown>[]}
        onSort={handleSort}
        sortKey={sortKey}
        sortDir={sortDir}
        loading={loading}
        filterable
        filterPlaceholder="Search by user, resource, or details…"
        exportable
        exportFilename="audit-logs"
        emptyMessage="No audit logs match your criteria"
      />
    </div>
  );
}
