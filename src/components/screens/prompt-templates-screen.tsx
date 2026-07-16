'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, FileCode2, Mail, Microscope, Layers, Edit3, Copy, Trash2,
  ChevronDown, X, Eye, Sparkles, Check, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { fetchApi } from '@/lib/fetchApi'

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface PromptTemplate {
  id: string
  name: string
  category: string
  description: string | null
  systemPrompt: string
  userPromptTemplate: string
  variables: string[]
  isBuiltIn: boolean
  createdAt: string | null
  updatedAt: string | null
}

type CategoryFilter = 'all' | 'email' | 'research' | 'general'

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Mail; color: string; bg: string }> = {
  email: { label: 'Email', icon: Mail, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  research: { label: 'Research', icon: Microscope, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  general: { label: 'General', icon: Layers, color: 'text-gray-800', bg: 'bg-gray-50 border-gray-200' },
}

const CATEGORIES: CategoryFilter[] = ['all', 'email', 'research', 'general']

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))]
}

function fillPreview(template: string): string {
  return template
    .replace(/\{\{contactName\}\}/g, 'Jane Smith')
    .replace(/\{\{companyName\}\}/g, 'Acme Corp')
    .replace(/\{\{industry\}\}/g, 'SaaS')
    .replace(/\{\{researchContext\}\}/g, 'Recently raised Series B funding and is expanding to European markets.')
    .replace(/\{\{employeeSize\}\}/g, '201-500')
    .replace(/\{\{location\}\}/g, 'San Francisco, CA')
}

/* ═══════════════════════════════════════════════════════════════════════
   Screen
   ═══════════════════════════════════════════════════════════════════════ */

export default function PromptTemplatesScreen() {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  /* ── Form state ── */
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('email')
  const [formDescription, setFormDescription] = useState('')
  const [formSystemPrompt, setFormSystemPrompt] = useState('')
  const [formUserTemplate, setFormUserTemplate] = useState('')
  const [formVariables, setFormVariables] = useState<string[]>([])

  /* ── Data fetch ── */
  const { data: templates = [], isLoading } = useQuery<PromptTemplate[]>({
    queryKey: ['prompt-templates', category],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (category !== 'all') params.category = category
      const res = await fetchApi<PromptTemplate[]>('/api/prompt-templates', { params })
      if (res.error) throw new Error(res.error)
      return res.data ?? []
    },
  })

  /* ── Create/Update mutation ── */
  const saveMutation = useMutation({
    mutationFn: async (body: any) => {
      if (editingTemplate && !editingTemplate.isBuiltIn) {
        const res = await fetchApi(`/api/prompt-templates/${editingTemplate.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.error) throw new Error(res.error)
        return res.data
      } else {
        const res = await fetchApi('/api/prompt-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.error) throw new Error(res.error)
        return res.data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-templates'] })
      toast.success(editingTemplate ? 'Template updated' : 'Template created')
      closeDialog()
    },
    onError: (err) => toast.error(err.message),
  })

  /* ── Delete mutation ── */
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/api/prompt-templates/${id}`, { method: 'DELETE' })
      if (res.error) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-templates'] })
      toast.success('Template deleted')
      setDeleteId(null)
    },
    onError: (err) => toast.error(err.message),
  })

  /* ── Duplicate mutation ── */
  const duplicateMutation = useMutation({
    mutationFn: async (t: PromptTemplate) => {
      const res = await fetchApi('/api/prompt-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${t.name} (Copy)`,
          category: t.category,
          description: t.description,
          systemPrompt: t.systemPrompt,
          userPromptTemplate: t.userPromptTemplate,
          variables: t.variables,
        }),
      })
      if (res.error) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-templates'] })
      toast.success('Template duplicated')
    },
    onError: (err) => toast.error(err.message),
  })

  /* ── Filtered templates ── */
  const filtered = useMemo(() => {
    if (!search.trim()) return templates
    const q = search.toLowerCase()
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    )
  }, [templates, search])

  /* ── Dialog helpers ── */
  function openCreate() {
    setEditingTemplate(null)
    setFormName('')
    setFormCategory('email')
    setFormDescription('')
    setFormSystemPrompt('')
    setFormUserTemplate('')
    setFormVariables([])
    setDialogOpen(true)
  }

  function openEdit(t: PromptTemplate) {
    setEditingTemplate(t)
    setFormName(t.name)
    setFormCategory(t.category)
    setFormDescription(t.description ?? '')
    setFormSystemPrompt(t.systemPrompt)
    setFormUserTemplate(t.userPromptTemplate)
    setFormVariables([...t.variables])
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingTemplate(null)
  }

  function handleTemplateChange(value: string) {
    setFormUserTemplate(value)
    setFormVariables(extractVariables(value))
  }

  function handleSave() {
    if (!formName.trim() || !formSystemPrompt.trim() || !formUserTemplate.trim()) {
      toast.error('Please fill in all required fields')
      return
    }
    saveMutation.mutate({
      name: formName.trim(),
      category: formCategory,
      description: formDescription.trim() || undefined,
      systemPrompt: formSystemPrompt.trim(),
      userPromptTemplate: formUserTemplate.trim(),
      variables: formVariables,
    })
  }

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">Prompt Library</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage email & research prompt templates</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-600" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? 'default' : 'outline'}
              size="sm"
              className={`h-8 text-xs rounded-lg ${category === cat ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat === 'all' ? 'All' : CATEGORY_CONFIG[cat]?.label ?? cat}
            </Button>
          ))}
          <Button
            onClick={openCreate}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg h-8 text-xs ml-auto"
          >
            <Plus className="size-3.5 mr-1" />
            New Template
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gray-100 mb-4">
            <FileCode2 className="size-7 text-gray-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No templates found</h3>
          <p className="text-sm text-gray-500 max-w-sm text-center mb-6 leading-relaxed">
            {search
              ? 'No templates match your search. Try a different query.'
              : 'No custom templates yet. Create one or use our built-in templates.'}
          </p>
          {!search && (
            <Button
              onClick={openCreate}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            >
              <Plus className="size-4 mr-1.5" />
              Create Template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((template) => {
            const catConfig = CATEGORY_CONFIG[template.category] ?? CATEGORY_CONFIG.general
            const CatIcon = catConfig.icon
            const isExpanded = expandedId === template.id
            const preview = fillPreview(template.userPromptTemplate)

            return (
              <div
                key={template.id}
                className="rounded-xl bg-white card-rest p-5 slide-up"
              >
                {/* Top row: name + badges */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{template.name}</h3>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-5 font-medium ${catConfig.bg} ${catConfig.color} border`}
                      >
                        <CatIcon className="size-3 mr-0.5" />
                        {catConfig.label}
                      </Badge>
                    </div>
                    {template.description && (
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{template.description}</p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${template.isBuiltIn ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700'}`}
                  >
                    {template.isBuiltIn ? 'Built-in' : 'Custom'}
                  </Badge>
                </div>

                {/* Variable chips */}
                {template.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {template.variables.map((v) => (
                      <code
                        key={v}
                        className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                      >
                        {'{{'}{v}{'}}'}
                      </code>
                    ))}
                  </div>
                )}

                {/* System prompt preview */}
                <div className="bg-gray-50 rounded-lg p-2.5 mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 font-medium mb-1">System Prompt</p>
                  <p className="text-xs text-gray-600 font-mono leading-relaxed line-clamp-2">
                    {template.systemPrompt}
                  </p>
                </div>

                {/* User template preview */}
                <div className="bg-gray-50 rounded-lg p-2.5 mb-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 font-medium mb-1">User Template</p>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                    {template.userPromptTemplate}
                  </p>
                </div>

                {/* Expandable preview section */}
                {isExpanded && (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 mb-3">
                    <p className="text-[10px] uppercase tracking-wider text-amber-600 font-medium mb-1.5">
                      <Eye className="size-3 inline mr-1" />
                      Preview with sample data
                    </p>
                    <p className="text-xs text-gray-800 leading-relaxed">{preview}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    onClick={() => setExpandedId(isExpanded ? null : template.id)}
                  >
                    <Eye className="size-3.5 mr-1" />
                    {isExpanded ? 'Hide' : 'Preview'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    onClick={() => duplicateMutation.mutate(template)}
                  >
                    <Copy className="size-3.5 mr-1" />
                    Duplicate
                  </Button>
                  {!template.isBuiltIn && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-gray-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => openEdit(template)}
                      >
                        <Edit3 className="size-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteId(template.id)}
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-600" />
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Modify your custom prompt template.' : 'Create a new prompt template for email generation or research.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name + Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Warm Introduction Email"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category *</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of when to use this template"
                className="h-9"
              />
            </div>

            {/* System Prompt */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">System Prompt *</Label>
              <Textarea
                value={formSystemPrompt}
                onChange={(e) => setFormSystemPrompt(e.target.value)}
                placeholder="You are a professional B2B sales writer..."
                className="font-mono text-xs min-h-[100px]"
                rows={5}
              />
            </div>

            {/* User Prompt Template */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                User Prompt Template *{' '}
                <span className="text-gray-600 font-normal">— use {'{{variableName}}'} for placeholders</span>
              </Label>
              <Textarea
                value={formUserTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                placeholder="Write a cold email to {{contactName}} at {{companyName}}..."
                className="font-mono text-xs min-h-[100px]"
                rows={5}
              />
            </div>

            {/* Detected Variables */}
            {formVariables.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500">Detected Variables</Label>
                <div className="flex flex-wrap gap-1.5">
                  {formVariables.map((v) => (
                    <code
                      key={v}
                      className="text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded"
                    >
                      {'{{'}{v}{'}}'}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Live Preview */}
            {formUserTemplate && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500">Preview</Label>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {fillPreview(formUserTemplate)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={closeDialog} className="rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !formName.trim() || !formSystemPrompt.trim() || !formUserTemplate.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            >
              {saveMutation.isPending && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              {deleteMutation.isPending && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}