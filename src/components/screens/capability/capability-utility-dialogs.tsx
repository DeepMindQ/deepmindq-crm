'use client';

import { useRef } from 'react';
import { Upload, FileText, CheckCircle2, X, Plus, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GlassDialog, goldAlpha, redAlpha, greenAlpha, CAT_ICON, CAT_BADGE, CAT_LABEL } from './capability-shared';

/* -- Upload result type -- */
export interface UploadResult {
  fileName: string;
  success?: boolean;
  error?: string;
  assetsGenerated?: number;
  duplicates?: Array<{ existingId: string; title: string }>;
}

/* ======== Upload Dialog ======== */
interface UploadDialogProps {
  open: boolean;
  uploading: boolean;
  uploadResults: UploadResult[];
  onClose: () => void;
  onFileUpload: (files: FileList | File[]) => void;
  onDrop: (e: React.DragEvent) => void;
  onCreateFromUpload: (result: UploadResult) => void;
}

export function UploadDialog({ open, uploading, uploadResults, onClose, onFileUpload, onDrop, onCreateFromUpload }: UploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!open) return null;

  return (
    <GlassDialog
      title="Upload Documents"
      subtitle="Extract content from one or more files (supports .txt, .md, .pdf, .docx)"
      onClose={onClose}
    >
      <div
        className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer group/drop bg-gray-50/50 hover:bg-gray-50"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.docx"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files && e.target.files.length > 0) onFileUpload(e.target.files);
            e.target.value = '';
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Extracting text...</p>
          </div>
        ) : (
          <>
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-transform duration-300 group-hover/drop:scale-110"
              style={{ background: `linear-gradient(135deg, ${goldAlpha(0.15)}, ${goldAlpha(0.03)})` }}
            >
              <Upload className="w-6 h-6" style={{ color: 'var(--color-gold)' }} />
            </div>
            <p className="text-sm font-medium text-foreground">Drag and drop or click to upload</p>
            <p className="text-xs text-muted-foreground mt-1.5">.txt, .md, .pdf, .docx — multiple files supported</p>
          </>
        )}
      </div>

      {uploadResults.length > 0 && (
        <div className="mt-5 space-y-3 max-h-72 overflow-y-auto">
          <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" />
            Results ({uploadResults.length} file{uploadResults.length !== 1 ? 's' : ''})
          </p>
          {uploadResults.map((r, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: r.error ? `${redAlpha(0.1)}` : `${greenAlpha(0.1)}` }}>
                {r.error ? <X className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.fileName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.error
                    ? r.error
                    : `${r.assetsGenerated || 0} assets extracted${((r.duplicates as any[])?.length || 0) > 0 ? ` • ${(r.duplicates as any[]).length} duplicate(s)` : ''}`}
                </p>
              </div>
              {r.success && (
                <Button variant="ghost" size="sm" className="h-10 text-xs text-primary hover:text-primary/80 shrink-0 min-h-[44px]"
                  onClick={() => onCreateFromUpload(r)}>
                  <Plus className="w-3 h-3 mr-1" />Use
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </GlassDialog>
  );
}

/* ======== Enrich Dialog ======== */
interface EnrichDialogProps {
  open: boolean;
  enrichUrl: string;
  enrichLoading: boolean;
  enrichSaving: boolean;
  enrichResult: any;
  onClose: () => void;
  onUrlChange: (url: string) => void;
  onEnrich: () => void;
  onSaveAll: () => void;
}

export function EnrichDialog({ open, enrichUrl, enrichLoading, enrichSaving, enrichResult, onClose, onUrlChange, onEnrich, onSaveAll }: EnrichDialogProps) {
  if (!open) return null;
  return (
    <GlassDialog
      title="Enrich from Website"
      subtitle="AI-powered knowledge extraction from any webpage"
      onClose={onClose}
      actions={enrichResult?.assets?.length ? (
        <Button size="sm" onClick={onSaveAll} disabled={enrichSaving} className="text-sm shadow-lg shadow-primary/10">
          {enrichSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3 h-3 mr-1.5" />}
          Save All ({enrichResult.assets.length} assets)
        </Button>
      ) : undefined}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/services"
            value={enrichUrl}
            onChange={e => onUrlChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onEnrich()}
            className="h-10 text-sm bg-gray-50 border-gray-200 focus:border-primary/40 flex-1"
          />
          <Button size="sm" onClick={onEnrich} disabled={enrichLoading || !enrichUrl.trim()} className="h-10 text-xs gap-1.5">
            {enrichLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {enrichLoading ? 'Extracting...' : 'Extract'}
          </Button>
        </div>

        {enrichResult?.success && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{enrichResult.pageTitle}</p>
                <p className="text-[11px] text-muted-foreground">{enrichResult.overallSummary?.slice(0, 120)}</p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {enrichResult.assets?.map((asset: any, idx: number) => {
                const CatIcon = CAT_ICON[asset.category] || FileText;
                return (
                  <div key={idx} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CatIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium text-foreground truncate">{asset.title}</p>
                      <Badge variant="outline" className={`text-[9px] ml-auto shrink-0 ${CAT_BADGE[asset.category] || ''}`}>
                        {CAT_LABEL[asset.category] || asset.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{asset.summary}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </GlassDialog>
  );
}

/* ======== Import Dialog ======== */
interface ImportDialogProps {
  open: boolean;
  importLoading: boolean;
  importResult: any;
  onClose: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ImportDialog({ open, importLoading, importResult, onClose, onImport }: ImportDialogProps) {
  if (!open) return null;
  return (
    <GlassDialog
      title="Import Capabilities"
      subtitle="Upload a JSON or CSV file with capability assets"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div
          className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer"
          onClick={() => document.getElementById('import-file-input')?.click()}
        >
          <input
            id="import-file-input"
            type="file"
            accept=".json,.csv"
            className="hidden"
            onChange={onImport}
          />
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{importLoading ? 'Importing...' : 'Click to select JSON or CSV'}</p>
          {importLoading && <Loader2 className="w-4 h-4 animate-spin text-primary mx-auto mt-2" />}
        </div>

        {importResult && (
          <div className="space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-emerald-600">{importResult.created}</p>
                <p className="text-[11px] text-muted-foreground">Created</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{importResult.skipped}</p>
                <p className="text-[11px] text-muted-foreground">Skipped</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-600">{importResult.errors}</p>
                <p className="text-[11px] text-muted-foreground">Errors</p>
              </div>
            </div>
            {importResult.skippedDetails?.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto">
                {importResult.skippedDetails.slice(0, 5).map((d: any, i: number) => (
                  <p key={i} className="text-[11px] text-muted-foreground">⊘ {d.title}: {d.reason}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </GlassDialog>
  );
}

/* ======== Delete Confirmation ======== */
interface DeleteConfirmDialogProps {
  open: boolean;
  onDelete: () => void;
  onClose: () => void;
}

export function DeleteConfirmDialog({ open, onDelete, onClose }: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <AlertDialogTitle>Delete Capability</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pl-[52px]">
            Are you sure you want to delete this capability? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700 text-white">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
