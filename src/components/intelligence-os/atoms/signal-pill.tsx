'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §2 — Signal Pill (Atom)
   
   Inline signal representation within AI advisor briefings.
   Maps to MS7 IntelligenceSignal in compact pill form.
   
   MS6 Reference: .signal-pill.blue / .purple / .cyan in reference_ai_advisor.html
   Tokens: All colors from design-tokens.ts domain system
   ═══════════════════════════════════════════════════════════════ */

import { TrendingUp, UserCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SignalPillVariant } from '@/types/ms9-advisor';

export interface SignalPillProps {
  /** Display label (e.g., "Revenue Acceleration — 23% YoY") */
  label: string;
  
  /** Visual variant — determines color treatment */
  variant: SignalPillVariant;
  
  /** Optional click handler */
  onClick?: () => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

// Variant → token color mapping (from design-tokens.ts)
const variantStyles: Record<SignalPillVariant, { bg: string; border: string; text: string; icon: string }> = {
  blue: {
    bg: 'rgba(59, 130, 246, 0.08)',
    border: 'rgba(59, 130, 246, 0.2)',
    text: 'var(--accent)',
    icon: 'var(--accent)',
  },
  purple: {
    bg: 'rgba(139, 92, 246, 0.08)',
    border: 'rgba(139, 92, 246, 0.2)',
    text: 'var(--accent-secondary)',
    icon: 'var(--accent-secondary)',
  },
  cyan: {
    bg: 'rgba(6, 182, 212, 0.08)',
    border: 'rgba(6, 182, 212, 0.2)',
    text: 'var(--enrichment-cyan)',
    icon: 'var(--enrichment-cyan)',
  },
  green: {
    bg: 'rgba(34, 197, 94, 0.08)',
    border: 'rgba(34, 197, 94, 0.2)',
    text: 'var(--trust-verified)',
    icon: 'var(--trust-verified)',
  },
  amber: {
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.2)',
    text: 'var(--warning-amber)',
    icon: 'var(--warning-amber)',
  },
  red: {
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.2)',
    text: 'var(--risk-red)',
    icon: 'var(--risk-red)',
  },
};

const variantIcons: Record<SignalPillVariant, React.ElementType> = {
  blue: TrendingUp,
  purple: UserCheck,
  cyan: Clock,
  green: TrendingUp,
  amber: Clock,
  red: TrendingUp,
};

export function SignalPill({ label, variant, onClick, className }: SignalPillProps) {
  const styles = variantStyles[variant];
  const Icon = variantIcons[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
        'text-[11px] font-medium leading-tight',
        'transition-colors duration-150',
        'cursor-default',
        onClick && 'cursor-pointer hover:brightness-125',
        className,
      )}
      style={{
        backgroundColor: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.text,
      }}
    >
      <Icon className="w-3 h-3 shrink-0" strokeWidth={1.5} strokeLinecap="round" />
      <span>{label}</span>
    </button>
  );
}
