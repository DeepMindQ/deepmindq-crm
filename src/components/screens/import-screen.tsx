'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  PageTransition,
  AnimatedCard,
  SectionHeader,
  StatCard,
  StaggerGrid,
  StaggerItem,
  GlassPanel,
  EmptyState,
  AnimatedBar,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload, X, CheckCircle2, AlertCircle, Loader2, ChevronRight,
  RotateCcw, FileSpreadsheet, Database, Shield, Sparkles, Eye,
  ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, XCircle,
  Copy, ClipboardList, Trash2, History, BarChart3, Zap, Download,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Props ──
interface ImportScreenProps {
  navigateTo?: (screen: string) => void;
}

// ── Target field options ──
const TARGET_FIELDS = [
  'name', 'email', 'company', 'title', 'phone', 'linkedin',
  'location', 'country', 'industry', 'size', 'website', 'domain',
  'revenue', 'funding', 'state', 'zip', 'address',
] as const;

const TARGET_LABELS: Record<string, string> = {
  name: 'Contact Name',
  email: 'Email',
  company: 'Company Name',
  title: 'Job Title',
  phone: 'Phone',
  linkedin: 'LinkedIn URL',
  location: 'City / Location',
  country: 'Country',
  industry: 'Industry',
  size: 'Employee Size',
  website: 'Website',
  domain: 'Domain',
  revenue: 'Revenue',
  funding: 'Funding Stage',
  state: 'State / Province',
  zip: 'ZIP / Postal Code',
  address: 'Address',
};

// ── Types ──
type Step = 'upload' | 'processing' | 'review' | 'complete';

interface AnalyzeResult {
  headers: string[];
  mapping: Record<string, string>;
  unmatchedHeaders: string[];
  confidence: number;
  previewRows: Record<string, unknown>[];
  totalRows: number;
  fileName: string;
}

interface ProgressData {
  id: string;
  status: string;
  totalRows: number;
  processedRows: number;
  acceptedRows: number;
  warningRows: number;
  failedRows: number;
  duplicateRows: number;
  dataQualityScore: number | null;
  percentComplete: number;
}

interface ValidationIssue {
  field: string;
  ruleId: string;
  ruleName: string;
  severity: 'error' | 'warning';
  message: string;
}

interface SuggestedCorrection {
  field: string;
  original: string;
  suggested: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

interface ReviewRow {
  id: string;
  rowIndex: number;
  rawData: Record<string, unknown>;
  mappedData: Record<string, unknown> | null;
  normalizedData: Record<string, unknown> | null;
  validationIssues: ValidationIssue[];
  suggestedCorrections: SuggestedCorrection[];
  status: string;
  qualityScore: number;
  duplicateOfRow: number | null;
}

interface ReviewSummary {
  uploadId: string;
  fileName: string;
  totalRows: number;
  acceptedRows: number;
  warningRows: number;
  failedRows: number;
  duplicateRows: number;
  dataQualityScore: number;
  qualityDistribution: { excellent: number; good: number; fair: number; poor: number };
  status: string;
}

interface CommitResult {
  companiesCreated: number;
  contactsCreated: number;
  batchId: string;
}

interface RecentUpload {
  id: string;
  fileName: string;
  totalRows: number;
  processedRows: number;
  acceptedRows: number;
  warningRows: number;
  failedRows: number;
  duplicateRows: number;
  status: string;
  dataQualityScore: number | null;
  createdAt: string;
}

interface CorrectionItem {
  rowId: string;
  field: string;
  appliedValue: string;
}

// ── Status config ──
const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof CheckCircle }> = {
  accepted: { color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle },
  warning: { color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle },
  failed: { color: 'text-red-600', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle },
  duplicate: { color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/20', icon: Copy },
  corrected: { color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: CheckCircle2 },
};

const STEP_LABELS: Record<Step, string> = {
  upload: 'Upload & Analyze',
  processing: 'Process Data',
  review: 'Review & Correct',
  complete: 'Import Complete',
};

// ── Component ──
export default function ImportScreen({ navigateTo }: ImportScreenProps) {
  // ── Step state ──
  const [step, setStep] = useState<Step>('upload');

  // ── Step 1: Upload & Analyze ──
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allRows, setAllRows] = useState<Record<string, unknown>[]>([]);
  const [consentSource, setConsentSource] = useState('manual_upload');
  const [leadSource, setLeadSource] = useState('manual');

  // ── Step 2: Processing ──
  const [uploadId, setUploadId] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const progressPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Step 3: Review ──
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewPages, setReviewPages] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewFilter, setReviewFilter] = useState<string>('all');
  const [correctionsBuffer, setCorrectionsBuffer] = useState<CorrectionItem[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [committing, setCommitting] = useState(false);

  // ── Step 4: Complete ──
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  // ── Recent uploads sidebar ──
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // ── Step indicators ──
  const stepOrder: Step[] = ['upload', 'processing', 'review', 'complete'];
  const stepIndex = stepOrder.indexOf(step);

  // ── Load recent uploads on mount ──
  useEffect(() => {
    loadRecentUploads();
  }, []);

  // Auto-seed default rules if none exist
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/config/column-rules');
        if (res.ok) {
          const rules = await res.json();
          if (!Array.isArray(rules) || rules.length === 0) {
            await fetch('/api/config/seed', { method: 'POST' });
          }
        }
      } catch { /* silent — rules may already exist */ }
    })();
  }, []);

  const loadRecentUploads = async () => {
    try {
      const res = await fetch('/api/uploads');
      if (res.ok) {
        const data = await res.json();
        setRecentUploads(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    }
  };

  // ── Cleanup polling on unmount ──
  useEffect(() => {
    return () => {
      if (progressPollRef.current) {
        clearInterval(progressPollRef.current);
      }
    };
  }, []);

  // ─────────────────────────────────────────────────
  // STEP 1: Upload & Analyze
  // ─────────────────────────────────────────────────

  const handleFileSelect = useCallback((selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Unsupported file format', { description: 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)' });
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum file size is 50MB' });
      return;
    }
    setFile(selectedFile);
    setAnalysis(null);
    setMapping({});
    handleAnalyze(selectedFile);
  }, []);

  const handleAnalyze = async (selectedFile: File) => {
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch('/api/upload/analyze', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || 'Analysis failed');
      }
      const data: AnalyzeResult = await res.json();
      setAnalysis(data);
      setMapping(data.mapping);
      toast.success('File analyzed', {
        description: `Detected ${data.headers.length} columns, ${data.totalRows.toLocaleString()} rows`,
      });
    } catch (err: any) {
      toast.error('Analysis failed', { description: err.message });
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMappingChange = (sourceHeader: string, targetField: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (targetField === '__skip__') {
        delete next[sourceHeader];
      } else {
        // Remove any existing mapping to this target
        for (const [k, v] of Object.entries(next)) {
          if (v === targetField && k !== sourceHeader) {
            delete next[k];
          }
        }
        next[sourceHeader] = targetField;
      }
      return next;
    });
  };

  const handleProceedToProcess = async () => {
    if (!file || !analysis) return;

    try {
      // Parse file client-side for all rows
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      setAllRows(rows);

      // Build clean mapping (only non-skipped)
      const cleanMapping: Record<string, string> = {};
      for (const [header, field] of Object.entries(mapping)) {
        if (field && field !== '__skip__') {
          cleanMapping[header] = field;
        }
      }

      // Create upload job
      const createRes = await fetch('/api/upload/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          totalRows: rows.length,
          columnMapping: cleanMapping,
          consentSource,
          leadSource,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error || err.detail || 'Failed to create upload job');
      }
      const createData = await createRes.json();
      const newUploadId = createData.uploadId;
      setUploadId(newUploadId);
      setStep('processing');

      // Start chunk processing
      await processAllChunks(newUploadId, rows);
    } catch (err: any) {
      toast.error('Failed to start processing', { description: err.message });
    }
  };

  // ─────────────────────────────────────────────────
  // STEP 2: Process Data (chunked)
  // ─────────────────────────────────────────────────

  const processAllChunks = async (uid: string, rows: Record<string, unknown>[]) => {
    setProcessing(true);
    const CHUNK_SIZE = 300;
    let currentRow = 0;

    // Start progress polling
    progressPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/upload/${uid}/progress`);
        if (res.ok) {
          const data: ProgressData = await res.json();
          setProgress(data);
          if (data.status === 'review_ready') {
            if (progressPollRef.current) clearInterval(progressPollRef.current);
          }
        }
      } catch {
        // poll silently
      }
    }, 2000);

    try {
      while (currentRow < rows.length) {
        const chunk = rows.slice(currentRow, currentRow + CHUNK_SIZE);
        const res = await fetch(`/api/upload/${uid}/process-chunk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk, startRowIndex: currentRow }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.detail || 'Chunk processing failed');
        }

        currentRow += chunk.length;

        // Update local progress immediately
        setProgress(prev => prev ? {
          ...prev,
          processedRows: Math.min(currentRow, prev.totalRows),
          percentComplete: Math.round((Math.min(currentRow, prev.totalRows) / prev.totalRows) * 100),
        } : null);
      }

      // Final poll to get accurate counts
      if (progressPollRef.current) clearInterval(progressPollRef.current);
      const finalRes = await fetch(`/api/upload/${uid}/progress`);
      if (finalRes.ok) {
        const finalData: ProgressData = await finalRes.json();
        setProgress(finalData);
        if (finalData.status === 'review_ready') {
          // Brief pause then auto-advance
          setTimeout(() => {
            setStep('review');
            loadReviewData(uid);
          }, 800);
        }
      }
    } catch (err: any) {
      if (progressPollRef.current) clearInterval(progressPollRef.current);
      toast.error('Processing failed', { description: err.message });
      setProcessing(false);
    } finally {
      setProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────
  // STEP 3: Review & Correct
  // ─────────────────────────────────────────────────

  const loadReviewData = async (uid?: string) => {
    const id = uid || uploadId;
    if (!id) return;
    setLoadingReview(true);
    try {
      const res = await fetch(
        `/api/upload/${id}/review?filter=${reviewFilter}&page=${reviewPage}&pageSize=50`
      );
      if (!res.ok) throw new Error('Failed to load review data');
      const data = await res.json();
      setReviewSummary(data.summary);
      setReviewRows(data.rows || []);
      setReviewTotal(data.total || 0);
      setReviewPages(data.pages || 1);
    } catch (err: any) {
      toast.error('Failed to load review', { description: err.message });
    } finally {
      setLoadingReview(false);
    }
  };

  // Reload review when filter or page changes
  useEffect(() => {
    if (step === 'review' && uploadId) {
      setCorrectionsBuffer([]);
      loadReviewData();
    }
  }, [reviewFilter, reviewPage, step, uploadId]);

  const addCorrection = (rowId: string, correction: SuggestedCorrection) => {
    setCorrectionsBuffer(prev => {
      // Check if already in buffer
      const exists = prev.find(
        c => c.rowId === rowId && c.field === correction.field
      );
      if (exists) {
        return prev.map(c =>
          c.rowId === rowId && c.field === correction.field
            ? { ...c, appliedValue: correction.suggested }
            : c
        );
      }
      return [...prev, { rowId, field: correction.field, appliedValue: correction.suggested }];
    });
  };

  const removeCorrection = (rowId: string, field: string) => {
    setCorrectionsBuffer(prev => prev.filter(c => !(c.rowId === rowId && c.field === field)));
  };

  const isCorrectionApplied = (rowId: string, field: string) => {
    return correctionsBuffer.some(c => c.rowId === rowId && c.field === field);
  };

  const handleApplyAllSuggestions = () => {
    const allCorrections: CorrectionItem[] = [];
    for (const row of reviewRows) {
      if (row.status === 'warning' && row.suggestedCorrections) {
        for (const corr of row.suggestedCorrections) {
          allCorrections.push({ rowId: row.id, field: corr.field, appliedValue: corr.suggested });
        }
      }
    }
    setCorrectionsBuffer(prev => {
      const merged = new Map<string, CorrectionItem>();
      for (const c of prev) merged.set(`${c.rowId}:${c.field}`, c);
      for (const c of allCorrections) merged.set(`${c.rowId}:${c.field}`, c);
      return Array.from(merged.values());
    });
    toast.success('All suggestions queued', {
      description: `${allCorrections.length} corrections will be applied on commit`,
    });
  };

  const handleCommit = async () => {
    if (!uploadId) return;
    setCommitting(true);
    try {
      // Apply corrections first if any
      if (correctionsBuffer.length > 0) {
        const corrRes = await fetch(`/api/upload/${uploadId}/apply-corrections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ corrections: correctionsBuffer }),
        });
        if (!corrRes.ok) {
          const err = await corrRes.json().catch(() => ({}));
          throw new Error(err.error || err.detail || 'Failed to apply corrections');
        }
        const corrData = await corrRes.json();
        toast.success(`Applied ${corrData.updated} corrections`);
      }

      // Commit accepted records
      const commitRes = await fetch(`/api/upload/${uploadId}/commit`, {
        method: 'POST',
      });
      if (!commitRes.ok) {
        const err = await commitRes.json().catch(() => ({}));
        if (commitRes.status === 409) {
          toast.warning('Already committed', { description: 'This upload has already been committed' });
          setStep('complete');
          return;
        }
        throw new Error(err.error || err.detail || 'Commit failed');
      }
      const result: CommitResult = await commitRes.json();
      setCommitResult(result);
      setStep('complete');
      toast.success('Import committed successfully', {
        description: `${result.companiesCreated} companies, ${result.contactsCreated} contacts created`,
      });
      loadRecentUploads();
    } catch (err: any) {
      toast.error('Commit failed', { description: err.message });
    } finally {
      setCommitting(false);
    }
  };

  const handleCancel = async () => {
    if (!uploadId) return;
    try {
      await fetch(`/api/upload/${uploadId}/cancel`, { method: 'POST' });
      toast.success('Upload cancelled');
      resetAll();
    } catch {
      toast.error('Failed to cancel upload');
    }
  };

  const resetAll = () => {
    if (progressPollRef.current) clearInterval(progressPollRef.current);
    setStep('upload');
    setFile(null);
    setAnalysis(null);
    setMapping({});
    setAllRows([]);
    setUploadId('');
    setProcessing(false);
    setProgress(null);
    setReviewSummary(null);
    setReviewRows([]);
    setReviewTotal(0);
    setReviewPages(1);
    setReviewPage(1);
    setReviewFilter('all');
    setCorrectionsBuffer([]);
    setHasReviewed(false);
    setCommitting(false);
    setCommitResult(null);
  };

  const acceptedCount = reviewSummary
    ? reviewSummary.acceptedRows + correctionsBuffer.length
    : (progress?.acceptedRows || 0);

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────

  return (
    <PageTransition className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)' }}
          >
            <Database className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Data Import</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered data intelligence for enterprise contact imports
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step !== 'upload' && step !== 'complete' && (
            <Button
              variant="ghost" size="sm"
              className="text-muted-foreground hover:text-foreground gap-1.5"
              onClick={handleCancel}
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </Button>
          )}
          {step === 'complete' && (
            <Button
              variant="ghost" size="sm"
              className="text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => navigateTo?.('companies')}
            >
              <Eye className="w-4 h-4" />
              View Companies
            </Button>
          )}
          <Button
            variant="ghost" size="sm"
            className="text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="w-4 h-4" />
            History
          </Button>
        </div>
      </div>

      {/* ── Step Indicator ── */}
      <div className="flex items-center gap-1">
        {stepOrder.map((s, i) => {
          const isActive = s === step;
          const isComplete = i < stepIndex;
          return (
            <div key={s} className="flex items-center flex-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <motion.div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{
                    background: isComplete
                      ? 'linear-gradient(135deg, #D4AF37, #E8C860)'
                      : isActive
                        ? 'linear-gradient(135deg, #D4AF37, #E8C860)'
                        : 'bg-gray-200',
                    color: isComplete || isActive ? '#000' : '#9CA3AF',
                  }}
                  animate={{ scale: isActive ? 1.1 : 1 }}
                >
                  {isComplete ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </motion.div>
                <span
                  className={`text-xs font-medium truncate hidden sm:block ${
                    isActive ? 'text-foreground' : isComplete ? 'text-muted-foreground' : 'text-gray-400'
                  }`}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < stepOrder.length - 1 && (
                <div
                  className={`h-px w-8 sm:w-12 mx-1 shrink-0 transition-colors ${
                    i < stepIndex ? 'bg-[#D4AF37]' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Recent Uploads History Dialog ── */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#D4AF37]" />
              Recent Uploads
            </DialogTitle>
            <DialogDescription>Your recent data import history</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            {recentUploads.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No uploads yet"
                description="Upload your first file to get started"
              />
            ) : (
              <div className="space-y-2 pt-2">
                {recentUploads.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.totalRows.toLocaleString()} rows &middot; {new Date(u.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        u.status === 'completed'
                          ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'
                          : u.status === 'review_ready'
                            ? 'border-amber-500/30 text-amber-600 bg-amber-500/5'
                            : u.status === 'failed'
                              ? 'border-red-500/30 text-red-600 bg-red-500/5'
                              : 'border-gray-300 text-muted-foreground'
                      }
                    >
                      {u.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
          STEP 1: Upload & Analyze
          ═══════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Upload Zone */}
            {!analysis && !analyzing && (
              <AnimatedCard hover={false}>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-10 sm:p-16 text-center transition-all cursor-pointer ${
                    dragOver
                      ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                      : 'border-gray-300 hover:border-[#D4AF37]/50 hover:bg-gray-50/50'
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
                  <motion.div
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))' }}
                    animate={dragOver ? { scale: 1.1 } : { scale: 1 }}
                  >
                    <Upload className="w-8 h-8 text-[#D4AF37]" />
                  </motion.div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    Drop your file here, or click to browse
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Supports CSV, XLSX, XLS &middot; Max 50MB
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI column detection &amp; mapping
                  </div>
                </div>
              </AnimatedCard>
            )}

            {/* Analyzing skeleton */}
            {analyzing && (
              <AnimatedCard hover={false}>
                <div className="p-8 space-y-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                    <div>
                      <p className="font-medium text-foreground">Analyzing file...</p>
                      <p className="text-sm text-muted-foreground">Detecting columns, suggesting mappings</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </AnimatedCard>
            )}

            {/* Analysis Results & Mapping */}
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* File info & confidence */}
                <StaggerGrid className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StaggerItem>
                    <StatCard
                      label="File"
                      value={analysis.fileName}
                      icon={FileSpreadsheet}
                      color="#D4AF37"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <StatCard
                      label="Total Rows"
                      value={analysis.totalRows.toLocaleString()}
                      icon={Database}
                      color="#D4AF37"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <StatCard
                      label="Columns Found"
                      value={analysis.headers.length}
                      icon={BarChart3}
                      color="#D4AF37"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <StatCard
                      label="Confidence"
                      value={`${Math.round(analysis.confidence * 100)}%`}
                      icon={Shield}
                      color={analysis.confidence >= 0.8 ? '#10B981' : analysis.confidence >= 0.5 ? '#F59E0B' : '#EF4444'}
                    />
                  </StaggerItem>
                </StaggerGrid>

                {/* Column Mapping Table */}
                <GlassPanel>
                  <div className="p-4 border-b border-gray-100">
                    <SectionHeader
                      title="Column Mapping"
                      subtitle="Map your file columns to the target fields. Adjust any auto-detected mappings."
                    />
                  </div>
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-100 hover:bg-transparent">
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Source Column
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Target Field
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                            Sample Data
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.headers.map((header, idx) => {
                          const targetField = mapping[header] || '__skip__';
                          const isMatched = targetField !== '__skip__' && !!analysis.mapping[header] && analysis.mapping[header] === targetField;
                          const isUnmatched = analysis.unmatchedHeaders.includes(header);
                          return (
                            <TableRow key={header} className="border-gray-100 hover:bg-gray-50/50">
                              <TableCell className="py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">{header}</span>
                                  {isUnmatched && (
                                    <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/5 text-[10px] px-1.5 py-0">
                                      unmatched
                                    </Badge>
                                  )}
                                  {isMatched && (
                                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/5 text-[10px] px-1.5 py-0">
                                      auto
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <Select
                                  value={targetField}
                                  onValueChange={(val) => handleMappingChange(header, val)}
                                >
                                  <SelectTrigger className="w-[180px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TARGET_FIELDS.map(field => (
                                      <SelectItem key={field} value={field}>
                                        {TARGET_LABELS[field] || field}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value="__skip__">— skip —</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-3 hidden sm:table-cell">
                                <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                                  {String(analysis.previewRows[0]?.[header] || '—')}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </GlassPanel>

                {/* Preview Rows */}
                <GlassPanel>
                  <div className="p-4 border-b border-gray-100">
                    <SectionHeader
                      title="Preview (First 5 Rows)"
                      subtitle="Verify your data looks correct before processing"
                    />
                  </div>
                  <ScrollArea className="max-h-[240px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-100 hover:bg-transparent">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-10">
                            #
                          </TableHead>
                          {analysis.headers.map(h => (
                            <TableHead key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.previewRows.map((row, ri) => (
                          <TableRow key={ri} className="border-gray-100 hover:bg-transparent">
                            <TableCell className="text-[10px] text-muted-foreground py-1.5">
                              {ri + 1}
                            </TableCell>
                            {analysis.headers.map(h => (
                              <TableCell key={h} className="text-[11px] text-muted-foreground py-1.5 whitespace-nowrap max-w-[150px]">
                                <span className="truncate block">{String(row[h] || '')}</span>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </GlassPanel>

                {/* Metadata & Actions */}
                <GlassPanel>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Consent Source</Label>
                        <Select value={consentSource} onValueChange={setConsentSource}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual_upload">Manual Upload</SelectItem>
                            <SelectItem value="web_form">Web Form</SelectItem>
                            <SelectItem value="event">Event / Trade Show</SelectItem>
                            <SelectItem value="purchased">Purchased List</SelectItem>
                            <SelectItem value="partner">Partner Referral</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Lead Source</Label>
                        <Select value={leadSource} onValueChange={setLeadSource}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="csv_import">CSV Import</SelectItem>
                            <SelectItem value="api">API</SelectItem>
                            <SelectItem value="integration">Integration</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <Button
                        variant="ghost" size="sm"
                        className="text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={() => { setAnalysis(null); setFile(null); setMapping({}); }}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Start Over
                      </Button>
                      <Button
                        className="gap-2 font-medium"
                        style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
                        onClick={handleProceedToProcess}
                        disabled={Object.keys(mapping).length === 0}
                      >
                        Next: Process Data
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════
            STEP 2: Process Data
            ═══════════════════════════════════════════════ */}
        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <GlassPanel>
              <div className="p-6 sm:p-8 space-y-6">
                {/* Processing header */}
                <div className="text-center space-y-2">
                  <motion.div
                    className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))' }}
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="w-8 h-8 text-[#D4AF37]" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground">Processing Your Data</h2>
                  <p className="text-sm text-muted-foreground">
                    {progress
                      ? `Processing row ${progress.processedRows.toLocaleString()} of ${progress.totalRows.toLocaleString()}...`
                      : 'Initializing...'}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-bold tabular-nums" style={{ color: '#D4AF37' }}>
                      {progress?.percentComplete || 0}%
                    </span>
                  </div>
                  <AnimatedBar
                    value={progress?.processedRows || 0}
                    max={progress?.totalRows || 1}
                    color="#D4AF37"
                  />
                </div>

                {/* Live counters */}
                {progress && (
                  <StaggerGrid className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                    <StaggerItem>
                      <div className="text-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <p className="text-2xl font-bold text-emerald-600 tabular-nums">
                          {progress.acceptedRows.toLocaleString()}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600/70 mt-1">
                          Accepted
                        </p>
                      </div>
                    </StaggerItem>
                    <StaggerItem>
                      <div className="text-center p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <p className="text-2xl font-bold text-amber-600 tabular-nums">
                          {progress.warningRows.toLocaleString()}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600/70 mt-1">
                          Warnings
                        </p>
                      </div>
                    </StaggerItem>
                    <StaggerItem>
                      <div className="text-center p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                        <p className="text-2xl font-bold text-red-600 tabular-nums">
                          {progress.failedRows.toLocaleString()}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-red-600/70 mt-1">
                          Failed
                        </p>
                      </div>
                    </StaggerItem>
                    <StaggerItem>
                      <div className="text-center p-3 rounded-lg bg-gray-500/5 border border-gray-500/10">
                        <p className="text-2xl font-bold text-gray-500 tabular-nums">
                          {progress.duplicateRows.toLocaleString()}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500/70 mt-1">
                          Duplicates
                        </p>
                      </div>
                    </StaggerItem>
                    <StaggerItem>
                      <div className="text-center p-3 rounded-lg bg-[#D4AF37]/5 border border-[#D4AF37]/10">
                        <p className="text-2xl font-bold tabular-nums" style={{ color: '#D4AF37' }}>
                          {progress.dataQualityScore != null ? Math.round(progress.dataQualityScore) : '—'}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: 'rgba(212,175,55,0.7)' }}>
                          Quality
                        </p>
                      </div>
                    </StaggerItem>
                  </StaggerGrid>
                )}
              </div>
            </GlassPanel>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════
            STEP 3: Review & Correct
            ═══════════════════════════════════════════════ */}
        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Summary Cards */}
            {reviewSummary && (
              <>
                <StaggerGrid className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  <StaggerItem>
                    <StatCard
                      label="Total"
                      value={reviewSummary.totalRows.toLocaleString()}
                      icon={Database}
                      color="#6B7280"
                      delay={0}
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <StatCard
                      label="Accepted"
                      value={reviewSummary.acceptedRows.toLocaleString()}
                      icon={CheckCircle}
                      color="#10B981"
                      delay={0.05}
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <StatCard
                      label="Warnings"
                      value={reviewSummary.warningRows.toLocaleString()}
                      icon={AlertTriangle}
                      color="#F59E0B"
                      delay={0.1}
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <StatCard
                      label="Failed"
                      value={reviewSummary.failedRows.toLocaleString()}
                      icon={XCircle}
                      color="#EF4444"
                      delay={0.15}
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <StatCard
                      label="Duplicates"
                      value={reviewSummary.duplicateRows.toLocaleString()}
                      icon={Copy}
                      color="#6B7280"
                      delay={0.2}
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <StatCard
                      label="Quality"
                      value={`${Math.round(reviewSummary.dataQualityScore)}`}
                      icon={Shield}
                      color={reviewSummary.dataQualityScore >= 80 ? '#10B981' : reviewSummary.dataQualityScore >= 60 ? '#F59E0B' : '#EF4444'}
                      delay={0.25}
                    />
                  </StaggerItem>
                </StaggerGrid>

                {/* Quality Distribution Bar */}
                <GlassPanel className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Quality Distribution</span>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Excellent (80+)</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Good (60-79)</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Fair (40-59)</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Poor (&lt;40)</span>
                    </div>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                    {reviewSummary.qualityDistribution.excellent > 0 && (
                      <motion.div
                        className="bg-emerald-500 h-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(reviewSummary.qualityDistribution.excellent / reviewSummary.totalRows) * 100}%`,
                        }}
                        transition={{ duration: 0.8 }}
                      />
                    )}
                    {reviewSummary.qualityDistribution.good > 0 && (
                      <motion.div
                        className="bg-blue-500 h-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(reviewSummary.qualityDistribution.good / reviewSummary.totalRows) * 100}%`,
                        }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                      />
                    )}
                    {reviewSummary.qualityDistribution.fair > 0 && (
                      <motion.div
                        className="bg-amber-500 h-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(reviewSummary.qualityDistribution.fair / reviewSummary.totalRows) * 100}%`,
                        }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                    )}
                    {reviewSummary.qualityDistribution.poor > 0 && (
                      <motion.div
                        className="bg-red-500 h-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(reviewSummary.qualityDistribution.poor / reviewSummary.totalRows) * 100}%`,
                        }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                      />
                    )}
                  </div>
                </GlassPanel>

                {/* Filter Tabs */}
                <Tabs value={reviewFilter} onValueChange={setReviewFilter}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <TabsList className="bg-gray-100 p-1 rounded-lg">
                      <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        All ({reviewSummary.totalRows})
                      </TabsTrigger>
                      <TabsTrigger value="accepted" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Accepted ({reviewSummary.acceptedRows})
                      </TabsTrigger>
                      <TabsTrigger value="warning" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Warnings ({reviewSummary.warningRows})
                      </TabsTrigger>
                      <TabsTrigger value="failed" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Failed ({reviewSummary.failedRows})
                      </TabsTrigger>
                      <TabsTrigger value="duplicate" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Duplicates ({reviewSummary.duplicateRows})
                      </TabsTrigger>
                    </TabsList>
                    {reviewFilter === 'warning' && reviewRows.some(r => r.suggestedCorrections.length > 0) && (
                      <Button
                        variant="outline" size="sm"
                        className="text-xs gap-1.5 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/5"
                        onClick={handleApplyAllSuggestions}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Apply All Suggestions
                      </Button>
                    )}
                  </div>

                  {/* Corrections buffer indicator */}
                  {correctionsBuffer.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm"
                    >
                      <ClipboardList className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="text-blue-700">
                        <strong>{correctionsBuffer.length}</strong> correction{correctionsBuffer.length !== 1 ? 's' : ''} queued
                      </span>
                      <Button
                        variant="ghost" size="sm" className="ml-auto h-6 text-xs text-blue-600 hover:text-blue-800"
                        onClick={() => setCorrectionsBuffer([])}
                      >
                        Clear
                      </Button>
                    </motion.div>
                  )}

                  {/* Review Table */}
                  <div className="mt-4">
                    {loadingReview ? (
                      <div className="space-y-3 p-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : reviewRows.length === 0 ? (
                      <EmptyState
                        icon={CheckCircle}
                        title="No rows match this filter"
                        description="Try a different filter tab"
                      />
                    ) : (
                      <GlassPanel className="overflow-hidden">
                        <ScrollArea className="max-h-[500px]">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-gray-100 hover:bg-transparent">
                                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-10">
                                  #
                                </TableHead>
                                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-20">
                                  Status
                                </TableHead>
                                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Name
                                </TableHead>
                                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                                  Email
                                </TableHead>
                                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                                  Company
                                </TableHead>
                                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                                  Score
                                </TableHead>
                                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-40">
                                  Issues &amp; Fixes
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reviewRows.map((row) => {
                                const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.accepted;
                                const StatusIcon = cfg.icon;
                                return (
                                  <TableRow
                                    key={row.id}
                                    className={`border-gray-100 ${row.status === 'warning' ? 'bg-amber-50/30' : row.status === 'failed' ? 'bg-red-50/30' : ''}`}
                                  >
                                    <TableCell className="py-2.5 text-xs text-muted-foreground tabular-nums">
                                      {row.rowIndex + 1}
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] px-1.5 py-0 ${cfg.bg} ${cfg.color} ${cfg.border}`}
                                      >
                                        <StatusIcon className="w-3 h-3 mr-0.5" />
                                        {row.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-2.5 text-sm text-foreground font-medium truncate max-w-[160px]">
                                      {String(row.normalizedData?.name || row.mappedData?.name || row.rawData?.name || '—')}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-xs text-muted-foreground truncate max-w-[180px] hidden md:table-cell">
                                      {String(row.normalizedData?.email || row.mappedData?.email || row.rawData?.email || '—')}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-xs text-muted-foreground truncate max-w-[160px] hidden lg:table-cell">
                                      {String(row.normalizedData?.company || row.mappedData?.company || row.rawData?.company || '—')}
                                    </TableCell>
                                    <TableCell className="py-2.5 hidden sm:table-cell">
                                      <span
                                        className="text-xs font-bold tabular-nums"
                                        style={{
                                          color: row.qualityScore >= 80 ? '#10B981' : row.qualityScore >= 60 ? '#3B82F6' : row.qualityScore >= 40 ? '#F59E0B' : '#EF4444',
                                        }}
                                      >
                                        {Math.round(row.qualityScore)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      <div className="space-y-1 max-w-[200px]">
                                        {row.validationIssues.map((issue, ii) => (
                                          <div
                                            key={ii}
                                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                                              issue.severity === 'error'
                                                ? 'bg-red-50 text-red-600'
                                                : 'bg-amber-50 text-amber-600'
                                            }`}
                                            title={issue.message}
                                          >
                                            {issue.field}: {issue.message}
                                          </div>
                                        ))}
                                        {row.status === 'warning' && row.suggestedCorrections.map((corr, ci) => {
                                          const applied = isCorrectionApplied(row.id, corr.field);
                                          return (
                                            <div
                                              key={ci}
                                              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                                                applied
                                                  ? 'bg-blue-50 text-blue-600'
                                                  : 'bg-gray-50 text-gray-600'
                                              }`}
                                            >
                                              <span className="truncate flex-1" title={`${corr.reason}: "${corr.original}" → "${corr.suggested}"`}>
                                                {corr.field}: {corr.suggested}
                                              </span>
                                              <button
                                                className={`shrink-0 p-0.5 rounded hover:bg-blue-100 transition-colors ${
                                                  applied ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'
                                                }`}
                                                onClick={() =>
                                                  applied
                                                    ? removeCorrection(row.id, corr.field)
                                                    : addCorrection(row.id, corr)
                                                }
                                                title={applied ? 'Remove correction' : 'Apply correction'}
                                              >
                                                {applied ? <X className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                              </button>
                                            </div>
                                          );
                                        })}
                                        {row.status === 'duplicate' && row.duplicateOfRow != null && (
                                          <div className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">
                                            Duplicate of row #{row.duplicateOfRow + 1}
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>

                        {/* Pagination */}
                        {reviewPages > 1 && (
                          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                            <p className="text-xs text-muted-foreground">
                              Showing {((reviewPage - 1) * 50) + 1}–{Math.min(reviewPage * 50, reviewTotal)} of {reviewTotal}
                            </p>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline" size="sm" className="h-7 w-7 p-0"
                                disabled={reviewPage <= 1}
                                onClick={() => setReviewPage(p => p - 1)}
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </Button>
                              <span className="text-xs font-medium text-muted-foreground px-2">
                                Page {reviewPage} of {reviewPages}
                              </span>
                              <Button
                                variant="outline" size="sm" className="h-7 w-7 p-0"
                                disabled={reviewPage >= reviewPages}
                                onClick={() => setReviewPage(p => p + 1)}
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </GlassPanel>
                    )}
                  </div>
                </Tabs>

                {/* Commit Action Bar */}
                <GlassPanel>
                  <div className="p-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost" size="sm"
                        className="text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={() => { setStep('upload'); setAnalysis(null); setMapping({}); setFile(null); }}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        {correctionsBuffer.length > 0 && (
                          <span className="text-blue-600 font-medium">
                            {correctionsBuffer.length} correction{correctionsBuffer.length !== 1 ? 's' : ''} queued &middot;{' '}
                          </span>
                        )}
                        <span className="font-semibold text-foreground">
                          {acceptedCount.toLocaleString()}
                        </span>
                        {' '}accepted records ready to commit
                      </div>
                    </div>
                    <Button
                      className="gap-2 font-medium"
                      style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
                      onClick={handleCommit}
                      disabled={committing || acceptedCount === 0}
                    >
                      {committing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      Commit {acceptedCount.toLocaleString()} Accepted Records
                    </Button>
                  </div>
                </GlassPanel>
              </>
            )}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════
            STEP 4: Complete
            ═══════════════════════════════════════════════ */}
        {step === 'complete' && commitResult && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <AnimatedCard hover={false} className="overflow-hidden">
              <div className="p-8 sm:p-12 text-center space-y-6">
                {/* Success animation */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #10B981, #34D399)' }}
                >
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">Import Complete!</h2>
                  <p className="text-sm text-muted-foreground">
                    Your data has been successfully imported and is ready to use.
                  </p>
                </div>

                {/* Results */}
                <StaggerGrid className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-md mx-auto">
                  <StaggerItem>
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-3xl font-bold text-emerald-600 tabular-nums">
                        {commitResult.companiesCreated}
                      </p>
                      <p className="text-xs font-medium text-emerald-600/70 mt-1">Companies Created</p>
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <p className="text-3xl font-bold text-blue-600 tabular-nums">
                        {commitResult.contactsCreated}
                      </p>
                      <p className="text-xs font-medium text-blue-600/70 mt-1">Contacts Created</p>
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div className="p-4 rounded-xl border" style={{ background: 'rgba(212,175,55,0.05)', borderColor: 'rgba(212,175,55,0.1)' }}>
                      <p className="text-3xl font-bold tabular-nums" style={{ color: '#D4AF37' }}>
                        {commitResult.batchId.slice(0, 8)}
                      </p>
                      <p className="text-xs font-medium mt-1" style={{ color: 'rgba(212,175,55,0.7)' }}>Batch ID</p>
                    </div>
                  </StaggerItem>
                </StaggerGrid>

                {/* Actions */}
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => navigateTo?.('companies')}
                  >
                    <Eye className="w-4 h-4" />
                    View Companies
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => navigateTo?.('contacts')}
                  >
                    <Database className="w-4 h-4" />
                    View Contacts
                  </Button>
                  <Button
                    className="gap-2"
                    style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
                    onClick={resetAll}
                  >
                    <Upload className="w-4 h-4" />
                    Import Another
                  </Button>
                </div>
              </div>
            </AnimatedCard>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}