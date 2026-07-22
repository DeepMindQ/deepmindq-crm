'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText, Plus, Pencil, Trash2, Eye, Search, Sparkles, Tag, LayoutGrid, List,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition, AnimatedCard, StaggerGrid, StaggerItem, SectionHeader,
  TabBar, GlassPanel, EmptyState, PulseDot,
} from '@/components/ui/animated-components';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  cta: string | null;
  serviceLine: string | null;
  tone: string;
  category: string | null;
  variables: string | null;
  isActive: boolean;
  createdAt: string;
}

const SAMPLE_DATA: Record<string, string> = {
  name: 'Sarah Chen',
  company: 'Acme Corp',
  title: 'VP of Engineering',
  industry: 'Technology',
};

const SUGGESTED_VARIABLES = ['name', 'company', 'title', 'industry', 'service', 'case_study', 'metric', 'pain_point'];

export default function TemplatesScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterServiceLine, setFilterServiceLine] = useState('');
  const [filterTone, setFilterTone] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (filterServiceLine) params.set('serviceLine', filterServiceLine);
        if (filterTone) params.set('tone', filterTone);
        const res = await fetch(`/api/templates?${params}`);
        const data = await res.json();
        if (!cancelled) setTemplates(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setTemplates([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [filterServiceLine, filterTone]);

  const reloadTemplates = async () => {
    const params = new URLSearchParams();
    if (filterServiceLine) params.set('serviceLine', filterServiceLine);
    if (filterTone) params.set('tone', filterTone);
    const res = await fetch(`/api/templates?${params}`);
    const data = await res.json();
    setTemplates(Array.isArray(data) ? data : []);
  };

  // Form state
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCta, setFormCta] = useState('');
  const [formServiceLine, setFormServiceLine] = useState('');
  const [formTone, setFormTone] = useState('professional');
  const [formCategory, setFormCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingTemplate(null);
    setFormName(''); setFormSubject(''); setFormBody('');
    setFormCta(''); setFormServiceLine(''); setFormTone('professional'); setFormCategory('');
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingTemplate(t);
    setFormName(t.name); setFormSubject(t.subject); setFormBody(t.body);
    setFormCta(t.cta || ''); setFormServiceLine(t.serviceLine || '');
    setFormTone(t.tone); setFormCategory(t.category || '');
    setDialogOpen(true);
  };

  const openPreview = (t: Template) => {
    setPreviewTemplate(t);
    setPreviewOpen(true);
  };

  const handleSave = async () => {
    if (!formName || !formSubject || !formBody) {
      toast.error('Name, subject, and body are required');
      return;
    }
    setSaving(true);
    try {
      if (editingTemplate) {
        await fetch('/api/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTemplate.id,
            name: formName,
            subject: formSubject,
            body: formBody,
            cta: formCta || null,
            serviceLine: formServiceLine || null,
            tone: formTone,
            category: formCategory || null,
          }),
        });
        toast.success('Template updated');
      } else {
        await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            subject: formSubject,
            body: formBody,
            cta: formCta || null,
            serviceLine: formServiceLine || null,
            tone: formTone,
            category: formCategory || null,
          }),
        });
        toast.success('Template created');
      }
      setDialogOpen(false);
      reloadTemplates();
    } catch {
      toast.error('Failed to save template');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
      toast.success('Template deleted');
      reloadTemplates();
    } catch {
      toast.error('Failed to delete template');
    }
  };

  const insertVariable = (v: string) => {
    const insertion = `{{${v}}}`;
    setFormBody(prev => prev + insertion);
  };

  const renderPreview = (text: string) => {
    let rendered = text;
    for (const [key, val] of Object.entries(SAMPLE_DATA)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    }
    return rendered;
  };

  const extractVars = (text: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const vars: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!vars.includes(match[1])) vars.push(match[1]);
    }
    return vars;
  };

  const filtered = templates.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.name.toLowerCase().includes(s) || t.subject.toLowerCase().includes(s) || (t.category || '').toLowerCase().includes(s);
  });

  const toneColor = (tone: string) => {
    switch (tone) {
      case 'professional': return 'text-amber-600 bg-amber-400/10 border-amber-400/20';
      case 'casual': return 'text-emerald-600 bg-emerald-50 border-emerald-400/20';
      case 'executive': return 'text-purple-600 bg-purple-400/10 border-purple-400/20';
      default: return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
    }
  };

  const gold = 'var(--color-gold)';

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <SectionHeader title="Email Templates" subtitle="Manage reusable email templates with variable placeholders" />
          <Button onClick={openCreate} className="gap-2" style={{ background: `linear-gradient(135deg, ${gold}, #E8C860)` }}>
            <Plus className="w-4 h-4" /> Create Template
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterServiceLine} onValueChange={v => setFilterServiceLine(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Service Line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Service Lines</SelectItem>
              <SelectItem value="AI & ML">AI & ML</SelectItem>
              <SelectItem value="Cloud Engineering">Cloud Engineering</SelectItem>
              <SelectItem value="Data Engineering">Data Engineering</SelectItem>
              <SelectItem value="Digital Transformation">Digital Transformation</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTone} onValueChange={v => setFilterTone(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Tones</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="executive">Executive</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Templates Grid/List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-xl bg-card/50 border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <GlassPanel className="p-8">
            <EmptyState
              icon={FileText}
              title="No templates found"
              description="Create your first email template with variable placeholders like {{name}} and {{company}}"
              action={
                <Button onClick={openCreate} variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" /> Create Template
                </Button>
              }
            />
          </GlassPanel>
        ) : viewMode === 'grid' ? (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" stagger={0.06}>
            {filtered.map(t => {
              const vars = extractVars(t.subject + ' ' + t.body);
              return (
                <StaggerItem key={t.id}>
                  <AnimatedCard hover className="p-0 overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">{t.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          <button onClick={() => openPreview(t)} className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.body.slice(0, 100)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className={`text-[10px] ${toneColor(t.tone)}`}>{t.tone}</Badge>
                        {t.serviceLine && <Badge variant="outline" className="text-[10px] text-primary/80 bg-primary/5 border-primary/20">{t.serviceLine}</Badge>}
                        {t.category && <Badge variant="outline" className="text-[10px]">{t.category}</Badge>}
                      </div>
                      {vars.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
                          {vars.map(v => (
                            <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/5 text-primary/70 font-mono">{'{{'}{v}{'}}'}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </AnimatedCard>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        ) : (
          <GlassPanel className="overflow-hidden">
            <div className="divide-y divide-border/50">
              {filtered.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${toneColor(t.tone)}`}>{t.tone}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{t.subject}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openPreview(t)} className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassPanel>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              Use {'{{variable}}'} placeholders that will be replaced when generating emails.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g., Enterprise AI Intro" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intro">Introduction</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="case_study">Case Study</SelectItem>
                    <SelectItem value="cta">Call to Action</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input value={formSubject} onChange={e => setFormSubject(e.target.value)} placeholder="e.g., {{service}} for {{company}} — {{metric}}" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Email Body</Label>
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground">Variables: </span>
                  {SUGGESTED_VARIABLES.map(v => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-primary/5 text-primary/70 hover:bg-primary/10 font-mono transition-colors"
                    >
                      {'{{'}{v}{'}}'}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea value={formBody} onChange={e => setFormBody(e.target.value)} placeholder="Hi {{name}},&#10;&#10;I noticed {{company}} is..." rows={8} className="font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CTA</Label>
                <Input value={formCta} onChange={e => setFormCta(e.target.value)} placeholder="e.g., Would you be open to a brief call?" />
              </div>
              <div className="space-y-2">
                <Label>Service Line</Label>
                <Select value={formServiceLine} onValueChange={setFormServiceLine}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AI & ML">AI & ML</SelectItem>
                    <SelectItem value="Cloud Engineering">Cloud Engineering</SelectItem>
                    <SelectItem value="Data Engineering">Data Engineering</SelectItem>
                    <SelectItem value="Digital Transformation">Digital Transformation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={formTone} onValueChange={setFormTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} style={{ background: `linear-gradient(135deg, ${gold}, #E8C860)` }}>
                {saving ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              Rendered with sample data: {SAMPLE_DATA.name}, {SAMPLE_DATA.company}
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-lg bg-gray-50 border border-border/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${toneColor(previewTemplate.tone)}`}>{previewTemplate.tone}</Badge>
                  {previewTemplate.serviceLine && <Badge variant="outline" className="text-[10px] text-primary/80 bg-primary/5">{previewTemplate.serviceLine}</Badge>}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Subject</p>
                  <p className="text-sm font-medium text-foreground">{renderPreview(previewTemplate.subject)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Body</p>
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap">{renderPreview(previewTemplate.body)}</div>
                </div>
                {previewTemplate.cta && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">CTA</p>
                    <p className="text-sm text-primary">{renderPreview(previewTemplate.cta)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}