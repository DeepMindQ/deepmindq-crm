'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §5 — Narrative Block (Molecule)
   
   Renders structured AI narrative text as paragraphs with emphasis
   support. NOT raw markdown — uses structured paragraph objects.
   
   Tokens: text hierarchy for body text and emphasis
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { BriefingBlockShell } from './briefing-block-shell';
import type { NarrativeContent, BriefingBlockTrust } from '@/types/ms9-advisor';

export interface NarrativeBlockProps {
  content: NarrativeContent;
  trust?: BriefingBlockTrust;
  defaultCollapsed?: boolean;
  className?: string;
}

export function NarrativeBlock({ content, trust, defaultCollapsed, className }: NarrativeBlockProps) {
  return (
    <BriefingBlockShell
      blockType="narrative"
      title="Analysis"
      defaultCollapsed={defaultCollapsed}
      trust={trust}
      className={className}
    >
      <div className="flex flex-col gap-2">
        {content.paragraphs.map((para) => (
          <p
            key={para.id}
            className={cn(
              'text-[12px] leading-relaxed',
              para.hasEmphasis ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
            )}
          >
            {para.text}
          </p>
        ))}
      </div>
    </BriefingBlockShell>
  );
}
