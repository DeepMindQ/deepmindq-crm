/* ═══════════════════════════════════════════════════
   Confidence Indicator — Visual confidence level
   
   Displays a colored dot/bar with optional label.
   High = green, Medium = amber, Low = red.
   
   Phase 2.9: Updated to use 5-tier trust classification from
   the unified confidence system (ai-unified-confidence.ts).
   ═══════════════════════════════════════════════════ */

'use client';

import { cn } from '@/lib/utils';

interface ConfidenceIndicatorProps {
  level: 'high' | 'medium' | 'low';
  label?: string;
  variant?: 'dot' | 'bar' | 'badge';
  /** Phase 2.9: Direct numeric score (0-100). When provided, maps to 5-tier trust classification. */
  score?: number;
  className?: string;
}

function scoreToLevel(score: number): 'high' | 'medium' | 'low' {
  // Phase 2.9: Map unified 5-tier to 3-tier for backward compat
  // A+, A, A- (80-100) → high
  // B+, B, B-, C+ (50-79) → medium  
  // C, C-, D, F (0-49) → low
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

const LEVEL_CONFIG = {
  high: {
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    label: 'text-emerald-600 dark:text-emerald-400',
    width: 'w-full',
  },
  medium: {
    dot: 'bg-amber-500 dark:bg-amber-400',
    bar: 'bg-amber-500 dark:bg-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    label: 'text-amber-600 dark:text-amber-400',
    width: 'w-2/3',
  },
  low: {
    dot: 'bg-red-500 dark:bg-red-400',
    bar: 'bg-red-500 dark:bg-red-400',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-red-200 dark:border-red-500/30',
    label: 'text-red-600 dark:text-red-400',
    width: 'w-1/3',
  },
};

const LEVEL_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function ConfidenceIndicator({ level, label, variant = 'dot', score, className }: ConfidenceIndicatorProps) {
  // Phase 2.9: Use score-based level when score is provided
  const resolvedLevel = score !== undefined ? scoreToLevel(score) : level;
  const config = LEVEL_CONFIG[resolvedLevel];
  const displayLabel = label || LEVEL_LABELS[level];

  if (variant === 'badge') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.badge,
        className
      )}>
        <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
        {displayLabel}
      </span>
    );
  }

  if (variant === 'bar') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-500', config.bar, config.width)} />
        </div>
        <span className={cn('text-xs font-medium min-w-[3rem] text-right', config.label)}>
          {displayLabel}
        </span>
      </div>
    );
  }

  // Default: dot variant
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', config.dot)} />
      {displayLabel && (
        <span className={cn('text-xs font-medium', config.label)}>{displayLabel}</span>
      )}
    </div>
  );
}