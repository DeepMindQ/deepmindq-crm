'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Radar, Brain, Target, TrendingUp, AlertTriangle, Activity, Building2, Zap, ArrowRight, RefreshCw, Sparkles, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'

interface DashboardStat {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: typeof Radar
  color: string
  href?: string
}

interface IntelligenceDashboardProps {
  className?: string
  onNavigate?: (href: string) => void
}

function StatCard({ stat, index, onNavigate }: { stat: DashboardStat; index: number; onNavigate?: (href: string) => void }) {
  const Icon = stat.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      onClick={() => stat.href && onNavigate?.(stat.href)}
      className={cn('rounded-xl border p-4 cursor-pointer transition-colors hover:border-opacity-60')}
      style={{ background: tokens.surface.card, borderColor: tokens.border.default }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}12` }}>
          <Icon className="w-4 h-4" style={{ color: stat.color }} />
        </div>
        {stat.change !== undefined && (
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', stat.change >= 0 ? 'text-emerald-400' : 'text-red-400')} style={{ background: stat.change >= 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)' }}>
            {stat.change >= 0 ? '+' : ''}{stat.change}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color: tokens.text.primary }}>{stat.value}</p>
      <p className="text-[11px] mt-1" style={{ color: tokens.text.secondary }}>{stat.label}</p>
    </motion.div>
  )
}

export function MainIntelligenceDashboard({ className, onNavigate }: IntelligenceDashboardProps) {
  const [stats, setStats] = useState<DashboardStat[]>([
    { label: 'Companies Tracked', value: '—', icon: Building2, color: tokens.domain.signal, href: '#accounts' },
    { label: 'Active Signals', value: '—', icon: Zap, color: tokens.domain.reasoning, href: '#signal-intelligence' },
    { label: 'Avg. Intelligence Score', value: '—', icon: Brain, color: tokens.confidence.high.value },
    { label: 'Open Opportunities', value: '—', icon: Target, color: tokens.domain.opportunity, href: '#opportunity-radar' },
    { label: 'Pipeline Value', value: '—', icon: TrendingUp, color: tokens.domain.action, href: '#pipeline' },
    { label: 'AI Health', value: '—', icon: Shield, color: tokens.confidence.high.value, href: '#ai-health' },
    { label: 'High Priority Actions', value: '—', icon: AlertTriangle, color: tokens.priority.critical.value, href: '#recommendation-queue' },
    { label: 'Data Freshness', value: '—', icon: Activity, color: tokens.domain.enrichment, href: '#data-health' },
  ])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) return
        const data = await res.json()
        setStats(prev => prev.map(s => {
          switch(s.label) {
            case 'Companies Tracked': return { ...s, value: data.totalLeads ?? data.totalCompanies ?? 0 }
            case 'Active Signals': return { ...s, value: data.aiSignalsToday ?? data.activeSignals ?? 0 }
            case 'Avg. Intelligence Score': return { ...s, value: data.intelligenceScore ?? 0 }
            case 'Open Opportunities': return { ...s, value: data.activeOpportunities ?? 0 }
            case 'Pipeline Value': return { ...s, value: `$${((data.pipelineValue ?? 0) / 1000).toFixed(0)}K` }
            case 'AI Health': return { ...s, value: data.aiHealthStatus ?? 'Healthy' }
            case 'High Priority Actions': return { ...s, value: data.pendingActions ?? 0 }
            case 'Data Freshness': return { ...s, value: `${data.dataFreshness ?? 0}%` }
            default: return s
          }
        }))
      } catch { /* use defaults */ }
      finally { setLoading(false) }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: tokens.text.primary }}>Intelligence Overview</h2>
          <p className="text-xs mt-0.5" style={{ color: tokens.text.secondary }}>Real-time intelligence across your portfolio</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: tokens.text.muted }}>
          <Sparkles className="w-3 h-3" style={{ color: tokens.domain.reasoning }} />
          Auto-refreshing
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <StatCard key={stat.label} stat={stat} index={i} onNavigate={onNavigate} />
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: 'AI Advisor', icon: Brain, href: '#ai-advisor', color: tokens.domain.reasoning },
          { label: 'Recommendations', icon: ArrowRight, href: '#recommendation-queue', color: tokens.priority.critical.value },
          { label: 'Pipeline', icon: TrendingUp, href: '#pipeline', color: tokens.domain.action },
        ].map(action => (
          <button
            key={action.label}
            onClick={() => onNavigate?.(action.href)}
            className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5 border"
            style={{ color: action.color, borderColor: `${action.color}30` }}
          >
            <action.icon className="w-3.5 h-3.5" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}