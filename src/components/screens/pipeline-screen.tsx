'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Upload, ShieldCheck, FileText, CheckCircle2, Clock,
  Send, Mail, Ban, ChevronRight, ArrowRight,
  UploadCloud, MailCheck, FileCheck,
  Layers, TrendingUp, AlertTriangle,
} from 'lucide-react';
import {
  KPICard, GlassPanel, SectionHeader, ScreenSkeleton,
  EmptyScreenState, ProgressBar, GoldButton,
} from '@/components/shared/enterprise-components';
import {
  gold, goldLight, card, border, glassPanel,
  animations, colors, spacing, cls,
} from '@/components/shared/enterprise-theme';
import { useAppStore } from '@/lib/store';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
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

interface PipelineStage {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  color: string;
  barBg: string;
  barFill: string;
  dotColor: string;
  iconBg: string;
  sublabel?: string;
  badge?: string;
  badgeBg: string;
  badgeText: string;
  navHint?: string;
  navScreen?: string;
}

/* ═══════════════════════════════════════════════════
   Stage Palette — consistent color tokens
   ═══════════════════════════════════════════════════ */
const PALETTE: Record<string, { color: string; bg: string; fill: string }> = {
  import:     { color: '#71717A', bg: 'rgba(113,113,122,0.08)',  fill: '#A1A1AA' },
  verified:   { color: '#3B82F6', bg: 'rgba(59,130,246,0.10)',   fill: '#3B82F6' },
  drafted:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',   fill: '#F59E0B' },
  approved:   { color: '#A855F7', bg: 'rgba(168,85,247,0.10)',   fill: '#A855F7' },
  queued:     { color: '#6366F1', bg: 'rgba(99,102,241,0.10)',   fill: '#6366F1' },
  sent:       { color: '#10B981', bg: 'rgba(16,185,129,0.10)',   fill: '#10B981' },
  replied:    { color: '#D4AF37', bg: 'rgba(212,175,55,0.10)',    fill: '#D4AF37' },
  bounced:    { color: '#EF4444', bg: 'rgba(239,68,68,0.10)',    fill: '#EF4444' },
  suppressed: { color: '#71717A', bg: 'rgba(113,113,122,0.08)',   fill: '#A1A1AA' },
};

function pct(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function rate(part: number, whole: number) {
  if (whole === 0) return '0%';
  return ((part / whole) * 100).toFixed(1) + '%';
}

/* ═══════════════════════════════════════════════════
   Pipeline Screen
   ═══════════════════════════════════════════════════ */
export default function PipelineScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const nav = navigateTo || ((screen: string) => useAppStore.getState().setActiveView(screen as any));

  /* ── Data fetching ── */
  const { data: dashData, isLoading } = useQuery<DashboardData>({
    queryKey: ['pipeline-dashboard'],
    queryFn: () => fetch('/api/dashboard').then(r => r.json()),
    staleTime: 30000,
  });

  const { data: leadsData } = useQuery<{ total: number }>({
    queryKey: ['pipeline-leads-count'],
    queryFn: () => fetch('/api/leads?limit=1').then(r => r.json()),
    staleTime: 60000,
  });

  /* ── Loading ── */
  if (isLoading) return <ScreenSkeleton kpiCount={4} panels={3} />;

  if (!dashData) return (
    <div className="text-muted-foreground text-sm p-6">Failed to load pipeline data.</div>
  );

  /* ── Compute stages ── */
  const { contactsByStatus: cbs, emailHealthDistribution: eh, draftsPendingReview, queuePending, repliesThisWeek, bouncesCount, suppressionsCount } = dashData;

  const importedCount = leadsData?.total || Object.values(cbs).reduce((a: number, b: number) => a + b, 0);
  const verifiedCount = cbs['cleaned'] || 0;
  const validEmails = eh?.valid || 0;
  const riskyEmails = eh?.risky || 0;
  const invalidEmails = eh?.invalid || 0;
  const emailTotal = validEmails + riskyEmails + invalidEmails + (eh?.unknown || 0);
  const draftedCount = cbs['drafted'] || 0;
  const approvedCount = Math.max(0, draftedCount - draftsPendingReview);
  const queuedCount = queuePending;
  const sentCount = cbs['sent'] || 0;
  const repliedCount = cbs['replied'] || 0;
  const bouncedCount = bouncesCount;
  const suppressedCount = suppressionsCount;
  const batchesCount = dashData.recentBatches?.length || 0;

  const deliveryRate = sentCount > 0 ? rate(sentCount - bouncedCount, sentCount) : '-';
  const replyRate = sentCount > 0 ? rate(repliedCount, sentCount) : '-';
  const bounceRate = sentCount > 0 ? rate(bouncedCount, sentCount) : '-';

  const stages: PipelineStage[] = [
    { key: 'import', label: 'Import', icon: Upload, count: importedCount, ...PALETTE.import, barBg: 'rgba(113,113,122,0.06)', barFill: PALETTE.import.fill, dotColor: '#A1A1AA', iconBg: PALETTE.import.bg, sublabel: `${batchesCount} batches processed`, navHint: 'Go to Import', navScreen: 'import', badgeBg: '', badgeText: '' },
    { key: 'verified', label: 'Email Verified', icon: ShieldCheck, count: verifiedCount, ...PALETTE.verified, barBg: 'rgba(59,130,246,0.06)', barFill: PALETTE.verified.fill, dotColor: '#60A5FA', iconBg: PALETTE.verified.bg, sublabel: `${validEmails} valid, ${riskyEmails} risky, ${invalidEmails} invalid`, navHint: 'Go to Leads', navScreen: 'leads', badgeBg: '', badgeText: '' },
    { key: 'drafted', label: 'Drafted', icon: FileText, count: draftedCount, ...PALETTE.drafted, barBg: 'rgba(245,158,11,0.06)', barFill: PALETTE.drafted.fill, dotColor: '#FBBF24', iconBg: PALETTE.drafted.bg, sublabel: 'AI-generated drafts', navHint: 'Go to Email Studio', navScreen: 'email-studio', badge: `${draftsPendingReview} pending`, badgeBg: 'rgba(245,158,11,0.12)', badgeText: '#D97706' },
    { key: 'approved', label: 'Approved', icon: CheckCircle2, count: approvedCount, ...PALETTE.approved, barBg: 'rgba(168,85,247,0.06)', barFill: PALETTE.approved.fill, dotColor: '#C084FC', iconBg: PALETTE.approved.bg, sublabel: 'Ready to send', navHint: 'Go to Email Studio', navScreen: 'email-studio', badgeBg: '', badgeText: '' },
    { key: 'queued', label: 'Queued', icon: Clock, count: queuedCount, ...PALETTE.queued, barBg: 'rgba(99,102,241,0.06)', barFill: PALETTE.queued.fill, dotColor: '#818CF8', iconBg: PALETTE.queued.bg, sublabel: 'In send queue', navHint: 'Go to Queue', navScreen: 'queue', badgeBg: '', badgeText: '' },
    { key: 'sent', label: 'Sent', icon: Send, count: sentCount, ...PALETTE.sent, barBg: 'rgba(16,185,129,0.06)', barFill: PALETTE.sent.fill, dotColor: '#34D399', iconBg: PALETTE.sent.bg, sublabel: 'Emails delivered', navHint: 'Go to Queue', navScreen: 'queue', badge: `${deliveryRate} delivery`, badgeBg: 'rgba(16,185,129,0.12)', badgeText: '#059669' },
    { key: 'replied', label: 'Replied', icon: Mail, count: repliedCount, ...PALETTE.replied, barBg: 'rgba(212,175,55,0.06)', barFill: PALETTE.replied.fill, dotColor: '#D4AF37', iconBg: PALETTE.replied.bg, sublabel: `${repliesThisWeek} this week`, navHint: 'Go to Replies', navScreen: 'inbox', badge: `${replyRate} reply rate`, badgeBg: 'rgba(212,175,55,0.12)', badgeText: '#B8960C' },
    { key: 'bounced', label: 'Bounced', icon: Ban, count: bouncedCount, ...PALETTE.bounced, barBg: 'rgba(239,68,68,0.06)', barFill: PALETTE.bounced.fill, dotColor: '#EF4444', iconBg: PALETTE.bounced.bg, sublabel: 'Failed deliveries', navHint: 'Go to Bounces', navScreen: 'bounces', badge: `${bounceRate} bounce rate`, badgeBg: 'rgba(239,68,68,0.12)', badgeText: '#DC2626' },
    { key: 'suppressed', label: 'Suppressed', icon: Ban, count: suppressedCount, ...PALETTE.suppressed, barBg: 'rgba(113,113,122,0.04)', barFill: PALETTE.suppressed.fill, dotColor: '#A1A1AA', iconBg: PALETTE.suppressed.bg, sublabel: 'Excluded contacts', navHint: 'Go to Bounces', navScreen: 'bounces', badgeBg: '', badgeText: '' },
  ];

  const maxCount = Math.max(1, ...stages.map(s => s.count));

  /* ═══════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════ */
  return (
    <div className={cls.scrollContainer} style={spacing.sectionGap as React.CSSProperties}>

      {/* ═══════ HERO BANNER ═══════ */}
      <motion.div
        {...animations.fadeIn}
        className="relative rounded-xl overflow-hidden"
        style={{ ...glassPanel, border: `1px solid rgba(212,175,55,0.2)` }}>
        {/* Background accents */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, transparent 40%, rgba(59,130,246,0.06) 70%, transparent 100%)' }}
        />
        <div className="relative px-6 py-6 sm:py-8 flex items-center justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(212,175,55,0.15)', boxShadow: '0 0 16px rgba(212,175,55,0.12)' }}>
                <span style={{ color: gold }}><Layers className="w-5 h-5" /></span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Outreach Pipeline</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Visual funnel from import to reply</p>
              </div>
            </div>
            <div className="flex items-baseline gap-3 pl-1">
              <span className="text-4xl sm:text-5xl font-black tabular-nums text-foreground tracking-tighter">
                {importedCount.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">total leads in pipeline</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />
              {sentCount.toLocaleString()} sent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: '#D4AF37', boxShadow: '0 0 8px rgba(212,175,55,0.5)' }} />
              {repliedCount.toLocaleString()} replied
            </span>
          </div>
        </div>
      </motion.div>

      {/* ═══════ KEY METRICS ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Send} label="Delivery Rate" value={deliveryRate} accentColor="#10B981" delay={0} />
        <KPICard icon={Mail} label="Reply Rate" value={replyRate} accentColor={gold} delay={0.06} />
        <KPICard icon={AlertTriangle} label="Bounce Rate" value={bounceRate} accentColor="#EF4444" delay={0.12} />
        <KPICard icon={TrendingUp} label="Conversion" value={importedCount > 0 ? rate(repliedCount, importedCount) : '0%'} accentColor="#6366F1" delay={0.18} />
      </div>

      {/* ═══════ PIPELINE FUNNEL ═══════ */}
      <GlassPanel animate delay={0.15}>
        <div className="px-5 pt-5 pb-2">
          <SectionHeader title="Pipeline Funnel" subtitle="Stage-by-stage volume from import through response tracking" />
        </div>
        <div className="px-5 pb-5 pt-2 flex flex-col gap-2">
          {stages.map((stage, idx) => {
            const w = Math.max(pct(stage.count, maxCount), 4);
            const funnelPct = pct(stage.count, importedCount);
            const Icon = stage.icon;
            return (
              <div key={stage.key}>
                <motion.div
                  className="flex items-center gap-3"
                  {...animations.slideIn('left')}
                  transition={{ duration: 0.5, delay: 0.2 + idx * 0.06, ease: [0.22, 1, 0.36, 1] }}>
                  {/* Label */}
                  <div className="w-28 sm:w-32 shrink-0 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: stage.iconBg }}>
                      <span style={{ color: stage.color }}><Icon className="w-3.5 h-3.5" /></span>
                    </div>
                    <span className="text-[11px] font-medium text-foreground truncate">{stage.label}</span>
                  </div>
                  {/* Bar */}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-8 rounded-md overflow-hidden" style={{ background: stage.barBg }}>
                      <motion.div
                        className="h-full rounded-md flex items-center px-3"
                        style={{ background: `linear-gradient(90deg, ${stage.barFill}CC, ${stage.barFill})` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${w}%` }}
                        transition={{ duration: 0.7, delay: 0.3 + idx * 0.06, ease: [0.22, 1, 0.36, 1] }}>
                        <span className="text-xs font-bold text-white/90 tabular-nums whitespace-nowrap">
                          {stage.count.toLocaleString()}
                        </span>
                      </motion.div>
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums w-12 text-right" style={{ color: stage.color }}>
                      {funnelPct}%
                    </span>
                  </div>
                </motion.div>
                {/* Connector */}
                {idx < stages.length - 1 && (
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="w-28 sm:w-32" />
                    <div className="flex-1 flex justify-center">
                      <span style={{ color: 'rgba(0,0,0,0.12)' }}><ChevronRight className="w-3 h-3" /></span>
                    </div>
                    <div className="w-12" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassPanel>

      {/* ═══════ STAGE BREAKDOWN GRID ═══════ */}
      <GlassPanel animate delay={0.3}>
        <div className="px-5 pt-5 pb-3">
          <SectionHeader title="Stage Breakdown" subtitle="Detailed metrics for each pipeline stage" />
        </div>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stages.map((stage, i) => {
              const Icon = stage.icon;
              const funnelPct = pct(stage.count, importedCount);
              return (
                <motion.div
                  key={stage.key}
                  {...animations.stagger(i)}
                  className="rounded-lg p-3 cursor-pointer group transition-all duration-300"
                  style={{ background: 'rgba(0,0,0,0.015)', border: `1px solid ${border}` }}
                  onClick={() => stage.navScreen && nav(stage.navScreen)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: stage.iconBg }}>
                        <span style={{ color: stage.color }}><Icon className="w-4 h-4" /></span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">{stage.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">{stage.sublabel}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity mt-2 shrink-0" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-foreground tabular-nums">{stage.count.toLocaleString()}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{funnelPct}% of total</span>
                  </div>
                  <ProgressBar value={funnelPct} max={100} color={stage.color} height={6} delay={0.4 + i * 0.04} showLabel={false} />
                  {stage.badge && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-[10px]" style={{ background: stage.badgeBg, color: stage.badgeText, borderColor: stage.badgeBg }}>
                        {stage.badge}
                      </Badge>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </GlassPanel>

      {/* ═══════ EMAIL VERIFICATION ═══════ */}
      <GlassPanel animate delay={0.4}>
        <div className="px-5 pt-5 pb-3">
          <SectionHeader title="Email Verification" subtitle="Distribution of email validity across your contact database" />
        </div>
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { key: 'valid', label: 'Valid', color: '#10B981', icon: MailCheck },
              { key: 'risky', label: 'Risky', color: '#F59E0B', icon: AlertTriangle },
              { key: 'invalid', label: 'Invalid', color: '#EF4444', icon: Ban },
              { key: 'unknown', label: 'Unknown', color: '#71717A', icon: ShieldCheck },
            ].map((item, idx) => {
              const count = (eh as Record<string, number>)?.[item.key] || 0;
              const itemPct = pct(count, emailTotal);
              const ItemIcon = item.icon;
              return (
                <div key={item.key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${item.color}15` }}>
                        <span style={{ color: item.color }}><ItemIcon className="w-4 h-4" /></span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </div>
                    <span className="text-lg font-bold tabular-nums" style={{ color: item.color }}>
                      {count.toLocaleString()}
                    </span>
                  </div>
                  <ProgressBar value={itemPct} max={100} color={item.color} height={8} delay={0.5 + idx * 0.1} showLabel={false} />
                  <p className="text-[10px] text-muted-foreground tabular-nums">{itemPct}% of verified</p>
                </div>
              );
            })}
          </div>
        </div>
      </GlassPanel>

      {/* ═══════ QUICK ACTIONS ═══════ */}
      <GlassPanel animate delay={0.5}>
        <div className="px-5 pt-5 pb-3">
          <SectionHeader title="Quick Actions" subtitle="Common pipeline operations" />
        </div>
        <div className="px-5 pb-5">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline" size="sm"
              className="h-9 gap-2 text-xs font-medium"
              style={{ background: 'rgba(113,113,122,0.06)', border: `1px solid ${border}` }}
              onClick={() => nav('import')}>
              <UploadCloud className="w-3.5 h-3.5" /> Upload New List
            </Button>
            <Button
              variant="outline" size="sm"
              className="h-9 gap-2 text-xs font-medium"
              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
              onClick={() => nav('leads')}>
              <ShieldCheck className="w-3.5 h-3.5" /> Verify All Emails
            </Button>
            <Button
              variant="outline" size="sm"
              className="h-9 gap-2 text-xs font-medium"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
              onClick={() => nav('email-studio')}>
              <FileCheck className="w-3.5 h-3.5" /> Review Pending Drafts
              {draftsPendingReview > 0 && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0" style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706', borderColor: 'rgba(245,158,11,0.2)' }}>
                  {draftsPendingReview}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
