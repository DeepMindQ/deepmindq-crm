'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Eye, FileSpreadsheet, X, CheckCircle2, AlertCircle, Database, Rows3, CheckCircle, Inbox } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/batches')
      .then(r => r.json())
      .then(d => {
        setBatches(Array.isArray(d) ? d : d.batches || []);
        setLoading(false);
      })
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
          details: {
            total: data.batch.totalRows,
            accepted: data.batch.acceptedRows,
            duplicates: data.batch.duplicateRows,
            invalid: data.batch.invalidRows,
          },
        });
      } else {
        setUploadResult({ success: false, message: data.error || 'Upload failed' });
      }
      // Refresh batch list
      const batchRes = await fetch('/api/batches');
      const d = await batchRes.json();
      setBatches(Array.isArray(d) ? d : d.batches || []);
    } catch {
      setUploadResult({ success: false, message: 'Network error - please try again.' });
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

  // Aggregate stats from batch data
  const stats = useMemo(() => {
    const totalImports = batches.length;
    const totalRows = batches.reduce((sum, b) => sum + b.totalRows, 0);
    const totalAccepted = batches.reduce((sum, b) => sum + b.acceptedRows, 0);
    return { totalImports, totalRows, totalAccepted };
  }, [batches]);

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
            {/* Animated gradient border */}
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
            {/* Shimmer sweep overlay */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
                backgroundSize: '200% 100%',
              }}
              animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
            />
            <GlassPanel className="relative z-10 rounded-[14px]">
              <div className="p-8">
                <motion.div
                  className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 transition-all duration-300 cursor-pointer ${
                    dragOver
                      ? 'border-primary/80 bg-primary/[0.06] scale-[1.01]'
                      : 'border-white/[0.12] hover:border-primary/40 hover:bg-white/[0.02]'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  whileTap={{ scale: 0.99 }}
                >
                  {uploading ? (
                    <motion.div
                      className="relative w-14 h-14"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <div className="absolute inset-0 rounded-full border-[3px] border-primary/30" />
                      <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary" />
                      <div className="absolute inset-2 rounded-full border-[3px] border-transparent border-b-blue-400" style={{ animationDirection: 'reverse' }} />
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
                      {uploading ? (
                        <ShimmerText>Processing file...</ShimmerText>
                      ) : (
                        'Upload CSV or Excel'
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                      {uploading
                        ? 'Parsing rows, detecting duplicates, scoring leads...'
                        : 'Drag and drop or click to browse. Supports .csv, .xlsx, .xls'}
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

        {/* Upload Result Banner - Glassmorphism with glow */}
        <AnimatePresence>
          {uploadResult && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative rounded-2xl p-[1px] overflow-hidden">
                {/* Glow border */}
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
                    uploadResult.success
                      ? 'bg-emerald-500/[0.06]'
                      : 'bg-red-500/[0.06]'
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
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                        className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0"
                        style={{ boxShadow: '0 0 16px rgba(239,68,68,0.2)' }}
                      >
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      </motion.div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          uploadResult.success ? 'text-emerald-300' : 'text-red-300'
                        }`}
                      >
                        {uploadResult.success ? 'Import Complete' : 'Import Failed'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{uploadResult.message}</p>
                      {uploadResult.details && (
                        <div className="flex gap-6 mt-3">
                          <span className="text-sm text-muted-foreground">
                            Total:{' '}
                            <span className="text-foreground font-semibold tabular-nums">
                              {uploadResult.details.total}
                            </span>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Accepted:{' '}
                            <span className="text-emerald-400 font-semibold tabular-nums">
                              {uploadResult.details.accepted}
                            </span>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Duplicates:{' '}
                            <span className="text-amber-400 font-semibold tabular-nums">
                              {uploadResult.details.duplicates}
                            </span>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Invalid:{' '}
                            <span className="text-red-400 font-semibold tabular-nums">
                              {uploadResult.details.invalid}
                            </span>
                          </span>
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
                    <button
                      onClick={() => setUploadResult(null)}
                      className="text-muted-foreground hover:text-foreground shrink-0 mt-1 transition-colors"
                    >
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
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      Filename
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">
                      Total Rows
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">
                      Accepted
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">
                      Duplicates
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">
                      Invalid
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">
                      Date
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b, i) => (
                    <motion.tr
                      key={b.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                      className="border-white/[0.04] group transition-colors duration-200 hover:bg-white/[0.03]"
                    >
                      <TableCell className="text-foreground text-sm font-medium max-w-[180px] truncate">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                          <span className="truncate">{b.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm text-right tabular-nums group-hover:text-foreground/80 transition-colors">
                        {b.totalRows}
                      </TableCell>
                      <TableCell className="text-foreground text-sm text-right tabular-nums font-medium">
                        {b.acceptedRows}
                      </TableCell>
                      <TableCell className="text-amber-400 text-sm text-right tabular-nums">
                        {b.duplicateRows}
                      </TableCell>
                      <TableCell className="text-red-400 text-sm text-right tabular-nums">
                        {b.invalidRows}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[b.status] || STATUS_COLORS.draft}
                        >
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs text-right whitespace-nowrap group-hover:text-foreground/60 transition-colors">
                        {b.createdAt}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary hover:text-primary/80 hover:bg-primary/10"
                            onClick={() => setSelectedBatch(b)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View
                          </Button>
                          {navigateTo && b.acceptedRows > 0 && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateTo('leads');
                              }}
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
          <DialogContent className="bg-card/95 backdrop-blur-xl border border-white/[0.08] text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  Batch Details
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setSelectedBatch(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            {selectedBatch && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">
                      Filename
                    </p>
                    <p className="text-foreground font-medium">{selectedBatch.fileName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">
                      Status
                    </p>
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[selectedBatch.status] || STATUS_COLORS.draft}
                    >
                      {selectedBatch.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">
                      Total Rows
                    </p>
                    <p className="text-foreground font-medium tabular-nums text-lg">
                      {selectedBatch.totalRows}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">
                      Accepted
                    </p>
                    <p className="text-emerald-400 font-medium tabular-nums text-lg">
                      {selectedBatch.acceptedRows}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">
                      Duplicates
                    </p>
                    <p className="text-amber-400 font-medium tabular-nums text-lg">
                      {selectedBatch.duplicateRows}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">
                      Invalid
                    </p>
                    <p className="text-red-400 font-medium tabular-nums text-lg">
                      {selectedBatch.invalidRows}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/[0.06]">
                  <p className="text-xs text-muted-foreground">
                    Imported: {selectedBatch.createdAt}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}