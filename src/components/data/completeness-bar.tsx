'use client'

import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'

export type FreshnessLevel = 'fresh' | 'stale' | 'critical' | 'unknown'

export interface DataField {
  name: string
  complete: boolean
  value?: string
  lastUpdated?: string
  source?: string
}

export interface CompletenessBarProps {
  fields: DataField[]
  overallScore: number // 0-100
  lastSync?: string
  entityName?: string
  className?: string
  onRefresh?: () => void
  isRefreshing?: boolean
  compact?: boolean
}

function getFreshness(lastUpdated?: string): FreshnessLevel {
  if (!lastUpdated) return 'unknown'
  const diffMs = Date.now() - new Date(lastUpdated).getTime()
  const diffDays = diffMs / 86400000
  if (diffDays < 7) return 'fresh'
  if (diffDays < 30) return 'stale'
  return 'critical'
}

const FRESHNESS_CONFIG: Record<FreshnessLevel, { color: string; label: string; icon: typeof CheckCircle2 }> = {
  fresh: { color: tokens.confidence.high.value, label: 'Fresh', icon: CheckCircle2 },
  stale: { color: tokens.confidence.medium.value, label: 'Stale', icon: Clock },
  critical: { color: tokens.confidence.low.value, label: 'Critical', icon: AlertCircle },
  unknown: { color: tokens.text.muted, label: 'Unknown', icon: Database },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function CompletenessBar({ fields, overallScore, lastSync, entityName, className, onRefresh, isRefreshing, compact = false }: CompletenessBarProps) {
  const filledCount = fields.filter(f => f.complete).length
  const totalCount = fields.length
  const scoreColor = overallScore >= 80 ? tokens.confidence.high.value : overallScore >= 50 ? tokens.confidence.medium.value : tokens.confidence.low.value

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: tokens.surface.secondary }}>
          <motion.div className="h-full rounded-full" style={{ background: scoreColor }} initial={{ width: 0 }} animate={{ width: `${overallScore}%` }} transition={{ duration: 0.6 }} />
        </div>
        <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ color: scoreColor }}>{overallScore}%</span>
        <span className="text-[10px] shrink-0" style={{ color: tokens.text.muted }}>{filledCount}/{totalCount}</span>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border overflow-hidden', className)} style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" style={{ color: tokens.domain.enrichment }} />
          <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
            {entityName ? `Data: ${entityName}` : 'Data Completeness'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: `${scoreColor}15`, color: scoreColor }}>
            {overallScore}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: tokens.text.muted }}>
              <Clock className="w-3 h-3" />Synced {timeAgo(lastSync)}
            </span>
          )}
          {onRefresh && (
            <motion.button onClick={onRefresh} disabled={isRefreshing} className="p-1 rounded hover:bg-white/5" whileTap={{ scale: 0.9 }} animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }} transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}>
              <RefreshCw className="w-3.5 h-3.5" style={{ color: tokens.text.secondary }} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Overall bar */}
      <div className="px-4 pb-3">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: tokens.surface.secondary }}>
          <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}aa)` }} initial={{ width: 0 }} animate={{ width: `${overallScore}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px]" style={{ color: tokens.text.muted }}>{filledCount} of {totalCount} fields complete</span>
          <span className="text-[10px]" style={{ color: tokens.text.muted }}>{overallScore}% complete</span>
        </div>
      </div>

      {/* Field list */}
      <div className="border-t" style={{ borderColor: tokens.border.default }}>
        <div className="divide-y" style={{ borderColor: tokens.border.subtle }}>
          {fields.map(field => {
            const freshness = getFreshness(field.lastUpdated)
            const freshConfig = FRESHNESS_CONFIG[freshness]
            const FreshIcon = freshConfig.icon
            return (
              <div key={field.name} className="flex items-center gap-3 px-4 py-2">
                <FreshIcon className="w-3.5 h-3.5 shrink-0" style={{ color: field.complete ? freshConfig.color : tokens.text.muted }} />
                <span className={cn('text-[11px] flex-1 truncate', !field.complete && 'italic')} style={{ color: field.complete ? tokens.text.primary : tokens.text.muted }}>
                  {field.name}
                </span>
                {field.value && (
                  <span className="text-[10px] truncate max-w-[150px]" style={{ color: tokens.text.secondary }}>{field.value}</span>
                )}
                {field.lastUpdated && (
                  <span className="text-[9px] shrink-0" style={{ color: freshConfig.color }}>{timeAgo(field.lastUpdated)}</span>
                )}
                {field.source && (
                  <span className="text-[9px] px-1 rounded shrink-0" style={{ background: tokens.surface.secondary, color: tokens.text.muted }}>{field.source}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
