'use client';

import { motion } from 'framer-motion';
import { ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens } from './design-tokens';

/* ═══════════════════════════════════════════════════
   ActionCTA — Action-Terminated Intelligence
   
   Every intelligence narrative must end with a clear action.
   This component ensures zero dead ends by providing a
   prominent, unambiguous next step.
   
   Variants:
   - primary: Full-width prominent action (narrative footer)
   - inline: Inline action within content
   - minimal: Subtle link-style action
   - external: Opens external URL
   
   Principles:
   - Action-Terminated Intelligence: Every piece of intel has a next step
   - Zero Dead Ends: User always knows what to do next
   - Decision Reduction: Clear, singular action
   ═══════════════════════════════════════════════════ */

export type ActionVariant = 'primary' | 'inline' | 'minimal' | 'external' | 'danger';
export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ActionCTAProps {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: ActionVariant;
  priority?: ActionPriority;
  loading?: boolean;
  loadingLabel?: string;
  icon?: boolean;
  className?: string;
}

const priorityConfig: Record<ActionPriority, { color: string; bg: string; border: string; hoverBg: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)',   border: 'rgba(239, 68, 68, 0.2)',   hoverBg: 'rgba(239, 68, 68, 0.18)' },
  high:     { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)',  border: 'rgba(245, 158, 11, 0.2)',  hoverBg: 'rgba(245, 158, 11, 0.18)' },
  medium:   { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)',  border: 'rgba(59, 130, 246, 0.2)',  hoverBg: 'rgba(59, 130, 246, 0.18)' },
  low:      { color: '#8892a8', bg: 'rgba(136, 146, 168, 0.1)', border: 'rgba(136, 146, 168, 0.2)', hoverBg: 'rgba(136, 146, 168, 0.18)' },
};

export function ActionCTA({
  label,
  onClick,
  href,
  variant = 'primary',
  priority = 'medium',
  loading = false,
  loadingLabel = 'Processing...',
  icon = true,
  className,
}: ActionCTAProps) {
  const pConfig = priorityConfig[priority];

  // ── Primary: Full-width button ──
  if (variant === 'primary') {
    const content = (
      <motion.button
        whileTap={{ scale: 0.98 }}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200',
          className
        )}
        style={{
          background: pConfig.bg,
          border: `1px solid ${pConfig.border}`,
          color: pConfig.color,
        }}
        onClick={onClick}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          <>
            {label}
            {icon && <ArrowRight className="w-3.5 h-3.5" />}
          </>
        )}
      </motion.button>
    );

    return content;
  }

  // ── Inline: Small pill button ──
  if (variant === 'inline') {
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200',
          className
        )}
        style={{
          background: pConfig.bg,
          border: `1px solid ${pConfig.border}`,
          color: pConfig.color,
        }}
        onClick={onClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            {label}
            {icon && <ArrowRight className="w-3 h-3" />}
          </>
        )}
      </motion.button>
    );
  }

  // ── Minimal: Text link style ──
  if (variant === 'minimal') {
    return (
      <button
        className={cn(
          'inline-flex items-center gap-1 text-[11px] font-medium transition-colors',
          className
        )}
        style={{ color: pConfig.color }}
        onClick={onClick}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            {label}
            {icon && <ArrowRight className="w-2.5 h-2.5" />}
          </>
        )}
      </button>
    );
  }

  // ── External: Link with external icon ──
  if (variant === 'external') {
    const content = (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors',
          className
        )}
        style={{ color: tokens.accent.bright }}
      >
        {label}
        <ExternalLink className="w-3 h-3" />
      </a>
    );
    return content;
  }

  // ── Danger: Destructive action ──
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
        className
      )}
      style={{
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
      }}
      onClick={onClick}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : label}
    </motion.button>
  );
}
