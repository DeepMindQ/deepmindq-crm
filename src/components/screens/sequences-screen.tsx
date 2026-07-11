'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Mail, Copy, Trash2, Loader2, Pencil, Play, ChevronDown, ChevronUp,
  X, Sparkles, Clock, MoreHorizontal, Eye, Send, GripVertical,
  ArrowUp, ArrowDown, Zap, FileText, LayoutList, Circle, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { fetchApi } from '@/lib/fetchApi'
import { EmptyState } from '@/components/shared/design-system'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface SequenceStep {
  id: string
  sequenceId: string
  stepNumber: number
  subject: string
  body: string
  delayMinutes: number
  cta: string | null
  status: string
  sentAt: string | null
  openedAt: string | null
  repliedAt: string | null
  createdAt: string
  updatedAt: string
}

interface Sequence {
  id: string
  name: string
  description: string | null
  status: string
  contactId: string | null
  companyId: string | null
  steps?: SequenceStep[]
  createdAt: string
  updatedAt: string
  _count?: { steps: number }
}

interface SequencesResponse {
  sequences: Sequence[]
  total: number
}

interface Template {
  id: string
  name: string
  subject: string
  body: string
  category: string
  description: string | null
  isBuiltIn: boolean
}

interface TemplatesResponse {
  templates: Template[]
  total: number
}

interface ContactOption {
  id: string
  name: string
  email: string | null
  company?: { id: string; name: string } | null
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const STATUS_TABS = ['all', 'draft', 'active', 'paused', 'completed'] as const
const STATUS_LABELS: Record<string, string> = {
  all: 'All',
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-sky-50 text-sky-700 border-sky-200',
}

const STEP_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  sent: 'bg-blue-100 text-blue-600',
  opened: 'bg-emerald-100 text-emerald-600',
  replied: 'bg-purple-100 text-purple-600',
  failed: 'bg-red-100 text-red-600',
}

const STEP_STATUS_ICONS: Record<string, typeof Circle> = {
  pending: Circle,
  sent: Send,
  opened: Eye,
  replied: CheckCircle2,
  failed: X,
}

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Immediately'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
  return `${Math.floor(minutes / 1440)}d`
}

/* ═══════════════════════════════════════════════════════════════
   Step Editor Form
   ═══════════════════════════════════════════════════════════════ */

interface StepFormData {
  subject: string
  body: string
  delayMinutes: number
  delayUnit: 'minutes' | 'hours' | 'days'
  cta: string
}

function emptyStep(): StepFormData {
  return { subject: '', body: '', delayMinutes: 1, delayUnit: 'days', cta: '' }
}

function delayToMinutes(val: number, unit: string): number {
  if (unit === 'minutes') return val
  if (unit === 'hours') return val * 60
  return val * 1440
}

function minutesToDelay(m: number): { val: number; unit: 'minutes' | 'hours' | 'days' } {
  if (m === 0) return { val: 0, unit: 'days' }
  if (m < 60) return { val: m, unit: 'minutes' }
  if (m < 1440) return { val: Math.round(m / 60), unit: 'hours' }
  return { val: Math.round(m / 1440), unit: 'days' }
}

/* ═══════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════ */

export function SequencesScreen() {
  const qc = useQueryClient()

  // ── Filters ──
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  // ── Dialog state ──
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null)
  const [detailSequence, setDetailSequence] = useState<Sequence | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Sequence | null>(null)
  const [executeDialog, setExecuteDialog] = useState<Sequence | null>(null)
  const [executeContactId, setExecuteContactId] = useState('')
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [templateInsertStepIdx, setTemplateInsertStepIdx] = useState<number>(-1)

  // ── Form state ──
  const [seqName, setSeqName] = useState('')
  const [seqDesc, setSeqDesc] = useState('')
  const [steps, setSteps] = useState<StepFormData[]>([emptyStep()])
  const [isSaving, setIsSaving] = useState(false)

  // ── Fetch sequences ──
  const { data, isLoading } = useQuery<SequencesResponse>({
    queryKey: ['sequences', statusFilter, search],
    queryFn: () => fetchApi<SequencesResponse>('/api/sequences', {
      params: {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      },
    }).then(r => {
      if (r.error) throw new Error(r.error)
      return r.data!
    }),
  })

  // ── Fetch contacts for execute dialog ──
  const { data: contactsData } = useQuery<{ data: ContactOption[] }>({
    queryKey: ['contacts-select-seq'],
    queryFn: () => fetchApi<ContactOption[]>('/api/contacts', {
      params: { limit: 200 },
    }).then(r => r.data ? { data: r.data } : { data: [] }),
  })

  // ── Fetch templates ──
  const { data: templatesData } = useQuery<TemplatesResponse>({
    queryKey: ['email-templates'],
    queryFn: () => fetchApi<TemplatesResponse>('/api/email-templates').then(r => {
      if (r.error) throw new Error(r.error)
      return r.data!
    }),
  })

  const sequences = data?.sequences ?? []
  const contacts = contactsData?.data ?? []
  const templates = templatesData?.templates ?? []

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (body: { name: string; description?: string }) => {
      const res = await fetchApi<Sequence>('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.error) throw new Error(res.error)
      return res.data!
    },
    onSuccess: (seq) => {
      toast.success('Sequence created')
      qc.invalidateQueries({ queryKey: ['sequences'] })
      // Now add the steps
      addStepsToSequence(seq.id, steps)
    },
    onError: (err) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetchApi<Sequence>(`/api/sequences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.error) throw new Error(res.error)
      return res.data!
    },
    onSuccess: () => {
      toast.success('Sequence updated')
      qc.invalidateQueries({ queryKey: ['sequences'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/api/sequences/${id}`, { method: 'DELETE' })
      if (res.error) throw new Error(res.error)
      return true
    },
    onSuccess: () => {
      toast.success('Sequence deleted')
      qc.invalidateQueries({ queryKey: ['sequences'] })
      setDeleteTarget(null)
      setDetailSequence(null)
    },
    onError: (err) => toast.error(err.message),
  })

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      // Fetch full sequence with steps
      const res = await fetchApi<Sequence>(`/api/sequences/${id}`)
      if (res.error) throw new Error(res.error)
      const source = res.data!
      // Create new
      const createRes = await fetchApi<Sequence>('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${source.name} (Copy)`, description: source.description || undefined }),
      })
      if (createRes.error) throw new Error(createRes.error)
      const newSeq = createRes.data!
      // Add steps
      if (source.steps) {
        for (const step of source.steps) {
          await fetchApi(`/api/sequences/${newSeq.id}/steps/${step.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: step.subject, body: step.body, delayMinutes: step.delayMinutes, cta: step.cta || undefined }),
          })
        }
      }
      return newSeq
    },
    onSuccess: () => {
      toast.success('Sequence duplicated')
      qc.invalidateQueries({ queryKey: ['sequences'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const executeMutation = useMutation({
    mutationFn: async ({ sequenceId, contactId }: { sequenceId: string; contactId: string }) => {
      const res = await fetchApi(`/api/sequences/${sequenceId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      })
      if (res.error) throw new Error(res.error)
      return res.data!
    },
    onSuccess: () => {
      toast.success('Sequence executed — first draft created')
      qc.invalidateQueries({ queryKey: ['sequences'] })
      setExecuteDialog(null)
      setExecuteContactId('')
    },
    onError: (err) => toast.error(err.message),
  })

  // ── Step management helpers ──
  const addStepsToSequence = async (sequenceId: string, stepsData: StepFormData[]) => {
    for (const step of stepsData) {
      if (!step.subject.trim() || !step.body.trim()) continue
      await fetchApi(`/api/sequences/${sequenceId}/steps/placeholder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: step.subject,
          body: step.body,
          delayMinutes: delayToMinutes(step.delayMinutes, step.delayUnit),
          cta: step.cta || undefined,
        }),
      })
    }
    qc.invalidateQueries({ queryKey: ['sequences'] })
  }

  const saveStepOrder = async (sequenceId: string, stepsList: SequenceStep[]) => {
    for (let i = 0; i < stepsList.length; i++) {
      if (stepsList[i].stepNumber !== i + 1) {
        await fetchApi(`/api/sequences/${sequenceId}/steps/${stepsList[i].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepNumber: i + 1 }),
        })
      }
    }
  }

  // ── Form handlers ──
  const openCreate = () => {
    setSeqName('')
    setSeqDesc('')
    setSteps([emptyStep()])
    setEditingSequence(null)
    setShowCreateDialog(true)
  }

  const openEdit = (seq: Sequence) => {
    setSeqName(seq.name)
    setSeqDesc(seq.description || '')
    if (seq.steps && seq.steps.length > 0) {
      setSteps(seq.steps.map(s => {
        const { val, unit } = minutesToDelay(s.delayMinutes)
        return { subject: s.subject, body: s.body, delayMinutes: val, delayUnit: unit, cta: s.cta || '' }
      }))
    } else {
      setSteps([emptyStep()])
    }
    setEditingSequence(seq)
    setShowCreateDialog(true)
  }

  const handleSave = async () => {
    if (!seqName.trim()) {
      toast.error('Name is required')
      return
    }
    const validSteps = steps.filter(s => s.subject.trim() && s.body.trim())
    if (validSteps.length === 0) {
      toast.error('Add at least one step with subject and body')
      return
    }

    setIsSaving(true)
    try {
      if (editingSequence) {
        await updateMutation.mutateAsync({
          id: editingSequence.id,
          body: { name: seqName.trim(), description: seqDesc.trim() || null },
        })
        // Delete existing steps and recreate
        for (const step of (editingSequence.steps || [])) {
          await fetchApi(`/api/sequences/${editingSequence.id}/steps/${step.id}`, { method: 'DELETE' })
        }
        await addStepsToSequence(editingSequence.id, steps)
      } else {
        await createMutation.mutateAsync({
          name: seqName.trim(),
          description: seqDesc.trim() || undefined,
        })
      }
      setShowCreateDialog(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDuplicate = (seq: Sequence) => {
    duplicateMutation.mutate(seq.id)
  }

  const stepOps = (idx: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= steps.length) return
    const newSteps = [...steps]
    ;[newSteps[idx], newSteps[target]] = [newSteps[target], newSteps[idx]]
    setSteps(newSteps)
  }

  const insertTemplate = (tmpl: Template) => {
    if (templateInsertStepIdx < 0) return
    setSteps(prev => {
      const next = [...prev]
      next[templateInsertStepIdx] = {
        ...next[templateInsertStepIdx],
        subject: tmpl.subject,
        body: tmpl.body,
        cta: next[templateInsertStepIdx].cta,
      }
      return next
    })
    setTemplatePickerOpen(false)
    toast.success(`Applied "${tmpl.name}" template`)
  }

  const toggleDetail = useCallback(async (seq: Sequence) => {
    if (detailSequence?.id === seq.id) {
      setDetailSequence(null)
      return
    }
    // Fetch full sequence with steps
    const res = await fetchApi<Sequence>(`/api/sequences/${seq.id}`)
    if (res.data) {
      setDetailSequence(res.data)
    }
  }, [detailSequence])

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Email Sequences</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage drip campaigns</p>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs">
          <Plus className="size-4 mr-2" />
          New Sequence
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 pb-px overflow-x-auto">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative',
              statusFilter === tab
                ? 'text-amber-700'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {STATUS_LABELS[tab]}
            {statusFilter === tab && (
              <motion.div
                layoutId="seq-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No sequences yet"
          description="Create your first email sequence to automate your outreach campaigns."
          actionLabel="Create Sequence"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sequences.map(seq => (
              <motion.div
                key={seq.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {/* Sequence Card */}
                <div
                  className="bg-white rounded-xl border border-gray-200 shadow-xs hover:shadow-sm transition-shadow"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3
                            className="font-semibold text-gray-900 cursor-pointer hover:text-amber-700 transition-colors truncate"
                            onClick={() => toggleDetail(seq)}
                          >
                            {seq.name}
                          </h3>
                          <Badge
                            variant="outline"
                            className={cn('text-xs font-medium', STATUS_STYLES[seq.status] || '')}
                          >
                            {STATUS_LABELS[seq.status] || seq.status}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {seq._count?.steps ?? seq.steps?.length ?? 0} steps
                          </span>
                        </div>
                        {seq.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{seq.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDistanceToNow(new Date(seq.createdAt), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Timeline visualization */}
                        {(seq._count?.steps || seq.steps?.length || 0) > 0 && (
                          <div className="flex items-center gap-1 mt-3">
                            {Array.from({ length: Math.min((seq._count?.steps || seq.steps?.length || 0), 8) }).map((_, i) => (
                              <div key={i} className="flex items-center">
                                <div className="size-2.5 rounded-full bg-amber-400" />
                                {i < Math.min((seq._count?.steps || seq.steps?.length || 0), 8) - 1 && (
                                  <div className="w-6 h-px bg-amber-200" />
                                )}
                              </div>
                            ))}
                            {(seq._count?.steps || seq.steps?.length || 0) > 8 && (
                              <span className="text-xs text-gray-400 ml-1">+{(seq._count?.steps || seq.steps?.length || 0) - 8}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 text-gray-400 hover:text-gray-600">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleDetail(seq)}>
                            <Eye className="size-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(seq)}>
                            <Pencil className="size-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(seq)}>
                            <Copy className="size-4 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          {(seq.status === 'draft' || seq.status === 'paused') && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setExecuteDialog(seq); setExecuteContactId(seq.contactId || '') }}>
                                <Play className="size-4 mr-2" /> Execute
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteTarget(seq)}
                          >
                            <Trash2 className="size-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Expanded detail view */}
                  <AnimatePresence>
                    {detailSequence?.id === seq.id && detailSequence.steps && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-gray-100 px-4 sm:px-5 py-4 bg-gray-50/50 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-700">Sequence Steps</h4>
                            <div className="flex gap-2">
                              {(detailSequence.status === 'draft' || detailSequence.status === 'paused') && (
                                <Button
                                  size="sm"
                                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs"
                                  onClick={() => { setExecuteDialog(detailSequence); setExecuteContactId(detailSequence.contactId || '') }}
                                >
                                  <Play className="size-3 mr-1.5" />
                                  Execute
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="relative">
                            {/* Vertical timeline line */}
                            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

                            <div className="space-y-4">
                              {detailSequence.steps.map((step, idx) => {
                                const StatusIcon = STEP_STATUS_ICONS[step.status] || Circle
                                return (
                                  <div key={step.id} className="relative flex gap-4">
                                    {/* Timeline dot */}
                                    <div className="relative z-10 flex items-center justify-center size-8 rounded-full bg-white border-2 border-gray-200 shrink-0 mt-1">
                                      <StatusIcon className={cn('size-3.5', step.status === 'pending' ? 'text-gray-400' : 'text-current')} />
                                    </div>

                                    {/* Step content */}
                                    <div className="flex-1 min-w-0 bg-white rounded-lg border border-gray-200 p-3">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="text-xs font-medium text-gray-400">Step {step.stepNumber}</span>
                                        <Badge
                                          variant="outline"
                                          className={cn('text-[10px] font-medium', STEP_STATUS_STYLES[step.status] || '')}
                                        >
                                          {step.status}
                                        </Badge>
                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                          <Clock className="size-2.5" />
                                          {formatDelay(step.delayMinutes)} delay
                                        </span>
                                      </div>
                                      <p className="text-sm font-medium text-gray-800 truncate">{step.subject}</p>
                                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{step.body}</p>
                                      {step.cta && (
                                        <p className="text-xs text-amber-600 mt-1.5 font-medium">CTA: {step.cta}</p>
                                      )}
                                      {step.sentAt && (
                                        <p className="text-[10px] text-gray-400 mt-1.5">
                                          Sent {formatDistanceToNow(new Date(step.sentAt), { addSuffix: true })}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) setShowCreateDialog(false) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingSequence ? 'Edit Sequence' : 'New Sequence'}
            </DialogTitle>
            <DialogDescription>
              {editingSequence ? 'Update sequence details and steps.' : 'Define your email sequence steps.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Sequence details */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="seq-name" className="text-sm font-medium">Name</Label>
                <Input
                  id="seq-name"
                  placeholder="e.g., Cold Outreach 5-Step"
                  value={seqName}
                  onChange={e => setSeqName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="seq-desc" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="seq-desc"
                  placeholder="Optional description..."
                  value={seqDesc}
                  onChange={e => setSeqDesc(e.target.value)}
                  className="mt-1 resize-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Steps header */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <LayoutList className="size-4" />
                Steps ({steps.length})
              </h4>
            </div>

            {/* Steps list */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50/50"
                >
                  {/* Step header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 flex items-center gap-2">
                      <GripVertical className="size-3.5 text-gray-300" />
                      Step {idx + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-gray-400 hover:text-gray-600"
                        onClick={() => stepOps(idx, 'up')}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-gray-400 hover:text-gray-600"
                        onClick={() => stepOps(idx, 'down')}
                        disabled={idx === steps.length - 1}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-gray-400 hover:text-amber-600"
                        onClick={() => { setTemplatePickerOpen(true); setTemplateInsertStepIdx(idx) }}
                        title="Insert template"
                      >
                        <FileText className="size-3.5" />
                      </Button>
                      {steps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-gray-400 hover:text-red-600"
                          onClick={() => setSteps(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Subject</Label>
                    <Input
                      placeholder="Email subject line..."
                      value={step.subject}
                      onChange={e => {
                        const next = [...steps]
                        next[idx] = { ...next[idx], subject: e.target.value }
                        setSteps(next)
                      }}
                      className="mt-1 text-sm"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Body</Label>
                    <Textarea
                      placeholder="Email body... Use {{firstName}}, {{company}}, {{cta}} for variables."
                      value={step.body}
                      onChange={e => {
                        const next = [...steps]
                        next[idx] = { ...next[idx], body: e.target.value }
                        setSteps(next)
                      }}
                      className="mt-1 text-sm resize-none"
                      rows={4}
                    />
                  </div>

                  {/* Delay + CTA */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Label className="text-xs font-medium text-gray-500">Delay Before Send</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="number"
                          min={0}
                          value={step.delayMinutes}
                          onChange={e => {
                            const next = [...steps]
                            next[idx] = { ...next[idx], delayMinutes: Math.max(0, parseInt(e.target.value) || 0) }
                            setSteps(next)
                          }}
                          className="w-24 text-sm"
                        />
                        <Select
                          value={step.delayUnit}
                          onValueChange={(v: 'minutes' | 'hours' | 'days') => {
                            const next = [...steps]
                            next[idx] = { ...next[idx], delayUnit: v }
                            setSteps(next)
                          }}
                        >
                          <SelectTrigger className="w-24 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutes</SelectItem>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs font-medium text-gray-500">CTA</Label>
                      <Input
                        placeholder="e.g., Book a 15-min call"
                        value={step.cta}
                        onChange={e => {
                          const next = [...steps]
                          next[idx] = { ...next[idx], cta: e.target.value }
                          setSteps(next)
                        }}
                        className="mt-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add step button */}
            <Button
              variant="outline"
              className="w-full border-dashed border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400"
              onClick={() => setSteps(prev => [...prev, emptyStep()])}
            >
              <Plus className="size-4 mr-2" />
              Add Step
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || createMutation.isPending || updateMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            >
              {(isSaving || createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="size-4 mr-2 animate-spin" />
              )}
              {editingSequence ? 'Update Sequence' : 'Create Sequence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Template Picker Dialog ── */}
      <Dialog open={templatePickerOpen} onOpenChange={(open) => { if (!open) setTemplatePickerOpen(false) }}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Choose a Template</DialogTitle>
            <DialogDescription>
              Select a template to fill the step content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {templates.map(tmpl => (
              <button
                key={tmpl.id}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
                onClick={() => insertTemplate(tmpl)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{tmpl.name}</span>
                  <Badge variant="outline" className="text-[10px] font-normal text-gray-400">{tmpl.category}</Badge>
                  {tmpl.isBuiltIn && (
                    <Badge variant="outline" className="text-[10px] font-normal text-gray-400">Built-in</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">Subject: {tmpl.subject}</p>
                {tmpl.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{tmpl.description}</p>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Execute Dialog ── */}
      <Dialog open={!!executeDialog} onOpenChange={(open) => { if (!open) setExecuteDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="size-5 text-amber-600" />
              Execute Sequence
            </DialogTitle>
            <DialogDescription>
              Select a contact to execute this sequence for. The first step will be generated as a draft.
            </DialogDescription>
          </DialogHeader>

          {executeDialog && (
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-sm font-medium">Sequence</Label>
                <p className="text-sm text-gray-700 mt-0.5 font-medium">{executeDialog.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {executeDialog.steps?.length || executeDialog._count?.steps || 0} steps
                </p>
              </div>

              <div>
                <Label htmlFor="exec-contact" className="text-sm font-medium">Contact</Label>
                <Select value={executeContactId} onValueChange={setExecuteContactId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.company ? ` — ${c.company.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteDialog(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (executeDialog && executeContactId) {
                  executeMutation.mutate({ sequenceId: executeDialog.id, contactId: executeContactId })
                } else {
                  toast.error('Please select a contact')
                }
              }}
              disabled={!executeContactId || executeMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            >
              {executeMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              <Play className="size-4 mr-2" />
              Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sequence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will also delete all its steps. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}