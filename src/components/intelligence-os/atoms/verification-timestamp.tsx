'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §2 — Verification Timestamp (Atom)
   
   Displays a verification timestamp with method indicator and
   human-readable relative time. Used inside evidence items,
   verification badges, and account trust panels.
   
   All tokens from design-tokens.ts. No hardcoded values.
   ═══════════════════════════════════════════════════════════════ */

import { Clock, ShieldCheck, Bot, GitCompare, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { tokens } from '../design-tokens';
import type { VerificationStatus } from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg } from '@/lib/intelligence-types';
import type { TrustLevel } from '@/lib/intelligence-types';
import { formatFreshness } from '@/lib/intelligence-types';

// ─── Method Config ─────────────────────────────────────────
const METHOD_CONFIG: Record<VerificationStatus['method'], {
  icon: React.ElementType;
  label: string;
  trustLevel: TrustLevel;
}> = {
  human_review:    { icon: ShieldCheck, label: 'Human Verified', trustLevel: 'verified' },
  automated_check: { icon: Bot,         label: 'Auto-Checked',   trustLevel: 'high' },
  cross_reference:  { icon: GitCompare,  label: 'Cross-Referenced', trustLevel: 'high' },
  not_verified:    { icon: HelpCircle,  label: 'Not Verified',    trustLevel: 'unverified' },
};

// ─── Props ──────────────────────────────────────────────────
export interface VerificationTimestampProps {
  /** Verification status data */
  verification: VerificationStatus;

  /** Show the verifier name */
  showVerifier?: boolean;

  /** Show the verification method icon */
  showMethodIcon?: boolean;

  /** Timestamp display format */
  format?: 'relative' | 'absolute';

  /** Size variant */
  size?: 'xs' | 'sm' | 'md';

  /** Additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────
export function VerificationTimestamp({
  verification,
  showVerifier = false,
  showMethodIcon = true,
  format = 'relative',
  size = 'sm',
  className,
}: VerificationTimestampProps) {
  const config = METHOD_CONFIG[verification.method];
  const Icon = config.icon;
  const trustColor = getTrustColor(config.trustLevel);
  const trustBg = getTrustBg(config.trustLevel);

  const sizeClasses = {
    xs: { icon: 'w-2.5 h-2.5', text: 'text-[9px]', gap: 'gap-1' },
    sm: { icon: 'w-3 h-3',     text: 'text-[10px]', gap: 'gap-1.5' },
    md: { icon: 'w-3.5 h-3.5', text: 'text-[11px]', gap: 'gap-2' },
  }[size];

  // Determine display timestamp
  const displayTimestamp = verification.verifiedAt
    ? format === 'relative'
      ? formatFreshness(verification.verifiedAt)
      : new Date(verification.verifiedAt).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
    : null;

  const absoluteTimestamp = verification.verifiedAt
    ? new Date(verification.verifiedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('inline-flex items-center', sizeClasses.gap, className)}
          style={{ color: tokens.text.muted }}
        >
          {showMethodIcon && (
            <Icon className={sizeClasses.icon} style={{ color: trustColor }} />
          )}
          {displayTimestamp && (
            <span className={cn('font-mono font-medium', sizeClasses.text)}>
              {displayTimestamp}
            </span>
          )}
          {showVerifier && verification.verifiedBy && (
            <span
              className={cn('font-sans', sizeClasses.text)}
              style={{ color: tokens.text.secondary }}
            >
              by {verification.verifiedBy}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[280px]">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{config.label}</span>
          {absoluteTimestamp && (
            <span className="opacity-80">{absoluteTimestamp}</span>
          )}
          {verification.notes && (
            <span className="opacity-60 italic">&ldquo;{verification.notes}&rdquo;</span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
