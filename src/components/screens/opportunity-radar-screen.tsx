'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, Crosshair, Sparkles, ChevronDown, ChevronUp,
  UserCheck, Flame, Sun, Droplets, Eye, Building2,
  MessageSquare, BarChart3, RefreshCw, Cpu, Cloud, Database,
  AlertCircle, Brain,
} from 'lucide-react';
import { PageTransition, AnimatedCounter, EmptyState } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface Opportunity {
  companyName: string;
  matchScore: number;
  opportunityType: string;
  whyNow: string;
  relevantCapability: string;
  targetPersona: string;
  confidence: number;
  reasoning: string;
}

interface Distribution {
  hot: number;
  warm: number;
  developing: number;
  monitoring: number;
}

interface APIResponse {
  opportunities: Opportunity[];
  companiesScanned: number;
  distribution: Distribution;
}

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */
const TYPE_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  'AI Automation': { bg: 'bg-purple-50', text: 'text-purple-700', icon: Cpu },
  'Cloud Modernization': { bg: 'bg-blue-50', text: 'text-blue-700', icon: Cloud },
  'Data Analytics': { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: Database },
  'Digital Transformation': { bg: 'bg-amber-50', text: 'text-amber-700', icon: RefreshCw },
};

const DISTRIBUTION_TIERS = [
  { key: 'hot' as const, tier: 'Hot', range: '≥80%', color: '#DC2626', icon: Flame },
  { key: 'warm' as const, tier: 'Warm', range: '60–79%', color: '#D97706', icon: Sun },
  { key: 'developing' as const, tier: 'Developing', range: '40–59%', color: '#2563EB', icon: Droplets },
  { key: 'monitoring' as const, tier: 'Monitoring', range: '<40%', color: '#9CA3AF', icon: Eye },
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High Match' },
  { key: 'recent', label: 'Recently Detected' },
];

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */
function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#D97706' : '#DC2626';
}
function scoreLabel(s: number) {
  return s >= 80 ? 'Hot' : s >= 60 ? 'Warm' : s >= 40 ? 'Developing' : 'Monitoring';
}
function getTypeStyle(type: string) {
  return TYPE_STYLES[type] ?? TYPE_STYLES['Digital Transformation'];
}

/* ═══════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════ */
function LoadingSkeleton() {
  return (
    <PageTransition className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="h-7 w-48" />
          </div>
          <Skeleton className="h-4 w-72 ml-[52px]" />
        </div>
        <div className="flex gap-2 ml-[52px] md:ml-0">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      </div>
      {/* Distribution skeleton */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <Skeleton className="h-4 w-60" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="w-7 h-7 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              </div>
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      {/* Cards skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-9 h-9 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-8 w-14" />
              </div>
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Skeleton className="h-2.5 w-20" /><Skeleton className="h-3 w-full" /></div>
                <div className="space-y-1.5"><Skeleton className="h-2.5 w-20" /><Skeleton className="h-3 w-24" /></div>
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}

/* ═══════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════ */
export default function OpportunityRadarScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/opportunities');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json.data ?? json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load opportunities');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Filtered + sorted opportunities */
  const filtered = useMemo(() => {
    if (!data) return [];
    let list = [...data.opportunities];
    if (filter === 'high') list = list.filter((o) => o.matchScore >= 80);
    if (filter === 'recent') list.sort((a, b) => b.confidence - a.confidence);
    return list;
  }, [data, filter]);

  /* Filter counts */
  const filterCounts = useMemo(() => {
    if (!data) return { all: 0, high: 0, recent: 0 };
    return {
      all: data.opportunities.length,
      high: data.opportunities.filter((o) => o.matchScore >= 80).length,
      recent: data.opportunities.length,
    };
  }, [data]);

  /* ── Loading ── */
  if (loading) return <LoadingSkeleton />;

  /* ── Error ── */
  if (error) {
    return (
      <PageTransition className="p-6 lg:p-8 max-w-7xl mx-auto">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load opportunities"
          description={error}
        />
      </PageTransition>
    );
  }

  if (!data) return null;

  const totalOpps = data.opportunities.length;

  return (
    <PageTransition className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))' }}>
              <Radar className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Opportunity Radar</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[52px]">
            AI-matched opportunities &middot;{' '}
            <span className="font-medium text-foreground">
              <AnimatedCounter value={data.companiesScanned} />
            </span>{' '}
            companies scanned
          </p>
        </div>
        <div className="flex items-center gap-2 ml-[52px] md:ml-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                filter === f.key
                  ? 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-foreground shadow-sm'
                  : 'border-gray-200 bg-white text-muted-foreground hover:border-gray-300 hover:text-foreground'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                filter === f.key ? 'bg-[#D4AF37]/20 text-[#9A8340]' : 'bg-gray-100 text-muted-foreground'
              }`}>{filterCounts[f.key as keyof typeof filterCounts]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Score Distribution ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Opportunity Score Distribution</h2>
          <span className="text-xs text-muted-foreground ml-auto">{totalOpps} accounts scored</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {DISTRIBUTION_TIERS.map((tier, i) => {
            const count = data.distribution[tier.key];
            return (
              <motion.div
                key={tier.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="relative overflow-hidden rounded-lg border border-gray-100 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${tier.color}12` }}>
                    <tier.icon className="w-3.5 h-3.5" style={{ color: tier.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{tier.tier}</p>
                    <p className="text-[10px] text-muted-foreground">{tier.range}</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mb-2.5">
                  <span className="text-2xl font-bold" style={{ color: tier.color }}>
                    <AnimatedCounter value={count} />
                  </span>
                  <span className="text-xs text-muted-foreground">accounts</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: tier.color }}
                    initial={{ width: 0 }}
                    animate={{ width: count > 0 && totalOpps > 0 ? `${Math.max((count / totalOpps) * 100, 8)}%` : '0%' }}
                    transition={{ delay: 0.4 + i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Top Opportunities Grid ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Crosshair className="w-4 h-4" style={{ color: '#D4AF37' }} />
          <h2 className="text-sm font-semibold text-foreground">Top Opportunities</h2>
          <Badge variant="outline" className="ml-2 text-[10px]">{filtered.length} shown</Badge>
        </div>

        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}
              >
                <Brain className="w-7 h-7" style={{ color: '#D4AF37' }} />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">
                {totalOpps === 0 ? 'Opportunity Radar Active — Awaiting Signals' : 'No opportunities match this filter'}
              </p>
              {totalOpps === 0 ? (
                <>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    AI is monitoring your accounts for buying signals. Opportunities will appear here when the engine detects high-intent patterns.
                  </p>
                  <div className="space-y-2 mt-3">
                    {[
                      'Funding rounds and expansion signals',
                      'Leadership changes creating new entry points',
                      'Technology stack changes indicating needs',
                    ].map((text, i) => (
                      <motion.p
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#D4AF37' }} />
                        {text}
                      </motion.p>
                    ))}
                  </div>
                  <button
                    onClick={() => navigateTo?.('signal-intelligence')}
                    className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-colors"
                    style={{ background: '#D4AF37' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#C5A030'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#D4AF37'; }}
                  >
                    Run Signal Scan
                  </button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Try selecting a different filter to see more results.
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              {filtered.map((opp, i) => {
                const typeStyle = getTypeStyle(opp.opportunityType);
                const TypeIcon = typeStyle.icon;
                const isExpanded = expandedIdx === i;
                const sc = scoreColor(opp.matchScore);

                return (
                  <motion.div
                    key={`${opp.companyName}-${i}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col"
                  >
                    {/* Card Header */}
                    <div className="p-5 pb-4 flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate block">
                              {opp.companyName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{opp.opportunityType}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="text-2xl font-bold tabular-nums" style={{ color: sc }}>{opp.matchScore}%</div>
                          <div className="text-[10px] font-medium" style={{ color: sc }}>{scoreLabel(opp.matchScore)}</div>
                        </div>
                      </div>

                      {/* Type Badge */}
                      <div className="mb-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                          <TypeIcon className="w-3 h-3" />
                          {opp.opportunityType}
                        </span>
                      </div>

                      {/* Why Now */}
                      <div className="mb-3">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Why Now</p>
                        <p className="text-xs text-foreground/80 leading-relaxed">{opp.whyNow}</p>
                      </div>

                      {/* Meta Row */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Relevant Capability</p>
                          <p className="text-xs text-foreground font-medium leading-snug">{opp.relevantCapability}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Target Persona</p>
                          <div className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-muted-foreground" />
                            <p className="text-xs text-foreground font-medium">{opp.targetPersona}</p>
                          </div>
                        </div>
                      </div>

                      {/* Confidence Bar */}
                      <div className="flex items-center gap-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Confidence</p>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${sc}, ${sc}CC)` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${opp.confidence}%` }}
                            transition={{ delay: 0.3 + i * 0.06, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: sc }}>{opp.confidence}%</span>
                      </div>
                    </div>

                    {/* AI Reasoning Toggle */}
                    <div className="border-t border-gray-100">
                      <button
                        onClick={() => setExpandedIdx(isExpanded ? null : i)}
                        className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-gray-50/50 transition-colors rounded-b-xl"
                      >
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                          <span>AI Reasoning</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-4 pt-1">
                              <div className="rounded-lg bg-gray-50 p-3">
                                <p className="text-xs text-foreground/75 leading-relaxed">{opp.reasoning}</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Action Footer */}
                    <div className="px-5 pb-4 pt-1 flex items-center gap-2">
                      <button
                        onClick={() => navigateTo?.('conversation-studio')}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                        style={{ background: opp.matchScore >= 80 ? 'linear-gradient(135deg, #D4AF37, #B8960F)' : 'linear-gradient(135deg, #4B5563, #374151)' }}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Start Conversation
                      </button>
                      <button
                        onClick={() => navigateTo?.('conversation-studio')}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-muted-foreground hover:text-foreground hover:border-gray-300 bg-white transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}