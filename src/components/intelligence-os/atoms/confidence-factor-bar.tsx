'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §4 — Confidence Factor Bar (Atom)
   
   Visualizes a single confidence factor as a horizontal bar with
   label, score, and color based on contribution tier.
   
   Used inside ConfidenceBreakdown and ConfidenceTooltip.
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { tokens } from '../design-tokens';
import type { ConfidenceFactor, ConfidenceFactorCategory } from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg } from '@/lib/intelligence-types';

// ─── Category Labels ─────────────────────────────────────────
const CATEGORY_LABELS: Record<ConfidenceFactorCategory, string> = {
  source_quality: 'Source Quality',
  freshness: 'Freshness',
  evidence_strength: 'Evidence Strength',
  signal_convergence: 'Signal Convergence',
  data_completeness: 'Data Completeness',
  conflict_penalty: 'Conflict Penalty',
};

// ─── Props ──────────────────────────────────────────────────
export interface ConfidenceFactorBarProps {
  /** The confidence factor to display */
  factor: ConfidenceFactor;

  /** Show the explanation text */
  showExplanation?: boolean;

  /** Size variant */
  size?: 'sm' | 'md';

  /** Additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────
export function ConfidenceFactorBar({
  factor,
  showExplanation = true,
  size = 'sm',
  className,
}: ConfidenceFactorBarProps) {
  const pct = Math.round((Math.abs(factor.points) / factor.maxPoints) * 100);
  const isNegative = factor.points < 0;
  const color = getTrustColor(factor.tier);
  const bgColor = getTrustBg(factor.tier);

  const barHeight = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const labelSize = size === 'sm' ? 'text-[11px]' : 'text-sm';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className={cn('font-medium', labelSize)} style={{ color: tokens.text.primary }}>
          {factor.label}
        </span>
        <span
          className={cn('font-mono font-semibold tabular-nums', textSize)}
          style={{ color }}
        >
          {isNegative ? '' : '+'}{factor.points}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className={cn('w-full rounded-full overflow-hidden', barHeight)}
        style={{ backgroundColor: tokens.surface.elevated }}
      >
        <div
          className={cn('h-full rounded-full transition-all', barHeight)}
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: isNegative ? tokens.trust.low.value : color,
            opacity: isNegative ? 0.6 : 1,
          }}
        />
      </div>

      {/* Explanation */}
      {showExplanation && factor.explanation && (
        <p className={cn('leading-relaxed', textSize)} style={{ color: tokens.text.secondary }}>
          {factor.explanation}
        </p>
      )}
    </div>
  );
}
