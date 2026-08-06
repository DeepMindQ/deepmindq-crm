'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §2 — Verification Status Badge (Atom)
   
   Shows verification status of intelligence/evidence items.
   Distinguishes between human-verified, automated checks,
   cross-referenced, and unverified content.
   
   Uses MS6 trust tier colors for visual consistency.
   ═══════════════════════════════════════════════════════════════ */

import { ShieldCheck, Bot, GitCompare, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { VerificationStatus } from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg, getTrustBorder } from '@/lib/intelligence-types';
import type { TrustLevel } from '@/lib/intelligence-types';

// ─── Verification Method Config ─────────────────────────────
const METHOD_CONFIG: Record<VerificationStatus['method'], {
  icon: React.ElementType;
  label: string;
  trustLevel: TrustLevel;
  description: string;
}> = {
  human_review: {
    icon: ShieldCheck,
    label: 'Human Verified',
    trustLevel: 'verified',
    description: 'Verified by a team member through direct review',
  },
  automated_check: {
    icon: Bot,
    label: 'Auto-Verified',
    trustLevel: 'high',
    description: 'Automated cross-check against authoritative sources',
  },
  cross_reference: {
    icon: GitCompare,
    label: 'Cross-Referenced',
    trustLevel: 'high',
    description: 'Confirmed by multiple independent sources',
  },
  not_verified: {
    icon: HelpCircle,
    label: 'Not Verified',
    trustLevel: 'unverified',
    description: 'Not yet verified — treat as provisional',
  },
};

// ─── Props ──────────────────────────────────────────────────
export interface VerificationBadgeProps {
  /** Verification status data */
  verification: VerificationStatus;

  /** Show the verifier name */
  showVerifier?: boolean;

  /** Show verification timestamp */
  showTimestamp?: boolean;

  /** Size variant */
  size?: 'xs' | 'sm' | 'md';

  /** Additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────
export function VerificationBadge({
  verification,
  showVerifier = false,
  showTimestamp = false,
  size = 'sm',
  className,
}: VerificationBadgeProps) {
  const config = METHOD_CONFIG[verification.method];
  const Icon = config.icon;
  const trustColor = getTrustColor(config.trustLevel);
  const trustBg = getTrustBg(config.trustLevel);
  const trustBorder = getTrustBorder(config.trustLevel);

  const sizeClasses = {
    xs: { icon: 'w-3 h-3', text: 'text-[9px]', badge: 'px-1.5 py-0.5 gap-1' },
    sm: { icon: 'w-3.5 h-3.5', text: 'text-[10px]', badge: 'px-2 py-0.5 gap-1.5' },
    md: { icon: 'w-4 h-4', text: 'text-[11px]', badge: 'px-2.5 py-1 gap-1.5' },
  }[size];

  const formattedDate = verification.verifiedAt
    ? new Date(verification.verifiedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center rounded-full font-medium',
            sizeClasses.badge,
            className,
          )}
          style={{
            color: trustColor,
            backgroundColor: trustBg,
            border: `1px solid ${trustBorder}`,
          }}
        >
          <Icon className={sizeClasses.icon} />
          <span className={cn('font-sans', sizeClasses.text)}>{config.label}</span>
          {showVerifier && verification.verifiedBy && (
            <span className={cn('opacity-70 font-mono', sizeClasses.text)}>
              by {verification.verifiedBy}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[280px]">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{config.label}</span>
          <span className="opacity-80">{config.description}</span>
          {showTimestamp && formattedDate && (
            <span className="opacity-60">Verified: {formattedDate}</span>
          )}
          {verification.notes && (
            <span className="opacity-60 italic mt-0.5">&ldquo;{verification.notes}&rdquo;</span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
