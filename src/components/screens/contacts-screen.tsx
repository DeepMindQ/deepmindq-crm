'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ChevronLeft, ChevronRight, Users, Mail, ShieldCheck, Sparkles, MoreHorizontal, Pencil, Archive, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { EmptyState, SortableHeader, StatusDot } from '@/components/shared/design-system'
import { useAppStore } from '@/lib/store'

const ROLES = ['Executive', 'Manager', 'Technical', 'Operations', 'Sales', 'Other']

const healthCls = (h: string) =>
  h === 'valid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  : h === 'risky' ? 'bg-amber-50 text-amber-700 border border-amber-200'
  : h === 'invalid' ? 'bg-red-50 text-red-700 border border-red-200'
  : 'bg-gray-100 text-gray-500 border border-gray-200'

const statusCls = (s: string) =>
  s === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  : s === 'archived' ? 'bg-gray-100 text-gray-400 border border-gray-200'
  : 'bg-amber-50 text-amber-700 border border-amber-200'

export default function ContactsScreen() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [health, setHealth] = useState('')
  const [dlgOpen, setDlgOpen] = useState(false)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [form, setForm] = useState({ name: '', email: '', jobTitle: '', roleBucket: '', companyId: '', linkedinUrl: '' })
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<any>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', jobTitle: '', roleBucket: '', company: '', linkedinUrl: '' })

  // Archive confirmation state
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archivingContact, setArchivingContact] = useState<any>(null)

  const updateSearch = (v: string) => { setSearch(v); setPage(1); clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setDebouncedSearch(v), 300) }
  const updateStatus = (v: string) => { setStatus(v === 'all' ? '' : v); setPage(1) }
  const updateHealth = (v: string) => { setHealth(v === 'all' ? '' : v); setPage(1) }
  const handleSort = (key: string) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc') } }

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', debouncedSearch, status, health, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (debouncedSearch) p.set('search', debouncedSearch)
      if (status) p.set('status', status)
      if (health) p.set('emailHealth', health)
      return fetch(`/api/contacts?${p}`).then(r => r.json())
    },
  })

  const addContact = useMutation({
    mutationFn: (f: typeof form) =>
      fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setDlgOpen(false); setForm({ name: '', email: '', jobTitle: '', roleBucket: '', companyId: '', linkedinUrl: '' }); toast.success('Contact added') },
    onError: (e: Error) => toast.error(e.message),
  })

  const validateMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/contacts/${id}/validate`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => { toast.success('Email validated'); qc.invalidateQueries({ queryKey: ['contacts'] }) },
    onError: () => toast.error('Validation failed'),
  })

  const editContact = useMutation({
    mutationFn: ({ id, ...f }: typeof editForm & { id: string }) =>
      fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setEditOpen(false); setEditingContact(null); toast.success('Contact updated') },
    onError: (e: Error) => toast.error(e.message),
  })

  const archiveContact = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/contacts/${id}`, { method: 'DELETE' })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setArchiveOpen(false); setArchivingContact(null); toast.success('Contact archived') },
    onError: (e: Error) => toast.error(e.message),
  })

  const contacts = data?.contacts ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 20))
  // Fetch companies for the add contact dialog
  const { data: companiesList } = useQuery({
    queryKey: ['companies', 'contact-dialog'],
    queryFn: () => fetch('/api/companies?pageSize=100').then(r => r.json()).then(d => d.companies ?? []),
  })

  const companyName = companiesList?.find((c: any) => c.id === form.companyId)?.name || ''

  const updateField = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))
  const updateEditField = (k: keyof typeof editForm, v: string) => setEditForm(p => ({ ...p, [k]: v }))

  const openEditDialog = (c: any) => {
    setEditingContact(c)
    setEditForm({
      name: c.name || '',
      email: c.email || '',
      jobTitle: c.jobTitle || '',
      roleBucket: c.roleBucket || '',
      company: typeof c.company === 'string' ? c.company : c.company?.name || '',
      linkedinUrl: c.linkedinUrl || '',
    })
    // Pre-select company in add form if coming from a company context
    if (c.company?.id) setForm(p => ({ ...p, companyId: c.company.id }))
    setEditOpen(true)
  }

  const openArchiveConfirm = (c: any) => {
    setArchivingContact(c)
    setArchiveOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Users className="size-5 text-gray-400" />
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Contacts</h2>
          {total > 0 && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums">{total}</span>}
        </div>
        <Button size="sm" onClick={() => setDlgOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs shrink-0">
          <Plus className="size-4" /> <span className="hidden sm:inline ml-1.5">Add Contact</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:min-w-[200px] sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search contacts..." value={search} onChange={e => updateSearch(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg h-9 pl-9 text-sm placeholder:text-gray-400 focus-visible:ring-amber-500/20 focus-visible:border-amber-400" />
        </div>
        <Select value={status || 'all'} onValueChange={updateStatus}>
          <SelectTrigger className="border-gray-200 rounded-lg h-9 w-32 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={health || 'all'} onValueChange={updateHealth}>
          <SelectTrigger className="border-gray-200 rounded-lg h-9 w-32 text-sm"><SelectValue placeholder="Health" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="risky">Risky</SelectItem>
            <SelectItem value="invalid">Invalid</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-xl bg-white card-rest overflow-hidden p-4 space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-xl bg-white card-rest overflow-hidden">
          <EmptyState icon={Users} title="No contacts found" description="Try adjusting your search or filters, or add your first contact."
            actionLabel="Add Contact" onAction={() => setDlgOpen(true)} secondaryActionLabel="Import CSV" onSecondaryAction={() => useAppStore.getState().setActiveView('import')} />
        </div>
      ) : (
        <div className="rounded-xl bg-white card-rest overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-gray-50/80 border-b border-gray-200/60">
                <SortableHeader label="Name" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Company</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Job Title</th>
                <SortableHeader label="Email" sortKey="email" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Health</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="w-10 px-4 py-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c: any) => (
                <TableRow key={c.id} className="table-row-hover border-b border-gray-50 last:border-b-0 group">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-[11px] font-semibold shrink-0">
                        {c.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-gray-500">{c.company?.name || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-gray-500">{c.jobTitle || '—'}</TableCell>
                  <TableCell><span className="text-sm text-gray-600 font-mono text-xs">{c.email || '—'}</span></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${healthCls(c.emailHealth)}`}>{c.emailHealth || 'unknown'}</span>
                      <button onClick={() => validateMutation.mutate(c.id)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-emerald-50" title="Validate email">
                        <ShieldCheck className="size-3.5 text-emerald-500" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${statusCls(c.status)}`}>{c.status}</span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-md hover:bg-gray-100 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <MoreHorizontal className="size-4 text-gray-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5 elevation-float">
                        <DropdownMenuItem className="rounded-lg text-sm" onClick={() => {
                          useAppStore.getState().setSelectedContactId(c.id)
                          useAppStore.getState().setActiveView('contact-profile')
                        }}>
                          <Users className="size-3.5 mr-2 text-gray-400" /> View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg text-sm" onClick={() => validateMutation.mutate(c.id)}>
                          <ShieldCheck className="size-3.5 mr-2 text-emerald-500" /> Validate Email
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg text-sm" onClick={() => {
                          useAppStore.getState().setSelectedContactId(c.id)
                          useAppStore.getState().setActiveView('email-generation')
                        }}>
                          <Sparkles className="size-3.5 mr-2 text-indigo-500" /> Generate Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1" />
                        <DropdownMenuItem className="rounded-lg text-sm" onClick={() => openEditDialog(c)}>
                          <Pencil className="size-3.5 mr-2 text-gray-400" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg text-sm text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => openArchiveConfirm(c)}>
                          <Archive className="size-3.5 mr-2 text-red-500" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-sm text-gray-500">
          <span className="text-center sm:text-left">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
          <div className="flex items-center gap-1 justify-center">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 h-8 text-xs">
              <ChevronLeft className="size-3.5 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 h-8 text-xs">
              Next <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl">
          <DialogHeader><DialogTitle className="text-gray-900">Add Contact</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Name *</Label>
              <Input value={form.name} onChange={e => updateField('name', e.target.value)} className="border-gray-200 rounded-lg h-9 text-sm" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Email</Label>
              <Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} className="border-gray-200 rounded-lg h-9 text-sm font-mono" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Job Title</Label>
                <Input value={form.jobTitle} onChange={e => updateField('jobTitle', e.target.value)} className="border-gray-200 rounded-lg h-9 text-sm" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Role</Label>
                <Select value={form.roleBucket} onValueChange={v => updateField('roleBucket', v)}>
                  <SelectTrigger className="border-gray-200 rounded-lg h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Company *</Label>
                <Select value={form.companyId} onValueChange={v => updateField('companyId', v)}>
                  <SelectTrigger className="border-gray-200 rounded-lg h-9 text-sm"><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {(companiesList || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">LinkedIn</Label>
                <Input value={form.linkedinUrl} onChange={e => updateField('linkedinUrl', e.target.value)} className="border-gray-200 rounded-lg h-9 text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)} className="border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</Button>
            <Button onClick={() => addContact.mutate(form)} disabled={!form.name.trim() || !form.companyId || addContact.isPending} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale">
              {addContact.isPending ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditingContact(null) } }}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl">
          <DialogHeader><DialogTitle className="text-gray-900">Edit Contact</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Name *</Label>
              <Input value={editForm.name} onChange={e => updateEditField('name', e.target.value)} className="border-gray-200 rounded-lg h-9 text-sm" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Email</Label>
              <Input type="email" value={editForm.email} onChange={e => updateEditField('email', e.target.value)} className="border-gray-200 rounded-lg h-9 text-sm font-mono" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Job Title</Label>
                <Input value={editForm.jobTitle} onChange={e => updateEditField('jobTitle', e.target.value)} className="border-gray-200 rounded-lg h-9 text-sm" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Role</Label>
                <Select value={editForm.roleBucket} onValueChange={v => updateEditField('roleBucket', v)}>
                  <SelectTrigger className="border-gray-200 rounded-lg h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Company</Label>
                <Input value={editForm.company} onChange={e => updateEditField('company', e.target.value)} placeholder="Company name" className="border-gray-200 rounded-lg h-9 text-sm" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">LinkedIn</Label>
                <Input value={editForm.linkedinUrl} onChange={e => updateEditField('linkedinUrl', e.target.value)} className="border-gray-200 rounded-lg h-9 text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setEditingContact(null) }} className="border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</Button>
            <Button onClick={() => editingContact && editContact.mutate({ id: editingContact.id, ...editForm })} disabled={!editForm.name.trim() || editContact.isPending || !editingContact} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale">
              {editContact.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveOpen} onOpenChange={(open) => { if (!open) { setArchiveOpen(false); setArchivingContact(null) } }}>
        <AlertDialogContent className="sm:max-w-md bg-white rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Archive Contact</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to archive <span className="font-semibold text-gray-900">{archivingContact?.name}</span>? This will soft-delete the contact. You can still find them by filtering for archived contacts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-200 text-gray-600 hover:bg-gray-50" onClick={() => { setArchiveOpen(false); setArchivingContact(null) }}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white rounded-lg press-scale" onClick={() => archivingContact && archiveContact.mutate(archivingContact.id)} disabled={archiveContact.isPending}>
              {archiveContact.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              {archiveContact.isPending ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}