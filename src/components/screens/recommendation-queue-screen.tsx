'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Check, Clock, X, Pause, Zap, Brain, ArrowRight, Filter,
  LayoutGrid, List, Sparkles, TrendingUp, ChevronDown,
  AlertCircle, Inbox, Timer, CheckCircle2, XCircle,
  RotateCcw, MoreHorizontal, Loader2, Building2, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorBoundary } from '@/components/error-boundary';
import { SkeletonDashboard } from '@/components/loading';
import { PageTransition, AnimatedCard, EmptyState, AnimatedCounter } from '@/components/ui/animated-components';
import { fetchApi } from '@/lib/fetchApi';
import { cn } from '@/lib/utils';
import { tokens, getConfidenceTier, getPriorityTier } from '@/components/intelligence-os/design-tokens';
import { ConfidenceIndicator } from '@/components/trust/confidence-indicator';
import { FreshnessIndicator } from '@/components/intelligence-os/atoms/freshness-indicator';
import type { SignalPillVariant } from '@/types/ms9-advisor';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  companyName: string;
  companyId: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  priority: 'critical' | 'high' | 'medium' | 'low';
  source: 'ai' | 'manual' | 'signal';
  reasoning: string;
  suggestedAction: string;
  status: 'pending' | 'accepted' | 'dismissed' | 'snoozed';
  snoozedUntil?: string;
  acceptedAt?: string;
  createdAt: string;
}

/* ═══════════════════════════════════════════════════════════════
   Fallback mock data
   ═══════════════════════════════════════════════════════════════ */
const fallbackRecommendations: RecommendationItem[] = [
  {
    id: 'rec-1', title: 'Prioritize Meridian Systems outreach',
    description: 'The CTO transition creates a 90-day window for technology vendor engagement. Their current contract expires in Q4.',
    companyName: 'Meridian Systems', companyId: 'acc-meridian', confidence: 88,
    impact: 'high', priority: 'critical', source: 'ai',
    reasoning: 'Leadership transitions create a unique 90-day window where new executives evaluate existing vendor relationships. Meridian\'s new CTO\'s cloud-native background aligns perfectly with your platform capabilities.',
    suggestedAction: 'Schedule executive intro call within 5 business days',
    status: 'pending', createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 'rec-2', title: 'Prepare competitive brief for Apex Analytics',
    description: 'Update battle cards and positioning documents to address their new enterprise tier pricing.',
    companyName: 'Apex Analytics', companyId: 'acc-apex', confidence: 76,
    impact: 'medium', priority: 'high', source: 'signal',
    reasoning: 'Apex Analytics entering your competitive space with lower pricing requires updated positioning. Focus on intelligence depth where DeepMindQ has clear advantage.',
    suggestedAction: 'Review and update competitive battle cards',
    status: 'pending', createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 'rec-3', title: 'Accelerate NovaTech qualification',
    description: 'Three RFP signals indicate active buying process. Schedule discovery call this week.',
    companyName: 'NovaTech Solutions', companyId: 'acc-novatech', confidence: 72,
    impact: 'high', priority: 'high', source: 'ai',
    reasoning: 'The combination of website research patterns and RFP activity strongly suggests NovaTech is in the evaluation phase. Speed of engagement correlates with 3x higher conversion.',
    suggestedAction: 'Schedule discovery call within 48 hours',
    status: 'pending', createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    id: 'rec-4', title: 'Re-engage Pinnacle Corp after leadership change',
    description: 'New VP of Sales hired from a competitor. Previous deal stalled due to champion departure.',
    companyName: 'Pinnacle Corp', companyId: 'acc-pinnacle', confidence: 65,
    impact: 'medium', priority: 'medium', source: 'signal',
    reasoning: 'New VP of Sales with competitor experience presents fresh engagement opportunity. Historical deal data shows willingness to invest in intelligence tools.',
    suggestedAction: 'Send personalized re-engagement email referencing their growth mandate',
    status: 'pending', createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
  },
  {
    id: 'rec-5', title: 'Monitor Vertex AI expansion signals',
    description: 'Series C funding suggests team expansion. Watch for technology platform RFPs.',
    companyName: 'Vertex AI', companyId: 'acc-vertex', confidence: 92,
    impact: 'high', priority: 'medium', source: 'ai',
    reasoning: 'Series C at $45M correlates with 3-6 month expansion timeline. Historical pattern analysis indicates 82% probability of platform purchase.',
    suggestedAction: 'Set up monitoring alerts and prepare outreach for when buying signals intensify',
    status: 'accepted', acceptedAt: new Date(Date.now() - 30 * 60000).toISOString(), createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
  },
  {
    id: 'rec-6', title: 'Dismiss: Low-priority lead from StartupCo',
    description: 'Company size below ICP threshold. Limited budget signals.',
    companyName: 'StartupCo', companyId: 'acc-startup', confidence: 35,
    impact: 'low', priority: 'low', source: 'ai',
    reasoning: 'Employee count and revenue signals fall below ideal customer profile thresholds. Budget constraints detected.',
    suggestedAction: 'Move to nurture list for future re-evaluation',
    status: 'dismissed', createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: 'rec-7', title: 'Snoozed: Follow up with DataBridge Inc',
    description: 'Initial contact made. Awaiting internal review completion before next steps.',
    companyName: 'DataBridge Inc', companyId: 'acc-databridge', confidence: 68,
    impact: 'medium', priority: 'medium', source: 'manual',
    reasoning: 'Initial discovery call completed positively. Their internal evaluation timeline is 2-3 weeks. Re-engage when their review concludes.',
    suggestedAction: 'Re-engage after their internal review period',
    status: 'snoozed', snoozedUntil: new Date(Date.now() + 7 * 24 * 3600000).toISOString(), createdAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
  },
];

/* ═══════════════════════════════════════════════════════════════
   Priority / Impact / Source Configs
   ═══════════════════════════════════════════════════════════════ */
const PRIORITY_CONFIG = {
  critical: { color: tokens.priority.critical.value, bg: tokens.priority.critical.bg, label: 'Critical' },
  high:     { color: tokens.priority.high.value,     bg: tokens.priority.high.bg,     label: 'High' },
  medium:   { color: tokens.priority.medium.value,   bg: tokens.priority.medium.bg,   label: 'Medium' },
  low:      { color: tokens.priority.low.value,      bg: tokens.priority.low.bg,      label: 'Low' },
};

const IMPACT_CONFIG = {
  high:   { color: tokens.trust.verified.value, label: 'High Impact' },
  medium: { color: tokens.domain.reasoning, label: 'Medium Impact' },
  low:    { color: tokens.text.secondary, label: 'Low Impact' },
};

const SOURCE_CONFIG = {
  ai:     { icon: Brain,   color: tokens.domain.opportunity, label: 'AI' },
  manual: { icon: Target,  color: tokens.domain.signal, label: 'Manual' },
  signal: { icon: Zap,     color: tokens.domain.signal, label: 'Signal' },
};

const STATUS_FILTERS = [
  { key: 'pending',  label: 'Pending',  icon: Clock },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2 },
  { key: 'dismissed', label: 'Dismissed', icon: XCircle },
  { key: 'snoozed',  label: 'Snoozed',  icon: Pause },
] as const;

const SORT_OPTIONS = [
  { key: 'priority',  label: 'Priority' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'newest',    label: 'Newest' },
  { key: 'impact',    label: 'Impact' },
] as const;

/* ═══════════════════════════════════════════════════════════════
   Priority Sort Weight
   ═══════════════════════════════════════════════════════════════ */
function getPriorityWeight(p: string): number {
  if (p === 'critical') return 0;
  if (p === 'high') return 1;
  if (p === 'medium') return 2;
  return 3;
}

function getImpactWeight(i: string): number {
  if (i === 'high') return 0;
  if (i === 'medium') return 1;
  return 2;
}

/* ═══════════════════════════════════════════════════════════════
   Recommendation Card
   ═══════════════════════════════════════════════════════════════ */
function RecommendationQueueCard({
  item,
  onAccept,
  onDismiss,
  onSnooze,
  onUndo,
}: {
  item: RecommendationItem;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const priorityCfg = PRIORITY_CONFIG[item.priority];
  const impactCfg = IMPACT_CONFIG[item.impact];
  const sourceCfg = SOURCE_CONFIG[item.source];
  const confidenceTier = getConfidenceTier(item.confidence);
  const isPending = item.status === 'pending';
  const isAccepted = item.status === 'accepted';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: item.status === 'dismissed' ? -100 : item.status === 'accepted' ? 100 : 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'rounded-xl border p-4 lg:p-5 transition-colors',
        !isPending && 'opacity-70',
      )}
      style={{
        borderColor: isPending ? tokens.border.hover : tokens.border.default,
        backgroundColor: tokens.surface.card,
        borderLeft: `3px solid ${priorityCfg.color}`,
      }}
    >
      {/* Top Row: Priority, Source, Confidence */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: priorityCfg.bg, color: priorityCfg.color }}
          >
            {priorityCfg.label}
          </span>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: `${sourceCfg.color}12`, color: sourceCfg.color }}
          >
            <sourceCfg.icon className="w-2.5 h-2.5" />
            {sourceCfg.label}
          </span>
          <span
            className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: `${impactCfg.color}12`, color: impactCfg.color }}
          >
            {impactCfg.label}
          </span>
          {!isPending && (
            <span className="text-[10px] font-medium capitalize" style={{ color: tokens.text.muted }}>
              {item.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[12px] font-bold tabular-nums" style={{ color: tokens.confidence[confidenceTier].value }}>
            {item.confidence}%
          </span>
          <ConfidenceIndicator level={confidenceTier} />
        </div>
      </div>

      {/* Title + Company */}
      <h3 className="text-[14px] font-semibold leading-snug mb-1" style={{ color: tokens.text.primary }}>
        {item.title}
      </h3>
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-3 h-3" style={{ color: tokens.text.muted }} />
        <span className="text-[12px] font-medium" style={{ color: tokens.accent.bright }}>
          {item.companyName}
        </span>
        <span className="text-[10px]" style={{ color: tokens.text.muted }}>·</span>
        <FreshnessIndicator timestamp={item.createdAt} />
      </div>

      {/* Description (truncated) */}
      <p className="text-[12px] leading-relaxed mb-3" style={{ color: tokens.text.secondary }}>
        {item.description}
      </p>

      {/* Expanded: Reasoning + Suggested Action */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg p-3 mb-3 space-y-2" style={{ backgroundColor: `${tokens.domain.reasoning}08`, border: `1px solid ${tokens.domain.reasoning}20` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="w-3 h-3" style={{ color: tokens.domain.reasoning }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tokens.domain.reasoning }}>AI Reasoning</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: tokens.text.secondary }}>{item.reasoning}</p>
            </div>
            <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: `${tokens.domain.action}08`, border: `1px solid ${tokens.domain.action}20` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowRight className="w-3 h-3" style={{ color: tokens.domain.action }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tokens.domain.action }}>Suggested Action</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: tokens.text.secondary }}>{item.suggestedAction}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Row */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] font-medium transition-colors"
          style={{ color: tokens.text.muted }}
          onMouseEnter={e => (e.currentTarget.style.color = tokens.text.secondary)}
          onMouseLeave={e => (e.currentTarget.style.color = tokens.text.muted)}
        >
          {isExpanded ? 'Show less' : 'Show reasoning'}
        </button>

        <div className="flex items-center gap-2">
          {isAccepted ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onUndo(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
              style={{ backgroundColor: `${tokens.text.muted}15`, color: tokens.text.secondary }}
            >
              <RotateCcw className="w-3 h-3" />
              Undo
            </motion.button>
          ) : isPending ? (
            <>
              <motion.button
                whileHover={{ backgroundColor: `${tokens.domain.risk}15` }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onDismiss(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{ color: tokens.text.secondary, minHeight: '36px' }}
              >
                <X className="w-3 h-3" />
                Dismiss
              </motion.button>
              <motion.button
                whileHover={{ backgroundColor: `${tokens.domain.reasoning}15` }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSnooze(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{ color: tokens.text.secondary, minHeight: '36px' }}
              >
                <Pause className="w-3 h-3" />
                Snooze
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onAccept(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                style={{ backgroundColor: `${tokens.domain.action}15`, color: tokens.domain.action, minHeight: '36px' }}
              >
                <Check className="w-3 h-3" />
                Accept
              </motion.button>
            </>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onUndo(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
              style={{ backgroundColor: `${tokens.text.muted}15`, color: tokens.text.secondary }}
            >
              <RotateCcw className="w-3 h-3" />
              Undo
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Empty State Messages
   ═══════════════════════════════════════════════════════════════ */
function FilterEmptyState({ status }: { status: string }) {
  const config: Record<string, { icon: React.ComponentType<{ className?: string }>; title: string; description: string }> = {
    pending:  { icon: CheckCircle2, title: 'All caught up!', description: 'No pending recommendations. Your AI advisor will generate new ones as intelligence signals are detected.' },
    accepted: { icon: Sparkles,   title: 'No accepted recommendations yet', description: 'Accepted recommendations will appear here as you act on AI suggestions.' },
    dismissed: { icon: XCircle,   title: 'No dismissed recommendations', description: 'Dismissed recommendations are archived here for reference.' },
    snoozed:  { icon: Pause,     title: 'No snoozed recommendations', description: 'Snoozed recommendations will reappear at their scheduled time.' },
  };
  const c = config[status] || config.pending;
  return <EmptyState icon={c.icon} title={c.title} description={c.description} />;
}

/* ═══════════════════════════════════════════════════════════════
   Main Recommendation Queue Screen
   ═══════════════════════════════════════════════════════════════ */
export default function RecommendationQueueScreen() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [sortBy, setSortBy] = useState<string>('priority');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [localItems, setLocalItems] = useState<RecommendationItem[]>(fallbackRecommendations);
  const queryClient = useQueryClient();

  // Fetch from API (falls back to local if unavailable)
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['recommendations', statusFilter],
    queryFn: () => fetchApi<RecommendationItem[]>(`/api/ai/recommendations?status=${statusFilter}`),
    refetchInterval: 60_000,
  });

  const recommendations = apiData?.data ?? localItems;

  // Mutations (optimistic local state)
  const acceptMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/ai/recommendations/${id}/accept`, { method: 'POST' }),
    onMutate: (id) => {
      setLocalItems(prev => prev.map(r => r.id === id ? { ...r, status: 'accepted' as const, acceptedAt: new Date().toISOString() } : r));
      toast.success('Recommendation accepted');
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['recommendations'] }); },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/ai/recommendations/${id}/dismiss`, { method: 'POST' }),
    onMutate: (id) => {
      setLocalItems(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' as const } : r));
      toast.info('Recommendation dismissed');
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['recommendations'] }); },
  });

  const snoozeMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/ai/recommendations/${id}/snooze`, { method: 'POST' }),
    onMutate: (id) => {
      setLocalItems(prev => prev.map(r => r.id === id ? { ...r, status: 'snoozed' as const, snoozedUntil: new Date(Date.now() + 24 * 3600000).toISOString() } : r));
      toast.info('Recommendation snoozed for 24 hours');
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['recommendations'] }); },
  });

  const undoMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/ai/recommendations/${id}/undo`, { method: 'POST' }),
    onMutate: (id) => {
      setLocalItems(prev => prev.map(r => r.id === id ? { ...r, status: 'pending' as const, acceptedAt: undefined, snoozedUntil: undefined } : r));
      toast.success('Recommendation restored to pending');
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['recommendations'] }); },
  });

  // Filter + Sort
  const filteredItems = useMemo(() => {
    let items = recommendations.filter(r => r.status === statusFilter);
    if (priorityFilter !== 'all') items = items.filter(r => r.priority === priorityFilter);
    if (sourceFilter !== 'all') items = items.filter(r => r.source === sourceFilter);

    items.sort((a, b) => {
      switch (sortBy) {
        case 'priority':   return getPriorityWeight(a.priority) - getPriorityWeight(b.priority);
        case 'confidence': return b.confidence - a.confidence;
        case 'newest':     return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'impact':     return getImpactWeight(a.impact) - getImpactWeight(b.impact);
        default:           return 0;
      }
    });
    return items;
  }, [recommendations, statusFilter, priorityFilter, sourceFilter, sortBy]);

  // Count by status
  const counts = useMemo(() => ({
    pending: recommendations.filter(r => r.status === 'pending').length,
    accepted: recommendations.filter(r => r.status === 'accepted').length,
    dismissed: recommendations.filter(r => r.status === 'dismissed').length,
    snoozed: recommendations.filter(r => r.status === 'snoozed').length,
    total: recommendations.length,
  }), [recommendations]);

  return (
    <ErrorBoundary>
      <PageTransition>
        <div className="min-h-screen" style={{ backgroundColor: tokens.surface.base, color: tokens.text.primary }}>
          <div className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 lg:py-8">

            {/* ── Header ── */}
            <header className="mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-5 h-5" style={{ color: tokens.domain.opportunity }} />
                    <h1 className="text-xl font-bold tracking-tight">Recommendation Queue</h1>
                  </div>
                  <p className="text-[13px]" style={{ color: tokens.text.secondary }}>
                    {counts.total} total recommendations · {counts.pending} pending actions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex items-center rounded-lg border p-0.5" style={{ borderColor: tokens.border.default }}>
                    <button
                      onClick={() => setViewMode('grid')}
                      className="p-2 rounded-md transition-colors"
                      style={{
                        backgroundColor: viewMode === 'grid' ? tokens.surface.elevated : 'transparent',
                        color: viewMode === 'grid' ? tokens.text.primary : tokens.text.muted,
                      }}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className="p-2 rounded-md transition-colors"
                      style={{
                        backgroundColor: viewMode === 'list' ? tokens.surface.elevated : 'transparent',
                        color: viewMode === 'list' ? tokens.text.primary : tokens.text.muted,
                      }}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </header>

            {isLoading ? (
              <SkeletonDashboard />
            ) : (
              <>
                {/* ── Status Filter Tabs ── */}
                <nav className="flex items-center gap-1 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }} aria-label="Filter by status">
                  {STATUS_FILTERS.map(f => {
                    const count = counts[f.key as keyof typeof counts] as number;
                    const isActive = statusFilter === f.key;
                    return (
                      <motion.button
                        key={f.key}
                        onClick={() => setStatusFilter(f.key)}
                        className={cn('relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors')}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          color: isActive ? tokens.text.primary : tokens.text.secondary,
                          backgroundColor: isActive ? tokens.surface.elevated : 'transparent',
                        }}
                      >
                        <f.icon className="w-3.5 h-3.5" />
                        {f.label}
                        {count > 0 && (
                          <span
                            className="px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums"
                            style={{ backgroundColor: isActive ? `${tokens.accent.DEFAULT}20` : `${tokens.text.muted}15`, color: isActive ? tokens.accent.bright : tokens.text.muted }}
                          >
                            {count}
                          </span>
                        )}
                        {isActive && (
                          <motion.div
                            layoutId="rec-queue-tab"
                            className="absolute inset-0 rounded-lg"
                            style={{ border: `1px solid ${tokens.border.hover}` }}
                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </nav>

                {/* ── Filter Bar ── */}
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  {/* Priority Filter */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
                    <span className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>Priority:</span>
                    <select
                      value={priorityFilter}
                      onChange={e => setPriorityFilter(e.target.value)}
                      className="text-[11px] rounded-md px-2 py-1 border outline-none"
                      style={{
                        borderColor: tokens.border.default,
                        backgroundColor: tokens.surface.card,
                        color: tokens.text.primary,
                      }}
                    >
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  {/* Source Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>Source:</span>
                    <select
                      value={sourceFilter}
                      onChange={e => setSourceFilter(e.target.value)}
                      className="text-[11px] rounded-md px-2 py-1 border outline-none"
                      style={{
                        borderColor: tokens.border.default,
                        backgroundColor: tokens.surface.card,
                        color: tokens.text.primary,
                      }}
                    >
                      <option value="all">All</option>
                      <option value="ai">AI</option>
                      <option value="manual">Manual</option>
                      <option value="signal">Signal</option>
                    </select>
                  </div>

                  {/* Sort */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[11px] font-medium" style={{ color: tokens.text.muted }}>Sort:</span>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="text-[11px] rounded-md px-2 py-1 border outline-none"
                      style={{
                        borderColor: tokens.border.default,
                        backgroundColor: tokens.surface.card,
                        color: tokens.text.primary,
                      }}
                    >
                      {SORT_OPTIONS.map(opt => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ── Recommendations Grid/List ── */}
                <main>
                  {filteredItems.length === 0 ? (
                    <FilterEmptyState status={statusFilter} />
                  ) : (
                    <AnimatePresence mode="popLayout">
                      <div className={cn(
                        viewMode === 'grid'
                          ? 'grid grid-cols-1 lg:grid-cols-2 gap-4'
                          : 'space-y-3',
                      )}>
                        {filteredItems.map(item => (
                          <RecommendationQueueCard
                            key={item.id}
                            item={item}
                            onAccept={(id) => acceptMutation.mutate(id)}
                            onDismiss={(id) => dismissMutation.mutate(id)}
                            onSnooze={(id) => snoozeMutation.mutate(id)}
                            onUndo={(id) => undoMutation.mutate(id)}
                          />
                        ))}
                      </div>
                    </AnimatePresence>
                  )}
                </main>

                {/* ── Accepted Section (when viewing pending) ── */}
                {statusFilter === 'pending' && counts.accepted > 0 && (
                  <section className="mt-8" aria-labelledby="accepted-section-title">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="w-4 h-4" style={{ color: tokens.domain.action }} />
                      <h2 id="accepted-section-title" className="text-[15px] font-semibold" style={{ color: tokens.text.primary }}>
                        Recently Accepted
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: `${tokens.domain.action}15`, color: tokens.domain.action }}>
                        {counts.accepted}
                      </span>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${tokens.border.hover} transparent` }}>
                      {recommendations
                        .filter(r => r.status === 'accepted')
                        .sort((a, b) => new Date(b.acceptedAt!).getTime() - new Date(a.acceptedAt!).getTime())
                        .map(item => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center justify-between rounded-lg border px-4 py-3"
                            style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.card }}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tokens.domain.action}15` }}>
                                <Check className="w-3.5 h-3.5" style={{ color: tokens.domain.action }} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[12px] font-medium truncate" style={{ color: tokens.text.primary }}>{item.title}</p>
                                <p className="text-[11px]" style={{ color: tokens.text.muted }}>{item.companyName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[11px] font-bold tabular-nums" style={{ color: tokens.confidence[getConfidenceTier(item.confidence)].value }}>
                                {item.confidence}%
                              </span>
                              {item.acceptedAt && (
                                <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                                  {new Date(item.acceptedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </PageTransition>
    </ErrorBoundary>
  );
}
