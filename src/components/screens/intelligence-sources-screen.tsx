'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, X, CheckCircle2, AlertCircle, Loader2,
  FileSpreadsheet, Database, Play, Eye, Clock,
  RefreshCw, ChevronDown, ChevronUp, Plus, Search,
  Zap, Building2, Radio, Globe, ArrowUpDown,
  AlertTriangle, ExternalLink, Wifi, WifiOff, Pause,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { LoadingState } from '@/components/enterprise/LoadingState';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { EmptyState } from '@/components/shared/design-system';
import { toast } from 'sonner';
import { ALL_CATEGORIES, KNOWLEDGE_CATEGORIES } from '@/lib/intelligence-sources/types';
import type { CompanyResolutionCandidate } from '@/lib/intelligence-sources/types';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface IntelligenceSourcesScreenProps {
  navigateTo?: (screen: string) => void;
}

interface UploadPreviewResponse {
  columns: string[];
  rowCount: number;
  preview: Record<string, unknown>[];
  detectedCompanyColumn: string | null;
}

interface AcquireResponse {
  runId: string;
  status: string;
}

interface Connector {
  id: string;
  name: string;
  sourceType: string;
  status: 'active' | 'paused' | 'failed' | 'disabled';
  lastRunAt: string | null;
  recordsAcquired: number;
  totalRuns: number;
  failureCount: number;
  errorMessage: string | null;
  healthScore?: number;
  dataQualityScore?: number;
}

interface AcquisitionRun {
  id: string;
  connectorId: string;
  connectorName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  recordsAcquired: number;
  errorsCount: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ResolutionModalState {
  open: boolean;
  companyName: string;
  candidates: CompanyResolutionCandidate[];
  runId: string;
  resolving: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

const SOURCE_TYPE_ICONS: Record<string, typeof Globe> = {
  csv: FileSpreadsheet, excel: FileSpreadsheet, website: Globe,
  rss: Radio, document: Database, human: Building2,
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; bg: string }> = {
  active:   { dot: 'bg-emerald-500',  label: 'Active',   bg: 'bg-emerald-50' },
  paused:   { dot: 'bg-amber-400',   label: 'Paused',   bg: 'bg-amber-50' },
  failed:   { dot: 'bg-red-500',      label: 'Failed',   bg: 'bg-red-50' },
  disabled: { dot: 'bg-slate-300',   label: 'Disabled', bg: 'bg-slate-100' },
};

function healthDotColor(score: number | undefined): string {
  if (!score) return 'bg-slate-300';
  if (score >= 0.7) return 'bg-emerald-500';
  if (score >= 0.4) return 'bg-amber-400';
  return 'bg-red-500';
}

function qualityLabel(score: number | undefined): string {
  if (!score) return '—';
  return `${(score * 100).toFixed(0)}%`;
}

/* ═══════════════════════════════════════════════════════════════
   Source Card Component
   ═══════════════════════════════════════════════════════════════ */
function SourceCard({
  connector, onRun, runningId,
}: {
  connector: Connector;
  onRun: (id: string) => void;
  runningId: string | null;
}) {
  const statusCfg = STATUS_CONFIG[connector.status] ?? STATUS_CONFIG.disabled;
  const TypeIcon = SOURCE_TYPE_ICONS[connector.sourceType] ?? Database;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <TypeIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{connector.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px] bg-slate-50">
                {connector.sourceType}
              </Badge>
              {/* Health dot */}
              <span className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', healthDotColor(connector.healthScore))} />
                <span className="text-[11px] text-slate-400">
                  {connector.status}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={() => onRun(connector.id)}
            disabled={runningId === connector.id}
          >
            {runningId === connector.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {connector.status === 'paused' ? 'Resume' : 'Run'}
          </Button>
        </div>
      </div>

      {/* Metrics row */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Last Sync</p>
          <p className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" />
            {formatTimestamp(connector.lastRunAt)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Records</p>
          <p className="text-xs font-semibold text-slate-700 mt-0.5">
            {connector.recordsAcquired.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Quality</p>
          <p className="text-xs font-semibold text-slate-700 mt-0.5">
            {qualityLabel(connector.dataQualityScore)}
          </p>
        </div>
      </div>

      {/* Error message */}
      {connector.errorMessage && (
        <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
          <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 leading-relaxed">{connector.errorMessage}</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceSourcesScreen({ navigateTo }: IntelligenceSourcesScreenProps) {
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loadingConnectors, setLoadingConnectors] = useState(false);
  const [runningConnectorId, setRunningConnectorId] = useState<string | null>(null);
  const [runs, setRuns] = useState<AcquisitionRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<UploadPreviewResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Strategy');
  const [acquiring, setAcquiring] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolution modal
  const [resolutionModal, setResolutionModal] = useState<ResolutionModalState>({
    open: false, companyName: '', candidates: [], runId: '', resolving: false,
  });

  // ── Fetching ──
  const fetchConnectors = useCallback(async () => {
    setLoadingConnectors(true);
    try {
      const res = await fetch('/api/g-intel-acquisition/connectors');
      if (res.ok) {
        const data = await res.json();
        setConnectors(Array.isArray(data.connectors) ? data.connectors : Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
    finally { setLoadingConnectors(false); }
  }, []);

  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const res = await fetch('/api/g-intel-acquisition/runs');
      if (res.ok) {
        const data = await res.json();
        setRuns(Array.isArray(data) ? data.slice(0, 10) : []);
      }
    } catch { /* silent */ }
    finally { setLoadingRuns(false); }
  }, []);

  useEffect(() => { fetchConnectors(); fetchRuns(); }, [fetchConnectors, fetchRuns]);

  // ── File Upload ──
  const handleFileSelect = useCallback((selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Only CSV and Excel files are supported');
      return;
    }
    setFile(selectedFile);
    setUploadPreview(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/g-intel-acquisition/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data: UploadPreviewResponse = await res.json();
      setUploadPreview(data);
      toast.success(`File uploaded: ${data.rowCount} rows detected`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleAcquire = async () => {
    if (!file) return;
    setAcquiring(true);
    try {
      const res = await fetch('/api/g-intel-acquisition/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory }),
      });
      if (!res.ok) throw new Error('Acquisition failed');
      const data: AcquireResponse = await res.json();
      toast.success(`Acquisition started (Run ID: ${data.runId})`);
      setFile(null);
      setUploadPreview(null);
      fetchConnectors();
      fetchRuns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Acquisition failed');
    } finally { setAcquiring(false); }
  };

  // ── Connector Actions ──
  const handleRunConnector = async (id: string) => {
    setRunningConnectorId(id);
    try {
      const res = await fetch(`/api/g-intel-acquisition/connectors/${id}/run`, { method: 'POST' });
      if (!res.ok) throw new Error('Run failed');
      toast.success('Connector run triggered');
      fetchConnectors();
      fetchRuns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Run failed');
    } finally { setRunningConnectorId(null); }
  };

  // ── Stats ──
  const activeCount = connectors.filter(c => c.status === 'active').length;
  const failedCount = connectors.filter(c => c.status === 'failed').length;
  const totalRecords = connectors.reduce((sum, c) => sum + c.recordsAcquired, 0);

  const runStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'running': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'failed': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <Wifi className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Data Sources</h2>
            <p className="text-sm text-slate-500">Connected data sources, connectors, and acquisition runs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchConnectors(); fetchRuns(); }}
            className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowUploadPanel(v => !v)}
            className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" />
            Add Source
          </Button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Sources', value: connectors.length, color: 'text-slate-900', icon: Database },
          { label: 'Active', value: activeCount, color: 'text-emerald-600', icon: Wifi },
          { label: 'Failed', value: failedCount, color: 'text-red-500', icon: WifiOff },
          { label: 'Total Records', value: totalRecords.toLocaleString(), color: 'text-blue-600', icon: Zap },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{stat.label}</p>
              <stat.icon className={cn('h-4 w-4', stat.color)} />
            </div>
            <p className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Upload Panel ── */}
      {showUploadPanel && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-600" />
              Upload Data Source
            </h3>
            <p className="text-xs text-slate-500 mt-1">Upload CSV or Excel files to create a new data source</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
                dragOver ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.xlsx,.xls"
                onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
              <Upload className={cn('h-8 w-8 mx-auto mb-3', file ? 'text-blue-500' : 'text-slate-300')} />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-600">Drop file here or click to browse</p>
                  <p className="text-xs text-slate-400 mt-1">CSV, XLSX, XLS</p>
                </div>
              )}
            </div>

            {/* Category & Actions */}
            {file && (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">Knowledge Category</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-9 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleUpload} disabled={uploading}
                  variant="outline" className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload
                </Button>
                {uploadPreview && (
                  <Button onClick={handleAcquire} disabled={acquiring}
                    className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {acquiring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Acquire
                  </Button>
                )}
              </div>
            )}

            {/* Preview */}
            {uploadPreview && (
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-700">Preview</span>
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                    {uploadPreview.rowCount} rows · {uploadPreview.columns.length} columns
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {uploadPreview.columns.map(col => (
                          <th key={col} className="text-left py-1.5 px-2 font-medium text-slate-500 whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadPreview.preview.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          {uploadPreview.columns.map(col => (
                            <td key={col} className="py-1.5 px-2 text-slate-600 whitespace-nowrap max-w-[200px] truncate">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Connectors Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Connected Sources</h3>
          <span className="text-xs text-slate-400">{connectors.length} source{connectors.length !== 1 ? 's' : ''}</span>
        </div>

        {loadingConnectors ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : connectors.length === 0 ? (
          <EmptyState
            icon={Wifi}
            title="No data sources connected"
            description="Upload a file or configure a connector to start collecting intelligence data."
            actionLabel="Add Source"
            onAction={() => setShowUploadPanel(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectors.map(connector => (
              <SourceCard
                key={connector.id}
                connector={connector}
                onRun={handleRunConnector}
                runningId={runningConnectorId}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Acquisition Runs ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Recent Acquisition Runs</h3>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {loadingRuns ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : runs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-400">No acquisition runs yet</p>
            </div>
          ) : (
            runs.map(run => (
              <div key={run.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn('text-[10px]', runStatusColor(run.status))}>
                    {run.status}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{run.connectorName || run.connectorId}</p>
                    <p className="text-[11px] text-slate-400">{formatTimestamp(run.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{run.recordsAcquired} records</span>
                  {run.errorsCount > 0 && (
                    <span className="text-red-500">{run.errorsCount} errors</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Company Resolution Modal ── */}
      <Dialog open={resolutionModal.open} onOpenChange={open => setResolutionModal(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Company Match</DialogTitle>
            <DialogDescription>Select the matching company for <strong>{resolutionModal.companyName}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {resolutionModal.candidates.map((c, i) => (
              <button
                key={i}
                onClick={async () => {
                  setResolutionModal(prev => ({ ...prev, resolving: true }));
                  try {
                    await fetch(`/api/g-intel-acquisition/runs/${resolutionModal.runId}/resolve`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ companyId: c.id }),
                    });
                    toast.success(`Resolved to ${c.name}`);
                    setResolutionModal(prev => ({ ...prev, open: false }));
                    fetchConnectors();
                    fetchRuns();
                  } catch { toast.error('Resolution failed'); }
                  finally { setResolutionModal(prev => ({ ...prev, resolving: false })); }
                }}
                className="w-full text-left rounded-lg border border-slate-200 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors"
              >
                <p className="text-sm font-medium text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.domain} · {c.industry || 'N/A'}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
