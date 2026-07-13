'use client';

import { useState, useEffect } from 'react';
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
  PageTransition, AnimatedCard, StaggerGrid, StaggerItem,
  SectionHeader, GlassPanel, StatCard, AnimatedCounter,
  ShimmerText, GradientCard,
} from '@/components/ui/animated-components';

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
  _demo?: boolean;
}

interface PipelineStage {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  color?: string;
  barBg: string;
  barFill: string;
  dotColor: string;
  iconColor: string;
  accentBg?: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  navHint?: string;
}

/* ═══════════════════════════════════════════════════
   Stage color palette
   ═══════════════════════════════════════════════════ */
const STAGE_PALETTE = {
  import: {
    barBg: 'bg-zinc-500/10',
    barFill: 'bg-zinc-500',
    dotColor: 'bg-zinc-400',
    iconColor: 'text-zinc-400',
    accentBg: 'bg-zinc-500/15',
  },
  verified: {
    barBg: 'bg-blue-500/10',
    barFill: 'bg-blue-500',
    dotColor: 'bg-blue-400',
    iconColor: 'text-blue-400',
    accentBg: 'bg-blue-500/15',
  },
  drafted: {
    barBg: 'bg-amber-500/10',
    barFill: 'bg-amber-500',
    dotColor: 'bg-amber-400',
    iconColor: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
  },
  approved: {
    barBg: 'bg-purple-500/10',
    barFill: 'bg-purple-500',
    dotColor: 'bg-purple-400',
    iconColor: 'text-purple-400',
    accentBg: 'bg-purple-500/15',
  },
  queued: {
    barBg: 'bg-indigo-500/10',
    barFill: 'bg-indigo-500',
    dotColor: 'bg-indigo-400',
    iconColor: 'text-indigo-400',
    accentBg: 'bg-indigo-500/15',
  },
  sent: {
    barBg: 'bg-emerald-500/10',
    barFill: 'bg-emerald-500',
    dotColor: 'bg-emerald-400',
    iconColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
  },
  replied: {
    barBg: 'bg-green-500/10',
    barFill: 'bg-green-500',
    dotColor: 'bg-green-400',
    iconColor: 'text-green-400',
    accentBg: 'bg-green-500/15',
  },
  bounced: {
    barBg: 'bg-red-500/10',
    barFill: 'bg-red-500',
    dotColor: 'bg-red-400',
    iconColor: 'text-red-400',
    accentBg: 'bg-red-500/15',
  },
  suppressed: {
    barBg: 'bg-slate-500/10',
    barFill: 'bg-slate-500',
    dotColor: 'bg-slate-400',
    iconColor: 'text-slate-400',
    accentBg: 'bg-slate-500/15',
  },
} as const;

const STAGE_GLOW_COLORS: Record<string, string> = {
  import: 'rgba(161, 161, 170, 0.35)',
  verified: 'rgba(59, 130, 246, 0.35)',
  drafted: 'rgba(245, 158, 11, 0.35)',
  approved: 'rgba(168, 85, 247, 0.35)',
  queued: 'rgba(99, 102, 241, 0.35)',
  sent: 'rgba(16, 185, 129, 0.35)',
  replied: 'rgba(34, 197, 94, 0.35)',
  bounced: 'rgba(239, 68, 68, 0.35)',
  suppressed: 'rgba(100, 116, 139, 0.35)',
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
   Component
   ═══════════════════════════════════════════════════ */
export default function PipelineScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, leadsRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/leads?limit=1'),
        ]);
        const dash = await dashRes.json();
        const leads = await leadsRes.json();
        setDashData(dash);
        setTotalLeads(leads.total || 0);
      } catch {
        /* empty */
      }
      setLoading(false);
    };
    load();
  }, []);

  /* -- Loading state -- */
  if (loading) {
    return (
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  if (!dashData) {
    return (
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
        <div className="text-muted-foreground text-sm p-6">Failed to load pipeline data.</div>
      </div>
    );
  }

  /* -- Compute stage counts -- */
  const { contactsByStatus: cbs, emailHealthDistribution: eh, draftsPendingReview, queuePending, repliesThisWeek, bouncesCount, suppressionsCount } = dashData;

  const importedCount = totalLeads || Object.values(cbs).reduce((a, b) => a + b, 0);
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

  /* -- Build stages array -- */
  const stages: PipelineStage[] = [
    {
      key: 'import',
      label: 'Import',
      icon: Upload,
      count: importedCount,
      ...STAGE_PALETTE.import,
      sublabel: `${batchesCount} batch${batchesCount !== 1 ? 'es' : ''} processed`,
      navHint: 'Go to Import',
    },
    {
      key: 'verified',
      label: 'Email Verified',
      icon: ShieldCheck,
      count: verifiedCount,
      ...STAGE_PALETTE.verified,
      sublabel: `${validEmails} valid - ${riskyEmails} risky - ${invalidEmails} invalid`,
      navHint: 'Go to Leads',
    },
    {
      key: 'drafted',
      label: 'Drafted',
      icon: FileText,
      count: draftedCount,
      ...STAGE_PALETTE.drafted,
      badge: `${draftsPendingReview} pending`,
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      sublabel: 'AI-generated drafts',
      navHint: 'Go to Drafts',
    },
    {
      key: 'approved',
      label: 'Approved',
      icon: CheckCircle2,
      count: approvedCount,
      ...STAGE_PALETTE.approved,
      sublabel: 'Ready to send',
      navHint: 'Go to Drafts',
    },
    {
      key: 'queued',
      label: 'Queued',
      icon: Clock,
      count: queuedCount,
      ...STAGE_PALETTE.queued,
      sublabel: 'In send queue',
      navHint: 'Go to Queue',
    },
    {
      key: 'sent',
      label: 'Sent',
      icon: Send,
      count: sentCount,
      ...STAGE_PALETTE.sent,
      badge: `${deliveryRate} delivery`,
      badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      sublabel: 'Emails delivered',
      navHint: 'Go to Queue',
    },
    {
      key: 'replied',
      label: 'Replied',
      icon: Mail,
      count: repliedCount,
      ...STAGE_PALETTE.replied,
      badge: `${replyRate} reply rate`,
      badgeColor: 'bg-green-500/15 text-green-400 border-green-500/30',
      sublabel: `${repliesThisWeek} this week`,
      navHint: 'Go to Replies',
    },
    {
      key: 'bounced',
      label: 'Bounced',
      icon: Ban,
      count: bouncedCount,
      ...STAGE_PALETTE.bounced,
      badge: `${bounceRate} bounce rate`,
      badgeColor: 'bg-red-500/15 text-red-400 border-red-500/30',
      sublabel: 'Failed deliveries',
      navHint: 'Go to Bounces',
    },
    {
      key: 'suppressed',
      label: 'Suppressed',
      icon: Ban,
      count: suppressedCount,
      ...STAGE_PALETTE.suppressed,
      sublabel: 'Excluded contacts',
      navHint: 'Go to Bounces',
    },
  ];

  const maxCount = Math.max(1, ...stages.map(s => s.count));

  /* ═══════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════ */
  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1">

        {/* ══════════════════════════════════════════════
           Hero Banner
           ══════════════════════════════════════════════ */}
        <GlassPanel
          className="relative overflow-hidden px-6 py-8"
        >
          {/* Background gradient accents */}
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, transparent 40%, rgba(59, 130, 246, 0.08) 70%, transparent 100%)',
            }}
          />
          <div
            className="absolute top-0 right-0 w-72 h-72 pointer-events-none opacity-20 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(212, 175, 55, 0.3), transparent 70%)',
            }}
          />

          <div className="relative flex items-center justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.08))',
                    boxShadow: '0 0 16px rgba(212, 175, 55, 0.15)',
                  }}
                >
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight">
                    <ShimmerText>Outreach Pipeline</ShimmerText>
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Visual funnel from import to reply
                  </p>
                </div>
              </div>

              <div className="flex items-baseline gap-3 pl-1">
                <span className="text-5xl font-black tabular-nums text-primary tracking-tighter">
                  <AnimatedCounter value={importedCount} />
                </span>
                <span className="text-base font-medium text-muted-foreground">total leads in pipeline</span>
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-end gap-2">
              {dashData._demo && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25 text-[10px] uppercase tracking-wider px-3 py-1">
                  Demo Data
                </Badge>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)' }} />
                  {sentCount.toLocaleString()} sent
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: '0 0 8px rgba(74, 222, 128, 0.5)' }} />
                  {repliedCount.toLocaleString()} replied
                </span>
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* ══════════════════════════════════════════════
           Key Metrics (StatCard)
           ══════════════════════════════════════════════ */}
        <SectionHeader
          title="Key Metrics"
          subtitle="Core performance indicators across the outreach funnel"
        />
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.08}>
          <StaggerItem>
            <StatCard
              label="Delivery Rate"
              value={deliveryRate}
              icon={Send}
              color="#34D399"
              delay={0}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Reply Rate"
              value={replyRate}
              icon={Mail}
              color="#4ADE80"
              delay={0.08}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Bounce Rate"
              value={bounceRate}
              icon={AlertTriangle}
              color="#F87171"
              delay={0.16}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Conversion"
              value={importedCount > 0 ? rate(repliedCount, importedCount) : '0%'}
              icon={TrendingUp}
              color="#D4AF37"
              delay={0.24}
            />
          </StaggerItem>
        </StaggerGrid>

        {/* ══════════════════════════════════════════════
           Funnel Visualization
           ══════════════════════════════════════════════ */}
        <SectionHeader
          title="Pipeline Funnel"
          subtitle="Stage-by-stage volume from import through response tracking"
        />
        <GlassPanel className="px-5 py-5">
          <div className="space-y-3">
            {stages.map((stage, idx) => {
              const widthPct = pct(stage.count, maxCount);
              const funnelPct = pct(stage.count, importedCount);
              const Icon = stage.icon;
              const glowColor = STAGE_GLOW_COLORS[stage.key] || 'rgba(212, 175, 55, 0.3)';
              return (
                <div key={stage.key} className="group relative">
                  {/* Row: label + bar */}
                  <div className="flex items-center gap-3">
                    {/* Label column */}
                    <div className="w-32 sm:w-36 shrink-0 flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-shadow duration-300 group-hover:shadow-lg"
                        style={{
                          background: stage.accentBg,
                          boxShadow: `0 0 0px transparent`,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 12px ${glowColor}`;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0px transparent';
                        }}
                      >
                        <Icon className={`w-3.5 h-3.5 ${stage.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground leading-tight truncate">{stage.label}</p>
                      </div>
                    </div>

                    {/* Funnel bar with glow */}
                    <div className="flex-1 min-w-0">
                      <div className={`h-8 ${stage.barBg} rounded-md overflow-hidden relative`}>
                        <motion.div
                          className={`h-full ${stage.barFill} rounded-md flex items-center justify-end pr-2`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(widthPct, 4)}%` }}
                          transition={{ duration: 0.7, delay: idx * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                          style={{
                            boxShadow: `0 0 10px ${glowColor}, 0 0 4px ${glowColor}`,
                          }}
                        >
                          <span className="text-[11px] font-bold text-white tabular-nums drop-shadow-sm">
                            {stage.count.toLocaleString()}
                          </span>
                        </motion.div>
                        {/* Percentage overlay on right when bar is small */}
                        {widthPct < 20 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums">
                            {funnelPct}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Funnel % column */}
                    <div className="w-12 shrink-0 text-right">
                      <span className="text-[11px] text-muted-foreground tabular-nums">{funnelPct}%</span>
                    </div>
                  </div>

                  {/* Connector arrow (except last) */}
                  {idx < stages.length - 1 && (
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="w-32 sm:w-36" />
                      <div className="flex-1 flex justify-center">
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                      </div>
                      <div className="w-12" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassPanel>

        {/* ══════════════════════════════════════════════
           Detailed Stage Breakdown Grid
           ══════════════════════════════════════════════ */}
        <SectionHeader
          title="Stage Breakdown"
          subtitle="Detailed metrics for each pipeline stage with navigation hints"
        />
        <GlassPanel className="px-4 py-4">
          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stages.map(stage => {
              const Icon = stage.icon;
              const funnelPct = pct(stage.count, importedCount);
              const glowColor = STAGE_GLOW_COLORS[stage.key] || 'rgba(212, 175, 55, 0.2)';
              return (
                <StaggerItem key={stage.key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="rounded-lg border border-border/60 p-3 cursor-pointer group transition-all duration-300 relative"
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget as HTMLDivElement;
                          el.style.borderColor = glowColor;
                          el.style.boxShadow = `0 0 16px ${glowColor}, inset 0 0 0 1px ${glowColor}`;
                          el.style.background = `linear-gradient(135deg, ${glowColor.replace('0.35', '0.06')}, transparent 60%)`;
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget as HTMLDivElement;
                          el.style.borderColor = '';
                          el.style.boxShadow = '';
                          el.style.background = 'rgba(255, 255, 255, 0.02)';
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-md ${stage.accentBg} flex items-center justify-center`}>
                              <Icon className={`w-4 h-4 ${stage.iconColor}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground leading-tight">{stage.label}</p>
                              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{stage.sublabel}</p>
                            </div>
                          </div>
                          <ArrowRight className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors mt-2" />
                        </div>

                        {/* Count badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl font-bold text-primary tabular-nums">{stage.count.toLocaleString()}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{funnelPct}% of total</span>
                        </div>

                        {/* Progress bar with glow */}
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${stage.barFill} transition-all duration-700`}
                            style={{
                              width: `${funnelPct}%`,
                              boxShadow: `0 0 8px ${glowColor}`,
                            }}
                          />
                        </div>

                        {/* Optional badge */}
                        {stage.badge && (
                          <div className="mt-2">
                            <Badge variant="outline" className={`text-[10px] ${stage.badgeColor}`}>
                              {stage.badge}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p>{stage.navHint || stage.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </GlassPanel>

        {/* ══════════════════════════════════════════════
           Email Verification Breakdown
           ══════════════════════════════════════════════ */}
        <SectionHeader
          title="Email Verification"
          subtitle="Distribution of email validity across your contact database"
        />
        <GlassPanel className="px-5 py-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { key: 'valid', label: 'Valid', color: '#34D399', textColor: 'text-emerald-400', icon: MailCheck },
              { key: 'risky', label: 'Risky', color: '#FBBF24', textColor: 'text-amber-400', icon: AlertTriangle },
              { key: 'invalid', label: 'Invalid', color: '#F87171', textColor: 'text-red-400', icon: Ban },
              { key: 'unknown', label: 'Unknown', color: '#A1A1AA', textColor: 'text-zinc-400', icon: ShieldCheck },
            ].map((item, idx) => {
              const count = (eh as Record<string, number>)?.[item.key] || 0;
              const itemPct = pct(count, emailTotal);
              const ItemIcon = item.icon;
              return (
                <div key={item.key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          background: `${item.color}15`,
                          boxShadow: `0 0 10px ${item.color}20`,
                        }}
                      >
                        <ItemIcon className={`w-4 h-4 ${item.textColor}`} />
                      </div>
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </div>
                    <span
                      className="text-lg font-bold tabular-nums"
                      style={{ color: item.color }}
                    >
                      <AnimatedCounter value={count} />
                    </span>
                  </div>
                  <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${item.color}, ${item.color}CC)`,
                        boxShadow: `0 0 8px ${item.color}60`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${itemPct}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{itemPct}% of verified</p>
                </div>
              );
            })}
          </div>
        </GlassPanel>

        {/* ══════════════════════════════════════════════
           Quick Actions
           ══════════════════════════════════════════════ */}
        <SectionHeader
          title="Quick Actions"
          subtitle="Common pipeline operations to keep things moving"
        />
        <GlassPanel className="px-5 py-5">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-xs font-medium border-zinc-500/30 text-foreground hover:text-white transition-all duration-300 px-5"
              style={{
                background: 'linear-gradient(135deg, rgba(161, 161, 170, 0.1), rgba(161, 161, 170, 0.03))',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'linear-gradient(135deg, rgba(161, 161, 170, 0.25), rgba(161, 161, 170, 0.1))';
                el.style.borderColor = 'rgba(161, 161, 170, 0.5)';
                el.style.boxShadow = '0 0 16px rgba(161, 161, 170, 0.2)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'linear-gradient(135deg, rgba(161, 161, 170, 0.1), rgba(161, 161, 170, 0.03))';
                el.style.borderColor = '';
                el.style.boxShadow = '';
              }}
            >
              <UploadCloud className="w-3.5 h-3.5 mr-2" />
              Upload New List
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-xs font-medium border-blue-500/30 text-foreground hover:text-white transition-all duration-300 px-5"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.03))',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.12))';
                el.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                el.style.boxShadow = '0 0 16px rgba(59, 130, 246, 0.25)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.03))';
                el.style.borderColor = '';
                el.style.boxShadow = '';
              }}
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-2" />
              Verify All Emails
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-xs font-medium border-amber-500/30 text-foreground hover:text-white transition-all duration-300 px-5"
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.03))',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(245, 158, 11, 0.12))';
                el.style.borderColor = 'rgba(245, 158, 11, 0.5)';
                el.style.boxShadow = '0 0 16px rgba(245, 158, 11, 0.25)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.03))';
                el.style.borderColor = '';
                el.style.boxShadow = '';
              }}
            >
              <FileCheck className="w-3.5 h-3.5 mr-2" />
              Review Pending Drafts
              {draftsPendingReview > 0 && (
                <Badge variant="outline" className="ml-2 bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
                  {draftsPendingReview}
                </Badge>
              )}
            </Button>
          </div>
        </GlassPanel>
      </div>
    </PageTransition>
  );
}