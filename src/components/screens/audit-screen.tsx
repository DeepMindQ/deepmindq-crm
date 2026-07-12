'use client'

import { useState, useMemo } from 'react'
import {
  ClipboardList, Download, ChevronDown, ChevronRight, Search,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MOCK_AUDIT_ENTRIES, type AuditAction, type AuditEntry } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════
   Action type config
   ═══════════════════════════════════════════════════════════════ */
const ACTION_STYLES: Record<AuditAction, { className: string; color: string }> = {
  created:    { className: 'bg-sky-500/15 text-sky-400 border-sky-500/30', color: 'text-sky-400' },
  updated:    { className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', color: 'text-amber-400' },
  approved:   { className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', color: 'text-emerald-400' },
  sent:       { className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', color: 'text-cyan-400' },
  merged:     { className: 'bg-purple-500/15 text-purple-400 border-purple-500/30', color: 'text-purple-400' },
  suppressed: { className: 'bg-red-500/15 text-red-400 border-red-500/30', color: 'text-red-400' },
  deleted:    { className: 'bg-red-500/15 text-red-400 border-red-500/30', color: 'text-red-400' },
  exported:   { className: 'bg-gray-500/15 text-gray-400 border-gray-500/30', color: 'text-gray-400' },
}

const ENTITY_TYPES = ['All', 'Contact', 'Company', 'Email', 'Duplicate', 'Queue', 'Suppression', 'Import', 'Settings'] as const
const ACTION_TYPES: (AuditAction | 'All')[] = ['All', 'created', 'updated', 'approved', 'sent', 'merged', 'suppressed', 'deleted', 'exported']
const USER_OPTIONS = ['All', 'Ravi Shanker', 'System'] as const

function formatTimestamp(iso: string) {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return `${Math.round(diff / 86400000)}d ago`
}

function formatFullTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

/* ═══════════════════════════════════════════════════════════════
   Expandable Row
   ═══════════════════════════════════════════════════════════════ */
function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false)
  const style = ACTION_STYLES[entry.action]

  return (
    <>
      <tr
        className="border-b border-border/50 transition-colors hover:bg-primary/5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Timestamp */}
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
        </td>

        {/* User */}
        <td className="px-4 py-3">
          <p className="text-xs font-medium text-foreground">{entry.user}</p>
        </td>

        {/* Entity Type */}
        <td className="px-4 py-3">
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-md border border-border bg-secondary/50 text-muted-foreground">
            {entry.entityType}
          </Badge>
        </td>

        {/* Entity */}
        <td className="px-4 py-3 max-w-[200px]">
          <p className="text-xs text-foreground truncate">{entry.entity}</p>
        </td>

        {/* Action */}
        <td className="px-4 py-3">
          <Badge variant="outline" className={cn('text-[10px] font-medium px-2 py-0.5 rounded-md border capitalize', style.className)}>
            {entry.action}
          </Badge>
        </td>

        {/* Details */}
        <td className="px-4 py-3 max-w-[260px]">
          <p className="text-xs text-muted-foreground line-clamp-1">{entry.details}</p>
        </td>

        {/* Expand */}
        <td className="px-4 py-3 w-8">
          {(entry.beforeData || entry.afterData) && (
            <div className="flex items-center">
              {expanded
                ? <ChevronDown className="size-3.5 text-muted-foreground" />
                : <ChevronRight className="size-3.5 text-muted-foreground" />
              }
            </div>
          )}
        </td>
      </tr>

      {/* Expanded: Before/After */}
      {expanded && (entry.beforeData || entry.afterData) && (
        <tr className="bg-secondary/10">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before */}
              {entry.beforeData && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-2">Before</p>
                  <div className="space-y-1">
                    {Object.entries(entry.beforeData).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground font-medium min-w-[120px]">{k}</span>
                        <span className="text-red-400 line-through">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* After */}
              {entry.afterData && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-2">After</p>
                  <div className="space-y-1">
                    {Object.entries(entry.afterData).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground font-medium min-w-[120px]">{k}</span>
                        <span className="text-emerald-400">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No before data */}
              {!entry.beforeData && entry.afterData && (
                <div className="md:col-span-2 text-xs text-muted-foreground italic">
                  No previous state — this was a creation action.
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground mt-2">
              Full timestamp: {formatFullTimestamp(entry.timestamp)}
            </p>
          </td>
        </tr>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   AuditScreen
   ═══════════════════════════════════════════════════════════════ */
export function AuditScreen() {
  const [entityFilter, setEntityFilter] = useState('All')
  const [actionFilter, setActionFilter] = useState<string>('All')
  const [userFilter, setUserFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const filteredEntries = useMemo(() => {
    return MOCK_AUDIT_ENTRIES.filter(entry => {
      if (entityFilter !== 'All' && entry.entityType !== entityFilter) return false
      if (actionFilter !== 'All' && entry.action !== actionFilter) return false
      if (userFilter !== 'All' && entry.user !== userFilter) return false
      if (search) {
        const s = search.toLowerCase()
        return (
          entry.entity.toLowerCase().includes(s) ||
          entry.details.toLowerCase().includes(s) ||
          entry.user.toLowerCase().includes(s)
        )
      }
      if (fromDate && new Date(entry.timestamp) < new Date(fromDate)) return false
      if (toDate && new Date(entry.timestamp) > new Date(toDate + 'T23:59:59')) return false
      return true
    })
  }, [entityFilter, actionFilter, userFilter, search, fromDate, toDate])

  const hasFilters = entityFilter !== 'All' || actionFilter !== 'All' || userFilter !== 'All' || search || fromDate || toDate

  const handleExport = () => {
    const headers = ['Timestamp', 'User', 'Entity Type', 'Entity', 'Action', 'Details']
    const rows = filteredEntries.map(e => [
      e.timestamp, e.user, e.entityType, e.entity, e.action, `"${e.details}"`,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredEntries.length} audit entries`)
  }

  const clearFilters = () => {
    setEntityFilter('All')
    setActionFilter('All')
    setUserFilter('All')
    setSearch('')
    setFromDate('')
    setToDate('')
  }

  return (
    <div className="space-y-5 fade-in">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <ClipboardList className="size-5 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Append-only, immutable record of all workspace actions &middot; {MOCK_AUDIT_ENTRIES.length} entries
          </p>
        </div>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg press-scale"
          onClick={handleExport}
        >
          <Download className="size-3.5 mr-1.5" />
          Export Audit Log
        </Button>
      </div>

      {/* ═══ Filters ═══ */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Filter className="size-3.5" />
          Filters
          {hasFilters && (
            <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-[10px] ml-1 px-1.5 py-0">
              Active
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search entities, details, users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/50 text-xs rounded-lg"
              />
            </div>
          </div>

          {/* Entity Type */}
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="h-8 bg-secondary/50 border-border text-foreground text-xs rounded-lg">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map(e => (
                <SelectItem key={e} value={e} className="text-xs">{e === 'All' ? 'All Entities' : e}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Action Type */}
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-8 bg-secondary/50 border-border text-foreground text-xs rounded-lg">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(a => (
                <SelectItem key={a} value={a} className="text-xs capitalize">{a === 'All' ? 'All Actions' : a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* User */}
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="h-8 bg-secondary/50 border-border text-foreground text-xs rounded-lg">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              {USER_OPTIONS.map(u => (
                <SelectItem key={u} value={u} className="text-xs">{u === 'All' ? 'All Users' : u}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range placeholder */}
          <div className="flex gap-1.5">
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-8 bg-secondary/50 border-border text-foreground text-xs rounded-lg flex-1"
              placeholder="From"
            />
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-8 bg-secondary/50 border-border text-foreground text-xs rounded-lg flex-1"
              placeholder="To"
            />
          </div>
        </div>

        {hasFilters && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground h-7" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* ═══ Audit Table ═══ */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-card">
                {['Timestamp', 'User', 'Entity Type', 'Entity', 'Action', 'Details', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <ClipboardList className="size-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No audit entries match your filters</p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => (
                  <AuditRow key={entry.id} entry={entry} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border bg-secondary/20 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Showing {filteredEntries.length} of {MOCK_AUDIT_ENTRIES.length} entries
          </p>
          <p className="text-[11px] text-muted-foreground">
            Append-only log &middot; Not editable &middot; Retained indefinitely
          </p>
        </div>
      </div>
    </div>
  )
}