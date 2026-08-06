'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §4 — Confidence Breakdown (Organism)
   
   Displays the full confidence breakdown for an intelligence
   conclusion. Shows overall score, tier badge, rationale,
   and individual contributing factors with visual bars.
   
   Answers: "Why should I trust this intelligence?"
   MS6 Pattern #7: Confidence Language & Trust Visualization
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import { Shield, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, elevation } from './design-tokens';
import { ConfidenceFactorBar } from './atoms/confidence-factor-bar';
import type { ConfidenceBreakdown as ConfidenceBreakdownType } from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg, getTrustBorder, getTrustLabel } from '@/lib/intelligence-types';

// ─── Props ──────────────────────────────────────────────────
export interface ConfidenceBreakdownProps {
  /** Confidence breakdown data */
  breakdown: ConfidenceBreakdownType;

  /** Show the rationale text */
  showRationale?: boolean;

  /** Show factor explanations */
  showExplanations?: boolean;

  /** Compact mode: hides explanations, smaller spacing */
  compact?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────
export function ConfidenceBreakdown({
  breakdown,
  showRationale = true,
  showExplanations = true,
  compact = false,
  className,
}: ConfidenceBreakdownProps) {
  const trustColor = getTrustColor(breakdown.overallTier);
  const trustBg = getTrustBg(breakdown.overallTier);
  const trustBorder = getTrustBorder(breakdown.overallTier);
  const trustLabel = getTrustLabel(breakdown.overallTier);

  // Separate positive and negative factors
  const positiveFactors = breakdown.factors.filter(f => f.points > 0).sort((a, b) => b.points - a.points);
  const negativeFactors = breakdown.factors.filter(f => f.points < 0).sort((a, b) => a.points - b.points);

  return (
    <div
      className={cn('rounded-xl border overflow-hidden', className)}
      style={{
        background: tokens.surface.card,
        borderColor: tokens.border.default,
        boxShadow: elevation.rest.shadow,
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" style={{ color: tokens.accent.DEFAULT }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tokens.text.muted }}>
            Confidence Breakdown
          </span>
        </div>

        {/* Overall score + tier */}
        <div className="flex items-center gap-2">
          <span
            className="text-lg font-bold tabular-nums font-mono"
            style={{ color: trustColor }}
          >
            {breakdown.overallScore}
          </span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: trustColor,
              backgroundColor: trustBg,
              border: `1px solid ${trustBorder}`,
            }}
          >
            {trustLabel}
          </span>
        </div>
      </div>

      <div className="px-4 py-3">
        {/* ── Rationale ── */}
        {showRationale && breakdown.rationale && (
          <div className="mb-4">
            <p className="text-xs leading-relaxed" style={{ color: tokens.text.primary }}>
              {breakdown.rationale}
            </p>
          </div>
        )}

        {/* ── Positive Factors ── */}
        {positiveFactors.length > 0 && (
          <div className="flex flex-col gap-3">
            {positiveFactors.map((factor, i) => (
              <motion.div
                key={`pos-${i}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <ConfidenceFactorBar
                  factor={factor}
                  showExplanation={showExplanations && !compact}
                  size={compact ? 'sm' : 'md'}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Negative Factors ── */}
        {negativeFactors.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.trust.low.value }}>
              Reducing Factors
            </p>
            <div className="flex flex-col gap-3">
              {negativeFactors.map((factor, i) => (
                <motion.div
                  key={`neg-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: (positiveFactors.length + i) * 0.05 }}
                >
                  <ConfidenceFactorBar
                    factor={factor}
                    showExplanation={showExplanations && !compact}
                    size={compact ? 'sm' : 'md'}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
