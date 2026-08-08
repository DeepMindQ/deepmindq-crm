'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §5 — Recommendations Block (Molecule)
   
   Renders actionable recommendation items with priority badges,
   action type indicators, and per-recommendation confidence.
   
   Tokens: priority tier colors, trust tier colors
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { BriefingBlockShell } from './briefing-block-shell';
import type { RecommendationsContent, BriefingBlockTrust } from '@/types/ms9-advisor';
import { tokens } from '../design-tokens';

export interface RecommendationsBlockProps {
  content: RecommendationsContent;
  trust?: BriefingBlockTrust;
  defaultCollapsed?: boolean;
  className?: string;
}

/** Action type → display label */
const actionLabels: Record<string, string> = {
  review: 'Review',
  save: 'Save',
  monitor: 'Monitor',
  schedule: 'Schedule',
  export: 'Export',
  escalate: 'Escalate',
};

export function RecommendationsBlock({ content, trust, defaultCollapsed, className }: RecommendationsBlockProps) {
  return (
    <BriefingBlockShell
      blockType="recommendations"
      title="Recommendations"
      defaultCollapsed={defaultCollapsed}
      trust={trust}
      className={className}
    >
      <div className="flex flex-col gap-2">
        {content.recommendations.map((rec) => {
          const priorityToken = tokens.priority[rec.priority];
          return (
            <div
              key={rec.id}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-md"
              style={{
                backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
                border: '1px solid var(--border-subtle, var(--border))',
              }}
            >
              {/* Action type badge */}
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 shrink-0"
                style={{
                  backgroundColor: priorityToken.bg,
                  color: priorityToken.value,
                  border: `1px solid ${priorityToken.border}`,
                }}
              >
                {actionLabels[rec.actionType] ?? rec.actionType}
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--text-primary)]">
                  {rec.title}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                  {rec.description}
                </div>
                {/* Reasoning */}
                {rec.reasoning && (
                  <div className="text-[10px] text-[var(--text-muted)] mt-1 italic">
                    Reasoning: {rec.reasoning}
                  </div>
                )}
              </div>

              {/* Confidence */}
              <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                {rec.confidenceScore}%
              </span>
            </div>
          );
        })}
      </div>
    </BriefingBlockShell>
  );
}
