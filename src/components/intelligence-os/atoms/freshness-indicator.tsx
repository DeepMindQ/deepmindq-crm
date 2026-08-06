'use client';

import { Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatFreshness } from '@/lib/intelligence-types';

export interface FreshnessIndicatorProps {
  timestamp: string;
  showIcon?: boolean;
  className?: string;
}

export function FreshnessIndicator({ timestamp, showIcon = true, className = '' }: FreshnessIndicatorProps) {
  const relative = formatFreshness(timestamp);
  const absolute = new Date(timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const isStale = (Date.now() - new Date(timestamp).getTime()) > 24 * 60 * 60 * 1000;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${isStale ? 'text-[var(--warning-amber)]' : 'text-[var(--primary-dim)]'} ${className}`}
        >
          {showIcon && <Clock className="w-3 h-3" />}
          {relative}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <span>{absolute}</span>
      </TooltipContent>
    </Tooltip>
  );
}
