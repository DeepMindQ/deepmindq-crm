'use client';

import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  WifiOff,
  ShieldAlert,
  Clock,
  FileWarning,
  Bug,
  RefreshCw,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ═══════════════════════════════════════════════════
   ErrorPanel — Reusable error display component
   
   Categorized error display with retry, back, and copy-actions.
   Matches the design system (tokens) and provides clear
   user-facing messages per error category.
   
   Usage:
     <ErrorPanel error={error} onRetry={() => refetch()} />
     <ErrorPanel category="network" message="Failed to load contacts" />
     <ErrorPanel type="inline" error={err} onRetry={refetch} />
   
   ═══════════════════════════════════════════════════ */

export type ErrorCategory = 'network' | 'auth' | 'validation' | 'timeout' | 'runtime' | 'unknown';

export interface ErrorPanelProps {
  /** The error object (will auto-categorize) */
  error?: Error | null;
  /** Explicit category (overrides auto-detection) */
  category?: ErrorCategory;
  /** Custom message (overrides error.message) */
  message?: string;
  /** Title override */
  title?: string;
  /** Retry handler */
  onRetry?: () => void;
  /** Back navigation handler */
  onBack?: () => void;
  /** Layout: 'full' for centered page, 'inline' for embedded in content */
  variant?: 'full' | 'inline';
  /** Additional class names */
  className?: string;
  /** Compact mode — no icons, minimal spacing */
  compact?: boolean;
}

const categoryConfig: Record<
  ErrorCategory,
  {
    icon: LucideIcon;
    label: string;
    defaultMessage: string;
    colorClass: string;
    bgClass: string;
  }
> = {
  network: {
    icon: WifiOff,
    label: 'Network Error',
    defaultMessage:
      'Unable to connect to the server. Please check your internet connection and try again.',
    colorClass: 'text-orange-500',
    bgClass: 'bg-orange-500/10 border-orange-500/20',
  },
  auth: {
    icon: ShieldAlert,
    label: 'Access Denied',
    defaultMessage:
      'You do not have permission to view this content. Please contact your administrator.',
    colorClass: 'text-red-500',
    bgClass: 'bg-red-500/10 border-red-500/20',
  },
  validation: {
    icon: FileWarning,
    label: 'Invalid Data',
    defaultMessage: 'The request contained invalid data. Please review and try again.',
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10 border-amber-500/20',
  },
  timeout: {
    icon: Clock,
    label: 'Request Timed Out',
    defaultMessage: 'The request took too long. Please try again or reduce your query scope.',
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10 border-amber-500/20',
  },
  runtime: {
    icon: AlertTriangle,
    label: 'Runtime Error',
    defaultMessage: 'An unexpected error occurred. Our team has been notified.',
    colorClass: 'text-red-500',
    bgClass: 'bg-red-500/10 border-red-500/20',
  },
  unknown: {
    icon: Bug,
    label: 'Something Went Wrong',
    defaultMessage: 'An unexpected error occurred. Please try again.',
    colorClass: 'text-gray-500',
    bgClass: 'bg-gray-500/10 border-gray-500/20',
  },
};

function categorizeError(error: Error): ErrorCategory {
  const msg = error.message.toLowerCase();
  if (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed to fetch') ||
    msg.includes('net::')
  )
    return 'network';
  if (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('permission')
  )
    return 'auth';
  if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required'))
    return 'validation';
  if (msg.includes('timeout') || msg.includes('abort') || msg.includes('timed out'))
    return 'timeout';
  return 'runtime';
}

/**
 * Unified error display component.
 * Shows categorized error with icon, message, and action buttons.
 */
export function ErrorPanel({
  error,
  category,
  message,
  title,
  onRetry,
  onBack,
  variant = 'full',
  className,
  compact = false,
}: ErrorPanelProps) {
  const detectedCategory = category || (error ? categorizeError(error) : 'unknown');
  const config = categoryConfig[detectedCategory];
  const Icon = config.icon;
  const displayMessage = message || (error?.message ? error.message : config.defaultMessage);
  const displayTitle = title || 'Something went wrong';

  if (variant === 'inline' || compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border p-3 sm:p-4',
          config.bgClass,
          className,
        )}
        role="alert"
        aria-live="polite"
      >
        {!compact && <Icon className={cn('w-4 h-4 shrink-0', config.colorClass)} />}
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs font-medium', config.colorClass)}>{config.label}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{displayMessage}</p>
        </div>
        {onRetry && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={onRetry}>
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4',
        className,
      )}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div
        className={cn(
          'flex w-14 h-14 items-center justify-center rounded-2xl mb-4 border',
          config.bgClass,
        )}
      >
        <Icon className={cn('w-7 h-7', config.colorClass)} />
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-foreground mb-1">{displayTitle}</p>

      {/* Category label */}
      <p
        className={cn('text-[11px] font-semibold tracking-wider uppercase mb-2', config.colorClass)}
      >
        {config.label}
      </p>

      {/* Message */}
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{displayMessage}</p>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 justify-center">
        {onBack && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </Button>
        )}
        {onRetry && (
          <Button size="sm" className="gap-1.5" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
