'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Clock, XCircle, ArrowRight, Star, Filter, Zap, Brain, Target, MoreVertical, ChevronDown, Sparkles, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'
import { useRecommendations, useMutation } from '@/lib/realtime-hooks'
import { EnterpriseLoading, EnterpriseEmptyState } from '@/components/enterprise'

type RecStatus = 'pending' | 'accepted' | 'dismissed' | 'snoozed' | 'executed'
type RecPriority = 'critical' | 'high' | 'medium' | 'low'
type RecType = 'opportunity' | 'enrichment' | 'outreach' | 'risk_alert' | 'scoring_change'

interface Recommendation {
  id: string
  title: string
  description: string
  type: RecType
  priority: RecPriority
  confidence: number
  status: RecStatus
  companyId?: string
  companyName?: string
  impact?: string
  suggestedAction: string
  createdAt: string
}

interface RecommendationQueueV2Props {
  recommendations?: Recommendation[]
  className?: string
  onAction?: (id: string, action: RecStatus) => void
  onNavigate?: (screen: string, companyId?: string) => void
}

const PRIORITY_ORDER: Record<RecPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const PRIORITY_CONFIG: Record<RecPriority, { color: string; icon: typeof Zap }> = {
  critical: { color: tokens.priority.critical.value, icon: Zap },
  high: { color: tokens.priority.high.value, icon: Star },
  medium: { color: tokens.priority.medium.value, icon: Brain },
  low: { color: tokens.priority.low.value, icon: Target },
}

const TYPE_CONFIG: Record<RecType, { color: string; label: string }> = {
  opportunity: { color: tokens.domain.opportunity, label: 'Opportunity' },
  enrichment: { color: tokens.domain.enrichment, label: 'Enrichment' },
  outreach: { color: tokens.domain.signal, label: 'Outreach' },
  risk_alert: { color: tokens.domain.risk, label: 'Risk Alert' },
  scoring_change: { color: tokens.domain.reasoning, label: 'Score Change' },
}

const STATUS_CONFIG: Record<RecStatus, { color: string; label: string; icon: typeof CheckCircle2 }> = {
  pending: { color: tokens.text.secondary, label: 'Pending', icon: Clock },
  accepted: { color: tokens.confidence.high.value, label: 'Accepted', icon: CheckCircle2 },
  dismissed: { color: tokens.confidence.low.value, label: 'Dismissed', icon: XCircle },
  snoozed: { color: tokens.confidence.medium.value, label: 'Snoozed', icon: Clock },
  executed: { color: tokens.domain.action, label: 'Executed', icon: Sparkles },
}

export function RecommendationQueueV2({ recommendations = [], className, onAction, onNavigate }: RecommendationQueueV2Props) {
  const [statusFilter, setStatusFilter] = useState<RecStatus | 'all'>('pending')
  const [priorityFilter, setPriorityFilter] = useState<RecPriority | 'all'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<RecStatus | null>(null)

  const { data: fetchedRecommendations, loading: fetchLoading, refetch } = useRecommendations(null, 30000)

  const acceptMutation = useMutation({
    endpoint: '/api/recommendations',
    method: 'POST',
  })

  const effectiveRecommendations: Recommendation[] = recommendations.length > 0
    ? recommendations
    : ((fetchedRecommendations as Recommendation[] | undefined) ?? [])

  if (fetchLoading && effectiveRecommendations.length === 0) {
    return <EnterpriseLoading message="Loading recommendations..." />
  }

  const filtered = useMemo(() => {
    return effectiveRecommendations
      .filter(r => statusFilter === 'all' || r.status === statusFilter)
      .filter(r => priorityFilter === 'all' || r.priority === priorityFilter)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }, [effectiveRecommendations, statusFilter, priorityFilter])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(r => r.id)))
  }

  const handleBulkAction = () => {
    if (!bulkAction) return
    selectedIds.forEach(id => onAction?.(id, bulkAction))
    setSelectedIds(new Set())
    setBulkAction(null)
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: effectiveRecommendations.length }
    effectiveRecommendations.forEach(r => { c[r.status] = (c[r.status] || 0) + 1 })
    return c
  }, [effectiveRecommendations])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: tokens.text.primary }}>
            <Sparkles className="w-5 h-5" style={{ color: tokens.domain.reasoning }} />
            AI Recommendations
          </h2>
          <p className="text-xs mt-0.5" style={{ color: tokens.text.secondary }}>
            {counts.pending ?? 0} pending · {filtered.length} shown
          </p>
        </div>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Refresh" style={{ color: tokens.text.secondary }}>
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'pending', 'accepted', 'dismissed', 'snoozed'] as const).map(status => (
          <button key={status} onClick={() => setStatusFilter(status)} className={cn('text-[10px] px-2.5 py-1 rounded-full transition-colors', statusFilter === status ? 'font-semibold' : 'opacity-50')} style={{ background: statusFilter === status ? `${STATUS_CONFIG[status === 'all' ? 'pending' : status].color}15` : 'transparent', color: statusFilter === status ? (status === 'all' ? tokens.text.primary : STATUS_CONFIG[status].color) : tokens.text.secondary }}>
            {status === 'all' ? `All (${counts.all})` : `${STATUS_CONFIG[status].label} (${counts[status] || 0})`}
          </button>
        ))}
        <span className="text-[10px] ml-2" style={{ color: tokens.text.muted }}>Priority:</span>
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => (
          <button key={p} onClick={() => setPriorityFilter(p)} className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors', priorityFilter === p ? 'font-semibold' : 'opacity-50')} style={{ background: priorityFilter === p ? `${p === 'all' ? tokens.text.primary : PRIORITY_CONFIG[p].color}15` : 'transparent', color: priorityFilter === p ? (p === 'all' ? tokens.text.primary : PRIORITY_CONFIG[p].color) : tokens.text.secondary }}>
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: tokens.surface.elevated, borderColor: tokens.border.hover }}>
          <span className="text-[11px] font-medium" style={{ color: tokens.text.primary }}>{selectedIds.size} selected</span>
          {(['accepted', 'dismissed', 'snoozed'] as RecStatus[]).map(action => (
            <button key={action} onClick={() => { setBulkAction(action); handleBulkAction() }} className="text-[10px] px-2 py-1 rounded-md hover:bg-white/5 font-medium" style={{ color: STATUS_CONFIG[action].color }}>
              {STATUS_CONFIG[action].label}
            </button>
          ))}
          <button onClick={() => setSelectedIds(new Set())} className="text-[10px] ml-auto" style={{ color: tokens.text.muted }}>Clear</button>
        </motion.div>
      )}

      {/* Recommendation list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map(rec => {
            const priConfig = PRIORITY_CONFIG[rec.priority]
            const typeConfig = TYPE_CONFIG[rec.type]
            const statusConfig = STATUS_CONFIG[rec.status]
            const isSelected = selectedIds.has(rec.id)

            return (
              <motion.div key={rec.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className={cn('rounded-xl border p-3 transition-all', isSelected && 'ring-1')} style={{ background: tokens.surface.card, borderColor: isSelected ? tokens.domain.signal : tokens.border.default, ...(isSelected ? { ['--tw-ring-color' as string]: tokens.domain.signal } as React.CSSProperties : {}) }}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(rec.id)} className="mt-1 accent-[var(--dmq-accent-blue)]" />
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${priConfig.color}12` }}>
                    <priConfig.icon className="w-4 h-4" style={{ color: priConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${priConfig.color}15`, color: priConfig.color }}>{rec.priority}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${typeConfig.color}12`, color: typeConfig.color }}>{typeConfig.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ background: `${statusConfig.color}12`, color: statusConfig.color }}>
                        <statusConfig.icon className="w-2.5 h-2.5" />{statusConfig.label}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{rec.title}</h4>
                    <p className="text-[11px] mt-0.5" style={{ color: tokens.text.secondary }}>{rec.description}</p>
                    {rec.companyName && (
                      <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: tokens.domain.signal }}>
                        <Target className="w-3 h-3" />{rec.companyName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px]" style={{ color: tokens.text.muted }}>Confidence</div>
                      <div className="text-sm font-mono tabular-nums font-bold" style={{ color: rec.confidence >= 70 ? tokens.confidence.high.value : rec.confidence >= 45 ? tokens.confidence.medium.value : tokens.confidence.low.value }}>{rec.confidence}%</div>
                    </div>
                    {rec.status === 'pending' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => onAction?.(rec.id, 'accepted')} className="p-1 rounded hover:bg-white/5" title="Accept" style={{ color: tokens.confidence.high.value }}><CheckCircle2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onAction?.(rec.id, 'dismissed')} className="p-1 rounded hover:bg-white/5" title="Dismiss" style={{ color: tokens.confidence.low.value }}><XCircle className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onAction?.(rec.id, 'snoozed')} className="p-1 rounded hover:bg-white/5" title="Snooze" style={{ color: tokens.confidence.medium.value }}><Clock className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <EnterpriseEmptyState
            icon={Sparkles}
            title="No recommendations match your filters"
            description="Try adjusting status or priority filters to see recommendations."
            actionLabel={statusFilter !== 'pending' || priorityFilter !== 'all' ? 'Show all' : undefined}
            onAction={statusFilter !== 'pending' || priorityFilter !== 'all' ? () => { setStatusFilter('all'); setPriorityFilter('all') } : undefined}
          />
        )}
      </div>
    </div>
  )
}