'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
/* ═══════════════════════════════════════════════════════════════
   MS9 §2 — Trust Source Chip (Atom)
   
   Inline source provenance shown in the trust footer of AI messages.
   Color-coded dot + source name + trust tier label.
   
   MS6 Reference: .trust-source + .trust-source-dot in reference_ai_advisor.html
   Tokens: Trust tier colors from design-tokens.ts trust system
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import type { TrustTier } from '@/types/ms9-advisor';

export interface TrustSourceChipProps {
  /** Human-readable source name (e.g., "SEC Filing", "LinkedIn") */
  sourceName: string;
  
  /** Trust tier — determines dot color and label */
  trustTier: TrustTier;
  
  /** Optional trust tier label override */
  trustLabel?: string;
  
  /** Optional click handler for deep-linking to evidence */
  onClick?: () => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

// Trust tier → dot color (from design-tokens.ts trust scale)
const trustDotColors: Record<TrustTier, string> = {
  verified: 'var(--trust-verified)',
  high: 'var(--trust-high)',
  medium: 'var(--trust-medium)',
  low: 'var(--trust-low)',
  unverified: 'var(--trust-unverified)',
};

const trustLabels: Record<TrustTier, string> = {
  verified: 'Verified',
  high: 'High Confidence',
  medium: 'Medium Confidence',
  low: 'Low Confidence',
  unverified: 'Unverified',
};

export function TrustSourceChip({
  sourceName,
  trustTier,
  trustLabel,
  onClick,
  className,
}: TrustSourceChipProps) {
  const label = trustLabel ?? `${sourceName} (${trustLabels[trustTier]})`;

  return (
    <span
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1',
        'text-[11px] font-medium text-[var(--text-secondary)]',
        'transition-colors duration-150',
        onClick && 'cursor-pointer hover:text-[var(--text-primary)]',
        className,
      )}
      title={label}
    >
      {/* Trust tier dot */}
      <span
        className="w-[6px] h-[6px] rounded-full shrink-0"
        style={{ backgroundColor: trustDotColors[trustTier] }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
