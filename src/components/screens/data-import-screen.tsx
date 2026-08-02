'use client';

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, ArrowLeft, Sparkles, Database, Shield, Building2,
  Users, FileText, TrendingUp, Phone, MapPin,
  XCircle, RotateCcw, PartyPopper, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

// ── Wizard step type ──
type WizardStep = 'upload' | 'mapping' | 'quality' | 'normalization' | 'commit';

const STEP_ORDER: WizardStep[] = ['upload', 'mapping', 'quality', 'normalization', 'commit'];

const STEP_LABELS: Record<WizardStep, string> = {
  upload: 'Upload',
  mapping: 'Column Mapping',
  quality: 'Data Quality',
  normalization: 'Normalization',
  commit: 'Commit',
};

// ── Target fields for mapping ──
const TARGET_FIELDS = [
  { key: 'companyName', label: 'Company Name', icon: Building2 },
  { key: 'contactName', label: 'Contact Name', icon: Users },
  { key: 'email', label: 'Email', icon: FileText },
  { key: 'jobTitle', label: 'Job Title', icon: TrendingUp },
  { key: 'phone', label: 'Phone', icon: Phone },
  { key: 'location', label: 'Location', icon: MapPin },
];

// ── API helper ──
async function apiPost(action: string, body: Record<string, unknown>) {
  const res = await fetch('/api/data-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

async function apiGetUpload(id: string) {
  const res = await fetch(`/api/data-import/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

// ── Types ──
interface RowQualityData {
  rowIndex: number;
  status: string;
  issues: Array<{ field: string; severity: string; message: string }>;
  qualityScore: number;
  mappedData: Record<string, string>;
}

interface NormalizationChange {
  rowIndex: number;
  field: string;
  original: string;
  applied: string;
}

// ── Helpers ──
function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-500';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-50 border-emerald-200';
  if (score >= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function scoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
}

function fieldIcon(field: string) {
  switch (field) {
    case 'companyName': return Building2;
    case 'contactName': return Users;
    case 'email': return FileText;
    case 'jobTitle': return TrendingUp;
    case 'phone': return Phone;
    case 'location': return MapPin;
    default: return FileText;
  }
}

function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// ═══════════════════════════════════════════════════════════
//  DATA IMPORT SCREEN
// ═══════════════════════════════════════════════════════════
export default function DataImportScreen() {
  const setActiveView = useAppStore((s) => s.setActiveView);

  // ── Wizard state ──
  const [step, setStep] = useState<WizardStep>('upload');
  const stepIndex = STEP_ORDER.indexOf(step);

  // ── Upload state ──
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  // ── Mapping state ──
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isConfirmingMapping, setIsConfirmingMapping] = useState(false);

  // ── Quality state ──
  const [isValidating, setIsValidating] = useState(false);
  const [validationSummary, setValidationSummary] = useState({
    totalRows: 0, failedRows: 0, warningRows: 0, pendingRows: 0,
  });
  const [rowQualityData, setRowQualityData] = useState<RowQualityData[]>([]);

  // ── Normalization state ──
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [normalizationSummary, setNormalizationSummary] = useState({
    totalRows: 0, normalizedRows: 0, unchangedRows: 0,
  });
  const [normalizationChanges, setNormalizationChanges] = useState<NormalizationChange[]>([]);

  // ── Commit state ──
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitResult, setCommitResult] = useState<{
    companiesCreated: number;
    contactsCreated: number;
    duplicatesSkipped: number;
    failedRows: number;
  } | null>(null);

  // ── Refs ──
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──
  const processFile = useCallback(async (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      toast.error('Unsupported file format. Please upload a CSV or XLSX file.');
      return;
    }
    if (selectedFile.size > 25 * 1024 * 1024) {
      toast.error('File exceeds 25MB limit.');
      return;
    }

    setFile(selectedFile);
    setIsUploading(true);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });
      const fileHeaders = Object.keys(jsonData[0] || {});

      setHeaders(fileHeaders);
      setParsedRows(jsonData);
      setTotalRows(jsonData.length);

      // POST to create upload + auto-map
      const result = await apiPost('upload', {
        fileName: selectedFile.name,
        totalRows: jsonData.length,
        headers: fileHeaders,
        rows: jsonData,
      });

      setUploadId(result.upload.id);
      setColumnMapping(result.columnMapping || {});

      toast.success(`File parsed: ${jsonData.length} rows, ${fileHeaders.length} columns detected`);
      setStep('mapping');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }, [processFile]);

  // ── Confirm mapping ──
  const handleConfirmMapping = useCallback(async () => {
    if (!uploadId) return;
    setIsConfirmingMapping(true);
    try {
      await apiPost('confirm-mapping', { uploadId, columnMapping });
      toast.success('Column mapping confirmed');
      setStep('quality');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm mapping');
    } finally {
      setIsConfirmingMapping(false);
    }
  }, [uploadId, columnMapping]);

  // ── Run validation ──
  const handleValidate = useCallback(async () => {
    if (!uploadId) return;
    setIsValidating(true);
    try {
      // POST validate to run server-side validation
      const summary = await apiPost('validate', { uploadId });
      setValidationSummary(summary);

      // GET upload detail to get per-row data
      const detail = await apiGetUpload(uploadId);
      const rows = (detail.upload as { rows?: Array<Record<string, unknown>> }).rows || [];

      const qualityData: RowQualityData[] = rows.map((row: Record<string, unknown>) => {
        const idx = row.rowIndex as number;
        const status = (row.status as string) || 'pending';
        const issues = safeJsonParse<(Array<{ field: string; severity: string; message: string }>)>(
          row.validationIssues as string | null,
          [],
        );
        const mapped = safeJsonParse<Record<string, string>>(row.mappedData as string | null, {});

        // Compute a simple quality score
        const errorCount = issues.filter((i) => i.severity === 'error').length;
        const warnCount = issues.filter((i) => i.severity === 'warning').length;
        const score = Math.max(0, 100 - errorCount * 25 - warnCount * 10);

        return { rowIndex: idx, status, issues, qualityScore: score, mappedData: mapped };
      });

      setRowQualityData(qualityData);
      toast.success(`Validation complete: ${summary.pendingRows} valid, ${summary.warningRows} warnings, ${summary.failedRows} errors`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  }, [uploadId]);

  // ── Run normalization ──
  const handleNormalize = useCallback(async () => {
    if (!uploadId) return;
    setIsNormalizing(true);
    try {
      const summary = await apiPost('normalize', { uploadId });
      setNormalizationSummary(summary);

      // Re-fetch to get applied corrections from rows
      const detail = await apiGetUpload(uploadId);
      const rows = (detail.upload as { rows?: Array<Record<string, unknown>> }).rows || [];

      const changes: NormalizationChange[] = [];
      for (const row of rows) {
        const corrections = safeJsonParse<
          Array<{ field: string; original: string; applied: string }>
        >(row.appliedCorrections as string | null, []);
        for (const c of corrections) {
          changes.push({ rowIndex: row.rowIndex as number, ...c });
        }
      }
      setNormalizationChanges(changes);

      toast.success(`Normalization complete: ${summary.normalizedRows} values corrected`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Normalization failed');
    } finally {
      setIsNormalizing(false);
    }
  }, [uploadId]);

  // ── Commit import ──
  const handleCommit = useCallback(async () => {
    if (!uploadId) return;
    setIsCommitting(true);
    setCommitProgress(0);

    try {
      setCommitProgress(10);
      await new Promise((r) => setTimeout(r, 300));
      setCommitProgress(30);

      const result = await apiPost('commit', { uploadId });

      setCommitProgress(70);
      await new Promise((r) => setTimeout(r, 400));
      setCommitProgress(90);
      await new Promise((r) => setTimeout(r, 300));
      setCommitProgress(100);

      setCommitResult({
        companiesCreated: result.companiesCreated ?? 0,
        contactsCreated: result.contactsCreated ?? 0,
        duplicatesSkipped: result.duplicatesSkipped ?? 0,
        failedRows: result.failedRows ?? 0,
      });

      toast.success(`Import committed: ${result.contactsCreated} contacts, ${result.companiesCreated} companies created`);
    } catch (err) {
      setCommitProgress(100);
      toast.error(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setIsCommitting(false);
    }
  }, [uploadId]);

  // ── Navigation ──
  const goToStep = useCallback((target: WizardStep) => {
    const targetIdx = STEP_ORDER.indexOf(target);
    const currentIdx = STEP_ORDER.indexOf(step);
    if (targetIdx < currentIdx) setStep(target);
  }, [step]);

  const handleNext = useCallback(() => {
    const nextIdx = stepIndex + 1;
    if (nextIdx < STEP_ORDER.length) setStep(STEP_ORDER[nextIdx]);
  }, [stepIndex]);

  const handleBack = useCallback(() => {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) setStep(STEP_ORDER[prevIdx]);
  }, [stepIndex]);

  const resetWizard = useCallback(() => {
    setStep('upload');
    setFile(null);
    setUploadId(null);
    setHeaders([]);
    setParsedRows([]);
    setTotalRows(0);
    setColumnMapping({});
    setValidationSummary({ totalRows: 0, failedRows: 0, warningRows: 0, pendingRows: 0 });
    setRowQualityData([]);
    setNormalizationSummary({ totalRows: 0, normalizedRows: 0, unchangedRows: 0 });
    setNormalizationChanges([]);
    setCommitProgress(0);
    setCommitResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Update a single mapping ──
  const updateMapping = useCallback((sourceHeader: string, targetField: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      // Remove any other header mapping to this target
      for (const [k, v] of Object.entries(next)) {
        if (v === targetField && k !== sourceHeader) delete next[k];
      }
      if (targetField === '__none__') {
        delete next[sourceHeader];
      } else {
        next[sourceHeader] = targetField;
      }
      return next;
    });
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  RENDER: Step Indicator
  // ═══════════════════════════════════════════════════════════
  const renderStepIndicator = () => (
    <div className="flex items-center gap-1 mb-8">
      {STEP_ORDER.map((s, idx) => {
        const sIdx = STEP_ORDER.indexOf(s);
        const isActive = s === step;
        const isComplete = sIdx < stepIndex || step === 'commit' && commitResult;
        const isPending = sIdx > stepIndex;

        return (
          <div key={s} className="flex items-center">
            {idx > 0 && (
              <div className={cn(
                'w-6 h-px mx-1',
                isComplete ? 'bg-blue-400' : 'bg-slate-200',
              )} />
            )}
            <button
              onClick={() => goToStep(s)}
              disabled={isPending}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                isActive && 'bg-blue-600 text-white shadow-sm',
                isComplete && !isActive && 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer',
                isPending && 'text-slate-400 cursor-not-allowed',
              )}
            >
              {isComplete && !isActive && <CheckCircle2 className="size-3" />}
              {STEP_LABELS[s]}
            </button>
          </div>
        );
      })}
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  //  RENDER: Step 1 — Upload
  // ═══════════════════════════════════════════════════════════
  const renderUpload = () => (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Data Intelligence Import</h2>
        <p className="text-slate-500 mt-1">Import contacts and companies with AI-powered validation and normalization</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        aria-label="Upload CSV or XLSX file"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-12 md:p-16 text-center cursor-pointer transition-all duration-200',
          isDragging
            ? 'border-blue-400 bg-blue-50/50 scale-[1.01]'
            : 'border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50/50',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-10 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-slate-600">Parsing and uploading your file...</p>
          </div>
        ) : (
          <>
            <div className={cn(
              'mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-colors',
              isDragging ? 'bg-blue-100' : 'bg-slate-100',
            )}>
              <Upload className={cn('size-8', isDragging ? 'text-blue-600' : 'text-slate-400')} />
            </div>
            <p className="text-lg font-semibold text-slate-700 mb-1">
              {isDragging ? 'Drop your file here' : 'Drop your file here or click to browse'}
            </p>
            <p className="text-sm text-slate-400 mb-4">Supports CSV and XLSX files up to 25MB</p>
            <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><FileSpreadsheet className="size-3.5" /> .csv</span>
              <span className="flex items-center gap-1"><FileSpreadsheet className="size-3.5" /> .xlsx</span>
            </div>
          </>
        )}
      </div>

      {/* Feature cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-slate-200">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Shield className="size-4.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Validation</p>
              <p className="text-sm font-semibold text-slate-700">Rule-Based</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Database className="size-4.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Normalization</p>
              <p className="text-sm font-semibold text-slate-700">Auto-Standardize</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Sparkles className="size-4.5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Mapping</p>
              <p className="text-sm font-semibold text-slate-700">Smart Detect</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  //  RENDER: Step 2 — Column Mapping
  // ═══════════════════════════════════════════════════════════
  const renderMapping = () => {
    const mappedCount = Object.keys(columnMapping).length;

    return (
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Column Mapping</h2>
          <p className="text-slate-500 mt-1">
            Review and adjust the auto-detected column mappings
          </p>
        </div>

        {/* File info */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 mb-6 max-w-lg mx-auto">
          <FileSpreadsheet className="size-5 text-blue-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 truncate">{file?.name}</p>
            <p className="text-xs text-slate-400">{totalRows} rows · {headers.length} columns · {mappedCount} mapped</p>
          </div>
          <Badge variant="outline">{file?.name?.split('.').pop()?.toUpperCase()}</Badge>
        </div>

        {/* Mapping table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Source → Target Mapping</CardTitle>
            <CardDescription>Each source column maps to a target field. Unmapped columns will be ignored.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Source Column</TableHead>
                    <TableHead className="w-[40px]" />
                    <TableHead>Target Field</TableHead>
                    <TableHead className="w-[80px] text-right">Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((header) => {
                    const currentTarget = columnMapping[header] || '__none__';
                    const IconComp = currentTarget !== '__none__' ? fieldIcon(currentTarget) : null;
                    const previewValue = parsedRows[0]?.[header] || '—';

                    return (
                      <TableRow key={header}>
                        <TableCell className="font-mono text-sm text-slate-700">{header}</TableCell>
                        <TableCell>
                          <ArrowRight className="size-4 text-slate-300" />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={currentTarget}
                            onValueChange={(val) => updateMapping(header, val)}
                          >
                            <SelectTrigger className="w-[220px]">
                              <div className="flex items-center gap-2">
                                {IconComp && <IconComp className="size-3.5 text-slate-400" />}
                                <SelectValue placeholder="Do not map" />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                <span className="text-slate-400">Do not map</span>
                              </SelectItem>
                              {TARGET_FIELDS.map((tf) => {
                                const TIcon = tf.icon;
                                return (
                                  <SelectItem key={tf.key} value={tf.key}>
                                    <div className="flex items-center gap-2">
                                      <TIcon className="size-3.5 text-slate-400" />
                                      {tf.label}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs text-slate-400 truncate max-w-[100px] inline-block">
                            {previewValue}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  //  RENDER: Step 3 — Data Quality
  // ═══════════════════════════════════════════════════════════
  const renderQuality = () => {
    const hasRunValidation = rowQualityData.length > 0;
    const avgScore = hasRunValidation
      ? Math.round(rowQualityData.reduce((s, r) => s + r.qualityScore, 0) / rowQualityData.length)
      : 0;

    return (
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Data Quality</h2>
          <p className="text-slate-500 mt-1">
            Validate rows and review quality scores per record
          </p>
        </div>

        {/* Validation trigger */}
        {!hasRunValidation && (
          <div className="flex justify-center mb-6">
            <Button onClick={handleValidate} disabled={isValidating} size="lg">
              {isValidating ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Shield className="size-4 mr-2" />}
              {isValidating ? 'Validating rows...' : 'Run Validation'}
            </Button>
          </div>
        )}

        {isValidating && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="size-10 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-slate-600">Running validation rules...</p>
          </div>
        )}

        {hasRunValidation && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{validationSummary.totalRows}</p>
                  <p className="text-xs text-slate-500">Total Rows</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className={cn('text-2xl font-bold', scoreColor(avgScore))}>{avgScore}%</p>
                  <p className="text-xs text-slate-500">Avg Quality</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{validationSummary.warningRows}</p>
                  <p className="text-xs text-slate-500">Warnings</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-500">{validationSummary.failedRows}</p>
                  <p className="text-xs text-slate-500">Errors</p>
                </CardContent>
              </Card>
            </div>

            {/* Per-row quality table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Row Quality Scores</CardTitle>
                <CardDescription>
                  Color-coded: <span className="text-emerald-600 font-medium">Green ≥80</span>,{' '}
                  <span className="text-amber-600 font-medium">Amber 60-79</span>,{' '}
                  <span className="text-red-500 font-medium">Red &lt;60</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Row</TableHead>
                        <TableHead className="w-[80px]">Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Issues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rowQualityData.map((rq) => (
                        <TableRow key={rq.rowIndex}>
                          <TableCell className="font-mono text-xs">#{rq.rowIndex + 1}</TableCell>
                          <TableCell>
                            <Badge variant={scoreBadgeVariant(rq.qualityScore)} className={cn('font-mono', scoreBg(rq.qualityScore))}>
                              {rq.qualityScore}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={rq.status === 'failed' ? 'destructive' : rq.status === 'warning' ? 'secondary' : 'default'}
                            >
                              {rq.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {rq.issues.length === 0 && (
                                <span className="text-xs text-slate-400">No issues</span>
                              )}
                              {rq.issues.map((issue, i) => (
                                <Badge
                                  key={i}
                                  variant={issue.severity === 'error' ? 'destructive' : 'secondary'}
                                  className="text-[10px]"
                                >
                                  {issue.field}: {issue.message}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  //  RENDER: Step 4 — Normalization Preview
  // ═══════════════════════════════════════════════════════════
  const renderNormalization = () => {
    const hasRunNormalization = normalizationChanges.length > 0 || normalizationSummary.totalRows > 0;

    return (
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Normalization Preview</h2>
          <p className="text-slate-500 mt-1">
            Review automated value corrections before committing
          </p>
        </div>

        {!hasRunNormalization && (
          <div className="flex justify-center mb-6">
            <Button onClick={handleNormalize} disabled={isNormalizing} size="lg">
              {isNormalizing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
              {isNormalizing ? 'Normalizing values...' : 'Run Normalization'}
            </Button>
          </div>
        )}

        {isNormalizing && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="size-10 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-slate-600">Applying normalization rules...</p>
          </div>
        )}

        {hasRunNormalization && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{normalizationSummary.totalRows}</p>
                  <p className="text-xs text-slate-500">Total Rows</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{normalizationSummary.normalizedRows}</p>
                  <p className="text-xs text-slate-500">Values Corrected</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-slate-500">{normalizationSummary.unchangedRows}</p>
                  <p className="text-xs text-slate-500">Unchanged</p>
                </CardContent>
              </Card>
            </div>

            {/* Before/After table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Before → After Changes</CardTitle>
                <CardDescription>
                  {normalizationChanges.length === 0
                    ? 'No values required normalization'
                    : `${normalizationChanges.length} corrections applied across ${new Set(normalizationChanges.map(c => c.rowIndex)).size} rows`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {normalizationChanges.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="size-10 text-emerald-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">All values already conform to standard formats</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">Row</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>Original</TableHead>
                          <TableHead className="w-[40px]" />
                          <TableHead>Normalized</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {normalizationChanges.map((change, i) => (
                          <TableRow key={`${change.rowIndex}-${change.field}-${i}`}>
                            <TableCell className="font-mono text-xs">#{change.rowIndex + 1}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{change.field}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-red-600 line-through">{change.original}</span>
                            </TableCell>
                            <TableCell>
                              <ArrowRight className="size-4 text-slate-300" />
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-emerald-600 font-medium">{change.applied}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  //  RENDER: Step 5 — Commit
  // ═══════════════════════════════════════════════════════════
  const renderCommit = () => {
    if (commitResult) {
      return (
        <div>
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <PartyPopper className="size-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Import Complete!</h2>
            <p className="text-slate-500 mt-1">Your data has been successfully imported</p>
          </div>

          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-blue-600" />
                    <span className="text-sm text-slate-600">Companies Created</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{commitResult.companiesCreated}</span>
                </div>
                <div className="border-t border-slate-100" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-emerald-600" />
                    <span className="text-sm text-slate-600">Contacts Imported</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{commitResult.contactsCreated}</span>
                </div>
                {commitResult.duplicatesSkipped > 0 && (
                  <>
                    <div className="border-t border-slate-100" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="size-4 text-amber-500" />
                        <span className="text-sm text-slate-600">Duplicates Skipped</span>
                      </div>
                      <span className="text-lg font-bold text-amber-600">{commitResult.duplicatesSkipped}</span>
                    </div>
                  </>
                )}
                {commitResult.failedRows > 0 && (
                  <>
                    <div className="border-t border-slate-100" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="size-4 text-red-500" />
                        <span className="text-sm text-slate-600">Failed Rows</span>
                      </div>
                      <span className="text-lg font-bold text-red-500">{commitResult.failedRows}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3 mt-6">
              <Button onClick={resetWizard} variant="outline" className="flex-1">
                <RotateCcw className="size-4 mr-2" />
                New Import
              </Button>
              <Button onClick={() => setActiveView('command-center')} className="flex-1">
                <ChevronRight className="size-4 mr-2" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Commit Import</h2>
          <p className="text-slate-500 mt-1">Review the summary and commit your data import</p>
        </div>

        {/* Commit progress area */}
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-6 space-y-4">
              {isCommitting && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Processing...</span>
                    <span className="font-mono text-slate-900">{commitProgress}%</span>
                  </div>
                  <Progress value={commitProgress} className="h-2" />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="size-4 text-slate-400" />
                  <span className="text-slate-600">File:</span>
                  <span className="font-medium text-slate-900">{file?.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Database className="size-4 text-slate-400" />
                  <span className="text-slate-600">Total Rows:</span>
                  <span className="font-medium text-slate-900">{totalRows}</span>
                </div>
                {validationSummary.totalRows > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="size-4 text-slate-400" />
                    <span className="text-slate-600">Valid Rows:</span>
                    <span className="font-medium text-emerald-600">{validationSummary.pendingRows}</span>
                  </div>
                )}
                {normalizationSummary.totalRows > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="size-4 text-slate-400" />
                    <span className="text-slate-600">Values Normalized:</span>
                    <span className="font-medium text-blue-600">{normalizationSummary.normalizedRows}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleCommit}
                  disabled={isCommitting}
                  className="w-full"
                  size="lg"
                >
                  {isCommitting ? (
                    <><Loader2 className="size-4 mr-2 animate-spin" /> Committing...</>
                  ) : (
                    <><CheckCircle2 className="size-4 mr-2" /> Commit Import</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  //  RENDER: Navigation
  // ═══════════════════════════════════════════════════════════
  const renderNavigation = () => {
    if (step === 'commit' && commitResult) return null;
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === STEP_ORDER.length - 1;
    const isCommitStep = step === 'commit';

    // Disable Next in specific states
    let canGoNext = true;
    if (step === 'mapping' && isConfirmingMapping) canGoNext = false;
    if (step === 'quality' && (isValidating || rowQualityData.length === 0)) canGoNext = false;
    if (step === 'normalization' && (isNormalizing && normalizationSummary.totalRows === 0)) canGoNext = false;
    if (isCommitStep && isCommitting) canGoNext = false;

    return (
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={isFirst || isUploading || isCommitting}
        >
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={resetWizard} disabled={isUploading || isCommitting}>
            <RotateCcw className="size-4 mr-2" />
            Reset
          </Button>

          {!isLast && !isCommitStep && (
            <Button onClick={handleNext} disabled={!canGoNext}>
              {step === 'mapping' && isConfirmingMapping ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Confirming...</>
              ) : (
                <>Next <ArrowRight className="size-4 ml-2" /></>
              )}
            </Button>
          )}

          {isCommitStep && !commitResult && (
            <Button onClick={handleCommit} disabled={!canGoNext}>
              {isCommitting ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Committing...</>
              ) : (
                <><CheckCircle2 className="size-4 mr-2" /> Commit Import</>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="max-w-4xl mx-auto px-4 py-8" role="main" aria-label="Data Import">
      {renderStepIndicator()}
      {step === 'upload' && renderUpload()}
      {step === 'mapping' && renderMapping()}
      {step === 'quality' && renderQuality()}
      {step === 'normalization' && renderNormalization()}
      {step === 'commit' && renderCommit()}
      {renderNavigation()}
    </div>
  );
}
