/* ═══════════════════════════════════════════════════
   Trust Score Badge — Reusable grade indicator
   
   Displays a TRUST grade (A+ through F) with color coding
   and optional numeric score.
   ═══════════════════════════════════════════════════ */

'use client';

import { cn } from '@/lib/utils';

interface TrustScoreBadgeProps {
  score: number;
  grade: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const GRADE_STYLES: Record<string, { bg: string; text: string; ring: string; glow: string }> = {
  'A+': {
    bg: 'bg-emerald-500/15 dark:bg-emerald-400/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-500/30',
    glow: 'shadow-emerald-500/20',
  },
  'A': {
    bg: 'bg-emerald-500/15 dark:bg-emerald-400/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-500/20',
    glow: 'shadow-emerald-500/10',
  },
  'B': {
    bg: 'bg-sky-500/15 dark:bg-sky-400/10',
    text: 'text-sky-600 dark:text-sky-400',
    ring: 'ring-sky-500/20',
    glow: 'shadow-sky-500/10',
  },
  'C': {
    bg: 'bg-amber-500/15 dark:bg-amber-400/10',
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500/20',
    glow: 'shadow-amber-500/10',
  },
  'D': {
    bg: 'bg-orange-500/15 dark:bg-orange-400/10',
    text: 'text-orange-600 dark:text-orange-400',
    ring: 'ring-orange-500/20',
    glow: 'shadow-orange-500/10',
  },
  'F': {
    bg: 'bg-red-500/15 dark:bg-red-400/10',
    text: 'text-red-600 dark:text-red-400',
    ring: 'ring-red-500/20',
    glow: 'shadow-red-500/10',
  },
};

const SIZE_STYLES = {
  sm: { grade: 'text-lg font-bold', score: 'text-xs', wrapper: 'px-2 py-1' },
  md: { grade: 'text-2xl font-bold', score: 'text-sm', wrapper: 'px-4 py-2' },
  lg: { grade: 'text-5xl font-extrabold tracking-tight', score: 'text-base', wrapper: 'px-8 py-6' },
};

export function TrustScoreBadge({ score, grade, size = 'md', className }: TrustScoreBadgeProps) {
  const style = GRADE_STYLES[grade] || GRADE_STYLES['F'];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <div className={cn(
      'inline-flex flex-col items-center justify-center rounded-xl ring-1 shadow-lg',
      style.bg,
      style.ring,
      style.glow,
      sizeStyle.wrapper,
      className
    )}>
      <span className={cn(sizeStyle.grade, style.text)}>
        {grade}
      </span>
      <span className={cn(sizeStyle.score, 'text-muted-foreground font-medium')}>
        {score}/100
      </span>
    </div>
  );
}
