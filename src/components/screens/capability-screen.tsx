'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PageTransition, AnimatedCard, StaggerGrid, StaggerItem, SectionHeader, TabBar } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Layers, BookOpen, Trophy, MessageSquare, Target, Tag, Eye,
  Plus, Upload, Search, Pencil, Trash2, X, FileText,
} from 'lucide-react';

/* ── Types ── */
interface Capability {
  id: string;
  title: string;
  summary: string;
  category: string;
  serviceLine?: string | null;
  targetIndustries?: string | null;
  targetRoles?: string | null;
  problems?: string | null;
  evidence?: string | null;
  content?: string | null;
  isActive: boolean;
  version?: number;
}

interface CapabilityScreenProps {
  navigateTo?: (screen: string) => void;
}

/* ── Constants ── */
const TABS = [
  { value: 'all', label: 'All' },
  { value: 'service_line', label: 'Service Lines' },
  { value: 'case_study', label: 'Case Studies' },
  { value: 'proof_point', label: 'Proof Points' },
  { value: 'objection_response', label: 'Objections' },
  { value: 'cta', label: 'CTAs' },
];

const CAT_ICON: Record<string, typeof Tag> = {
  service_line: Layers, case_study: BookOpen, proof_point: Trophy,
  objection_response: MessageSquare, cta: Target,
};
const CAT_BADGE: Record<string, string> = {
  service_line: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  case_study: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  proof_point: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  objection_response: 'bg-red-500/20 text-red-300 border-red-500/30',
  cta: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};
const CAT_LABEL: Record<string, string> = {
  service_line: 'Service Line', case_study: 'Case Study', proof_point: 'Proof Point',
  objection_response: 'Objection Response', cta: 'CTA',
};

const EMPTY_FORM = {
  title: '',
  summary: '',
  category: 'service_line',
  serviceLine: '',
  targetIndustries: '',
  targetRoles: '',
  problems: '',
  evidence: '',
  content: '',
  isActive: true,
};

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */
export default function CapabilityScreen({ navigateTo }: CapabilityScreenProps) {
  const [items, setItems] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  // View dialog
  const [selected, setSelected] = useState<Capability | null>(null);

  // Create/Edit dialog
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ extractedText: string; fileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* ── Fetch capabilities ── */
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab !== 'all' ? `?category=${tab}` : '';
      const res = await fetch(`/api/capabilities${params}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /* ── Filtered items ── */
  const filtered = search
    ? items.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.summary.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  /* ── Form handlers ── */
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (cap: Capability) => {
    setEditingId(cap.id);
    setForm({
      title: cap.title,
      summary: cap.summary,
      category: cap.category,
      serviceLine: cap.serviceLine || '',
      targetIndustries: cap.targetIndustries || '',
      targetRoles: cap.targetRoles || '',
      problems: cap.problems || '',
      evidence: cap.evidence || '',
      content: cap.content || '',
      isActive: cap.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.summary.trim()) {
      toast.error('Title and summary are required');
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editingId;
      const url = '/api/capabilities';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit
        ? { id: editingId, ...form }
        : form;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }

      toast.success(isEdit ? 'Capability updated' : 'Capability created');
      setShowForm(false);
      fetchItems();
      if (isEdit && selected?.id === editingId) {
        setSelected(prev => prev ? { ...prev, ...form } : null);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/capabilities', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteId }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Capability deleted');
      setSelected(prev => prev?.id === deleteId ? null : prev);
      fetchItems();
    } catch {
      toast.error('Failed to delete capability');
    } finally {
      setDeleteId(null);
    }
  };

  /* ── Upload handlers ── */
  const handleFileUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['txt', 'md', 'pdf', 'docx'].includes(ext || '')) {
      toast.error('Unsupported file type. Use .txt, .md, .pdf, or .docx');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large (max 5MB)');
      return;
    }

    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/capabilities/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      setUploadResult({ extractedText: data.extractedText, fileName: data.fileName });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleCreateFromUpload = () => {
    if (!uploadResult) return;
    const titleFromName = uploadResult.fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const firstLine = uploadResult.extractedText.split('\n')[0]?.trim() || '';
    setShowUpload(false);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      title: firstLine.length > 5 ? firstLine : titleFromName,
      summary: uploadResult.extractedText.slice(0, 300).trim(),
      content: uploadResult.extractedText,
    });
    setUploadResult(null);
    setShowForm(true);
  };

  /* ── Render ── */
  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
      {/* Info Note */}
      {navigateTo && (
        <p className="text-xs text-muted-foreground">
          Capabilities are used by the AI draft engine.{' '}
          <span
            onClick={() => navigateTo('drafts')}
            className="text-primary cursor-pointer hover:text-primary/80 transition-colors"
          >View generated drafts →</span>
        </p>
      )}

      <SectionHeader title="Capability Library" />
      <AnimatedCard hover={false}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" />Add Capability
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => { setUploadResult(null); setShowUpload(true); }}>
            <Upload className="w-3.5 h-3.5" />Upload Document
          </Button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search capabilities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>
      </div>
      </AnimatedCard>

      {/* Category Tabs */}
      <TabBar
        tabs={TABS.map(t => ({ key: t.value, label: t.label }))}
        active={tab}
        onChange={(key) => { setTab(key); setSearch(''); }}
      />

      {/* Card Grid */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(cap => {
          const Icon = CAT_ICON[cap.category] || Tag;
          return (
            <StaggerItem key={cap.id}>
              <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <div className="rounded-xl border p-[1px]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.1), transparent 60%)' }}>
                  <div className="rounded-xl bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                          <h3 className="text-sm font-semibold text-foreground truncate">{cap.title}</h3>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${CAT_BADGE[cap.category] || ''}`}>
                          {CAT_LABEL[cap.category] || cap.category}
                        </Badge>
                      </div>
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cap.isActive ? 'bg-emerald-400' : 'bg-zinc-500'}`} title={cap.isActive ? 'Active' : 'Inactive'} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">{cap.summary}</p>
                    {cap.serviceLine && (
                      <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Layers className="w-3 h-3" />{cap.serviceLine}
                      </p>
                    )}
                    {cap.targetIndustries && (
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Tag className="w-3 h-3" />{cap.targetIndustries}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-3">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary/80 px-2"
                        onClick={() => setSelected(cap)}>
                        <Eye className="w-3.5 h-3.5 mr-1" />View
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                        onClick={() => openEdit(cap)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-400 px-2 ml-auto"
                        onClick={() => setDeleteId(cap.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </StaggerItem>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-muted-foreground text-sm text-center py-12">
            {search ? 'No capabilities match your search.' : 'No capabilities in this category. Add some to improve AI draft quality.'}
          </div>
        )}
      </StaggerGrid>

      {/* ═══ View Dialog ═══ */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {(() => { const I = CAT_ICON[selected.category] || Tag; return <I className="w-4 h-4 text-primary" />; })()}
                <h2 className="text-base font-semibold text-foreground">{selected.title}</h2>
                <Badge variant="outline" className={`text-[10px] ${CAT_BADGE[selected.category] || ''}`}>{CAT_LABEL[selected.category] || selected.category}</Badge>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { openEdit(selected); setSelected(null); }}>
                  <Pencil className="w-3.5 h-3.5" />Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-red-400 hover:text-red-300" onClick={() => { setDeleteId(selected.id); setSelected(null); }}>
                  <Trash2 className="w-3.5 h-3.5" />Delete
                </Button>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none ml-1">&times;</button>
              </div>
            </div>
            <div className="space-y-4 text-sm">
              {selected.serviceLine && <p className="text-muted-foreground"><span className="text-foreground font-medium">Service Line:</span> {selected.serviceLine}</p>}
              {selected.targetIndustries && <p className="text-muted-foreground"><span className="text-foreground font-medium">Industries:</span> {selected.targetIndustries}</p>}
              {selected.targetRoles && <p className="text-muted-foreground"><span className="text-foreground font-medium">Target Roles:</span> {selected.targetRoles}</p>}
              {selected.problems && <p className="text-muted-foreground"><span className="text-foreground font-medium">Problems Addressed:</span> {selected.problems}</p>}
              {selected.evidence && <p className="text-muted-foreground"><span className="text-foreground font-medium">Evidence:</span> {selected.evidence}</p>}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
                <p className="text-foreground leading-relaxed">{selected.summary}</p>
              </div>
              {selected.content && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Full Content</p>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{selected.content}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Create/Edit Dialog ═══ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">
                {editingId ? 'Edit Capability' : 'New Capability'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="cap-title" className="text-sm">Title <span className="text-red-400">*</span></Label>
                <Input
                  id="cap-title"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Capability title"
                  className="h-9 text-sm"
                />
              </div>

              {/* Category + Active */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Category <span className="text-red-400">*</span></Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service_line">Service Line</SelectItem>
                      <SelectItem value="case_study">Case Study</SelectItem>
                      <SelectItem value="proof_point">Proof Point</SelectItem>
                      <SelectItem value="objection_response">Objection Response</SelectItem>
                      <SelectItem value="cta">CTA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2 pb-0.5">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
                  />
                  <Label className="text-sm text-muted-foreground">Active</Label>
                </div>
              </div>

              {/* Service Line */}
              <div className="space-y-1.5">
                <Label htmlFor="cap-sl" className="text-sm">Service Line</Label>
                <Input
                  id="cap-sl"
                  value={form.serviceLine}
                  onChange={e => setForm(f => ({ ...f, serviceLine: e.target.value }))}
                  placeholder="e.g., AI & Data, Cloud & Infrastructure"
                  className="h-9 text-sm"
                />
              </div>

              {/* Target Industries + Target Roles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cap-ind" className="text-sm">Target Industries</Label>
                  <Input
                    id="cap-ind"
                    value={form.targetIndustries}
                    onChange={e => setForm(f => ({ ...f, targetIndustries: e.target.value }))}
                    placeholder="Comma-separated"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cap-roles" className="text-sm">Target Roles</Label>
                  <Input
                    id="cap-roles"
                    value={form.targetRoles}
                    onChange={e => setForm(f => ({ ...f, targetRoles: e.target.value }))}
                    placeholder="Comma-separated"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Problems Addressed */}
              <div className="space-y-1.5">
                <Label htmlFor="cap-problems" className="text-sm">Problems Addressed</Label>
                <Textarea
                  id="cap-problems"
                  value={form.problems}
                  onChange={e => setForm(f => ({ ...f, problems: e.target.value }))}
                  placeholder="Key problems this capability solves"
                  className="text-sm min-h-[60px]"
                  rows={2}
                />
              </div>

              {/* Evidence */}
              <div className="space-y-1.5">
                <Label htmlFor="cap-evidence" className="text-sm">Evidence / Proof</Label>
                <Textarea
                  id="cap-evidence"
                  value={form.evidence}
                  onChange={e => setForm(f => ({ ...f, evidence: e.target.value }))}
                  placeholder="Supporting evidence, metrics, or proof points"
                  className="text-sm min-h-[60px]"
                  rows={2}
                />
              </div>

              {/* Summary */}
              <div className="space-y-1.5">
                <Label htmlFor="cap-summary" className="text-sm">Summary <span className="text-red-400">*</span></Label>
                <Textarea
                  id="cap-summary"
                  value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  placeholder="Brief summary of the capability"
                  className="text-sm min-h-[80px]"
                  rows={3}
                />
              </div>

              {/* Full Content */}
              <div className="space-y-1.5">
                <Label htmlFor="cap-content" className="text-sm">Full Content</Label>
                <Textarea
                  id="cap-content"
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Detailed content (optional)"
                  className="text-sm min-h-[100px]"
                  rows={4}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-sm">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="text-sm">
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1.5" />
                ) : null}
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Upload Dialog ═══ */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setShowUpload(false); setUploadResult(null); }}>
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">Upload Document</h2>
              <button onClick={() => { setShowUpload(false); setUploadResult(null); }} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Upload a .txt, .md, .pdf, or .docx file to extract content and create a capability from it.
            </p>

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,.docx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                  e.target.value = '';
                }}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Extracting text…</p>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-foreground">Drag & drop or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">.txt, .md, .pdf, .docx - max 5MB</p>
                </>
              )}
            </div>

            {/* Extracted text preview */}
            {uploadResult && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">{uploadResult.fileName}</p>
                  <Badge variant="outline" className="text-[10px] text-emerald-300 border-emerald-500/30 bg-emerald-500/20">Extracted</Badge>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/50 p-3">
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{uploadResult.extractedText}</p>
                </div>
                <Button size="sm" className="text-xs gap-1.5" onClick={handleCreateFromUpload}>
                  <Plus className="w-3.5 h-3.5" />Create Capability from This
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Delete Confirmation ═══ */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Capability</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this capability? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PageTransition>
  );
}