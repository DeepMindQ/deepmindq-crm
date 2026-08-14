'use client';

import { useState, useEffect, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, LoadingSkeleton, ErrorPanel } from '@/components/ui/screen-states';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Pencil, Play, FileText, Bot } from 'lucide-react';

/* ── Types ── */
interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  model: string;
  systemPrompt: string;
  variables: string[];
  lastModified: string;
  usageCount: number;
}

/* ── Constants ── */
const CATEGORIES = ['All', 'Intelligence', 'Outreach', 'Enablement', 'Retention', 'Sales'];
const MODELS = ['GPT-4o', 'GPT-4o-mini', 'Claude 3.5'];

/* ── Component ── */
export default function PromptTemplatesScreen() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testTemplate, setTestTemplate] = useState<PromptTemplate | null>(null);
  const [testResponse, setTestResponse] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Intelligence');
  const [formModel, setFormModel] = useState('GPT-4o');
  const [formPrompt, setFormPrompt] = useState('');
  const [formVariables, setFormVariables] = useState('');

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/prompts');
      if (!res.ok) {
        throw new Error(`Failed to fetch prompt templates (HTTP ${res.status})`);
      }
      const json = await res.json();
      // Support both { data: [...] } envelope and raw array
      const raw = json.data ?? json.prompts ?? json;

      // Map server PromptVersion → local PromptTemplate shape
      const mapped: PromptTemplate[] = (Array.isArray(raw) ? raw : []).map(
        (p: Record<string, unknown>) => ({
          id: p.id as string,
          name: (p.label ?? p.name ?? p.key ?? 'Untitled') as string,
          category: (p.feature ?? p.category ?? 'Intelligence') as string,
          model: (p.model ?? 'GPT-4o') as string,
          systemPrompt: (p.systemPrompt ?? '') as string,
          variables: extractVariables(p.systemPrompt as string),
          lastModified: p.updatedAt
            ? String(p.updatedAt).slice(0, 10)
            : p.createdAt
              ? String(p.createdAt).slice(0, 10)
              : new Date().toISOString().slice(0, 10),
          usageCount: (p.usageCount ?? 0) as number,
        }),
      );

      setTemplates(mapped);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error loading prompt templates'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const filtered = templates.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'All' || t.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const openCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormCategory('Intelligence');
    setFormModel('GPT-4o');
    setFormPrompt('');
    setFormVariables('');
    setModalOpen(true);
  };

  const openEdit = (t: PromptTemplate) => {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormCategory(t.category);
    setFormModel(t.model);
    setFormPrompt(t.systemPrompt);
    setFormVariables(t.variables.join(', '));
    setModalOpen(true);
  };

  const handleSave = async () => {
    const vars = formVariables
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (editingTemplate) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? {
                ...t,
                name: formName,
                category: formCategory,
                model: formModel,
                systemPrompt: formPrompt,
                variables: vars,
                lastModified: new Date().toISOString().slice(0, 10),
              }
            : t,
        ),
      );
    } else {
      const newTemplate: PromptTemplate = {
        id: String(Date.now()),
        name: formName,
        category: formCategory,
        model: formModel,
        systemPrompt: formPrompt,
        variables: vars,
        lastModified: new Date().toISOString().slice(0, 10),
        usageCount: 0,
      };
      setTemplates((prev) => [newTemplate, ...prev]);
    }
    setModalOpen(false);
  };

  const handleTest = (t: PromptTemplate) => {
    setTestTemplate(t);
    setTestResponse('');
    setTestLoading(true);
    setTestModalOpen(true);
    setTimeout(() => {
      setTestResponse(`Based on the "${t.name}" prompt template analysis:

The AI model (${t.model}) has processed the template with the defined variables. Here is a simulated response demonstrating the template's capability:

**Key Findings:**
- Template successfully incorporates ${t.variables.length} variable(s)
- Response coherence: High
- Relevance score: 94%

**Recommendation:** This template is performing well. Consider A/B testing variable ordering for improved output quality.`);
      setTestLoading(false);
    }, 1500);
  };

  const getCategoryBadgeClass = (cat: string) => {
    const map: Record<string, string> = {
      Intelligence: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
      Outreach: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      Enablement: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      Retention: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      Sales: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    };
    return map[cat] || 'bg-gray-100 text-gray-800';
  };

  /* ── Error State ── */
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: tokens.border.default }}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" style={{ color: tokens.domain.reasoning }} />
            <div>
              <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>
                Prompt Templates
              </h1>
              <p className="text-xs" style={{ color: tokens.text.muted }}>
                Manage and test AI prompt templates for intelligence and outreach
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <ErrorPanel
            error={error}
            message="Unable to load prompt templates from the Intelligence OS server."
            onRetry={fetchPrompts}
          />
        </div>
      </div>
    );
  }

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: tokens.border.default }}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" style={{ color: tokens.domain.reasoning }} />
            <div>
              <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>
                Prompt Templates
              </h1>
              <p className="text-xs" style={{ color: tokens.text.muted }}>
                Manage and test AI prompt templates for intelligence and outreach
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
          <LoadingSkeleton variant="table" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: tokens.border.default }}
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5" style={{ color: tokens.domain.reasoning }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>
              Prompt Templates
            </h1>
            <p className="text-xs" style={{ color: tokens.text.muted }}>
              Manage and test AI prompt templates for intelligence and outreach
            </p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Create Template
        </Button>
      </div>

      {/* Filters */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b"
        style={{ borderColor: tokens.borderFaint }}
      >
        <div className="relative flex-1 max-w-sm">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: tokens.text.muted }}
          />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon="file"
            title="No templates found"
            description={
              search || categoryFilter !== 'All'
                ? 'Try adjusting your filters'
                : 'Create your first prompt template'
            }
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" /> Create Template
              </Button>
            }
          />
        ) : (
          <div className="p-6">
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: tokens.border.default }}
            >
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Name
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Category
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Model
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium text-center"
                      style={{ color: tokens.text.secondary }}
                    >
                      Variables
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Last Modified
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium text-right"
                      style={{ color: tokens.text.secondary }}
                    >
                      Usage
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium text-right"
                      style={{ color: tokens.text.secondary }}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Bot
                            className="w-4 h-4 shrink-0"
                            style={{ color: tokens.domain.reasoning }}
                          />
                          <span
                            className="text-sm font-medium"
                            style={{ color: tokens.text.primary }}
                          >
                            {t.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryBadgeClass(t.category)}>{t.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm" style={{ color: tokens.text.secondary }}>
                        {t.model}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: tokens.accent.subtle,
                            color: tokens.accent.DEFAULT,
                          }}
                        >
                          {t.variables.length}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm" style={{ color: tokens.text.muted }}>
                        {t.lastModified}
                      </TableCell>
                      <TableCell
                        className="text-sm text-right font-medium"
                        style={{ color: tokens.text.primary }}
                      >
                        {t.usageCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleTest(t)}
                            title="Test template"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(t)}
                            title="Edit template"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingTemplate ? 'Edit Template' : 'Create Template'}
              <FileText className="w-4 h-4" style={{ color: tokens.domain.reasoning }} />
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Template Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Company Research Brief"
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Category</Label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-9 rounded-md border bg-transparent px-3 text-sm"
                    style={{ borderColor: tokens.border.default, color: tokens.text.primary }}
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Model</Label>
                  <select
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full h-9 rounded-md border bg-transparent px-3 text-sm"
                    style={{ borderColor: tokens.border.default, color: tokens.text.primary }}
                  >
                    {MODELS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">System Prompt</Label>
              <Textarea
                value={formPrompt}
                onChange={(e) => setFormPrompt(e.target.value)}
                placeholder="Enter the system prompt..."
                rows={6}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Variables (comma-separated)</Label>
              <Input
                value={formVariables}
                onChange={(e) => setFormVariables(e.target.value)}
                placeholder="e.g. company_name, industry, revenue_range"
                className="h-9 text-sm"
              />
              {formVariables && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {formVariables
                    .split(',')
                    .map(
                      (v, i) =>
                        v.trim() && (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-xs"
                          >{`{{${v.trim()}}}`}</Badge>
                        ),
                    )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim() || !formPrompt.trim()}>
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Modal */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-4 h-4" style={{ color: tokens.confidence.high.value }} />
              Test: {testTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="rounded-lg p-4"
              style={{
                backgroundColor: tokens.surface.secondary,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: tokens.text.muted }}>
                System Prompt
              </p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: tokens.text.secondary }}>
                {testTemplate?.systemPrompt}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {testTemplate?.variables.map((v, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{`{{${v}}}`}</Badge>
                ))}
              </div>
            </div>
            <div
              className="rounded-lg p-4"
              style={{
                backgroundColor: tokens.surface.secondary,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: tokens.text.muted }}>
                Variables (Sample Input)
              </p>
              <div className="grid gap-2">
                {testTemplate?.variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="text-xs font-mono w-28 shrink-0"
                      style={{ color: tokens.text.muted }}
                    >
                      {v}:
                    </span>
                    <Input className="h-7 text-xs" placeholder={`Enter ${v}...`} />
                  </div>
                ))}
              </div>
            </div>
            <div
              className="rounded-lg p-4"
              style={{ border: `1px solid ${tokens.border.default}` }}
            >
              <p className="text-xs font-medium mb-2" style={{ color: tokens.text.muted }}>
                AI Response
              </p>
              {testLoading ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  <span className="text-sm" style={{ color: tokens.text.muted }}>
                    Generating response via {testTemplate?.model}...
                  </span>
                </div>
              ) : testResponse ? (
                <pre
                  className="text-sm whitespace-pre-wrap font-sans"
                  style={{ color: tokens.text.secondary }}
                >
                  {testResponse}
                </pre>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestModalOpen(false)}>
              Close
            </Button>
            <Button onClick={() => testTemplate && handleTest(testTemplate)} disabled={testLoading}>
              <Play className="w-4 h-4 mr-1.5" /> Re-run Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Helpers ── */

/** Extract {{variable}} placeholders from a prompt string. */
function extractVariables(prompt: string | undefined): string[] {
  if (!prompt) return [];
  const matches = prompt.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];
}
