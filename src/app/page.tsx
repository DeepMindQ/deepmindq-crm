'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Radio, Brain, Network,
  AlertTriangle, Eye, RefreshCw,
  Upload, GitBranch, Zap, ChevronRight,
  Activity, Target, Shield, Users
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────

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

// ─── Severity color mapping ───────────────────────────────────────────────

const severityConfig: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  critical: { color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: AlertTriangle },
  high: { color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: AlertTriangle },
  medium: { color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: Eye },
  low: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: Eye },
};

const confidenceColor: Record<string, string> = {
  very_high: 'bg-emerald-500/20 text-emerald-300',
  high: 'bg-emerald-500/10 text-emerald-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-orange-500/10 text-orange-400',
  very_low: 'bg-red-500/10 text-red-400',
};

const categoryIcon: Record<string, typeof Target> = {
  opportunity: Target,
  risk: Shield,
  recommendation: Brain,
  pattern: Network,
};

// ─── Mock Data (used when API is unavailable) ──────────────────────────────

function getMockStats(): GraphStats {
  return {
    totalNodes: 24,
    totalEdges: 31,
    organizations: 8,
    people: 16,
    relationshipTypes: { works_at: 14, coworker: 8, competes_with: 5, same_region: 3, partnered_with: 1 },
    avgConnectionsPerNode: 2.58,
    isolatedNodes: 2,
    largestCluster: 22,
  };
}

function getMockOrgs(): OrgSummary[] {
  return [
    { id: '1', name: 'Stratoscale AI', domain: 'stratoscale.ai', industry: 'AI / Machine Learning', employeeCount: 1200, intelligenceScore: 87, trackingStatus: 'active', signalCount: 12, lastSignalAt: '2026-08-12T14:30:00Z' },
    { id: '2', name: 'Meridian Fintech', domain: 'meridian.io', industry: 'FinTech', employeeCount: 450, intelligenceScore: 72, trackingStatus: 'active', signalCount: 7, lastSignalAt: '2026-08-11T09:00:00Z' },
    { id: '3', name: 'NovaTech Solutions', domain: 'novatech.com', industry: 'Cloud SaaS', employeeCount: 3200, intelligenceScore: 65, trackingStatus: 'active', signalCount: 5, lastSignalAt: '2026-08-10T16:00:00Z' },
    { id: '4', name: 'Quantum Health', domain: 'quantumhealth.co', industry: 'HealthTech', employeeCount: 800, intelligenceScore: 58, trackingStatus: 'active', signalCount: 3, lastSignalAt: '2026-08-09T11:00:00Z' },
    { id: '5', name: 'Atlas Cyberdefense', domain: 'atlascyber.com', industry: 'Cybersecurity', employeeCount: 600, intelligenceScore: 45, trackingStatus: 'active', signalCount: 2, lastSignalAt: '2026-08-08T08:00:00Z' },
  ];
}

function getMockSignals(): SignalItem[] {
  return [
    { id: 's1', signalType: 'market_expansion', severity: 'high', title: 'Stratoscale AI operates in a high-growth sector', description: 'The AI/ML sector is experiencing rapid growth. Companies are investing heavily in infrastructure and tools to scale.', confidenceScore: 75, detectedAt: '2026-08-12T14:30:00Z' },
    { id: 's2', signalType: 'leadership_change', severity: 'medium', title: '3 executive-level contacts at Meridian Fintech', description: 'Known executives: Sarah Chen (CEO), David Park (CTO), Maya Rodriguez (CRO). Established access to decision-makers.', confidenceScore: 80, detectedAt: '2026-08-11T09:00:00Z' },
    { id: 's3', signalType: 'financial_indicator', severity: 'high', title: 'NovaTech Solutions: Large enterprise (3,200 employees)', description: '3,200 employees indicates large-scale operations with complex buying processes and multiple stakeholders.', confidenceScore: 85, detectedAt: '2026-08-10T16:00:00Z' },
    { id: 's4', signalType: 'customer_signal', severity: 'medium', title: 'Single contact at Atlas Cyberdefense', description: 'Only one known contact. Multi-threading relationships is critical for deal security.', confidenceScore: 90, detectedAt: '2026-08-09T11:00:00Z' },
    { id: 's5', signalType: 'technology_change', severity: 'low', title: 'Technology-native organization detected', description: 'Atlas Cyberdefense evaluates tools based on technical merit, integration capabilities, and developer experience.', confidenceScore: 80, detectedAt: '2026-08-08T08:00:00Z' },
  ];
}

function getMockInsights(): InsightItem[] {
  return [
    { id: 'i1', category: 'opportunity', title: 'Strong engagement opportunity: Stratoscale AI', narrative: 'Stratoscale AI has a composite opportunity score of 87/100 based on 12 active signals, 6 known contacts, and complete data coverage. This organization shows strong indicators for active engagement.', recommendation: 'Engage Stratoscale AI proactively. Schedule discovery conversation within 7 days.', confidence: 'high', confidenceScore: 82 },
    { id: 'i2', category: 'risk', title: 'Single point of failure at Atlas Cyberdefense', narrative: 'Only one known contact at Atlas Cyberdefense. If this contact leaves, all relationship equity is lost. This is a critical coverage gap for an organization in a high-value sector.', recommendation: 'Expand relationship map immediately. Identify 2-3 additional stakeholders within 30 days.', confidence: 'high', confidenceScore: 90 },
    { id: 'i3', category: 'recommendation', title: 'Multi-thread Meridian Fintech executive layer', narrative: 'Meridian Fintech has 3 known executives (CEO, CTO, CRO). Multi-threaded engagement across leadership reduces single-point-of-failure risk and accelerates deal velocity.', recommendation: 'Map reporting hierarchy and prepare tailored value propositions for each executive persona.', confidence: 'medium', confidenceScore: 65 },
    { id: 'i4', category: 'opportunity', title: 'NovaTech Solutions enterprise procurement timing', narrative: 'NovaTech has 3,200 employees and estimated revenue exceeding $500M. Large enterprise procurement cycles typically align with Q3/Q4 budget planning. Current timing is optimal for initial outreach.', recommendation: 'Prepare enterprise ROI analysis. Target procurement committee members for initial conversation.', confidence: 'medium', confidenceScore: 55 },
  ];
}

// ─── Data Fetching Hook ────────────────────────────────────────────────────

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

// ─── Main Command Center ──────────────────────────────────────────────────

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch real data, fallback to mocks
  const { data: stats = getMockStats() } = useApiData<GraphStats>('/api/knowledge-graph/stats', getMockStats());
  const { data: orgs = getMockOrgs() } = useApiData<OrgSummary[]>('/api/organizations?limit=50', getMockOrgs());

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Brain className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100">DeepMindQ</h1>
              <p className="text-[11px] text-zinc-500">Intelligence Command Center</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-zinc-400 hover:text-zinc-100"
              onClick={() => {
                toast.success('Intelligence refresh initiated');
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-zinc-900/60 border border-zinc-800/60">
            <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400">
              <Activity className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="signals" className="gap-1.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400">
              <Radio className="h-3.5 w-3.5" />
              Signals
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400">
              <Brain className="h-3.5 w-3.5" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="graph" className="gap-1.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400">
              <Network className="h-3.5 w-3.5" />
              Knowledge Graph
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <OverviewSection stats={stats} orgs={orgs} />
            <SignalsQuickView />
            <InsightsQuickView />
            <QuickActions />
          </TabsContent>

          {/* Signals Tab */}
          <TabsContent value="signals">
            <SignalsFullView />
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights">
            <InsightsFullView />
          </TabsContent>

          {/* Knowledge Graph Tab */}
          <TabsContent value="graph">
            <GraphView stats={stats} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge() {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">
      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-[11px] font-medium text-emerald-400">Systems Active</span>
    </div>
  );
}

// ─── Overview Section ───────────────────────────────────────────────────────

function OverviewSection({ stats, orgs }: { stats: GraphStats; orgs: OrgSummary[] }) {
  const statCards = [
    {
      title: 'Organizations',
      value: stats.organizations,
      subtitle: `${stats.people} people tracked`,
      icon: Building2,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Active Signals',
      value: orgs.reduce((sum, o) => sum + o.signalCount, 0),
      subtitle: 'Across all targets',
      icon: Radio,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      title: 'AI Insights',
      value: orgs.filter(o => o.intelligenceScore && o.intelligenceScore > 50).length,
      subtitle: 'High-confidence findings',
      icon: Brain,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Graph Density',
      value: stats.avgConnectionsPerNode.toFixed(1),
      subtitle: `${stats.totalEdges} relationships`,
      icon: Network,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((card) => (
        <Card key={card.title} className="border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{card.title}</p>
                <p className="mt-1 text-2xl font-bold text-zinc-100 tabular-nums">{card.value}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{card.subtitle}</p>
              </div>
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Signals Quick View ────────────────────────────────────────────────────

function SignalsQuickView() {
  const signals = getMockSignals();

  return (
    <Card className="border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-amber-400" />
            <CardTitle className="text-sm font-semibold text-zinc-200">Active Signals</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-[10px]">
            {signals.length} detected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          {signals.slice(0, 4).map((signal) => (
            <div key={signal.id} className="flex items-start gap-3 rounded-lg border border-zinc-800/40 bg-zinc-800/20 p-3 transition-colors hover:bg-zinc-800/40">
              <Badge variant="outline" className={`mt-0.5 shrink-0 text-[10px] font-semibold ${severityConfig[signal.severity]?.color || 'bg-zinc-800 text-zinc-400'}`}>
                {signal.severity}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-200 leading-tight">{signal.title}</p>
                <p className="mt-1 text-[11px] text-zinc-500 line-clamp-2">{signal.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Insights Quick View ────────────────────────────────────────────────────

function InsightsQuickView() {
  const insights = getMockInsights();

  return (
    <Card className="border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-emerald-400" />
            <CardTitle className="text-sm font-semibold text-zinc-200">AI Recommendations</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-[10px]">
            {insights.length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
          {insights.slice(0, 4).map((insight) => {
            const Icon = categoryIcon[insight.category] || Brain;
            return (
              <div key={insight.id} className="rounded-lg border border-zinc-800/40 bg-zinc-800/20 p-3 transition-colors hover:bg-zinc-800/40">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-1.5 shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium text-zinc-200">{insight.title}</p>
                      <Badge variant="secondary" className={`text-[10px] ${confidenceColor[insight.confidence] || 'bg-zinc-800 text-zinc-400'}`}>
                        {insight.confidenceScore}%
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed line-clamp-2">{insight.narrative}</p>
                    <div className="mt-2 flex items-start gap-1.5">
                      <ChevronRight className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-emerald-400/80">{insight.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Quick Actions ─────────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    {
      title: 'Upload Data',
      description: 'Import Excel/CSV intelligence data',
      icon: Upload,
      onClick: () => toast.info('Data upload — connect to /api/ingestion endpoint'),
    },
    {
      title: 'Discover Relationships',
      description: 'Auto-find hidden connections',
      icon: GitBranch,
      onClick: () => toast.info('Relationship discovery — connect to /api/knowledge-graph/discover'),
    },
    {
      title: 'Run Intelligence Pipeline',
      description: 'Signals → AI Reasoning → Briefing',
      icon: Zap,
      onClick: () => toast.info('Pipeline — connect to /api/advisor/pipeline'),
    },
    {
      title: 'Resolve Entities',
      description: 'Find and merge duplicates',
      icon: Network,
      onClick: () => toast.info('Entity resolution — connect to /api/knowledge-graph/resolve'),
    },
  ];

  return (
    <Card className="border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-zinc-200">Quick Actions</CardTitle>
        <CardDescription className="text-xs text-zinc-500">Execute intelligence operations</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <button
              key={action.title}
              onClick={action.onClick}
              className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-800/20 p-3 text-left transition-all hover:bg-zinc-800/50 hover:border-zinc-700/60 group"
            >
              <div className="rounded-lg bg-zinc-800/80 p-2 transition-colors group-hover:bg-emerald-500/10">
                <action.icon className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100">{action.title}</p>
                <p className="text-[11px] text-zinc-500">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Signals Full View ──────────────────────────────────────────────────────

function SignalsFullView() {
  const signals = getMockSignals();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Signal Intelligence Feed</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Detected business events and patterns</p>
        </div>
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
          {signals.length} active signals
        </Badge>
      </div>

      <div className="space-y-3">
        {signals.map((signal) => {
          const config = severityConfig[signal.severity] || severityConfig.medium;
          const Icon = config.icon;
          return (
            <Card key={signal.id} className="border-zinc-800/60 bg-zinc-900/40">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 shrink-0 ${config.color.split(' ').slice(0, 2).join(' ')}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] font-semibold ${config.color}`}>
                        {signal.severity}
                      </Badge>
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-[10px]">
                        {signal.signalType.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-[10px] text-zinc-600 ml-auto">
                        {new Date(signal.detectedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-zinc-100">{signal.title}</h3>
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{signal.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">Confidence:</span>
                      <Progress value={signal.confidenceScore} className="h-1.5 w-24" />
                      <span className="text-[10px] font-medium text-zinc-300 tabular-nums">{signal.confidenceScore}%</span>
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

// ─── Insights Full View ────────────────────────────────────────────────────

function InsightsFullView() {
  const insights = getMockInsights();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">AI Intelligence Insights</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Machine reasoning: &quot;Why does this matter? What should we do?&quot;</p>
        </div>
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
          {insights.length} active insights
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {insights.map((insight) => {
          const Icon = categoryIcon[insight.category] || Brain;
          return (
            <Card key={insight.id} className="border-zinc-800/60 bg-zinc-900/40">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2 shrink-0">
                    <Icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-[10px] capitalize">
                        {insight.category}
                      </Badge>
                      <Badge variant="secondary" className={`text-[10px] ${confidenceColor[insight.confidence] || 'bg-zinc-800 text-zinc-400'}`}>
                        {insight.confidenceScore}% confidence
                      </Badge>
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-zinc-100">{insight.title}</h3>
                    <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">{insight.narrative}</p>

                    <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                      <div className="flex items-start gap-1.5">
                        <Zap className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Recommended Action</p>
                          <p className="mt-0.5 text-xs text-emerald-300/80 leading-relaxed">{insight.recommendation}</p>
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

// ─── Graph View ─────────────────────────────────────────────────────────────

function GraphView({ stats }: { stats: GraphStats }) {
  const relTypes = Object.entries(stats.relationshipTypes);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Knowledge Graph</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Entity connections and relationship intelligence</p>
      </div>

      {/* Graph Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-zinc-800/60 bg-zinc-900/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Building2 className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Organizations</p>
                <p className="text-lg font-bold text-zinc-100 tabular-nums">{stats.organizations}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/60 bg-zinc-900/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Users className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">People</p>
                <p className="text-lg font-bold text-zinc-100 tabular-nums">{stats.people}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/60 bg-zinc-900/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <Network className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Total Relationships</p>
                <p className="text-lg font-bold text-zinc-100 tabular-nums">{stats.totalEdges}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Relationship Types Breakdown */}
      <Card className="border-zinc-800/60 bg-zinc-900/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-zinc-200">Relationship Types</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {relTypes.map(([type, count]) => {
              const maxCount = Math.max(...relTypes.map(([, c]) => c));
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-28 shrink-0 capitalize">{type.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2 rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500/60 transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-zinc-300 tabular-nums w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Graph Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-zinc-800/60 bg-zinc-900/40">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-zinc-500">Avg Connections</p>
            <p className="mt-1 text-xl font-bold text-zinc-100 tabular-nums">{stats.avgConnectionsPerNode}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/60 bg-zinc-900/40">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-zinc-500">Largest Cluster</p>
            <p className="mt-1 text-xl font-bold text-emerald-400 tabular-nums">{stats.largestCluster}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/60 bg-zinc-900/40">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-zinc-500">Isolated Nodes</p>
            <p className="mt-1 text-xl font-bold text-amber-400 tabular-nums">{stats.isolatedNodes}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
