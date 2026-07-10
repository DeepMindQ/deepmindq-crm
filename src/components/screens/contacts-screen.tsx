'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronLeft, ChevronRight, Users, Mail, ShieldCheck,
  Sparkles, MoreHorizontal, Pencil, Archive, Loader2, Building2,
  CheckCircle2, XCircle, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
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
}

export default function ContactsScreen() {
  const qc = useQueryClient()
  const { setSelectedCompanyId } = useAppStore()

  /* ── List state ── */
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [health, setHealth] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  /* ── Capture selectedCompanyId on mount, then clear it ── */
  const [filterCompanyId, setFilterCompanyId] = useState<string | null>(() => {
    const id = useAppStore.getState().selectedCompanyId
    if (id) {
      useAppStore.getState().setSelectedCompanyId(null)
      return id
    }
    return null
  })

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

  /* ── Handlers ── */
  const updateSearch = useCallback((v: string) => {
    setSearch(v)
    setPage(1)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedSearch(v), 300)
  }, [])

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

  /* ── Queries ── */
  /* ── Fetch company name for filter banner ── */
  const { data: filterCompany } = useQuery({
    queryKey: ['company-brief-contacts', filterCompanyId],
    queryFn: () => fetch(`/api/companies/${filterCompanyId}`).then(r => {
      if (!r.ok) throw new Error('Failed to load company')
      return r.json()
    }),
    enabled: !!filterCompanyId,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['contacts', debouncedSearch, status, health, page, filterCompanyId],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debouncedSearch) p.set('search', debouncedSearch)
      if (status) p.set('status', status)
      if (health) p.set('emailHealth', health)
      if (filterCompanyId) p.set('companyId', filterCompanyId)
      return fetch(`/api/contacts?${p}`).then(r => {
        if (!r.ok) throw new Error('Failed to load contacts')
        return r.json()
      })
    },
  })

  const { data: companiesList } = useQuery({
    queryKey: ['companies', 'contact-dialog'],
    queryFn: () =>
      fetch('/api/companies?pageSize=100')
        .then(r => { if (!r.ok) throw new Error('Failed to load companies'); return r.json() })
        .then(d => d.companies ?? []),
  })

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
      // Flash the badge to indicate update
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

  /* ── Derived ── */
  const contacts: ContactRow[] = data?.contacts ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Build draft indicator set from list data — using useMemo (C14 fix)
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
      {filterCompanyId && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200/80">
          <Building2 className="size-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Showing contacts for <span className="font-semibold">{filterCompany?.name || 'Company'}</span>
          </p>
          <button
            onClick={() => setFilterCompanyId(null)}
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
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums">
              {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* ═══ Batch Validate Emails Button (H4 fix — opens confirmation) ═══ */}
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
            <span className="hidden sm:inline ml-1.5">{batchValidateMutation.isPending ? 'Validating...' : 'Validate Emails'}</span>
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
        <div className="relative flex-1 sm:min-w-[200px] sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={e => updateSearch(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg h-9 pl-9 text-sm placeholder:text-gray-400 focus-visible:ring-amber-500/20 focus-visible:border-amber-400"
          />
        </div>
        <Select value={status || 'all'} onValueChange={updateStatus}>
          <SelectTrigger className="border-gray-200 rounded-lg h-9 w-32 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
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
            description="Try adjusting your search or filters, or add your first contact."
            actionLabel="Add Contact"
            onAction={() => setDlgOpen(true)}
            secondaryActionLabel="Import CSV"
            onSecondaryAction={() => useAppStore.getState().setActiveView('import')}
          />
        </div>
      ) : (
        <div className="rounded-xl bg-white card-rest overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-gray-50/80 border-b border-gray-200/60">
                <SortableHeader label="Name" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                  Company
                </th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                  Job Title
                </th>
                <SortableHeader label="Email" sortKey="email" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
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
                    <TableCell className="hidden md:table-cell">
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

                    {/* Job Title */}
                    <TableCell className="hidden lg:table-cell text-sm text-gray-500">
                      {c.jobTitle || '—'}
                    </TableCell>

                    {/* Email */}
                    <TableCell>
                      <span className="text-sm text-gray-600 font-mono text-xs">{c.email || '—'}</span>
                    </TableCell>

                    {/* Health with validation UX */}
                    <TableCell>
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
                    <TableCell>
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

      {/* ════════════ Edit Contact Dialog (H5 fix — company is now Select) ════════════ */}
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

      {/* ════════════ Batch Validate Confirmation (H4 fix) ════════════ */}
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
    </div>
  )
}