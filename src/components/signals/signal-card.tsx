'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radar, AlertTriangle, TrendingUp, Clock, ExternalLink, ChevronDown, ChevronRight, Zap, ArrowRight, Eye, EyeOff, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'

export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type SignalSource = 'ai_detected' | 'web_scraping' | 'crm_sync' | 'manual' | 'enrichment'

export interface SignalAction {
  id: string
  label: string
  type: 'navigate' | 'dismiss' | 'snooze' | 'create_opportunity' | 'assign'
  href?: string
}

export interface Signal {
  id: string
  title: string
  description: string
  severity: SignalSeverity
  source: SignalSource
  confidence: number // 0-100
  company?: { id: string; name: string }
  detectedAt: string
  expiresAt?: string
  tags?: string[]
  actions?: SignalAction[]
  metadata?: Record<string, string>
}

export interface SignalCardProps {
  signal: Signal
  onDismiss?: (id: string) => void
  onAction?: (signalId: string, action: SignalAction) => void
  onNavigate?: (href: string) => void
  variant?: 'full' | 'compact'
  className?: string
  isDismissible?: boolean
}

const SEVERITY_CONFIG: Record<SignalSeverity, { color: string; bg: string; icon: typeof Radar; label: string }> = {
  critical: { color: tokens.priority.critical.value, bg: `${tokens.priority.critical.value}12`, icon: AlertTriangle, label: 'Critical' },
  high:     { color: tokens.priority.high.value,     bg: `${tokens.priority.high.value}12`,     icon: Zap,         label: 'High' },
  medium:   { color: tokens.priority.medium.value,   bg: `${tokens.priority.medium.value}12`,   icon: TrendingUp,   label: 'Medium' },
  low:      { color: tokens.priority.low.value,      bg: `${tokens.priority.low.value}12`,      icon: Radar,       label: 'Low' },
  info:     { color: tokens.domain.signal,           bg: `${tokens.domain.signal}12`,           icon: Eye,         label: 'Info' },
}

const SOURCE_LABELS: Record<SignalSource, string> = {
  ai_detected: 'AI Detected', web_scraping: 'Web Scraping', crm_sync: 'CRM Sync', manual: 'Manual', enrichment: 'Enrichment',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function SignalCard({ signal, onDismiss, onAction, onNavigate, variant = 'full', className, isDismissible = true }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [snoozed, setSnoozed] = useState(false)
  const sevConfig = SEVERITY_CONFIG[signal.severity]
  const SevIcon = sevConfig.icon

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.(signal.id)
  }

  const handleSnooze = () => {
    setSnoozed(true)
  }

  if (dismissed || snoozed) return null

  if (variant === 'compact') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className={cn('flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer hover:border-opacity-60 transition-all', className)}
        style={{ background: tokens.surface.card, borderColor: tokens.border.default }}
        onClick={() => onNavigate?.(signal.actions?.[0]?.href || `#accounts`)}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: sevConfig.bg }}>
          <SevIcon className="w-3.5 h-3.5" style={{ color: sevConfig.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium truncate" style={{ color: tokens.text.primary }}>{signal.title}</p>
          <p className="text-[10px] truncate" style={{ color: tokens.text.secondary }}>{signal.company?.name}</p>
        </div>
        <span className="text-[10px] shrink-0" style={{ color: tokens.text.muted }}>{timeAgo(signal.detectedAt)}</span>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, height: 0 }}
      className={cn('rounded-xl border overflow-hidden', className)}
      style={{ background: tokens.surface.card, borderColor: `${sevConfig.color}30` }}
    >
      {/* Header stripe */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${sevConfig.color}, transparent)` }} />

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: sevConfig.bg }}>
            <SevIcon className="w-4.5 h-4.5" style={{ color: sevConfig.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: sevConfig.bg, color: sevConfig.color }}>
                {sevConfig.label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: tokens.surface.secondary, color: tokens.text.secondary }}>
                {SOURCE_LABELS[signal.source]}
              </span>
              <span className="text-[10px] ml-auto shrink-0 flex items-center gap-1" style={{ color: tokens.text.muted }}>
                <Clock className="w-3 h-3" />{timeAgo(signal.detectedAt)}
              </span>
            </div>
            <h4 className="text-sm font-semibold mb-1" style={{ color: tokens.text.primary }}>{signal.title}</h4>
            <p className="text-[11px] leading-relaxed" style={{ color: tokens.text.secondary }}>{signal.description}</p>
          </div>
        </div>

        {/* Company + Confidence row */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t" style={{ borderColor: tokens.border.subtle }}>
          {signal.company && (
            <div className="flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3" style={{ color: tokens.domain.signal }} />
              <span className="text-[11px] font-medium" style={{ color: tokens.text.primary }}>{signal.company.name}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px]" style={{ color: tokens.text.muted }}>Confidence</span>
            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: tokens.surface.secondary }}>
              <div className="h-full rounded-full" style={{
                width: `${signal.confidence}%`,
                background: signal.confidence >= 70 ? tokens.confidence.high.value : signal.confidence >= 45 ? tokens.confidence.medium.value : tokens.confidence.low.value,
              }} />
            </div>
            <span className="text-[11px] font-mono tabular-nums w-6 text-right" style={{ color: tokens.text.secondary }}>{signal.confidence}</span>
          </div>
        </div>

        {/* Tags */}
        {signal.tags && signal.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {signal.tags.map(tag => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: tokens.surface.secondary, color: tokens.text.muted }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Expandable details */}
        {signal.metadata && Object.keys(signal.metadata).length > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: tokens.text.secondary }}>
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Details
          </button>
        )}
        <AnimatePresence>
          {expanded && signal.metadata && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 rounded-lg p-2.5 space-y-1" style={{ background: tokens.surface.secondary }}>
                {Object.entries(signal.metadata).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-[10px] font-medium min-w-[100px]" style={{ color: tokens.text.secondary }}>{k}:</span>
                    <span className="text-[10px]" style={{ color: tokens.text.primary }}>{v}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        {signal.actions && signal.actions.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: tokens.border.subtle }}>
            {signal.actions.slice(0, 3).map(action => (
              <button
                key={action.id}
                onClick={() => {
                  if (action.type === 'navigate' && action.href) onNavigate?.(action.href)
                  else onAction?.(signal.id, action)
                }}
                className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: sevConfig.color, border: `1px solid ${sevConfig.color}30` }}
              >
                <ArrowRight className="w-3 h-3" />
                {action.label}
              </button>
            ))}
            {isDismissible && (
              <button onClick={handleSnooze} className="ml-auto p-1.5 rounded-lg hover:bg-white/5" title="Snooze">
                <EyeOff className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
              </button>
            )}
            {isDismissible && (
              <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-white/5" title="Dismiss">
                <Bookmark className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
