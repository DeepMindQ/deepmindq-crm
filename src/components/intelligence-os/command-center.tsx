'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, TrendingUp, AlertTriangle, Zap, Target, Building2,
  Loader2, ChevronRight, Clock, Lightbulb, ArrowRight,
  RefreshCw, Plus, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { ConfidenceIndicator } from './confidence-indicator';
import { IntelligenceNarrative, type NarrativeVariant } from './intelligence-narrative';
import { IntelligenceCard } from './intelligence-card';

// ── Phase 1B Extracted Components ──
import { HeroNarrative } from './hero-narrative';
import { StatusMetricsBar } from './status-metrics-bar';
import { IntelligenceQueue } from './intelligence-queue';
import { ActionQueue } from './action-queue';
import { AccountDeltaTracker } from './account-delta-tracker';

// ── Existing Intelligence OS Components ──
import { EvidenceChain, type EvidenceChainItem } from './evidence-chain';
import { ProgressiveDisclosure } from './progressive-disclosure';
import { IntelligencePanel } from './intelligence-panel';
import { useIntelligenceNarratives } from './use-intelligence-narratives';
import { tokens, getConfidenceTier } from './design-tokens';
import { logger } from '@/lib/logger';
import { useState, useMemo, useCallback, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   Command Center — Intelligence Command System
   
   Phase 1B Layout (Composed Architecture):
     1. StatusMetricsBar (collapsed KPIs — accessible not prominent)
     2. HeroNarrative (L1: Decision, L2: Reasoning, L3-L4: Evidence)
     3. AccountDeltaTracker (intelligence change detection)
     4. IntelligenceQueue (next 3-5 priority items)
     5. ActionQueue (top 5 actions across all narratives)
     6. Supporting sections (briefings, insights, cross-account)
   
   All components extracted into standalone files.
   Each component has its own intelligence flow, UX DNA compliance,
   and evidence chain.
   
   Intelligence speaks first. Data follows.
   ═══════════════════════════════════════════════════════════════ */

export function CommandCenter() {
  const { intelligenceActivated, setActiveView, setSelectedCompanyId } = useAppStore();
  const [stats, setStats] = useState<IntelligenceStats>({ companies: 0, capabilities: 0, signals: 0, contacts: 0 });
  const [topAccounts, setTopAccounts] = useState<PriorityAccount[]>([]);
  const [accountBriefings, setAccountBriefings] = useState<AccountBriefing[]>([]);
  const [crossInsights, setCrossInsights] = useState<CrossAccountInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [insights, setInsights] = useState<CommandCenterInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ── REAL INTELLIGENCE PIPELINE ── */
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

  // Hero narrative = top 1, Queue = next 5
  const heroNarrative = intelligenceNarratives[0] || null;
  const queueNarratives = intelligenceNarratives.slice(1, 6);

  // Ranked for action extraction
  const rankedNarratives = useMemo(() => {
    if (!intelligenceNarratives.length) return [];
    const priorityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return [...intelligenceNarratives].sort((a, b) => {
      const scoreA = (a.confidence?.score ?? 0) * (priorityWeight[a.priority || 'medium'] ?? 1);
      const scoreB = (b.confidence?.score ?? 0) * (priorityWeight[b.priority || 'medium'] ?? 1);
      return scoreB - scoreA;
    });
  }, [intelligenceNarratives]);

  // Extract actions from narratives (real intelligence flow)
  const extractedActions = useMemo(() => {
    type ExtractedAction = {
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
      sourceNarrativeId?: string;
      actionType?: string;
    };
    const actions: ExtractedAction[] = [];
    for (const n of rankedNarratives) {
      if (n.primaryAction) {
        actions.push({
          id: `narrative-${n.id}`,
          type: n.primaryAction.priority === 'critical' ? 'risk' : 'opportunity',
          title: n.primaryAction.label,
          description: n.headline,
          company: n.entityName || 'Unknown',
          companyId: n.entityId || '',
          priority: (n.primaryAction.priority === 'critical' ? 'high' : n.primaryAction.priority) || 'medium',
          confidence: n.confidence?.score ?? 0,
          reason: n.reasoning || '',
          createdAt: n.timestamp || '',
          sourceNarrativeId: n.id,
          actionType: n.primaryAction.actionType,
        });
      }
      for (const sa of (n.secondaryActions || []).slice(0, 1)) {
        actions.push({
          id: `secondary-${n.id}`,
          type: sa.priority === 'critical' ? 'risk' : 'opportunity',
          title: sa.label,
          description: `Secondary: ${n.headline}`,
          company: n.entityName || 'Unknown',
          companyId: n.entityId || '',
          priority: (sa.priority === 'critical' ? 'high' : sa.priority) || 'low',
          confidence: n.confidence?.score ?? 0,
          reason: '',
          createdAt: n.timestamp || '',
          sourceNarrativeId: n.id,
          actionType: sa.actionType,
        });
      }
    }
    return actions.slice(0, 5);
  }, [rankedNarratives]);

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
      setStats({
        companies: compData.stats?.total ?? companies.length,
        capabilities: capabilities.length,
        signals: signals.length,
        contacts: companies.reduce((sum: number, c: Record<string, unknown>) => sum + ((c._count as Record<string, number>)?.contacts ?? 0), 0),
      });
      setError(null);
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
    } catch (err) {
      logger.error('Command Center fetch error:', { error: err });
      setError('Failed to load intelligence data. Tap to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

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
          } catch { /* skip */ }
          return { companyId: account.id, companyName: account.name, intelligenceScore: account.score, needsCount: 0, topNeed: undefined, topCapability: undefined, matchStrength: 0, actionCount: 0 };
        })
      );
      setAccountBriefings(briefings.filter(Boolean));
      const insights: CrossAccountInsight[] = [];
      const highMatch = briefings.filter(b => b.matchStrength > 60);
      if (highMatch.length >= 2) {
        insights.push({ title: `${highMatch.length} accounts with strong capability alignment`, type: 'opportunity', accounts: highMatch.map(b => b.companyName), description: 'Multiple accounts show strong alignment with your capabilities. Consider parallel outreach.', confidence: 75 });
      }
      const withNeeds = briefings.filter(b => b.needsCount > 0);
      if (withNeeds.length > 0) {
        const allNeeds = new Set(withNeeds.map(b => b.topNeed).filter(Boolean));
        if (allNeeds.size >= 2) {
          insights.push({ title: 'Cross-account need pattern detected', type: 'pattern', accounts: withNeeds.map(b => b.companyName), description: `Common needs: ${Array.from(allNeeds).slice(0, 3).join(', ')}. Consider a vertical campaign.`, confidence: 65 });
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
        const data = json.success ? json.data : json;
        setInsights(data);
        if (data.kpis) {
          setStats({ companies: data.kpis.totalAccounts, capabilities: stats.capabilities, signals: data.kpis.activeSignals, contacts: stats.contacts });
        }
      }
    } catch (err) {
      logger.error('Unified insights fetch error:', { error: err });
    }
  }, [stats.capabilities, stats.contacts]);

  useEffect(() => {
    if (intelligenceActivated) {
      fetchIntelligence();
      fetchUnifiedInsights();
      const poll = setInterval(fetchUnifiedInsights, 30000);
      return () => clearInterval(poll);
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

  /* ── Empty State ── */
  if (!intelligenceActivated && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-lg">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: tokens.accent.ghost }}>
            <Brain className="w-8 h-8" style={{ color: tokens.accent.bright }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>Welcome to DeepMindQ</h1>
          <p className="text-sm mt-2" style={{ color: tokens.text.secondary }}>Your intelligence engine is ready. It needs your business context to activate.</p>
          <p className="text-xs mt-1 mb-8" style={{ color: tokens.text.muted }}>Upload your capabilities and accounts to generate your first intelligence briefing.</p>
          <Button onClick={() => setActiveView('activation-workspace')} className="gap-2 px-6">
            <Plus className="w-4 h-4" /> Activate Intelligence <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="space-y-4 p-1">
        {/* HeroNarrative skeleton */}
        <div className="rounded-xl border p-6 space-y-4" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl animate-pulse" style={{ background: tokens.accent.ghost }} />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 rounded-lg animate-pulse" style={{ background: tokens.border.subtle }} />
              <div className="h-3 w-1/2 rounded-lg animate-pulse" style={{ background: tokens.border.subtle }} />
            </div>
          </div>
        </div>
        {/* Intelligence queue skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border animate-pulse" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }} />
          ))}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     INTELLIGENCE COMMAND SYSTEM LAYOUT — Phase 1B Composed
     
     Each section is an extracted, independently testable component.
     Intelligence flows: Signal → Engine → Confidence → Evidence → Action
     ═══════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Command Center
          </h1>
          <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>
            Intelligence Command System
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchIntelligence(); fetchBriefings(); fetchUnifiedInsights(); refetchNarratives(); }}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveView('activation-workspace')}
            className="gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Expand
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.15)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#ef4444' }} />
          <p className="text-sm flex-1" style={{ color: tokens.text.secondary }}>{error}</p>
          <Button variant="outline" size="sm" onClick={() => { setError(null); fetchIntelligence(); fetchUnifiedInsights(); }} className="text-xs">Retry</Button>
        </div>
      )}

      {/* ═══ INTELLIGENCE-FIRST LAYOUT ═══ */}

      {/* 1. HeroNarrative — Intelligence speaks first */}
      <HeroNarrative
        narrative={heroNarrative}
        isLoading={narrativesLoading}
        onAction={(narrative) => {
          if (narrative.entityType === 'company' && narrative.entityId) {
            navigateToCompany(narrative.entityId);
          }
        }}
      />

      {/* 2. AccountDeltaTracker — What changed since I last looked? */}
      <AccountDeltaTracker
        autoFetch={true}
        onNavigateToCompany={navigateToCompany}
        onInvestigate={(delta) => {
          navigateToCompany(delta.companyId);
        }}
      />

      {/* 3. IntelligenceQueue — Next priorities */}
      <IntelligenceQueue
        narratives={queueNarratives}
        onNavigateToCompany={navigateToCompany}
        onDrillDown={(narrative) => {
          if (narrative.entityType === 'company' && narrative.entityId) {
            navigateToCompany(narrative.entityId);
          }
        }}
      />

      {/* Pipeline loading */}
      {narrativesLoading && (
        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: tokens.accent.bright }} />
          <span className="text-xs" style={{ color: tokens.text.secondary }}>Intelligence pipeline processing...</span>
        </div>
      )}
      {narrativesError && (
        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.15)' }}>
          <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
          <span className="text-xs" style={{ color: tokens.text.secondary }}>{narrativesError}</span>
          <button onClick={() => refetchNarratives()} className="ml-auto text-[10px] font-medium" style={{ color: tokens.accent.bright }}>Retry pipeline</button>
        </div>
      )}

      {/* 4. Action Queue — What should I do today? */}
      <ActionQueue
        actions={extractedActions}
        onNavigateToCompany={navigateToCompany}
        onActionExecute={(action) => {
          navigateToCompany(action.companyId);
        }}
      />

      {/* 5. StatusMetricsBar — Collapsible KPIs */}
      <StatusMetricsBar kpis={insights?.kpis ?? null} systemHealth={insights?.systemHealth ?? null} />

      {/* 6. Supporting: Priority Accounts + Briefings */}
      {accountBriefings.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4" style={{ color: tokens.text.muted }} />
            <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
              Account Intelligence Briefings
            </h2>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0" style={{ background: tokens.accent.ghost, color: tokens.accent.bright, border: 0 }}>
              {accountBriefings.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {accountBriefings.slice(0, 4).map((briefing, i) => (
              <div
                key={briefing.companyId}
                className="rounded-xl border p-4 cursor-pointer transition-colors hover:brightness-110"
                style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}
                onClick={() => navigateToCompany(briefing.companyId)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: tokens.text.primary }}>{briefing.companyName}</p>
                  </div>
                  <ConfidenceIndicator
                    value={briefing.intelligenceScore}
                    mode="ring"
                    size="sm"
                    showPercentage={true}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {briefing.topNeed && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: tokens.domain.opportunity + '15', color: tokens.domain.opportunity, border: `1px solid ${tokens.domain.opportunity}30` }}>
                      Need: {briefing.topNeed}
                    </span>
                  )}
                  {briefing.topCapability && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: tokens.domain.enrichment + '15', color: tokens.domain.enrichment, border: `1px solid ${tokens.domain.enrichment}30` }}>
                      Cap: {briefing.topCapability}
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: tokens.domain.action + '15', color: tokens.domain.action, border: `1px solid ${tokens.domain.action}30` }}>
                    {briefing.actionCount} actions
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 7. Cross-Account Intelligence Insights */}
      <AnimatePresence>
        {crossInsights.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>Cross-Account Insights</h2>
            </div>
            <div className="space-y-2">
              {crossInsights.map((insight, i) => {
                const variantMap: Record<string, NarrativeVariant> = { opportunity: 'opportunity', risk: 'risk', pattern: 'signal', trend: 'reasoning' };
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
                    evidence={insight.accounts.map(a => ({ source: 'Cross-account analysis', snippet: `Account "${a}" contributes to this intelligence pattern` }))}
                    primaryAction={{ label: 'Explore Accounts', onClick: () => setActiveView('accounts') }}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
