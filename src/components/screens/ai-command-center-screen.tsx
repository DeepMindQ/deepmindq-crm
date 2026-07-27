'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   DeepMindQ — AI Command Center Screen
   "Today's Intelligence" — unified dashboard of all AI intelligence activity.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Radar,
  Target,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronRight,
  Activity,
  ShieldCheck,
  DollarSign,
  Gauge,
  RefreshCw,
  Loader2,
  AlertCircle,
  Building2,
  TrendingUp,
  ArrowRight,
  Sparkles,
  MessageSquare,
  Brain,
  Clock,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

/* ═══════════════════════════════════════════════════════════════════════════
   Types — shapes returned by the API endpoints
   ═══════════════════════════════════════════════════════════════════════════ */

interface DashboardStats {
  companies: number;
  contacts: number;
  signals: number;
  insights: number;
  opportunities: number;
  risks: number;
  recommendations: number;
  today: {
    newSignals: number;
    newOpportunities: number;
    newRisks: number;
    newRecommendations: number;
  };
  breakdown: {
    signalsByImpact: Record<string, number>;
    signalsByType: Record<string, number>;
    insightsByType: Record<string, number>;
  };
}

interface RecentInsight {
  id: string;
  type: string; // SIGNAL | OPPORTUNITY | RISK | RECOMMENDATION | SCORING | FORECAST
  title: string;
  description: string;
  confidence: number;
  impact: number;
  urgency: number;
  evidence: Array<{ source?: string; url?: string; snippet?: string }>;
  recommendedAction: string | null;
  reasoning: string | null;
  companyId: string | null;
  companyName: string | null;
  createdAt: string;
  status: string;
  sourceType: string;
  modelUsed: string | null;
}

interface InsightsResponse {
  summary?: string;
  keyInsights?: Array<{ type: string; icon: string; title: string; description: string }>;
  predictions?: Array<{ metric: string; current: number; predicted: number; trend: string; confidence: number }>;
  recentInsights?: RecentInsight[];
}

interface SignalItem {
  id: string;
  type: string;
  title: string;
  description: string;
  contactId?: string;
  contactName?: string;
  companyName?: string;
  severity: 'high' | 'medium' | 'low';
  detectedAt: string;
  metadata?: Record<string, unknown>;
}

interface SignalsResponse {
  signals: SignalItem[];
  summary: Record<string, number>;
  total: number;
}

interface CompanyItem {
  id: string;
  rawName: string;
  domain: string | null;
  industry: string | null;
  sizeRange: string | null;
  country: string | null;
  status: string;
  intelligenceScore: number | null;
  contactCount: number;
  signalCount: number;
  isEnriched: boolean;
  topSignal: { id: string; title: string; signalType: string; impact: string } | null;
  updatedAt: string | null;
}

interface CompaniesResponse {
  companies: CompanyItem[];
  total: number;
  page: number;
  limit: number;
  stats: { total: number; avgScore: number; withSignals: number; enriched: number };
}

interface AIHealthResponse {
  overview: {
    totalInsights: number;
    activeInsights: number;
    expiredInsights: number;
    recentInsights: number;
    approvalRate: number;
  };
  quality: {
    avgConfidence: number;
    avgImpact: number;
    highUrgencyCount: number;
    expiringSoon: number;
  };
  byType: Array<{ type: string; count: number; avgConfidence: number; avgImpact: number }>;
  usageByRoute: Array<{ route: string | null; count: number }>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Config — insight types & colours
   ═══════════════════════════════════════════════════════════════════════════ */

type InsightCategory = 'SIGNAL' | 'OPPORTUNITY' | 'RISK' | 'RECOMMENDATION' | 'OTHER';

const INSIGHT_CFG: Record<
  InsightCategory,
  { label: string; dot: string; badge: string; bar: string; text: string }
> = {
  SIGNAL: {
    label: 'SIGNAL',
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    bar: 'bg-blue-500',
    text: 'text-blue-600',
  },
  OPPORTUNITY: {
    label: 'OPPORTUNITY',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    text: 'text-emerald-600',
  },
  RISK: {
    label: 'RISK',
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border-red-200',
    bar: 'bg-red-500',
    text: 'text-red-600',
  },
  RECOMMENDATION: {
    label: 'RECOMMENDATION',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    text: 'text-amber-600',
  },
  OTHER: {
    label: 'INSIGHT',
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    bar: 'bg-zinc-400',
    text: 'text-zinc-600',
  },
};

function insightCategory(type: string): InsightCategory {
  const t = (type || '').toUpperCase();
  if (t === 'SIGNAL') return 'SIGNAL';
  if (t === 'OPPORTUNITY') return 'OPPORTUNITY';
  if (t === 'RISK') return 'RISK';
  if (t === 'RECOMMENDATION') return 'RECOMMENDATION';
  return 'OTHER';
}

const SEVERITY_CFG: Record<string, { dot: string; label: string }> = {
  high: { dot: 'bg-red-500', label: 'High' },
  critical: { dot: 'bg-red-600', label: 'Critical' },
  medium: { dot: 'bg-amber-500', label: 'Medium' },
  low: { dot: 'bg-zinc-400', label: 'Low' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function gradeFromScore(score: number | null | undefined): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score == null) return 'F';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

const GRADE_CFG: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  B: { bg: 'bg-blue-100', text: 'text-blue-700' },
  C: { bg: 'bg-amber-100', text: 'text-amber-700' },
  D: { bg: 'bg-red-100', text: 'text-red-700' },
  F: { bg: 'bg-zinc-100', text: 'text-zinc-600' },
};

function hallucinationRiskLevel(health: AIHealthResponse | undefined): 'Low' | 'Medium' | 'High' {
  if (!health) return 'Low';
  const high = health.quality.highUrgencyCount;
  const conf = health.quality.avgConfidence;
  // High urgency insights + low avg confidence => higher hallucination risk
  if (high > 10 || (conf < 50 && health.overview.activeInsights > 5)) return 'High';
  if (high > 3 || conf < 70) return 'Medium';
  return 'Low';
}

const HALLUCINATION_CFG: Record<string, { bg: string; text: string; dot: string }> = {
  Low: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Medium: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  High: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

/** Build a 7-day volume series from a list of timestamped items. */
function build7DaySeries(items: Array<{ ts: string }>): Array<{ day: string; count: number }> {
  const days: Array<{ day: string; count: number }> = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = items.filter((it) => {
      const t = new Date(it.ts).getTime();
      return t >= d.getTime() && t < next.getTime();
    }).length;
    days.push({ day: d.toLocaleDateString(undefined, { weekday: 'short' }), count });
  }
  return days;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function StatCardSkeleton() {
  return (
    <Card className="bg-white rounded-xl border shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <AlertCircle className="h-8 w-8 text-red-400" />
      <p className="text-sm text-zinc-500 max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

/* ── Stat metric card ── */
function MetricCard({
  label,
  value,
  trend,
  icon: Icon,
  accent,
  gradient,
}: {
  label: string;
  value: number;
  trend: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: { ring: string; iconBg: string; iconText: string; trendText: string };
  gradient: string;
}) {
  return (
    <Card
      className={`relative overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md ${gradient}`}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-500">{label}</p>
            <p className="text-2xl font-bold text-zinc-900 tabular-nums">{value.toLocaleString()}</p>
            <p className={`text-xs font-medium ${accent.trendText}`}>{trend}</p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${accent.iconBg}`}>
            <Icon className={`h-5 w-5 ${accent.iconText}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Intelligence feed item ── */
function IntelligenceFeedItem({ insight }: { insight: RecentInsight }) {
  const [expanded, setExpanded] = useState(false);
  const cat = insightCategory(insight.type);
  const cfg = INSIGHT_CFG[cat];
  const conf = Math.round(insight.confidence || 0);

  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
      >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.badge}`}
            >
              {cfg.label}
            </span>
            <span className="truncate text-sm font-semibold text-zinc-900">{insight.title}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{insight.description}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${cfg.bar}`}
                  style={{ width: `${Math.min(100, conf)}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-zinc-500">{conf}% conf.</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Clock className="h-3 w-3" />
              {fmtRelative(insight.createdAt)}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 bg-zinc-50/60 px-4 py-3">
              {insight.companyName && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="font-medium">{insight.companyName}</span>
                </div>
              )}
              {insight.reasoning && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Reasoning
                  </p>
                  <p className="text-xs text-zinc-600">{insight.reasoning}</p>
                </div>
              )}
              {insight.evidence.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Evidence
                  </p>
                  <ul className="space-y-1">
                    {insight.evidence.slice(0, 4).map((ev, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-600">
                        <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                        <span className="line-clamp-2">
                          {ev.source && <span className="font-medium">{ev.source}: </span>}
                          {ev.snippet || ev.url || '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {insight.recommendedAction && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
                  <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    <Zap className="h-3 w-3" /> Recommended Action
                  </p>
                  <p className="text-xs text-amber-900">{insight.recommendedAction}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Signal timeline item ── */
function SignalTimelineItem({ signal }: { signal: SignalItem }) {
  const sev = SEVERITY_CFG[signal.severity] || SEVERITY_CFG.low;
  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      {/* vertical line */}
      <div className="flex flex-col items-center">
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${sev.dot}`} />
        <span className="mt-1 w-px flex-1 bg-zinc-200" />
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium text-zinc-400">
            {fmtDayLabel(signal.detectedAt)} · {fmtTimeLabel(signal.detectedAt)}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
              signal.severity === 'high'
                ? 'bg-red-50 text-red-600'
                : signal.severity === 'medium'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-zinc-100 text-zinc-500'
            }`}
          >
            {signal.severity}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-medium leading-snug text-zinc-800 line-clamp-2">
          {signal.title}
        </p>
        {signal.companyName && (
          <p className="mt-0.5 text-[11px] text-zinc-400">{signal.companyName}</p>
        )}
      </div>
    </div>
  );
}

/* ── Top accounts row ── */
function AccountRow({
  company,
  onScore,
  scoring,
  onNavigate,
}: {
  company: CompanyItem;
  onScore: (c: CompanyItem) => void;
  scoring: boolean;
  onNavigate: (c: CompanyItem) => void;
}) {
  const grade = gradeFromScore(company.intelligenceScore);
  const gCfg = GRADE_CFG[grade];
  return (
    <div className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-b-0 transition-colors hover:bg-zinc-50">
      <button
        type="button"
        onClick={() => onNavigate(company)}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
          <Building2 className="h-4 w-4 text-zinc-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 hover:text-blue-600">
            {company.rawName}
          </p>
          <p className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span>{company.signalCount} signals</span>
            {company.industry && (
              <>
                <span>·</span>
                <span className="truncate">{company.industry}</span>
              </>
            )}
          </p>
        </div>
      </button>
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${gCfg.bg} ${gCfg.text}`}
        title={`Revenue score ${company.intelligenceScore ?? '—'}`}
      >
        {grade}
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onScore(company)}
        disabled={scoring}
        className="h-7 shrink-0 gap-1 px-2 text-xs"
      >
        {scoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Gauge className="h-3 w-3" />}
        Score
      </Button>
    </div>
  );
}

/* ── Quick action button ── */
function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
  loading,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  loading?: boolean;
  accent: { bg: string; text: string };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group flex flex-col items-start gap-1.5 rounded-lg border border-zinc-200 bg-white p-3 text-left transition-all hover:border-zinc-300 hover:shadow-sm disabled:opacity-60"
    >
      <div className="flex w-full items-center justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent.bg}`}>
          {loading ? (
            <Loader2 className={`h-4 w-4 animate-spin ${accent.text}`} />
          ) : (
            <Icon className={`h-4 w-4 ${accent.text}`} />
          )}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
      </div>
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="text-[11px] leading-snug text-zinc-500">{description}</p>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main screen
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AICommandCenterScreen() {
  const { setActiveView, setSelectedCompanyId } = useAppStore();
  const queryClient = useQueryClient();

  /* ── Data fetching ── */
  const statsQuery = useQuery<DashboardStats>({
    queryKey: ['ai-command-center', 'stats'],
    queryFn: () => fetch('/api/dashboard/stats').then((r) => r.json()),
    staleTime: 60_000,
  });

  const insightsQuery = useQuery<InsightsResponse>({
    queryKey: ['ai-command-center', 'insights', 20],
    queryFn: () =>
      fetch('/api/ai/insights?limit=20')
        .then((r) => r.json())
        .then((d) => d?.data || d),
    staleTime: 60_000,
  });

  const signalsQuery = useQuery<SignalsResponse>({
    queryKey: ['ai-command-center', 'signals', 15],
    queryFn: () =>
      fetch('/api/signals?limit=15')
        .then((r) => r.json())
        .then((d) => ({ ...d, signals: d.signals || [] })),
    staleTime: 60_000,
  });

  const companiesQuery = useQuery<CompaniesResponse>({
    queryKey: ['ai-command-center', 'companies', 10],
    queryFn: () =>
      fetch('/api/companies?limit=10&sortBy=updatedAt').then((r) => r.json()),
    staleTime: 60_000,
  });

  const healthQuery = useQuery<AIHealthResponse>({
    queryKey: ['ai-command-center', 'ai-health'],
    queryFn: () => fetch('/api/ai/health').then((r) => r.json()),
    staleTime: 60_000,
  });

  /* ── Derived data ── */
  const recentInsights = useMemo<RecentInsight[]>(
    () => insightsQuery.data?.recentInsights || [],
    [insightsQuery.data]
  );

  const signals = useMemo<SignalItem[]>(
    () => signalsQuery.data?.signals || [],
    [signalsQuery.data]
  );

  const companies = useMemo<CompanyItem[]>(
    () => companiesQuery.data?.companies || [],
    [companiesQuery.data]
  );

  const signalSeries = useMemo(() => build7DaySeries(signals.map((s) => ({ ts: s.detectedAt }))), [signals]);

  const stats = statsQuery.data;
  const health = healthQuery.data;
  const hallucination = hallucinationRiskLevel(health);
  const hallucCfg = HALLUCINATION_CFG[hallucination];

  /* ── Scoring state ── */
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [batchScoring, setBatchScoring] = useState(false);
  const [generatingActions, setGeneratingActions] = useState(false);

  /* ── Actions ── */
  async function scoreCompany(company: CompanyItem) {
    setScoringId(company.id);
    try {
      const res = await fetch('/api/engines/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', companyId: company.id, skipNarrative: false }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Scoring failed');
      }
      const score = json.score;
      toast.success(`${company.rawName} scored`, {
        description: score
          ? `Grade ${score.grade} · ${score.score}/100 · ${(score.confidence ?? 0).toFixed(0)}% confidence`
          : 'Scoring completed.',
      });
      queryClient.invalidateQueries({ queryKey: ['ai-command-center', 'companies'] });
    } catch (err) {
      toast.error('Failed to score account', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setScoringId(null);
    }
  }

  async function scoreTopAccounts() {
    if (companies.length === 0) {
      toast.error('No accounts to score', { description: 'Load accounts first.' });
      return;
    }
    setBatchScoring(true);
    try {
      const ids = companies.slice(0, 10).map((c) => c.id);
      const res = await fetch('/api/engines/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'batch', companyIds: ids, skipNarrative: true }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Batch scoring failed');
      }
      const total = json.total ?? (json.scores?.length ?? 0);
      toast.success('Batch scoring complete', {
        description: `${total} account${total === 1 ? '' : 's'} scored successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['ai-command-center', 'companies'] });
    } catch (err) {
      toast.error('Batch scoring failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setBatchScoring(false);
    }
  }

  async function generateActions() {
    const top = companies[0];
    if (!top) {
      toast.error('No top account found', { description: 'Load accounts first.' });
      return;
    }
    setGeneratingActions(true);
    try {
      const res = await fetch('/api/engines/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: top.id }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Action generation failed');
      }
      toast.success('Action recommendations generated', {
        description: `For ${top.rawName}.`,
      });
      // Navigate to the account intelligence view for context
      setSelectedCompanyId(top.id);
      setActiveView('account-intelligence');
    } catch (err) {
      toast.error('Action generation failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setGeneratingActions(false);
    }
  }

  function navigateToAccount(company: CompanyItem) {
    setSelectedCompanyId(company.id);
    setActiveView('account-intelligence');
  }

  const refreshAll = () => {
    statsQuery.refetch();
    insightsQuery.refetch();
    signalsQuery.refetch();
    companiesQuery.refetch();
    healthQuery.refetch();
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-zinc-50/60">
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
        {/* ── Header ── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-700 shadow-sm">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
                AI Command Center
              </h1>
              <p className="text-sm text-zinc-500">Real-time intelligence overview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshAll} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </header>

        {/* ── Stats row ── */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsQuery.isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <MetricCard
                label="New Signals"
                value={stats?.signals ?? 0}
                trend={`+${stats?.today?.newSignals ?? 0} today`}
                icon={Radar}
                accent={{
                  ring: 'ring-blue-200',
                  iconBg: 'bg-blue-100',
                  iconText: 'text-blue-600',
                  trendText: 'text-blue-600',
                }}
                gradient="bg-gradient-to-br from-blue-50/60 to-white"
              />
              <MetricCard
                label="Revenue Opportunities"
                value={stats?.opportunities ?? 0}
                trend={`+${stats?.today?.newOpportunities ?? 0} today`}
                icon={Target}
                accent={{
                  ring: 'ring-emerald-200',
                  iconBg: 'bg-emerald-100',
                  iconText: 'text-emerald-600',
                  trendText: 'text-emerald-600',
                }}
                gradient="bg-gradient-to-br from-emerald-50/60 to-white"
              />
              <MetricCard
                label="Risks Detected"
                value={stats?.risks ?? 0}
                trend={`+${stats?.today?.newRisks ?? 0} today`}
                icon={AlertTriangle}
                accent={{
                  ring: 'ring-red-200',
                  iconBg: 'bg-red-100',
                  iconText: 'text-red-600',
                  trendText: 'text-red-600',
                }}
                gradient="bg-gradient-to-br from-red-50/60 to-white"
              />
              <MetricCard
                label="Recommended Actions"
                value={stats?.recommendations ?? 0}
                trend={`+${stats?.today?.newRecommendations ?? 0} today`}
                icon={Zap}
                accent={{
                  ring: 'ring-amber-200',
                  iconBg: 'bg-amber-100',
                  iconText: 'text-amber-600',
                  trendText: 'text-amber-600',
                }}
                gradient="bg-gradient-to-br from-amber-50/60 to-white"
              />
            </>
          )}
        </section>

        {/* ── AI Health bar ── */}
        <section>
          <Card className="bg-white rounded-xl border shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900">
                  <Activity className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">AI System Health</p>
                  <p className="text-[11px] text-zinc-400">
                    {healthQuery.isLoading
                      ? 'Loading status…'
                      : `${health?.overview?.activeInsights ?? 0} active insights · ${health?.overview?.recentInsights ?? 0} this week`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:items-center sm:gap-6">
                {/* Model status */}
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">Model</p>
                    <p className="text-xs font-semibold text-zinc-900">Active</p>
                  </div>
                </div>

                {/* Avg confidence */}
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">Avg Confidence</p>
                    {healthQuery.isLoading ? (
                      <Skeleton className="h-3 w-12" />
                    ) : (
                      <p className="text-xs font-semibold text-zinc-900">
                        {(health?.quality?.avgConfidence ?? 0).toFixed(0)}%
                      </p>
                    )}
                  </div>
                </div>

                {/* Hallucination risk */}
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100">
                    <Gauge className="h-3.5 w-3.5 text-zinc-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">Hallucination Risk</p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${hallucCfg.bg} ${hallucCfg.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${hallucCfg.dot}`} />
                      {hallucination}
                    </span>
                  </div>
                </div>

                {/* Cost today */}
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">Cost Today</p>
                    <p className="text-xs font-semibold text-zinc-900">
                      $
                      {(
                        ((health?.overview?.recentInsights ?? 0) * 0.012 +
                          (health?.overview?.activeInsights ?? 0) * 0.004)
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Two-column layout ── */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* ═══ LEFT COLUMN (60%) ═══ */}
          <div className="space-y-6 lg:col-span-3">
            {/* Intelligence Feed */}
            <Card className="bg-white rounded-xl border shadow-sm">
              <CardHeader className="flex-row items-center justify-between border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Intelligence Feed
                </CardTitle>
                <Badge variant="secondary" className="rounded-full">
                  {recentInsights.length} recent
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {insightsQuery.isLoading ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="h-2 w-2 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-1/3" />
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-1.5 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : insightsQuery.isError ? (
                  <ErrorBlock
                    message="We couldn't load the intelligence feed. Please retry."
                    onRetry={() => insightsQuery.refetch()}
                  />
                ) : recentInsights.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <Sparkles className="h-7 w-7 text-zinc-300" />
                    <p className="text-sm text-zinc-500">No recent AI insights yet.</p>
                    <p className="text-xs text-zinc-400">
                      Insights appear here as the engines analyze your accounts.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[420px]">
                    {recentInsights.map((ins) => (
                      <IntelligenceFeedItem key={ins.id} insight={ins} />
                    ))}
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Signal Timeline */}
            <Card className="bg-white rounded-xl border shadow-sm">
              <CardHeader className="flex-row items-center justify-between border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Radar className="h-4 w-4 text-blue-500" />
                  Signal Timeline
                </CardTitle>
                <Badge variant="secondary" className="rounded-full">
                  {signals.length} signals
                </Badge>
              </CardHeader>
              <CardContent className="p-4">
                {/* Mini volume chart */}
                {signalSeries.length > 0 && (
                  <div className="mb-4 h-16 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={signalSeries} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="signalVol" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" hide />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: '1px solid #e4e4e7',
                            fontSize: 11,
                            padding: '4px 8px',
                          }}
                          labelStyle={{ fontSize: 11, color: '#71717a' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#signalVol)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {signalsQuery.isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="h-2.5 w-2.5 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-2.5 w-1/4" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : signalsQuery.isError ? (
                  <ErrorBlock
                    message="Couldn't load signals. Please retry."
                    onRetry={() => signalsQuery.refetch()}
                  />
                ) : signals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <Radar className="h-6 w-6 text-zinc-300" />
                    <p className="text-sm text-zinc-500">No recent signals detected.</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[320px] pr-2">
                    <div className="pl-1">
                      {signals.map((s) => (
                        <SignalTimelineItem key={s.id} signal={s} />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ RIGHT COLUMN (40%) ═══ */}
          <div className="space-y-6 lg:col-span-2">
            {/* Top Accounts by Score */}
            <Card className="bg-white rounded-xl border shadow-sm">
              <CardHeader className="flex-row items-center justify-between border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Top Accounts by Score
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveView('companies')}
                  className="h-7 gap-1 px-2 text-xs text-zinc-500"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </CardHeader>
              <CardContent className="p-2">
                {companiesQuery.isLoading ? (
                  <div className="space-y-2 p-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 py-2">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-1/2" />
                          <Skeleton className="h-2.5 w-1/3" />
                        </div>
                        <Skeleton className="h-6 w-6 rounded-md" />
                        <Skeleton className="h-7 w-14 rounded-md" />
                      </div>
                    ))}
                  </div>
                ) : companiesQuery.isError ? (
                  <ErrorBlock
                    message="Couldn't load accounts."
                    onRetry={() => companiesQuery.refetch()}
                  />
                ) : companies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <Building2 className="h-6 w-6 text-zinc-300" />
                    <p className="text-sm text-zinc-500">No accounts found.</p>
                  </div>
                ) : (
                  <div>
                    {companies.slice(0, 8).map((c) => (
                      <AccountRow
                        key={c.id}
                        company={c}
                        onScore={scoreCompany}
                        scoring={scoringId === c.id}
                        onNavigate={navigateToAccount}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-white rounded-xl border shadow-sm">
              <CardHeader className="border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <QuickAction
                    icon={Gauge}
                    title="Score Top Accounts"
                    description="Batch score top 10 accounts"
                    onClick={scoreTopAccounts}
                    loading={batchScoring}
                    accent={{ bg: 'bg-blue-50', text: 'text-blue-600' }}
                  />
                  <QuickAction
                    icon={Sparkles}
                    title="Generate Actions"
                    description="Recommend actions for top account"
                    onClick={generateActions}
                    loading={generatingActions}
                    accent={{ bg: 'bg-amber-50', text: 'text-amber-600' }}
                  />
                  <QuickAction
                    icon={MessageSquare}
                    title="Plan Conversation"
                    description="Open the conversation planner"
                    onClick={() => setActiveView('conversation-planner')}
                    accent={{ bg: 'bg-emerald-50', text: 'text-emerald-600' }}
                  />
                  <QuickAction
                    icon={Brain}
                    title="View AI Health"
                    description="Inspect AI quality metrics"
                    onClick={() => setActiveView('ai-health')}
                    accent={{ bg: 'bg-zinc-100', text: 'text-zinc-700' }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
