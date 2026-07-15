'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Building2, Users, FileText, Send, Mail, TrendingUp, TrendingDown, ChevronRight, Zap, UserPlus, Eye, MessageSquare, AlertTriangle, Inbox, Sparkles } from 'lucide-react';

const gold = '#D4AF37', goldLight = '#E8C860';
const card = 'rgba(12,18,30,0.7)', border = 'rgba(255,255,255,0.06)';

interface DashboardData { contactsByStatus: Record<string, number>; totalCompanies: number; draftsPendingReview: number; queuePending: number; repliesThisWeek: number; [k: string]: any }
interface AuditEntry { id: string; action: string; entity: string; entityId?: string; details?: string; createdAt: string }

const engagementData = [
  { day: 'Mon', opens: 320, clicks: 89, replies: 14 }, { day: 'Tue', opens: 410, clicks: 112, replies: 21 },
  { day: 'Wed', opens: 380, clicks: 95, replies: 18 }, { day: 'Thu', opens: 520, clicks: 148, replies: 32 },
  { day: 'Fri', opens: 490, clicks: 134, replies: 28 }, { day: 'Sat', opens: 210, clicks: 58, replies: 9 },
  { day: 'Sun', opens: 180, clicks: 42, replies: 7 },
];

const funnelStages = [
  { label: 'Imported', count: 40982 }, { label: 'Drafted', count: 1000 },
  { label: 'Queued', count: 300 }, { label: 'Sent', count: 203 }, { label: 'Replied', count: 44 },
];
const funnelMax = funnelStages[0].count;

const topCompanies = [
  { name: 'Nexus Technologies', industry: 'SaaS', contacts: 342, flag: '🇺🇸', id: 'c1' },
  { name: 'Quantum Financial', industry: 'FinTech', contacts: 287, flag: '🇬🇧', id: 'c2' },
  { name: 'Helios Corp', industry: 'Healthcare', contacts: 254, flag: '🇩🇪', id: 'c3' },
  { name: 'Apex Dynamics', industry: 'Manufacturing', contacts: 198, flag: '🇯🇵', id: 'c4' },
  { name: 'Vortex AI', industry: 'AI/ML', contacts: 176, flag: '🇺🇸', id: 'c5' },
  { name: 'Solaris Group', industry: 'Energy', contacts: 153, flag: '🇫🇷', id: 'c6' },
  { name: 'Cipher Labs', industry: 'Cybersecurity', contacts: 141, flag: '🇮🇱', id: 'c7' },
  { name: 'Atlas Ventures', industry: 'Venture Capital', contacts: 128, flag: '🇺🇸', id: 'c8' },
];

const segments = [
  { label: 'SaaS Decision Makers', count: 4820 }, { label: 'FinTech C-Suite', count: 3650 },
  { label: 'Healthcare IT Leaders', count: 2980 }, { label: 'Series A+ Founders', count: 2140 },
  { label: 'Enterprise Procurement', count: 1780 },
];

const ACT_CFG: Record<string, { icon: typeof Zap; color: string; bg: string; label: string }> = {
  lead_imported: { icon: UserPlus, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Lead Imported' },
  draft_generated: { icon: Sparkles, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Draft Generated' },
  email_sent: { icon: Send, color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Email Sent' },
  email_opened: { icon: Eye, color: '#A855F7', bg: 'rgba(168,85,247,0.12)', label: 'Email Opened' },
  reply_received: { icon: MessageSquare, color: gold, bg: 'rgba(212,175,55,0.12)', label: 'Reply Received' },
  bounce_detected: { icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Bounce Detected' },
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

/* Animated Counter */
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

/* Stat Card */
function StatCard({ icon: Icon, label, value, suffix, trend, bc, delay }: {
  icon: typeof Building2; label: string; value: number | string; suffix?: string;
  trend?: { value: number; up: boolean }; bc: string; delay: number;
}) {
  const num = typeof value === 'number' ? value : 0;
  const anim = useCounter(num);
  const display = typeof value === 'number' ? anim.toLocaleString() : value;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-xl overflow-hidden group" style={{ background: card, backdropFilter: 'blur(20px)', border: `1px solid ${border}`, borderLeft: `3px solid ${bc}` }}>
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
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend.up ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{trend.value}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs space-y-1" style={{ background: 'rgba(12,18,30,0.95)', borderColor: border }}>
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.dataKey}</span>
          <span className="font-bold tabular-nums text-foreground ml-auto">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

const glassPanel = { background: card, backdropFilter: 'blur(20px)', border: `1px solid ${border}` };

export default function DashboardScreen({ navigateTo }: { navigateTo?: (screen: string, companyId?: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDash = useCallback(async () => {
    try { const r = await fetch('/api/dashboard'); const d = await r.json(); if (d?.contactsByStatus) setData(d); } catch { /* */ }
  }, []);
  const fetchAct = useCallback(async () => {
    try { const r = await fetch('/api/audit?limit=8'); const d = await r.json(); if (Array.isArray(d)) setActivity(d.slice(0, 8)); } catch { /* */ }
  }, []);

  useEffect(() => {
    let off = false;
    (async () => { await Promise.all([fetchDash(), fetchAct()]); if (!off) setLoading(false); })();
    return () => { off = true; };
  }, [fetchDash, fetchAct]);

  if (loading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4"><Skeleton className="h-72 rounded-xl lg:col-span-3" /><Skeleton className="h-72 rounded-xl lg:col-span-2" /></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>
    </div>
  );

  if (!data) return <div className="text-muted-foreground text-sm p-6">Failed to load dashboard data.</div>;

  const totalLeads = Object.values(data.contactsByStatus || {}).reduce((a: number, b: number) => a + b, 0);
  const replied = data.contactsByStatus?.replied || data.repliesThisWeek || 0;
  const sent = data.contactsByStatus?.sent || 0;
  const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : '4.4';

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-5 pr-1">
      {/* 1. STATS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Building2} label="Total Companies" value={data.totalCompanies || 10684} bc="#D4AF37" trend={{ value: 12.3, up: true }} delay={0} />
        <StatCard icon={Users} label="Active Contacts" value={totalLeads || 40982} bc="#3B82F6" trend={{ value: 8.1, up: true }} delay={0.06} />
        <StatCard icon={FileText} label="Pending Drafts" value={data.draftsPendingReview || 797} bc="#F59E0B" trend={{ value: 3.2, up: false }} delay={0.12} />
        <StatCard icon={Send} label="In Queue" value={data.queuePending || 97} bc="#10B981" trend={{ value: 24.5, up: true }} delay={0.18} />
        <StatCard icon={Mail} label="Reply Rate" value={replyRate} suffix="%" bc="#A855F7" trend={{ value: 1.8, up: true }} delay={0.24} />
      </div>

      {/* 2. PIPELINE FUNNEL */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
        className="rounded-xl overflow-hidden" style={glassPanel}>
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight">Pipeline Funnel</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lead conversion across outreach stages</p>
          </div>
          <span className="text-[10px] font-medium px-2 py-1 rounded-md" style={{ background: 'rgba(212,175,55,0.1)', color: gold }}>
            {((funnelStages[4].count / funnelMax) * 100).toFixed(2)}% conversion
          </span>
        </div>
        <div className="px-5 pb-5 pt-1 flex flex-col gap-2">
          {funnelStages.map((s, i) => {
            const w = Math.max((s.count / funnelMax) * 100, 12);
            return (
              <motion.div key={s.label} className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}>
                <span className="text-[11px] text-muted-foreground font-medium w-[70px] shrink-0 text-right">{s.label}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-8 rounded-md overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
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

      {/* 3. ENGAGEMENT (60%) + TOP COMPANIES (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <motion.div className="lg:col-span-3 rounded-xl overflow-hidden" style={glassPanel}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
          <div className="px-5 pt-5 pb-1 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Engagement Overview</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">7-day opens, clicks & replies</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white/90" />Opens</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: gold }} />Clicks</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />Replies</span>
            </div>
          </div>
          <div className="px-3 pb-4 pt-2" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={engagementData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gO" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(255,255,255,0.25)" /><stop offset="100%" stopColor="rgba(255,255,255,0)" /></linearGradient>
                  <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(212,175,55,0.35)" /><stop offset="100%" stopColor="rgba(212,175,55,0)" /></linearGradient>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(16,185,129,0.35)" /><stop offset="100%" stopColor="rgba(16,185,129,0)" /></linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 11 }} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="opens" stroke="rgba(255,255,255,0.8)" fill="url(#gO)" strokeWidth={2} />
                <Area type="monotone" dataKey="clicks" stroke={gold} fill="url(#gC)" strokeWidth={2} />
                <Area type="monotone" dataKey="replies" stroke="#10B981" fill="url(#gR)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
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
              whileHover={{ x: 2 }} onClick={() => navigateTo?.('companies')}>View All <ChevronRight className="w-3 h-3" /></motion.button>
          </div>
          <div className="flex-1 px-5 pb-4 max-h-80 overflow-y-auto custom-scrollbar">
            <div className="space-y-1">
              {topCompanies.map((co, i) => (
                <motion.button key={co.id} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left group"
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.4 + i * 0.05 }}
                  onClick={() => navigateTo?.('company-detail', co.id)}>
                  <span className="text-base leading-none">{co.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate group-hover:text-white transition-colors">{co.name}</p>
                    <p className="text-[10px] text-muted-foreground">{co.industry}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${gold}CC, ${goldLight})` }}
                        initial={{ width: 0 }} animate={{ width: `${(co.contacts / topCompanies[0].contacts) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.5 + i * 0.05 }} />
                    </div>
                    <span className="text-[11px] font-bold tabular-nums text-foreground w-8 text-right">{co.contacts}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 4. ACTIVITY + SEGMENTS */}
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
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3"><Inbox className="w-6 h-6 text-muted-foreground/40" /></div>
                <p className="text-sm text-muted-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Actions will appear here as they happen</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[13px] top-3 bottom-3 w-px bg-white/[0.06]" />
                <div className="space-y-0.5">
                  {activity.map((e, i) => {
                    const cfg = getActCfg(e.action); const Icon = cfg.icon;
                    return (
                      <motion.div key={e.id} className="relative flex gap-3 px-1 py-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.5 + i * 0.05 }}>
                        <div className="relative z-10 w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                          <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
                            <span className="text-[10px] text-muted-foreground/50">{fmtTime(e.createdAt)}</span>
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

        {/* Quick Segments */}
        <motion.div className="rounded-xl overflow-hidden" style={glassPanel}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.52 }}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="text-sm font-bold text-foreground tracking-tight">Quick Segments</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Top contact segments</p>
          </div>
          <div className="px-5 pb-5 space-y-3 pt-2">
            {segments.map((seg, i) => (
              <motion.div key={seg.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.55 + i * 0.06 }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">{seg.label}</span>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: gold }}>{seg.count.toLocaleString()}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.8), rgba(232,200,96,0.6))' }}
                    initial={{ width: 0 }} animate={{ width: `${(seg.count / segments[0].count) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.6 + i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}