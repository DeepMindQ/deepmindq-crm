'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Upload, ShieldCheck, FileText, CheckCircle2, Clock,
  Send, Mail, MailX, Ban, ChevronRight, ArrowRight,
  UploadCloud, MailCheck, FileCheck, ListChecks,
  Layers, TrendingUp, AlertTriangle, Zap,
} from 'lucide-react';

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

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
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

  /* ── Compute stage counts ── */
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

  const deliveryRate = sentCount > 0 ? rate(sentCount - bouncedCount, sentCount) : '—';
  const replyRate = sentCount > 0 ? rate(repliedCount, sentCount) : '—';
  const bounceRate = sentCount > 0 ? rate(bouncedCount, sentCount) : '—';

  /* ── Build stages array ── */
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
      sublabel: `${validEmails} valid · ${riskyEmails} risky · ${invalidEmails} invalid`,
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
      icon: MailX,
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
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Outreach Pipeline
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visual funnel from import to reply &mdash;{' '}
            <span className="text-primary font-medium tabular-nums">{importedCount.toLocaleString()}</span> total leads
          </p>
        </div>
        {dashData._demo && (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase tracking-wider">
            Demo Data
          </Badge>
        )}
      </div>

      {/* ══════════════════════════════════════════════
         Funnel Visualization
         ══════════════════════════════════════════════ */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Pipeline Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {stages.map((stage, idx) => {
            const widthPct = pct(stage.count, maxCount);
            const funnelPct = pct(stage.count, importedCount);
            const Icon = stage.icon;
            return (
              <div key={stage.key} className="group relative">
                {/* Row: label + bar */}
                <div className="flex items-center gap-3">
                  {/* Label column */}
                  <div className="w-32 sm:w-36 shrink-0 flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-md ${stage.accentBg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 ${stage.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-tight truncate">{stage.label}</p>
                    </div>
                  </div>

                  {/* Funnel bar */}
                  <div className="flex-1 min-w-0">
                    <div className={`h-8 ${stage.barBg} rounded-md overflow-hidden relative`}>
                      <div
                        className={`h-full ${stage.barFill} rounded-md flex items-center justify-end pr-2 transition-all duration-700`}
                        style={{ width: `${Math.max(widthPct, 4)}%` }}
                      >
                        <span className="text-[11px] font-bold text-white tabular-nums drop-shadow-sm">
                          {stage.count.toLocaleString()}
                        </span>
                      </div>
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
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════
         Detailed Stage Breakdown Grid
         ══════════════════════════════════════════════ */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            Stage Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stages.map(stage => {
              const Icon = stage.icon;
              const funnelPct = pct(stage.count, importedCount);
              return (
                <Tooltip key={stage.key}>
                  <TooltipTrigger asChild>
                    <div className={`rounded-lg border border-border p-3 hover:border-muted-foreground/30 transition-colors cursor-pointer group`}>
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

                      {/* Progress bar */}
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${stage.barFill} transition-all duration-700`}
                          style={{ width: `${funnelPct}%` }}
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
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════
         Key Metrics Summary
         ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Delivery Rate</p>
                <p className="text-xl font-bold text-emerald-400 mt-0.5 tabular-nums">{deliveryRate}</p>
              </div>
              <div className="w-8 h-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
                <Send className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Reply Rate</p>
                <p className="text-xl font-bold text-green-400 mt-0.5 tabular-nums">{replyRate}</p>
              </div>
              <div className="w-8 h-8 rounded-md bg-green-500/15 flex items-center justify-center">
                <Mail className="w-4 h-4 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Bounce Rate</p>
                <p className="text-xl font-bold text-red-400 mt-0.5 tabular-nums">{bounceRate}</p>
              </div>
              <div className="w-8 h-8 rounded-md bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Conversion</p>
                <p className="text-xl font-bold text-primary mt-0.5 tabular-nums">
                  {importedCount > 0 ? rate(repliedCount, importedCount) : '0%'}
                </p>
              </div>
              <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════
         Email Verification Breakdown
         ══════════════════════════════════════════════ */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            Email Verification Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'valid', label: 'Valid', color: 'bg-emerald-400', textColor: 'text-emerald-400', icon: MailCheck },
              { key: 'risky', label: 'Risky', color: 'bg-amber-400', textColor: 'text-amber-400', icon: AlertTriangle },
              { key: 'invalid', label: 'Invalid', color: 'bg-red-400', textColor: 'text-red-400', icon: MailX },
              { key: 'unknown', label: 'Unknown', color: 'bg-zinc-500', textColor: 'text-zinc-400', icon: ShieldCheck },
            ].map(item => {
              const count = (eh as any)?.[item.key] || 0;
              const itemPct = pct(count, emailTotal);
              const ItemIcon = item.icon;
              return (
                <div key={item.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ItemIcon className={`w-3.5 h-3.5 ${item.textColor}`} />
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                    <span className="text-sm font-medium text-primary tabular-nums">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-700`}
                      style={{ width: `${itemPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{itemPct}% of verified</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════
         Quick Actions
         ══════════════════════════════════════════════ */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs border-zinc-500/30 text-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5 mr-2" />
              Upload New List
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs border-blue-500/30 text-foreground hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-2" />
              Verify All Emails
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs border-amber-500/30 text-foreground hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors"
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
        </CardContent>
      </Card>
    </div>
  );
}
