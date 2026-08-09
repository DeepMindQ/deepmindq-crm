/* ═══════════════════════════════════════════════════
   Trust Breakdown Chart — Pure CSS/SVG charts
   
   No external chart library. Renders:
   1. Source reliability breakdown (horizontal bars)
   2. Confidence distribution (stacked bar)
   ═══════════════════════════════════════════════════ */

'use client';

import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────

export interface SourceBreakdownItem {
  source: string;
  count: number;
  avgScore: number;
}

export interface ConfidenceDistribution {
  high: number;
  medium: number;
  low: number;
}

interface TrustBreakdownChartProps {
  sourceBreakdown: SourceBreakdownItem[];
  confidenceDistribution: ConfidenceDistribution;
  className?: string;
}

// ─── Source Color Map ───────────────────────────────────────────

const SOURCE_COLORS: Record<string, { bar: string; bg: string; text: string; dot: string }> = {
  verified_api: {
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/5',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  customer_data: {
    bar: 'bg-sky-500 dark:bg-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-500/5',
    text: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  internal_document: {
    bar: 'bg-violet-500 dark:bg-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-500/5',
    text: 'text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  web_intelligence: {
    bar: 'bg-amber-500 dark:bg-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/5',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  platform_computed: {
    bar: 'bg-teal-500 dark:bg-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-500/5',
    text: 'text-teal-700 dark:text-teal-300',
    dot: 'bg-teal-500',
  },
  ai_inference: {
    bar: 'bg-orange-500 dark:bg-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-500/5',
    text: 'text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
};

const SOURCE_LABELS: Record<string, string> = {
  verified_api: 'Verified API',
  customer_data: 'Customer Data',
  internal_document: 'Internal Doc',
  web_intelligence: 'Web Intel',
  platform_computed: 'Computed',
  ai_inference: 'AI Inference',
};

const DEFAULT_COLOR = {
  bar: 'bg-gray-400',
  bg: 'bg-gray-50 dark:bg-gray-500/5',
  text: 'text-gray-600 dark:text-gray-400',
  dot: 'bg-gray-400',
};

// ─── Component ──────────────────────────────────────────────────

export function TrustBreakdownChart({
  sourceBreakdown,
  confidenceDistribution,
  className,
}: TrustBreakdownChartProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Source Reliability Breakdown */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Source Reliability</h4>
        <div className="space-y-2.5">
          {sourceBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No source data available</p>
          ) : (
            sourceBreakdown.map((item) => {
              const colors = SOURCE_COLORS[item.source] || DEFAULT_COLOR;
              const maxCount = Math.max(...sourceBreakdown.map((s) => s.count), 1);
              const pct = Math.round((item.count / maxCount) * 100);
              return (
                <div key={item.source} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', colors.dot)} />
                      <span className={cn('text-xs font-medium', colors.text)}>
                        {SOURCE_LABELS[item.source] || item.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.count} records</span>
                      <span className="font-medium text-foreground">{item.avgScore}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700 ease-out', colors.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confidence Distribution — Stacked Bar */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Confidence Distribution</h4>
        <ConfidenceStackedBar distribution={confidenceDistribution} />
      </div>
    </div>
  );
}

// ─── Confidence Stacked Bar ─────────────────────────────────────

function ConfidenceStackedBar({ distribution }: { distribution: ConfidenceDistribution }) {
  const total = distribution.high + distribution.medium + distribution.low;

  if (total === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">No confidence data available</p>;
  }

  const highPct = Math.round((distribution.high / total) * 100);
  const medPct = Math.round((distribution.medium / total) * 100);
  const lowPct = 100 - highPct - medPct;

  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden bg-muted">
        {highPct > 0 && (
          <div
            className="bg-emerald-500 dark:bg-emerald-400 transition-all duration-700"
            style={{ width: `${highPct}%` }}
          />
        )}
        {medPct > 0 && (
          <div
            className="bg-amber-500 dark:bg-amber-400 transition-all duration-700"
            style={{ width: `${medPct}%` }}
          />
        )}
        {lowPct > 0 && (
          <div
            className="bg-red-500 dark:bg-red-400 transition-all duration-700"
            style={{ width: `${lowPct}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">High</span>
            <span className="font-medium text-foreground">{distribution.high}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">Medium</span>
            <span className="font-medium text-foreground">{distribution.medium}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Low</span>
            <span className="font-medium text-foreground">{distribution.low}</span>
          </div>
        </div>
        <span className="text-muted-foreground">{total} total</span>
      </div>
    </div>
  );
}
