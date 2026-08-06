'use client';

import type { PriorityLevel, SignalType } from '@/lib/intelligence-types';
import { getPriorityColor } from '@/lib/intelligence-types';

type BadgeVariant = 'priority' | 'signal' | 'status';

export interface StatusBadgeProps {
  variant: BadgeVariant;
  value: PriorityLevel | SignalType | string;
  label?: string;
  className?: string;
}

const signalColors: Record<string, string> = {
  leadership_change: 'var(--signal-blue)',
  technology_investment: 'var(--enrichment-cyan)',
  funding_event: 'var(--success-green)',
  market_expansion: 'var(--opportunity-purple)',
  partnership: 'var(--signal-blue)',
  product_launch: 'var(--enrichment-cyan)',
  hiring_surge: 'var(--success-green)',
  financial_signal: 'var(--warning-amber)',
  competitive_move: 'var(--risk-red)',
  risk_indicator: 'var(--risk-red)',
};

const signalLabels: Record<string, string> = {
  leadership_change: 'Leadership Change',
  technology_investment: 'Tech Investment',
  funding_event: 'Funding',
  market_expansion: 'Market Expansion',
  partnership: 'Partnership',
  product_launch: 'Product Launch',
  hiring_surge: 'Hiring Surge',
  financial_signal: 'Financial',
  competitive_move: 'Competitive Move',
  risk_indicator: 'Risk',
};

function formatSignalLabel(type: string): string {
  return signalLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function StatusBadge({ variant, value, label, className = '' }: StatusBadgeProps) {
  let color: string;
  let displayLabel: string;

  switch (variant) {
    case 'priority':
      color = getPriorityColor(value as PriorityLevel);
      displayLabel = label || (value as string).charAt(0).toUpperCase() + (value as string).slice(1);
      break;
    case 'signal':
      color = signalColors[value as string] || 'var(--signal-blue)';
      displayLabel = label || formatSignalLabel(value as string);
      break;
    default:
      color = 'var(--primary-dim)';
      displayLabel = label || (value as string);
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${className}`}
      style={{
        color,
        backgroundColor: color.replace(')', ', 0.12)').replace('var(', 'var(').includes('var(') ? undefined : undefined,
        border: `1px solid ${color}`,
        borderColor: color.includes('var(') ? color : `${color}30`,
      }}
    >
      {displayLabel}
    </span>
  );
}
