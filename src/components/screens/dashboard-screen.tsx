'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedCard, StaggerGrid, StaggerItem, AnimatedBar, SectionHeader, PulseDot } from '@/components/ui/animated-components';
import {
  Users, FileCheck, Clock, Mail, Activity, Heart, ShieldCheck, ShieldAlert, ShieldX, HelpCircle,
  AlertTriangle, Info, Eye, ChevronRight, ArrowUpRight,
} from 'lucide-react';

interface DashboardData {
  contactsByStatus: Record<string, number>;
  totalCompanies: number;
  recentBatches: { id: string; fileName: string; totalRows: number; acceptedRows: number; status: string; createdAt: string }[];
  draftsPendingReview: number;
  queuePending: number;
  repliesThisWeek: number;
  bouncesCount: number;
  suppressionsCount: number;
  emailHealthDistribution: { valid: number; risky: number; invalid: number; unknown: number };
}

const STATUS_COLORS: Record<string, string> = {
  staged: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  processing: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  archived: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const STATUS_DOT: Record<string, string> = {
  imported: 'bg-zinc-400',
  cleaned: 'bg-blue-400',
  drafted: 'bg-amber-400',
  queued: 'bg-purple-400',
  sent: 'bg-emerald-400',
  replied: 'bg-emerald-500',
  bounced: 'bg-red-400',
  suppressed: 'bg-slate-400',
  archived: 'bg-zinc-500',
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return iso; }
}

const CLICKABLE = 'cursor-pointer hover:opacity-80 transition-opacity';

export default function DashboardScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-muted-foreground text-sm p-6">Failed to load dashboard data.</div>;
  }

  const totalLeads = Object.values(data.contactsByStatus).reduce((a, b) => a + b, 0);
  const statusBreakdown = Object.entries(data.contactsByStatus).map(([status, count]) => ({ status, count }));
  const { emailHealthDistribution: eh } = data;
  const healthTotal = eh.valid + eh.risky + eh.invalid + eh.unknown;

  // --- Pipeline Funnel Data ---
  const importedCount = (data.contactsByStatus['imported'] || 0) + (data.contactsByStatus['cleaned'] || 0) + (data.contactsByStatus['duplicate'] || 0);
  const verifiedCount = eh.valid + eh.risky;
  const draftedCount = data.contactsByStatus['drafted'] || 0;
  const inReviewCount = data.draftsPendingReview;
  const queuedCount = data.queuePending;
  const sentCount = data.contactsByStatus['sent'] || 0;
  const repliedCount = data.repliesThisWeek;

  const funnelStages = [
    { label: 'Imported', count: importedCount, color: 'bg-zinc-500' },
    { label: 'Verified', count: verifiedCount, color: 'bg-blue-500' },
    { label: 'Drafted', count: draftedCount, color: 'bg-amber-500' },
    { label: 'In Review', count: inReviewCount, color: 'bg-purple-500' },
    { label: 'Queued', count: queuedCount, color: 'bg-indigo-500' },
    { label: 'Sent', count: sentCount, color: 'bg-emerald-500' },
    { label: 'Replied', count: repliedCount, color: 'bg-green-500' },
  ];

  const funnelMax = Math.max(...funnelStages.map(s => s.count), 1);

  // --- Alerts ---
  const alerts: { icon: typeof AlertTriangle; text: string; color: string; viewScreen?: string; viewLabel?: string }[] = [];
  if (data.bouncesCount > 0) {
    alerts.push({ icon: AlertTriangle, text: `Bounce rate needs attention (${data.bouncesCount} bounces)`, color: 'bg-amber-500/10 border-amber-500/25 text-amber-400', viewScreen: 'bounces', viewLabel: 'View' });
  }
  if (data.draftsPendingReview > 5) {
    alerts.push({ icon: AlertTriangle, text: `Draft review backlog growing (${data.draftsPendingReview} pending)`, color: 'bg-amber-500/10 border-amber-500/25 text-amber-400', viewScreen: 'drafts', viewLabel: 'Review' });
  }
  if (data.queuePending > 20) {
    alerts.push({ icon: Info, text: `Large queue pending (${data.queuePending} in queue) - consider throttling`, color: 'bg-blue-500/10 border-blue-500/25 text-blue-400', viewScreen: 'queue', viewLabel: 'View' });
  }
  if (eh.invalid > 0) {
    alerts.push({ icon: ShieldX, text: `Invalid emails detected (${eh.invalid}) - consider cleanup`, color: 'bg-red-500/10 border-red-500/25 text-red-400', viewScreen: 'leads', viewLabel: 'Clean' });
  }
  if (data.suppressionsCount > 0) {
    alerts.push({ icon: ShieldAlert, text: `Suppressions active (${data.suppressionsCount}) - review periodically`, color: 'bg-zinc-500/10 border-zinc-500/25 text-zinc-400', viewScreen: 'leads', viewLabel: 'View' });
  }

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-5 pr-1">
      {/* Pipeline Funnel - Animated */}
      <AnimatedCard hover={false} className="!rounded-xl overflow-hidden">
        <div className="px-5 pt-5 pb-1">
          <SectionHeader title="Pipeline Funnel" />
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-end gap-2 h-[80px]">
            {funnelStages.map((stage, i) => {
              const widthPct = Math.max((stage.count / funnelMax) * 100, 6);
              return (
                <motion.div
                  key={stage.label}
                  className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <motion.span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: '#D4AF37' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.08 + 0.3 }}
                  >{stage.count}</motion.span>
                  <div className="w-full flex justify-center">
                    <motion.div
                      className="rounded-md"
                      style={{ height: '36px' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <div className={`w-full h-full rounded-md ${stage.color}`} style={{ opacity: 0.7 }} />
                    </motion.div>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center font-medium">{stage.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimatedCard>

      {/* Alerts - Animated */}
      {alerts.length > 0 && (
        <StaggerGrid className="space-y-2" stagger={0.08}>
          {alerts.map((alert, i) => (
            <StaggerItem key={i}>
              <motion.div
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${alert.color}`}
                whileHover={{ x: 2 }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <alert.icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-medium truncate">{alert.text}</span>
                </div>
                {alert.viewScreen && navigateTo && (
                  <motion.button
                    onClick={() => navigateTo(alert.viewScreen!)}
                    className="flex items-center gap-1 text-xs font-medium shrink-0 hover:underline ml-3"
                    whileHover={{ x: 2 }}
                  >
                    {alert.viewLabel || 'View'}
                    <ArrowUpRight className="w-3 h-3" />
                  </motion.button>
                )}
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}

      {/* Stat Cards - Staggered with gradients */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.08}>
        {[
          { label: 'Total Leads', value: totalLeads, icon: Users, screen: undefined, gradient: 'gold' },
          { label: 'Ready for Review', value: data.draftsPendingReview, icon: FileCheck, screen: 'drafts', gradient: 'purple' },
          { label: 'In Queue', value: data.queuePending, icon: Clock, screen: 'queue', gradient: 'blue' },
          { label: 'Replies This Week', value: data.repliesThisWeek, icon: Mail, screen: 'replies', gradient: 'green' },
        ].map(s => (
          <StaggerItem key={s.label}>
            <motion.div
              className="rounded-xl border p-[1px] cursor-default"
              style={{
                background: `linear-gradient(135deg, ${
                  s.gradient === 'gold' ? 'rgba(212,175,55,0.15)' :
                  s.gradient === 'blue' ? 'rgba(59,130,246,0.15)' :
                  s.gradient === 'green' ? 'rgba(16,185,129,0.15)' :
                  'rgba(139,92,246,0.15)'
                }, transparent 60%)`,
              }}
              whileHover={{ y: -3 }}
              onClick={() => s.screen && navigateTo?.(s.screen)}
            >
              <div className="rounded-xl bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">{s.label}</p>
                    <p className="text-2xl font-bold tabular-nums mt-1.5" style={{ color: '#D4AF37' }}>{s.value.toLocaleString()}</p>
                  </div>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{
                      background: s.gradient === 'gold' ? 'rgba(212,175,55,0.12)' :
                        s.gradient === 'blue' ? 'rgba(59,130,246,0.12)' :
                        s.gradient === 'green' ? 'rgba(16,185,129,0.12)' :
                        'rgba(139,92,246,0.12)',
                    }}
                  >
                    <s.icon className="w-5 h-5" style={{
                      color: s.gradient === 'gold' ? '#D4AF37' :
                             s.gradient === 'blue' ? '#3B82F6' :
                             s.gradient === 'green' ? '#10B981' : '#8B5CF6',
                    }} />
                  </div>
                </div>
              </div>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerGrid>

      {/* Recent Batches + Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatedCard hover={false} className="!rounded-xl">
          <div className="px-5 pt-5 pb-1">
            <SectionHeader title="Recent Batches" />
          </div>
          <div className="px-5 pb-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Filename</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Rows</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Accepted</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentBatches.map(b => (
                  <TableRow key={b.id} className="border-border">
                    <TableCell className="text-foreground text-sm font-medium max-w-[160px] truncate">{b.fileName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm text-right tabular-nums">{b.totalRows}</TableCell>
                    <TableCell className="text-foreground text-sm text-right tabular-nums">{b.acceptedRows}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[b.status] || ''}>
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs text-right whitespace-nowrap">{fmtDate(b.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {data.recentBatches.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground text-sm text-center py-6">No batches yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </AnimatedCard>

        <AnimatedCard hover={false} className="!rounded-xl">
          <div className="px-5 pt-5 pb-1">
            <SectionHeader title="Lead Status" />
          </div>
          <div className="px-5 pb-5">
            <div className="space-y-2.5">
              {statusBreakdown.map(s => (
                <motion.div
                  key={s.status}
                  className="flex items-center justify-between py-1.5"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s.status] || 'bg-zinc-500'}`} />
                    <span className="text-sm text-foreground capitalize">{s.status.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: '#D4AF37' }}>{s.count.toLocaleString()}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* Email Health - Enhanced */}
      <AnimatedCard hover={false} className="!rounded-xl">
        <div className="px-5 pt-5 pb-1">
          <SectionHeader title="Email Health" />
        </div>
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              { key: 'valid', label: 'Valid', icon: ShieldCheck, color: 'bg-emerald-400' },
              { key: 'risky', label: 'Risky', icon: ShieldAlert, color: 'bg-amber-400' },
              { key: 'invalid', label: 'Invalid', icon: ShieldX, color: 'bg-red-400' },
              { key: 'unknown', label: 'Unknown', icon: HelpCircle, color: 'bg-zinc-500' },
            ] as const).map((h, i) => {
              const count = eh[h.key];
              const pct = healthTotal > 0 ? (count / healthTotal) * 100 : 0;
              const barColor = h.key === 'valid' ? '#10B981' : h.key === 'risky' ? '#F59E0B' : h.key === 'invalid' ? '#EF4444' : '#71717A';
              return (
                <div key={h.key} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h.icon className="w-3.5 h-3.5" style={{ color: barColor }} />
                      <span className="text-sm text-foreground">{h.label}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: barColor }}>{count}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: barColor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AnimatedCard>

      {/* Quick Counts - Gradient border */}
      <StaggerGrid className="grid grid-cols-3 gap-4" stagger={0.08}>
        <StaggerItem>
          <motion.div
            className="rounded-xl border p-[1px] cursor-pointer"
            style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12), transparent 60%)' }}
            whileHover={{ y: -2 }}
            onClick={() => navigateTo?.('bounces')}
          >
            <div className="rounded-xl bg-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <ShieldX className="w-4 h-4" style={{ color: '#EF4444' }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bounces</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{data.bouncesCount}</p>
              </div>
            </div>
          </motion.div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-xl border p-[1px]" style={{ background: 'linear-gradient(135deg, rgba(113,113,122,0.1), transparent 60%)' }}>
            <div className="rounded-xl bg-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(113,113,122,0.1)' }}>
                <ShieldAlert className="w-4 h-4" style={{ color: '#71717A' }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Suppressions</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{data.suppressionsCount}</p>
              </div>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <motion.div
            className="rounded-xl border p-[1px] cursor-pointer"
            style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.12), transparent 60%)' }}
            whileHover={{ y: -2 }}
            onClick={() => navigateTo?.('companies')}
          >
            <div className="rounded-xl bg-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.12)' }}>
                <Activity className="w-4 h-4" style={{ color: '#D4AF37' }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Companies</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{data.totalCompanies}</p>
              </div>
            </div>
          </motion.div>
        </StaggerItem>
      </StaggerGrid>
    </div>
  );
}