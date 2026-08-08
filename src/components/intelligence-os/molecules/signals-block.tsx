'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §5 — Signals Block (Molecule)
   
   Renders active signal pills with a "show more" hint when
   additional signals are available beyond what's displayed.
   Reuses SignalPill atom from Chapter 2.
   
   Tokens: Reuses SignalPill variant colors
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { BriefingBlockShell } from './briefing-block-shell';
import { SignalPill } from '../atoms/signal-pill';
import type { SignalsContent, BriefingBlockTrust } from '@/types/ms9-advisor';

export interface SignalsBlockProps {
  content: SignalsContent;
  trust?: BriefingBlockTrust;
  defaultCollapsed?: boolean;
  onSignalClick?: (signalId: string) => void;
  className?: string;
}

export function SignalsBlock({ content, trust, defaultCollapsed, onSignalClick, className }: SignalsBlockProps) {
  return (
    <BriefingBlockShell
      blockType="signals"
      title="Active Signals"
      defaultCollapsed={defaultCollapsed}
      trust={trust}
      className={className}
    >
      <div className="flex flex-col gap-2">
        {/* Signal pills */}
        <div className="flex flex-wrap gap-1.5">
          {content.pills.map((pill) => (
            <SignalPill
              key={pill.signalId}
              label={pill.label}
              variant={pill.variant}
              onClick={onSignalClick ? () => onSignalClick(pill.signalId) : undefined}
            />
          ))}
        </div>

        {/* Show more hint */}
        {content.hasMore && (
          <div className="text-[10px] font-mono text-[var(--text-muted)]">
            +{content.totalSignals - content.pills.length} more signal{content.totalSignals - content.pills.length !== 1 ? 's' : ''} available
          </div>
        )}
      </div>
    </BriefingBlockShell>
  );
}
