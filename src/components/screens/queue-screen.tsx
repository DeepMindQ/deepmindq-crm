'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Send, Clock, CheckCircle2, XCircle, Pause, Play, Eye,
  RotateCcw, Ban, Zap, Mail, AlertTriangle, RefreshCw, Calendar,
  SquareCheck, Square, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  PageTransition,
  StaggerGrid,
  StaggerItem,
  SectionHeader,
  PulseDot,
  StatCard,
  GlassPanel,
  AnimatedCard,
  EmptyState,
  TabBar,
} from '@/components/ui/animated-components';

interface QueueItem {
  id: string;
  contactName: string;
  contactEmail?: string;
  companyName?: string;
  subject: string;
  scheduledAt?: string;
  sentAt?: string;
  status: string;
  retryCount: number;
  failureReason?: string;
  provider?: string;
  openCount: number;
  clickCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  scheduled: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  sent: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  paused: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

const MAX_RETRIES = 3;

// E-04: Retry count visual indicators
function retryIndicator(retryCount: number, status: string): { color: string; label: string } {
  if (status !== 'failed' || retryCount === 0) return { color: '', label: '' };
  if (retryCount >= MAX_RETRIES) return { color: 'text-red-600', label: `Retry ${retryCount}/${MAX_RETRIES}` };
  if (retryCount === 1) return { color: 'text-yellow-600', label: `Retry ${retryCount}/${MAX_RETRIES}` };
  return { color: 'text-red-600', label: `Retry ${retryCount}/${MAX_RETRIES}` };
}

function failureBorderColor(retryCount: number): string {
  if (retryCount >= MAX_RETRIES) return '#7F1D1D';     // dark red — permanently failed
  if (retryCount >= 2) return '#DC2626';     // red
  if (retryCount >= 1) return '#EAB308';     // yellow
  return 'transparent';
}

const TAB_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'paused', label: 'Paused' },
];

interface QueueScreenProps {
  navigateTo?: (screen: string) => void;
}

export default function QueueScreen({ navigateTo }: QueueScreenProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [sendingAll, setSendingAll] = useState(false);
  const [workerResult, setWorkerResult] = useState<{ processed: number; sent: number; failed: number } | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk action confirmation dialog
  const [bulkAction, setBulkAction] = useState<{ action: string; label: string; ids: string[] } | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/queue');
      const data = await res.json();
      const itemsList = Array.isArray(data) ? data : data.items || [];
      setItems(itemsList.map((q: any) => ({
        id: q.id,
        contactName: q.draft?.contact?.rawName || q.contactName || '-',
        contactEmail: q.draft?.contact?.email || q.contactEmail,
        companyName: q.draft?.contact?.company?.rawName || q.companyName || '-',
        subject: q.draft?.subject || q.subject || '-',
        scheduledAt: q.scheduledAt || undefined,
        sentAt: q.sentAt || undefined,
        status: q.status,
        retryCount: q.retryCount || 0,
        failureReason: q.failureReason || undefined,
        provider: q.provider || undefined,
        openCount: q.openCount || 0,
        clickCount: q.clickCount || 0,
      })));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/queue');
        const data = await res.json();
        if (cancelled) return;
        const itemsList = Array.isArray(data) ? data : data.items || [];
        setItems(itemsList.map((q: any) => ({
          id: q.id,
          contactName: q.draft?.contact?.rawName || q.contactName || '-',
          contactEmail: q.draft?.contact?.email || q.contactEmail,
          companyName: q.draft?.contact?.company?.rawName || q.companyName || '-',
          subject: q.draft?.subject || q.subject || '-',
          scheduledAt: q.scheduledAt || undefined,
          sentAt: q.sentAt || undefined,
          status: q.status,
          retryCount: q.retryCount || 0,
          failureReason: q.failureReason || undefined,
          provider: q.provider || undefined,
          openCount: q.openCount || 0,
          clickCount: q.clickCount || 0,
        })));
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Queue PATCH action helper
  const queueAction = async (action: string, id?: string, ids?: string[]) => {
    try {
      const res = await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, ids }),
      });
      const data = await res.json();
      await load();
      return data;
    } catch {
      return null;
    }
  };

  const handlePauseAll = () => queueAction('pause');
  const handleResumeAll = () => queueAction('resume');
  const handleRetryAll = () => queueAction('retry');
  const handleCancelAll = () => queueAction('cancel');

  const handleRetryOne = (id: string) => queueAction('retry', id);
  const handlePauseOne = (id: string) => queueAction('pause', id);
  const handleResumeOne = (id: string) => queueAction('resume', id);
  const handleCancelOne = (id: string) => queueAction('cancel', id);

  // E-03: Send All Pending button (enhanced with toast)
  const handleSendAll = async () => {
    setSendingAll(true);
    setWorkerResult(null);
    try {
      const res = await fetch('/api/email-worker', { method: 'POST' });
      const data = await res.json();
      setWorkerResult(data);
      await load();
      if (data.sent > 0 || data.failed > 0) {
        toast.success(`Email worker completed: Sent ${data.sent || 0}${data.failed > 0 ? `, Failed ${data.failed}` : ''}`);
      } else {
        toast.info('No pending emails to send');
      }
    } catch {
      toast.error('Failed to start email worker');
    }
    setSendingAll(false);
  };

  // ── Bulk Selection ──
  const filtered = tab === 'all' ? items : items.filter(i => i.status === tab);

  const allVisibleSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id));
  const someVisibleSelected = filtered.some(i => selectedIds.has(i.id)) && !allVisibleSelected;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      // Deselect all visible
      const newSet = new Set(selectedIds);
      filtered.forEach(i => newSet.delete(i.id));
      setSelectedIds(newSet);
    } else {
      // Select all visible
      const newSet = new Set(selectedIds);
      filtered.forEach(i => newSet.add(i.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── Bulk Actions ──
  const selectedItems = items.filter(i => selectedIds.has(i.id));
  const selectedPending = selectedItems.filter(i => i.status === 'pending' || i.status === 'scheduled');
  const selectedPaused = selectedItems.filter(i => i.status === 'paused');
  const allFailedItems = items.filter(i => i.status === 'failed');
  const selectedCancelable = selectedItems.filter(i => ['pending', 'scheduled', 'paused'].includes(i.status));

  const openBulkAction = (action: string, label: string, ids: string[]) => {
    setBulkAction({ action, label, ids });
  };

  const executeBulkAction = async () => {
    if (!bulkAction) return;
    setBulkActionLoading(true);
    try {
      const res = await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: bulkAction.action, ids: bulkAction.ids }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${bulkAction.label} — ${bulkAction.ids.length} item${bulkAction.ids.length !== 1 ? 's' : ''} updated`);
        clearSelection();
        await load();
      } else {
        toast.error(data.error || `Failed to ${bulkAction.label.toLowerCase()}`);
      }
    } catch {
      toast.error(`Failed to ${bulkAction.label.toLowerCase()}`);
    }
    setBulkActionLoading(false);
    setBulkAction(null);
  };

  // Stats
  const pendingCount = items.filter(i => i.status === 'pending').length;
  const scheduledCount = items.filter(i => i.status === 'scheduled').length;
  const sentCount = items.filter(i => i.status === 'sent').length;
  const failedCount = items.filter(i => i.status === 'failed').length;
  const pausedCount = items.filter(i => i.status === 'paused').length;

  const tabData = TAB_OPTIONS.map(t => ({
    key: t.value,
    label: t.label,
    count: t.value === 'all' ? items.length :
      t.value === 'pending' ? pendingCount :
      t.value === 'scheduled' ? scheduledCount :
      t.value === 'sent' ? sentCount :
      t.value === 'failed' ? failedCount :
      t.value === 'paused' ? pausedCount : 0,
  }));

  return (
    <PageTransition>
      <TooltipProvider>
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1">

          {/* ── Header Banner ── */}
          <motion.div
            className="relative overflow-hidden rounded-xl"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="absolute inset-0 animate-[bannerShift_8s_ease-in-out_infinite]"
              style={{
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(139, 92, 246, 0.08), rgba(212, 175, 55, 0.15))',
                backgroundSize: '300% 300%',
              }}
            />
            <div className="relative border border-gray-200 bg-gray-50 backdrop-blur-xl rounded-xl px-6 py-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Send className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-foreground tracking-tight">Send Queue</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <span className="text-primary font-medium tabular-nums">{items.length}</span> items &middot;
                      <span className="text-emerald-600 font-medium tabular-nums ml-1">{pendingCount + scheduledCount}</span> ready to send
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <PulseDot color="#D4AF37" />
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 gap-1.5"
                    onClick={handleSendAll}
                    disabled={sendingAll || (pendingCount + scheduledCount === 0)}
                  >
                    {sendingAll ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    Send All Pending
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-amber-500/30 text-amber-600 hover:text-amber-300 hover:bg-amber-50 gap-1.5"
                    onClick={handlePauseAll}
                    disabled={pendingCount + scheduledCount === 0}
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-emerald-500/30 text-emerald-600 hover:text-emerald-300 hover:bg-emerald-50 gap-1.5"
                    onClick={handleResumeAll}
                    disabled={pausedCount === 0}
                  >
                    <Play className="w-3.5 h-3.5" />Resume All
                  </Button>
                </div>
              </div>

              {/* Worker Result Toast (E-03) */}
              <AnimatePresence>
                {workerResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="mt-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between rounded-lg bg-gray-100/50 border border-gray-200 px-4 py-3">
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">
                          Worker completed: <span className="text-foreground font-medium">{workerResult.processed}</span> processed
                        </span>
                        <span className="text-emerald-600">
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />{workerResult.sent} sent
                        </span>
                        {workerResult.failed > 0 && (
                          <span className="text-red-600">
                            <XCircle className="w-3 h-3 inline mr-1" />{workerResult.failed} failed
                          </span>
                        )}
                        {workerResult.provider && (
                          <span className="text-muted-foreground">
                            via <span className="text-primary font-medium">{workerResult.provider}</span>
                          </span>
                        )}
                      </div>
                      <button
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setWorkerResult(null)}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <style>{`
              @keyframes bannerShift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
              }
            `}</style>
          </motion.div>

          {/* ── Stat Cards ── */}
          <StaggerGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" stagger={0.06}>
            <StaggerItem>
              <StatCard label="Pending" value={pendingCount} icon={Clock} color="#3B82F6" delay={0} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Scheduled" value={scheduledCount} icon={Calendar} color="#8B5CF6" delay={0.06} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Sent" value={sentCount} icon={CheckCircle2} color="#10B981" delay={0.12} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Failed" value={failedCount} icon={XCircle} color="#EF4444" delay={0.18} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Paused" value={pausedCount} icon={Pause} color="#F59E0B" delay={0.24} />
            </StaggerItem>
          </StaggerGrid>

          {/* ── Tabs ── */}
          <GlassPanel className="p-4">
            <TabBar tabs={tabData} active={tab} onChange={(t) => { setTab(t); clearSelection(); }} />
          </GlassPanel>

          {/* ── Queue Table ── */}
          <SectionHeader
            title="Queue"
            subtitle={`${filtered.length} item${filtered.length !== 1 ? 's' : ''}${tab !== 'all' ? ` in "${tab}"` : ''}`}
          />

          <GlassPanel>
            <div className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Send}
                  title={tab !== 'all' ? `No ${tab} items` : 'No items in the send queue'}
                  description={navigateTo ? 'Review and schedule drafts to start sending.' : undefined}
                  action={navigateTo ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => navigateTo('drafts')}
                    >
                      Review pending drafts
                    </Button>
                  ) : undefined}
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        {/* Checkbox column */}
                        <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider w-10 pl-4">
                          <Checkbox
                            checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                            onCheckedChange={toggleSelectAll}
                            className="border-gray-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary"
                          />
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Contact</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider hidden sm:table-cell">Company</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Subject</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider hidden md:table-cell">Scheduled</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((item) => {
                        const ri = retryIndicator(item.retryCount, item.status);
                        const isPermanentlyFailed = item.status === 'failed' && item.retryCount >= MAX_RETRIES;
                        const borderLeftColor = item.status === 'failed' ? failureBorderColor(item.retryCount) : 'transparent';
                        const isSelected = selectedIds.has(item.id);

                        return (
                          <TableRow
                            key={item.id}
                            className={`border-border group transition-all duration-200 hover:bg-gray-50 ${isSelected ? 'bg-primary/[0.04]' : ''}`}
                            style={{ borderLeft: `3px solid ${borderLeftColor}` }}
                            onMouseEnter={(e) => {
                              if (item.status !== 'failed') {
                                (e.currentTarget as HTMLElement).style.borderLeftColor = '#D4AF37';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (item.status !== 'failed') {
                                (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                              }
                            }}
                          >
                            {/* Checkbox */}
                            <TableCell className="pl-4 w-10">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectOne(item.id)}
                                className="border-gray-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </TableCell>
                            <TableCell className="text-foreground text-sm font-medium">
                              <div className="flex items-center gap-2">
                                {item.status === 'sent' && item.openCount > 0 && (
                                  <Mail className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                                {item.contactName}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {ri.label && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] px-1.5 py-0 ${ri.color} ${isPermanentlyFailed ? 'border-red-500/30' : 'border-yellow-500/30'} gap-0.5`}
                                      >
                                        <RotateCcw className="w-2 h-2" />
                                        {ri.label}
                                        {isPermanentlyFailed && ' (max)'}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      {item.retryCount >= MAX_RETRIES
                                        ? 'Maximum retry attempts reached. Cancel and recreate to try again.'
                                        : `${MAX_RETRIES - item.retryCount} retry attempt${MAX_RETRIES - item.retryCount !== 1 ? 's' : ''} remaining`
                                      }
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{item.companyName || '-'}</TableCell>
                            <TableCell className="text-foreground text-sm max-w-[220px] truncate">
                              {item.subject}
                              {item.status === 'sent' && (item.openCount > 0 || item.clickCount > 0) && (
                                <div className="flex items-center gap-2 mt-0.5">
                                  {item.openCount > 0 && (
                                    <span className="text-[9px] text-emerald-600">{item.openCount} opens</span>
                                  )}
                                  {item.clickCount > 0 && (
                                    <span className="text-[9px] text-primary">{item.clickCount} clicks</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs hidden md:table-cell whitespace-nowrap">
                              {item.status === 'sent' && item.sentAt
                                ? `Sent ${new Date(item.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                : item.status === 'scheduled' && item.scheduledAt
                                  ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="flex items-center gap-1">
                                          <Calendar className="w-3 h-3 text-violet-600" />
                                          {new Date(item.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        Scheduled for: {new Date(item.scheduledAt).toLocaleString()}
                                      </TooltipContent>
                                    </Tooltip>
                                  )
                                  : item.status === 'pending'
                                    ? (
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-zinc-400" />
                                        Ready to send
                                      </span>
                                    )
                                    : item.status === 'paused'
                                      ? (
                                        <span className="flex items-center gap-1">
                                          <Pause className="w-3 h-3 text-amber-600" />
                                          Paused
                                        </span>
                                      )
                                      : '-'
                              }
                              {item.status === 'failed' && item.failureReason && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1 text-red-600/70 text-[10px] mt-0.5 cursor-help">
                                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                      <span className="max-w-[160px] truncate">{item.failureReason}</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs max-w-xs">
                                    <p className="font-medium text-red-300 mb-1">Failure Reason:</p>
                                    <p className="text-muted-foreground">{item.failureReason}</p>
                                    {item.retryCount > 0 && (
                                      <p className="text-muted-foreground mt-1">Retried {item.retryCount}/{MAX_RETRIES} times</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUS_COLORS[item.status] || STATUS_COLORS.pending}>
                                {item.status}
                                {item.provider && item.status === 'sent' && (
                                  <span className="ml-1 opacity-60 text-[9px]">via {item.provider}</span>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>

                                {/* E-02: Per-item actions */}
                                {item.status === 'pending' && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-amber-600 hover:text-amber-300 hover:bg-amber-50"
                                        onClick={() => handlePauseOne(item.id)}
                                      >
                                        <Pause className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Pause</TooltipContent>
                                  </Tooltip>
                                )}

                                {item.status === 'paused' && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-300 hover:bg-emerald-50"
                                        onClick={() => handleResumeOne(item.id)}
                                      >
                                        <Play className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Resume</TooltipContent>
                                  </Tooltip>
                                )}

                                {item.status === 'scheduled' && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-amber-600 hover:text-amber-300 hover:bg-amber-50"
                                        onClick={() => handlePauseOne(item.id)}
                                      >
                                        <Pause className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Pause</TooltipContent>
                                  </Tooltip>
                                )}

                                {item.status === 'failed' && !isPermanentlyFailed && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-yellow-600 hover:text-yellow-300 hover:bg-yellow-500/10"
                                        onClick={() => handleRetryOne(item.id)}
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Retry</TooltipContent>
                                  </Tooltip>
                                )}

                                {item.status === 'failed' && isPermanentlyFailed && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] bg-red-50 text-red-600/80 border-red-500/20 gap-0.5"
                                      >
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        Permanent
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Max retries reached. Cancel and recreate to send again.
                                    </TooltipContent>
                                  </Tooltip>
                                )}

                                {(item.status === 'pending' || item.status === 'scheduled' || item.status === 'paused') && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-red-600/60 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => handleCancelOne(item.id)}
                                      >
                                        <Ban className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Cancel</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </GlassPanel>

          {/* ── Floating Bulk Selection Toolbar ── */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
              >
                <GlassPanel className="px-5 py-3 border-primary/20">
                  <div className="flex items-center gap-4">
                    {/* Selection count */}
                    <div className="flex items-center gap-2 text-sm">
                      <SquareCheck className="w-4 h-4 text-primary" />
                      <span className="text-foreground font-medium tabular-nums">{selectedIds.size}</span>
                      <span className="text-muted-foreground text-xs">selected</span>
                    </div>

                    <div className="w-px h-6 bg-gray-100/50" />

                    {/* Bulk action buttons */}
                    <div className="flex items-center gap-1.5">
                      {selectedPending.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] border-amber-500/30 text-amber-600 hover:text-amber-300 hover:bg-amber-50 gap-1"
                          onClick={() => openBulkAction('pause', 'Pause Selected', selectedPending.map(i => i.id))}
                        >
                          <Pause className="w-3 h-3" />
                          Pause ({selectedPending.length})
                        </Button>
                      )}

                      {selectedPaused.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] border-emerald-500/30 text-emerald-600 hover:text-emerald-300 hover:bg-emerald-50 gap-1"
                          onClick={() => openBulkAction('resume', 'Resume Selected', selectedPaused.map(i => i.id))}
                        >
                          <Play className="w-3 h-3" />
                          Resume ({selectedPaused.length})
                        </Button>
                      )}

                      {failedCount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] border-yellow-500/30 text-yellow-600 hover:text-yellow-300 hover:bg-yellow-500/10 gap-1"
                          onClick={() => openBulkAction('retry', 'Retry All Failed', [])}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry Failed ({failedCount})
                        </Button>
                      )}

                      {selectedCancelable.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] border-red-500/30 text-red-600 hover:text-red-300 hover:bg-red-50 gap-1"
                          onClick={() => openBulkAction('cancel', 'Cancel Selected', selectedCancelable.map(i => i.id))}
                        >
                          <Ban className="w-3 h-3" />
                          Cancel ({selectedCancelable.length})
                        </Button>
                      )}
                    </div>

                    <div className="w-px h-6 bg-gray-100/50" />

                    {/* Clear selection */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={clearSelection}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Bulk Actions Footer (for failed/paused) ── */}
          {(failedCount > 0 || pausedCount > 0) && (
            <GlassPanel className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">Bulk Actions</span>
                  {' '}&middot;{' '}
                  {failedCount > 0 && <span className="text-red-600">{failedCount} failed</span>}
                  {failedCount > 0 && pausedCount > 0 && <span>, </span>}
                  {pausedCount > 0 && <span className="text-amber-600">{pausedCount} paused</span>}
                </div>
                <div className="flex items-center gap-2">
                  {failedCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-yellow-500/30 text-yellow-600 hover:text-yellow-300 hover:bg-yellow-500/10 gap-1.5"
                      onClick={handleRetryAll}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />Retry All Failed
                    </Button>
                  )}
                  {pausedCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-emerald-500/30 text-emerald-600 hover:text-emerald-300 hover:bg-emerald-50 gap-1.5"
                      onClick={handleResumeAll}
                    >
                      <Play className="w-3.5 h-3.5" />Resume All Paused
                    </Button>
                  )}
                  {(failedCount > 0 || pausedCount > 0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-red-500/30 text-red-600 hover:text-red-300 hover:bg-red-50 gap-1.5"
                      onClick={handleCancelAll}
                    >
                      <Ban className="w-3.5 h-3.5" />Cancel All Pending
                    </Button>
                  )}
                </div>
              </div>
            </GlassPanel>
          )}

          {/* ── Email Provider Status (E-01) ── */}
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                  <RefreshCw className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Email Provider</p>
                  <p className="text-[10px] text-muted-foreground">
                    Configure EMAIL_PROVIDER and EMAIL_API_KEY in environment variables
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/email/test', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                      toast.success('Email provider connection test successful');
                    } else {
                      toast.error(data.error || 'Connection test failed');
                    }
                  } catch {
                    toast.error('Connection test failed');
                  }
                }}
              >
                <Zap className="w-3.5 h-3.5" />Test Connection
              </Button>
            </div>
          </GlassPanel>

        </div>

        {/* ── Bulk Action Confirmation Dialog ── */}
        <AlertDialog open={!!bulkAction} onOpenChange={(open) => { if (!open) { setBulkAction(null); setBulkActionLoading(false); } }}>
          <AlertDialogContent className="border-gray-200 bg-[#12141E] backdrop-blur-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                {bulkAction?.label || 'Confirm Action'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                {bulkAction?.action === 'retry' && bulkAction?.ids.length === 0
                  ? `This will retry all ${failedCount} failed items in the queue. Continue?`
                  : `Are you sure you want to ${bulkAction?.action?.toLowerCase() || 'apply this action to'} ${bulkAction?.ids.length || 0} selected item${(bulkAction?.ids.length || 0) !== 1 ? 's' : ''}?`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="border-gray-200 text-muted-foreground hover:text-foreground" disabled={bulkActionLoading}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className={
                  bulkAction?.action === 'cancel'
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }
                onClick={executeBulkAction}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {bulkAction?.label || 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </PageTransition>
  );
}