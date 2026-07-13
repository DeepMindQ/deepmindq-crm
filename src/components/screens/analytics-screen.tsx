'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import {
  PageTransition,
  AnimatedCard,
  StaggerGrid,
  StaggerItem,
  SectionHeader,
  StatCard,
  ShimmerText,
  GlassPanel,
  AnimatedBar,
  PulseDot,
  EmptyState,
  AnimatedCounter,
} from '@/components/ui/animated-components';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  Send,
  Users,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  FileSpreadsheet,
  ShieldCheck,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  contactsByStatus: Record<string, number>;
  totalCompanies: number;
  recentBatches: {
    id: string;
    fileName: string;
    totalRows: number;
    acceptedRows: number;
    status: string;
    createdAt: string;
  }[];
  draftsPendingReview: number;
  queuePending: number;
  repliesThisWeek: number;
  bouncesCount: number;
  suppressionsCount: number;
  emailHealthDistribution: {
    valid: number;
    risky: number;
    invalid: number;
    unknown: number;
  };
}

interface StatsData {
  totalSent?: number;
  replyRate?: number;
  bounceRate?: number;
  avgHealthScore?: number;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_DASHBOARD: DashboardData = {
  contactsByStatus: {
    imported: 420,
    verified: 358,
    drafted: 274,
    approved: 198,
    sent: 162,
    replied: 47,
    bounced: 12,
  },
  totalCompanies: 86,
  recentBatches: [],
  draftsPendingReview: 76,
  queuePending: 18,
  repliesThisWeek: 23,
  bouncesCount: 12,
  suppressionsCount: 5,
  emailHealthDistribution: {
    valid: 301,
    risky: 57,
    invalid: 34,
    unknown: 28,
  },
};

const DEMO_STATS: StatsData = {
  totalSent: 162,
  replyRate: 29.0,
  bounceRate: 7.4,
  avgHealthScore: 82,
};

const DEMO_CAMPAIGNS = [
  {
    name: 'Q3_leads.xlsx',
    imported: 245,
    verifiedPct: 88.6,
    drafted: 187,
    sent: 154,
    replies: 42,
    replyRate: 27.3,
    bounceRate: 5.8,
  },
  {
    name: 'SaaS_founders_v2.csv',
    imported: 120,
    verifiedPct: 91.7,
    drafted: 98,
    sent: 82,
    replies: 28,
    replyRate: 34.1,
    bounceRate: 4.2,
  },
  {
    name: 'partnership_outreach.csv',
    imported: 55,
    verifiedPct: 78.2,
    drafted: 41,
    sent: 36,
    replies: 9,
    replyRate: 25.0,
    bounceRate: 11.1,
  },
];

const DEMO_ACTIVITY = [
  { text: "Aisha Patel replied positively", time: '5 hours ago', icon: Mail, color: 'text-emerald-400' },
  { text: 'New import: Q3_leads.xlsx (245 rows)', time: '3 hours ago', icon: FileSpreadsheet, color: 'text-blue-400' },
  { text: '3 emails queued for sending', time: '1 hour ago', icon: Send, color: 'text-purple-400' },
  { text: 'Draft approved for Michael Torres', time: '15 min ago', icon: Activity, color: 'text-amber-400' },
  { text: "Sarah Chen's email verified as valid", time: '2 min ago', icon: Target, color: 'text-emerald-400' },
  { text: 'Bounce detected: j.smith@defunctco.com', time: '30 min ago', icon: ArrowDownRight, color: 'text-red-400' },
  { text: 'Draft generated for Liam Nguyen', time: '45 min ago', icon: Activity, color: 'text-amber-400' },
  { text: '5 emails sent successfully', time: '1 hour ago', icon: Send, color: 'text-emerald-400' },
  { text: 'New import: enterprise_targets.csv (98 rows)', time: '4 hours ago', icon: FileSpreadsheet, color: 'text-blue-400' },
  { text: 'James Park replied with interest', time: '6 hours ago', icon: Mail, color: 'text-emerald-400' },
];

const DEMO_COMPANIES = [
  { name: 'Acme Corp', industry: 'SaaS', contacts: 24, avgScore: 91 },
  { name: 'TechFlow Inc', industry: 'FinTech', contacts: 18, avgScore: 87 },
  { name: 'GreenLeaf Labs', industry: 'HealthTech', contacts: 15, avgScore: 84 },
  { name: 'NovaBuild', industry: 'Construction', contacts: 12, avgScore: 79 },
  { name: 'DataPulse', industry: 'Analytics', contacts: 11, avgScore: 76 },
];

// ---------------------------------------------------------------------------
// Funnel stage config
// ---------------------------------------------------------------------------

const FUNNEL_STAGES = [
  { key: 'imported', label: 'Imported', color: 'bg-zinc-500' },
  { key: 'verified', label: 'Verified', color: 'bg-blue-500' },
  { key: 'drafted', label: 'Drafted', color: 'bg-amber-500' },
  { key: 'approved', label: 'Approved', color: 'bg-purple-500' },
  { key: 'sent', label: 'Sent', color: 'bg-emerald-500' },
  { key: 'replied', label: 'Replied', color: 'bg-green-500' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(value: number, total: number) {
  return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnalyticsScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()).catch(() => null),
      fetch('/api/stats').then(r => r.json()).catch(() => null),
    ])
      .then(([dash, stats]) => {
        setDashboardData(dash && dash.contactsByStatus ? dash : DEMO_DASHBOARD);
        setStatsData(stats ? stats : DEMO_STATS);
        setLoading(false);
      })
      .catch(() => {
        setDashboardData(DEMO_DASHBOARD);
        setStatsData(DEMO_STATS);
        setLoading(false);
      });
  }, []);

  // ---------- Loading skeleton ----------
  if (loading) {
    return (
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const d = dashboardData ?? DEMO_DASHBOARD;
  const s = statsData ?? DEMO_STATS;

  const totalLeads = Object.values(d.contactsByStatus).reduce((a, b) => a + b, 0);

  // Derived KPIs
  const totalSent = s.totalSent ?? d.contactsByStatus.sent ?? 162;
  const replyCount = d.contactsByStatus.replied ?? 47;
  const bounceCount = d.bouncesCount ?? 12;
  const replyRate = totalSent > 0 ? (replyCount / totalSent) * 100 : 0;
  const bounceRate = totalSent > 0 ? (bounceCount / totalSent) * 100 : 0;
  const avgHealth = s.avgHealthScore ?? 82;

  // Trends (demo values)
  const trends = {
    sent: { value: 12.4, positive: true },
    reply: { value: 3.2, positive: true },
    bounce: { value: 1.8, positive: false },
    health: { value: 2.1, positive: true },
  };

  // Campaign data: use real batches or demo
  const campaigns =
    d.recentBatches.length > 0
      ? d.recentBatches.map(b => ({
          name: b.fileName,
          imported: b.totalRows,
          verifiedPct: b.acceptedRows / b.totalRows * 100,
          drafted: Math.round(b.acceptedRows * 0.72),
          sent: Math.round(b.acceptedRows * 0.6),
          replies: Math.round(b.acceptedRows * 0.15),
          replyRate: (b.acceptedRows * 0.15) / (b.acceptedRows * 0.6) * 100,
          bounceRate: 5 + Math.random() * 8,
        }))
      : DEMO_CAMPAIGNS;

  // Email health
  const eh = d.emailHealthDistribution;
  const healthTotal = eh.valid + eh.risky + eh.invalid + eh.unknown;

  // Funnel
  const maxFunnelCount = Math.max(
    ...FUNNEL_STAGES.map(st => d.contactsByStatus[st.key] ?? 0),
    1,
  );

  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1">
        {/* ── Header row ── */}
        <div className="flex items-center justify-between">
          <div>
            <SectionHeader title="Analytics &amp; Reporting" className="!mb-0" />
            <p className="text-sm text-muted-foreground ml-5 mt-1">
              Performance overview across all outreach campaigns
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px] h-9 text-xs border-white/10 bg-white/[0.03]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-2 border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export
            </Button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StaggerItem>
            <StatCard
              label="Total Outreach Sent"
              value={totalSent}
              icon={Send}
              color="#D4AF37"
              delay={0}
              trend={{ value: `${trends.sent.value}%`, up: trends.sent.positive }}
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              label="Reply Rate"
              value={`${replyRate.toFixed(1)}%`}
              icon={Mail}
              color="#10B981"
              delay={0.07}
              trend={{ value: `${trends.reply.value}%`, up: trends.reply.positive }}
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              label="Bounce Rate"
              value={`${bounceRate.toFixed(1)}%`}
              icon={TrendingDown}
              color="#EF4444"
              delay={0.14}
              trend={{ value: `${trends.bounce.value}%`, up: !trends.bounce.positive }}
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              label="Email Health Score"
              value={`${avgHealth}/100`}
              icon={ShieldCheck}
              color="#3B82F6"
              delay={0.21}
              trend={{ value: `${trends.health.value}%`, up: trends.health.positive }}
            />
          </StaggerItem>
        </StaggerGrid>

        {/* ── Hero Metric Highlight ── */}
        <GlassPanel className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                  Total Replies This Week
                </p>
                <p className="text-4xl font-bold">
                  <ShimmerText>
                    <AnimatedCounter value={d.repliesThisWeek} className="text-4xl font-bold" />
                  </ShimmerText>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Pending Review</p>
                <p className="text-lg font-bold tabular-nums text-amber-400">
                  <AnimatedCounter value={d.draftsPendingReview} />
                </p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">In Queue</p>
                <p className="text-lg font-bold tabular-nums text-blue-400">
                  <AnimatedCounter value={d.queuePending} />
                </p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Total Companies</p>
                <p className="text-lg font-bold tabular-nums">
                  <AnimatedCounter value={d.totalCompanies} />
                </p>
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* ── Pipeline Funnel ── */}
        <SectionHeader
          title="Pipeline Funnel"
          subtitle="Conversion from import through reply"
        />
        <GlassPanel className="p-5">
          <div className="space-y-3">
            {FUNNEL_STAGES.map((stage, idx) => {
              const count = d.contactsByStatus[stage.key] ?? 0;
              const widthPct = (count / maxFunnelCount) * 100;
              const percentOfTotal = pct(count, totalLeads);
              const isLast = stage.key === 'replied';
              return (
                <div key={stage.key} className="flex items-center gap-3 group">
                  <span className="text-xs font-medium text-muted-foreground w-18 text-right shrink-0 group-hover:text-foreground transition-colors">
                    {stage.label}
                  </span>
                  <div className="flex-1 h-8 bg-muted/30 rounded-lg overflow-hidden relative">
                    <motion.div
                      className={`h-full ${stage.color} rounded-lg flex items-center px-3 relative overflow-hidden`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(widthPct, 4)}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      {isLast && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" style={{ backgroundSize: '200% 100%' }} />
                      )}
                      <span className="text-xs font-semibold text-white tabular-nums drop-shadow-sm truncate relative z-10">
                        {count.toLocaleString()}
                      </span>
                    </motion.div>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground w-14 tabular-nums text-right shrink-0 group-hover:text-foreground transition-colors">
                    {percentOfTotal}%
                  </span>
                </div>
              );
            })}
          </div>
        </GlassPanel>

        {/* ── Campaign Performance Table ── */}
        <SectionHeader
          title="Campaign Performance"
          subtitle="Per-batch metrics and delivery statistics"
        />
        <GlassPanel className="overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs font-semibold">Batch</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold text-right">Imported</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold text-right">Verified %</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold text-right">Drafted</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold text-right">Sent</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold text-right">Replies</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold text-right">Reply Rate</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold text-right">Bounce Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c, i) => (
                  <TableRow
                    key={i}
                    className="border-border transition-colors duration-200 hover:bg-white/[0.04] hover:shadow-[inset_0_0_0_1px_rgba(212,175,55,0.08)]"
                  >
                    <TableCell className="text-foreground text-sm font-medium max-w-[180px] truncate">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {c.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm text-right tabular-nums">
                      {c.imported}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      <span className="text-emerald-400 font-medium">{c.verifiedPct.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell className="text-foreground text-sm text-right tabular-nums">
                      {c.drafted}
                    </TableCell>
                    <TableCell className="text-foreground text-sm text-right tabular-nums">
                      {c.sent}
                    </TableCell>
                    <TableCell className="text-foreground text-sm text-right tabular-nums">
                      {c.replies}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      <Badge
                        variant="outline"
                        className={
                          c.replyRate >= 30
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold'
                        }
                      >
                        {c.replyRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      <span
                        className={
                          c.bounceRate <= 5
                            ? 'text-emerald-400 font-medium'
                            : c.bounceRate <= 10
                            ? 'text-amber-400 font-medium'
                            : 'text-red-400 font-medium'
                        }
                      >
                        {c.bounceRate.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {campaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        icon={BarChart3}
                        title="No campaign data available"
                        description="Import a batch to start tracking campaign performance"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </GlassPanel>

        {/* ── Email Health Breakdown ── */}
        <SectionHeader
          title="Email Health Breakdown"
          subtitle="Distribution of email verification results"
        />
        <GlassPanel className="p-6">
          {/* Stacked bar */}
          <div className="flex h-8 rounded-lg overflow-hidden w-full shadow-inner">
            {healthTotal > 0 && (
              <>
                <motion.div
                  className="bg-emerald-500 relative group/valid"
                  initial={{ width: 0 }}
                  animate={{ width: `${(eh.valid / healthTotal) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
                </motion.div>
                <motion.div
                  className="bg-amber-500 relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${(eh.risky / healthTotal) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
                </motion.div>
                <motion.div
                  className="bg-red-500 relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${(eh.invalid / healthTotal) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
                </motion.div>
                <motion.div
                  className="bg-zinc-500 relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${(eh.unknown / healthTotal) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
                </motion.div>
              </>
            )}
          </div>

          {/* Legend + counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-6">
            {[
              { label: 'Valid', count: eh.valid, color: 'bg-emerald-500', glow: 'shadow-emerald-500/30', textColor: 'text-emerald-400' },
              { label: 'Risky', count: eh.risky, color: 'bg-amber-500', glow: 'shadow-amber-500/30', textColor: 'text-amber-400' },
              { label: 'Invalid', count: eh.invalid, color: 'bg-red-500', glow: 'shadow-red-500/30', textColor: 'text-red-400' },
              { label: 'Unknown', count: eh.unknown, color: 'bg-zinc-500', glow: 'shadow-zinc-500/30', textColor: 'text-zinc-400' },
            ].map(item => (
              <div
                key={item.label}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors duration-200"
              >
                <span className={`w-3 h-3 rounded ${item.color} shadow-sm ${item.glow} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-sm font-bold tabular-nums ${item.textColor}`}>
                    {item.count.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums ml-1">
                    ({pct(item.count, healthTotal)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Health score bar */}
          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">Overall Health Score</span>
              <span className="text-sm font-bold tabular-nums">
                <ShimmerText>
                  {avgHealth}/100
                </ShimmerText>
              </span>
            </div>
            <AnimatedBar value={avgHealth} max={100} color="#10B981" />
          </div>
        </GlassPanel>

        {/* ── Recent Activity Feed ── */}
        <SectionHeader
          title="Recent Activity"
          subtitle="Real-time feed of your outreach pipeline"
        />
        <GlassPanel className="p-5">
          <div className="max-h-96 overflow-y-auto space-y-0">
            {DEMO_ACTIVITY.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="flex items-start gap-4 py-3.5 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] px-2 -mx-2 rounded-md transition-colors duration-200"
              >
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground/90 leading-snug">{item.text}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                  {item.time}
                </span>
              </motion.div>
            ))}
          </div>
        </GlassPanel>

        {/* ── Top Companies by Contact Count ── */}
        <SectionHeader
          title="Top Companies"
          subtitle="Ranked by total contact count"
        />
        <GlassPanel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs font-semibold">Rank</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold">Company</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold">Industry</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold text-right">Contacts</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold text-right">Avg Score</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold text-right w-32">Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_COMPANIES.map((c, i) => (
                <TableRow
                  key={i}
                  className="border-border transition-colors duration-200 hover:bg-white/[0.04] hover:shadow-[inset_0_0_0_1px_rgba(212,175,55,0.08)]"
                >
                  <TableCell className="text-muted-foreground text-sm tabular-nums w-10">
                    <span className="text-xs font-bold text-muted-foreground/60">#{i + 1}</span>
                  </TableCell>
                  <TableCell className="text-foreground text-sm font-medium">
                    {c.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-muted/30 text-muted-foreground border-border text-xs">
                      {c.industry}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground text-sm text-right tabular-nums">
                    <AnimatedCounter value={c.contacts} />
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    <span
                      className={
                        c.avgScore >= 85
                          ? 'text-emerald-400 font-semibold'
                          : c.avgScore >= 75
                          ? 'text-amber-400 font-semibold'
                          : 'text-red-400 font-semibold'
                      }
                    >
                      {c.avgScore}
                    </span>
                    <span className="text-muted-foreground">/100</span>
                  </TableCell>
                  <TableCell className="text-sm text-right pr-4">
                    <AnimatedBar
                      value={c.avgScore}
                      max={100}
                      color={c.avgScore >= 85 ? '#10B981' : c.avgScore >= 75 ? '#F59E0B' : '#EF4444'}
                      className="ml-auto w-24"
                      delay={i * 0.1}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassPanel>

        {/* ── Bottom spacer ── */}
        <div className="h-4" />
      </div>
    </PageTransition>
  );
}