'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { AIProgressTracker } from '@/components/enterprise/AIProgressTracker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, ArrowLeft, Sparkles, BarChart3, Database,
  Shield, Clock, Users, Building2, Copy, AlertTriangle,
  ChevronRight, RotateCcw, FileText, TrendingUp, XCircle,
  CheckCircle, Eye, Zap, Trash2, History,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Props ──
interface ImportScreenProps {
  navigateTo?: (screen: string) => void;
}

// ── Target fields for mapping ──
const TARGET_FIELDS = [
  { key: 'companyName', label: 'Company Name', icon: Building2 },
  { key: 'contactName', label: 'Contact Name', icon: Users },
  { key: 'email', label: 'Email', icon: FileText },
  { key: 'jobTitle', label: 'Job Title', icon: TrendingUp },
  { key: 'phone', label: 'Phone', icon: FileText },
  { key: 'location', label: 'Location', icon: FileText },
];

// ── Wizard step type ──
type WizardStep = 'upload' | 'analysis' | 'mapping' | 'quality' | 'preview' | 'executing' | 'complete';

const STEP_ORDER: WizardStep[] = ['upload', 'analysis', 'mapping', 'quality', 'preview', 'executing', 'complete'];

const STEP_LABELS: Record<WizardStep, string> = {
  upload: 'Upload File',
  analysis: 'Data Analysis',
  mapping: 'Column Mapping',
  quality: 'Quality Report',
  preview: 'Import Preview',
  executing: 'Importing Data',
  complete: 'Complete',
};

// ── Types ──
interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
}

interface QualityColumn {
  name: string;
  filled: number;
  empty: number;
  valid: number;
  invalid: number;
}

interface ImportHistoryItem {
  id: string;
  fileName: string;
  date: string;
  totalRows: number;
  accepted: number;
  duplicates: number;
  invalid: number;
  status: 'completed' | 'failed' | 'processing' | 'partial';
}

// ── Animation variants ──
const fadeSlideUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

// ── Mock history data ──
const MOCK_HISTORY: ImportHistoryItem[] = [
  { id: 'h1', fileName: 'sales_leads_q4.csv', date: '2025-01-15 14:32', totalRows: 1247, accepted: 1189, duplicates: 38, invalid: 20, status: 'completed' },
  { id: 'h2', fileName: 'partner_contacts.xlsx', date: '2025-01-14 09:17', totalRows: 523, accepted: 510, duplicates: 8, invalid: 5, status: 'completed' },
  { id: 'h3', fileName: 'trade_show_leads.csv', date: '2025-01-13 16:45', totalRows: 342, accepted: 298, duplicates: 32, invalid: 12, status: 'partial' },
  { id: 'h4', fileName: 'webinar_registrants.csv', date: '2025-01-12 11:03', totalRows: 891, accepted: 0, duplicates: 0, invalid: 891, status: 'failed' },
];

// ── Confidence color helper ──
function confidenceColor(confidence: number): string {
  if (confidence >= 90) return 'text-emerald-600';
  if (confidence >= 70) return 'text-amber-600';
  return 'text-red-500';
}

function confidenceBg(confidence: number): string {
  if (confidence >= 90) return 'bg-emerald-50 border-emerald-200';
  if (confidence >= 70) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function confidenceBarColor(confidence: number): string {
  if (confidence >= 90) return 'bg-emerald-500';
  if (confidence >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

// ═══════════════════════════════════════════════════════════
//  IMPORT SCREEN
// ═══════════════════════════════════════════════════════════
export default function ImportScreen({ navigateTo }: ImportScreenProps) {
  // ── Wizard state ──
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);

  // ── Analysis state ──
  const [analysisSteps, setAnalysisSteps] = useState<Array<{ label: string; status: 'pending' | 'processing' | 'complete' }>>([
    { label: 'Parsing file structure...', status: 'pending' },
    { label: 'Analyzing column headers...', status: 'pending' },
    { label: 'Detecting data patterns...', status: 'pending' },
    { label: 'Generating quality report...', status: 'pending' },
  ]);
  const [detectedRows, setDetectedRows] = useState(0);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);

  // ── Mapping state ──
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  // ── Quality state ──
  const [qualitySummary, setQualitySummary] = useState({
    totalRows: 0, valid: 0, duplicates: 0, missing: 0, qualityScore: 0,
  });
  const [qualityColumns, setQualityColumns] = useState<QualityColumn[]>([]);

  // ── Preview state ──
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);

  // ── Execution state ──
  const [executionProgress, setExecutionProgress] = useState(0);
  const [intelSteps, setIntelSteps] = useState<Array<{ label: string; status: 'pending' | 'processing' | 'complete' }>>([
    { label: 'Creating company profiles...', status: 'pending' },
    { label: 'Scoring contacts...', status: 'pending' },
    { label: 'Detecting buying signals...', status: 'pending' },
    { label: 'Generating recommendations...', status: 'pending' },
  ]);
  const [completionSummary, setCompletionSummary] = useState({ companiesCreated: 0, contactsImported: 0, duplicatesFound: 0 });

  // ── History state ──
  const [history, setHistory] = useState<ImportHistoryItem[]>(MOCK_HISTORY);

  // ── Refs ──
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Current step index for progress bar ──
  const stepIndex = STEP_ORDER.indexOf(step);

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
    setStep('analysis');

    // Simulate analysis steps
    const steps = [
      { label: 'Parsing file structure...', status: 'processing' as const },
      { label: 'Analyzing column headers...', status: 'pending' as const },
      { label: 'Detecting data patterns...', status: 'pending' as const },
      { label: 'Generating quality report...', status: 'pending' as const },
    ];
    setAnalysisSteps(steps);

    // Read file
    const arrayBuffer = await selectedFile.arrayBuffer();
    let workbook: XLSX.WorkBook;
    if (ext === 'csv') {
      workbook = XLSX.read(arrayBuffer, { type: 'array' });
    } else {
      workbook = XLSX.read(arrayBuffer, { type: 'array' });
    }
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });
    const headers = Object.keys(jsonData[0] || {});

    // Step 1 complete
    await new Promise(r => setTimeout(r, 700));
    setAnalysisSteps(s => s.map((st, i) => i === 0 ? { ...st, status: 'complete' as const } : i === 1 ? { ...st, status: 'processing' as const } : st));

    // Step 2 complete
    await new Promise(r => setTimeout(r, 600));
    setDetectedColumns(headers);
    setDetectedRows(jsonData.length);
    setAnalysisSteps(s => s.map((st, i) => i <= 1 ? { ...st, status: 'complete' as const } : i === 2 ? { ...st, status: 'processing' as const } : st));

    // Step 3 complete
    await new Promise(r => setTimeout(r, 800));
    setAnalysisSteps(s => s.map((st, i) => i <= 2 ? { ...st, status: 'complete' as const } : i === 3 ? { ...st, status: 'processing' as const } : st));

    // Generate AI mappings
    const aiMappings = TARGET_FIELDS.map(tf => {
      const bestMatch = headers.find(h => {
        const lh = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        const lk = tf.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        return lh.includes(lk) || lk.includes(lh);
      });
      const fallback = headers.find(h => {
        const lh = h.toLowerCase();
        if (tf.key === 'email' && lh.includes('email')) return true;
        if (tf.key === 'companyName' && (lh.includes('company') || lh.includes('org') || lh.includes('business'))) return true;
        if (tf.key === 'contactName' && (lh.includes('name') || lh.includes('contact') || lh.includes('full'))) return true;
        if (tf.key === 'jobTitle' && (lh.includes('title') || lh.includes('role') || lh.includes('position'))) return true;
        if (tf.key === 'phone' && (lh.includes('phone') || lh.includes('tel'))) return true;
        if (tf.key === 'location' && (lh.includes('loc') || lh.includes('city') || lh.includes('address'))) return true;
        return false;
      });
      const matched = bestMatch || fallback;
      return {
        sourceColumn: matched || '',
        targetField: tf.key,
        confidence: matched ? (bestMatch ? 92 + Math.floor(Math.random() * 7) : 75 + Math.floor(Math.random() * 15)) : 0,
      };
    });
    setMappings(aiMappings);

    // Generate quality data
    const total = jsonData.length;
    const dupes = Math.floor(total * 0.03);
    const missing = Math.floor(total * 0.08);
    const valid = total - dupes - Math.floor(missing * 0.5);
    const score = Math.round((valid / total) * 100);
    setQualitySummary({ totalRows: total, valid, duplicates: dupes, missing, qualityScore: score });

    const qCols: QualityColumn[] = headers.slice(0, 8).map(h => {
      const filled = jsonData.filter(r => r[h] && r[h].toString().trim() !== '').length;
      const empty = total - filled;
      const validCount = Math.floor(filled * (0.85 + Math.random() * 0.14));
      return { name: h, filled, empty, valid: validCount, invalid: filled - validCount };
    });
    setQualityColumns(qCols);

    // Generate preview
    const mappedHeaders = aiMappings.filter(m => m.sourceColumn).map(m => m.targetField);
    setPreviewHeaders(mappedHeaders);
    const preview = jsonData.slice(0, 5).map(row => {
      const mapped: Record<string, string> = {};
      aiMappings.forEach(m => {
        if (m.sourceColumn) {
          const tf = TARGET_FIELDS.find(t => t.key === m.targetField);
          mapped[m.targetField] = row[m.sourceColumn] || '';
        }
      });
      return mapped;
    });
    setPreviewRows(preview);

    // Final step
    await new Promise(r => setTimeout(r, 500));
    setAnalysisSteps(s => s.map(st => ({ ...st, status: 'complete' as const })));

    // Auto-advance to mapping after brief pause
    await new Promise(r => setTimeout(r, 400));
    setStep('mapping');
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

  // ── Execute import ──
  const executeImport = useCallback(async () => {
    setStep('executing');
    setExecutionProgress(0);
    setIntelSteps([
      { label: 'Creating company profiles...', status: 'pending' },
      { label: 'Scoring contacts...', status: 'pending' },
      { label: 'Detecting buying signals...', status: 'pending' },
      { label: 'Generating recommendations...', status: 'pending' },
    ]);

    // Simulate import progress
    for (let p = 0; p <= 100; p += Math.random() * 15 + 5) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      setExecutionProgress(Math.min(100, Math.round(p)));
      if (p > 30) {
        setIntelSteps(s => s.map((st, i) => i === 0 ? { ...st, status: 'complete' as const } : i === 1 && p > 50 ? { ...st, status: 'complete' as const } : i === 1 && p > 30 ? { ...st, status: 'processing' as const } : st));
      }
    }
    setExecutionProgress(100);

    // Intel steps
    await new Promise(r => setTimeout(r, 600));
    setIntelSteps(s => s.map((st, i) => i <= 1 ? { ...st, status: 'complete' as const } : i === 2 ? { ...st, status: 'processing' as const } : st));
    await new Promise(r => setTimeout(r, 800));
    setIntelSteps(s => s.map((st, i) => i <= 2 ? { ...st, status: 'complete' as const } : i === 3 ? { ...st, status: 'processing' as const } : st));
    await new Promise(r => setTimeout(r, 700));
    setIntelSteps(s => s.map(st => ({ ...st, status: 'complete' as const })));

    const companiesCreated = Math.floor(qualitySummary.valid * 0.4);
    const contactsImported = qualitySummary.valid - companiesCreated;
    setCompletionSummary({ companiesCreated, contactsImported, duplicatesFound: qualitySummary.duplicates });

    await new Promise(r => setTimeout(r, 400));
    setStep('complete');

    toast.success('Import completed successfully!');
  }, [qualitySummary]);

  // ── Reset wizard ──
  const resetWizard = useCallback(() => {
    setStep('upload');
    setFile(null);
    setBatchId(null);
    setDetectedRows(0);
    setDetectedColumns([]);
    setMappings([]);
    setQualitySummary({ totalRows: 0, valid: 0, duplicates: 0, missing: 0, qualityScore: 0 });
    setQualityColumns([]);
    setPreviewRows([]);
    setPreviewHeaders([]);
    setExecutionProgress(0);
    setCompletionSummary({ companiesCreated: 0, contactsImported: 0, duplicatesFound: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Go to specific step ──
  const goToStep = useCallback((target: WizardStep) => {
    const targetIdx = STEP_ORDER.indexOf(target);
    const currentIdx = STEP_ORDER.indexOf(step);
    // Can only go back, not forward (except auto-advance during analysis)
    if (targetIdx < currentIdx) setStep(target);
  }, [step]);

  // ── Update mapping ──
  const updateMapping = useCallback((targetField: string, sourceColumn: string) => {
    setMappings(prev => prev.map(m =>
      m.targetField === targetField
        ? { ...m, sourceColumn, confidence: sourceColumn ? 70 + Math.floor(Math.random() * 25) : 0 }
        : m
    ));
  }, []);

  // ── Render: Step indicator ──
  const renderStepIndicator = () => (
    <div className="flex items-center gap-1 mb-8">
      {STEP_ORDER.filter(s => s !== 'analysis' && s !== 'executing').map((s, idx) => {
        const sIdx = STEP_ORDER.indexOf(s);
        const isActive = s === step;
        const isComplete = sIdx < stepIndex || step === 'complete';
        const isPending = sIdx > stepIndex && step !== 'complete';
        const realIdx = idx;

        return (
          <div key={s} className="flex items-center">
            {realIdx > 0 && (
              <div className={`w-6 h-px mx-1 ${isComplete ? 'bg-blue-400' : 'bg-slate-200'}`} />
            )}
            <button
              onClick={() => goToStep(s)}
              disabled={isPending}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all
                ${isActive ? 'bg-blue-600 text-white shadow-sm' : ''}
                ${isComplete && !isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer' : ''}
                ${isPending ? 'text-slate-400 cursor-not-allowed' : ''}
              `}
            >
              {isComplete && !isActive && <CheckCircle2 className="size-3" />}
              {STEP_LABELS[s]}
            </button>
          </div>
        );
      })}
    </div>
  );

  // ── Render: Step 1 - Upload ──
  const renderUpload = () => (
    <motion.div key="upload" {...fadeSlideUp}>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Upload Your Data</h2>
        <p className="text-slate-500 mt-1">Import contacts and companies from CSV or Excel files</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 md:p-16 text-center cursor-pointer transition-all duration-200
          ${isDragging
            ? 'border-blue-400 bg-blue-50/50 scale-[1.01]'
            : 'border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50/50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-colors
          ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}
        `}>
          <Upload className={`size-8 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
        </div>
        <p className="text-lg font-semibold text-slate-700 mb-1">
          {isDragging ? 'Drop your file here' : 'Drop your file here or click to browse'}
        </p>
        <p className="text-sm text-slate-400 mb-4">Supports CSV and XLSX files up to 25MB</p>
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><FileSpreadsheet className="size-3.5" /> .csv</span>
          <span className="flex items-center gap-1"><FileSpreadsheet className="size-3.5" /> .xlsx</span>
          <span className="flex items-center gap-1"><FileSpreadsheet className="size-3.5" /> .xls</span>
        </div>
      </div>

      {/* Quick stats banner */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Shield className="size-4.5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Validation</p>
            <p className="text-sm font-semibold text-slate-700">AI-Powered</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Database className="size-4.5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Dedup</p>
            <p className="text-sm font-semibold text-slate-700">Automatic</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
            <Sparkles className="size-4.5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Mapping</p>
            <p className="text-sm font-semibold text-slate-700">Smart Detect</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // ── Render: Step 2 - Analysis ──
  const renderAnalysis = () => (
    <motion.div key="analysis" {...fadeSlideUp}>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Analyzing Your Data</h2>
        <p className="text-slate-500 mt-1">AI is processing your file and detecting patterns</p>
      </div>

      <div className="max-w-md mx-auto">
        {/* File info card */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="size-5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 truncate">{file?.name}</p>
            <p className="text-xs text-slate-400">{(file?.size ? (file.size / 1024).toFixed(1) : '0')} KB</p>
          </div>
          <Badge variant="outline" className="shrink-0">{file?.name?.split('.').pop()?.toUpperCase()}</Badge>
        </div>

        <AIProgressTracker steps={analysisSteps} className="mb-6" />

        {/* Detected info */}
        {detectedRows > 0 && (
          <motion.div {...fadeSlideUp} className="grid grid-cols-2 gap-3">
            <div className="text-center p-4 rounded-xl bg-white border border-slate-200">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{detectedRows.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">Rows Detected</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white border border-slate-200">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{detectedColumns.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Columns Detected</p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  // ── Render: Step 3 - Column Mapping ──
  const renderMapping = () => (
    <motion.div key="mapping" {...fadeSlideUp}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Column Mapping</h2>
          <p className="text-slate-500 mt-0.5">Review and adjust AI-detected field mappings</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="size-3.5" />
          Re-detect
        </Button>
      </div>

      <div className="grid gap-3">
        {TARGET_FIELDS.map((tf, idx) => {
          const mapping = mappings.find(m => m.targetField === tf.key);
          const mappedCol = mapping?.sourceColumn || '';
          const conf = mapping?.confidence || 0;
          const Icon = tf.icon;

          return (
            <motion.div
              key={tf.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.25 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors"
            >
              {/* Target field */}
              <div className="flex items-center gap-2.5 w-44 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon className="size-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-800">{tf.label}</span>
              </div>

              {/* Arrow */}
              <ArrowRight className="size-4 text-slate-300 shrink-0" />

              {/* Source column select */}
              <Select
                value={mappedCol}
                onValueChange={(val) => updateMapping(tf.key, val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {detectedColumns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Confidence */}
              {mappedCol && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 ${confidenceBg(conf)} ${confidenceColor(conf)}`}>
                  {conf >= 90 ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                  {conf}% confidence
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Unmapped columns notice */}
      <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-sm text-amber-700">
        <AlertCircle className="size-4 shrink-0" />
        <span>{detectedColumns.filter(c => !mappings.some(m => m.sourceColumn === c)).length} columns were not mapped. They will be imported as custom fields.</span>
      </div>
    </motion.div>
  );

  // ── Render: Step 4 - Quality Report ──
  const renderQuality = () => (
    <motion.div key="quality" {...fadeSlideUp}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Data Quality Report</h2>
        <p className="text-slate-500 mt-0.5">AI-powered analysis of your data quality</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="stat-card text-center">
          <p className="exec-stat-value">{qualitySummary.totalRows.toLocaleString()}</p>
          <p className="exec-stat-label">Total Rows</p>
        </div>
        <div className="stat-card text-center">
          <p className="exec-stat-value text-emerald-600">{qualitySummary.valid.toLocaleString()}</p>
          <p className="exec-stat-label">Valid</p>
        </div>
        <div className="stat-card text-center">
          <p className="exec-stat-value text-amber-600">{qualitySummary.duplicates}</p>
          <p className="exec-stat-label">Duplicates</p>
        </div>
        <div className="stat-card text-center">
          <p className="exec-stat-value text-red-500">{qualitySummary.missing}</p>
          <p className="exec-stat-label">Missing Data</p>
        </div>
        <div className="stat-card text-center col-span-2 md:col-span-1">
          <p className={`exec-stat-value ${qualitySummary.qualityScore >= 85 ? 'text-emerald-600' : qualitySummary.qualityScore >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
            {qualitySummary.qualityScore}%
          </p>
          <p className="exec-stat-label">Quality Score</p>
        </div>
      </div>

      {/* Quality score bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Overall Quality</span>
          <span className={`text-sm font-bold tabular-nums ${qualitySummary.qualityScore >= 85 ? 'text-emerald-600' : qualitySummary.qualityScore >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
            {qualitySummary.qualityScore}%
          </span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${qualitySummary.qualityScore}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            className={`h-full rounded-full ${qualitySummary.qualityScore >= 85 ? 'bg-emerald-500' : qualitySummary.qualityScore >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
          />
        </div>
      </div>

      {/* Per-column breakdown */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Per-Column Quality</h3>
        </div>
        <ScrollArea className="max-h-64">
          <div className="divide-y divide-slate-100">
            {qualityColumns.map((col, idx) => {
              const pct = Math.round((col.filled / qualitySummary.totalRows) * 100);
              return (
                <motion.div
                  key={col.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex items-center gap-4 px-5 py-3"
                >
                  <span className="text-sm font-medium text-slate-700 w-40 truncate shrink-0" title={col.name}>
                    {col.name}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.1 + idx * 0.04 }}
                        className={`h-full rounded-full ${pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-400'}`}
                      />
                    </div>
                  </div>
                  <span className={`text-xs font-medium tabular-nums w-10 text-right ${pct >= 90 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
                    {pct}%
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums w-20 text-right">
                    {col.filled}/{col.filled + col.empty}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );

  // ── Render: Step 5 - Preview ──
  const renderPreview = () => {
    const companiesCount = Math.floor(qualitySummary.valid * 0.4);
    const contactsCount = qualitySummary.valid - companiesCount;

    return (
      <motion.div key="preview" {...fadeSlideUp}>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Import Preview</h2>
          <p className="text-slate-500 mt-0.5">Review the first 5 rows before importing</p>
        </div>

        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 mb-6">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Will import <span className="font-bold">{companiesCount} companies</span></span>
          </div>
          <div className="w-px h-5 bg-blue-200" />
          <div className="flex items-center gap-2">
            <Users className="size-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">and <span className="font-bold">{contactsCount} contacts</span></span>
          </div>
          {qualitySummary.duplicates > 0 && (
            <>
              <div className="w-px h-5 bg-blue-200" />
              <div className="flex items-center gap-2">
                <Copy className="size-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">{qualitySummary.duplicates} duplicates detected</span>
              </div>
            </>
          )}
        </div>

        {/* Preview table */}
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <ScrollArea className="max-h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  {previewHeaders.map(h => {
                    const tf = TARGET_FIELDS.find(t => t.key === h);
                    return (
                      <TableHead key={h}>{tf?.label || h}</TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-slate-400 text-xs">{idx + 1}</TableCell>
                    {previewHeaders.map(h => (
                      <TableCell key={h} className="max-w-[200px] truncate">
                        {row[h] || <span className="text-slate-300 italic">empty</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </motion.div>
    );
  };

  // ── Render: Step 6 - Executing ──
  const renderExecuting = () => (
    <motion.div key="executing" {...fadeSlideUp}>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Importing Data</h2>
        <p className="text-slate-500 mt-1">Processing your records and generating intelligence</p>
      </div>

      <div className="max-w-lg mx-auto">
        {/* Import progress */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Import Progress</span>
            <span className="text-sm font-bold text-blue-600 tabular-nums">{executionProgress}%</span>
          </div>
          <Progress value={executionProgress} className="h-2.5" />
          <p className="text-xs text-slate-400 mt-2">
            {executionProgress < 100
              ? `Processing row ${Math.round(qualitySummary.totalRows * executionProgress / 100).toLocaleString()} of ${qualitySummary.totalRows.toLocaleString()}`
              : 'Import complete. Generating intelligence...'
            }
          </p>
        </div>

        {/* Intelligence generation tracker */}
        {executionProgress >= 100 && (
          <motion.div {...fadeSlideUp}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="size-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-slate-800">Intelligence Generation</h3>
            </div>
            <AIProgressTracker steps={intelSteps} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  // ── Render: Step 7 - Complete ──
  const renderComplete = () => (
    <motion.div key="complete" {...fadeSlideUp}>
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4"
        >
          <CheckCircle2 className="size-8 text-emerald-600" />
        </motion.div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Import Complete</h2>
        <p className="text-slate-500 mt-1">Your data has been successfully imported and enriched</p>
      </div>

      {/* Success summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center p-5 rounded-xl bg-white border border-slate-200"
        >
          <Building2 className="size-6 text-blue-600 mx-auto mb-2" />
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{completionSummary.companiesCreated}</p>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Companies Created</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center p-5 rounded-xl bg-white border border-slate-200"
        >
          <Users className="size-6 text-emerald-600 mx-auto mb-2" />
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{completionSummary.contactsImported}</p>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Contacts Imported</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center p-5 rounded-xl bg-white border border-slate-200"
        >
          <Copy className="size-6 text-amber-500 mx-auto mb-2" />
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{completionSummary.duplicatesFound}</p>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Duplicates Found</p>
        </motion.div>
      </div>

      {/* Intelligence summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-5 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100"
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-purple-600" />
          <h3 className="text-sm font-semibold text-slate-800">AI Intelligence Generated</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <CheckCircle className="size-3.5 text-emerald-500" />
            Company profiles enriched
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <CheckCircle className="size-3.5 text-emerald-500" />
            Contact scores calculated
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <CheckCircle className="size-3.5 text-emerald-500" />
            Buying signals detected
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <CheckCircle className="size-3.5 text-emerald-500" />
            Recommendations generated
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 mt-6">
        <Button variant="outline" onClick={resetWizard} className="gap-1.5">
          <RotateCcw className="size-3.5" />
          Import Another File
        </Button>
        {navigateTo && (
          <Button onClick={() => navigateTo('companies')} className="gap-1.5">
            <Eye className="size-3.5" />
            View Companies
          </Button>
        )}
      </div>
    </motion.div>
  );

  // ── Render: Navigation footer ──
  const renderFooter = () => {
    if (step === 'upload' || step === 'analysis' || step === 'executing' || step === 'complete') return null;

    const prevStep = stepIndex > 0 ? STEP_ORDER[stepIndex - 1] : null;
    const nextStep = stepIndex < STEP_ORDER.length - 1 ? STEP_ORDER[stepIndex + 1] : null;

    return (
      <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-6">
        <Button
          variant="outline"
          onClick={() => prevStep && goToStep(prevStep)}
          disabled={!prevStep}
          className="gap-1.5"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
        {step === 'preview' ? (
          <Button onClick={executeImport} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
            <Zap className="size-3.5" />
            Execute Import
          </Button>
        ) : (
          <Button
            onClick={() => nextStep && setStep(nextStep)}
            disabled={!nextStep}
            className="gap-1.5"
          >
            Continue
            <ArrowRight className="size-3.5" />
          </Button>
        )}
      </div>
    );
  };

  // ── Render: Import History ──
  const renderHistory = () => (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-slate-400" />
          <h3 className="text-base font-semibold text-slate-800">Import History</h3>
        </div>
      </div>
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <ScrollArea className="max-h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total Rows</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead className="text-right">Duplicates</TableHead>
                <TableHead className="text-right">Invalid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="size-4 text-slate-400" />
                      <span className="font-medium">{item.fileName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="size-3" />
                      {item.date}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.totalRows.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600 font-medium">{item.accepted.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums text-amber-600">{item.duplicates}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-500">{item.invalid}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );

  // ── Render: current step content ──
  const renderStepContent = () => {
    switch (step) {
      case 'upload': return renderUpload();
      case 'analysis': return renderAnalysis();
      case 'mapping': return renderMapping();
      case 'quality': return renderQuality();
      case 'preview': return renderPreview();
      case 'executing': return renderExecuting();
      case 'complete': return renderComplete();
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Step indicator - hide during analysis/executing/complete */
      {step !== 'analysis' && step !== 'executing' && step !== 'complete' ? renderStepIndicator() : null}

      {/* Wizard content */}
      <AnimatePresence mode="wait">
        {renderStepContent()}
      </AnimatePresence>

      {/* Footer navigation */}
      {renderFooter()}

      {/* Import History */}
      {renderHistory()}
    </div>
  );
}

// ── Status Badge sub-component ──
function StatusBadge({ status }: { status: ImportHistoryItem['status'] }) {
  const config: Record<string, { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200' },
    processing: { label: 'Processing', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    partial: { label: 'Partial', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  };
  const c = config[status] || config.processing;
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  );
}
