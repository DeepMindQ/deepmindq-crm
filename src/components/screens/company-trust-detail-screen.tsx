'use client';

import { useState } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, Mail, Globe, Radio, TrendingUp, Lightbulb, Loader2,
  CheckCircle2, ArrowRight, Clock, Building2,
} from 'lucide-react';

const companyName = 'Acme Corp';
const overallScore = 78;

type DimKey = 'dataVerification' | 'emailDeliverability' | 'domainAuthority' | 'signalReliability';

const dimensions: { key: DimKey; label: string; score: number; icon: typeof ShieldCheck; color: string; detail: string }[] = [
  { key: 'dataVerification', label: 'Data Verification', score: 85, icon: ShieldCheck, color: '#16A34A', detail: '18 of 21 fields verified against authoritative sources' },
  { key: 'emailDeliverability', label: 'Email Deliverability', score: 92, icon: Mail, color: '#16A34A', detail: 'SPF, DKIM, DMARC all passing. Low bounce rate.' },
  { key: 'domainAuthority', label: 'Domain Authority', score: 71, icon: Globe, color: '#D97706', detail: 'Domain age 10yr. Moderate backlink profile.' },
  { key: 'signalReliability', label: 'Signal Reliability', score: 64, icon: Radio, color: '#D97706', detail: 'Mixed source reliability. 3 unverified signals.' },
];

const trustHistory = [
  { date: 'Jan 15', score: 78, event: 'Email deliverability improved (+4)' },
  { date: 'Jan 08', score: 74, event: 'New unverified signal detected (-2)' },
  { date: 'Jan 01', score: 76, event: 'Data verification updated (+1)' },
  { date: 'Dec 25', score: 75, event: 'Domain authority recalculation' },
  { date: 'Dec 18', score: 73, event: 'Initial trust assessment' },
];

const recommendations = [
  { priority: 'high', title: 'Verify pending signals', detail: '3 intelligence signals lack authoritative corroboration. Cross-reference with LinkedIn, Crunchbase, and SEC filings.', action: 'Review Signals' },
  { priority: 'high', title: 'Improve domain authority', detail: 'Current domain authority score is below industry average. Consider building more quality backlinks and improving SEO presence.', action: 'View Details' },
  { priority: 'medium', title: 'Enrich missing data fields', detail: 'Employee count, tech stack, and social profiles have partial data. Schedule a data enrichment batch.', action: 'Enrich Data' },
  { priority: 'low', title: 'Monitor signal freshness', detail: '2 signals are over 30 days old. Set up automated refresh for high-value accounts.', action: 'Configure' },
];

function PriorityBadge({ priority }: { priority: string }) {
  const cls: Record<string, string> = {
    high: 'border-red-500/40 bg-red-500/15 text-red-400',
    medium: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
    low: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
  };
  return <Badge className={cls[priority] || ''}>{priority}</Badge>;
}

function TrustScoreRing({ score }: { score: number }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626';
  const label = score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: 150, height: 150 }}>
        <svg width="150" height="150" className="-rotate-90">
          <circle cx="75" cy="75" r={radius} fill="none" stroke={tokens.border.default} strokeWidth="10" />
          <circle cx="75" cy="75" r={radius} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-1000" />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs" style={{ color: tokens.text.muted }}>out of 100</span>
        </div>
      </div>
      <Badge className={`${score >= 80 ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' : 'border-amber-500/40 bg-amber-500/15 text-amber-400'}`}>
        {label} Trust
      </Badge>
    </div>
  );
}

export default function CompanyTrustDetail() {
  const [loading] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="size-4" style={{ color: tokens.text.secondary }} />
          <span className="text-sm" style={{ color: tokens.text.secondary }}>{companyName}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
          Trust Score Detail
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          Comprehensive trust assessment across four dimensions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Ring */}
        <Card className="py-0 gap-0">
          <CardContent className="p-6 flex justify-center">
            <TrustScoreRing score={overallScore} />
          </CardContent>
        </Card>

        {/* Dimensions */}
        <div className="lg:col-span-2 space-y-4">
          {dimensions.map(dim => (
            <Card key={dim.key} className="py-0 gap-0">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg p-2 mt-0.5 shrink-0" style={{ backgroundColor: `${dim.color}15` }}>
                    <dim.icon className="size-4" style={{ color: dim.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{dim.label}</p>
                      <span className="text-sm font-mono font-bold" style={{ color: dim.color }}>{dim.score}</span>
                    </div>
                    <Progress value={dim.score} className="h-2 mb-2" style={{ '--progress-color': dim.color } as React.CSSProperties} />
                    <p className="text-xs" style={{ color: tokens.text.muted }}>{dim.detail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trust History */}
        <Card className="py-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4" style={{ color: tokens.accent.primary }} />
              Trust History
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="max-h-[320px] overflow-y-auto">
              {trustHistory.map((h, i) => (
                <div key={i} className="flex items-start gap-3 px-6 py-3 border-b last:border-b-0" style={{ borderColor: tokens.borderFaint }}>
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold" style={{ color: h.score >= 75 ? '#16A34A' : '#D97706' }}>{h.score}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: tokens.text.primary }}>{h.event}</p>
                    <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>{h.date}</p>
                  </div>
                  {h.score > trustHistory[i + 1]?.score ? (
                    <TrendingUp className="size-4 text-emerald-400 shrink-0" />
                  ) : (
                    <TrendingUp className="size-4 text-red-400 rotate-180 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="py-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="size-4" style={{ color: tokens.gold.dark }} />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="max-h-[320px] overflow-y-auto">
              {recommendations.map((rec, i) => (
                <div key={i} className="px-6 py-3 border-b last:border-b-0 space-y-2" style={{ borderColor: tokens.borderFaint }}>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={rec.priority} />
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{rec.title}</p>
                  </div>
                  <p className="text-xs" style={{ color: tokens.text.secondary }}>{rec.detail}</p>
                  <button className="text-xs flex items-center gap-1 hover:underline" style={{ color: tokens.accent.primary }}>
                    {rec.action} <ArrowRight className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
