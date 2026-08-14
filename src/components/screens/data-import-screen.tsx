'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { tokens, typography, elevation } from '@/components/intelligence-os/design-tokens';
import { fetchApi } from '@/lib/fetchApi';
import { DataTable } from '@/components/enterprise/DataTable';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  Upload,
  FileSpreadsheet,
  FileJson,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  RefreshCw,
  Database,
  BarChart3,
  Loader2,
  ArrowUpFromLine,
  Trash2,
  ChevronRight,
  MapPin,
  ListOrdered,
  AlertOctagon,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

type IngestionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
type IngestionFileType = 'csv' | 'xlsx' | 'xls' | 'json';

interface IngestionRecord {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: IngestionFileType;
  status: IngestionStatus;
  totalRows: number | null;
  processedRows: number | null;
  failedRows: number | null;
  organizationsCreated: number | null;
  peopleCreated: number | null;
  columnMap: string | null;
  errorMessage: string | null;
  errorDetails: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
  completedAt: string | null;
}

/* ══════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════ */

const ACCEPTED_TYPES: Record<string, string[]> = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/json': ['.json'],
};

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.json'];

const STATUS_CONFIG: Record<IngestionStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: Clock },
  processing: { label: 'Processing', color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD', icon: Loader2 },
  completed: { label: 'Completed', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0', icon: CheckCircle2 },
  failed: { label: 'Failed', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', icon: AlertCircle },
  partial: { label: 'Partial', color: '#EA580C', bg: '#FFEDD5', border: '#FED7AA', icon: AlertTriangle },
};

const FILE_TYPE_ICONS: Record<string, React.ElementType> = {
  csv: FileText,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  json: FileJson,
};

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function getAcceptedMimeTypes(): string {
  return Object.keys(ACCEPTED_TYPES).join(',');
}

function getAcceptedExtensionsStr(): string {
  return ACCEPTED_EXTENSIONS.join(',');
}

/* ══════════════════════════════════════════════════════════════
   Status Badge Component
   ══════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: IngestionStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const isSpinning = status === 'processing';

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <Icon className="h-3 w-3" style={isSpinning ? { animation: 'spin 1s linear infinite' } : undefined} />
      {cfg.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   Stats Card Component
   ══════════════════════════════════════════════════════════════ */

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
}) {
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-xl transition-all"
      style={{
        background: tokens.surface.primary,
        border: `1px solid ${tokens.border.default}`,
        boxShadow: elevation.sm,
      }}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
        style={{ background: bgColor }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: tokens.text.secondary }}>
          {label}
        </p>
        <p className="text-xl font-bold" style={{ color: tokens.text.primary }}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Detail Slide-Over Panel
   ══════════════════════════════════════════════════════════════ */

function DetailPanel({
  record,
  open,
  onClose,
  onRetry,
  isRetrying,
}: {
  record: IngestionRecord | null;
  open: boolean;
  onClose: () => void;
  onRetry: (id: string) => void;
  isRetrying: boolean;
}) {
  if (!record) return null;

  const cfg = STATUS_CONFIG[record.status];
  const parsedColumnMap: Record<string, string> | null = record.columnMap
    ? (() => { try { return JSON.parse(record.columnMap); } catch { return null; } })()
    : null;
  const parsedErrorDetails: Array<{ row: number; errors: string[] }> | null = record.errorDetails
    ? (() => { try { return JSON.parse(record.errorDetails); } catch { return null; } })()
    : null;

  const progress = record.totalRows && record.totalRows > 0
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

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {/* Status & Progress */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.text.secondary }}>
              Status & Progress
            </h4>
            <div className="p-4 rounded-xl space-y-3" style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.default}` }}>
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
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>Total Rows</p>
                  <p className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{record.totalRows ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>Processed</p>
                  <p className="text-sm font-semibold" style={{ color: STATUS_CONFIG.completed.color }}>{record.processedRows ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>Failed Rows</p>
                  <p className="text-sm font-semibold" style={{ color: STATUS_CONFIG.failed.color }}>{record.failedRows ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>File Size</p>
                  <p className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{formatBytes(record.fileSize)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Created Entities */}
          {(record.organizationsCreated !== null || record.peopleCreated !== null) && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.text.secondary }}>
                Created Entities
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.default}` }}>
                  <Database className="h-4 w-4 mb-1" style={{ color: tokens.accent.DEFAULT }} />
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>Organizations</p>
                  <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>{record.organizationsCreated ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.default}` }}>
                  <ListOrdered className="h-4 w-4 mb-1" style={{ color: tokens.domain.value }} />
                  <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>People</p>
                  <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>{record.peopleCreated ?? 0}</p>
                </div>
              </div>
            </section>
          )}

          {/* Column Mapping */}
          {parsedColumnMap && Object.keys(parsedColumnMap).length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: tokens.text.secondary }}>
                <MapPin className="h-3.5 w-3.5" />
                Column Mapping
              </h4>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${tokens.border.default}` }}>
                {Object.entries(parsedColumnMap).map(([source, target], idx) => (
                  <div
                    key={source}
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{
                      borderBottom: idx < Object.keys(parsedColumnMap).length - 1 ? `1px solid ${tokens.border.default}` : 'none',
                      background: idx % 2 === 0 ? tokens.surface.primary : tokens.surface.secondary,
                    }}
                  >
                    <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>{source}</span>
                    <ChevronRight className="h-3 w-3" style={{ color: tokens.text.muted }} />
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ color: tokens.accent.DEFAULT, background: tokens.accent.ghost }}>{target}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Error Details */}
          {(record.errorMessage || (parsedErrorDetails && parsedErrorDetails.length > 0)) && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: tokens.text.secondary }}>
                <AlertOctagon className="h-3.5 w-3.5" style={{ color: STATUS_CONFIG.failed.color }} />
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
                    <p className="text-[11px] font-semibold uppercase mb-1" style={{ color: STATUS_CONFIG.failed.color }}>
                      Error Message
                    </p>
                    <p className="text-sm" style={{ color: tokens.text.primary }}>{record.errorMessage}</p>
                  </div>
                )}
                {parsedErrorDetails && parsedErrorDetails.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: STATUS_CONFIG.failed.color }}>
                      Row-Level Errors
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {parsedErrorDetails.map((err, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 rounded-lg"
                          style={{ background: tokens.surface.primary, border: `1px solid ${STATUS_CONFIG.failed.border}` }}
                        >
                          <p className="text-[11px] font-semibold" style={{ color: STATUS_CONFIG.failed.color }}>
                            Row {err.row}
                          </p>
                          {err.errors.map((e, eIdx) => (
                            <p key={eIdx} className="text-xs mt-0.5" style={{ color: tokens.text.secondary }}>
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
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.text.secondary }}>
              Metadata
            </h4>
            <div className="p-4 rounded-xl space-y-2" style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.default}` }}>
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: tokens.text.muted }}>Uploaded</span>
                <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>{formatDateTime(record.uploadedAt)}</span>
              </div>
              {record.completedAt && (
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: tokens.text.muted }}>Completed</span>
                  <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>{formatDateTime(record.completedAt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: tokens.text.muted }}>File Type</span>
                <span className="text-xs font-medium uppercase" style={{ color: tokens.text.primary }}>{record.fileType}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer with retry button for failed/partial */}
        {(record.status === 'failed' || record.status === 'partial') && (
          <div className="px-4 pb-4">
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
      </SheetContent>
    </Sheet>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════ */

export default function DataImport() {
  /* ── State ── */
  const [ingestions, setIngestions] = useState<IngestionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [uploadState, setUploadState] = useState<{
    status: 'idle' | 'uploading' | 'success' | 'error';
    progress: number;
    fileName: string;
    error: string;
  }>({ status: 'idle', progress: 0, fileName: '', error: '' });
  const [dragActive, setDragActive] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IngestionRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [pollingTimer, setPollingTimer] = useState<ReturnType<typeof setInterval> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  /* ── Fetch ingestion history ── */
  const fetchHistory = useCallback(async () => {
    const { data, error } = await fetchApi<IngestionRecord[]>('/api/ingestion', {
      params: { limit: 50 },
    });
    if (error) {
      toast.error('Failed to load ingestion history', { description: error });
    } else if (data) {
      setIngestions(data);
    }
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  /* ── Poll for in-progress ingestions ── */
  useEffect(() => {
    const hasActive = ingestions.some((i) => i.status === 'pending' || i.status === 'processing');
    if (hasActive && !pollingTimer) {
      const timer = setInterval(fetchHistory, 5000);
      setPollingTimer(timer);
    } else if (!hasActive && pollingTimer) {
      clearInterval(pollingTimer);
      setPollingTimer(null);
    }
    return () => {
      if (pollingTimer) clearInterval(pollingTimer);
    };
  }, [ingestions, fetchHistory, pollingTimer]);

  /* ── Compute stats ── */
  const stats = {
    total: ingestions.length,
    successful: ingestions.filter((i) => i.status === 'completed').length,
    failed: ingestions.filter((i) => i.status === 'failed' || i.status === 'partial').length,
    totalRows: ingestions.reduce((sum, i) => sum + (i.processedRows ?? 0), 0),
  };

  /* ── File validation ── */
  const validateFile = (file: File): string | null => {
    const ext = getFileExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type "${ext}". Accepted: ${getAcceptedExtensionsStr()}`;
    }
    if (file.size > 50 * 1024 * 1024) {
      return 'File is too large. Maximum size is 50MB.';
    }
    return null;
  };

  /* ── Upload handler ── */
  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState({ status: 'error', progress: 0, fileName: file.name, error: validationError });
      toast.error('Upload failed', { description: validationError });
      return;
    }

    setUploadState({ status: 'uploading', progress: 0, fileName: file.name, error: '' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();

      // Track progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 90); // Cap at 90% — server processing takes the rest
          setUploadState((prev) => ({ ...prev, progress: pct }));
        }
      });

      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: body.error || `Upload failed with status ${xhr.status}` });
            }
          } catch {
            resolve({ success: false, error: 'Failed to parse server response.' });
          }
        };
        xhr.onerror = () => resolve({ success: false, error: 'Network error during upload.' });
        xhr.open('POST', '/api/ingestion');
        xhr.withCredentials = true;

        // CSRF token
        const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
        if (match) {
          xhr.setRequestHeader('x-csrf-token', decodeURIComponent(match[1]));
        }

        xhr.send(formData);
      });

      if (result.success) {
        setUploadState({ status: 'success', progress: 100, fileName: file.name, error: '' });
        toast.success('File uploaded', { description: `${file.name} is being processed.` });
        await fetchHistory();
        // Reset success state after 3 seconds
        setTimeout(() => {
          setUploadState((prev) => (prev.status === 'success' ? { status: 'idle', progress: 0, fileName: '', error: '' } : prev));
        }, 3000);
      } else {
        setUploadState({ status: 'error', progress: 0, fileName: file.name, error: result.error || 'Upload failed.' });
        toast.error('Upload failed', { description: result.error });
      }
    } catch {
      setUploadState({ status: 'error', progress: 0, fileName: file.name, error: 'Unexpected error during upload.' });
      toast.error('Upload failed', { description: 'Unexpected error.' });
    }
  }, [fetchHistory]);

  /* ── Drag & Drop handlers ── */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      dragCounterRef.current = 0;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        uploadFile(e.dataTransfer.files[0]);
      }
    },
    [uploadFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        uploadFile(e.target.files[0]);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [uploadFile]
  );

  /* ── Clear error state ── */
  const clearError = useCallback(() => {
    setUploadState((prev) => ({ ...prev, status: 'idle', progress: 0, fileName: '', error: '' }));
  }, []);

  /* ── Retry handler ── */
  const handleRetry = useCallback(
    async (id: string) => {
      setRetryingId(id);
      const { error } = await fetchApi(`/api/ingestion/${id}/retry`, { method: 'POST' });
      if (error) {
        toast.error('Retry failed', { description: error });
      } else {
        toast.success('Retry initiated', { description: 'The import is being re-processed.' });
        await fetchHistory();
      }
      setRetryingId(null);
    },
    [fetchHistory]
  );

  /* ── Row click → detail panel ── */
  const handleRowClick = useCallback((row: Record<string, unknown>) => {
    setSelectedRecord(row as unknown as IngestionRecord);
    setDetailOpen(true);
  }, []);

  /* ── Retry from table (inline button) ── */
  const inlineRetry = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      handleRetry(id);
    },
    [handleRetry]
  );

  /* ── DataTable columns ── */
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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase" style={{ background: tokens.surfaceExtended, color: tokens.text.secondary }}>
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
        <span className="tabular-nums" style={{ color: value ? tokens.text.primary : tokens.text.muted }}>
          {value != null ? (value as number).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      key: 'processedRows',
      label: 'Processed Rows',
      sortable: true,
      render: (value: unknown) => (
        <span className="tabular-nums" style={{ color: value ? STATUS_CONFIG.completed.color : tokens.text.muted }}>
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
        <span style={{ color: tokens.text.secondary }}>
          {formatDateTime(value as string)}
        </span>
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
            onClick={(e) => inlineRetry(e, id)}
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

  /* ══════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════ */
  return (
    <div
      className="min-h-screen"
      style={{
        background: tokens.surface.secondary,
        fontFamily: typography.fontFamily,
      }}
    >
      {/* Spin keyframe for Loader2 icons */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Header ── */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: tokens.text.primary }}>
              <div
                className="flex items-center justify-center w-9 h-9 rounded-xl"
                style={{ background: tokens.accent.ghost }}
              >
                <ArrowUpFromLine className="h-5 w-5" style={{ color: tokens.accent.DEFAULT }} />
              </div>
              Data Import
            </h1>
            <p className="mt-1 text-sm" style={{ color: tokens.text.secondary }}>
              Upload CSV, XLSX, or JSON files to ingest data into the intelligence graph.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: tokens.accent.DEFAULT,
              color: tokens.flat.white,
              boxShadow: elevation.sm,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = tokens.accent.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = tokens.accent.DEFAULT;
            }}
          >
            <Upload className="h-4 w-4" />
            Upload File
          </button>
        </header>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Database}
            label="Total Imports"
            value={stats.total}
            color={tokens.accent.DEFAULT}
            bgColor={tokens.accent.ghost}
          />
          <StatCard
            icon={CheckCircle2}
            label="Successful"
            value={stats.successful}
            color={STATUS_CONFIG.completed.color}
            bgColor={STATUS_CONFIG.completed.bg}
          />
          <StatCard
            icon={AlertCircle}
            label="Failed"
            value={stats.failed}
            color={STATUS_CONFIG.failed.color}
            bgColor={STATUS_CONFIG.failed.bg}
          />
          <StatCard
            icon={BarChart3}
            label="Total Rows Processed"
            value={stats.totalRows.toLocaleString()}
            color={tokens.domain.value}
            bgColor={tokens.domain.bg}
          />
        </div>

        {/* ── Upload Zone ── */}
        <div
          className={cn('relative rounded-xl transition-all duration-200', uploadState.status === 'uploading' && 'pointer-events-none')}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onClick={(e) => {
            if (uploadState.status !== 'uploading') {
              fileInputRef.current?.click();
            }
          }}
          aria-label="File upload zone. Click or drag and drop files here."
          style={{
            border: `2px dashed ${dragActive ? tokens.accent.DEFAULT : tokens.border.default}`,
            background: dragActive ? tokens.accent.ghost : tokens.surface.primary,
            boxShadow: dragActive ? `0 0 0 4px ${tokens.accent.subtle}` : 'none',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptedMimeTypes()}
            onChange={handleFileInput}
            className="hidden"
            aria-hidden="true"
          />

          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            {/* Idle State */}
            {uploadState.status === 'idle' && (
              <>
                <div
                  className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                  style={{ background: tokens.surfaceExtended }}
                >
                  <Upload className="h-8 w-8" style={{ color: tokens.text.muted }} />
                </div>
                <p className="text-base font-semibold mb-1" style={{ color: tokens.text.primary }}>
                  {dragActive ? 'Drop your file here' : 'Drag & drop files here, or click to browse'}
                </p>
                <p className="text-sm" style={{ color: tokens.text.muted }}>
                  Supports CSV, XLSX, XLS, and JSON files up to 50MB
                </p>
              </>
            )}

            {/* Uploading State */}
            {uploadState.status === 'uploading' && (
              <>
                <div
                  className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                  style={{ background: tokens.accent.ghost }}
                >
                  <Loader2 className="h-8 w-8" style={{ color: tokens.accent.DEFAULT, animation: 'spin 1s linear infinite' }} />
                </div>
                <p className="text-base font-semibold mb-1" style={{ color: tokens.text.primary }}>
                  Uploading {uploadState.fileName}
                </p>
                <p className="text-sm mb-4" style={{ color: tokens.text.secondary }}>
                  {uploadState.progress}% complete
                </p>
                <div className="w-full max-w-xs">
                  <Progress value={uploadState.progress} className="h-2" />
                </div>
              </>
            )}

            {/* Success State */}
            {uploadState.status === 'success' && (
              <>
                <div
                  className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                  style={{ background: STATUS_CONFIG.completed.bg }}
                >
                  <CheckCircle2 className="h-8 w-8" style={{ color: STATUS_CONFIG.completed.color }} />
                </div>
                <p className="text-base font-semibold mb-1" style={{ color: STATUS_CONFIG.completed.color }}>
                  Upload successful
                </p>
                <p className="text-sm" style={{ color: tokens.text.secondary }}>
                  {uploadState.fileName} is now being processed.
                </p>
              </>
            )}

            {/* Error State */}
            {uploadState.status === 'error' && (
              <>
                <div
                  className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                  style={{ background: STATUS_CONFIG.failed.bg }}
                >
                  <AlertCircle className="h-8 w-8" style={{ color: STATUS_CONFIG.failed.color }} />
                </div>
                <p className="text-base font-semibold mb-1" style={{ color: STATUS_CONFIG.failed.color }}>
                  Upload failed
                </p>
                <p className="text-sm mb-3 max-w-md" style={{ color: tokens.text.secondary }}>
                  {uploadState.error}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearError();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: tokens.surfaceExtended,
                    color: tokens.text.secondary,
                    border: `1px solid ${tokens.border.default}`,
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Ingestion History Table ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: tokens.text.primary }}>
              <RefreshCw className="h-5 w-5" style={{ color: tokens.text.muted }} />
              Ingestion History
            </h2>
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                border: `1px solid ${tokens.border.default}`,
                color: tokens.text.secondary,
                opacity: loadingHistory ? 0.5 : 1,
              }}
            >
              <RefreshCw
                className="h-3.5 w-3.5"
                style={loadingHistory ? { animation: 'spin 1s linear infinite' } : undefined}
              />
              Refresh
            </button>
          </div>

          <DataTable
            columns={columns}
            data={ingestions as unknown as Record<string, unknown>[]}
            onRowClick={handleRowClick}
            loading={loadingHistory}
            emptyMessage="No imports yet. Upload a file to get started."
            filterable
            filterPlaceholder="Search imports..."
            exportable
            exportFilename="ingestion-history"
            title=""
          />
        </section>
      </main>

      {/* ── Detail Slide-Over Panel ── */}
      <DetailPanel
        record={selectedRecord}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onRetry={handleRetry}
        isRetrying={retryingId !== null && retryingId === selectedRecord?.id}
      />
    </div>
  );
}
