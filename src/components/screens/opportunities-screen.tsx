'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, LayoutGrid, List, ChevronRight, Pencil, Trash2, Loader2,
  Building2, User, Clock, Target, ArrowRight, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { fetchApi } from '@/lib/fetchApi'
import { EmptyState, SortableHeader } from '@/components/shared/design-system'
import { cn } from '@/lib/utils'
import { getOppStatusVariant, getStatusBorder } from '@/lib/constants'
import { formatDistanceToNow, differenceInDays } from 'date-fns'
import type { OpportunityStatus } from '@/lib/types'

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface OppRow {
  id: string
  companyId: string
  title: string
  description: string | null
  targetContactId: string | null
  status: OpportunityStatus
  nextAction: string | null
  value: number | null
  createdAt: string
  updatedAt: string
  companyName?: string | null
  contactName?: string | null
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

/* ═══════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════ */

const PIPELINE_STAGES: { key: OpportunityStatus; label: string; color: string }[] = [
  { key: 'researching', label: 'Researching', color: '#0ea5e9' },
  { key: 'qualified', label: 'Qualified', color: '#3b82f6' },
  { key: 'proposal', label: 'Proposal', color: '#8b5cf6' },
  { key: 'negotiation', label: 'Negotiation', color: '#f59e0b' },
  { key: 'won', label: 'Won', color: '#22c55e' },
  { key: 'lost', label: 'Lost', color: '#ef4444' },
]

const ACTIVE_STAGES = PIPELINE_STAGES.filter(s => !['won', 'lost', 'archived'].includes(s.key))

function getNextStage(current: OpportunityStatus): OpportunityStatus | null {
  const idx = PIPELINE_STAGES.findIndex(s => s.key === current)
  if (idx < 0 || idx >= PIPELINE_STAGES.length - 1) return null
  return PIPELINE_STAGES[idx + 1].key
}

const INITIAL_FORM = {
  title: '',
  description: '',
  companyId: '',
  targetContactId: '',
  status: 'researching' as string,
  nextAction: '',
}

/* ═══════════════════════════════════════════════════════════════════════
   OpportunitiesScreen
   ═══════════════════════════════════════════════════════════════════════ */

export function OpportunitiesScreen() {
  const { setActiveView, setSelectedCompanyId, setSelectedContactId } = useAppStore()
  const qc = useQueryClient()

  // ── View mode ──
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  // ── Dialog ──
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingOpp, setEditingOpp] = useState<OppRow | null>(null)
  const [form, setForm] = useState(INITIAL_FORM)

  // ── Delete ──
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ── List sort ──
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // ── Data ──
  const { data: opps, isLoading } = useQuery<OppRow[]>({
    queryKey: ['opportunities-all'],
    queryFn: () => fetchApi<OppRow[]>('/api/opportunities', {
      params: { limit: 200 },
    }).then(res => {
      if (res.error) throw new Error(res.error)
      return (res.data as any)?.opportunities || res.data || []
    }),
  })

  const allOpps = opps || []

  // ── Derived: grouped by stage ──
  const grouped = useMemo(() => {
    const map = new Map<OpportunityStatus, OppRow[]>()
    for (const s of PIPELINE_STAGES) map.set(s.key, [])
    for (const o of allOpps) {
      const list = map.get(o.status)
      if (list) list.push(o)
    }
    return map
  }, [allOpps])

  // ── Stage summary ──
  const totalActiveValue = useMemo(() =>
    allOpps.filter(o => !['won', 'lost', 'archived'].includes(o.status)).reduce((s, o) => s + (o.value || 0), 0),
    [allOpps],
  )

  const totalWonValue = useMemo(() =>
    allOpps.filter(o => o.status === 'won').reduce((s, o) => s + (o.value || 0), 0),
    [allOpps],
  )

  // ── Sorted list for list view ──
  const sortedOpps = useMemo(() => {
    return [...allOpps].sort((a, b) => {
      const aVal = (a as any)[sortKey] ?? ''
      const bVal = (b as any)[sortKey] ?? ''
      if (typeof aVal === 'number' && typeof bVal === 'number')
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [allOpps, sortKey, sortDir])

  // ── Companies & contacts for selects ──
  const { data: companies } = useQuery<CompanyOption[]>({
    queryKey: ['companies-select-opp'],
    queryFn: () => fetchApi<CompanyOption[]>('/api/companies', {
      params: { limit: 1000, pageSize: 1000 },
    }).then(res => {
      if (res.error) throw new Error(res.error)
      return (res.data as any)?.companies || res.data || []
    }).then((cs: any[]) => cs.map((c: any) => ({ id: c.id, name: c.name }))),
  })

  const { data: contacts } = useQuery<ContactOption[]>({
    queryKey: ['contacts-select-opp', form.companyId],
    queryFn: () => fetchApi<ContactOption[]>('/api/contacts', {
      params: { limit: 500, pageSize: 500, companyId: form.companyId || undefined },
    }).then(res => {
      if (res.error) throw new Error(res.error)
      return (res.data as any)?.contacts || res.data || []
    }).then((cs: any[]) => cs.map((c: any) => ({ id: c.id, name: c.name, companyId: c.companyId }))),
    enabled: !!form.companyId,
  })

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => fetchApi('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => { if (res.error) throw new Error(res.error); return res.data }),
    onSuccess: () => {
      toast.success('Opportunity created')
      setDialogOpen(false)
      resetForm()
      qc.invalidateQueries({ queryKey: ['opportunities'] })
    },
    onError: (e) => toast.error(e.message || 'Failed to create opportunity'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => fetchApi(`/api/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => { if (res.error) throw new Error(res.error); return res.data }),
    onSuccess: (_, vars) => {
      toast.success('Opportunity updated')
      setDialogOpen(false)
      setEditingOpp(null)
      resetForm()
      qc.invalidateQueries({ queryKey: ['opportunities'] })
    },
    onError: (e) => toast.error(e.message || 'Failed to update opportunity'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/opportunities/${id}`, {
      method: 'DELETE',
    }).then(res => { if (res.error) throw new Error(res.error); return res.data }),
    onSuccess: () => {
      toast.success('Opportunity deleted')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['opportunities'] })
    },
    onError: (e) => toast.error(e.message || 'Failed to delete opportunity'),
  })

  // ── Helpers ──
  const resetForm = () => setForm(INITIAL_FORM)

  const openCreate = () => {
    setEditingOpp(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (opp: OppRow) => {
    setEditingOpp(opp)
    setForm({
      title: opp.title,
      description: opp.description || '',
      companyId: opp.companyId,
      targetContactId: opp.targetContactId || '',
      status: opp.status,
      nextAction: opp.nextAction || '',
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.title.trim() || !form.companyId) return
    const body: Record<string, unknown> = {
      title: form.title.trim(),
      companyId: form.companyId,
      description: form.description.trim() || undefined,
      targetContactId: form.targetContactId || undefined,
      status: form.status,
      nextAction: form.nextAction.trim() || undefined,
    }
    if (editingOpp) {
      updateMutation.mutate({ id: editingOpp.id, body })
    } else {
      createMutation.mutate(body)
    }
  }

  const handleAdvance = (opp: OppRow) => {
    const next = getNextStage(opp.status)
    if (next) {
      updateMutation.mutate({ id: opp.id, body: { status: next } })
    }
  }

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const formatValue = (v: number | null) => {
    if (v == null) return null
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
  }

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">Pipeline</h1>
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 tabular-nums">
              {allOpps.length}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalActiveValue > 0 && (
              <span className="text-gray-700 font-medium">{formatValue(totalActiveValue)}</span>
            )}
            {totalActiveValue > 0 && totalWonValue > 0 && ' active · '}
            {totalWonValue > 0 && (
              <span className="text-emerald-600">{formatValue(totalWonValue)} won</span>
            )}
            {totalActiveValue === 0 && totalWonValue === 0 && `${allOpps.length} opportunities`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
                viewMode === 'kanban' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <LayoutGrid className="size-3.5" /> Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
                viewMode === 'list' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <List className="size-3.5" /> List
            </button>
          </div>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs shrink-0"
            onClick={openCreate}
          >
            <Plus className="size-4 sm:mr-1.5" />
            <span className="hidden sm:inline">New Opportunity</span>
          </Button>
        </div>
      </div>

      {/* ── Stage Summary Bar ── */}
      <div className="rounded-xl bg-white card-rest p-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {PIPELINE_STAGES.map((stage) => {
            const items = grouped.get(stage.key) || []
            const count = items.length
            const stageValue = items.reduce((s, o) => s + (o.value || 0), 0)
            return (
              <div
                key={stage.key}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
              >
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <div>
                  <p className="text-xs font-medium text-gray-700">{stage.label}</p>
                  <p className="text-[11px] text-gray-400 tabular-nums">
                    {count} {count === 1 ? 'deal' : 'deals'}
                    {stageValue > 0 && ` · ${formatValue(stageValue)}`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Kanban View ── */}
      {viewMode === 'kanban' && (
        isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-gray-50/80 p-4 space-y-3 animate-pulse">
                <Skeleton className="h-4 w-24 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {PIPELINE_STAGES.map((stage) => {
              const items = grouped.get(stage.key) || []
              const stageValue = items.reduce((s, o) => s + (o.value || 0), 0)
              return (
                <div key={stage.key} className="flex flex-col min-w-0">
                  {/* Column header */}
                  <div className="flex items-center justify-between gap-2 mb-3 px-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="text-xs font-semibold text-gray-700 truncate">{stage.label}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-400 tabular-nums shrink-0">{items.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5 custom-scrollbar">
                    {items.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 flex items-center justify-center">
                        <span className="text-xs text-gray-300">No deals</span>
                      </div>
                    ) : (
                      items.map((opp) => {
                        const daysInStage = differenceInDays(new Date(), new Date(opp.updatedAt))
                        const nextStage = getNextStage(opp.status)
                        return (
                          <motion.div
                            key={opp.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                              'rounded-xl bg-white card-rest p-3.5 border-l-[3px] group cursor-default',
                              getStatusBorder(opp.status),
                            )}
                          >
                            <div className="space-y-2">
                              {/* Title & actions */}
                              <div className="flex items-start justify-between gap-1">
                                <button
                                  onClick={() => {
                                    setSelectedCompanyId(opp.companyId)
                                    setActiveView('company-profile')
                                  }}
                                  className="text-sm font-semibold text-gray-900 leading-snug hover:text-amber-700 transition-colors text-left line-clamp-2"
                                >
                                  {opp.title}
                                </button>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button
                                    onClick={() => openEdit(opp)}
                                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                                    aria-label="Edit opportunity"
                                  >
                                    <Pencil className="size-3 text-gray-400" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteId(opp.id)}
                                    className="p-1 rounded hover:bg-red-50 transition-colors"
                                    aria-label="Delete opportunity"
                                  >
                                    <Trash2 className="size-3 text-gray-400 hover:text-red-500" />
                                  </button>
                                </div>
                              </div>

                              {/* Company */}
                              <button
                                onClick={() => {
                                  setSelectedCompanyId(opp.companyId)
                                  setActiveView('company-profile')
                                }}
                                className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-amber-600 transition-colors"
                              >
                                <Building2 className="size-3" />
                                <span className="truncate">{opp.companyName || 'Unknown'}</span>
                              </button>

                              {/* Contact */}
                              {opp.contactName && (
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                  <User className="size-3" />
                                  <span className="truncate">{opp.contactName}</span>
                                </div>
                              )}

                              {/* Value */}
                              {opp.value != null && opp.value > 0 && (
                                <p className="text-sm font-bold text-gray-900 tabular-nums">
                                  {formatValue(opp.value)}
                                </p>
                              )}

                              {/* Days in stage */}
                              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Clock className="size-3" />
                                <span>{daysInStage === 0 ? 'Updated today' : `${daysInStage}d in stage`}</span>
                              </div>

                              {/* Next action */}
                              {opp.nextAction && (
                                <p className="text-[11px] text-gray-500 bg-gray-50 rounded-md px-2 py-1 line-clamp-1">
                                  → {opp.nextAction}
                                </p>
                              )}

                              {/* Advance button */}
                              {nextStage && (
                                <button
                                  onClick={() => handleAdvance(opp)}
                                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-500 hover:text-amber-700 hover:border-amber-200 hover:bg-amber-50/50 transition-all duration-150"
                                >
                                  Advance to {PIPELINE_STAGES.find(s => s.key === nextStage)?.label}
                                  <ChevronRight className="size-3" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )
                      })
                    )}
                  </div>

                  {/* Column total */}
                  {stageValue > 0 && (
                    <p className="mt-2 px-1 text-[11px] font-medium text-gray-400 tabular-nums">
                      Total: {formatValue(stageValue)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── List View ── */}
      {viewMode === 'list' && (
        <div className="rounded-xl bg-white card-rest overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200/60">
                  <SortableHeader label="Company" sortKey="companyName" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Title" sortKey="title" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="w-32" />
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Contact</th>
                  <SortableHeader label="Value" sortKey="value" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="w-28" />
                  <SortableHeader label="Created" sortKey="createdAt" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="w-32" />
                  <th className="w-20 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td colSpan={7} className="px-4 py-2">
                          <Skeleton className="h-11 w-full rounded-lg" />
                        </td>
                      </tr>
                    ))
                  : sortedOpps.map((opp) => (
                      <tr key={opp.id} className="table-row-hover border-b border-gray-50 transition-colors group">
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => {
                              setSelectedCompanyId(opp.companyId)
                              setActiveView('company-profile')
                            }}
                            className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-amber-700 transition-colors"
                          >
                            <Building2 className="size-3.5 text-gray-400 shrink-0" />
                            <span className="truncate max-w-[160px]">{opp.companyName || '—'}</span>
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-sm text-gray-900 font-medium truncate max-w-[200px]">{opp.title}</p>
                          {opp.nextAction && (
                            <p className="text-[11px] text-gray-400 truncate max-w-[200px]">→ {opp.nextAction}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border', getOppStatusVariant(opp.status))}>
                            {opp.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-600 truncate max-w-[140px]">
                          {opp.contactName || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 tabular-nums">
                          {opp.value != null && opp.value > 0 ? formatValue(opp.value) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {formatDistanceToNow(new Date(opp.createdAt), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(opp)}
                              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                              aria-label="Edit opportunity"
                            >
                              <Pencil className="size-3.5 text-gray-400" />
                            </button>
                            <button
                              onClick={() => setDeleteId(opp.id)}
                              className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                              aria-label="Delete opportunity"
                            >
                              <Trash2 className="size-3.5 text-gray-400 hover:text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {allOpps.length === 0 && !isLoading && (
            <EmptyState
              icon={Target}
              title="No opportunities yet"
              description="Create your first opportunity to start tracking your pipeline."
              actionLabel="New Opportunity"
              onAction={openCreate}
            />
          )}
        </div>
      )}

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) { setEditingOpp(null); resetForm() }
      }}>
        <DialogContent className="sm:max-w-lg rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingOpp ? 'Edit Opportunity' : 'New Opportunity'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            {/* Title */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Title</Label>
              <Input
                placeholder="Opportunity name"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="border-gray-200 rounded-lg"
                autoFocus
              />
            </div>

            {/* Company */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Company *</Label>
              <Select
                value={form.companyId}
                onValueChange={v => setForm(f => ({ ...f, companyId: v, targetContactId: '' }))}
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

            {/* Description */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Description</Label>
              <Textarea
                placeholder="Describe the opportunity..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="border-gray-200 rounded-lg min-h-[80px] resize-none"
                rows={3}
              />
            </div>

            {/* Contact & Status row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Contact</Label>
                <Select
                  value={form.targetContactId}
                  onValueChange={v => setForm(f => ({ ...f, targetContactId: v }))}
                >
                  <SelectTrigger className="border-gray-200 rounded-lg">
                    <SelectValue placeholder={form.companyId ? 'Select contact' : 'Pick company first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(contacts || []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="border-gray-200 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.filter(s => s.key !== 'archived').map(s => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Next Action */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Next Action</Label>
              <Input
                placeholder="What's the next step?"
                value={form.nextAction}
                onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))}
                className="border-gray-200 rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => { setDialogOpen(false); setEditingOpp(null); resetForm() }}
              className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
              onClick={handleSave}
              disabled={!form.title.trim() || !form.companyId || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              )}
              {editingOpp ? 'Save Changes' : 'Create Opportunity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete opportunity?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The opportunity will be permanently removed.
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