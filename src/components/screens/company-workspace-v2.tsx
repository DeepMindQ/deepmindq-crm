'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Users, Target, Clock, Radar, Brain, ArrowLeft, ExternalLink, TrendingUp, FileText, Zap } from 'lucide-react'
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
                { label: 'Contacts', value: '—', icon: Users, color: tokens.domain.signal },
                { label: 'Opportunities', value: '—', icon: Target, color: tokens.domain.opportunity },
                { label: 'Signals', value: '—', icon: Zap, color: tokens.domain.reasoning },
                { label: 'AI Actions', value: '—', icon: Brain, color: tokens.domain.action },
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
            <div className="py-8 text-center">
              <Users className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
              <p className="text-xs" style={{ color: tokens.text.secondary }}>Contact data loads from API</p>
            </div>
          )}
          {activeTab === 'opportunities' && (
            <div className="py-8 text-center">
              <Target className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
              <p className="text-xs" style={{ color: tokens.text.secondary }}>Opportunities load from API</p>
            </div>
          )}
          {activeTab === 'signals' && (
            <div className="py-8 text-center">
              <Radar className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
              <p className="text-xs" style={{ color: tokens.text.secondary }}>Signal intelligence loads from API</p>
            </div>
          )}
          {activeTab === 'timeline' && (
            <div className="py-8 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
              <p className="text-xs" style={{ color: tokens.text.secondary }}>Timeline events load from API</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}