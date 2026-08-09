'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §5 — Risk Flags Block (Molecule)
   
   Renders risk indicators with severity badges, category labels,
   and mitigation strategies. Critical/high risks use domain colors.
   
   Tokens: priority.critical/high for severity, domain.risk for accent
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { BriefingBlockShell } from './briefing-block-shell';
import type { RiskFlagsContent, BriefingBlockTrust } from '@/types/ms9-advisor';
import { tokens } from '../design-tokens';

export interface RiskFlagsBlockProps {
  content: RiskFlagsContent;
  trust?: BriefingBlockTrust;
  defaultCollapsed?: boolean;
  className?: string;
}

/** Severity → color */
const severityColors: Record<string, string> = {
  critical: tokens.priority.critical.value,
  high: tokens.priority.high.value,
  medium: tokens.priority.medium.value,
  low: tokens.priority.low.value,
};

export function RiskFlagsBlock({ content, trust, defaultCollapsed, className }: RiskFlagsBlockProps) {
  return (
    <BriefingBlockShell
      blockType="risk_flags"
      title="Risk Flags"
      defaultCollapsed={defaultCollapsed}
      trust={trust}
      className={className}
    >
      <div className="flex flex-col gap-2">
        {/* Risk items */}
        {content.flags.map((flag) => (
          <div
            key={flag.id}
            className="px-3 py-2.5 rounded-md"
            style={{
              backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
              border: `1px solid var(--border-subtle, var(--border))`,
              borderLeftColor: severityColors[flag.severity] ?? 'var(--border-default, var(--border))',
              borderLeftWidth: '3px',
            }}
          >
            <div className="flex items-center gap-2">
              {/* Severity badge */}
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${severityColors[flag.severity]}15`,
                  color: severityColors[flag.severity],
                }}
              >
                {flag.severity}
              </span>
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                {flag.headline}
              </span>
              <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                {flag.confidenceScore}%
              </span>
            </div>

            <div className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
              {flag.description}
            </div>

            {/* Mitigation strategy */}
            {flag.mitigation && (
              <div className="mt-1.5 text-[10px] text-[var(--text-muted)]">
                <span className="font-semibold">Mitigation: </span>{flag.mitigation}
              </div>
            )}
          </div>
        ))}

        {/* Risk summary */}
        {content.riskSummary && (
          <div className="text-[11px] text-[var(--text-secondary)] mt-1 px-1 italic leading-relaxed">
            Assessment: {content.riskSummary}
          </div>
        )}
      </div>
    </BriefingBlockShell>
  );
}
