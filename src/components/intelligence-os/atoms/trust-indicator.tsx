'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, ShieldCheck, ShieldAlert, ShieldQuestion, CheckCircle2 } from 'lucide-react';
import type { TrustLevel } from '@/lib/intelligence-types';
import { getTrustColor, getTrustBg, getTrustBorder, getTrustLabel } from '@/lib/intelligence-types';

export interface TrustIndicatorProps {
  level: TrustLevel;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const iconMap: Record<TrustLevel, React.ElementType> = {
  verified: CheckCircle2,
  high: ShieldCheck,
  medium: ShieldAlert,
  low: ShieldAlert,
  unverified: ShieldQuestion,
};

const sizeMap = {
  sm: 'w-4 h-4 text-[10px]',
  md: 'w-5 h-5 text-xs',
  lg: 'w-6 h-6 text-sm',
};

const scoreSizeMap = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
};

export function TrustIndicator({ level, score, showScore = true, size = 'md', className = '' }: TrustIndicatorProps) {
  const Icon = iconMap[level];
  const color = getTrustColor(level);
  const bg = getTrustBg(level);
  const border = getTrustBorder(level);
  const label = getTrustLabel(level);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium tabular-nums ${sizeMap[size]} ${className}`}
          style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}
        >
          <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          {showScore && score !== undefined && (
            <span className={`font-mono font-semibold ${scoreSizeMap[size]}`}>{score}%</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <span>{label}{score !== undefined ? ` — ${score}% confidence` : ''}</span>
      </TooltipContent>
    </Tooltip>
  );
}
