'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronLeft, ChevronRight, Users, Mail, ShieldCheck,
  Sparkles, MoreHorizontal, Pencil, Archive, Loader2, Building2,
  CheckCircle2, XCircle, X, RotateCcw, Download, Columns3, CalendarDays,
  Check, CheckSquare, Square, Trash2, Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { EmptyState, SortableHeader, StatusDot } from '@/components/shared/design-system'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { getHealthVariant, ROLE_BUCKETS } from '@/lib/constants'
import type { Contact, Company } from '@/lib/types'

/* ── Constants ── */

const PAGE_SIZE = 20

/* ── Component ── */

interface ContactRow {
  id: string
  name: string
  email: string | null
  jobTitle: string | null
  roleBucket: string | null
  linkedinUrl: string | null
  status: string
  emailHealth: string | null
  company: Company | null
  _draftCount?: number
  createdAt?: string
}

// ── Client-side CSV export ──
function exportToCSV(rows: ContactRow[], filename: string) {
  const esc = (v: string | number | null | undefined) => {
    if (v == null) return '""'
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = 'Name,Email,Job Title,Company,Health,Status\n'
  const body = rows.map(r =>
    [esc(r.name), esc(r.email), esc(r.jobTitle), esc(r.company?.name), esc(r.emailHealth), esc(r.status)].join(',')
  ).join('\n')
  const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ContactsScreen() {
  const qc = useQueryClient()
  const { setSelectedCompanyId, setActiveView } = useAppStore()

  /* ── List state ── */
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [health, setHealth] = useState('')
  const [filterCompanyId, setFilterCompanyId] = useState('')
  const [createdAfter, setCreatedAfter] = useState('')
  const [createdBefore, setCreatedBefore] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  /* ── Bulk select ── */
  const [selected, setSelected] = useState<Set<string>>(new Set())

  /* ── Column visibility ── */
  const [visibleColumns, setVisibleColumns] = useState({ company: true, jobTitle: true, email: true })

  /* ── Bulk status change ── */
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkNewStatus, setBulkNewStatus] = useState('')

  /* ── Capture selectedCompanyId on mount, then clear it ── */
  const [navFilterCompanyId, setNavFilterCompanyId] = useState<string | null>(() => {
    const id = useAppStore.getState().selectedCompanyId
    if (id) {
      useAppStore.getState().setSelectedCompanyId(null)
      return id
    }
    return null
  })

  // Merge navigation filter and manual company filter
  const activeCompanyId = navFilterCompanyId || filterCompanyId || null

  /* ── Validation loading per contact ── */
  const [validatingIds, setValidatingIds] = useState<Set<string>>(new Set())
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())

  /* ── Batch validate confirmation ── */
  const [batchValidateOpen, setBatchValidateOpen] = useState(false)

  /* ── Add dialog ── */
  const [dlgOpen, setDlgOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', jobTitle: '', roleBucket: '',
    companyId: '', linkedinUrl: '',
  })

  /* ── Edit dialog ── */
  const [editOpen, setEditOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', email: '', jobTitle: '', roleBucket: '',
    companyId: '', linkedinUrl: '',
  })

  /* ── Archive confirm ── */
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archivingContact, setArchivingContact] = useState<ContactRow | null>(null)

  /* ── Bulk delete confirm ── */
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  /* ── Company filter search ── */
  const [companySearch, setCompanySearch] = useState('')

  /* ── Handlers ── */
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

  const updateStatus = useCallback((v: string) => {
    setStatus(v === 'all' ? '' : v)
    setPage(1)
  }, [])

  const updateHealth = useCallback((v: string) => {
    setHealth(v === 'all' ? '' : v)
    setPage(1)
  }, [])

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }, [sortKey])

  // ── Reset all filters ──
  const resetFilters = useCallback(() => {
    setSearch('')
    setDebouncedSearch('')
    setStatus('')
    setHealth('')
    setFilterCompanyId('')
    setNavFilterCompanyId(null)
    setCreatedAfter('')
    setCreatedBefore('')
    setPage(1)
    setSelected(new Set())
  }, [])

  const hasActiveFilters = search || status || health || activeCompanyId || createdAfter || createdBefore

  const updateField = (k: keyof typeof form, v: string) =>
    setForm(p => ({ ...p, [k]: v }))

  const updateEditField = (k: keyof typeof editForm, v: string) =>
    setEditForm(p => ({ ...p, [k]: v }))

  const openEditDialog = (c: ContactRow) => {
    setEditingContact(c)
    setEditForm({
      name: c.name || '',
      email: c.email || '',
      jobTitle: c.jobTitle || '',
      roleBucket: c.roleBucket || '',
      companyId: c.company?.id || '',
      linkedinUrl: c.linkedinUrl || '',
    })
    setEditOpen(true)
  }

  const openArchiveConfirm = (c: ContactRow) => {
    setArchivingContact(c)
    setArchiveOpen(true)
  }

  const navigateToContact = (id: string) => {
    useAppStore.getState().setSelectedContactId(id)
    useAppStore.getState().setActiveView('contact-profile')
  }

  const navigateToCompany = (id: string) => {
    useAppStore.getState().setSelectedCompanyId(id)
    useAppStore.getState().setActiveView('company-profile')
  }

  const navigateToEmailGen = (id: string) => {
    useAppStore.getState().setSelectedContactId(id)
    useAppStore.getState().setActiveView('email-generation')
  }

  const toggleAll = () => {
    if (selected.size === contacts.length) setSelected(new Set())
    else setSelected(new Set(contacts.map(c => c.id)))
  }

  const toggleOne = (id: string) => {
    const s = new Set(selected)
    if (s.has(id)) { s.delete(id) } else { s.add(id) }
    setSelected(s)
  }

  /* ── Queries ── */
  /* ── Fetch company name for filter banner ── */
  const { data: filterCompany } = useQuery({
    queryKey: ['company-brief-contacts', navFilterCompanyId],
    queryFn: () => fetch(`/api/companies/${navFilterCompanyId}`).then(r => {
      if (!r.ok) throw new Error('Failed to load company')
      return r.json()
    }),
    enabled: !!navFilterCompanyId,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['contacts', debouncedSearch, status, health, activeCompanyId, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debouncedSearch) p.set('search', debouncedSearch)
      if (status) p.set('status', status)
      if (health) p.set('emailHealth', health)
      if (activeCompanyId) p.set('companyId', activeCompanyId)
      return fetch(`/api/contacts?${p}`).then(r => {
        if (!r.ok) throw new Error('Failed to load contacts')
        return r.json().then((d: any) => ({
          ...d,
          contacts: (d.contacts || []).map((c: any) => ({
            ...c,
            name: c.rawName || c.name || '',
            jobTitle: c.title || c.jobTitle || null,
            company: c.company ? { ...c.company, name: c.company.rawName || c.company.name || '' } : null,
          })),
        }))
      })
    },
  })

  const { data: companiesList } = useQuery({
    queryKey: ['companies', 'contact-dialog'],
    queryFn: () =>
      fetch('/api/companies?pageSize=200')
        .then(r => { if (!r.ok) throw new Error('Failed to load companies'); return r.json() })
        .then(d => (d.companies || []).map((c: any) => ({ ...c, name: c.rawName || c.name || '' }))),
  })

  // ── Filtered company list for the company filter dropdown ──
  const filteredCompanies = useMemo(() => {
    const list = (companiesList || []) as Company[]
    if (!companySearch) return list
    const q = companySearch.toLowerCase()
    return list.filter(c => c.name.toLowerCase().includes(q) || (c.domain && c.domain.toLowerCase().includes(q)))
  }, [companiesList, companySearch])

  /* ── Mutations ── */
  const addContact = useMutation({
    mutationFn: (f: typeof form) =>
      fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setDlgOpen(false)
      setForm({ name: '', email: '', jobTitle: '', roleBucket: '', companyId: '', linkedinUrl: '' })
      toast.success('Contact added')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const validateEmail = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/contacts/${id}/validate`, { method: 'POST' }).then(r => {
        if (!r.ok) throw new Error('Validation request failed')
        return r.json()
      }),
    onMutate: (id) => {
      setValidatingIds(prev => new Set(prev).add(id))
    },
    onSuccess: (_result, id) => {
      setValidatingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setFlashIds(prev => new Set(prev).add(id))
      setTimeout(() => {
        setFlashIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 1500)
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Email validated')
    },
    onError: (_e, id) => {
      setValidatingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast.error('Validation failed')
    },
  })

  const editContact = useMutation({
    mutationFn: ({ id, ...f }: typeof editForm & { id: string }) =>
      fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setEditOpen(false)
      setEditingContact(null)
      toast.success('Contact updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const archiveContact = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/contacts/${id}`, { method: 'DELETE' })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setArchiveOpen(false)
      setArchivingContact(null)
      toast.success('Contact archived')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /* ── Batch email validation ── */
  const batchValidateMutation = useMutation({
    mutationFn: () =>
      fetch('/api/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkAll: true }),
      }).then(r => {
        if (!r.ok) throw new Error('Batch validation failed')
        return r.json()
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      const summary = result?.summary || `${result?.checked ?? 0} emails checked`
      toast.success(`Email validation complete: ${summary}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /* ── Bulk mutations ── */
  const bulkValidateMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      let done = 0
      for (const id of ids) {
        const r = await fetch(`/api/contacts/${id}/validate`, { method: 'POST' })
        if (!r.ok) throw new Error(`Failed to validate contact ${done + 1}`)
        done++
      }
      return done
    },
    onSuccess: (count) => {
      toast.success(`Validated emails for ${count} contacts`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['contacts'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, newStatus }: { ids: string[]; newStatus: string }) => {
      let done = 0
      for (const id of ids) {
        const r = await fetch(`/api/contacts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
        if (!r.ok) throw new Error(`Failed to update contact ${done + 1}`)
        done++
      }
      return done
    },
    onSuccess: (count) => {
      toast.success(`Status updated for ${count} contacts`)
      setSelected(new Set())
      setBulkStatusOpen(false)
      qc.invalidateQueries({ queryKey: ['contacts'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkArchiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      let done = 0
      for (const id of ids) {
        const r = await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
        if (!r.ok) throw new Error(`Failed to archive contact ${done + 1}`)
        done++
      }
      return done
    },
    onSuccess: (count) => {
      toast.success(`${count} contacts archived`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['contacts'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      let done = 0
      for (const id of ids) {
        const r = await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
        if (!r.ok) throw new Error(`Failed to delete contact ${done + 1}`)
        done++
      }
      return done
    },
    onSuccess: (count) => {
      toast.success(`${count} contacts deleted`)
      setSelected(new Set())
      setBulkDeleteOpen(false)
      qc.invalidateQueries({ queryKey: ['contacts'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /* ── Export selected ── */
  const handleExportSelected = () => {
    const selectedRows = contacts.filter(c => selected.has(c.id))
    if (selectedRows.length === 0) { toast.error('No contacts selected'); return }
    exportToCSV(selectedRows, 'contacts-selected.csv')
    toast.success(`Exported ${selectedRows.length} contacts`)
  }

  /* ── Derived ── */
  const contacts: ContactRow[] = data?.contacts ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Build draft indicator set from list data
  const draftContacts = useMemo(() => {
    const ids = new Set<string>()
    contacts.forEach((c: ContactRow) => {
      if (c._draftCount && c._draftCount > 0) ids.add(c.id)
    })
    return ids
  }, [contacts])

  /* ── Render ── */
  return (
    <div className="space-y-4">
      {/* ═══ Company Filter Banner ═══ */}
      {navFilterCompanyId && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200/80">
          <Building2 className="size-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Showing contacts for <span className="font-semibold">{filterCompany?.name || 'Company'}</span>
          </p>
          <button
            onClick={() => { setNavFilterCompanyId(null) }}
            className="ml-auto p-1 rounded-md hover:bg-amber-100 transition-colors"
            aria-label="Clear company filter"
          >
            <X className="size-3.5 text-amber-600" />
          </button>
        </div>
      )}

      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Users className="size-5 text-gray-400" />
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Contacts</h2>
          {total > 0 && (
            <span className="text-sm text-gray-500">
              {contacts.length != null && total > 0
                ? `Showing ${contacts.length} of ${total}`
                : total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Column Visibility Toggle */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-gray-200 text-gray-600 rounded-lg h-8 text-xs">
                <Columns3 className="size-3.5 mr-1.5" />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 rounded-xl p-2 elevation-float">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">Toggle Columns</p>
              {([
                { key: 'company' as const, label: 'Company' },
                { key: 'jobTitle' as const, label: 'Job Title' },
                { key: 'email' as const, label: 'Email' },
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

          {/* ═══ Batch Validate Emails Button ═══ */}
          <Button
            size="sm"
            variant="outline"
            className="border-gray-200 text-gray-600 rounded-lg press-scale shrink-0"
            onClick={() => setBatchValidateOpen(true)}
            disabled={batchValidateMutation.isPending}
          >
            {batchValidateMutation.isPending
              ? <Loader2 className="size-4 animate-spin" />
              : <ShieldCheck className="size-4" />
            }
            <span className="hidden sm:inline ml-1.5">{batchValidateMutation.isPending ? 'Validating...' : 'Validate All'}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setDlgOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs shrink-0"
          >
            <Plus className="size-4" /> <span className="hidden sm:inline ml-1.5">Add Contact</span>
          </Button>
        </div>
      </div>

      {/* ═══ Error Banner ═══ */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load contacts. Please try again.
        </div>
      )}

      {/* ═══ Filters ═══ */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        {/* Search with debounce + clear */}
        <div className="relative flex-1 sm:min-w-[200px] sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={e => updateSearch(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg h-9 pl-9 pr-8 text-sm placeholder:text-gray-400 focus-visible:ring-amber-500/20 focus-visible:border-amber-400"
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

        <Select value={status || 'all'} onValueChange={updateStatus}>
          <SelectTrigger className="border-gray-200 rounded-lg h-9 w-32 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={health || 'all'} onValueChange={updateHealth} data-filter="health">
          <SelectTrigger className="border-gray-200 rounded-lg h-9 w-32 text-sm">
            <SelectValue placeholder="Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="risky">Risky</SelectItem>
            <SelectItem value="invalid">Invalid</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>

        {/* Company Filter (searchable dropdown) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="border-gray-200 rounded-lg h-9 w-40 text-sm justify-start font-normal text-gray-600">
              <Building2 className="size-3.5 mr-1.5 text-gray-400 shrink-0" />
              {activeCompanyId
                ? ((companiesList || []) as Company[]).find((c: Company) => c.id === activeCompanyId)?.name || 'Company'
                : 'All Companies'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 rounded-xl p-2 elevation-float">
            <div className="px-1 pb-2">
              <Input
                placeholder="Search companies..."
                value={companySearch}
                onChange={e => setCompanySearch(e.target.value)}
                className="h-8 border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                className="w-full text-left px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                onClick={() => { setFilterCompanyId(''); setPage(1) }}
              >
                All Companies
              </button>
              {filteredCompanies.map((c: Company) => (
                <button
                  key={c.id}
                  className={cn(
                    'w-full text-left px-2.5 py-1.5 text-sm rounded-lg transition-colors truncate',
                    activeCompanyId === c.id ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                  )}
                  onClick={() => { setFilterCompanyId(c.id); setPage(1); setCompanySearch('') }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Date Range Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
            <Input
              type="date"
              value={createdAfter}
              onChange={e => { setCreatedAfter(e.target.value); setPage(1) }}
              className="h-9 w-[146px] bg-white border-gray-200 rounded-lg text-xs pl-8 pr-2"
            />
          </div>
          <span className="text-gray-300 text-xs">–</span>
          <Input
            type="date"
            value={createdBefore}
            onChange={e => { setCreatedBefore(e.target.value); setPage(1) }}
            className="h-9 w-[130px] bg-white border-gray-200 rounded-lg text-xs pl-2 pr-2"
          />
        </div>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs text-gray-500 hover:text-gray-700">
            <RotateCcw className="size-3.5 mr-1.5" /> Reset
          </Button>
        )}
      </div>

      {/* ═══ Table ═══ */}
      {isLoading ? (
        <div className="rounded-xl bg-white card-rest overflow-hidden">
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full rounded-lg" />
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-xl bg-white card-rest overflow-hidden">
          <EmptyState
            icon={Users}
            title="No contacts found"
            description={hasActiveFilters ? 'Try adjusting your search or filters.' : 'Add your first contact to get started.'}
            actionLabel={hasActiveFilters ? undefined : 'Add Contact'}
            onAction={hasActiveFilters ? resetFilters : () => setDlgOpen(true)}
            secondaryActionLabel={hasActiveFilters ? 'Reset Filters' : 'Import CSV'}
            onSecondaryAction={hasActiveFilters ? resetFilters : () => useAppStore.getState().setActiveView('import')}
          />
        </div>
      ) : (
        <div className="rounded-xl bg-white card-rest overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-gray-50/80 border-b border-gray-200/60">
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={selected.size === contacts.length && contacts.length > 0} onCheckedChange={toggleAll} className="size-4" />
                </th>
                <SortableHeader label="Name" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                {visibleColumns.company && (
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Company
                  </th>
                )}
                {visibleColumns.jobTitle && (
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                    Job Title
                  </th>
                )}
                {visibleColumns.email && (
                  <SortableHeader label="Email" sortKey="email" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                )}
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Health
                </th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="w-10 px-4 py-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => {
                const isValidating = validatingIds.has(c.id)
                const isFlashing = flashIds.has(c.id)
                const hasDrafts = draftContacts.has(c.id)

                return (
                  <TableRow
                    key={c.id}
                    className="table-row-hover border-b border-gray-50 last:border-b-0 group cursor-pointer"
                    onClick={() => navigateToContact(c.id)}
                  >
                    {/* Checkbox */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} className="size-4" />
                    </TableCell>

                    {/* Name */}
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-[11px] font-semibold shrink-0">
                          {c.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 truncate group-hover:text-amber-700 transition-colors duration-150">{c.name}</span>
                          <ChevronRight className="size-3 text-gray-300 group-hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0" />
                          {hasDrafts && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-px text-[10px] font-medium shrink-0"
                              title="AI email generated"
                            >
                              <Sparkles className="size-2.5" />
                              AI
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Company — clickable */}
                    {visibleColumns.company && (
                      <TableCell className="hidden md:table-cell" onClick={e => e.stopPropagation()}>
                        {c.company?.id ? (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              navigateToCompany(c.company!.id)
                            }}
                            className="text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors duration-150 inline-flex items-center gap-1 group/biz hover:underline underline-offset-2"
                          >
                            <Building2 className="size-3 text-gray-400 group-hover/biz:text-amber-500 transition-colors" />
                            {c.company.name}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </TableCell>
                    )}

                    {/* Job Title */}
                    {visibleColumns.jobTitle && (
                      <TableCell className="hidden lg:table-cell text-sm text-gray-500">
                        {c.jobTitle || '—'}
                      </TableCell>
                    )}

                    {/* Email */}
                    {visibleColumns.email && (
                      <TableCell>
                        <span className="text-sm text-gray-600 font-mono text-xs">{c.email || '—'}</span>
                      </TableCell>
                    )}

                    {/* Health with validation UX */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border transition-all duration-500',
                            getHealthVariant(c.emailHealth || 'unknown'),
                            isFlashing && 'scale-110 ring-2 ring-amber-300 shadow-amber-100 shadow-sm',
                          )}
                        >
                          {isValidating ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : c.emailHealth === 'valid' ? (
                            <CheckCircle2 className="size-3 mr-0.5" />
                          ) : c.emailHealth === 'invalid' ? (
                            <XCircle className="size-3 mr-0.5" />
                          ) : null}
                          {c.emailHealth || 'unknown'}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            validateEmail.mutate(c.id)
                          }}
                          disabled={isValidating}
                          className={cn(
                            'p-1 rounded transition-all',
                            'opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
                            isValidating
                              ? 'hover:bg-emerald-50 cursor-wait'
                              : 'hover:bg-emerald-50',
                          )}
                          title="Validate email"
                        >
                          <ShieldCheck
                            className={cn(
                              'size-3.5',
                              isValidating ? 'text-emerald-400 animate-pulse' : 'text-emerald-500',
                            )}
                          />
                        </button>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border gap-1.5',
                          c.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : c.status === 'archived'
                              ? 'bg-gray-100 text-gray-400 border-gray-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200',
                        )}
                      >
                        <StatusDot
                          status={
                            c.status === 'active' ? 'fresh'
                              : c.status === 'archived' ? 'old'
                                : 'stale'
                          }
                        />
                        {c.status}
                      </span>
                    </TableCell>

                    {/* Dropdown */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-1 rounded-md hover:bg-gray-100 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            onClick={e => e.stopPropagation()}
                          >
                            <MoreHorizontal className="size-4 text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 rounded-xl p-1.5 elevation-float"
                        >
                          <DropdownMenuItem
                            className="rounded-lg text-sm"
                            onClick={() => navigateToContact(c.id)}
                          >
                            <Users className="size-3.5 mr-2 text-gray-400" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="rounded-lg text-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              validateEmail.mutate(c.id)
                            }}
                            disabled={isValidating}
                          >
                            {isValidating
                              ? <Loader2 className="size-3.5 mr-2 text-emerald-500 animate-spin" />
                              : <ShieldCheck className="size-3.5 mr-2 text-emerald-500" />
                            }
                            {isValidating ? 'Validating...' : 'Validate Email'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="rounded-lg text-sm"
                            onClick={() => navigateToEmailGen(c.id)}
                          >
                            <Sparkles className="size-3.5 mr-2 text-amber-500" />
                            Generate Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem
                            className="rounded-lg text-sm"
                            onClick={() => openEditDialog(c)}
                          >
                            <Pencil className="size-3.5 mr-2 text-gray-400" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="rounded-lg text-sm text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => openArchiveConfirm(c)}
                          >
                            <Archive className="size-3.5 mr-2 text-red-500" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ═══ Pagination ═══ */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-sm text-gray-500">
          <span className="text-center sm:text-left">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1 justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 h-8 text-xs"
            >
              <ChevronLeft className="size-3.5 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 h-8 text-xs"
            >
              Next <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ═══ Floating Bulk Operations Toolbar ═══ */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-gray-900 text-white rounded-2xl shadow-2xl max-w-[calc(100vw-3rem)]">
            <span className="text-sm font-medium whitespace-nowrap">
              {selected.size} {selected.size === 1 ? 'contact' : 'contacts'} selected
            </span>
            <div className="w-px h-5 bg-gray-600 shrink-0" />

            {/* Select All / Deselect All */}
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors text-xs whitespace-nowrap"
            >
              {selected.size === contacts.length ? <Square className="size-3.5" /> : <CheckSquare className="size-3.5" />}
              {selected.size === contacts.length ? 'Deselect All' : 'Select All'}
            </button>

            <div className="w-px h-5 bg-gray-600 shrink-0" />

            {/* Validate Emails */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => bulkValidateMutation.mutate(Array.from(selected))}
              disabled={bulkValidateMutation.isPending}
              className="h-7 text-xs text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg"
            >
              {bulkValidateMutation.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="size-3.5 mr-1.5" />}
              Validate
            </Button>

            {/* Change Status */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg">
                  <Archive className="size-3.5 mr-1.5" /> Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-xl p-1 elevation-float">
                {['new', 'active', 'inactive'].map(s => (
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
              onClick={() => setBulkDeleteOpen(true)}
              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg"
            >
              <Trash2 className="size-3.5 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* ════════════ Add Contact Dialog ════════════ */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Add Contact</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Name *</Label>
              <Input
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                className="border-gray-200 rounded-lg h-9 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => updateField('email', e.target.value)}
                className="border-gray-200 rounded-lg h-9 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Job Title</Label>
                <Input
                  value={form.jobTitle}
                  onChange={e => updateField('jobTitle', e.target.value)}
                  className="border-gray-200 rounded-lg h-9 text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Role</Label>
                <Select value={form.roleBucket} onValueChange={v => updateField('roleBucket', v)}>
                  <SelectTrigger className="border-gray-200 rounded-lg h-9 text-sm">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_BUCKETS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Company *</Label>
                <Select value={form.companyId} onValueChange={v => updateField('companyId', v)}>
                  <SelectTrigger className="border-gray-200 rounded-lg h-9 text-sm">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {(companiesList || []).map((c: Company) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">LinkedIn</Label>
                <Input
                  value={form.linkedinUrl}
                  onChange={e => updateField('linkedinUrl', e.target.value)}
                  className="border-gray-200 rounded-lg h-9 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDlgOpen(false)}
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addContact.mutate(form)}
              disabled={!form.name.trim() || !form.companyId || addContact.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale"
            >
              {addContact.isPending ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════ Edit Contact Dialog ════════════ */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditingContact(null) } }}
      >
        <DialogContent className="sm:max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Name *</Label>
              <Input
                value={editForm.name}
                onChange={e => updateEditField('name', e.target.value)}
                className="border-gray-200 rounded-lg h-9 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={e => updateEditField('email', e.target.value)}
                className="border-gray-200 rounded-lg h-9 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Job Title</Label>
                <Input
                  value={editForm.jobTitle}
                  onChange={e => updateEditField('jobTitle', e.target.value)}
                  className="border-gray-200 rounded-lg h-9 text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Role</Label>
                <Select value={editForm.roleBucket} onValueChange={v => updateEditField('roleBucket', v)}>
                  <SelectTrigger className="border-gray-200 rounded-lg h-9 text-sm">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_BUCKETS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Company</Label>
                <Select value={editForm.companyId} onValueChange={v => updateEditField('companyId', v)}>
                  <SelectTrigger className="border-gray-200 rounded-lg h-9 text-sm">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {(companiesList || []).map((c: Company) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">LinkedIn</Label>
                <Input
                  value={editForm.linkedinUrl}
                  onChange={e => updateEditField('linkedinUrl', e.target.value)}
                  className="border-gray-200 rounded-lg h-9 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditOpen(false); setEditingContact(null) }}
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingContact &&
                editContact.mutate({ id: editingContact.id, ...editForm })
              }
              disabled={!editForm.name.trim() || editContact.isPending || !editingContact}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale"
            >
              {editContact.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════ Archive Confirmation ════════════ */}
      <AlertDialog
        open={archiveOpen}
        onOpenChange={(open) => { if (!open) { setArchiveOpen(false); setArchivingContact(null) } }}
      >
        <AlertDialogContent className="sm:max-w-md bg-white rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Archive Contact</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to archive{' '}
              <span className="font-semibold text-gray-900">{archivingContact?.name}</span>? This
              will soft-delete the contact. You can still find them by filtering for archived
              contacts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => { setArchiveOpen(false); setArchivingContact(null) }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg press-scale"
              onClick={() => archivingContact && archiveContact.mutate(archivingContact.id)}
              disabled={archiveContact.isPending}
            >
              {archiveContact.isPending ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : null}
              {archiveContact.isPending ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════ Batch Validate Confirmation ════════════ */}
      <AlertDialog
        open={batchValidateOpen}
        onOpenChange={setBatchValidateOpen}
      >
        <AlertDialogContent className="sm:max-w-md bg-white rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Validate All Emails?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This will check the health status of all email addresses in your contact list. This operation
              may take a moment depending on the number of contacts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-200 text-gray-600 hover:bg-gray-50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale"
              onClick={() => {
                setBatchValidateOpen(false)
                batchValidateMutation.mutate()
              }}
              disabled={batchValidateMutation.isPending}
            >
              {batchValidateMutation.isPending ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : null}
              {batchValidateMutation.isPending ? 'Validating...' : 'Validate All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Bulk Status Change Confirmation ═══ */}
      <AlertDialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Status for {selected.size} {selected.size === 1 ? 'contact' : 'contacts'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the status of all selected contacts to <span className="font-semibold">{bulkNewStatus}</span>.
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

      {/* ═══ Bulk Delete Confirmation ═══ */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} {selected.size === 1 ? 'contact' : 'contacts'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected contacts will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}