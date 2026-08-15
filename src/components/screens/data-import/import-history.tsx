'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import { RefreshCw, RotateCcw, Loader2, FileText } from 'lucide-react';
import {
  STATUS_CONFIG,
  FILE_TYPE_ICONS,
  formatDateTime,
  type IngestionRecord,
  type IngestionStatus,
} from './import-types';

/* ══════════════════════════════════════════════════════════════
   Status Badge (used in table columns)
   ══════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: IngestionStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const isSpinning = status === 'processing';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <Icon
        className="h-3 w-3"
        style={isSpinning ? { animation: 'spin 1s linear infinite' } : undefined}
      />
      {cfg.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   Ingestion History Table
   ══════════════════════════════════════════════════════════════ */

export interface ImportHistoryProps {
  ingestions: IngestionRecord[];
  loading: boolean;
  retryingId: string | null;
  onRowClick: (_row: Record<string, unknown>) => void;
  onRefresh: () => void;
  onRetry: (_e: React.MouseEvent, _id: string) => void;
}

export function ImportHistory({
  ingestions,
  loading,
  retryingId,
  onRowClick,
  onRefresh,
  onRetry,
}: ImportHistoryProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  const sortedData = useMemo(() => {
    if (!sortKey) return ingestions as unknown as Record<string, unknown>[];
    return [...(ingestions as unknown as Record<string, unknown>[])].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [ingestions, sortKey, sortDir]);

  const columns = [
    {
      key: 'fileName',
      label: 'File Name',
      sortable: true,
      render: (value: unknown, row: Record<string, unknown>) => {
        const fileType = (row.fileType as string) || 'csv';
        const Icon = FILE_TYPE_ICONS[fileType] || FileText;
        return (
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ background: tokens.accent.ghost }}
            >
              <Icon className="h-4 w-4" style={{ color: tokens.accent.DEFAULT }} />
            </div>
            <span className="font-medium truncate max-w-[200px]" title={value as string}>
              {value as string}
            </span>
          </div>
        );
      },
    },
    {
      key: 'fileType',
      label: 'File Type',
      sortable: true,
      render: (value: unknown) => (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase"
          style={{ background: tokens.surfaceExtended, color: tokens.text.secondary }}
        >
          {value as string}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: unknown) => <StatusBadge status={value as IngestionStatus} />,
    },
    {
      key: 'totalRows',
      label: 'Total Rows',
      sortable: true,
      render: (value: unknown) => (
        <span
          className="tabular-nums"
          style={{ color: value ? tokens.text.primary : tokens.text.muted }}
        >
          {value != null ? (value as number).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      key: 'processedRows',
      label: 'Processed Rows',
      sortable: true,
      render: (value: unknown) => (
        <span
          className="tabular-nums"
          style={{ color: value ? STATUS_CONFIG.completed.color : tokens.text.muted }}
        >
          {value != null ? (value as number).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      key: 'failedRows',
      label: 'Failed Rows',
      sortable: true,
      render: (value: unknown) => {
        const num = value as number | null;
        return (
          <span
            className="tabular-nums"
            style={{ color: num && num > 0 ? STATUS_CONFIG.failed.color : tokens.text.muted }}
          >
            {num != null ? num.toLocaleString() : '—'}
          </span>
        );
      },
    },
    {
      key: 'uploadedAt',
      label: 'Uploaded At',
      sortable: true,
      render: (value: unknown) => (
        <span style={{ color: tokens.text.secondary }}>{formatDateTime(value as string)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_value: unknown, row: Record<string, unknown>) => {
        const status = row.status as IngestionStatus;
        const id = row.id as string;
        const canRetry = status === 'failed' || status === 'partial';
        if (!canRetry) return null;
        return (
          <button
            onClick={(e) => onRetry(e, id)}
            disabled={retryingId === id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
            style={{
              background: STATUS_CONFIG.failed.bg,
              color: STATUS_CONFIG.failed.color,
              border: `1px solid ${STATUS_CONFIG.failed.border}`,
            }}
            title="Retry this import"
          >
            {retryingId === id ? (
              <Loader2 className="h-3 w-3" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Retry
          </button>
        );
      },
    },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-lg font-bold flex items-center gap-2"
          style={{ color: tokens.text.primary }}
        >
          <RefreshCw className="h-5 w-5" style={{ color: tokens.text.muted }} />
          Ingestion History
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            border: `1px solid ${tokens.border.default}`,
            color: tokens.text.secondary,
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw
            className="h-3.5 w-3.5"
            style={loading ? { animation: 'spin 1s linear infinite' } : undefined}
          />
          Refresh
        </button>
      </div>
      <DataTable
        columns={columns}
        data={sortedData}
        onRowClick={onRowClick}
        onSort={handleSort}
        sortKey={sortKey ?? undefined}
        sortDir={sortDir}
        loading={loading}
        emptyMessage="No imports yet. Upload a file to get started."
        filterable
        filterPlaceholder="Search imports..."
        exportable
        exportFilename="ingestion-history"
        title=""
      />
    </section>
  );
}
