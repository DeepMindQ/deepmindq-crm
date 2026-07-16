'use client';

import { motion } from 'framer-motion';
import {
  Users, Heart, AlertTriangle, Activity, Plus, ArrowRight, Sparkles,
  Mail, Phone, MessageSquare, BookOpen, StickyNote, Clock,
} from 'lucide-react';
import { PageTransition, StatCard, StaggerGrid, StaggerItem, SectionHeader, GlassPanel } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ── Types ──────────────────────────────────────────── */
type InteractionType = 'Email Sent' | 'Meeting' | 'Call' | 'Research' | 'Note';

interface Contact {
  name: string;
  initials: string;
  color: string;
}

interface TimelineEntry {
  date: string;
  type: InteractionType;
  description: string;
  nextAction?: string;
}

interface CompanyTimeline {
  id: string;
  name: string;
  health: number;
  healthColor: 'green' | 'amber' | 'red';
  contacts: Contact[];
  interactions: TimelineEntry[];
}

interface RecommendedAction {
  company: string;
  person: string;
  action: string;
  reason: string;
  priority: 'high' | 'medium';
}

/* ── Demo Data ──────────────────────────────────────── */
const stats = [
  { label: 'Active Relationships', value: 47, icon: Users, color: '#D4AF37', trend: { value: '12%', up: true } },
  { label: 'Strong Connections', value: 28, icon: Heart, color: '#10B981', trend: { value: '8%', up: true } },
  { label: 'Need Attention', value: 6, icon: AlertTriangle, color: '#F59E0B', trend: { value: '3 new', up: false } },
  { label: 'Total Interactions', value: 312, icon: Activity, color: '#6366F1', trend: { value: '24 this week', up: true } },
];

const interactionIcons: Record<InteractionType, typeof Mail> = {
  'Email Sent': Mail,
  Meeting: MessageSquare,
  Call: Phone,
  Research: BookOpen,
  Note: StickyNote,
};

const interactionColors: Record<InteractionType, string> = {
  'Email Sent': 'bg-blue-50 text-blue-700 border-blue-200',
  Meeting: 'bg-purple-50 text-purple-700 border-purple-200',
  Call: 'bg-green-50 text-green-700 border-green-200',
  Research: 'bg-amber-50 text-amber-700 border-amber-200',
  Note: 'bg-gray-50 text-gray-700 border-gray-200',
};

const companyTimelines: CompanyTimeline[] = [
  {
    id: 'abc-mfg',
    name: 'ABC Manufacturing',
    health: 82,
    healthColor: 'green',
    contacts: [
      { name: 'Sarah Chen', initials: 'SC', color: '#6366F1' },
      { name: 'James Wright', initials: 'JW', color: '#0EA5E9' },
      { name: 'Maria Lopez', initials: 'ML', color: '#EC4899' },
    ],
    interactions: [
      { date: 'Jun 18, 2025', type: 'Research', description: 'Reviewed Q2 procurement strategy and expansion plans. Key pain point: supply chain visibility.' },
      { date: 'Jun 20, 2025', type: 'Email Sent', description: 'Sent industry benchmark report on supply chain optimization to Sarah Chen with personalized insights.' },
      { date: 'Jun 24, 2025', type: 'Meeting', description: 'Discovery call with Sarah & James — discussed current ERP limitations and timeline for evaluation.', nextAction: 'Send technical whitepaper on integration capabilities' },
    ],
  },
  {
    id: 'xyz-bank',
    name: 'XYZ Bank',
    health: 68,
    healthColor: 'green',
    contacts: [
      { name: 'David Park', initials: 'DP', color: '#10B981' },
      { name: 'Emma Wilson', initials: 'EW', color: '#F59E0B' },
    ],
    interactions: [
      { date: 'Jun 12, 2025', type: 'Note', description: 'Initial contact made at FinTech Summit. David expressed interest in risk analytics solutions.' },
      { date: 'Jun 17, 2025', type: 'Email Sent', description: 'Follow-up email with case study from similar financial institution. David confirmed interest in a demo.' },
      { date: 'Jun 25, 2025', type: 'Meeting', description: 'Proposal presentation scheduled for July 2 with David and Emma (Head of Compliance).', nextAction: 'Prepare customized demo environment with sample risk data' },
    ],
  },
  {
    id: 'def-energy',
    name: 'DEF Energy',
    health: 34,
    healthColor: 'red',
    contacts: [
      { name: 'Robert Hall', initials: 'RH', color: '#EF4444' },
      { name: 'Lisa Tran', initials: 'LT', color: '#8B5CF6' },
    ],
    interactions: [
      { date: 'May 28, 2025', type: 'Research', description: 'Researched DEF Energy\'s recent regulatory compliance challenges and sustainability reporting needs.' },
      { date: 'Jun 5, 2025', type: 'Email Sent', description: 'Sent introductory email to Robert Hall referencing their recent ESG report findings. No response received.' },
      { date: 'Jun 10, 2025', type: 'Call', description: 'Left voicemail for Robert. Followed up via LinkedIn — profile viewed but no reply.', nextAction: 'Reach out to Lisa Tran (VP Operations) as alternate point of contact' },
    ],
  },
  {
    id: 'ghi-tech',
    name: 'GHI Technologies',
    health: 55,
    healthColor: 'amber',
    contacts: [
      { name: 'Alex Kumar', initials: 'AK', color: '#0EA5E9' },
      { name: 'Nina Patel', initials: 'NP', color: '#D4AF37' },
      { name: 'Tom Bradley', initials: 'TB', color: '#10B981' },
    ],
    interactions: [
      { date: 'Jun 3, 2025', type: 'Meeting', description: 'Initial discovery meeting. Alex shared roadmap for data platform consolidation — potential $120K opportunity.' },
      { date: 'Jun 15, 2025', type: 'Email Sent', description: 'Sent detailed solution architecture and ROI projection. Nina requested security compliance documentation.' },
      { date: 'Jun 22, 2025', type: 'Note', description: 'Security docs delivered. Tom (CTO) reviewing. Decision expected by mid-July.', nextAction: 'Schedule technical deep-dive with Tom Bradley' },
    ],
  },
];

const recommendedActions: RecommendedAction[] = [
  {
    company: 'ABC Manufacturing',
    person: 'Sarah Chen',
    action: 'Send technical whitepaper on ERP integration',
    reason: 'Follow-up from Jun 24 discovery call — 4 days overdue',
    priority: 'high',
  },
  {
    company: 'DEF Energy',
    person: 'Lisa Tran',
    action: 'Introductory outreach email via alternative contact',
    reason: 'Robert Hall unresponsive after 3 touchpoints',
    priority: 'high',
  },
  {
    company: 'GHI Technologies',
    person: 'Tom Bradley',
    action: 'Schedule technical deep-dive meeting',
    reason: 'Security docs delivered — capitalize on CTO engagement window',
    priority: 'medium',
  },
];

/* ── Helpers ────────────────────────────────────────── */
function healthBarColor(healthColor: string) {
  if (healthColor === 'green') return '#10B981';
  if (healthColor === 'amber') return '#F59E0B';
  return '#EF4444';
}

function HealthBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}CC)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-9 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

/* ── Component ──────────────────────────────────────── */
export default function RelationshipMemoryScreen({ navigateTo }: { navigateTo?: (screen: string, id?: string) => void }) {
  return (
    <PageTransition className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ── 1. Page Header ─────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Relationship Memory</h1>
          <p className="text-sm text-muted-foreground mt-1">Track every interaction. Never lose context.</p>
        </div>
        <Button
          onClick={() => navigateTo?.('interactions', 'new')}
          className="gap-2 font-medium shadow-sm"
          style={{ background: '#D4AF37', color: '#fff' }}
        >
          <Plus className="w-4 h-4" /> Add Interaction
        </Button>
      </div>

      {/* ── 2. Relationship Health Overview ─────────── */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.08}>
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            <StatCard label={s.label} value={s.value} icon={s.icon} color={s.color} trend={s.trend} />
          </StaggerItem>
        ))}
      </StaggerGrid>

      {/* ── 3 + 4. Main Content Grid ───────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Account Timelines (2/3) */}
        <div className="xl:col-span-2 space-y-5">
          <SectionHeader title="Account Relationship Timeline" subtitle="Recent interactions grouped by company" />

          <StaggerGrid className="space-y-5" stagger={0.1}>
            {companyTimelines.map((company) => (
              <StaggerItem key={company.id}>
                <GlassPanel className="p-5 space-y-4">
                  {/* Company header row */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => navigateTo?.('company', company.id)}
                      className="flex items-center gap-2 group"
                    >
                      <h3 className="text-base font-semibold text-foreground group-hover:underline underline-offset-2">
                        {company.name}
                      </h3>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <span className="text-xs text-muted-foreground">{company.contacts.length} contacts</span>
                  </div>

                  {/* Health bar */}
                  <HealthBar pct={company.health} color={healthBarColor(company.healthColor)} />

                  {/* Key contacts */}
                  <div className="flex items-center gap-2">
                    {company.contacts.map((c) => (
                      <div key={c.name} className="flex items-center gap-1.5 bg-gray-50 rounded-full pl-1 pr-3 py-1">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: c.color }}
                        >
                          {c.initials}
                        </span>
                        <span className="text-xs text-foreground font-medium">{c.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Interaction timeline */}
                  <div className="relative pl-5 border-l-2 border-gray-100 space-y-4 mt-2">
                    {company.interactions.map((entry, idx) => {
                      const Icon = interactionIcons[entry.type];
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.08, duration: 0.4 }}
                          className="relative"
                        >
                          {/* Timeline dot */}
                          <div
                            className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white"
                            style={{ background: healthBarColor(company.healthColor) }}
                          />

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground font-medium">{entry.date}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${interactionColors[entry.type]}`}>
                                <Icon className="w-3 h-3 mr-1" />
                                {entry.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed">{entry.description}</p>
                            {entry.nextAction && (
                              <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 w-fit">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span className="text-xs text-amber-800 font-medium">Next Action: {entry.nextAction}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </GlassPanel>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>

        {/* Right: AI Next Best Action Panel (1/3) */}
        <div className="space-y-5">
          <SectionHeader title="Today's Recommended Actions" subtitle="AI-prioritized based on relationship signals" />

          <GlassPanel
            className="p-5 space-y-4"
            style={{ borderColor: 'rgba(212, 175, 55, 0.3)' }}
          >
            {/* Panel header accent */}
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212, 175, 55, 0.12)' }}>
                <Sparkles className="w-4 h-4" style={{ color: '#D4AF37' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Smart Suggestions</p>
                <p className="text-[11px] text-muted-foreground">{recommendedActions.length} actions for today</p>
              </div>
            </div>

            {recommendedActions.map((rec, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.1, duration: 0.4 }}
                className="group relative p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all bg-white space-y-2.5"
              >
                {/* Priority indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      background: rec.priority === 'high' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                      color: rec.priority === 'high' ? '#DC2626' : '#D97706',
                    }}
                  >
                    {rec.priority} priority
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">{rec.company}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Contact: {rec.person}</p>
                </div>

                <p className="text-sm text-foreground leading-relaxed">{rec.action}</p>

                <p className="text-[11px] text-muted-foreground italic">{rec.reason}</p>

                <Button
                  size="sm"
                  className="w-full mt-1 text-xs font-medium gap-1.5"
                  variant="outline"
                  onClick={() => navigateTo?.('company', companyTimelines.find(c => c.name === rec.company)?.id)}
                >
                  Do It <ArrowRight className="w-3 h-3" />
                </Button>
              </motion.div>
            ))}
          </GlassPanel>

          {/* Quick stats mini-card */}
          <GlassPanel className="p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">This Week</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Emails Sent', value: '12', color: '#6366F1' },
                { label: 'Meetings', value: '4', color: '#10B981' },
                { label: 'Calls Made', value: '7', color: '#0EA5E9' },
                { label: 'Notes Added', value: '9', color: '#D4AF37' },
              ].map((item) => (
                <div key={item.label} className="text-center p-2 rounded-lg bg-gray-50">
                  <p className="text-lg font-bold tabular-nums" style={{ color: item.color }}>{item.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>
    </PageTransition>
  );
}