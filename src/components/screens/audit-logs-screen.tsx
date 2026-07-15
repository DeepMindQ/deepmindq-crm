'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Download, FileText, ChevronLeft, ChevronRight, Filter,
  ClipboardList,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/fetchApi'
import { relativeDate, formatDate } from '@/lib/date'
import type { AuditLogEntry } from '@/lib/types'

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const ENTITY_OPTIONS = [
  { value: '', label: 'All Entities' },
  { value: 'Company', label: 'Company' },
  { value: 'Contact', label: 'Contact' },
  { value: 'Opportunity', label: 'Opportunity' },
  { value: 'User', label: 'User' },
  { value: 'Settings', label: 'Settings' },
  { value: 'Data', label: 'Data' },
] as const

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'export', label: 'Export' },
  { value: 'import', label: 'Import' },
] as const

const PAGE_SIZE = 50

const ACTION_STYLES: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  login: 'bg-violet-50 text-violet-700 border-violet-200',
  logout: 'bg-violet-50 text-violet-600 border-violet-200',
  export: 'bg-amber-50 text-amber-700 border-amber-200',
  import: 'bg-sky-50 text-sky-700 border-sky-200',
}

function getActionStyle(action: string): string {
  return ACTION_STYLES[action] || 'bg-gray-50 text-gray-600 border-gray-200'
}

/* ═══════════════════════════════════════════════════════════════
   Audit Logs Screen
   ═══════════════════════════════════════════════════════════════ */

export function AuditLogsScreen() {
  // ── Filter state ──
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [userId, setUserId] = useState('')
  const [page, setPage] = useState(0)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // ── Build query params ──
  const queryParams = useMemo(() => ({
    entity: entity || undefined,
    action: action || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    userId: userId || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [entity, action, fromDate, toDate, userId, page])

  // ── Fetch audit logs ──
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => fetchApi<{ data: AuditLogEntry[]; total: number }>('/api/audit-logs', { params: queryParams }),
    select: (res) => res.data,
  })

  const logs = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ── Fetch users for filter dropdown ──
  const { data: usersData } = useQuery({
    queryKey: ['audit-users'],
    queryFn: () => fetchApi<any[]>('/api/users').then(res => res.data),
  })
  const users = usersData ?? []

  // ── Export CSV ──
  const handleExport = useCallback(async () => {
    try {
      const { data: exportData, error } = await fetchApi<AuditLogEntry[]>('/api/audit-logs', {
        params: {
          entity: entity || undefined,
          action: action || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
          userId: userId || undefined,
          limit: 10000,
          offset: 0,
        },
      })
      if (error || !exportData) {
        toast.error('Failed to export audit logs')
        return
      }

      const headers = ['Timestamp', 'User', 'Email', 'Action', 'Entity', 'Entity ID', 'Details', 'IP Address']
      const rows = exportData.map(log => [
        new Date(log.createdAt).toISOString(),
        log.user?.name ?? 'System',
        log.user?.email ?? '',
        log.action,
        log.entity,
        log.entityId ?? '',
        (log.details ?? '').replace(/"/g, '""'),
        log.ipAddress ?? '',
      ])

      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${exportData.length} audit log entries`)
    } catch {
      toast.error('Export failed — please try again')
    }
  }, [entity, action, fromDate, toDate, userId])

  // ── Reset filters ──
  const handleReset = useCallback(() => {
    setEntity('')
    setAction('')
    setFromDate('')
    setToDate('')
    setUserId('')
    setPage(0)
  }, [])

  const hasActiveFilters = entity || action || fromDate || toDate || userId

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* ═══════════════════════════════════════════════════════
          Header
         ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track all actions performed in your workspace. {total > 0 && `${total} total entries.`}
          </p>
        </div>
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm press-scale"
          onClick={handleExport}
        >
          <Download className="size-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════
          Filters
         ═══════════════════════════════════════════════════════ */}
      <div className="rounded-xl bg-white card-rest p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
          <Filter className="size-3.5" />
          Filters
          {hasActiveFilters && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] ml-1 px-1.5 py-0">
              Active
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Entity */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 block mb-1">Entity</label>
            <Select value={entity} onValueChange={(v) => { setEntity(v === '__all__' ? '' : v); setPage(0) }}>
              <SelectTrigger className="h-8 border-gray-200 rounded-lg text-xs">
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value || '__all__'} value={opt.value || '__all__'} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 block mb-1">Action</label>
            <Select value={action} onValueChange={(v) => { setAction(v === '__all__' ? '' : v); setPage(0) }}>
              <SelectTrigger className="h-8 border-gray-200 rounded-lg text-xs">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value || '__all__'} value={opt.value || '__all__'} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 block mb-1">From</label>
            <Input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setPage(0) }}
              className="h-8 border-gray-200 rounded-lg text-xs"
            />
          </div>

          {/* To */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 block mb-1">To</label>
            <Input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setPage(0) }}
              className="h-8 border-gray-200 rounded-lg text-xs"
            />
          </div>

          {/* User */}
          {users.length > 1 && (
            <div>
              <label className="text-[11px] font-medium text-gray-500 block mb-1">User</label>
              <Select value={userId} onValueChange={(v) => { setUserId(v === '__all__' ? '' : v); setPage(0) }}>
                <SelectTrigger className="h-8 border-gray-200 rounded-lg text-xs">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__" className="text-xs">All Users</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 hover:text-gray-700 h-7"
              onClick={handleReset}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          Error State
         ═══════════════════════════════════════════════════════ */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
          <FileText className="size-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Failed to load audit logs</p>
            <p className="text-xs text-red-500 mt-1">Please try refreshing the page.</p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          Log Table
         ═══════════════════════════════════════════════════════ */}
      {!error && (
        <div className="rounded-xl bg-white card-rest overflow-hidden">
          {logs.length === 0 ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="size-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <ClipboardList className="size-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No audit logs found</h3>
              <p className="text-xs text-gray-500 text-center max-w-sm">
                {hasActiveFilters
                  ? 'No logs match the current filters. Try adjusting your filter criteria.'
                  : 'Audit logs will appear here as actions are performed in your workspace.'}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 text-xs rounded-lg"
                  onClick={handleReset}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* ── Table ── */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-44">Timestamp</th>
                      <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-44">User</th>
                      <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-24">Action</th>
                      <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-28">Entity</th>
                      <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-32">Entity ID</th>
                      <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Details</th>
                      <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-36">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => {
                      const isExpanded = expandedRow === log.id
                      const isAlt = idx % 2 === 1
                      return (
                        <tr
                          key={log.id}
                          className={cn(
                            'border-b border-gray-50 transition-colors hover:bg-amber-50/30',
                            isAlt && 'bg-gray-50/30',
                          )}
                        >
                          {/* Timestamp */}
                          <td className="px-4 py-3">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-gray-700 cursor-default">
                                    {relativeDate(log.createdAt)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                  {formatDate(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString()}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>

                          {/* User */}
                          <td className="px-4 py-3">
                            <div className="text-xs font-medium text-gray-900">
                              {log.user?.name ?? 'System'}
                            </div>
                            {log.user?.email && (
                              <div className="text-[11px] text-gray-400 mt-0.5">{log.user.email}</div>
                            )}
                          </td>

                          {/* Action */}
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-medium px-2 py-0.5 rounded-md border capitalize',
                                getActionStyle(log.action),
                              )}
                            >
                              {log.action}
                            </Badge>
                          </td>

                          {/* Entity */}
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-700">{log.entity}</span>
                          </td>

                          {/* Entity ID */}
                          <td className="px-4 py-3">
                            {log.entityId ? (
                              <code className="text-[11px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                                {log.entityId.length > 12 ? log.entityId.slice(0, 12) + '...' : log.entityId}
                              </code>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>

                          {/* Details */}
                          <td className="px-4 py-3 max-w-xs">
                            {log.details ? (
                              <div>
                                <p
                                  className={cn(
                                    'text-xs text-gray-600',
                                    !isExpanded && 'line-clamp-1',
                                  )}
                                >
                                  {log.details}
                                </p>
                                {log.details.length > 60 && (
                                  <button
                                    onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                    className="text-[10px] text-amber-600 hover:text-amber-800 font-medium mt-0.5 transition-colors"
                                  >
                                    {isExpanded ? 'Show less' : 'Show more'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>

                          {/* IP Address */}
                          <td className="px-4 py-3">
                            {log.ipAddress ? (
                              <code className="text-[11px] font-mono text-gray-500">{log.ipAddress}</code>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/40">
                  <p className="text-xs text-gray-500">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} entries
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs rounded-lg border-gray-200"
                      disabled={page === 0}
                      onClick={() => setPage(0)}
                    >
                      <ChevronLeft className="size-3.5" />
                      <ChevronLeft className="size-3.5 -ml-1.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs rounded-lg border-gray-200"
                      disabled={page === 0}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-0.5 mx-1">
                      {generatePageNumbers(page, totalPages).map((p, i) =>
                        p === '...' ? (
                          <span key={`dots-${i}`} className="text-xs text-gray-400 px-1">...</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p as number)}
                            className={cn(
                              'h-7 w-7 rounded-lg text-xs font-medium transition-colors',
                              page === p
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-gray-600 hover:bg-gray-100',
                            )}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs rounded-lg border-gray-200"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs rounded-lg border-gray-200"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(totalPages - 1)}
                    >
                      <ChevronRight className="size-3.5" />
                      <ChevronRight className="size-3.5 -ml-1.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const pages: (number | '...')[] = [0]
  if (current > 2) pages.push('...')
  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 3) pages.push('...')
  pages.push(total - 1)
  return pages
}