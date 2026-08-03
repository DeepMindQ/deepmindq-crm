'use client';

/**
 * WI-17C — Account Recommendation Card
 *
 * Displays the AI-generated recommendation for a company in the
 * Company Workspace. Shows:
 *   - Opportunity Score with priority badge
 *   - Confidence Grade with trust classification
 *   - "Why this account?" explanation
 *   - Evidence-backed reasons (with strength indicators)
 *   - Risk factors
 *   - Recommended Action with timeline
 *   - Knowledge Graph and Memory enrichment indicators
 *
 * Visual Language: Dark Intelligence OS (consistent with company-workspace.tsx)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Target, Shield, Zap, AlertTriangle, ArrowRight,
  Brain, Layers, Clock, TrendingUp, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Circle, RefreshCw, Lightbulb,
  ExternalLink, BarChart3, Radio,
} from 'lucide-react';

// ── Types (matching recommendation-engine.ts output) ──

interface RecommendationReason {
  text: string;
  category: 'signal' | 'capability' | 'pattern' | 'timing' | 'contact' | 'similarity' | 'icp_fit';
  strength: number;
  sourceId?: string;
  sourceType?: string;
}

interface RecommendationRisk {
  text: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  mitigation?: string;
  sourceId?: string;
}

interface AccountRecommendation {
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  companyIndustry: string | null;
  opportunityScore: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tier: string;
  confidenceGrade: string;
  confidenceScore: number;
  enterpriseReady: boolean;
  signalCount: number;
  opportunityCount: number;
  capabilityMatchCount: number;
  highSeveritySignalCount: number;
  contactCount: number;
  reasons: RecommendationReason[];
  risks: RecommendationRisk[];
  recommendedAction: {
    text: string;
    timeline: string;
    targetRole?: string;
    conversationAngle?: string;
  };
  whyThisAccount: string;
  graphInsights?: { similarCompanies: number; relationshipPatterns: number };
  memoryPatterns?: { relevantMemories: number; enterpriseContext: string };
  topOpportunity?: { title: string; score: number; signalType: string; whyNow: string };
  generatedAt: string;
  confidenceFactors?: Array<{ dimension: string; score: number; weight: number; explanation: string }>;
}

// ── Color System ──

const COLORS = {
  bgCard: 'var(--ios-bg-card, rgba(255,255,255,0.05))',
  bgElevated: 'var(--ios-bg-elevated, #1a1a2e)',
  border: 'var(--ios-border, rgba(255,255,255,0.1))',
  textPrimary: 'var(--ios-text-primary, #f0f0f5)',
  textSecondary: 'var(--ios-text-secondary, #a0a0b8)',
  textMuted: 'var(--ios-text-muted, #6b6b80)',
  accent: 'var(--ios-accent, #6366f1)',
  signal: 'var(--ios-signal, #f97316)',
  opportunity: 'var(--ios-opportunity, #a855f7)',
  confHigh: 'var(--ios-confidence-high, #10b981)',
  confMedium: 'var(--ios-confidence-medium, #f59e0b)',
  confLow: 'var(--ios-confidence-low, #ef4444)',
  intelligence: 'var(--ios-intelligence, #06b6d4)',
};

// ── Priority Config ──

const PRIORITY_CONFIG = {
  critical: { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  high: { label: 'HIGH', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  medium: { label: 'MEDIUM', color: '#eab308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)' },
  low: { label: 'LOW', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
};

const REASON_CATEGORY_ICONS: Record<string, React.ElementType> = {
  signal: Zap,
  capability: Target,
  pattern: Brain,
  timing: Clock,
  contact: Layers,
  similarity: Radio,
  icp_fit: TrendingUp,
};

const RISK_SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#6b7280',
};

// ── Score Color Helper ──

function getScoreColor(score: number): string {
  if (score >= 75) return COLORS.confHigh;
  if (score >= 50) return COLORS.confMedium;
  return COLORS.confLow;
}

function getScoreBarFill(score: number): string {
  if (score >= 75) return 'rgba(16,185,129,0.6)';
  if (score >= 50) return 'rgba(245,158,11,0.6)';
  return 'rgba(239,68,68,0.6)';
}

// ── Component ──

interface RecommendationCardProps {
  companyId: string;
  compact?: boolean;
}

export function RecommendationCard({ companyId, compact = false }: RecommendationCardProps) {
  const [data, setData] = useState<AccountRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showConfidence, setShowConfidence] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendation = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recommendations/${companyId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      } else {
        setError('Failed to load recommendation');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchRecommendation(); }, [fetchRecommendation]);

  if (loading) {
    return (
      <div className="rounded-xl p-6 space-y-4"
        style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}>
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" style={{ color: COLORS.textMuted }} />
          <span className="text-sm" style={{ color: COLORS.textSecondary }}>Analyzing recommendation...</span>
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  const pConfig = PRIORITY_CONFIG[data.priority];
  const scoreColor = getScoreColor(data.opportunityScore);
  const confColor = getScoreColor(data.confidenceScore);

  // ── Compact mode: summary only ──
  if (compact) {
    return (
      <div className="rounded-xl p-4"
        style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Score badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: `${scoreColor}15`, border: `1px solid ${scoreColor}30` }}>
              <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor }}>
                {data.opportunityScore}
              </span>
              <span className="text-[10px]" style={{ color: `${scoreColor}80` }}>/100</span>
            </div>

            {/* Priority badge */}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ background: pConfig.bg, color: pConfig.color, border: `1px solid ${pConfig.border}` }}>
              {pConfig.label}
            </span>

            {/* Confidence */}
            <span className="text-[10px] font-bold" style={{ color: confColor }}>
              {data.confidenceGrade}
            </span>
          </div>

          {/* Action text */}
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>
            {data.recommendedAction.timeline}
          </span>
        </div>
      </div>
    );
  }

  // ── Full mode ──
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}>

      {/* ═══ HEADER: Score + Priority + Confidence ═══ */}
      <div className="p-5 flex items-start justify-between gap-4"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="flex items-center gap-3">
          {/* Opportunity Score */}
          <div className="text-center">
            <div className="text-3xl font-black tabular-nums" style={{ color: scoreColor }}>
              {data.opportunityScore}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] mt-0.5"
              style={{ color: COLORS.textMuted }}>
              Opportunity
            </div>
          </div>

          {/* Score bar */}
          <div className="w-20 h-1.5 rounded-full mt-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${data.opportunityScore}%`, background: getScoreBarFill(data.opportunityScore) }} />
          </div>

          {/* Priority Badge */}
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wide"
            style={{ background: pConfig.bg, color: pConfig.color, border: `1px solid ${pConfig.border}` }}>
            {pConfig.label} PRIORITY
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Confidence Grade */}
          <button
            onClick={() => setShowConfidence(!showConfidence)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            style={{ background: `${confColor}10`, border: `1px solid ${confColor}25` }}>
            <Shield className="w-3.5 h-3.5" style={{ color: confColor }} />
            <span className="text-sm font-bold" style={{ color: confColor }}>{data.confidenceGrade}</span>
            <span className="text-[10px]" style={{ color: `${confColor}70` }}>({data.confidenceScore}/100)</span>
            {data.enterpriseReady && (
              <CheckCircle2 className="w-3 h-3 ml-0.5" style={{ color: COLORS.confHigh }} />
            )}
          </button>

          {/* Refresh */}
          <button onClick={fetchRecommendation}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: COLORS.textMuted, background: 'transparent' }}
            title="Refresh recommendation">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══ WHY THIS ACCOUNT ═══ */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-3.5 h-3.5" style={{ color: COLORS.accent }} />
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: COLORS.accent }}>
            Why This Account
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: COLORS.textSecondary }}>
          {data.whyThisAccount}
        </p>
      </div>

      {/* ═══ REASONS (expandable) ═══ */}
      <div className="px-5 pb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full py-1 text-left"
          style={{ color: COLORS.textSecondary }}>
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase">
            Evidence ({data.reasons.length} reasons)
          </span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {expanded && (
          <div className="mt-2 space-y-2">
            {data.reasons.slice(0, 6).map((reason, i) => {
              const ReasonIcon = REASON_CATEGORY_ICONS[reason.category] || Zap;
              const strengthPercent = Math.round(reason.strength * 100);
              const strengthColor = strengthPercent >= 75 ? COLORS.confHigh
                : strengthPercent >= 50 ? COLORS.confMedium
                : COLORS.confLow;

              return (
                <div key={i} className="flex items-start gap-2.5 py-1.5 px-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="mt-0.5 shrink-0">
                    <ReasonIcon className="w-3.5 h-3.5" style={{ color: strengthColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                        {reason.text}
                      </span>
                    </div>
                    {/* Strength indicator */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-12 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${strengthPercent}%`, background: `${strengthColor}60` }} />
                      </div>
                      <span className="text-[9px] tabular-nums" style={{ color: COLORS.textMuted }}>
                        {strengthPercent}%
                      </span>
                      <span className="text-[9px]" style={{ color: `${COLORS.textMuted}60` }}>
                        {reason.sourceType}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ RISKS ═══ */}
      {data.risks.length > 0 && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: COLORS.confMedium }} />
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase"
              style={{ color: COLORS.confMedium }}>
              Risks ({data.risks.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {data.risks.slice(0, 3).map((risk, i) => {
              const riskColor = RISK_SEVERITY_COLORS[risk.severity];
              return (
                <div key={i} className="flex items-start gap-2 py-1.5 px-3 rounded-lg"
                  style={{ background: `${riskColor}06` }}>
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: riskColor }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs" style={{ color: COLORS.textSecondary }}>{risk.text}</span>
                    {risk.mitigation && (
                      <p className="text-[10px] mt-0.5" style={{ color: COLORS.textMuted }}>
                        Mitigation: {risk.mitigation}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ RECOMMENDED ACTION ═══ */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <ArrowRight className="w-3.5 h-3.5" style={{ color: COLORS.accent }} />
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: COLORS.accent }}>
            Recommended Action
          </span>
        </div>
        <div className="rounded-lg p-4"
          style={{ background: `${COLORS.accent}08`, border: `1px solid ${COLORS.accent}18`, borderLeft: `3px solid ${COLORS.accent}` }}>
          <p className="text-sm font-medium leading-relaxed" style={{ color: COLORS.textPrimary }}>
            {data.recommendedAction.text}
          </p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" style={{ color: COLORS.textMuted }} />
              <span className="text-[11px]" style={{ color: COLORS.textMuted }}>
                {data.recommendedAction.timeline}
              </span>
            </div>
            {data.recommendedAction.targetRole && (
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3" style={{ color: COLORS.textMuted }} />
                <span className="text-[11px]" style={{ color: COLORS.textMuted }}>
                  Target: {data.recommendedAction.targetRole}
                </span>
              </div>
            )}
          </div>
          {data.recommendedAction.conversationAngle && (
            <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${COLORS.border}` }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1"
                style={{ color: COLORS.textMuted }}>
                Conversation Angle
              </p>
              <p className="text-xs leading-relaxed" style={{ color: COLORS.textSecondary }}>
                {data.recommendedAction.conversationAngle}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ ENRICHMENT INDICATORS ═══ */}
      {(data.graphInsights || data.memoryPatterns || data.topOpportunity) && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Top Opportunity */}
            {data.topOpportunity && (
              <div className="flex items-center gap-1.5 text-[10px]"
                style={{ color: COLORS.opportunity }}>
                <Target className="w-3 h-3" />
                <span className="font-medium">Top: {data.topOpportunity.title}</span>
                <span className="tabular-nums">({data.topOpportunity.score}/100)</span>
              </div>
            )}

            {/* KG enrichment */}
            {data.graphInsights && (
              <div className="flex items-center gap-1.5 text-[10px]"
                style={{ color: COLORS.intelligence }}>
                <Brain className="w-3 h-3" />
                <span>KG: {data.graphInsights.similarCompanies} similar, {data.graphInsights.relationshipPatterns} patterns</span>
              </div>
            )}

            {/* Memory patterns */}
            {data.memoryPatterns && (
              <div className="flex items-center gap-1.5 text-[10px]"
                style={{ color: COLORS.signal }}>
                <Layers className="w-3 h-3" />
                <span>Memory: {data.memoryPatterns.relevantMemories} patterns</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CONFIDENCE BREAKDOWN (expandable) ═══ */}
      {showConfidence && data.confidenceFactors && (
        <div className="px-5 pb-4 pt-1" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <p className="text-[9px] font-bold tracking-[0.2em] uppercase mb-3"
            style={{ color: COLORS.textMuted }}>
            Confidence Breakdown
          </p>
          <div className="space-y-2">
            {data.confidenceFactors.map((factor, i) => {
              const fColor = factor.score >= 75 ? COLORS.confHigh
                : factor.score >= 50 ? COLORS.confMedium
                : COLORS.confLow;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[11px] w-32 shrink-0 capitalize" style={{ color: COLORS.textSecondary }}>
                    {factor.dimension.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${factor.score}%`, background: `${fColor}60` }} />
                  </div>
                  <span className="text-[10px] tabular-nums w-8 text-right font-medium" style={{ color: fColor }}>
                    {factor.score}
                  </span>
                  <span className="text-[9px] w-8 text-right" style={{ color: COLORS.textMuted }}>
                    {Math.round(factor.weight * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
          {/* Summary */}
          <p className="text-[10px] mt-3 italic" style={{ color: COLORS.textMuted }}>
            {data.enterpriseReady
              ? 'Enterprise-ready: This recommendation meets the confidence threshold for operational use.'
              : 'Below enterprise threshold: Verify key data points before taking action.'}
          </p>
        </div>
      )}

      {/* ═══ STATS FOOTER ═══ */}
      <div className="px-5 py-3 flex items-center gap-4 flex-wrap"
        style={{ background: 'rgba(255,255,255,0.02)', borderTop: `1px solid ${COLORS.border}` }}>
        <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
          <Zap className="w-3 h-3 inline mr-1" style={{ color: COLORS.signal }} />
          {data.signalCount} signals
        </span>
        <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
          <Target className="w-3 h-3 inline mr-1" style={{ color: COLORS.opportunity }} />
          {data.opportunityCount} opportunities
        </span>
        <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
          <BarChart3 className="w-3 h-3 inline mr-1" style={{ color: COLORS.confHigh }} />
          {data.capabilityMatchCount} matches
        </span>
        <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
          <Layers className="w-3 h-3 inline mr-1" style={{ color: COLORS.intelligence }} />
          {data.contactCount} contacts
        </span>
        <span className="ml-auto text-[9px]" style={{ color: `${COLORS.textMuted}60` }}>
          Generated {new Date(data.generatedAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
