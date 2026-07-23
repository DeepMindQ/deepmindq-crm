'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Lightbulb, Target, RefreshCw, ChevronRight, User,
  MessageSquare, Clock, AlertTriangle, Star, Zap, BookOpen,
  ArrowUpDown, DollarSign, Building2, TrendingUp, Shield,
  ExternalLink, Loader2, Filter, type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { LoadingState } from '@/components/enterprise/LoadingState';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface Recommendation {
  companyId: string;
  companyName: string;
  industry: string | null;
  category: string;
  priority: string;
  action: string;
  rationale: string;
  suggestedConversation: string;
  targetDecisionMaker: string;
  whyNow: string;
  supportingSignals: Array<{ type: string; title: string; score: number }>;
  confidence: number;
  impactEstimate?: string;
  createdAt?: string;
}

type FilterTab = 'all' | 'high' | 'opportunities' | 'risks';
type SortKey = 'confidence' | 'impact' | 'recency';
type SortDir = 'asc' | 'desc';

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function priorityColor(p: string) {
  switch (p) {
    case 'high': return 'bg-red-100 text-red-700 border-red-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function getPriorityIcon(p: string): LucideIcon {
  switch (p) {
    case 'high': return AlertTriangle;
    case 'medium': return Star;
    default: return Zap;
  }
}

function PriorityIconBadge({ priority }: { priority: string }) {
  return (
    <Badge className={`text-[10px] uppercase font-bold shrink-0 ${priorityColor(priority)}`}>
      {priority === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
      {priority === 'medium' && <Star className="w-3 h-3 mr-1" />}
      {priority !== 'high' && priority !== 'medium' && <Zap className="w-3 h-3 mr-1" />}
      {priority}
    </Badge>
  );
}

function priorityAccent(p: string) {
  switch (p) {
    case 'high': return 'border-l-red-500';
    case 'medium': return 'border-l-amber-500';
    default: return 'border-l-gray-400';
  }
}

function categoryLabel(c: string) {
  return c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function signalTypeColor(t: string) {
  switch (t) {
    case 'TECHNOLOGY': return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'GROWTH': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PARTNERSHIP': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'PAIN': return 'bg-red-50 text-red-700 border-red-200';
    case 'LEADERSHIP': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'RISK': return 'bg-red-50 text-red-700 border-red-200';
    case 'OPPORTUNITY': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function estimateImpact(priority: string, confidence: number): string {
  const conf = confidence * 100;
  if (priority === 'high' && conf >= 70) return '$500K+';
  if (priority === 'high') return '$250K–$500K';
  if (priority === 'medium' && conf >= 60) return '$100K–$250K';
  if (priority === 'medium') return '$50K–$100K';
  return '<$50K';
}

function isOpportunity(rec: Recommendation): boolean {
  const cat = rec.category.toLowerCase();
  const action = rec.action.toLowerCase();
  return cat.includes('opportunity') || cat.includes('growth') || action.includes('expand') || action.includes('upsell');
}

function isRisk(rec: Recommendation): boolean {
  const cat = rec.category.toLowerCase();
  const action = rec.action.toLowerCase();
  return cat.includes('risk') || cat.includes('churn') || action.includes('prevent') || action.includes('retain');
}

/* ═══════════════════════════════════════════════════════════════
   Recommendation Card
   ═══════════════════════════════════════════════════════════════ */

function RecommendationCard({
  rec,
  onViewBrief,
}: {
  rec: Recommendation;
  onViewBrief: (id: string) => void;
}) {
  const impact = rec.impactEstimate || estimateImpact(rec.priority, rec.confidence);
  const hasSupporting = rec.supportingSignals && rec.supportingSignals.length > 0;

  return (
    <Card className={`overflow-hidden border-l-4 ${priorityAccent(rec.priority)} hover:shadow-md transition-shadow`}>
      {/* Priority top strip */}
      <div className={`h-0.5 ${
        rec.priority === 'high' ? 'bg-red-500' :
        rec.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-400'
      }`} />

      <CardContent className="p-5 space-y-4">
        {/* Header: Company + Priority */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-tight truncate">{rec.companyName}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rec.industry || 'Unknown'} · {categoryLabel(rec.category)}
              </p>
            </div>
          </div>
          <PriorityIconBadge priority={rec.priority} />
        </div>

        {/* Signal / Action */}
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Signal</span>
          </div>
          <p className="text-sm font-medium text-foreground leading-relaxed">{rec.action}</p>
        </div>

        {/* Evidence + Source */}
        {rec.rationale && (
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Shield className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">{rec.rationale}</p>
          </div>
        )}

        {/* Impact Estimate */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">{impact}</span>
          </div>
          <span className="text-xs text-muted-foreground">estimated business impact</span>
        </div>

        {/* Confidence Bar */}
        <ConfidenceBar value={Math.round(rec.confidence * 100)} label="Confidence" size="sm" />

        {/* Supporting Signals */}
        {hasSupporting && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Supporting Intelligence ({rec.supportingSignals.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rec.supportingSignals.slice(0, 5).map((s, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${signalTypeColor(s.type)}`}
                >
                  {s.type}: {s.title}
                </span>
              ))}
              {rec.supportingSignals.length > 5 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] text-muted-foreground bg-muted">
                  +{rec.supportingSignals.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Target + Why Now + Conversation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {rec.targetDecisionMaker && (
            <div className="flex items-start gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Target</p>
                <p className="text-xs text-foreground">{rec.targetDecisionMaker}</p>
              </div>
            </div>
          )}
          {rec.whyNow && (
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Why Now</p>
                <p className="text-xs text-foreground/80 line-clamp-2">{rec.whyNow}</p>
              </div>
            </div>
          )}
          {rec.suggestedConversation && (
            <div className="flex items-start gap-2 sm:col-span-2">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Conversation Starter</p>
                <p className="text-xs text-foreground/80 line-clamp-2">{rec.suggestedConversation}</p>
              </div>
            </div>
          )}
        </div>

        {/* Evidence Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <EvidenceBadge source="AI" confidence={Math.round(rec.confidence * 100)} />
          <EvidenceBadge source={rec.category.toLowerCase().includes('tech') ? 'web' : 'database'} />
        </div>

        {/* CTA */}
        <Separator className="!my-0" />
        <div className="flex items-center justify-between pt-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {isOpportunity(rec) ? 'Expansion opportunity' : isRisk(rec) ? 'Risk mitigation' : 'Engagement action'}
          </p>
          <button
            onClick={() => onViewBrief(rec.companyId)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors group/btn"
          >
            View Full Brief
            <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════ */

const FILTER_TABS: { key: FilterTab; label: string; icon: typeof Lightbulb }[] = [
  { key: 'all', label: 'All', icon: BookOpen },
  { key: 'high', label: 'High Priority', icon: AlertTriangle },
  { key: 'opportunities', label: 'Opportunities', icon: TrendingUp },
  { key: 'risks', label: 'Risks', icon: Shield },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'confidence', label: 'Confidence' },
  { key: 'impact', label: 'Impact' },
  { key: 'recency', label: 'Recency' },
];

export default function RevenueIntelligenceRecommendationsScreen({
  navigateTo,
}: {
  navigateTo?: (screen: string, companyId?: string) => void;
}) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('confidence');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  /* ── Fetch Recommendations ── */
  const fetchRecs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashRes = await fetch('/api/g-revenue-intelligence/dashboard');
      if (!dashRes.ok) throw new Error('Failed to load dashboard');
      const dash = (await dashRes.json()).data ?? (await dashRes.json());
      const top = dash.topScoredAccounts || [];
      const allRecs: Recommendation[] = [];

      for (let i = 0; i < top.length; i += 5) {
        const batch = top.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (a: { accountId: string; accountName: string; industry: string | null; category: string; score: number }) => {
            const r = await fetch(`/api/g-revenue-intelligence/accounts/${a.accountId}/recommendations`);
            if (!r.ok) return null;
            const d = (await r.json()).data ?? (await r.json());
            if (Array.isArray(d) && d.length > 0) {
              const t = d[0];
              return {
                companyId: a.accountId,
                companyName: a.accountName,
                industry: a.industry,
                category: a.category,
                priority: t.priority || 'medium',
                action: t.action || t.recommendation || 'Engage',
                rationale: t.rationale || t.reason || '',
                suggestedConversation: t.suggestedConversation || t.conversation || '',
                targetDecisionMaker: t.targetDecisionMaker || t.target || 'Decision Maker',
                whyNow: t.whyNow || t.reason || '',
                supportingSignals: t.supportingSignals || t.signals || [],
                confidence: t.confidence || 0.5,
                createdAt: t.createdAt || new Date().toISOString(),
              };
            }
            return null;
          }),
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) allRecs.push(r.value);
        }
      }

      setRecs(allRecs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  /* ── Filter ── */
  const filtered = useMemo(() => {
    let list = [...recs];
    switch (activeTab) {
      case 'high':
        list = list.filter(r => r.priority === 'high');
        break;
      case 'opportunities':
        list = list.filter(r => isOpportunity(r));
        break;
      case 'risks':
        list = list.filter(r => isRisk(r));
        break;
    }
    return list;
  }, [recs, activeTab]);

  /* ── Sort ── */
  const sorted = useMemo(() => {
    const list = [...filtered];
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'confidence':
          cmp = a.confidence - b.confidence;
          break;
        case 'impact': {
          const aScore = a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1;
          const bScore = b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1;
          cmp = aScore * a.confidence - bScore * b.confidence;
          break;
        }
        case 'recency':
          cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [filtered, sortKey, sortDir]);

  /* ── Counts ── */
  const counts = useMemo(() => ({
    all: recs.length,
    high: recs.filter(r => r.priority === 'high').length,
    opportunities: recs.filter(r => isOpportunity(r)).length,
    risks: recs.filter(r => isRisk(r)).length,
  }), [recs]);

  /* ── Handle sort toggle ── */
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-primary" />
            </div>
            AI Revenue Recommendations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prioritized, AI-generated recommendations with evidence and confidence scores
          </p>
        </div>
        <Button variant="outline" onClick={fetchRecs} disabled={loading} className="gap-2 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Summary Stats ── */}
      {!loading && recs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Recommendations', value: counts.all, icon: BookOpen, color: 'text-foreground' },
            { label: 'High Priority', value: counts.high, icon: AlertTriangle, color: 'text-red-600' },
            { label: 'Opportunities', value: counts.opportunities, icon: TrendingUp, color: 'text-emerald-600' },
            { label: 'Risks', value: counts.risks, icon: Shield, color: 'text-amber-600' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground tabular-nums">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter Tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
              <span className={`text-[10px] tabular-nums ${
                activeTab === tab.key ? 'text-foreground/70' : 'text-muted-foreground/60'
              }`}>
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Sort Controls */}
        <div className="sm:ml-auto flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Sort by:</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                sortKey === opt.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
              {sortKey === opt.key && (
                <ArrowUpDown className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-80 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to Load Recommendations"
          message={error}
          onRetry={fetchRecs}
        />
      ) : sorted.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Lightbulb className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">No Recommendations Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              {activeTab === 'all'
                ? 'No AI recommendations are available yet. Try refreshing or check back after intelligence signals are detected.'
                : `No ${activeTab} recommendations found. Try switching to a different filter tab.`
              }
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sorted.map(rec => (
            <RecommendationCard
              key={rec.companyId}
              rec={rec}
              onViewBrief={id => navigateTo?.('revenue-intelligence-brief', id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
