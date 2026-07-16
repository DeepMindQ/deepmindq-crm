'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, CheckCircle2, Circle, Pencil, Trash2, Loader2, Filter,
  Calendar, Building2, User, Clock, AlertTriangle, X, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { fetchApi } from '@/lib/fetchApi'
import { EmptyState } from '@/components/shared/design-system'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, isToday, isPast, format } from 'date-fns'

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface TaskRow {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'overdue'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate: string | null
  completedAt: string | null
  companyId: string | null
  contactId: string | null
  companyName: string | null
  contactName: string | null
  createdAt: string
  updatedAt: string
}

interface CompanyOption {
  id: string
  name: string
}

interface ContactOption {
  id: string
  name: string
  companyId: string
}

interface TasksResponse {
  data: TaskRow[]
  total: number
}

/* ═══════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════ */

const STATUS_TABS = ['all', 'pending', 'in_progress', 'completed', 'overdue'] as const
const STATUS_LABELS: Record<string, string> = {
  all: 'All',
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
}
const PRIORITY_OPTIONS = ['all', 'low', 'medium', 'high', 'urgent'] as const
const PRIORITY_LABELS: Record<string, string> = {
  all: 'All Priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

function getStatusVariant(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-gray-50 text-gray-600 border-gray-200',
    in_progress: 'bg-sky-50 text-sky-700 border-sky-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    overdue: 'bg-red-50 text-red-700 border-red-200',
  }
  return map[status] || 'bg-gray-50 text-gray-600 border-gray-200'
}

function getPriorityVariant(priority: string): string {
  const map: Record<string, string> = {
    low: 'bg-gray-50 text-gray-500 border-gray-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    urgent: 'bg-red-50 text-red-700 border-red-200',
  }
  return map[priority] || 'bg-gray-50 text-gray-500 border-gray-200'
}

function getDueDateDisplay(dueDate: string | null): { text: string; className: string } | null {
  if (!dueDate) return null
  const d = new Date(dueDate)
  if (isToday(d)) return { text: 'Today', className: 'text-amber-600 font-medium' }
  if (isPast(d)) return { text: format(d, 'MMM d'), className: 'text-red-600 font-medium' }
  return { text: format(d, 'MMM d'), className: 'text-gray-500' }
}

const INITIAL_FORM = {
  title: '',
  description: '',
  status: 'pending' as string,
  priority: 'medium' as string,
  dueDate: '' as string,
  companyId: '',
  contactId: '',
}

/* ═══════════════════════════════════════════════════════════════════════
   Task Card Animation
   ═══════════════════════════════════════════════════════════════════════ */

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: Math.min(i * 30, 200), duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
}

/* ═══════════════════════════════════════════════════════════════════════
   TasksScreen
   ═══════════════════════════════════════════════════════════════════════ */

export function TasksScreen() {
  const { setActiveView, setSelectedCompanyId, setSelectedContactId, setTaskCount } = useAppStore()
  const qc = useQueryClient()

  // ── Filters ──
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  // ── Dialog ──
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)
  const [form, setForm] = useState(INITIAL_FORM)

  // ── Delete ──
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ── Date picker ──
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // ── Data ──
  const { data, isLoading } = useQuery<TasksResponse>({
    queryKey: ['tasks', statusFilter, priorityFilter, search],
    queryFn: () => fetchApi<TaskRow[]>('/api/tasks', {
      params: {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        limit: 100,
        offset: 0,
        search: search || undefined,
      },
    }).then(res => {
      if (res.error) throw new Error(res.error)
      return { data: res.data || [], total: (res.data || []).length }
    }),
  })

  const tasks = data?.data || []
  const total = data?.total || 0

  // Update task count in store
  const { data: allTasksData } = useQuery<TasksResponse>({
    queryKey: ['tasks-count'],
    queryFn: () => fetchApi<TaskRow[]>('/api/tasks', {
      params: { limit: 1, offset: 0 },
    }).then(res => {
      if (res.error) throw new Error(res.error)
      return { data: res.data || [], total: (res.data || []).length }
    }),
    staleTime: 30_000,
  })

  // Companies & contacts for selects
  const { data: companies } = useQuery<CompanyOption[]>({
    queryKey: ['companies-select'],
    queryFn: () => fetchApi<CompanyOption[]>('/api/companies', {
      params: { limit: 1000, pageSize: 1000 },
    }).then(res => {
      if (res.error) throw new Error(res.error)
      return (res.data as any)?.companies || res.data || []
    }).then((cs: any[]) => cs.map((c: any) => ({ id: c.id, name: c.name }))),
  })

  const { data: contacts } = useQuery<ContactOption[]>({
    queryKey: ['contacts-select', form.companyId],
    queryFn: () => fetchApi<ContactOption[]>('/api/contacts', {
      params: {
        limit: 500,
        pageSize: 500,
        companyId: form.companyId || undefined,
      },
    }).then(res => {
      if (res.error) throw new Error(res.error)
      return (res.data as any)?.contacts || res.data || []
    }).then((cs: any[]) => cs.map((c: any) => ({ id: c.id, name: c.name, companyId: c.companyId }))),
    enabled: !!form.companyId,
  })

  // Update store count
  useMemo(() => {
    if (allTasksData?.total !== undefined) {
      setTaskCount(allTasksData.total)
    }
  }, [allTasksData?.total, setTaskCount])

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => fetchApi('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => { if (res.error) throw new Error(res.error); return res.data }),
    onSuccess: () => {
      toast.success('Task created')
      setDialogOpen(false)
      resetForm()
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['tasks-count'] })
    },
    onError: (e) => toast.error(e.message || 'Failed to create task'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => fetchApi(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => { if (res.error) throw new Error(res.error); return res.data }),
    onSuccess: () => {
      toast.success('Task updated')
      setDialogOpen(false)
      setEditingTask(null)
      resetForm()
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['tasks-count'] })
    },
    onError: (e) => toast.error(e.message || 'Failed to update task'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/tasks/${id}`, {
      method: 'DELETE',
    }).then(res => { if (res.error) throw new Error(res.error); return res.data }),
    onSuccess: () => {
      toast.success('Task deleted')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['tasks-count'] })
    },
    onError: (e) => toast.error(e.message || 'Failed to delete task'),
  })

  const toggleCompleteMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => fetchApi(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: completed ? 'completed' : 'pending',
        completedAt: completed ? new Date().toISOString() : null,
      }),
    }).then(res => { if (res.error) throw new Error(res.error); return res.data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['tasks-count'] })
    },
    onError: (e) => toast.error(e.message || 'Failed to update task'),
  })

  // ── Helpers ──
  const resetForm = () => setForm(INITIAL_FORM)

  const openCreate = () => {
    setEditingTask(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (task: TaskRow) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      companyId: task.companyId || '',
      contactId: task.contactId || '',
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.title.trim()) return
    const body: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      companyId: form.companyId || undefined,
      contactId: form.contactId || undefined,
    }
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, body })
    } else {
      createMutation.mutate(body)
    }
  }

  const isOverdue = (task: TaskRow) =>
    task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'completed'

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Tasks</h1>
          {total > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 tabular-nums">
              {total}
            </span>
          )}
        </div>
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs shrink-0"
          onClick={openCreate}
        >
          <Plus className="size-4 sm:mr-1.5" />
          <span className="hidden sm:inline">New Task</span>
        </Button>
      </div>

      {/* ── Status Tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 -mb-0.5">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150',
              statusFilter === s
                ? 'bg-white text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
            )}
          >
            {STATUS_LABELS[s]}
            {s !== 'all' && (
              <span className={cn(
                'text-[11px] tabular-nums',
                statusFilter === s ? 'text-gray-700' : 'text-gray-600',
              )}>
                {tasks.filter(t => t.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Secondary Filters ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-600" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-white border-gray-200 rounded-lg text-sm focus:border-amber-400 focus:ring-amber-100"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36 h-9 bg-white border-gray-200 rounded-lg text-sm">
            <Filter className="size-3.5 mr-1.5 text-gray-600" />
            <SelectValue placeholder={PRIORITY_LABELS[priorityFilter]} />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map(p => (
              <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Task List ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-4 w-48 rounded" />
              </div>
              <Skeleton className="h-3 w-72 rounded" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl bg-white card-rest overflow-hidden">
          <EmptyState
            icon={CheckCircle2}
            title="No tasks found"
            description={search || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'Create your first task to get started.'}
            actionLabel="New Task"
            onAction={openCreate}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {tasks.map((task, i) => {
              const overdue = isOverdue(task)
              const dueDateInfo = getDueDateDisplay(task.dueDate)
              return (
                <motion.div
                  key={task.id}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  className={cn(
                    'rounded-xl bg-white card-rest p-4 group transition-shadow hover:shadow-md',
                    overdue && 'border-l-[3px] border-l-red-400',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-0.5">
                      <Checkbox
                        checked={task.status === 'completed'}
                        onCheckedChange={(checked) => {
                          toggleCompleteMutation.mutate({ id: task.id, completed: !!checked })
                        }}
                        className="size-5 rounded-md border-gray-300 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            'text-sm font-semibold text-gray-900 leading-snug',
                            task.status === 'completed' && 'line-through text-gray-600',
                          )}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => openEdit(task)}
                            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                            aria-label="Edit task"
                          >
                            <Pencil className="size-3.5 text-gray-600" />
                          </button>
                          <button
                            onClick={() => setDeleteId(task.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                            aria-label="Delete task"
                          >
                            <Trash2 className="size-3.5 text-gray-600 hover:text-red-500" />
                          </button>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium border', getStatusVariant(task.status))}>
                          {STATUS_LABELS[task.status] || task.status}
                        </span>
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium border', getPriorityVariant(task.priority))}>
                          {PRIORITY_LABELS[task.priority] || task.priority}
                        </span>

                        {dueDateInfo && (
                          <span className={cn('inline-flex items-center gap-1 text-[11px]', dueDateInfo.className)}>
                            <Calendar className="size-3" />
                            {dueDateInfo.text}
                            {overdue && <AlertTriangle className="size-3" />}
                          </span>
                        )}

                        {task.companyName && (
                          <button
                            onClick={() => {
                              setSelectedCompanyId(task.companyId!)
                              setActiveView('company-profile')
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-amber-600 transition-colors"
                          >
                            <Building2 className="size-3" />
                            {task.companyName}
                          </button>
                        )}

                        {task.contactName && (
                          <button
                            onClick={() => {
                              if (task.companyId) setSelectedCompanyId(task.companyId)
                              setSelectedContactId(task.contactId!)
                              setActiveView('contact-profile')
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-amber-600 transition-colors"
                          >
                            <User className="size-3" />
                            {task.contactName}
                          </button>
                        )}

                        <span className="text-[11px] text-gray-600 ml-auto">
                          {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) { setEditingTask(null); resetForm() }
      }}>
        <DialogContent className="sm:max-w-lg rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingTask ? 'Edit Task' : 'New Task'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            {/* Title */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-800">Title</Label>
              <Input
                placeholder="What needs to be done?"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="border-gray-200 rounded-lg"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-800">Description</Label>
              <Textarea
                placeholder="Add details..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="border-gray-200 rounded-lg min-h-[80px] resize-none"
                rows={3}
              />
            </div>

            {/* Status & Priority row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-800">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="border-gray-200 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-800">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="border-gray-200 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due Date */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-800">Due Date</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center gap-2 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-left hover:bg-gray-50 transition-colors',
                      !form.dueDate && 'text-gray-600',
                    )}
                  >
                    <Calendar className="size-4 text-gray-600" />
                    {form.dueDate ? format(new Date(form.dueDate), 'MMM d, yyyy') : 'Pick a date'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={form.dueDate ? new Date(form.dueDate) : undefined}
                    onSelect={(d) => {
                      setForm(f => ({ ...f, dueDate: d ? format(d, 'yyyy-MM-dd') : '' }))
                      setDatePickerOpen(false)
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Company */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-800">Company (optional)</Label>
              <Select
                value={form.companyId}
                onValueChange={v => setForm(f => ({ ...f, companyId: v, contactId: '' }))}
              >
                <SelectTrigger className="border-gray-200 rounded-lg">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {(companies || []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contact */}
            {form.companyId && (
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-800">Contact (optional)</Label>
                <Select
                  value={form.contactId}
                  onValueChange={v => setForm(f => ({ ...f, contactId: v }))}
                >
                  <SelectTrigger className="border-gray-200 rounded-lg">
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {(contacts || []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => { setDialogOpen(false); setEditingTask(null); resetForm() }}
              className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
              onClick={handleSave}
              disabled={!form.title.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              )}
              {editingTask ? 'Save Changes' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The task will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
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