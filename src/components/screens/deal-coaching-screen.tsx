'use client';

import { useState } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Target,
  Shield,
  MessageSquare,
  Lightbulb,
  TrendingUp,
  Swords,
  MapPin,
  ChevronRight,
  Bot,
  Award,
  Zap,
  Handshake,
} from 'lucide-react';

const DEALS = {
  'acme-enterprise': {
    name: 'Acme Corp — Enterprise Platform',
    value: '$850,000',
    stage: 'Negotiation',
    closeDate: 'Jan 31, 2025',
    probability: '65%',
    context: 'Acme is evaluating our platform against Competitor A. They are 34 days into negotiation. Budget approval has been delayed by CFO review. The champion (Michael Torres, VP Engineering) is strong but needs executive sponsorship. The incumbent (Competitor A) recently renewed a 2-year contract, creating urgency to establish POC before renewal locks in.',
    tips: [
      { icon: Target, title: 'Focus on CFO Concerns', advice: 'The CFO review is the primary blocker. Prepare a detailed ROI analysis with payback period under 12 months. Include TCO comparison showing 35% savings vs. Competitor A over 3 years.' },
      { icon: Shield, title: 'Address Security Early', advice: 'Competitor A will position their 2-year renewal as lower risk. Proactively share SOC2 Type II, GDPR compliance docs, and data residency guarantees before they become objections.' },
      { icon: Handshake, title: 'Leverage Michael as Champion', advice: 'Michael Torres has presented an internal case study on platform consolidation. Arm him with a one-pager he can share with the CEO and CFO. Offer to co-present in the next executive review.' },
      { icon: Zap, title: 'Create Urgency', advice: 'Propose a limited-time POC with dedicated implementation team. Frame it as "start before budget cycle" to beat Q2 competitor lock-in risk.' },
      { icon: Award, title: 'Differentiate on AI Capabilities', advice: 'Acme is actively hiring ML Engineers. Position our AI/ML module as a unique differentiator that Competitor A lacks. Demo predictive analytics on their actual data.' },
    ],
    competitive: 'Competitor A (incumbent) renewed 2-year contract. Key weakness: limited AI capabilities, slow product velocity. Competitor B (evaluation) has stronger AI but lacks enterprise compliance certifications.',
    nextSteps: [
      'Schedule joint call with Michael Torres and CFO for ROI presentation',
      'Send SOC2 + GDPR compliance documentation package',
      'Prepare AI/ML module demo with Acme-specific use cases',
      'Propose 30-day POC with defined success criteria',
      'Request executive sponsor introduction through Michael',
    ],
    talkingPoints: [
      'Our platform reduced consolidation costs by 35% for similar enterprise clients',
      'AI/ML module can be operational within 4 weeks — faster than any competitor',
      'Dedicated implementation team with 98% on-time deployment record',
      'Flexible pricing that scales with Acme\'s growth trajectory',
      'Michael\'s internal case study already validated the technical fit',
    ],
  },
  'nexus-fintech': {
    name: 'Nexus Technologies — Fintech Suite',
    value: '$420,000',
    stage: 'Proposal',
    closeDate: 'Feb 28, 2025',
    probability: '45%',
    context: 'Nexus recently closed Series C ($45M) and is expanding sales team by 40%. COO departure creates leadership instability. Multi-stakeholder buying committee (CEO + CRO + CTO). Currently evaluating 3 vendors including us. The bank partnership requires enterprise-grade compliance.',
    tips: [
      { icon: Target, title: 'Target CRO as Decision Maker', advice: 'With COO departure, CRO (Priya Sharma) is the key decision maker for sales tech investments. Tailor value proposition around revenue acceleration and pipeline visibility — her core KPIs.' },
      { icon: Shield, title: 'Address Leadership Instability', advice: 'The COO departure is a risk factor. Position our platform as reducing single-point-of-failure dependencies. Show how workflow automation reduces reliance on individual operators.' },
      { icon: MessageSquare, title: 'Multi-Stakeholder Strategy', advice: 'CEO cares about growth metrics. CRO cares about pipeline. CTO cares about integration. Create three versions of the proposal, each speaking to their specific priorities.' },
      { icon: Zap, title: 'Compliance as Differentiator', advice: 'Their bank partnership requires SOC2 + GDPR. We have both certified. Competitor C (cheapest option) only has SOC2. This is a deal-breaker for fintech-bank partnerships.' },
    ],
    competitive: 'Competitor C is 30% cheaper but lacks GDPR certification. Competitor A has strongest brand but 6-month implementation timeline. Our advantage: compliance + speed + growth-focused analytics.',
    nextSteps: [
      'Schedule separate discovery calls with CRO, CEO, and CTO',
      'Prepare bank partnership compliance documentation',
      'Create 3 tailored proposal versions for each stakeholder',
      'Offer implementation timeline of 8 weeks (vs. competitor\'s 24 weeks)',
      'Request intro to bank partnership technical team for integration scoping',
    ],
    talkingPoints: [
      '8-week implementation vs. industry average of 16 weeks',
      'Bank-grade compliance already certified — no remediation needed',
      'Revenue analytics dashboard can show ROI within first quarter',
      'Scales with their 40% sales team expansion without re-architecture',
      'References from 3 fintech clients with similar bank partnerships',
    ],
  },
  'vertex-startup': {
    name: 'Vertex Solutions — Growth Package',
    value: '$96,000',
    stage: 'Discovery',
    closeDate: 'Mar 31, 2025',
    probability: '30%',
    context: 'Early-stage startup (120 employees) preparing Series A. First sales hire just started. Product-market fit is validated (Gartner Cool Vendor). Budget is constrained until funding closes. Key engineer departed to FAANG — technical talent risk. Need to build relationship before Series A closes and they get vendor-bombed.',
    tips: [
      { icon: Lightbulb, title: 'Land Before Funding', advice: 'Engage now with a free/low-cost pilot. Post-Series A they will be approached by dozens of vendors. First-mover advantage in establishing the relationship is critical.' },
      { icon: Target, title: 'Focus on Sam Rivera', advice: 'Sam Rivera is building the entire sales process from scratch. Position as a "GTM partner" not just a vendor. Help shape their sales infrastructure — that creates lock-in.' },
      { icon: TrendingUp, title: 'Technical Credibility', advice: 'CTO Marcus Johnson is technical co-founder. Lead with technical depth, not sales pitches. Show architecture docs, API-first approach, and how we handle their specific infrastructure challenges.' },
    ],
    competitive: 'No active competition yet — they are early in evaluation. Risk: they may build in-house with their strong engineering team. Mitigate by showing time-to-value of buying vs. building.',
    nextSteps: [
      'Offer free pilot with 5-user license for their new sales team',
      'Schedule technical deep-dive with Marcus Johnson',
      'Send Gartner Cool Vendor congrats note to build warmth',
      'Create "Build vs. Buy" analysis showing 6-month faster time-to-value',
      'Connect Sam Rivera with our Customer Success team for GTM best practices',
    ],
    talkingPoints: [
      'Build vs. Buy analysis: 6 months faster to revenue with our platform',
      'Designed for high-growth startups — scales from 5 to 500 users seamlessly',
      'API-first architecture fits their developer-heavy culture',
      'Free pilot lets you validate before committing budget',
      'We\'ve helped 12 startups scale from Series A to B with our platform',
    ],
  },
};

export default function DealCoaching() {
  const [selectedDeal, setSelectedDeal] = useState<string>('acme-enterprise');
  const deal = DEALS[selectedDeal as keyof typeof DEALS];

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: tokens.text.muted }}>
        <p>Select a deal to view coaching advice</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bot className="size-6" style={{ color: tokens.domain.value }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>AI Deal Coaching</h1>
            <p className="text-sm" style={{ color: tokens.text.secondary }}>AI-powered deal strategy and coaching</p>
          </div>
        </div>
        <Select value={selectedDeal} onValueChange={setSelectedDeal}>
          <SelectTrigger className="w-full sm:w-[300px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DEALS).map(([key, d]) => (
              <SelectItem key={key} value={key}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Deal Context */}
      <Card className="gap-4 py-4" style={{ borderLeft: `4px solid ${tokens.domain.value}` }}>
        <CardHeader className="pb-0 pt-0 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Deal Context</CardTitle>
            <div className="flex items-center gap-2">
              <Badge style={{ backgroundColor: tokens.domain.bg, color: tokens.domain.value }}>{deal.stage}</Badge>
              <Badge style={{ backgroundColor: tokens.confidence.high.bg, color: tokens.confidence.high.value }}>{deal.probability} close</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><p className="text-xs" style={{ color: tokens.text.muted }}>Deal Value</p><p className="text-lg font-bold" style={{ color: tokens.text.primary }}>{deal.value}</p></div>
            <div><p className="text-xs" style={{ color: tokens.text.muted }}>Target Close</p><p className="text-lg font-bold" style={{ color: tokens.text.primary }}>{deal.closeDate}</p></div>
            <div><p className="text-xs" style={{ color: tokens.text.muted }}>Stage</p><p className="text-lg font-bold" style={{ color: tokens.text.primary }}>{deal.stage}</p></div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: tokens.text.secondary }}>{deal.context}</p>
        </CardContent>
      </Card>

      {/* Coaching Tips */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: tokens.text.primary }}>
          <Lightbulb className="size-4" style={{ color: tokens.domain.value }} />
          AI Coaching Tips
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {deal.tips.map((tip, idx) => (
            <Card key={idx} className="gap-4 py-4 hover:shadow-md transition-shadow">
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.domain.bg }}>
                    <tip.icon className="size-4" style={{ color: tokens.domain.value }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{tip.title}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: tokens.text.secondary }}>{tip.advice}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competitive Intel */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Swords className="size-4" style={{ color: tokens.confidence.low.value }} />
              Competitive Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed" style={{ color: tokens.text.secondary }}>{deal.competitive}</p>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="size-4" style={{ color: tokens.accent.primary }} />
              Recommended Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {deal.nextSteps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <ChevronRight className="size-4 mt-0.5 shrink-0" style={{ color: tokens.accent.primary }} />
                <span className="text-sm" style={{ color: tokens.text.secondary }}>{step}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Talking Points */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="size-4" style={{ color: tokens.confidence.high.value }} />
            Suggested Talking Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {deal.talkingPoints.map((point, idx) => (
              <Badge key={idx} className="text-xs py-1.5 px-3 font-normal" style={{ backgroundColor: tokens.surface.secondary, color: tokens.text.primary, border: `1px solid ${tokens.border.default}` }}>
                {point}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
