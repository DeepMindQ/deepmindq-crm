'use client';

import {
  Users, FileText, Clock, Send, AlertTriangle,
  ArrowUpRight, Upload, Copy, CheckCircle2,
  Sparkles, Mail, Zap, Ban,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';

/* ═══════════════════════════════════════════════════════════════════════
   Mock Data (inline so no external dependency issues)
   ═══════════════════════════════════════════════════════════════════════ */

const DASHBOARD_METRICS = {
  totalContacts: 1247,
  totalContactsDelta: '+12%',
  readyForDrafting: 892,
  draftsPendingReview: 23,
  sentThisWeek: 156,
  repliesReceived: 34,
  bounceRate: 6.2,
  totalSuppressed: 89,
  suppressionDelta: '+4',
  totalDuplicates: 47,
  aiScored: 1103,
  aiScoredPct: 88,
};

const EMAIL_HEALTH_DISTRIBUTION = [
  { name: 'Valid', value: 843, color: '#059669' },
  { name: 'Risky', value: 247, color: '#D97706' },
  { name: 'Invalid', value: 157, color: '#DC2626' },
];

const WEEKLY_ACTIVITY = [
  { day: 'Mon', sent: 32, replies: 5 },
  { day: 'Tue', sent: 28, replies: 8 },
  { day: 'Wed', sent: 45, replies: 6 },
  { day: 'Thu', sent: 22, replies: 4 },
  { day: 'Fri', sent: 19, replies: 3 },
  { day: 'Sat', sent: 5, replies: 1 },
  { day: 'Sun', sent: 5, replies: 7 },
];

const RECENT_ACTIVITY = [
  { id: '1', type: 'import', message: 'Imported 150 contacts from Salesforce CSV', time: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
  { id: '2', type: 'draft', message: 'AI generated 23 new email drafts', time: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
  { id: '3', type: 'sent', message: 'Sent 15 emails from queue', time: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: '4', type: 'bounce', message: '6 hard bounces detected — emails suppressed', time: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: '5', type: 'ai', message: 'AI scoring completed for 89 leads', time: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: '6', type: 'reply', message: 'New reply from Sarah Chen at Acme Corp', time: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
];

/* ═══════════════════════════════════════════════════════════════════════
   Metric Cards
   ═══════════════════════════════════════════════════════════════════════ */

const METRIC_CARDS = [
  {
    label: 'Total Contacts',
    value: DASHBOARD_METRICS.totalContacts.toLocaleString(),
    icon: Users,
    delta: DASHBOARD_METRICS.totalContactsDelta,
    deltaColor: 'text-emerald-400',
    deltaIcon: ArrowUpRight,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
  },
  {
    label: 'Ready for Drafting',
    value: DASHBOARD_METRICS.readyForDrafting.toLocaleString(),
    icon: FileText,
    subtext: 'leads with valid email & company context',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  {
    label: 'Drafts Pending Review',
    value: DASHBOARD_METRICS.draftsPendingReview.toString(),
    icon: Clock,
    badge: { text: 'Needs attention', color: 'border-primary/40 text-primary' },
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    onClick: () => {},
  },
  {
    label: 'Sent This Week',
    value: DASHBOARD_METRICS.sentThisWeek.toString(),
    icon: Send,
    subtext: `${DASHBOARD_METRICS.repliesReceived} replies received`,
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
  },
  {
    label: 'Bounce Rate',
    value: `${DASHBOARD_METRICS.bounceRate}%`,
    icon: AlertTriangle,
    indicator: { color: 'text-red-400', text: 'Above 5% threshold' },
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-400',
  },
  {
    label: 'Suppressed',
    value: DASHBOARD_METRICS.totalSuppressed.toString(),
    icon: Ban,
    delta: `+${DASHBOARD_METRICS.suppressionDelta}`,
    deltaColor: 'text-red-400',
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-400',
  },
];

/* ═══════════════════════════════════════════════════════════════════════
   Activity icon helper
   ═══════════════════════════════════════════════════════════════════════ */

function getActivityIcon(type: string) {
  switch (type) {
    case 'import': return <Upload className="w-4 h-4 text-primary" />;
    case 'draft': return <FileText className="w-4 h-4 text-primary" />;
    case 'sent': return <Send className="w-4 h-4 text-cyan-400" />;
    case 'bounce': return <AlertTriangle className="w-4 h-4 text-red-400" />;
    case 'ai': return <Sparkles className="w-4 h-4 text-primary" />;
    case 'reply': return <Mail className="w-4 h-4 text-emerald-400" />;
    default: return <Zap className="w-4 h-4 text-muted-foreground" />;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Dashboard Screen
   ═══════════════════════════════════════════════════════════════════════ */

export function DashboardScreen() {
  const setActiveView = useAppStore((s) => s.setActiveView);

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your lead intelligence and outreach pipeline.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {METRIC_CARDS.map((m) => (
          <Card
            key={m.label}
            className="bg-card border-border hover:border-border/80 transition-colors cursor-default"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${m.iconBg}`}>
                  <m.icon className={`w-[18px] h-[18px] ${m.iconColor}`} />
                </div>
                {m.badge && (
                  <Badge variant="outline" className={`text-[10px] px-2 py-0 border ${m.badge.color}`}>
                    {m.badge.text}
                  </Badge>
                )}
                {m.delta && (
                  <span className={`text-xs font-medium flex items-center gap-0.5 ${m.deltaColor}`}>
                    {m.deltaIcon && <m.deltaIcon className="w-3 h-3" />}
                    {m.delta}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-foreground tabular-nums">{m.value}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {m.subtext || m.indicator ? (
                  <span className={m.indicator?.color}>{m.subtext || m.indicator?.text}</span>
                ) : (
                  m.label
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Email Health Pie */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-foreground">Email Health Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={EMAIL_HEALTH_DISTRIBUTION}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {EMAIL_HEALTH_DISTRIBUTION.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'oklch(0.17 0.01 260)',
                      border: '1px solid oklch(0.27 0.005 260)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'oklch(0.93 0 0)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              {EMAIL_HEALTH_DISTRIBUTION.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name} ({item.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Activity Area */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-foreground">Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={WEEKLY_ACTIVITY}>
                  <defs>
                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.78 0.14 75)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.78 0.14 75)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="replyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'oklch(0.6 0 0)', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'oklch(0.6 0 0)', fontSize: 11 }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'oklch(0.17 0.01 260)',
                      border: '1px solid oklch(0.27 0.005 260)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'oklch(0.93 0 0)',
                    }}
                  />
                  <Area type="monotone" dataKey="sent" stroke="oklch(0.78 0.14 75)" strokeWidth={2} fill="url(#sentGrad)" />
                  <Area type="monotone" dataKey="replies" stroke="#059669" strokeWidth={2} fill="url(#replyGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                Emails Sent
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#059669' }} />
                Replies
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {[
              { label: 'Import Leads', icon: Upload, view: 'import' as const },
              { label: 'Review Drafts', icon: FileText, view: 'drafts' as const, badge: '23' },
              { label: 'Send Queue', icon: Send, view: 'queue' as const },
              { label: 'Find Duplicates', icon: Copy, view: 'duplicates' as const },
              { label: 'Capability Library', icon: Sparkles, view: 'capability-library' as const },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => setActiveView(action.view)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-colors text-left"
              >
                <action.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{action.label}</span>
                {action.badge && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px] bg-primary/15 text-primary border-0">
                    {action.badge}
                  </Badge>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-3 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-foreground">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ScrollArea className="h-[280px]">
              <div className="space-y-1">
                {RECENT_ACTIVITY.map((item, i) => (
                  <div key={item.id}>
                    <div className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.04] mt-0.5 shrink-0">
                        {getActivityIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">{item.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {i < RECENT_ACTIVITY.length - 1 && <Separator className="ml-12" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* AI Scoring Banner */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              AI Scoring Engine
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {DASHBOARD_METRICS.aiScored} of {DASHBOARD_METRICS.totalContacts} contacts scored ({DASHBOARD_METRICS.aiScoredPct}%).
              {DASHBOARD_METRICS.totalContacts - DASHBOARD_METRICS.aiScored > 0 && ` ${DASHBOARD_METRICS.totalContacts - DASHBOARD_METRICS.aiScored} remaining.`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${DASHBOARD_METRICS.aiScoredPct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-primary tabular-nums">{DASHBOARD_METRICS.aiScoredPct}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}