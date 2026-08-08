'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §5 — Structured Briefing Renderer (Organism)
   
   Renders a full StructuredBriefing's blocks array by routing
   each BriefingBlock to its type-specific molecule using the
   BriefingBlockContent discriminated union.
   
   This is the CORE MS9 rendering engine that transforms
   structured AI output into the intelligence briefing UI.
   
   Every AI response MUST render through this renderer.
   Raw markdown or generic chat text is NOT supported.
   
   Tokens: All sub-components use design tokens
   ═══════════════════════════════════════════════════════════════ */

import { cn } from '@/lib/utils';
import { KeyFindingsBlock } from './molecules/key-findings-block';
import { SignalsBlock } from './molecules/signals-block';
import { RecommendationsBlock } from './molecules/recommendations-block';
import { TimelineInsightsBlock } from './molecules/timeline-insights-block';
import { CompetitiveIntelBlock } from './molecules/competitive-intel-block';
import { RiskFlagsBlock } from './molecules/risk-flags-block';
import { NarrativeBlock } from './molecules/narrative-block';
import { DataSummaryBlock } from './molecules/data-summary-block';
import type { BriefingBlock, BriefingBlockContent } from '@/types/ms9-advisor';

export interface StructuredBriefingRendererProps {
  /** Ordered briefing blocks to render */
  blocks: BriefingBlock[];
  
  /** Callback when a signal pill is clicked */
  onSignalClick?: (signalId: string) => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Routes a single BriefingBlock to its type-specific renderer
 * based on the BriefingBlockContent discriminated union.
 */
function renderBlock(block: BriefingBlock, onSignalClick?: (signalId: string) => void): React.ReactNode {
  const { content, trust, defaultCollapsed } = block;

  switch (content.type) {
    case 'key_findings':
      return <KeyFindingsBlock content={content} trust={trust} defaultCollapsed={defaultCollapsed} />;

    case 'signals':
      return <SignalsBlock content={content} trust={trust} defaultCollapsed={defaultCollapsed} onSignalClick={onSignalClick} />;

    case 'recommendations':
      return <RecommendationsBlock content={content} trust={trust} defaultCollapsed={defaultCollapsed} />;

    case 'timeline_insights':
      return <TimelineInsightsBlock content={content} trust={trust} defaultCollapsed={defaultCollapsed} />;

    case 'competitive_intel':
      return <CompetitiveIntelBlock content={content} trust={trust} defaultCollapsed={defaultCollapsed} />;

    case 'risk_flags':
      return <RiskFlagsBlock content={content} trust={trust} defaultCollapsed={defaultCollapsed} />;

    case 'narrative':
      return <NarrativeBlock content={content} trust={trust} defaultCollapsed={defaultCollapsed} />;

    case 'data_summary':
      return <DataSummaryBlock content={content} trust={trust} defaultCollapsed={defaultCollapsed} />;

    default:
      // Type-safe exhaustive check — should never reach here
      const _exhaustive: never = content;
      return null;
  }
}

export function StructuredBriefingRenderer({
  blocks,
  onSignalClick,
  className,
}: StructuredBriefingRendererProps) {
  if (blocks.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2 mt-3', className)}>
      {blocks.map((block) => (
        <div key={block.id}>
          {renderBlock(block, onSignalClick)}
        </div>
      ))}
    </div>
  );
}
