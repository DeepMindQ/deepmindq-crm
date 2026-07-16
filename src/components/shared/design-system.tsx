'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'
import {
  Building2, Users, Mail, FileText, ShieldCheck, Upload, Trash2, Sparkles, AlertTriangle, Edit3
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   Empty State — rich, actionable, Apple-level
   ═══════════════════════════════════════════════════════════════ */
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6', className)}>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-gray-100 mb-4">
        <Icon className="size-7 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm text-center mb-6 leading-relaxed">{description}</p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-3">
          {actionLabel && (
            <Button
              onClick={onAction}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs"
            >
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && (
            <Button
              variant="outline"
              onClick={onSecondaryAction}
              className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Score Gauge — radial with breakdown segments
   ═══════════════════════════════════════════════════════════════ */
interface ScoreGaugeProps {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
  segments?: { label: string; value: number; color: string }[]
  className?: string
}

export function ScoreGauge({
  score,
  size = 120,
  strokeWidth = 10,
  label = 'Intel Score',
  sublabel,
  segments,
  className,
}: ScoreGaugeProps) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const getColor = (s: number) =>
    s >= 80 ? '#059669' : s >= 60 ? '#D97706' : s >= 40 ? '#F59E0B' : '#DC2626'

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke={getColor(score)} strokeWidth={strokeWidth}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900 tabular-nums">{score}</span>
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mt-0.5">of 100</span>
        </div>
      </div>
      {label && <p className="text-sm font-semibold text-gray-900">{label}</p>}
      {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
      {segments && (
        <div className="flex flex-col gap-2 w-full max-w-[200px]">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-gray-600">{seg.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[100px] ml-4">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${seg.value}%`, backgroundColor: seg.color }}
                  />
                </div>
                <span className="text-gray-500 font-medium tabular-nums w-7 text-right">{seg.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Trend Indicator — ↑ 12% vs last week
   ═══════════════════════════════════════════════════════════════ */
interface TrendIndicatorProps {
  value: number
  period?: string
  className?: string
}

export function TrendIndicator({ value, period = 'vs last week', className }: TrendIndicatorProps) {
  const isPositive = value >= 0
  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium', className)}>
      <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
        {isPositive ? '↑' : '↓'} {Math.abs(value)}%
      </span>
      <span className="text-gray-400">{period}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Sparkline — tiny inline chart
   ═══════════════════════════════════════════════════════════════ */
interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export function Sparkline({ data, width = 80, height = 32, color = '#D97706', className }: SparklineProps) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`)
    .join(' ')
  const area = `0,${height} ${pts} ${width},${height}`
  const gradId = `sg-${color.replace('#','')}`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn('shrink-0', className)} fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={pts} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Activity Icon — maps action strings to styled icons
   ═══════════════════════════════════════════════════════════════ */
const activityIconMap: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  company_created:    { icon: Building2,    color: 'text-blue-600',    bg: 'bg-blue-50' },
  contact_added:      { icon: Users,        color: 'text-violet-600', bg: 'bg-violet-50' },
  email_generated:    { icon: Mail,         color: 'text-amber-600',  bg: 'bg-amber-50' },
  research_generated: { icon: Sparkles,     color: 'text-indigo-600', bg: 'bg-indigo-50' },
  note_added:         { icon: FileText,     color: 'text-gray-600',   bg: 'bg-gray-100' },
  email_validated:    { icon: ShieldCheck,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  import_completed:   { icon: Upload,       color: 'text-blue-600',   bg: 'bg-blue-50' },
  deleted:            { icon: Trash2,       color: 'text-red-500',    bg: 'bg-red-50' },
  status_changed:     { icon: Edit3,        color: 'text-amber-600',  bg: 'bg-amber-50' },
  error:              { icon: AlertTriangle, color: 'text-red-500',   bg: 'bg-red-50' },
}

export function getActivityIcon(action: string) {
  const norm = action.toLowerCase().replace(/\s+/g, '_')
  for (const [key, val] of Object.entries(activityIconMap)) {
    if (norm.includes(key)) return val
  }
  return { icon: FileText, color: 'text-gray-500', bg: 'bg-gray-100' }
}

/* ═══════════════════════════════════════════════════════════════
   Status Dot — colored dot with optional pulse
   ═══════════════════════════════════════════════════════════════ */
interface StatusDotProps {
  status: 'fresh' | 'stale' | 'old' | 'unknown'
  pulse?: boolean
  className?: string
}

export function StatusDot({ status, pulse, className }: StatusDotProps) {
  const c = { fresh: 'bg-emerald-500', stale: 'bg-amber-400', old: 'bg-red-500', unknown: 'bg-gray-300' }
  return (
    <span className={cn('relative flex size-2.5', className)}>
      {pulse && status === 'fresh' && (
        <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-40" />
      )}
      <span className={cn('relative inline-flex size-2.5 rounded-full', c[status])} />
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Skeleton Grid — premium loading state
   ═══════════════════════════════════════════════════════════════ */
interface SkeletonGridProps {
  cols?: number
  panels?: number
  className?: string
}

export function SkeletonGrid({ cols = 4, panels = 2, className }: SkeletonGridProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-5 space-y-3 animate-pulse">
            <div className="flex justify-between">
              <div className="space-y-2">
                <div className="h-3 w-20 rounded bg-gray-100" />
                <div className="h-7 w-16 rounded bg-gray-100" />
              </div>
              <div className="h-10 w-10 rounded-xl bg-gray-100" />
            </div>
            <div className="h-3 w-24 rounded bg-gray-100" />
          </div>
        ))}
      </div>
      {Array.from({ length: panels }).map((_, i) => (
        <div key={i} className="rounded-xl bg-white p-6 animate-pulse">
          <div className="h-4 w-40 rounded bg-gray-100 mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="h-12 w-full rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Sortable Header — for table columns
   ═══════════════════════════════════════════════════════════════ */
interface SortableHeaderProps {
  label: string
  sortKey: string
  currentSort: string
  currentDir: 'asc' | 'desc'
  onSort: (key: string) => void
  className?: string
}

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export function SortableHeader({ label, sortKey, currentSort, currentDir, onSort, className }: SortableHeaderProps) {
  const active = currentSort === sortKey
  return (
    <th
      className={cn(
        'text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 cursor-pointer select-none group transition-colors hover:text-gray-900',
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          currentDir === 'asc' ? <ArrowUp className="size-3 text-amber-600" /> : <ArrowDown className="size-3 text-amber-600" />
        ) : (
          <ArrowUpDown className="size-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
        )}
      </div>
    </th>
  )
}