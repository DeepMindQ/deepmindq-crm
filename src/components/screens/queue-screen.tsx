'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Clock, CheckCircle2, XCircle, Pause, Play, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
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
} from '@/components/ui/animated-components';

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

  const pendingCount = summary?.pending ?? items.filter(i => i.status === 'pending').length;
  const scheduledCount = summary?.scheduled ?? items.filter(i => i.status === 'scheduled').length;
  const sentTodayCount = summary?.sentToday ?? items.filter(i => i.status === 'sent').length;
  const failedCount = summary?.failed ?? items.filter(i => i.status === 'failed').length;

  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1">
        {/* Animated Gradient Header Banner */}
        <motion.div
          className="relative overflow-hidden rounded-xl"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="absolute inset-0 animate-[bannerShift_8s_ease-in-out_infinite]"
            style={{
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.08), rgba(212, 175, 55, 0.15))',
              backgroundSize: '300% 300%',
            }}
          />
          <div className="relative border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl rounded-xl px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {paused ? (
                    <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                      <Pause className="w-5 h-5 text-amber-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Send className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-bold text-foreground tracking-tight">
                      {paused ? 'Queue Paused' : 'Send Queue'}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <span className="text-primary font-medium tabular-nums">{items.length}</span> items
                      {!paused && ' processing'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!paused && <PulseDot color="#D4AF37" />}
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
            </div>
          </div>
          <style>{`
            @keyframes bannerShift {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
          `}</style>
        </motion.div>

        {/* Stat Cards */}
        <SectionHeader title="Queue Status" />

        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.08}>
          <StaggerItem>
            <StatCard
              label="Pending"
              value={pendingCount}
              icon={Clock}
              color="#3B82F6"
              delay={0}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Scheduled"
              value={scheduledCount}
              icon={Send}
              color="#8B5CF6"
              delay={0.08}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Sent Today"
              value={sentTodayCount}
              icon={CheckCircle2}
              color="#10B981"
              delay={0.16}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Failed"
              value={failedCount}
              icon={XCircle}
              color="#EF4444"
              delay={0.24}
            />
          </StaggerItem>
        </StaggerGrid>

        {/* Queue Table */}
        <SectionHeader title="Queue" />

        <GlassPanel>
          <div className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Send}
                title="No items in the send queue."
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
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider hidden md:table-cell">Scheduled At</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow
                        key={item.id}
                        className="border-border group transition-all duration-200 hover:bg-white/[0.03]"
                        style={{ borderLeft: '3px solid transparent' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderLeftColor = '#D4AF37';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                        }}
                      >
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
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </PageTransition>
  );
}