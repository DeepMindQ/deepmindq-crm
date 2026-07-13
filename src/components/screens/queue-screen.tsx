'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Send, Clock, CheckCircle2, XCircle, Pause, Play, Eye,
  RotateCcw, Ban, Zap, Mail, AlertTriangle, RefreshCw, Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

// E-04: Retry count visual indicators
function retryIndicator(retryCount: number, status: string): { color: string; label: string } {
  if (status !== 'failed' || retryCount === 0) return { color: '', label: '' };
  if (retryCount === 1) return { color: 'text-yellow-400', label: 'Retry 1' };
  if (retryCount >= 2) return { color: 'text-red-400', label: `Retry ${retryCount}` };
  return { color: '', label: '' };
}

function failureBorderColor(retryCount: number): string {
  if (retryCount >= 3) return '#7F1D1D';     // dark red — permanently failed
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

  // E-03: Send All Pending button
  const handleSendAll = async () => {
    setSendingAll(true);
    setWorkerResult(null);
    try {
      const res = await fetch('/api/email-worker', { method: 'POST' });
      const data = await res.json();
      setWorkerResult(data);
      await load();
    } catch { /* ignore */ }
    setSendingAll(false);
  };

  // Filtered items
  const filtered = tab === 'all' ? items : items.filter(i => i.status === tab);

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
          <div className="relative border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl rounded-xl px-6 py-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground tracking-tight">Send Queue</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    <span className="text-primary font-medium tabular-nums">{items.length}</span> items &middot;
                    <span className="text-emerald-400 font-medium tabular-nums ml-1">{pendingCount + scheduledCount}</span> ready to send
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
                    <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  Send All Pending
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-amber-500/30 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1.5"
                  onClick={handlePauseAll}
                  disabled={pendingCount + scheduledCount === 0}
                >
                  <Pause className="w-3.5 h-3.5" />Pause All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1.5"
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
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/[0.08] px-4 py-3">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground">
                        Worker completed: <span className="text-foreground font-medium">{workerResult.processed}</span> processed
                      </span>
                      <span className="text-emerald-400">
                        <CheckCircle2 className="w-3 h-3 inline mr-1" />{workerResult.sent} sent
                      </span>
                      {workerResult.failed > 0 && (
                        <span className="text-red-400">
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
          <TabBar tabs={tabData} active={tab} onChange={setTab} />
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
                      const isPermanentlyFailed = item.status === 'failed' && item.retryCount >= 3;
                      const borderLeftColor = item.status === 'failed' ? failureBorderColor(item.retryCount) : 'transparent';

                      return (
                        <TableRow
                          key={item.id}
                          className="border-border group transition-all duration-200 hover:bg-white/[0.03]"
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
                          <TableCell className="text-foreground text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {item.status === 'sent' && item.openCount > 0 && (
                                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                              {item.contactName}
                            </div>
                            {ri.label && (
                              <span className={`text-[10px] font-medium ${ri.color}`}>
                                {ri.label} {isPermanentlyFailed && '(permanent)'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{item.companyName || '-'}</TableCell>
                          <TableCell className="text-foreground text-sm max-w-[220px] truncate">
                            {item.subject}
                            {item.status === 'sent' && (item.openCount > 0 || item.clickCount > 0) && (
                              <div className="flex items-center gap-2 mt-0.5">
                                {item.openCount > 0 && (
                                  <span className="text-[9px] text-emerald-400">{item.openCount} opens</span>
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
                                ? new Date(item.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : '-'
                            }
                            {item.status === 'failed' && item.failureReason && (
                              <span className="block text-red-400/70 text-[10px] mt-0.5 max-w-[180px] truncate" title={item.failureReason}>
                                {item.failureReason}
                              </span>
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                  onClick={() => handlePauseOne(item.id)}
                                  title="Pause"
                                >
                                  <Pause className="w-3.5 h-3.5" />
                                </Button>
                              )}

                              {item.status === 'paused' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                  onClick={() => handleResumeOne(item.id)}
                                  title="Resume"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </Button>
                              )}

                              {item.status === 'scheduled' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                  onClick={() => handlePauseOne(item.id)}
                                  title="Pause"
                                >
                                  <Pause className="w-3.5 h-3.5" />
                                </Button>
                              )}

                              {item.status === 'failed' && !isPermanentlyFailed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                                  onClick={() => handleRetryOne(item.id)}
                                  title="Retry"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )}

                              {item.status === 'failed' && isPermanentlyFailed && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] bg-red-500/10 text-red-400/80 border-red-500/20 gap-0.5"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  Permanent
                                </Badge>
                              )}

                              {(item.status === 'pending' || item.status === 'scheduled' || item.status === 'paused') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                                  onClick={() => handleCancelOne(item.id)}
                                  title="Cancel"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
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

        {/* ── Bulk Actions Footer (for failed/paused) ── */}
        {(failedCount > 0 || pausedCount > 0) && (
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">Bulk Actions</span>
                {' '}&middot;{' '}
                {failedCount > 0 && <span className="text-red-400">{failedCount} failed</span>}
                {failedCount > 0 && pausedCount > 0 && <span>, </span>}
                {pausedCount > 0 && <span className="text-amber-400">{pausedCount} paused</span>}
              </div>
              <div className="flex items-center gap-2">
                {failedCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-yellow-500/30 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 gap-1.5"
                    onClick={handleRetryAll}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />Retry All Failed
                  </Button>
                )}
                {pausedCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1.5"
                    onClick={handleResumeAll}
                  >
                    <Play className="w-3.5 h-3.5" />Resume All Paused
                  </Button>
                )}
                {(failedCount > 0 || pausedCount > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5"
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
                    setWorkerResult({ processed: 0, sent: 1, failed: 0 });
                  }
                } catch { /* ignore */ }
              }}
            >
              <Zap className="w-3.5 h-3.5" />Test Connection
            </Button>
          </div>
        </GlassPanel>

      </div>
    </PageTransition>
  );
}