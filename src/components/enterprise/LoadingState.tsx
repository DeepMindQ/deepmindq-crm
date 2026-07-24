'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingStateProps {
  message?: string;
  lines?: number;
  className?: string;
}

export function LoadingState({
  message = 'Loading...',
  lines = 3,
  className,
}: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col gap-4 p-6', className)}>
      {message && (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          <span className="text-sm font-medium text-slate-600">{message}</span>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            {i < lines - 1 && <Skeleton className="h-4 w-4/5 rounded" />}
          </div>
        ))}
      </div>
    </div>
  );
}
