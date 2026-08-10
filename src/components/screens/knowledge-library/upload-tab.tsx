'use client';

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AnimatedCard } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Upload, FileText, Sparkles, X, Loader2, CheckCircle2, AlertTriangle, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORY_CONFIG, CATEGORY_LABELS, SERVICE_LINE_LIST, goldAlpha, greenAlpha } from './knowledge-types';

export function UploadTab({ onAssetsChanged }: { onAssetsChanged: () => void }) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading' | 'extracting' | 'generating' | 'done' | 'error'>('idle');
  const [uploadResult, setUploadResult] = useState<{
    extractedText: string; fileName: string; wordCount: number; readingTime: number;
    aiExtractionUsed: boolean; overallSummary: string; assetsGenerated: number;
    assets: Array<Record<string, unknown>>;
  } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [savingExtracted, setSavingExtracted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gold = 'var(--color-gold-dim)';
  const goldLight = 'var(--color-gold)';

  const handleUpload = useCallback(async () => {
    const filesToUpload = uploadFiles.length > 0 ? uploadFiles : (uploadFile ? [uploadFile] : []);
    if (filesToUpload.length === 0) return;
    setUploadLoading(true); setUploadError(''); setUploadResult(null); setUploadStep('uploading');
    try {
      const formData = new FormData();
      filesToUpload.forEach(f => formData.append('file', f));
      formData.append('autoGenerate', 'true');
      const res = await fetch('/api/capabilities/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadStep('done');
      if (data.totalFiles > 1) {
        const firstResult = data.results?.[0] || {};
        setUploadResult({ extractedText: firstResult.extractedText || '', fileName: `${data.totalFiles} files uploaded`, wordCount: (data.results || []).reduce((s: number, r: any) => s + (r.wordCount || 0), 0), readingTime: Math.max(1, Math.ceil(((data.results || []).reduce((s: number, r: any) => s + (r.wordCount || 0), 0)) / 200)), aiExtractionUsed: (data.results || []).some((r: any) => r.aiExtractionUsed), overallSummary: data.totalAssetsGenerated > 0 ? `Generated ${data.totalAssetsGenerated} assets from ${data.totalFiles} files` : '', assetsGenerated: data.totalAssetsGenerated || 0, assets: (data.results || []).flatMap((r: any) => r.assets || []), });
      } else {
        setUploadResult({ extractedText: data.extractedText || '', fileName: data.fileName || uploadFile?.name || filesToUpload[0]?.name || '', wordCount: data.wordCount || 0, readingTime: data.readingTime || 1, aiExtractionUsed: data.aiExtractionUsed || false, overallSummary: data.overallSummary || '', assetsGenerated: data.assetsGenerated || 0, assets: data.assets || [], });
      }
      const totalAssets = data.totalAssetsGenerated ?? data.assetsGenerated ?? 0;
      if (totalAssets > 0) { toast.success(`${totalAssets} knowledge asset${totalAssets > 1 ? 's' : ''} generated from "${filesToUpload.length} file${filesToUpload.length > 1 ? 's' : ''}"`); onAssetsChanged(); }
      else { toast.success(`Text extracted from ${filesToUpload.length} file${filesToUpload.length > 1 ? 's' : ''}`); }
      setUploadFile(null); setUploadFiles([]);
    } catch (err) {
      setUploadStep('error'); setUploadError(err instanceof Error ? err.message : 'Upload failed'); toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploadLoading(false);
  }, [uploadFile, uploadFiles, onAssetsChanged]);

  const handleSaveExtracted = useCallback(async () => {
    if (!uploadResult?.extractedText) return; setSavingExtracted(true);
    try {
      const nameWithoutExt = uploadResult.fileName.replace(/\.[^/.]+$/, '');
      const maxChunkLen = 2000; const text = uploadResult.extractedText; const chunks: string[] = [];
      if (text.length <= maxChunkLen) { chunks.push(text); }
      else { const paragraphs = text.split(/\n\n+/).filter(Boolean); let current = ''; for (const para of paragraphs) { if ((current + '\n\n' + para).length > maxChunkLen && current) { chunks.push(current.trim()); current = para; } else { current = current ? current + '\n\n' + para : para; } } if (current.trim()) chunks.push(current.trim()); }
      for (let i = 0; i < chunks.length; i++) {
        const suffix = chunks.length > 1 ? ` (Part ${i + 1}/${chunks.length})` : '';
        await fetch('/api/capabilities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: nameWithoutExt + suffix, summary: chunks[i].slice(0, 200).trim() + (chunks[i].length > 200 ? '...' : ''), content: chunks[i], category: 'service_line' }) });
      }
      toast.success(`Manually saved ${chunks.length} asset${chunks.length > 1 ? 's' : ''} to knowledge base`); onAssetsChanged();
    } catch { toast.error('Failed to save knowledge asset'); }
    setSavingExtracted(false);
  }, [uploadResult, onAssetsChanged]);

  return (
    <div className="space-y-4">
      <AnimatedCard delay={0.1}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.2)}, ${goldAlpha(0.05)})` }}><Upload className="w-4.5 h-4.5" style={{ color: gold }} /></div>
            <div><h3 className="text-sm font-semibold text-foreground">Document Upload & AI Knowledge Extraction</h3><p className="text-xs text-muted-foreground">Upload a document — text is extracted, analyzed by AI, and automatically saved as structured knowledge assets for RAG retrieval</p></div>
          </div>
          {uploadLoading && (
            <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center gap-3"><Loader2 className="w-4 h-4 animate-spin" style={{ color: gold }} /><span className="text-sm text-foreground font-medium">{uploadStep === 'uploading' && 'Uploading document...'}{uploadStep === 'extracting' && 'Extracting text content...'}{uploadStep === 'generating' && 'AI is analyzing and generating knowledge assets...'}</span></div>
              <div className="space-y-1.5">
                {[{ label: 'Upload file', done: ['extracting', 'generating', 'done'].includes(uploadStep) }, { label: 'Extract text', done: ['generating', 'done'].includes(uploadStep) }, { label: 'AI knowledge generation', done: uploadStep === 'done' }, { label: 'Save to knowledge base', done: uploadStep === 'done' }].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">{step.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}<span className={`text-xs ${step.done ? 'text-emerald-600' : 'text-muted-foreground'}`}>{step.label}</span></div>
                ))}
              </div>
            </div>
          )}
          {uploadStep === 'error' && (<div className="mt-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /><div><p className="text-sm text-red-600 font-medium">Upload failed</p><p className="text-xs text-muted-foreground mt-0.5">{uploadError}</p></div></div>)}
          <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mt-4 ${uploadLoading ? 'border-border/50 opacity-50 pointer-events-none' : 'border-border hover:border-primary/30'}`} onClick={() => !uploadLoading && fileInputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (uploadLoading) return; const files = Array.from(e.dataTransfer.files); if (files.length === 1) { setUploadFile(files[0]); setUploadFiles([]); } else if (files.length > 1) { setUploadFiles(files); setUploadFile(null); } }}>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []); if (files.length === 1) { setUploadFile(files[0]); setUploadFiles([]); } else if (files.length > 1) { setUploadFiles(files); setUploadFile(null); } }} />
            <Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">{uploadFiles.length > 0 ? `${uploadFiles.length} files selected` : uploadFile ? uploadFile.name : 'Click to upload or drag and drop'}</p>
            <p className="text-[11px] text-muted-foreground/60">Supports .txt, .md, .pdf, .docx (max 25MB) — multiple files supported</p>
          </div>
          {!uploadLoading && (uploadFile || uploadFiles.length > 0) && (
            <div className="mt-4 space-y-2">
              {uploadFile && (<div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50"><div className="flex items-center gap-3"><FileText className="w-4 h-4" style={{ color: gold }} /><div><p className="text-xs font-medium text-foreground">{uploadFile.name}</p><p className="text-[11px] text-muted-foreground">{(uploadFile.size / 1024).toFixed(1)} KB</p></div></div><div className="flex items-center gap-2"><Button size="sm" className="h-10 text-xs gap-1.5 min-h-[44px]" style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: 'var(--dmq-black)' }} onClick={handleUpload}><Sparkles className="w-3.5 h-3.5" />Upload & Generate</Button><button onClick={() => { setUploadFile(null); setUploadStep('idle'); setUploadResult(null); setUploadError(''); }} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" aria-label="Remove file"><X className="w-3.5 h-3.5" /></button></div></div>)}
              {uploadFiles.length > 0 && (<div className="p-3 rounded-lg border border-border bg-card/50"><div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-foreground">{uploadFiles.length} files selected</span><button onClick={() => { setUploadFiles([]); setUploadStep('idle'); setUploadResult(null); setUploadError(''); }} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" aria-label="Clear selected files"><X className="w-3.5 h-3.5" /></button></div><div className="max-h-32 overflow-y-auto space-y-1 mb-3">{uploadFiles.map((f, i) => (<div key={i} className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="w-3 h-3" style={{ color: gold }} /><span className="flex-1 truncate">{f.name}</span><span>{(f.size / 1024).toFixed(1)} KB</span></div>))}</div><Button size="sm" className="h-10 text-xs gap-1.5 w-full min-h-[44px]" style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: 'var(--dmq-black)' }} onClick={handleUpload}><Sparkles className="w-3.5 h-3.5" />Upload & Generate from {uploadFiles.length} Files</Button></div>)}
            </div>
          )}
        </div>
      </AnimatedCard>
      {uploadResult && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <AnimatedCard delay={0.15}><div className="p-4"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: uploadResult.aiExtractionUsed ? `${greenAlpha(0.15)}` : `${goldAlpha(0.1)}` }}>{uploadResult.aiExtractionUsed ? <Sparkles className="w-4.5 h-4.5 text-emerald-600" /> : <FileText className="w-4.5 h-4.5" style={{ color: gold }} />}</div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-foreground">{uploadResult.aiExtractionUsed ? `AI extracted ${uploadResult.assetsGenerated} knowledge asset${uploadResult.assetsGenerated !== 1 ? 's' : ''} and saved to knowledge base` : `Text extracted (${uploadResult.wordCount.toLocaleString()} words, ~${uploadResult.readingTime} min read)`}</p>{uploadResult.overallSummary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{uploadResult.overallSummary}</p>}<div className="flex items-center gap-3 mt-2"><Badge variant="outline" className="text-[11px] border-border text-muted-foreground">{uploadResult.fileName}</Badge><Badge variant="outline" className="text-[11px] border-border text-muted-foreground">{uploadResult.wordCount.toLocaleString()} words</Badge>{uploadResult.aiExtractionUsed && <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-600"><Sparkles className="w-2.5 h-2.5 mr-1" />AI-Powered</Badge>}</div></div><button onClick={() => { setUploadResult(null); setUploadStep('idle'); }} className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors shrink-0" aria-label="Close result"><X className="w-3.5 h-3.5" /></button></div></div></AnimatedCard>
          {uploadResult.assets.length > 0 && (<div className="space-y-2"><p className="text-xs text-muted-foreground font-medium px-1">Generated Knowledge Assets</p>{uploadResult.assets.map((asset, i) => {const cat = String(asset.category || 'service_line'); const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.service_line; const Icon = config.icon; return (<motion.div key={String(asset.id) || `gen-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="p-3 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-colors"><div className="flex items-start gap-3"><div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${config.color}15` }}><Icon className="w-3.5 h-3.5" style={{ color: config.color }} /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><p className="text-xs font-medium text-foreground truncate">{String(asset.title || 'Untitled')}</p><CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /></div><p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{String(asset.summary || '')}</p><div className="flex items-center gap-1.5 flex-wrap mt-2"><Badge variant="outline" className={`text-[11px] ${config.badge}`}>{CATEGORY_LABELS[cat] || cat}</Badge>{!!asset.serviceLine && <Badge variant="outline" className="text-[11px] border-border text-muted-foreground">{String(asset.serviceLine)}</Badge>}{!!asset.targetIndustries && <Badge variant="outline" className="text-[11px] border-border text-muted-foreground"><Globe className="w-2.5 h-2.5 mr-0.5" />{String(asset.targetIndustries).split(',').slice(0, 2).join(', ')}</Badge>}</div></div></div></motion.div>);})}</div>)}
          {uploadResult.assets.length === 0 && uploadResult.extractedText && (
            <AnimatedCard delay={0.2}><div className="p-4 space-y-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /><p className="text-xs text-amber-600 font-medium">No knowledge assets were auto-generated</p></div><Button size="sm" className="h-10 text-xs gap-1.5 min-h-[44px]" style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: 'var(--dmq-black)' }} onClick={handleSaveExtracted} disabled={savingExtracted}>{savingExtracted ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}{savingExtracted ? 'Saving...' : 'Manually Save to Knowledge Base'}</Button></div><div className="p-3 rounded-lg bg-muted/30 border border-border/50"><p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{uploadResult.extractedText}</p></div></div></AnimatedCard>
          )}
        </motion.div>
      )}
    </div>
  );
}
