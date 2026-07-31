'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
// recharts removed — engagement chart replaced with real aggregate stat panel (Phase 0.4)
import {
  Building2, Users, FileText, Send, Mail, TrendingUp, TrendingDown,
  ChevronRight, Zap, UserPlus, Eye, MessageSquare, AlertTriangle,
  Sparkles, Brain, RefreshCw, Layers,
  Upload, GitBranch, MailPlus, Radar, Activity, Shield,
} from 'lucide-react';
import { useAppStore, type ViewId } from '@/lib/store';

/* ═══════════════════════════════════════════════════
   Design Tokens
   ═══════════════════════════════════════════════════ */
const gold = 'var(--color-gold-dim)', goldLight = 'var(--color-gold)';
const card = 'rgba(255, 255, 255, 0.85)', border = 'rgba(0, 0, 0, 0.08)';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface DashboardData {
  contactsByStatus: Record<string, number>;
  totalCompanies: number;
  draftsPendingReview: number;
  queuePending: number;
  repliesThisWeek: number;
  bouncesCount?: number;
  emailHealthDistribution?: Record<string, number>;
}

interface AuditEntry {
  id: string; action: string; entity: string;
  entityId?: string; details?: string; createdAt: string;
}

interface TopCompany {
  id: string; name: string; industry: string | null;
  country: string | null; contactCount: number; domain: string | null;
}

interface Segment { id: string; name: string; _count: { contacts: number } }

/** Raw company shape returned by /api/companies */
interface RawCompany {
  id: string;
  name?: string;
  rawName?: string;
  normalizedName?: string;
  industry?: string | null;
  country?: string | null;
  contactCount?: number;
  _count?: { contacts?: number };
  domain?: string | null;
}

/** Raw segment shape returned by /api/segments */
interface RawSegment {
  id: string;
  name: string;
  _count?: { contacts: number };
}

/** AI briefing shape returned by /api/ai/insights */
interface AIBriefing {
  summary?: string;
  keyInsights?: Array<{ title: string; description: string }>;
  predictions?: Array<{ trend: string; metric: string; current: string; predicted: string }>;
}

/* ═══════════════════════════════════════════════════
   Activity Config
   ═══════════════════════════════════════════════════ */
const ACT_CFG: Record<string, { icon: typeof Zap; color: string; bg: string; label: string }> = {
  lead_imported:    { icon: UserPlus,      color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  label: 'Lead Imported' },
  draft_generated:  { icon: Sparkles,      color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  label: 'Draft Generated' },
  email_sent:       { icon: Send,          color: '#10B981', bg: 'rgba(16,185,129,0.12)',  label: 'Email Sent' },
  email_opened:     { icon: Eye,           color: '#A855F7', bg: 'rgba(168,85,247,0.12)', label: 'Email Opened' },
  reply_received:   { icon: MessageSquare, color: gold,     bg: 'rgba(212,175,55,0.12)',   label: 'Reply Received' },
  bounce_detected:  { icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   label: 'Bounce Detected' },
};

function getActCfg(action: string) {
  for (const [k, c] of Object.entries(ACT_CFG)) if (action.toLowerCase().includes(k)) return c;
  return { icon: Zap, color: '#71717A', bg: 'rgba(113,113,122,0.12)', label: action.replace(/_/g, ' ') };
}

function fmtTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`;
}

function fmtDetails(action: string, details?: string) {
  if (details) return details;
  const m: Record<string, string> = {
    lead_imported: 'New leads imported', draft_generated: 'AI draft created',
    email_sent: 'Email delivered', email_opened: 'Recipient opened email',
    reply_received: 'Response received', bounce_detected: 'Bounce recorded',
  };
  for (const [k, v] of Object.entries(m)) if (action.toLowerCase().includes(k)) return v;
  return action.replace(/_/g, ' ');
}

/* ═══════════════════════════════════════════════════
   Animated Counter
   ═══════════════════════════════════════════════════ */
function useCounter(target: number, dur = 1200) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, dur]);
  return v;
}

/* ═══════════════════════════════════════════════════
   Stat Card
   ═══════════════════════════════════════════════════ */
function StatCard({ icon: Icon, label, value, suffix, trend, bc, delay }: {
  icon: typeof Building2; label: string; value: number | string; suffix?: string;
  trend?: { value: number; up: boolean }; bc: string; delay: number;
}) {
  const num = typeof value === 'number' ? value : 0;
  const anim = useCounter(num);
  const display = typeof value === 'number' ? anim.toLocaleString() : value;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-xl overflow-hidden group cursor-default"
      style={{ background: card, backdropFilter: 'blur(20px)', border: `1px solid ${border}`, borderLeft: `3px solid ${bc}` }}>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${bc}18` }}>
            <Icon className="w-4 h-4" style={{ color: bc }} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums text-foreground">{display}{suffix || ''}</span>
          {trend && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend.up ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{trend.value}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ChartTip removed — no longer used after Phase 0.4 fake data cleanup

/* ═══════════════════════════════════════════════════
   Quick Action Card
   ═══════════════════════════════════════════════════ */
function QuickAction({ icon: Icon, label, color, onClick, delay }: {
  icon: typeof Upload; label: string; color: string; onClick: () => void; delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-shadow hover:shadow-md"
      style={{ background: card, border: `1px solid ${border}` }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}14` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
    </motion.button>
  );
}

const glassPanel = { background: card, backdropFilter: 'blur(20px)', border: `1px solid ${border}` };

/* ═══════════════════════════════════════════════════
   Dashboard Screen
   ═══════════════════════════════════════════════════ */
export default function DashboardScreen({ navigateTo }: { navigateTo?: (screen: string, companyId?: string) => void }) {
  const nav = navigateTo || ((screen: string) => useAppStore.getState().setActiveView(screen as ViewId));

  /* ── Data queries ── */
  const { data: dashData, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then(r => r.json()),
    staleTime: 30000,
  });

  const { data: activity = [] } = useQuery<AuditEntry[]>({
    queryKey: ['dashboard-activity'],
    queryFn: () => fetch('/api/audit?limit=8').then(r => r.json()),
    staleTime: 30000,
  });

  const { data: rawCompanies } = useQuery<{ companies?: RawCompany[]; data?: RawCompany[] } | undefined>({
    queryKey: ['dashboard-companies'],
    queryFn: () => fetch('/api/companies?limit=8&sortBy=contacts&sortDir=desc').then(r => r.json()),
    staleTime: 60000,
  });

  const { data: rawSegments } = useQuery<RawSegment[] | { data: RawSegment[] } | undefined>({
    queryKey: ['dashboard-segments'],
    queryFn: () => fetch('/api/segments?limit=6').then(r => r.json()),
    staleTime: 60000,
  });

  const { data: aiBriefing, isLoading: briefingLoading, isError: briefingError, refetch: refetchBriefing } = useQuery<AIBriefing>({
    queryKey: ['dashboard-briefing'],
    queryFn: () => fetch('/api/ai/insights').then(r => r.json()).then(d => d?.data || d),
    staleTime: 120000,
    retry: false,
  });

  /* ── Derived data ── */
  const topCompanies: TopCompany[] = useMemo(() => {
    const list = rawCompanies?.companies || rawCompanies?.data || [];
    return list.slice(0, 8).map((c: RawCompany) => ({
      id: c.id, name: c.rawName || c.normalizedName || c.name || '',
      industry: c.industry ?? null, country: c.country ?? null,
      contactCount: c.contactCount || c._count?.contacts || 0, domain: c.domain ?? null,
    }));
  }, [rawCompanies]);

  const segments: Segment[] = useMemo(() => {
    const list = Array.isArray(rawSegments) ? rawSegments : rawSegments?.data || [];
    return list.slice(0, 6).map((s: RawSegment) => ({
      id: s.id, name: s.name, _count: s._count || { contacts: 0 },
    }));
  }, [rawSegments]);

  const totalLeads = Object.values(dashData?.contactsByStatus || {}).reduce((a: number, b: number) => a + b, 0);
  const replied = dashData?.repliesThisWeek || 0;
  const sent = dashData?.contactsByStatus?.sent || 0;
  const queued = dashData?.queuePending || 0;
  const drafts = dashData?.draftsPendingReview || 0;
  const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : '0.0';

  const funnelStages = [
    { label: 'Imported', count: totalLeads },
    { label: 'Drafted', count: drafts + (dashData?.contactsByStatus?.drafted || 0) },
    { label: 'Queued', count: queued + (dashData?.contactsByStatus?.queued || 0) },
    { label: 'Sent', count: dashData?.contactsByStatus?.sent || 0 },
    { label: 'Replied', count: replied },
  ];
  const funnelMax = Math.max(funnelStages[0].count, 1);

  // Engagement snapshot — REAL totals only, no fabricated daily breakdowns.
  // Per-day email event tracking is not yet wired up; until it is, we show
  // the honest aggregate count (sent / replied / bounced) instead of
  // multiplying by fake coefficients.
  const repliedCount = dashData?.contactsByStatus?.replied || 0;
  const bouncedCount = dashData?.contactsByStatus?.bounced || 0;
  const engagementSummary = {
    sent,
    replied: repliedCount,
    bounced: bouncedCount,
    openRate: sent > 0 ? ((repliedCount / sent) * 100).toFixed(1) : '0.0',
  };

  const maxContacts = topCompanies.length > 0 ? Math.max(...topCompanies.map(c => c.contactCount)) : 1;
  const maxSegContacts = segments.length > 0 ? Math.max(...segments.map(s => s._count?.contacts || 0)) : 1;

  /* ── Loading skeleton ── */
  if (isLoading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Skeleton className="h-72 rounded-xl lg:col-span-3" />
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );

  if (!dashData?.contactsByStatus) return (
    <div className="text-muted-foreground text-sm p-6">Failed to load dashboard data.</div>
  );

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-5 pr-1">

      {/* ═══════ 0. AI BRIEFING ═══════ */}
      {briefingLoading ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl overflow-hidden" style={{ ...glassPanel, border: '1px solid rgba(212,175,55,0.3)' }}>
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.12)' }}>
              <Brain className="w-4 h-4 animate-pulse" style={{ color: gold }} />
            </div>
            <span className="text-sm text-muted-foreground">Analyzing your pipeline intelligence<span className="inline-flex gap-0.5 ml-1"><span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span><span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span><span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span></span></span>
          </div>
        </motion.div>
      ) : briefingError || !aiBriefing?.summary ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl overflow-hidden" style={glassPanel}>
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100">
              <Brain className="w-4 h-4 text-muted-foreground/40" />
            </div>
            <span className="text-sm text-muted-foreground">AI briefing unavailable</span>
            <button onClick={() => refetchBriefing()} className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: gold }}>
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-xl overflow-hidden" style={{ ...glassPanel, borderLeft: '3px solid #D4AF37', boxShadow: '0 0 24px rgba(212,175,55,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.12)' }}>
                  <Brain className="w-4 h-4" style={{ color: gold }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight">Daily AI Briefing</h2>
                  <p className="text-[11px] text-muted-foreground">Today, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide" style={{ background: 'rgba(212,175,55,0.1)', color: gold }}>
                <Brain className="w-2.5 h-2.5" /> AI
              </div>
            </div>
            <p className="text-[13px] text-foreground/85 leading-relaxed">{aiBriefing.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
              {(aiBriefing.keyInsights?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Key Insights</p>
                  {aiBriefing.keyInsights!.slice(0, 3).map((ins, i: number) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: gold }} />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground">{ins.title}</span>
                        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{ins.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(aiBriefing.predictions?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Predictions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiBriefing.predictions!.slice(0, 3).map((p, i: number) => {
                      const arrow = p.trend === 'up' ? '\u2191' : p.trend === 'down' ? '\u2193' : '\u2192';
                      const tc = p.trend === 'up' ? '#10B981' : p.trend === 'down' ? '#EF4444' : '#71717A';
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.05)' }}>
                          <span style={{ color: tc, fontWeight: 700, fontSize: 12 }}>{arrow}</span>
                          <span className="text-[11px] font-medium text-foreground">{p.metric}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{p.current}\u2192{p.predicted}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════ 1. KPI CARDS ═══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Building2} label="Total Companies" value={dashData.totalCompanies || 0} bc="var(--color-gold)" delay={0} />
        <StatCard icon={Users} label="Active Contacts" value={totalLeads} bc="#3B82F6" delay={0.06} />
        <StatCard icon={FileText} label="Pending Drafts" value={drafts} bc="#F59E0B" delay={0.12} />
        <StatCard icon={Send} label="In Queue" value={queued} bc="#10B981" delay={0.18} />
        <StatCard icon={Mail} label="Reply Rate" value={replyRate} suffix="%" bc="#A855F7" delay={0.24} />
      </div>

      {/* ═══════ 2. QUICK ACTIONS ═══════ */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <QuickAction icon={Upload} label="Import Data" color="#3B82F6" onClick={() => nav('import')} delay={0.3} />
        <QuickAction icon={GitBranch} label="New Sequence" color="#8B5CF6" onClick={() => nav('sequences')} delay={0.34} />
        <QuickAction icon={MailPlus} label="Email Studio" color="#10B981" onClick={() => nav('email-studio')} delay={0.38} />
        <QuickAction icon={Radar} label="AI Research" color={gold} onClick={() => nav('signal-intelligence')} delay={0.42} />
        <QuickAction icon={Activity} label="Pipeline" color="#F59E0B" onClick={() => nav('pipeline')} delay={0.46} />
        <QuickAction icon={Shield} label="AI Health" color="#EF4444" onClick={() => nav('ai-health')} delay={0.50} />
      </div>

      {/* ═══════ 3. PIPELINE FUNNEL ═══════ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
        className="rounded-xl overflow-hidden" style={glassPanel}>
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight">Pipeline Funnel</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lead conversion across outreach stages</p>
          </div>
          <span className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ background: 'rgba(212,175,55,0.1)', color: gold }}>
            {totalLeads > 0 ? ((funnelStages[4].count / funnelStages[0].count) * 100).toFixed(2) : 0}% conversion
          </span>
        </div>
        <div className="px-5 pb-5 pt-1 flex flex-col gap-2">
          {funnelStages.map((s, i) => {
            const w = Math.max((s.count / funnelMax) * 100, 4);
            return (
              <motion.div key={s.label} className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}>
                <span className="text-[11px] text-muted-foreground font-medium w-[70px] shrink-0 text-right">{s.label}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-8 rounded-md overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
                    <motion.div className="h-full rounded-md flex items-center px-3"
                      style={{ background: `linear-gradient(90deg, rgba(212,175,55,${0.9 - i * 0.15}), rgba(232,200,96,${0.7 - i * 0.12}))` }}
                      initial={{ width: 0 }} animate={{ width: `${w}%` }}
                      transition={{ duration: 1, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}>
                      <span className="text-xs font-bold text-black/80 tabular-nums whitespace-nowrap">{s.count.toLocaleString()}</span>
                    </motion.div>
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums w-12 text-right" style={{ color: goldLight }}>
                    {((s.count / funnelMax) * 100).toFixed(1)}%
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ═══════ 4. ENGAGEMENT SNAPSHOT (60%) + TOP COMPANIES (40%) ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <motion.div className="lg:col-span-3 rounded-xl overflow-hidden" style={glassPanel}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
          <div className="px-5 pt-5 pb-1 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Engagement Overview</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">7-day opens, clicks & replies</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-800" />Opens</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: gold }} />Clicks</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />Replies</span>
            </div>
          </div>
          <div className="px-5 pb-5 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sent</p>
              <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{engagementSummary.sent}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Replied</p>
              <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: '#10B981' }}>{engagementSummary.replied}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bounced</p>
              <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: '#EF4444' }}>{engagementSummary.bounced}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reply Rate</p>
              <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: gold }}>{engagementSummary.openRate}%</p>
            </div>
          </div>
        </motion.div>

        {/* Top Companies */}
        <motion.div className="lg:col-span-2 rounded-xl overflow-hidden flex flex-col" style={glassPanel}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.38 }}>
          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Top Companies</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">By contact count</p>
            </div>
            <motion.button className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: gold }}
              whileHover={{ x: 2 }} onClick={() => nav('companies')}>View All <ChevronRight className="w-3 h-3" /></motion.button>
          </div>
          <div className="flex-1 px-5 pb-4 max-h-80 overflow-y-auto custom-scrollbar">
            {topCompanies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <Brain className="w-6 h-6" style={{ color: gold }} />
                </motion.div>
                <p className="text-sm font-medium text-foreground">No companies yet</p>
                <p className="text-xs text-muted-foreground mt-1">Import companies to see your top accounts</p>
              </div>
            ) : (
              <div className="space-y-1">
                {topCompanies.map((co, i) => (
                  <motion.button key={co.id} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100/50 transition-colors text-left group"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.4 + i * 0.05 }}
                    onClick={() => { useAppStore.getState().setSelectedCompanyId(co.id); navigateTo?.('company-detail', co.id); }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: 'rgba(212,175,55,0.1)', color: gold }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-foreground transition-colors">{co.name}</p>
                      <p className="text-[11px] text-muted-foreground">{co.industry || 'Unknown'}{co.country ? ` \u00B7 ${co.country}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.05)' }}>
                        <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${gold}CC, ${goldLight})` }}
                          initial={{ width: 0 }} animate={{ width: `${(co.contactCount / maxContacts) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.5 + i * 0.05 }} />
                      </div>
                      <span className="text-[11px] font-bold tabular-nums text-foreground w-8 text-right">{co.contactCount}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ═══════ 5. ACTIVITY + SEGMENTS ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Timeline */}
        <motion.div className="rounded-xl overflow-hidden" style={glassPanel}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.45 }}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="text-sm font-bold text-foreground tracking-tight">Recent Activity</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Latest pipeline actions</p>
          </div>
          <div className="px-5 pb-5">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <Brain className="w-6 h-6" style={{ color: gold }} />
                </motion.div>
                <p className="text-sm font-medium text-foreground">No activity recorded</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Start engaging with your contacts to see activity here</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[13px] top-3 bottom-3 w-px bg-gray-100" />
                <div className="space-y-0.5">
                  {activity.slice(0, 8).map((e, i) => {
                    const cfg = getActCfg(e.action); const Icon = cfg.icon;
                    return (
                      <motion.div key={e.id} className="relative flex gap-3 px-1 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.5 + i * 0.05 }}>
                        <div className="relative z-10 w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                          <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
                            <span className="text-[11px] text-muted-foreground/50">{fmtTime(e.createdAt)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{fmtDetails(e.action, e.details)}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Segments */}
        <motion.div className="rounded-xl overflow-hidden" style={glassPanel}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.52 }}>
          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Quick Segments</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Top contact segments</p>
            </div>
            <motion.button className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: gold }}
              whileHover={{ x: 2 }} onClick={() => nav('segments')}>View All <ChevronRight className="w-3 h-3" /></motion.button>
          </div>
          <div className="px-5 pb-5 space-y-3 pt-2">
            {segments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100/50 flex items-center justify-center mb-3"><Layers className="w-6 h-6 text-muted-foreground/40" /></div>
                <p className="text-sm text-muted-foreground">Loading segments...</p>
              </div>
            ) : (
              segments.map((seg, i) => (
                <motion.div key={seg.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.55 + i * 0.06 }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{seg.name}</span>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: gold }}>{(seg._count?.contacts || 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.04)' }}>
                    <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.8), rgba(232,200,96,0.6))' }}
                      initial={{ width: 0 }} animate={{ width: `${((seg._count?.contacts || 0) / maxSegContacts) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.6 + i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
