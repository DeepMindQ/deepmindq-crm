'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { tokens, getConfidenceTier, getTrustTier } from './design-tokens';
import type { TrustTier, ConfidenceBreakdown as ConfidenceBreakdownType } from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg, getTrustBorder, getTrustLabel } from '@/lib/intelligence-types';

/* ═══════════════════════════════════════════════════
   ConfidenceIndicator — Universal Confidence Display
   
   Single component for all confidence displays across
   the platform. Replaces all ConfidenceBar, ScoreRing,
   confidence badge variants.
   
   Modes:
   - ring: Circular SVG ring (default for narratives)
   - bar: Horizontal progress bar (for feeds, tables)
   - badge: Compact badge (for inline use)
   - score: Large numeric display (for dashboards)
   
   Principles:
   - Confidence as Universal Layer: Every intelligence carries confidence
   - Consistent Intelligence Language: Same visual language everywhere
   ═══════════════════════════════════════════════════ */

export type ConfidenceMode = 'ring' | 'bar' | 'badge' | 'score';

export interface ConfidenceIndicatorProps {
  value: number; // 0-100
  mode?: ConfidenceMode;
  label?: string;
  showPercentage?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  animated?: boolean;
  /** MS8 TrustTier — when provided, uses 5-tier trust colors instead of 3-tier confidence */
  trustTier?: TrustTier;
  /** MS8 ConfidenceBreakdown — when provided, enables tooltip on hover */
  breakdown?: ConfidenceBreakdownType;
  className?: string;
}

const sizeMap = {
  xs:  { ring: 28, bar: 'h-1',   badge: 'text-[9px]',  score: 'text-lg' },
  sm:  { ring: 36, bar: 'h-1.5', badge: 'text-[10px]', score: 'text-xl' },
  md:  { ring: 44, bar: 'h-2',   badge: 'text-[11px]', score: 'text-2xl' },
  lg:  { ring: 56, bar: 'h-2.5', badge: 'text-xs',    score: 'text-3xl' },
};

export function ConfidenceIndicator({
  value,
  mode = 'ring',
  label,
  showPercentage = true,
  size = 'md',
  animated = true,
  trustTier: explicitTier,
  breakdown,
  className,
}: ConfidenceIndicatorProps) {
  const [animatedValue, setAnimatedValue] = useState(animated ? 0 : value);
  const clamped = Math.max(0, Math.min(100, value));

  // MS8: Use explicit TrustTier if provided, otherwise fall back to 3-tier
  const ms8Tier = explicitTier || getTrustTier(clamped) as TrustTier;
  const useMS8Colors = Boolean(explicitTier);

  const legacyTier = getConfidenceTier(clamped);
  const color = useMS8Colors ? getTrustColor(ms8Tier) : tokens.confidence[legacyTier].value;
  const bg = useMS8Colors ? getTrustBg(ms8Tier) : tokens.confidence[legacyTier].bg;
  const s = sizeMap[size];

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setAnimatedValue(clamped), 50);
      return () => clearTimeout(timer);
    }
  }, [clamped, animated]);

  // ── Ring Mode ──
  if (mode === 'ring') {
    const strokeWidth = size === 'xs' ? 2 : size === 'sm' ? 2.5 : 3;
    const radius = (s.ring - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (animatedValue / 100) * circumference;
    const fontSize = s.ring * 0.24;

    return (
      <div className={cn('flex flex-col items-center gap-1', className)}>
        <div className="relative shrink-0" style={{ width: s.ring, height: s.ring }}>
          <svg width={s.ring} height={s.ring} className="-rotate-90">
            <circle
              cx={s.ring / 2} cy={s.ring / 2} r={radius}
              fill="none" stroke={tokens.border.subtle} strokeWidth={strokeWidth}
            />
            <circle
              cx={s.ring / 2} cy={s.ring / 2} r={radius}
              fill="none" stroke={color} strokeWidth={strokeWidth}
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {showPercentage && (
              <span className="font-bold tabular-nums" style={{ fontSize, color }}>
                {animatedValue}
              </span>
            )}
          </div>
        </div>
        {label && (
          <span className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>{label}</span>
        )}
      </div>
    );
  }

  // ── Bar Mode ──
  if (mode === 'bar') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        {(label || showPercentage) && (
          <div className="flex items-center justify-between">
            {label && (
              <span className="text-[10px] font-medium" style={{ color: tokens.text.secondary }}>{label}</span>
            )}
            {showPercentage && (
              <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>{clamped}%</span>
            )}
          </div>
        )}
        <div
          className={cn('w-full rounded-full overflow-hidden', s.bar)}
          style={{ background: tokens.border.subtle }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || `Confidence: ${clamped}%`}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${animatedValue}%`,
              background: color,
              transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>
    );
  }

  // ── Badge Mode ──
  if (mode === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold',
          s.badge,
          className
        )}
        style={{ background: bg, color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {showPercentage && `${clamped}%`}
        {label && !showPercentage && label}
      </span>
    );
  }

  // ── Score Mode ──
  return (
    <div className={cn('flex flex-col items-start gap-0.5', className)}>
      <span className={cn('font-bold tabular-nums leading-none', s.score)} style={{ color }}>
        {animatedValue}
      </span>
      {label && (
        <span className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>
          {label}
        </span>
      )}
      <div className="w-full h-1 rounded-full mt-1" style={{ background: tokens.border.subtle }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${animatedValue}%`,
            background: color,
            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
}
