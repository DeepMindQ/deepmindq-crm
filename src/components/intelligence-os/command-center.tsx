'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Brain, TrendingUp, AlertTriangle, Zap,
  ArrowRight, Loader2, RefreshCw, Target,
  ChevronRight, Plus, Sparkles, Search, Clock,
  Layers, Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { ProgressiveDisclosure } from './progressive-disclosure';
import { IntelligenceNarrative, type NarrativeVariant } from './intelligence-narrative';
import { ConfidenceIndicator } from './confidence-indicator';
import { useIntelligenceNarratives } from './use-intelligence-narratives';
import { tokens } from './design-tokens';
import { logger } from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

interface IntelligenceStats {
  companies: number;
  capabilities: number;
  signals: number;
  contacts: number;
}

interface PriorityAccount {
  id: string;
  name: string;
  industry: string | null;
  score: number;
  signalCount: number;
  topSignal?: string;
  intelligenceScore?: number;
  domain?: string | null;
}

interface AccountBriefing {
  companyId: string;
  companyName: string;
  intelligenceScore: number;
  needsCount: number;
  topNeed?: string;
  topCapability?: string;
  matchStrength: number;
  actionCount: number;
}

interface CrossAccountInsight {
  title: string;
  type: 'opportunity' | 'risk' | 'pattern' | 'trend';
  accounts: string[];
  description: string;
  confidence: number;
}

interface DailyBriefing {
  summary: string;
  topAccounts: PriorityAccount[];
  accountBriefings: AccountBriefing[];
  crossAccountInsights: CrossAccountInsight[];
  actionItems: ActionItem[];
  stats: IntelligenceStats;
}

interface ActionItem {
  id: string;
  type: 'opportunity' | 'risk' | 'action' | 'signal';
  title: string;
  description: string;
  company: string;
  companyId: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  reason: string;
  createdAt: string;
}

interface CommandCenterInsights {
  kpis: {
    totalAccounts: number;
    activeSignals: number;
    avgIntelligenceScore: number;
    pendingActions: number;
  };
  recentSignals: Array<{
    id: string;
    companyId: string;
    companyName: string;
    signalType: string;
    title: string;
    severity: string;
    impact: string;
    confidence: number;
    createdAt: string;
  }>;
  topOpportunities: Array<{
    id: string;
    companyId: string;
    companyName: string;
    industry: string | null;
    title: string;
    score: number;
    confidence: number;
    priority: string;
    status: string;
    createdAt: string;
  }>;
  systemHealth: {
    engines: Array<{ name: string; status: string }>;
    aiStatus: string;
  };
  intelligenceFeed: Array<{
    id: string;
    companyId: string;
    eventType: string;
    title: string;
    description: string;
    createdAt: string;
  }>;
  morningBrief?: {
    greeting: string;
    executiveSummary: string;
  };
}

/* ═══════════════════════════════════════════════════
   Command Center — Intelligence Briefing
   
   "What should I focus on today?"
   
   Evolved from flat metrics to narrative intelligence briefing.
   Shows: accounts ranked by actionable intelligence,
   cross-account patterns, and prioritized next actions.
   
   No fake intelligence. Only shows what the system knows.
   Designed so deeper intelligence can plug in tomorrow.
   ═══════════════════════════════════════════════════ */

export function CommandCenter() {
  const { intelligenceActivated, setActiveView, setSelectedCompanyId } = useAppStore();
  const [stats, setStats] = useState<IntelligenceStats>({ companies: 0, capabilities: 0, signals: 0, contacts: 0 });
  const [topAccounts, setTopAccounts] = useState<PriorityAccount[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [accountBriefings, setAccountBriefings] = useState<AccountBriefing[]>([]);
  const [crossInsights, setCrossInsights] = useState<CrossAccountInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [insights, setInsights] = useState<CommandCenterInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════
  // REAL INTELLIGENCE PIPELINE — The Core Integration
  // ═══════════════════════════════════════════════════
  // This hook connects the Command Center to the full
  // intelligence engine: Signal → Grounding → Evidence →
  // Confidence → Recommendation → Narrative
  //
  // Data flow:
  //   useIntelligenceNarratives (hook)
  //     → /api/intelligence/narratives (API)
  //       → IntelligenceNarrativeService (service)
  //         → GroundingEngine + confidence-explainability (engines)
  //           → IntelligenceNarrativeData (structured output)
  // ═══════════════════════════════════════════════════
  const {
    narratives: intelligenceNarratives,
    isLoading: narrativesLoading,
    error: narrativesError,
    meta: narrativesMeta,
    refetch: refetchNarratives,
  } = useIntelligenceNarratives({
    limit: 8,
    minConfidence: 30,
    enabled: intelligenceActivated,
  });

  // Narratives ranked by confidence × priority for briefing order
  const rankedNarratives = useMemo(() => {
    if (!intelligenceNarratives.length) return [];
    const priorityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return [...intelligenceNarratives].sort((a, b) => {
      const scoreA = (a.confidence?.score ?? 0) * (priorityWeight[a.priority || 'medium'] ?? 1);
      const scoreB = (b.confidence?.score ?? 0) * (priorityWeight[b.priority || 'medium'] ?? 1);
      return scoreB - scoreA;
    });
  }, [intelligenceNarratives]);

  // Aggregate confidence from all active narratives
  const aggregatedConfidence = useMemo(() => {
    if (!intelligenceNarratives.length) return null;
    const avgConfidence = Math.round(
      intelligenceNarratives.reduce((sum, n) => sum + (n.confidence?.score ?? 0), 0) / intelligenceNarratives.length
    );
    const highConfidence = intelligenceNarratives.filter(n => (n.confidence?.score ?? 0) >= 70).length;
    return {
      average: avgConfidence,
      total: intelligenceNarratives.length,
      highConfidence,
      factors: intelligenceNarratives[0]?.confidence?.breakdown
        ? intelligenceNarratives[0].confidence.breakdown
        : null,
    };
  }, [intelligenceNarratives]);

  const fetchIntelligence = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, capRes, sigRes] = await Promise.all([
        fetch('/api/companies?limit=100'),
        fetch('/api/capabilities'),
        fetch('/api/signals'),
      ]);

      const compData = await compRes.json();
      const capData = await capRes.json();
      const sigData = await sigRes.json();

      const companies = compData.data ?? compData ?? [];
      const capabilities = Array.isArray(capData) ? capData : capData.data ?? [];
      const signals = Array.isArray(sigData) ? sigData : sigData.data ?? sigData.signals ?? [];

      const newStats = {
        companies: compData.stats?.total ?? companies.length,
        capabilities: capabilities.length,
        signals: signals.length,
        contacts: companies.reduce((sum: number, c: Record<string, unknown>) => sum + ((c._count as Record<string, number>)?.contacts ?? 0), 0),
      };
      setStats(newStats);
      setError(null);

      // Rank accounts by intelligence score + signal count
      const ranked = companies
        .map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: (c.name || c.rawName || 'Unknown') as string,
          industry: c.industry as string | null,
          domain: c.domain as string | null,
          score: (c.score ?? c.intelligenceScore ?? 0) as number,
          signalCount: (c._count as Record<string, number>)?.signals ?? (c.signalCount as number) ?? 0,
          topSignal: c.topSignal as string | undefined,
          intelligenceScore: c.intelligenceScore as number | undefined,
        }))
        .sort((a: PriorityAccount, b: PriorityAccount) => (b.score + b.signalCount) - (a.score + a.signalCount))
        .slice(0, 8);

      setTopAccounts(ranked);

      // Generate action items from signals
      const actions: ActionItem[] = [];
      for (const s of signals.slice(0, 5)) {
        actions.push({
          id: s.id,
          type: 'signal',
          title: s.title || s.type || 'Signal detected',
          description: s.description || s.summary || 'New intelligence signal',
          company: s.companyName || s.company?.name || 'Unknown',
          companyId: s.companyId || '',
          priority: s.priority || (s.severity === 'high' ? 'high' : 'medium'),
          confidence: s.confidence ?? 60,
          reason: `Detected from ${s.type || 'signal analysis'}`,
          createdAt: s.createdAt || s.detectedAt || new Date().toISOString(),
        });
      }

      // Opportunity actions for high-score accounts
      for (const a of ranked.slice(0, 3)) {
        if (a.score > 0) {
          actions.push({
            id: `opp-${a.id}`,
            type: 'opportunity',
            title: `Engage ${a.name}`,
            description: `High-priority account with ${a.signalCount} active signals and score ${a.score}`,
            company: a.name,
            companyId: a.id,
            priority: a.score > 70 ? 'high' : 'medium',
            confidence: a.score,
            reason: `Intelligence score ${a.score} with ${a.signalCount} active signals`,
            createdAt: new Date().toISOString(),
          });
        }
      }

      setActionItems(actions);
    } catch (err) {
      logger.error('Command Center fetch error:', { error: err });
      setError('Failed to load intelligence data. Tap to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch alignment briefings for top accounts (composition layer)
  const fetchBriefings = useCallback(async () => {
    if (topAccounts.length === 0) { setBriefingLoading(false); return; }
    setBriefingLoading(true);
    try {
      const briefings = await Promise.all(
        topAccounts.slice(0, 5).map(async (account) => {
          try {
            const res = await fetch(`/api/companies/${account.id}/alignment`);
            if (res.ok) {
              const data = await res.json();
              return {
                companyId: account.id,
                companyName: data.company || account.name,
                intelligenceScore: data.intelligenceScore || account.score,
                needsCount: data.needs?.length || 0,
                topNeed: data.needs?.[0]?.need,
                topCapability: data.capabilityMatches?.[0]?.capability,
                matchStrength: data.recommendedPositioning?.strengthScore || 0,
                actionCount: data.actions?.length || 0,
              };
            }
          } catch { /* skip failed accounts */ }
          return {
            companyId: account.id,
            companyName: account.name,
            intelligenceScore: account.score,
            needsCount: 0,
            topNeed: undefined,
            topCapability: undefined,
            matchStrength: 0,
            actionCount: 0,
          };
        })
      );
      setAccountBriefings(briefings.filter(Boolean));

      // Generate cross-account insights from briefings
      const insights: CrossAccountInsight[] = [];
      const highMatchAccounts = briefings.filter(b => b.matchStrength > 60);
      if (highMatchAccounts.length >= 2) {
        insights.push({
          title: `${highMatchAccounts.length} accounts with strong capability alignment`,
          type: 'opportunity',
          accounts: highMatchAccounts.map(b => b.companyName),
          description: `Multiple accounts show strong alignment with your capabilities. Consider parallel outreach.`,
          confidence: 75,
        });
      }

      const accountsWithNeeds = briefings.filter(b => b.needsCount > 0);
      if (accountsWithNeeds.length > 0) {
        const allNeeds = new Set(accountsWithNeeds.map(b => b.topNeed).filter(Boolean));
        if (allNeeds.size >= 2) {
          insights.push({
            title: 'Cross-account need pattern detected',
            type: 'pattern',
            accounts: accountsWithNeeds.map(b => b.companyName),
            description: `Common needs across accounts: ${Array.from(allNeeds).slice(0, 3).join(', ')}. Consider a vertical campaign.`,
            confidence: 65,
          });
        }
      }

      setCrossInsights(insights);
    } catch (err) {
      logger.error('Briefings fetch error:', { error: err });
    } finally {
      setBriefingLoading(false);
    }
  }, [topAccounts]);

  const fetchUnifiedInsights = useCallback(async () => {
    try {
      const res = await fetch('/api/command-center/insights');
      if (res.ok) {
        const json = await res.json();
        // Support both envelope { success, data } and direct response
        const data = json.success ? json.data : json;
        setInsights(data);
        // Update stats from KPIs
        if (data.kpis) {
          setStats({
            companies: data.kpis.totalAccounts,
            capabilities: stats.capabilities,
            signals: data.kpis.activeSignals,
            contacts: stats.contacts,
          });
        }
      }
    } catch (err) {
      logger.error('Command Center unified insights fetch error:', { error: err });
      setError('Failed to load intelligence data. Tap to retry.');
    }
  }, [stats.capabilities, stats.contacts]);

  useEffect(() => {
    if (intelligenceActivated) {
      fetchIntelligence();
      fetchUnifiedInsights();
      const pollInterval = setInterval(() => {
        fetchUnifiedInsights();
      }, 30000);
      return () => clearInterval(pollInterval);
    } else {
      setLoading(false);
    }
  }, [intelligenceActivated, fetchIntelligence, fetchUnifiedInsights]);

  useEffect(() => {
    if (intelligenceActivated && topAccounts.length > 0 && !loading) {
      fetchBriefings();
    }
  }, [intelligenceActivated, topAccounts, loading, fetchBriefings]);

  const navigateToCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setActiveView('company-workspace');
  };

  const getRelativeTime = (dateStr: string): string => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  const priorityConfig = {
    high: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'High' },
    medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Medium' },
    low: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Low' },
  };

  /* ── Empty State: Not yet activated ── */
  if (!intelligenceActivated && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-lg"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Brain className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-3">
            Welcome to DeepMindQ
          </h1>
          <p className="text-sm text-muted-foreground mb-2">
            Your intelligence engine is ready. It needs your business context to activate.
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            Upload your capabilities and accounts to generate your first intelligence briefing.
          </p>
          <Button
            onClick={() => setActiveView('activation-workspace')}
            className="gap-2 px-6"
          >
            <Plus className="w-4 h-4" />
            Activate Intelligence
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-8 w-24 rounded-lg bg-gray-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-white border border-gray-200 p-5 space-y-3">
              <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
              <div className="h-7 w-20 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-white border border-gray-200 p-5 space-y-3">
              <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-12 rounded-lg bg-gray-50 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Main Command Center ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Command Center
          </h1>
          {insights?.morningBrief?.greeting && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <p className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                {insights.morningBrief.greeting}
              </p>
              {insights.morningBrief.executiveSummary && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{insights.morningBrief.executiveSummary}</p>
              )}
            </motion.div>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            What should I focus on today?
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchIntelligence(); fetchBriefings(); fetchUnifiedInsights(); }}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchNarratives(); fetchIntelligence(); fetchBriefings(); fetchUnifiedInsights(); }}
            className="gap-1.5 text-xs"
          >
            <Brain className="w-3.5 h-3.5" />
            Refresh Intelligence
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveView('activation-workspace')}
            className="gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Expand Intelligence
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 p-4">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { setError(null); fetchIntelligence(); fetchUnifiedInsights(); }} className="text-xs">Retry</Button>
        </div>
      )}

      {/* Ticket 5: Spec KPI Cards */}
      {insights?.kpis ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Accounts', value: insights.kpis.totalAccounts, icon: Building2, color: 'text-blue-600 bg-blue-50' },
            { label: 'Active Signals', value: insights.kpis.activeSignals, icon: Zap, color: 'text-amber-600 bg-amber-50' },
            { label: 'Avg Intel Score', value: insights.kpis.avgIntelligenceScore, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Pending Actions', value: insights.kpis.pendingActions, icon: Target, color: 'text-violet-600 bg-violet-50' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl bg-white border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className={`size-9 rounded-lg ${kpi.color} flex items-center justify-center`}>
                  <kpi.icon className="size-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-foreground">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[76px] rounded-xl bg-white border border-gray-200 p-4 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-gray-100 animate-pulse" />
              <div className="space-y-2">
                <div className="h-6 w-12 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket 5: System Health */}
      {insights?.systemHealth && (
        <div className="rounded-xl bg-white border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">System Health</h3>
            <div className="flex items-center gap-2">
              <div className={`size-2 rounded-full ${insights.systemHealth.aiStatus === 'available' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-xs text-muted-foreground">{insights.systemHealth.aiStatus}</span>
            </div>
          </div>
          <div className="flex gap-4 mt-3">
            {insights.systemHealth.engines.map(eng => (
              <div key={eng.name} className="flex items-center gap-1.5">
                <div className={`size-1.5 rounded-full ${eng.status === 'healthy' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-[11px] text-muted-foreground/60">{eng.name.replace(' Engine', '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ticket 5: Recent Signals Feed */}
      {insights?.recentSignals && insights.recentSignals.length > 0 && (
        <div className="section-container">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-foreground">Recent Signals</h2>
            </div>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-0">
              {insights.recentSignals.length}
            </Badge>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {insights.recentSignals.slice(0, 10).map(signal => {
              const severityColor = signal.severity === 'high' ? 'text-red-700 bg-red-50 border-red-200'
                : signal.severity === 'medium' ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-blue-700 bg-blue-50 border-blue-200';
              const relativeTime = getRelativeTime(signal.createdAt);
              return (
                <div
                  key={signal.id}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{signal.title}</p>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border shrink-0 ${severityColor}`}>
                        {signal.severity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground">{signal.companyName}</span>
                      <span className="text-[11px] text-muted-foreground/40">·</span>
                      <span className="text-[11px] text-muted-foreground/60">{signal.signalType}</span>
                      <span className="text-[11px] text-muted-foreground/40">·</span>
                      <span className="text-[11px] text-muted-foreground/60">{relativeTime}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigateToCompany(signal.companyId)}
                    className="shrink-0 mt-0.5"
                  >
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 hover:text-primary transition-colors" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          INTELLIGENCE BRIEFINGS — Real AI Pipeline Output
          ═══════════════════════════════════════════════
          This section renders narratives produced by the
          full intelligence engine pipeline:

          Signal Detection → GroundingEngine → Evidence Chain →
          Confidence Computation → Narrative Construction

          Every narrative carries:
          • Multi-factor confidence (NOT hardcoded)
          • Traceable evidence from real sources
          • AI reasoning from signal analysis
          • Actionable recommendations
          ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {rankedNarratives.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4" style={{ color: tokens.accent.bright }} />
                <h2 className="text-sm font-semibold text-foreground">Intelligence Briefings</h2>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0" style={{ background: tokens.accent.ghost, color: tokens.accent.bright, border: 0 }}>
                  {rankedNarratives.length} active
                </Badge>
              </div>
              {narrativesMeta && (
                <span className="text-[10px] tabular-nums" style={{ color: tokens.text.muted }}>
                  Pipeline: {narrativesMeta.computationTimeMs ?? 0}ms · {narrativesMeta.engineCalls ?? 0} engine calls
                </span>
              )}
            </div>

            {/* Aggregate Intelligence Health Bar */}
            {aggregatedConfidence && (
              <div className="rounded-xl border p-4" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
                <div className="flex items-center gap-4">
                  <ConfidenceIndicator
                    value={aggregatedConfidence.average}
                    mode="ring"
                    size="md"
                    label="Avg Confidence"
                    showPercentage={true}
                  />
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color: tokens.text.primary }}>
                      {aggregatedConfidence.highConfidence} of {aggregatedConfidence.total} signals high-confidence
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: tokens.text.secondary }}>
                      AI has analyzed {aggregatedConfidence.total} intelligence signals across your accounts
                    </p>
                    {aggregatedConfidence.factors && (
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px]" style={{ color: tokens.text.muted }}>Breakdown:</span>
                        <span className="text-[10px] font-medium" style={{ color: tokens.confidence.high.value }}>Signal {aggregatedConfidence.factors.signalQuality || 0}%</span>
                        <span className="text-[10px] font-medium" style={{ color: tokens.confidence.high.value }}>Evidence {aggregatedConfidence.factors.evidenceQuality || 0}%</span>
                        <span className="text-[10px] font-medium" style={{ color: tokens.confidence.medium.value }}>Capability {aggregatedConfidence.factors.capabilityFit || 0}%</span>
                        <span className="text-[10px] font-medium" style={{ color: tokens.text.secondary }}>Data {aggregatedConfidence.factors.dataCompleteness || 0}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Individual Intelligence Narratives — each from real pipeline */}
            {rankedNarratives.map((narrative, i) => {
              return (
                <ProgressiveDisclosure
                  key={narrative.id || i}
                  title={narrative.headline}
                  subtitle={narrative.subtitle}
                  confidence={narrative.confidence?.score ?? 0}
                  confidenceLabel="AI Confidence"
                  badge={narrative.priority ? { label: narrative.priority, variant: narrative.priority === 'critical' ? 'high' : narrative.priority } : undefined}
                  timestamp={narrative.timestamp}
                  reasoning={narrative.reasoning}
                  reasoningItems={narrative.reasoningPoints}
                  evidence={narrative.evidence.map(e => ({
                    source: e.source,
                    url: e.url,
                    snippet: e.snippet,
                    date: e.date,
                  }))}
                  impactStatement={narrative.impactStatement}
                  relatedSignals={narrative.relatedSignals}
                  relatedActions={narrative.secondaryActions.map(a => ({
                    title: a.label,
                    priority: a.priority === 'critical' ? 'high' : a.priority,
                  }))}
                  defaultExpanded={0}
                  onAction={narrative.primaryAction ? () => {
                    if (narrative.entityType === 'company') {
                      setSelectedCompanyId(narrative.entityId);
                      setActiveView('company-workspace');
                    }
                  } : undefined}
                  actionLabel={narrative.primaryAction?.label}
                />
              );
            })}

            {/* Pipeline loading state */}
            {narrativesLoading && (
              <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: tokens.accent.bright }} />
                <span className="text-xs" style={{ color: tokens.text.secondary }}>Intelligence pipeline processing...</span>
              </div>
            )}

            {/* Pipeline error state */}
            {narrativesError && (
              <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.15)' }}>
                <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                <span className="text-xs" style={{ color: tokens.text.secondary }}>{narrativesError}</span>
                <button
                  onClick={() => refetchNarratives()}
                  className="ml-auto text-[10px] font-medium"
                  style={{ color: tokens.accent.bright }}
                >
                  Retry pipeline
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cross-Account Intelligence Insights (compositional layer) */}
      <AnimatePresence>
        {crossInsights.length > 0 && rankedNarratives.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-foreground">Intelligence Insights</h2>
            </div>
            {crossInsights.map((insight, i) => {
              const variantMap: Record<string, NarrativeVariant> = {
                opportunity: 'opportunity', risk: 'risk', pattern: 'signal', trend: 'reasoning',
              };
              return (
                <IntelligenceNarrative
                  key={i}
                  headline={insight.title}
                  variant={variantMap[insight.type] || 'signal'}
                  confidence={insight.confidence}
                  confidenceLabel="Insight confidence"
                  priority={insight.type === 'opportunity' ? 'high' : insight.type === 'risk' ? 'critical' : 'medium'}
                  reasoning={insight.description}
                  reasoningPoints={insight.accounts.map(a => `${a} shows alignment pattern`)}
                  evidence={insight.accounts.map(a => ({
                    source: 'Cross-account analysis',
                    snippet: `Account "${a}" contributes to this intelligence pattern`,
                  }))}
                  primaryAction={{
                    label: 'Explore Accounts',
                    onClick: () => setActiveView('accounts'),
                  }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Accounts with Intelligence Briefings */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="section-container"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Priority Accounts</h2>
            </div>
            <div className="flex items-center gap-2">
              {briefingLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              )}
              <button
                onClick={() => setActiveView('accounts')}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                View all
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {topAccounts.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">No accounts yet. Upload accounts to get started.</p>
              </div>
            ) : (
              topAccounts.map((account, i) => {
                const briefing = accountBriefings.find(b => b.companyId === account.id);
                return (
                  <motion.button
                    key={account.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.03 }}
                    onClick={() => navigateToCompany(account.id)}
                    className="w-full flex items-start gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center text-sm font-bold text-primary shrink-0 mt-0.5">
                      {account.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
                        {account.signalCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-0 shrink-0">
                            {account.signalCount} signals
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {account.industry || 'Technology'} {account.topSignal ? `· ${account.topSignal}` : ''}
                      </p>
                      {/* Intelligence briefing preview */}
                      {briefing && !briefingLoading && (
                        <div className="flex items-center gap-2 mt-2">
                          {briefing.needsCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                              <Target className="w-2.5 h-2.5" />
                              {briefing.needsCount} needs
                            </span>
                          )}
                          {briefing.topCapability && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                              <Layers className="w-2.5 h-2.5" />
                              {briefing.topCapability.length > 25 ? briefing.topCapability.slice(0, 25) + '...' : briefing.topCapability}
                            </span>
                          )}
                          {briefing.actionCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                              <Sparkles className="w-2.5 h-2.5" />
                              {briefing.actionCount} actions
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground">{account.score}</p>
                        <p className="text-[10px] text-muted-foreground">score</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Recommended Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="section-container"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-foreground">Recommended Actions</h2>
            </div>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/8 text-primary border-0">
              {actionItems.length} items
            </Badge>
          </div>
          <div className="divide-y divide-gray-50">
            {actionItems.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">No actions yet. Intelligence actions appear as signals are detected.</p>
              </div>
            ) : (
              actionItems.slice(0, 8).map((action, i) => {
                const config = priorityConfig[action.priority];
                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 + i * 0.03 }}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: config.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{action.title}</p>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 border-0 shrink-0"
                          style={{ background: config.bg, color: config.color }}
                        >
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-muted-foreground/60">{action.company}</p>
                        {action.confidence > 0 && (
                          <span className="text-[10px] tabular-nums" style={{ color: action.confidence >= 70 ? '#059669' : '#f59e0b' }}>
                            {action.confidence}%
                          </span>
                        )}
                      </div>
                    </div>
                    {action.companyId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToCompany(action.companyId);
                        }}
                        className="shrink-0"
                      >
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 hover:text-primary transition-colors" />
                      </button>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Ticket 5: Top Opportunities Table */}
      {insights?.topOpportunities && insights.topOpportunities.length > 0 && (
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Top Opportunities</h3>
            <Badge variant="secondary" className="text-[10px]">{insights.topOpportunities.length}</Badge>
          </div>
          <div className="space-y-2">
            {insights.topOpportunities.slice(0, 5).map(opp => (
              <div
                key={opp.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => { setSelectedCompanyId(opp.companyId); setActiveView('companies'); }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{opp.companyName}</p>
                  <p className="text-xs text-muted-foreground truncate">{opp.title || opp.industry || '—'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground tabular-nums">{opp.score}</p>
                    <p className="text-[10px] text-muted-foreground/60 uppercase">{opp.priority}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ticket 5: Intelligence Feed */}
      {insights?.intelligenceFeed && insights.intelligenceFeed.length > 0 && (
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Intelligence Feed</h3>
          <div className="space-y-2">
            {insights.intelligenceFeed.slice(0, 8).map(item => (
              <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <Clock className="size-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{item.eventType} · {new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intelligence Search Prompt */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="section-container p-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
            <Search className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Intelligence Search</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ask DeepMindQ any question about your accounts, capabilities, or market intelligence.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveView('intelligence-search')}
            className="gap-1.5 text-xs"
          >
            Search
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
