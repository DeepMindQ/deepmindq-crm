'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §4 — Data Freshness Panel (Molecule)
   
   Displays intelligence source freshness in the context sidebar.
   Each row shows the data domain, last refreshed time, and a
   freshness status indicator.
   
   MS6 Reference: .freshness-list + .freshness-item
   Tokens: surface.card bg, border.default, trust-verified for fresh
   ═══════════════════════════════════════════════════════════════ */

import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DataFreshnessEntry } from '@/types/ms9-advisor';

export interface DataFreshnessPanelProps {
  /** Freshness entries for each intelligence source */
  entries: DataFreshnessEntry[];
  
  /** Optional callback when a freshness item is clicked (e.g., to refresh) */
  onEntryClick?: (label: string) => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

export function DataFreshnessPanel({ entries, onEntryClick, className }: DataFreshnessPanelProps) {
  if (entries.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {entries.map((entry) => (
        <div
          key={entry.label}
          className={cn(
            'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[13px]',
            onEntryClick && 'cursor-pointer',
          )}
          style={{
            backgroundColor: 'var(--surface-card, var(--bg-card))',
            border: '1px solid var(--border-default, var(--border))',
          }}
          onClick={() => onEntryClick?.(entry.label)}
          role={onEntryClick ? 'button' : undefined}
          tabIndex={onEntryClick ? 0 : undefined}
          onKeyDown={onEntryClick ? (e) => { if (e.key === 'Enter') onEntryClick(entry.label); } : undefined}
        >
          {/* Left — domain label */}
          <span className="font-medium text-[var(--text-primary)]">
            {entry.label}
          </span>

          {/* Right — freshness time + status icon */}
          <div className="flex items-center gap-2">
            <span
              className="text-[11px]"
              style={{
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {entry.freshnessLabel}
            </span>
            {entry.isFresh ? (
              <Check
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: 'var(--trust-verified)' }}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <AlertTriangle
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: 'var(--warning-amber)' }}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
