'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { tokens, typography } from '@/components/intelligence-os/design-tokens';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';
import {
  ArrowUpFromLine,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import {
  ImportStatCard,
  UploadZone,
  DetailPanel,
  ImportHistory,
  STATUS_CONFIG,
  ACCEPTED_EXTENSIONS,
  getFileExtension,
  type IngestionRecord,
} from './data-import';

/* ══════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════ */

export default function DataImport() {
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

  const fetchHistory = useCallback(async () => {
    const { data, error } = await fetchApi<IngestionRecord[]>('/api/ingestion', {
      params: { limit: 50 },
    });
    if (error) toast.error('Failed to load ingestion history', { description: error });
    else if (data) setIngestions(data);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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

  const stats = {
    total: ingestions.length,
    successful: ingestions.filter((i) => i.status === 'completed').length,
    failed: ingestions.filter((i) => i.status === 'failed' || i.status === 'partial').length,
    totalRows: ingestions.reduce((sum, i) => sum + (i.processedRows ?? 0), 0),
  };

  const validateFile = (file: File): string | null => {
    const ext = getFileExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext))
      return `Unsupported file type "${ext}". Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`;
    if (file.size > 50 * 1024 * 1024) return 'File is too large. Maximum size is 50MB.';
    return null;
  };

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setUploadState({
          status: 'error',
          progress: 0,
          fileName: file.name,
          error: validationError,
        });
        toast.error('Upload failed', { description: validationError });
        return;
      }
      setUploadState({ status: 'uploading', progress: 0, fileName: file.name, error: '' });
      const formData = new FormData();
      formData.append('file', file);
      try {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable)
            setUploadState((prev) => ({
              ...prev,
              progress: Math.round((e.loaded / e.total) * 90),
            }));
        });
        const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
          xhr.onload = () => {
            try {
              const body = JSON.parse(xhr.responseText);
              resolve(
                xhr.status >= 200 && xhr.status < 300
                  ? { success: true }
                  : {
                      success: false,
                      error: body.error || `Upload failed with status ${xhr.status}`,
                    },
              );
            } catch {
              resolve({ success: false, error: 'Failed to parse server response.' });
            }
          };
          xhr.onerror = () => resolve({ success: false, error: 'Network error during upload.' });
          xhr.open('POST', '/api/ingestion');
          xhr.withCredentials = true;
          const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
          if (match) xhr.setRequestHeader('x-csrf-token', decodeURIComponent(match[1]));
          xhr.send(formData);
        });
        if (result.success) {
          setUploadState({ status: 'success', progress: 100, fileName: file.name, error: '' });
          toast.success('File uploaded', { description: `${file.name} is being processed.` });
          await fetchHistory();
          setTimeout(() => {
            setUploadState((prev) =>
              prev.status === 'success'
                ? { status: 'idle', progress: 0, fileName: '', error: '' }
                : prev,
            );
          }, 3000);
        } else {
          setUploadState({
            status: 'error',
            progress: 0,
            fileName: file.name,
            error: result.error || 'Upload failed.',
          });
          toast.error('Upload failed', { description: result.error });
        }
      } catch {
        setUploadState({
          status: 'error',
          progress: 0,
          fileName: file.name,
          error: 'Unexpected error during upload.',
        });
        toast.error('Upload failed', { description: 'Unexpected error.' });
      }
    },
    [fetchHistory],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setDragActive(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setDragActive(false);
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
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0)
        uploadFile(e.dataTransfer.files[0]);
    },
    [uploadFile],
  );
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) uploadFile(e.target.files[0]);
      e.target.value = '';
    },
    [uploadFile],
  );
  const clearError = useCallback(() => {
    setUploadState((prev) => ({ ...prev, status: 'idle', progress: 0, fileName: '', error: '' }));
  }, []);

  const handleRetry = useCallback(
    async (id: string) => {
      setRetryingId(id);
      const { error } = await fetchApi(`/api/ingestion/${id}/retry`, { method: 'POST' });
      if (error) toast.error('Retry failed', { description: error });
      else {
        toast.success('Retry initiated', { description: 'The import is being re-processed.' });
        await fetchHistory();
      }
      setRetryingId(null);
    },
    [fetchHistory],
  );

  const handleRowClick = useCallback((row: Record<string, unknown>) => {
    setSelectedRecord(row as unknown as IngestionRecord);
    setDetailOpen(true);
  }, []);
  const inlineRetry = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      handleRetry(id);
    },
    [handleRetry],
  );

  return (
    <div
      className="min-h-screen"
      style={{ background: tokens.surface.secondary, fontFamily: typography.fontFamily }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-bold flex items-center gap-2.5"
              style={{ color: tokens.text.primary }}
            >
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
            style={{ background: tokens.accent.DEFAULT, color: tokens.flat.white }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = tokens.accent.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = tokens.accent.DEFAULT;
            }}
          >
            <Upload className="h-4 w-4" /> Upload File
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ImportStatCard
            icon={Database}
            label="Total Imports"
            value={stats.total}
            color={tokens.accent.DEFAULT}
            bgColor={tokens.accent.ghost}
          />
          <ImportStatCard
            icon={CheckCircle2}
            label="Successful"
            value={stats.successful}
            color={STATUS_CONFIG.completed.color}
            bgColor={STATUS_CONFIG.completed.bg}
          />
          <ImportStatCard
            icon={AlertCircle}
            label="Failed"
            value={stats.failed}
            color={STATUS_CONFIG.failed.color}
            bgColor={STATUS_CONFIG.failed.bg}
          />
          <ImportStatCard
            icon={BarChart3}
            label="Total Rows Processed"
            value={stats.totalRows.toLocaleString()}
            color={tokens.domain?.value || '#06B6D4'}
            bgColor={tokens.domain?.bg || 'rgba(6,182,212,0.1)'}
          />
        </div>

        <UploadZone
          fileInputRef={fileInputRef}
          dragActive={dragActive}
          uploadState={uploadState}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onFileInput={handleFileInput}
          clearError={clearError}
        />

        <ImportHistory
          ingestions={ingestions}
          loading={loadingHistory}
          retryingId={retryingId}
          onRowClick={handleRowClick}
          onRefresh={fetchHistory}
          onRetry={inlineRetry}
        />
      </main>

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
