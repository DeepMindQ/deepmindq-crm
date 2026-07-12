'use client'

import { useState, useMemo } from 'react'
import {
  MessageSquare, Mail, MailWarning, ShieldBan, ChevronDown, ChevronUp,
  ThumbsUp, Clock, ThumbsDown, Ban, Inbox,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  MOCK_REPLIES, MOCK_BOUNCES, MOCK_SUPPRESSIONS,
  type ReplyItem, type ReplyClassification,
  type BounceEvent, type SuppressedContact,
} from '@/lib/mock-data'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════
   Classification badge
   ═══════════════════════════════════════════════════════════════ */
const CLASSIFICATION_CONFIG: Record<ReplyClassification, { label: string; className: string; icon: typeof ThumbsUp }> = {
  positive_interest: { label: 'Positive Interest', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: ThumbsUp },
  out_of_office:     { label: 'Out of Office',     className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Clock },
  negative:          { label: 'Negative',          className: 'bg-red-500/15 text-red-400 border-red-500/30', icon: ThumbsDown },
  unsubscribe:       { label: 'Unsubscribe',       className: 'bg-gray-500/15 text-gray-400 border-gray-500/30', icon: Ban },
  other:             { label: 'Other',             className: 'bg-sky-500/15 text-sky-400 border-sky-500/30', icon: Inbox },
}

function ClassificationBadge({ classification }: { classification: ReplyClassification }) {
  const cfg = CLASSIFICATION_CONFIG[classification]
  const Icon = cfg.icon
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium px-2 py-0.5 rounded-md border flex items-center gap-1 w-fit', cfg.className)}>
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  )
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return `${Math.round(diff / 86400000)}d ago`
}

/* ═══════════════════════════════════════════════════════════════
   Reply Card
   ═══════════════════════════════════════════════════════════════ */
function ReplyCard({ reply }: { reply: ReplyItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3 transition-colors hover:border-primary/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
            {reply.contactName.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{reply.contactName}</p>
            <p className="text-xs text-muted-foreground">{reply.company}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ClassificationBadge classification={reply.classification} />
          <span className="text-[11px] text-muted-foreground">{timeAgo(reply.timestamp)}</span>
        </div>
      </div>

      {/* Subject */}
      <div>
        <p className="text-xs font-medium text-foreground">{reply.subject}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Thread: {reply.originalSubject}
        </p>
      </div>

      {/* Body preview */}
      <div className="relative">
        <p className={cn(
          'text-xs text-muted-foreground leading-relaxed whitespace-pre-line',
          !expanded && 'line-clamp-2',
        )}>
          {expanded ? reply.fullBody : reply.preview}
        </p>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-primary hover:text-primary/80 font-medium mt-1 transition-colors"
        >
          {expanded ? 'Show less' : 'Show full reply'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   RepliesScreen
   ═══════════════════════════════════════════════════════════════ */
export function RepliesScreen() {
  const [activeTab, setActiveTab] = useState('all')
  const [suppressReason, setSuppressReason] = useState('')
  const [removeTarget, setRemoveTarget] = useState<SuppressedContact | null>(null)

  const filteredReplies = useMemo(() => {
    if (activeTab === 'all') return MOCK_REPLIES
    return MOCK_REPLIES.filter(r => r.classification === activeTab)
  }, [activeTab])

  const handleRemoveSuppression = () => {
    if (!removeTarget || !suppressReason.trim()) return
    toast.success(`Removed ${removeTarget.contactName} from suppression`)
    setRemoveTarget(null)
    setSuppressReason('')
  }

  return (
    <div className="space-y-6 fade-in">
      {/* ═══ Header ═══ */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
          <MessageSquare className="size-5 text-primary" />
          Replies & Bounces
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track inbound replies, bounces, and suppression management
        </p>
      </div>

      {/* ═══ Tabs ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border rounded-lg h-9 p-0.5">
          {[
            { key: 'all', label: 'All Replies', count: MOCK_REPLIES.length },
            { key: 'positive_interest', label: 'Positive', count: MOCK_REPLIES.filter(r => r.classification === 'positive_interest').length },
            { key: 'out_of_office', label: 'OOO', count: MOCK_REPLIES.filter(r => r.classification === 'out_of_office').length },
            { key: 'negative', label: 'Negative', count: MOCK_REPLIES.filter(r => r.classification === 'negative').length },
            { key: 'unsubscribe', label: 'Unsub', count: MOCK_REPLIES.filter(r => r.classification === 'unsubscribe').length },
          ].map(tab => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="text-xs rounded-md data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none h-7 px-3"
            >
              {tab.label}
              <span className="ml-1.5 text-[10px] opacity-60 tabular-nums">{tab.count}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-3">
          {filteredReplies.length === 0 ? (
            <div className="rounded-xl bg-card border border-border p-12 text-center">
              <Inbox className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No replies in this category</p>
            </div>
          ) : (
            filteredReplies.map(reply => (
              <ReplyCard key={reply.id} reply={reply} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ Bounces Section ═══ */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MailWarning className="size-4 text-red-400" />
            Bounce Events
            <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] ml-1">
              {MOCK_BOUNCES.length}
            </Badge>
          </h2>
        </div>

        <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-card">
                {['Contact', 'Type', 'Reason', 'Date', 'Auto-Suppressed'].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_BOUNCES.map((bounce, idx) => (
                <tr key={bounce.id} className={cn('border-b border-border/50 hover:bg-primary/5', idx % 2 === 1 && 'bg-secondary/20')}>
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-medium text-foreground">{bounce.contactName}</p>
                    <p className="text-[10px] text-muted-foreground">{bounce.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-md border',
                      bounce.bounceType === 'hard'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    )}>
                      {bounce.bounceType}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 max-w-[300px]">
                    <code className="text-[10px] font-mono text-muted-foreground">{bounce.reason}</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{timeAgo(bounce.date)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {bounce.autoSuppressed ? (
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-md">
                        Auto-suppressed
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Suppressions Section ═══ */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldBan className="size-4 text-purple-400" />
            Suppressed Contacts
            <Badge variant="outline" className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-[10px] ml-1">
              {MOCK_SUPPRESSIONS.length}
            </Badge>
          </h2>
        </div>

        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-card">
                {['Contact', 'Type', 'Reason', 'Date Suppressed', 'Actions'].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_SUPPRESSIONS.map((sup, idx) => (
                <tr key={sup.id} className={cn('border-b border-border/50 hover:bg-primary/5', idx % 2 === 1 && 'bg-secondary/20')}>
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-medium text-foreground">{sup.contactName}</p>
                    <p className="text-[10px] text-muted-foreground">{sup.email} &middot; {sup.company}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-md border',
                      sup.suppressionType === 'bounce_hard'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : sup.suppressionType === 'unsubscribed'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                    )}>
                      {sup.suppressionType === 'bounce_hard' ? 'Bounce (Hard)' : sup.suppressionType === 'unsubscribed' ? 'Unsubscribed' : 'Manual DNC'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 max-w-[280px]">
                    <p className="text-xs text-muted-foreground line-clamp-1">{sup.reason}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{timeAgo(sup.dateSuppressed)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Dialog open={removeTarget?.id === sup.id} onOpenChange={(open) => { if (!open) setRemoveTarget(null) }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          onClick={() => setRemoveTarget(sup)}
                        >
                          Remove
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border">
                        <DialogHeader>
                          <DialogTitle className="text-foreground">Remove from Suppression</DialogTitle>
                          <DialogDescription className="text-muted-foreground">
                            This action is <span className="text-amber-400 font-semibold">auditable</span>. A reason is required to remove {sup.contactName} from the suppression list.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Reason (required)</label>
                            <Textarea
                              value={suppressReason}
                              onChange={e => setSuppressReason(e.target.value)}
                              placeholder="e.g., Contact confirmed email is now active..."
                              className="min-h-[80px] bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/50 text-sm"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border" onClick={() => setRemoveTarget(null)}>
                            Cancel
                          </Button>
                          <Button
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            disabled={!suppressReason.trim()}
                            onClick={handleRemoveSuppression}
                          >
                            Remove from Suppression
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}