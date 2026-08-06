'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §5 — Key Findings Block (Molecule)
   
   Renders key intelligence findings as a list of evidence-backed
   conclusions with per-finding confidence indicators.
   
   Tokens: surface.elevated for finding items, trust tier colors
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { BriefingBlockShell } from './briefing-block-shell';
import type { KeyFindingsContent, BriefingBlockTrust } from '@/types/ms9-advisor';

export interface KeyFindingsBlockProps {
  content: KeyFindingsContent;
  trust?: BriefingBlockTrust;
  defaultCollapsed?: boolean;
  className?: string;
}

export function KeyFindingsBlock({ content, trust, defaultCollapsed, className }: KeyFindingsBlockProps) {
  return (
    <BriefingBlockShell
      blockType="key_findings"
      title="Key Findings"
      defaultCollapsed={defaultCollapsed}
      trust={trust}
      className={className}
    >
      <div className="flex flex-col gap-2">
        {content.findings.map((finding) => (
          <div
            key={finding.id}
            className="flex items-start gap-2 px-3 py-2 rounded-md"
            style={{
              backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
              border: '1px solid var(--border-subtle, var(--border))',
            }}
          >
            {/* Finding confidence dot */}
            <span
              className="w-2 h-2 rounded-full mt-1 shrink-0"
              style={{
                backgroundColor: finding.confidenceScore >= 70
                  ? 'var(--trust-verified)'
                  : finding.confidenceScore >= 45
                    ? 'var(--warning-amber)'
                    : 'var(--risk-red)',
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-[var(--text-primary)]">
                {finding.headline}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                {finding.description}
              </div>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
              {finding.confidenceScore}%
            </span>
          </div>
        ))}
      </div>
    </BriefingBlockShell>
  );
}
