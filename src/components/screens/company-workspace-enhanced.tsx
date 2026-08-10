'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Building2, Brain, Zap, Target, Users, Globe,
  RefreshCw, Clock, Activity, BarChart3,
  MessageSquare, DollarSign, FileText,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { SkeletonDetail } from '@/components/loading';
import { PageTransition, EmptyState } from '@/components/ui/animated-components';
import { useAppStore } from '@/lib/store';
import { fetchApi } from '@/lib/fetchApi';
import { cn } from '@/lib/utils';
import { tokens, getConfidenceTier } from '@/components/intelligence-os/design-tokens';
import { FreshnessIndicator } from '@/components/intelligence-os/atoms/freshness-indicator';
import { DataFreshnessPanel } from '@/components/intelligence-os/molecules/data-freshness-panel';
import { ConfidenceIndicator } from '@/components/trust/confidence-indicator';
import { ScoreBreakdown } from '@/components/score/score-breakdown';
import { AccountTierBadge, getTierFromScore } from '@/components/tier/account-tier-badge';
import { CalibrationReason } from '@/components/calibration/calibration-reason';
import { InlineFeedback } from '@/components/feedback/inline-feedback';
import type { IntelligenceSignal } from '@/lib/intelligence-types';
import { formatFreshness, getPriorityColor, getPriorityLabel } from '@/lib/intelligence-types';

/* ═══════════════════════════════════════════════════════════════
   Company Workspace Enhanced — Intelligence OS Detail View
   ═══════════════════════════════════════════════════════════════ */

const TABS = ['overview', 'intelligence', 'signals', 'opportunities', 'notes', 'timeline'] as const;
type TabKey = (typeof TABS)[number];

const TAB_ICONS: Record<TabKey, React.ElementType> = {
  overview: BarChart3,
  intelligence: Brain,
  signals: Zap,
  opportunities: Target,
  notes: MessageSquare,
  timeline: Clock,
};


/* ── Score Ring Gauge ── */
function ScoreGauge({ score, size = 88, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? tokens.trust.verified.value : score >= 60 ? tokens.domain.reasoning : tokens.domain.risk;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={tokens.border.default} strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black tabular-nums" style={{ color }}>{Math.round(score)}</span>
      </div>
    </div>
  );
}

/* ── Metric Card (compact) ── */
function MetricCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <div className="rounded-lg border p-3 transition-colors" style={{
      borderColor: tokens.border.default,
      backgroundColor: tokens.surface.card,
    }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tokens.text.secondary }}>{label}</span>
      </div>
      <span className="text-lg font-bold tabular-nums" style={{ color: tokens.text.primary }}>{value}</span>
    </div>
  );
}

/* ── Signal Card ── */
function SignalCard({ signal }: { signal: IntelligenceSignal }) {
  const confidenceTier = getConfidenceTier(signal.confidenceScore);
  const priorityColor = getPriorityColor(signal.priority);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-4 transition-colors"
      style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: `${priorityColor}15`, color: priorityColor, border: `1px solid ${priorityColor}25` }}>
            {getPriorityLabel(signal.priority)}
          </span>
          <span className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>{signal.type.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold tabular-nums" style={{ color: tokens.confidence[confidenceTier].value }}>
            {signal.confidenceScore}%
          </span>
          <ConfidenceIndicator level={confidenceTier} />
        </div>
      </div>
      <p className="text-[13px] font-semibold leading-snug mb-1.5" style={{ color: tokens.text.primary }}>{signal.headline}</p>
      <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: tokens.text.secondary }}>{signal.summary}</p>
      <div className="flex items-center gap-3 mt-3">
        <FreshnessIndicator timestamp={signal.freshnessTimestamp} />
        <span className="text-[10px]" style={{ color: tokens.text.muted }}>{signal.source}</span>
        {signal.evidenceCount && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ backgroundColor: `${tokens.trust.verified.bg}`, color: tokens.trust.verified.value }}>
            <FileText className="w-2.5 h-2.5" />
            {signal.evidenceCount} evidence
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ── Opportunity Card ── */
function OpportunityCard({ opp }: { opp: { id: string; title: string; value: string; stage: string; probability: number; closeDate: string; owner: string } }) {
  const probColor = opp.probability >= 60 ? tokens.trust.verified.value : opp.probability >= 40 ? tokens.domain.reasoning : tokens.domain.risk;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-4 transition-colors"
      style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>{opp.title}</p>
        <span className="text-[13px] font-bold tabular-nums flex-shrink-0" style={{ color: tokens.domain.opportunity }}>{opp.value}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px]" style={{ color: tokens.text.secondary }}>
        <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${tokens.accent.DEFAULT}15`, color: tokens.accent.bright }}>{opp.stage}</span>
        <span>Close: {opp.closeDate}</span>
        <span style={{ color: probColor }} className="font-semibold">{opp.probability}%</span>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Company Workspace Enhanced
   ═══════════════════════════════════════════════════════════════ */
export default function CompanyWorkspaceEnhanced() {
  const companyId = useAppStore(s => s.selectedCompanyId);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { data: companyData, isLoading, error } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => fetchApi<any>(`/api/companies/${companyId}`),
    enabled: !!companyId,
  });

  const company = companyData?.data ?? null;
  const score = company.intelligenceScore ?? company.score ?? 0;
  const tier = company.tier || getTierFromScore(score);

  if (!companyId) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.surface.base }}>
          <EmptyState
            icon={Building2}
            title="No company selected"
            description="Select a company from the sidebar to view its intelligence workspace."
          />
        </div>
      </ErrorBoundary>
    );
  }

  if (isLoading) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen p-6" style={{ backgroundColor: tokens.surface.base }}>
          <SkeletonDetail />
        </div>
      </ErrorBoundary>
    );
  }

  const handleRefresh = () => {
    toast.success('Refreshing intelligence data...');
  };

  return (
    <ErrorBoundary>
      <PageTransition>
        <div className="min-h-screen" style={{ backgroundColor: tokens.surface.base, color: tokens.text.primary }}>
          <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 lg:py-8">

            {/* ── Company Intelligence Header ── */}
            <header className="mb-6">
              <div
                className="rounded-xl border p-5 lg:p-6"
                style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-5">
                  {/* Left: Company Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <Building2 className="w-5 h-5" style={{ color: tokens.accent.DEFAULT }} />
                      <h1 className="text-xl font-bold tracking-tight truncate" style={{ color: tokens.text.primary }}>
                        {company.name}
                      </h1>
                      <AccountTierBadge tier={tier} score={score} size="sm" />
                    </div>
                    <div className="flex items-center gap-2 text-[12px] flex-wrap" style={{ color: tokens.text.secondary }}>
                      {company.domain && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {company.domain}
                        </span>
                      )}
                      {company.industry && <><span>·</span><span>{company.industry}</span></>}
                      {company.sizeRange && <><span>·</span><span>{company.sizeRange} employees</span></>}
                      {company.location && <><span>·</span><span>{company.location}</span></>}
                    </div>

                    {/* KPI strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      <MetricCard icon={Target} label="Score" value={score} color={score >= 80 ? tokens.trust.verified.value : tokens.domain.reasoning} />
                      <MetricCard icon={Zap} label="Signals" value={company.signals?.length ?? 3} color={tokens.domain.signal} />
                      <MetricCard icon={Users} label="Contacts" value={company.contacts?.length ?? 3} color={tokens.domain.opportunity} />
                      <MetricCard icon={DollarSign} label="Revenue" value={company.revenue ?? 'N/A'} color={tokens.domain.action} />
                    </div>
                  </div>

                  {/* Right: Score Gauge + Refresh */}
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <ScoreGauge score={score} />
                    <span className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>Intelligence Score</span>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={handleRefresh}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-[11px] font-medium transition-colors min-h-[44px]"
                        style={{ borderColor: tokens.border.default, color: tokens.text.secondary, backgroundColor: 'transparent' }}
                      >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                      </button>
                    </div>
                    <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                      Updated {formatFreshness(company.lastRefreshed)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Tab Navigation ── */}
              <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {TABS.map(tab => {
                  const TabIcon = TAB_ICONS[tab];
                  const isActive = activeTab === tab;
                  return (
                    <motion.button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors capitalize',
                      )}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        color: isActive ? tokens.text.primary : tokens.text.secondary,
                        backgroundColor: isActive ? tokens.surface.elevated : 'transparent',
                      }}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      {tab}
                      {isActive && (
                        <motion.div
                          layoutId="workspace-tab-indicator"
                          className="absolute inset-0 rounded-lg"
                          style={{ border: `1px solid ${tokens.border.hover}` }}
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </header>

            {/* ── Tab Content ── */}
            <main>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* ── Overview Tab ── */}
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Contact Summary */}
                        <div
                          className="lg:col-span-2 rounded-xl border p-4"
                          style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4" style={{ color: tokens.domain.opportunity }} />
                            <h3 className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>Key Contacts</h3>
                          </div>
                          <div className="space-y-2.5">
                            {(company.contacts ?? []).map((contact: any) => (
                              <div key={contact.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: tokens.border.subtle }}>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: `${tokens.accent.DEFAULT}15`, color: tokens.accent.bright }}>
                                    {contact.name.split(' ').map((n: string) => n[0]).join('')}
                                  </div>
                                  <div>
                                    <p className="text-[12px] font-medium" style={{ color: tokens.text.primary }}>{contact.name}</p>
                                    <p className="text-[11px]" style={{ color: tokens.text.secondary }}>{contact.title}</p>
                                  </div>
                                </div>
                                <span className="text-[11px]" style={{ color: tokens.text.muted }}>{contact.email}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div
                          className="rounded-xl border p-4"
                          style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Activity className="w-4 h-4" style={{ color: tokens.domain.enrichment }} />
                            <h3 className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>Recent Activity</h3>
                          </div>
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {(company.recentActivity ?? []).map((item: any) => (
                              <div key={item.id} className="flex items-start gap-2.5">
                                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: tokens.domain.signal }} />
                                <div>
                                  <p className="text-[12px]" style={{ color: tokens.text.primary }}>{item.text}</p>
                                  <span className="text-[10px]" style={{ color: tokens.text.muted }}>{formatFreshness(item.time)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Data Freshness */}
                      <div className="rounded-xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}>
                        <div className="flex items-center gap-2 mb-3">
                          <RefreshCw className="w-4 h-4" style={{ color: tokens.domain.enrichment }} />
                          <h3 className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>Data Freshness</h3>
                        </div>
                        <DataFreshnessPanel entries={[
                          { label: 'CRM Data', lastRefreshedAt: new Date(Date.now() - 3600000).toISOString(), freshnessLabel: '1h ago', isFresh: true },
                          { label: 'LinkedIn', lastRefreshedAt: new Date(Date.now() - 7200000).toISOString(), freshnessLabel: '2h ago', isFresh: true },
                          { label: 'Intent Data', lastRefreshedAt: new Date(Date.now() - 48 * 3600000).toISOString(), freshnessLabel: '2d ago', isFresh: false },
                          { label: 'Job Postings', lastRefreshedAt: new Date(Date.now() - 12 * 3600000).toISOString(), freshnessLabel: '12h ago', isFresh: true },
                        ]} />
                      </div>
                    </div>
                  )}

                  {/* ── Intelligence Tab ── */}
                  {activeTab === 'intelligence' && (
                    <div className="space-y-4">
                      {/* Score Breakdown */}
                      <div
                        className="rounded-xl border p-4"
                        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart3 className="w-4 h-4" style={{ color: tokens.accent.DEFAULT }} />
                          <h3 className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>Score Breakdown</h3>
                        </div>
                        <ScoreBreakdown
                          totalScore={score}
                          dimensions={company.scoreDimensions ?? []}
                        />
                      </div>

                      {/* Calibration Reason */}
                      <CalibrationReason
                        originalScore={score - 8}
                        calibratedScore={score}
                        factors={company.calibrationFactors ?? []}
                        overallReason={company?.narrative ?? "Score computed from multiple intelligence dimensions."}
                        confidence={company?.intelligenceScore ?? 0}
                      />

                      {/* AI Narrative */}
                      <div
                        className="rounded-xl border p-4"
                        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4" style={{ color: tokens.domain.opportunity }} />
                            <h3 className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>AI Intelligence Narrative</h3>
                          </div>
                          <InlineFeedback context="company-narrative" itemId={company.id ?? 'company-1'} itemType="intelligence" />
                        </div>
                        <p className="text-[12px] leading-relaxed" style={{ color: tokens.text.secondary }}>
                          {company.narrative}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Signals Tab ── */}
                  {activeTab === 'signals' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4" style={{ color: tokens.domain.signal }} />
                          <h3 className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>Intelligence Signals</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: `${tokens.domain.signal}15`, color: tokens.domain.signal }}>
                            {company.signals?.length ?? 0}
                          </span>
                        </div>
                      </div>
                      {(company.signals ?? []).map((signal: IntelligenceSignal) => (
                        <SignalCard key={signal.id} signal={signal} />
                      ))}
                      {(!company.signals || company.signals.length === 0) && (
                        <EmptyState icon={Zap} title="No signals detected" description="Intelligence signals will appear here when detected." />
                      )}
                    </div>
                  )}

                  {/* ── Opportunities Tab ── */}
                  {activeTab === 'opportunities' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4" style={{ color: tokens.domain.opportunity }} />
                          <h3 className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>Opportunities</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: `${tokens.domain.opportunity}15`, color: tokens.domain.opportunity }}>
                            {company.opportunities?.length ?? 0}
                          </span>
                        </div>
                      </div>
                      {(company.opportunities ?? []).map((opp: any) => (
                        <OpportunityCard key={opp.id} opp={opp} />
                      ))}
                      {(!company.opportunities || company.opportunities.length === 0) && (
                        <EmptyState icon={Target} title="No opportunities yet" description="Opportunities will be tracked here as they are identified." />
                      )}
                    </div>
                  )}

                  {/* ── Notes Tab ── */}
                  {activeTab === 'notes' && (
                    <div
                      className="rounded-xl border p-8 text-center"
                      style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
                    >
                      <EmptyState
                        icon={MessageSquare}
                        title="Notes & Annotations"
                        description="Capture insights, meeting notes, and strategic observations about this account. Coming soon."
                      />
                    </div>
                  )}

                  {/* ── Timeline Tab ── */}
                  {activeTab === 'timeline' && (
                    <div
                      className="rounded-xl border p-8 text-center"
                      style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
                    >
                      <EmptyState
                        icon={Clock}
                        title="Account Timeline"
                        description="A chronological view of all intelligence events, interactions, and milestones. Coming soon."
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      </PageTransition>
    </ErrorBoundary>
  );
}
