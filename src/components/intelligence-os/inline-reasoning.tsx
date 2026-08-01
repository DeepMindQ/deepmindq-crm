'use client';

import { motion } from 'framer-motion';
import {
  TrendingUp, AlertTriangle, ChevronRight, Brain,
} from 'lucide-react';
import { tokens, motion as motionTokens } from './design-tokens';

/* ═══════════════════════════════════════════════════════════════
   InlineReasoning — L2 Progressive Disclosure Reasoning
   
   NEW COMPONENT — Phase 1B. Replaces duplicate reasoning display
   in progressive-disclosure.tsx (L221-259) and inline reasoning
   in command-center.tsx HeroNarrative (L269-304).
   
   Design Intent: A unified, reusable L2 reasoning surface that
   shows "Why does the system think this?" directly within the
   intelligence narrative. No navigation required.
   
   Displays:
   - Primary reasoning statement (from synthesis engine)
   - Positive confidence factors (green tags)
   - Negative confidence factors (amber tags)
   - "See full evidence" link to L3
   
   Intelligence Flow:
     IntelligenceNarrativeService.reasoning → synthesis of
       GroundingEngine evidence + confidence factors
         → InlineReasoning display
   
   UX DNA Compliance:
     ✅ Intelligence First — Reasoning visible without click
     ✅ Reasoning Transparency — "Why?" directly visible
     ✅ Evidence Visibility — Link to L3 evidence chain
     ✅ Confidence Layer — Factor indicators colored by impact
     ✅ Action Orientation — "See full evidence" terminates in action
     ✅ Context Preservation — Inline, no context lost
   ═══════════════════════════════════════════════════════════════ */

export interface InlineReasoningProps {
  /** Primary reasoning statement from synthesis engine */
  reasoning?: string;
  /** Positive confidence factors boosting the score */
  positiveFactors?: string[];
  /** Negative confidence factors reducing the score */
  negativeFactors?: string[];
  /** Callback to expand to L3 evidence view */
  onClickExpand?: () => void;
  /** Compact mode — no reasoning text, only factors */
  compact?: boolean;
  /** Show "See full evidence" link */
  showExpandLink?: boolean;
}

export function InlineReasoning({
  reasoning,
  positiveFactors = [],
  negativeFactors = [],
  onClickExpand,
  compact = false,
  showExpandLink = true,
}: InlineReasoningProps) {
  const hasContent = reasoning || positiveFactors.length > 0 || negativeFactors.length > 0;

  if (!hasContent) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...motionTokens.fast }}
      className="px-5 py-3"
      style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
    >
      {/* Reasoning statement */}
      {!compact && reasoning && (
        <p
          className="text-sm italic leading-relaxed mb-2"
          style={{ color: tokens.text.secondary }}
        >
          {reasoning}
        </p>
      )}

      {/* Confidence Factor Bar — visual "Why?" breakdown */}
      {(positiveFactors.length > 0 || negativeFactors.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1"
            style={{ color: tokens.text.muted }}
          >
            <Brain className="w-3 h-3" />
            Why:
          </span>

          {/* Positive factors — boosting confidence */}
          {positiveFactors.map((factor, i) => (
            <FactorTag
              key={`pos-${i}`}
              label={factor}
              type="positive"
            />
          ))}

          {/* Negative factors — reducing confidence */}
          {negativeFactors.map((factor, i) => (
            <FactorTag
              key={`neg-${i}`}
              label={factor}
              type="negative"
            />
          ))}
        </div>
      )}

      {/* Expand link to L3 evidence */}
      {showExpandLink && onClickExpand && (
        <button
          onClick={onClickExpand}
          className="mt-2 flex items-center gap-1 text-[10px] font-semibold transition-colors"
          style={{ color: tokens.accent.bright }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          See full evidence
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Factor Tag — Visual confidence factor indicator
   ═══════════════════════════════════════════════════════════════ */

function FactorTag({
  label,
  type,
}: {
  label: string;
  type: 'positive' | 'negative';
}) {
  const config = type === 'positive'
    ? { color: tokens.confidence.high.value, bg: tokens.confidence.high.bg, Icon: TrendingUp }
    : { color: tokens.confidence.medium.value, bg: tokens.confidence.medium.bg, Icon: AlertTriangle };

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
      style={{ color: config.color, background: config.bg }}
    >
      <config.Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
