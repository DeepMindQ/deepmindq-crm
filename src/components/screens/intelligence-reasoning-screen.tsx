'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Shield, Eye,
  FileWarning, Info, TrendingUp, TrendingDown, ExternalLink,
  Clock, BarChart3, Sparkles, ChevronRight, ArrowLeft, Loader2, Brain,
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
      <svg aria-hidden="true" className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="6" className="stroke-slate-100" />
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="6" strokeLinecap="round"
          stroke={color} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('text-3xl font-bold', getScoreColor(score))}>{score}</span>
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Confidence</span>
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
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Evidence</p>
              {step.evidence.map((ev, i) => (
                <div key={i} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <EvidenceBadge source={ev.source} />
                    <Badge variant="outline" className={cn('text-[11px]', getQualityBadge(ev.quality).className)}>
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
              <p className="text-[11px] uppercase tracking-wider text-blue-600 font-semibold mb-1">Conclusion</p>
              <p className="text-sm text-slate-700 leading-relaxed">{step.conclusion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WI-4: Real Pipeline Types — mapped from /api/intelligence/reasoning/{companyId}
   ═══════════════════════════════════════════════════════════════ */
interface ReasoningApiResponse {
  success: boolean;
  data?: {
    companyId: string;
    reasoningContextId: string;
    overallConfidence: number;
    winProbability: number;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    totalAIcalls: number;
    totalTokensUsed: number;
    totalCostUsd: number;
    durationMs: number;
    summary: string | null;
    steps: Array<{
      stepNumber: number;
      stepName: string;
      status: 'completed' | 'pending';
      output: string | null;
      summary: string | null;
      confidence: number;
      durationMs: number;
      aiCalls: number;
      tokensUsed: number;
      costUsd: number;
    }>;
    impact?: Array<{
      stepNumber: number;
      stepName: string;
      summary: string | null;
      confidence: number;
    }>;
    recommendations?: Array<{
      stepNumber: number;
      stepName: string;
      summary: string | null;
      confidence: number;
    }>;
  };
  error?: string;
  meta?: {
    durationMs: number;
    confidence: number;
    freshness: { level: string; label: string };
  };
}

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
  /* ── WI-4: All state derived from real API. No mock data. ── */
  const [reasoningData, setReasoningData] = useState<ReasoningApiResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch from real reasoning pipeline
  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadReasoning() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/intelligence/reasoning/${companyId}?include=steps,impact,recommendations`);
        if (!res.ok) throw new Error(`Reasoning API returned ${res.status}`);
        const json: ReasoningApiResponse = await res.json();
        if (!cancelled) {
          setReasoningData(json.success ? (json.data ?? null) : null);
          setError(json.success ? null : (json.error || 'Reasoning pipeline failed'));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to connect to reasoning pipeline');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReasoning();
    return () => { cancelled = true; };
  }, [companyId]);

  // Derive reasoning steps from real pipeline data
  const reasoningSteps: ReasoningStep[] = useMemo(() => {
    if (!reasoningData?.steps) return [];
    return reasoningData.steps.map((s, i) => ({
      id: `step-${s.stepNumber}`,
      title: s.stepName,
      description: s.summary || s.output || `Step ${s.stepNumber}: ${s.stepName}`,
      evidence: s.output
        ? [{ source: 'engine', content: s.output.slice(0, 300), quality: s.confidence >= 0.7 ? 'high' : 'medium' }]
        : [],
      conclusion: s.summary || '',
      confidence: Math.round(s.confidence * 100),
      status: s.status === 'completed' ? 'complete' as const : 'pending' as const,
    }));
  }, [reasoningData]);

  // Derive impact/recommendation steps
  const impactSteps = reasoningData?.impact ?? [];
  const recommendationSteps = reasoningData?.recommendations ?? [];

  // Derive evidence rows from impact steps
  const evidenceRows: EvidenceRow[] = useMemo(() => {
    return impactSteps.map((imp) => ({
      source: imp.stepName,
      date: new Date().toISOString().split('T')[0],
      quality: imp.confidence >= 0.7 ? 'high' : 'medium',
      impact: `+${Math.round(imp.confidence * 100)}`,
    }));
  }, [impactSteps]);

  // Derive positive/negative factors from high-confidence and low-confidence steps
  const { positiveFactors, negativeFactors } = useMemo(() => {
    const pos: Factor[] = [];
    const neg: Factor[] = [];
    if (!reasoningData?.steps) return { positiveFactors: pos, negativeFactors: neg };
    for (const step of reasoningData.steps) {
      const pct = Math.round(step.confidence * 100);
      const summary = step.summary || step.stepName;
      if (step.confidence >= 0.7) {
        pos.push({ factor: summary, impact: `+${pct}` });
      } else if (step.confidence > 0 && step.confidence < 0.5) {
        neg.push({ factor: summary, impact: `-${100 - pct}` });
      }
    }
    return { positiveFactors: pos.slice(0, 6), negativeFactors: neg.slice(0, 4) };
  }, [reasoningData]);

  // Derive conflicts from steps with low confidence or failed status
  const conflicts: Conflict[] = useMemo(() => {
    if (!reasoningData?.steps) return [];
    return reasoningData.steps
      .filter(s => s.confidence < 0.4 || (s.status === 'pending' && s.stepNumber > 1))
      .map(s => ({
        conflictType: 'insufficient_data',
        severity: s.confidence < 0.2 ? 'HIGH' : 'MEDIUM',
        description: s.summary || `${s.stepName} has low confidence (${Math.round(s.confidence * 100)}%) — may need additional data sources.`,
      }));
  }, [reasoningData]);

  // Missing intelligence derived from steps that are still pending
  const missingIntelligence: Array<string | MissingItem> = useMemo(() => {
    if (!reasoningData?.steps) return [];
    const pending = reasoningData.steps.filter(s => s.status === 'pending');
    if (pending.length === 0) return [];
    return [{
      category: 'Incomplete Reasoning',
      description: `${pending.length} of ${reasoningData.totalSteps} reasoning steps are still pending. These steps require additional data or processing to complete.`,
      improvementHint: 'Run intelligence enrichment or ensure company data is up to date to complete all reasoning steps.',
    }];
  }, [reasoningData]);

  // AI reasoning summary derived from real pipeline
  const aiReasoning = reasoningData?.summary
    || (reasoningSteps.length > 0
      ? `Completed ${reasoningData?.completedSteps ?? 0}/${reasoningData?.totalSteps ?? 0} reasoning steps. ${reasoningSteps.filter(s => s.confidence >= 70).length} steps show high confidence.`
      : 'No reasoning data available yet.');

  // Confidence and breakdown from real pipeline
  const overallConfidence = Math.round((reasoningData?.overallConfidence ?? 0) * 100);

  const breakdown = useMemo(() => ({
    signalQuality: reasoningSteps.length > 0 ? Math.max(...reasoningSteps.map(s => s.confidence)) : 0,
    evidenceQuality: evidenceRows.length > 0 ? Math.round(evidenceRows.reduce((sum, r) => sum + parseInt(r.impact), 0) / evidenceRows.length) : 0,
    capabilityFit: impactSteps.length > 0 ? Math.round(Math.max(...impactSteps.map(i => i.confidence)) * 100) : 0,
    dataCompleteness: reasoningData ? Math.round((reasoningData.completedSteps / Math.max(reasoningData.totalSteps, 1)) * 100) : 0,
  }), [reasoningSteps, evidenceRows, impactSteps, reasoningData]);

  const supportingEvidence = {
    total: reasoningSteps.length,
    validatedSignals: reasoningSteps.filter(s => s.status === 'complete' && s.confidence >= 60).length,
    weakSignals: reasoningSteps.filter(s => s.confidence < 50).length,
  };

  const recommendation: RecommendationData = {
    id: recommendationId || reasoningData?.reasoningContextId || 'none',
    title: recommendationSteps.length > 0
      ? recommendationSteps[0].stepName
      : 'Intelligence Analysis',
    company: companyId || 'Unknown',
    priority: overallConfidence >= 70 ? 'HIGH' : overallConfidence >= 50 ? 'MEDIUM' : 'LOW',
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  // ── No companyId → empty state ──
  if (!companyId) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Intelligence Reasoning
          </h1>
        </div>
        <EmptyState
          icon={Brain}
          title="No company selected"
          description="Select a company to run the intelligence reasoning pipeline. The reasoning engine analyzes signals, evidence, and market data to produce confidence-scored insights."
        />
      </div>
    );
  }

  // ── Error state ──
  if (error && !reasoningData) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Intelligence Reasoning
          </h1>
          {navigateTo && companyId && (
            <button
              onClick={() => navigateTo('company-detail', companyId)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to company
            </button>
          )}
        </div>
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  // ── Pipeline metadata badge ──
  const PipelineMeta = reasoningData ? (
    <div className="flex items-center gap-2 text-[10px] text-slate-400">
      {reasoningData.totalAIcalls > 0 && (
        <span>{reasoningData.totalAIcalls} AI calls</span>
      )}
      {reasoningData.durationMs > 0 && (
        <span>{(reasoningData.durationMs / 1000).toFixed(1)}s</span>
      )}
      {reasoningData.totalSteps > 0 && (
        <span>{reasoningData.completedSteps}/{reasoningData.totalSteps} steps</span>
      )}
    </div>
  ) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* ── Header ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Intelligence Reasoning
          </h1>
          {navigateTo && companyId && (
            <button
              onClick={() => navigateTo('company-detail', companyId)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to company
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">
            {recommendation.title} — {recommendation.company}
          </p>
          {PipelineMeta}
        </div>
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
            {reasoningSteps.length > 0 ? (
              reasoningSteps.map((step, idx) => (
                <ReasoningStepCard key={step.id} step={step} index={idx} totalSteps={reasoningSteps.length} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Sparkles className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No reasoning steps available yet.</p>
                <p className="text-xs text-slate-400 mt-1">The reasoning pipeline will produce steps when intelligence data is available.</p>
              </div>
            )}
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
              {positiveFactors.map((f, i) => (
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
              {negativeFactors.length > 0 ? (
                negativeFactors.map((f, i) => (
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
              <Badge variant="outline" className="ml-auto text-[11px] bg-slate-50">{supportingEvidence.total} items</Badge>
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
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', q.className)}>
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
                <p className="text-[11px] text-slate-400">Valid Signals</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-center">
                <p className="text-lg font-bold text-amber-600">{supportingEvidence.weakSignals}</p>
                <p className="text-[11px] text-slate-400">Weak Signals</p>
              </div>
            </div>
          </div>

          {/* Conflicts */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-slate-400" /> Active Conflicts
              <Badge variant={conflicts.length > 0 ? 'destructive' : 'outline'}
                className={cn('ml-auto text-[11px]', conflicts.length === 0 && 'bg-emerald-50 text-emerald-700 border-emerald-200')}>
                {conflicts.length}
              </Badge>
            </h3>
            {conflicts.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {conflicts.map((c, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-4 space-y-2 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getSeverityVariant(c.severity)} className="text-[11px]">{c.severity}</Badge>
                      <Badge variant="outline" className="text-[11px]">{c.conflictType.replace(/_/g, ' ')}</Badge>
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
