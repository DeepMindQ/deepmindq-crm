'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
/* ═══════════════════════════════════════════════════════════════
   MS9 §2 — Advisor Message Bubble (Atom)
   
   AI assistant message container. Wraps structured briefing content
   with signal pills, trust footer, and optional confidence footer.
   
   This is NOT a generic chat bubble. Every AI message renders as
   an intelligence briefing fragment with evidence grounding.
   
   MS6 Reference: .ai-message + .ai-message-body in reference_ai_advisor.html
   Tokens: surface.card background, border tokens, text hierarchy
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AdvisorAvatar } from './advisor-avatar';
import { SignalPill } from './signal-pill';
import { TrustSourceChip } from './trust-source-chip';
import { ConfidenceFooter } from './confidence-footer';
import type {
  SignalPill as SignalPillType,
  TrustSourceReference,
  ConfidenceFooter as ConfidenceFooterType,
} from '@/types/ms9-advisor';

export interface AdvisorMessageBubbleProps {
  /** AI message content — rendered as structured text (not raw markdown) */
  children: React.ReactNode;
  
  /** Signal pills to display inline */
  signalPills?: SignalPillType[];
  
  /** Trust source references for the trust footer */
  trustSources?: TrustSourceReference[];
  
  /** Confidence footer data */
  confidence?: ConfidenceFooterType;
  
  /** Whether to show the AI badge label */
  showBadge?: boolean;
  
  /** Optional message timestamp */
  timestamp?: string;
  
  /** Optional additional CSS classes */
  className?: string;
}

export function AdvisorMessageBubble({
  children,
  signalPills,
  trustSources,
  confidence,
  showBadge = true,
  timestamp,
  className,
}: AdvisorMessageBubbleProps) {
  return (
    <motion.div
      className={cn('flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300', className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* AI Avatar */}
      <AdvisorAvatar size="md" />

      {/* Message body */}
      <div className="flex-1 min-w-0">
        {/* AI badge */}
        {showBadge && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: tokens.extended.purple.bg,
                color: 'var(--accent-secondary)',
                border: `1px solid ${tokens.extended.purple.border}`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--accent-secondary)' }}
              />
              AI Assistant
            </span>
          </div>
        )}

        {/* AI text content — structured intelligence, not raw markdown */}
        <div
          className="text-[13px] leading-relaxed text-[var(--text-primary)]"
        >
          {children}
        </div>

        {/* Signal pills */}
        {signalPills && signalPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {signalPills.map((pill) => (
              <SignalPill
                key={pill.signalId}
                label={pill.label}
                variant={pill.variant}
              />
            ))}
          </div>
        )}

        {/* Trust footer — source provenance dots + labels */}
        {trustSources && trustSources.length > 0 && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-3',
              'border-t border-[var(--border-default, var(--border))]',
            )}
          >
            {trustSources.map((source, i) => (
              <TrustSourceChip
                key={`${source.sourceName}-${i}`}
                sourceName={source.sourceName}
                trustTier={source.trustTier}
              />
            ))}
          </div>
        )}

        {/* Confidence footer */}
        {confidence && (
          <div className="mt-3">
            <ConfidenceFooter
              score={confidence.score}
              trustTier={confidence.trustTier}
              direction={confidence.direction}
              delta={confidence.delta}
              deltaExplanation={confidence.deltaExplanation}
              hasReasoningChain={confidence.hasReasoningChain}
            />
          </div>
        )}

        {/* Timestamp */}
        {timestamp && (
          <div className="mt-2 text-[10px] text-[var(--text-muted)] font-mono">
            {timestamp}
          </div>
        )}
      </div>
    </motion.div>
  );
}
