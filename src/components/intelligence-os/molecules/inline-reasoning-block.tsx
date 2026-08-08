'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §3 — Inline Reasoning Block (Molecule)
   
   Expandable reasoning chain within an AI advisor message.
   Shows AI reasoning steps with source attribution and
   per-step confidence. Progressive disclosure: collapsed by default.
   
   MS6 Reference: .inline-reasoning + .reasoning-toggle + .reasoning-content
   Tokens: surface.elevated bg, border.default, text.secondary
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { InlineReasoning } from '@/types/ms9-advisor';

export interface InlineReasoningBlockProps {
  /** Inline reasoning data */
  reasoning: InlineReasoning;
  
  /** Optional additional CSS classes */
  className?: string;
}

export function InlineReasoningBlock({ reasoning, className }: InlineReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(reasoning.defaultExpanded);

  return (
    <div
      className={cn('mt-3 overflow-hidden', className)}
      style={{
        border: '1px solid var(--border-default, var(--border))',
        borderRadius: '8px',
        backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
      }}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 w-full px-3.5 py-2.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150"
        aria-expanded={isExpanded}
      >
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </motion.span>
        {isExpanded ? 'Hide reasoning chain' : reasoning.toggleLabel}
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {/* Reasoning narrative */}
              <p className="mb-3">{reasoning.content}</p>

              {/* Structured reasoning steps */}
              {reasoning.steps && reasoning.steps.length > 0 && (
                <div className="flex flex-col gap-2">
                  {reasoning.steps.map((step, i) => (
                    <div
                      key={step.claim + '-' + i}
                      className="pl-3 border-l-2"
                      style={{ borderColor: 'var(--border-hover, var(--border-light))' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-[var(--text-primary)]">
                          {step.claim}
                        </p>
                        <span className="shrink-0 text-[10px] font-mono text-[var(--text-muted)]">
                          {step.stepConfidence}%
                        </span>
                      </div>
                      <p className="mt-0.5">{step.supportingEvidence}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                        Source: {step.source}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Source count */}
              <div className="mt-2 text-[10px] font-mono text-[var(--text-muted)]">
                {reasoning.sourceCount} source{reasoning.sourceCount !== 1 ? 's' : ''} referenced
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
