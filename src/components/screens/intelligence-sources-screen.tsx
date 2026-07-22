'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition,
  AnimatedCard,
  SectionHeader,
  StatCard,
} from '@/components/ui/animated-components';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Upload, X, CheckCircle2, AlertCircle, Loader2,
  FileSpreadsheet, Database, Play, Eye, Clock,
  RefreshCw, ChevronDown, ChevronUp, Plus, Search,
  Zap, Building2, Radio, Globe, ArrowUpDown,
  AlertTriangle, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { ALL_CATEGORIES, KNOWLEDGE_CATEGORIES } from '@/lib/intelligence-sources/types';
import type { CompanyResolutionCandidate } from '@/lib/intelligence-sources/types';

// ─── Props ──────────────────────────────────────────────────────
interface IntelligenceSourcesScreenProps {
  navigateTo?: (screen: string) => void;
}

// ─── Upload Response Types ─────────────────────────────────────
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

// ─── Connector Types ───────────────────────────────────────────
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
}

// ─── Run Types ─────────────────────────────────────────────────
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

// ─── Company Resolution Types ──────────────────────────────────
interface ResolutionModalState {
  open: boolean;
  companyName: string;
  candidates: CompanyResolutionCandidate[];
  runId: string;
  resolving: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────
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
  csv: FileSpreadsheet,
  excel: FileSpreadsheet,
  website: Globe,
  rss: Radio,
  document: Database,
  human: Building2,
};

// ─── Component ─────────────────────────────────────────────────
export default function IntelligenceSourcesScreen({ navigateTo }: IntelligenceSourcesScreenProps) {
  // ── Panel toggles ──
  const [showUploadPanel, setShowUploadPanel] = useState(true);
  const [showConnectors, setShowConnectors] = useState(true);
  const [showRuns, setShowRuns] = useState(true);

  // ── Upload state ──
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPreview, setUploadPreview] = useState<UploadPreviewResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Strategy');
  const [acquiring, setAcquiring] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Connectors state ──
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loadingConnectors, setLoadingConnectors] = useState(false);
  const [runningConnectorId, setRunningConnectorId] = useState<string | null>(null);

  // ── Runs state ──
  const [runs, setRuns] = useState<AcquisitionRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  // ── Company resolution modal ──
  const [resolutionModal, setResolutionModal] = useState<ResolutionModalState>({
    open: false,
    companyName: '',
    candidates: [],
    runId: '',
    resolving: false,
  });

  // ─────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────

  const fetchConnectors = useCallback(async () => {
    setLoadingConnectors(true);
    try {
      const res = await fetch('/api/g-intel-acquisition/connectors');
      if (res.ok) {
        const data = await res.json();
        setConnectors(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent — connectors may not be configured yet
    } finally {
      setLoadingConnectors(false);
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const res = await fetch('/api/g-intel-acquisition/runs');
      if (res.ok) {
        const data = await res.json();
        setRuns(Array.isArray(data) ? data.slice(0, 10) : []);
      }
    } catch {
      // silent
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
    fetchRuns();
  }, [fetchConnectors, fetchRuns]);

  // ─────────────────────────────────────────────────
  // FILE UPLOAD
  // ─────────────────────────────────────────────────

  const handleFileSelect = useCallback((selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Unsupported file format', {
        description: 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)',
      });
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum file size is 50MB' });
      return;
    }
    setFile(selectedFile);
    setUploadPreview(null);
    handleUpload(selectedFile);
  }, []);

  const handleUpload = async (selectedFile: File) => {
    setUploading(true);
    setUploadProgress(0);

    // Simulate progress ticks
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/g-intel-acquisition/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || 'Upload failed');
      }

      const data: UploadPreviewResponse = await res.json();
      setUploadPreview(data);
      toast.success('File parsed', {
        description: `Detected ${data.columns.length} columns, ${data.rowCount.toLocaleString()} rows`,
      });
    } catch (err: unknown) {
      clearInterval(progressInterval);
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error('Upload failed', { description: message });
      setFile(null);
      setUploadPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleStartAcquisition = async () => {
    if (!uploadPreview) return;
    setAcquiring(true);
    try {
      const res = await fetch('/api/g-intel-acquisition/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: uploadPreview.columns,
          rowCount: uploadPreview.rowCount,
          preview: uploadPreview.preview,
          detectedCompanyColumn: uploadPreview.detectedCompanyColumn,
          category: selectedCategory,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || 'Acquisition failed');
      }

      const data: AcquireResponse = await res.json();
      toast.success('Acquisition started', {
        description: `Run ${data.runId} is processing your data`,
      });

      // Reset upload state
      setFile(null);
      setUploadPreview(null);
      setUploadProgress(0);
      setSelectedCategory('Strategy');

      // Refresh runs
      fetchRuns();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Acquisition failed';
      toast.error('Acquisition failed', { description: message });
    } finally {
      setAcquiring(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadPreview(null);
    setUploadProgress(0);
    setUploading(false);
    setAcquiring(false);
  };

  // ─────────────────────────────────────────────────
  // CONNECTOR ACTIONS
  // ─────────────────────────────────────────────────

  const handleRunConnector = async (connectorId: string, connectorName: string) => {
    setRunningConnectorId(connectorId);
    try {
      const res = await fetch(`/api/g-intel-acquisition/connectors/${connectorId}/run`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || 'Run failed');
      }
      const data = await res.json();
      toast.success('Connector run started', {
        description: `${connectorName} — Run ${data.runId}`,
      });
      // Refresh both lists
      fetchConnectors();
      fetchRuns();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Run failed';
      toast.error('Run failed', { description: message });
    } finally {
      setRunningConnectorId(null);
    }
  };

  // ─────────────────────────────────────────────────
  // COMPANY RESOLUTION
  // ─────────────────────────────────────────────────

  const handleConfirmResolution = async (candidate: CompanyResolutionCandidate) => {
    setResolutionModal(prev => ({ ...prev, resolving: true }));
    try {
      const res = await fetch('/api/g-intel-acquisition/resolve-company/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: resolutionModal.runId,
          companyName: resolutionModal.companyName,
          selectedCompanyId: candidate.companyId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || 'Resolution failed');
      }
      toast.success('Company resolved', {
        description: `Matched "${resolutionModal.companyName}" to ${candidate.name}`,
      });
      setResolutionModal({ open: false, companyName: '', candidates: [], runId: '', resolving: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Resolution failed';
      toast.error('Resolution failed', { description: message });
    } finally {
      setResolutionModal(prev => ({ ...prev, resolving: false }));
    }
  };

  // ─────────────────────────────────────────────────
  // STATUS BADGES
  // ─────────────────────────────────────────────────

  const ConnectorStatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { className: string; label: string }> = {
      active: { className: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10', label: 'Active' },
      paused: { className: 'border-amber-500/30 text-amber-500 bg-amber-500/10', label: 'Paused' },
      disabled: { className: 'border-gray-500/30 text-gray-500 bg-gray-500/10', label: 'Disabled' },
      failed: { className: 'border-red-500/30 text-red-500 bg-red-500/10', label: 'Failed' },
    };
    const c = config[status] || config.disabled;
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  const RunStatusBadge = ({ status }: { status: string }) => {
    if (status === 'running') {
      return (
        <Badge variant="outline" className="border-sky-500/30 text-sky-400 bg-sky-500/10 gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Running
        </Badge>
      );
    }
    const config: Record<string, { className: string; label: string }> = {
      pending: { className: 'border-gray-500/30 text-gray-400 bg-gray-500/10', label: 'Pending' },
      completed: { className: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10', label: 'Completed' },
      failed: { className: 'border-red-500/30 text-red-500 bg-red-500/10', label: 'Failed' },
      cancelled: { className: 'border-gray-500/30 text-gray-500 bg-gray-500/10', label: 'Cancelled' },
    };
    const c = config[status] || config.pending;
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  // ─────────────────────────────────────────────────
  // SKELETON HELPERS
  // ─────────────────────────────────────────────────

  const TableSkeleton = ({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) => (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 bg-muted rounded animate-pulse flex-1"
              style={{ animationDelay: `${(r * cols + c) * 75}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────

  return (
    <PageTransition className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ═══════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, oklch(0.75 0.18 160), oklch(0.70 0.15 180))' }}
          >
            <Database className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Intelligence Sources</h1>
            <p className="text-sm text-muted-foreground">
              Acquire, manage, and monitor intelligence from external sources
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setShowUploadPanel(true);
            fileInputRef.current?.click();
          }}
          className="gap-2 shrink-0"
          style={{ background: 'linear-gradient(135deg, oklch(0.75 0.18 160), oklch(0.70 0.15 180))', color: '#000' }}
        >
          <Upload className="w-4 h-4" />
          Upload File
        </Button>
      </div>

      {/* ═══════════════════════════════════════════
          STATS ROW
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Connectors"
          value={connectors.filter(c => c.status === 'active').length}
          icon={Zap}
          trend={connectors.length > 0 ? { value: `${connectors.length} total`, up: true } : undefined}
        />
        <StatCard
          label="Total Records"
          value={connectors.reduce((sum, c) => sum + c.recordsAcquired, 0).toLocaleString()}
          icon={Database}
        />
        <StatCard
          label="Recent Runs"
          value={runs.filter(r => r.status === 'completed').length}
          icon={RefreshCw}
          trend={runs.length > 0 ? { value: `Last ${runs.length} runs`, up: true } : undefined}
        />
        <StatCard
          label="Failed Runs"
          value={runs.filter(r => r.status === 'failed').length}
          icon={AlertTriangle}
        />
      </div>

      {/* ═══════════════════════════════════════════
          UPLOAD PANEL
          ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {showUploadPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <Card className="border-border">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Upload className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">File Upload</CardTitle>
                      <CardDescription>Import intelligence from CSV or Excel files</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setShowUploadPanel(false)}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                    e.target.value = '';
                  }}
                />

                {/* ── Drop Zone / Uploading / Preview ── */}
                {!uploadPreview && !uploading && !file && (
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-10 sm:p-14 text-center transition-all cursor-pointer ${
                      dragOver
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-border hover:border-emerald-500/50 hover:bg-muted/30'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const droppedFile = e.dataTransfer.files[0];
                      if (droppedFile) handleFileSelect(droppedFile);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <FileSpreadsheet className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Drag and drop your CSV or Excel file here
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          or click to browse &middot; .csv, .xlsx, .xls up to 50MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Uploading Progress ── */}
                {uploading && (
                  <div className="rounded-xl border border-border p-8 text-center space-y-4">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Uploading and parsing {file?.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Analyzing columns and detecting data structure...
                      </p>
                    </div>
                    <div className="w-full max-w-sm mx-auto">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: 'linear-gradient(90deg, oklch(0.75 0.18 160), oklch(0.70 0.15 180))' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(uploadProgress, 100)}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {Math.round(uploadProgress)}%
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Upload Preview ── */}
                {uploadPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* File info bar */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {file?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {uploadPreview.columns.length} columns &middot;{' '}
                            {uploadPreview.rowCount.toLocaleString()} rows
                            {uploadPreview.detectedCompanyColumn && (
                              <span className="ml-2 text-emerald-500">
                                &middot; Company column detected
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        onClick={resetUpload}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Preview table */}
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="max-h-80 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                              {uploadPreview.columns.map((col) => (
                                <TableHead
                                  key={col}
                                  className={`text-xs font-semibold whitespace-nowrap px-3 py-2.5 ${
                                    col === uploadPreview.detectedCompanyColumn
                                      ? 'text-emerald-400 bg-emerald-500/5'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {col}
                                  {col === uploadPreview.detectedCompanyColumn && (
                                    <Badge
                                      variant="outline"
                                      className="ml-1.5 text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                    >
                                      Company
                                    </Badge>
                                  )}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {uploadPreview.preview.slice(0, 5).map((row, i) => (
                              <TableRow key={i} className="border-border">
                                {uploadPreview.columns.map((col) => (
                                  <TableCell
                                    key={col}
                                    className={`text-xs px-3 py-2 max-w-[200px] truncate ${
                                      col === uploadPreview.detectedCompanyColumn
                                        ? 'text-emerald-300 font-medium bg-emerald-500/5'
                                        : 'text-foreground'
                                    }`}
                                  >
                                    {String(row[col] ?? '')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {uploadPreview.rowCount > 5 && (
                        <div className="px-4 py-2 bg-muted/30 border-t border-border">
                          <p className="text-xs text-muted-foreground text-center">
                            Showing first 5 of {uploadPreview.rowCount.toLocaleString()} rows
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Category selection & action bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <label className="text-sm text-muted-foreground whitespace-nowrap">
                          Category:
                        </label>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(KNOWLEDGE_CATEGORIES) as [string, readonly string[]][]).map(
                              ([group, categories]) => (
                                <SelectItem key={group} disabled value={`__group__${group}`}>
                                  <span className="font-semibold uppercase text-xs tracking-wider text-muted-foreground">
                                    {group}
                                  </span>
                                </SelectItem>
                              )
                            )}
                            {ALL_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={handleStartAcquisition}
                        disabled={acquiring}
                        className="gap-2 shrink-0"
                        style={{
                          background: 'linear-gradient(135deg, oklch(0.75 0.18 160), oklch(0.70 0.15 180))',
                          color: '#000',
                        }}
                      >
                        {acquiring ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        {acquiring ? 'Starting...' : 'Start Acquisition'}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload panel collapsed toggle */}
      {!showUploadPanel && (
        <Button
          variant="outline"
          className="w-full justify-center gap-2 border-dashed border-border text-muted-foreground hover:text-foreground"
          onClick={() => setShowUploadPanel(true)}
        >
          <Upload className="w-4 h-4" />
          Show Upload Panel
        </Button>
      )}

      {/* ═══════════════════════════════════════════
          CONNECTOR LIST
          ═══════════════════════════════════════════ */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-sky-500" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Connectors
                  {!loadingConnectors && (
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-border">
                      {connectors.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>External intelligence source connections</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={fetchConnectors}
                disabled={loadingConnectors}
              >
                <RefreshCw className={`w-4 h-4 ${loadingConnectors ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShowConnectors(!showConnectors)}
              >
                {showConnectors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {showConnectors && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0">
                {loadingConnectors ? (
                  <TableSkeleton rows={3} cols={6} />
                ) : connectors.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Globe className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">No connectors configured</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Connect external sources like websites, RSS feeds, and APIs to automate intelligence acquisition
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-xs font-semibold text-muted-foreground">Name</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Type</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Last Run</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground text-right">Records</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {connectors.map((connector) => {
                            const IconComp = SOURCE_TYPE_ICONS[connector.sourceType] || Database;
                            return (
                              <TableRow key={connector.id} className="border-border group">
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                                      <IconComp className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                                        {connector.name}
                                      </p>
                                      {connector.errorMessage && (
                                        <p className="text-[10px] text-red-400 truncate max-w-[200px]">
                                          {connector.errorMessage}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <span className="text-xs text-muted-foreground capitalize">
                                    {connector.sourceType}
                                  </span>
                                </TableCell>
                                <TableCell className="py-3">
                                  <ConnectorStatusBadge status={connector.status} />
                                </TableCell>
                                <TableCell className="py-3">
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimestamp(connector.lastRunAt)}
                                  </span>
                                </TableCell>
                                <TableCell className="py-3 text-right">
                                  <span className="text-sm font-medium text-foreground tabular-nums">
                                    {connector.recordsAcquired.toLocaleString()}
                                  </span>
                                </TableCell>
                                <TableCell className="py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                      onClick={() => handleRunConnector(connector.id, connector.name)}
                                      disabled={runningConnectorId === connector.id}
                                    >
                                      {runningConnectorId === connector.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5" />
                                      )}
                                      Run Now
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* ═══════════════════════════════════════════
          RECENT ACQUISITION RUNS
          ═══════════════════════════════════════════ */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Recent Acquisition Runs
                  {!loadingRuns && runs.length > 0 && (
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-border">
                      Last {runs.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Monitor the status and results of intelligence acquisitions</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={fetchRuns}
                disabled={loadingRuns}
              >
                <RefreshCw className={`w-4 h-4 ${loadingRuns ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShowRuns(!showRuns)}
              >
                {showRuns ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {showRuns && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0">
                {loadingRuns ? (
                  <TableSkeleton rows={4} cols={5} />
                ) : runs.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Clock className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">No acquisition runs yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload a file or run a connector to start acquiring intelligence
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-xs font-semibold text-muted-foreground">Connector</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground text-right">Records</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground text-right">Errors</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {runs.map((run) => (
                            <TableRow key={run.id} className="border-border group">
                              <TableCell className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                                    <Zap className="w-3 h-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-sm font-medium text-foreground truncate max-w-[180px]">
                                    {run.connectorName || run.connectorId}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <RunStatusBadge status={run.status} />
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                <span className="text-sm text-foreground tabular-nums">
                                  {run.recordsAcquired.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                {run.errorsCount > 0 ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                    <span className="text-sm text-red-400 tabular-nums">
                                      {run.errorsCount}
                                    </span>
                                  </div>
                        ) : (
                                  <span className="text-sm text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimestamp(run.createdAt)}
                                  </span>
                                  {run.completedAt && (
                                    <span className="text-[10px] text-muted-foreground/60">
                                      completed {formatTimestamp(run.completedAt)}
                                    </span>
                                  )}
                                  {run.status === 'failed' && run.errorMessage && (
                                    <span className="text-[10px] text-red-400/70 truncate max-w-[180px]" title={run.errorMessage}>
                                      {run.errorMessage}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* ═══════════════════════════════════════════
          COMPANY RESOLUTION MODAL
          ═══════════════════════════════════════════ */}
      <Dialog open={resolutionModal.open} onOpenChange={(open) => {
        if (!open && !resolutionModal.resolving) {
          setResolutionModal({ open: false, companyName: '', candidates: [], runId: '', resolving: false });
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-500" />
              Resolve Company
            </DialogTitle>
            <DialogDescription>
              Multiple matches found for &ldquo;{resolutionModal.companyName}&rdquo;.
              Select the correct company or create a new one.
            </DialogDescription>
          </DialogHeader>

          {/* Search within candidates */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter candidates..."
              className="pl-9"
              disabled={resolutionModal.resolving}
            />
          </div>

          {/* Candidate list */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {resolutionModal.candidates.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Building2 className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">No candidates found</p>
              </div>
            ) : (
              resolutionModal.candidates.map((candidate) => (
                <motion.div
                  key={candidate.companyId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {candidate.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {candidate.domain && (
                          <span className="text-xs text-muted-foreground">{candidate.domain}</span>
                        )}
                        {candidate.industry && (
                          <span className="text-xs text-muted-foreground">{candidate.industry}</span>
                        )}
                        {candidate.country && (
                          <span className="text-xs text-muted-foreground">{candidate.country}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {/* Confidence bar */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${
                            candidate.confidence >= 0.8
                              ? 'bg-emerald-500'
                              : candidate.confidence >= 0.5
                                ? 'bg-amber-500'
                                : 'bg-red-400'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(candidate.confidence * 100)}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                        />
                      </div>
                      <span className={`text-xs font-medium tabular-nums min-w-[32px] text-right ${
                        candidate.confidence >= 0.8
                          ? 'text-emerald-400'
                          : candidate.confidence >= 0.5
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }`}>
                        {Math.round(candidate.confidence * 100)}%
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        background: 'linear-gradient(135deg, oklch(0.75 0.18 160), oklch(0.70 0.15 180))',
                        color: '#000',
                      }}
                      onClick={() => handleConfirmResolution(candidate)}
                      disabled={resolutionModal.resolving}
                    >
                      {resolutionModal.resolving ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      Confirm
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                toast.info('Create New Company', {
                  description: 'New company creation flow would be triggered here',
                });
                setResolutionModal({ open: false, companyName: '', candidates: [], runId: '', resolving: false });
              }}
              disabled={resolutionModal.resolving}
            >
              <Plus className="w-4 h-4" />
              Create New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}