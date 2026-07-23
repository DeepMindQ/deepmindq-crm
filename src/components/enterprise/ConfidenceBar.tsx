'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ConfidenceBarProps {
  value: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getConfidenceColor(value: number): string {
  if (value >= 80) return 'bg-emerald-500';
  if (value >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function getConfidenceTrackColor(value: number): string {
  if (value >= 80) return 'bg-emerald-100';
  if (value >= 60) return 'bg-amber-100';
  return 'bg-red-100';
}

function getConfidenceTextColor(value: number): string {
  if (value >= 80) return 'text-emerald-700';
  if (value >= 60) return 'text-amber-700';
  return 'text-red-700';
}

const sizeConfig = {
  sm: { bar: 'h-1.5', text: 'text-[10px]', percentage: 'text-xs' },
  md: { bar: 'h-2.5', text: 'text-xs', percentage: 'text-sm' },
  lg: { bar: 'h-3.5', text: 'text-sm', percentage: 'text-base' },
};

export function ConfidenceBar({
  value,
  label,
  showPercentage = true,
  size = 'md',
  className,
}: ConfidenceBarProps) {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const clampedValue = Math.max(0, Math.min(100, value));
  const config = sizeConfig[size];

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(clampedValue), 50);
    return () => clearTimeout(timer);
  }, [clampedValue]);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between">
          {label && (
            <span
              className={cn(
                'font-medium text-slate-600',
                config.text
              )}
            >
              {label}
            </span>
          )}
          {showPercentage && (
            <span
              className={cn(
                'font-semibold tabular-nums',
                getConfidenceTextColor(clampedValue),
                config.percentage
              )}
            >
              {clampedValue}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full overflow-hidden',
          getConfidenceTrackColor(clampedValue),
          config.bar
        )}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `Confidence: ${clampedValue}%`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            getConfidenceColor(clampedValue)
          )}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>
    </div>
  );
}
