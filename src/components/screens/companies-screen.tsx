'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Search, MoreHorizontal, ExternalLink, Archive, Building2, Globe, MapPin, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'

export function CompaniesScreen() {
  const { setSelectedCompanyId, setActiveView } = useAppStore()
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', domain: '', industry: '', employeeSize: '', country: '', location: '', website: '', linkedinUrl: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search, industry, status, page],
    queryFn: () => fetch(`/api/companies?search=${search}&industry=${industry !== 'all' ? industry : ''}&status=${status !== 'all' ? status : ''}&page=${page}&pageSize=20`).then(r => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => fetch('/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast.success('Company created'); setShowAdd(false); setForm({ name: '', domain: '', industry: '', employeeSize: '', country: '', location: '', website: '', linkedinUrl: '' }) },
  })

  const statusColor = (s: string) => {
    const map: Record<string, string> = { new: 'bg-[#242424] text-slate-300', researching: 'bg-amber-950/50 text-amber-400', ready: 'bg-[#D4AF37]/15 text-[#D4AF37]', contacted: 'bg-[#2A9DFF]/10 text-[#2A9DFF]', archived: 'bg-gray-800 text-gray-400' }
    return map[s] || map.new
  }

  const freshnessColor = (f: string) => {
    const map: Record<string, string> = { fresh: 'bg-[#D4AF37]', stale: 'bg-amber-500', old: 'bg-red-500' }
    return map[f] || 'bg-gray-400'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{data?.total || 0} companies</span>
        </div>
        <Button size="sm" className="bg-[#D4AF37] hover:bg-[#D4AF37]/15 text-white" onClick={() => setShowAdd(true)}>
          <Plus className="size-4 mr-1.5" /> Add Company
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
          <Input placeholder="Search companies..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={industry} onValueChange={v => { setIndustry(v); setPage(1) }}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Industry" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {['Manufacturing', 'Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Energy', 'Logistics'].map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={v => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {['new', 'researching', 'ready', 'contacted', 'archived'].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/30">
              <TableHead className="text-xs font-medium">Company</TableHead>
              <TableHead className="text-xs font-medium">Industry</TableHead>
              <TableHead className="text-xs font-medium">Country</TableHead>
              <TableHead className="text-xs font-medium text-center">Contacts</TableHead>
              <TableHead className="text-xs font-medium">Score</TableHead>
              <TableHead className="text-xs font-medium">Freshness</TableHead>
              <TableHead className="text-xs font-medium">Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10" /></TableCell></TableRow>
            )) : data?.companies?.map((c: any) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => { setSelectedCompanyId(c.id); setActiveView('company-profile') }}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] text-xs font-bold shrink-0">{c.name?.charAt(0)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.domain && <p className="text-xs text-muted-foreground truncate">{c.domain}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.industry || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.country || '—'}</TableCell>
                <TableCell className="text-center"><Badge variant="secondary" className="font-medium">{c._count?.contacts || 0}</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${c.intelligenceScore >= 80 ? 'bg-[#D4AF37]' : c.intelligenceScore >= 50 ? 'bg-amber-500' : 'bg-gray-400'}`} style={{ width: `${c.intelligenceScore || 0}%` }} />
                    </div>
                    <span className="text-xs font-medium tabular-nums">{c.intelligenceScore || 0}</span>
                  </div>
                </TableCell>
                <TableCell><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${freshnessColor(c.dataFreshness)}`} /><span className="text-xs text-muted-foreground capitalize">{c.dataFreshness || 'unknown'}</span></div></TableCell>
                <TableCell><Badge className={`text-xs font-medium border-0 ${statusColor(c.status)}`}>{c.status}</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedCompanyId(c.id); setActiveView('company-profile') }}>View Profile</DropdownMenuItem>
                      {c.website && <DropdownMenuItem onClick={e => e.stopPropagation()}><ExternalLink className="size-3.5 mr-2" />Visit Website</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data?.companies?.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="size-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No companies found</p>
            <p className="text-xs mt-1">Add your first company or import a CSV</p>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Add Company Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Company</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name</Label><Input placeholder="ABC Manufacturing" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Domain</Label><Input placeholder="abc.com" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Industry</Label>
                <Select value={form.industry} onValueChange={v => setForm({ ...form, industry: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{['Manufacturing', 'Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Energy', 'Logistics'].map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Country</Label><Input placeholder="USA" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Employees</Label>
                <Select value={form.employeeSize} onValueChange={v => setForm({ ...form, employeeSize: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Website</Label><Input placeholder="https://abc.com" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-[#D4AF37] hover:bg-[#D4AF37]/15 text-white" onClick={() => createMutation.mutate(form)} disabled={!form.name}>Create Company</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}