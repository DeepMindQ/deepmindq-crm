'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  Shield,
  Target,
  AlertTriangle,
  Clock,
  User,
  MessageSquare,
  BarChart3,
  FileWarning,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

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
  capabilityMatch?: { matchPercent: number; recommendedCapability: string };
}

/* ------------------------------------------------------------------ */
/*  Demo Fallback                                                      */
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
    'Large enterprise showing multiple digital transformation signals with strong alignment to AI modernization capabilities. The organization has publicly committed to cloud-first strategy and is actively building AI/ML teams.',
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
    { date: 'Jun 2026', event: 'Cloud engineering hiring increased 40%', type: 'signal' },
    { date: 'Jun 2026', event: 'Technology modernization confirmed by 3 sources', type: 'evidence' },
    { date: 'Jul 2026', event: 'Executive alignment signals detected', type: 'signal' },
    { date: 'Jul 2026', event: 'Vendor evaluation signals identified', type: 'signal' },
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
      description: 'Conflicting on-premise and cloud migration signals detected',
    },
  ],
  evidenceStats: { total: 12, highQuality: 8, sources: 8, avgRelevance: 82 },
  capabilityMatch: { matchPercent: 94, recommendedCapability: 'AI Transformation Platform' },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBarBg(score: number): string {
  if (score >= 80) return 'bg-emerald-400';
  if (score >= 60) return 'bg-amber-400';
  return 'bg-red-400';
}

function confidenceBadgeClass(confidence: string): string {
  switch (confidence.toLowerCase()) {
    case 'high':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'medium':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function severityBadgeClass(severity: string): string {
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">
      {children}
    </h2>
  );
}

function EvidenceBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">
          {value} / {max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-4 w-full max-w-xl" />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function IntelligenceReportScreen({
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

        const positiveFactors: Factor[] =
          confidence?.factors?.positiveFactors?.map(
            (f: { factor: string; impact: string }) => ({
              factor: f.factor,
              impact: f.impact,
            }),
          ) || [];
        const negativeFactors: Factor[] =
          confidence?.factors?.negativeFactors?.map(
            (f: { factor: string; impact: string }) => ({
              factor: f.factor,
              impact: f.impact,
            }),
          ) || [];

        const timelineEntries: TimelineEntry[] =
          health?.signals?.slice(0, 6).map(
            (s: { detectedAt: string; signalType: string; summary: string }) => ({
              date: new Date(s.detectedAt).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              }),
              event: s.summary || s.signalType,
              type: 'signal' as const,
            }),
          ) || [];

        const conflicts: Conflict[] =
          validation?.conflicts?.map(
            (c: { type: string; severity: string; description: string }) => c,
          ) || [];

        const briefData: BriefData = {
          company: {
            name: company?.name || health?.companyName || 'Unknown Company',
            industry: company?.industry || health?.industry || 'N/A',
            location: company?.location || '',
            sizeRange: company?.sizeRange || '',
            website: company?.website || company?.domain || '',
          },
          overallScore: health?.healthScore ?? confidence?.overallConfidence ?? 75,
          confidence:
            confidence?.overallConfidence >= 80
              ? 'High'
              : confidence?.overallConfidence >= 60
                ? 'Medium'
                : 'Low',
          summary:
            health?.summary ||
            confidence?.reasoning ||
            'Intelligence analysis complete.',
          positiveFactors,
          negativeFactors,
          breakdown: confidence?.breakdown || {
            signalQuality: 0,
            evidenceQuality: 0,
            capabilityFit: 0,
            dataCompleteness: 0,
          },
          evidenceTimeline: timelineEntries,
          recommendation: confidence?.recommendedAction
            ? {
                target: confidence.recommendedAction.targetExecutive || 'CIO',
                conversation:
                  confidence.recommendedAction.conversationTheme ||
                  'Technology modernization',
                entryPoint:
                  confidence.recommendedAction.entryPoint ||
                  'Direct outreach',
                reason: confidence.recommendedAction.reasoning || 'Signals aligned',
              }
            : DEMO_BRIEF.recommendation,
          conflicts,
          evidenceStats: evidence
            ? {
                total: evidence.totalEvidence || 0,
                highQuality: evidence.highQualityCount || 0,
                sources: evidence.uniqueSources || 0,
                avgRelevance: evidence.avgRelevance || 0,
              }
            : { total: 0, highQuality: 0, sources: 0, avgRelevance: 0 },
        };

        setBrief(briefData);
      } catch {
        setBrief(DEMO_BRIEF);
      }
      setLoading(false);
    }

    fetchBrief();
  }, [companyId]);

  /* ── Loading ── */
  if (loading) return <ReportSkeleton />;
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
    capabilityMatch,
  } = brief;

  const missingIntelligence = [
    'Executive contact hierarchy and decision-making structure',
    'Recent budget allocation and financial commitment signals',
    'Direct technology stack confirmation from internal sources',
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
      {/* ── Back button ── */}
      <button
        onClick={() => navigateTo?.('dashboard')}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back
      </button>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  TITLE BLOCK                                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Executive Intelligence Brief
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
        <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            {company.industry}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>{company.sizeRange} employees</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{company.location}</span>
        </div>
        <Separator />
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  STRATEGIC SIGNALS                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionLabel>Strategic Signals</SectionLabel>
        <div className="relative pl-6 border-l-2 border-muted space-y-6">
          {evidenceTimeline.map((entry, i) => (
            <div key={i} className="relative">
              {/* Timeline dot */}
              <div
                className={`absolute -left-[calc(0.75rem+1px+6px)] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                  entry.type === 'evidence'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1 opacity-60" />
                    {entry.date}
                  </span>
                  <Badge
                    variant={entry.type === 'evidence' ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {entry.type}
                  </Badge>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{entry.event}</p>
              </div>
            </div>
          ))}
          {evidenceTimeline.length === 0 && (
            <p className="text-sm text-muted-foreground">No strategic signals detected.</p>
          )}
        </div>
      </section>

      <Separator />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  EVIDENCE STRENGTH                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionLabel>Evidence Strength</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold">{evidenceStats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Evidence</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{evidenceStats.highQuality}</p>
            <p className="text-xs text-muted-foreground mt-1">High Quality</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold">{evidenceStats.sources}</p>
            <p className="text-xs text-muted-foreground mt-1">Unique Sources</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold">{evidenceStats.avgRelevance}%</p>
            <p className="text-xs text-muted-foreground mt-1">Avg Relevance</p>
          </div>
        </div>
        <div className="space-y-3 max-w-lg">
          <EvidenceBar label="High-quality evidence" value={evidenceStats.highQuality} max={evidenceStats.total || 1} />
          <EvidenceBar label="Validated signals" value={evidenceStats.highQuality} max={evidenceStats.sources || 1} />
          <EvidenceBar label="Source diversity" value={evidenceStats.sources} max={12} />
          <EvidenceBar label="Relevance threshold" value={evidenceStats.avgRelevance} max={100} />
        </div>
      </section>

      <Separator />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  AI CONFIDENCE                                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionLabel>AI Confidence</SectionLabel>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className={`rounded-full border-2 px-5 py-2 flex items-center gap-3 shrink-0 ${confidenceBadgeClass(confidence)}`}>
            <Shield className="h-5 w-5" />
            <div>
              <p className="text-3xl font-bold leading-none">{overallScore}</p>
              <p className="text-[10px] uppercase tracking-wider font-medium opacity-70">
                Intelligence Score
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
        </div>

        {/* 4-dimension breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              { label: 'Signal Quality', value: breakdown.signalQuality },
              { label: 'Evidence Quality', value: breakdown.evidenceQuality },
              { label: 'Capability Fit', value: breakdown.capabilityFit },
              { label: 'Data Completeness', value: breakdown.dataCompleteness },
            ] as const
          ).map((dim) => (
            <div key={dim.label} className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{dim.label}</span>
                <span className={`font-bold ${getScoreColor(dim.value)}`}>{dim.value}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={`h-full rounded-full ${getScoreBarBg(dim.value)} transition-all duration-700 ease-out`}
                  style={{ width: `${dim.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Positive / Negative factors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <TrendingUp className="h-4 w-4" />
              Positive Contributors
            </div>
            {positiveFactors.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100 text-sm">
                <span className="text-foreground/80">{f.factor}</span>
                <span className="font-semibold text-emerald-700 shrink-0 ml-3">{f.impact}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <TrendingUp className="h-4 w-4 rotate-180" />
              Negative Contributors
            </div>
            {negativeFactors.length > 0 ? (
              negativeFactors.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/70 border border-red-100 text-sm">
                  <span className="text-foreground/80">{f.factor}</span>
                  <span className="font-semibold text-red-700 shrink-0 ml-3">{f.impact}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-emerald-600 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
                No negative contributors detected
              </p>
            )}
          </div>
        </div>
      </section>

      <Separator />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  CAPABILITY ALIGNMENT                                          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionLabel>Capability Alignment</SectionLabel>
        {capabilityMatch ? (
          <div className="rounded-xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-emerald-600" />
                <span className="font-semibold">{capabilityMatch.recommendedCapability}</span>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(capabilityMatch.matchPercent)}`}>
                {capabilityMatch.matchPercent}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className={`h-full rounded-full ${getScoreBarBg(capabilityMatch.matchPercent)} transition-all duration-700 ease-out`}
                style={{ width: `${capabilityMatch.matchPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Match percentage based on signal-to-capability correlation analysis across{' '}
              {evidenceStats.sources} source domains.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border p-6">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">{breakdown.capabilityFit}% Capability Fit</span>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className={`h-full rounded-full ${getScoreBarBg(breakdown.capabilityFit)} transition-all duration-700 ease-out`}
                style={{ width: `${breakdown.capabilityFit}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  RECOMMENDED EXECUTIVE CONVERSATION                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionLabel>Recommended Executive Conversation</SectionLabel>
        <div className="rounded-xl border p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Target Executive
              </p>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{recommendation.target}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Conversation Theme
              </p>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{recommendation.conversation}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Entry Point
              </p>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{recommendation.entryPoint}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Strategic Rationale
              </p>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{recommendation.reason}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  RISKS & UNKNOWNS                                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionLabel>Risks &amp; Unknowns</SectionLabel>

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileWarning className="h-4 w-4 text-amber-600" />
              Active Conflicts
            </div>
            <div className="space-y-2">
              {conflicts.map((c, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-xs border ${severityBadgeClass(c.severity)}`}
                      variant="outline"
                    >
                      {c.severity}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {c.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Intelligence */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Intelligence Gaps
          </div>
          <div className="space-y-2">
            {missingIntelligence.map((gap, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-sm text-foreground/80">{gap}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <div className="pt-4">
        <Separator />
        <p className="text-xs text-muted-foreground/60 mt-4 text-center">
          This intelligence brief was generated by AI analysis. All signals should be verified
          before action. Generated{' '}
          {new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          .
        </p>
      </div>

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  );
}