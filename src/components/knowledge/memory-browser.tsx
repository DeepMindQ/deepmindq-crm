'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Search, BookOpen, Zap, TrendingUp, AlertCircle, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'

export type MemoryType = 'signal_detected' | 'pattern_learned' | 'model_updated' | 'correction' | 'enrichment' | 'relationship_mapped'
export type MemoryImpact = 'high' | 'medium' | 'low'

export interface MemoryEvent {
  id: string
  timestamp: string
  type: MemoryType
  impact: MemoryImpact
  title: string
  description: string
  entities: string[]
  confidence: number
  source: string
  details?: Record<string, string>
}

export interface MemoryBrowserProps {
  events: MemoryEvent[]
  className?: string
  onEventClick?: (event: MemoryEvent) => void
  title?: string
}

const TYPE_CONFIG: Record<MemoryType, { icon: typeof Brain; color: string; label: string }> = {
  signal_detected: { icon: Zap, color: tokens.domain.signal, label: 'Signal' },
  pattern_learned: { icon: Brain, color: tokens.domain.reasoning, label: 'Pattern' },
  model_updated: { icon: TrendingUp, color: tokens.confidence.high.value, label: 'Model Update' },
  correction: { icon: AlertCircle, color: tokens.domain.risk, label: 'Correction' },
  enrichment: { icon: BookOpen, color: tokens.domain.enrichment, label: 'Enrichment' },
  relationship_mapped: { icon: Share2, color: tokens.domain.opportunity, label: 'Relationship' },
}

const IMPACT_CONFIG: Record<MemoryImpact, { color: string; label: string }> = {
  high: { color: tokens.priority.critical.value, label: 'High' },
  medium: { color: tokens.priority.high.value, label: 'Medium' },
  low: { color: tokens.priority.low.value, label: 'Low' },
}

export function MemoryBrowser({ events, className, onEventClick, title }: MemoryBrowserProps) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<MemoryType | 'all'>('all')
  const [filterImpact, setFilterImpact] = useState<MemoryImpact | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filterType !== 'all' && event.type !== filterType) return false
      if (filterImpact !== 'all' && event.impact !== filterImpact) return false
      if (searchQuery && !event.title.toLowerCase().includes(searchQuery.toLowerCase()) && !event.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [events, filterType, filterImpact, searchQuery])

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffHrs = Math.floor(diffMs / 3600000)
    if (diffHrs < 1) return `${Math.floor(diffMs / 60000)}m ago`
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  }

  return (
    <div className={cn('rounded-xl border overflow-hidden', className)} style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: tokens.border.default }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4" style={{ color: tokens.domain.reasoning }} />
            <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{title || 'Learning Timeline'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${tokens.domain.reasoning}15`, color: tokens.domain.reasoning }}>
              {filteredEvents.length} events
            </span>
          </div>
        </div>
        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: tokens.text.muted }} />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-7 pl-8 pr-3 rounded-lg text-[11px] border bg-transparent outline-none focus:ring-1"
              style={{ borderColor: tokens.border.default, color: tokens.text.primary, ['--tw-ring-color' as string]: tokens.domain.signal }}
            />
          </div>
        </div>
        {/* Type + Impact filters */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <button onClick={() => setFilterType('all')} className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors', filterType === 'all' ? 'font-semibold' : 'opacity-60')} style={{ background: filterType === 'all' ? `${tokens.text.primary}15` : 'transparent', color: filterType === 'all' ? tokens.text.primary : tokens.text.secondary }}>All</button>
          {Object.entries(TYPE_CONFIG).map(([type, config]) => (
            <button key={type} onClick={() => setFilterType(type as MemoryType)} className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors flex items-center gap-1', filterType === type ? 'font-semibold' : 'opacity-60')} style={{ background: filterType === type ? `${config.color}15` : 'transparent', color: filterType === type ? config.color : tokens.text.secondary }}>
              <config.icon className="w-3 h-3" />{config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="max-h-[500px] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Brain className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
            <p className="text-xs" style={{ color: tokens.text.secondary }}>No matching events</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px" style={{ background: tokens.border.default }} />

            {filteredEvents.map((event) => {
              const typeConfig = TYPE_CONFIG[event.type]
              const impactConfig = IMPACT_CONFIG[event.impact]
              const TypeIcon = typeConfig.icon
              const isExpanded = expandedEvent === event.id

              return (
                <div key={event.id} className="relative pl-10 pr-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                  {/* Timeline dot */}
                  <div className="absolute left-3.5 top-3.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: tokens.surface.card, borderColor: typeConfig.color }} />

                  <button onClick={() => { setExpandedEvent(isExpanded ? null : event.id); onEventClick?.(event) }} className="w-full text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <TypeIcon className="w-3.5 h-3.5 shrink-0" style={{ color: typeConfig.color }} />
                      <span className="text-xs font-medium truncate flex-1" style={{ color: tokens.text.primary }}>{event.title}</span>
                      <span className="text-[10px] shrink-0" style={{ color: tokens.text.muted }}>{formatTime(event.timestamp)}</span>
                    </div>
                    <p className="text-[11px] line-clamp-2 pl-[22px]" style={{ color: tokens.text.secondary }}>{event.description}</p>

                    {/* Tags row */}
                    <div className="flex items-center gap-1.5 mt-1 pl-[22px] flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${impactConfig.color}15`, color: impactConfig.color }}>{impactConfig.label}</span>
                      <span className="text-[9px]" style={{ color: tokens.text.muted }}>·</span>
                      <span className="text-[9px]" style={{ color: tokens.text.muted }}>conf: {event.confidence}%</span>
                      <span className="text-[9px]" style={{ color: tokens.text.muted }}>·</span>
                      <span className="text-[9px]" style={{ color: tokens.text.muted }}>{event.source}</span>
                      {event.entities.length > 0 && (
                        <>
                          <span className="text-[9px]" style={{ color: tokens.text.muted }}>·</span>
                          {event.entities.slice(0, 3).map(e => (
                            <span key={e} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: tokens.surface.secondary, color: tokens.text.secondary }}>{e}</span>
                          ))}
                        </>
                      )}
                    </div>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && event.details && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pl-[22px] mt-1.5"
                      >
                        <div className="rounded-lg p-2.5 space-y-1" style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.subtle}` }}>
                          {Object.entries(event.details).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="text-[10px] font-medium min-w-[80px]" style={{ color: tokens.text.secondary }}>{key}:</span>
                              <span className="text-[10px]" style={{ color: tokens.text.primary }}>{value}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
