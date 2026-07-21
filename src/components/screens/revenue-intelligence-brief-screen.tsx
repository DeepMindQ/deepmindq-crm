'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  Clock,
  Eye,
  ChevronRight,
  User,
  MessageSquare,
  DoorOpen,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BriefCompany {
  name: string;
  industry: string;
  location: string;
  sizeRange: string;
  website: string;
}

interface Factor {
  factor: string;
  impact: string;
}

interface Breakdown {
  signalQuality: number;
  evidenceQuality: number;
  capabilityFit: number;
  dataCompleteness: number;
}

interface TimelineEntry {
  date: string;
  event: string;
  type: 'signal' | 'evidence';
}

interface Recommendation {
  target: string;
  conversation: string;
  entryPoint: string;
  reason: string;
}

interface Conflict {
  type: string;
  severity: string;
  description: string;
}

interface EvidenceStats {
  total: number;
  highQuality: number;
  sources: number;
  avgRelevance: number;
}

interface BriefData {
  company: BriefCompany;
  overallScore: number;
  confidence: string;
  summary: string;
  positiveFactors: Factor[];
  negativeFactors: Factor[];
  breakdown: Breakdown;
  evidenceTimeline: TimelineEntry[];
  recommendation: Recommendation;
  conflicts: Conflict[];
  evidenceStats: EvidenceStats;
}

/* ------------------------------------------------------------------ */
/*  Demo fallback data                                                 */
/* ------------------------------------------------------------------ */

const DEMO_BRIEF: BriefData = {
  company: {
    name: 'Saudi Aramco',
    industry: 'Oil & Gas',
    location: 'Dhahran, Saudi Arabia',
    sizeRange: '10000+',
    website: 'aramco.com',
  },
  overallScore: 91,
  confidence: 'High',
  summary:
    'Large enterprise showing multiple digital transformation signals with strong alignment to AI modernization capabilities.',
  positiveFactors: [
    { factor: 'Cloud modernization initiative detected', impact: '+12' },
    { factor: 'AI/ML hiring activity increased 40%', impact: '+10' },
    { factor: 'Technology investment signals confirmed', impact: '+8' },
    { factor: 'Strong capability alignment (94%)', impact: '+8' },
    { factor: 'Multiple independent sources (8 domains)', impact: '+5' },
  ],
  negativeFactors: [
    { factor: 'Limited executive contact intelligence', impact: '-8' },
    { factor: 'One conflicting technology signal detected', impact: '-5' },
  ],
  breakdown: {
    signalQuality: 92,
    evidenceQuality: 89,
    capabilityFit: 94,
    dataCompleteness: 87,
  },
  evidenceTimeline: [
    { date: 'May 2026', event: 'AI transformation announcement detected', type: 'signal' },
    { date: 'June 2026', event: 'Cloud engineering hiring increased 40%', type: 'signal' },
    {
      date: 'June 2026',
      event: 'Technology modernization confirmed by 3 sources',
      type: 'evidence',
    },
    { date: 'July 2026', event: 'Executive alignment signals detected', type: 'signal' },
  ],
  recommendation: {
    target: 'Chief Digital Officer / CIO',
    conversation: 'AI-led operational transformation assessment',
    entryPoint: 'Digital transformation workshop',
    reason: 'Active cloud transformation signals with executive buy-in indicators',
  },
  conflicts: [
    {
      type: 'SIGNAL_CONTRADICTION',
      severity: 'MEDIUM',
      description: 'Conflicting on-premise and cloud migration signals',
    },
  ],
  evidenceStats: { total: 12, highQuality: 8, sources: 8, avgRelevance: 82 },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function confidenceColor(confidence: string) {
  switch (confidence.toLowerCase()) {
    case 'high':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'medium':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function severityColor(severity: string) {
  switch (severity.toUpperCase()) {
    case 'HIGH':
    case 'CRITICAL':
      return 'bg-red-100 text-red-700';
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? 'text-emerald-500'
      : score >= 60
        ? 'text-amber-500'
        : 'text-red-500';

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          className="text-muted/30"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          className={`${color} transition-all duration-1000 ease-out`}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <span className={`absolute text-xl font-bold ${color}`}>{score}</span>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">(weight: {weight})</span>
          <span className="font-semibold text-foreground w-10 text-right">{value}%</span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all duration-700 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function BriefSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-16 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function RevenueIntelligenceBriefScreen({
  companyId,
  navigateTo,
}: {
  companyId?: string;
  navigateTo?: (screen: string, companyId?: string) => void;
}) {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBrief() {
      if (!companyId) {
        setBrief(DEMO_BRIEF);
        setLoading(false);
        return;
      }

      try {
        const [healthRes, confidenceRes, validationRes, evidenceRes, companyRes] =
          await Promise.allSettled([
            fetch(`/api/g-intelligence/companies/${companyId}/health`).then((r) => r.json()),
            fetch(`/api/g-intelligence/companies/${companyId}/confidence`).then((r) => r.json()),
            fetch(
              `/api/g-intelligence/companies/${companyId}/validation-report`,
            ).then((r) => r.json()),
            fetch(`/api/g-intelligence/companies/${companyId}/evidence-quality`).then(
              (r) => r.json(),
            ),
            fetch(`/api/companies/${companyId}`).then((r) => r.json()),
          ]);

        if (healthRes.status === 'rejected' || !healthRes.value) {
          setBrief(DEMO_BRIEF);
          setLoading(false);
          return;
        }

        const health = healthRes.value;
        const confidence =
          confidenceRes.status === 'fulfilled' ? confidenceRes.value : null;
        const validation =
          validationRes.status === 'fulfilled' ? validationRes.value : null;
        const evidence =
          evidenceRes.status === 'fulfilled' ? evidenceRes.value : null;
        const company =
          companyRes.status === 'fulfilled' ? companyRes.value : null;

        const mapped: BriefData = {
          company: company
            ? {
                name: company.name ?? DEMO_BRIEF.company.name,
                industry: company.industry ?? DEMO_BRIEF.company.industry,
                location: company.location ?? DEMO_BRIEF.company.location,
                sizeRange: company.sizeRange ?? DEMO_BRIEF.company.sizeRange,
                website: company.website ?? DEMO_BRIEF.company.website,
              }
            : DEMO_BRIEF.company,
          overallScore: health.overallScore ?? health.score ?? DEMO_BRIEF.overallScore,
          confidence: confidence?.confidence ?? health.confidence ?? DEMO_BRIEF.confidence,
          summary:
            confidence?.summary ??
            health.summary ??
            DEMO_BRIEF.summary,
          positiveFactors:
            confidence?.positiveFactors ??
            confidence?.confidenceFactors?.filter((f: { direction?: string }) => f.direction !== 'negative') ??
            DEMO_BRIEF.positiveFactors,
          negativeFactors:
            confidence?.negativeFactors ??
            confidence?.confidenceFactors?.filter((f: { direction?: string }) => f.direction === 'negative') ??
            DEMO_BRIEF.negativeFactors,
          breakdown: {
            signalQuality:
              health.breakdown?.signalQuality ??
              health.dimensions?.signalQuality ??
              DEMO_BRIEF.breakdown.signalQuality,
            evidenceQuality:
              health.breakdown?.evidenceQuality ??
              health.dimensions?.evidenceQuality ??
              DEMO_BRIEF.breakdown.evidenceQuality,
            capabilityFit:
              health.breakdown?.capabilityFit ??
              health.dimensions?.capabilityFit ??
              DEMO_BRIEF.breakdown.capabilityFit,
            dataCompleteness:
              health.breakdown?.dataCompleteness ??
              health.dimensions?.dataCompleteness ??
              DEMO_BRIEF.breakdown.dataCompleteness,
          },
          evidenceTimeline:
            validation?.timeline ??
            validation?.evidenceTimeline ??
            health.evidenceTimeline ??
            DEMO_BRIEF.evidenceTimeline,
          recommendation:
            confidence?.recommendation ??
            health.recommendation ??
            DEMO_BRIEF.recommendation,
          conflicts:
            validation?.conflicts ??
            health.conflicts ??
            DEMO_BRIEF.conflicts,
          evidenceStats: evidence
            ? {
                total: evidence.total ?? DEMO_BRIEF.evidenceStats.total,
                highQuality:
                  evidence.highQuality ?? DEMO_BRIEF.evidenceStats.highQuality,
                sources: evidence.sources ?? DEMO_BRIEF.evidenceStats.sources,
                avgRelevance:
                  evidence.avgRelevance ??
                  DEMO_BRIEF.evidenceStats.avgRelevance,
              }
            : DEMO_BRIEF.evidenceStats,
        };

        setBrief(mapped);
      } catch {
        setBrief(DEMO_BRIEF);
      } finally {
        setLoading(false);
      }
    }

    fetchBrief();
  }, [companyId]);

  if (loading) return <BriefSkeleton />;
  if (!brief) return null;

  const {
    company,
    overallScore,
    confidence,
    summary,
    positiveFactors,
    negativeFactors,
    breakdown,
    evidenceTimeline,
    recommendation,
    conflicts,
    evidenceStats,
  } = brief;

  return (
    <div className="bg-background min-h-screen">
      <main className="max-w-4xl mx-auto px-6 py-8 sm:px-8 sm:py-10">
        {/* Back button */}
        <button
          onClick={() => navigateTo?.('revenue-intelligence')}
          className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back to Revenue Intelligence
        </button>

        {/* Section 1: Executive Summary */}
        <section className="mb-10" aria-label="Executive Summary">
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            {company.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {company.industry} &middot; {company.location} &middot; {company.sizeRange} employees
          </p>
          <p className="mt-4 text-base leading-relaxed text-foreground/80 max-w-2xl">
            {summary}
          </p>
          <div className="mt-6 flex items-center gap-5">
            <ScoreRing score={overallScore} />
            <span
              className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-semibold border ${confidenceColor(confidence)}`}
            >
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              {confidence.toUpperCase()} CONFIDENCE
            </span>
          </div>
        </section>

        {/* Section 2: Why This Account? */}
        <section className="mb-10" aria-label="Why This Account">
          <h2 className="text-lg font-semibold text-foreground">Why This Account?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Key intelligence signals driving this score
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Positive factors */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 mb-2">
                <TrendingUp className="w-4 h-4" />
                Positive Signals
              </div>
              {positiveFactors.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 pl-4 py-2.5 border-l-2 border-emerald-400 rounded-r-lg bg-emerald-50/60"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground/90 leading-snug">
                      {f.factor}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 shrink-0">
                    {f.impact}
                  </span>
                </div>
              ))}
            </div>

            {/* Negative factors */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-2">
                <TrendingDown className="w-4 h-4" />
                Risk Factors
              </div>
              {negativeFactors.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 pl-4 py-2.5 border-l-2 border-amber-400 rounded-r-lg bg-amber-50/60"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground/90 leading-snug">
                      {f.factor}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-amber-600 shrink-0">
                    {f.impact}
                  </span>
                </div>
              ))}
              {negativeFactors.length === 0 && (
                <p className="text-sm text-muted-foreground italic pl-4">
                  No significant risk factors detected
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Section 3: Intelligence Score Breakdown */}
        <section className="mb-10" aria-label="Intelligence Confidence">
          <h2 className="text-lg font-semibold text-foreground">Intelligence Confidence</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Multi-dimensional assessment of data quality and reliability
          </p>

          <div className="bg-white rounded-xl border p-6 space-y-5">
            <ScoreBar label="Signal Quality" value={breakdown.signalQuality} weight="30%" />
            <ScoreBar label="Evidence Strength" value={breakdown.evidenceQuality} weight="30%" />
            <ScoreBar label="Capability Fit" value={breakdown.capabilityFit} weight="25%" />
            <ScoreBar
              label="Data Completeness"
              value={breakdown.dataCompleteness}
              weight="15%"
            />
            <div className="pt-3 mt-3 border-t border-muted">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Overall Score</span>
                <span className="text-lg font-bold text-emerald-600">{overallScore}%</span>
              </div>
            </div>
          </div>

          {/* Evidence stats row */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Evidence', value: evidenceStats.total, icon: Eye },
              { label: 'High Quality', value: evidenceStats.highQuality, icon: CheckCircle2 },
              { label: 'Sources', value: evidenceStats.sources, icon: Target },
              {
                label: 'Avg Relevance',
                value: `${evidenceStats.avgRelevance}%`,
                icon: TrendingUp,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-lg border px-4 py-3 flex items-center gap-3"
              >
                <s.icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-sm font-semibold text-foreground">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Conflicts warning (conditional) */}
        {conflicts.length > 0 && (
          <section className="mb-10" aria-label="Intelligence Conflicts">
            <h2 className="text-lg font-semibold text-foreground">
              Intelligence Conflicts
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Contradictory signals detected during analysis
            </p>
            <div className="space-y-3">
              {conflicts.map((c, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4"
                >
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {c.type.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${severityColor(c.severity)}`}
                      >
                        {c.severity}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 4: Evidence Timeline */}
        <section className="mb-10" aria-label="Intelligence Journey">
          <h2 className="text-lg font-semibold text-foreground">Intelligence Journey</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Chronological evidence and signal collection
          </p>

          <div className="bg-white rounded-xl border p-6">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[18px] top-2 bottom-2 w-px bg-amber-200" />

              <div className="space-y-6">
                {evidenceTimeline.map((entry, i) => (
                  <div key={i} className="relative flex gap-4">
                    {/* Dot */}
                    <div className="relative z-10 mt-1.5 w-[10px] h-[10px] rounded-full bg-amber-400 ring-4 ring-amber-100 shrink-0" />
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {entry.date}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${entry.type === 'signal' ? 'border-amber-300 text-amber-700' : 'border-emerald-300 text-emerald-700'}`}
                        >
                          {entry.type.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground mt-0.5">{entry.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Recommended Sales Motion */}
        <section className="mb-12" aria-label="Recommended Engagement">
          <h2 className="text-lg font-semibold text-foreground">
            Recommended Engagement
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Advisory suggestion &middot; No CRM objects created
          </p>

          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Target Decision Maker
                </p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-foreground">
                    {recommendation.target}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Conversation Theme
                </p>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-foreground">
                    {recommendation.conversation}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Entry Point
                </p>
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-foreground">
                    {recommendation.entryPoint}
                  </span>
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Why Now
                </p>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 mt-0.5" />
                  <span className="text-sm text-foreground/80 leading-relaxed">
                    {recommendation.reason}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}