'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import { FileText, Shield, Activity } from 'lucide-react';

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

// ── Mock Data ──

const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    timestamp: '2025-01-15T15:32:10Z',
    user: 'Sarah Chen',
    action: 'login',
    resource: 'Session',
    ipAddress: '192.168.1.45',
    details: 'Successful login via SSO',
  },
  {
    id: 'log-002',
    timestamp: '2025-01-15T15:28:45Z',
    user: 'Marcus Johnson',
    action: 'update',
    resource: 'Opportunity opp-001',
    ipAddress: '10.0.0.23',
    details: 'Changed stage from Qualification to Proposal',
  },
  {
    id: 'log-003',
    timestamp: '2025-01-15T15:15:20Z',
    user: 'Emily Rodriguez',
    action: 'create',
    resource: 'Account: QuantumLeap Labs',
    ipAddress: '192.168.1.88',
    details: 'New account created with 3 contacts',
  },
  {
    id: 'log-004',
    timestamp: '2025-01-15T14:55:00Z',
    user: 'System',
    action: 'export',
    resource: 'Weekly Intelligence Report',
    ipAddress: '10.0.0.1',
    details: 'Automated report generated and emailed to 5 recipients',
  },
  {
    id: 'log-005',
    timestamp: '2025-01-15T14:42:33Z',
    user: 'James Park',
    action: 'delete',
    resource: 'Contact: John Doe (con-045)',
    ipAddress: '192.168.1.102',
    details: 'Contact deleted — duplicate of con-012',
  },
  {
    id: 'log-006',
    timestamp: '2025-01-15T14:30:12Z',
    user: 'Lisa Wang',
    action: 'update',
    resource: 'Settings: AI Providers',
    ipAddress: '10.0.0.45',
    details: 'Updated Gemini API key configuration',
  },
  {
    id: 'log-007',
    timestamp: '2025-01-15T14:10:55Z',
    user: 'Sarah Chen',
    action: 'create',
    resource: 'Sequence: Q1 Outreach',
    ipAddress: '192.168.1.45',
    details: 'Created new email sequence with 8 steps',
  },
  {
    id: 'log-008',
    timestamp: '2025-01-15T13:58:22Z',
    user: 'Marcus Johnson',
    action: 'login',
    resource: 'Session',
    ipAddress: '10.0.0.23',
    details: 'Successful login via email/password',
  },
  {
    id: 'log-009',
    timestamp: '2025-01-15T13:45:10Z',
    user: 'Emily Rodriguez',
    action: 'export',
    resource: 'Account Rankings',
    ipAddress: '192.168.1.88',
    details: 'Exported 150 account rankings to CSV',
  },
  {
    id: 'log-010',
    timestamp: '2025-01-15T13:30:00Z',
    user: 'System',
    action: 'update',
    resource: 'Pipeline Forecast',
    ipAddress: '10.0.0.1',
    details: 'Automated pipeline recalculation completed',
  },
  {
    id: 'log-011',
    timestamp: '2025-01-15T13:15:44Z',
    user: 'James Park',
    action: 'create',
    resource: 'Opportunity: Fleet AI',
    ipAddress: '192.168.1.102',
    details: 'New opportunity created for Vanguard Logistics ($265K)',
  },
  {
    id: 'log-012',
    timestamp: '2025-01-15T12:58:30Z',
    user: 'Lisa Wang',
    action: 'delete',
    resource: 'Draft: drft-089',
    ipAddress: '10.0.0.45',
    details: 'Draft email deleted from outbox',
  },
  {
    id: 'log-013',
    timestamp: '2025-01-15T12:40:15Z',
    user: 'Sarah Chen',
    action: 'update',
    resource: 'User: chris.m@deepmindq.ai',
    ipAddress: '192.168.1.45',
    details: 'Suspended user account',
  },
  {
    id: 'log-014',
    timestamp: '2025-01-15T12:22:00Z',
    user: 'System',
    action: 'create',
    resource: 'Signal Batch #447',
    ipAddress: '10.0.0.1',
    details: 'Ingested 34 new signals from web sources',
  },
  {
    id: 'log-015',
    timestamp: '2025-01-15T12:05:48Z',
    user: 'Marcus Johnson',
    action: 'export',
    resource: 'Pipeline Coverage Report',
    ipAddress: '10.0.0.23',
    details: 'Generated PDF report for Q1 planning',
  },
  {
    id: 'log-016',
    timestamp: '2025-01-15T11:50:33Z',
    user: 'Emily Rodriguez',
    action: 'login',
    resource: 'Session',
    ipAddress: '192.168.1.88',
    details: 'Successful login via SSO',
  },
  {
    id: 'log-017',
    timestamp: '2025-01-15T11:35:20Z',
    user: 'James Park',
    action: 'update',
    resource: 'Playbook: Enterprise Sales',
    ipAddress: '192.168.1.102',
    details: 'Updated stage gates and exit criteria',
  },
  {
    id: 'log-018',
    timestamp: '2025-01-15T11:20:10Z',
    user: 'Lisa Wang',
    action: 'create',
    resource: 'Knowledge Entry: Market Trends 2025',
    ipAddress: '10.0.0.45',
    details: 'Added new knowledge base article',
  },
  {
    id: 'log-019',
    timestamp: '2025-01-15T11:05:00Z',
    user: 'System',
    action: 'update',
    resource: 'Scoring Engine',
    ipAddress: '10.0.0.1',
    details: 'Model weights recalibrated based on feedback',
  },
  {
    id: 'log-020',
    timestamp: '2025-01-15T10:48:22Z',
    user: 'Sarah Chen',
    action: 'delete',
    resource: 'Sequence: Legacy Q4 Campaign',
    ipAddress: '192.168.1.45',
    details: 'Archived and deleted outdated sequence',
  },
];

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
  const [loading] = useState(false);

  const filtered = useMemo(() => {
    let result = [...MOCK_AUDIT_LOGS];
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
  }, [actionFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = MOCK_AUDIT_LOGS.length;
    const byAction = ALL_ACTIONS.reduce<Record<string, number>>((acc, a) => {
      acc[a] = MOCK_AUDIT_LOGS.filter((l) => l.action === a).length;
      return acc;
    }, {});
    return { total, ...byAction };
  }, []);

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
