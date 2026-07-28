'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Brain, Zap, Target, Users, Sparkles,
  ArrowLeft, ExternalLink, RefreshCw, ChevronRight,
  CheckCircle2, AlertTriangle, HelpCircle, Clock, ArrowUpRight,
  TrendingUp, TrendingDown, Minus, Layers,
  FileText, BarChart3, ThumbsUp, ThumbsDown,
  ChevronDown, ChevronUp, X, Copy, Check,
  Activity, Radar, Radio,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { CompanyIntelligence, IntelligenceObject, EvidenceState, ExecutiveBriefData } from '@/lib/intelligence-types';

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
  if (val >= 75) return 'rgba(16,185,129,0.08)';
  if (val >= 50) return 'rgba(245,158,11,0.08)';
  return 'rgba(239,68,68,0.08)';
}

function getConfidenceFill(val: number): string {
  if (val >= 75) return 'rgba(16,185,129,0.6)';
  if (val >= 50) return 'rgba(245,158,11,0.6)';
  return 'rgba(239,68,68,0.6)';
}

/* ── Type Label Config ── */
const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  signal:            { label: 'INTELLIGENCE SIGNAL',  color: IOS.signal,      icon: Zap },
  need:              { label: 'DETECTED NEED',        color: '#f59e0b',     icon: Target },
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
    } catch (e) { console.error('Feedback error:', e); }
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
        className="p-1 rounded transition-colors hover:bg-[rgba(16,185,129,0.1)]"
        title="Accurate"
      >
        <ThumbsUp className="w-3 h-3" style={{ color: IOS.textMuted }} />
      </button>
      <button
        onClick={() => submitFeedback('outdated')}
        className="p-1 rounded transition-colors hover:bg-[rgba(245,158,11,0.1)]"
        title="Outdated"
      >
        <Clock className="w-3 h-3" style={{ color: IOS.textMuted }} />
      </button>
      <button
        onClick={() => submitFeedback('incorrect')}
        className="p-1 rounded transition-colors hover:bg-[rgba(239,68,68,0.1)]"
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="group relative ios-card overflow-hidden"
      style={{
        borderLeft: `2px solid ${accentColor}`,
        boxShadow: `0 0 20px ${accentColor}06`,
      }}
    >
      {/* Glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 30px ${accentColor}08` }}
      />

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
            <EvidenceStateBadge state={item.evidenceState} />
            {item.priority === 'high' && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide"
                style={{ background: 'rgba(239,68,68,0.1)', color: IOS.confLow, border: '1px solid rgba(239,68,68,0.2)' }}
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
                      <EvidenceStateBadge state={ev.state} />
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
      style={{ background: 'rgba(10,12,16,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="ios-card w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        style={{
          boxShadow: `0 25px 50px rgba(0,0,0,0.5), 0 0 80px ${IOS.accent}08`,
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
                    <EvidenceStateBadge state={ev.state} />
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
   Main Company Workspace
   ═══════════════════════════════════════════════════════════════════════════ */

type Section = 'executive' | 'evidence' | 'alignment' | 'stakeholders' | 'actions' | 'history';

const SECTIONS: { key: Section; label: string; icon: React.ElementType; accent: string }[] = [
  { key: 'executive',    label: 'Understanding',        icon: Brain,     accent: IOS.accent },
  { key: 'evidence',     label: 'Signals & Evidence',    icon: Zap,       accent: IOS.signal },
  { key: 'alignment',    label: 'Capability Alignment',  icon: Target,    accent: IOS.confHigh },
  { key: 'stakeholders', label: 'Stakeholders',          icon: Users,     accent: IOS.intelligence },
  { key: 'actions',      label: 'Actions',              icon: Sparkles,  accent: IOS.opportunity },
  { key: 'history',      label: 'Intelligence History',  icon: BarChart3, accent: '#06b6d4' },
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
    } catch (e) { console.error('Intelligence fetch error:', e); }
    finally { setLoading(false); }
  }, [selectedCompanyId]);

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
    } catch (e) { console.error('Brief fetch error:', e); }
    finally { setBriefLoading(false); }
  }, [selectedCompanyId]);

  useEffect(() => { fetchIntelligence(); }, [fetchIntelligence]);

  const skipReveal = useCallback(() => {
    setRevealComplete(true);
    setShowReveal(false);
  }, []);

  const completeReveal = useCallback(() => {
    setRevealComplete(true);
    setShowReveal(false);
  }, []);

  const sectionRefs = useRef<Record<Section, HTMLElement | null>>({
    executive: null, evidence: null, alignment: null, stakeholders: null, actions: null, history: null,
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
              </div>
              <p className="text-xs mt-0.5" style={{ color: IOS.textMuted }}>
                {intelligence.company.industry || 'Technology'}{intelligence.company.domain ? ` · ${intelligence.company.domain}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ── PROMINENT Executive Brief Button ── */}
            <button
              onClick={fetchBrief}
              disabled={briefLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all"
              style={{
                background: briefLoading
                  ? `${IOS.accent}20`
                  : `linear-gradient(135deg, ${IOS.accent}, ${IOS.accentDim})`,
                color: '#fff',
                boxShadow: briefLoading ? 'none' : `0 0 20px ${IOS.accent}30, 0 4px 12px rgba(0,0,0,0.3)`,
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
                  color: isActive ? '#fff' : IOS.textSecondary,
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
                      background: isActive ? 'rgba(255,255,255,0.2)' : `${section.accent}12`,
                      color: isActive ? '#fff' : section.accent,
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

        {/* ═══ SECTION 2: Evidence & Signals ═══ */}
        <section
          ref={(el) => { sectionRefs.current.evidence = el; }}
          id="section-evidence"
        >
          <SectionHeader icon={Zap} title="Evidence & Signals" count={intelligence.signals.length} accent={IOS.signal} />
          {intelligence.signals.length === 0 ? (
            <div className="ios-card p-12 text-center">
              <Zap className="w-8 h-8 mx-auto mb-3" style={{ color: `${IOS.signal}30` }} />
              <p className="text-sm" style={{ color: IOS.textSecondary }}>No signals detected. Run intelligence enrichment to discover opportunities.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {intelligence.signals.map((signal, i) => (
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
          <SectionHeader icon={BarChart3} title="Intelligence History" accent="#06b6d4" />

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
              <BarChart3 className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(6,182,212,0.3)' }} />
              <p className="text-sm" style={{ color: IOS.textSecondary }}>
                Intelligence history will appear as signals are detected over time.
              </p>
            </div>
          )}
        </section>

        {/* Bottom spacer for sticky nav */}
        <div className="h-20" />
      </div>
    </div>
  );
}
