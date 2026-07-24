'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-12 px-6 text-center', className)}>
      <div className='flex h-12 w-12 items-center justify-center rounded-full bg-red-50'>
        <AlertTriangle className='h-6 w-6 text-red-500' />
      </div>
      <div className='flex flex-col gap-1.5 max-w-sm'>
        <h3 className='text-sm font-semibold text-slate-900'>{title}</h3>
        <p className='text-sm text-slate-500 leading-relaxed'>{message}</p>
      </div>
      {onRetry && (
        <Button
          variant='outline'
          size='sm'
          onClick={onRetry}
          className='gap-2 text-slate-600 border-slate-300 hover:bg-slate-50'
        >
          <RefreshCw className='h-3.5 w-3.5' />
          Try again
        </Button>
      )}
    </div>
  );
}
