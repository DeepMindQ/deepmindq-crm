'use client';

import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

export type IngestionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
export type IngestionFileType = 'csv' | 'xlsx' | 'xls' | 'json';

export interface IngestionRecord {
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

export const ACCEPTED_TYPES: Record<string, string[]> = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/json': ['.json'],
};

export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.json'];

export const STATUS_CONFIG: Record<
  IngestionStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ElementType }
> = {
  pending: { label: 'Pending', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: Clock },
  processing: {
    label: 'Processing',
    color: '#2563EB',
    bg: '#DBEAFE',
    border: '#93C5FD',
    icon: Loader2,
  },
  completed: {
    label: 'Completed',
    color: '#16A34A',
    bg: '#DCFCE7',
    border: '#BBF7D0',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    color: '#DC2626',
    bg: '#FEE2E2',
    border: '#FECACA',
    icon: AlertCircle,
  },
  partial: {
    label: 'Partial',
    color: '#EA580C',
    bg: '#FFEDD5',
    border: '#FED7AA',
    icon: AlertTriangle,
  },
};

export const FILE_TYPE_ICONS: Record<string, React.ElementType> = {
  csv: FileText,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  json: FileJson,
};

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

export function getAcceptedMimeTypes(): string {
  return Object.keys(ACCEPTED_TYPES).join(',');
}

export function getAcceptedExtensionsStr(): string {
  return ACCEPTED_EXTENSIONS.join(',');
}
