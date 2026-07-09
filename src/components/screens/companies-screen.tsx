'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Search, MoreHorizontal, ExternalLink, Building2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'

const statusStyle: Record<string, string> = {
  new: 'bg-gray-100 text-gray-600',
  researching: 'bg-amber-50 text-amber-700',
  ready: 'bg-emerald-50 text-emerald-700',
  contacted: 'bg-blue-50 text-blue-700',
  archived: 'bg-gray-50 text-gray-400',
}

const freshnessDot: Record<string, string> = {
  fresh: 'bg-emerald-500',
  stale: 'bg-amber-400',
  old: 'bg-red-400',
}

const scoreFill = (score: number) =>
  score >= 80 ? 'bg-amber-500' : score >= 50 ? 'bg-amber-400' : 'bg-gray-300'

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500">{data?.total || 0} total</p>
        </div>
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="size-4 mr-1.5" /> Add Company
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9 h-10 bg-white border-gray-200 rounded-lg text-sm focus:border-amber-400 focus:ring-amber-100"
          />
        </div>
        <Select value={industry} onValueChange={v => { setIndustry(v); setPage(1) }}>
          <SelectTrigger className="w-40 h-10 bg-white border-gray-200 rounded-lg text-sm">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {['Manufacturing', 'Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Energy', 'Logistics'].map(i => (
              <SelectItem key={i} value={i}>{i}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={v => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-36 h-10 bg-white border-gray-200 rounded-lg text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {['new', 'researching', 'ready', 'contacted', 'archived'].map(s => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200/80 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Company</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Industry</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Country</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Contacts</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Score</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Freshness</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="w-12 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td colSpan={8} className="px-4 py-3">
                        <Skeleton className="h-10 w-full rounded-md" />
                      </td>
                    </tr>
                  ))
                : data?.companies?.map((c: any) => (
                    <tr
                      key={c.id}
                      className="cursor-pointer hover:bg-gray-50/80 transition-colors border-b border-gray-100 last:border-0"
                      onClick={() => { setSelectedCompanyId(c.id); setActiveView('company-profile') }}
                    >
                      {/* Company */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center justify-center text-xs shrink-0">
                            {c.name?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                            {c.domain && <p className="text-xs text-gray-500 truncate">{c.domain}</p>}
                          </div>
                        </div>
                      </td>
                      {/* Industry */}
                      <td className="px-4 py-3 text-sm text-gray-600">{c.industry || '—'}</td>
                      {/* Country */}
                      <td className="px-4 py-3 text-sm text-gray-600">{c.country || '—'}</td>
                      {/* Contacts */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-gray-900">{c._count?.contacts || 0}</span>
                      </td>
                      {/* Score */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${scoreFill(c.intelligenceScore || 0)}`}
                              style={{ width: `${c.intelligenceScore || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-500 tabular-nums">{c.intelligenceScore || 0}</span>
                        </div>
                      </td>
                      {/* Freshness */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${freshnessDot[c.dataFreshness] || 'bg-gray-300'}`} />
                          <span className="text-xs text-gray-500 capitalize">{c.dataFreshness || 'unknown'}</span>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[c.status] || statusStyle.new}`}>
                          {c.status}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <button className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                              <MoreHorizontal className="size-4 text-gray-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedCompanyId(c.id); setActiveView('company-profile') }}>
                              View Profile
                            </DropdownMenuItem>
                            {c.website && (
                              <DropdownMenuItem onClick={e => e.stopPropagation()}>
                                <ExternalLink className="size-3.5 mr-2" />Visit Website
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {data?.companies?.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Building2 className="size-10 mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No companies found</p>
            <p className="text-xs mt-1 text-gray-400">Add your first company or import a CSV</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="inline-flex items-center gap-1 px-3 h-9 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="size-4" /> Previous
            </button>
            <button
              disabled={page * 20 >= data.total}
              onClick={() => setPage(p => p + 1)}
              className="inline-flex items-center gap-1 px-3 h-9 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add Company Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Add Company</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Name</Label>
              <Input
                placeholder="ABC Manufacturing"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="border-gray-200 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Domain</Label>
                <Input
                  placeholder="abc.com"
                  value={form.domain}
                  onChange={e => setForm({ ...form, domain: e.target.value })}
                  className="border-gray-200 rounded-lg"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Industry</Label>
                <Select value={form.industry} onValueChange={v => setForm({ ...form, industry: v })}>
                  <SelectTrigger className="border-gray-200 rounded-lg">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Manufacturing', 'Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Energy', 'Logistics'].map(i => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Country</Label>
                <Input
                  placeholder="USA"
                  value={form.country}
                  onChange={e => setForm({ ...form, country: e.target.value })}
                  className="border-gray-200 rounded-lg"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-700">Employees</Label>
                <Select value={form.employeeSize} onValueChange={v => setForm({ ...form, employeeSize: v })}>
                  <SelectTrigger className="border-gray-200 rounded-lg">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Website</Label>
              <Input
                placeholder="https://abc.com"
                value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
                className="border-gray-200 rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg">
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name}
            >
              Create Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}