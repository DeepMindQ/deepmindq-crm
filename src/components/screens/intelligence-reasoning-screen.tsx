'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Eye,
  FileWarning,
  Info,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Clock,
  BarChart3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
// @ts-ignore — demo-data.ts is excluded from TS compilation
import { DEMO_TRUST_REPORT as CANONICAL_TRUST, isDemoId, type DemoTrustReportData } from '@/lib/demo-data';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TrustReportData = DemoTrustReportData;

/* ------------------------------------------------------------------ */
/*  Demo Fallback — canonical source: lib/demo-data.ts                */
/* ------------------------------------------------------------------ */

const DEMO_DATA = CANONICAL_TRUST;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 60) return 'stroke-amber-500';
  return 'stroke-red-500';
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
    case 'CRITICAL':
    case 'HIGH':
      return 'destructive';
    case 'MEDIUM':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getQualityBadge(quality: string): { label: string; className: string } {
  switch (quality.toLowerCase()) {
    case 'high':
      return { label: 'High', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    case 'medium':
      return { label: 'Medium', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    default:
      return { label: 'Low', className: 'bg-gray-100 text-gray-600 border-gray-200' };
  }
}

function parseMissingItem(item: string | MissingItem): MissingItem {
  if (typeof item === 'string') {
    return { category: 'Data Gap', description: item, improvementHint: 'Addressing this gap would improve overall intelligence quality' };
  }
  return item;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ConfidenceCircle({ score }: { score: number }) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const colorClass = getScoreColor(score);
  const ringColorClass = getScoreRingColor(score);

  return (
    <div className="relative flex items-center justify-center w-36 h-36 mx-auto">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-muted/30"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={`${ringColorClass} transition-all duration-1000 ease-out`}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold ${colorClass}`}>{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Confidence
        </span>
      </div>
    </div>
  );
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  const colorClass = getScoreColor(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${colorClass}`}>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            value >= 80 ? 'bg-emerald-400' : value >= 60 ? 'bg-amber-400' : 'bg-red-400'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="rounded-2xl border p-8 space-y-6">
        <div className="flex items-center justify-center">
          <Skeleton className="h-36 w-36 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isDemoId(companyId)) {
        setData(DEMO_DATA);
        setLoading(false);
        return;
      }

      try {
        if (recommendationId) {
          const res = await fetch(
            `/api/g-intelligence/recommendations/${recommendationId}/trust-report`
          );
          if (res.ok) {
            const json = await res.json();
            if (!cancelled) {
              setData(json as TrustReportData);
              setLoading(false);
              return;
            }
          }
        }
        // Fallback to demo
        if (!cancelled) {
          setData(DEMO_DATA);
          setLoading(false);
        }
      } catch (e) {
        console.error('[intelligence-reasoning] Failed to load data, using demo fallback:', e);
        if (!cancelled) {
          setData(DEMO_DATA);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [companyId, recommendationId]);

  /* ── Loading ── */
  if (loading) return <LoadingSkeleton />;

  /* ── Error ── */
  if (error && !data) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <button
          onClick={() => navigateTo?.('dashboard')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">Failed to load intelligence reasoning</p>
          <p className="text-red-600/70 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { recommendation, overallConfidence, breakdown, factors, conflicts, missingIntelligence } = data;
  const aiReasoning = data.aiReasoning || 'Multiple independent signals indicate active digital transformation investment based on a convergence of hiring patterns, technology announcements, and industry activity.';
  const evidenceRows = data.evidenceRows || [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
      {/* ── Header ── */}
      <div className="space-y-2">
        <button
          onClick={() => navigateTo?.('dashboard', companyId)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
        <div className="flex items-center gap-3 pt-2">
          <Shield className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Intelligence Reasoning</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {recommendation.title} &mdash; {recommendation.company}
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  Section 1: Why AI Believes This                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border bg-card p-6 md:p-8 space-y-8">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Why AI Believes This</h2>
        </div>

        {/* Confidence Circle + Tier */}
        <div className="flex flex-col items-center gap-4">
          <ConfidenceCircle score={overallConfidence} />
          <Badge
            variant={overallConfidence >= 80 ? 'default' : overallConfidence >= 60 ? 'secondary' : 'destructive'}
            className="text-xs px-3 py-1"
          >
            {getTierLabel(overallConfidence)}
          </Badge>
        </div>

        {/* AI Reasoning Paragraph */}
        <div className={`rounded-xl border p-5 ${getScoreBgColor(overallConfidence)}`}>
          <div className="flex items-start gap-3">
            <BarChart3 className="h-5 w-5 shrink-0 mt-0.5 opacity-60" />
            <p className="text-sm leading-relaxed text-foreground/80">{aiReasoning}</p>
          </div>
        </div>

        {/* Dimension Breakdown */}
        {breakdown && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <DimensionBar label="Signal Quality" value={breakdown.signalQuality} />
            <DimensionBar label="Evidence Quality" value={breakdown.evidenceQuality} />
            <DimensionBar label="Capability Fit" value={breakdown.capabilityFit} />
            <DimensionBar label="Data Completeness" value={breakdown.dataCompleteness} />
          </div>
        )}

        <Separator />

        {/* Positive & Negative Factors */}
        {factors && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Positive */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <TrendingUp className="h-4 w-4" />
                Positive Contributors
              </div>
              <div className="space-y-2">
                {factors.positiveFactors.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-emerald-50/70 border border-emerald-100"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-sm leading-snug">{f.factor}</span>
                    </div>
                    <span className="font-semibold text-emerald-700 text-sm shrink-0">{f.impact}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Negative */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <TrendingDown className="h-4 w-4" />
                Negative Contributors
              </div>
              <div className="space-y-2">
                {factors.negativeFactors.length > 0 ? (
                  factors.negativeFactors.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50/70 border border-red-100"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <span className="text-sm leading-snug">{f.factor}</span>
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
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  Section 2: Evidence & Conflicts                               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-8">
        <div className="flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Evidence &amp; Conflicts</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evidence Table */}
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Evidence Sources
              <Badge variant="outline" className="ml-auto text-xs">
                {data.supportingEvidence.total} items
              </Badge>
            </h3>

            {evidenceRows.length > 0 ? (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Quality</th>
                      <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {evidenceRows.slice(0, 6).map((row, i) => {
                      const q = getQualityBadge(row.quality);
                      return (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium">{row.source}</td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            <Clock className="h-3 w-3 inline mr-1 opacity-50" />
                            {row.date}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${q.className}`}>
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
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No structured evidence data available</p>
              </div>
            )}

            {/* Supporting evidence stats */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-bold text-emerald-600">{data.supportingEvidence.validatedSignals}</p>
                <p className="text-xs text-muted-foreground">Valid Signals</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-bold text-amber-600">{data.supportingEvidence.weakSignals}</p>
                <p className="text-xs text-muted-foreground">Weak Signals</p>
              </div>
            </div>
          </div>

          {/* Conflicts List */}
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Active Conflicts
              <Badge variant={conflicts.length > 0 ? 'destructive' : 'outline'} className="ml-auto text-xs">
                {conflicts.length}
              </Badge>
            </h3>

            {conflicts.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {conflicts.map((c, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-2 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getSeverityVariant(c.severity)} className="text-xs">
                        {c.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {c.conflictType.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80">{c.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                      <ExternalLink className="h-3 w-3" />
                      Human review required
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-emerald-600">No conflicts detected</p>
                <p className="text-xs mt-1">All signals are consistent</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  Section 3: Missing Intelligence                               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border bg-card p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Missing Intelligence</h2>
          <Badge variant="secondary" className="text-xs ml-auto">
            {missingIntelligence.length} gaps
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Addressing these intelligence gaps would improve the confidence and accuracy of this recommendation.
        </p>

        {missingIntelligence.length > 0 ? (
          <div className="space-y-4">
            {missingIntelligence.map((item, i) => {
              const parsed = parseMissingItem(item);
              return (
                <div
                  key={i}
                  className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 space-y-3 hover:bg-amber-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-amber-100 p-2 mt-0.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">
                          Missing {parsed.category}
                        </h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{parsed.description}</p>
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
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
            <p className="text-sm font-medium text-emerald-600">Intelligence is complete</p>
            <p className="text-xs mt-1">No critical gaps identified</p>
          </div>
        )}
      </section>

      {/* ── Footer spacer ── */}
      <div className="h-4" />
    </div>
  );
}