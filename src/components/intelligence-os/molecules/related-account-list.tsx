'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §4 — Related Account List (Molecule)
   
   List of related accounts in the advisor context sidebar.
   Each item shows initials avatar, company name, relevance,
   and a chevron for navigation.
   
   MS6 Reference: .related-list + .related-item
   Tokens: surface.card bg, border.default, text hierarchy
   ═══════════════════════════════════════════════════════════════ */

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RelatedAccountItem } from '@/types/ms9-advisor';

export interface RelatedAccountListProps {
  /** Related account items */
  accounts: RelatedAccountItem[];
  
  /** Callback when a related account is clicked */
  onAccountClick?: (companyId: string) => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

export function RelatedAccountList({ accounts, onAccountClick, className }: RelatedAccountListProps) {
  if (accounts.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {accounts.map((account) => (
        <button
          key={account.companyId}
          type="button"
          onClick={() => onAccountClick?.(account.companyId)}
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg text-left transition-colors duration-150"
          style={{
            backgroundColor: 'var(--surface-card, var(--bg-card))',
            border: '1px solid var(--border-default, var(--border))',
          }}
        >
          {/* Initials avatar */}
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md shrink-0 text-[12px] font-bold"
            style={{
              backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
              border: '1px solid var(--border-default, var(--border))',
              color: 'var(--text-secondary)',
            }}
          >
            {account.initials}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
              {account.companyName}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] truncate">
              {account.relevance}
            </div>
          </div>

          {/* Chevron */}
          <ChevronRight
            className="w-3.5 h-3.5 shrink-0 text-[var(--text-secondary)]"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </button>
      ))}
    </div>
  );
}
