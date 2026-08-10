'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §5 — Competitive Intel Block (Molecule)
   
   Renders competitive landscape entities with threat level
   indicators and market positioning summary.
   
   Tokens: domain colors for threat levels, surface.elevated
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { BriefingBlockShell } from './briefing-block-shell';
import type { CompetitiveIntelContent, BriefingBlockTrust } from '@/types/ms9-advisor';
import { tokens } from '../design-tokens';

export interface CompetitiveIntelBlockProps {
  content: CompetitiveIntelContent;
  trust?: BriefingBlockTrust;
  defaultCollapsed?: boolean;
  className?: string;
}

/** Threat level → color mapping */
const threatColors: Record<string, string> = {
  high: tokens.domain.risk,
  medium: tokens.domain.reasoning,
  low: tokens.domain.signal,
  opportunity: tokens.domain.action,
};

export function CompetitiveIntelBlock({ content, trust, defaultCollapsed, className }: CompetitiveIntelBlockProps) {
  return (
    <BriefingBlockShell
      blockType="competitive_intel"
      title="Competitive Intelligence"
      defaultCollapsed={defaultCollapsed}
      trust={trust}
      className={className}
    >
      <div className="flex flex-col gap-2">
        {/* Competitor cards */}
        {content.competitors.map((comp) => (
          <div
            key={comp.id}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-md"
            style={{
              backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
              border: '1px solid var(--border-subtle, var(--border))',
            }}
          >
            {/* Threat level dot */}
            <span
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: threatColors[comp.threatLevel] ?? 'var(--text-muted)' }}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                  {comp.name}
                </span>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: tokens.priority.low.bg,
                    color: threatColors[comp.threatLevel] ?? 'var(--text-muted)',
                  }}
                >
                  {comp.threatLevel}
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {comp.relevance}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                {comp.description}
              </div>
            </div>

            <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
              {comp.confidenceScore}%
            </span>
          </div>
        ))}

        {/* Positioning summary */}
        {content.positioningSummary && (
          <div className="text-[11px] text-[var(--text-secondary)] mt-1 px-1 italic leading-relaxed">
            Position: {content.positioningSummary}
          </div>
        )}
      </div>
    </BriefingBlockShell>
  );
}
