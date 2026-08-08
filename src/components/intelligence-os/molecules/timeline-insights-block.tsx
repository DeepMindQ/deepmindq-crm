'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §5 — Timeline Insights Block (Molecule)
   
   Renders temporal analysis events in chronological order with
   significance indicators and pattern summary.
   
   Tokens: domain colors for significance, surface.elevated for items
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { BriefingBlockShell } from './briefing-block-shell';
import type { TimelineInsightsContent, BriefingBlockTrust } from '@/types/ms9-advisor';
import { tokens } from '../design-tokens';

export interface TimelineInsightsBlockProps {
  content: TimelineInsightsContent;
  trust?: BriefingBlockTrust;
  defaultCollapsed?: boolean;
  className?: string;
}

/** Significance → color mapping using domain tokens */
const significanceColors: Record<string, string> = {
  critical: tokens.domain.risk,
  high: tokens.domain.reasoning,
  medium: tokens.domain.signal,
  low: 'var(--text-muted)',
};

export function TimelineInsightsBlock({ content, trust, defaultCollapsed, className }: TimelineInsightsBlockProps) {
  return (
    <BriefingBlockShell
      blockType="timeline_insights"
      title="Timeline Insights"
      defaultCollapsed={defaultCollapsed}
      trust={trust}
      className={className}
    >
      <div className="flex flex-col gap-2">
        {/* Timeline events */}
        {content.events.map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-2.5 px-3 py-2 rounded-md"
            style={{
              backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
              border: '1px solid var(--border-subtle, var(--border))',
            }}
          >
            {/* Significance dot */}
            <span
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: significanceColors[event.significance] ?? 'var(--text-muted)' }}
            />

            {/* Date label */}
            <span className="text-[10px] font-mono text-[var(--text-muted)] w-16 shrink-0 pt-0.5">
              {event.dateLabel}
            </span>

            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-[var(--text-primary)]">
                {event.event}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                {event.description}
              </div>
            </div>

            <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
              {event.confidenceScore}%
            </span>
          </div>
        ))}

        {/* Pattern summary */}
        {content.patternSummary && (
          <div className="text-[11px] text-[var(--text-secondary)] mt-1 px-1 italic leading-relaxed">
            Pattern: {content.patternSummary}
          </div>
        )}
      </div>
    </BriefingBlockShell>
  );
}
