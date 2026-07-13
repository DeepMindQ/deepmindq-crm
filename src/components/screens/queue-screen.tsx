'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Clock, CheckCircle2, XCircle, Pause, Play, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageTransition, AnimatedCard, StaggerGrid, StaggerItem, SectionHeader, PulseDot } from '@/components/ui/animated-components';

interface QueueItem {
  id: string;
  contactName: string;
  contactEmail?: string;
  companyName?: string;
  subject: string;
  scheduledAt?: string;
  status: string;
}

interface QueueSummary {
  pending: number;
  scheduled: number;
  sentToday: number;
  failed: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  sent: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  paused: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

interface QueueScreenProps {
  navigateTo?: (screen: string) => void;
}

export default function QueueScreen({ navigateTo }: QueueScreenProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const load = async () => {
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
          scheduledAt: q.scheduledAt ? new Date(q.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : q.scheduledAt,
          status: q.status,
        })));
        const s = Array.isArray(data) ? null : data.summary;
        setSummary(s || {
          pending: itemsList.filter((i: QueueItem) => i.status === 'pending').length,
          scheduled: itemsList.filter((i: QueueItem) => i.status === 'scheduled').length,
          sentToday: itemsList.filter((i: QueueItem) => i.status === 'sent').length,
          failed: itemsList.filter((i: QueueItem) => i.status === 'failed').length,
        });
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const togglePause = async () => {
    try {
      await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: paused ? 'resume' : 'pause' }),
      });
      setPaused(!paused);
    } catch { /* ignore */ }
  };

  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
        {/* Queue Status */}
        <SectionHeader title="Queue Status" />

        {/* Stat Cards */}
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.08}>
          <StaggerItem>
            <motion.div
              className="rounded-xl border p-[1px]"
              style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), transparent 60%)' }}
              whileHover={{ y: -3 }}
            >
              <div className="rounded-xl bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <PulseDot color="#3B82F6" />
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Pending</p>
                    </div>
                    <p className="text-xl font-bold mt-0.5 tabular-nums" style={{ color: '#D4AF37' }}>{summary?.pending ?? items.filter(i => i.status === 'pending').length}</p>
                  </div>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          </StaggerItem>

          <StaggerItem>
            <motion.div
              className="rounded-xl border p-[1px]"
              style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), transparent 60%)' }}
              whileHover={{ y: -3 }}
            >
              <div className="rounded-xl bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <PulseDot color="#8B5CF6" />
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Scheduled</p>
                    </div>
                    <p className="text-xl font-bold mt-0.5 tabular-nums" style={{ color: '#D4AF37' }}>{summary?.scheduled ?? items.filter(i => i.status === 'scheduled').length}</p>
                  </div>
                  <Send className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          </StaggerItem>

          <StaggerItem>
            <motion.div
              className="rounded-xl border p-[1px]"
              style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), transparent 60%)' }}
              whileHover={{ y: -3 }}
            >
              <div className="rounded-xl bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Sent Today</p>
                    <p className="text-xl font-bold mt-0.5 tabular-nums" style={{ color: '#D4AF37' }}>{summary?.sentToday ?? items.filter(i => i.status === 'sent').length}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            </motion.div>
          </StaggerItem>

          <StaggerItem>
            <motion.div
              className="rounded-xl border p-[1px]"
              style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), transparent 60%)' }}
              whileHover={{ y: -3 }}
            >
              <div className="rounded-xl bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Failed</p>
                    <p className="text-xl font-bold mt-0.5 tabular-nums" style={{ color: '#D4AF37' }}>{summary?.failed ?? items.filter(i => i.status === 'failed').length}</p>
                  </div>
                  <XCircle className="w-4 h-4 text-red-400" />
                </div>
              </div>
            </motion.div>
          </StaggerItem>
        </StaggerGrid>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <Send className="w-3.5 h-3.5 inline mr-1.5" />
            <span className="text-primary font-medium tabular-nums">{items.length}</span> items in queue
          </p>
          <Button
            variant={paused ? 'default' : 'outline'}
            size="sm"
            className={`h-8 text-xs ${paused ? 'bg-primary text-primary-foreground' : 'border-amber-500/30 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'}`}
            onClick={togglePause}
          >
            {paused ? (
              <><Play className="w-3.5 h-3.5 mr-1.5" />Resume All</>
            ) : (
              <><Pause className="w-3.5 h-3.5 mr-1.5" />Pause All</>
            )}
          </Button>
        </div>

        {/* Queue Table */}
        <SectionHeader title="Queue" />

        <AnimatedCard hover={false}>
          <div className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Contact</TableHead>
                      <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">Company</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Subject</TableHead>
                      <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Scheduled At</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(item => (
                      <TableRow key={item.id} className="border-border">
                        <TableCell className="text-foreground text-sm font-medium">{item.contactName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{item.companyName || '-'}</TableCell>
                        <TableCell className="text-foreground text-sm max-w-[220px] truncate">{item.subject}</TableCell>
                        <TableCell className="text-muted-foreground text-xs hidden md:table-cell whitespace-nowrap">{item.scheduledAt || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[item.status] || STATUS_COLORS.pending}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {navigateTo && (
                              <span
                                onClick={(e) => { e.stopPropagation(); navigateTo('drafts'); }}
                                className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
                              >View Draft</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground text-sm text-center py-8">
                          No items in the send queue.
                          {navigateTo && (
                            <span
                              onClick={() => navigateTo('drafts')}
                              className="ml-2 text-xs text-primary cursor-pointer hover:text-primary/80 transition-colors"
                            >Review pending drafts</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </AnimatedCard>
      </div>
    </PageTransition>
  );
}