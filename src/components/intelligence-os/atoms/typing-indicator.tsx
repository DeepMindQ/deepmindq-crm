'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §2 — Typing Indicator (Atom)
   
   Animated three-dot typing indicator shown while the AI advisor
   is processing a response. Includes a processing state label.
   Uses framer-motion for animation (project-standard approach).
   
   MS6 Reference: .typing-indicator + .typing-dots + .typing-label
   Tokens: surface.card background, accent-secondary for dots
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AdvisorProcessingState } from '@/types/ms9-advisor';

export interface TypingIndicatorProps {
  /** Current processing state — determines the label text */
  state: AdvisorProcessingState;
  
  /** Custom label override */
  label?: string;
  
  /** Optional additional CSS classes */
  className?: string;
}

/** Processing state → human-readable label */
const stateLabels: Record<AdvisorProcessingState, string> = {
  idle: 'Ready',
  retrieving: 'Retrieving intelligence...',
  analyzing: 'Analyzing evidence...',
  generating: 'Generating briefing...',
  grounding: 'Cross-referencing sources...',
  streaming: 'Delivering response...',
  waiting_input: 'Awaiting your question...',
};

/** Bounce animation for individual dots — matches reference prototype timing */
const dotVariants = {
  initial: { opacity: 0.3, y: 0 },
  animate: { opacity: 1, y: -4 },
};

export function TypingIndicator({ state, label, className }: TypingIndicatorProps) {
  const displayLabel = label ?? stateLabels[state];

  return (
    <div
      className={cn('flex items-center gap-3 px-1', className)}
      role="status"
      aria-label={displayLabel}
    >
      {/* Animated dots container */}
      <div
        className="flex items-center gap-1 px-3 py-2 rounded-2xl"
        style={{
          backgroundColor: 'var(--surface-card, var(--bg-card))',
          border: '1px solid var(--border-default, var(--border))',
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-[7px] h-[7px] rounded-full"
            style={{ backgroundColor: 'var(--accent-secondary)' }}
            variants={dotVariants}
            initial="initial"
            animate="animate"
            transition={{
              duration: 0.6,
              repeat: Infinity,
              repeatType: 'reverse',
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* State label */}
      <span className="text-[11px] font-mono text-[var(--text-secondary)]">
        {displayLabel}
      </span>
    </div>
  );
}
