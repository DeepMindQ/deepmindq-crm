'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radar, Filter, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'
import { SignalCard, type Signal, type SignalSeverity, type SignalSource } from './signal-card'

export interface SignalCardListProps {
  signals: Signal[]
  onDismiss?: (id: string) => void
  onAction?: (signalId: string, action: any) => void
  onNavigate?: (href: string) => void
  className?: string
  title?: string
  variant?: 'full' | 'compact'
  maxVisible?: number
}

const SEVERITY_ORDER: Record<SignalSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

const SEVERITY_COLORS: Record<SignalSeverity, string> = {
  critical: tokens.priority.critical.value,
  high: tokens.priority.high.value,
  medium: tokens.priority.medium.value,
  low: tokens.priority.low.value,
  info: tokens.domain.signal,
}

export function SignalCardList({ signals, onDismiss, onAction, onNavigate, className, title, variant = 'full', maxVisible }: SignalCardListProps) {
  const [filterSeverity, setFilterSeverity] = useState<SignalSeverity | 'all'>('all')
  const [filterSource, setFilterSource] = useState<SignalSource | 'all'>('all')

  const sorted = [...signals].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sevDiff !== 0) return sevDiff
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  })

  const filtered = sorted.filter(s => {
    if (filterSeverity !== 'all' && s.severity !== filterSeverity) return false
    if (filterSource !== 'all' && s.source !== filterSource) return false
    return true
  })

  const visible = maxVisible ? filtered.slice(0, maxVisible) : filtered

  return (
    <div className={cn('rounded-xl border overflow-hidden', className)} style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: tokens.border.default }}>
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4" style={{ color: tokens.domain.signal }} />
          <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{title || 'Signal Intelligence'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${tokens.domain.signal}15`, color: tokens.domain.signal }}>
            {filtered.length}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b overflow-x-auto" style={{ borderColor: tokens.border.subtle }}>
        <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map(sev => (
          <button key={sev} onClick={() => setFilterSeverity(sev)} className={cn('text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors', filterSeverity === sev ? 'font-semibold' : 'opacity-50')} style={{ background: filterSeverity === sev ? `${sev === 'all' ? tokens.text.primary : SEVERITY_COLORS[sev as SignalSeverity]}15` : 'transparent', color: filterSeverity === sev ? (sev === 'all' ? tokens.text.primary : SEVERITY_COLORS[sev as SignalSeverity]) : tokens.text.secondary }}>
            {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
          </button>
        ))}
        <span className="text-[10px] ml-auto shrink-0" style={{ color: tokens.text.muted }}>Source:</span>
        {(['all', 'ai_detected', 'web_scraping', 'crm_sync'] as const).map(src => (
          <button key={src} onClick={() => setFilterSource(src)} className={cn('text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors', filterSource === src ? 'font-semibold' : 'opacity-50')} style={{ background: filterSource === src ? `${tokens.text.primary}15` : 'transparent', color: filterSource === src ? tokens.text.primary : tokens.text.secondary }}>
            {src === 'all' ? 'All' : src.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Signal list */}
      <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {visible.map(signal => (
            <SignalCard key={signal.id} signal={signal} onDismiss={onDismiss} onAction={onAction} onNavigate={onNavigate} variant={variant} />
          ))}
        </AnimatePresence>
        {visible.length === 0 && (
          <div className="py-8 text-center">
            <Radar className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
            <p className="text-xs" style={{ color: tokens.text.secondary }}>No matching signals</p>
          </div>
        )}
      </div>
    </div>
  )
}
