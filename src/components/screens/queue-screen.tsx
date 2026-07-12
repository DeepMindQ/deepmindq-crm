'use client'

import { useState, useMemo } from 'react'
import {
  Send, Pause, Play, AlertTriangle, Eye, CalendarClock,
  RefreshCw, Trash2, Clock, Mail, Shield, Flame,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { MOCK_QUEUE_ITEMS, MOCK_QUEUE_STATS, type QueueItem, type QueueStatus } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════
   Status badge config
   ═══════════════════════════════════════════════════════════════ */
const STATUS_CONFIG: Record<QueueStatus, { label: string; className: string; pulse?: boolean }> = {
  queued:    { label: 'Queued',    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  sending:   { label: 'Sending',   className: 'bg-sky-500/15 text-sky-400 border-sky-500/30', pulse: true },
  sent:      { label: 'Sent',      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  failed:    { label: 'Failed',    className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  paused:    { label: 'Paused',    className: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  dry_run:   { label: 'Dry Run',  className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
}

function StatusBadge({ status }: { status: QueueStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium px-2 py-0.5 rounded-md border', cfg.className)}>
      {cfg.pulse && <span className="inline-block size-1.5 rounded-full bg-sky-400 mr-1.5 animate-pulse" />}
      {cfg.label}
    </Badge>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = Date.now()
  const diff = d.getTime() - now
  if (diff < 0) return 'Now'
  if (diff < 3600000) return `in ${Math.round(diff / 60000)}m`
  if (diff < 86400000) return `in ${Math.round(diff / 3600000)}h`
  return `in ${Math.round(diff / 86400000)}d`
}

/* ═══════════════════════════════════════════════════════════════
   QueueScreen
   ═══════════════════════════════════════════════════════════════ */
export function QueueScreen() {
  const [items, setItems] = useState<QueueItem[]>(MOCK_QUEUE_ITEMS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPaused, setIsPaused] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const stats = MOCK_QUEUE_STATS
  const progressPct = (stats.sentToday / stats.dailyLimit) * 100

  const filteredItems = useMemo(() => {
    if (filterStatus === 'all') return items
    return items.filter(i => i.status === filterStatus)
  }, [items, filterStatus])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id) } else { s.add(id) }
      return s
    })
  }

  const toggleAll = () => {
    if (selected.size === filteredItems.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredItems.map(i => i.id)))
    }
  }

  const handlePauseAll = () => {
    setIsPaused(p => !p)
    setItems(prev => prev.map(i =>
      (i.status === 'queued' || i.status === 'sending')
        ? { ...i, status: isPaused ? 'queued' as const : 'paused' as const }
        : i
    ))
    toast.success(isPaused ? 'Queue resumed' : 'All sends paused')
  }

  const handleRetry = (id: string) => {
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'queued' as const, retryCount: i.retryCount + 1 } : i
    ))
    toast.success('Email queued for retry')
  }

  const handleRemove = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    toast.success('Removed from queue')
  }

  return (
    <div className="space-y-6 fade-in">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Send className="size-5 text-primary" />
            Send Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="text-amber-400 font-semibold">{stats.pending} pending</span>
            <span className="text-muted-foreground mx-1.5">|</span>
            <span className="text-sky-400 font-semibold">{stats.scheduled} scheduled</span>
            <span className="text-muted-foreground mx-1.5">|</span>
            <span className="text-red-400 font-semibold">{stats.failed} failed</span>
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg press-scale shadow-lg shadow-red-900/20"
            >
              <AlertTriangle className="size-4 mr-1.5" />
              {isPaused ? 'PAUSED' : 'PAUSE ALL'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                {isPaused ? 'Resume All Sends?' : 'Emergency Stop All Sends'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                {isPaused
                  ? 'This will resume all pending and scheduled emails in the queue.'
                  : 'This will immediately pause all outgoing emails. Emergency stop — no emails will be sent until you resume.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePauseAll}
                className={isPaused
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'}
              >
                {isPaused ? 'Resume All' : 'Pause All Sends'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* ═══ Stats Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Daily Send Limit */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Flame className="size-3.5 text-primary" />
              Daily Send Limit
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {stats.sentToday} / {stats.dailyLimit}
            </span>
          </div>
          <Progress value={progressPct} className="h-2 bg-secondary [&>div]:bg-primary" />
          <p className="text-[11px] text-muted-foreground">
            {Math.round(progressPct)}% of daily capacity used
          </p>
        </div>

        {/* Working Hours */}
        <div className="rounded-xl bg-card border border-border p-4">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-primary" />
            Sending Window
          </span>
          <p className="text-sm font-semibold text-foreground mt-2">
            {stats.workingHoursStart} — {stats.workingHoursEnd} {stats.timezone}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-emerald-400" />
            Currently within working hours
          </p>
        </div>

        {/* Pending */}
        <div className="rounded-xl bg-card border border-border p-4">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Mail className="size-3.5 text-amber-400" />
            Pending Sends
          </span>
          <p className="text-2xl font-bold text-amber-400 mt-2 tabular-nums">{stats.pending}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting delivery</p>
        </div>

        {/* Failed */}
        <div className="rounded-xl bg-card border border-border p-4">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-red-400" />
            Failed
          </span>
          <p className="text-2xl font-bold text-red-400 mt-2 tabular-nums">{stats.failed}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Requires attention</p>
        </div>
      </div>

      {/* ═══ Queue Table ═══ */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        {/* Table Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.size === filteredItems.length && filteredItems.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground">
                {selected.size > 0 ? `${selected.size} selected` : `${filteredItems.length} items`}
              </span>
            </div>
            <div className="flex gap-1">
              {(['all', 'queued', 'sending', 'failed', 'paused', 'dry_run'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                    filterStatus === s
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-card">
                {['Contact', 'Subject', 'Scheduled', 'Status', 'Mailbox', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground text-sm">
                    No items in queue matching this filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b border-border/50 transition-colors hover:bg-primary/5',
                      selected.has(item.id) && 'bg-primary/5',
                      idx % 2 === 1 && 'bg-secondary/20',
                    )}
                  >
                    {/* Checkbox + Contact */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                        <div>
                          <p className="text-xs font-medium text-foreground">{item.contactName}</p>
                          <p className="text-[11px] text-muted-foreground">{item.company}</p>
                        </div>
                      </div>
                    </td>

                    {/* Subject */}
                    <td className="px-4 py-3 max-w-[260px]">
                      <p className="text-xs text-foreground truncate">{item.subject}</p>
                      <p className="text-[10px] text-muted-foreground">Step {item.stepNumber}</p>
                    </td>

                    {/* Scheduled */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-muted-foreground">{formatTime(item.scheduledFor)}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>

                    {/* Mailbox */}
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-muted-foreground font-mono">{item.mailbox}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
                                <Eye className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View email</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
                                <CalendarClock className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reschedule</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {item.status === 'failed' && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-amber-400 hover:text-amber-300"
                                  onClick={() => handleRetry(item.id)}
                                >
                                  <RefreshCw className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Retry ({item.retryCount} retries)</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-red-400 hover:text-red-300"
                                onClick={() => handleRemove(item.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove from queue</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Bottom Controls ═══ */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch
              id="dry-run"
              checked={dryRun}
              onCheckedChange={setDryRun}
            />
            <div>
              <label htmlFor="dry-run" className="text-sm font-medium text-foreground cursor-pointer">
                Dry Run Mode
              </label>
              <p className="text-xs text-muted-foreground">
                Simulate sends without actually delivering emails
              </p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-right">
            <p><span className="text-foreground font-medium">Send Schedule Summary</span></p>
            <p>Initial: 8 contacts &middot; Follow-up 1: 3 contacts &middot; Follow-up 2: 2 contacts</p>
          </div>
        </div>
      </div>
    </div>
  )
}