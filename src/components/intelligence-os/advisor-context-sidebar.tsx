'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §4 — Advisor Context Sidebar (Organism)
   
   Right-panel intelligence grounding context for the AI advisor.
   Shows the active account card, related accounts, and data
   freshness to anchor AI briefings in real intelligence data.
   
   This is NOT a generic details panel. It provides the evidence
   grounding context that makes every AI briefing traceable.
   
   MS6 Reference: .context-panel in reference_ai_advisor.html
   Tokens: surface.deep bg, text hierarchy, trust tier colors
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { ContextAccountCard } from './molecules/context-account-card';
import { RelatedAccountList } from './molecules/related-account-list';
import { DataFreshnessPanel } from './molecules/data-freshness-panel';
import type { ContextSidebarData } from '@/types/ms9-advisor';

export interface AdvisorContextSidebarProps {
  /** Complete sidebar data */
  data: ContextSidebarData;
  
  /** Callback when account card is clicked */
  onAccountClick?: (companyId: string) => void;
  
  /** Callback when a related account is clicked */
  onRelatedAccountClick?: (companyId: string) => void;
  
  /** Callback when a freshness entry is clicked (e.g., to refresh) */
  onFreshnessClick?: (label: string) => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

export function AdvisorContextSidebar({
  data,
  onAccountClick,
  onRelatedAccountClick,
  onFreshnessClick,
  className,
}: AdvisorContextSidebarProps) {
  return (
    <aside
      className={cn(
        'flex flex-col gap-5 overflow-y-auto p-6',
        className,
      )}
      style={{
        backgroundColor: 'var(--surface-base, var(--bg-deep))',
        /* Custom scrollbar */
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border-default, var(--border)) transparent',
      }}
    >
      {/* Section 1 — Current Briefing Context */}
      <div>
        <div
          className="text-[11px] font-bold uppercase tracking-wider mb-3"
          style={{
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          Current Briefing Context
        </div>
        <ContextAccountCard
          data={data.currentContext}
          onClick={() => onAccountClick?.(data.currentContext.companyId)}
        />
      </div>

      {/* Section 2 — Related Accounts */}
      {data.relatedAccounts.length > 0 && (
        <div>
          <div
            className="text-[11px] font-bold uppercase tracking-wider mb-3"
            style={{
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            Related Accounts
          </div>
          <RelatedAccountList
            accounts={data.relatedAccounts}
            onAccountClick={onRelatedAccountClick}
          />
        </div>
      )}

      {/* Section 3 — Data Freshness */}
      {data.dataFreshness.length > 0 && (
        <div>
          <div
            className="text-[11px] font-bold uppercase tracking-wider mb-3"
            style={{
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            Data Freshness
          </div>
          <DataFreshnessPanel
            entries={data.dataFreshness}
            onEntryClick={onFreshnessClick}
          />
        </div>
      )}
    </aside>
  );
}
