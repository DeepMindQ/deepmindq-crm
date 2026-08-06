'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §7 — Signal Timeline (Screen Component)
   
   Displays account signals in a chronological timeline format.
   Each signal entry shows: headline, type, impact level, confidence,
   freshness, and expandable evidence chain.
   
   Used inside AccountIntelligenceScreen (Signals tab).
   MS6 Reference: reference_account_intelligence.html signals view
   All tokens from design-tokens.ts. No hardcoded values.
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Clock, ChevronDown, ChevronRight,
  AlertTriangle, AlertCircle, Info, Activity,
  Shield, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, elevation, motion as motionTokens } from '../design-tokens';
import { EvidenceChain } from '../evidence-chain';
import { EvidenceFootprint } from '../molecules/evidence-footprint';
import { buildEvidenceFootprint } from '@/types/ms8-evidence';
import type { AccountSignalEntry, EvidenceChainItem } from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg, getTrustBorder, getTrustLabel, formatFreshness, getConfidenceTrustLevel } from '@/lib/intelligence-types';

// ─── Impact Level Helpers ───────────────────────────────────
function getImpactColor(impact: AccountSignalEntry['impactLevel']): string {
  switch (impact) {
    case 'critical': return tokens.priority.critical.value;
    case 'high':     return tokens.priority.high.value;
    case 'medium':   return tokens.priority.medium.value;
    case 'low':      return tokens.priority.low.value;
  }
}

function getImpactBg(impact: AccountSignalEntry['impactLevel']): string {
  switch (impact) {
    case 'critical': return tokens.priority.critical.bg;
    case 'high':     return tokens.priority.high.bg;
    case 'medium':   return tokens.priority.medium.bg;
    case 'low':      return tokens.priority.low.bg;
  }
}

function getImpactBorder(impact: AccountSignalEntry['impactLevel']): string {
  switch (impact) {
    case 'critical': return tokens.priority.critical.border;
    case 'high':     return tokens.priority.high.border;
    case 'medium':   return tokens.priority.medium.border;
    case 'low':      return tokens.priority.low.border;
  }
}

function getImpactIcon(impact: AccountSignalEntry['impactLevel']): React.ElementType {
  switch (impact) {
    case 'critical': return AlertTriangle;
    case 'high':     return AlertCircle;
    case 'medium':   return Info;
    case 'low':      return Activity;
  }
}

// ─── Props ──────────────────────────────────────────────────
export interface SignalTimelineProps {
  /** Signal entries to display */
  signals: AccountSignalEntry[];

  /** Maximum signals to show before "Show more" */
  maxVisible?: number;

  /** Callback when a signal is clicked */
  onSignalClick?: (signal: AccountSignalEntry) => void;

  /** Additional CSS classes */
  className?: string;
}

// ─── Single Signal Entry ───────────────────────────────────
function SignalEntry({
  signal,
  index,
  isExpanded,
  onToggle,
  onClick,
}: {
  signal: AccountSignalEntry;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onClick?: (signal: AccountSignalEntry) => void;
}) {
  const ImpactIcon = getImpactIcon(signal.impactLevel);
  const trustTier = getConfidenceTrustLevel(signal.confidenceScore);
  const trustColor = getTrustColor(trustTier);
  const trustBg = getTrustBg(trustTier);
  const trustBorder = getTrustBorder(trustTier);
  const trustLabel = getTrustLabel(trustTier);
  const footprint = buildEvidenceFootprint(signal.evidence);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: motionTokens.fast.duration,
        ease: motionTokens.fast.ease as unknown as [number, number, number, number],
        delay: index * 0.04,
      }}
    >
      {/* ── Signal Header ── */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-lg transition-colors duration-150 cursor-pointer"
        style={{ background: tokens.surface.card }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = tokens.surface.cardHover;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = tokens.surface.card;
        }}
        onClick={() => {
          onClick?.(signal);
          if (signal.hasEvidenceChain) onToggle();
        }}
      >
        {/* Impact icon */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5"
          style={{
            background: getImpactBg(signal.impactLevel),
            border: `1px solid ${getImpactBorder(signal.impactLevel)}`,
          }}
        >
          <ImpactIcon
            className="w-4 h-4"
            style={{ color: getImpactColor(signal.impactLevel) }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Signal type */}
            <span
              className="font-medium uppercase"
              style={{ fontSize: '9px', letterSpacing: '1px', color: tokens.text.muted }}
            >
              {signal.signalType.replace(/_/g, ' ')}
            </span>

            {/* Impact badge */}
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold"
              style={{
                fontSize: '9px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: getImpactColor(signal.impactLevel),
                backgroundColor: getImpactBg(signal.impactLevel),
                border: `1px solid ${getImpactBorder(signal.impactLevel)}`,
              }}
            >
              {signal.impactLevel}
            </span>
          </div>

          {/* Headline */}
          <h4
            className="font-medium leading-snug"
            style={{ fontSize: '13px', color: tokens.text.primary, lineHeight: 1.4 }}
          >
            {signal.headline}
          </h4>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {/* Freshness */}
            <span
              className="inline-flex items-center gap-1 font-mono"
              style={{ fontSize: '10px', color: tokens.text.muted }}
            >
              <Clock className="w-2.5 h-2.5" />
              {signal.freshnessLabel}
            </span>

            {/* Confidence */}
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold font-mono"
              style={{
                fontSize: '10px',
                color: trustColor,
                backgroundColor: trustBg,
                border: `1px solid ${trustBorder}`,
              }}
            >
              {signal.confidenceScore}% {trustLabel}
            </span>

            {/* Evidence count */}
            {signal.hasEvidenceChain && (
              <span
                className="inline-flex items-center gap-1 font-mono"
                style={{ fontSize: '10px', color: tokens.text.muted }}
              >
                <Shield className="w-2.5 h-2.5" />
                {signal.evidence.length} source{signal.evidence.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Expand arrow */}
        {signal.hasEvidenceChain && (
          <div className="shrink-0 pt-1">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" style={{ color: tokens.text.muted }} />
            ) : (
              <ChevronRight className="w-4 h-4" style={{ color: tokens.text.muted }} />
            )}
          </div>
        )}
      </div>

      {/* ── Expanded Evidence Chain ── */}
      <AnimatePresence>
        {isExpanded && signal.hasEvidenceChain && signal.evidence.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              duration: motionTokens.default.duration,
              ease: motionTokens.default.ease as unknown as [number, number, number, number],
            }}
            className="overflow-hidden"
          >
            <div className="ml-11 mt-1 mb-2">
              <EvidenceChain
                items={signal.evidence}
                title="Signal Evidence"
                footprint={footprint}
                maxVisible={3}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────
export function SignalTimeline({
  signals,
  maxVisible = 6,
  onSignalClick,
  className,
}: SignalTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const visibleSignals = showAll ? signals : signals.slice(0, maxVisible);
  const hasMore = signals.length > maxVisible;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Timeline entries */}
      <div className="space-y-2">
        {visibleSignals.map((signal, i) => (
          <SignalEntry
            key={signal.id}
            signal={signal}
            index={i}
            isExpanded={expandedId === signal.id}
            onToggle={() => setExpandedId(prev => prev === signal.id ? null : signal.id)}
            onClick={onSignalClick}
          />
        ))}
      </div>

      {/* Show More / Show Less */}
      {hasMore && (
        <div
          className="flex items-center justify-center py-2 rounded-lg cursor-pointer transition-colors duration-150"
          style={{ background: tokens.surface.card }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = tokens.surface.cardHover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = tokens.surface.card;
          }}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: tokens.accent.bright }}>
              <ChevronDown className="w-3.5 h-3.5" />
              Show less
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: tokens.accent.bright }}>
              <ChevronRight className="w-3.5 h-3.5" />
              Show {signals.length - maxVisible} more signal{signals.length - maxVisible > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
