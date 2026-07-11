'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, MoreHorizontal, ExternalLink, Building2, ChevronLeft, ChevronRight,
  Sparkles, Users, Eye, Archive, Trash2, ArrowUpDown, X, Loader2, ArrowRight,
  RotateCcw, Download, Bookmark, BookmarkPlus, SlidersHorizontal, Save, Columns3,
  CalendarDays, Check, Filter, CheckSquare, Square,
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useAppStore, type SavedCompanyView } from '@/lib/store'
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
  employeeSize?: string | null
  createdAt?: string
}

const statusOptions = ['new', 'researching', 'qualified', 'ready', 'contacted', 'won', 'lost', 'archived']

// ── Client-side CSV export ──
function exportToCSV(rows: CompanyRow[], filename: string) {
  const esc = (v: string | number | null | undefined) => {
    if (v == null) return '""'
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = 'Name,Domain,Industry,Score,Status,Employee Size,Freshness\n'
  const body = rows.map(r =>
    [esc(r.name), esc(r.domain), esc(r.industry), r.intelligenceScore ?? 0, esc(r.status), esc(r.employeeSize), esc(r.dataFreshness)].join(',')
  ).join('\n')
  const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function CompaniesScreen() {
  const { setSelectedCompanyId, setActiveView, companyStatusFilter, setCompanyStatusFilter, savedViews, addSavedView, removeSavedView } = useAppStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [industry, setIndustry] = useState('all')
  const [status, setStatus] = useState(companyStatusFilter)
  const [employeeSize, setEmployeeSize] = useState('all')
  const [createdAfter, setCreatedAfter] = useState('')
  const [createdBefore, setCreatedBefore] = useState('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; id: string; current: string }>({ open: false, id: '', current: '' })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', domain: '', industry: '', employeeSize: '', country: '', location: '', website: '', linkedinUrl: '' })

  // ── Column visibility ──
  const [visibleColumns, setVisibleColumns] = useState({ industry: true, score: true, freshness: true })

  // ── Bulk status change dialog ──
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkNewStatus, setBulkNewStatus] = useState('')

  // ── Saved views ──
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [manageViewsOpen, setManageViewsOpen] = useState(false)
  const [newViewName, setNewViewName] = useState('')

  // ── Debounce search (300ms) ──
  const updateSearch = useCallback((v: string) => {
    setSearch(v)
    setPage(1)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedSearch(v), 300)
  }, [])

  const clearSearch = useCallback(() => {
    setSearch('')
    setDebouncedSearch('')
    setPage(1)
    clearTimeout(timerRef.current)
  }, [])

  // ── Escape key clears search ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && search) {
        clearSearch()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [search, clearSearch])

  // ── Reset all filters ──
  const resetFilters = useCallback(() => {
    setSearch('')
    setDebouncedSearch('')
    setIndustry('all')
    setStatus('all')
    setCompanyStatusFilter('all')
    setEmployeeSize('all')
    setCreatedAfter('')
    setCreatedBefore('')
    setPage(1)
    setSelected(new Set())
  }, [setCompanyStatusFilter])

  const hasActiveFilters = search || industry !== 'all' || status !== 'all' || employeeSize !== 'all' || createdAfter || createdBefore

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

  const { data, isLoading, error } = useQuery({
    queryKey: ['companies', debouncedSearch, industry, status, employeeSize, createdAfter, createdBefore, page, sortKey, sortDir],
    queryFn: () => {
      const p = new URLSearchParams()
      if (debouncedSearch) p.set('search', debouncedSearch)
      if (industry !== 'all') p.set('industry', industry)
      if (status !== 'all') p.set('status', status)
      if (employeeSize !== 'all') p.set('employeeSize', employeeSize)
      if (createdAfter) p.set('createdAfter', createdAfter)
      if (createdBefore) p.set('createdBefore', createdBefore)
      p.set('page', String(page))
      p.set('pageSize', '20')
      p.set('sortKey', sortKey)
      p.set('sortDir', sortDir)
      return fetch(`/api/companies?${p}`).then(r => {
        if (!r.ok) throw new Error('Failed to load companies')
        return r.json()
      })
    },
  })

  const companies = useMemo(() => {
    if (!data?.companies) return []
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

  // ── Bulk mutations ──
  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, newStatus }: { ids: string[]; newStatus: string }) => {
      let done = 0
      for (const id of ids) {
        const r = await fetch(`/api/companies/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
        if (!r.ok) throw new Error(`Failed to update company ${done + 1}`)
        done++
      }
      return done
    },
    onSuccess: (count) => {
      toast.success(`Status updated for ${count} companies`)
      setSelected(new Set())
      setBulkStatusOpen(false)
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkArchiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      let done = 0
      for (const id of ids) {
        const r = await fetch(`/api/companies/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'archived' }),
        })
        if (!r.ok) throw new Error(`Failed to archive company ${done + 1}`)
        done++
      }
      return done
    },
    onSuccess: (count) => {
      toast.success(`${count} companies archived`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: (e: Error) => toast.error(e.message),
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

  // ── Saved view handlers ──
  const saveCurrentView = () => {
    if (!newViewName.trim()) return
    const view: SavedCompanyView = {
      id: `custom_${Date.now()}`,
      name: newViewName.trim(),
      filters: { search: debouncedSearch, industry, status, employeeSize, createdAfter, createdBefore },
    }
    addSavedView(view)
    setSaveViewOpen(false)
    setNewViewName('')
    toast.success(`View "${view.name}" saved`)
  }

  const applySavedView = (view: SavedCompanyView) => {
    const f = view.filters
    setSearch(f.search)
    setDebouncedSearch(f.search)
    setIndustry(f.industry)
    setStatus(f.status)
    setCompanyStatusFilter(f.status)
    setEmployeeSize(f.employeeSize)
    setCreatedAfter(f.createdAfter)
    setCreatedBefore(f.createdBefore)
    setPage(1)
    setSelected(new Set())
  }

  const deleteSavedView = (id: string) => {
    removeSavedView(id)
    toast.success('View deleted')
  }

  // ── Export selected ──
  const handleExportSelected = () => {
    const selectedRows = companies.filter((c: CompanyRow) => selected.has(c.id))
    if (selectedRows.length === 0) { toast.error('No companies selected'); return }
    exportToCSV(selectedRows, 'companies-selected.csv')
    toast.success(`Exported ${selectedRows.length} companies`)
  }

  // ── Check if current filters match a saved view ──
  const isDefaultView = !hasActiveFilters

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Companies</h1>
          <p className="text-sm text-gray-500">
            {data?.companies?.length != null
              ? `Showing ${data.companies.length} of ${data.total || 0} companies`
              : `${data?.total || 0} accounts`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Saved Views Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-gray-200 text-gray-600 rounded-lg h-9 text-xs">
                <Bookmark className="size-3.5 mr-1.5" />
                <span className="hidden sm:inline">Views</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 elevation-float">
              <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Saved Views</DropdownMenuLabel>
              {savedViews.map(v => (
                <DropdownMenuItem
                  key={v.id}
                  className="rounded-lg text-sm flex items-center justify-between gap-2"
                  onClick={() => applySavedView(v)}
                >
                  <span className="truncate">{v.name}</span>
                  {v.isBuiltIn && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">Built-in</Badge>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-lg text-sm text-amber-600" onClick={() => setSaveViewOpen(true)}>
                <BookmarkPlus className="size-3.5 mr-2" /> Save Current View
              </DropdownMenuItem>
              {!savedViews.some(v => !v.isBuiltIn) ? null : (
                <DropdownMenuItem className="rounded-lg text-sm" onClick={() => setManageViewsOpen(true)}>
                  <SlidersHorizontal className="size-3.5 mr-2" /> Manage Views
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column Visibility Toggle */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-gray-200 text-gray-600 rounded-lg h-9 text-xs">
                <Columns3 className="size-3.5 mr-1.5" />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 rounded-xl p-2 elevation-float">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">Toggle Columns</p>
              {([
                { key: 'industry' as const, label: 'Industry' },
                { key: 'score' as const, label: 'Score' },
                { key: 'freshness' as const, label: 'Freshness' },
              ]).map(col => (
                <button
                  key={col.key}
                  className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                >
                  <div className={cn('size-4 rounded border flex items-center justify-center transition-colors', visibleColumns[col.key] ? 'bg-amber-600 border-amber-600' : 'border-gray-300')}>
                    {visibleColumns[col.key] && <Check className="size-3 text-white" />}
                  </div>
                  {col.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs" onClick={() => setShowAdd(true)}>
            <Plus className="size-4 sm:mr-1.5" /> <span className="hidden sm:inline">Add Company</span>
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load companies. Please try again.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        {/* Search with debounce + clear */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={e => updateSearch(e.target.value)}
            className="pl-9 pr-8 h-9 bg-white border-gray-200 rounded-lg text-sm focus:border-amber-400 focus:ring-amber-100"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="Clear search"
            >
              <X className="size-3.5 text-gray-400" />
            </button>
          )}
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

        {/* Employee Size Filter */}
        <Select value={employeeSize} onValueChange={v => { setEmployeeSize(v); setPage(1) }}>
          <SelectTrigger className="w-32 h-9 bg-white border-gray-200 rounded-lg text-sm"><SelectValue placeholder="Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sizes</SelectItem>
            {EMPLOYEE_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Date Range Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
            <Input
              type="date"
              value={createdAfter}
              onChange={e => { setCreatedAfter(e.target.value); setPage(1) }}
              className="h-9 w-[146px] bg-white border-gray-200 rounded-lg text-xs pl-8 pr-2"
              placeholder="After"
            />
          </div>
          <span className="text-gray-300 text-xs">–</span>
          <Input
            type="date"
            value={createdBefore}
            onChange={e => { setCreatedBefore(e.target.value); setPage(1) }}
            className="h-9 w-[130px] bg-white border-gray-200 rounded-lg text-xs pl-2 pr-2"
            placeholder="Before"
          />
        </div>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs text-gray-500 hover:text-gray-700">
            <RotateCcw className="size-3.5 mr-1.5" /> Reset
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white card-rest overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200/60">
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={selected.size === companies.length && companies.length > 0} onCheckedChange={toggleAll} className="size-4" />
                </th>
                <SortableHeader label="Company" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                {visibleColumns.industry && (
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Industry</th>
                )}
                {visibleColumns.score && (
                  <SortableHeader label="Score" sortKey="intelligenceScore" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="w-32" />
                )}
                {visibleColumns.freshness && (
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Freshness</th>
                )}
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50"><td colSpan={7} className="px-4 py-2"><Skeleton className="h-12 w-full rounded-lg" /></td></tr>
                  ))
                : companies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-0">
                      <EmptyState
                        icon={Building2}
                        title="No companies found"
                        description={hasActiveFilters ? 'Try adjusting your search or filters.' : 'Add your first company to get started.'}
                        actionLabel={hasActiveFilters ? undefined : 'Add Company'}
                        onAction={hasActiveFilters ? resetFilters : () => setShowAdd(true)}
                        secondaryActionLabel={hasActiveFilters ? 'Reset Filters' : 'Import CSV'}
                        onSecondaryAction={hasActiveFilters ? resetFilters : () => setActiveView('import')}
                      />
                    </td>
                  </tr>
                ) : companies.map((c: CompanyRow) => (
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
                          {visibleColumns.industry && (
                            <td className="px-4 py-2.5 text-sm text-gray-600">{c.industry || '—'}</td>
                          )}
                          {visibleColumns.score && (
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div className={`h-full rounded-full ${scoreFill(c.intelligenceScore || 0)}`} style={{ width: `${c.intelligenceScore || 0}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-gray-600 tabular-nums">{c.intelligenceScore || 0}</span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.freshness && (
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <StatusDot status={(c.dataFreshness || 'unknown') as 'unknown' | 'fresh' | 'stale' | 'old'} pulse />
                                <span className="text-xs text-gray-500 capitalize">{c.dataFreshness || 'unknown'}</span>
                              </div>
                            </td>
                          )}
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

      {/* ═══ Floating Bulk Operations Toolbar ═══ */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-gray-900 text-white rounded-2xl shadow-2xl max-w-[calc(100vw-3rem)]">
            <span className="text-sm font-medium whitespace-nowrap">
              {selected.size} {selected.size === 1 ? 'company' : 'companies'} selected
            </span>
            <div className="w-px h-5 bg-gray-600 shrink-0" />

            {/* Select All / Deselect All */}
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors text-xs whitespace-nowrap"
            >
              {selected.size === companies.length ? <Square className="size-3.5" /> : <CheckSquare className="size-3.5" />}
              {selected.size === companies.length ? 'Deselect All' : 'Select All'}
            </button>

            <div className="w-px h-5 bg-gray-600 shrink-0" />

            {/* Change Status */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg">
                  <Archive className="size-3.5 mr-1.5" /> Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-xl p-1 elevation-float">
                {statusOptions.filter(s => s !== 'archived').map(s => (
                  <DropdownMenuItem
                    key={s}
                    className="rounded-lg text-sm"
                    onClick={() => {
                      setBulkNewStatus(s)
                      setBulkStatusOpen(true)
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export */}
            <Button variant="ghost" size="sm" onClick={handleExportSelected} className="h-7 text-xs text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg">
              <Download className="size-3.5 mr-1.5" /> Export
            </Button>

            {/* Archive */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => bulkArchiveMutation.mutate(Array.from(selected))}
              disabled={bulkArchiveMutation.isPending}
              className="h-7 text-xs text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg"
            >
              {bulkArchiveMutation.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Archive className="size-3.5 mr-1.5" />}
              Archive
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg"
            >
              <Trash2 className="size-3.5 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Status Change Dialog (single) */}
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

      {/* Bulk Status Change Confirmation */}
      <AlertDialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Status for {selected.size} {selected.size === 1 ? 'company' : 'companies'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the status of all selected companies to <span className="font-semibold">{bulkNewStatus}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selected), newStatus: bulkNewStatus })}
              disabled={bulkStatusMutation.isPending}
            >
              {bulkStatusMutation.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Update Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Save View Dialog */}
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl p-6">
          <DialogHeader><DialogTitle className="text-gray-900">Save Current View</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label className="text-sm font-medium text-gray-700 mb-1.5 block">View Name</Label>
            <Input
              placeholder="e.g., Enterprise SaaS Leads"
              value={newViewName}
              onChange={e => setNewViewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveCurrentView() }}
              className="border-gray-200 rounded-lg"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-2">
              Saves current search and filter combination
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSaveViewOpen(false); setNewViewName('') }} className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg" onClick={saveCurrentView} disabled={!newViewName.trim()}>
              <Save className="size-3.5 mr-1.5" /> Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Views Dialog */}
      <Dialog open={manageViewsOpen} onOpenChange={setManageViewsOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl p-6">
          <DialogHeader><DialogTitle className="text-gray-900">Manage Views</DialogTitle></DialogHeader>
          <div className="py-2 space-y-1.5 max-h-64 overflow-y-auto">
            {savedViews.filter(v => !v.isBuiltIn).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No custom views saved yet.</p>
            )}
            {savedViews.filter(v => !v.isBuiltIn).map(v => (
              <div key={v.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-gray-50 group">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{v.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {[v.filters.status !== 'all' && v.filters.status, v.filters.industry !== 'all' && v.filters.industry, v.filters.employeeSize !== 'all' && v.filters.employeeSize].filter(Boolean).join(', ') || 'All companies'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteSavedView(v.id)}
                  className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageViewsOpen(false)} className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}