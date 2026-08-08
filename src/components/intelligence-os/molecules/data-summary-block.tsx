'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §5 — Data Summary Block (Molecule)
   
   Renders key metrics and data points as a compact grid with
   trend indicators and source attribution.
   
   Tokens: trust tier colors, domain colors for trends
   ═══════════════════════════════════════════════════════════════ */

import { TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BriefingBlockShell } from './briefing-block-shell';
import type { DataSummaryContent, BriefingBlockTrust } from '@/types/ms9-advisor';

export interface DataSummaryBlockProps {
  content: DataSummaryContent;
  trust?: BriefingBlockTrust;
  defaultCollapsed?: boolean;
  className?: string;
}

/** Trend → icon and color */
const trendConfig: Record<string, { icon: React.ElementType; color: string }> = {
  up: { icon: TrendingUp, color: 'var(--trust-verified)' },
  down: { icon: TrendingDown, color: 'var(--risk-red)' },
  stable: { icon: Minus, color: 'var(--text-muted)' },
  new: { icon: Plus, color: 'var(--accent)' },
};

export function DataSummaryBlock({ content, trust, defaultCollapsed, className }: DataSummaryBlockProps) {
  return (
    <BriefingBlockShell
      blockType="data_summary"
      title="Key Metrics"
      defaultCollapsed={defaultCollapsed}
      trust={trust}
      className={className}
    >
      {/* Metrics grid — 2 columns on wider screens */}
      <div className="grid grid-cols-2 gap-2">
        {content.metrics.map((metric) => {
          const trend = metric.trend ? trendConfig[metric.trend] : null;
          const TrendIcon = trend?.icon;

          return (
            <div
              key={metric.id}
              className="flex flex-col gap-1 px-3 py-2 rounded-md"
              style={{
                backgroundColor: 'var(--surface-elevated, var(--bg-elevated))',
                border: '1px solid var(--border-subtle, var(--border))',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  {metric.label}
                </span>
                {trend && TrendIcon && (
                  <TrendIcon
                    className="w-3 h-3"
                    style={{ color: trend.color }}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                )}
              </div>
              <span className="text-[14px] font-bold text-[var(--text-primary)]">
                {metric.value}
              </span>
              {metric.context && (
                <span className="text-[10px] text-[var(--text-muted)]">
                  {metric.context}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </BriefingBlockShell>
  );
}
