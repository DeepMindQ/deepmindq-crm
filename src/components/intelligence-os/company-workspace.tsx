'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Brain, Zap, Target, Users, Sparkles,
  ArrowLeft, ExternalLink, RefreshCw, ChevronRight,
  CheckCircle2, AlertTriangle, HelpCircle, Clock, ArrowUpRight,
  TrendingUp, TrendingDown, Minus, Layers,
  FileText, BarChart3, ThumbsUp, ThumbsDown,
  ChevronDown, ChevronUp, X, Copy, Check,
  Activity, Radar, Radio, Server, BookOpen, Cpu, Newspaper, Briefcase,
  Play, Loader2, CheckCircle2 as CheckCircle2Icon, XCircle, Timer,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { CompanyIntelligence, IntelligenceObject, EvidenceState, ExecutiveBriefData } from '@/lib/intelligence-types';
import { logger } from '@/lib/logger';
import { AIProgressTracker } from '@/components/enterprise/AIProgressTracker';
import { ActivationStatus } from '@/components/intelligence-os/activation-status';
import { RecommendationCard } from '@/components/intelligence-os/recommendation-card';
import { TemporalIntelligenceTimeline, type TemporalMetrics } from '@/components/intelligence-os/molecules/temporal-intelligence-timeline';

/* ═══════════════════════════════════════════════════════════════════════════
   Company Intelligence Workspace — Dark Intelligence OS
   
   "How do I win this account?"
   
   This is the gold standard Intelligence OS experience.
   Think: Palantir, Bloomberg Terminal, Linear, Datadog — NOT Salesforce.
   
   Visual Language:
   - Dark surfaces using --ios-* tokens
   - Intelligence surfaces, not SaaS cards
   - Choreographed reveal sequence
   - Narrative-first scrollable sections
   
   Every intelligence item surfaces its reasoning by default,
   with evidence expandable. Human feedback remains on every item.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Color Helpers ── */
const IOS = {
  bgPrimary: 'var(--ios-bg-primary)',
  bgSecondary: 'var(--ios-bg-secondary)',
  bgCard: 'var(--ios-bg-card)',
  bgCardHover: 'var(--ios-bg-card-hover)',
  bgElevated: 'var(--ios-bg-elevated)',
  border: 'var(--ios-border)',
  borderHover: 'var(--ios-border-hover)',
  textPrimary: 'var(--ios-text-primary)',
  textSecondary: 'var(--ios-text-secondary)',
  textMuted: 'var(--ios-text-muted)',
  accent: 'var(--ios-accent)',
  accentDim: 'var(--ios-accent-dim)',
  confHigh: 'var(--ios-confidence-high)',
  confMedium: 'var(--ios-confidence-medium)',
  confLow: 'var(--ios-confidence-low)',
  signal: 'var(--ios-signal)',
  opportunity: 'var(--ios-opportunity)',
  intelligence: 'var(--ios-intelligence)',
} as const;

function getConfidenceColor(val: number): string {
  if (val >= 75) return IOS.confHigh;
  if (val >= 50) return IOS.confMedium;
  return IOS.confLow;
}

function getConfidenceBg(val: number): string {
  if (val >= 75) return 'tokens.extended.emerald.bg';
  if (val >= 50) return tokens.confidence.medium.bg;
  return tokens.priority.critical.bg;
}

function getConfidenceFill(val: number): string {
  if (val >= 75) return tokens.extended.emerald.value;
  if (val >= 50) return tokens.domain.reasoning;
  return tokens.domain.risk;
}

/* ── Type Label Config ── */
const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  signal:            { label: 'INTELLIGENCE SIGNAL',  color: IOS.signal,      icon: Zap },
  need:              { label: 'DETECTED NEED',        color: tokens.domain.reasoning,     icon: Target },
  capability_match:  { label: 'CAPABILITY MATCH',     color: IOS.confHigh,   icon: Target },
  action:            { label: 'RECOMMENDED ACTION',   color: IOS.opportunity, icon: Sparkles },
  stakeholder:       { label: 'KEY STAKEHOLDER',      color: IOS.intelligence, icon: Users },
  positioning:       { label: 'POSITIONING',          color: IOS.accent,     icon: Brain },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Primitive Dark UI Components
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Evidence State Badge ── */
function EvidenceStateBadge({ state }: { state: EvidenceState }) {
  const config = {
    confirmed: { label: 'Confirmed', color: IOS.confHigh, icon: CheckCircle2 },
    inferred:  { label: 'Inferred',  color: IOS.confMedium, icon: Brain },
    unknown:   { label: 'Unknown',   color: IOS.textMuted, icon: HelpCircle },
  }[state];
  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
      style={{ background: `${config.color}15`, color: config.color, border: `1px solid ${config.color}25` }}
    >
      <Icon className="w-2.5 h-2.5" />
      {config.label}
    </span>
  );
}

/* ── Freshness Indicator ── */
function FreshnessBadge({ lastEnriched, staleness }: { lastEnriched: string; staleness: string }) {
  const config = {
    fresh: { label: 'Fresh', color: IOS.confHigh },
    aging: { label: 'Aging', color: IOS.confMedium },
    stale: { label: 'Stale', color: IOS.confLow },
    unknown: { label: 'Unknown', color: IOS.textMuted },
  }[staleness] || { label: 'Unknown', color: IOS.textMuted };
  const dateStr = new Date(lastEnriched).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium" style={{ color: config.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.color, boxShadow: `0 0 6px ${config.color}60` }} />
      {config.label} · {dateStr}
    </span>
  );
}

/* ── Confidence Display (with bar) ── */
function ConfidenceIndicator({ value, showBar = true, size = 'sm' }: { value: number; showBar?: boolean; size?: 'sm' | 'lg' }) {
  const color = getConfidenceColor(value);
  const fill = getConfidenceFill(value);
  if (size === 'lg') {
    return (
      <div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-3xl font-bold tabular-nums tracking-tight" style={{ color }}>{value}</span>
          <span className="text-sm font-semibold" style={{ color: `${color}99` }}>%</span>
        </div>
        {showBar && (
          <div className="confidence-bar mt-2" style={{ width: 120 }}>
            <div className="confidence-bar-fill" style={{ width: `${value}%`, background: fill }} />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums"
        style={{ background: getConfidenceBg(value), color }}
      >
        {value}%
      </span>
      {showBar && (
        <div className="confidence-bar" style={{ width: 60 }}>
          <div className="confidence-bar-fill" style={{ width: `${value}%`, background: fill }} />
        </div>
      )}
    </div>
  );
}

/* ── Temporal Display ── */
function TemporalBadge({ temporal }: { temporal?: IntelligenceObject['temporal'] }) {
  if (!temporal) return null;
  const trendIcon = temporal.trend === 'rising' ? TrendingUp : temporal.trend === 'declining' ? TrendingDown : Minus;
  const trendColor = temporal.trend === 'rising' ? IOS.confHigh : temporal.trend === 'declining' ? IOS.confLow : IOS.textMuted;
  const TrendIcon = trendIcon;
  return (
    <div className="flex items-center gap-2 text-[10px]" style={{ color: IOS.textSecondary }}>
      <span>Was <span className="font-semibold tabular-nums" style={{ color: IOS.textSecondary }}>{temporal.previous}%</span></span>
      <TrendIcon className="w-3 h-3" style={{ color: trendColor }} />
      <span>Now <span className="font-semibold tabular-nums" style={{ color: trendColor }}>{temporal.current}%</span></span>
      {temporal.changeReason && (
        <span style={{ color: `${IOS.textMuted}99` }}>· {temporal.changeReason}</span>
      )}
    </div>
  );
}

/* ── Human Feedback Control (dark-themed) ── */
function FeedbackControl({
  intelligenceId,
  companyId,
  artifactType,
  currentFeedback,
}: {
  intelligenceId: string;
  companyId: string;
  artifactType: string;
  currentFeedback?: IntelligenceObject['feedback'];
}) {
  const [status, setStatus] = useState<'accurate' | 'outdated' | 'incorrect' | null>(
    currentFeedback?.status || null
  );
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = async (feedback: 'accurate' | 'outdated' | 'incorrect') => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/companies/${companyId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifactType, artifactId: intelligenceId, feedback }),
      });
      setStatus(feedback);
    } catch (e) { logger.error('Feedback error:', { error: e }); }
    finally { setSubmitting(false); }
  };

  if (status) {
    const config = {
      accurate:  { icon: CheckCircle2, color: IOS.confHigh, label: 'Accurate' },
      outdated:  { icon: Clock, color: IOS.confMedium, label: 'Outdated' },
      incorrect: { icon: AlertTriangle, color: IOS.confLow, label: 'Incorrect' },
    }[status];
    const Icon = config.icon;
    return (
      <div className="flex items-center gap-1 opacity-70">
        <Icon className="w-3 h-3" style={{ color: config.color }} />
        <span className="text-[9px] font-semibold" style={{ color: config.color }}>{config.label}</span>
        <button
          onClick={() => submitFeedback('outdated')}
          className="text-[9px] ml-1 transition-colors"
          style={{ color: IOS.textMuted }}
        >
          change
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <button
        onClick={() => submitFeedback('accurate')}
        className="p-1 rounded transition-colors hover:bg-[tokens.extended.emerald.bg]"
        title="Accurate"
      >
        <ThumbsUp className="w-3 h-3" style={{ color: IOS.textMuted }} />
      </button>
      <button
        onClick={() => submitFeedback('outdated')}
        className="p-1 rounded transition-colors hover:bg-[tokens.priority.high.bg]"
        title="Outdated"
      >
        <Clock className="w-3 h-3" style={{ color: IOS.textMuted }} />
      </button>
      <button
        onClick={() => submitFeedback('incorrect')}
        className="p-1 rounded transition-colors hover:bg-[tokens.priority.critical.bg]"
        title="Incorrect"
      >
        <ThumbsDown className="w-3 h-3" style={{ color: IOS.textMuted }} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Intelligence Surface — The new card pattern
   ═══════════════════════════════════════════════════════════════════════════ */

function IntelligenceSurface({
  item,
  companyId,
  showTemporal = false,
  delay = 0,
}: {
  item: IntelligenceObject;
  companyId: string;
  showTemporal?: boolean;
  delay?: number;
}) {
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.signal;
  const TypeIcon = typeConf.icon;
  const accentColor = typeConf.color;
  const roleColor = item.type === 'stakeholder' && item.category
    ? item.category === 'Decision Maker' ? tokens.domain.risk
      : item.category === 'Influencer' ? tokens.domain.reasoning
        : item.category === 'Team Member' ? tokens.domain.enrichment
          : IOS.textMuted
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="group relative ios-card overflow-hidden"
      style={{
        borderLeft: `2px solid ${accentColor}`,
        boxShadow: 'none',
      }}
    >
      <div className="relative p-5">
        {/* Type label + evidence state row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TypeIcon className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: accentColor }}>
              {typeConf.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {roleColor && item.category && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide"
                style={{ background: `${roleColor}12`, color: roleColor, border: `1px solid ${roleColor}25` }}
              >
                {item.category}
              </span>
            )}
            <EvidenceStateBadge state={item.evidenceState} />
            {item.priority === 'high' && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide"
                style={{ background: tokens.confidence.low.bg, color: IOS.confLow, border: '1px solid tokens.priority.critical.border' }}
              >
                HIGH PRIORITY
              </span>
            )}
          </div>
        </div>

        {/* Intelligence statement — the hero */}
        <h3 className="text-sm font-semibold leading-snug mb-1" style={{ color: IOS.textPrimary }}>
          {item.title}
        </h3>
        {item.subtitle && (
          <p className="text-xs leading-relaxed mb-2" style={{ color: IOS.textSecondary }}>
            {item.subtitle}
          </p>
        )}

        {/* Confidence bar */}
        <div className="flex items-center gap-3 mb-3">
          <ConfidenceIndicator value={item.confidence} />
          {item.freshness && (
            <FreshnessBadge lastEnriched={item.freshness.lastEnriched} staleness={item.freshness.staleness} />
          )}
        </div>

        {/* Reasoning — visible by default */}
        {item.reasoning && (
          <div className="mb-3">
            <span className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: IOS.textMuted }}>
              Because:
            </span>
            <p className="text-xs leading-relaxed mt-1" style={{ color: IOS.textSecondary }}>
              {item.reasoning}
            </p>
          </div>
        )}

        {/* What Changed / Why it Matters / Why we're relevant / What to do */}
        <div className="space-y-2 mb-3">
          {item.whatChanged && (
            <div className="flex gap-2">
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase shrink-0 pt-0.5" style={{ color: IOS.textMuted }}>
                What changed:
              </span>
              <p className="text-xs leading-relaxed" style={{ color: IOS.textSecondary }}>{item.whatChanged}</p>
            </div>
          )}
          {item.whyItMatters && (
            <div className="flex gap-2">
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase shrink-0 pt-0.5" style={{ color: IOS.textMuted }}>
                Impact:
              </span>
              <p className="text-xs leading-relaxed" style={{ color: IOS.textSecondary }}>{item.whyItMatters}</p>
            </div>
          )}
          {item.whyWeRelevant && (
            <div className="flex gap-2">
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase shrink-0 pt-0.5" style={{ color: IOS.textMuted }}>
                Our relevance:
              </span>
              <p className="text-xs leading-relaxed" style={{ color: IOS.textSecondary }}>{item.whyWeRelevant}</p>
            </div>
          )}
          {item.whatToDo && (
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-lg"
              style={{ background: `${IOS.accent}08`, border: `1px solid ${IOS.accent}15` }}
            >
              <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" style={{ color: IOS.accent }} />
              <p className="text-xs font-medium leading-relaxed" style={{ color: IOS.textPrimary }}>
                {item.whatToDo}
              </p>
            </div>
          )}
        </div>

        {/* Temporal evolution */}
        {showTemporal && item.temporal && (
          <div className="mb-3 pt-2" style={{ borderTop: `1px solid ${IOS.border}` }}>
            <TemporalBadge temporal={item.temporal} />
          </div>
        )}

        {/* Bottom row: timing + evidence toggle + feedback */}
        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: `1px solid ${IOS.border}` }}
        >
          <div className="flex items-center gap-3">
            {item.timing && (
              <span className="text-[10px] font-medium" style={{ color: IOS.textMuted }}>
                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                {item.timing.replace(/_/g, ' ')}
              </span>
            )}
            {item.evidence.length > 0 && (
              <button
                onClick={() => setEvidenceExpanded(!evidenceExpanded)}
                className="flex items-center gap-1 text-[10px] font-semibold transition-colors"
                style={{ color: IOS.accent }}
              >
                {evidenceExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Evidence ({item.evidence.length})
              </button>
            )}
          </div>
          <FeedbackControl
            intelligenceId={item.id}
            companyId={companyId}
            artifactType={item.type}
            currentFeedback={item.feedback}
          />
        </div>
      </div>

      {/* Expandable evidence */}
      <AnimatePresence>
        {evidenceExpanded && item.evidence.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 space-y-2" style={{ background: IOS.bgSecondary, borderTop: `1px solid ${IOS.border}` }}>
              {item.evidence.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                  style={{ background: IOS.bgCard, border: `1px solid ${IOS.border}` }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5"
                    style={{ background: `${IOS.accent}15`, color: IOS.accent }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: IOS.textPrimary }}>{ev.snippet}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-medium" style={{ color: IOS.textMuted }}>{ev.source}</span>
                      {ev.date && (
                        <span className="text-[10px]" style={{ color: `${IOS.textMuted}80` }}>
                          {new Date(ev.date).toLocaleDateString()}
                        </span>
                      )}
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-medium flex items-center gap-0.5 transition-colors"
                          style={{ color: IOS.accent }}
                        >
                          <ExternalLink className="w-2 h-2" /> Source
                        </a>
                      )}
                      <EvidenceStateBadge state={ev.state as EvidenceState} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section Header — Dark themed
   ═══════════════════════════════════════════════════════════════════════════ */
function SectionHeader({
  icon: Icon,
  title,
  count,
  accent,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: `${accent}12`, border: `1px solid ${accent}20` }}
      >
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <h2 className="text-sm font-semibold tracking-tight" style={{ color: IOS.textPrimary }}>
        {title}
      </h2>
      {count !== undefined && (
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums"
          style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}20` }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Signal Categorization — Grouped intelligence, not flat list
   ═══════════════════════════════════════════════════════════════════════════ */

const SIGNAL_GROUPS = [
  { key: 'technology', label: 'Technology Signals', icon: Cpu, accent: tokens.domain.enrichment, categories: ['tech_change'] },
  { key: 'business', label: 'Business Signals', icon: Briefcase, accent: IOS.confHigh, categories: ['funding', 'expansion', 'partnership'] },
  { key: 'external', label: 'External Signals', icon: Newspaper, accent: IOS.signal, categories: ['news', 'mention', 'leadership_change'] },
  { key: 'relationship', label: 'Relationship Signals', icon: Users, accent: tokens.extended.purple.value, categories: ['hiring'] },
];

function groupSignalsByCategory(signals: IntelligenceObject[]) {
  if (signals.length === 0) return [];
  const groups: Array<{ key: string; label: string; icon: React.ElementType; accent: string; summary: string; signals: IntelligenceObject[] }> = [];

  for (const group of SIGNAL_GROUPS) {
    const matched = signals.filter(s => s.category && group.categories.includes(s.category));
    if (matched.length === 0) continue;
    const topConfidence = Math.max(...matched.map(s => s.confidence));
    groups.push({
      key: group.key,
      label: group.label,
      icon: group.icon,
      accent: group.accent,
      summary: `${matched.length} signal${matched.length !== 1 ? 's' : ''} · highest confidence ${topConfidence}%`,
      signals: matched,
    });
  }

  // Uncategorized remainder
  const categorized = new Set(SIGNAL_GROUPS.flatMap(g => g.categories));
  const remainder = signals.filter(s => !s.category || !categorized.has(s.category));
  if (remainder.length > 0) {
    groups.push({
      key: 'other',
      label: 'Other Signals',
      icon: Zap,
      accent: IOS.textMuted,
      summary: `${remainder.length} additional signal${remainder.length !== 1 ? 's' : ''}`,
      signals: remainder,
    });
  }

  return groups;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Evidence Library — Centralized trust surface
   ═══════════════════════════════════════════════════════════════════════════ */

interface FlattenedEvidence {
  snippet: string;
  source: string;
  url?: string;
  date?: string;
  state: EvidenceState;
  parentTitle: string;
  parentType: string;
  parentConfidence: number;
}

function collectAllEvidence(intel: CompanyIntelligence): FlattenedEvidence[] {
  const all: FlattenedEvidence[] = [];
  const sources = [
    ...intel.signals.map(s => ({ obj: s, label: s.type })),
    ...intel.needs.map(n => ({ obj: n, label: n.type })),
    ...intel.capabilityMatches.map(m => ({ obj: m, label: m.type })),
    ...intel.actions.map(a => ({ obj: a, label: a.type })),
    ...intel.stakeholders.map(s => ({ obj: s, label: s.type })),
    ...(intel.technology?.techSignals || []).map(s => ({ obj: s, label: 'technology' })),
  ];
  for (const { obj, label } of sources) {
    for (const ev of obj.evidence) {
      all.push({
        snippet: ev.snippet ?? '',
        source: ev.source,
        url: ev.url,
        date: ev.date,
        state: ev.state as EvidenceState,
        parentTitle: obj.title,
        parentType: label,
        parentConfidence: obj.confidence,
      });
    }
  }
  return all.sort((a, b) => {
    if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
}

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Intelligence Reveal Sequence — The 10-second moment
   ═══════════════════════════════════════════════════════════════════════════ */

type RevealPhase = 'analyzing' | 'ready' | 'what-changed' | 'why-now' | 'why-you' | 'action' | 'complete';

function IntelligenceReveal({
  companyName,
  intelligence,
  onSkip,
  onComplete,
}: {
  companyName: string;
  intelligence: CompanyIntelligence;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<RevealPhase>('analyzing');
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    const schedule = [
      { after: 800, phase: 'ready' as RevealPhase },
      { after: 1800, phase: 'what-changed' as RevealPhase },
      { after: 2800, phase: 'why-now' as RevealPhase },
      { after: 3800, phase: 'why-you' as RevealPhase },
      { after: 4800, phase: 'action' as RevealPhase },
      { after: 6000, phase: 'complete' as RevealPhase },
    ];

    const timers = schedule.map(({ after, phase: p }) =>
      setTimeout(() => setPhase(p), after)
    );
    timersRef.current = timers;

    return () => timers.forEach(clearTimeout);
  }, []);

  // Auto-complete after phase 'complete'
  useEffect(() => {
    if (phase === 'complete') {
      const t = setTimeout(onComplete, 800);
      timersRef.current.push(t);
    }
  }, [phase, onComplete]);

  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    onSkip();
  };

  const topSignal = intelligence.signals[0];
  const topAction = intelligence.actions[0];

  return (
    <div
      className="ios-background flex flex-col items-center justify-center min-h-[70vh] relative"
    >
      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-wider uppercase transition-all"
        style={{ color: IOS.textMuted, background: `${IOS.bgElevated}`, border: `1px solid ${IOS.border}` }}
      >
        Skip →
      </button>

      {/* Central reveal content */}
      <div className="max-w-lg text-center px-6">
        {/* Phase 1: Analyzing */}
        <AnimatePresence mode="wait">
          {phase === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className="w-2 h-2 rounded-full intel-pulse" style={{ background: IOS.accent }} />
                <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: IOS.textMuted }}>
                  Initializing intelligence analysis
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: IOS.textPrimary }}>
                Analyzing {companyName}
              </h1>
              <p className="text-sm" style={{ color: IOS.textSecondary }}>
                Processing signals, evidence, and capability alignment...
              </p>
            </motion.div>
          )}

          {/* Phase 2: Ready */}
          {phase === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-3 mb-6">
                <Radar className="w-5 h-5" style={{ color: IOS.accent }} />
                <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: IOS.accent }}>
                  Intelligence ready
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: IOS.textPrimary }}>
                {companyName}
              </h1>
              <ConfidenceIndicator value={intelligence.executiveUnderstanding.overallConfidence} showBar size="lg" />
              <p className="text-sm" style={{ color: IOS.textSecondary }}>
                {intelligence.company.industry || 'Technology'}{intelligence.company.domain ? ` · ${intelligence.company.domain}` : ''}
              </p>
            </motion.div>
          )}

          {/* Phase 3: What changed */}
          {phase === 'what-changed' && (
            <motion.div
              key="what-changed"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-2 mb-6">
                <Zap className="w-4 h-4" style={{ color: IOS.signal }} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: IOS.signal }}>
                  What changed?
                </span>
              </div>
              <h2 className="text-lg font-semibold leading-snug" style={{ color: IOS.textPrimary }}>
                {intelligence.executiveUnderstanding.headline}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: IOS.textSecondary }}>
                {topSignal?.title || 'No signals detected yet'}
              </p>
            </motion.div>
          )}

          {/* Phase 4: Why now */}
          {phase === 'why-now' && (
            <motion.div
              key="why-now"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-2 mb-6">
                <Activity className="w-4 h-4" style={{ color: IOS.confMedium }} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: IOS.confMedium }}>
                  Why now?
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: IOS.textPrimary }}>
                {intelligence.executiveUnderstanding.narrative}
              </p>
              <div className="flex items-center justify-center gap-6 pt-2">
                <span className="text-xs" style={{ color: IOS.textSecondary }}>
                  <Zap className="w-3 h-3 inline mr-1" style={{ color: IOS.signal }} />
                  {intelligence.signalCount} signals
                </span>
                <span className="text-xs" style={{ color: IOS.textSecondary }}>
                  <Layers className="w-3 h-3 inline mr-1" style={{ color: IOS.confHigh }} />
                  {intelligence.capabilityMatches.length} matches
                </span>
              </div>
              {topSignal?.evidence.slice(0, 3).length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <span className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: IOS.textMuted }}>
                    Detected because:
                  </span>
                  <div className="space-y-1.5 mt-2">
                    {topSignal.evidence.slice(0, 3).map((ev, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg"
                        style={{ background: IOS.bgCard, border: `1px solid ${IOS.border}` }}>
                        <Check className="w-3 h-3 shrink-0 mt-0.5" style={{ color: IOS.confHigh }} />
                        <span className="text-xs" style={{ color: IOS.textSecondary }}>{ev.snippet}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Phase 5: Why you */}
          {phase === 'why-you' && (
            <motion.div
              key="why-you"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-2 mb-6">
                <Target className="w-4 h-4" style={{ color: IOS.confHigh }} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: IOS.confHigh }}>
                  Why you?
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: IOS.textPrimary }}>
                {intelligence.positioning.message || 'Capability alignment processing...'}
              </p>
              {intelligence.positioning.topCapabilities.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {intelligence.positioning.topCapabilities.slice(0, 4).map((cap, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: `${IOS.confHigh}10`, color: IOS.confHigh, border: `1px solid ${IOS.confHigh}20` }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Phase 6: Action */}
          {phase === 'action' && (
            <motion.div
              key="action"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-2 mb-6">
                <Sparkles className="w-4 h-4" style={{ color: IOS.opportunity }} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: IOS.opportunity }}>
                  Action
                </span>
              </div>
              <p className="text-sm leading-relaxed font-medium" style={{ color: IOS.textPrimary }}>
                {topAction?.whatToDo || topAction?.title || 'Review full intelligence workspace below'}
              </p>
              {topAction?.confidence && (
                <ConfidenceIndicator value={topAction.confidence} />
              )}
            </motion.div>
          )}

          {/* Phase complete — brief flash */}
          {phase === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" style={{ color: IOS.confHigh }} />
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: IOS.confHigh }}>
                Intelligence workspace loaded
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Executive Brief Modal — Dark themed
   ═══════════════════════════════════════════════════════════════════════════ */

function ExecutiveBriefModal({
  brief,
  onClose,
}: {
  brief: ExecutiveBriefData;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = [
      `ACCOUNT INTELLIGENCE BRIEF`,
      `─────────────────────────`,
      `Account: ${brief.companyName}`,
      `Industry: ${brief.industry || 'Unknown'}`,
      `Generated: ${new Date(brief.generatedAt).toLocaleDateString()}`,
      ``,
      `CURRENT SITUATION`,
      `${brief.currentSituation}`,
      ``,
      `WHY NOW`,
      `${brief.whyNow}`,
      ``,
      `OPPORTUNITY AREAS`,
      ...brief.opportunityAreas.map((a, i) => `${i + 1}. ${a}`),
      ``,
      `RECOMMENDED APPROACH`,
      `${brief.recommendedApproach}`,
      ``,
      `EVIDENCE`,
      ...brief.evidence.map((e, i) => `${i + 1}. [${e.state.toUpperCase()}] ${e.title} — Source: ${e.source}${e.date ? ' (' + new Date(e.date).toLocaleDateString() + ')' : ''}`),
      ``,
      `NEXT ACTIONS`,
      ...brief.nextActions.map((a, i) => `${i + 1}. [${a.priority.toUpperCase()}] ${a.action} (Confidence: ${a.confidence}%)`),
      ``,
      `KEY STAKEHOLDERS`,
      ...brief.keyStakeholders.map((s, i) => `${i + 1}. ${s.role} — ${s.reason}`),
      ``,
      `TOP CAPABILITY MATCHES`,
      ...brief.topCapabilities.map((c, i) => `${i + 1}. ${c}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: tokens.surface.overlay, backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="ios-card w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        style={{
          boxShadow: `0 25px 50px tokens.opacity.medium, 0 0 80px ${IOS.accent}08`,
          border: `1px solid ${IOS.borderHover}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: `1px solid ${IOS.border}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${IOS.accent}15`, border: `1px solid ${IOS.accent}25` }}
            >
              <FileText className="w-4 h-4" style={{ color: IOS.accent }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: IOS.textPrimary }}>Executive Brief</h2>
              <p className="text-[10px]" style={{ color: IOS.textMuted }}>
                {brief.companyName} · {new Date(brief.generatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all"
              style={{
                background: copied ? `${IOS.confHigh}15` : `${IOS.accent}15`,
                color: copied ? IOS.confHigh : IOS.accent,
                border: `1px solid ${copied ? `${IOS.confHigh}30` : `${IOS.accent}25`}`,
              }}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy Brief'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: IOS.textMuted }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal content */}
        <div className="p-6 space-y-6">
          <div className="text-center pb-4" style={{ borderBottom: `1px solid ${IOS.border}` }}>
            <h1 className="text-xl font-bold" style={{ color: IOS.textPrimary }}>{brief.companyName}</h1>
            <p className="text-xs mt-1" style={{ color: IOS.textSecondary }}>
              Intelligence Score: <span className="font-bold tabular-nums" style={{ color: getConfidenceColor(brief.intelligenceScore) }}>{brief.intelligenceScore}%</span>
              {' · '}{brief.industry || 'Technology'}
            </p>
          </div>

          <BriefSection label="Current Situation">
            <p className="text-sm leading-relaxed" style={{ color: IOS.textSecondary }}>{brief.currentSituation}</p>
          </BriefSection>

          <BriefSection label="Why Now">
            <p className="text-sm leading-relaxed" style={{ color: IOS.textSecondary }}>{brief.whyNow}</p>
          </BriefSection>

          {brief.opportunityAreas.length > 0 && (
            <BriefSection label="Opportunity Areas">
              <ul className="space-y-2">
                {brief.opportunityAreas.map((area, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: IOS.opportunity }} />
                    <span className="text-sm leading-relaxed" style={{ color: IOS.textSecondary }}>{area}</span>
                  </li>
                ))}
              </ul>
            </BriefSection>
          )}

          <BriefSection label="Recommended Approach">
            <p className="text-sm leading-relaxed" style={{ color: IOS.textSecondary }}>{brief.recommendedApproach}</p>
          </BriefSection>

          {brief.evidence.length > 0 && (
            <BriefSection label="Evidence" count={brief.evidence.length}>
              <div className="space-y-2">
                {brief.evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
                    style={{ background: IOS.bgSecondary, border: `1px solid ${IOS.border}` }}
                  >
                    <EvidenceStateBadge state={ev.state as EvidenceState} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: IOS.textPrimary }}>{ev.title}</p>
                      <p className="text-[10px]" style={{ color: IOS.textMuted }}>
                        {ev.source}{ev.date ? ` · ${new Date(ev.date).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </BriefSection>
          )}

          <BriefSection label="Next Actions" count={brief.nextActions.length}>
            <div className="space-y-2">
              {brief.nextActions.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: IOS.bgSecondary, border: `1px solid ${IOS.border}` }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: a.priority === 'high' ? IOS.confLow : a.priority === 'medium' ? IOS.confMedium : IOS.accent,
                      boxShadow: `0 0 6px ${a.priority === 'high' ? `${IOS.confLow}60` : a.priority === 'medium' ? `${IOS.confMedium}60` : `${IOS.accent}60`}`,
                    }}
                  />
                  <span className="text-xs flex-1" style={{ color: IOS.textPrimary }}>{a.action}</span>
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: getConfidenceColor(a.confidence) }}>
                    {a.confidence}%
                  </span>
                </div>
              ))}
            </div>
          </BriefSection>

          {brief.keyStakeholders.length > 0 && (
            <BriefSection label="Key Stakeholders">
              <div className="space-y-2">
                {brief.keyStakeholders.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                    style={{ background: IOS.bgSecondary, border: `1px solid ${IOS.border}` }}
                  >
                    <Users className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: IOS.intelligence }} />
                    <div>
                      <span className="text-xs font-semibold" style={{ color: IOS.textPrimary }}>{s.role}</span>
                      <span className="text-xs ml-2" style={{ color: IOS.textMuted }}>— {s.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </BriefSection>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Brief section helper ── */
function BriefSection({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: IOS.textMuted }}>
          {label}
        </h3>
        {count !== undefined && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
            style={{ background: `${IOS.accent}10`, color: IOS.accent }}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Pipeline Progress Panel — Intelligence Pipeline Execution Visualization
   
   Reuses AIProgressTracker for stage visualization.
   Maps real API pipeline stages (from POST /api/intelligence/full-pipeline)
   into the tracker's step format.
   ═══════════════════════════════════════════════════════════════════════════ */

type PipelineExecutionState = 'idle' | 'running' | 'complete' | 'error';

interface PipelineStageResult {
  name: string;
  status: 'completed' | 'failed' | 'skipped';
  durationMs: number;
  result: Record<string, unknown> | null;
  error?: string;
}

interface PipelineRunResult {
  id: string;
  companyId: string;
  companyName: string;
  totalStages: number;
  completedStages: number;
  failedStages: number;
  skippedStages: number;
  durationMs: number;
  stages: PipelineStageResult[];
  accountStrategy?: {
    capabilityMatches?: { totalMatches: number; highConfidence: number };
    winProbability?: { probability: number };
    executiveBrief?: string;
    recommendedActions?: { actions: Array<{ action: string; priority: string }> };
  };
}

/* Human-readable labels for pipeline stage names */
const STAGE_LABELS: Record<string, string> = {
  company_profile: 'Company Profile Assessment',
  contact_intelligence: 'Contact Intelligence',
  buying_committee: 'Buying Committee Detection',
  signal_detection: 'Signal Detection',
  evidence_collection: 'Evidence Collection',
  research_card: 'Research Card Analysis',
  revenue_score: 'Revenue Intelligence Score',
  capability_matching: 'Capability Matching',
  case_study_matching: 'Case Study Matching',
  solution_matching: 'Solution Matching',
  competitive_positioning: 'Competitive Positioning',
  intelligence_fusion: 'Intelligence Fusion',
  win_probability: 'Win Probability Analysis',
  recommended_actions: 'Recommended Actions',
  conversation_strategy: 'Conversation Strategy',
  executive_brief: 'Executive Brief Generation',
  persist_all: 'Results Persistence',
};

/* Phase grouping for stage display */
const STAGE_PHASES: Array<{ label: string; names: string[] }> = [
  { label: 'Phase A — External Intelligence', names: ['company_profile', 'contact_intelligence', 'buying_committee', 'signal_detection', 'evidence_collection', 'research_card', 'revenue_score'] },
  { label: 'Phase B — Internal Matching', names: ['capability_matching', 'case_study_matching', 'solution_matching', 'competitive_positioning'] },
  { label: 'Phase B.5 — Intelligence Fusion', names: ['intelligence_fusion'] },
  { label: 'Phase C — Strategy Generation', names: ['win_probability', 'recommended_actions', 'conversation_strategy', 'executive_brief', 'persist_all'] },
];

/* Map API stage status to AIProgressTracker step status */
function mapStageStatus(status: 'completed' | 'failed' | 'skipped'): 'complete' | 'error' | 'complete' {
  if (status === 'failed') return 'error';
  return 'complete'; // both 'completed' and 'skipped' show as complete
}

function PipelineProgressPanel({
  state,
  stages,
  result,
  duration,
  onDismiss,
  onRetry,
}: {
  state: PipelineExecutionState;
  stages: PipelineStageResult[];
  result: PipelineRunResult | null;
  duration: number | null;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (state === 'idle') return null;

  /* Build AIProgressTracker steps from real pipeline stages */
  const trackerSteps = stages.length > 0
    ? stages.map(s => ({
        label: STAGE_LABELS[s.name] || s.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        status: mapStageStatus(s.status) as 'pending' | 'processing' | 'complete' | 'error',
      }))
    : [{ label: 'Running full intelligence pipeline...', status: 'processing' as const }];

  const completedCount = stages.filter(s => s.status === 'completed').length;
  const failedCount = stages.filter(s => s.status === 'failed').length;
  const totalDuration = duration ?? (result?.durationMs ?? 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="px-6 pb-4"
      >
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: IOS.bgCard,
            border: `1px solid ${state === 'error' ? tokens.domain.risk : state === 'complete' ? `${IOS.confHigh}30` : `${IOS.accent}30`}`,
            boxShadow: state === 'running'
              ? `0 0 40px ${IOS.accent}08, 0 4px 20px tokens.opacity.subtle`
              : state === 'complete'
              ? `0 0 30px ${IOS.confHigh}06, 0 4px 16px rgba(0,0,0,0.2)`
              : 'none',
          }}
        >
          {/* Panel Header */}
          <div
            className="flex items-center justify-between px-5 py-3 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
            style={{ borderBottom: expanded ? `1px solid ${IOS.border}` : 'none' }}
          >
            <div className="flex items-center gap-3">
              {state === 'running' ? (
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `${IOS.accent}20` }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: IOS.accent }} />
                </div>
              ) : state === 'complete' ? (
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `${IOS.confHigh}20` }}>
                  <CheckCircle2Icon className="w-3.5 h-3.5" style={{ color: IOS.confHigh }} />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: tokens.confidence.low.bg }}>
                  <XCircle className="w-3.5 h-3.5" style={{ color: tokens.domain.risk }} />
                </div>
              )}
              <div>
                <span className="text-xs font-bold tracking-wide" style={{ color: IOS.textPrimary }}>
                  {state === 'running' ? 'Intelligence Pipeline Running' : state === 'complete' ? 'Pipeline Complete' : 'Pipeline Failed'}
                </span>
                <div className="flex items-center gap-3 mt-0.5">
                  {stages.length > 0 && (
                    <span className="text-[10px]" style={{ color: IOS.textMuted }}>
                      {completedCount}/{stages.length} stages complete
                      {failedCount > 0 && <span style={{ color: tokens.domain.risk }}> · {failedCount} failed</span>}
                    </span>
                  )}
                  {totalDuration > 0 && (
                    <span className="text-[10px] flex items-center gap-1" style={{ color: IOS.textMuted }}>
                      <Timer className="w-2.5 h-2.5" />
                      {(totalDuration / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {state === 'error' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRetry(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
                  style={{ background: `${IOS.accent}15`, color: IOS.accent, border: `1px solid ${IOS.accent}30` }}
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              )}
              {(state === 'complete' || state === 'error') && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: IOS.textMuted, background: `${IOS.bgPrimary}80` }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform"
                style={{ color: IOS.textMuted, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </div>
          </div>

          {/* Expanded Content */}
          {expanded && (
            <div className="px-5 py-4">
              {state === 'running' && stages.length === 0 ? (
                /* Pre-completion: show processing indicator */
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: IOS.accent }} />
                    <span className="text-xs" style={{ color: IOS.textSecondary }}>
                      DeepMindQ is actively analyzing this account — running 17 intelligence stages across external data, internal matching, and strategy generation...
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {STAGE_PHASES.map(phase => (
                      <div key={phase.label} className="rounded-lg px-3 py-2" style={{ background: `${IOS.bgPrimary}60`, border: `1px solid ${IOS.border}` }}>
                        <p className="text-[9px] font-bold tracking-wide uppercase" style={{ color: IOS.accent }}>{phase.label.split(' — ')[0]}</p>
                        <p className="text-[9px] mt-0.5" style={{ color: IOS.textMuted }}>{phase.names.length} stages</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : stages.length > 0 ? (
                /* Post-completion: show full AIProgressTracker with real stages */
                <div>
                  {/* Phase-grouped stage tracker */}
                  {STAGE_PHASES.map(phase => {
                    const phaseStages = stages.filter(s => phase.names.includes(s.name));
                    if (phaseStages.length === 0) return null;
                    const phaseTrackerSteps = phaseStages.map(s => ({
                      label: STAGE_LABELS[s.name] || s.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                      status: mapStageStatus(s.status) as 'pending' | 'processing' | 'complete' | 'error',
                    }));
                    return (
                      <div key={phase.label} className="mb-4 last:mb-0">
                        <p className="text-[9px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: IOS.textMuted }}>
                          {phase.label}
                        </p>
                        <div
                          className="rounded-lg p-4"
                          style={{ background: tokens.flat.coolBg, border: `1px solid ${IOS.border}` }}
                        >
                          <AIProgressTracker steps={phaseTrackerSteps} />
                        </div>
                      </div>
                    );
                  })}

                  {/* Completion summary metrics */}
                  {state === 'complete' && result && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {result.accountStrategy?.capabilityMatches && (
                        <div className="rounded-lg px-3 py-2.5" style={{ background: `${IOS.confHigh}08`, border: `1px solid ${IOS.confHigh}20` }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: IOS.confHigh }}>Capability Matches</p>
                          <p className="text-base font-bold mt-0.5 tabular-nums" style={{ color: IOS.textPrimary }}>
                            {result.accountStrategy.capabilityMatches.totalMatches}
                            <span className="text-[10px] font-normal ml-1" style={{ color: IOS.textMuted }}>
                              ({result.accountStrategy.capabilityMatches.highConfidence} high confidence)
                            </span>
                          </p>
                        </div>
                      )}
                      {result.accountStrategy?.winProbability && (
                        <div className="rounded-lg px-3 py-2.5" style={{ background: `${IOS.opportunity}08`, border: `1px solid ${IOS.opportunity}20` }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: IOS.opportunity }}>Win Probability</p>
                          <p className="text-base font-bold mt-0.5 tabular-nums" style={{ color: IOS.textPrimary }}>
                            {Math.round(result.accountStrategy.winProbability.probability * 100)}%
                          </p>
                        </div>
                      )}
                      {result.accountStrategy?.recommendedActions && (
                        <div className="rounded-lg px-3 py-2.5" style={{ background: `${IOS.signal}08`, border: `1px solid ${IOS.signal}20` }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: IOS.signal }}>Actions Generated</p>
                          <p className="text-base font-bold mt-0.5 tabular-nums" style={{ color: IOS.textPrimary }}>
                            {result.accountStrategy.recommendedActions.actions.length}
                          </p>
                        </div>
                      )}
                      {result.accountStrategy?.executiveBrief && (
                        <div className="rounded-lg px-3 py-2.5" style={{ background: `${IOS.accent}08`, border: `1px solid ${IOS.accent}20` }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: IOS.accent }}>Executive Brief</p>
                          <p className="text-xs font-medium mt-1" style={{ color: IOS.confHigh }}>
                            <CheckCircle2Icon className="w-3 h-3 inline mr-1" />
                            Generated
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Company Workspace
   ═══════════════════════════════════════════════════════════════════════════ */

type Section = 'executive' | 'evidence' | 'technology' | 'alignment' | 'stakeholders' | 'actions' | 'evidence-library' | 'history';

const SECTIONS: { key: Section; label: string; icon: React.ElementType; accent: string }[] = [
  { key: 'executive',    label: 'Understanding',        icon: Brain,     accent: IOS.accent },
  { key: 'evidence',     label: 'Signals & Evidence',    icon: Zap,       accent: IOS.signal },
  { key: 'technology',   label: 'Technology',            icon: Server,    accent: tokens.domain.enrichment },
  { key: 'alignment',    label: 'Capability Alignment',  icon: Target,    accent: IOS.confHigh },
  { key: 'stakeholders', label: 'Stakeholders',          icon: Users,     accent: IOS.intelligence },
  { key: 'actions',      label: 'Actions',              icon: Sparkles,  accent: IOS.opportunity },
  { key: 'evidence-library', label: 'Evidence Library',  icon: BookOpen,  accent: IOS.confMedium },
  { key: 'history',      label: 'Intelligence History',  icon: BarChart3, accent: tokens.domain.enrichment },
];

export function CompanyWorkspace() {
  const { selectedCompanyId, setActiveView } = useAppStore();
  const [intelligence, setIntelligence] = useState<CompanyIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>('executive');
  const [showBrief, setShowBrief] = useState(false);
  const [brief, setBrief] = useState<ExecutiveBriefData | null>(null);
  const [revealComplete, setRevealComplete] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);

  /* ── Pipeline Execution State ── */
  const [pipelineState, setPipelineState] = useState<PipelineExecutionState>('idle');
  const [temporalData, setTemporalData] = useState<TemporalMetrics | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageResult[]>([]);
  const [pipelineResult, setPipelineResult] = useState<PipelineRunResult | null>(null);
  const [pipelineDuration, setPipelineDuration] = useState<number | null>(null);

  const fetchIntelligence = useCallback(async () => {
    if (!selectedCompanyId) { setLoading(false); return; }
    setLoading(true);
    setRevealComplete(false);
    setShowReveal(false);
    try {
      const res = await fetch(`/api/companies/${selectedCompanyId}/alignment`);
      if (res.ok) {
        const data = await res.json();
        setIntelligence(data);
        setShowReveal(true);
      }
    } catch (e) { logger.error('Intelligence fetch error:', { error: e }); }
    finally { setLoading(false); }
  }, [selectedCompanyId]);

  /* ── Pipeline Execution Handler ──
     Calls POST /api/intelligence/full-pipeline with the selected companyId.
     The pipeline runs 17 stages synchronously server-side.
     On completion, updates workspace intelligence with fresh data. */
  const runFullPipeline = useCallback(async () => {
    if (!selectedCompanyId || pipelineState === 'running') return;
    const startTime = Date.now();
    setPipelineState('running');
    setPipelineStages([]);
    setPipelineResult(null);
    setPipelineDuration(null);
    try {
      const res = await fetch('/api/intelligence/full-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      const elapsed = Date.now() - startTime;
      setPipelineDuration(elapsed);
      if (!res.ok) {
        throw new Error(`Pipeline returned ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success && data.pipelineRun) {
        setPipelineStages(data.pipelineRun.stages);
        setPipelineResult(data);
        setPipelineState('complete');
        logger.info('Intelligence pipeline completed', {
          companyId: selectedCompanyId,
          totalStages: data.pipelineRun.totalStages,
          completedStages: data.pipelineRun.completedStages,
          failedStages: data.pipelineRun.failedStages,
          durationMs: elapsed,
        });
        // Refresh intelligence data with pipeline results
        fetchIntelligence();
      } else {
        throw new Error(data.error || 'Pipeline returned unexpected response');
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      setPipelineDuration(elapsed);
      setPipelineState('error');
      logger.error('Pipeline execution failed', {
        companyId: selectedCompanyId,
        error: err instanceof Error ? err.message : String(err),
        durationMs: elapsed,
      });
    }
  }, [selectedCompanyId, pipelineState, fetchIntelligence]);

  const dismissPipeline = useCallback(() => {
    setPipelineState('idle');
  }, []);

  const fetchBrief = useCallback(async () => {
    if (!selectedCompanyId) return;
    setBriefLoading(true);
    try {
      const res = await fetch(`/api/companies/${selectedCompanyId}/brief`);
      if (res.ok) {
        const data = await res.json();
        setBrief(data);
        setShowBrief(true);
      }
    } catch (e) { logger.error('Brief fetch error:', { error: e }); }
    finally { setBriefLoading(false); }
  }, [selectedCompanyId]);

  useEffect(() => { fetchIntelligence(); }, [fetchIntelligence]);

  // G10 FIX: Fetch temporal intelligence metrics for the timeline
  useEffect(() => {
    if (!selectedCompanyId) return;
    fetch(`/api/companies/${selectedCompanyId}/temporal`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setTemporalData(data); })
      .catch(() => {});
  }, [selectedCompanyId]);

  const skipReveal = useCallback(() => {
    setRevealComplete(true);
    setShowReveal(false);
  }, []);

  const completeReveal = useCallback(() => {
    setRevealComplete(true);
    setShowReveal(false);
  }, []);

  const sectionRefs = useRef<Record<Section, HTMLElement | null>>({
    executive: null, evidence: null, technology: null, alignment: null, stakeholders: null, actions: null, 'evidence-library': null, history: null,
  });

  const scrollToSection = (section: Section) => {
    setActiveSection(section);
    const el = sectionRefs.current[section];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // No company selected
  if (!selectedCompanyId) {
    return (
      <div className="ios-background flex flex-col items-center justify-center min-h-[70vh]">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: `${IOS.accent}10`, border: `1px solid ${IOS.accent}20` }}
        >
          <Building2 className="w-8 h-8" style={{ color: IOS.accent, opacity: 0.5 }} />
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: IOS.textPrimary }}>Select an Account</h2>
        <p className="text-sm mb-6 max-w-sm text-center" style={{ color: IOS.textSecondary }}>
          Choose an account from the Command Center to enter its intelligence workspace.
        </p>
        <button
          onClick={() => setActiveView('command-center')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all"
          style={{ color: IOS.textSecondary, background: IOS.bgCard, border: `1px solid ${IOS.border}` }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Command Center
        </button>
      </div>
    );
  }

  // Loading
  if (loading || !intelligence) {
    return (
      <div className="ios-background p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl animate-pulse" style={{ background: IOS.bgCard }} />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded-lg animate-pulse" style={{ background: IOS.bgCard }} />
            <div className="h-3 w-32 rounded-lg animate-pulse" style={{ background: IOS.bgCard }} />
          </div>
        </div>
        <div className="h-48 rounded-xl animate-pulse" style={{ background: IOS.bgCard }} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: IOS.bgCard }} />
          ))}
        </div>
      </div>
    );
  }

  const companyName = intelligence.company.name;

  // Intelligence Reveal
  if (showReveal && !revealComplete) {
    return (
      <IntelligenceReveal
        companyName={companyName}
        intelligence={intelligence}
        onSkip={skipReveal}
        onComplete={completeReveal}
      />
    );
  }

  return (
    <div className="ios-background min-h-screen">
      {/* Executive Brief Modal */}
      <AnimatePresence>
        {showBrief && brief && (
          <ExecutiveBriefModal brief={brief} onClose={() => setShowBrief(false)} />
        )}
      </AnimatePresence>

      {/* ── Workspace Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-30 px-6 py-4"
        style={{
          background: `linear-gradient(to bottom, ${IOS.bgPrimary} 60%, transparent)`,
          borderBottom: `1px solid ${IOS.border}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
              style={{
                background: `${IOS.accent}12`,
                border: `1px solid ${IOS.accent}25`,
                color: IOS.accent,
              }}
            >
              {companyName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold tracking-tight" style={{ color: IOS.textPrimary }}>
                  {companyName}
                </h1>
                <EvidenceStateBadge state={intelligence.executiveUnderstanding.evidenceState} />
                {/* WI-17B: Intelligence Activation Status Indicator */}
                <ActivationStatus companyId={selectedCompanyId} compact darkMode />
              </div>
              <p className="text-xs mt-0.5" style={{ color: IOS.textMuted }}>
                {intelligence.company.industry || 'Technology'}{intelligence.company.domain ? ` · ${intelligence.company.domain}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ── PRIMARY: Run Intelligence Pipeline CTA ── */}
            <button
              onClick={runFullPipeline}
              disabled={pipelineState === 'running'}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all"
              style={{
                background: pipelineState === 'running'
                  ? `${IOS.signal}20`
                  : `linear-gradient(135deg, ${IOS.signal}, ${IOS.opportunity})`,
                color: tokens.flat.white,
                boxShadow: pipelineState === 'running' ? 'none' : `0 0 24px ${IOS.signal}25, 0 4px 14px rgba(0,0,0,0.35)`,
                border: 'none',
                opacity: pipelineState === 'running' ? 0.7 : 1,
              }}
            >
              {pipelineState === 'running' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {pipelineState === 'running' ? 'Running Pipeline...' : 'Run Intelligence Pipeline'}
            </button>

            {/* ── Executive Brief Button ── */}
            <button
              onClick={fetchBrief}
              disabled={briefLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all"
              style={{
                background: briefLoading
                  ? `${IOS.accent}20`
                  : `linear-gradient(135deg, ${IOS.accent}, ${IOS.accentDim})`,
                color: tokens.flat.white,
                boxShadow: briefLoading ? 'none' : `0 0 20px ${IOS.accent}30, 0 4px 12px tokens.opacity.subtle`,
                border: 'none',
              }}
            >
              {briefLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              Generate Brief
            </button>

            {/* ── G2 FIX: Export Intelligence (PDF/JSON) ── */}
            <button
              onClick={() => {
                const url = `/api/intelligence/export?companyId=${selectedCompanyId}&format=pdf`;
                window.open(url, '_blank');
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all"
              style={{
                background: IOS.bgCard,
                color: IOS.textPrimary,
                border: `1px solid ${IOS.border}`,
              }}
              title="Export intelligence report as PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              Export PDF
            </button>

            <button
              onClick={() => {
                const url = `/api/intelligence/export?companyId=${selectedCompanyId}&format=json`;
                window.open(url, '_blank');
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all"
              style={{
                background: IOS.bgCard,
                color: IOS.textSecondary,
                border: `1px solid ${IOS.border}`,
              }}
              title="Export intelligence data as JSON"
            >
              <Copy className="w-3 h-3" />
              JSON
            </button>

            <button
              onClick={fetchIntelligence}
              className="p-2 rounded-lg transition-colors"
              style={{ color: IOS.textMuted, background: IOS.bgCard, border: `1px solid ${IOS.border}` }}
              title="Refresh intelligence"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setActiveView('accounts')}
              className="p-2 rounded-lg transition-colors"
              style={{ color: IOS.textMuted, background: IOS.bgCard, border: `1px solid ${IOS.border}` }}
              title="Back to accounts"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Sticky Section Navigation ── */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto scrollbar-hide">
          {SECTIONS.map(section => {
            const Icon = section.icon;
            const isActive = activeSection === section.key;
            const count = section.key === 'evidence' ? intelligence.signals.length :
              section.key === 'alignment' ? intelligence.capabilityMatches.length + intelligence.needs.length :
              section.key === 'stakeholders' ? intelligence.stakeholders.length :
              section.key === 'actions' ? intelligence.actions.length : undefined;
            return (
              <button
                key={section.key}
                onClick={() => scrollToSection(section.key)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all shrink-0"
                style={{
                  color: isActive ? tokens.flat.white : IOS.textSecondary,
                  background: isActive ? `${section.accent}` : 'transparent',
                  border: isActive ? 'none' : `1px solid transparent`,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = IOS.bgCard;
                    e.currentTarget.style.borderColor = IOS.border;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {section.label}
                {count !== undefined && count > 0 && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                    style={{
                      background: isActive ? tokens.opacity.white.faint : `${section.accent}12`,
                      color: isActive ? tokens.flat.white : section.accent,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Pipeline Progress Panel (appears when pipeline is running/complete/error) ── */}
      <PipelineProgressPanel
        state={pipelineState}
        stages={pipelineStages}
        result={pipelineResult}
        duration={pipelineDuration}
        onDismiss={dismissPipeline}
        onRetry={runFullPipeline}
      />

      {/* ── Scrollable Narrative Content ── */}
      <div className="px-6 py-6 space-y-10">

        {/* ═══ SECTION 1: Executive Understanding ═══ */}
        <motion.section
          ref={(el) => { sectionRefs.current.executive = el; }}
          id="section-executive"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <SectionHeader icon={Brain} title="Executive Understanding" accent={IOS.accent} />

          {/* Executive headline card */}
          <div
            className="ios-card p-6 mb-4"
            style={{ boxShadow: `0 0 40px ${IOS.accent}06` }}
          >
            <div className="flex items-start gap-5">
              <div className="shrink-0">
                <ConfidenceIndicator value={intelligence.executiveUnderstanding.overallConfidence} showBar size="lg" />
                <div className="mt-3">
                  <TemporalBadge temporal={intelligence.executiveUnderstanding.temporal} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2" style={{ color: IOS.accent }}>
                  Executive Understanding
                </p>
                <h2 className="text-lg font-semibold leading-snug mb-2" style={{ color: IOS.textPrimary }}>
                  {intelligence.executiveUnderstanding.headline}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: IOS.textSecondary }}>
                  {intelligence.executiveUnderstanding.narrative}
                </p>
                <div className="flex items-center gap-5 mt-4 pt-3" style={{ borderTop: `1px solid ${IOS.border}` }}>
                  <span className="text-[10px] font-medium" style={{ color: IOS.textMuted }}>
                    <Zap className="w-3 h-3 inline mr-1" style={{ color: IOS.signal }} />
                    {intelligence.signalCount} signals
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: IOS.textMuted }}>
                    <Layers className="w-3 h-3 inline mr-1" style={{ color: IOS.confHigh }} />
                    {intelligence.capabilityMatches.length} matches
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: IOS.textMuted }}>
                    <Sparkles className="w-3 h-3 inline mr-1" style={{ color: IOS.opportunity }} />
                    {intelligence.actions.length} actions
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: IOS.textMuted }}>
                    <Radio className="w-3 h-3 inline mr-1" style={{ color: IOS.intelligence }} />
                    Score: {intelligence.company.intelligenceScore}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Four Questions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                q: 'What changed?',
                a: intelligence.signals[0]?.whatChanged || intelligence.signals[0]?.title || 'No signals detected yet',
                icon: Zap,
                color: IOS.signal,
              },
              {
                q: 'Why it matters',
                a: intelligence.signals[0]?.whyItMatters || intelligence.executiveUnderstanding.headline,
                icon: Brain,
                color: IOS.opportunity,
              },
              {
                q: "Why we're relevant",
                a: intelligence.positioning.message || 'Upload capabilities to enable alignment analysis',
                icon: Target,
                color: IOS.confHigh,
              },
              {
                q: 'What to do',
                a: intelligence.actions[0]?.whatToDo || intelligence.actions[0]?.title || 'Enrich account to generate recommendations',
                icon: Sparkles,
                color: IOS.accent,
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="ios-card p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: item.color }}>
                    {item.q}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: IOS.textSecondary }}>{item.a}</p>
              </motion.div>
            ))}
          </div>

          {/* Positioning Block */}
          {intelligence.positioning.strengthScore > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="ios-card p-5 mt-4"
              style={{ borderLeft: `2px solid ${IOS.confHigh}`, boxShadow: `0 0 20px ${IOS.confHigh}06` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4" style={{ color: IOS.confHigh }} />
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: IOS.confHigh }}>
                  Recommended Positioning
                </span>
                <span className="ml-auto text-[10px] font-bold tabular-nums" style={{ color: IOS.confHigh }}>
                  {intelligence.positioning.strengthScore}%
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: IOS.textSecondary }}>
                {intelligence.positioning.message}
              </p>
              {intelligence.positioning.topCapabilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {intelligence.positioning.topCapabilities.map((cap, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{ background: `${IOS.confHigh}10`, color: IOS.confHigh, border: `1px solid ${IOS.confHigh}20` }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </motion.section>

        {/* ═══ WI-17C: AI Recommendation ═══ */}
        {selectedCompanyId && (
          <div className="mb-6">
            <RecommendationCard companyId={selectedCompanyId} />
          </div>
        )}

        {/* ═══ G10 FIX: Temporal Intelligence Timeline ═══ */}
        {temporalData && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="mb-6"
          >
            <div className="ios-card p-5" style={{ borderLeft: `2px solid ${IOS.signal}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" style={{ color: IOS.signal }} />
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: IOS.signal }}>
                  Intelligence Timeline
                </span>
              </div>
              <TemporalIntelligenceTimeline temporal={temporalData} compact />
            </div>
          </motion.div>
        )}

        {/* ═══ SECTION 2: Evidence & Signals — Categorized ═══ */}
        <section
          ref={(el) => { sectionRefs.current.evidence = el; }}
          id="section-evidence"
        >
          <SectionHeader icon={Zap} title="Signals & Evidence" count={intelligence.signals.length} accent={IOS.signal} />
          {intelligence.signals.length === 0 ? (
            <div className="ios-card p-12 text-center">
              <Zap className="w-8 h-8 mx-auto mb-3" style={{ color: `${IOS.signal}30` }} />
              <p className="text-sm" style={{ color: IOS.textSecondary }}>No signals detected. Run intelligence enrichment to discover opportunities.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupSignalsByCategory(intelligence.signals).map((group) => (
                <div key={group.key}>
                  {/* Category header with intelligence summary */}
                  <div className="flex items-center gap-3 mb-3 px-1">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${group.accent}12`, border: `1px solid ${group.accent}20` }}
                    >
                      <group.icon className="w-3.5 h-3.5" style={{ color: group.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: group.accent }}>
                        {group.label}
                      </span>
                      <span
                        className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                        style={{ background: `${group.accent}12`, color: group.accent }}
                      >
                        {group.signals.length}
                      </span>
                    </div>
                    <p className="text-[10px] italic truncate max-w-xs" style={{ color: IOS.textMuted }}>
                      {group.summary}
                    </p>
                  </div>
                  {/* Signals in this group */}
                  <div className="space-y-3">
                    {group.signals.map((signal, i) => (
                      <IntelligenceSurface
                        key={signal.id}
                        item={signal}
                        companyId={selectedCompanyId}
                        showTemporal
                        delay={i * 0.04}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ═══ SECTION 2.5: Technology Intelligence ═══ */}
        <section
          ref={(el) => { sectionRefs.current.technology = el; }}
          id="section-technology"
        >
          <SectionHeader icon={Server} title="Technology Intelligence" accent={tokens.domain.enrichment} />

          {/* Digital Maturity + Tech Landscape */}
          <div className="ios-card p-5 mb-4" style={{ borderLeft: `2px solid #06b6d4` }}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: tokens.domain.enrichment }}>
                  Digital Maturity
                </p>
                <p className="text-lg font-bold capitalize mt-1" style={{ color: IOS.textPrimary }}>
                  {intelligence.technology.digitalMaturity || 'Unknown'}
                </p>
              </div>
              {intelligence.technology.techSignals.length > 0 && (
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: tokens.domain.enrichment, color: tokens.domain.enrichment }}
                >
                  {intelligence.technology.techSignals.length} change signal{intelligence.technology.techSignals.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Known Tech — business context, not tag cloud */}
            {intelligence.technology.knownTech.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${IOS.border}` }}>
                <p className="text-[9px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: IOS.textMuted }}>
                  Known Technology Landscape
                </p>
                <p className="text-xs leading-relaxed" style={{ color: IOS.textSecondary }}>
                  {intelligence.company.name} operates with {intelligence.technology.knownTech.slice(0, 8).join(', ')}{intelligence.technology.knownTech.length > 8 ? ` and ${intelligence.technology.knownTech.length - 8} more technologies` : ''}. {intelligence.technology.digitalMaturity === 'advanced' ? 'This suggests significant infrastructure investment and platform maturity, creating opportunities for modernization and integration capabilities.' : intelligence.technology.digitalMaturity === 'high' ? 'Strong technology foundation indicates readiness for advanced solutions and platform partnerships.' : 'Growing technology adoption signals increasing openness to new tools and platform investments.'}
                </p>
              </div>
            )}

            {/* Technology → Business Meaning translation */}
            {intelligence.technology.knownTech.length > 0 && intelligence.capabilityMatches.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${IOS.border}` }}>
                <p className="text-[9px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: IOS.textMuted }}>
                  Technology → Capability Relevance
                </p>
                {(() => {
                  const techLower = intelligence.technology.knownTech.map(t => t.toLowerCase());
                  const relevantCaps = intelligence.capabilityMatches
                    .filter(m => {
                      const capText = [m.title, m.subtitle, m.reasoning].filter(Boolean).join(' ').toLowerCase();
                      return techLower.some(tech => capText.includes(tech));
                    })
                    .slice(0, 3);
                  if (relevantCaps.length === 0) return (
                    <p className="text-xs leading-relaxed" style={{ color: IOS.textSecondary }}>
                      Their technology stack suggests potential alignment with your capabilities. Further enrichment will strengthen the connection analysis.
                    </p>
                  );
                  return (
                    <div className="space-y-2">
                      {relevantCaps.map(cap => (
                        <div key={cap.id} className="flex items-start gap-2 px-3 py-2 rounded-lg"
                          style={{ background: tokens.accent.ghost, border: `1px solid ${tokens.extended.sky.border}` }}>
                          <Cpu className="w-3 h-3 shrink-0 mt-0.5" style={{ color: tokens.domain.enrichment }} />
                          <div>
                            <p className="text-xs font-medium" style={{ color: IOS.textPrimary }}>
                              {cap.title} — {cap.confidence}% match
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: IOS.textSecondary }}>
                              {cap.whyWeRelevant || cap.whyItMatters}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Tech description */}
            {intelligence.technology.techDescription && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${IOS.border}` }}>
                <p className="text-[9px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: IOS.textMuted }}>
                  Technology Assessment
                </p>
                <p className="text-xs leading-relaxed" style={{ color: IOS.textSecondary }}>
                  {intelligence.technology.techDescription}
                </p>
              </div>
            )}
          </div>

          {/* Tech Signals as Intelligence Surfaces */}
          {intelligence.technology.techSignals.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: IOS.textMuted }}>
                Technology Change Signals
              </p>
              {intelligence.technology.techSignals.map((signal, i) => (
                <IntelligenceSurface
                  key={signal.id}
                  item={signal}
                  companyId={selectedCompanyId}
                  showTemporal
                  delay={i * 0.04}
                />
              ))}
            </div>
          )}

          {intelligence.technology.knownTech.length === 0 && intelligence.technology.techSignals.length === 0 && (
            <div className="ios-card p-12 text-center">
              <Server className="w-8 h-8 mx-auto mb-3" style={{ color: tokens.domain.enrichment }} />
              <p className="text-sm" style={{ color: IOS.textSecondary }}>No technology intelligence available yet. Enrich account to discover technology landscape.</p>
            </div>
          )}
        </section>

        {/* ═══ SECTION 3: Capability Alignment ═══ */}
        <section
          ref={(el) => { sectionRefs.current.alignment = el; }}
          id="section-alignment"
        >
          <SectionHeader
            icon={Target}
            title="Capability Alignment"
            count={intelligence.needs.length + intelligence.capabilityMatches.length}
            accent={IOS.confHigh}
          />

          {/* Detected Needs */}
          {intelligence.needs.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: IOS.textMuted }}>
                Detected Business Needs
              </p>
              <div className="space-y-3">
                {intelligence.needs.slice(0, 6).map((need, i) => (
                  <IntelligenceSurface
                    key={need.id}
                    item={need}
                    companyId={selectedCompanyId}
                    delay={i * 0.04}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Capability Matches */}
          {intelligence.capabilityMatches.length > 0 && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: IOS.textMuted }}>
                Capability Matches
              </p>
              <div className="space-y-3">
                {intelligence.capabilityMatches.map((match, i) => (
                  <IntelligenceSurface
                    key={match.id}
                    item={match}
                    companyId={selectedCompanyId}
                    delay={i * 0.04}
                  />
                ))}
              </div>
            </div>
          )}

          {intelligence.needs.length === 0 && intelligence.capabilityMatches.length === 0 && (
            <div className="ios-card p-12 text-center">
              <Target className="w-8 h-8 mx-auto mb-3" style={{ color: `${IOS.confHigh}30` }} />
              <p className="text-sm" style={{ color: IOS.textSecondary }}>No capability alignment yet.</p>
              <p className="text-xs mt-1" style={{ color: IOS.textMuted }}>Upload capabilities and enrich accounts to enable alignment.</p>
              <button
                onClick={() => setActiveView('activation-workspace')}
                className="mt-4 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{ color: IOS.accent, background: `${IOS.accent}10`, border: `1px solid ${IOS.accent}20` }}
              >
                <ArrowUpRight className="w-3 h-3" />
                Manage Capabilities
              </button>
            </div>
          )}
        </section>

        {/* ═══ SECTION 4: Stakeholders ═══ */}
        <section
          ref={(el) => { sectionRefs.current.stakeholders = el; }}
          id="section-stakeholders"
        >
          <SectionHeader icon={Users} title="Stakeholders" count={intelligence.stakeholders.length} accent={IOS.intelligence} />

          {/* Target stakeholders from positioning */}
          {intelligence.positioning.targetStakeholders.length > 0 && (
            <div className="ios-card p-4 mb-4" style={{ borderLeft: `2px solid ${IOS.intelligence}` }}>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase mb-3" style={{ color: IOS.intelligence }}>
                Recommended Targets
              </p>
              <div className="flex flex-wrap gap-2">
                {intelligence.positioning.targetStakeholders.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: IOS.bgSecondary, border: `1px solid ${IOS.border}` }}
                  >
                    <Users className="w-3 h-3" style={{ color: IOS.intelligence }} />
                    <span className="font-semibold" style={{ color: IOS.textPrimary }}>{s.role}</span>
                    <span className="text-[10px]" style={{ color: IOS.textMuted }}>— {s.reason}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {intelligence.stakeholders.length === 0 ? (
            <div className="ios-card p-12 text-center">
              <Users className="w-8 h-8 mx-auto mb-3" style={{ color: `${IOS.intelligence}30` }} />
              <p className="text-sm" style={{ color: IOS.textSecondary }}>No stakeholders identified. Enrich account to discover contacts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {intelligence.stakeholders.map((s, i) => (
                <IntelligenceSurface key={s.id} item={s} companyId={selectedCompanyId} delay={i * 0.04} />
              ))}
            </div>
          )}
        </section>

        {/* ═══ SECTION 5: Actions ═══ */}
        <section
          ref={(el) => { sectionRefs.current.actions = el; }}
          id="section-actions"
        >
          <SectionHeader icon={Sparkles} title="Actions" count={intelligence.actions.length} accent={IOS.opportunity} />
          {intelligence.actions.length === 0 ? (
            <div className="ios-card p-12 text-center">
              <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: `${IOS.opportunity}30` }} />
              <p className="text-sm" style={{ color: IOS.textSecondary }}>No actions recommended. Enrich account to generate recommendations.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {intelligence.actions.map((action, i) => (
                <IntelligenceSurface key={action.id} item={action} companyId={selectedCompanyId} delay={i * 0.04} />
              ))}
            </div>
          )}
        </section>

        {/* ═══ SECTION 6: Intelligence History ═══ */}
        <section
          ref={(el) => { sectionRefs.current.history = el; }}
          id="section-history"
        >
          <SectionHeader icon={BarChart3} title="Intelligence History" accent={tokens.domain.enrichment} />

          {intelligence.signals.filter(s => s.temporal).length > 0 ? (
            <div className="space-y-2">
              {intelligence.signals.filter(s => s.temporal).slice(0, 8).map((signal, i) => (
                <motion.div
                  key={signal.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="ios-card px-5 py-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: IOS.textPrimary }}>{signal.title}</p>
                      <div className="mt-1.5">
                        <TemporalBadge temporal={signal.temporal} />
                      </div>
                    </div>
                    <ConfidenceIndicator value={signal.temporal!.current} />
                  </div>
                  {/* Mini confidence evolution bar */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[9px] tabular-nums" style={{ color: IOS.textMuted }}>
                      {signal.temporal!.previous}%
                    </span>
                    <div className="flex-1 confidence-bar">
                      <div
                        className="confidence-bar-fill"
                        style={{
                          width: `${Math.abs(signal.temporal!.current - signal.temporal!.previous) * 5}%`,
                          background: signal.temporal!.trend === 'rising'
                            ? `${IOS.confHigh}60`
                            : signal.temporal!.trend === 'declining'
                              ? `${IOS.confLow}60`
                              : `${IOS.textMuted}40`,
                        }}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums font-bold" style={{ color: getConfidenceColor(signal.temporal!.current) }}>
                      {signal.temporal!.current}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="ios-card p-12 text-center">
              <BarChart3 className="w-8 h-8 mx-auto mb-3" style={{ color: tokens.domain.enrichment }} />
              <p className="text-sm" style={{ color: IOS.textSecondary }}>
                Intelligence history will appear as signals are detected over time.
              </p>
            </div>
          )}
        </section>

        {/* ═══ SECTION 7: Evidence Library — Centralized Trust Surface ═══ */}
        <section
          ref={(el) => { sectionRefs.current['evidence-library'] = el; }}
          id="section-evidence-library"
        >
          <SectionHeader icon={BookOpen} title="Evidence Library" accent={IOS.confMedium} />
          {(() => {
            const allEvidence = collectAllEvidence(intelligence);
            if (allEvidence.length === 0) {
              return (
                <div className="ios-card p-12 text-center">
                  <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: `${IOS.confMedium}30` }} />
                  <p className="text-sm" style={{ color: IOS.textSecondary }}>No evidence collected yet. Evidence accumulates as intelligence signals are detected.</p>
                </div>
              );
            }

            // Group by month
            const byMonth = new Map<string, FlattenedEvidence[]>();
            for (const ev of allEvidence) {
              const key = ev.date ? formatMonthYear(ev.date) : 'Undated';
              if (!byMonth.has(key)) byMonth.set(key, []);
              byMonth.get(key)!.push(ev);
            }

            return (
              <div className="space-y-6">
                <p className="text-[10px] italic px-1" style={{ color: IOS.textMuted }}>
                  {allEvidence.length} evidence entries across {intelligence.signalCount} signals, {intelligence.capabilityMatches.length} capability matches, and {intelligence.stakeholders.length} stakeholders
                </p>
                {Array.from(byMonth.entries()).map(([month, items]) => (
                  <div key={month}>
                    <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3 px-1" style={{ color: IOS.textSecondary }}>
                      {month}
                    </p>
                    <div className="space-y-2">
                      {items.map((ev, i) => (
                        <div
                          key={`${month}-${i}`}
                          className="ios-card px-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: `${IOS.accent}10`, border: `1px solid ${IOS.accent}15` }}
                            >
                              <Check className="w-2.5 h-2.5" style={{ color: IOS.accent }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium leading-relaxed" style={{ color: IOS.textPrimary }}>
                                {ev.snippet}
                              </p>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                <span className="text-[10px]" style={{ color: IOS.textMuted }}>
                                  Source: {ev.source}
                                </span>
                                {ev.date && (
                                  <span className="text-[10px]" style={{ color: `${IOS.textMuted}60` }}>
                                    {new Date(ev.date).toLocaleDateString()}
                                  </span>
                                )}
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: `${IOS.accent}10`, color: IOS.accent }}
                                >
                                  {ev.parentType}
                                </span>
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: getConfidenceBg(ev.parentConfidence), color: getConfidenceColor(ev.parentConfidence) }}
                                >
                                  {ev.parentConfidence}%
                                </span>
                                <span className="text-[10px]" style={{ color: `${IOS.textMuted}60` }}>
                                  Linked: {ev.parentTitle}
                                </span>
                                {ev.url && (
                                  <a href={ev.url} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] font-medium flex items-center gap-0.5 transition-colors"
                                    style={{ color: IOS.accent }}
                                  >
                                    <ExternalLink className="w-2 h-2" /> View
                                  </a>
                                )}
                                <EvidenceStateBadge state={ev.state as EvidenceState} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>

        {/* Bottom spacer for sticky nav */}
        <div className="h-20" />
      </div>
    </div>
  );
}
