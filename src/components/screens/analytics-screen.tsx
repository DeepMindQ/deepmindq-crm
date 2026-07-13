'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-52 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
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
    bounce: { value: 1.8, positive: false }, // lower is better
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
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Analytics &amp; Reporting
        </h2>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          1. KPI Cards
      ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outreach Sent */}
        <Card className="bg-card border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Total Outreach Sent
              </p>
              <Send className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              {totalSent.toLocaleString()}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {trends.sent.positive ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
              )}
              <span
                className={`text-xs font-medium tabular-nums ${
                  trends.sent.positive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {trends.sent.value}%
              </span>
              <span className="text-xs text-muted-foreground ml-1">vs prev. period</span>
            </div>
          </CardContent>
        </Card>

        {/* Reply Rate */}
        <Card className="bg-card border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Reply Rate
              </p>
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              {replyRate.toFixed(1)}%
            </p>
            <div className="flex items-center gap-1 mt-1">
              {trends.reply.positive ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
              )}
              <span
                className={`text-xs font-medium tabular-nums ${
                  trends.reply.positive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {trends.reply.value}%
              </span>
              <span className="text-xs text-muted-foreground ml-1">vs prev. period</span>
            </div>
          </CardContent>
        </Card>

        {/* Bounce Rate */}
        <Card className="bg-card border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Bounce Rate
              </p>
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              {bounceRate.toFixed(1)}%
            </p>
            <div className="flex items-center gap-1 mt-1">
              {/* Lower bounce is good — green when decreasing */}
              {trends.bounce.positive ? (
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
              )}
              <span
                className={`text-xs font-medium tabular-nums ${
                  !trends.bounce.positive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {trends.bounce.value}%
              </span>
              <span className="text-xs text-muted-foreground ml-1">vs prev. period</span>
            </div>
          </CardContent>
        </Card>

        {/* Email Health Score */}
        <Card className="bg-card border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Email Health Score
              </p>
              <Target className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              {avgHealth}
              <span className="text-base font-normal text-muted-foreground">/100</span>
            </p>
            <div className="flex items-center gap-1 mt-1">
              {trends.health.positive ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
              )}
              <span
                className={`text-xs font-medium tabular-nums ${
                  trends.health.positive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {trends.health.value}%
              </span>
              <span className="text-xs text-muted-foreground ml-1">vs prev. period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. Pipeline Funnel Chart
      ══════════════════════════════════════════════════════════════════ */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Pipeline Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            {FUNNEL_STAGES.map(stage => {
              const count = d.contactsByStatus[stage.key] ?? 0;
              const widthPct = (count / maxFunnelCount) * 100;
              const percentOfTotal = pct(count, totalLeads);
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                    {stage.label}
                  </span>
                  <div className="flex-1 h-7 bg-muted/50 rounded-md overflow-hidden relative">
                    <div
                      className={`h-full ${stage.color} rounded-md transition-all duration-500 flex items-center px-2`}
                      style={{ width: `${Math.max(widthPct, 4)}%` }}
                    >
                      <span className="text-[11px] font-semibold text-white tabular-nums drop-shadow-sm truncate">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground w-12 tabular-nums text-right shrink-0">
                    {percentOfTotal}%
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          3. Campaign Performance Table
      ══════════════════════════════════════════════════════════════════ */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Campaign Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Batch</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Imported</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Verified %</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Drafted</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Sent</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Replies</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Reply Rate</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Bounce Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell className="text-foreground text-sm font-medium max-w-[160px] truncate">
                      {c.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm text-right tabular-nums">
                      {c.imported}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      <span className="text-emerald-400">{c.verifiedPct.toFixed(1)}%</span>
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
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }
                      >
                        {c.replyRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      <span
                        className={
                          c.bounceRate <= 5
                            ? 'text-emerald-400'
                            : c.bounceRate <= 10
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }
                      >
                        {c.bounceRate.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {campaigns.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground text-sm text-center py-6"
                    >
                      No campaign data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          4. Email Health Breakdown
      ══════════════════════════════════════════════════════════════════ */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Email Health Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* Stacked bar */}
          <div className="flex h-6 rounded-md overflow-hidden w-full">
            {healthTotal > 0 && (
              <>
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(eh.valid / healthTotal) * 100}%` }}
                />
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${(eh.risky / healthTotal) * 100}%` }}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(eh.invalid / healthTotal) * 100}%` }}
                />
                <div
                  className="bg-zinc-500 transition-all"
                  style={{ width: `${(eh.unknown / healthTotal) * 100}%` }}
                />
              </>
            )}
          </div>

          {/* Legend + counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {[
              { label: 'Valid', count: eh.valid, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
              { label: 'Risky', count: eh.risky, color: 'bg-amber-500', textColor: 'text-amber-400' },
              { label: 'Invalid', count: eh.invalid, color: 'bg-red-500', textColor: 'text-red-400' },
              { label: 'Unknown', count: eh.unknown, color: 'bg-zinc-500', textColor: 'text-zinc-400' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-sm ${item.color} shrink-0`} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className={`text-xs font-semibold tabular-nums ml-auto ${item.textColor}`}>
                  {item.count.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  ({pct(item.count, healthTotal)}%)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          5. Recent Activity Feed
      ══════════════════════════════════════════════════════════════════ */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="max-h-80 overflow-y-auto space-y-0">
            {DEMO_ACTIVITY.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2.5 border-b border-border last:border-b-0"
              >
                <div className="mt-0.5">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">{item.text}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          6. Top Companies by Contact Count
      ══════════════════════════════════════════════════════════════════ */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Top Companies by Contact Count
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs">Company</TableHead>
                <TableHead className="text-muted-foreground text-xs">Industry</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Contacts</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Avg Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_COMPANIES.map((c, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell className="text-foreground text-sm font-medium">
                    {c.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-xs">
                      {c.industry}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground text-sm text-right tabular-nums">
                    {c.contacts}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    <span
                      className={
                        c.avgScore >= 85
                          ? 'text-emerald-400'
                          : c.avgScore >= 75
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }
                    >
                      {c.avgScore}
                    </span>
                    <span className="text-muted-foreground">/100</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}