'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition, SectionHeader, TabBar, StatCard, GlassPanel, EmptyState, ShimmerText,
  AnimatedBar,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  Plus, Upload, Search, X, Database, Tag, CheckCircle2, Layers,
  Globe, Download, Hash, Check, Ban, Trash2, Loader2, Sparkles,
} from 'lucide-react';
import { colors, gold, goldLight } from '@/components/design-system';

import type { Capability, CapabilityFormState } from './capability/capability-shared';
import {
  TABS, EMPTY_FORM, goldAlpha, CAT_ICON, CAT_BADGE, CAT_LABEL, CAT_GRADIENT,
} from './capability/capability-shared';
import { KnowledgeEnginePanel } from './capability/knowledge-engine-panel';
import { CapabilityViewDialog } from './capability/capability-view-dialog';
import { CapabilityFormDialog } from './capability/capability-form-dialog';
import { CapabilityCardGrid } from './capability/capability-card-grid';
import { UploadDialog, EnrichDialog, ImportDialog, DeleteConfirmDialog } from './capability/capability-utility-dialogs';
import type { UploadResult } from './capability/capability-utility-dialogs';
import { TagCloudDialog } from './capability/capability-tag-cloud-dialog';

interface CapabilityScreenProps {
  navigateTo?: (screen: string) => void;
}

export default function CapabilityScreen({ navigateTo }: CapabilityScreenProps) {
  const [items, setItems] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showTagCloud, setShowTagCloud] = useState(false);

  // View dialog
  const [selected, setSelected] = useState<Capability | null>(null);

  // Create/Edit dialog
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CapabilityFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Enrich dialog
  const [showEnrich, setShowEnrich] = useState(false);
  const [enrichUrl, setEnrichUrl] = useState('');
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState<any>(null);
  const [enrichSaving, setEnrichSaving] = useState(false);

  // Import dialog
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  /* -- All unique tags -- */
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of items) {
      if (item.tags && Array.isArray(item.tags)) {
        for (const tag of item.tags) { tagSet.add(tag); }
      }
    }
    return [...tagSet].sort();
  }, [items]);

  /* -- Fetch capabilities -- */
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('category', tab);
      const res = await fetch(`/api/capabilities?${params.toString()}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.error('[Capability] fetch capabilities failed:', { error: err });
      setItems([]);
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  /* -- Computed stats -- */
  const activeCount = items.filter(i => i.isActive).length;
  const categoryCount = new Set(items.map(i => i.category)).size;

  /* -- Filtered items -- */
  const filtered = useMemo(() => {
    let result = search
      ? items.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.summary.toLowerCase().includes(search.toLowerCase()))
      : items;
    if (filterTag) {
      result = result.filter(c => c.tags && Array.isArray(c.tags) && c.tags.includes(filterTag));
    }
    return result;
  }, [items, search, filterTag]);

  /* -- Form handlers -- */
  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); };

  const openEdit = (cap: Capability) => {
    setEditingId(cap.id);
    setForm({
      title: cap.title, summary: cap.summary, category: cap.category,
      serviceLine: cap.serviceLine || '', targetIndustries: cap.targetIndustries || '',
      targetRoles: cap.targetRoles || '', problems: cap.problems || '',
      evidence: cap.evidence || '', content: cap.content || '', isActive: cap.isActive,
      tags: Array.isArray(cap.tags) ? [...cap.tags] : [],
      targetCompanySizes: cap.targetCompanySizes || '', parentAssetId: cap.parentAssetId || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.summary.trim()) { toast.error('Title and summary are required'); return; }
    setSaving(true);
    try {
      const isEdit = !!editingId;
      const body = { ...form, parentAssetId: form.parentAssetId && form.parentAssetId !== '__none__' ? form.parentAssetId : null };
      if (isEdit) { (body as any).id = editingId; }
      const res = await fetch('/api/capabilities', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to save'); }
      const savedData = await res.json();
      toast.success(isEdit ? `Updated (v${savedData.version || ''})` : 'Capability created');
      setShowForm(false); fetchItems();
      if (isEdit && selected?.id === editingId) { setSelected(prev => prev ? { ...prev, ...form } : null); }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/capabilities', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteId }) });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Capability deleted');
      setSelected(prev => prev?.id === deleteId ? null : prev); fetchItems();
    } catch { toast.error('Failed to delete capability'); }
    finally { setDeleteId(null); }
  };

  /* -- Upload handlers -- */
  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const invalid = fileArr.find(f => { const ext = f.name.split('.').pop()?.toLowerCase(); return !['txt', 'md', 'pdf', 'docx'].includes(ext || ''); });
    if (invalid) { toast.error(`Unsupported file type: ${invalid.name}`); return; }
    const tooBig = fileArr.find(f => f.size > 25 * 1024 * 1024);
    if (tooBig) { toast.error(`File too large: ${tooBig.name} (max 25MB)`); return; }
    setUploading(true); setUploadResults([]);
    try {
      const fd = new FormData(); for (const f of fileArr) fd.append('file', f);
      const res = await fetch('/api/capabilities/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success && data.error) { setUploadResults([{ fileName: 'Upload', error: data.error }]); return; }
      setUploadResults(data.results ? data.results.map((r: any) => ({ fileName: r.fileName, success: r.success, error: r.error, assetsGenerated: r.assetsGenerated, duplicates: r.duplicates })) : [{ fileName: data.fileName, success: true, assetsGenerated: data.assetsGenerated, duplicates: data.duplicates }]);
      fetchItems();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files); };

  const handleCreateFromUpload = (result: UploadResult) => {
    setShowUpload(false); setUploadResults([]); setEditingId(null);
    setForm({ ...EMPTY_FORM, title: result.fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), summary: `Uploaded from ${result.fileName}` });
    setShowForm(true);
  };

  /* -- Bulk operations -- */
  const toggleSelect = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const toggleSelectAll = () => { setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id))); };
  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedIds.size === 0) return; setBulkLoading(true);
    try {
      const res = await fetch('/api/capabilities', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedIds), action }) });
      if (!res.ok) throw new Error('Bulk action failed');
      const data = await res.json();
      toast.success(`${action === 'delete' ? 'Deleted' : action === 'activate' ? 'Activated' : 'Deactivated'} ${data.processed} items`);
      setSelectedIds(new Set()); fetchItems();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Bulk action failed'); }
    finally { setBulkLoading(false); }
  };

  /* -- Export -- */
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(`/api/capabilities/export?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `deepmindq-capabilities.${format}`; a.click(); URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Export failed'); }
  };

  /* -- Import -- */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportLoading(true); setImportResult(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/capabilities/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportResult(data); toast.success(`Imported ${data.created} of ${data.total} assets`); fetchItems();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Import failed'); }
    finally { setImportLoading(false); e.target.value = ''; }
  };

  /* -- Enrich -- */
  const handleEnrich = async () => {
    if (!enrichUrl.trim()) return; setEnrichLoading(true); setEnrichResult(null);
    try {
      const res = await fetch('/api/capabilities/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: enrichUrl }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrichment failed'); setEnrichResult(data);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Enrichment failed'); }
    finally { setEnrichLoading(false); }
  };

  const handleSaveEnrichedAssets = async () => {
    if (!enrichResult?.assets?.length) return; setEnrichSaving(true); let created = 0;
    try {
      for (const asset of enrichResult.assets) { const res = await fetch('/api/capabilities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(asset) }); if (res.ok) created++; }
      toast.success(`Saved ${created} enriched assets`); setShowEnrich(false); setEnrichResult(null); setEnrichUrl(''); fetchItems();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to save enriched assets'); }
    finally { setEnrichSaving(false); }
  };

  /* -- Tab bar data -- */
  const tabBarTabs = TABS.map(t => ({ key: t.value, label: t.label, count: t.value === 'all' ? items.length : items.filter(i => i.category === t.value).length }));

  /* -- Render -- */
  if (loading && items.length === 0) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>;
  }

  return (
    <PageTransition>
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <SectionHeader title="" className="mb-0" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground"><ShimmerText>Capability Library</ShimmerText></h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg">Curate the knowledge assets that power personalized AI-driven email generation.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button size="sm" className="h-10 text-xs gap-1.5 shadow-lg shadow-primary/10 min-h-[44px]" onClick={openCreate}><Plus className="w-3.5 h-3.5" />Add Capability</Button>
          <Button size="sm" variant="outline" className="h-10 text-xs gap-1.5 min-h-[44px]" onClick={() => { setUploadResults([]); setShowUpload(true); }}><Upload className="w-3.5 h-3.5" />Upload</Button>
          <Button size="sm" variant="outline" className="h-10 text-xs gap-1.5 min-h-[44px]" onClick={() => setShowEnrich(true)}><Globe className="w-3.5 h-3.5" />Enrich</Button>
          <Button size="sm" variant="outline" className="h-10 text-xs gap-1.5 min-h-[44px]" onClick={() => handleExport('json')}><Download className="w-3.5 h-3.5" />Export</Button>
          <Button size="sm" variant="outline" className="h-10 text-xs gap-1.5 min-h-[44px]" onClick={() => setShowImport(true)}><Upload className="w-3.5 h-3.5" />Import</Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Total Capabilities" value={items.length} icon={Database} color="var(--color-gold)" delay={0} />
        <StatCard label="Active" value={activeCount} icon={CheckCircle2} color={colors.green} delay={0.08} />
        <StatCard label="Categories Used" value={categoryCount} icon={Layers} color={colors.purple} delay={0.16} />
        <StatCard label="Tags" value={allTags.length} icon={Tag} color={colors.amber} delay={0.24} />
      </div>

      {/* Knowledge Engine */}
      <KnowledgeEnginePanel items={items} navigateTo={navigateTo} />

      {/* Search & Filter */}
      <GlassPanel className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search capabilities by title or summary..." value={search} onChange={e => { setSearch(e.target.value); setFilterTag(null); }} className="h-10 text-sm pl-10 bg-gray-50 border-gray-200 focus:border-primary/40" />
            {search && (<button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>)}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            {(search || filterTag) && <Badge variant="outline" className="text-[11px] gap-1"><Sparkles className="w-3 h-3 text-primary" />Filtered</Badge>}
            {filterTag && (
              <Badge variant="outline" className="text-[11px] gap-1 border-primary/30 text-primary bg-primary/5">
                <Tag className="w-2.5 h-2.5" />{filterTag}<button onClick={() => setFilterTag(null)}><X className="w-2.5 h-2.5" /></button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-10 text-[11px] text-muted-foreground hover:text-foreground min-h-[44px]" onClick={() => setShowTagCloud(true)}>
              <Hash className="w-3 h-3 mr-1" />All Tags ({allTags.length})
            </Button>
          </div>
        </div>
        {allTags.length > 0 && !filterTag && !search && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <span className="text-[11px] text-muted-foreground">Quick filter:</span>
            {allTags.slice(0, 12).map(tag => (
              <button key={tag} onClick={() => setFilterTag(tag)} className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all duration-200">{tag}</button>
            ))}
            {allTags.length > 12 && (
              <button onClick={() => setShowTagCloud(true)} className="text-[11px] text-primary hover:text-primary/80 transition-colors">+{allTags.length - 12} more</button>
            )}
          </div>
        )}
      </GlassPanel>

      {/* Category Tabs */}
      <SectionHeader title="Browse by Category" subtitle="Filter capabilities by type to find exactly what you need" />
      <TabBar tabs={tabBarTabs} active={tab} onChange={(key) => { setTab(key); setSearch(''); setFilterTag(null); }} />

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="flex items-center justify-between gap-4 p-3 rounded-xl border border-primary/20 shadow-lg"
            style={{ background: `${goldAlpha(0.06)}`, backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
              <Button variant="ghost" size="sm" className="h-10 text-xs gap-1 min-h-[44px]" onClick={toggleSelectAll}>{selectedIds.size === filtered.length ? 'Deselect All' : 'Select All'}</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-10 text-xs gap-1.5 min-h-[44px]" onClick={() => handleBulkAction('activate')} disabled={bulkLoading}><Check className="w-3 h-3 text-emerald-600" />Activate</Button>
              <Button size="sm" variant="outline" className="h-10 text-xs gap-1.5 min-h-[44px]" onClick={() => handleBulkAction('deactivate')} disabled={bulkLoading}><Ban className="w-3 h-3 text-amber-600" />Deactivate</Button>
              <Button size="sm" variant="outline" className="h-10 text-xs gap-1.5 text-red-600 border-red-500/30 hover:bg-red-50 min-h-[44px]" onClick={() => handleBulkAction('delete')} disabled={bulkLoading}><Trash2 className="w-3 h-3" />Delete</Button>
              {bulkLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Grid */}
      <CapabilityCardGrid
        filtered={filtered} items={items} selectedIds={selectedIds} loading={loading}
        search={search} filterTag={filterTag} allTags={allTags}
        onToggleSelect={toggleSelect} onView={setSelected} onEdit={openEdit} onDelete={setDeleteId}
        onFilterTag={setFilterTag} onOpenCreate={openCreate} onClearTagFilter={() => setFilterTag(null)} onShowTagCloud={() => setShowTagCloud(true)}
      />

      {/* View Dialog */}
      {selected && (
        <CapabilityViewDialog
          selected={selected} items={items} onEdit={openEdit} onDelete={setDeleteId}
          onClose={() => setSelected(null)} onFilterTag={(tag) => { setSelected(null); setFilterTag(tag); }}
        />
      )}

      {/* Form Dialog */}
      <CapabilityFormDialog
        open={showForm} editingId={editingId} form={form} saving={saving}
        items={items} allTags={allTags}
        onSave={handleSave} onClose={() => setShowForm(false)} onFormChange={setForm}
      />

      {/* Upload Dialog */}
      <UploadDialog open={showUpload} uploading={uploading} uploadResults={uploadResults}
        onClose={() => { setShowUpload(false); setUploadResults([]); }}
        onFileUpload={handleFileUpload} onDrop={handleDrop} onCreateFromUpload={handleCreateFromUpload}
      />

      {/* Enrich Dialog */}
      <EnrichDialog open={showEnrich} enrichUrl={enrichUrl} enrichLoading={enrichLoading}
        enrichSaving={enrichSaving} enrichResult={enrichResult}
        onClose={() => { setShowEnrich(false); setEnrichResult(null); setEnrichUrl(''); }}
        onUrlChange={setEnrichUrl} onEnrich={handleEnrich} onSaveAll={handleSaveEnrichedAssets}
      />

      {/* Import Dialog */}
      <ImportDialog open={showImport} importLoading={importLoading} importResult={importResult}
        onClose={() => { setShowImport(false); setImportResult(null); }} onImport={handleImport}
      />

      {/* Tag Cloud Dialog */}
      {showTagCloud && <TagCloudDialog items={items} onSelectTag={setFilterTag} onClose={() => setShowTagCloud(false)} />}

      {/* Delete Confirmation */}
      <DeleteConfirmDialog open={!!deleteId} onDelete={handleDelete} onClose={() => setDeleteId(null)} />

      {/* Info Note */}
      {navigateTo && (
        <p className="text-xs text-muted-foreground pb-2">
          Capabilities are used by the AI draft engine.{' '}
          <span onClick={() => navigateTo('drafts')} className="text-primary cursor-pointer hover:text-primary/80 transition-colors underline decoration-primary/30 underline-offset-2">View generated drafts</span>
        </p>
      )}
    </div>
    </PageTransition>
  );
}
