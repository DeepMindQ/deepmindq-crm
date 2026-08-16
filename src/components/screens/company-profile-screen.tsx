'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Globe,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Zap,
  BrainCircuit,
  FileText,
  Loader2,
  ExternalLink,
  TrendingUp,
  ArrowRight,
  Network,
  Clock,
  Star,
} from 'lucide-react';

const company = {
  name: 'Acme Corp',
  domain: 'acmecorp.com',
  industry: 'SaaS',
  score: 92,
  employees: 485,
  revenue: '$124M',
  founded: '2014',
  hq: 'San Francisco, CA',
  description:
    'Enterprise AI-powered analytics platform helping Fortune 500 companies optimize operations.',
};

const briefingSummary = {
  priority: 'High Priority Account',
  keyInsight:
    'Expansion signals detected — hiring surge + new office lease indicate 40% growth planned for Q2. New CRO hired from Salesforce likely to revamp go-to-market.',
  recommendation: 'Engage with infrastructure and cloud solutions. Decision window: 30–60 days.',
  risk: 'Competitive pressure from Vertex AI and NovaTech entering same market segment.',
};

const relationships = [
  { company: 'CloudFlare', type: 'Partner', strength: 'Strong' },
  { company: 'AWS', type: 'Vendor', strength: 'Strong' },
  { company: 'Salesforce', type: 'Competitor', strength: '—' },
  { company: 'Datadog', type: 'Partner', strength: 'Moderate' },
  { company: 'Snowflake', type: 'Vendor', strength: 'Moderate' },
];

const timeline = [
  {
    time: '2d ago',
    event: 'Intelligence score updated to 92 (+5)',
    icon: TrendingUp,
    color: '#16A34A',
  },
  { time: '5d ago', event: 'New signal: 12 engineering roles posted', icon: Zap, color: '#2563EB' },
  { time: '1w ago', event: 'Maria Garcia added as CRO', icon: Users, color: '#a78bfa' },
  {
    time: '2w ago',
    event: 'Partnership with CloudFlare detected',
    icon: Network,
    color: '#D97706',
  },
  { time: '3w ago', event: 'ML module v3.0 launched', icon: Star, color: '#059669' },
  {
    time: '1mo ago',
    event: 'Company profile enriched with financial data',
    icon: FileText,
    color: tokens.text.secondary,
  },
];

function ScoreRing({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626';
  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={tokens.border.default}
          strokeWidth="7"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px]" style={{ color: tokens.text.muted }}>
          score
        </span>
      </div>
    </div>
  );
}

function StrengthBadge({ strength }: { strength: string }) {
  if (strength === 'Strong')
    return (
      <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400">{strength}</Badge>
    );
  if (strength === 'Moderate')
    return <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-400">{strength}</Badge>;
  return <Badge variant="outline">{strength || '—'}</Badge>;
}

export default function CompanyProfile() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="rounded-xl p-3 flex items-center justify-center"
            style={{ backgroundColor: tokens.accent.subtle }}
          >
            <Building2 className="size-8" style={{ color: tokens.accent.primary }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: tokens.text.primary }}
            >
              {company.name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span
                className="text-sm flex items-center gap-1"
                style={{ color: tokens.text.secondary }}
              >
                <Globe className="size-3.5" /> {company.domain}
              </span>
              <Badge variant="outline">{company.industry}</Badge>
              <a
                href="#"
                className="text-sm flex items-center gap-1 hover:underline"
                style={{ color: tokens.accent.primary }}
              >
                <ExternalLink className="size-3" /> Website
              </a>
            </div>
          </div>
        </div>
        <ScoreRing score={company.score} />
      </div>

      {/* Intelligence Briefing Summary */}
      <Card className="py-0 gap-0 border-l-4" style={{ borderLeftColor: tokens.accent.primary }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit className="size-4" style={{ color: tokens.accent.primary }} />
            <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
              Intelligence Briefing
            </h2>
            <Badge className="border-red-500/40 bg-red-500/15 text-red-400">
              {briefingSummary.priority}
            </Badge>
          </div>
          <p className="text-sm mb-3" style={{ color: tokens.text.secondary }}>
            {briefingSummary.keyInsight}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-md p-3" style={{ backgroundColor: tokens.confidence.high.bg }}>
              <p
                className="text-xs font-medium mb-0.5"
                style={{ color: tokens.confidence.high.value }}
              >
                Recommendation
              </p>
              <p className="text-xs" style={{ color: tokens.text.secondary }}>
                {briefingSummary.recommendation}
              </p>
            </div>
            <div className="rounded-md p-3" style={{ backgroundColor: tokens.confidence.low.bg }}>
              <p
                className="text-xs font-medium mb-0.5"
                style={{ color: tokens.confidence.low.value }}
              >
                Risk
              </p>
              <p className="text-xs" style={{ color: tokens.text.secondary }}>
                {briefingSummary.risk}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Key Metrics */}
        <Card className="py-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Key Metrics</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {[
              { label: 'Employees', value: company.employees.toLocaleString(), icon: Users },
              { label: 'Revenue', value: company.revenue, icon: DollarSign },
              { label: 'Founded', value: company.founded, icon: Calendar },
              { label: 'HQ', value: company.hq, icon: MapPin },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <m.icon className="size-4" style={{ color: tokens.text.muted }} />
                <div className="flex-1 flex justify-between">
                  <span className="text-sm" style={{ color: tokens.text.secondary }}>
                    {m.label}
                  </span>
                  <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                    {m.value}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Relationship Map */}
        <Card className="py-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Network className="size-3.5" /> Relationship Map
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {relationships.map((r) => (
              <div key={r.company} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="size-6 rounded flex items-center justify-center text-[9px] font-bold"
                    style={{
                      backgroundColor: tokens.surfaceExtended,
                      color: tokens.text.secondary,
                    }}
                  >
                    {r.company.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: tokens.text.primary }}>
                      {r.company}
                    </p>
                    <p className="text-[10px]" style={{ color: tokens.text.muted }}>
                      {r.type}
                    </p>
                  </div>
                </div>
                <StrengthBadge strength={r.strength} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card className="py-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Clock className="size-3.5" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="relative space-y-4">
              <div
                className="absolute left-[7px] top-2 bottom-2 w-px"
                style={{ backgroundColor: tokens.border.default }}
              />
              {timeline.map((item, i) => (
                <div key={i} className="flex items-start gap-3 relative">
                  <div
                    className="rounded-full p-0.5 z-10 shrink-0"
                    style={{ backgroundColor: item.color }}
                  >
                    <div className="size-3 rounded-full bg-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: tokens.text.primary }}>
                      {item.event}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: tokens.text.muted }}>
                      {item.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
