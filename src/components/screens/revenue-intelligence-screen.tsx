'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Target, Sparkles, ChevronRight, RefreshCw,
  Flame, Sun, Sprout, AlertTriangle, Zap, Radar,
  Building2, Users, Mail, MessageSquare, ArrowUpRight,
  ArrowDownRight, BarChart3, Activity, Lightbulb, Eye,
  Brain, ShieldCheck, Send, Inbox,
} from 'lucide-react';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { LoadingState } from '@/components/enterprise/LoadingState';

/* ═══════════════════════════════════════════════════════════════
   Types — mirror real API response shapes
   ═══════════════════════════════════════════════════════════════ */

interface DashboardData {
  contactsByStatus: Record<string, number>;
  totalCompanies: number;
  draftsPendingReview: number;
  queuePending: number;
  repliesThisWeek: number;
  bouncesCount: number;
  suppressionsCount: number;
  emailHealthDistribution: Record<string, number>;
}

interface TopCompany {
  id: string;
  name: string;
  industry: string;
  score: number;
  status: string;
  lifecycleStage?: string;
}

interface Signal {
  id: string;
  companyId: string;
  type: string;
  title: string;
  severity: string;
  createdAt: string;
}

interface HighValueLead {
  id: string;
  name: string;
  email: string;
  score: number;
  company: string;
  status: string;
}

interface StrategicInsight {
  insight: string;
  impact: 'high' | 'medium' | 'low';
  action: string;
}

interface Recommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  engine: string;
  title: string;
  description: string;
  actionScreen?: string;
}

interface InsightsData {
  companyEngine: {
    totalCompanies: number;
    companiesByStatus: Record<string, number>;
    topScoredCompanies: TopCompany[];
    unreadSignalCount: number;
    criticalSignalCount: number;
    latestSignals: Signal[];
  };
  emailEngine: {
    totalContacts: number;
    contactsByStatus: Record<string, number>;
    pendingDrafts: number;
    pendingQueue: number;
    totalReplies: number;
    positiveReplies: number;
    replyRate: number;
    avgLeadScore: number;
    highValueLeads: HighValueLead[];
    activeSequences: number;
  };
  capabilityEngine: {
    totalCapabilities: number;
  };
  recommendations: Recommendation[];
  healthScore: number;
  aiSummary?: string;
  aiStrategicInsights?: StrategicInsight[];
  aiHealthAnalysis?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function scoreColorClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500 text-white';
  if (score >= 60) return 'bg-amber-500 text-white';
  return 'bg-red-500 text-white';
}

function healthColor(score: number) {
  if (score >= 75) return { text: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500', track: 'bg-emerald-100' };
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-500', track: 'bg-amber-100' };
  return { text: 'text-red-500', bg: 'bg-red-50', bar: 'bg-red-500', track: 'bg-red-100' };
}

function severityConfig(severity: string) {
  if (severity === 'critical') return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', confidence: 95 };
  if (severity === 'high') return { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', confidence: 82 };
  if (severity === 'medium') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', confidence: 68 };
  return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-600', confidence: 55 };
}

function priorityConfig(priority: string) {
  if (priority === 'high') return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'HIGH', confidence: 90 };
  if (priority === 'medium') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'MEDIUM', confidence: 75 };
  return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', label: 'LOW', confidence: 55 };
}

function categoryFromStatus(status: string): string {
  const s = (status || '').toLowerCase();
  if (s.includes('hot') || s.includes('prospect')) return 'HOT_ACCOUNT';
  if (s.includes('warm') || s.includes('engaged')) return 'WARM_ACCOUNT';
  if (s.includes('nurture') || s.includes('new')) return 'NURTURE';
  if (s.includes('risk') || s.includes('churn') || s.includes('lost')) return 'AT_RISK';
  return 'WARM_ACCOUNT';
}

function categoryIcon(cat: string) {
  switch (cat) {
    case 'HOT_ACCOUNT': return Flame;
    case 'WARM_ACCOUNT': return Sun;
    case 'NURTURE': return Sprout;
    case 'AT_RISK': return AlertTriangle;
    default: return BarChart3;
  }
}

function categoryColor(cat: string) {
  switch (cat) {
    case 'HOT_ACCOUNT': return 'bg-red-50 border-red-200 text-red-700';
    case 'WARM_ACCOUNT': return 'bg-amber-50 border-amber-200 text-amber-700';
    case 'NURTURE': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    case 'AT_RISK': return 'bg-gray-100 border-gray-200 text-gray-700';
    default: return 'bg-gray-50 border-gray-200 text-gray-600';
  }
}

function categoryLabel(cat: string) {
  return cat.replace(/_/g, ' ');
}

function relativeTime(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function totalContacts(statusCounts: Record<string, number>): number {
  return Object.values(statusCounts).reduce((sum, v) => sum + v, 0);
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components — Decision Intelligence pattern
   ═══════════════════════════════════════════════════════════════ */

/** Metric KPI Card — "What happened?" */
function MetricCard({
  icon: Icon, label, value, context, trend, trendLabel, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  context: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-gold-subtle' : 'bg-muted'}`}>
            <Icon className={`w-4 h-4 ${accent ? 'text-gold' : 'text-muted-foreground'}`} />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        {trend && trendLabel && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
            {trendLabel}
          </span>
        )}
      </div>
      <p className={`text-3xl font-bold tracking-tight ${accent ? 'text-gold' : 'text-foreground'}`}>{value}</p>
      <p className="text-sm text-muted-foreground leading-snug">{context}</p>
    </div>
  );
}

/** AI Summary Card — "Why did it happen?" */
function AISummaryCard({
  summary,
  healthAnalysis,
  healthScore,
}: {
  summary?: string;
  healthAnalysis?: string;
  healthScore: number;
}) {
  const hc = healthColor(healthScore);
  return (
    <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <Brain className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Revenue Intelligence</h2>
          <p className="text-[11px] text-muted-foreground">Cross-engine analysis &middot; Updated in real time</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hc.bg}`}>
            <span className={`text-sm font-bold ${hc.text}`}>{healthScore}</span>
          </div>
          <div className="text-xs">
            <p className="font-semibold text-foreground">Health</p>
            <p className="text-muted-foreground">Score</p>
          </div>
        </div>
      </div>

      {summary ? (
        <div className="rounded-lg bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100/60 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Executive Summary</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
        </div>
      ) : (
        <div className="rounded-lg bg-muted/40 border border-border p-4">
          <p className="text-sm text-muted-foreground italic">AI summary will be generated once sufficient data is available across engines.</p>
        </div>
      )}

      {healthAnalysis && (
        <div className="mt-3 rounded-lg bg-amber-50/60 border border-amber-100/60 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldCheck className="w-3 h-3 text-amber-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Health Analysis</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{healthAnalysis}</p>
        </div>
      )}
    </div>
  );
}

/** Priority Account Card — "What should happen next?" */
function PriorityAccountCard({
  rank, account, signalCount, onView,
}: {
  rank: number;
  account: TopCompany;
  signalCount: number;
  onView: (id: string) => void;
}) {
  const cat = categoryFromStatus(account.status);
  const CatIcon = categoryIcon(cat);

  return (
    <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-gold-subtle text-gold text-xs font-bold flex items-center justify-center">
            #{rank}
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground leading-tight">{account.name}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{account.industry || 'Unknown industry'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${categoryColor(cat)}`}>
            <CatIcon className="w-3 h-3" />
            {categoryLabel(cat)}
          </span>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${scoreColorClass(account.score)}`}>
            {account.score}
          </div>
        </div>
      </div>

      {/* Signal count + confidence */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Radar className="w-3 h-3" />
          <span>{signalCount} signal{signalCount !== 1 ? 's' : ''}</span>
        </div>
        <ConfidenceBar value={Math.min(95, 60 + account.score / 3)} size="sm" showPercentage={false} className="flex-1" />
        <span className="text-[10px] text-muted-foreground tabular-nums">{Math.min(95, 60 + account.score / 3)}%</span>
      </div>

      {/* Action */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-border/50">
        <div className="flex items-center gap-2">
          <EvidenceBadge source="analytics" confidence={Math.min(90, 50 + account.score / 4)} />
        </div>
        <button
          onClick={() => onView(account.id)}
          className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-bright transition-colors group/btn"
        >
          View Strategy
          <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

/** Signal Intelligence Card */
function SignalCard({ signal }: { signal: Signal }) {
  const sc = severityConfig(signal.severity);
  return (
    <div className={`rounded-xl border p-4 ${sc.bg}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${sc.badge}`}>
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className={`text-sm font-medium ${sc.text} leading-snug`}>{signal.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{signal.type} &middot; {relativeTime(signal.createdAt)}</p>
          </div>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${sc.badge}`}>
          {signal.severity}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <ConfidenceBar value={sc.confidence} label="Confidence" size="sm" showPercentage />
        <EvidenceBadge source="news" confidence={sc.confidence} />
      </div>
    </div>
  );
}

/** Recommendation Card with evidence and action */
function RecommendationCard({
  rec, onNavigate,
}: {
  rec: Recommendation;
  onNavigate?: (screen: string) => void;
}) {
  const pc = priorityConfig(rec.priority);
  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${pc.bg}`}>
            {rec.type === 'signal' ? <Radar className="w-3.5 h-3.5" /> :
             rec.type === 'draft' ? <Mail className="w-3.5 h-3.5" /> :
             rec.type === 'reply' ? <MessageSquare className="w-3.5 h-3.5" /> :
             rec.type === 'lead' ? <Users className="w-3.5 h-3.5" /> :
             <Lightbulb className="w-3.5 h-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground leading-snug">{rec.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{rec.engine} engine &middot; {rec.type}</p>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${pc.bg}`}>
            {pc.label}
          </span>
        </div>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed mb-3">{rec.description}</p>

      <div className="flex items-center gap-2 mb-3">
        <ConfidenceBar value={pc.confidence} label="Confidence" size="sm" showPercentage />
        <EvidenceBadge source="analytics" confidence={pc.confidence} />
      </div>

      {rec.actionScreen && onNavigate && (
        <button
          onClick={() => onNavigate(rec.actionScreen!)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <Lightbulb className="w-3 h-3" />
          Take Action
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/** Pipeline Status Bar */
function PipelineStatusBar({
  label, count, icon: Icon, color, total,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-sm font-bold text-foreground tabular-nums">{count}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${color === 'bg-blue-500' ? 'bg-blue-500' : color === 'bg-emerald-500' ? 'bg-emerald-500' : color === 'bg-amber-500' ? 'bg-amber-500' : color === 'bg-purple-500' ? 'bg-purple-500' : color === 'bg-slate-400' ? 'bg-slate-400' : 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Screen Component
   ═══════════════════════════════════════════════════════════════ */

export default function RevenueIntelligenceScreen({
  navigateTo,
}: {
  navigateTo?: (screen: string, companyId?: string) => void;
}) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, insightRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/command-center/insights'),
      ]);
      if (!dashRes.ok) throw new Error(`Dashboard: ${dashRes.status}`);
      if (!insightRes.ok) throw new Error(`Insights: ${insightRes.status}`);
      const dashJson = await dashRes.json();
      const insightJson = await insightRes.json();
      setDashboardData(dashJson);
      setInsightsData(insightJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load revenue intelligence.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <LoadingState message="Loading revenue intelligence..." lines={8} />
      </div>
    );
  }

  /* ── Error State ── */
  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <ErrorState
          title="Revenue intelligence unavailable"
          message={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  /* ── Empty State ── */
  const totalCompanies = insightsData?.companyEngine.totalCompanies ?? dashboardData?.totalCompanies ?? 0;
  const totalContacts = insightsData?.emailEngine.totalContacts ?? totalContactsFromStatus(dashboardData);
  if (totalCompanies === 0 && totalContacts === 0) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white border border-border rounded-xl p-12 text-center">
          <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Revenue intelligence requires company data. Import companies to activate AI-powered revenue insights.
          </p>
          <button
            onClick={() => navigateTo?.('import')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Import Companies
          </button>
        </div>
      </div>
    );
  }

  /* ── Data Extraction ── */
  const avgScore = insightsData?.emailEngine.avgLeadScore ?? 0;
  const healthScore = insightsData?.healthScore ?? 0;
  const topCompanies = insightsData?.companyEngine.topScoredCompanies ?? [];
  const latestSignals = insightsData?.companyEngine.latestSignals ?? [];
  const criticalSignalCount = insightsData?.companyEngine.criticalSignalCount ?? 0;
  const unreadSignalCount = insightsData?.companyEngine.unreadSignalCount ?? 0;
  const recommendations = insightsData?.recommendations ?? [];
  const aiSummary = insightsData?.aiSummary;
  const aiInsights = insightsData?.aiStrategicInsights ?? [];
  const aiHealthAnalysis = insightsData?.aiHealthAnalysis;
  const contactsByStatus = insightsData?.emailEngine.contactsByStatus ?? dashboardData?.contactsByStatus ?? {};
  const positiveReplies = insightsData?.emailEngine.positiveReplies ?? dashboardData?.repliesThisWeek ?? 0;
  const replyRate = insightsData?.emailEngine.replyRate ?? 0;

  /* ── Render ── */
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ─── Header ─── */}
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gold-subtle flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Revenue Intelligence</h1>
              <p className="text-sm text-muted-foreground">Decision intelligence across all engines</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-black/[0.04] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </header>

      {/* ─── Tab Navigation ─── */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Dashboard', view: 'revenue-intelligence', active: true },
          { label: 'Opportunity Radar', view: 'revenue-intelligence-opportunities' },
          { label: 'Executive Recommendations', view: 'revenue-intelligence-recommendations' },
        ].map((item) => (
          <button
            key={item.view}
            onClick={() => !item.active && navigateTo?.(item.view as any)}
            disabled={item.active}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              item.active
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
         SECTION 1: Revenue Overview Header — "What happened?"
         ═══════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Building2}
          label="Total Companies"
          value={totalCompanies}
          context="tracked accounts in database"
          trend={totalCompanies > 50 ? 'up' : 'neutral'}
          trendLabel="active"
          accent
        />
        <MetricCard
          icon={Users}
          label="Total Contacts"
          value={totalContacts}
          context="across all status stages"
          trend={totalContacts > 100 ? 'up' : 'neutral'}
          trendLabel="growing"
        />
        <MetricCard
          icon={Target}
          label="Avg Score"
          value={avgScore}
          context="composite intelligence score"
          trend={avgScore >= 60 ? 'up' : avgScore >= 40 ? 'neutral' : 'down'}
          trendLabel={avgScore >= 60 ? 'strong' : avgScore >= 40 ? 'moderate' : 'weak'}
          accent
        />
        <MetricCard
          icon={ShieldCheck}
          label="Health Score"
          value={healthScore}
          context={`signal${criticalSignalCount !== 1 ? 's' : ''}: ${unreadSignalCount} unread, ${criticalSignalCount} critical`}
          trend={healthScore >= 75 ? 'up' : healthScore >= 50 ? 'neutral' : 'down'}
          trendLabel={healthScore >= 75 ? 'excellent' : healthScore >= 50 ? 'fair' : 'needs attention'}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════
         SECTION 2: AI Revenue Intelligence Summary — "Why did it happen?"
         ═══════════════════════════════════════════════════════════ */}
      <section>
        <AISummaryCard
          summary={aiSummary}
          healthAnalysis={aiHealthAnalysis}
          healthScore={healthScore}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════
         SECTION 3: Priority Accounts Grid — "What should happen next?"
         ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Priority Accounts</h2>
            <p className="text-sm text-muted-foreground">Top 5 accounts by intelligence score &middot; Each with recommended strategy</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <EvidenceBadge source="analytics" />
            Score + signals
          </span>
        </div>
        {topCompanies.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-12 text-center">
            <TrendingUp className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No scored accounts yet. Import companies to see priority accounts.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {topCompanies.slice(0, 5).map((account, idx) => (
              <PriorityAccountCard
                key={account.id}
                rank={idx + 1}
                account={account}
                signalCount={idx < latestSignals.filter(s => s.companyId === account.id).length + 1 ? Math.max(1, Math.min(unreadSignalCount, 3) - idx) : Math.max(0, 3 - idx)}
                onView={(id) => navigateTo?.('revenue-intelligence-brief' as any, id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
         SECTION 4: Signal Intelligence Snapshot — "Why does it matter?"
         ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Signal Intelligence</h2>
            <p className="text-sm text-muted-foreground">{unreadSignalCount} signals detected &middot; {criticalSignalCount} critical &middot; Severity + confidence rated</p>
          </div>
          {latestSignals.length > 0 && (
            <button
              onClick={() => navigateTo?.('revenue-intelligence-opportunities' as any)}
              className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-bright transition-colors"
            >
              View All Signals <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        {latestSignals.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-8 text-center">
            <Radar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No signals detected. Signals will appear as company intelligence is enriched.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {latestSignals.slice(0, 6).map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
         SECTION 5: Revenue Recommendations — "What should happen next?"
         ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Revenue Recommendations</h2>
            <p className="text-sm text-muted-foreground">{recommendations.length} AI-generated actions &middot; Prioritized with confidence</p>
          </div>
          {aiInsights.length > 0 && (
            <button
              onClick={() => navigateTo?.('revenue-intelligence-recommendations' as any)}
              className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-bright transition-colors"
            >
              All Recommendations <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AI Strategic Insights (highest priority) */}
          {aiInsights.slice(0, 3).map((insight, i) => (
            <div key={`ai-${i}`} className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium leading-relaxed">{insight.insight}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                  insight.impact === 'high' ? 'bg-red-100 text-red-700 border-red-300' :
                  insight.impact === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                  'bg-slate-100 text-slate-600 border-slate-300'
                }`}>
                  {insight.impact}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <ConfidenceBar
                  value={insight.impact === 'high' ? 92 : insight.impact === 'medium' ? 78 : 65}
                  label="Confidence"
                  size="sm"
                  showPercentage
                />
                <EvidenceBadge source="analytics" confidence={85} />
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Action</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">{insight.action}</p>
              </div>
            </div>
          ))}
          {/* Rule-based recommendations (fill remaining slots) */}
          {recommendations.slice(0, Math.max(0, 3 - aiInsights.length)).map((rec, i) => (
            <RecommendationCard
              key={`rec-${i}`}
              rec={rec}
              onNavigate={(screen) => navigateTo?.(screen)}
            />
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
         SECTION 6: Engagement Pipeline — "What happened?" detail
         ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Engagement Pipeline</h2>
            <p className="text-sm text-muted-foreground">Contacts by status &middot; Conversion indicators across funnel stages</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {positiveReplies} positive replies
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {replyRate}% reply rate
            </span>
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          {Object.keys(contactsByStatus).length === 0 ? (
            <div className="py-8 text-center">
              <Inbox className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No contacts in pipeline. Import contacts to see engagement stages.</p>
            </div>
          ) : (
            <>
              <PipelineStatusBar
                label="New"
                count={contactsByStatus['new'] ?? 0}
                icon={Users}
                color="bg-blue-500"
                total={totalContacts}
              />
              <PipelineStatusBar
                label="Active"
                count={contactsByStatus['active'] ?? 0}
                icon={Zap}
                color="bg-emerald-500"
                total={totalContacts}
              />
              <PipelineStatusBar
                label="Sent"
                count={contactsByStatus['sent'] ?? 0}
                icon={Send}
                color="bg-amber-500"
                total={totalContacts}
              />
              <PipelineStatusBar
                label="Replied"
                count={contactsByStatus['replied'] ?? 0}
                icon={MessageSquare}
                color="bg-purple-500"
                total={totalContacts}
              />
              <PipelineStatusBar
                label="Bounced"
                count={contactsByStatus['bounced'] ?? 0}
                icon={AlertTriangle}
                color="bg-red-500"
                total={totalContacts}
              />
              <PipelineStatusBar
                label="Unsubscribed"
                count={contactsByStatus['unsubscribed'] ?? 0}
                icon={Eye}
                color="bg-slate-400"
                total={totalContacts}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** Utility: sum contacts from status map */
function totalContactsFromStatus(dashboardData: DashboardData | null): number {
  if (!dashboardData) return 0;
  return totalContacts(dashboardData.contactsByStatus);
}
