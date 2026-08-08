'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §6 — Human Assistance Banner (Molecule)
   
   Non-intrusive escalation banner that appears when AI confidence
   drops below threshold or conflicting evidence is detected.
   Provides a clear entry point for human expert review.
   
   This is NOT a generic notification. It is an intelligence
   escalation trigger grounded in evidence quality metrics.
   
   MS6 Reference: trust warning indicators, risk alert patterns
   Tokens: domain.risk, trust tier colors, priority colors
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../design-tokens';
import type { HumanAssistanceEntry } from '@/types/ms9-advisor';

export interface HumanAssistanceBannerProps {
  /** Active human assistance entry to display */
  entry: HumanAssistanceEntry;
  
  /** Callback when user clicks "Request Human Review" */
  onEscalate?: (entryId: string) => void;
  
  /** Callback when user dismisses the banner */
  onDismiss?: (entryId: string) => void;
  
  /** Whether the banner is visible */
  visible?: boolean;
  
  /** Optional additional CSS classes */
  className?: string;
}

/** Reason → display config mapping using individual string fields */
const reasonConfig: Record<HumanAssistanceEntry['reason'], {
  icon: string;
  label: string;
  description: string;
  bg: string;
  border: string;
  value: string;
}> = {
  low_confidence: {
    icon: 'shield-alert',
    label: 'Low Confidence',
    description: 'AI confidence is below the reliable threshold. Human review recommended.',
    bg: tokens.priority.medium.bg,
    border: tokens.priority.medium.border,
    value: tokens.priority.medium.value,
  },
  conflicting_evidence: {
    icon: 'split',
    label: 'Conflicting Evidence',
    description: 'Multiple sources present contradictory signals. Expert analysis needed.',
    bg: tokens.priority.high.bg,
    border: tokens.priority.high.border,
    value: tokens.priority.high.value,
  },
  complex_analysis: {
    icon: 'layers',
    label: 'Complex Analysis',
    description: 'This intelligence requires multi-dimensional human interpretation.',
    bg: tokens.priority.medium.bg,
    border: tokens.priority.medium.border,
    value: tokens.priority.medium.value,
  },
  data_gap: {
    icon: 'database-off',
    label: 'Data Gap',
    description: 'Key intelligence data is missing or outdated. Human verification needed.',
    bg: tokens.priority.high.bg,
    border: tokens.priority.high.border,
    value: tokens.priority.high.value,
  },
  user_request: {
    icon: 'user-check',
    label: 'User Requested',
    description: 'You requested human expert review for this intelligence.',
    bg: tokens.priority.low.bg,
    border: tokens.priority.low.border,
    value: tokens.priority.low.value,
  },
};

function ReasonIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'shield-alert':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M8 1 L2 4 L2 8 C2 12 5 15 8 15 C11 15 14 12 14 8 L14 4 Z" />
          <path d="M8 6 L8 9" />
          <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
        </svg>
      );
    case 'split':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M8 1 L8 15" />
          <path d="M4 4 L8 1 L12 4" />
          <path d="M4 12 L8 15 L12 12" />
        </svg>
      );
    case 'layers':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M2 5 L8 2 L14 5 L8 8 Z" />
          <path d="M2 8 L8 11 L14 8" />
          <path d="M2 11 L8 14 L14 11" />
        </svg>
      );
    case 'database-off':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <ellipse cx="8" cy="4" rx="5" ry="2" />
          <path d="M3 4 L3 10 C3 11.1 5.2 12 8 12 C10.8 12 13 11.1 13 10 L13 4" />
          <path d="M2 14 L14 2" />
        </svg>
      );
    case 'user-check':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <circle cx="6" cy="5" r="2.5" />
          <path d="M1 14 C1 11 3.5 9 6 9" />
          <path d="M10 7 L12 9 L15 4" />
        </svg>
      );
    default:
      return null;
  }
}

export function HumanAssistanceBanner({
  entry,
  onEscalate,
  onDismiss,
  visible = true,
  className,
}: HumanAssistanceBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const config = reasonConfig[entry.reason];

  if (!visible || dismissed) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg',
        className,
      )}
      style={{
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      {/* Reason icon */}
      <div
        className="flex-shrink-0 mt-0.5"
        style={{ color: config.value }}
      >
        <ReasonIcon icon={config.icon} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{
              color: config.value,
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {config.label}
          </span>
          <span
            className="text-[10px] font-mono"
            style={{ color: tokens.text.muted }}
          >
            {entry.priority}
          </span>
        </div>
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: tokens.text.secondary }}
        >
          {config.description}
        </p>

        {/* Context snapshot */}
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] font-mono"
          style={{ color: tokens.text.muted }}
        >
          {entry.contextSnapshot.accountName && (
            <span>Account: {entry.contextSnapshot.accountName}</span>
          )}
          <span>Confidence: {entry.contextSnapshot.confidenceScore}%</span>
          <span>Evidence: {entry.contextSnapshot.evidenceCount} items</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2.5">
          <button
            onClick={() => onEscalate?.(entry.id)}
            className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer"
            style={{
              backgroundColor: config.value,
              color: tokens.text.inverse,
            }}
          >
            Request Human Review
          </button>
          <button
            onClick={() => {
              setDismissed(true);
              onDismiss?.(entry.id);
            }}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer"
            style={{
              backgroundColor: 'transparent',
              border: `1px solid ${config.border}`,
              color: tokens.text.secondary,
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
