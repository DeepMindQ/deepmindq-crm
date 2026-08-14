'use client';

import { useState, useCallback, useRef } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  FileText,
  AlertCircle,
  Table2,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──
interface RecentImport {
  id: string;
  filename: string;
  records: number;
  status: 'completed' | 'failed' | 'processing';
  importedAt: string;
  type: 'csv' | 'xlsx';
}

// ── Mock Data ──
const MOCK_IMPORTS: RecentImport[] = [
  {
    id: 'i1',
    filename: 'sales_leads_q1.csv',
    records: 1247,
    status: 'completed',
    importedAt: '2025-01-20 14:32',
    type: 'csv',
  },
  {
    id: 'i2',
    filename: 'partner_contacts.xlsx',
    records: 384,
    status: 'completed',
    importedAt: '2025-01-19 09:15',
    type: 'xlsx',
  },
  {
    id: 'i3',
    filename: 'conference_attendees.csv',
    records: 526,
    status: 'failed',
    importedAt: '2025-01-18 16:45',
    type: 'csv',
  },
  {
    id: 'i4',
    filename: 'webinar_registrations.xlsx',
    records: 892,
    status: 'processing',
    importedAt: '2025-01-22 11:20',
    type: 'xlsx',
  },
  {
    id: 'i5',
    filename: 'trade_show_leads.csv',
    records: 215,
    status: 'completed',
    importedAt: '2025-01-17 08:00',
    type: 'csv',
  },
];

const MAPPING_PREVIEW = [
  { source: 'Company Name', target: 'company', confidence: 98 },
  { source: 'Email Address', target: 'email', confidence: 100 },
  { source: 'First Name', target: 'firstName', confidence: 95 },
  { source: 'Last Name', target: 'lastName', confidence: 95 },
  { source: 'Phone #', target: 'phone', confidence: 88 },
  { source: 'Job Title', target: 'title', confidence: 92 },
];

const STATUS_ICONS = {
  completed: CheckCircle2,
  failed: XCircle,
  processing: Clock,
};

const STATUS_COLORS = {
  completed: '#16A34A',
  failed: '#DC2626',
  processing: '#D97706',
};

// ── Component ──
export default function Import() {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv' || ext === 'xlsx') {
        setSelectedFile(file.name);
        toast.success(`File "${file.name}" selected for import`);
      } else {
        toast.error('Only CSV and XLSX files are supported');
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file.name);
      toast.success(`File "${file.name}" selected for import`);
    }
  }, []);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  if (loading) {
    return (
      <div
        className="p-6 space-y-6"
        style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
      >
        <div className="h-64 rounded-xl animate-pulse" style={{ background: border }} />
        <div className="h-48 rounded-xl animate-pulse" style={{ background: border }} />
      </div>
    );
  }

  return (
    <div
      className="p-6 space-y-6"
      style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
    >
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
          Import
        </h1>
        <p className="text-sm mt-1" style={{ color: textSecondary }}>
          Upload CSV or XLSX files to import leads and contacts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Upload + Format Info ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Upload Area */}
          <div
            className="rounded-xl p-8 border-2 border-dashed transition-colors cursor-pointer"
            style={{
              background: dragOver ? `${tokens.accent.primary}10` : bg,
              borderColor: dragOver ? tokens.accent.primary : border,
              boxShadow: elevation.sm,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="flex flex-col items-center gap-4">
              {selectedFile ? (
                <>
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ background: `${tokens.accent.primary}15` }}
                  >
                    <FileSpreadsheet className="w-7 h-7" style={{ color: tokens.accent.primary }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                      {selectedFile}
                    </p>
                    <p className="text-xs mt-1" style={{ color: textMuted }}>
                      Click or drop a new file to replace
                    </p>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors hover:opacity-90"
                    style={{ background: tokens.accent.primary, color: tokens.flat.white }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info('Import processing would start here');
                    }}
                  >
                    Start Import
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ background: `${tokens.accent.primary}15` }}
                  >
                    <Upload className="w-7 h-7" style={{ color: tokens.accent.primary }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                      Drop your file here or click to browse
                    </p>
                    <p className="text-xs mt-1" style={{ color: textMuted }}>
                      Supports CSV and XLSX formats up to 50MB
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Format Support Info */}
          <div
            className="rounded-xl p-5"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <h3
              className="text-sm font-semibold mb-4 flex items-center gap-2"
              style={{ color: textPrimary }}
            >
              <FileText className="h-4 w-4" style={{ color: tokens.accent.primary }} />
              Supported Formats
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  format: 'CSV',
                  desc: 'Comma-separated values. UTF-8 encoding recommended.',
                  icon: FileText,
                  color: '#16A34A',
                },
                {
                  format: 'XLSX',
                  desc: 'Microsoft Excel format. First sheet will be imported.',
                  icon: FileSpreadsheet,
                  color: '#D97706',
                },
              ].map((f) => (
                <div
                  key={f.format}
                  className="flex items-start gap-3 p-3 rounded-lg"
                  style={{ background: tokens.surface.secondary }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${f.color}15` }}
                  >
                    <f.icon className="w-4 h-4" style={{ color: f.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: textPrimary }}>
                      {f.format}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div
              className="mt-4 p-3 rounded-lg flex items-start gap-2"
              style={{ background: '#FEF3C720' }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#D97706' }} />
              <p className="text-xs" style={{ color: textSecondary }}>
                Auto-mapping will attempt to match column headers to system fields. Review the
                mapping preview before confirming import.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Mapping Preview + Recent Imports ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mapping Preview */}
          <div
            className="rounded-xl p-5"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <h3
              className="text-sm font-semibold mb-4 flex items-center gap-2"
              style={{ color: textPrimary }}
            >
              <Table2 className="h-4 w-4" style={{ color: tokens.accent.primary }} />
              Mapping Preview
            </h3>
            <div className="space-y-2">
              {MAPPING_PREVIEW.map((m) => (
                <div
                  key={m.target}
                  className="flex items-center justify-between p-2.5 rounded-lg"
                  style={{ background: tokens.surface.secondary }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium truncate" style={{ color: textPrimary }}>
                      {m.source}
                    </span>
                    <ArrowRight className="w-3 h-3 shrink-0" style={{ color: textMuted }} />
                    <span className="text-xs truncate" style={{ color: tokens.accent.primary }}>
                      {m.target}
                    </span>
                  </div>
                  <span
                    className="text-xs font-medium shrink-0 ml-2"
                    style={{ color: m.confidence >= 95 ? '#16A34A' : '#D97706' }}
                  >
                    {m.confidence}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Imports */}
          <div
            className="rounded-xl p-5"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
              Recent Imports
            </h3>
            <div className="space-y-3">
              {MOCK_IMPORTS.map((imp) => {
                const StatusIcon = STATUS_ICONS[imp.status];
                const color = STATUS_COLORS[imp.status];
                return (
                  <div
                    key={imp.id}
                    className="flex items-start gap-3 p-3 rounded-lg"
                    style={{ background: tokens.surface.secondary }}
                  >
                    <StatusIcon className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: textPrimary }}>
                        {imp.filename}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                        {imp.records.toLocaleString()} records · {imp.importedAt}
                      </p>
                    </div>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: `${color}15`, color }}
                    >
                      {imp.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
