'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  FileText, Users, MessageSquare, TrendingUp, Plus, Sparkles, Eye, Mail, Pencil,
  ChevronRight, Brain, Target, Shield, ArrowRight, Lightbulb, X, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition, AnimatedCounter, EmptyState, StatCard, StaggerGrid, StaggerItem,
} from '@/components/ui/animated-components';

/* ── Types ── */
type PlanStatus = 'Draft' | 'Ready' | 'Sent';
type Approach = 'Direct' | 'Warm Intro' | 'Event-based' | 'Referral';

interface ConversationPlan {
  id: string;
  company: string;
  executive: string;
  role: string;
  avatar: string;
  whatMatters: string[];
  suggestedOpening: string;
  topicsToAvoid: string[];
  approach: Approach;
  status: PlanStatus;
  confidence: number;
  reasoning: {
    why: string;
    signals: string[];
    relationshipContext: string;
  };
}

/* ── Demo Data ── */
const PLANS: ConversationPlan[] = [
  {
    id: 'cp-1',
    company: 'ABC Manufacturing',
    executive: 'Sarah Chen',
    role: 'Chief Technology Officer',
    avatar: 'SC',
    whatMatters: [
      'Reducing production downtime through predictive maintenance',
      'Integrating legacy systems with modern cloud infrastructure',
      'Demonstrating measurable ROI within 6 months to the board',
    ],
    suggestedOpening:
      'Sarah, I noticed ABC Manufacturing recently announced a $12M investment in smart factory initiatives. Our predictive maintenance platform helped Pinnacle Industrial cut unplanned downtime by 34% in their first quarter — I\'d love to share how that approach could align with your roadmap.',
    topicsToAvoid: [
      'Long-term multi-year contracts — they prefer 90-day pilot commitments',
    ],
    approach: 'Direct',
    status: 'Ready',
    confidence: 92,
    reasoning: {
      why: 'Sarah has publicly spoken about AI-driven manufacturing at two industry conferences this quarter. Her LinkedIn activity shows engagement with predictive analytics content. The direct approach is recommended because she values data-driven outreach and has a track record of responding to ROI-focused pitches.',
      signals: [
        'Published article in IndustryWeek on AI transformation (Nov 2024)',
        'ABC Manufacturing posted CTO job listing mentioning "AI/ML strategy"',
        'Attended Manufacturing Tech Summit — listed AI adoption as #1 priority',
      ],
      relationshipContext: 'No prior direct contact, but your VP of Engineering, Mark Torres, and Sarah overlapped at Siemens for 3 years. This shared background can be referenced for credibility.',
    },
  },
  {
    id: 'cp-2',
    company: 'XYZ Bank',
    executive: 'Michael Torres',
    role: 'Chief Information Officer',
    avatar: 'MT',
    whatMatters: [
      'Modernizing legacy core banking systems without disrupting operations',
      'Compliance with evolving data residency and SOX requirements',
      'Building an internal data platform that reduces vendor lock-in',
    ],
    suggestedOpening:
      'Michael, XYZ Bank\'s Q3 earnings call highlighted data infrastructure as a strategic priority. We recently helped a top-20 regional bank migrate 80% of their data platform to a modern stack with zero compliance incidents during the transition.',
    topicsToAvoid: [
      'Blockchain or crypto-related solutions — the bank has explicitly deprioritized these',
      'Comparisons to neobanks — Michael has pushed back on "disruptor" framing',
    ],
    approach: 'Warm Intro',
    status: 'Draft',
    confidence: 84,
    reasoning: {
      why: 'A warm introduction is recommended because enterprise banking CIOs are highly guarded. Our mutual connection David Park (XYZ Bank Board Advisor) has agreed to make an email introduction. Michael\'s recent Gartner symposium attendance suggests he\'s in active evaluation mode for data platform vendors.',
      signals: [
        'Gartner Symposium attendee — registered for "Data & Analytics" track',
        'XYZ Bank RFP for data platform modernization leaked to industry contacts',
        'Michael\'s team posted 3 senior data engineering roles in the last 60 days',
      ],
      relationshipContext: 'David Park (Board Advisor) is a warm introduction path. Additionally, your company presented at FinTech Innovation Day where XYZ Bank was a sponsor, providing event-based context for name recognition.',
    },
  },
  {
    id: 'cp-3',
    company: 'DEF Energy',
    executive: 'Priya Sharma',
    role: 'VP of Digital Transformation',
    avatar: 'PS',
    whatMatters: [
      'Cloud migration that maintains OT/IT security boundaries',
      'Real-time operational dashboards for field operations',
      'Sustainability reporting automation tied to ESG commitments',
    ],
    suggestedOpening:
      'Priya, DEF Energy\'s sustainability report showed impressive progress on Scope 2 emissions. Our real-time carbon tracking platform integrates directly with operational systems — we helped Equinor automate 40% of their ESG reporting workflow while improving data accuracy.',
    topicsToAvoid: [
      'Generic "digital transformation" messaging — she finds it oversaturated',
      'Assumptions about their AWS vs Azure preference — they use a hybrid model',
    ],
    approach: 'Event-based',
    status: 'Sent',
    confidence: 78,
    reasoning: {
      why: 'Event-based engagement is optimal here. Priya is a confirmed speaker at the upcoming Energy Digital Summit in March. Reaching out around this event provides natural context and positions the conversation as industry-relevant rather than cold outreach.',
      signals: [
        'Confirmed speaker at Energy Digital Summit (March 2025)',
        'DEF Energy\'s investor deck mentions $8M digital budget allocation',
        'Priya recently followed your company\'s CTO on LinkedIn',
      ],
      relationshipContext: 'You met briefly at last year\'s Energy Tech Forum during a panel break. No follow-up was made, so this can be referenced as a reconnection point. Her team has also downloaded two of your whitepapers in the past 90 days.',
    },
  },
  {
    id: 'cp-4',
    company: 'GHI Logistics',
    executive: 'James O\'Brien',
    role: 'Chief Operating Officer',
    avatar: 'JO',
    whatMatters: [
      'Warehouse automation ROI with clear labor cost reduction metrics',
      'Scalability across 23 distribution centers without custom deployments',
      'Integration with existing WMS and TMS platforms',
    ],
    suggestedOpening:
      'James, GHI Logistics\' expansion into the Southeast region is a bold move. Our warehouse automation solution deploys in under 6 weeks and has helped logistics companies achieve a 28% reduction in pick-and-pack cycle times across multi-site operations.',
    topicsToAvoid: [
      'Robotics or physical automation — GHI is focused on software-led optimization',
      'Mentioning competitors by name in any capacity',
    ],
    approach: 'Referral',
    status: 'Ready',
    confidence: 87,
    reasoning: {
      why: 'A referral-based approach is strongest here. Tomás Rivera, COO of Pacific Freight (a current customer), is a former colleague of James from their DHL days. Tomás has offered to provide a reference, and James places high value on peer recommendations for vendor evaluation.',
      signals: [
        'GHI Logistics opened 3 new distribution centers in Q4 2024',
        'James posted about "efficiency at scale" on LinkedIn last month',
        'GHI\'s latest job postings include "Automation Specialist" roles',
      ],
      relationshipContext: 'Strong referral path through Tomás Rivera (Pacific Freight COO, customer, and former DHL colleague of James). Tomás reported a 31% efficiency gain using your platform and is willing to serve as a reference. No direct contact history with James.',
    },
  },
];

const APPROACH_STYLES: Record<Approach, { bg: string; text: string; border: string }> = {
  Direct:       { bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200' },
  'Warm Intro': { bg: 'bg-blue-50',     text: 'text-blue-700',     border: 'border-blue-200' },
  'Event-based':{ bg: 'bg-purple-50',   text: 'text-purple-700',   border: 'border-purple-200' },
  Referral:     { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200' },
};

const STATUS_STYLES: Record<PlanStatus, { bg: string; text: string; dot: string }> = {
  Draft: { bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400' },
  Ready: { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500' },
  Sent:  { bg: 'bg-emerald-50',  text: 'text-emerald-700',  dot: 'bg-emerald-500' },
};

/* ── Component ── */
export default function ConversationStudioScreen({ navigateTo }: { navigateTo?: (screen: string, id?: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = PLANS.find(p => p.id === selectedId) ?? null;

  return (
    <PageTransition className="h-full flex flex-col">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Conversation Studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI-powered executive engagement preparation</p>
        </div>
        <Button
          onClick={() => {}}
          className="gap-2 font-semibold text-sm shadow-sm"
          style={{ background: '#D4AF37', color: '#fff', border: 'none' }}
        >
          <Plus className="w-4 h-4" /> New Conversation Plan
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 py-6 space-y-6">
          {/* ─── Quick Stats Row ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Plans Created" value={24} icon={FileText} color="#D4AF37" delay={0} />
            <StatCard label="Executives Researched" value={87} icon={Users} color="#D4AF37" delay={0.05} />
            <StatCard label="Conversations Active" value={12} icon={MessageSquare} color="#D4AF37" delay={0.1} />
            <StatCard label="Success Rate" value="73%" icon={TrendingUp} color="#10b981" delay={0.15} />
          </div>

          {/* ─── Main Content: Cards + AI Panel ─── */}
          <div className="flex gap-6 items-start">
            {/* Plan Cards */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: '#D4AF37' }} />
                <h2 className="text-sm font-semibold text-foreground">AI-Generated Conversation Plans</h2>
                <Badge variant="secondary" className="ml-1 text-xs font-medium">{PLANS.length} active</Badge>
              </div>

              <StaggerGrid className="space-y-4" stagger={0.08}>
                {PLANS.map((plan) => (
                  <StaggerItem key={plan.id}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2 }}
                      className={`bg-white border rounded-xl shadow-sm p-5 cursor-pointer transition-shadow duration-200 hover:shadow-md ${
                        selectedId === plan.id ? 'ring-2 ring-[#D4AF37]/40 border-[#D4AF37]/30' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedId(selectedId === plan.id ? null : plan.id)}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg, #D4AF37, #9A8340)' }}
                          >
                            {plan.avatar}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{plan.executive}</p>
                            <p className="text-xs text-muted-foreground">{plan.role}</p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">{plan.company}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <Badge className={`text-[11px] font-medium ${APPROACH_STYLES[plan.approach].bg} ${APPROACH_STYLES[plan.approach].text} border ${APPROACH_STYLES[plan.approach].border}`}>
                            {plan.approach}
                          </Badge>
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[plan.status].bg} ${STATUS_STYLES[plan.status].text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[plan.status].dot}`} />
                            {plan.status}
                          </span>
                        </div>
                      </div>

                      {/* What matters */}
                      <div className="mb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">What matters to them</p>
                        <ul className="space-y-1">
                          {plan.whatMatters.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                              <Target className="w-3 h-3 mt-0.5 shrink-0" style={{ color: '#D4AF37' }} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Suggested Opening */}
                      <div className="mb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Suggested Opening</p>
                        <p className="text-xs text-foreground/80 leading-relaxed italic bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                          &ldquo;{plan.suggestedOpening}&rdquo;
                        </p>
                      </div>

                      {/* Topics to Avoid */}
                      <div className="mb-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-red-500/70 mb-1">Topics to Avoid</p>
                        <div className="flex flex-wrap gap-1.5">
                          {plan.topicsToAvoid.map((topic, i) => (
                            <span key={i} className="text-[11px] bg-red-50 text-red-600 border border-red-100 rounded-md px-2 py-0.5 flex items-center gap-1">
                              <Shield className="w-3 h-3" /> {topic}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 font-medium" onClick={(e) => { e.stopPropagation(); }}>
                          <Eye className="w-3 h-3" /> View Plan
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 font-medium" onClick={(e) => { e.stopPropagation(); }}>
                          <Mail className="w-3 h-3" /> Generate Email
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 font-medium text-muted-foreground" onClick={(e) => { e.stopPropagation(); }}>
                          <Pencil className="w-3 h-3" /> Edit
                        </Button>
                        <div className="ml-auto">
                          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${selectedId === plan.id ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </motion.div>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            </div>

            {/* ─── AI Reasoning Panel ─── */}
            <div className="hidden xl:block w-[380px] shrink-0">
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm sticky top-6 overflow-hidden"
                  >
                    {/* Panel Header */}
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.06), rgba(212,175,55,0.02))' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.12)' }}>
                          <Brain className="w-4 h-4" style={{ color: '#D4AF37' }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">AI Reasoning</p>
                          <p className="text-[11px] text-muted-foreground">Why this approach works</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedId(null)} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Confidence Score */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence Score</span>
                          <span className="text-lg font-bold tabular-nums" style={{ color: selected.confidence >= 85 ? '#10b981' : '#D4AF37' }}>
                            {selected.confidence}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: selected.confidence >= 85
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : 'linear-gradient(90deg, #D4AF37, #E8C860)',
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${selected.confidence}%` }}
                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Why This Approach */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Lightbulb className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Why This Approach</p>
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed">{selected.reasoning.why}</p>
                      </div>

                      <Separator />

                      {/* Key Signals */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Zap className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Key Signals</p>
                        </div>
                        <ul className="space-y-2">
                          {selected.reasoning.signals.map((signal, i) => (
                            <motion.li
                              key={i}
                              initial={{ opacity: 0, x: 8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 + i * 0.08 }}
                              className="flex items-start gap-2 text-xs text-foreground/80"
                            >
                              <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" style={{ color: '#D4AF37' }} />
                              <span>{signal}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>

                      <Separator />

                      {/* Relationship Context */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Users className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Relationship Context</p>
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed">{selected.reasoning.relationshipContext}</p>
                      </div>

                      <Separator />

                      {/* CTA */}
                      <Button
                        className="w-full gap-2 text-sm font-semibold shadow-sm"
                        style={{ background: '#D4AF37', color: '#fff', border: 'none' }}
                        onClick={() => {}}
                      >
                        <Mail className="w-4 h-4" /> Generate Outreach Email
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty-panel"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center sticky top-6"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Brain className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">AI Reasoning Panel</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Select a conversation plan to see the AI&apos;s reasoning, confidence score, and key signals behind each recommendation.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </ScrollArea>
    </PageTransition>
  );
}