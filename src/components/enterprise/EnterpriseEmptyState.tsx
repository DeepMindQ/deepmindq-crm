'use client';

import { LucideIcon } from 'lucide-react';

interface EnterpriseEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: 'default' | 'intelligence';
}

export function EnterpriseEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'default',
}: EnterpriseEmptyStateProps) {
  const accentColor = variant === 'intelligence' ? '#3B82F6' : '#3B82F6';

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{
          background: `${accentColor}15`,
          border: `1px solid ${accentColor}30`,
        }}
      >
        <Icon className="w-6 h-6" style={{ color: accentColor }} />
      </div>

      <h3 className="text-sm font-semibold mb-1.5" style={{ color: '#e8ecf4' }}>{title}</h3>
      {description && (
        <p className="text-xs mb-5" style={{ color: '#8892a8', maxWidth: '320px' }}>{description}</p>
      )}

      <div className="flex items-center gap-3">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: '#2563EB', color: '#fff' }}
          >
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ border: '1px solid #1e2535', color: '#8892a8' }}
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
