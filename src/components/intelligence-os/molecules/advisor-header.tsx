'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
/* ═══════════════════════════════════════════════════════════════
   MS9 §3 — Advisor Header (Molecule)
   
   AI Advisor panel header with title, status, and context chips.
   Shows the advisor title, connection status, and quick-action
   header chips for account context switching.
   
   MS6 Reference: .advisor-header + .advisor-header-row
   Tokens: surface.base bg, border.default, text hierarchy
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AdvisorConnectionStatus } from '@/types/ms9-advisor';

export interface AdvisorHeaderProps {
  /** Primary account name shown in header chip (null = no active account) */
  activeAccountName?: string | null;
  
  /** Connection status — determines the status line */
  connectionStatus?: AdvisorConnectionStatus;
  
  /** Number of active intelligence sources */
  activeSourceCount?: number;
  
  /** Whether to show the "New Briefing" chip */
  showNewBriefingChip?: boolean;
  
  /** Whether to show the "History" chip */
  showHistoryChip?: boolean;
  
  /** Callback when "New Briefing" chip is clicked */
  onNewBriefing?: () => void;
  
  /** Callback when "History" chip is clicked */
  onHistory?: () => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

/** Connection status → display config */
const statusConfig: Record<AdvisorConnectionStatus, { label: string; color: string }> = {
  connected: { label: 'Connected', color: 'var(--trust-high)' },
  degraded: { label: 'Degraded', color: 'var(--warning-amber)' },
  offline: { label: 'Offline', color: 'var(--risk-red)' },
  initializing: { label: 'Initializing...', color: 'var(--text-muted)' },
};

export function AdvisorHeader({
  activeAccountName,
  connectionStatus = 'connected',
  activeSourceCount = 0,
  showNewBriefingChip = true,
  showHistoryChip = true,
  onNewBriefing,
  onHistory,
  className,
}: AdvisorHeaderProps) {
  const status = statusConfig[connectionStatus];

  return (
    <header
      className={cn(
        'px-8 pb-5 border-b',
        className,
      )}
      style={{
        backgroundColor: 'var(--surface-base, var(--bg))',
        borderColor: 'var(--border-default, var(--border))',
      }}
    >
      <div className="flex items-start justify-between gap-5">
        {/* Left — Title + subtitle + status */}
        <div className="flex-1 min-w-0">
          <h1 className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
            {/* Advisor icon — gradient box */}
            <span
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--accent-secondary), #6d28d9)',
              }}
            >
              <svg
                viewBox="0 0 18 18"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="18"
                height="18"
              >
                <path d="M9 2 C5 2 2 5 2 9 C2 11 3 13 4.5 14 L4.5 17 L8 15 L9 15 C13 15 16 12 16 9 C16 5 13 2 9 2Z" />
                <circle cx="6" cy="9" r="1" fill="white" />
                <circle cx="9" cy="9" r="1" fill="white" />
                <circle cx="12" cy="9" r="1" fill="white" />
              </svg>
            </span>
            AI Advisor
          </h1>

          <p
            className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)] max-w-xl"
          >
            Ask questions about your intelligence. The AI provides structured briefings, not casual conversation.
          </p>

          {/* Connection status */}
          <div className="flex items-center gap-2 mt-3 text-[12px] font-mono" style={{ color: status.color }}>
            <motion.span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: status.color }}
              animate={
                connectionStatus === 'connected'
                  ? { opacity: [1, 0.6, 1], boxShadow: ['0 0 0 0 rgba(20,184,166,0.4)', '0 0 0 6px rgba(20,184,166,0)'] }
                  : {}
              }
              transition={connectionStatus === 'connected' ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
            />
            {status.label}
            {activeSourceCount > 0 && (
              <span> — Processing intelligence from {activeSourceCount} source{activeSourceCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {/* Right — Header chips */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active account chip */}
          {activeAccountName && (
            <button
              type="button"
              className={cn(
                'px-3.5 py-1.5 rounded-full text-[12px] font-semibold',
                'border transition-colors duration-150',
              )}
              style={{
                backgroundColor: tokens.accent.subtle,
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              {activeAccountName}
            </button>
          )}

          {/* New Briefing chip */}
          {showNewBriefingChip && (
            <button
              type="button"
              onClick={onNewBriefing}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-[12px] font-semibold',
                'border transition-colors duration-150',
              )}
              style={{
                backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
                borderColor: 'var(--border-default, var(--border))',
                color: 'var(--text-secondary)',
              }}
            >
              New Briefing
            </button>
          )}

          {/* History chip */}
          {showHistoryChip && (
            <button
              type="button"
              onClick={onHistory}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-[12px] font-semibold',
                'border transition-colors duration-150',
              )}
              style={{
                backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
                borderColor: 'var(--border-default, var(--border))',
                color: 'var(--text-secondary)',
              }}
            >
              History
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
