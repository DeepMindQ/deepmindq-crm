'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Clock, ArrowUpRight, ArrowDownRight, Minus, Filter, Search, ChevronRight, Sparkles, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface MemoryEntry {
  id: string
  type: 'insight' | 'pattern' | 'correction' | 'preference' | 'signal_learned' | 'feedback_incorporated'
  content: string
  confidence: number
  source: string
  impact: 'high' | 'medium' | 'low'
  createdAt: Date
  references?: string[]
  feedbackCount?: number
}

export interface LearningEvent {
  id: string
  type: 'model_update' | 'weight_adjustment' | 'pattern_recognition' | 'correction' | 'feedback_processed'
  description: string
  metricChange?: number
  timestamp: Date
  details?: string
}

interface MemoryBrowserProps {
  memories: MemoryEntry[]
  learningEvents: LearningEvent[]
  onMemoryClick?: (memory: MemoryEntry) => void
  className?: string
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: typeof Brain; label: string }> = {
  insight: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: Sparkles, label: 'Insight' },
  pattern: { color: '#a855f7', bg: 'rgba(168,85,247,0.1)', icon: Brain, label: 'Pattern' },
  correction: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: ArrowDownRight, label: 'Correction' },
  preference: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: ArrowUpRight, label: 'Preference' },
  signal_learned: { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', icon: BookOpen, label: 'Signal Learned' },
  feedback_incorporated: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: Brain, label: 'Feedback' },
}

function formatRelativeTime(date: Date): string {
  const ms = Date.now() - date.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export function MemoryBrowser({ memories, learningEvents, onMemoryClick, className }: MemoryBrowserProps) {
  const [activeTab, setActiveTab] = useState<'memories' | 'timeline'>('memories')
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filteredMemories = useMemo(() => {
    return memories.filter(m => {
      if (filter !== 'all' && m.type !== filter) return false
      if (search && !m.content.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [memories, filter, search])

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">AI Memory &amp; Learning</h3>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {memories.length} memories · {learningEvents.length} events
          </Badge>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border" role="tablist">
        <button
          onClick={() => setActiveTab('memories')}
          role="tab"
          aria-selected={activeTab === 'memories'}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
            activeTab === 'memories'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Memory Browser
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          role="tab"
          aria-selected={activeTab === 'timeline'}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
            activeTab === 'timeline'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Learning Timeline
        </button>
      </div>

      {/* Filter bar */}
      {activeTab === 'memories' && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search memories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-7 pl-8 text-xs"
              aria-label="Search memories"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-7 w-28 text-xs" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="insight">Insights</SelectItem>
              <SelectItem value="pattern">Patterns</SelectItem>
              <SelectItem value="correction">Corrections</SelectItem>
              <SelectItem value="preference">Preferences</SelectItem>
              <SelectItem value="feedback_incorporated">Feedback</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === 'memories' ? (
            <motion.div
              key="memories"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="divide-y divide-border"
              role="list"
              aria-label="AI memories"
            >
              {filteredMemories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <Brain className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No memories found</p>
                </div>
              )}
              {filteredMemories.map((memory, i) => {
                const config = TYPE_CONFIG[memory.type] || TYPE_CONFIG.insight
                const Icon = config.icon
                return (
                  <motion.div
                    key={memory.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer'
                    )}
                    onClick={() => onMemoryClick?.(memory)}
                    role="listitem"
                  >
                    <div
                      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                      style={{ background: config.bg, border: `1px solid ${config.color}30` }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1.5"
                          style={{ background: config.bg, color: config.color, borderColor: `${config.color}30` }}
                        >
                          {config.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          <span className="tabular-nums">{memory.confidence}%</span>
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatRelativeTime(memory.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-foreground line-clamp-2">{memory.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Source: {memory.source}</p>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : (
            <motion.div
              key="timeline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-3"
              role="list"
              aria-label="Learning timeline"
            >
              {learningEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Clock className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No learning events yet</p>
                </div>
              )}
              {learningEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-start gap-3"
                  role="listitem"
                >
                  <div className="shrink-0 mt-1 w-6 h-6 rounded-full flex items-center justify-center bg-muted">
                    {event.metricChange !== undefined ? (
                      event.metricChange > 0
                        ? <ArrowUpRight className="w-3 h-3 text-green-400" />
                        : event.metricChange < 0
                          ? <ArrowDownRight className="w-3 h-3 text-red-400" />
                          : <Minus className="w-3 h-3 text-muted-foreground" />
                    ) : <Clock className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{event.description}</p>
                    {event.details && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{event.details}</p>
                    )}
                    {event.metricChange !== undefined && (
                      <span className={cn(
                        'text-[10px] font-medium',
                        event.metricChange > 0 ? 'text-green-400' : event.metricChange < 0 ? 'text-red-400' : 'text-muted-foreground'
                      )}>
                        {event.metricChange > 0 ? '+' : ''}{event.metricChange.toFixed(1)}% metric impact
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  )
}
