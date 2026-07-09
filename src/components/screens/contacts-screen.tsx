'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ROLES = ['Executive', 'Manager', 'Technical', 'Operations', 'Sales', 'Other']

const healthCls = (h: string) =>
  h === 'valid' ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : h === 'risky' ? 'bg-amber-100 text-amber-700' : h === 'invalid' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'

const statusCls = (s: string) =>
  s === 'active' ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : s === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'

export default function ContactsScreen() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [health, setHealth] = useState('')
  const [dlgOpen, setDlgOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', jobTitle: '', roleBucket: '', company: '', linkedinUrl: '' })
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const updateSearch = (v: string) => { setSearch(v); setPage(1); clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setDebouncedSearch(v), 300) }
  const updateStatus = (v: string) => { setStatus(v === 'all' ? '' : v); setPage(1) }
  const updateHealth = (v: string) => { setHealth(v === 'all' ? '' : v); setPage(1) }

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
      fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setDlgOpen(false); setForm({ name: '', email: '', jobTitle: '', roleBucket: '', company: '', linkedinUrl: '' }); toast.success('Contact added') },
    onError: (e: Error) => toast.error(e.message),
  })

  const contacts = data?.contacts ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 20))

  const updateField = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Users className="size-5 text-muted-foreground" /><h2 className="text-lg font-semibold">Contacts</h2>{total > 0 && <Badge variant="secondary">{total}</Badge>}</div>
        <Button size="sm" onClick={() => setDlgOpen(true)}><Plus className="size-3.5 mr-1.5" />Add Contact</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search contacts..." value={search} onChange={e => updateSearch(e.target.value)} className="pl-8 h-9" /></div>
        <Select value={status} onValueChange={updateStatus}><SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select>
        <Select value={health} onValueChange={updateHealth}><SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Health" /></SelectTrigger><SelectContent><SelectItem value="all">All Health</SelectItem><SelectItem value="valid">Valid</SelectItem><SelectItem value="risky">Risky</SelectItem><SelectItem value="invalid">Invalid</SelectItem><SelectItem value="unknown">Unknown</SelectItem></SelectContent></Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12"><Users className="size-10 mx-auto text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-2">No contacts found.</p></div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="hidden md:table-cell">Company</TableHead><TableHead className="hidden lg:table-cell">Job Title</TableHead><TableHead>Email</TableHead><TableHead>Health</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{contacts.map((c: any) => (
            <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell className="hidden md:table-cell text-muted-foreground">{c.company?.name || '—'}</TableCell><TableCell className="hidden lg:table-cell text-muted-foreground">{c.jobTitle || '—'}</TableCell><TableCell className="text-muted-foreground text-sm">{c.email || '—'}</TableCell>
            <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${healthCls(c.emailHealth)}`}>{c.emailHealth || 'unknown'}</span></TableCell>
            <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCls(c.status)}`}>{c.status}</span></TableCell></TableRow>
          ))}</TableBody></Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="icon" className="size-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => updateField('name', e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Job Title</Label><Input value={form.jobTitle} onChange={e => updateField('jobTitle', e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Role Bucket</Label><Select value={form.roleBucket} onValueChange={v => updateField('roleBucket', v)}><SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Company</Label><Input value={form.company} onChange={e => updateField('company', e.target.value)} className="mt-1" placeholder="Company name" /></div>
              <div><Label className="text-xs">LinkedIn</Label><Input value={form.linkedinUrl} onChange={e => updateField('linkedinUrl', e.target.value)} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDlgOpen(false)}>Cancel</Button><Button onClick={() => addContact.mutate(form)} disabled={!form.name.trim() || addContact.isPending}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}