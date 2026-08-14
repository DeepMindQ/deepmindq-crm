'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Building2, DollarSign, TrendingUp, TrendingDown, Target, Shield,
  AlertTriangle, CheckCircle2, ArrowRight, FileText, Download,
  Globe, Users, Briefcase, BarChart3, Zap, Lightbulb, Clock,
} from 'lucide-react';

// ── Mock Data ──
const company = {
  name: 'Acme Corp',
  industry: 'Enterprise SaaS',
  founded: '2012',
  employees: '2,400',
  hq: 'San Francisco, CA',
  website: 'acmecorp.com',
  description: 'Leading provider of enterprise cloud solutions serving Fortune 500 companies across 40 countries. Recently announced expansion into AI-driven analytics.',
};

const revenueMetrics = {
  arr: 2400000,
  mrr: 200000,
  growth: 34,
  nrr: 118,
  dealSize: 85,
  salesCycle: 62,
};

const topSignals = [
  { title: 'Engineering team expansion — 15 new roles posted in last 30 days', type: 'Growth', confidence: 94, impact: 'High', icon: <Users className="w-4 h-4" /> },
  { title: 'CFO Sarah Chen spoke at SaaS Conference about platform consolidation strategy', type: 'Intent', confidence: 89, impact: 'High', icon: <Lightbulb className="w-4 h-4" /> },
  { title: 'AWS contract renewal approaching — potential multi-cloud strategy shift', type: 'Opportunity', confidence: 76, impact: 'Medium', icon: <Zap className="w-4 h-4" /> },
];

const keyRisks = [
  { risk: 'Competitive threat from VendorX pricing reduction', severity: 'high' as const, mitigation: 'Strengthen value proposition around TCO and integration depth' },
  { risk: 'Procurement lead (Lisa Wang) showing negative sentiment', severity: 'medium' as const, mitigation: 'Engage champion Emily Park to build internal advocacy' },
  { risk: 'Budget cycle timing — Q2 approvals may delay close', severity: 'medium' as const, mitigation: 'Offer early-adopter incentives for Q1 commitment' },
];

const opportunities = [
  { opp: 'Cross-sell security module to engineering team', potential: '$120K', probability: '72%' },
  { opp: 'Expand from single department to enterprise-wide license', potential: '$350K', probability: '45%' },
  { opp: 'Replace incumbent data warehouse solution', potential: '$200K', probability: '58%' },
];

const recommendedActions = [
  { action: 'Schedule 1:1 with CFO Chen to finalize pricing proposal', priority: 'high' as const, owner: 'AE - John', deadline: 'Jan 24' },
  { action: 'Send technical case study to VP Engineering Rodriguez', priority: 'medium' as const, owner: 'SE - Alex', deadline: 'Jan 22' },
  { action: 'Prepare competitive comparison deck addressing VendorX TCO', priority: 'high' as const, owner: 'AE - John', deadline: 'Jan 25' },
  { action: 'Arrange reference call with existing FinTech customer', priority: 'low' as const, owner: 'CS - Maria', deadline: 'Jan 30' },
];

// ── Helpers ──
const severityColors: Record<string, { bg: string; text: string }> = {
  high: { bg: tokens.confidence.low.bg, text: tokens.confidence.low.value },
  medium: { bg: tokens.confidence.medium.bg, text: tokens.confidence.medium.value },
  low: { bg: tokens.confidence.high.bg, text: tokens.confidence.high.value },
};

const priorityColors: Record<string, string> = {
  high: tokens.priority.high,
  medium: tokens.priority.medium,
  low: tokens.priority.low,
};

function formatCurrency(val: number) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

// ── Component ──
export default function RevenueIntelligenceBriefScreen() {
  const [loading, setLoading] = useState(true);

  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid grid-cols-2 gap-4"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tokens.accent.primary}15` }}>
            <Building2 className="w-7 h-7" style={{ color: tokens.accent.primary }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>Revenue Intelligence Brief</h1>
            <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>Executive summary for strategic decision-making</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2 shrink-0">
          <Download className="w-3.5 h-3.5" /> Export PDF
        </Button>
      </div>

      {/* Company Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: tokens.text.primary }}>
            <Globe className="w-4 h-4" style={{ color: tokens.accent.primary }} /> Company Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            {[
              { label: 'Industry', value: company.industry, icon: Briefcase },
              { label: 'Employees', value: company.employees, icon: Users },
              { label: 'Founded', value: company.founded, icon: Building2 },
              { label: 'HQ', value: company.hq, icon: Globe },
              { label: 'Website', value: company.website, icon: Globe },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label}>
                  <div className="flex items-center gap-1.5 mb-1"><Icon className="w-3 h-3" style={{ color: tokens.text.muted }} /><span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: tokens.text.muted }}>{item.label}</span></div>
                  <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{item.value}</p>
                </div>
              );
            })}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: tokens.text.secondary }}>{company.description}</p>
        </CardContent>
      </Card>

      {/* Revenue Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: tokens.text.primary }}>
            <DollarSign className="w-4 h-4" style={{ color: tokens.confidence.high.value }} /> Revenue Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'ARR', value: formatCurrency(revenueMetrics.arr), sub: '+34% YoY', positive: true },
              { label: 'MRR', value: formatCurrency(revenueMetrics.mrr), sub: 'Current month', positive: null },
              { label: 'Growth Rate', value: `${revenueMetrics.growth}%`, sub: 'Year over year', positive: true },
              { label: 'Net Retention', value: `${revenueMetrics.nrr}%`, sub: 'Above 100%', positive: true },
              { label: 'Avg Deal Size', value: formatCurrency(revenueMetrics.dealSize * 1000), sub: 'Last quarter', positive: null },
              { label: 'Sales Cycle', value: `${revenueMetrics.salesCycle}d`, sub: '-8d vs avg', positive: true },
            ].map((m) => (
              <div key={m.label} className="text-center p-3 rounded-lg" style={{ backgroundColor: tokens.surfaceExtended }}>
                <p className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>{m.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: tokens.text.primary }}>{m.value}</p>
                {m.positive !== null && (
                  <p className="text-[11px] mt-1 flex items-center justify-center gap-0.5" style={{ color: m.positive ? tokens.confidence.high.value : tokens.confidence.low.value }}>
                    {m.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {m.sub}
                  </p>
                )}
                {m.positive === null && <p className="text-[11px] mt-1" style={{ color: tokens.text.muted }}>{m.sub}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Intelligence Highlights + Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Signals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: tokens.text.primary }}>
              <Zap className="w-4 h-4" style={{ color: tokens.gold.dark }} /> Top Intelligence Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topSignals.map((sig, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ border: `1px solid ${tokens.borderFaint}` }}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${tokens.accent.primary}12`, color: tokens.accent.primary }}>{sig.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug" style={{ color: tokens.text.primary }}>{sig.title}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: tokens.border.default, color: tokens.text.secondary }}>{sig.type}</Badge>
                        <span className="text-[11px]" style={{ color: tokens.text.muted }}>{sig.confidence}% confidence</span>
                        <span className="text-[11px] font-medium" style={{ color: sig.impact === 'High' ? tokens.confidence.low.value : tokens.confidence.medium.value }}>{sig.impact} impact</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Key Risks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: tokens.text.primary }}>
              <AlertTriangle className="w-4 h-4" style={{ color: tokens.confidence.low.value }} /> Key Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {keyRisks.map((r, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ border: `1px solid ${tokens.borderFaint}` }}>
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 mt-0.5 shrink-0" style={{ color: severityColors[r.severity].text }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{r.risk}</p>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: severityColors[r.severity].bg, color: severityColors[r.severity].text }}>{r.severity}</span>
                      </div>
                      <p className="text-xs" style={{ color: tokens.text.secondary }}><strong>Mitigation:</strong> {r.mitigation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opportunities + Recommended Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opportunities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: tokens.text.primary }}>
              <Target className="w-4 h-4" style={{ color: tokens.confidence.high.value }} /> Revenue Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {opportunities.map((o, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ border: `1px solid ${tokens.borderFaint}` }}>
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{o.opp}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-bold" style={{ color: tokens.confidence.high.value }}>{o.potential}</span>
                      <span className="text-xs" style={{ color: tokens.text.muted }}>{o.probability} probability</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0" style={{ color: tokens.text.muted }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recommended Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: tokens.text.primary }}>
              <ArrowRight className="w-4 h-4" style={{ color: tokens.accent.primary }} /> Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recommendedActions.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ border: `1px solid ${tokens.borderFaint}` }}>
                  <div className="w-1.5 h-full min-h-[40px] rounded-full shrink-0" style={{ backgroundColor: priorityColors[a.priority] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{a.action}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px]" style={{ color: tokens.text.muted }}>{a.owner}</span>
                      <span className="text-[11px] flex items-center gap-1" style={{ color: tokens.text.muted }}><Clock className="w-3 h-3" /> {a.deadline}</span>
                    </div>
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
