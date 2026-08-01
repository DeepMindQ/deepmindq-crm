'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronRight, ExternalLink, ArrowRight,
  Brain, Target, Clock, Zap, TrendingUp, AlertTriangle,
  Loader2, Sparkles, Shield, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, getConfidenceTier } from './design-tokens';
import type { IntelligenceNarrativeData } from '@/lib/intelligence-narrative-service';

/* ═══════════════════════════════════════════════════
   IntelligenceNarrative — The Core Experience Pattern
   
   This is NOT a card. It is the primary intelligence delivery vehicle.
   It transforms raw data + signals + reasoning into a clear,
   action-oriented narrative that a revenue leader can immediately
   understand and act on.
   
   Design Principles:
   - Narrative First: Tell the story, don't dump data
   - Progressive Disclosure: L1 Decision → L2 Reasoning → L3 Evidence → L4 Explore
   - Confidence as Universal Layer: Every intelligence carries confidence
   - Action-Terminated: Every narrative ends with a clear action
   - Calm Over Complexity: Dense intelligence, calm presentation
   - Zero Dead Ends: Every narrative has a next step
   
   Emotional Design:
   - Intelligence Advantage: "I know something my competitors don't"
   - Confidence & Trust: Confidence visible, evidence accessible
   - Discovery Experience: Progressive layers reveal depth
   ═══════════════════════════════════════════════════ */

// ── Types ──

export interface EvidenceItem {
  source: string;
  sourceType?: 'news' | 'filing' | 'web' | 'database' | 'social' | 'internal' | 'sec' | 'press';
  snippet: string;
  url?: string;
  date?: string;
}

export interface RelatedSignal {
  title: string;
  type: 'signal' | 'opportunity' | 'risk' | 'pattern';
  date?: string;
  entityId?: string;
}

export interface NarrativeAction {
  label: string;
  href?: string;
  onClick?: () => void;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

export type NarrativeVariant = 'signal' | 'opportunity' | 'risk' | 'enrichment' | 'reasoning' | 'action';

export interface IntelligenceNarrativeProps {
  /** ═══ REAL INTELLIGENCE MODE ═══
   *  Pass pre-computed narrative data from the Intelligence Engine.
   *  When provided, all individual props (headline, confidence, etc.)
   *  are derived from this data object.
   *  This is the PREFERRED way to use IntelligenceNarrative.
   */
  data?: IntelligenceNarrativeData;

  /** ═══ MANUAL MODE (backward compatible) ═══
   *  Use these props only for static/storyboard content.
   *  When `data` is provided, these are ignored.
   */
  headline?: string;
  subtitle?: string;
  variant?: NarrativeVariant;
  confidence?: number; // 0-100
  confidenceLabel?: string;
  timestamp?: string;
  entityName?: string;
  entityType?: 'company' | 'contact' | 'opportunity' | 'signal';

  /** L2 — Reasoning Layer */
  reasoning?: string;
  reasoningPoints?: string[];

  /** L3 — Evidence Layer */
  evidence?: EvidenceItem[];
  impactStatement?: string;

  /** L4 — Exploration Layer */
  relatedSignals?: RelatedSignal[];
  relatedActions?: NarrativeAction[];

  /** Primary Action (action-terminated) */
  primaryAction?: NarrativeAction;

  /** Visual customization */
  intelligenceScore?: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  isNew?: boolean;
  isDismissable?: boolean;
  onDismiss?: () => void;

  /** Loading state */
  loading?: boolean;
  loadingLabel?: string;

  /** Layout */
  compact?: boolean;
  className?: string;

  /** Navigation handler for company/entity click */
  onEntityClick?: (entityId: string, entityType: string) => void;

  /** Navigation handler for action click */
  onActionClick?: (action: { label: string; companyId?: string }) => void;

  /** Children slot for custom extensions */
  children?: ReactNode;
}

// ── Helper: Domain accent color ──

function getDomainAccent(variant: NarrativeVariant) {
  const map: Record<NarrativeVariant, { color: string; bg: string; border: string; icon: typeof Zap }> = {
    signal:      { color: tokens.domain.signal,      bg: 'rgba(59, 130, 246, 0.1)',      border: 'rgba(59, 130, 246, 0.2)',      icon: Zap },
    opportunity: { color: tokens.domain.opportunity, bg: 'rgba(139, 92, 246, 0.1)',     border: 'rgba(139, 92, 246, 0.2)',     icon: TrendingUp },
    risk:        { color: tokens.domain.risk,         bg: 'rgba(239, 68, 68, 0.1)',       border: 'rgba(239, 68, 68, 0.2)',       icon: AlertTriangle },
    enrichment:  { color: tokens.domain.enrichment,   bg: 'rgba(6, 182, 212, 0.1)',       border: 'rgba(6, 182, 212, 0.2)',       icon: Sparkles },
    reasoning:   { color: tokens.domain.reasoning,    bg: 'rgba(245, 158, 11, 0.1)',      border: 'rgba(245, 158, 11, 0.2)',      icon: Brain },
    action:      { color: tokens.domain.action,       bg: 'rgba(16, 185, 129, 0.1)',      border: 'rgba(16, 185, 129, 0.2)',      icon: Target },
  };
  return map[variant || 'signal'];
}

// ── Confidence Ring (SVG) ──

function ConfidenceRing({ value, size = 44 }: { value: number; size?: number }) {
  const tier = getConfidenceTier(value);
  const color = tokens.confidence[tier].value;
  const bgColor = tokens.confidence[tier].bg;
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={tokens.border.subtle} strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-bold tabular-nums"
          style={{ fontSize: size * 0.24, color }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

// ── Priority Badge ──

function PriorityBadge({ priority, isNew }: { priority?: string; isNew?: boolean }) {
  if (!priority && !isNew) return null;
  const p = priority?.toLowerCase();
  const priorityColors: Record<string, { bg: string; color: string }> = {
    critical: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' },
    high:     { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' },
    medium:   { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' },
    low:      { bg: 'rgba(136, 146, 168, 0.1)', color: '#8892a8' },
  };

  return (
    <div className="flex items-center gap-1.5">
      {isNew && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          New
        </span>
      )}
      {p && priorityColors[p] && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: priorityColors[p].bg, color: priorityColors[p].color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityColors[p].color }} />
          {p.charAt(0).toUpperCase() + p.slice(1)}
        </span>
      )}
    </div>
  );
}

// ── Evidence Source Icon ──

function sourceIcon(sourceType?: string) {
  const map: Record<string, string> = {
    news: '📰', filing: '📋', web: '🌐', database: '💾',
    social: '👥', internal: '🔒', sec: '🏛️', press: '📰',
  };
  return sourceType ? map[sourceType] || '📄' : '📄';
}

// ── Confidence Breakdown Tooltip ──

function ConfidenceBreakdownTooltip({
  data,
}: {
  data: NonNullable<IntelligenceNarrativeData['confidence']>;
}) {
  return (
    <div
      className="absolute z-50 left-full ml-3 top-0 w-64 rounded-xl border p-3 shadow-xl"
      style={{
        background: tokens.surface.elevated,
        borderColor: tokens.border.default,
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.text.muted }}>
        Confidence Breakdown
      </p>

      {/* Formula */}
      <p className="text-[10px] font-mono mb-3 leading-relaxed" style={{ color: tokens.text.secondary }}>
        {data.formula}
      </p>

      {/* Dimension bars */}
      {[
        { label: 'Signal Quality', value: data.breakdown.signalQuality, weight: '30%' },
        { label: 'Evidence Quality', value: data.breakdown.evidenceQuality, weight: '30%' },
        { label: 'Capability Fit', value: data.breakdown.capabilityFit, weight: '25%' },
        { label: 'Data Completeness', value: data.breakdown.dataCompleteness, weight: '15%' },
      ].map((dim) => {
        const tier = getConfidenceTier(dim.value);
        const color = tokens.confidence[tier].value;
        return (
          <div key={dim.label} className="mb-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px]" style={{ color: tokens.text.secondary }}>{dim.label}</span>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>{dim.value}</span>
            </div>
            <div className="w-full h-1 rounded-full" style={{ background: tokens.border.subtle }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${dim.value}%`, background: color }}
              />
            </div>
          </div>
        );
      })}

      {/* Factors */}
      {(data.factors.positiveFactors.length > 0 || data.factors.negativeFactors.length > 0) && (
        <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: tokens.text.muted }}>
            Key Factors
          </p>
          {data.factors.positiveFactors.slice(0, 2).map((f, i) => (
            <div key={`pos-${i}`} className="flex items-start gap-1.5 mb-1">
              <span className="text-[10px] font-bold text-emerald-500 shrink-0">+</span>
              <span className="text-[10px]" style={{ color: tokens.text.secondary }}>{f.factor}</span>
            </div>
          ))}
          {data.factors.negativeFactors.slice(0, 2).map((f, i) => (
            <div key={`neg-${i}`} className="flex items-start gap-1.5 mb-1">
              <span className="text-[10px] font-bold text-red-400 shrink-0">-</span>
              <span className="text-[10px]" style={{ color: tokens.text.secondary }}>{f.factor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Enhanced Confidence Ring with breakdown tooltip ──

function EnhancedConfidenceRing({
  value,
  confidenceData,
  size = 44,
}: {
  value: number;
  confidenceData?: IntelligenceNarrativeData['confidence'];
  size?: number;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const tier = getConfidenceTier(value);
  const color = tokens.confidence[tier].value;
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative shrink-0" onMouseEnter={() => confidenceData && setShowBreakdown(true)} onMouseLeave={() => setShowBreakdown(false)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={tokens.border.subtle} strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-bold tabular-nums" style={{ fontSize: size * 0.24, color }}>{value}</span>
        </div>
        {confidenceData && (
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full" style={{ background: color, opacity: 0.4 }}>
            <div className="w-full h-full rounded-full animate-ping" style={{ background: color, opacity: 0.3 }} />
          </div>
        )}
      </div>
      {/* Breakdown tooltip */}
      {showBreakdown && confidenceData && (
        <ConfidenceBreakdownTooltip data={confidenceData} />
      )}
    </div>
  );
}

// ── Main Component ──

export function IntelligenceNarrative({
  data,
  headline,
  subtitle,
  variant = 'signal',
  confidence = 0,
  confidenceLabel,
  timestamp,
  entityName,
  entityType,
  reasoning,
  reasoningPoints,
  evidence = [],
  impactStatement,
  relatedSignals,
  relatedActions,
  primaryAction,
  intelligenceScore,
  priority,
  isNew,
  isDismissable,
  onDismiss,
  loading = false,
  loadingLabel = 'Analyzing intelligence...',
  compact = false,
  className,
  onEntityClick,
  onActionClick,
  children,
}: IntelligenceNarrativeProps) {
  // ═══ Resolve props: prefer `data` (real intelligence) over manual props ═══
  const _headline = data?.headline || headline || 'Untitled Intelligence';
  const _subtitle = data?.subtitle || subtitle;
  const _variant = data?.variant || variant;
  const _confidence = data?.confidence.score || confidence;
  const _confidenceLabel = data ? 'Multi-factor confidence' : confidenceLabel;
  const _timestamp = data?.timestamp || timestamp;
  const _entityName = data?.entityName || entityName;
  const _entityType = data?.entityType || entityType;
  const _reasoning = data?.reasoning || reasoning || '';
  const _reasoningPoints = data?.reasoningPoints?.length ? data.reasoningPoints : reasoningPoints;
  const _evidence = data?.evidence?.length
    ? data.evidence.map(e => ({
        source: e.source,
        sourceType: e.sourceType,
        snippet: e.snippet,
        url: e.url,
        date: e.date,
        relevanceScore: e.relevanceScore,
      }))
    : evidence;
  const _impactStatement = data?.impactStatement || impactStatement;
  const _relatedSignals = data?.relatedSignals || relatedSignals;
  const _relatedActions = data?.secondaryActions?.length
    ? data.secondaryActions.map(a => ({
        label: a.label,
        onClick: () => onActionClick?.({ label: a.label, companyId: a.companyId }),
        priority: a.priority,
      }))
    : relatedActions;
  const _primaryAction = data?.primaryAction
    ? {
        label: data.primaryAction.label,
        onClick: () => onActionClick?.({ label: data.primaryAction!.label, companyId: data.primaryAction!.companyId }),
        priority: data.primaryAction.priority,
      }
    : primaryAction;
  const _intelligenceScore = data?.intelligenceScore || intelligenceScore;
  const _priority = data?.priority || priority;
  const _isNew = data?.isNew || isNew;
  const _entityId = data?.entityId;
  const _confidenceData = data?.confidence;
  const [expandedLevel, setExpandedLevel] = useState(1);
  const accent = getDomainAccent(_variant);
  const AccentIcon = accent.icon;
  const tier = getConfidenceTier(_confidence);

  const hasL2 = Boolean(_reasoning || _reasoningPoints?.length);
  const hasL3 = _evidence.length > 0;
  const hasL4 = Boolean(_relatedSignals?.length || _relatedActions?.length);

  const toggleLevel = (level: number) => {
    setExpandedLevel(prev => prev === level ? level - 1 : level);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div
        className={cn(
          'rounded-xl overflow-hidden border',
          className
        )}
        style={{
          background: tokens.surface.card,
          borderColor: tokens.border.default,
        }}
      >
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full animate-pulse" style={{ background: tokens.border.subtle }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded animate-pulse" style={{ background: tokens.border.subtle }} />
              <div className="h-3 w-1/2 rounded animate-pulse" style={{ background: tokens.border.subtle }} />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-14">
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: tokens.accent.DEFAULT }} />
            <span className="text-xs" style={{ color: tokens.text.secondary }}>{loadingLabel}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group rounded-xl overflow-hidden border transition-all duration-200',
        className
      )}
      style={{
        background: tokens.surface.card,
        borderColor: tokens.border.default,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tokens.border.hover;
        e.currentTarget.style.background = tokens.surface.cardHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tokens.border.default;
        e.currentTarget.style.background = tokens.surface.card;
      }}
    >
      {/* ─── Left Accent Stripe ─── */}
      <div className="flex">
        <div
          className="w-[3px] shrink-0 self-stretch"
          style={{ background: accent.color }}
        />

        <div className="flex-1 min-w-0">
          {/* ═══ L1 — Decision Layer ═══ */}
          <div className={compact ? 'px-3.5 py-3' : 'px-4 py-3.5'}>
            <div className="flex items-start gap-3">
              {/* Confidence Ring (enhanced with breakdown) */}
              <EnhancedConfidenceRing value={_confidence} confidenceData={_confidenceData} />

              {/* Headline Area */}
              <div className="flex-1 min-w-0">
                {/* Top meta row */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <PriorityBadge priority={_priority} isNew={_isNew} />
                  {_confidenceLabel && (
                    <span className="text-[10px] font-medium flex items-center gap-1" style={{ color: tokens.text.muted }}>
                      {_confidenceData && <Info className="w-2.5 h-2.5" />}
                      {_confidenceLabel}
                    </span>
                  )}
                </div>

                {/* Headline */}
                <h3
                  className="font-semibold leading-snug"
                  style={{ fontSize: compact ? '13px' : '14px', color: tokens.text.primary }}
                >
                  {_headline}
                </h3>

                {/* Subtitle */}
                {_subtitle && (
                  <p className="mt-1 leading-relaxed" style={{ fontSize: '12px', color: tokens.text.secondary }}>
                    {_subtitle}
                  </p>
                )}

                {/* Entity + timestamp */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {_entityName && (
                    <button
                      onClick={() => _entityId && onEntityClick?.(_entityId, _entityType || 'company')}
                      className="inline-flex items-center gap-1 text-[10px] font-medium transition-colors hover:underline"
                      style={{ color: tokens.text.muted }}
                    >
                      <span style={{ color: accent.color }}>●</span>
                      {_entityName}
                      {_entityType && (
                        <span style={{ color: tokens.text.muted }}>· {_entityType}</span>
                      )}
                    </button>
                  )}
                  {_timestamp && (
                    <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: tokens.text.muted }}>
                      <Clock className="w-2.5 h-2.5" />
                      {_timestamp}
                    </span>
                  )}
                  {_intelligenceScore !== undefined && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: tokens.accent.bright }}>
                      <Brain className="w-2.5 h-2.5" />
                      Intelligence {_intelligenceScore}
                    </span>
                  )}
                </div>
              </div>

              {/* Dismiss */}
              {isDismissable && onDismiss && (
                <button
                  onClick={onDismiss}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/5"
                  style={{ color: tokens.text.muted }}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* ═══ Progressive Disclosure Controls ═══ */}
          {(hasL2 || hasL3 || hasL4) && (
            <div className={compact ? 'px-3.5 pb-1.5' : 'px-4 pb-1.5'}>
              <div className="flex items-center gap-0.5 -mx-1">
                {hasL2 && (
                  <button
                    onClick={() => toggleLevel(2)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors'
                    )}
                    style={{
                      background: expandedLevel >= 2 ? tokens.accent.subtle : 'transparent',
                      color: expandedLevel >= 2 ? tokens.accent.bright : tokens.text.muted,
                    }}
                  >
                    {expandedLevel >= 2 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                    Reasoning
                  </button>
                )}
                {hasL3 && (
                  <button
                    onClick={() => toggleLevel(3)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
                    style={{
                      background: expandedLevel >= 3 ? tokens.accent.subtle : 'transparent',
                      color: expandedLevel >= 3 ? tokens.accent.bright : tokens.text.muted,
                    }}
                  >
                    {expandedLevel >= 3 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                    Evidence ({_evidence.length})
                  </button>
                )}
                {hasL4 && (
                  <button
                    onClick={() => toggleLevel(4)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
                    style={{
                      background: expandedLevel >= 4 ? tokens.accent.subtle : 'transparent',
                      color: expandedLevel >= 4 ? tokens.accent.bright : tokens.text.muted,
                    }}
                  >
                    {expandedLevel >= 4 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                    Related
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ═══ L2 — Reasoning Layer ═══ */}
          <AnimatePresence>
            {expandedLevel >= 2 && hasL2 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div
                  className={compact ? 'px-3.5 py-3' : 'px-4 py-3'}
                  style={{ borderTop: `1px solid ${tokens.border.subtle}`, background: tokens.accent.ghost }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.text.muted }}>
                    Why this matters
                  </p>
                  {_reasoning && (
                    <p className="text-xs leading-relaxed" style={{ color: tokens.text.primary }}>
                      {_reasoning}
                    </p>
                  )}
                  {_reasoningPoints && _reasoningPoints.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {_reasoningPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs" style={{ color: tokens.text.primary }}>
                          <span
                            className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                            style={{ background: accent.color, opacity: 0.6 }}
                          />
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ L3 — Evidence Layer ═══ */}
          <AnimatePresence>
            {expandedLevel >= 3 && hasL3 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className={compact ? 'px-3.5 py-3' : 'px-4 py-3'} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.text.muted }}>
                    Evidence
                  </p>
                  {_impactStatement && (
                    <div
                      className="mb-3 px-3 py-2 rounded-lg"
                      style={{
                        background: 'rgba(245, 158, 11, 0.06)',
                        border: '1px solid rgba(245, 158, 11, 0.12)',
                      }}
                    >
                      <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>{_impactStatement}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {_evidence.map((ev, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-colors"
                        style={{ background: tokens.surface.elevated }}
                      >
                        <span className="text-[10px] font-bold shrink-0 mt-0.5 tabular-nums" style={{ color: tokens.text.muted, opacity: 0.4 }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs leading-relaxed" style={{ color: tokens.text.primary }}>{ev.snippet}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] font-medium" style={{ color: tokens.text.secondary }}>
                              {sourceIcon(ev.sourceType)} {ev.source}
                            </span>
                            {ev.date && (
                              <span className="text-[10px]" style={{ color: tokens.text.muted }}>{ev.date}</span>
                            )}
                            {ev.url && (
                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[10px] font-medium transition-colors"
                                style={{ color: tokens.accent.bright }}
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                Source
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ L4 — Exploration Layer ═══ */}
          <AnimatePresence>
            {expandedLevel >= 4 && hasL4 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div
                  className={compact ? 'px-3.5 py-3' : 'px-4 py-3'}
                  style={{ borderTop: `1px solid ${tokens.border.subtle}`, background: tokens.accent.ghost }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.text.muted }}>
                    Related Intelligence
                  </p>
                  <div className="space-y-1.5">
                    {_relatedSignals?.map((sig, i) => {
                      const sigAccent = getDomainAccent(sig.type as NarrativeVariant);
                      return (
                        <div
                          key={`sig-${i}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors"
                          style={{
                            background: tokens.surface.card,
                            borderColor: tokens.border.subtle,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sigAccent.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: tokens.text.primary }}>{sig.title}</p>
                            <p className="text-[10px]" style={{ color: tokens.text.muted }}>
                              {sig.type}{sig.date ? ` · ${sig.date}` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {_relatedActions?.map((act, i) => (
                      <button
                        key={`act-${i}`}
                        onClick={act.onClick}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border w-full text-left transition-colors hover:border-blue-500/30"
                        style={{
                          background: tokens.surface.card,
                          borderColor: tokens.border.subtle,
                        }}
                      >
                        <ArrowRight className="w-3 h-3 shrink-0" style={{ color: tokens.domain.action }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: tokens.text.primary }}>{act.label}</p>
                          <p className="text-[10px] capitalize" style={{ color: tokens.text.muted }}>{act.priority} priority</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ Primary Action (Action-Terminated Intelligence) ═══ */}
          {_primaryAction && (
            <div className={compact ? 'px-3.5 pb-3' : 'px-4 pb-3.5'} style={{ paddingTop: hasL2 || hasL3 || hasL4 ? '0' : '8px' }}>
              <button
                onClick={_primaryAction.onClick}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200'
                )}
                style={{
                  background: accent.bg,
                  border: `1px solid ${accent.border}`,
                  color: accent.color,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = accent.border;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = accent.bg;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {_primaryAction.label}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Children slot */}
          {children}
        </div>
      </div>
    </motion.div>
  );
}
