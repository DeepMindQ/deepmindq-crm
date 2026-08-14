'use client';

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { C, type StatCardData } from './hub-types';

// ═══════════════════════════════════════════════════════════════
// STAT CARD WIDGET
// ═══════════════════════════════════════════════════════════════

export function StatCardWidget({ stat }: { stat: StatCardData }) {
  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl transition-colors duration-200"
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = C.bgCardHover;
        (e.currentTarget as HTMLElement).style.borderColor = C.borderLight;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = C.bgCard;
        (e.currentTarget as HTMLElement).style.borderColor = C.border;
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex items-center justify-center h-9 w-9 rounded-lg"
          style={{ background: stat.accentBg, color: stat.accentColor }}
        >
          {stat.icon}
        </div>
        <div className="flex items-center gap-1">
          {stat.change > 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5" style={{ color: C.success }} />
          ) : stat.change < 0 ? (
            <ArrowDownRight className="h-3.5 w-3.5" style={{ color: C.danger }} />
          ) : null}
          <span
            className="text-xs font-medium"
            style={{
              color: stat.change > 0 ? C.success : stat.change < 0 ? C.danger : C.textMuted,
            }}
          >
            {stat.change > 0 ? '+' : ''}
            {stat.change}%
          </span>
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight" style={{ color: C.textPrimary }}>
          {stat.value}
        </div>
        <div className="text-xs mt-0.5" style={{ color: C.textSecondary }}>
          {stat.label}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CIRCULAR PROGRESS
// ═══════════════════════════════════════════════════════════════

export function CircularProgress({
  value,
  size = 56,
  strokeWidth = 5,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const getColor = (v: number) => {
    if (v >= 80) return C.success;
    if (v >= 60) return C.accent;
    if (v >= 40) return C.warning;
    return C.danger;
  };

  const color = getColor(value);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={C.border}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
