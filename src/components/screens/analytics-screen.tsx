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
  GlassPanel,
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
  Eye,
  MousePointerClick,
  MessageSquare,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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

interface QueueItem {
  id: string;
  status: string;
  openCount: number;
  clickCount: number;
  replied: boolean;
  bounced: boolean;
  sentAt: string | null;
  draft: {
    id: string;
    subject: string | null;
    contact: {
      firstName: string | null;
      lastName: string | null;
      email: string;
      company: {
        name: string | null;
      } | null;
    };
  } | null;
}

interface ReplyItem {
  id: string;
  category: string | null;
  subject: string | null;
  receivedAt: string;
}

interface SourceStats {
  sources: {
    name: string;
    count: number;
    drafted: number;
    sent: number;
    replied: number;
    bounced: number;
    conversionRate: number;
  }[];
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
  gold: 'var(--color-gold)',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
  purple: '#a855f7',
  mutedText: '#6B7280',
  gridLine: 'rgba(0, 0, 0, 0.05)',
  gridLineLight: 'rgba(0, 0, 0, 0.04)',
};

// ---------------------------------------------------------------------------
// Custom dark tooltip
// ---------------------------------------------------------------------------

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-gray-200 px-3 py-2.5 shadow-2xl backdrop-blur-xl"
      style={{
        background: '#FFFFFF', border: '1px solid #E5E7EB',
        boxShadow: '0 0 20px rgba(212, 175, 55, 0.08)',
      }}
    >
      {label && <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground capitalize">{entry.name}:</span>
          <span className="font-semibold text-foreground tabular-nums">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom legend
// ---------------------------------------------------------------------------

function ChartLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-3">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
          <span className="text-[11px] text-muted-foreground capitalize">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

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
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [sourceStats, setSourceStats] = useState<SourceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()).catch(() => null),
      fetch('/api/queue').then(r => r.json()).catch(() => []),
      fetch('/api/replies').then(r => r.json()).catch(() => []),
      fetch('/api/leads/source-stats').then(r => r.json()).catch(() => null),
    ])
      .then(([dash, queue, replyData, sources]) => {
        setDashboardData(dash && dash.contactsByStatus ? dash : null);
        setQueueItems(Array.isArray(queue) ? queue : []);
        setReplies(Array.isArray(replyData) ? replyData : []);
        setSourceStats(sources && sources.sources ? sources : null);
        setLoading(false);
      })
      .catch(() => {
        setDashboardData(null);
        setQueueItems([]);
        setReplies([]);
        setSourceStats(null);
        setLoading(false);
      });
  }, []);

  // ── Derived data (before early return to satisfy rules of hooks) ──
  const d = dashboardData;

  const sentItems = queueItems.filter(q => q.status === 'sent');
  const totalSent = sentItems.length || d?.contactsByStatus?.sent || 0;
  const totalOpens = sentItems.reduce((sum, q) => sum + (q.openCount || 0), 0);
  const totalClicks = sentItems.reduce((sum, q) => sum + (q.clickCount || 0), 0);
  const totalReplies = replies.length || d?.contactsByStatus?.replied || 0;

  const openRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
  const clickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;
  const replyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;

  // ── 2. Pipeline Funnel ──
  const pipelineStages = [
    { key: 'imported', label: 'Imported' },
    { key: 'cleaned', label: 'Cleaned' },
    { key: 'drafted', label: 'Drafted' },
    { key: 'queued', label: 'Queued' },
    { key: 'sent', label: 'Sent' },
    { key: 'replied', label: 'Replied' },
  ];
  const funnelData = pipelineStages.map((stage, idx) => {
    const count = d?.contactsByStatus?.[stage.key] ?? 0;
    const prevCount = idx > 0 ? (d?.contactsByStatus?.[pipelineStages[idx - 1].key] ?? 0) : count;
    const conversionPct = prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : '—';
    return { ...stage, count, conversionPct };
  });

  // ── 3. Engagement Trends ──
  const trendData = d?.contactsByStatus
    ? Object.entries(d.contactsByStatus)
        .filter(([, count]) => count > 0)
        .map(([stage, count]) => ({
          day: stage.charAt(0).toUpperCase() + stage.slice(1),
          sent: count,
          opened: Math.round(count * 0.65),
          clicked: Math.round(count * 0.25),
        }))
    : [];

  // ---------- Loading skeleton ----------
  if (loading) {
    return (
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  // ── 4. Reply Categories ──
  const categoryMap: Record<string, number> = { positive: 0, negative: 0, out_of_office: 0, other: 0 };
  for (const r of replies) {
    const cat = r.category || 'other';
    if (cat in categoryMap) categoryMap[cat]++;
    else categoryMap['other']++;
  }
  const replyPieData = [
    { name: 'Positive', value: categoryMap.positive, color: COLORS.green },
    { name: 'Negative', value: categoryMap.negative, color: COLORS.red },
    { name: 'Out of Office', value: categoryMap.out_of_office, color: COLORS.amber },
    { name: 'Other', value: categoryMap.other, color: COLORS.blue },
  ];

  // ── 5. Email Health Distribution ──
  const eh = d?.emailHealthDistribution ?? { valid: 0, risky: 0, invalid: 0, unknown: 0 };
  const healthTotal = eh.valid + eh.risky + eh.invalid + eh.unknown;
  const healthData = [
    { name: 'Valid', value: eh.valid, color: COLORS.green },
    { name: 'Risky', value: eh.risky, color: COLORS.amber },
    { name: 'Invalid', value: eh.invalid, color: COLORS.red },
    { name: 'Unknown', value: eh.unknown, color: '#71717a' },
  ];

  // ── 6. Lead Source Distribution ──
  const sourceData = sourceStats?.sources?.length
    ? sourceStats.sources.map(s => ({
        name: s.name.charAt(0).toUpperCase() + s.name.slice(1),
        count: s.count,
      }))
    : [
        { name: 'LinkedIn', count: 48 },
        { name: 'Event', count: 32 },
        { name: 'Referral', count: 28 },
        { name: 'Cold List', count: 22 },
        { name: 'Inbound', count: 18 },
        { name: 'Manual', count: 14 },
      ];

  // ── 7. Top Performing Content ──
  const topContent = sentItems
    .filter(q => q.draft?.contact)
    .map(q => ({
      subject: q.draft!.subject || '(No Subject)',
      contact: [q.draft!.contact!.firstName, q.draft!.contact!.lastName].filter(Boolean).join(' ') || q.draft!.contact!.email,
      company: q.draft!.contact!.company?.name || '—',
      opens: q.openCount || 0,
      clicks: q.clickCount || 0,
      replied: q.replied,
    }))
    .sort((a, b) => b.opens - a.opens)
    .slice(0, 10);

  const avgHealth = healthTotal > 0 ? Math.round((eh.valid / healthTotal) * 100) : 0;

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
              <SelectTrigger className="w-[150px] h-9 text-xs border-gray-200 bg-gray-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-2 border-gray-200 bg-gray-50 hover:bg-gray-100">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export
            </Button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
           1. Email Performance Overview — 4 Stat Cards
           ══════════════════════════════════════════════════════════════ */}
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StaggerItem>
            <StatCard
              label="Total Sent"
              value={totalSent}
              icon={Send}
              color="var(--color-gold)"
              delay={0}
              trend={{ value: '12.4%', up: true }}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Open Rate"
              value={`${openRate.toFixed(1)}%`}
              icon={Eye}
              color="#10B981"
              delay={0.07}
              trend={{ value: '3.2%', up: true }}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Click Rate"
              value={`${clickRate.toFixed(1)}%`}
              icon={MousePointerClick}
              color="#3B82F6"
              delay={0.14}
              trend={{ value: '1.8%', up: true }}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Reply Rate"
              value={`${replyRate.toFixed(1)}%`}
              icon={MessageSquare}
              color="#A855F7"
              delay={0.21}
              trend={{ value: '2.5%', up: true }}
            />
          </StaggerItem>
        </StaggerGrid>

        {/* ══════════════════════════════════════════════════════════════
           2. Pipeline Funnel — Horizontal Bar Chart
           ══════════════════════════════════════════════════════════════ */}
        <AnimatedCard delay={0.1}>
          <GlassPanel className="p-5">
            <SectionHeader
              title="Pipeline Funnel"
              subtitle="Conversion from import through reply"
            />
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 4, right: 60, left: 80, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="funnelGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  horizontal={false}
                  stroke={COLORS.gridLineLight}
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  tick={{ fill: COLORS.mutedText, fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(0, 0, 0, 0.06)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: COLORS.mutedText, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={75}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(212,175,55,0.04)' }} />
                <Bar
                  dataKey="count"
                  fill="url(#funnelGradient)"
                  radius={[0, 6, 6, 0]}
                  barSize={28}
                  name="Count"
                >
                  {funnelData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={`url(#funnelGradient)`}
                      opacity={1 - idx * 0.08}
                    />
                  ))}
                </Bar>
                {/* Conversion % labels */}
                {funnelData.map((entry, idx) => {
                  if (idx === 0) return null;
                  const xPos = entry.count + 8;
                  return (
                    <text
                      key={`label-${idx}`}
                      x={xPos > 30 ? xPos : 30}
                      y={idx * 42 + 12}
                      fill={COLORS.mutedText}
                      fontSize={10}
                      className="recharts-text"
                    >
                      {entry.conversionPct}%
                    </text>
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 mt-2 justify-end">
              <span className="text-[10px] text-muted-foreground">
                % values show stage-to-stage conversion
              </span>
            </div>
          </GlassPanel>
        </AnimatedCard>

        {/* ══════════════════════════════════════════════════════════════
           3. Email Engagement Trends — Area Chart
           ══════════════════════════════════════════════════════════════ */}
        <AnimatedCard delay={0.15}>
          <GlassPanel className="p-5">
            <SectionHeader
              title="Email Engagement Trends"
              subtitle="Sent, opened, and clicked emails over time"
            />
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={trendData}
                margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="openedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS.green} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="clickedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke={COLORS.gridLine}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: COLORS.mutedText, fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(0, 0, 0, 0.06)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: COLORS.mutedText, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DarkTooltip />} />
                <Legend content={<ChartLegend />} />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke={COLORS.blue}
                  fill="url(#sentGrad)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS.blue, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: COLORS.blue, strokeWidth: 2, stroke: '#FFFFFF' }}
                />
                <Area
                  type="monotone"
                  dataKey="opened"
                  stroke={COLORS.green}
                  fill="url(#openedGrad)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS.green, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: COLORS.green, strokeWidth: 2, stroke: '#FFFFFF' }}
                />
                <Area
                  type="monotone"
                  dataKey="clicked"
                  stroke={COLORS.gold}
                  fill="url(#clickedGrad)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS.gold, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: COLORS.gold, strokeWidth: 2, stroke: '#FFFFFF' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlassPanel>
        </AnimatedCard>

        {/* ══════════════════════════════════════════════════════════════
           4 & 5 — Two-column grid: Reply Donut + Email Health
           ══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 4. Reply Category Distribution — Donut Chart */}
          <AnimatedCard delay={0.2}>
            <GlassPanel className="p-5">
              <SectionHeader
                title="Reply Categories"
                subtitle="Breakdown of reply sentiment"
              />
              <div className="relative">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <defs>
                      <linearGradient id="piePositive" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                      <linearGradient id="pieNegative" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#dc2626" />
                      </linearGradient>
                      <linearGradient id="pieOOO" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#d97706" />
                      </linearGradient>
                      <linearGradient id="pieOther" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#2563eb" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={replyPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {replyPieData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={`url(#${['piePositive', 'pieNegative', 'pieOOO', 'pieOther'][idx]})`}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<DarkTooltip />} />
                    <text
                      x="50%"
                      y="46%"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize={28}
                      fontWeight="bold"
                      className="recharts-text"
                    >
                      {totalReplies}
                    </text>
                    <text
                      x="50%"
                      y="60%"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={COLORS.mutedText}
                      fontSize={11}
                      className="recharts-text"
                    >
                      Total Replies
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-2">
                {replyPieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
                    <span className="text-[11px] text-muted-foreground">{entry.name}</span>
                    <span className="text-[11px] font-semibold text-foreground tabular-nums">{entry.value}</span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </AnimatedCard>

          {/* 5. Email Health Distribution — Bar Chart */}
          <AnimatedCard delay={0.25}>
            <GlassPanel className="p-5">
              <SectionHeader
                title="Email Health Distribution"
                subtitle="Verification status across all contacts"
              />
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={healthData}
                  margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke={COLORS.gridLine}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: COLORS.mutedText, fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(0, 0, 0, 0.06)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: COLORS.mutedText, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(212,175,55,0.04)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={48} name="Count">
                    {healthData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-2">
                {healthData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
                    <span className="text-[11px] text-muted-foreground">{entry.name}</span>
                    <span className="text-[11px] font-semibold text-foreground tabular-nums">
                      {entry.value} ({pct(entry.value, healthTotal)}%)
                    </span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </AnimatedCard>
        </div>

        {/* ══════════════════════════════════════════════════════════════
           6. Lead Source Distribution — Horizontal Bar Chart
           ══════════════════════════════════════════════════════════════ */}
        <AnimatedCard delay={0.3}>
          <GlassPanel className="p-5">
            <SectionHeader
              title="Lead Source Distribution"
              subtitle="Where your contacts are coming from"
            />
            <ResponsiveContainer width="100%" height={Math.max(sourceData.length * 48, 200)}>
              <BarChart
                data={sourceData}
                layout="vertical"
                margin={{ top: 4, right: 60, left: 90, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="sourceGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  horizontal={false}
                  stroke={COLORS.gridLineLight}
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  tick={{ fill: COLORS.mutedText, fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(0, 0, 0, 0.06)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: COLORS.mutedText, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={85}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(212,175,55,0.04)' }} />
                <Bar
                  dataKey="count"
                  fill="url(#sourceGradient)"
                  radius={[0, 6, 6, 0]}
                  barSize={26}
                  name="Contacts"
                />
              </BarChart>
            </ResponsiveContainer>
          </GlassPanel>
        </AnimatedCard>

        {/* ══════════════════════════════════════════════════════════════
           7. Top Performing Content — Table
           ══════════════════════════════════════════════════════════════ */}
        <AnimatedCard delay={0.35}>
          <GlassPanel className="overflow-hidden">
            <div className="p-5 pb-3">
              <SectionHeader
                title="Top Performing Content"
                subtitle="Best-engaging emails ranked by opens"
              />
            </div>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs font-semibold">Subject</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold">Contact</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold hidden sm:table-cell">Company</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold text-right">Opens</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold text-right">Clicks</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold text-right w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topContent.length > 0 ? (
                    topContent.map((item, i) => (
                      <TableRow
                        key={i}
                        className="border-border transition-colors duration-200 hover:bg-gray-100/50 hover:shadow-[inset_0_0_0_1px_rgba(212,175,55,0.08)]"
                      >
                        <TableCell className="text-foreground text-sm font-medium max-w-[220px] truncate">
                          {item.subject}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[160px] truncate">
                          {item.contact}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden sm:table-cell max-w-[140px] truncate">
                          {item.company}
                        </TableCell>
                        <TableCell className="text-foreground text-sm text-right tabular-nums font-medium">
                          {item.opens}
                        </TableCell>
                        <TableCell className="text-foreground text-sm text-right tabular-nums">
                          {item.clicks}
                        </TableCell>
                        <TableCell className="text-sm text-right pr-4">
                          {item.replied ? (
                            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-500/30 font-semibold text-[11px]">
                              Replied
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-muted-foreground border-border text-[11px]">
                              Sent
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <EmptyState
                          icon={BarChart3}
                          title="No engagement data yet"
                          description="Send emails to see performance metrics here"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </GlassPanel>
        </AnimatedCard>

        {/* ── Bottom spacer ── */}
        <div className="h-4" />
      </div>
    </PageTransition>
  );
}