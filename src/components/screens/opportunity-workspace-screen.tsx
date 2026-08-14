'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/screen-states';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Building2, DollarSign, Calendar, Users, Clock, TrendingUp, Brain,
  Target, Shield, ChevronRight, MessageSquare, AlertTriangle,
  CheckCircle2, Lightbulb, MapPin, Trophy, Swords, ArrowRight,
  Phone, FileText,
} from 'lucide-react';

// ── Mock Data ──
const opportunity = {
  id: 'opp-001',
  company: 'Acme Corp',
  value: 420000,
  stage: 'Negotiation',
  stageOrder: 4,
  totalStages: 6,
  closeDate: '2025-03-15',
  probability: 72,
  type: 'New Business',
  createdAt: '2024-11-01',
  lastActivity: '2025-01-20',
};

type TimelineEvent = { date: string; title: string; description: string; type: 'email' | 'meeting' | 'call' | 'note' | 'milestone' };
const activityTimeline: TimelineEvent[] = [
  { date: 'Jan 20', title: 'Pricing proposal sent', description: 'Sent revised enterprise pricing to CFO Sarah Chen', type: 'email' },
  { date: 'Jan 17', title: 'Technical deep-dive', description: '2hr session with VP Engineering on API integration', type: 'meeting' },
  { date: 'Jan 14', title: 'Competitive evaluation update', description: 'Acme confirmed we are in final 2 with VendorX', type: 'note' },
  { date: 'Jan 10', title: 'ROI presentation', description: 'Presented business case to C-suite leadership team', type: 'meeting' },
  { date: 'Jan 5', title: 'Discovery call completed', description: 'Initial requirements gathering with IT Director', type: 'call' },
  { date: 'Dec 28', title: 'Opportunity qualified', description: 'BANT criteria met, moved to pipeline', type: 'milestone' },
];

const dealTeam = [
  { name: 'Sarah Chen', role: 'CFO', email: 'schen@acme.com', influence: 'Decision Maker', avatar: 'SC' },
  { name: 'James Rodriguez', role: 'VP Engineering', email: 'jrod@acme.com', influence: 'Technical Evaluator', avatar: 'JR' },
  { name: 'Emily Park', role: 'IT Director', email: 'epark@acme.com', influence: 'Champion', avatar: 'EP' },
  { name: 'Michael Torres', role: 'CTO', email: 'mtorres@acme.com', influence: 'Influencer', avatar: 'MT' },
];

const keyMetrics = [
  { label: 'Deal Velocity', value: '52 days', change: '-8 days vs avg' },
  { label: 'Engagement Score', value: '88/100', change: '+12 from last month' },
  { label: 'Stakeholder Coverage', value: '4/6', change: '67% mapped' },
  { label: 'Competitive Position', value: 'Strong', change: 'Preferred vendor' },
];

const aiCoachTips = [
  { id: '1', tip: 'Focus on CFO Chen — she controls budget sign-off. Schedule a 1:1 to address remaining pricing objections before the Feb board meeting.', priority: 'high' as const },
  { id: '2', tip: 'James Rodriguez has been reviewing your API docs heavily. Send a technical case study from a similar FinTech implementation to reinforce confidence.', priority: 'medium' as const },
  { id: '3', tip: 'Risk: VendorX recently lowered pricing by 15%. Prepare a value-comparison deck highlighting total cost of ownership advantages.', priority: 'high' as const },
];

const relatedSignals = [
  { title: 'Acme posted 15 new engineering roles', type: 'growth', time: '2d ago', confidence: 94 },
  { title: 'CFO Chen spoke at SaaS conference about platform consolidation', type: 'intent', time: '5d ago', confidence: 89 },
  { title: 'Acme renewing AWS contract — potential multi-cloud need', type: 'opportunity', time: '1w ago', confidence: 76 },
];

const nextSteps = [
  { id: '1', text: 'Send revised pricing proposal to CFO', done: true },
  { id: '2', text: 'Schedule technical workshop with VP Eng', done: true },
  { id: '3', text: 'Prepare competitive comparison deck', done: false },
  { id: '4', text: 'Arrange reference call with existing customer', done: false },
  { id: '5', text: 'Draft final SOW for legal review', done: false },
];

const competitiveIntel = [
  { competitor: 'VendorX', status: 'Finalist', threat: 'high' as const, note: 'Recently dropped pricing 15%. Strong executive sponsorship.' },
  { competitor: 'LegacySolution', status: 'Incumbent', threat: 'medium' as const, note: 'Current provider. Renewal in 6 months. Limited AI capabilities.' },
  { competitor: 'CloudNative Inc', status: 'Evaluated', threat: 'low' as const, note: 'Dropped from evaluation per IT Director. Missing compliance features.' },
];

// ── Helpers ──
const eventTypeIcon: Record<string, React.ReactNode> = {
  email: <MessageSquare className="w-3.5 h-3.5" />,
  meeting: <Users className="w-3.5 h-3.5" />,
  call: <Phone className="w-3.5 h-3.5" />,
  note: <FileText className="w-3.5 h-3.5" />,
  milestone: <Trophy className="w-3.5 h-3.5" />,
};



const stageLabels = ['Qualification', 'Discovery', 'Solution Design', 'Negotiation', 'Commitment', 'Closed Won'];

const threatColors: Record<string, { bg: string; text: string }> = {
  high: { bg: tokens.confidence.low.bg, text: tokens.confidence.low.value },
  medium: { bg: tokens.confidence.medium.bg, text: tokens.confidence.medium.value },
  low: { bg: tokens.confidence.high.bg, text: tokens.confidence.high.value },
};

// ── Component ──
export default function OpportunityWorkspace() {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState(nextSteps);

  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const toggleStep = (id: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Opportunity Header */}
      <Card className="overflow-hidden">
        <div className="p-6" style={{ background: `linear-gradient(135deg, ${tokens.accent.primary}08, ${tokens.accent.primary}03)` }}>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tokens.accent.primary}15` }}>
                <Building2 className="w-6 h-6" style={{ color: tokens.accent.primary }} />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold" style={{ color: tokens.text.primary }}>{opportunity.company}</h1>
                  <Badge variant="outline" style={{ borderColor: tokens.accent.border || tokens.accent.primary, color: tokens.accent.primary }}>{opportunity.type}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm" style={{ color: tokens.text.secondary }}>
                  <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />${(opportunity.value / 1000).toFixed(0)}K</span>
                  <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />{opportunity.stage}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Closes {opportunity.closeDate}</span>
                  <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" />{opportunity.probability}% probability</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Log Activity</Button>
              <Button size="sm" className="gap-1.5" style={{ backgroundColor: tokens.accent.primary, color: '#fff' }}><ArrowRight className="w-3.5 h-3.5" /> Advance Stage</Button>
            </div>
          </div>
          {/* Stage Progress */}
          <div className="mt-5">
            <div className="flex justify-between mb-2">
              {stageLabels.map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i + 1 <= opportunity.stageOrder ? 'text-white' : ''}`} style={{ backgroundColor: i + 1 <= opportunity.stageOrder ? tokens.accent.primary : tokens.neutral['100'], color: i + 1 > opportunity.stageOrder ? tokens.text.muted : '#fff' }}>
                    {i + 1 <= opportunity.stageOrder ? '✓' : i + 1}
                  </div>
                  <span className="text-[10px] hidden sm:block max-w-[80px] text-center" style={{ color: i + 1 === opportunity.stageOrder ? tokens.text.primary : tokens.text.muted }}>{label}</span>
                </div>
              ))}
            </div>
            <Progress value={(opportunity.stageOrder / opportunity.totalStages) * 100} className="h-1.5 mt-1" />
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {keyMetrics.map((m) => (
          <Card key={m.label} className="py-4 gap-2">
            <CardContent className="p-4 pb-0">
              <p className="text-xs font-medium" style={{ color: tokens.text.muted }}>{m.label}</p>
              <p className="text-lg font-bold mt-1" style={{ color: tokens.text.primary }}>{m.value}</p>
              <p className="text-[11px] mt-1" style={{ color: tokens.text.secondary }}>{m.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle Row: Team + Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Team */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>Deal Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dealTeam.map((member) => (
                <div key={member.email} className="flex items-center gap-3 p-3 rounded-lg" style={{ border: `1px solid ${tokens.borderFaint}` }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: tokens.accent.primary }}>
                    {member.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{member.name}</p>
                    <p className="text-xs" style={{ color: tokens.text.muted }}>{member.role}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: tokens.border.default, color: tokens.text.secondary }}>{member.influence}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 max-h-80 overflow-y-auto">
              {activityTimeline.map((event, i) => (
                <div key={i} className="flex gap-3 pb-4 relative">
                  {i < activityTimeline.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-px" style={{ backgroundColor: tokens.border.default }} />
                  )}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${tokens.accent.primary}12`, color: tokens.accent.primary }}>
                    {eventTypeIcon[event.type] || <Clock className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{event.title}</p>
                      <span className="text-[11px] shrink-0" style={{ color: tokens.text.muted }}>{event.date}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: tokens.text.secondary }}>{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: AI Coaching + Next Steps + Competitive + Signals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* AI Coaching Tips */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: tokens.text.primary }}>
              <Brain className="w-4 h-4" style={{ color: tokens.domain.reasoning }} /> AI Coaching
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiCoachTips.map((tip) => (
                <div key={tip.id} className="p-3 rounded-lg" style={{ backgroundColor: tip.priority === 'high' ? `${tokens.confidence.medium.bg}50` : `${tokens.neutral['100']}50`, border: `1px solid ${tip.priority === 'high' ? tokens.confidence.medium.border : tokens.borderFaint}` }}>
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" style={{ color: tip.priority === 'high' ? tokens.confidence.medium.value : tokens.text.muted }} />
                    <p className="text-xs leading-relaxed" style={{ color: tokens.text.primary }}>{tip.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Next Steps Checklist */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>Next Steps</CardTitle>
              <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>{doneCount}/{steps.length} done</span>
            </div>
            <Progress value={(doneCount / steps.length) * 100} className="h-1.5" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {steps.map((step) => (
                <label key={step.id} className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox checked={step.done} onCheckedChange={() => toggleStep(step.id)} />
                  <span className={`text-sm ${step.done ? 'line-through' : ''}`} style={{ color: step.done ? tokens.text.muted : tokens.text.primary }}>{step.text}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Competitive Intel + Related Signals */}
        <div className="space-y-6">
          {/* Competitive Intel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: tokens.text.primary }}>
                <Swords className="w-4 h-4" style={{ color: tokens.confidence.low.value }} /> Competitive Intel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {competitiveIntel.map((c) => (
                  <div key={c.competitor} className="p-3 rounded-lg" style={{ border: `1px solid ${tokens.borderFaint}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{c.competitor}</p>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: threatColors[c.threat].bg, color: threatColors[c.threat].text }}>{c.threat} threat</span>
                    </div>
                    <p className="text-xs" style={{ color: tokens.text.secondary }}>{c.note}</p>
                    <Badge variant="outline" className="text-[10px] mt-1.5" style={{ borderColor: tokens.border.default, color: tokens.text.muted }}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Related Signals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: tokens.text.primary }}>
                <Target className="w-4 h-4" style={{ color: tokens.domain.opportunity }} /> Related Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {relatedSignals.map((sig, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: sig.confidence >= 85 ? tokens.confidence.high.value : tokens.confidence.medium.value }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: tokens.text.primary }}>{sig.title}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: tokens.text.muted }}>{sig.time} · {sig.confidence}% confidence</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
