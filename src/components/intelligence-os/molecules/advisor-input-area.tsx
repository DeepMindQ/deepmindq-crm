'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §3 — Advisor Input Area (Molecule)
   
   Intelligence briefing query input. Not a generic chat input —
   the placeholder and helper text reinforce structured briefings.
   Supports keyboard submission (Enter to send).
   
   MS6 Reference: .input-area + .input-wrapper + .input-field + .send-btn
   Tokens: surface.elevated bg, border.default, accent focus ring
   ═══════════════════════════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AdvisorInputAreaProps {
  /** Callback when user submits a query */
  onSubmit: (query: string) => void;
  
  /** Whether the advisor is currently processing (disables input) */
  isProcessing?: boolean;
  
  /** Placeholder text override */
  placeholder?: string;
  
  /** Optional additional CSS classes */
  className?: string;
}

export function AdvisorInputArea({
  onSubmit,
  isProcessing = false,
  placeholder = 'Ask about any account, market, or intelligence signal...',
  className,
}: AdvisorInputAreaProps) {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) return;
    onSubmit(trimmed);
    setValue('');
  }, [value, isProcessing, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div
      className={cn('px-8 pb-5 pt-4 border-t', className)}
      style={{
        backgroundColor: 'var(--surface-base, var(--bg))',
        borderColor: 'var(--border-default, var(--border))',
      }}
    >
      {/* Input wrapper */}
      <div
        className={cn(
          'flex items-center gap-2.5 pl-4 pr-1.5 py-1.5 rounded-xl',
          'border transition-colors duration-200',
        )}
        style={{
          backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
          borderColor: 'var(--border-default, var(--border))',
        }}
        onFocusCapture={(e) => {
          const wrapper = e.currentTarget;
          wrapper.style.borderColor = 'var(--accent)';
          wrapper.style.boxShadow = `0 0 0 3px ${tokens.accent.subtle}`;
        }}
        onBlurCapture={(e) => {
          const wrapper = e.currentTarget;
          wrapper.style.borderColor = 'var(--border-default, var(--border))';
          wrapper.style.boxShadow = 'none';
        }}
      >
        {/* Text input */}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none py-2"
          aria-label="Intelligence query"
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() || isProcessing}
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg shrink-0',
            'transition-colors duration-150',
            value.trim() && !isProcessing ? 'text-white cursor-pointer' : 'text-[var(--text-muted)] cursor-not-allowed opacity-50',
          )}
          style={{
            backgroundColor: value.trim() && !isProcessing ? 'var(--accent)' : 'transparent',
          }}
          aria-label="Send query"
        >
          <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </button>
      </div>

      {/* Helper text */}
      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--text-muted)]">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="13" height="13" className="opacity-50">
          <circle cx="7" cy="7" r="6" />
          <path d="M7 5 L7 7.5 L9 8.5" />
        </svg>
        <span>The AI provides structured briefings with confidence scores. All information requires your judgment.</span>
      </div>
    </div>
  );
}
