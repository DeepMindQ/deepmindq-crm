'use client';

import React, { type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Upload, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { STATUS_CONFIG } from './import-types';

/* ══════════════════════════════════════════════════════════════
   Upload Zone Component
   ══════════════════════════════════════════════════════════════ */

export interface UploadZoneProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  dragActive: boolean;
  uploadState: {
    status: 'idle' | 'uploading' | 'success' | 'error';
    progress: number;
    fileName: string;
    error: string;
  };
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearError: () => void;
}

export function UploadZone({
  fileInputRef,
  dragActive,
  uploadState,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileInput,
  clearError,
}: UploadZoneProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl transition-all duration-200',
        uploadState.status === 'uploading' && 'pointer-events-none',
      )}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      onClick={() => {
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
        accept={Object.keys({
          'text/csv': ['.csv'],
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
          'application/vnd.ms-excel': ['.xls'],
          'application/json': ['.json'],
        }).join(',')}
        onChange={onFileInput}
        className="hidden"
        aria-hidden="true"
      />

      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
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

        {uploadState.status === 'uploading' && (
          <>
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: tokens.accent.ghost }}
            >
              <Loader2
                className="h-8 w-8"
                style={{ color: tokens.accent.DEFAULT, animation: 'spin 1s linear infinite' }}
              />
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

        {uploadState.status === 'success' && (
          <>
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: STATUS_CONFIG.completed.bg }}
            >
              <CheckCircle2 className="h-8 w-8" style={{ color: STATUS_CONFIG.completed.color }} />
            </div>
            <p
              className="text-base font-semibold mb-1"
              style={{ color: STATUS_CONFIG.completed.color }}
            >
              Upload successful
            </p>
            <p className="text-sm" style={{ color: tokens.text.secondary }}>
              {uploadState.fileName} is now being processed.
            </p>
          </>
        )}

        {uploadState.status === 'error' && (
          <>
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: STATUS_CONFIG.failed.bg }}
            >
              <AlertCircle className="h-8 w-8" style={{ color: STATUS_CONFIG.failed.color }} />
            </div>
            <p
              className="text-base font-semibold mb-1"
              style={{ color: STATUS_CONFIG.failed.color }}
            >
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
              <Trash2 className="h-3 w-3" /> Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
