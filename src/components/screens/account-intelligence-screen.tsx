'use client';

import { useState, useMemo } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Users,
  DollarSign,
  Zap,
  TrendingUp,
  Lightbulb,
  Signal,
  User,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const COMPANIES = {
  acme: {
    name: 'Acme Corporation',
    industry: 'Enterprise SaaS',
    employees: 2400,
    revenue: '$180M ARR',
    score: 87,
    briefing:
      'Acme Corporation is a high-priority enterprise account actively investing in AI/ML capabilities. Recent CTO promotion signals strategic shift toward platform consolidation. Strong buying signals detected across engineering and product teams. Current tech stack shows gaps that align with our solution portfolio.',
    signals: [
      {
        id: '1',
        type: 'hiring',
        text: 'Posted 5 new ML Engineer roles — signals AI investment ramp-up',
        time: '2h ago',
        trend: 'up' as const,
      },
      {
        id: '2',
        type: 'leadership',
        text: 'Sarah Chen promoted to CTO with platform consolidation mandate',
        time: '1d ago',
        trend: 'up' as const,
      },
      {
        id: '3',
        type: 'tech',
        text: 'New GCP contract detected — expanding cloud infrastructure',
        time: '3d ago',
        trend: 'up' as const,
      },
      {
        id: '4',
        type: 'news',
        text: 'Won "Best AI Innovation" at enterprise tech summit',
        time: '5d ago',
        trend: 'up' as const,
      },
      {
        id: '5',
        type: 'risk',
        text: 'Competitor A renewed 2-year enterprise contract',
        time: '1w ago',
        trend: 'down' as const,
      },
    ],
    people: [
      { name: 'Sarah Chen', title: 'CTO', initials: 'SC' },
      { name: 'Michael Torres', title: 'VP Engineering', initials: 'MT' },
      { name: 'Lisa Park', title: 'Head of Product', initials: 'LP' },
      { name: 'David Kim', title: 'Director of IT', initials: 'DK' },
      { name: 'Rachel Foster', title: 'VP Sales', initials: 'RF' },
    ],
    insights: [
      {
        title: 'Expansion Window',
        text: 'Customer uses only 3 of 8 available modules. Security and Analytics add-ons have highest propensity based on usage patterns.',
      },
      {
        title: 'Competitive Moat',
        text: 'Competitor A contract renewal through 2025 creates urgency. Need to establish POC before renewal cycle to displace.',
      },
      {
        title: 'Champion Identified',
        text: 'Michael Torres (VP Eng) is a strong internal champion. Recently presented internal case study on platform consolidation needs.',
      },
    ],
  },
  nexus: {
    name: 'Nexus Technologies',
    industry: 'Fintech',
    employees: 850,
    revenue: '$64M ARR',
    score: 72,
    briefing:
      'Nexus Technologies is a mid-market fintech company showing steady growth. Recent Series C funding ($45M) indicates expansion plans. Current technology evaluation underway for customer intelligence platform. Decision-making is collaborative but slow — multi-stakeholder approval required.',
    signals: [
      {
        id: '1',
        type: 'funding',
        text: 'Series C closed at $45M — expanding sales team by 40%',
        time: '4d ago',
        trend: 'up' as const,
      },
      {
        id: '2',
        type: 'tech',
        text: 'Evaluating 3 CRM vendors per job posting requirements',
        time: '1w ago',
        trend: 'up' as const,
      },
      {
        id: '3',
        type: 'hiring',
        text: 'Hiring RevOps Manager — signals sales process maturity push',
        time: '2w ago',
        trend: 'up' as const,
      },
      {
        id: '4',
        type: 'risk',
        text: 'COO departure announced — leadership instability risk',
        time: '2w ago',
        trend: 'down' as const,
      },
      {
        id: '5',
        type: 'news',
        text: 'Partnership with major bank announced — enterprise credibility boost',
        time: '3w ago',
        trend: 'up' as const,
      },
    ],
    people: [
      { name: 'James Wilson', title: 'CEO', initials: 'JW' },
      { name: 'Priya Sharma', title: 'CRO', initials: 'PS' },
      { name: 'Alex Rivera', title: 'VP Product', initials: 'AR' },
      { name: 'Nina Patel', title: 'Head of Sales', initials: 'NP' },
      { name: 'Tom Bradley', title: 'CTO (interim)', initials: 'TB' },
    ],
    insights: [
      {
        title: 'Timing Advantage',
        text: 'Series C funding creates 6-month window where budget is available and urgency to scale sales operations is high.',
      },
      {
        title: 'Decision Complexity',
        text: 'Multi-stakeholder buying committee (CEO + CRO + CTO). Need tailored value props for each role.',
      },
      {
        title: 'Integration Priority',
        text: 'Bank partnership requires enterprise-grade compliance. Our SOC2 + GDPR capabilities are key differentiators.',
      },
    ],
  },
  vertex: {
    name: 'Vertex Solutions',
    industry: 'Cloud Infrastructure',
    employees: 120,
    revenue: '$12M ARR',
    score: 54,
    briefing:
      'Vertex Solutions is an early-stage cloud infrastructure startup. Small team but high technical talent density. Currently bootstrapped with plans to raise Series A in Q1 2025. Product-market fit signals are mixed — strong technical reviews but limited go-to-market motion.',
    signals: [
      {
        id: '1',
        type: 'funding',
        text: 'Preparing Series A pitch deck — targeting $8-12M raise',
        time: '1d ago',
        trend: 'up' as const,
      },
      {
        id: '2',
        type: 'product',
        text: 'Launched v2.0 with 3x performance improvement',
        time: '5d ago',
        trend: 'up' as const,
      },
      {
        id: '3',
        type: 'hiring',
        text: 'First sales hire posted — signals GTM investment start',
        time: '1w ago',
        trend: 'up' as const,
      },
      {
        id: '4',
        type: 'risk',
        text: 'Key engineer departed to FAANG — talent risk',
        time: '2w ago',
        trend: 'down' as const,
      },
      {
        id: '5',
        type: 'news',
        text: 'Mentioned in Gartner "Cool Vendors" list',
        time: '3w ago',
        trend: 'up' as const,
      },
    ],
    people: [
      { name: 'Emily Zhang', title: 'CEO & Co-founder', initials: 'EZ' },
      { name: 'Marcus Johnson', title: 'CTO & Co-founder', initials: 'MJ' },
      { name: 'Chris Lee', title: 'Head of Engineering', initials: 'CL' },
      { name: 'Sam Rivera', title: 'First Sales Hire', initials: 'SR' },
      { name: 'Dana Kim', title: 'Product Lead', initials: 'DK' },
    ],
    insights: [
      {
        title: 'Early Engagement',
        text: 'Engaging now before Series A builds relationship early. Post-funding they will be bombarded by vendors.',
      },
      {
        title: 'Land-and-Expand',
        text: 'Free tier or pilot is essential. Budget will be constrained until funding closes. Focus on technical value prop.',
      },
      {
        title: 'GTM Partner',
        text: 'First sales hire (Sam Rivera) is building process from scratch. Opportunity to influence their entire sales stack.',
      },
    ],
  },
};

function getScoreColor(score: number) {
  if (score >= 80) return tokens.confidence.high.value;
  if (score >= 60) return tokens.confidence.medium.value;
  return tokens.confidence.low.value;
}

function getScoreBg(score: number) {
  if (score >= 80) return tokens.confidence.high.bg;
  if (score >= 60) return tokens.confidence.medium.bg;
  return tokens.confidence.low.bg;
}

function getSignalIcon(type: string) {
  switch (type) {
    case 'hiring':
      return <Users className="size-3.5" />;
    case 'funding':
      return <DollarSign className="size-3.5" />;
    case 'tech':
      return <Zap className="size-3.5" />;
    case 'leadership':
      return <User className="size-3.5" />;
    case 'news':
      return <TrendingUp className="size-3.5" />;
    case 'product':
      return <Lightbulb className="size-3.5" />;
    case 'risk':
      return <Shield className="size-3.5" />;
    default:
      return <Signal className="size-3.5" />;
  }
}

export default function AccountIntelligence() {
  const [selected, setSelected] = useState<string>('acme');
  const company = COMPANIES[selected as keyof typeof COMPANIES];

  if (!company) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: tokens.text.muted }}>
        <p>Select a company to view intelligence</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Account Intelligence
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Deep-dive intelligence for strategic accounts
          </p>
        </div>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <Building2 className="size-4 mr-2" style={{ color: tokens.text.muted }} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="acme">Acme Corporation</SelectItem>
            <SelectItem value="nexus">Nexus Technologies</SelectItem>
            <SelectItem value="vertex">Vertex Solutions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Intelligence Briefing */}
      <Card className="gap-4 py-4" style={{ borderLeft: `4px solid ${tokens.domain.value}` }}>
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="size-4" style={{ color: tokens.domain.value }} />
            Intelligence Briefing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed" style={{ color: tokens.text.secondary }}>
            {company.briefing}
          </p>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="gap-4 py-4">
          <CardContent className="flex items-center gap-3">
            <Users className="size-5" style={{ color: tokens.accent.primary }} />
            <div>
              <p className="text-xs" style={{ color: tokens.text.muted }}>
                Employees
              </p>
              <p className="text-xl font-bold" style={{ color: tokens.text.primary }}>
                {company.employees.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-4 py-4">
          <CardContent className="flex items-center gap-3">
            <DollarSign className="size-5" style={{ color: tokens.confidence.high.value }} />
            <div>
              <p className="text-xs" style={{ color: tokens.text.muted }}>
                Revenue
              </p>
              <p className="text-xl font-bold" style={{ color: tokens.text.primary }}>
                {company.revenue}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-4 py-4">
          <CardContent className="flex items-center gap-3">
            <Signal className="size-5" style={{ color: tokens.domain.value }} />
            <div>
              <p className="text-xs" style={{ color: tokens.text.muted }}>
                Active Signals
              </p>
              <p className="text-xl font-bold" style={{ color: tokens.text.primary }}>
                {company.signals.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-4 py-4">
          <CardContent className="flex items-center gap-3">
            <div
              className="text-xl font-bold rounded-lg px-2.5 py-0.5"
              style={{
                color: getScoreColor(company.score),
                backgroundColor: getScoreBg(company.score),
              }}
            >
              {company.score}
            </div>
            <div>
              <p className="text-xs" style={{ color: tokens.text.muted }}>
                Intelligence Score
              </p>
              <p className="text-sm font-medium" style={{ color: getScoreColor(company.score) }}>
                {company.score >= 80 ? 'High Priority' : company.score >= 60 ? 'Monitor' : 'Watch'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signals */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="size-4" style={{ color: tokens.gold.dark }} />
              Recent Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {company.signals.map((sig) => (
              <div
                key={sig.id}
                className="flex items-start gap-3 p-2.5 rounded-lg"
                style={{ backgroundColor: tokens.surface.secondary }}
              >
                <div
                  className="size-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    backgroundColor:
                      sig.trend === 'up' ? tokens.confidence.high.bg : tokens.confidence.low.bg,
                  }}
                >
                  {getSignalIcon(sig.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm" style={{ color: tokens.text.primary }}>
                    {sig.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: tokens.text.muted }}>
                      {sig.time}
                    </span>
                    {sig.trend === 'up' ? (
                      <ArrowUpRight
                        className="size-3"
                        style={{ color: tokens.confidence.high.value }}
                      />
                    ) : (
                      <ArrowDownRight
                        className="size-3"
                        style={{ color: tokens.confidence.low.value }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {/* People at Company */}
          <Card className="gap-4 py-4">
            <CardHeader className="pb-0 pt-0 px-6">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="size-4" style={{ color: tokens.accent.primary }} />
                Key People
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {company.people.map((person) => (
                <div
                  key={person.name}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Avatar className="size-8">
                    <AvatarFallback
                      className="text-xs"
                      style={{ backgroundColor: tokens.domain.bg, color: tokens.domain.value }}
                    >
                      {person.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                      {person.name}
                    </p>
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      {person.title}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top Insights */}
          <Card className="gap-4 py-4">
            <CardHeader className="pb-0 pt-0 px-6">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="size-4" style={{ color: tokens.domain.value }} />
                Top Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {company.insights.map((ins, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-1 p-3 rounded-lg"
                  style={{ border: `1px solid ${tokens.border.default}` }}
                >
                  <p className="text-sm font-semibold" style={{ color: tokens.domain.value }}>
                    {ins.title}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: tokens.text.secondary }}>
                    {ins.text}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
