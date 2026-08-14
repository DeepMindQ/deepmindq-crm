'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/screen-states';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Building2,
  Target,
  Users,
  Calendar,
  Phone,
  Mail,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ChevronRight,
  Shield,
  Zap,
  BarChart3,
  UserCircle,
  Briefcase,
  MapPin,
} from 'lucide-react';

// ── Mock Data ──
type Touchpoint = {
  id: string;
  date: string;
  title: string;
  type: 'call' | 'email' | 'meeting' | 'event';
  status: 'completed' | 'planned';
  note?: string;
};
type Stakeholder = {
  name: string;
  role: string;
  influence: 'decision-maker' | 'champion' | 'influencer' | 'blocker';
  sentiment: 'positive' | 'neutral' | 'negative';
};
type WinFactor = { factor: string; score: number; direction: 'positive' | 'negative' | 'neutral' };
type ActionItem = { id: string; text: string; owner: string; due: string; done: boolean };

const stages = ['Target', 'Engage', 'Qualify', 'Propose', 'Negotiate', 'Close'];

const accounts = [
  {
    id: 'acc-1',
    name: 'Acme Corp',
    currentStage: 3,
    targetValue: '$420K',
    arr: '$2.4M',
    industry: 'Enterprise SaaS',
    winProbability: 72,
    touchpoints: [
      {
        id: 't1',
        date: 'Jan 20',
        title: 'Pricing proposal sent',
        type: 'email',
        status: 'completed',
        note: 'Revised enterprise pricing to CFO',
      },
      {
        id: 't2',
        date: 'Jan 17',
        title: 'Technical deep-dive session',
        type: 'meeting',
        status: 'completed',
        note: '2hr API integration review',
      },
      {
        id: 't3',
        date: 'Jan 14',
        title: 'Competitive evaluation update',
        type: 'call',
        status: 'completed',
      },
      {
        id: 't4',
        date: 'Jan 10',
        title: 'ROI presentation to C-suite',
        type: 'meeting',
        status: 'completed',
      },
      {
        id: 't5',
        date: 'Jan 25',
        title: 'Follow-up with CFO on pricing',
        type: 'call',
        status: 'planned',
      },
      {
        id: 't6',
        date: 'Jan 28',
        title: 'Technical workshop with VP Eng',
        type: 'meeting',
        status: 'planned',
      },
      {
        id: 't7',
        date: 'Feb 3',
        title: 'Reference customer call',
        type: 'call',
        status: 'planned',
      },
    ] as Touchpoint[],
    stakeholders: [
      { name: 'Sarah Chen', role: 'CFO', influence: 'decision-maker', sentiment: 'positive' },
      {
        name: 'James Rodriguez',
        role: 'VP Engineering',
        influence: 'champion',
        sentiment: 'positive',
      },
      { name: 'Emily Park', role: 'IT Director', influence: 'champion', sentiment: 'neutral' },
      { name: 'Michael Torres', role: 'CTO', influence: 'influencer', sentiment: 'neutral' },
      { name: 'Lisa Wang', role: 'Procurement', influence: 'blocker', sentiment: 'negative' },
    ] as Stakeholder[],
    winFactors: [
      { factor: 'Technical Fit', score: 92, direction: 'positive' },
      { factor: 'Executive Sponsorship', score: 85, direction: 'positive' },
      { factor: 'Competitive Position', score: 78, direction: 'positive' },
      { factor: 'Budget Availability', score: 65, direction: 'neutral' },
      { factor: 'Timeline Urgency', score: 55, direction: 'neutral' },
      { factor: 'Internal Alignment', score: 42, direction: 'negative' },
    ] as WinFactor[],
    actionItems: [
      {
        id: 'a1',
        text: 'Prepare competitive comparison deck',
        owner: 'AE - John',
        due: 'Jan 24',
        done: false,
      },
      {
        id: 'a2',
        text: 'Arrange reference call with NovaTech',
        owner: 'CS - Maria',
        due: 'Jan 30',
        done: false,
      },
      {
        id: 'a3',
        text: 'Draft final SOW for legal review',
        owner: 'AE - John',
        due: 'Feb 1',
        done: false,
      },
      {
        id: 'a4',
        text: 'Send case study to VP Eng',
        owner: 'SE - Alex',
        due: 'Jan 22',
        done: true,
      },
    ] as ActionItem[],
    competitivePosition: {
      position: 'Preferred Vendor',
      competitors: [
        { name: 'VendorX', status: 'Finalist', threat: 'high' as const },
        { name: 'LegacySolution', status: 'Incumbent', threat: 'medium' as const },
      ],
    },
  },
  {
    id: 'acc-2',
    name: 'NovaTech',
    currentStage: 2,
    targetValue: '$280K',
    arr: '$1.8M',
    industry: 'FinTech',
    winProbability: 58,
    touchpoints: [
      {
        id: 't8',
        date: 'Jan 15',
        title: 'Initial discovery call',
        type: 'call',
        status: 'completed',
        note: 'Discussed current stack and pain points',
      },
      {
        id: 't9',
        date: 'Jan 8',
        title: 'Intro email with collateral',
        type: 'email',
        status: 'completed',
      },
      {
        id: 't10',
        date: 'Jan 22',
        title: 'Product demo to team',
        type: 'meeting',
        status: 'planned',
      },
      {
        id: 't11',
        date: 'Jan 29',
        title: 'Security & compliance review',
        type: 'meeting',
        status: 'planned',
      },
      {
        id: 't12',
        date: 'Feb 5',
        title: 'Business case presentation',
        type: 'meeting',
        status: 'planned',
      },
    ] as Touchpoint[],
    stakeholders: [
      { name: 'David Kim', role: 'CTO', influence: 'decision-maker', sentiment: 'positive' },
      { name: 'Rachel Adams', role: 'VP Product', influence: 'champion', sentiment: 'positive' },
      { name: 'Tom Bradley', role: 'CISO', influence: 'influencer', sentiment: 'neutral' },
    ] as Stakeholder[],
    winFactors: [
      { factor: 'Technical Fit', score: 88, direction: 'positive' },
      { factor: 'Budget Availability', score: 82, direction: 'positive' },
      { factor: 'Executive Sponsorship', score: 75, direction: 'positive' },
      { factor: 'Competitive Position', score: 60, direction: 'neutral' },
      { factor: 'Timeline Urgency', score: 45, direction: 'neutral' },
      { factor: 'Internal Alignment', score: 50, direction: 'neutral' },
    ] as WinFactor[],
    actionItems: [
      {
        id: 'a5',
        text: 'Prepare FinTech-specific demo environment',
        owner: 'SE - Alex',
        due: 'Jan 20',
        done: true,
      },
      {
        id: 'a6',
        text: 'Get security certification docs ready',
        owner: 'SE - Alex',
        due: 'Jan 26',
        done: false,
      },
      {
        id: 'a7',
        text: 'Draft ROI model for FinTech use case',
        owner: 'AE - John',
        due: 'Feb 2',
        done: false,
      },
    ] as ActionItem[],
    competitivePosition: {
      position: 'Under Evaluation',
      competitors: [
        { name: 'CloudStack Pro', status: 'Evaluating', threat: 'high' as const },
        { name: 'DataFlow Inc', status: 'Not yet engaged', threat: 'low' as const },
      ],
    },
  },
];

// ── Helpers ──
const influenceColors: Record<string, { bg: string; text: string }> = {
  'decision-maker': { bg: tokens.confidence.high.bg, text: tokens.confidence.high.value },
  champion: { bg: tokens.accent.ghost, text: tokens.accent.primary },
  influencer: { bg: tokens.confidence.medium.bg, text: tokens.confidence.medium.value },
  blocker: { bg: tokens.confidence.low.bg, text: tokens.confidence.low.value },
};

const sentimentIcons: Record<string, string> = { positive: '🟢', neutral: '🟡', negative: '🔴' };

const touchpointIcons: Record<string, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  meeting: <Users className="w-3.5 h-3.5" />,
  event: <Calendar className="w-3.5 h-3.5" />,
};

const threatColors: Record<string, { bg: string; text: string }> = {
  high: { bg: tokens.confidence.low.bg, text: tokens.confidence.low.value },
  medium: { bg: tokens.confidence.medium.bg, text: tokens.confidence.medium.value },
  low: { bg: tokens.confidence.high.bg, text: tokens.confidence.high.value },
};

// ── Component ──
export default function PursuitWorkspace() {
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0].id);

  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const account = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Pursuit Workspace
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Track and manage account pursuit plans
          </p>
        </div>
        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Account Overview */}
      <Card className="overflow-hidden">
        <div
          className="p-6"
          style={{
            background: `linear-gradient(135deg, ${tokens.accent.primary}08, ${tokens.accent.primary}03)`,
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${tokens.accent.primary}15` }}
              >
                <Building2 className="w-6 h-6" style={{ color: tokens.accent.primary }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: tokens.text.primary }}>
                  {account.name}
                </h2>
                <div
                  className="flex flex-wrap items-center gap-4 mt-1 text-sm"
                  style={{ color: tokens.text.secondary }}
                >
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    {account.industry}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    {account.targetValue}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5" />
                    ARR {account.arr}
                  </span>
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-sm px-3 py-1"
              style={{
                borderColor:
                  account.winProbability >= 70
                    ? tokens.confidence.high.border
                    : tokens.confidence.medium.border,
                color:
                  account.winProbability >= 70
                    ? tokens.confidence.high.value
                    : tokens.confidence.medium.value,
              }}
            >
              {account.winProbability}% Win Probability
            </Badge>
          </div>
          {/* Stage Progress */}
          <div className="mt-5">
            <div className="flex justify-between mb-2">
              {stages.map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      backgroundColor:
                        i < account.currentStage
                          ? tokens.accent.primary
                          : i === account.currentStage
                            ? `${tokens.accent.primary}40`
                            : tokens.neutral['100'],
                      color: i <= account.currentStage ? '#fff' : tokens.text.muted,
                    }}
                  >
                    {i < account.currentStage ? '✓' : i + 1}
                  </div>
                  <span
                    className="text-[10px] hidden sm:block max-w-[72px] text-center"
                    style={{
                      color: i === account.currentStage ? tokens.text.primary : tokens.text.muted,
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <Progress value={(account.currentStage / stages.length) * 100} className="h-1.5 mt-1" />
          </div>
        </div>
      </Card>

      {/* Tabs: Touchpoints, Stakeholders, Win Factors, Competitive, Actions */}
      <Tabs defaultValue="touchpoints">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0">
          {['touchpoints', 'stakeholders', 'win-factors', 'competitive', 'actions'].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="data-[state=active]:shadow-sm data-[state=active]:bg-background rounded-lg px-4 py-2 text-sm font-medium"
              style={{ color: tokens.text.secondary }}
            >
              {tab
                .split('-')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Touchpoints */}
        <TabsContent value="touchpoints" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                Touchpoints Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0 max-h-96 overflow-y-auto">
                {account.touchpoints.map((tp, i) => (
                  <div key={tp.id} className="flex gap-3 pb-4 relative">
                    {i < account.touchpoints.length - 1 && (
                      <div
                        className="absolute left-[15px] top-8 bottom-0 w-px"
                        style={{ backgroundColor: tokens.border.default }}
                      />
                    )}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tp.status === 'planned' ? 'border-2 border-dashed' : ''}`}
                      style={{
                        backgroundColor:
                          tp.status === 'completed' ? `${tokens.accent.primary}12` : 'transparent',
                        borderColor: tp.status === 'planned' ? tokens.text.muted : undefined,
                        color: tokens.accent.primary,
                      }}
                    >
                      {touchpointIcons[tp.type] || <Circle className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-medium ${tp.status === 'planned' ? 'italic' : ''}`}
                          style={{ color: tokens.text.primary }}
                        >
                          {tp.title}
                        </p>
                        {tp.status === 'planned' && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{
                              borderColor: tokens.accent.border || tokens.accent.primary,
                              color: tokens.accent.primary,
                            }}
                          >
                            Planned
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
                        {tp.date}
                        {tp.note ? ` · ${tp.note}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stakeholders */}
        <TabsContent value="stakeholders" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                Key Stakeholders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {account.stakeholders.map((sh) => (
                  <div
                    key={sh.name}
                    className="p-4 rounded-lg"
                    style={{ border: `1px solid ${tokens.borderFaint}` }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: tokens.accent.primary }}
                      >
                        {sh.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                          {sh.name}
                        </p>
                        <p className="text-xs" style={{ color: tokens.text.muted }}>
                          {sh.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: influenceColors[sh.influence].bg,
                          color: influenceColors[sh.influence].text,
                        }}
                      >
                        {sh.influence.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span className="text-xs" style={{ color: tokens.text.muted }}>
                        {sentimentIcons[sh.sentiment]} {sh.sentiment}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Win Probability Factors */}
        <TabsContent value="win-factors" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                Win Probability Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {account.winFactors.map((wf) => (
                  <div key={wf.factor}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                        {wf.factor}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-bold"
                          style={{
                            color:
                              wf.score >= 75
                                ? tokens.confidence.high.value
                                : wf.score >= 50
                                  ? tokens.confidence.medium.value
                                  : tokens.confidence.low.value,
                          }}
                        >
                          {wf.score}%
                        </span>
                        {wf.direction === 'positive' ? (
                          <TrendingUp
                            className="w-3.5 h-3.5"
                            style={{ color: tokens.confidence.high.value }}
                          />
                        ) : wf.direction === 'negative' ? (
                          <TrendingDown
                            className="w-3.5 h-3.5"
                            style={{ color: tokens.confidence.low.value }}
                          />
                        ) : (
                          <span className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>
                    <Progress value={wf.score} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitive Positioning */}
        <TabsContent value="competitive" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                Competitive Positioning
              </CardTitle>
              <CardDescription>
                Current position:{' '}
                <strong style={{ color: tokens.text.primary }}>
                  {account.competitivePosition.position}
                </strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {account.competitivePosition.competitors.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between p-4 rounded-lg"
                    style={{ border: `1px solid ${tokens.borderFaint}` }}
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4" style={{ color: tokens.text.muted }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                          {c.name}
                        </p>
                        <p className="text-xs" style={{ color: tokens.text.muted }}>
                          {c.status}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: threatColors[c.threat].bg,
                        color: threatColors[c.threat].text,
                      }}
                    >
                      {c.threat} threat
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Action Items */}
        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                Action Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {account.actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      border: `1px solid ${tokens.borderFaint}`,
                      backgroundColor: item.done ? `${tokens.confidence.high.bg}20` : 'transparent',
                    }}
                  >
                    {item.done ? (
                      <CheckCircle2
                        className="w-4 h-4 shrink-0"
                        style={{ color: tokens.confidence.high.value }}
                      />
                    ) : (
                      <Circle className="w-4 h-4 shrink-0" style={{ color: tokens.text.muted }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${item.done ? 'line-through' : ''}`}
                        style={{ color: item.done ? tokens.text.muted : tokens.text.primary }}
                      >
                        {item.text}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
                        {item.owner} · Due {item.due}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      style={{ color: tokens.accent.primary }}
                    >
                      {item.done ? 'Undo' : 'Complete'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
