'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Users, Target, Clock, Radar, Brain, ArrowLeft, ExternalLink, TrendingUp, FileText, Zap, Activity, AlertTriangle, TrendingDown } from 'lucide-react'
import { TemporalIntelligenceTimeline } from '@/components/intelligence-os/molecules/temporal-intelligence-timeline'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'
import { useCompanyDetail, useCompanySignals, useCompanyScore } from '@/lib/realtime-hooks'

type TabId = 'overview' | 'contacts' | 'opportunities' | 'signals' | 'timeline'

interface CompanyData {
  id: string
  name: string
  domain?: string
  industry?: string
  employeeSize?: string
  intelligenceScore?: number
  tier?: string
  description?: string
}

interface CompanyWorkspaceV2Props {
  companyId: string
  onBack?: () => void
  onNavigate?: (screen: string, companyId?: string) => void
  className?: string
}

const TABS: { id: TabId; label: string; icon: typeof Building2 }[] = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'opportunities', label: 'Opportunities', icon: Target },
  { id: 'signals', label: 'Signals', icon: Radar },
  { id: 'timeline', label: 'Timeline', icon: Clock },
]

export function CompanyWorkspaceV2({ companyId, onBack, onNavigate, className }: CompanyWorkspaceV2Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const { data: companyData, loading, refetch } = useCompanyDetail(companyId, 60000)
  const { data: signalsData } = useCompanySignals(companyId, 45000)
  const { data: scoreData } = useCompanyScore(companyId)

  // Derived counts from fetched data
  const signals = useMemo(() => {
    const raw = signalsData as any;
    if (!raw) return [];
    // API returns { signals: [...] } or { data: { signals: [...] } }
    const arr = raw?.signals ?? raw?.data?.signals ?? (Array.isArray(raw) ? raw : []);
    return arr;
  }, [signalsData]);

  const scoreBreakdown = useMemo(() => {
    const raw = scoreData as any;
    if (!raw) return null;
    return raw?.data ?? raw;
  }, [scoreData]);

  // Fetch contacts and opportunities for the tabs
  const [contacts, setContacts] = useState<any[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false)

  useEffect(() => {
    if (!companyId) return
    let mounted = true
    setContactsLoading(true)
    fetch(`/api/companies/${companyId}/contacts`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (mounted) { setContacts(data?.contacts ?? []); setContactsLoading(false) } })
      .catch(() => { if (mounted) setContactsLoading(false) })
    return () => { mounted = false }
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    let mounted = true
    setOpportunitiesLoading(true)
    fetch(`/api/opportunities?companyId=${companyId}&pageSize=50`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (mounted) { setOpportunities(data?.data ?? data?.opportunities ?? []); setOpportunitiesLoading(false) } })
      .catch(() => { if (mounted) setOpportunitiesLoading(false) })
    return () => { mounted = false }
  }, [companyId])

  const company = useMemo<CompanyData | null>(() => {
    if (!companyData) return null
    return {
      id: (companyData as any).id || companyId,
      name: (companyData as any).name || 'Unknown Company',
      domain: (companyData as any).domain,
      industry: (companyData as any).industry,
      employeeSize: (companyData as any).employeeSize,
      intelligenceScore: (companyData as any).intelligenceScore ?? (companyData as any).intelligence_score,
      tier: (companyData as any).priorityTier || (companyData as any).tier,
      description: (companyData as any).description,
    }
  }, [companyData, companyId])

  const getScoreColor = (score?: number) => {
    if (!score) return tokens.text.muted
    if (score >= 70) return tokens.confidence.high.value
    if (score >= 45) return tokens.confidence.medium.value
    return tokens.confidence.low.value
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Company header */}
      <div className="flex items-start gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 mt-1" title="Back">
          <ArrowLeft className="w-4 h-4" style={{ color: tokens.text.secondary }} />
        </button>
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-2">
              <div className="h-6 w-48 rounded-lg animate-pulse" style={{ background: tokens.surface.secondary }} />
              <div className="h-4 w-32 rounded animate-pulse" style={{ background: tokens.surface.secondary }} />
            </div>
          ) : company ? (
            <>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold" style={{ color: tokens.text.primary }}>{company.name}</h2>
                {company.tier && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase" style={{ background: `${getScoreColor(company.intelligenceScore)}15`, color: getScoreColor(company.intelligenceScore) }}>
                    {company.tier}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: tokens.text.secondary }}>
                {company.domain && <span>{company.domain}</span>}
                {company.industry && <span>· {company.industry}</span>}
                {company.employeeSize && <span>· {company.employeeSize}</span>}
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: tokens.text.muted }}>Company not found</p>
          )}
        </div>
        {company?.intelligenceScore !== undefined && (
          <div className="text-center shrink-0">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold border" style={{
              background: `${getScoreColor(company.intelligenceScore)}12`,
              borderColor: `${getScoreColor(company.intelligenceScore)}30`,
              color: getScoreColor(company.intelligenceScore),
            }}>
              {company.intelligenceScore}
            </div>
            <p className="text-[10px] mt-1" style={{ color: tokens.text.muted }}>Intel Score</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b overflow-x-auto" style={{ borderColor: tokens.border.default }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap relative', activeTab === tab.id ? '' : 'opacity-60')}
            style={{ color: activeTab === tab.id ? tokens.text.primary : tokens.text.secondary }}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: tokens.domain.signal }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Contacts', value: contacts.length, icon: Users, color: tokens.domain.signal },
                { label: 'Opportunities', value: opportunities.length, icon: Target, color: tokens.domain.opportunity },
                { label: 'Signals', value: signals.length, icon: Zap, color: tokens.domain.reasoning },
                { label: 'Intel Score', value: scoreBreakdown?.intelligence?.score ?? company?.intelligenceScore ?? '—', icon: Brain, color: tokens.domain.action },
              ].map((stat, i) => (
                <div key={stat.label} className="rounded-xl border p-3" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
                  <stat.icon className="w-4 h-4 mb-2" style={{ color: stat.color }} />
                  <p className="text-lg font-bold tabular-nums" style={{ color: tokens.text.primary }}>{stat.value}</p>
                  <p className="text-[10px]" style={{ color: tokens.text.secondary }}>{stat.label}</p>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'contacts' && (
            contactsLoading ? (
              <div className="py-8 text-center">
                <div className="h-6 w-48 rounded animate-pulse mx-auto mb-2" style={{ background: tokens.surface.secondary }} />
                <div className="h-4 w-32 rounded animate-pulse mx-auto" style={{ background: tokens.surface.secondary }} />
              </div>
            ) : contacts.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
                <p className="text-xs" style={{ color: tokens.text.secondary }}>No contacts found for this company</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {contacts.map((c: any) => (
                  <div key={c.id} className="rounded-xl border p-3 flex items-center justify-between" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: `${tokens.domain.signal}20`, color: tokens.domain.signal }}>
                        {(c.firstName?.[0] ?? '?').toUpperCase()}{(c.lastName?.[0] ?? '').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: tokens.text.primary }}>{c.firstName} {c.lastName}</p>
                        <p className="text-[11px] truncate" style={{ color: tokens.text.secondary }}>{c.title ?? ''}{c.title && c.email ? ' · ' : ''}{c.email ?? ''}</p>
                      </div>
                    </div>
                    {c.status && (
                      <span className="text-[9px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: `${tokens.confidence.high.value}15`, color: tokens.confidence.high.value }}>
                        {c.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
          {activeTab === 'opportunities' && (
            opportunitiesLoading ? (
              <div className="py-8 text-center">
                <div className="h-6 w-48 rounded animate-pulse mx-auto mb-2" style={{ background: tokens.surface.secondary }} />
                <div className="h-4 w-32 rounded animate-pulse mx-auto" style={{ background: tokens.surface.secondary }} />
              </div>
            ) : opportunities.length === 0 ? (
              <div className="py-8 text-center">
                <Target className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
                <p className="text-xs" style={{ color: tokens.text.secondary }}>No opportunities found for this company</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {opportunities.map((o: any) => (
                  <div key={o.id} className="rounded-xl border p-3" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{o.title ?? o.type ?? 'Opportunity'}</p>
                      {o.value && (
                        <span className="text-xs font-semibold" style={{ color: tokens.domain.opportunity }}>${Number(o.value).toLocaleString()}</span>
                      )}
                    </div>
                    {o.description && <p className="text-[11px] line-clamp-2" style={{ color: tokens.text.secondary }}>{o.description}</p>}
                    {o.stage && (
                      <span className="text-[9px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: `${tokens.domain.opportunity}15`, color: tokens.domain.opportunity }}>
                        {o.stage}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
          {activeTab === 'signals' && (
            signals.length === 0 ? (
              <div className="py-8 text-center">
                <Radar className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
                <p className="text-xs" style={{ color: tokens.text.secondary }}>No signals detected for this company</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {signals.map((s: any) => (
                  <div key={s.id} className="rounded-xl border p-3" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{s.title ?? s.signalType ?? 'Signal'}</p>
                      <span className={"text-[9px] font-medium px-2 py-0.5 rounded-full" + (s.severity === 'critical' || s.severity === 'high' ? ' bg-red-100 text-red-700' : s.severity === 'medium' ? ' bg-amber-100 text-amber-700' : ' bg-zinc-100 text-zinc-600')}>
                        {s.severity ?? 'info'}
                      </span>
                    </div>
                    {s.description && <p className="text-[11px] line-clamp-2" style={{ color: tokens.text.secondary }}>{s.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: tokens.text.muted }}>
                      <span>{s.signalType ?? ''}</span>
                      {s.source && <span>· {s.source}</span>}
                      {s.createdAt && <span>· {new Date(s.createdAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
          {activeTab === 'timeline' && (
            <TemporalTimelineTab companyId={companyId} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** G10 FIX: Temporal timeline tab with actual data from /api/companies/[id]/temporal */
function TemporalTimelineTab({ companyId }: { companyId: string }) {
  const [temporal, setTemporal] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch(`/api/companies/${companyId}/temporal`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (mounted) { setTemporal(data); setLoading(false) } })
      .catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [companyId])

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="h-6 w-48 rounded animate-pulse mx-auto mb-2" style={{ background: tokens.surface.secondary }} />
        <div className="h-4 w-32 rounded animate-pulse mx-auto" style={{ background: tokens.surface.secondary }} />
      </div>
    )
  }

  if (!temporal) {
    return (
      <div className="py-8 text-center">
        <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
        <p className="text-xs" style={{ color: tokens.text.secondary }}>Temporal data unavailable</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Velocity metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Signals (7d)"
          value={String(temporal.signalsLast7Days)}
          icon={Zap}
          color={tokens.domain.signal}
          trend={temporal.velocityTrend === 'accelerating' ? 'up' : temporal.velocityTrend === 'decelerating' ? 'down' : 'flat'}
        />
        <MetricCard
          label="Signals (30d)"
          value={String(temporal.signalsLast30Days)}
          icon={Activity}
          color={tokens.domain.reasoning}
        />
        <MetricCard
          label="Velocity"
          value={temporal.velocityTrend}
          icon={temporal.velocityTrend === 'accelerating' ? TrendingUp : temporal.velocityTrend === 'decelerating' ? TrendingDown : Activity}
          color={temporal.velocityTrend === 'accelerating' ? tokens.confidence.high.value : temporal.velocityTrend === 'decelerating' ? tokens.confidence.low.value : tokens.text.secondary}
        />
        <MetricCard
          label="Growth"
          value={temporal.growthTrend}
          icon={temporal.growthTrend === 'growing' ? TrendingUp : temporal.growthTrend === 'declining' ? AlertTriangle : Activity}
          color={temporal.growthTrend === 'growing' ? tokens.confidence.high.value : temporal.growthTrend === 'declining' ? tokens.confidence.low.value : tokens.text.secondary}
        />
      </div>

      {/* Latency info */}
      {temporal.signalToDecisionLatencyHours !== null && (
        <div className="rounded-xl border p-3" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
          <p className="text-[10px] mb-1" style={{ color: tokens.text.secondary }}>Signal-to-Decision Latency</p>
          <p className="text-sm font-bold" style={{ color: tokens.text.primary }}>
            {temporal.signalToDecisionLatencyHours.toFixed(1)}h avg · {temporal.medianSignalToDecisionLatencyHours?.toFixed(1) ?? '—'}h median
          </p>
        </div>
      )}

      {/* Last update */}
      {temporal.daysSinceLastUpdate !== null && (
        <div className="rounded-xl border p-3" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
          <p className="text-[10px] mb-1" style={{ color: tokens.text.secondary }}>Last Intelligence Update</p>
          <p className="text-sm font-bold" style={{ color: temporal.daysSinceLastUpdate > 30 ? tokens.confidence.low.value : tokens.text.primary }}>
            {temporal.daysSinceLastUpdate === 0 ? 'Today' : `${temporal.daysSinceLastUpdate}d ago`}
          </p>
        </div>
      )}

      {/* Growth rate */}
      {temporal.growthRatePercent !== null && (
        <div className="rounded-xl border p-3" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
          <p className="text-[10px] mb-1" style={{ color: tokens.text.secondary }}>Signal Growth Rate (30d vs 60d)</p>
          <p className="text-sm font-bold" style={{ color: (temporal.growthRatePercent ?? 0) > 0 ? tokens.confidence.high.value : tokens.confidence.low.value }}>
            {(temporal.growthRatePercent ?? 0) > 0 ? '+' : ''}{temporal.growthRatePercent?.toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color, trend }: {
  label: string; value: string; icon: typeof Zap; color: string; trend?: 'up' | 'down' | 'flat'
}) {
  return (
    <div className="rounded-xl border p-3" style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
      <div className="flex items-center justify-between mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        {trend === 'up' && <TrendingUp className="w-3 h-3" style={{ color: tokens.confidence.high.value }} />}
        {trend === 'down' && <TrendingDown className="w-3 h-3" style={{ color: tokens.confidence.low.value }} />}
      </div>
      <p className="text-sm font-bold" style={{ color: tokens.text.primary }}>{value}</p>
      <p className="text-[10px]" style={{ color: tokens.text.secondary }}>{label}</p>
    </div>
  )
}