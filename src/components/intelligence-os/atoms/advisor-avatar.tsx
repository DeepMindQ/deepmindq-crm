'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §2 — Advisor Avatar (Atom)
   
   AI assistant avatar shown on every AI message bubble.
   Uses the Intelligence OS building icon (from reference_ai_advisor.html).
   Gradient background matching the DeepMindQ brand mark.
   
   MS6 Reference: .ai-message-avatar in reference_ai_advisor.html
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';

export interface AdvisorAvatarProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  
  /** Optional additional CSS classes */
  className?: string;
}

const sizeMap = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
} as const;

const iconSizeMap = {
  sm: 12,
  md: 14,
  lg: 18,
} as const;

export function AdvisorAvatar({ size = 'md', className }: AdvisorAvatarProps) {
  const iconSize = iconSizeMap[size];

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg shrink-0',
        'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)]',
        'shadow-[0_0_8px_rgba(59,130,246,0.2)]',
        sizeMap[size],
        className,
      )}
      aria-label="AI Advisor"
      role="img"
    >
      {/* Intelligence OS building icon — from reference_ai_advisor.html */}
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        width={iconSize}
        height={iconSize}
      >
        <path d="M8 1 L3 6 L3 14 L13 14 L13 6 Z" />
        <rect x="6" y="9" width="4" height="5" rx="0.5" />
      </svg>
    </div>
  );
}
