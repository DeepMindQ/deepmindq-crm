'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §2 — Confidence Footer (Atom)
   
   Per-message confidence display with delta tracking.
   Shows confidence score, direction change, and optional delta
   explanation. Supports inline reasoning expansion trigger.
   
   MS6 Reference: .confidence-footer in reference_ai_advisor.html
   Tokens: Accent-secondary border/bg, warning-amber for score
   ═══════════════════════════════════════════════════════════════ */

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConfidenceDirection, TrustTier } from '@/types/ms9-advisor';
import { tokens } from '../design-tokens';

export interface ConfidenceFooterProps {
  /** Confidence score 0-100 */
  score: number;
  
  /** Trust tier derived from score */
  trustTier: TrustTier;
  
  /** Direction relative to previous response */
  direction: ConfidenceDirection;
  
  /** Delta value (e.g., -6 for a drop from 78 to 72) */
  delta: number | null;
  
  /** Human-readable explanation for the delta change */
  deltaExplanation: string | null;
  
  /** Whether inline reasoning is expandable from this footer */
  hasReasoningChain?: boolean;
  
  /** Optional additional CSS classes */
  className?: string;
}

export function ConfidenceFooter({
  score,
  trustTier,
  direction,
  delta,
  deltaExplanation,
  hasReasoningChain = false,
  className,
}: ConfidenceFooterProps) {
  // Score color from trust tokens
  const trustToken = tokens.trust[trustTier];
  const scoreColor = trustToken.value;

  // Delta indicator
  const deltaLabel = delta !== null
    ? delta > 0
      ? `+${delta}`
      : `${delta}`
    : null;

  const deltaColor = direction === 'up'
    ? 'var(--trust-verified)'
    : direction === 'down'
      ? 'var(--risk-red)'
      : 'var(--text-muted)';

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'text-[11px] font-mono text-[var(--text-secondary)]',
        className,
      )}
      style={{
        backgroundColor: tokens.extended.purple.bgSubtle,
        border: `1px solid ${tokens.extended.purple.border}`,
      }}
      role="status"
      aria-label={`Confidence: ${score}%`}
    >
      {/* Confidence clock icon */}
      <Clock
        className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* Confidence label */}
      <span>
        {'Confidence: '}
        <span className="font-semibold" style={{ color: scoreColor }}>
          {score}%
        </span>
      </span>

      {/* Delta indicator */}
      {deltaLabel && (
        <span className="text-[10px]" style={{ color: deltaColor }}>
          {'('}
          {direction === 'up' && 'up'}
          {direction === 'down' && 'down'}
          {direction === 'stable' && 'stable'}
          {delta !== null && delta !== 0 && ` from ${score - delta}`}
          {deltaExplanation && ` — ${deltaExplanation}`}
          {')'}
        </span>
      )}

      {/* Reasoning chain indicator */}
      {hasReasoningChain && (
        <span className="ml-auto text-[10px] text-[var(--text-muted)]">
          Expand reasoning →
        </span>
      )}
    </div>
  );
}
