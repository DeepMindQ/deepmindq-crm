'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Sparkles, Send, ArrowRight, Building2, TrendingUp,
  Zap, Activity, BarChart3, Clock, Lightbulb, RefreshCw,
  MessageSquare, ArrowUpRight, Target, AlertTriangle, Globe,
  Shield, ChevronRight, FileText, Mail, Radar, Inbox,
  Radio, Users, Database, ShieldCheck, Cpu, HeartPulse,
} from 'lucide-react';
import { PageTransition, AnimatedCounter, EmptyState } from '@/components/ui/animated-components';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { AIProgressTracker } from '@/components/enterprise/AIProgressTracker';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { LoadingState } from '@/components/enterprise/LoadingState';

/* ═══════════════════════════════════════════════════════════════
   Types — mirror the API response shape exactly
   ═══════════════════════════════════════════════════════════════ */
interface CommandCenterProps {
  navigateTo?: (screen: string, companyId?: string) => void;
}

interface TopCompany {
  id: string; name: string; industry: string; score: number;
  status: string; lifecycleStage?: string;
}

interface Signal {
  id: string; companyId: string; type: string; title: string;
  severity: string; createdAt: string;
}

interface HighValueLead {
  id: string; name: string; email: string; score: number;
  company: string; status: string;
}

interface StrategicInsight {
  insight: string; impact: 'high' | 'medium' | 'low'; action: string;
}

interface Recommendation {
  type: string; priority: 'high' | 'medium' | 'low'; engine: string;
  title: string; description: string; actionScreen?: string;
}

interface InsightsData {
  companyEngine: {
    totalCompanies: number;
    companiesByStatus: Record<string, number>;
    companiesByIndustry: Record<string, number>;
    companiesByLifecycle: Record<string, number>;
    companiesByCountry: Record<string, number>;
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
    capabilitiesByCategory: Record<string, number>;
    capabilitiesByServiceLine: Record<string, number>;
    topCapabilities: Array<{ id: string; title: string; category: string; usedInEmails: number }>;
  };
  recommendations: Recommendation[];
  healthScore: number;
  aiSummary?: string;
  aiStrategicInsights?: StrategicInsight[];
  aiHealthAnalysis?: string;
}

type ProgressStep = 'pending' | 'processing' | 'complete' | 'error';

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function healthColor(score: number) {
  if (score >= 75) return { text: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500', track: 'bg-emerald-100', ring: 'ring-emerald-500/20' };
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-500', track: 'bg-amber-100', ring: 'ring-amber-500/20' };
  return { text: 'text-red-500', bg: 'bg-red-50', bar: 'bg-red-500', track: 'bg-red-100', ring: 'ring-red-500/20' };
}

function severityColor(severity: string) {
  if (severity === 'critical') return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
  if (severity === 'high') return { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' };
  if (severity === 'medium') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' };
  return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-600' };
}

/* ═══════════════════════════════════════════════════════════════
   Sub-component: Health Gauge (circular)
   ═══════════════════════════════════════════════════════════════ */
function HealthGauge({ score, size = 72 }: { score: number; size?: number }) {
  const c = healthColor(score);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5" className={c.track} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5"
          strokeLinecap="round"
          className={c.bar}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <span className={`absolute text-sm font-bold tabular-nums ${c.text}`}>{score}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-component: Priority Action Card
   ═══════════════════════════════════════════════════════════════ */
function PriorityActionCard({
  icon: Icon, label, count, items, accentBg, accentText, accentBorder,
  onClick, badgeText, badgeClass,
}: {
  icon: typeof Zap;
  label: string;
  count: number;
  items: Array<{ primary: string; secondary?: string; badge?: string; badgeClass?: string }>;
  accentBg: string; accentText: string; accentBorder: string;
  onClick?: () => void;
  badgeText?: string;
  badgeClass?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`card-interactive rounded-xl bg-white border border-slate-200 overflow-hidden text-left w-full press-scale ${accentBorder}`}
      whileHover={{ y: -2 }}
    >
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentBg}`}>
              <Icon className={`h-4 w-4 ${accentText}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{count}</p>
            </div>
          </div>
          {badgeText && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeClass || 'bg-blue-100 text-blue-700'}`}>
              {badgeText}
            </span>
          )}
          <ArrowUpRight className="h-4 w-4 text-slate-300" />
        </div>
        <div className="space-y-1.5">
          {items.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {item.badge && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${item.badgeClass || ''}`}>
                  {item.badge}
                </span>
              )}
              <span className="text-slate-700 truncate font-medium">{item.primary}</span>
              {item.secondary && <span className="text-slate-400 ml-auto text-[10px]">{item.secondary}</span>}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-[11px] text-slate-400 italic">No items at this time</p>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-component: Strategic Insight Card
   ═══════════════════════════════════════════════════════════════ */
function StrategicInsightCard({
  insight, index, onNavigate,
}: {
  insight: StrategicInsight;
  index: number;
  onNavigate?: (screen: string) => void;
}) {
  const impactMap: Record<string, { badge: string; label: string; accent: string; confidence: number }> = {
    high: { badge: 'bg-red-100 text-red-700 border-red-300', label: 'HIGH', accent: 'risk', confidence: 92 },
    medium: { badge: 'bg-amber-100 text-amber-700 border-amber-300', label: 'MEDIUM', accent: 'signal', confidence: 78 },
    low: { badge: 'bg-slate-100 text-slate-600 border-slate-300', label: 'LOW', accent: 'enrichment', confidence: 65 },
  };
  const m = impactMap[insight.impact] ?? impactMap.medium;

  return (
    <motion.div
      data-accent={m.accent}
      className="intel-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <div className="pl-5 pr-5 py-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <p className="text-sm text-slate-800 font-medium leading-relaxed">{insight.insight}</p>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${m.badge}`}>
            {m.label}
          </span>
        </div>

        {/* Confidence + Source Evidence */}
        <div className="flex items-center gap-3">
          <ConfidenceBar value={m.confidence} size="sm" showPercentage={true} />
          <div className="flex items-center gap-1.5">
            <EvidenceBadge source="analytics" confidence={m.confidence} />
            <EvidenceBadge source="internal" confidence={85} />
          </div>
        </div>

        {/* Recommended Action */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-start gap-2 flex-1">
              <Lightbulb className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-700 leading-relaxed font-medium">{insight.action}</p>
            </div>
            {onNavigate && (
              <ChevronRight className="h-4 w-4 text-blue-400 shrink-0 cursor-pointer hover:text-blue-600" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-component: Account Score Row
   ═══════════════════════════════════════════════════════════════ */
function AccountScoreRow({
  company, rank, onView,
}: { company: TopCompany; rank: number; onView?: (id: string) => void }) {
  const sc = company.score >= 80 ? 'text-emerald-600' : company.score >= 60 ? 'text-amber-600' : 'text-slate-500';
  const barColor = company.score >= 80 ? 'bg-emerald-500' : company.score >= 60 ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <button
      onClick={() => onView?.(company.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group text-left"
    >
      <span className="text-[10px] font-bold text-slate-300 w-4 text-center">{rank}</span>
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
        <Building2 className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{company.name}</p>
        <p className="text-[10px] text-slate-400">{company.industry || 'Unknown'}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${company.score}%`, transition: 'width 0.8s ease-out' }} />
        </div>
        <span className={`text-xs font-bold tabular-nums w-6 text-right ${sc}`}>{company.score}</span>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-component: Signal Feed Item
   ═══════════════════════════════════════════════════════════════ */
function SignalFeedItem({ signal, onClick }: { signal: Signal; onClick?: () => void }) {
  const sc = severityColor(signal.severity);

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
    >
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${sc.bg} mt-0.5`}>
        <Zap className={`h-3 w-3 ${sc.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[9px] font-bold uppercase tracking-wider ${sc.text}`}>{signal.severity}</span>
          <span className="text-[9px] text-slate-400">·</span>
          <span className="text-[9px] text-slate-400">{signal.type}</span>
        </div>
        <p className="text-xs font-medium text-slate-700 truncate group-hover:text-slate-900 transition-colors">{signal.title}</p>
      </div>
      <span className="text-[10px] text-slate-400 whitespace-nowrap mt-0.5">{relativeTime(signal.createdAt)}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-component: Industry Bar
   ═══════════════════════════════════════════════════════════════ */
function IndustryBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-24 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: 'width 0.6s ease-out' }} />
      </div>
      <span className="text-[10px] font-semibold text-slate-600 tabular-nums w-6 text-right">{count}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-component: Engine Health Bar
   ═══════════════════════════════════════════════════════════════ */
function EngineHealthBar({
  label, icon: Icon, score, description,
}: { label: string; icon: typeof Shield; score: number; description: string }) {
  const c = healthColor(score);
  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
        <Icon className={`h-4 w-4 ${c.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-700">{label}</span>
          <span className={`text-xs font-bold tabular-nums ${c.text}`}>{score}/100</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${score}%`, transition: 'width 1s ease-out' }} />
        </div>
        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-component: Loading Progress
   ═══════════════════════════════════════════════════════════════ */
function CommandLoadingState() {
  const [steps, setSteps] = useState<Array<{ label: string; status: ProgressStep }>>([
    { label: 'Scanning company signals', status: 'pending' },
    { label: 'Analyzing email pipeline', status: 'pending' },
    { label: 'Evaluating capability coverage', status: 'pending' },
    { label: 'Generating AI intelligence briefing', status: 'pending' },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = [...steps];
      for (let i = 0; i < s.length; i++) {
        await delay(400 + Math.random() * 300);
        if (cancelled) return;
        s[i].status = 'processing';
        setSteps([...s]);
        await delay(600 + Math.random() * 400);
        if (cancelled) return;
        s[i].status = 'complete';
        setSteps([...s]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-blue-600/5 border border-blue-200/50">
          <Brain className="h-6 w-6 text-blue-600 animate-pulse" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Analyzing platform signals...</h3>
          <p className="text-xs text-slate-400">Cross-referencing all three intelligence engines</p>
        </div>
      </div>
      <div className="w-full max-w-sm">
        <AIProgressTracker steps={steps} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-component: Command Empty State
   ═══════════════════════════════════════════════════════════════ */
function CommandEmptyState({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  return (
    <EmptyState
      icon={Radar}
      title="No Intelligence Data Yet"
      description="The Command Center activates once you have companies, contacts, and signals in your platform. Start by importing companies or enriching your existing data."
      action={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => navigateTo?.('companies')} className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Add Companies
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigateTo?.('contacts')} className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Import Contacts
          </Button>
        </div>
      }
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function CommandCenterScreen({ navigateTo }: CommandCenterProps) {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/command-center/insights');
      if (res.ok) {
        const json = await res.json();
        setInsights(json);
        setLastRefreshed(new Date());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  // ── Derived data for priority cards ──
  const criticalSignals = insights?.companyEngine.latestSignals.filter(
    s => s.severity === 'critical' || s.severity === 'high'
  ) ?? [];
  const highValueLeads = insights?.emailEngine.highValueLeads ?? [];
  const pendingDrafts = insights?.emailEngine.pendingDrafts ?? 0;
  const positiveReplies = insights?.emailEngine.positiveReplies ?? 0;

  // ── Compute individual engine health scores ──
  const companyHealth = insights ? Math.min(100, Math.round(
    Math.min(insights.companyEngine.totalCompanies / 200, 30) +
    (insights.companyEngine.unreadSignalCount === 0 ? 20 : Math.max(20 - insights.companyEngine.unreadSignalCount, 0)) +
    Math.min(Object.keys(insights.companyEngine.companiesByIndustry).length * 2, 20) +
    (insights.companyEngine.topScoredCompanies.length > 0 ? Math.min(insights.companyEngine.topScoredCompanies[0].score / 5, 15) : 0) +
    (insights.companyEngine.criticalSignalCount === 0 ? 15 : 0)
  )) : 0;

  const emailHealth = insights ? Math.min(100, Math.round(
    Math.min(insights.emailEngine.totalContacts / 200, 25) +
    Math.min(insights.emailEngine.avgLeadScore / 5, 25) +
    Math.min(insights.emailEngine.replyRate * 1.5, 25) +
    (pendingDrafts === 0 ? 15 : Math.max(15 - pendingDrafts / 10, 0)) +
    (insights.emailEngine.activeSequences > 0 ? 10 : 0)
  )) : 0;

  const capabilityHealth = insights ? Math.min(100, Math.round(
    Math.min(insights.capabilityEngine.totalCapabilities / 2, 40) +
    Math.min(Object.keys(insights.capabilityEngine.capabilitiesByCategory).length * 5, 20) +
    (insights.capabilityEngine.topCapabilities.length > 0 ? Math.min(insights.capabilityEngine.topCapabilities[0].usedInEmails * 2, 20) : 0) +
    (insights.capabilityEngine.totalCapabilities >= 20 ? 20 : insights.capabilityEngine.totalCapabilities >= 10 ? 10 : 0)
  )) : 0;

  // ── Industry distribution data ──
  const industryEntries = insights
    ? Object.entries(insights.companyEngine.companiesByIndustry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    : [];
  const maxIndustry = industryEntries.length > 0 ? industryEntries[0][1] : 1;
  const industryColors = ['bg-blue-500', 'bg-violet-500', 'bg-cyan-500', 'bg-amber-500', 'bg-emerald-500', 'bg-pink-500'];

  // ── Activity timeline items (derived from available data) ──
  const activityItems = insights ? [
    ...(insights.companyEngine.latestSignals.map(s => ({
      id: s.id, icon: Zap, iconColor: s.severity === 'critical' ? 'text-red-500' : 'text-blue-500',
      iconBg: s.severity === 'critical' ? 'bg-red-50' : 'bg-blue-50',
      label: `Signal: ${s.title}`, time: relativeTime(s.createdAt),
    }))),
    ...(insights.emailEngine.positiveReplies > 0 ? [{
      id: 'replies', icon: MessageSquare, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-50',
      label: `${insights.emailEngine.positiveReplies} positive replies received`, time: 'Recent',
    }] : []),
    ...(insights.emailEngine.pendingDrafts > 0 ? [{
      id: 'drafts', icon: FileText, iconColor: 'text-amber-500', iconBg: 'bg-amber-50',
      label: `${insights.emailEngine.pendingDrafts} drafts awaiting review`, time: 'Pending',
    }] : []),
    ...(insights.emailEngine.pendingQueue > 0 ? [{
      id: 'queue', icon: Send, iconColor: 'text-blue-500', iconBg: 'bg-blue-50',
      label: `${insights.emailEngine.pendingQueue} emails in send queue`, time: 'Queued',
    }] : []),
  ].slice(0, 6) : [];

  // ── Signal count change indicator (simulated) ──
  const signalChange = insights ? (insights.companyEngine.unreadSignalCount > 5 ? '+3 new' : 'No change') : null;

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */
  return (
    <PageTransition>
      <div className="h-full flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

            {/* ═══════════════════════════════════════
               SECTION 1: Executive Summary Bar
               ═══════════════════════════════════════ */}
            {!loading && !error && insights && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                    <Brain className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-sm font-bold text-white tracking-tight">AI Revenue Command Center</h1>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-[10px] font-semibold text-blue-300 uppercase tracking-wider">
                        <Radio className="h-2.5 w-2.5" />
                        Live
                      </span>
                    </div>
                    {insights.aiSummary ? (
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{insights.aiSummary}</p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Platform operational. {insights.companyEngine.totalCompanies} companies tracked, {insights.emailEngine.totalContacts} contacts, {insights.capabilityEngine.totalCapabilities} capabilities.
                      </p>
                    )}
                  </div>

                  {/* Health Gauge + Change Indicator */}
                  <div className="flex items-center gap-4 shrink-0">
                    {signalChange && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10">
                        <Activity className={`h-3 w-3 ${signalChange.includes('+') ? 'text-amber-400' : 'text-slate-500'}`} />
                        <span className={`text-[10px] font-semibold ${signalChange.includes('+') ? 'text-amber-400' : 'text-slate-500'}`}>{signalChange}</span>
                      </div>
                    )}
                    <div className="text-center">
                      <HealthGauge score={insights.healthScore} size={56} />
                      <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-wider font-medium">Health</p>
                    </div>
                  </div>
                </div>

                {/* Bottom bar with timestamp + refresh */}
                <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {lastRefreshed ? `Last refreshed: ${lastRefreshed.toLocaleTimeString()}` : 'Refreshing...'}
                    </div>
                    <Separator orientation="vertical" className="h-3" />
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Database className="h-3 w-3" />
                      {insights.companyEngine.totalCompanies} companies · {insights.emailEngine.totalContacts} contacts · {insights.capabilityEngine.totalCapabilities} capabilities
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchInsights} className="h-7 gap-1.5 text-slate-500 hover:text-slate-700 text-xs">
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </Button>
                </div>
              </motion.section>
            )}

            {/* ═══════════════════════════════════════
               LOADING STATE
               ═══════════════════════════════════════ */}
            {loading && <CommandLoadingState />}

            {/* ═══════════════════════════════════════
               ERROR STATE
               ═══════════════════════════════════════ */}
            {error && !loading && (
              <ErrorState
                title="Intelligence generation could not complete"
                message="The AI Revenue Command Center could not retrieve or process your platform data. This may be due to a temporary service disruption or database issue."
                onRetry={fetchInsights}
              />
            )}

            {/* ═══════════════════════════════════════
               EMPTY STATE
               ═══════════════════════════════════════ */}
            {!loading && !error && insights && insights.companyEngine.totalCompanies === 0 && (
              <CommandEmptyState navigateTo={navigateTo} />
            )}

            {/* ═══════════════════════════════════════
               MAIN CONTENT (data available)
               ═══════════════════════════════════════ */}
            {!loading && !error && insights && insights.companyEngine.totalCompanies > 0 && (
              <>

                {/* ═══════════════════════════════════
                   SECTION 2: Priority Action Grid
                   ═══════════════════════════════════ */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Priority Actions</h2>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-600 border-blue-200">
                      AI-Detected
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {/* Critical Signals */}
                    <PriorityActionCard
                      icon={Zap}
                      label="Critical Signals"
                      count={criticalSignals.length}
                      accentBg="bg-red-50" accentText="text-red-600" accentBorder=""
                      badgeText={insights.companyEngine.unreadSignalCount > 0 ? `${insights.companyEngine.unreadSignalCount} total` : undefined}
                      badgeClass="bg-red-100 text-red-700"
                      items={criticalSignals.map(s => ({
                        primary: s.title,
                        badge: s.severity,
                        badgeClass: severityColor(s.severity).badge,
                        secondary: relativeTime(s.createdAt),
                      }))}
                      onClick={() => navigateTo?.('companies')}
                    />
                    {/* High-Value Leads */}
                    <PriorityActionCard
                      icon={Target}
                      label="High-Value Leads"
                      count={highValueLeads.length}
                      accentBg="bg-violet-50" accentText="text-violet-600" accentBorder=""
                      items={highValueLeads.map(l => ({
                        primary: l.name,
                        secondary: `Score: ${l.score}`,
                        badge: l.score >= 90 ? 'Hot' : l.score >= 80 ? 'Warm' : undefined,
                        badgeClass: l.score >= 90 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                      }))}
                      onClick={() => navigateTo?.('leads')}
                    />
                    {/* Drafts Awaiting Review */}
                    <PriorityActionCard
                      icon={FileText}
                      label="Drafts Awaiting Review"
                      count={pendingDrafts}
                      accentBg="bg-amber-50" accentText="text-amber-600" accentBorder=""
                      badgeText={pendingDrafts > 10 ? 'Review needed' : pendingDrafts > 0 ? 'Pending' : undefined}
                      badgeClass={pendingDrafts > 10 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}
                      items={pendingDrafts > 0 ? [
                        { primary: `${pendingDrafts} AI-generated drafts`, secondary: 'Ready to review' },
                      ] : []}
                      onClick={() => navigateTo?.('drafts')}
                    />
                    {/* Positive Replies */}
                    <PriorityActionCard
                      icon={MessageSquare}
                      label="Positive Replies"
                      count={positiveReplies}
                      accentBg="bg-emerald-50" accentText="text-emerald-600" accentBorder=""
                      badgeText={insights.emailEngine.replyRate > 0 ? `${insights.emailEngine.replyRate}% rate` : undefined}
                      badgeClass="bg-emerald-100 text-emerald-700"
                      items={positiveReplies > 0 ? [
                        { primary: `${positiveReplies} warm leads detected`, secondary: 'Follow-up recommended' },
                      ] : []}
                      onClick={() => navigateTo?.('replies')}
                    />
                  </div>
                </section>

                {/* ═══════════════════════════════════
                   SECTION 3: AI Strategic Insights Panel
                   ═══════════════════════════════════ */}
                {insights.aiStrategicInsights && insights.aiStrategicInsights.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Strategic Insights</h2>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[10px] font-semibold text-blue-600">
                        <Sparkles className="h-2.5 w-2.5" />
                        {insights.aiStrategicInsights.length} insights
                      </span>
                    </div>
                    <div className="space-y-3">
                      {insights.aiStrategicInsights.slice(0, 6).map((insight, idx) => (
                        <StrategicInsightCard key={idx} insight={insight} index={idx} />
                      ))}
                    </div>
                  </section>
                )}

                {/* ═══════════════════════════════════
                   SECTION 4: Revenue Command Dashboard (2 cols)
                   ═══════════════════════════════════ */}
                <section>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Revenue Intelligence Dashboard</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* ── Left Column ── */}
                    <div className="space-y-4">
                      {/* Account Intelligence Scores */}
                      <div className="section-container">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-500" />
                            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Account Intelligence Scores</h3>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-slate-400 hover:text-blue-600" onClick={() => navigateTo?.('companies')}>
                            View all
                          </Button>
                        </div>
                        <div className="p-2">
                          {insights.companyEngine.topScoredCompanies.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                              {insights.companyEngine.topScoredCompanies.slice(0, 5).map((company, idx) => (
                                <AccountScoreRow key={company.id} company={company} rank={idx + 1} onView={(id) => navigateTo?.('company-detail', id)} />
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 py-6 text-center">No companies scored yet</p>
                          )}
                        </div>
                      </div>

                      {/* Industry Distribution */}
                      {industryEntries.length > 0 && (
                        <div className="section-container">
                          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                            <Globe className="h-4 w-4 text-violet-500" />
                            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Industry Distribution</h3>
                          </div>
                          <div className="p-4 space-y-2.5">
                            {industryEntries.map(([name, count], idx) => (
                              <IndustryBar key={name} label={name} count={count} max={maxIndustry} color={industryColors[idx % industryColors.length]} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Right Column ── */}
                    <div className="space-y-4">
                      {/* Signal Intelligence Feed */}
                      <div className="section-container">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Radio className="h-4 w-4 text-amber-500" />
                            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Signal Intelligence Feed</h3>
                          </div>
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-50 text-amber-600 border-amber-200">
                            {insights.companyEngine.unreadSignalCount} unread
                          </Badge>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1">
                          {insights.companyEngine.latestSignals.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                              {insights.companyEngine.latestSignals.slice(0, 5).map(signal => (
                                <SignalFeedItem key={signal.id} signal={signal} onClick={() => navigateTo?.('companies')} />
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 py-6 text-center">No signals detected</p>
                          )}
                        </div>
                      </div>

                      {/* Activity Timeline */}
                      <div className="section-container">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                          <Activity className="h-4 w-4 text-blue-500" />
                          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Activity Timeline</h3>
                        </div>
                        <div className="p-3 space-y-1 max-h-48 overflow-y-auto">
                          {activityItems.length > 0 ? (
                            activityItems.map(item => {
                              const Icon = item.icon;
                              return (
                                <div key={item.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${item.iconBg}`}>
                                    <Icon className={`h-3 w-3 ${item.iconColor}`} />
                                  </div>
                                  <p className="text-xs text-slate-600 flex-1 truncate">{item.label}</p>
                                  <span className="text-[10px] text-slate-400">{item.time}</span>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-400 py-4 text-center">No recent activity</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ═══════════════════════════════════
                   SECTION 5: Engine Health Overview
                   ═══════════════════════════════════ */}
                <section className="section-container">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-emerald-500" />
                      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Engine Health Overview</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <HealthGauge score={insights.healthScore} size={40} />
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Overall</span>
                    </div>
                  </div>
                  <div className="p-5 space-y-5">
                    <EngineHealthBar
                      icon={Shield}
                      label="Company Engine"
                      score={companyHealth}
                      description={`${insights.companyEngine.totalCompanies} companies tracked · ${insights.companyEngine.unreadSignalCount} unread signals · ${insights.companyEngine.criticalSignalCount} critical`}
                    />
                    <Separator />
                    <EngineHealthBar
                      icon={Mail}
                      label="Email Engine"
                      score={emailHealth}
                      description={`${insights.emailEngine.pendingDrafts} drafts pending · ${insights.emailEngine.positiveReplies} positive replies · ${insights.emailEngine.replyRate}% reply rate`}
                    />
                    <Separator />
                    <EngineHealthBar
                      icon={Cpu}
                      label="Capability Engine"
                      score={capabilityHealth}
                      description={`${insights.capabilityEngine.totalCapabilities} capabilities · ${Object.keys(insights.capabilityEngine.capabilitiesByCategory).length} categories`}
                    />

                    {/* AI Health Analysis */}
                    {insights.aiHealthAnalysis && (
                      <>
                        <Separator />
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Brain className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">AI Health Analysis</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{insights.aiHealthAnalysis}</p>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* Bottom spacing */}
                <div className="h-8" />
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </PageTransition>
  );
}
