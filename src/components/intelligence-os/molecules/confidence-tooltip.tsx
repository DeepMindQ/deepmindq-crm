'use client';

import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, elevation } from '../design-tokens';
import { ConfidenceFactorBar } from '../atoms/confidence-factor-bar';
import type { ConfidenceBreakdown as ConfidenceBreakdownType } from '@/types/ms8-evidence';
import { getTrustColor, getTrustLabel } from '@/lib/intelligence-types';

/* ═══════════════════════════════════════════════════════════════
   MS8 §4 — Confidence Tooltip (Molecule)
   
   Wraps any element to show a confidence breakdown tooltip on
   hover/focus. Allows any ConfidenceIndicator (ring, bar, badge, score)
   to reveal its breakdown without changing the indicator itself.
   
   Usage:
     <ConfidenceTooltip breakdown={breakdown}>
       <ConfidenceIndicator value={78} mode="ring" />
     </ConfidenceTooltip>
   ═══════════════════════════════════════════════════════════════ */

export interface ConfidenceTooltipProps {
  /** Confidence breakdown data to display */
  breakdown: ConfidenceBreakdownType | null;

  /** The trigger element (usually a ConfidenceIndicator) */
  children: React.ReactNode;

  /** Side of the tooltip */
  side?: 'top' | 'bottom' | 'left' | 'right';

  /** Additional CSS classes */
  className?: string;
}

export function ConfidenceTooltip({
  breakdown,
  children,
  side = 'right',
  className,
}: ConfidenceTooltipProps) {
  if (!breakdown) {
    return <>{children}</>;
  }

  const trustColor = getTrustColor(breakdown.overallTier);
  const trustLabel = getTrustLabel(breakdown.overallTier);

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn('p-0 max-w-[320px] overflow-hidden', className)}
        style={{
          background: tokens.surface.elevated,
          border: `1px solid ${tokens.border.default}`,
          boxShadow: elevation.overlay.shadow,
        }}
      >
        {/* Tooltip header */}
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tokens.text.muted }}>
            Why this score?
          </span>
          <span
            className="text-xs font-bold font-mono tabular-nums"
            style={{ color: trustColor }}
          >
            {breakdown.overallScore} — {trustLabel}
          </span>
        </div>

        {/* Rationale */}
        {breakdown.rationale && (
          <div className="px-3 py-2" style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}>
            <p className="text-[11px] leading-relaxed" style={{ color: tokens.text.secondary }}>
              {breakdown.rationale}
            </p>
          </div>
        )}

        {/* Factors */}
        <div className="px-3 py-2 flex flex-col gap-2 max-h-[200px] overflow-y-auto">
          {breakdown.factors
            .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
            .slice(0, 4) // Show top 4 factors in tooltip
            .map((factor, i) => (
              <ConfidenceFactorBar
                key={i}
                factor={factor}
                showExplanation={false}
                size="sm"
              />
            ))}
        </div>

        {/* Footer hint */}
        {breakdown.factors.length > 4 && (
          <div
            className="px-3 py-1.5"
            style={{ borderTop: `1px solid ${tokens.border.subtle}`, background: tokens.accent.ghost }}
          >
            <span className="text-[9px] font-medium" style={{ color: tokens.text.muted }}>
              +{breakdown.factors.length - 4} more factor{breakdown.factors.length - 4 > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
