'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Eye, Bookmark, Monitor, Calendar, Download, ChevronDown
} from 'lucide-react';

export type CTAAction = 'review' | 'save' | 'monitor' | 'schedule' | 'export' | 'expand';

export interface ActionCTAProps {
  action: CTAAction;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

const iconMap: Record<CTAAction, React.ElementType> = {
  review: Eye,
  save: Bookmark,
  monitor: Monitor,
  schedule: Calendar,
  export: Download,
  expand: ChevronDown,
};

const defaultLabels: Record<CTAAction, string> = {
  review: 'Review',
  save: 'Save',
  monitor: 'Monitor',
  schedule: 'Schedule',
  export: 'Export',
  expand: 'Details',
};

export function ActionCTA({
  action,
  label,
  variant = 'secondary',
  size = 'sm',
  onClick,
  className,
}: ActionCTAProps) {
  const Icon = iconMap[action];
  const displayLabel = label || defaultLabels[action];

  return (
    <Button
      variant={variant === 'primary' ? 'default' : variant === 'ghost' ? 'ghost' : 'outline'}
      size={size === 'sm' ? 'sm' : 'default'}
      onClick={onClick}
      className={cn(
        'gap-1.5 font-medium transition-colors min-h-[44px]',
        variant === 'primary' && 'bg-[var(--signal-blue)] hover:bg-[var(--signal-blue-high)] text-white border-0',
        variant === 'secondary' && 'border-[var(--border)] text-[var(--primary)] hover:bg-[var(--glass-card-bg)] hover:border-[var(--border-light)]',
        variant === 'ghost' && 'text-[var(--primary-dim)] hover:text-[var(--primary)] hover:bg-[var(--signal-blue-low)]',
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {displayLabel}
    </Button>
  );
}
