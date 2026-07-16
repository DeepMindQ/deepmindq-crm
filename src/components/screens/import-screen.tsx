'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition,
  AnimatedCard,
  SectionHeader,
  StatCard,
  StaggerGrid,
  StaggerItem,
  ShimmerText,
  GlassPanel,
  EmptyState,
  AnimatedBar,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Eye, FileSpreadsheet, X, CheckCircle2, AlertCircle, Database, Rows3, CheckCircle, Inbox, StopCircle, Loader2, ChevronRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Batch {
  id: string;
  fileName: string;
  totalRows: number;
  acceptedRows: number;
  duplicateRows: number;
  invalidRows: number;
  status: string;
  createdAt: string;
}

/* L-08: Preview mapping types */
interface PreviewData {
  headers: string[];
  detectedMapping: Record<string, string>;
  availableFields: string[];
  previewRows: Record<string, unknown>[];
  totalRows: number;
  fileName: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  processing: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  failed: 'bg-red-500/20 text-red-600 border-red-500/30',
  pending: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  cancelled: 'bg-red-500/20 text-red-600 border-red-500/30',
  draft: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const CONSENT_SOURCES = [
  { value: 'manual_upload', label: 'Manual Upload' },
  { value: 'purchased_list', label: 'Purchased List' },
  { value: 'web_form', label: 'Web Form' },
  { value: 'referral', label: 'Referral' },
  { value: 'double_opt_in', label: 'Double Opt-In' },
];

const LEAD_SOURCES = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'event', label: 'Event' },
  { value: 'referral', label: 'Referral' },
  { value: 'cold_list', label: 'Cold List' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'manual', label: 'Manual' },
  { value: 'purchased', label: 'Purchased' },
];

interface ProgressData {
  status: string;
  processedRows: number;
  totalRows: number;
  acceptedRows: number;
  duplicateRows: number;
  invalidRows: number;
  percentComplete: number;
  eta: number;
}

interface ImportScreenProps {
  navigateTo?: (screen: string) => void;
}

export default function ImportScreen({ navigateTo }: ImportScreenProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    details?: { total: number; accepted: number; duplicates: number; invalid: number };
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── L-08: Preview & Mapping state ── */
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [customMapping, setCustomMapping] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importingWithMapping, setImportingWithMapping] = useState(false);

  /* L-09: Progress tracking for large files */
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const progressPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* L-12: Consent source */
  const [consentSource, setConsentSource] = useState('manual_upload');

  /* L-15: Lead source */
  const [leadSource, setLeadSource] = useState('manual');

  useEffect(() => {
    fetch('/api/batches')
      .then(r => r.json())
      .then(d => {
        setBatches(Array.isArray(d) ? d : d.batches || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* L-09: Poll progress for active batch */
  const startProgressPolling = useCallback((batchId: string) => {
    setActiveBatchId(batchId);
    if (progressPollRef.current) clearInterval(progressPollRef.current);

    progressPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/batches/${batchId}/progress`);
        const data = await res.json();
        setProgress(data);

        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          if (progressPollRef.current) clearInterval(progressPollRef.current);
          progressPollRef.current = null;
          setActiveBatchId(null);

          // Refresh batches
          const batchRes = await fetch('/api/batches');
          const d = await batchRes.json();
          setBatches(Array.isArray(d) ? d : d.batches || []);

          if (data.status === 'completed') {
            setUploadResult({
              success: true,
              message: `Imported ${data.acceptedRows} of ${data.totalRows} rows`,
              details: {
                total: data.totalRows,
                accepted: data.acceptedRows,
                duplicates: data.duplicateRows,
                invalid: data.invalidRows,
              },
            });
          } else if (data.status === 'cancelled') {
            toast.info('Import cancelled');
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);
  }, []);

  /* L-09: Cancel batch */
  const cancelBatch = async (batchId: string) => {
    try {
      await fetch(`/api/batches/${batchId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      toast.info('Cancellation requested...');
    } catch {
      toast.error('Failed to cancel');
    }
  };

  /* Cleanup polling on unmount */
  useEffect(() => {
    return () => {
      if (progressPollRef.current) clearInterval(progressPollRef.current);
    };
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatEta = (seconds: number): string => {
    if (seconds <= 0) return 'calculating...';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const handleFileUpload = async (file: File, mapping?: Record<string, string>) => {
    if (file.size > 25 * 1024 * 1024) {
      setUploadResult({
        success: false,
        message: `File too large (${formatFileSize(file.size)}). Maximum size is 25MB.`,
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);
    setProgress(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('consentSource', consentSource);
    formData.append('source', leadSource);
    // L-08: Send custom mapping if provided
    if (mapping && Object.keys(mapping).length > 0) {
      formData.append('mapping', JSON.stringify(mapping));
    }
    try {
      const res = await fetch('/api/batches', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.batch.largeFile) {
          startProgressPolling(data.batch.id);
        } else {
          setUploadResult({
            success: true,
            message: `Imported ${data.batch.acceptedRows} of ${data.batch.totalRows} rows`,
            details: {
              total: data.batch.totalRows,
              accepted: data.batch.acceptedRows,
              duplicates: data.batch.duplicateRows,
              invalid: data.batch.invalidRows,
            },
          });
        }
      } else {
        setUploadResult({ success: false, message: data.error || 'Upload failed' });
      }
      const batchRes = await fetch('/api/batches');
      const d = await batchRes.json();
      setBatches(Array.isArray(d) ? d : d.batches || []);
    } catch {
      setUploadResult({ success: false, message: 'Network error - please try again.' });
    }
    setUploading(false);
  };

  /* ── L-08: Preview file before import ── */
  const handlePreviewFile = async (file: File) => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/batches/preview', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.headers) {
        setPreviewData(data);
        setCustomMapping(data.detectedMapping || {});
      } else {
        toast.error(data.error || 'Preview failed');
        setPreviewOpen(false);
      }
    } catch {
      toast.error('Preview failed');
      setPreviewOpen(false);
    }
    setPreviewLoading(false);
  };

  /* ── L-08: Import with confirmed mapping ── */
  const handleImportWithMapping = async () => {
    if (!selectedFile) return;
    setImportingWithMapping(true);
    await handleFileUpload(selectedFile, customMapping);
    setImportingWithMapping(false);
    setPreviewOpen(false);
  };

  /* ── L-08: Reset to auto-detected mapping ── */
  const handleAutoDetect = () => {
    if (previewData) setCustomMapping(previewData.detectedMapping || {});
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      handlePreviewFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      handlePreviewFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const stats = useMemo(() => {
    const totalImports = batches.length;
    const totalRows = batches.reduce((sum, b) => sum + b.totalRows, 0);
    const totalAccepted = batches.reduce((sum, b) => sum + b.acceptedRows, 0);
    return { totalImports, totalRows, totalAccepted };
  }, [batches]);

  const isProcessing = progress !== null && progress.status === 'processing';

  if (loading) {
    return (
      <div className="space-y-8 p-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-10 pr-1 pb-8">
        {/* Page Title */}
        <div className="pt-2">
          <SectionHeader
            title="Import Leads"
            subtitle="Upload CSV or Excel files to import leads into your pipeline"
          />
        </div>

        {/* Stat Cards */}
        <StaggerGrid className="grid grid-cols-3 gap-4" stagger={0.1}>
          <StaggerItem>
            <StatCard
              label="Total Imports"
              value={stats.totalImports}
              icon={Database}
              color="#D4AF37"
              delay={0}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Total Rows"
              value={stats.totalRows}
              icon={Rows3}
              color="#3B82F6"
              delay={0.1}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Total Accepted"
              value={stats.totalAccepted}
              icon={CheckCircle}
              color="#10B981"
              delay={0.2}
            />
          </StaggerItem>
        </StaggerGrid>

        {/* Upload Area - GlassPanel with animated gradient border */}
        <div>
          <SectionHeader
            title="Upload File"
            subtitle="Drag and drop your file or click to browse"
          />
          <motion.div
            className="relative rounded-2xl p-[2px] overflow-hidden"
            animate={
              dragOver
                ? {
                    boxShadow: [
                      '0 0 20px rgba(212,175,55,0.3), 0 0 60px rgba(212,175,55,0.1)',
                      '0 0 30px rgba(212,175,55,0.5), 0 0 80px rgba(212,175,55,0.2)',
                      '0 0 20px rgba(212,175,55,0.3), 0 0 60px rgba(212,175,55,0.1)',
                    ],
                  }
                : {}
            }
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.div
              className="absolute inset-0 rounded-2xl"
              animate={{
                background: dragOver
                  ? [
                      'linear-gradient(135deg, rgba(212,175,55,0.8), rgba(59,130,246,0.6), rgba(16,185,129,0.6), rgba(212,175,55,0.8))',
                      'linear-gradient(225deg, rgba(212,175,55,0.8), rgba(59,130,246,0.6), rgba(16,185,129,0.6), rgba(212,175,55,0.8))',
                      'linear-gradient(315deg, rgba(212,175,55,0.8), rgba(59,130,246,0.6), rgba(16,185,129,0.6), rgba(212,175,55,0.8))',
                      'linear-gradient(135deg, rgba(212,175,55,0.8), rgba(59,130,246,0.6), rgba(16,185,129,0.6), rgba(212,175,55,0.8))',
                    ]
                  : [
                      'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.05), rgba(59,130,246,0.08), transparent 70%)',
                      'linear-gradient(225deg, rgba(59,130,246,0.15), rgba(212,175,55,0.25), rgba(212,175,55,0.05), transparent 70%)',
                      'linear-gradient(315deg, rgba(16,185,129,0.1), rgba(59,130,246,0.15), rgba(212,175,55,0.25), transparent 70%)',
                      'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.05), rgba(59,130,246,0.08), transparent 70%)',
                    ],
              }}
              transition={{
                duration: dragOver ? 2 : 6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(0, 0, 0, 0.05) 50%, transparent 60%)',
                backgroundSize: '200% 100%',
              }}
              animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
            />
            <GlassPanel className="relative z-10 rounded-[14px]">
              <div className="p-8">

                {/* L-12 & L-15: Consent Source + Lead Source dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Consent Source (L-12)</Label>
                    <Select value={consentSource} onValueChange={setConsentSource}>
                      <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200 text-foreground focus:border-primary/30">
                        <SelectValue placeholder="Select consent source" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        {CONSENT_SOURCES.map(s => (
                          <SelectItem key={s.value} value={s.value} className="text-xs text-foreground focus:bg-gray-100">{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Lead Source (L-15)</Label>
                    <Select value={leadSource} onValueChange={setLeadSource}>
                      <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200 text-foreground focus:border-primary/30">
                        <SelectValue placeholder="Select lead source" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        {LEAD_SOURCES.map(s => (
                          <SelectItem key={s.value} value={s.value} className="text-xs text-foreground focus:bg-gray-100">{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <motion.div
                  className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 transition-all duration-300 cursor-pointer ${
                    dragOver
                      ? 'border-primary/80 bg-primary/[0.06] scale-[1.01]'
                      : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  whileTap={{ scale: 0.99 }}
                >
                  {(uploading || isProcessing) ? (
                    <motion.div
                      className="relative w-14 h-14"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <div className="absolute inset-0 rounded-full border-[3px] border-primary/30" />
                      <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary" />
                      <div className="absolute inset-2 rounded-full border-[3px] border-transparent border-b-amber-400" style={{ animationDirection: 'reverse' }} />
                    </motion.div>
                  ) : (
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center"
                      animate={
                        dragOver
                          ? { scale: [1, 1.1, 1], boxShadow: ['0 0 0px rgba(212,175,55,0)', '0 0 30px rgba(212,175,55,0.3)', '0 0 0px rgba(212,175,55,0)'] }
                          : {}
                      }
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <Upload className="w-7 h-7 text-primary" />
                    </motion.div>
                  )}
                  <div className="text-center">
                    <p className="text-base font-semibold text-foreground">
                      {isProcessing ? (
                        <ShimmerText>Processing large file...</ShimmerText>
                      ) : uploading ? (
                        <ShimmerText>Processing file...</ShimmerText>
                      ) : selectedFile ? (
                        <span className="text-primary">{selectedFile.name}</span>
                      ) : (
                        'Upload CSV or Excel'
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                      {isProcessing
                        ? 'Processing in background — you can navigate away'
                        : uploading
                          ? 'Parsing rows, detecting duplicates, scoring leads...'
                          : selectedFile
                            ? `${formatFileSize(selectedFile.size)} — Click or drop to re-upload`
                            : 'Drag and drop or click to browse. Supports .csv, .xlsx, .xls (max 25MB)'}
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </motion.div>
              </div>
            </GlassPanel>
          </motion.div>
        </div>

        {/* L-09: Progress Bar for Large Files */}
        <AnimatePresence>
          {isProcessing && progress && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <GlassPanel className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Processing Import</p>
                      <p className="text-xs text-muted-foreground">{progress.processedRows.toLocaleString()} / {progress.totalRows.toLocaleString()} rows processed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-primary/15 border-primary/25 text-primary text-xs">
                      {progress.percentComplete}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-red-600 hover:text-red-600 hover:bg-red-50"
                      onClick={() => activeBatchId && cancelBatch(activeBatchId)}
                    >
                      <StopCircle className="w-3.5 h-3.5 mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
                <AnimatedBar value={progress.percentComplete} max={100} color="#D4AF37" />
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{progress.acceptedRows}</p>
                    <p className="text-[10px] text-emerald-600 uppercase tracking-wider">Accepted</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{progress.duplicateRows}</p>
                    <p className="text-[10px] text-amber-600 uppercase tracking-wider">Duplicates</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{progress.invalidRows}</p>
                    <p className="text-[10px] text-red-600 uppercase tracking-wider">Invalid</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{formatEta(progress.eta)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ETA</p>
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Result Banner */}
        <AnimatePresence>
          {uploadResult && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative rounded-2xl p-[1px] overflow-hidden">
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: uploadResult.success
                      ? 'linear-gradient(135deg, rgba(16,185,129,0.6), rgba(16,185,129,0.1), rgba(212,175,55,0.2))'
                      : 'linear-gradient(135deg, rgba(239,68,68,0.6), rgba(239,68,68,0.1), rgba(239,68,68,0.2))',
                    boxShadow: uploadResult.success
                      ? '0 0 20px rgba(16,185,129,0.15), inset 0 0 20px rgba(16,185,129,0.05)'
                      : '0 0 20px rgba(239,68,68,0.15), inset 0 0 20px rgba(239,68,68,0.05)',
                  }}
                />
                <GlassPanel
                  className={`relative z-10 rounded-[14px] ${
                    uploadResult.success ? 'bg-emerald-500/[0.06]' : 'bg-red-500/[0.06]'
                  }`}
                >
                  <div className="flex items-start gap-4 p-5">
                    {uploadResult.success ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                        className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0"
                        style={{ boxShadow: '0 0 16px rgba(16,185,129,0.2)' }}
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                        className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0"
                        style={{ boxShadow: '0 0 16px rgba(239,68,68,0.2)' }}
                      >
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      </motion.div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${uploadResult.success ? 'text-emerald-700' : 'text-red-600'}`}>
                        {uploadResult.success ? 'Import Complete' : 'Import Failed'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{uploadResult.message}</p>
                      {uploadResult.details && (
                        <div className="flex gap-6 mt-3">
                          <span className="text-sm text-muted-foreground">Total: <span className="text-foreground font-semibold tabular-nums">{uploadResult.details.total}</span></span>
                          <span className="text-sm text-muted-foreground">Accepted: <span className="text-emerald-600 font-semibold tabular-nums">{uploadResult.details.accepted}</span></span>
                          <span className="text-sm text-muted-foreground">Duplicates: <span className="text-amber-600 font-semibold tabular-nums">{uploadResult.details.duplicates}</span></span>
                          <span className="text-sm text-muted-foreground">Invalid: <span className="text-red-600 font-semibold tabular-nums">{uploadResult.details.invalid}</span></span>
                        </div>
                      )}
                      {uploadResult.success && navigateTo && (
                        <motion.span
                          onClick={() => navigateTo('leads')}
                          className="inline-block mt-3 text-sm text-primary cursor-pointer hover:text-primary/80 transition-colors font-medium"
                          whileHover={{ x: 2 }}
                        >
                          View imported leads &rarr;
                        </motion.span>
                      )}
                    </div>
                    <button onClick={() => setUploadResult(null)} className="text-muted-foreground hover:text-foreground shrink-0 mt-1 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </GlassPanel>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Batch History */}
        <div>
          <SectionHeader
            title="Import History"
            subtitle={`${batches.length} import${batches.length !== 1 ? 's' : ''} recorded`}
          />
          <GlassPanel className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Filename</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Total</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Accepted</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Duplicates</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Invalid</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Date</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b, i) => (
                    <motion.tr
                      key={b.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                      className="border-gray-200 group transition-colors duration-200 hover:bg-gray-50"
                    >
                      <TableCell className="text-foreground text-sm font-medium max-w-[180px] truncate">
                        <div className="flex items-center gap-2">
                          {b.status === 'processing' ? (
                            <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                          ) : (
                            <FileSpreadsheet className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                          )}
                          <span className="truncate">{b.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm text-right tabular-nums group-hover:text-foreground/80 transition-colors">{b.totalRows}</TableCell>
                      <TableCell className="text-foreground text-sm text-right tabular-nums font-medium">{b.acceptedRows}</TableCell>
                      <TableCell className="text-amber-600 text-sm text-right tabular-nums">{b.duplicateRows}</TableCell>
                      <TableCell className="text-red-600 text-sm text-right tabular-nums">{b.invalidRows}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[b.status] || STATUS_COLORS.draft}>
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs text-right whitespace-nowrap group-hover:text-foreground/60 transition-colors">{b.createdAt}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary/80 hover:bg-primary/10" onClick={() => setSelectedBatch(b)}>
                            <Eye className="w-3.5 h-3.5 mr-1" />View
                          </Button>
                          {navigateTo && b.acceptedRows > 0 && (
                            <span
                              onClick={(e) => { e.stopPropagation(); navigateTo('leads'); }}
                              className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
                            >
                              View Leads
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                  {batches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="p-0">
                        <EmptyState
                          icon={Inbox}
                          title="No imports yet"
                          description="Upload a file to get started. Your import history will appear here."
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </GlassPanel>
        </div>

        {/* Batch Detail Dialog */}
        <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
          <DialogContent className="bg-card/95 backdrop-blur-xl border border-gray-200 text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  Batch Details
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedBatch(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            {selectedBatch && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Filename</p>
                    <p className="text-foreground font-medium">{selectedBatch.fileName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Status</p>
                    <Badge variant="outline" className={STATUS_COLORS[selectedBatch.status] || STATUS_COLORS.draft}>{selectedBatch.status}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Total Rows</p>
                    <p className="text-foreground font-medium tabular-nums text-lg">{selectedBatch.totalRows}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Accepted</p>
                    <p className="text-emerald-600 font-medium tabular-nums text-lg">{selectedBatch.acceptedRows}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Duplicates</p>
                    <p className="text-amber-600 font-medium tabular-nums text-lg">{selectedBatch.duplicateRows}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Invalid</p>
                    <p className="text-red-600 font-medium tabular-nums text-lg">{selectedBatch.invalidRows}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-muted-foreground">Imported: {selectedBatch.createdAt}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══ L-08: Preview & Map Dialog ═══ */}
        <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) setPreviewOpen(false); }}>
          <DialogContent className="bg-card/95 backdrop-blur-xl border-gray-200 text-foreground max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                Preview & Map Columns
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] ml-2">
                  {previewData?.totalRows || 0} rows
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Review AI-detected column mapping before importing {previewData?.fileName || ''}
              </DialogDescription>
            </DialogHeader>
            {previewLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : previewData ? (
              <>
              <div className="flex flex-col lg:flex-row gap-4 min-h-0">
                {/* Left: Column Mapping */}
                <div className="lg:w-1/2 space-y-3 border-r border-gray-200 pr-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Column Mapping</p>
                    <Button
                      variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-primary gap-1"
                      onClick={handleAutoDetect}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Auto-detect
                    </Button>
                  </div>
                  <ScrollArea className="max-h-[55vh]">
                    <div className="space-y-2 pr-2">
                      {previewData.headers.map((header, i) => (
                        <div key={header} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-5 text-right tabular-nums">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{header}</p>
                            <p className="text-[10px] text-muted-foreground/60 truncate">
                              {previewData.previewRows[0]?.[header] as string || '—'}
                            </p>
                          </div>
                          <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                          <select
                            value={customMapping[header] || '— skip —'}
                            onChange={(e) => setCustomMapping(prev => ({ ...prev, [header]: e.target.value }))}
                            className="h-7 text-[11px] bg-gray-100/50 border border-gray-200 text-foreground rounded-md px-2 flex-1 max-w-[140px] focus:outline-none focus:ring-1 focus:ring-primary/30"
                          >
                            {previewData.availableFields.map(field => (
                              <option key={field} value={field}>{field === '— skip —' ? '— skip —' : field}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                {/* Right: Preview Rows */}
                <div className="lg:w-1/2 space-y-3">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Preview Data (first {previewData.previewRows.length} rows)
                  </p>
                  <ScrollArea className="max-h-[55vh]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-200 hover:bg-transparent">
                          {previewData.headers.map(h => (
                            <TableHead key={h} className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-8 whitespace-nowrap">
                              <span className="truncate max-w-[100px] block">{h}</span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.previewRows.map((row, ri) => (
                          <TableRow key={ri} className="border-gray-200 hover:bg-transparent">
                            {previewData.headers.map(h => (
                              <TableCell key={h} className="text-[10px] text-muted-foreground py-2 whitespace-nowrap">
                                <span className="truncate max-w-[100px] block">{String(row[h] || '')}</span>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
              {/* Import Button */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                <Button
                  variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                  onClick={() => setPreviewOpen(false)}
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </Button>
                <Button
                  className="h-9 gap-2 text-xs font-medium"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
                  onClick={handleImportWithMapping}
                  disabled={importingWithMapping}
                >
                  {importingWithMapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  Import with Mapping
                </Button>
              </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}