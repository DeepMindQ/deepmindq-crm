'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AnimatedCard, StaggerGrid, StaggerItem, SectionHeader,
  PulseDot, StatCard,
} from '@/components/ui/animated-components';
import {
  Users, Building2, FilePenLine, Clock, Mail, MailCheck,
  ShieldX, ShieldAlert, ShieldCheck, ArrowRight,
  Sparkles, Upload, BarChart3, Send, RefreshCw, Loader2,
  Zap, Inbox, UserPlus, Eye, MessageSquare, AlertTriangle,
  ChevronRight, Flame, Target, Info, X, ChevronDown,
  Activity, Radio, UserX, MailWarning, TrendingUp, Ban, ThumbsUp,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface DashboardData {
  contactsByStatus: Record<string, number>;
  totalCompanies: number;
  recentBatches: { id: string; fileName: string; totalRows: number; acceptedRows: number; status: string; createdAt: string }[];
  draftsPendingReview: number;
  queuePending: number;
  repliesThisWeek: number;
  bouncesCount: number;
  suppressionsCount: number;
  emailHealthDistribution: { valid: number; risky: number; invalid: number; unknown: number };
}

interface HotLead {
  id: string;
  rawName: string;
  title: string;
  company: string;
  _dbFields: {
    leadScore: number;
    status: string;
  };
}

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  createdAt: string;
}

interface Signal {
  id: string;
  type: string;
  title: string;
  description: string;
  contactId?: string;
  contactName?: string;
  companyName?: string;
  severity: 'high' | 'medium' | 'low';
  detectedAt: string;
}

interface SignalsData {
  signals: Signal[];
  summary: Record<string, number>;
  total: number;
  dismissed: number;
}

const SIGNAL_TYPE_CONFIG: Record<string, { icon: typeof Zap; color: string; label: string }> = {
  high_engagement:       { icon: Eye,           color: '#10B981', label: 'High-Engagement' },
  score_spike:           { icon: TrendingUp,    color: '#F59E0B', label: 'Score Spike' },
  stale_lead:            { icon: Clock,         color: '#71717A', label: 'Stale Lead' },
  bounce_risk:           { icon: MailWarning,   color: '#EF4444', label: 'Bounce Risk' },
  unassigned_high_value: { icon: UserX,         color: '#A855F7', label: 'Unassigned' },
  sequence_dropout:      { icon: Ban,           color: '#F97316', label: 'Seq. Dropout' },
  positive_reply:        { icon: ThumbsUp,      color: '#D4AF37', label: 'Positive Reply' },
};

const SEVERITY_CONFIG = {
  high:   { icon: AlertTriangle, color: '#EF4444', border: 'border-l-red-500',   bg: 'bg-red-500/8' },
  medium: { icon: Info,          color: '#F59E0B', border: 'border-l-amber-500', bg: 'bg-amber-500/8' },
  low:    { icon: Eye,           color: '#3B82F6', border: 'border-l-blue-500',  bg: 'bg-blue-500/8' },
} as const;

/* ═══════════════════════════════════════════════════════════════
   Pipeline Funnel Config
   ═══════════════════════════════════════════════════════════════ */
const FUNNEL_STAGES = [
  { key: 'imported', label: 'Imported', icon: Upload, navScreen: 'import', barColor: '#71717A', barBg: 'rgba(113,113,122,0.15)' },
  { key: 'cleaned', label: 'Cleaned', icon: ShieldCheck, navScreen: 'leads', barColor: '#3B82F6', barBg: 'rgba(59,130,246,0.15)' },
  { key: 'drafted', label: 'Drafted', icon: FilePenLine, navScreen: 'drafts', barColor: '#F59E0B', barBg: 'rgba(245,158,11,0.15)' },
  { key: 'queued', label: 'Queued', icon: Clock, navScreen: 'queue', barColor: '#A855F7', barBg: 'rgba(168,85,247,0.15)' },
  { key: 'sent', label: 'Sent', icon: Send, navScreen: 'queue', barColor: '#10B981', barBg: 'rgba(16,185,129,0.15)' },
  { key: 'replied', label: 'Replied', icon: MailCheck, navScreen: 'replies', barColor: '#D4AF37', barBg: 'rgba(212,175,55,0.15)' },
] as const;

/* ═══════════════════════════════════════════════════════════════
   Activity Feed Config
   ═══════════════════════════════════════════════════════════════ */
const ACTIVITY_CONFIG: Record<string, { icon: typeof Zap; color: string; bg: string; label: string }> = {
  lead_imported:    { icon: UserPlus, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Lead Imported' },
  draft_generated:  { icon: FilePenLine, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Draft Generated' },
  email_sent:       { icon: Send, color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Email Sent' },
  email_opened:     { icon: Eye, color: '#A855F7', bg: 'rgba(168,85,247,0.12)', label: 'Email Opened' },
  reply_received:   { icon: MessageSquare, color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', label: 'Reply Received' },
  bounce_detected:  { icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Bounce Detected' },
};

function getActivityConfig(action: string) {
  const lower = action.toLowerCase();
  for (const [key, config] of Object.entries(ACTIVITY_CONFIG)) {
    if (lower.includes(key)) return config;
  }
  return { icon: Zap, color: '#71717A', bg: 'rgba(113,113,122,0.12)', label: action.replace(/_/g, ' ') };
}

function formatTimestamp(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatActivityDetails(action: string, details?: string): string {
  if (details) return details;
  const lower = action.toLowerCase();
  if (lower.includes('lead_imported')) return 'New leads were imported into the system';
  if (lower.includes('draft_generated')) return 'AI-generated email draft was created';
  if (lower.includes('email_sent')) return 'Email was successfully delivered';
  if (lower.includes('email_opened')) return 'Recipient opened the email';
  if (lower.includes('reply_received')) return 'Received a response from the recipient';
  if (lower.includes('bounce_detected')) return 'Email delivery failed — bounce recorded';
  return action.replace(/_/g, ' ');
}

/* ═══════════════════════════════════════════════════════════════
   Score Badge
   ═══════════════════════════════════════════════════════════════ */
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';
  const bg = score >= 70 ? 'rgba(16,185,129,0.12)' : score >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold tabular-nums"
      style={{ color, background: bg }}
    >
      <Flame className="w-3 h-3" />
      {score}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function DashboardScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingAll, setSendingAll] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsSummary, setSignalsSummary] = useState<Record<string, number>>({});
  const [signalsExpanded, setSignalsExpanded] = useState(true);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  /* ── Data Fetching ── */
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      const d = await res.json();
      if (d && typeof d === 'object' && d.contactsByStatus) {
        setData(d);
      } else {
        setData(null);
      }
    } catch {
      // keep loading state
    }
  }, []);

  const fetchHotLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads?sortBy=leadScore&sortDir=desc&limit=5&source=db');
      const d = await res.json();
      if (d.leads) setHotLeads(d.leads.slice(0, 5));
    } catch {
      // no-op
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/audit?limit=10');
      const d = await res.json();
      if (Array.isArray(d)) setActivity(d.slice(0, 10));
    } catch {
      // no-op
    }
  }, []);

  const fetchSignals = useCallback(async () => {
    try {
      setSignalsLoading(true);
      const res = await fetch('/api/signals?limit=8');
      const d: SignalsData = await res.json();
      if (d.signals) {
        setSignals(d.signals);
        setSignalsSummary(d.summary || {});
      }
    } catch {
      // no-op
    } finally {
      setSignalsLoading(false);
    }
  }, []);

  const dismissSignal = useCallback(async (signalId: string) => {
    setDismissingIds(prev => new Set(prev).add(signalId));
    try {
      await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: signalId, action: 'dismiss' }),
      });
      setSignals(prev => prev.filter(s => s.id !== signalId));
      toast.success('Signal dismissed');
    } catch {
      toast.error('Failed to dismiss signal');
    } finally {
      setDismissingIds(prev => {
        const next = new Set(prev);
        next.delete(signalId);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchDashboard(), fetchHotLeads(), fetchActivity(), fetchSignals()]).finally(() => setLoading(false));
  }, [fetchDashboard, fetchHotLeads, fetchActivity, fetchSignals]);

  /* ── Quick Actions ── */
  const handleSendAll = async () => {
    setSendingAll(true);
    try {
      const res = await fetch('/api/email-worker', { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        toast.success(`Worker triggered — ${d.processed ?? 'emails queued'} processed`);
        fetchDashboard();
      } else {
        toast.error(d.error || 'Failed to trigger email worker');
      }
    } catch {
      toast.error('Network error — could not reach email worker');
    } finally {
      setSendingAll(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch('/api/leads/recalculate-scores', { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        toast.success(`Scores recalculated for ${d.updated ?? 0} leads`);
        fetchHotLeads();
      } else {
        toast.error(d.error || 'Failed to recalculate scores');
      }
    } catch {
      toast.error('Network error — could not recalculate');
    } finally {
      setRecalculating(false);
    }
  };

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-44 rounded-xl" />
        <div className="flex gap-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-11 flex-1 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-muted-foreground text-sm p-6">Failed to load dashboard data.</div>;
  }

  /* ── Computed Values ── */
  const totalLeads = Object.values(data.contactsByStatus || {}).reduce((a: number, b: number) => a + b, 0);
  const eh = data?.emailHealthDistribution;
  const healthTotal = eh ? (eh.valid || 0) + (eh.risky || 0) + (eh.invalid || 0) + (eh.unknown || 0) : 0;
  const validPct = healthTotal > 0 ? Math.round(((eh?.valid || 0) / healthTotal) * 100) : 0;

  // Funnel stage counts
  const funnelCounts = FUNNEL_STAGES.map(s => data.contactsByStatus[s.key] || 0);
  const funnelMax = Math.max(...funnelCounts, 1);

  // Conversion rates between consecutive stages
  const conversionRates: (number | null)[] = [];
  for (let i = 0; i < funnelCounts.length - 1; i++) {
    const from = funnelCounts[i];
    const to = funnelCounts[i + 1];
    conversionRates.push(from > 0 ? Math.round((to / from) * 100) : null);
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-5 pr-1">
      {/* ─────────────────────────────────────────────
          1. PIPELINE FUNNEL — Command Center Hero
          ───────────────────────────────────────────── */}
      <AnimatedCard hover={false} className="!rounded-xl overflow-hidden">
        <div className="px-5 pt-5 pb-1">
          <div className="flex items-center justify-between">
            <SectionHeader title="Pipeline Funnel" subtitle="Lead conversion across outreach stages" />
            <div className="flex items-center gap-2">
              <PulseDot color="#D4AF37" />
              <span className="text-xs text-muted-foreground font-medium">Live</span>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 pt-2">
          <div className="flex items-stretch gap-1">
            {FUNNEL_STAGES.map((stage, i) => {
              const count = funnelCounts[i];
              const widthPct = Math.max((count / funnelMax) * 100, 8);
              const convRate = conversionRates[i];
              const StageIcon = stage.icon;
              const isLast = i === FUNNEL_STAGES.length - 1;

              return (
                <div key={stage.key} className="flex-1 flex flex-col items-center min-w-0">
                  {/* Stage Column — clickable */}
                  <motion.button
                    className="w-full flex flex-col items-center gap-2 group py-2 px-1 rounded-lg transition-colors hover:bg-white/[0.03]"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
                    onClick={() => navigateTo?.(stage.navScreen)}
                    whileHover={{ y: -2 }}
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                      style={{ background: stage.barBg }}
                    >
                      <StageIcon className="w-4 h-4" style={{ color: stage.barColor }} />
                    </div>

                    {/* Count */}
                    <motion.span
                      className="text-lg font-bold tabular-nums"
                      style={{ color: isLast ? '#D4AF37' : stage.barColor }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.07 + 0.3 }}
                    >
                      {count.toLocaleString()}
                    </motion.span>

                    {/* Proportional Bar */}
                    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: stage.barBg }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${stage.barColor}CC, ${stage.barColor})` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.9, delay: 0.15 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>

                    {/* Label */}
                    <span className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase">{stage.label}</span>
                  </motion.button>

                  {/* Conversion Arrow between stages */}
                  {!isLast && (
                    <div className="flex items-center self-center -mx-0.5" style={{ marginBottom: '32px' }}>
                      <motion.div
                        className="flex flex-col items-center gap-0.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.07 + 0.5 }}
                      >
                        {convRate !== null ? (
                          <>
                            <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
                            <span
                              className="text-[9px] font-bold tabular-nums whitespace-nowrap"
                              style={{ color: convRate >= 40 ? '#10B981' : convRate >= 15 ? '#F59E0B' : '#EF4444' }}
                            >
                              {convRate}%
                            </span>
                          </>
                        ) : (
                          <ArrowRight className="w-3 h-3 text-muted-foreground/20" />
                        )}
                      </motion.div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </AnimatedCard>

      {/* ─────────────────────────────────────────────
          2. QUICK ACTION BUTTONS
          ───────────────────────────────────────────── */}
      <StaggerGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" stagger={0.06}>
        {/* Generate Drafts */}
        <StaggerItem>
          <motion.button
            className="relative w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl text-left group transition-all duration-300 hover:border-[#D4AF37]/30 hover:bg-white/[0.05]"
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigateTo?.('drafts')}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#D4AF37]/10 group-hover:bg-[#D4AF37]/20 transition-colors">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">Generate Drafts</p>
              <p className="text-[11px] text-muted-foreground">AI email drafts</p>
            </div>
            {(data.draftsPendingReview || 0) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#D4AF37] text-[10px] font-bold text-black flex items-center justify-center shadow-lg">
                {(data.draftsPendingReview || 0) > 99 ? '99+' : data.draftsPendingReview}
              </span>
            )}
          </motion.button>
        </StaggerItem>

        {/* Send All Pending */}
        <StaggerItem>
          <motion.button
            className="relative w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl text-left group transition-all duration-300 hover:border-emerald-500/30 hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={!sendingAll ? { y: -2, scale: 1.01 } : {}}
            whileTap={!sendingAll ? { scale: 0.98 } : {}}
            onClick={handleSendAll}
            disabled={sendingAll}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
              {sendingAll ? (
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">Send All Pending</p>
              <p className="text-[11px] text-muted-foreground">{sendingAll ? 'Sending...' : 'Trigger worker'}</p>
            </div>
            {(data.queuePending || 0) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-[10px] font-bold text-black flex items-center justify-center shadow-lg">
                {(data.queuePending || 0) > 99 ? '99+' : data.queuePending}
              </span>
            )}
          </motion.button>
        </StaggerItem>

        {/* Recalculate Scores */}
        <StaggerItem>
          <motion.button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl text-left group transition-all duration-300 hover:border-blue-500/30 hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={!recalculating ? { y: -2, scale: 1.01 } : {}}
            whileTap={!recalculating ? { scale: 0.98 } : {}}
            onClick={handleRecalculate}
            disabled={recalculating}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
              {recalculating ? (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">Recalculate Scores</p>
              <p className="text-[11px] text-muted-foreground">{recalculating ? 'Updating...' : 'Refresh lead scores'}</p>
            </div>
          </motion.button>
        </StaggerItem>

        {/* Import Leads */}
        <StaggerItem>
          <motion.button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl text-left group transition-all duration-300 hover:border-purple-500/30 hover:bg-white/[0.05]"
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigateTo?.('import')}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
              <Upload className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">Import Leads</p>
              <p className="text-[11px] text-muted-foreground">Upload CSV / XLSX</p>
            </div>
          </motion.button>
        </StaggerItem>

        {/* View Analytics */}
        <StaggerItem>
          <motion.button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl text-left group transition-all duration-300 hover:border-amber-500/30 hover:bg-white/[0.05]"
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigateTo?.('analytics')}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
              <BarChart3 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">View Analytics</p>
              <p className="text-[11px] text-muted-foreground">Performance insights</p>
            </div>
          </motion.button>
        </StaggerItem>
      </StaggerGrid>

      {/* ─────────────────────────────────────────────
          2.5 SIGNALS PANEL — Smart Detection Alerts
          ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
          {/* Header — collapsible */}
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left group"
            onClick={() => setSignalsExpanded(prev => !prev)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10">
                <Activity className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-bold text-foreground tracking-tight">Signals & Alerts</h2>
                  {signals.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <PulseDot color="#EF4444" />
                      <span className="text-xs font-semibold text-red-400 tabular-nums">{signals.length}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">AI-detected patterns requiring your attention</p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: signalsExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </motion.div>
          </button>

          {/* Collapsible content */}
          <AnimatePresence initial={false}>
            {signalsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                {/* Signal type summary chips */}
                {Object.keys(signalsSummary).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-5 pb-3">
                    {Object.entries(signalsSummary).map(([type, count]) => {
                      const config = SIGNAL_TYPE_CONFIG[type];
                      if (!config) return null;
                      const TypeIcon = config.icon;
                      return (
                        <span
                          key={type}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border border-white/[0.06] bg-white/[0.02]"
                        >
                          <TypeIcon className="w-3 h-3" style={{ color: config.color }} />
                          <span className="text-muted-foreground">{config.label}</span>
                          <span className="font-bold tabular-nums" style={{ color: config.color }}>{count}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="px-5 pb-1 max-h-96 overflow-y-auto custom-scrollbar">
                  {signalsLoading ? (
                    <div className="space-y-2 py-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                      ))}
                    </div>
                  ) : signals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                        <Radio className="w-6 h-6 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm text-muted-foreground">All clear — no signals detected</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Signals will appear as patterns emerge</p>
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      <div className="space-y-1.5 pb-3">
                        {signals.map((signal, i) => {
                          const sevConfig = SEVERITY_CONFIG[signal.severity];
                          const typeConfig = SIGNAL_TYPE_CONFIG[signal.type];
                          const SevIcon = sevConfig.icon;
                          const TypeIcon = typeConfig?.icon || Zap;
                          const isDismissing = dismissingIds.has(signal.id);

                          return (
                            <motion.div
                              key={signal.id}
                              layout
                              initial={{ opacity: 0, x: -16, scale: 0.97 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              exit={{ opacity: 0, x: 24, scale: 0.95, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                              transition={{ duration: 0.35, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                              className={`relative rounded-lg border-l-[3px] ${sevConfig.border} bg-white/[0.02] hover:bg-white/[0.04] transition-colors group/signal`}
                            >
                              <div className="flex items-start gap-3 px-3 py-2.5">
                                {/* Severity icon */}
                                <div
                                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                                  style={{ background: `${sevConfig.color}12` }}
                                >
                                  <TypeIcon className="w-3.5 h-3.5" style={{ color: typeConfig?.color || sevConfig.color }} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <SevIcon className="w-3 h-3 shrink-0" style={{ color: sevConfig.color }} />
                                    <span className="text-xs font-semibold text-foreground truncate">{signal.title}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">
                                    {signal.description}
                                  </p>
                                  {/* Contact info */}
                                  {signal.contactName && (
                                    <button
                                      className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#D4AF37] hover:underline"
                                      onClick={() => navigateTo?.('leads')}
                                    >
                                      <span className="font-medium">{signal.contactName}</span>
                                      {signal.companyName && (
                                        <>
                                          <span className="text-muted-foreground/40">·</span>
                                          <span className="text-muted-foreground">{signal.companyName}</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>

                                {/* Meta column */}
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className="text-[10px] text-muted-foreground/60 font-medium">
                                    {formatTimestamp(signal.detectedAt)}
                                  </span>
                                  <motion.button
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground hover:bg-white/[0.06] transition-colors opacity-0 group-hover/signal:opacity-100"
                                    whileTap={{ scale: 0.85 }}
                                    onClick={(e) => { e.stopPropagation(); dismissSignal(signal.id); }}
                                    disabled={isDismissing}
                                  >
                                    {isDismissing ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <X className="w-3 h-3" />
                                    )}
                                  </motion.button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </AnimatePresence>
                  )}
                </div>

                {/* Footer */}
                {signals.length > 0 && (
                  <div className="px-5 py-3 border-t border-white/[0.04]">
                    <motion.button
                      className="flex items-center gap-1.5 text-xs font-medium text-[#D4AF37] hover:underline"
                      whileHover={{ x: 2 }}
                      onClick={() => toast.info('Full signals view coming soon')}
                    >
                      View All Signals
                      <ChevronRight className="w-3 h-3" />
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ─────────────────────────────────────────────
          3. STATS GRID — 2 rows × 4 columns
          ───────────────────────────────────────────── */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.06}>
        {/* Row 1 */}
        <StaggerItem>
          <StatCard
            label="Total Leads"
            value={totalLeads}
            icon={Users}
            color="#D4AF37"
            delay={0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Companies"
            value={data.totalCompanies || 0}
            icon={Building2}
            color="#A855F7"
            delay={0.06}
          />
        </StaggerItem>
        <StaggerItem>
          <motion.div
            className="cursor-pointer"
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={() => navigateTo?.('drafts')}
          >
            <StatCard
              label="Pending Drafts"
              value={data.draftsPendingReview || 0}
              icon={FilePenLine}
              color="#F59E0B"
              delay={0.12}
            />
          </motion.div>
        </StaggerItem>
        <StaggerItem>
          <motion.div
            className="cursor-pointer"
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={() => navigateTo?.('queue')}
          >
            <StatCard
              label="Queue Pending"
              value={data.queuePending || 0}
              icon={Clock}
              color="#3B82F6"
              delay={0.18}
            />
          </motion.div>
        </StaggerItem>

        {/* Row 2 */}
        <StaggerItem>
          <motion.div
            className="cursor-pointer"
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={() => navigateTo?.('replies')}
          >
            <StatCard
              label="Replies This Week"
              value={data.repliesThisWeek || 0}
              icon={Mail}
              color="#10B981"
              delay={0.24}
            />
          </motion.div>
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Bounces"
            value={data.bouncesCount || 0}
            icon={ShieldX}
            color="#EF4444"
            delay={0.30}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Suppressions"
            value={data.suppressionsCount || 0}
            icon={ShieldAlert}
            color="#71717A"
            delay={0.36}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Email Health"
            value={`${validPct}%`}
            icon={ShieldCheck}
            color={validPct >= 80 ? '#10B981' : validPct >= 50 ? '#F59E0B' : '#EF4444'}
            delay={0.42}
          />
        </StaggerItem>
      </StaggerGrid>

      {/* ─────────────────────────────────────────────
          4. HOT LEADS + ACTIVITY FEED — Side by Side
          ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Hot Leads Panel ── */}
        <AnimatedCard hover={false} className="!rounded-xl">
          <div className="px-5 pt-5 pb-1">
            <div className="flex items-center justify-between">
              <SectionHeader title="Hot Leads" subtitle="Top prospects by score" />
              <motion.button
                className="flex items-center gap-1 text-xs font-medium text-[#D4AF37] hover:underline"
                whileHover={{ x: 2 }}
                onClick={() => navigateTo?.('leads')}
              >
                View All <ChevronRight className="w-3 h-3" />
              </motion.button>
            </div>
          </div>
          <div className="px-5 pb-5">
            {hotLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                  <Target className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">No scored leads yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Import leads to see rankings</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {hotLeads.map((lead, i) => (
                  <motion.button
                    key={lead.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left group"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
                    onClick={() => navigateTo?.('leads')}
                  >
                    {/* Rank */}
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        background: i === 0 ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                        color: i === 0 ? '#D4AF37' : 'text-muted-foreground',
                      }}
                    >
                      {i + 1}
                    </span>

                    {/* Lead Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-[#D4AF37] transition-colors">
                        {lead.rawName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {lead.title && `${lead.title}`}
                        {lead.title && lead.company && ' · '}
                        {lead.company}
                      </p>
                    </div>

                    {/* Score Badge */}
                    <ScoreBadge score={lead._dbFields?.leadScore ?? 0} />
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </AnimatedCard>

        {/* ── Recent Activity Feed ── */}
        <AnimatedCard hover={false} className="!rounded-xl">
          <div className="px-5 pt-5 pb-1">
            <div className="flex items-center justify-between">
              <SectionHeader title="Recent Activity" subtitle="Latest actions in your pipeline" />
              <div className="flex items-center gap-1.5">
                <PulseDot color="#10B981" />
                <span className="text-[11px] text-muted-foreground font-medium">Auto-refresh</span>
              </div>
            </div>
          </div>
          <div className="px-5 pb-5">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Actions will appear here as they happen</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-3 bottom-3 w-px bg-white/[0.06]" />

                <div className="space-y-0.5">
                  {activity.map((entry, i) => {
                    const config = getActivityConfig(entry.action);
                    const ActivityIcon = config.icon;
                    return (
                      <motion.div
                        key={entry.id}
                        className="relative flex gap-3 px-1 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
                      >
                        {/* Icon node on timeline */}
                        <div
                          className="relative z-10 w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: config.bg }}
                        >
                          <ActivityIcon className="w-3.5 h-3.5" style={{ color: config.color }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{config.label}</span>
                            <span className="text-[10px] text-muted-foreground/50">{formatTimestamp(entry.createdAt)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                            {formatActivityDetails(entry.action, entry.details)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}