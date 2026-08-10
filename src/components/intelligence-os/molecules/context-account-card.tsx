'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §4 — Context Account Card (Molecule)
   
   Primary account context card in the advisor sidebar.
   Shows company identity, key fields with verification badges,
   and a trust score progress bar.
   
   MS6 Reference: .context-card + .context-card-header + .context-field-list + .trust-score-bar
   Tokens: surface.card bg, border.default, accent icon, trust tier colors
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { tokens } from '../design-tokens';
import type { ContextAccountCard as ContextAccountCardType } from '@/types/ms9-advisor';

export interface ContextAccountCardProps {
  /** Account card data */
  data: ContextAccountCardType;
  
  /** Optional click handler to navigate to full account view */
  onClick?: () => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

/** Verification status → badge styling */
const verificationStyles: Record<string, { bg: string; text: string }> = {
  verified: {
    bg: tokens.trust.verified.bg,
    text: 'var(--trust-verified)',
  },
  estimated: {
    bg: tokens.neutral.bg,
    text: 'var(--text-secondary)',
  },
  unknown: {
    bg: tokens.trust.unverified.bg,
    text: 'var(--text-muted)',
  },
};

export function ContextAccountCard({ data, onClick, className }: ContextAccountCardProps) {
  // Trust score bar fill percentage
  const fillPercent = Math.min(100, Math.max(0, (data.trustScore.score / data.trustScore.maxScore) * 100));
  // Trust tier color for the bar
  const trustToken = tokens.trust[data.trustScore.tier];

  return (
    <div
      className={cn(
        'rounded-xl p-5',
        onClick && 'cursor-pointer',
        className,
      )}
      style={{
        backgroundColor: 'var(--surface-card, var(--bg-card))',
        border: '1px solid var(--border-default, var(--border))',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
    >
      {/* Card header — icon + label + company name */}
      <div className="flex items-center gap-2.5 mb-4">
        {/* Card icon — accent glow box */}
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{
            backgroundColor: tokens.accent.subtle,
            border: `1px solid ${tokens.accent.subtle}`,
          }}
        >
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ color: 'var(--accent)' }}>
            <rect x="2" y="3" width="14" height="12" rx="2" />
            <path d="M6 7 L6 11" />
            <path d="M9 6 L9 11" />
            <path d="M12 8 L12 11" />
          </svg>
        </div>

        <div>
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)' }}
          >
            Active Account
          </div>
          <div className="text-[14px] font-bold text-[var(--text-primary)]">
            {data.companyName}
          </div>
        </div>
      </div>

      {/* Field list — key account data with verification badges */}
      <div className="flex flex-col gap-2.5">
        {data.fields.map((field) => {
          const badge = verificationStyles[field.verificationStatus] ?? verificationStyles.unknown;
          return (
            <div key={field.label} className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--text-secondary)]">{field.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--text-primary)]">{field.value}</span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: badge.bg,
                    color: badge.text,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {field.verificationStatus}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust score bar */}
      <div className="mt-4">
        <div className="flex items-center text-[13px] mb-1.5">
          <span className="text-[var(--text-secondary)]">Trust Score</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Track */}
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--surface-elevated, var(--bg-surface))' }}
          >
            <div
              className="h-full rounded-full transition-all duration-600"
              style={{
                width: `${fillPercent}%`,
                background: `linear-gradient(90deg, ${trustToken.value}, ${tokens.trust.verified.value})`,
              }}
            />
          </div>
          {/* Label */}
          <span
            className="text-[12px] font-semibold whitespace-nowrap"
            style={{
              color: trustToken.value,
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {data.trustScore.score}/{data.trustScore.maxScore} — {trustToken.label}
          </span>
        </div>
      </div>
    </div>
  );
}
