'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Brain, TrendingUp, AlertTriangle, Zap,
  ArrowRight, Loader2, RefreshCw, Target, Users, FileText,
  ChevronRight, Plus, Sparkles, Search, BarChart3, Clock,
  Shield, Layers, Play, Eye, Wrench, ArrowUpRight,
  CheckCircle2, Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { ProgressiveDisclosure } from './progressive-disclosure';

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
        contacts: companies.reduce((sum: number, c: any) => sum + (c._count?.contacts ?? 0), 0),
      };
      setStats(newStats);

      // Rank accounts by intelligence score + signal count
      const ranked = companies
        .map((c: any) => ({
          id: c.id,
          name: c.name || c.rawName || 'Unknown',
          industry: c.industry,
          domain: c.domain,
          score: c.score ?? c.intelligenceScore ?? 0,
          signalCount: c._count?.signals ?? c.signalCount ?? 0,
          topSignal: c.topSignal,
          intelligenceScore: c.intelligenceScore,
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
      console.error('Command Center fetch error:', err);
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
      console.error('Briefings fetch error:', err);
    } finally {
      setBriefingLoading(false);
    }
  }, [topAccounts]);

  useEffect(() => {
    if (intelligenceActivated) {
      fetchIntelligence();
    } else {
      setLoading(false);
    }
  }, [intelligenceActivated, fetchIntelligence]);

  useEffect(() => {
    if (intelligenceActivated && topAccounts.length > 0 && !loading) {
      fetchBriefings();
    }
  }, [intelligenceActivated, topAccounts, loading, fetchBriefings]);

  const navigateToCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setActiveView('company-workspace');
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
          <p className="text-sm text-muted-foreground mt-0.5">
            What should I focus on today?
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchIntelligence(); fetchBriefings(); }}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
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

      {/* Intelligence Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Accounts', value: stats.companies, icon: Building2, color: '#2563EB' },
          { label: 'Capabilities', value: stats.capabilities, icon: Sparkles, color: '#8B5CF6' },
          { label: 'Signals', value: stats.signals, icon: Zap, color: '#F59E0B' },
          { label: 'Contacts', value: stats.contacts, icon: Users, color: '#06B6D4' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="stat-card"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${stat.color}12` }}
              >
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {stat.value.toLocaleString()}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Cross-Account Intelligence Insights */}
      <AnimatePresence>
        {crossInsights.length > 0 && (
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
            {crossInsights.map((insight, i) => (
              <ProgressiveDisclosure
                key={i}
                title={insight.title}
                confidence={insight.confidence}
                confidenceLabel="Insight confidence"
                badge={{
                  label: insight.type,
                  variant: insight.type === 'opportunity' ? 'high' : insight.type === 'risk' ? 'high' : 'medium',
                }}
                reasoning={insight.description}
                evidence={insight.accounts.map(a => ({
                  source: 'Cross-account analysis',
                  snippet: a,
                }))}
                defaultExpanded={1}
              />
            ))}
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
