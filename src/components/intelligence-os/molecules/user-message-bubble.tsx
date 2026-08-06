'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §3 — User Message Bubble (Molecule)
   
   Right-aligned user query bubble. Minimal — just the text content.
   This is NOT a generic chat bubble; it renders intelligence queries.
   
   MS6 Reference: .user-message + .user-bubble
   Tokens: accent background, white text, rounded corners
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface UserMessageBubbleProps {
  /** User query text */
  text: string;
  
  /** Optional message timestamp */
  timestamp?: string;
  
  /** Optional additional CSS classes */
  className?: string;
}

export function UserMessageBubble({ text, timestamp, className }: UserMessageBubbleProps) {
  return (
    <motion.div
      className={cn('flex justify-end', className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-col items-end max-w-[65%]">
        {/* User bubble */}
        <div
          className="px-5 py-3.5 rounded-2xl rounded-br-sm text-[13px] leading-relaxed font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {text}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <div className="mt-1.5 text-[10px] font-mono text-[var(--text-muted)]">
            {timestamp}
          </div>
        )}
      </div>
    </motion.div>
  );
}
