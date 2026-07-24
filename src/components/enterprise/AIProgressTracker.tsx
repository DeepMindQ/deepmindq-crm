'use client';

import { Circle, Loader2, Check, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

interface AIProgressTrackerProps {
  steps: Step[];
  className?: string;
}

const statusConfig: Record<Step['status'], { icon: typeof Circle; color: string; ring: string; bg?: string; animate?: boolean }> = {
  pending: { icon: Circle, color: 'text-slate-300', ring: 'border-slate-200' },
  processing: { icon: Loader2, color: 'text-blue-600', ring: 'border-blue-300', animate: true },
  complete: { icon: Check, color: 'text-emerald-600', ring: 'border-emerald-300', bg: 'bg-emerald-50' },
  error: { icon: XCircle, color: 'text-red-500', ring: 'border-red-300', bg: 'bg-red-50' },
};

export function AIProgressTracker({ steps, className }: AIProgressTrackerProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {steps.map((step, idx) => {
        const config = statusConfig[step.status];
        const Icon = config.icon;
        const isLast = idx === steps.length - 1;

        return (
          <div key={idx} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2',
                  config.ring,
                  config.bg,
                  step.status === 'processing' && 'bg-blue-50'
                )}
              >
                <Icon
                  className={cn('h-3.5 w-3.5', config.color, config.animate && 'animate-spin')}
                />
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[24px]',
                    step.status === 'complete' ? 'bg-emerald-300' :
                    step.status === 'error' ? 'bg-red-200' : 'bg-slate-200'
                  )}
                />
              )}
            </div>
            <div className={cn('pb-6', isLast && 'pb-0')}>
              <p
                className={cn(
                  'text-sm font-medium leading-snug',
                  step.status === 'pending' ? 'text-slate-400' :
                  step.status === 'error' ? 'text-red-700' : 'text-slate-800'
                )}
              >
                {step.label}
              </p>
              {step.status === 'processing' && (
                <p className="mt-0.5 text-xs text-blue-500 italic">Processing...</p>
              )}
              {step.status === 'complete' && (
                <p className="mt-0.5 text-xs text-emerald-600">Done</p>
              )}
              {step.status === 'error' && (
                <p className="mt-0.5 text-xs text-red-500">Failed</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
