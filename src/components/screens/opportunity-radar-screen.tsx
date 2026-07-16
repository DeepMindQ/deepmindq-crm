'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, Crosshair, Sparkles, ChevronDown, ChevronUp,
  Brain, Target, UserCheck, ArrowRight, TrendingUp, BarChart3,
  Flame, Sun, Droplets, Eye, Zap, Building2, MessageSquare,
  ShieldCheck, Cpu, Cloud, Database, RefreshCw,
} from 'lucide-react';
import { PageTransition, AnimatedCounter, EmptyState } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';

/* ═══════════════════════════════════════════════════
   Types & Demo Data
   ═══════════════════════════════════════════════════ */
interface Opportunity {
  id: string; company: string; companyId: string; matchScore: number;
  type: string; whyNow: string; capability: string; persona: string;
  confidence: number; detectedAt: string;
  reasoning: { signals: { label: string; points: number }[]; alignment: string; capabilityMatch: string };
}

const TYPE_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  'AI Automation': { bg: 'bg-purple-50', text: 'text-purple-700', icon: Cpu },
  'Cloud Modernization': { bg: 'bg-blue-50', text: 'text-blue-700', icon: Cloud },
  'Data Analytics': { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: Database },
  'Digital Transformation': { bg: 'bg-amber-50', text: 'text-amber-700', icon: RefreshCw },
};

const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp-1', company: 'ABC Manufacturing', companyId: 'comp-abc', matchScore: 92,
    type: 'AI Automation', whyNow: 'A new Chief Data Officer was appointed last month, signaling a strategic push toward data-driven operations. Recent job postings indicate significant investment in operational efficiency tools. The company reported a 15% increase in production costs, creating urgency.',
    capability: 'Predictive Maintenance AI Suite', persona: 'CDO', confidence: 94, detectedAt: '2 days ago',
    reasoning: {
      signals: [
        { label: 'New CDO appointment', points: 28 },
        { label: 'Manufacturing efficiency job postings (12 roles)', points: 22 },
        { label: 'Production cost increase reported', points: 18 },
        { label: 'Tech stack: legacy SAP, no AI layer', points: 14 },
      ],
      alignment: 'Manufacturing sector shows 3.2x higher conversion when AI automation is pitched within 90 days of C-suite technology leadership change.',
      capabilityMatch: 'Predictive Maintenance Suite directly addresses operational cost pressures and aligns with their stated efficiency goals from Q4 earnings call.',
    },
  },
  {
    id: 'opp-2', company: 'XYZ Bank', companyId: 'comp-xyz', matchScore: 87,
    type: 'Data Analytics', whyNow: 'Currently hiring 25 data engineers across multiple teams, indicating a massive data infrastructure build-out. Their annual report highlighted real-time analytics as a top-3 strategic priority. Existing data warehouse is reaching end of life.',
    capability: 'Enterprise Data Platform & Real-Time Analytics', persona: 'CTO', confidence: 89, detectedAt: '5 days ago',
    reasoning: {
      signals: [
        { label: 'Hiring 25 data engineers', points: 30 },
        { label: 'Annual report: real-time analytics priority', points: 20 },
        { label: 'Legacy data warehouse end-of-life', points: 16 },
        { label: 'Regulatory compliance deadline (6 months)', points: 12 },
      ],
      alignment: 'Financial services with active data engineering hiring have a 4.1x higher close rate on analytics platform deals.',
      capabilityMatch: 'Enterprise Data Platform provides seamless migration from legacy warehouses with built-in compliance modules for financial regulations.',
    },
  },
  {
    id: 'opp-3', company: 'DEF Energy', companyId: 'comp-def', matchScore: 85,
    type: 'Cloud Modernization', whyNow: 'Announced a $500M digital transformation program with cloud-first mandate. Their CTO publicly stated the goal to migrate 80% of workloads to cloud within 18 months. Currently running 3 RFPs for cloud consulting services.',
    capability: 'Cloud Migration & Modernization Framework', persona: 'CTO', confidence: 91, detectedAt: '1 day ago',
    reasoning: {
      signals: [
        { label: '$500M digital program announced', points: 32 },
        { label: 'Public cloud-first mandate', points: 22 },
        { label: '3 active RFPs for cloud consulting', points: 18 },
        { label: 'On-premise infrastructure aging (avg 7 years)', points: 10 },
      ],
      alignment: 'Energy sector cloud modernization deals average 2.8x larger when initiated within the first quarter of a public digital transformation announcement.',
      capabilityMatch: 'Cloud Migration Framework includes energy-sector specific compliance templates and IoT integration patterns critical for their operational technology environment.',
    },
  },
  {
    id: 'opp-4', company: 'GHI Logistics', companyId: 'comp-ghi', matchScore: 78,
    type: 'AI Automation', whyNow: 'Detected a major technology stack migration from on-premise to hybrid cloud. Their VP of Operations mentioned supply chain optimization as a key initiative in a recent industry conference. Currently evaluating AI vendors for route optimization.',
    capability: 'Supply Chain Intelligence Platform', persona: 'VP Digital', confidence: 76, detectedAt: '1 week ago',
    reasoning: {
      signals: [
        { label: 'Technology stack migration detected', points: 24 },
        { label: 'VP Ops public statement on optimization', points: 18 },
        { label: 'AI vendor evaluation in progress', points: 20 },
        { label: 'Q3 delivery delays (publicly reported)', points: 10 },
      ],
      alignment: 'Logistics companies in active tech migration show 2.4x higher intent to purchase AI solutions compared to stable-stack peers.',
      capabilityMatch: 'Supply Chain Intelligence Platform integrates with their hybrid cloud target architecture and provides immediate ROI on route optimization.',
    },
  },
  {
    id: 'opp-5', company: 'JKL Healthcare', companyId: 'comp-jkl', matchScore: 72,
    type: 'Digital Transformation', whyNow: 'Launched a new digital innovation division with a $50M annual budget and hired a Chief Innovation Officer from a leading tech firm. Their patient engagement scores are below industry average, creating internal pressure for digital solutions.',
    capability: 'Patient Experience Digital Suite', persona: 'CIO', confidence: 71, detectedAt: '4 days ago',
    reasoning: {
      signals: [
        { label: 'New innovation division ($50M budget)', points: 22 },
        { label: 'CIO hired from tech background', points: 16 },
        { label: 'Below-average patient engagement scores', points: 14 },
        { label: 'Competitor launched digital patient portal', points: 10 },
      ],
      alignment: 'Healthcare organizations with new innovation divisions and external CIO hires show 2.1x faster procurement cycles.',
      capabilityMatch: 'Patient Experience Suite addresses engagement gaps and includes HIPAA-compliant modules that reduce compliance risk for the innovation team.',
    },
  },
  {
    id: 'opp-6', company: 'MNO Consulting', companyId: 'comp-mno', matchScore: 65,
    type: 'AI Automation', whyNow: 'Recently acquired an AI diagnostics startup, signaling strategic interest in AI-powered solutions. Their consulting practice is under pressure to demonstrate AI capabilities to clients. Partners have been asking for AI tooling internally.',
    capability: 'AI-Powered Consulting Intelligence', persona: 'COO', confidence: 63, detectedAt: '2 weeks ago',
    reasoning: {
      signals: [
        { label: 'AI diagnostics startup acquisition', points: 20 },
        { label: 'Client pressure for AI capabilities', points: 16 },
        { label: 'Internal partner demand for AI tools', points: 12 },
        { label: 'Competitor launched AI consulting practice', points: 8 },
      ],
      alignment: 'Consulting firms post-acquisition of AI companies have a 1.8x higher propensity to invest in AI infrastructure within 6 months.',
      capabilityMatch: 'Consulting Intelligence platform can integrate with their newly acquired AI diagnostics IP, creating a differentiated offering for their client base.',
    },
  },
];

const SCORE_DISTRIBUTION = [
  { tier: 'Hot', range: '90%+', count: 1, color: '#DC2626', accent: '#D4AF37', icon: Flame },
  { tier: 'Warm', range: '70–89%', count: 3, color: '#D97706', accent: '#D97706', icon: Sun },
  { tier: 'Developing', range: '50–69%', count: 1, color: '#2563EB', accent: '#2563EB', icon: Droplets },
  { tier: 'Monitoring', range: '<50%', count: 0, color: '#9CA3AF', accent: '#9CA3AF', icon: Eye },
];

const FILTERS = [
  { key: 'all', label: 'All', count: 6 },
  { key: 'high', label: 'High Match', count: 3 },
  { key: 'recent', label: 'Recently Detected', count: 4 },
];

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */
function scoreColor(s: number) { return s >= 80 ? '#059669' : s >= 60 ? '#D97706' : '#DC2626'; }
function scoreLabel(s: number) { return s >= 90 ? 'Hot' : s >= 70 ? 'Warm' : s >= 50 ? 'Developing' : 'Monitoring'; }

function filterOpps(opp: Opportunity, filter: string) {
  if (filter === 'high') return opp.matchScore >= 80;
  if (filter === 'recent') return ['2 days ago', '1 day ago', '5 days ago', '4 days ago'].includes(opp.detectedAt);
  return true;
}

/* ═══════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════ */
export default function OpportunityRadarScreen({ navigateTo }: { navigateTo?: (screen: string, id?: string) => void }) {
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = OPPORTUNITIES.filter(o => filterOpps(o, filter));

  return (
    <PageTransition className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))' }}>
              <Radar className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Opportunity Radar</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[52px]">
            AI-matched opportunities based on signals and capabilities
          </p>
        </div>
        <div className="flex items-center gap-2 ml-[52px] md:ml-0">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                filter === f.key
                  ? 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-foreground shadow-sm'
                  : 'border-gray-200 bg-white text-muted-foreground hover:border-gray-300 hover:text-foreground'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                filter === f.key ? 'bg-[#D4AF37]/20 text-[#9A8340]' : 'bg-gray-100 text-muted-foreground'
              }`}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Score Distribution ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Opportunity Score Distribution</h2>
          <span className="text-xs text-muted-foreground ml-auto">{OPPORTUNITIES.length} accounts scored</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SCORE_DISTRIBUTION.map((tier, i) => (
            <motion.div
              key={tier.tier}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="relative overflow-hidden rounded-lg border border-gray-100 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${tier.color}12` }}>
                  <tier.icon className="w-3.5 h-3.5" style={{ color: tier.color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{tier.tier}</p>
                  <p className="text-[10px] text-muted-foreground">{tier.range}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 mb-2.5">
                <span className="text-2xl font-bold" style={{ color: tier.color }}>
                  <AnimatedCounter value={tier.count} />
                </span>
                <span className="text-xs text-muted-foreground">accounts</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: tier.color }}
                  initial={{ width: 0 }}
                  animate={{ width: tier.count > 0 ? `${Math.max((tier.count / OPPORTUNITIES.length) * 100, 8)}%` : '0%' }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── 3. Top Opportunities Grid ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Crosshair className="w-4 h-4" style={{ color: '#D4AF37' }} />
          <h2 className="text-sm font-semibold text-foreground">Top Opportunities</h2>
          <Badge variant="outline" className="ml-2 text-[10px]">{filtered.length} shown</Badge>
        </div>

        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <EmptyState icon={Radar} title="No opportunities match this filter" description="Try selecting a different filter to see more results." />
          ) : (
            <motion.div
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              {filtered.map((opp, i) => {
                const typeStyle = TYPE_STYLES[opp.type] || TYPE_STYLES['AI Automation'];
                const TypeIcon = typeStyle.icon;
                const isExpanded = expandedId === opp.id;
                const sc = scoreColor(opp.matchScore);

                return (
                  <motion.div
                    key={opp.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col"
                  >
                    {/* Card Header */}
                    <div className="p-5 pb-4 flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => navigateTo?.('company', opp.companyId)}
                              className="text-sm font-semibold text-foreground hover:underline underline-offset-2 truncate block"
                            >
                              {opp.company}
                            </button>
                            <p className="text-[11px] text-muted-foreground">{opp.detectedAt}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="text-2xl font-bold tabular-nums" style={{ color: sc }}>{opp.matchScore}%</div>
                          <div className="text-[10px] font-medium" style={{ color: sc }}>{scoreLabel(opp.matchScore)}</div>
                        </div>
                      </div>

                      {/* Type Badge */}
                      <div className="mb-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                          <TypeIcon className="w-3 h-3" />
                          {opp.type}
                        </span>
                      </div>

                      {/* Why Now */}
                      <div className="mb-3">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Why Now</p>
                        <p className="text-xs text-foreground/80 leading-relaxed">{opp.whyNow}</p>
                      </div>

                      {/* Meta Row */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Relevant Capability</p>
                          <p className="text-xs text-foreground font-medium leading-snug">{opp.capability}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Target Persona</p>
                          <div className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-muted-foreground" />
                            <p className="text-xs text-foreground font-medium">{opp.persona}</p>
                          </div>
                        </div>
                      </div>

                      {/* Confidence Bar */}
                      <div className="flex items-center gap-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Confidence</p>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${sc}, ${sc}CC)` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${opp.confidence}%` }}
                            transition={{ delay: 0.3 + i * 0.06, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: sc }}>{opp.confidence}%</span>
                      </div>
                    </div>

                    {/* AI Reasoning Toggle */}
                    <div className="border-t border-gray-100">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : opp.id)}
                        className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-gray-50/50 transition-colors rounded-b-xl"
                      >
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                          <span>Why AI recommended this</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-4 pt-1 space-y-3">
                              {/* Signal Factors */}
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Signal Factors</p>
                                <div className="space-y-1.5">
                                  {opp.reasoning.signals.map((sig, si) => (
                                    <div key={si} className="flex items-center justify-between text-xs">
                                      <span className="text-foreground/70">{sig.label}</span>
                                      <span className="font-semibold tabular-nums" style={{ color: '#059669' }}>+{sig.points}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {/* Industry Alignment */}
                              <div className="rounded-lg bg-gray-50 p-3">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Industry Alignment</p>
                                <p className="text-xs text-foreground/75 leading-relaxed">{opp.reasoning.alignment}</p>
                              </div>
                              {/* Capability Match */}
                              <div className="rounded-lg bg-gray-50 p-3">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Capability Match</p>
                                <p className="text-xs text-foreground/75 leading-relaxed">{opp.reasoning.capabilityMatch}</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Action Footer */}
                    <div className="px-5 pb-4 pt-1 flex items-center gap-2">
                      <button
                        onClick={() => navigateTo?.('company', opp.companyId)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                        style={{ background: opp.matchScore >= 80 ? 'linear-gradient(135deg, #D4AF37, #B8960F)' : 'linear-gradient(135deg, #4B5563, #374151)' }}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Start Conversation
                      </button>
                      <button
                        onClick={() => navigateTo?.('company', opp.companyId)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-muted-foreground hover:text-foreground hover:border-gray-300 bg-white transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Account
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}