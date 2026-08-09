'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §5 — Briefing Block Shell (Molecule)
   
   Common wrapper for all 8 structured briefing block types.
   Provides: collapsible title, block type icon, trust badge,
   and standardized card styling.
   
   MS6 Reference: Derived from .ai-message-body card patterns
   Tokens: surface.card bg, border.default, accent for active states
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { BriefingBlockType, BriefingBlockTrust } from '@/types/ms9-advisor';
import { tokens } from '../design-tokens';

export interface BriefingBlockShellProps {
  /** Block type — determines icon and label */
  blockType: BriefingBlockType;
  
  /** Block title */
  title: string;
  
  /** Whether this block starts collapsed */
  defaultCollapsed?: boolean;
  
  /** Trust metadata for this block */
  trust?: BriefingBlockTrust;
  
  /** Block content */
  children: React.ReactNode;
  
  /** Optional additional CSS classes */
  className?: string;
}

/** Block type → icon SVG and label */
const blockMeta: Record<BriefingBlockType, { label: string; icon: React.ElementType }> = {
  key_findings: { label: 'Key Findings', icon: () => null },
  signals: { label: 'Signals', icon: () => null },
  recommendations: { label: 'Recommendations', icon: () => null },
  timeline_insights: { label: 'Timeline', icon: () => null },
  competitive_intel: { label: 'Competitive Intel', icon: () => null },
  risk_flags: { label: 'Risk Flags', icon: () => null },
  narrative: { label: 'Narrative', icon: () => null },
  data_summary: { label: 'Data Summary', icon: () => null },
};

export function BriefingBlockShell({
  blockType,
  title,
  defaultCollapsed = false,
  trust,
  children,
  className,
}: BriefingBlockShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const meta = blockMeta[blockType];
  const trustTier = trust?.trustTier;
  const trustColor = trustTier ? tokens.trust[trustTier].value : 'var(--text-muted)';

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden',
        className,
      )}
      style={{
        backgroundColor: 'var(--surface-card, var(--bg-card))',
        border: '1px solid var(--border-default, var(--border))',
      }}
    >
      {/* Block header — clickable to collapse/expand */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between w-full px-3.5 py-2.5 text-left transition-colors duration-150 hover:opacity-80"
      >
        <div className="flex items-center gap-2">
          {/* Collapse chevron */}
          <motion.span
            animate={{ rotate: isCollapsed ? 0 : 90 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight
              className="w-3 h-3 text-[var(--text-muted)]"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </motion.span>

          {/* Block title */}
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">
            {title}
          </span>
        </div>

        {/* Trust badge */}
        {trust && (
          <span
            className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: trustTier ? tokens.trust[trustTier].bg : 'transparent',
              color: trustColor,
            }}
          >
            {trust.confidenceScore}%
          </span>
        )}
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
