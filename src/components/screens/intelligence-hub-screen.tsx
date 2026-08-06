'use client';

import { useState } from 'react';
import {
  Radar, Target, Brain, Building2,
  TrendingUp, Search, Upload, FileDown,
  Sparkles, Activity, ChevronRight, Zap
} from 'lucide-react';
import { TrustIndicator } from '@/components/intelligence-os/atoms/trust-indicator';
import { ActionCTA, type CTAAction } from '@/components/intelligence-os/atoms/action-cta';
import { IntelligenceBriefingCard } from '@/components/intelligence-os/molecules/intelligence-briefing-card';
import { RecommendationCard } from '@/components/intelligence-os/molecules/recommendation-card';
import { ActivityFeed } from '@/components/intelligence-os/molecules/activity-feed';
import type {
  IntelligenceSignal, Recommendation, ActivityEvent, ExecutiveStats,
} from '@/lib/intelligence-types';

/* ── Mock Data ── */
const mockStats: ExecutiveStats = {
  prioritySignals: 8,
  activeOpportunities: 12,
  confidenceAverage: 78,
  accountsMonitored: 147,
  prioritySignalsDelta: 3,
  activeOpportunitiesDelta: 2,
  confidenceAverageDelta: -2,
  accountsMonitoredDelta: 5,
};

const mockSignals: IntelligenceSignal[] = [
  {
    id: 'sig-1',
    type: 'leadership_change',
    headline: 'New CTO appointed at Meridian Systems',
    summary: 'Meridian Systems appointed a new Chief Technology Officer from a cloud-native background. This signals potential technology stack migration and partnership opportunities.',
    confidenceScore: 92,
    freshnessTimestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    source: 'LinkedIn + SEC Filing',
    priority: 'high',
    reasoning: 'Leadership changes at the CTO level typically precede technology strategy shifts within 6-12 months. Combined with recent job postings for Kubernetes engineers, this suggests a cloud migration initiative. Historical analysis shows 73% of similar signals led to vendor changes within the quarter.',
    status: 'active',
    accountId: 'acc-meridian',
    accountName: 'Meridian Systems',
    evidenceAvailable: true,
    evidenceCount: 4,
    tags: ['Leadership', 'Cloud Migration', 'Technology'],
  },
  {
    id: 'sig-2',
    type: 'funding_event',
    headline: 'Vertex AI closed $45M Series C round',
    summary: 'Vertex AI secured $45M in Series C funding led by Sequoia Capital, bringing total funding to $120M. Expansion signals are strong.',
    confidenceScore: 96,
    freshnessTimestamp: new Date(Date.now() - 3 * 60000).toISOString(),
    source: 'PitchBook + Press Release',
    priority: 'critical',
    reasoning: 'Series C funding at this level typically correlates with aggressive sales team expansion within 3-6 months. Historical pattern analysis indicates 82% probability of CRM/platform purchase within the next 2 quarters. The Sequoia investment validates the business model and reduces risk.',
    status: 'active',
    accountId: 'acc-vertex',
    accountName: 'Vertex AI',
    evidenceAvailable: true,
    evidenceCount: 6,
    tags: ['Funding', 'Expansion', 'High Priority'],
  },
  {
    id: 'sig-3',
    type: 'competitive_move',
    headline: 'Apex Analytics launched enterprise tier',
    summary: 'Direct competitor Apex Analytics announced an enterprise-focused tier with AI-driven analytics. May impact positioning for shared prospects.',
    confidenceScore: 71,
    freshnessTimestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    source: 'Product Hunt + Blog',
    priority: 'medium',
    reasoning: 'Apex Analytics entering the enterprise segment creates competitive overlap with 15 shared accounts in your pipeline. Their pricing model appears 20% lower but lacks the intelligence depth of DeepMindQ. This is a positioning opportunity, not a threat.',
    status: 'active',
    evidenceAvailable: true,
    evidenceCount: 2,
    tags: ['Competitive', 'Enterprise', 'Market'],
  },
  {
    id: 'sig-4',
    type: 'technology_investment',
    headline: 'NovaTech evaluating data intelligence platforms',
    summary: 'Web activity analysis shows NovaTech engineering team researching AI-powered customer intelligence solutions. Three RFPs detected.',
    confidenceScore: 65,
    freshnessTimestamp: new Date(Date.now() - 26 * 3600000).toISOString(),
    source: 'Website Intelligence + Intent Data',
    priority: 'high',
    reasoning: 'Multiple visits to competitor pricing pages, combined with RFP activity detected through public procurement databases, suggests active buying intent. The engineering team focus indicates a technical evaluation rather than executive-driven purchase.',
    status: 'active',
    accountId: 'acc-novatech',
    accountName: 'NovaTech Solutions',
    evidenceAvailable: true,
    evidenceCount: 3,
    tags: ['Buying Intent', 'Evaluation', 'RFP'],
  },
];

const mockRecommendations: Recommendation[] = [
  {
    id: 'rec-1',
    title: 'Prioritize Meridian Systems outreach',
    description: 'The CTO transition creates a 90-day window for technology vendor engagement. Their current contract expires in Q4.',
    confidence: 88,
    reasoning: 'Leadership transitions create a unique 90-day window where new executives evaluate existing vendor relationships. Meridian\'s current CRM contract expires Q4, and their new CTO\'s cloud-native background aligns perfectly with your platform capabilities.',
    actionType: 'schedule',
    status: 'pending',
    signalId: 'sig-1',
    accountId: 'acc-meridian',
    accountName: 'Meridian Systems',
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 'rec-2',
    title: 'Prepare competitive brief for Apex Analytics',
    description: 'Update battle cards and positioning documents to address their new enterprise tier pricing.',
    confidence: 76,
    reasoning: 'With Apex Analytics entering your competitive space, updating positioning documents ensures your sales team can effectively differentiate. Focus on intelligence depth and AI reasoning capabilities where DeepMindQ has clear advantage.',
    actionType: 'review',
    status: 'pending',
    signalId: 'sig-3',
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 'rec-3',
    title: 'Accelerate NovaTech qualification',
    description: 'Three RFP signals indicate active buying process. Schedule discovery call this week.',
    confidence: 72,
    reasoning: 'The combination of website research patterns and RFP activity strongly suggests NovaTech is in the evaluation phase. Speed of engagement correlates with win rate — teams that engage within 5 days of first intent signal see 3x higher conversion.',
    actionType: 'schedule',
    status: 'pending',
    signalId: 'sig-4',
    accountId: 'acc-novatech',
    accountName: 'NovaTech Solutions',
    createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
  },
];

const mockActivity: ActivityEvent[] = [
  {
    id: 'evt-1',
    type: 'signal_detected',
    headline: 'New signal: Vertex AI $45M Series C',
    description: 'Funding event detected',
    timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
    source: 'PitchBook',
    confidence: 96,
    trustLevel: 'verified',
  },
  {
    id: 'evt-2',
    type: 'confidence_updated',
    headline: 'Meridian Systems confidence increased to 92%',
    description: 'New evidence strengthened signal',
    timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
    source: 'Multi-source',
    confidence: 92,
    trustLevel: 'high',
  },
  {
    id: 'evt-3',
    type: 'recommendation_generated',
    headline: 'New recommendation: Prioritize Meridian outreach',
    description: 'AI identified 90-day engagement window',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    source: 'AI Reasoning Engine',
  },
  {
    id: 'evt-4',
    type: 'data_refreshed',
    headline: 'Company data refreshed for 147 accounts',
    description: 'Scheduled enrichment cycle complete',
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    source: 'Data Pipeline',
  },
  {
    id: 'evt-5',
    type: 'account_changed',
    headline: 'NovaTech added 3 new engineering roles',
    description: 'Job posting analysis detected',
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    source: 'Job Intelligence',
    confidence: 65,
    trustLevel: 'medium',
  },
];

/* ── Stat Card Component ── */
function ExecutiveStatCard({
  icon: Icon,
  label,
  value,
  delta,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  delta?: number;
  color: string;
}) {
  return (
    <div className="dmq-glass-card p-4 lg:p-5 transition-all duration-200 hover:border-[var(--border-light)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--primary-dim)]">
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-[var(--primary)] tabular-nums tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {delta !== undefined && (
          <span
            className={`text-[11px] font-semibold tabular-nums pb-0.5 ${
              delta > 0 ? 'text-[var(--success-green)]' : delta < 0 ? 'text-[var(--risk-red)]' : 'text-[var(--primary-dim)]'
            }`}
          >
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Intelligence Hub Screen ── */
export default function IntelligenceHubScreen() {
  const [recommendations, setRecommendations] = useState(mockRecommendations);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  const handleRecommendationAction = (action: string, id: string) => {
    setRecommendations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: action === 'accept' ? 'accepted' as const : action === 'dismiss' ? 'dismissed' as const : 'saved' as const }
          : r
      )
    );
  };

  const handleSignalAction = (action: string, signalId: string) => {
    // Placeholder for MS7 — will be wired to real intelligence actions in MS8+
    console.log('Signal action:', action, signalId);
  };

  const pendingRecommendations = recommendations.filter(r => r.status === 'pending');

  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ color: 'var(--primary)' }}>
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 lg:py-8">
        
        {/* ── Header ── */}
        <header className="mb-6 lg:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--signal-blue)] flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[13px] font-semibold tracking-tight">DeepMindQ</span>
                </div>
                <span className="text-[11px] font-medium text-[var(--primary-dim)]">
                  Intelligence Platform
                </span>
              </div>
              <h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-tight leading-tight">
                {greeting}
              </h1>
              <p className="text-[var(--primary-dim)] text-[13px] mt-1">
                {dateStr} · {timeStr}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--success-green-low)] border border-[var(--trust-verified-border)]">
                <span className="w-2 h-2 rounded-full bg-[var(--trust-verified)] animate-pulse" />
                <span className="text-[12px] font-medium text-[var(--trust-verified)]">
                  {mockStats.prioritySignals} priority signals
                </span>
              </div>
            </div>
          </div>

          {/* ── Executive Stats Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <ExecutiveStatCard
              icon={Radar}
              label="Priority Signals"
              value={mockStats.prioritySignals}
              delta={mockStats.prioritySignalsDelta}
              color="var(--signal-blue)"
            />
            <ExecutiveStatCard
              icon={Target}
              label="Active Opportunities"
              value={mockStats.activeOpportunities}
              delta={mockStats.activeOpportunitiesDelta}
              color="var(--opportunity-purple)"
            />
            <ExecutiveStatCard
              icon={Brain}
              label="Confidence Avg"
              value={`${mockStats.confidenceAverage}%`}
              delta={mockStats.confidenceAverageDelta}
              color="var(--trust-high)"
            />
            <ExecutiveStatCard
              icon={Building2}
              label="Accounts Monitored"
              value={mockStats.accountsMonitored}
              delta={mockStats.accountsMonitoredDelta}
              color="var(--enrichment-cyan)"
            />
          </div>
        </header>

        {/* ── Main Content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          
          {/* Left Column: Signals + Recommendations (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* ── Signal Intelligence Section ── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Radar className="w-4 h-4 text-[var(--signal-blue)]" />
                  <h2 className="text-[15px] font-semibold tracking-tight">Signal Intelligence</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--signal-blue-low)] text-[var(--signal-blue)]">
                    {mockSignals.length} signals
                  </span>
                </div>
                <button className="flex items-center gap-1 text-[12px] font-medium text-[var(--primary-dim)] hover:text-[var(--accent)] transition-colors min-h-[44px] px-2">
                  View all
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                {mockSignals.map((signal) => (
                  <IntelligenceBriefingCard
                    key={signal.id}
                    signal={signal}
                    onAction={handleSignalAction}
                  />
                ))}
              </div>
            </section>

            {/* ── Recommendations Section ── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--opportunity-purple)]" />
                  <h2 className="text-[15px] font-semibold tracking-tight">AI Recommendations</h2>
                  {pendingRecommendations.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--opportunity-purple-low)] text-[var(--opportunity-purple)]">
                      {pendingRecommendations.length} pending
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onAction={handleRecommendationAction}
                  />
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Activity + Quick Actions (1/3 width) */}
          <div className="space-y-4 lg:space-y-6">
            
            {/* ── Activity Feed ── */}
            <section className="dmq-glass-card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--enrichment-cyan)]" />
                  <h2 className="text-[13px] font-semibold">Activity Feed</h2>
                </div>
                <span className="text-[11px] text-[var(--primary-dim)]">Last 24h</span>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                <ActivityFeed events={mockActivity} />
              </div>
            </section>

            {/* ── Quick Actions ── */}
            <section className="dmq-glass-card p-4">
              <h2 className="text-[13px] font-semibold mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Search, label: 'New Analysis', color: 'var(--signal-blue)' },
                  { icon: Upload, label: 'Import Accounts', color: 'var(--enrichment-cyan)' },
                  { icon: TrendingUp, label: 'Configure Sources', color: 'var(--success-green)' },
                  { icon: FileDown, label: 'Export Report', color: 'var(--warning-amber)' },
                ].map(({ icon: Icon, label, color }) => (
                  <button
                    key={label}
                    className="flex items-center gap-2.5 px-3 py-3 rounded-lg border border-[var(--border)] text-[12px] font-medium text-[var(--primary)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-light)] transition-colors min-h-[44px] justify-start"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* ── Intelligence Summary ── */}
            <section className="dmq-glass-card p-4">
              <h2 className="text-[13px] font-semibold mb-2">Intelligence Summary</h2>
              <p className="text-[12px] text-[var(--primary-dim)] leading-relaxed">
                Enterprise SaaS buying signals increased 18% this week, primarily driven by leadership 
                changes and technology investment patterns. 3 accounts show critical engagement signals 
                requiring immediate attention.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
