'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §2 — Evidence Footprint (Molecule)
   
   Compact evidence summary shown at L1/L2 level.
   Displays: total sources, verified count, freshness,
   source type dots, and AI inference indicator.
   
   Matches MS6 Phase 3 evidence footprint pattern:
   4 color-coded dots (Verified=green, AI=purple, CRM=blue, Web=cyan)
   ═══════════════════════════════════════════════════════════════ */

import { FileText, Sparkles, Database, Globe, Clock, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { EvidenceFootprint as EvidenceFootprintType, SourceCategory } from '@/types/ms8-evidence';
import { formatFreshness } from '@/lib/intelligence-types';

// ─── Source dot colors (MS6 Phase 3 reference) ──────────────
const DOT_COLORS: Record<SourceCategory, string> = {
  verified_official: 'var(--success-green)',
  verified_external: 'var(--trust-verified)',
  crm_internal:      'var(--signal-blue)',
  web_signal:        'var(--enrichment-cyan)',
  ai_inference:      'var(--accent-secondary)',
  crm_analytics:     'var(--warning-amber)',
  external_database: 'var(--signal-blue)',
};

const DOT_LABELS: Record<SourceCategory, string> = {
  verified_official: 'Official',
  verified_external: 'Verified Source',
  crm_internal:      'CRM Data',
  web_signal:        'Web Signal',
  ai_inference:      'AI Inference',
  crm_analytics:     'CRM Analytics',
  external_database: 'External DB',
};

// ─── Props ──────────────────────────────────────────────────
export interface EvidenceFootprintProps {
  /** Evidence footprint summary data */
  footprint: EvidenceFootprintType;

  /** Show freshness indicator */
  showFreshness?: boolean;

  /** Show source count text */
  showCount?: boolean;

  /** Show AI inference indicator */
  showAIIndicator?: boolean;

  /** Size variant */
  size?: 'xs' | 'sm' | 'md';

  /** Additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────
export function EvidenceFootprint({
  footprint,
  showFreshness = true,
  showCount = true,
  showAIIndicator = true,
  size = 'sm',
  className,
}: EvidenceFootprintProps) {
  const dotSize = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
  }[size];

  const textSize = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-[11px]',
  }[size];

  const iconSize = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  }[size];

  // Build ordered source dots (max 6 unique categories shown)
  const orderedCategories: SourceCategory[] = [
    'verified_official', 'verified_external', 'crm_internal',
    'web_signal', 'ai_inference', 'crm_analytics', 'external_database',
  ];

  const activeCategories = orderedCategories.filter(
    cat => (footprint.sourceBreakdown[cat] ?? 0) > 0,
  );

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {/* Source dots */}
      {activeCategories.length > 0 && (
        <div className="flex items-center gap-1">
          {activeCategories.map(cat => (
            <Tooltip key={cat}>
              <TooltipTrigger asChild>
                <span
                  className={cn('rounded-full flex-shrink-0', dotSize)}
                  style={{ backgroundColor: DOT_COLORS[cat] }}
                  aria-label={`${DOT_LABELS[cat]} (${footprint.sourceBreakdown[cat]})`}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <span>{DOT_LABELS[cat]} ({footprint.sourceBreakdown[cat]})</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Source count */}
      {showCount && (
        <span className={cn('font-mono font-medium', textSize)} style={{ color: 'var(--primary-dim)' }}>
          {footprint.totalSources} {footprint.totalSources === 1 ? 'source' : 'sources'}
          {footprint.verifiedCount > 0 && (
            <span style={{ color: 'var(--trust-verified)' }}>
              {' '}&middot; {footprint.verifiedCount} verified
            </span>
          )}
        </span>
      )}

      {/* AI inference indicator */}
      {showAIIndicator && footprint.hasAIInference && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{
                color: 'var(--accent-secondary)',
                backgroundColor: 'var(--opportunity-purple-low)',
              }}
            >
              <Sparkles className={cn(iconSize, 'w-3 h-3')} />
              <span className={cn('font-medium', textSize)}>AI</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <span>AI inference contributed to this intelligence</span>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Freshness */}
      {showFreshness && footprint.mostRecentAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn('inline-flex items-center gap-1 font-mono', textSize)}
              style={{
                color: footprint.freshnessLevel === 'stale'
                  ? 'var(--warning-amber)'
                  : 'var(--primary-dim)',
              }}
            >
              <Clock className="w-3 h-3" />
              {formatFreshness(footprint.mostRecentAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <span>Most recent evidence: {formatFreshness(footprint.mostRecentAt)}</span>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
