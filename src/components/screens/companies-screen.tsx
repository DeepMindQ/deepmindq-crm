'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, MoreHorizontal, ExternalLink, Building2, ChevronLeft, ChevronRight,
  Sparkles, Users, Eye, Archive, Trash2, ArrowUpDown, X, Loader2, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { EmptyState, SortableHeader, StatusDot } from '@/components/shared/design-system'
import { cn } from '@/lib/utils'
import { getCompanyStatusVariant, DEFAULT_INDUSTRIES, EMPLOYEE_SIZES } from '@/lib/constants'
import Image from 'next/image'

interface CompanyRow {
  id: string
  name: string
  domain: string | null
  industry: string | null
  intelligenceScore: number | null
  dataFreshness: string | null
  status: string
  website: string | null
}

const statusOptions = ['new', 'researching', 'qualified', 'ready', 'contacted', 'won', 'lost', 'archived']

export function CompaniesScreen() {
  const { setSelectedCompanyId, setActiveView, companyStatusFilter, setCompanyStatusFilter } = useAppStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('all')
  const [status, setStatus] = useState(companyStatusFilter)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; id: string; current: string }>({ open: false, id: '', current: '' })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', domain: '', industry: '', employeeSize: '', country: '', location: '', website: '', linkedinUrl: '' })

  const { data: meta } = useQuery({
    queryKey: ['companies-meta'],
    queryFn: () => fetch('/api/companies/meta').then(r => {
      if (!r.ok) throw new Error('Failed to load metadata')
      return r.json()
    }),
  })

  const industries = useMemo(() => {
    const api: string[] = meta?.industries || []
    const merged = [...new Set([...DEFAULT_INDUSTRIES, ...api])]
    return merged.sort((a, b) => a.localeCompare(b))
  }, [meta?.industries])

  // NOTE: sortKey and sortDir are sent to the API. Client-side sort is kept
  // as a fallback but only sorts the current page of results.
  const { data, isLoading, error } = useQuery({
    queryKey: ['companies', search, industry, status, page, sortKey, sortDir],
    queryFn: () => fetch(
      `/api/companies?search=${search}&industry=${industry !== 'all' ? industry : ''}&status=${status !== 'all' ? status : ''}&page=${page}&pageSize=20&sortKey=${sortKey}&sortDir=${sortDir}`
    ).then(r => {
      if (!r.ok) throw new Error('Failed to load companies')
      return r.json()
    }),
  })

  const companies = useMemo(() => {
    if (!data?.companies) return []
    // Client-side sort as fallback — only sorts the current page
    return [...data.companies].sort((a: CompanyRow, b: CompanyRow) => {
      const aVal = a[sortKey as keyof CompanyRow] ?? ''
      const bVal = b[sortKey as keyof CompanyRow] ?? ''
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal))
    })
  }, [data, sortKey, sortDir])

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    }).then(r => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      toast.success('Company created')
      setShowAdd(false)
      setForm({ name: '', domain: '', industry: '', employeeSize: '', country: '', location: '', website: '', linkedinUrl: '' })
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: () => toast.error('Failed to create company'),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id =>
      fetch(`/api/companies/${id}`, { method: 'DELETE' }).then(r => { if (!r.ok) throw new Error('Request failed'); return r.json() })
    )),
    onSuccess: () => {
      toast.success(`${selected.size} companies deleted`)
      setSelected(new Set())
      setDeleteDialogOpen(false)
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: () => toast.error('Failed to delete companies'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status: newStatus }: { id: string; status: string }) =>
      fetch(`/api/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      }).then(r => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      toast.success('Status updated')
      setStatusDialog({ open: false, id: '', current: '' })
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const handleStatusChange = (val: string) => {
    setStatus(val)
    setCompanyStatusFilter(val)
    setPage(1)
  }

  const toggleAll = () => {
    if (selected.size === companies.length) setSelected(new Set())
    else setSelected(new Set(companies.map((c: CompanyRow) => c.id)))
  }

  const toggleOne = (id: string) => {
    const s = new Set(selected)
    if (s.has(id)) { s.delete(id) } else { s.add(id) }
    setSelected(s)
  }

  const scoreFill = (score: number) => score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-400'

  const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement>, name: string) => {
    const img = e.currentTarget
    const parent = img.parentElement
    if (parent) {
      parent.innerHTML = ''
      const span = document.createElement('span')
      span.className = 'flex items-center justify-center size-8 rounded-lg bg-gray-100 text-gray-400 font-semibold text-sm'
      span.textContent = (name || '?').charAt(0).toUpperCase()
      parent.appendChild(span)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Companies</h1>
          <p className="text-sm text-gray-500">{data?.total || 0} accounts</p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs shrink-0" onClick={() => setShowAdd(true)}>
          <Plus className="size-4 sm:mr-1.5" /> <span className="hidden sm:inline">Add Company</span>
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load companies. Please try again.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input placeholder="Search companies..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9 h-9 bg-white border-gray-200 rounded-lg text-sm focus:border-amber-400 focus:ring-amber-100" />
        </div>
        <Select value={industry} onValueChange={v => { setIndustry(v); setPage(1) }}>
          <SelectTrigger className="w-36 h-9 bg-white border-gray-200 rounded-lg text-sm"><SelectValue placeholder="Industry" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {industries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-32 h-9 bg-white border-gray-200 rounded-lg text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statusOptions.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto animate-in fade-in slide-in-from-right-2 duration-200 w-full sm:w-auto">
            <span className="text-xs font-medium text-gray-500">{selected.size} selected</span>
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <Button variant="outline" size="sm" className="h-8 border-gray-200 text-gray-600 rounded-lg text-xs" onClick={() => setDeleteDialogOpen(true)} disabled={deleteMutation.isPending || selected.size === 0}>
              {deleteMutation.isPending ? <Loader2 className="size-3 mr-1 animate-spin text-red-500" /> : <Trash2 className="size-3 mr-1 text-red-500" />}
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
            <Button variant="outline" size="sm" className="h-8 border-gray-200 text-gray-600 rounded-lg text-xs" onClick={() => setSelected(new Set())}>
              <X className="size-3 mr-1" /> Clear
            </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white card-rest overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200/60">
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={selected.size === companies.length && companies.length > 0} onCheckedChange={toggleAll} className="size-4" />
                </th>
                <SortableHeader label="Company" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Industry</th>
                <SortableHeader label="Score" sortKey="intelligenceScore" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="w-32" />
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Freshness</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50"><td colSpan={7} className="px-4 py-2"><Skeleton className="h-12 w-full rounded-lg" /></td></tr>
                  ))
                : companies.map((c: CompanyRow) => (
                      <tr key={c.id} className="table-row-hover border-b border-gray-50 transition-colors group">
                          <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                            <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} className="size-4" />
                          </td>
                          <td className="px-4 py-2.5 cursor-pointer" onClick={() => { setSelectedCompanyId(c.id); setActiveView('company-profile') }}>
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                                {c.domain ? (
                                  <Image src={`https://logo.clearbit.com/${c.domain}`} alt="" width={32} height={32} className="size-8 object-contain p-1" onError={e => handleLogoError(e, c.name)} />
                                ) : (
                                  <span className="text-xs font-bold text-gray-400">{c.name?.charAt(0)}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-amber-700 transition-colors duration-150">{c.name}</p>
                                {c.domain && <p className="text-xs text-gray-400 truncate">{c.domain}</p>}
                              </div>
                              <ArrowRight className="size-3.5 text-gray-300 group-hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0 ml-auto" />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-600">{c.industry || '—'}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div className={`h-full rounded-full ${scoreFill(c.intelligenceScore || 0)}`} style={{ width: `${c.intelligenceScore || 0}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-gray-600 tabular-nums">{c.intelligenceScore || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <StatusDot status={(c.dataFreshness || 'unknown') as 'unknown' | 'fresh' | 'stale' | 'old'} pulse />
                              <span className="text-xs text-gray-500 capitalize">{c.dataFreshness || 'unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setStatusDialog({ open: true, id: c.id, current: c.status }) }}
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors hover:opacity-80 ${getCompanyStatusVariant(c.status)}`}
                            >
                              {c.status}
                            </button>
                          </td>
                          <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"><MoreHorizontal className="size-4 text-gray-400" /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 elevation-float">
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); setSelectedCompanyId(c.id); setActiveView('company-profile') }} className="rounded-lg text-sm">
                                  <Eye className="size-3.5 mr-2 text-gray-400" /> View Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); setSelectedCompanyId(c.id); setActiveView('company-profile') }} className="rounded-lg text-sm">
                                  <Users className="size-3.5 mr-2 text-gray-400" /> View Contacts
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); setSelectedCompanyId(c.id); setActiveView('company-profile'); setTimeout(() => { document.querySelector<HTMLButtonElement>('[data-action="generate-research"]')?.click() }, 300) }} className="rounded-lg text-sm">
                                  <Sparkles className="size-3.5 mr-2 text-amber-400" /> Generate Research
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {c.website && (
                                  <DropdownMenuItem onClick={e => { e.stopPropagation(); window.open(c.website || `https://${c.domain}`, '_blank') }} className="rounded-lg text-sm">
                                    <ExternalLink className="size-3.5 mr-2 text-gray-400" /> Visit Website
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); setStatusDialog({ open: true, id: c.id, current: c.status }) }} className="rounded-lg text-sm">
                                  <Archive className="size-3.5 mr-2 text-gray-400" /> Change Status
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {data?.companies?.length === 0 && !isLoading && (
          <EmptyState
            icon={Building2}
            title="No companies found"
            description="Try adjusting your search or filters, or add your first company."
            actionLabel="Add Company"
            onAction={() => setShowAdd(true)}
            secondaryActionLabel="Import CSV"
            onSecondaryAction={() => setActiveView('import')}
          />
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-sm text-gray-500">
          <span className="text-center sm:text-left">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</span>
          <div className="flex gap-1 justify-center">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="inline-flex items-center gap-1 px-3 h-8 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="size-3.5" /> Previous
            </button>
            <button disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)} className="inline-flex items-center gap-1 px-3 h-8 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Status Change Dialog */}
      <Dialog open={statusDialog.open} onOpenChange={o => setStatusDialog({ ...statusDialog, open: o })}>
        <DialogContent className="sm:max-w-xs rounded-xl p-6">
          <DialogHeader><DialogTitle className="text-gray-900 text-base">Change Status</DialogTitle></DialogHeader>
          <div className="grid gap-2 py-2">
            {statusOptions.map(s => (
              <button key={s} onClick={() => updateStatusMutation.mutate({ id: statusDialog.id, status: s })}
                disabled={updateStatusMutation.isPending}
                className={cn('flex items-center gap-3 p-2.5 rounded-lg text-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed', statusDialog.current === s ? 'bg-amber-50 text-amber-900 font-medium' : 'hover:bg-gray-50 text-gray-700')}>
                {updateStatusMutation.isPending ? <Loader2 className="size-3.5 animate-spin text-amber-600" /> : <div className={cn('w-2 h-2 rounded-full', getCompanyStatusVariant(s).split(' ')[0])} />}
                {s.charAt(0).toUpperCase() + s.slice(1)}
                {statusDialog.current === s && <span className="ml-auto text-xs text-amber-600">current</span>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Company Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md rounded-xl p-6">
          <DialogHeader><DialogTitle className="text-gray-900">Add Company</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Name</Label>
              <Input placeholder="ABC Manufacturing" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border-gray-200 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Domain</Label>
                <Input placeholder="abc.com" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} className="border-gray-200 rounded-lg" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Industry</Label>
                <Select value={form.industry} onValueChange={v => setForm({ ...form, industry: v })}>
                  <SelectTrigger className="border-gray-200 rounded-lg"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{industries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Country</Label>
                <Input placeholder="USA" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="border-gray-200 rounded-lg" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Employees</Label>
                <Select value={form.employeeSize} onValueChange={v => setForm({ ...form, employeeSize: v })}>
                  <SelectTrigger className="border-gray-200 rounded-lg"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{EMPLOYEE_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Website</Label>
              <Input placeholder="https://abc.com" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="border-gray-200 rounded-lg" />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg" onClick={() => createMutation.mutate(form)} disabled={!form.name}>Create Company</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} {selected.size === 1 ? 'company' : 'companies'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected companies and all associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteMutation.mutate(Array.from(selected))}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}