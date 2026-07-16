'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Brain, Building2, Mail, Archive, Sparkles, AlertTriangle, TrendingUp, Zap,
  ArrowRight, BarChart3, Activity, Lightbulb, RefreshCw, Send, FileText, Users,
  ArrowUpRight, ArrowDownRight, Loader2, Clock, Layers, Eye, Shield, Cpu,
} from 'lucide-react';
import { PageTransition, AnimatedCounter, EmptyState } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

/* ═══════════════════════════════════════════════════
   Types & Config
   ═══════════════════════════════════════════════════ */
interface CommandCenterProps { navigateTo?: (screen: string, companyId?: string) => void }
interface Insights {
  companyEngine: {
    totalCompanies: number; companiesByStatus: Record<string, number>;
    companiesByIndustry: Record<string, number>; companiesByLifecycle: Record<string, number>; companiesByCountry?: Record<string, number>;
    topScoredCompanies: Array<{ id: string; name: string; industry: string; score: number; status: string; lifecycleStage: string }>;
    unreadSignalCount: number; criticalSignalCount: number;
    latestSignals: Array<{ id: string; type: string; title: string; severity: string; createdAt: string }>;
  };
  emailEngine: {
    totalContacts: number; contactsByStatus: Record<string, number>;
    pendingDrafts: number; pendingQueue: number; totalReplies: number;
    positiveReplies: number; replyRate: number; avgLeadScore: number;
    highValueLeads: Array<{ id: string; name: string; email: string; score: number; company: string; status: string }>;
    activeSequences: number;
  };
  capabilityEngine: {
    totalCapabilities: number; capabilitiesByCategory: Record<string, number>;
    capabilitiesByServiceLine: Record<string, number>;
    topCapabilities: Array<{ id: string; title: string; category: string; serviceLine: string; usedInEmails: number; upvotes: number }>;
  };
  recommendations: Array<{ type: string; priority: 'high' | 'medium' | 'low'; engine: string; title: string; description: string; actionScreen?: string }>;
  healthScore: number;
}
interface AuditItem { id: string; action: string; entity: string; entityId?: string; details?: string; createdAt: string }

const C = { bg: '#FAFAFA', card: 'rgba(255, 255, 255, 0.85)', border: 'rgba(0, 0, 0, 0.08)', gold: '#B8860B', goldLight: '#D4A843', goldDim: '#8B6914', text: '#111827', textMuted: '#6B7280', textDim: '#9CA3AF', green: '#059669', red: '#DC2626', blue: '#2563EB', amber: '#D97706' };
const ENGINES = { company: { label: 'Company Engine', icon: Building2, color: '#A855F7' }, email: { label: 'Email Engine', icon: Mail, color: '#3B82F6' }, capability: { label: 'Capability Engine', icon: Archive, color: '#10B981' } } as const;
const PRIORITY = { high: { color: C.red, bg: 'rgba(239,68,68,0.12)', label: 'Critical', icon: Shield }, medium: { color: C.amber, bg: 'rgba(245,158,11,0.12)', label: 'Warning', icon: AlertTriangle }, low: { color: C.blue, bg: 'rgba(59,130,246,0.12)', label: 'Info', icon: Eye } };
const PIE_COLORS = [C.gold, '#A855F7', C.blue, C.green, C.amber, C.red, C.textMuted];
const SIGNAL_ICONS: Record<string, string> = { funding: '💰', hiring: '👤', leadership_change: '👔', tech_change: '⚙️', news: '📰', mention: '💬' };
const ENGAGEMENT = [
  { day: 'Mon', sent: 320, opens: 42, replies: 8 }, { day: 'Tue', sent: 410, opens: 51, replies: 12 },
  { day: 'Wed', sent: 380, opens: 47, replies: 9 }, { day: 'Thu', sent: 520, opens: 55, replies: 14 },
  { day: 'Fri', sent: 490, opens: 50, replies: 11 }, { day: 'Sat', sent: 210, opens: 34, replies: 5 },
  { day: 'Sun', sent: 180, opens: 26, replies: 3 },
];
const SPARK = { company: [65, 72, 68, 80, 75, 82, 78], email: [45, 52, 48, 60, 55, 63, 58], capability: [30, 35, 32, 40, 38, 42, 41] };
// COUNTRIES now comes from API (companiesByCountry)

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */
function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`;
}
function actIcon(entity: string) {
  if (entity.includes('contact') || entity.includes('lead')) return Users;
  if (entity.includes('company')) return Building2; if (entity.includes('draft') || entity.includes('email')) return Mail;
  if (entity.includes('signal')) return Zap; return Activity;
}
function fmtTitle(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

/* ═══════════════════════════════════════════════════
   Shared Chart Components
   ═══════════════════════════════════════════════════ */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2 text-[10px]" style={{ background: 'rgba(6,9,15,0.95)', borderColor: C.border }}>
      <p className="font-medium mb-1" style={{ color: C.text }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: p.color }} /><span style={{ color: C.textMuted }}>{p.name}:</span><span className="font-medium" style={{ color: C.text }}>{p.value}</span></div>
      ))}
    </div>
  );
}

function Sparkline({ data, color, h = 40 }: { data: number[]; color: string; h?: number }) {
  const gid = `sg-${color.replace('#', '')}`;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gid})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════════════
   Health Gauge
   ═══════════════════════════════════════════════════ */
function HealthGauge({ score, insights }: { score: number; insights: Insights }) {
  const r = 62, circ = 2 * Math.PI * r, offset = circ - (score / 100) * circ;
  const color = score >= 70 ? C.green : score >= 40 ? C.amber : C.red;
  const pills = [
    { label: 'Companies Active', value: insights.companyEngine.totalCompanies, icon: Building2 },
    { label: 'Emails Queued', value: insights.emailEngine.pendingQueue, icon: Mail },
    { label: 'Segments', value: Object.keys(insights.capabilityEngine.capabilitiesByCategory).length, icon: Layers },
    { label: 'Signals', value: insights.companyEngine.unreadSignalCount, icon: Zap },
  ];
  return (
    <div className="rounded-2xl border p-6 flex flex-col items-center" style={{ background: C.card, borderColor: C.border }}>
      <div className="relative flex items-center justify-center mb-4">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(0, 0, 0, 0.04)" strokeWidth="8" />
          <circle cx="80" cy="80" r={r} fill="none" stroke="url(#gG)" strokeWidth="8" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 80 80)" style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1)' }} />
          <defs><linearGradient id="gG" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={C.goldDim} /><stop offset="100%" stopColor={C.goldLight} /></linearGradient></defs>
        </svg>
        <div className="absolute flex flex-col items-center">
          <AnimatedCounter value={score} className="text-4xl font-black" style={{ color }} />
          <span className="text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: C.textMuted }}>System Health</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        {pills.map((p, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ background: 'rgba(0, 0, 0, 0.02)', borderColor: C.border }}>
            <p.icon className="w-3.5 h-3.5 shrink-0" style={{ color: C.goldDim }} />
            <div className="min-w-0"><div className="text-xs font-bold tabular-nums" style={{ color: C.text }}>{p.value}</div>
              <div className="text-[8px] uppercase tracking-wider truncate" style={{ color: C.textDim }}>{p.label}</div></div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Engine Intelligence Card
   ═══════════════════════════════════════════════════ */
function EngineCard({ key_: k, insights }: { key_: 'company' | 'email' | 'capability'; insights: Insights }) {
  const cfg = ENGINES[k], Icon = cfg.icon;
  const eng = k === 'company' ? insights.companyEngine : k === 'email' ? insights.emailEngine : insights.capabilityEngine;
  const warn = k === 'company' ? eng.criticalSignalCount > 0 : k === 'email' ? (eng as any).pendingDrafts > 50 : eng.totalCapabilities < 5;
  const metrics = k === 'company'
    ? [{ l: 'Total Companies', v: eng.totalCompanies }, { l: 'Critical Signals', v: eng.criticalSignalCount }, { l: 'Unread Signals', v: eng.unreadSignalCount }, { l: 'Top Score', v: eng.topScoredCompanies[0]?.score || 0 }]
    : k === 'email'
    ? [{ l: 'Total Contacts', v: eng.totalContacts }, { l: 'Pending Drafts', v: (eng as any).pendingDrafts }, { l: 'Reply Rate', v: `${(eng as any).replyRate}%` }, { l: 'Avg Lead Score', v: (eng as any).avgLeadScore }]
    : [{ l: 'Capabilities', v: eng.totalCapabilities }, { l: 'Categories', v: Object.keys(eng.capabilitiesByCategory).length }, { l: 'Top Used', v: eng.topCapabilities[0]?.usedInEmails || 0 }, { l: 'Service Lines', v: Object.keys(eng.capabilitiesByServiceLine).length }];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-5 relative overflow-hidden group transition-all duration-300 cursor-default"
      style={{ background: C.card, borderColor: C.border }} whileHover={{ borderColor: `${C.gold}40` }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${cfg.color}08, transparent 70%)` }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}15` }}><Icon className="w-5 h-5" style={{ color: cfg.color }} /></div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: C.text }}>{cfg.label}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${warn ? 'animate-pulse' : ''}`} style={{ background: warn ? C.amber : C.green }} />
                <span className="text-[10px]" style={{ color: C.textMuted }}>{warn ? 'Needs Attention' : 'Active'}</span>
              </div>
            </div>
          </div>
          <Badge className="text-[9px] px-2 py-0.5 font-medium" style={{ background: warn ? PRIORITY.medium.bg : `${C.green}15`, color: warn ? C.amber : C.green, border: `1px solid ${warn ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}` }}>
            {warn ? 'Needs Attention' : 'Active'}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {metrics.map((m, i) => (
            <div key={i} className="rounded-xl p-3 border" style={{ background: 'rgba(0, 0, 0, 0.02)', borderColor: 'rgba(0, 0, 0, 0.04)' }}>
              <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: C.textDim }}>{m.l}</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: C.text }}>{typeof m.v === 'number' ? m.v.toLocaleString() : m.v}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-2 border" style={{ background: '#F9FAFB', borderColor: 'rgba(0, 0, 0, 0.06)' }}>
          <div className="text-[8px] uppercase tracking-widest mb-1 px-1" style={{ color: C.textDim }}>7-DAY TREND</div>
          <Sparkline data={SPARK[k]} color={cfg.color} h={50} />
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Activity Feed
   ═══════════════════════════════════════════════════ */
function ActivityFeed({ items }: { items: AuditItem[] }) {
  return (
    <div className="rounded-2xl border flex flex-col" style={{ background: C.card, borderColor: C.border, maxHeight: '380px' }}>
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.green }} />
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text }}>Live Activity Feed</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0, 0, 0, 0.06) transparent' }}>
        {items.length === 0 ? <div className="flex items-center justify-center py-8"><span className="text-[11px]" style={{ color: C.textDim }}>No recent activity</span></div> : (
          <div className="space-y-0.5">
            {items.slice(0, 15).map((item, i) => {
              const Icon = actIcon(item.entity);
              return (
                <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-gray-50">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(0, 0, 0, 0.04)' }}><Icon className="w-3.5 h-3.5" style={{ color: C.textMuted }} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] leading-snug" style={{ color: C.text }}>{fmtTitle(item.action)}</p>
                    <p className="text-[9px] capitalize mt-0.5" style={{ color: C.textDim }}>{item.entity.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="text-[9px] tabular-nums shrink-0 mt-1" style={{ color: C.textDim }}>{timeAgo(item.createdAt)}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Overview Tab
   ═══════════════════════════════════════════════════ */
function OverviewTab({ insights }: { insights: Insights }) {
  const ee = insights.emailEngine;
  const topMetrics = [
    { label: 'Total Contacts', value: ee.totalContacts, icon: Users, trend: '+12.3%', up: true, color: C.blue },
    { label: 'Companies', value: insights.companyEngine.totalCompanies, icon: Building2, trend: '+8.7%', up: true, color: '#A855F7' },
    { label: 'Pending Drafts', value: ee.pendingDrafts, icon: FileText, trend: '-3.2%', up: false, color: C.amber },
    { label: 'Reply Rate', value: ee.replyRate, icon: TrendingUp, trend: '+1.8%', up: true, color: C.green, suffix: '%' },
  ];
  const pipelineData = Object.entries(ee.contactsByStatus).map(([status, count]) => ({
    name: status.replace(/_/g, ' '), count, fill: status === 'replied' ? C.green : status === 'sent' ? C.blue : status === 'queued' ? C.amber : status === 'drafted' ? '#A855F7' : C.textDim,
  }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topMetrics.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl border p-5 relative overflow-hidden group" style={{ background: C.card, borderColor: C.border }}>
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.04] -translate-y-8 translate-x-8" style={{ background: `radial-gradient(circle, ${m.color}, transparent)` }} />
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${m.color}12` }}><m.icon className="w-4 h-4" style={{ color: m.color }} /></div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: m.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: m.up ? C.green : C.red }}>
                {m.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{m.trend}
              </div>
            </div>
            <div className="text-2xl font-black tabular-nums" style={{ color: C.text }}><AnimatedCounter value={m.value} />{m.suffix || ''}</div>
            <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: C.textDim }}>{m.label}</div>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Engagement Chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-3 rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="text-sm font-bold" style={{ color: C.text }}>Email Engagement</h3><p className="text-[10px] mt-0.5" style={{ color: C.textDim }}>7-day performance across all sequences</p></div>
            <div className="flex items-center gap-4 text-[9px]" style={{ color: C.textMuted }}>
              {[{ label: 'Sent', color: C.gold }, { label: 'Opens', color: C.textMuted }, { label: 'Replies', color: C.green }].map((l, i) => (
                <div key={i} className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: l.color }} />{l.label}</div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ENGAGEMENT} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="gld" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.gold} stopOpacity={0.25} /><stop offset="100%" stopColor={C.gold} stopOpacity={0} /></linearGradient>
                <linearGradient id="gln" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={0.2} /><stop offset="100%" stopColor={C.green} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.03)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="sent" stroke={C.gold} strokeWidth={2} fill="url(#gld)" name="Sent" />
              <Area type="monotone" dataKey="opens" stroke={C.textMuted} strokeWidth={1.5} fill="none" name="Opens" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="replies" stroke={C.green} strokeWidth={2} fill="url(#gln)" name="Replies" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
        {/* Pipeline Distribution */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="lg:col-span-2 rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
          <h3 className="text-sm font-bold mb-1" style={{ color: C.text }}>Pipeline Distribution</h3>
          <p className="text-[10px] mb-4" style={{ color: C.textDim }}>Contacts by current status</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pipelineData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.03)" horizontal={false} />
              <XAxis type="number" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: C.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Contacts" barSize={18}>
                {pipelineData.map((e, i) => <Cell key={i} fill={e.fill} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Engines Tab
   ═══════════════════════════════════════════════════ */
function EnginesTab({ insights }: { insights: Insights }) {
  const ce = insights.companyEngine, ee = insights.emailEngine, capE = insights.capabilityEngine;
  const countries = useMemo(() => {
    const raw = ce.companiesByCountry || {};
    return Object.entries(raw)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 8)
      .map(([name, value]) => ({ name, value: value as number }));
  }, [ce.companiesByCountry]);
  const indData = Object.entries(ce.companiesByIndustry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
  const draftData = Object.entries(ee.contactsByStatus).filter(([k]) => ['drafted', 'pending_review', 'sent', 'queued', 'replied'].includes(k)).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));
  const seqMetrics = [
    { label: 'Active Sequences', value: ee.activeSequences, color: C.blue },
    { label: 'Pending Drafts', value: ee.pendingDrafts, color: C.amber },
    { label: 'Emails in Queue', value: ee.pendingQueue, color: '#A855F7' },
    { label: 'Positive Replies', value: ee.positiveReplies, color: C.green },
    { label: 'Avg Lead Score', value: `${ee.avgLeadScore}/100`, color: C.gold },
  ];
  const catData = Object.entries(capE.capabilitiesByCategory).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  return (
    <div className="space-y-6">
      {/* Company Engine */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border p-6" style={{ background: C.card, borderColor: C.border }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.12)' }}><Building2 className="w-5 h-5" style={{ color: '#A855F7' }} /></div>
          <div><h3 className="text-sm font-bold" style={{ color: C.text }}>Company Intelligence</h3><p className="text-[10px]" style={{ color: C.textDim }}>{ce.totalCompanies} companies • {ce.unreadSignalCount} signals</p></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h4 className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: C.textDim }}>TOP INDUSTRIES</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={indData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                <XAxis type="number" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: C.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Companies" barSize={16}>{indData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.75} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: C.textDim }}>GEO DISTRIBUTION</h4>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart><Pie data={countries} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">{countries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">{countries.slice(0, 6).map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[9px]"><div className="w-1.5 h-1.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /><span style={{ color: C.textMuted }}>{c.name}</span></div>
            ))}</div>
          </div>
        </div>
        {ce.latestSignals.length > 0 && (
          <div className="mt-5">
            <h4 className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: C.textDim }}>RECENT SIGNALS</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {ce.latestSignals.slice(0, 6).map(s => (
                <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border" style={{ background: s.severity === 'critical' ? 'rgba(239,68,68,0.05)' : '#F9FAFB', borderColor: s.severity === 'critical' ? 'rgba(239,68,68,0.15)' : C.border }}>
                  <span className="text-sm">{SIGNAL_ICONS[s.type] || '📡'}</span>
                  <div className="flex-1 min-w-0"><p className="text-[11px] truncate" style={{ color: C.text }}>{s.title}</p><p className="text-[9px] capitalize" style={{ color: C.textDim }}>{s.severity}</p></div>
                  <span className="text-[9px]" style={{ color: C.textDim }}>{timeAgo(s.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Email Engine */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border p-6" style={{ background: C.card, borderColor: C.border }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.12)' }}><Mail className="w-5 h-5" style={{ color: C.blue }} /></div>
          <div><h3 className="text-sm font-bold" style={{ color: C.text }}>Email Engine Analytics</h3><p className="text-[10px]" style={{ color: C.textDim }}>{ee.totalContacts} contacts • {ee.activeSequences} sequences</p></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: C.textDim }}>DRAFT STATUS</h4>
            {draftData.length > 0 ? (<>
              <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={draftData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">{draftData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">{draftData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[9px]"><div className="w-1.5 h-1.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /><span style={{ color: C.textMuted }}>{d.name} ({d.value})</span></div>
              ))}</div>
            </>) : <p className="text-[11px] py-8 text-center" style={{ color: C.textDim }}>No data yet</p>}
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: C.textDim }}>SEQUENCE METRICS</h4>
            <div className="space-y-3">{seqMetrics.map((m, i) => (
              <div key={i} className="flex items-center justify-between"><span className="text-[11px]" style={{ color: C.textMuted }}>{m.label}</span><span className="text-sm font-bold tabular-nums" style={{ color: m.color }}>{m.value}</span></div>
            ))}</div>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: C.textDim }}>HIGH-VALUE LEADS</h4>
            <div className="space-y-2">{ee.highValueLeads.slice(0, 5).map((l, i) => (
              <div key={l.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border" style={{ background: '#F9FAFB', borderColor: C.border }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: l.score >= 80 ? C.green : l.score >= 60 ? C.gold : C.blue }}>{l.score}</div>
                <div className="flex-1 min-w-0"><p className="text-[11px] truncate" style={{ color: C.text }}>{l.name}</p><p className="text-[9px] truncate" style={{ color: C.textDim }}>{l.email}</p></div>
                <span className="text-[9px] uppercase" style={{ color: C.textDim }}>{l.status}</span>
              </div>
            ))}{ee.highValueLeads.length === 0 && <p className="text-[11px] py-6 text-center" style={{ color: C.textDim }}>No leads scored yet</p>}</div>
          </div>
        </div>
      </motion.div>

      {/* Capability Engine */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border p-6" style={{ background: C.card, borderColor: C.border }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}><Archive className="w-5 h-5" style={{ color: C.green }} /></div>
          <div><h3 className="text-sm font-bold" style={{ color: C.text }}>Capability Library</h3><p className="text-[10px]" style={{ color: C.textDim }}>{capE.totalCapabilities} capabilities • {Object.keys(capE.capabilitiesByServiceLine).length} service lines</p></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: C.textDim }}>BY CATEGORY</h4>
            <ResponsiveContainer width="100%" height={Math.max(100, catData.length * 35)}>
              <BarChart data={catData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                <XAxis type="number" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: C.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<ChartTooltip />} /><Bar dataKey="value" radius={[0, 6, 6, 0]} name="Count" barSize={16} fill={C.green} fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: C.textDim }}>MOST USED CAPABILITIES</h4>
            <div className="space-y-2">{capE.topCapabilities.slice(0, 5).map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border" style={{ background: '#F9FAFB', borderColor: C.border }}>
                <span className="text-xs font-bold w-5 text-center" style={{ color: i === 0 ? C.gold : C.textDim }}>#{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-[11px] truncate" style={{ color: C.text }}>{c.title}</p><p className="text-[9px] capitalize" style={{ color: C.textDim }}>{c.category?.replace(/_/g, ' ')} {c.serviceLine ? `• ${c.serviceLine}` : ''}</p></div>
                <div className="flex items-center gap-3 text-[9px] shrink-0" style={{ color: C.textMuted }}>
                  <span className="flex items-center gap-1"><Send className="w-3 h-3" />{c.usedInEmails}</span>
                  <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />{c.upvotes}</span>
                </div>
              </div>
            ))}{capE.topCapabilities.length === 0 && <p className="text-[11px] py-6 text-center" style={{ color: C.textDim }}>No capabilities loaded</p>}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   AI Query Tab
   ═══════════════════════════════════════════════════ */
function AIQueryTab({ onQuery, loading, result }: { onQuery: (q: string) => void; loading: boolean; result: any }) {
  const [query, setQuery] = useState('');
  const [animBorder, setAnimBorder] = useState(false);
  const examples = ['Show top industries', 'Which companies need follow-up?', 'Best performing sequences', 'High-value leads not contacted'];
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (query.trim() && !loading) { onQuery(query.trim()); setQuery(''); } };
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-8 relative overflow-hidden" style={{ background: C.card, borderColor: animBorder ? `${C.gold}40` : C.border, transition: 'border-color 0.3s' }}>
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(212,175,55,0.06), transparent 60%)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.gold}20, ${C.goldLight}10)` }}><Brain className="w-6 h-6" style={{ color: C.gold }} /></div>
            <div><h3 className="text-base font-bold" style={{ color: C.text }}>Ask Einstein AI</h3><p className="text-[11px]" style={{ color: C.textMuted }}>Natural language queries across all three engines</p></div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border transition-colors" style={{ background: 'rgba(0, 0, 0, 0.03)', borderColor: 'rgba(0, 0, 0, 0.06)' }} onFocus={() => setAnimBorder(true)} onBlur={() => setAnimBorder(false)}>
              <Sparkles className="w-5 h-5 shrink-0" style={{ color: C.gold }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. What are the top-performing sequences this week?" className="flex-1 bg-transparent text-sm outline-none" style={{ color: C.text }} />
              {loading ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.gold }} /> :
                <button type="submit" className="px-4 py-2 rounded-xl text-xs font-medium transition-colors" style={{ background: `${C.gold}15`, color: C.gold, border: `1px solid ${C.gold}30` }}>
                  <span className="flex items-center gap-1.5">Analyze <Send className="w-3 h-3" /></span>
                </button>}
            </div>
          </form>
          <div className="flex flex-wrap gap-2 mt-4">{examples.map((eq, i) => (
            <button key={i} onClick={() => onQuery(eq)} className="px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200"
              style={{ borderColor: 'rgba(0, 0, 0, 0.06)', color: C.textMuted, background: 'rgba(0, 0, 0, 0.02)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${C.gold}40`; e.currentTarget.style.color = C.gold; e.currentTarget.style.background = `${C.gold}08`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.06)'; e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)'; }}>
              {eq}
            </button>
          ))}</div>
        </div>
      </motion.div>
      {loading && (
        <div className="flex items-center justify-center gap-4 py-12 rounded-2xl border" style={{ background: C.card, borderColor: `${C.gold}20` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${C.gold}12` }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: C.gold }} /></div>
          <div><p className="text-sm font-medium" style={{ color: C.gold }}>Einstein AI is analyzing your query...</p><p className="text-[11px]" style={{ color: C.textDim }}>Cross-referencing all three engines</p></div>
        </div>
      )}
      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border p-6" style={{ background: C.card, borderColor: `${C.gold}25` }}>
          <div className="flex items-center gap-2 mb-2"><Brain className="w-4 h-4" style={{ color: C.gold }} /><span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: C.gold }}>AI Analysis</span></div>
          <p className="text-sm mb-3" style={{ color: C.text }}>{result.summary || 'Query processed successfully.'}</p>
          {result.interpretation && <p className="text-[11px] italic mb-3" style={{ color: C.textMuted }}>"{result.interpretation}"</p>}
          {Array.isArray(result.data) && result.data.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border" style={{ borderColor: C.border }}>
              {result.data.slice(0, 8).map((item: any, i: number) => (
                <div key={item.id || i} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0" style={{ borderColor: 'rgba(0, 0, 0, 0.04)' }}>
                  {item.name && <span className="text-xs flex-1 truncate" style={{ color: C.text }}>{item.name}</span>}
                  {item.title && <span className="text-xs flex-1 truncate" style={{ color: C.text }}>{item.title}</span>}
                  {item.score !== undefined && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${C.gold}15`, color: C.gold }}>{item.score}</span>}
                  {item.count !== undefined && <span className="text-[10px] font-medium" style={{ color: C.gold }}>{item.count}</span>}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
      {!loading && !result && (
        <div className="text-center py-16 rounded-2xl border" style={{ background: C.card, borderColor: C.border }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(0, 0, 0, 0.03)' }}><Brain className="w-8 h-8" style={{ color: C.textDim }} /></div>
          <p className="text-sm font-medium mb-1" style={{ color: C.textMuted }}>No queries yet</p>
          <p className="text-[11px]" style={{ color: C.textDim }}>Try one of the suggested queries above to get started</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Command Center Screen
   ═══════════════════════════════════════════════════ */
export default function CommandCenterScreen({ navigateTo }: CommandCenterProps) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [activities, setActivities] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'engines' | 'query'>('overview');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [insRes, actRes] = await Promise.all([fetch('/api/command-center/insights'), fetch('/api/audit?limit=15')]);
      const insData = await insRes.json(); if (insData?.companyEngine) setInsights(insData);
      const actData = await actRes.json(); if (Array.isArray(actData)) setActivities(actData);
      setLastRefresh(new Date());
    } catch { /* silent */ }
    setLoading(false); setRefreshing(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleQuery = useCallback(async (q: string) => {
    setQueryLoading(true); setQueryResult(null);
    try {
      const res = await fetch('/api/command-center/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
      const data = await res.json();
      if (data?.summary) { setQueryResult(data); if (activeTab !== 'query') setActiveTab('query'); }
    } catch { toast.error('Query failed'); }
    setQueryLoading(false);
  }, [activeTab]);

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-8 w-32 ml-auto" /></div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4"><Skeleton className="h-80 rounded-2xl" /><div className="lg:col-span-3 grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div></div>
    </div>
  );
  if (!insights) return <EmptyState icon={Brain} title="Command Center Unavailable" description="Could not load AI insights. Try refreshing." />;

  const tabs = [{ key: 'overview' as const, label: 'Overview', icon: BarChart3 }, { key: 'engines' as const, label: 'Engines', icon: Cpu }, { key: 'query' as const, label: 'AI Query', icon: Brain }];

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center relative" style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}>
              <Brain className="w-5 h-5 text-white" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2" style={{ borderColor: C.bg }}>
                <div className="w-full h-full rounded-full bg-emerald-500 animate-ping opacity-50" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2.5" style={{ color: C.text }}>
                AI Command Center
                <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: C.green }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
                </span>
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>
                Real-time intelligence across <span className="font-semibold" style={{ color: C.text }}>{insights.emailEngine.totalContacts.toLocaleString()}</span> contacts and <span className="font-semibold" style={{ color: C.text }}>{insights.companyEngine.totalCompanies.toLocaleString()}</span> companies
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] tabular-nums" style={{ color: C.textDim }}><Clock className="w-3 h-3 inline mr-1 -mt-0.5" />Updated {timeAgo(lastRefresh.toISOString())}</span>
            <button onClick={fetchData} disabled={refreshing} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all duration-200"
              style={{ borderColor: C.border, color: C.textMuted, background: 'rgba(0, 0, 0, 0.02)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${C.gold}30`; e.currentTarget.style.color = C.gold; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}>
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh
            </button>
          </div>
        </div>

        {/* TOP ROW: Health + Activity | Engine Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <HealthGauge score={insights.healthScore} insights={insights} />
            <ActivityFeed items={activities} />
          </div>
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['company', 'email', 'capability'] as const).map(eng => <EngineCard key={eng} key_={eng} insights={insights} />)}
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 p-1.5 rounded-2xl" style={{ background: 'rgba(0, 0, 0, 0.03)', border: `1px solid ${C.border}` }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-200"
              style={activeTab === tab.key ? { background: `${C.gold}12`, color: C.gold, boxShadow: `0 0 20px ${C.gold}08` } : { color: C.textMuted }}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && <motion.div key="ov" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}><OverviewTab insights={insights} /></motion.div>}
          {activeTab === 'engines' && <motion.div key="en" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}><EnginesTab insights={insights} /></motion.div>}
          {activeTab === 'query' && <motion.div key="qr" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}><AIQueryTab onQuery={handleQuery} loading={queryLoading} result={queryResult} /></motion.div>}
        </AnimatePresence>

        {/* RECOMMENDATIONS */}
        {insights.recommendations.length > 0 && (
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${C.gold}12` }}><Lightbulb className="w-4 h-4" style={{ color: C.gold }} /></div>
              <div>
                <h2 className="text-sm font-bold" style={{ color: C.text }}>AI Recommendations</h2>
                <p className="text-[10px]" style={{ color: C.textDim }}>{insights.recommendations.filter(r => r.priority === 'high').length} critical • {insights.recommendations.filter(r => r.priority === 'medium').length} warnings</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.recommendations.slice(0, 6).map((rec, i) => {
                const ps = PRIORITY[rec.priority], ec = ENGINES[rec.engine as keyof typeof ENGINES];
                const PIcon = ps.icon;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all duration-200 group"
                    style={{ background: C.card, borderColor: C.border }}
                    whileHover={{ borderColor: `${ec.color}35`, background: `${ec.color}04` }}
                    onClick={() => { if (rec.actionScreen) navigateTo?.(rec.actionScreen); }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: ps.bg }}><PIcon className="w-4 h-4" style={{ color: ps.color }} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold" style={{ color: C.text }}>{rec.title}</span>
                        <span className="text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md" style={{ background: ps.bg, color: ps.color }}>{ps.label}</span>
                      </div>
                      <p className="text-[10px] leading-relaxed" style={{ color: C.textMuted }}>{rec.description}</p>
                    </div>
                    {rec.actionScreen && <ArrowRight className="w-4 h-4 shrink-0 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.textDim }} />}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}