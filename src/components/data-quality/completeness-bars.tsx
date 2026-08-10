'use client'

import { motion } from 'framer-motion'
import { tokens } from '@/components/intelligence-os/design-tokens';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface FieldCompleteness {
  field: string
  label: string
  filledPercentage: number // 0-100
  total: number
  filled: number
  category: 'contact' | 'company' | 'enrichment' | 'signal' | 'custom'
}

export interface CompletenessOverview {
  overallScore: number
  fields: FieldCompleteness[]
  totalRecords: number
  lastScan?: Date
}

interface DataCompletenessBarsProps {
  data: CompletenessOverview
  showDetails?: boolean
  compact?: boolean
  className?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  contact: tokens.accent.DEFAULT,
  company: tokens.domain.opportunity,
  enrichment: tokens.domain.enrichment,
  signal: tokens.domain.reasoning,
  custom: tokens.text.secondary,
}

function getStatus(score: number): { icon: typeof CheckCircle2; color: string; label: string } {
  if (score >= 80) return { icon: CheckCircle2, color: tokens.domain.action, label: 'Good' }
  if (score >= 50) return { icon: AlertTriangle, color: tokens.domain.reasoning, label: 'Needs Work' }
  return { icon: XCircle, color: tokens.domain.risk, label: 'Poor' }
}

export function DataCompletenessBars({ data, showDetails = true, className }: DataCompletenessBarsProps) {
  const status = getStatus(data.overallScore)
  const StatusIcon = status.icon

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <StatusIcon className="w-4 h-4" style={{ color: status.color }} />
          <h3 className="text-sm font-semibold">Data Completeness</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tabular-nums" style={{ color: status.color }}>
            {data.overallScore}%
          </span>
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5"
            style={{ background: `${status.color}15`, color: status.color, borderColor: `${status.color}30` }}
          >
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Overall bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">
            Overall completeness across {data.totalRecords.toLocaleString()} records
          </span>
        </div>
        <Progress value={data.overallScore} className="h-2" />
      </div>

      {/* Field breakdown */}
      {showDetails && (
        <div className="px-4 py-3 space-y-2.5 max-h-80 overflow-y-auto">
          {data.fields.map((field, i) => (
            <motion.div
              key={field.field}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: CATEGORY_COLORS[field.category] || tokens.text.secondary }}
                  />
                  <span className="text-xs font-medium">{field.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{field.filled}/{field.total}</span>
                  <span className={cn(
                    'text-xs font-semibold tabular-nums w-8 text-right',
                    field.filledPercentage >= 80 ? 'text-green-400' : field.filledPercentage >= 50 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {field.filledPercentage}%
                  </span>
                </div>
              </div>
              <Progress value={field.filledPercentage} className="h-1" />
            </motion.div>
          ))}
        </div>
      )}

      {data.lastScan && (
        <div className="px-4 py-2 border-t border-border">
          <span className="text-[10px] text-muted-foreground">Last scanned: {data.lastScan.toLocaleDateString()}</span>
        </div>
      )}
    </div>
  )
}
