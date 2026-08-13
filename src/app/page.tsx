'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Brain, Radio, Network, Upload, Zap, Search,
  Building2, Users, Shield,
  ChevronRight, ArrowUpRight, Activity, Target,
  GitBranch, BarChart3, Database,
  Sparkles, Globe, Layers, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  organizations: number;
  people: number;
  relationshipTypes: Record<string, number>;
  avgConnectionsPerNode: number;
  isolatedNodes: number;
  largestCluster: number;
}

interface OrgSummary {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  intelligenceScore: number | null;
  trackingStatus: string;
  signalCount: number;
  lastSignalAt: string | null;
}

interface SignalItem {
  id: string;
  signalType: string;
  severity: string;
  title: string;
  description: string;
  confidenceScore: number;
  detectedAt: string;
}

interface InsightItem {
  id: string;
  category: string;
  title: string;
  narrative: string;
  recommendation: string;
  confidence: string;
  confidenceScore: number;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string; hex: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', dot: 'bg-red-500', hex: '#EF4444' },
  high:     { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-500', hex: '#F97316' },
  medium:   { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', dot: 'bg-yellow-500', hex: '#EAB308' },
  low:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500', hex: '#10B981' },
};

const CATEGORY_CONFIG: Record<string, { icon: typeof Target; color: string; bg: string; hex: string }> = {
  opportunity:    { icon: Target,  color: 'text-violet-400',  bg: 'bg-violet-500/10', hex: '#8B5CF6' },
  risk:           { icon: Shield, color: 'text-red-400',     bg: 'bg-red-500/10', hex: '#EF4444' },
  recommendation: { icon: Brain,  color: 'text-blue-400',    bg: 'bg-blue-500/10', hex: '#3B82F6' },
  pattern:        { icon: Network, color: 'text-cyan-400',    bg: 'bg-cyan-500/10', hex: '#06B6D4' },
};

// ────────────────────────────────────────────────────────────
// Mock Data
// ────────────────────────────────────────────────────────────

function getMockStats(): GraphStats {
  return {
    totalNodes: 24, totalEdges: 31, organizations: 8, people: 16,
    relationshipTypes: { works_at: 14, coworker: 8, competes_with: 5, same_region: 3, partnered_with: 1 },
    avgConnectionsPerNode: 2.58, isolatedNodes: 2, largestCluster: 22,
  };
}

function getMockOrgs(): OrgSummary[] {
  return [
    { id: '1', name: 'Stratoscale AI', domain: 'stratoscale.ai', industry: 'AI / Machine Learning', employeeCount: 1200, intelligenceScore: 87, trackingStatus: 'active', signalCount: 12, lastSignalAt: '2026-08-12T14:30:00Z' },
    { id: '2', name: 'Meridian Fintech', domain: 'meridian.io', industry: 'FinTech', employeeCount: 450, intelligenceScore: 72, trackingStatus: 'active', signalCount: 7, lastSignalAt: '2026-08-11T09:00:00Z' },
    { id: '3', name: 'NovaTech Solutions', domain: 'novatech.com', industry: 'Cloud SaaS', employeeCount: 3200, intelligenceScore: 65, trackingStatus: 'active', signalCount: 5, lastSignalAt: '2026-08-10T16:00:00Z' },
    { id: '4', name: 'Quantum Health', domain: 'quantumhealth.co', industry: 'HealthTech', employeeCount: 800, intelligenceScore: 58, trackingStatus: 'active', signalCount: 3, lastSignalAt: '2026-08-09T11:00:00Z' },
    { id: '5', name: 'Atlas Cyberdefense', domain: 'atlascyber.com', industry: 'Cybersecurity', employeeCount: 600, intelligenceScore: 45, trackingStatus: 'active', signalCount: 2, lastSignalAt: '2026-08-08T08:00:00Z' },
    { id: '6', name: 'Orbit Analytics', domain: 'orbitanalytics.io', industry: 'Data Analytics', employeeCount: 280, intelligenceScore: 91, trackingStatus: 'active', signalCount: 15, lastSignalAt: '2026-08-12T18:00:00Z' },
    { id: '7', name: 'Peak Logistics', domain: 'peaklogistics.com', industry: 'Supply Chain', employeeCount: 2100, intelligenceScore: 53, trackingStatus: 'monitoring', signalCount: 4, lastSignalAt: '2026-08-07T12:00:00Z' },
    { id: '8', name: 'CipherTrust Security', domain: 'ciphertrust.io', industry: 'Cybersecurity', employeeCount: 350, intelligenceScore: 78, trackingStatus: 'active', signalCount: 9, lastSignalAt: '2026-08-11T16:30:00Z' },
  ];
}

function getMockSignals(): SignalItem[] {
  return [
    { id: 's1', signalType: 'market_expansion', severity: 'high', title: 'Stratoscale AI closes $45M Series C', description: 'Major funding round positions Stratoscale for aggressive expansion. Expected headcount growth of 40% within 12 months, creating infrastructure buying intent.', confidenceScore: 92, detectedAt: '2026-08-12T14:30:00Z' },
    { id: 's2', signalType: 'leadership_change', severity: 'high', title: 'New CTO appointed at Meridian Fintech', description: 'David Park joins as CTO from Stripe. Known for cloud-native architecture preferences. Likely to drive technology stack modernization within first 90 days.', confidenceScore: 88, detectedAt: '2026-08-11T09:00:00Z' },
    { id: 's3', signalType: 'technology_change', severity: 'medium', title: 'NovaTech Solutions adopting Kubernetes', description: 'Job postings indicate enterprise-wide Kubernetes migration. Infrastructure team hiring 8 engineers suggests major cloud transformation initiative.', confidenceScore: 76, detectedAt: '2026-08-10T16:00:00Z' },
    { id: 's4', signalType: 'customer_signal', severity: 'critical', title: 'Atlas Cyberdefense security breach reported', description: 'Public disclosure of security incident. Incident response team expanded. Immediate buying intent for security monitoring and compliance tools.', confidenceScore: 95, detectedAt: '2026-08-09T11:00:00Z' },
    { id: 's5', signalType: 'hiring_spike', severity: 'medium', title: 'Orbit Analytics hiring 12 sales reps', description: 'Aggressive sales team expansion indicates new product launch or market push. Timing aligns with Q4 revenue targets.', confidenceScore: 82, detectedAt: '2026-08-08T08:00:00Z' },
    { id: 's6', signalType: 'financial_indicator', severity: 'low', title: 'Peak Logistics reduces Q3 guidance', description: 'Lowered revenue guidance by 8%. May trigger cost optimization initiatives and vendor consolidation.', confidenceScore: 70, detectedAt: '2026-08-07T12:00:00Z' },
  ];
}

function getMockInsights(): InsightItem[] {
  return [
    { id: 'i1', category: 'opportunity', title: 'Orbit Analytics — Prime for engagement', narrative: 'Composite intelligence score of 91/100 with 15 active signals, 8 known contacts, and complete data coverage. Sales team expansion confirms go-to-market motion.', recommendation: 'Prioritize Orbit Analytics as Tier 1. Schedule executive briefing within 5 days. Lead with cloud infrastructure ROI narrative.', confidence: 'very_high', confidenceScore: 94 },
    { id: 'i2', category: 'opportunity', title: 'Stratoscale AI — Funding-driven infrastructure buying', narrative: 'Series C funding creates 6-12 month window for infrastructure vendor selection. CTO has published blog posts on scalability challenges.', recommendation: 'Connect with CTO office immediately. Provide technical whitepaper on scalability patterns. Position as infrastructure partner.', confidence: 'high', confidenceScore: 87 },
    { id: 'i3', category: 'risk', title: 'Atlas Cyberdefense — Breach creates volatile environment', narrative: 'Post-breach environment is high-opportunity but high-risk. Budget authority shifts to CISO. Decision timeline compressed to 30-60 days.', recommendation: 'Lead with breach response capabilities. Engage CISO directly through security community channels.', confidence: 'high', confidenceScore: 85 },
    { id: 'i4', category: 'recommendation', title: 'Multi-thread Meridian Fintech across 3 executives', narrative: 'New CTO David Park brings cloud-native bias. CEO Sarah Chen focuses on revenue acceleration. CRO Maya Rodriguez drives pipeline efficiency.', recommendation: 'Deploy 3 tailored campaigns: CTO (technical depth), CEO (business outcomes), CRO (pipeline acceleration).', confidence: 'medium', confidenceScore: 72 },
  ];
}

// ────────────────────────────────────────────────────────────
// Data Hook
// ────────────────────────────────────────────────────────────

function useApiData<T>(url: string, fallback: T, enabled = true) {
  return useQuery({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('API unavailable');
      const json = await res.json();
      return json.data as T;
    },
    enabled,
    retry: 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ────────────────────────────────────────────────────────────
// Navigation
// ────────────────────────────────────────────────────────────

type TabId = 'overview' | 'signals' | 'insights' | 'graph' | 'target' | 'pipeline';

const NAV_ITEMS: { id: TabId; label: string; icon: typeof Brain; description: string }[] = [
  { id: 'overview',  label: 'Command Center', icon: Activity,  description: 'Real-time intelligence overview' },
  { id: 'target',    label: 'Target Intel',   icon: Target,    description: 'Organization tracking & scoring' },
  { id: 'signals',   label: 'Signal Feed',     icon: Radio,     description: 'Detected events & patterns' },
  { id: 'insights',  label: 'AI Reasoning',    icon: Brain,     description: 'Intelligence analysis & actions' },
  { id: 'graph',     label: 'Knowledge Graph',  icon: Network,   description: 'Entity relationships' },
  { id: 'pipeline',  label: 'Pipeline',        icon: BarChart3, description: 'Revenue pipeline intelligence' },
];

// ────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: stats = getMockStats() } = useApiData<GraphStats>('/api/knowledge-graph/stats', getMockStats());
  const { data: orgs = getMockOrgs() } = useApiData<OrgSummary[]>('/api/organizations?limit=50', getMockOrgs());

  const totalSignals = orgs.reduce((sum, o) => sum + o.signalCount, 0);
  const highValueOrgs = orgs.filter(o => o.intelligenceScore && o.intelligenceScore > 60).length;

  return (
    <div className="flex h-screen overflow-hidden bg-[#070a10] text-zinc-100">
      {/* ─── Sidebar ─── */}
      <aside className={`flex flex-col border-r border-white/[0.06] bg-[#0b0e16]/90 backdrop-blur-xl transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'}`}>
        <div className="flex h-14 items-center gap-3 border-b border-white/[0.06] px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20">
            <Brain className="h-4 w-4 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold tracking-tight text-white">DeepMindQ</h1>
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Intelligence OS</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 ${isActive ? 'bg-gradient-to-r from-blue-500/15 to-violet-500/10 text-white shadow-sm' : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-blue-400' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium leading-tight truncate ${isActive ? 'text-white' : ''}`}>{item.label}</p>
                    {isActive && <p className="text-[10px] text-zinc-500 leading-tight truncate mt-0.5">{item.description}</p>}
                  </div>
                )}
                {isActive && !sidebarCollapsed && <div className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50 shrink-0" />}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-zinc-600 hover:bg-white/[0.03] hover:text-zinc-400 transition-colors">
            <Layers className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span className="text-xs">{sidebarCollapsed ? 'Expand' : 'Collapse'}</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#070a10]/80 backdrop-blur-xl px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">All Systems Active</span>
            </div>
            <div className="h-4 w-px bg-white/[0.06]" />
            <span className="text-[11px] text-zinc-600 tabular-nums">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
              <input type="text" placeholder="Search entities..." className="h-8 w-64 rounded-lg border border-white/[0.06] bg-white/[0.03] pl-9 pr-3 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 transition-all" />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-600">/</kbd>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-300" onClick={() => toast.success('Pipeline refreshed')}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'overview' && <OverviewView stats={stats} orgs={orgs} totalSignals={totalSignals} highValueOrgs={highValueOrgs} onNavigate={setActiveTab} />}
          {activeTab === 'target' && <TargetIntelView orgs={orgs} />}
          {activeTab === 'signals' && <SignalsView />}
          {activeTab === 'insights' && <InsightsView />}
          {activeTab === 'graph' && <GraphView stats={stats} />}
          {activeTab === 'pipeline' && <PipelineView orgs={orgs} />}
        </main>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// OVERVIEW
// ────────────────────────────────────────────────────────────

function OverviewView({ stats, orgs, totalSignals, highValueOrgs, onNavigate }: {
  stats: GraphStats; orgs: OrgSummary[]; totalSignals: number; highValueOrgs: number;
  onNavigate: (/* tab: TabId */ tabId: TabId) => void;
}) {
  const topOrgs = useMemo(() => [...orgs].sort((a, b) => (b.intelligenceScore || 0) - (a.intelligenceScore || 0)).slice(0, 5), [orgs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Organizations" value={stats.organizations} subtitle={`${stats.people} people in graph`} icon={Building2} iconColor="text-blue-400" iconBg="bg-blue-500/10" accent="from-blue-500/5 to-transparent" />
        <StatCard label="Active Signals" value={totalSignals} subtitle="Across all targets" icon={Radio} iconColor="text-amber-400" iconBg="bg-amber-500/10" accent="from-amber-500/5 to-transparent" />
        <StatCard label="High-Value Targets" value={highValueOrgs} subtitle="Score above 60" icon={Target} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" accent="from-emerald-500/5 to-transparent" />
        <StatCard label="Graph Density" value={stats.totalEdges} subtitle={`${stats.avgConnectionsPerNode.toFixed(1)} avg connections`} icon={Network} iconColor="text-violet-400" iconBg="bg-violet-500/10" accent="from-violet-500/5 to-transparent" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-3 border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-400" /><CardTitle className="text-sm font-semibold text-white">Intelligence Leaderboard</CardTitle></div>
              <button onClick={() => onNavigate('target')} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-blue-400 transition-colors">View all <ArrowUpRight className="h-3 w-3" /></button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-2">
              {topOrgs.map((org, i) => (
                <div key={org.id} className="group flex items-center gap-4 rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 transition-all hover:border-white/[0.08] hover:bg-white/[0.03]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-xs font-bold text-zinc-500">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-200 truncate">{org.name}</p>
                      <Badge variant="secondary" className="text-[10px] bg-white/[0.04] text-zinc-500 border-white/[0.06] shrink-0">{org.industry}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-zinc-600 flex items-center gap-1"><Globe className="h-3 w-3" /> {org.domain}</span>
                      <span className="text-[11px] text-zinc-600 flex items-center gap-1"><Users className="h-3 w-3" /> {org.employeeCount?.toLocaleString()}</span>
                      <span className="text-[11px] text-zinc-600 flex items-center gap-1"><Radio className="h-3 w-3" /> {org.signalCount} signals</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-2">
                      <div className={`text-lg font-bold tabular-nums ${getScoreColor(org.intelligenceScore || 0)}`}>{org.intelligenceScore}</div>
                      <div className="text-[10px] text-zinc-600">/100</div>
                    </div>
                    <div className="mt-1 h-1 w-20 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getScoreBarColor(org.intelligenceScore || 0)}`} style={{ width: `${org.intelligenceScore || 0}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-400/50" /><CardTitle className="text-sm font-semibold text-white">Live Signal Feed</CardTitle></div>
              <button onClick={() => onNavigate('signals')} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-blue-400 transition-colors">All signals <ArrowUpRight className="h-3 w-3" /></button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-3">
              {getMockSignals().slice(0, 4).map((signal) => {
                const style = SEVERITY_STYLES[signal.severity] || SEVERITY_STYLES.medium;
                return (
                  <div key={signal.id} className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 transition-all hover:border-white/[0.08]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      <Badge variant="secondary" className={`text-[9px] font-semibold uppercase tracking-wider ${style.bg} ${style.text} border-0`}>{signal.severity}</Badge>
                      <span className="text-[10px] text-zinc-600 ml-auto tabular-nums">{formatTimeAgo(signal.detectedAt)}</span>
                    </div>
                    <p className="text-xs font-medium text-zinc-300 leading-snug">{signal.title}</p>
                    <p className="text-[11px] text-zinc-600 mt-1 line-clamp-2 leading-relaxed">{signal.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-violet-400" /><CardTitle className="text-sm font-semibold text-white">AI Intelligence Analysis</CardTitle></div>
              <button onClick={() => onNavigate('insights')} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-blue-400 transition-colors">Full analysis <ArrowUpRight className="h-3 w-3" /></button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-3">
              {getMockInsights().slice(0, 3).map((insight) => {
                const config = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.opportunity;
                return (
                  <div key={insight.id} className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-4 transition-all hover:border-white/[0.08]">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg p-2 shrink-0 ${config.bg}`}><config.icon className={`h-4 w-4 ${config.color}`} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-zinc-200">{insight.title}</p>
                          <div className="flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5">
                            <div className={`h-1.5 w-1.5 rounded-full ${insight.confidenceScore >= 80 ? 'bg-emerald-400' : insight.confidenceScore >= 60 ? 'bg-yellow-400' : 'bg-orange-400'}`} />
                            <span className="text-[10px] font-medium text-zinc-400 tabular-nums">{insight.confidenceScore}%</span>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed line-clamp-2">{insight.narrative}</p>
                        <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-blue-500/[0.06] border border-blue-500/10 px-3 py-2">
                          <Zap className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-blue-300/80 leading-relaxed">{insight.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3 px-5 pt-5"><CardTitle className="text-sm font-semibold text-white">Quick Actions</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              {[
                { label: 'Upload Intelligence Data', icon: Upload, desc: 'Excel/CSV import', color: 'text-blue-400' },
                { label: 'Discover Relationships', icon: GitBranch, desc: 'Auto-find connections', color: 'text-violet-400' },
                { label: 'Run AI Pipeline', icon: Zap, desc: 'Full analysis run', color: 'text-amber-400' },
                { label: 'Resolve Entities', icon: Network, desc: 'Merge duplicates', color: 'text-cyan-400' },
              ].map((action) => (
                <button key={action.label} onClick={() => toast.info(`${action.label} — API endpoint ready`)} className="flex items-center gap-3 w-full rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 text-left transition-all hover:border-white/[0.08] hover:bg-white/[0.03] group">
                  <action.icon className={`h-4 w-4 shrink-0 ${action.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                  <div><p className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">{action.label}</p><p className="text-[10px] text-zinc-600">{action.desc}</p></div>
                  <ChevronRight className="h-3 w-3 text-zinc-700 ml-auto shrink-0" />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3 px-5 pt-5"><CardTitle className="text-sm font-semibold text-white">System Modules</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-2.5">
                {[
                  { name: 'Data Ingestion', status: 'operational', icon: Database },
                  { name: 'Knowledge Graph', status: 'operational', icon: Network },
                  { name: 'Signal Engine', status: 'operational', icon: Radio },
                  { name: 'AI Reasoning', status: 'operational', icon: Brain },
                ].map((mod) => (
                  <div key={mod.name} className="flex items-center gap-3">
                    <mod.icon className="h-3.5 w-3.5 text-zinc-600" />
                    <span className="text-xs text-zinc-400 flex-1">{mod.name}</span>
                    <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-emerald-400" /><span className="text-[10px] text-emerald-400/70">{mod.status}</span></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// TARGET INTEL
// ────────────────────────────────────────────────────────────

function TargetIntelView({ orgs }: { orgs: OrgSummary[] }) {
  const [sortBy, setSortBy] = useState<'score' | 'signals' | 'employees'>('score');
  const sorted = useMemo(() => {
    return [...orgs].sort((a, b) => {
      if (sortBy === 'score') return (b.intelligenceScore || 0) - (a.intelligenceScore || 0);
      if (sortBy === 'signals') return b.signalCount - a.signalCount;
      return (b.employeeCount || 0) - (a.employeeCount || 0);
    });
  }, [orgs, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Target className="h-5 w-5 text-blue-400" />Target Intelligence</h2>
          <p className="text-xs text-zinc-500 mt-1">Organizations ranked by intelligence score, signal activity, and enterprise scale</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
          {(['score', 'signals', 'employees'] as const).map((sort) => (
            <button key={sort} onClick={() => setSortBy(sort)} className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all capitalize ${sortBy === sort ? 'bg-blue-500/15 text-blue-400 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}>{sort}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {sorted.map((org, i) => (
          <div key={org.id} className="group flex items-center gap-4 rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 transition-all hover:border-white/[0.08] hover:bg-white/[0.03]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-white/[0.06]"><span className="text-sm font-bold text-zinc-400">{i + 1}</span></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-zinc-200">{org.name}</p>
                <Badge variant="secondary" className="text-[9px] bg-white/[0.04] text-zinc-500 border-white/[0.06]">{org.industry}</Badge>
                <Badge variant="secondary" className={`text-[9px] ${org.trackingStatus === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'} border`}>{org.trackingStatus}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-1.5">
                <span className="text-[11px] text-zinc-600">{org.domain}</span>
                <span className="text-[11px] text-zinc-600">{org.employeeCount?.toLocaleString()} employees</span>
                <span className="text-[11px] text-zinc-600">{org.signalCount} signals</span>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Intelligence Score</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xl font-bold tabular-nums ${getScoreColor(org.intelligenceScore || 0)}`}>{org.intelligenceScore}</span>
                  <span className="text-[11px] text-zinc-600">/ 100</span>
                </div>
              </div>
              <div className="h-10 w-24 rounded-lg bg-white/[0.04] border border-white/[0.06] p-1.5">
                <ScoreBar score={org.intelligenceScore || 0} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SIGNALS
// ────────────────────────────────────────────────────────────

function SignalsView() {
  const signals = getMockSignals();
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? signals : signals.filter(s => s.severity === filter);
  const counts = useMemo(() => ({
    all: signals.length,
    critical: signals.filter(s => s.severity === 'critical').length,
    high: signals.filter(s => s.severity === 'high').length,
    medium: signals.filter(s => s.severity === 'medium').length,
    low: signals.filter(s => s.severity === 'low').length,
  }), [signals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Radio className="h-5 w-5 text-amber-400" />Signal Intelligence Feed</h2>
          <p className="text-xs text-zinc-500 mt-1">Detected business events, market shifts, and pattern recognition</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all capitalize flex items-center gap-1.5 ${filter === f ? 'bg-blue-500/15 text-blue-400 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}>
              {f !== 'all' && <div className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[f]?.dot}`} />}
              {f}
              {counts[f] > 0 && <span className="text-[9px] opacity-60">({counts[f]})</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {filtered.map((signal) => {
          const style = SEVERITY_STYLES[signal.severity] || SEVERITY_STYLES.medium;
          return (
            <Card key={signal.id} className="border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <CardContent className="p-0">
                <div className="flex">
                  <div className="w-1 shrink-0" style={{ backgroundColor: style.hex }} />
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className={`text-[9px] font-bold uppercase tracking-wider ${style.bg} ${style.text} border-0`}>{signal.severity}</Badge>
                          <Badge variant="secondary" className="text-[9px] bg-white/[0.04] text-zinc-500 border-white/[0.06]">{signal.signalType.replace(/_/g, ' ')}</Badge>
                          <span className="text-[10px] text-zinc-600">{formatTimeAgo(signal.detectedAt)}</span>
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-zinc-200">{signal.title}</h3>
                        <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed max-w-2xl">{signal.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-zinc-600 mb-1.5">Confidence</p>
                        <span className={`text-sm font-bold tabular-nums ${signal.confidenceScore >= 85 ? 'text-emerald-400' : signal.confidenceScore >= 70 ? 'text-yellow-400' : 'text-orange-400'}`}>{signal.confidenceScore}%</span>
                        <div className="mt-1 h-1 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${signal.confidenceScore}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// INSIGHTS
// ────────────────────────────────────────────────────────────

function InsightsView() {
  const insights = getMockInsights();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Brain className="h-5 w-5 text-violet-400" />AI Intelligence Analysis</h2>
          <p className="text-xs text-zinc-500 mt-1">Machine reasoning: &quot;Why does this matter? What should we do?&quot;</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 px-3 py-1.5">
            <Sparkles className="h-3 w-3 text-violet-400" />
            <span className="text-[11px] font-medium text-violet-400">{insights.length} active insights</span>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {insights.map((insight) => {
          const config = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.opportunity;
          return (
            <Card key={insight.id} className="border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <CardContent className="p-0">
                <div className="flex">
                  <div className="w-1 shrink-0" style={{ backgroundColor: config.hex }} />
                  <div className="flex-1 p-5">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-xl p-2.5 shrink-0 ${config.bg}`}><config.icon className={`h-5 w-5 ${config.color}`} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className={`text-[9px] font-semibold uppercase tracking-wider ${config.bg} ${config.color} border-0`}>{insight.category}</Badge>
                          <div className="flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1">
                            <div className={`h-1.5 w-1.5 rounded-full ${insight.confidenceScore >= 85 ? 'bg-emerald-400' : insight.confidenceScore >= 70 ? 'bg-yellow-400' : 'bg-orange-400'}`} />
                            <span className="text-[10px] font-semibold text-zinc-400 tabular-nums">{insight.confidenceScore}% confidence</span>
                          </div>
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-zinc-200">{insight.title}</h3>
                        <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{insight.narrative}</p>
                        <div className="mt-3 rounded-lg bg-gradient-to-r from-blue-500/[0.08] to-violet-500/[0.06] border border-blue-500/10 px-4 py-3">
                          <div className="flex items-start gap-2">
                            <Zap className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-bold text-blue-300/90 uppercase tracking-wider">Recommended Action</p>
                              <p className="mt-1 text-xs text-blue-200/70 leading-relaxed">{insight.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// GRAPH VIEW
// ────────────────────────────────────────────────────────────

function GraphView({ stats }: { stats: GraphStats }) {
  const relTypes = Object.entries(stats.relationshipTypes).sort((a, b) => b[1] - a[1]);
  const maxRel = Math.max(...relTypes.map(([, c]) => c));

  const nodes = useMemo(() => {
    const orgs = Array.from({ length: stats.organizations }, (_, i) => ({
      x: 250 + Math.cos((i / stats.organizations) * Math.PI * 2) * 160,
      y: 200 + Math.sin((i / stats.organizations) * Math.PI * 2) * 130,
      type: 'org' as const,
    }));
    const people = Array.from({ length: Math.min(stats.people, 16) }, (_, i) => ({
      x: 250 + Math.cos((i / 16) * Math.PI * 2 + 0.3) * (80 + Math.random() * 100),
      y: 200 + Math.sin((i / 16) * Math.PI * 2 + 0.3) * (60 + Math.random() * 80),
      type: 'person' as const,
    }));
    return [...orgs, ...people];
  }, [stats]);

  const edges = useMemo(() => {
    return Array.from({ length: Math.min(stats.totalEdges, 40) }, () => {
      const a = Math.floor(Math.random() * nodes.length);
      let b = Math.floor(Math.random() * nodes.length);
      if (b === a) b = (a + 1) % nodes.length;
      return { from: a, to: b };
    });
  }, [stats, nodes]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Network className="h-5 w-5 text-cyan-400" />Knowledge Graph</h2>
        <p className="text-xs text-zinc-500 mt-1">Entity connections, relationship mapping, and network intelligence</p>
      </div>

      <Card className="border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <CardContent className="p-0">
          <svg viewBox="0 0 500 400" className="w-full h-auto" style={{ maxHeight: '420px' }}>
            <defs>
              <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="personGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
              </radialGradient>
            </defs>
            <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
            </pattern>
            <rect width="500" height="400" fill="url(#grid)" />
            {edges.map((edge, idx) => (
              <line key={idx} x1={nodes[edge.from]?.x || 0} y1={nodes[edge.from]?.y || 0} x2={nodes[edge.to]?.x || 0} y2={nodes[edge.to]?.y || 0} stroke="rgba(59,130,246,0.12)" strokeWidth="1" />
            ))}
            {nodes.map((node, i) => (
              <g key={i}>
                <circle cx={node.x} cy={node.y} r={node.type === 'org' ? 16 : 10} fill={node.type === 'org' ? 'url(#nodeGlow)' : 'url(#personGlow)'} />
                <circle cx={node.x} cy={node.y} r={node.type === 'org' ? 5 : 3} fill={node.type === 'org' ? '#3B82F6' : '#8B5CF6'} />
              </g>
            ))}
          </svg>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Organizations" value={stats.organizations} icon={Building2} color="text-blue-400" />
        <MiniStat label="People" value={stats.people} icon={Users} color="text-violet-400" />
        <MiniStat label="Relationships" value={stats.totalEdges} icon={Network} color="text-cyan-400" />
        <MiniStat label="Largest Cluster" value={stats.largestCluster} icon={Globe} color="text-emerald-400" />
      </div>

      <Card className="border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-5"><CardTitle className="text-sm font-semibold text-white">Relationship Types</CardTitle></CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="space-y-3">
            {relTypes.map(([type, count]) => (
              <div key={type} className="flex items-center gap-4">
                <span className="text-xs text-zinc-400 w-36 shrink-0 capitalize">{type.replace(/_/g, ' ')}</span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500/60 to-violet-500/40 transition-all duration-700" style={{ width: `${(count / maxRel) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-zinc-400 tabular-nums w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Avg Connections</p>
            <p className="mt-1 text-2xl font-bold text-white tabular-nums">{stats.avgConnectionsPerNode.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Graph Density</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400 tabular-nums">{stats.totalNodes > 1 ? ((2 * stats.totalEdges) / (stats.totalNodes * (stats.totalNodes - 1))).toFixed(3) : '0'}</p>
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Isolated Nodes</p>
            <p className="mt-1 text-2xl font-bold text-amber-400 tabular-nums">{stats.isolatedNodes}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// PIPELINE
// ────────────────────────────────────────────────────────────

function PipelineView({ orgs }: { orgs: OrgSummary[] }) {
  const tiers = useMemo(() => {
    return [
      { name: 'Tier 1 — Immediate Action', color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/20', orgs: orgs.filter(o => o.intelligenceScore && o.intelligenceScore >= 80) },
      { name: 'Tier 2 — High Priority', color: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-500/20', orgs: orgs.filter(o => o.intelligenceScore && o.intelligenceScore >= 60 && o.intelligenceScore < 80) },
      { name: 'Tier 3 — Monitor', color: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/20', orgs: orgs.filter(o => o.intelligenceScore && o.intelligenceScore >= 40 && o.intelligenceScore < 60) },
      { name: 'Tier 4 — Nurture', color: 'from-zinc-500/20 to-zinc-500/5', border: 'border-zinc-500/20', orgs: orgs.filter(o => !o.intelligenceScore || o.intelligenceScore < 40) },
    ];
  }, [orgs]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-400" />Intelligence Pipeline</h2>
        <p className="text-xs text-zinc-500 mt-1">Organizations segmented by intelligence score and engagement priority</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiers.map((tier) => (
          <div key={tier.name} className={`rounded-xl border ${tier.border} bg-gradient-to-br ${tier.color} p-4`}>
            <p className="text-2xl font-bold text-white tabular-nums">{tier.orgs.length}</p>
            <p className="text-[10px] text-zinc-400 mt-1 leading-tight">{tier.name}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {tiers.map((tier) => (
          <div key={tier.name} className={`rounded-xl border ${tier.border} bg-gradient-to-b ${tier.color} p-4 space-y-3`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-300">{tier.name.split(' — ')[0]}</p>
              <Badge variant="secondary" className="text-[9px] bg-white/[0.06] text-zinc-400">{tier.orgs.length}</Badge>
            </div>
            {tier.orgs.map((org) => (
              <div key={org.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-xs font-medium text-zinc-300 truncate">{org.name}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-zinc-600">{org.signalCount} signals</span>
                  <span className={`text-xs font-bold tabular-nums ${getScoreColor(org.intelligenceScore || 0)}`}>{org.intelligenceScore}</span>
                </div>
              </div>
            ))}
            {tier.orgs.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">No targets in this tier</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Shared Components
// ────────────────────────────────────────────────────────────

function StatCard({ label, value, subtitle, icon: Icon, iconColor, iconBg, accent }: {
  label: string; value: number | string; subtitle: string;
  icon: typeof Brain; iconColor: string; iconBg: string; accent: string;
}) {
  return (
    <Card className={`border-white/[0.06] bg-gradient-to-br ${accent} backdrop-blur-sm overflow-hidden`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
            <p className="mt-1.5 text-2xl font-bold text-white tabular-nums">{value}</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">{subtitle}</p>
          </div>
          <div className={`rounded-xl p-2.5 ${iconBg}`}><Icon className={`h-5 w-5 ${iconColor}`} /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Brain; color: string }) {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">{label}</p>
          <p className="text-lg font-bold text-white tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative h-full rounded-md overflow-hidden bg-white/[0.04]">
      <div className={`absolute inset-y-0 left-0 rounded-md transition-all duration-500 ${score >= 80 ? 'bg-gradient-to-r from-emerald-500/40 to-emerald-500/20' : score >= 60 ? 'bg-gradient-to-r from-blue-500/40 to-blue-500/20' : score >= 40 ? 'bg-gradient-to-r from-amber-500/40 to-amber-500/20' : 'bg-gradient-to-r from-red-500/40 to-red-500/20'}`} style={{ width: `${score}%` }} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
