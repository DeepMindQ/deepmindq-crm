'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Shield, Eye,
  FileWarning, Info, TrendingUp, TrendingDown, ExternalLink,
  Clock, BarChart3, Sparkles, ChevronRight, ArrowLeft, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { EmptyState } from '@/components/shared/design-system';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { AIProgressTracker } from '@/components/enterprise/AIProgressTracker';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface TrustReportData {
  overallScore: number;
  sourceReliability: number;
  evidenceQuality: number;
  temporalFreshness: number;
  crossValidation: number;
  confidenceExplanation: string;
  sources: Array<{ name: string; type: string; reliability: number; lastUpdated: string }>;
  gaps: Array<{ area: string; severity: string; description: string; improvementHint?: string }>;
}

interface ReasoningStep {
  id: string;
  title: string;
  description: string;
  evidence: Array<{ source: string; content: string; quality: string }>;
  conclusion: string;
  confidence: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

interface RecommendationData {
  id: string;
  title: string;
  company: string;
  priority: string;
}

interface Factor {
  factor: string;
  impact: string;
}

interface EvidenceRow {
  source: string;
  date: string;
  quality: string;
  impact: string;
}

interface Conflict {
  conflictType: string;
  severity: string;
  description: string;
}

interface MissingItem {
  category: string;
  description: string;
  improvementHint?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-50 border-emerald-200';
  if (score >= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function getTierLabel(score: number): string {
  if (score >= 80) return 'High Confidence';
  if (score >= 60) return 'Medium Confidence';
  return 'Low Confidence';
}

function getSeverityVariant(severity: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (severity.toUpperCase()) {
    case 'CRITICAL': case 'HIGH': return 'destructive';
    case 'MEDIUM': return 'secondary';
    default: return 'outline';
  }
}

function getQualityBadge(quality: string): { label: string; className: string } {
  switch (quality.toLowerCase()) {
    case 'high': return { label: 'High', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    case 'medium': return { label: 'Medium', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    default: return { label: 'Low', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
}

function parseMissingItem(item: string | MissingItem): MissingItem {
  if (typeof item === 'string') {
    return { category: 'Data Gap', description: item, improvementHint: 'Addressing this gap would improve overall intelligence quality' };
  }
  return item;
}

/* ═══════════════════════════════════════════════════════════════
   Confidence Circle
   ═══════════════════════════════════════════════════════════════ */
function ConfidenceCircle({ score }: { score: number }) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative flex items-center justify-center w-36 h-36 mx-auto">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="6" className="stroke-slate-100" />
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="6" strokeLinecap="round"
          stroke={color} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('text-3xl font-bold', getScoreColor(score))}>{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Confidence</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Reasoning Step Card
   ═══════════════════════════════════════════════════════════════ */
function ReasoningStepCard({
  step, index, totalSteps,
}: {
  step: ReasoningStep;
  index: number;
  totalSteps: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      'rounded-xl border bg-white transition-all',
      step.status === 'complete' ? 'border-emerald-200' :
      step.status === 'processing' ? 'border-blue-300 shadow-md' :
      step.status === 'error' ? 'border-red-200' : 'border-slate-200'
    )}>
      {/* Step header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4 flex items-center gap-3"
      >
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          step.status === 'complete' ? 'bg-emerald-100 text-emerald-700' :
          step.status === 'processing' ? 'bg-blue-100 text-blue-700' :
          step.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
        )}>
          {step.status === 'complete' ? '✓' : step.status === 'error' ? '!' : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{step.title}</p>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{step.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {step.confidence > 0 && (
            <div className="w-16">
              <ConfidenceBar value={step.confidence} size="sm" showPercentage={false} />
            </div>
          )}
          <ChevronRight className={cn('h-4 w-4 text-slate-400 transition-transform', expanded && 'rotate-90')} />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>

          {/* Evidence at this step */}
          {step.evidence.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Evidence</p>
              {step.evidence.map((ev, i) => (
                <div key={i} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <EvidenceBadge source={ev.source} />
                    <Badge variant="outline" className={cn('text-[10px]', getQualityBadge(ev.quality).className)}>
                      {ev.quality}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{ev.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Conclusion */}
          {step.conclusion && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold mb-1">Conclusion</p>
              <p className="text-sm text-slate-700 leading-relaxed">{step.conclusion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Mock reasoning steps for demo
   ═══════════════════════════════════════════════════════════════ */
const MOCK_STEPS: ReasoningStep[] = [
  {
    id: 'step-1', title: 'Signal Detection', description: 'Identified hiring patterns for cloud architecture roles and AI/ML positions across multiple job boards and LinkedIn.', status: 'complete', confidence: 92,
    evidence: [
      { source: 'linkedin', content: '15 new cloud architect roles posted in the last 30 days, up 300% from previous period.', quality: 'high' },
      { source: 'web', content: 'Glassdoor reviews mention "cloud transformation initiative" as a strategic priority.', quality: 'medium' },
    ],
    conclusion: 'Strong signal that the company is investing heavily in cloud infrastructure and AI capabilities.',
  },
  {
    id: 'step-2', title: 'Technology Stack Analysis', description: 'Analyzed technology mentions across press releases, job postings, and patent filings.', status: 'complete', confidence: 88,
    evidence: [
      { source: 'news', content: 'Press release: "Acme Corp selects AWS as preferred cloud provider for next-generation platform."', quality: 'high' },
      { source: 'filing', content: 'Patent filing for "AI-driven data processing pipeline" indicates significant R&D investment.', quality: 'high' },
    ],
    conclusion: 'Company is migrating to AWS with a focus on AI-driven analytics.',
  },
  {
    id: 'step-3', title: 'Leadership Change Impact', description: 'Evaluated the impact of new CTO appointment on technology strategy direction.', status: 'complete', confidence: 85,
    evidence: [
      { source: 'social', content: 'Sarah Chen (ex-Microsoft Azure VP) appointed as CTO. Track record includes three major cloud migrations.', quality: 'high' },
    ],
    conclusion: 'New CTO strongly reinforces cloud migration trajectory. High credibility based on proven track record.',
  },
  {
    id: 'step-4', title: 'Market Timing Assessment', description: 'Cross-referenced the signal with industry trends, competitor activity, and market conditions.', status: 'complete', confidence: 78,
    evidence: [
      { source: 'analytics', content: 'Enterprise cloud spending in target industry up 25% YoY. Window of opportunity identified for Q1-Q2.', quality: 'medium' },
    ],
    conclusion: 'Market timing is favorable. Recommend engagement within next 60 days for optimal positioning.',
  },
  {
    id: 'step-5', title: 'Confidence Synthesis', description: 'Aggregated all evidence sources and computed final confidence score using weighted reliability model.', status: 'complete', confidence: 86,
    evidence: [
      { source: 'internal', content: 'Weighted confidence: Signal Quality=92, Evidence=88, Leadership=85, Market=78. Overall: 86.', quality: 'high' },
    ],
    conclusion: 'Final recommendation confidence: 86%. High confidence that this represents a genuine buying opportunity.',
  },
];

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceReasoningScreen({
  companyId,
  recommendationId,
  navigateTo,
}: {
  companyId?: string;
  recommendationId?: string;
  navigateTo?: (screen: string, companyId?: string) => void;
}) {
  const [data, setData] = useState<TrustReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overallConfidence] = useState(86);
  const [recommendation] = useState<RecommendationData>({
    id: 'rec-1', title: 'Cloud Infrastructure Investment Opportunity', company: 'Acme Corp', priority: 'HIGH',
  });
  const [breakdown] = useState({
    signalQuality: 92, evidenceQuality: 88, capabilityFit: 75, dataCompleteness: 80,
  });
  const [factors] = useState<{
    positiveFactors: Factor[];
    negativeFactors: Factor[];
  }>({
    positiveFactors: [
      { factor: 'Strong cloud hiring signals (300% increase)', impact: '+25' },
      { factor: 'New CTO with cloud expertise appointed', impact: '+20' },
      { factor: 'AWS partnership announced', impact: '+15' },
      { factor: 'Patent filings in AI space', impact: '+10' },
    ],
    negativeFactors: [
      { factor: 'Limited public financial data', impact: '-5' },
    ],
  });
  const [conflicts] = useState<Conflict[]>([
    { conflictType: 'timeline_mismatch', severity: 'MEDIUM', description: 'Hiring signal timeline differs from press release timing by 2 weeks.' },
  ]);
  const [evidenceRows] = useState<EvidenceRow[]>([
    { source: 'LinkedIn', date: '2025-01-10', quality: 'high', impact: '+25' },
    { source: 'Press Release', date: '2025-01-08', quality: 'high', impact: '+20' },
    { source: 'Patent Filing', date: '2024-12-15', quality: 'high', impact: '+15' },
    { source: 'Industry Report', date: '2025-01-12', quality: 'medium', impact: '+10' },
    { source: 'Glassdoor', date: '2025-01-05', quality: 'medium', impact: '+5' },
  ]);
  const [supportingEvidence] = useState({ total: 5, validatedSignals: 4, weakSignals: 1 });
  const [missingIntelligence] = useState<Array<string | MissingItem>>([
    { category: 'Financial Health', description: 'No recent financial statements available to assess budget capacity for cloud migration.', improvementHint: 'Request annual report or SEC filing for financial capacity assessment.' },
    { category: 'Current Vendor Stack', description: 'Unknown which cloud providers are currently in use. Could indicate multi-cloud or on-premise.', improvementHint: 'Research current technology stack through job postings and job descriptions.' },
  ]);
  const [aiReasoning] = useState(
    'Multiple independent signals indicate active digital transformation investment based on a convergence of hiring patterns, technology announcements, and industry activity. The appointment of a cloud-focused CTO, combined with a 300% increase in cloud architecture hiring and a public AWS partnership, creates a high-confidence buying signal.'
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (recommendationId) {
          const res = await fetch(`/api/g-intelligence/recommendations/${recommendationId}/trust-report`);
          if (res.ok) {
            const json = await res.json();
            if (!cancelled) { setData(json as TrustReportData); setLoading(false); return; }
          }
        }
        if (!cancelled) { setData(null); setLoading(false); }
      } catch (e) {
        if (!cancelled) { setError('Failed to load trust report data'); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [companyId, recommendationId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* ── Header ── */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          Intelligence Reasoning
        </h1>
        <p className="text-sm text-slate-500">
          {recommendation.title} — {recommendation.company}
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════
         Section 1: Why AI Believes This
         ═══════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 md:p-8 space-y-8">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Why AI Believes This</h2>
        </div>

        {/* Confidence Circle + Tier */}
        <div className="flex flex-col items-center gap-4">
          <ConfidenceCircle score={overallConfidence} />
          <Badge variant={overallConfidence >= 80 ? 'default' : overallConfidence >= 60 ? 'secondary' : 'destructive'}
            className={cn('text-xs px-3 py-1',
              overallConfidence >= 80 ? 'bg-emerald-600' : overallConfidence >= 60 ? 'bg-amber-500' : 'bg-red-600',
              'text-white'
            )}>
            {getTierLabel(overallConfidence)}
          </Badge>
        </div>

        {/* AI Reasoning */}
        <div className={cn('rounded-xl border p-5', getScoreBgColor(overallConfidence))}>
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
            <p className="text-sm leading-relaxed text-slate-800">{aiReasoning}</p>
          </div>
        </div>

        {/* Reasoning Steps */}
        <div>
          <h3 className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-4">
            Step-by-Step Reasoning
          </h3>
          <div className="space-y-3">
            {MOCK_STEPS.map((step, idx) => (
              <ReasoningStepCard key={step.id} step={step} index={idx} totalSteps={MOCK_STEPS.length} />
            ))}
          </div>
        </div>

        {/* Dimension Breakdown */}
        <div>
          <h3 className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-4">
            Confidence Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Signal Quality', value: breakdown.signalQuality },
              { label: 'Evidence Quality', value: breakdown.evidenceQuality },
              { label: 'Capability Fit', value: breakdown.capabilityFit },
              { label: 'Data Completeness', value: breakdown.dataCompleteness },
            ].map(dim => (
              <div key={dim.label}>
                <ConfidenceBar value={dim.value} label={dim.label} size="md" />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Positive & Negative Factors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <TrendingUp className="h-4 w-4" /> Positive Contributors
            </div>
            <div className="space-y-2">
              {factors.positiveFactors.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-emerald-50/70 border border-emerald-100">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-sm leading-snug text-slate-700">{f.factor}</span>
                  </div>
                  <span className="font-semibold text-emerald-700 text-sm shrink-0">+{f.impact}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <TrendingDown className="h-4 w-4" /> Negative Contributors
            </div>
            <div className="space-y-2">
              {factors.negativeFactors.length > 0 ? (
                factors.negativeFactors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50/70 border border-red-100">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <span className="text-sm leading-snug text-slate-700">{f.factor}</span>
                    </div>
                    <span className="font-semibold text-red-700 text-sm shrink-0">{f.impact}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50/70 border border-emerald-100">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-emerald-700">No negative factors detected</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
         Section 2: Evidence & Conflicts
         ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-8">
        <div className="flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Evidence & Conflicts</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evidence Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" /> Evidence Sources
              <Badge variant="outline" className="ml-auto text-[10px] bg-slate-50">{supportingEvidence.total} items</Badge>
            </h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wide">Source</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wide">Date</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wide">Quality</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wide">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evidenceRows.map((row, i) => {
                    const q = getQualityBadge(row.quality);
                    return (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-700">{row.source}</td>
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{row.date}</td>
                        <td className="py-2.5 px-3">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', q.className)}>
                            {q.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">{row.impact}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-3 text-center">
                <p className="text-lg font-bold text-emerald-600">{supportingEvidence.validatedSignals}</p>
                <p className="text-[10px] text-slate-400">Valid Signals</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-center">
                <p className="text-lg font-bold text-amber-600">{supportingEvidence.weakSignals}</p>
                <p className="text-[10px] text-slate-400">Weak Signals</p>
              </div>
            </div>
          </div>

          {/* Conflicts */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-slate-400" /> Active Conflicts
              <Badge variant={conflicts.length > 0 ? 'destructive' : 'outline'}
                className={cn('ml-auto text-[10px]', conflicts.length === 0 && 'bg-emerald-50 text-emerald-700 border-emerald-200')}>
                {conflicts.length}
              </Badge>
            </h3>
            {conflicts.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {conflicts.map((c, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-4 space-y-2 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getSeverityVariant(c.severity)} className="text-[10px]">{c.severity}</Badge>
                      <Badge variant="outline" className="text-[10px]">{c.conflictType.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">{c.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                      <ExternalLink className="h-3 w-3" /> Human review recommended
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-emerald-600">No conflicts detected</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
         Section 3: Missing Intelligence
         ═══════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Missing Intelligence</h2>
          <Badge variant="secondary" className="text-xs ml-auto">{missingIntelligence.length} gaps</Badge>
        </div>

        <p className="text-sm text-slate-500">
          Addressing these intelligence gaps would improve the confidence and accuracy of this recommendation.
        </p>

        <div className="space-y-4">
          {missingIntelligence.map((item, i) => {
            const parsed = parseMissingItem(item);
            return (
              <div key={i} className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 space-y-3 hover:bg-amber-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-amber-100 p-2 mt-0.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="text-sm font-semibold text-slate-800">Missing {parsed.category}</h4>
                    <p className="text-sm text-slate-500">{parsed.description}</p>
                  </div>
                </div>
                <div className="ml-11 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">{parsed.improvementHint}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
