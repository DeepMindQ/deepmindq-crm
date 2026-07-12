'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Eye, FileSpreadsheet, X, CheckCircle2, AlertCircle } from 'lucide-react';

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

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  processing: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  draft: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export default function ImportScreen() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; details?: { total: number; accepted: number; duplicates: number; invalid: number } } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/batches')
      .then(r => r.json())
      .then(d => { setBatches(Array.isArray(d) ? d : d.batches || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/batches', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadResult({
          success: true,
          message: `Imported ${data.batch.acceptedRows} of ${data.batch.totalRows} rows`,
          details: { total: data.batch.totalRows, accepted: data.batch.acceptedRows, duplicates: data.batch.duplicateRows, invalid: data.batch.invalidRows },
        });
      } else {
        setUploadResult({ success: false, message: data.error || 'Upload failed' });
      }
      // Refresh batch list
      const batchRes = await fetch('/api/batches');
      const d = await batchRes.json();
      setBatches(Array.isArray(d) ? d : d.batches || []);
    } catch {
      setUploadResult({ success: false, message: 'Network error — please try again.' });
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1">
      {/* ── Upload Area ── */}
      <Card className="bg-card border border-border">
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-10 h-10 text-muted-foreground" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {uploading ? 'Processing file...' : 'Upload CSV or Excel'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {uploading ? 'Parsing rows, detecting duplicates, scoring leads...' : 'Drag & drop or click to browse. Supports .csv, .xlsx, .xls'}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Upload Result Banner ── */}
      {uploadResult && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${
          uploadResult.success
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          {uploadResult.success
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            : <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          }
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${uploadResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
              {uploadResult.success ? 'Import Complete' : 'Import Failed'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{uploadResult.message}</p>
            {uploadResult.details && (
              <div className="flex gap-4 mt-2">
                <span className="text-xs text-muted-foreground">Total: <span className="text-foreground font-medium tabular-nums">{uploadResult.details.total}</span></span>
                <span className="text-xs text-muted-foreground">Accepted: <span className="text-emerald-400 font-medium tabular-nums">{uploadResult.details.accepted}</span></span>
                <span className="text-xs text-muted-foreground">Duplicates: <span className="text-amber-400 font-medium tabular-nums">{uploadResult.details.duplicates}</span></span>
                <span className="text-xs text-muted-foreground">Invalid: <span className="text-red-400 font-medium tabular-nums">{uploadResult.details.invalid}</span></span>
              </div>
            )}
          </div>
          <button onClick={() => setUploadResult(null)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Batch History ── */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Import History
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs">Filename</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Total Rows</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Accepted</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Duplicates</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Invalid</TableHead>
                <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Date</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map(b => (
                <TableRow key={b.id} className="border-border">
                  <TableCell className="text-foreground text-sm font-medium max-w-[180px] truncate">{b.fileName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm text-right tabular-nums">{b.totalRows}</TableCell>
                  <TableCell className="text-foreground text-sm text-right tabular-nums">{b.acceptedRows}</TableCell>
                  <TableCell className="text-amber-400 text-sm text-right tabular-nums">{b.duplicateRows}</TableCell>
                  <TableCell className="text-red-400 text-sm text-right tabular-nums">{b.invalidRows}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[b.status] || STATUS_COLORS.draft}>
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs text-right whitespace-nowrap">{b.createdAt}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary hover:text-primary/80"
                      onClick={() => setSelectedBatch(b)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {batches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground text-sm text-center py-8">
                    No imports yet. Upload a file to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Batch Detail Dialog ── */}
      <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
        <DialogContent className="bg-card border border-border text-foreground max-w-md">
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Filename</p>
                  <p className="text-foreground font-medium">{selectedBatch.fileName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant="outline" className={STATUS_COLORS[selectedBatch.status] || STATUS_COLORS.draft}>
                    {selectedBatch.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total Rows</p>
                  <p className="text-foreground font-medium tabular-nums">{selectedBatch.totalRows}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Accepted</p>
                  <p className="text-emerald-400 font-medium tabular-nums">{selectedBatch.acceptedRows}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Duplicates</p>
                  <p className="text-amber-400 font-medium tabular-nums">{selectedBatch.duplicateRows}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Invalid</p>
                  <p className="text-red-400 font-medium tabular-nums">{selectedBatch.invalidRows}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Imported: {selectedBatch.createdAt}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}