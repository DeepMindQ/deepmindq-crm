'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Eye,
  MapPin,
  ListOrdered,
  AlertOctagon,
  RotateCcw,
  Loader2,
  XCircle,
  Trash2,
} from 'lucide-react';
import { type IngestionRecord, STATUS_CONFIG, formatBytes, formatDateTime } from './import-types';

/* ══════════════════════════════════════════════════════════════
   Status Badge
   ══════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
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
   Detail Slide-Over Panel
   ══════════════════════════════════════════════════════════════ */

export interface DetailPanelProps {
  record: IngestionRecord | null;
  open: boolean;
  onClose: () => void;
  onRetry: (id: string) => void;
  isRetrying: boolean;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  isCancelling?: boolean;
  isDeleting?: boolean;
}

export function DetailPanel({
  record,
  open,
  onClose,
  onRetry,
  isRetrying,
  onCancel,
  onDelete,
  isCancelling,
  isDeleting,
}: DetailPanelProps) {
  if (!record) return null;

  const cfg = STATUS_CONFIG[record.status];
  const parsedColumnMap: Record<string, string> | null = record.columnMap
    ? (() => {
        try {
          return JSON.parse(record.columnMap);
        } catch {
          return null;
        }
      })()
    : null;
  const parsedErrorDetails: Array<{ row: number; errors: string[] }> | null = record.errorDetails
    ? (() => {
        try {
          return JSON.parse(record.errorDetails);
        } catch {
          return null;
        }
      })()
    : null;
  const progress =
    record.totalRows && record.totalRows > 0
      ? Math.round(((record.processedRows ?? 0) / record.totalRows) * 100)
      : 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg"
        style={{
          background: tokens.surface.primary,
          borderLeft: `1px solid ${tokens.border.default}`,
        }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2" style={{ color: tokens.text.primary }}>
            <Eye className="h-4 w-4" style={{ color: tokens.accent.DEFAULT }} />
            Import Details
          </SheetTitle>
          <SheetDescription style={{ color: tokens.text.secondary }}>
            {record.fileName}
          </SheetDescription>
        </SheetHeader>

        <div
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-6"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {/* Status & Progress */}
          <section>
            <h4
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: tokens.text.secondary }}
            >
              Status & Progress
            </h4>
            <div
              className="p-4 rounded-xl space-y-3"
              style={{
                background: tokens.surface.secondary,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <div className="flex items-center justify-between">
                <StatusBadge status={record.status} />
                <span className="text-xs" style={{ color: tokens.text.muted }}>
                  {progress}%
                </span>
              </div>
              {record.status !== 'pending' && (
                <Progress
                  value={progress}
                  className="h-2"
                  style={{ '--progress-background': cfg.color } as React.CSSProperties}
                />
              )}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>
                    Total Rows
                  </p>
                  <p className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                    {record.totalRows ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>
                    Processed
                  </p>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: STATUS_CONFIG.completed.color }}
                  >
                    {record.processedRows ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>
                    Failed Rows
                  </p>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: STATUS_CONFIG.failed.color }}
                  >
                    {record.failedRows ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>
                    File Size
                  </p>
                  <p className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                    {formatBytes(record.fileSize)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Created Entities */}
          {(record.organizationsCreated !== null || record.peopleCreated !== null) && (
            <section>
              <h4
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: tokens.text.secondary }}
              >
                Created Entities
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="p-3 rounded-xl"
                  style={{
                    background: tokens.surface.secondary,
                    border: `1px solid ${tokens.border.default}`,
                  }}
                >
                  <ListOrdered className="h-4 w-4 mb-1" style={{ color: tokens.text.secondary }} />
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>
                    Organizations
                  </p>
                  <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                    {record.organizationsCreated ?? 0}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl"
                  style={{
                    background: tokens.surface.secondary,
                    border: `1px solid ${tokens.border.default}`,
                  }}
                >
                  <ListOrdered className="h-4 w-4 mb-1" style={{ color: tokens.text.secondary }} />
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>
                    People
                  </p>
                  <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                    {record.peopleCreated ?? 0}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Column Mapping */}
          {parsedColumnMap && Object.keys(parsedColumnMap).length > 0 && (
            <section>
              <h4
                className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
                style={{ color: tokens.text.secondary }}
              >
                <MapPin className="h-3.5 w-3.5" />
                Column Mapping
              </h4>
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${tokens.border.default}` }}
              >
                {Object.entries(parsedColumnMap).map(([source, target], idx) => (
                  <div
                    key={source}
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{
                      borderBottom:
                        idx < Object.keys(parsedColumnMap).length - 1
                          ? `1px solid ${tokens.border.default}`
                          : 'none',
                      background: idx % 2 === 0 ? tokens.surface.primary : tokens.surface.secondary,
                    }}
                  >
                    <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>
                      {source}
                    </span>
                    <span className="text-xs" style={{ color: tokens.text.muted }}>
                      →
                    </span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{ color: tokens.accent.DEFAULT, background: tokens.accent.ghost }}
                    >
                      {target}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Error Details */}
          {(record.errorMessage || (parsedErrorDetails && parsedErrorDetails.length > 0)) && (
            <section>
              <h4
                className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
                style={{ color: tokens.text.secondary }}
              >
                <AlertOctagon
                  className="h-3.5 w-3.5"
                  style={{ color: STATUS_CONFIG.failed.color }}
                />
                Error Details
              </h4>
              <div
                className="p-4 rounded-xl space-y-3"
                style={{
                  background: STATUS_CONFIG.failed.bg,
                  border: `1px solid ${STATUS_CONFIG.failed.border}`,
                }}
              >
                {record.errorMessage && (
                  <div>
                    <p
                      className="text-[11px] font-semibold uppercase mb-1"
                      style={{ color: STATUS_CONFIG.failed.color }}
                    >
                      Error Message
                    </p>
                    <p className="text-sm" style={{ color: tokens.text.primary }}>
                      {record.errorMessage}
                    </p>
                  </div>
                )}
                {parsedErrorDetails && parsedErrorDetails.length > 0 && (
                  <div>
                    <p
                      className="text-[11px] font-semibold uppercase mb-2"
                      style={{ color: STATUS_CONFIG.failed.color }}
                    >
                      Row-Level Errors
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {parsedErrorDetails.map((err, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 rounded-lg"
                          style={{
                            background: tokens.surface.primary,
                            border: `1px solid ${STATUS_CONFIG.failed.border}`,
                          }}
                        >
                          <p
                            className="text-[11px] font-semibold"
                            style={{ color: STATUS_CONFIG.failed.color }}
                          >
                            Row {err.row}
                          </p>
                          {err.errors.map((e, eIdx) => (
                            <p
                              key={eIdx}
                              className="text-xs mt-0.5"
                              style={{ color: tokens.text.secondary }}
                            >
                              {e}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Metadata */}
          <section>
            <h4
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: tokens.text.secondary }}
            >
              Metadata
            </h4>
            <div
              className="p-4 rounded-xl space-y-2"
              style={{
                background: tokens.surface.secondary,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: tokens.text.muted }}>
                  Uploaded
                </span>
                <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>
                  {formatDateTime(record.uploadedAt)}
                </span>
              </div>
              {record.completedAt && (
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: tokens.text.muted }}>
                    Completed
                  </span>
                  <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>
                    {formatDateTime(record.completedAt)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: tokens.text.muted }}>
                  File Type
                </span>
                <span
                  className="text-xs font-medium uppercase"
                  style={{ color: tokens.text.primary }}
                >
                  {record.fileType}
                </span>
              </div>
            </div>
          </section>
        </div>

        {(record.status === 'failed' || record.status === 'partial') && (
          <div className="px-4 pb-4 space-y-2">
            <button
              onClick={() => onRetry(record.id)}
              disabled={isRetrying}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: tokens.accent.DEFAULT,
                color: tokens.flat.white,
                opacity: isRetrying ? 0.7 : 1,
              }}
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {isRetrying ? 'Retrying...' : 'Retry Import'}
            </button>
          </div>
        )}
        {(record.status === 'pending' || record.status === 'processing') && onCancel && (
          <div className="px-4 pb-4">
            <button
              onClick={() => onCancel(record.id)}
              disabled={isCancelling}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: STATUS_CONFIG.failed.bg,
                color: STATUS_CONFIG.failed.color,
                border: `1px solid ${STATUS_CONFIG.failed.border}`,
                opacity: isCancelling ? 0.7 : 1,
              }}
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {isCancelling ? 'Cancelling...' : 'Cancel Import'}
            </button>
          </div>
        )}
        {(record.status === 'completed' ||
          record.status === 'failed' ||
          record.status === 'partial') &&
          onDelete && (
            <div className="px-4 pb-4">
              <button
                onClick={() => onDelete(record.id)}
                disabled={isDeleting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: 'transparent',
                  color: tokens.text.muted,
                  border: `1px solid ${tokens.border.default}`,
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {isDeleting ? 'Deleting...' : 'Delete Import'}
              </button>
            </div>
          )}
      </SheetContent>
    </Sheet>
  );
}
