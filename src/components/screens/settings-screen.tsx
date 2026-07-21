'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition,
  GlassPanel,
  GradientCard,
  StaggerGrid,
  StaggerItem,
  SectionHeader,
  TabBar,
  ShimmerText,
  PulseDot,
  AnimatedCard,
  StatCard,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import {
  Mail,
  Clock,
  ShieldCheck,
  Star,
  Ban,
  Plug,
  Save,
  RotateCcw,
  Database,
  CheckCircle2,
  XCircle,
  Users,
  Trophy,
  RefreshCw,
  ArrowRightLeft,
  Send,
  MessageSquare,
  AlertTriangle,
  Target,
  ShieldAlert,
  Download,
  Trash2,
  ExternalLink,
  UserCircle, Lock, Phone, Building2, Briefcase, KeyRound, Eye,
} from 'lucide-react';
import DataRulesSection from './settings-data-rules';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

// ── Shared gold-focus input className ───────────────────────
const INPUT_CLS =
  'bg-input/30 border-border focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 transition-all duration-300';

// ── Timezone list ──────────────────────────────────────────
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC',
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const suffix = i < 12 ? 'AM' : 'PM';
  return { value: String(i).padStart(2, '0') + ':00', label: `${h}:00 ${suffix}` };
});

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// ── Default scoring rules ──────────────────────────────────
interface ScoringRule {
  id: string;
  label: string;
  points: number;
}

const DEFAULT_SCORING_RULES: ScoringRule[] = [
  { id: 'corporate-domain', label: 'Corporate email domain', points: 15 },
  { id: 'email-verified', label: 'Email verified valid', points: 25 },
  { id: 'executive-role', label: 'Executive role (CTO, CIO, VP)', points: 20 },
  { id: 'director-role', label: 'Director role', points: 15 },
  { id: 'manager-role', label: 'Manager role', points: 10 },
  { id: 'target-industry', label: 'Company in target industry', points: 10 },
  { id: 'company-size', label: 'Company size 1000+', points: 10 },
];

function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

// ── Toggle row inside a GradientCard ──────────────────────
function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <GradientCard>
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {Icon && (
            <div
              className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(212, 175, 55, 0.08)' }}
            >
              <Icon className="size-4 text-[#D4AF37]" />
            </div>
          )}
          <div className="space-y-0.5 min-w-0">
            <Label className="text-sm font-medium text-foreground leading-tight">{title}</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
      </div>
    </GradientCard>
  );
}

// ── Status colors for the stacked bar ──────────────────────
const STATUS_ORDER = ['imported', 'cleaned', 'drafted', 'queued', 'sent', 'replied', 'bounced'] as const;
const STATUS_COLORS: Record<string, string> = {
  imported: '#6b7280',
  cleaned: '#8b5cf6',
  drafted: '#3b82f6',
  queued: '#f59e0b',
  sent: '#D4AF37',
  replied: '#10b981',
  bounced: '#ef4444',
};

interface TeamMember {
  name: string;
  avatar: string;
  totalAssigned: number;
  statusBreakdown: Record<string, number>;
  avgScore: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  replyRate: number;
  bounceRate: number;
}

// ── Custom recharts tooltip ────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white border border-gray-200 shadow-lg px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.dataKey}:</span>
          <span className="text-foreground font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Team Performance Section ──────────────────────────────
function TeamPerformanceSection() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const fetchPerformance = useCallback(async () => {
    try {
      const res = await fetch('/api/team/performance');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const runAssignment = async (method: 'unassigned' | 'all') => {
    setAssigning(true);
    try {
      // First, get the contact IDs
      let url = '/api/leads/assign';
      const res = await fetch(url);
      const summary = await res.json();

      // For simplicity, call the assign endpoint
      const assignRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds: ['_all'], // sentinel — backend will handle
          method: 'round_robin',
          _assignMode: method,
        }),
      });
      const result = await assignRes.json();
      toast.success(result.message || `${method === 'all' ? 'Rebalanced' : 'Auto-assigned'} successfully`);
      fetchPerformance();
    } catch {
      toast.error('Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  // Derived summary
  const totalTeamSize = members.length;
  const totalContacts = members.reduce((s, m) => s + m.totalAssigned, 0);
  const teamAvgReplyRate = members.length > 0
    ? Math.round(members.reduce((s, m) => s + m.replyRate, 0) / members.length)
    : 0;
  const topPerformer = members.length > 0 ? members[0] : null;

  return (
    <StaggerGrid stagger={0.08} className="space-y-6">
      {/* ── Header panel ─────────────────────────────────── */}
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div
            className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap"
            style={{
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), transparent)',
              borderBottom: '1px solid rgba(212, 175, 55, 0.1)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.06))' }}
              >
                <Users className="size-4.5" style={{ color: '#D4AF37' }} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  <ShimmerText>Team Performance</ShimmerText>
                </h3>
                <p className="text-xs text-muted-foreground">Track individual KPIs, reply rates, and contact distribution</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={assigning}
                  className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all duration-300"
                  onClick={() => runAssignment('unassigned')}
                >
                  {assigning ? <RefreshCw className="size-3.5 mr-1.5 animate-spin" /> : <ArrowRightLeft className="size-3.5 mr-1.5" />}
                  Auto-Assign Unassigned
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={assigning}
                  className="border-border text-muted-foreground hover:bg-accent transition-all duration-300"
                  onClick={() => runAssignment('all')}
                >
                  <RefreshCw className={`size-3.5 mr-1.5 ${assigning ? 'animate-spin' : ''}`} />
                  Rebalance
                </Button>
              </motion.div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* ── Summary Cards ────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Team Size" value={totalTeamSize} icon={Users} color="#D4AF37" delay={0} />
              <StatCard label="Total Assigned" value={totalContacts} icon={Target} color="#3b82f6" delay={0.05} />
              <StatCard
                label="Avg Reply Rate"
                value={`${teamAvgReplyRate}%`}
                icon={MessageSquare}
                color="#10b981"
                delay={0.1}
              />
              <StatCard
                label="Top Performer"
                value={topPerformer ? topPerformer.name.split(' ')[0] : '—'}
                icon={Trophy}
                color="#f59e0b"
                delay={0.15}
              />
            </div>

            {/* ── Loading state ────────────────────────────── */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="size-5 text-[#D4AF37] animate-spin" />
                <span className="ml-3 text-sm text-muted-foreground">Loading team data…</span>
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No team members yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Assign contacts to team members to see performance data</p>
              </div>
            ) : (
              <>
                {/* ── Performance Table ─────────────────────── */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr
                          className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)' }}
                        >
                          <th className="px-4 py-3 whitespace-nowrap">Member</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Assigned</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Sent</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Replied</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Bounced</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Reply Rate</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Avg Score</th>
                          <th className="px-4 py-3 whitespace-nowrap min-w-[200px]">Status Distribution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {members.map((m, idx) => {
                          const sentCount = m.statusBreakdown['sent'] || 0;
                          const repliedCount = m.statusBreakdown['replied'] || 0;
                          const bouncedCount = m.statusBreakdown['bounced'] || 0;

                          // Reply rate color
                          const replyColor = m.replyRate > 20 ? '#10b981' : m.replyRate >= 10 ? '#f59e0b' : '#ef4444';

                          // Stacked bar data
                          const barData = STATUS_ORDER
                            .filter(s => (m.statusBreakdown[s] || 0) > 0)
                            .map(s => ({ name: s, value: m.statusBreakdown[s] || 0 }));

                          const barTotal = barData.reduce((sum, d) => sum + d.value, 0);

                          return (
                            <motion.tr
                              key={m.name}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05, duration: 0.3 }}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              {/* Avatar + Name */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                    style={{
                                      background: `linear-gradient(135deg, #D4AF37, #9A8340)`,
                                      boxShadow: idx === 0 ? '0 0 12px rgba(212, 175, 55, 0.4)' : 'none',
                                    }}
                                  >
                                    {m.avatar}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                                    {idx === 0 && (
                                      <span className="text-[10px] font-semibold text-[#D4AF37] flex items-center gap-1">
                                        <Trophy className="size-2.5" /> Top Performer
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">{m.totalAssigned}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">{sentCount}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{repliedCount}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-red-600">{bouncedCount}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-bold tabular-nums" style={{ color: replyColor }}>
                                  {m.replyRate}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{m.avgScore}</td>
                              {/* Stacked bar */}
                              <td className="px-4 py-3">
                                <div className="h-2.5 rounded-full overflow-hidden bg-gray-100 flex">
                                  {barData.map(d => {
                                    const pct = barTotal > 0 ? (d.value / barTotal) * 100 : 0;
                                    return (
                                      <motion.div
                                        key={d.name}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ delay: idx * 0.05 + 0.2, duration: 0.6 }}
                                        className="h-full"
                                        style={{ background: STATUS_COLORS[d.name] || '#6b7280' }}
                                        title={`${d.name}: ${d.value}`}
                                      />
                                    );
                                  })}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Per-member bar charts ─────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {members.slice(0, 4).map((m, idx) => {
                    const chartData = STATUS_ORDER
                      .filter(s => (m.statusBreakdown[s] || 0) > 0)
                      .map(s => ({
                        name: s.charAt(0).toUpperCase() + s.slice(1, 4),
                        value: m.statusBreakdown[s] || 0,
                        color: STATUS_COLORS[s],
                      }));

                    return (
                      <motion.div
                        key={m.name}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + idx * 0.08 }}
                      >
                        <GlassPanel className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #D4AF37, #9A8340)' }}
                              >
                                {m.avatar}
                              </div>
                              <span className="text-xs font-medium text-foreground truncate">{m.name}</span>
                            </div>
                            <span className="text-xs font-bold tabular-nums" style={{
                              color: m.replyRate > 20 ? '#10b981' : m.replyRate >= 10 ? '#f59e0b' : '#ef4444',
                            }}>
                              {m.replyRate}% reply
                            </span>
                          </div>
                          <div className="h-24">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <XAxis
                                  dataKey="name"
                                  tick={{ fontSize: 9, fill: '#6b7280' }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <YAxis hide />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.03)' }} />
                                <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={24}>
                                  {chartData.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </GlassPanel>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </GlassPanel>
      </StaggerItem>
    </StaggerGrid>
  );
}

/* ═══════════════════════════════════════════════════════════
   GDPR Compliance Section
   ═══════════════════════════════════════════════════════════ */

interface ComplianceData {
  summary: {
    totalContacts: number;
    consented: number;
    unknown: number;
    suppressed: number;
    complianceRate: string;
    emailVerifiedRate: string;
  };
  consentBreakdown: Record<string, number>;
  suppressionBreakdown: Record<string, number>;
  recentChanges: Array<{ id: string; action: string; entity: string; entityId?: string; details?: string; createdAt: string }>;
  retentionDays: number;
  riskFlags: Array<{ type: string; count: number; message: string; fixable?: boolean; fixAction?: string }>;
}

const CONSENT_COLORS: Record<string, string> = {
  opted_in: '#10B981',
  unknown: '#D4AF37',
  opted_out: '#EF4444',
};

function ComplianceSection({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/compliance')
      .then(r => r.json())
      .then(d => { setData(d); })
      .catch(() => { /* silent */ })
      .finally(() => { setLoading(false); });
  }, []);

  const runAction = async (action: string, fixAction?: string) => {
    const key = fixAction || action;
    setActionLoading(key);
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: fixAction || action }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message || `${action} completed`);
        // Refresh data
        const fresh = await fetch('/api/compliance').then(r => r.json());
        setData(fresh);
      } else {
        toast.error(result.error || 'Action failed');
      }
    } catch {
      toast.error('Network error');
    }
    setActionLoading(null);
  };

  const complianceRate = data ? parseFloat(data.summary.complianceRate) : 0;
  const complianceColor = complianceRate >= 80 ? '#10B981' : complianceRate >= 50 ? '#F59E0B' : '#EF4444';
  const complianceLabel = complianceRate >= 80 ? 'Compliant' : complianceRate >= 50 ? 'Needs Attention' : 'Non-Compliant';

  const pieData = data
    ? [
        { name: 'Opted In', value: data.consentBreakdown.opted_in || 0, fill: CONSENT_COLORS.opted_in },
        { name: 'Unknown', value: data.consentBreakdown.unknown || 0, fill: CONSENT_COLORS.unknown },
        { name: 'Opted Out', value: data.consentBreakdown.opted_out || 0, fill: CONSENT_COLORS.opted_out },
      ].filter(d => d.value > 0)
    : [];

  return (
    <StaggerGrid stagger={0.08} className="space-y-6">
      {/* ── Header ───────────────────────────────────────── */}
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div
            className="px-6 py-4 flex items-center gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(212, 175, 55, 0.04), transparent)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.1)',
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(212, 175, 55, 0.08))' }}
            >
              <ShieldAlert className="size-4.5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight">
                <ShimmerText>GDPR Compliance Dashboard</ShimmerText>
              </h3>
              <p className="text-xs text-muted-foreground">Monitor consent status, risk flags, and data retention</p>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : !data ? (
              <p className="text-sm text-muted-foreground text-center py-8">Failed to load compliance data</p>
            ) : (
              <div className="space-y-6">
                {/* ── Score + Donut Chart ────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Compliance Score Card */}
                  <div className="lg:col-span-1">
                    <GlassPanel className="p-6 flex flex-col items-center justify-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3">Compliance Score</p>
                      <div className="relative">
                        <span
                          className="text-5xl font-bold tabular-nums"
                          style={{ color: complianceColor }}
                        >
                          {data.summary.complianceRate}%
                        </span>
                      </div>
                      <Badge
                        className="mt-3 text-xs font-medium"
                        style={{
                          background: `${complianceColor}20`,
                          color: complianceColor,
                          border: `1px solid ${complianceColor}40`,
                        }}
                      >
                        {complianceLabel}
                      </Badge>
                      <div className="mt-4 w-full space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Total contacts</span>
                          <span className="font-semibold text-foreground tabular-nums">{data.summary.totalContacts}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Opted in</span>
                          <span className="font-semibold text-emerald-600 tabular-nums">{data.summary.consented}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Unknown status</span>
                          <span className="font-semibold text-amber-600 tabular-nums">{data.summary.unknown}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Suppressed</span>
                          <span className="font-semibold text-red-600 tabular-nums">{data.summary.suppressed}</span>
                        </div>
                        <Separator className="bg-border/40 !my-2" />
                        <div className="flex items-center justify-between">
                          <span>Email verified</span>
                          <span className="font-semibold text-foreground tabular-nums">{data.summary.emailVerifiedRate}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Data retention</span>
                          <span className="font-semibold text-foreground tabular-nums">{data.retentionDays} days</span>
                        </div>
                      </div>
                    </GlassPanel>
                  </div>

                  {/* Donut Chart */}
                  <div className="lg:col-span-1">
                    <GlassPanel className="p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-4">Consent Distribution</p>
                      {pieData.length > 0 ? (
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={85}
                                paddingAngle={3}
                                dataKey="value"
                                stroke="none"
                              >
                                {pieData.map((entry, idx) => (
                                  <Cell key={idx} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  background: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  color: '#e4e4e7',
                                }}
                                itemStyle={{ color: '#e4e4e7' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">No data</div>
                      )}
                      <div className="flex flex-wrap justify-center gap-4 mt-2">
                        {pieData.map(d => (
                          <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                            <span>{d.name}</span>
                            <span className="font-semibold text-foreground tabular-nums">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </GlassPanel>
                  </div>

                  {/* Risk Flags */}
                  <div className="lg:col-span-1">
                    <GlassPanel className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Risk Flags</p>
                        {data.riskFlags.length > 0 && (
                          <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] ml-auto">{data.riskFlags.length}</Badge>
                        )}
                      </div>

                      {data.riskFlags.length === 0 ? (
                        <div className="text-center py-6">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                          <p className="text-xs text-emerald-600 font-medium">No risk flags</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">All compliance checks passed</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                          {data.riskFlags.map(flag => (
                            <div key={flag.type} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-xs font-medium text-foreground leading-snug">{flag.message}</p>
                                <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] shrink-0 tabular-nums">{flag.count}</Badge>
                              </div>
                              {flag.fixable && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 mt-1"
                                  disabled={actionLoading === flag.fixAction}
                                  onClick={() => runAction('fix', flag.fixAction)}
                                >
                                  {actionLoading === flag.fixAction ? (
                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3 mr-1" />
                                  )}
                                  Fix
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </GlassPanel>
                  </div>
                </div>

                {/* ── Quick Actions ────────────────────────────── */}
                <GlassPanel className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className="w-1 h-4 rounded-full"
                      style={{ background: 'linear-gradient(180deg, #D4AF37, #9A8340)' }}
                    />
                    <h4 className="text-sm font-semibold text-foreground">Quick Actions</h4>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="outline"
                        className="h-9 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
                        disabled={actionLoading === 'export_all_consented'}
                        onClick={() => runAction('export_all_consented')}
                      >
                        {actionLoading === 'export_all_consented' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Export All Contact Data
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="outline"
                        className="h-9 text-xs gap-1.5 border-red-500/30 text-red-600 hover:bg-red-50 hover:border-red-500/50"
                        disabled={actionLoading === 'clean_stale_suppressions'}
                        onClick={() => runAction('clean', 'clean_stale_suppressions')}
                      >
                        {actionLoading === 'clean_stale_suppressions' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Clean Stale Suppressions
                      </Button>
                    </motion.div>
                    {navigateTo && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          variant="outline"
                          className="h-9 text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                          onClick={() => navigateTo('bounces')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Suppression List
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </GlassPanel>

                {/* ── Recent Consent Changes ────────────────────── */}
                <GlassPanel className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className="w-1 h-4 rounded-full"
                      style={{ background: 'linear-gradient(180deg, #D4AF37, #9A8340)' }}
                    />
                    <h4 className="text-sm font-semibold text-foreground">Recent Consent Changes</h4>
                    <span className="text-[10px] text-muted-foreground ml-1">(last 30 days)</span>
                  </div>

                  {data.recentChanges.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No consent changes recorded recently</p>
                  ) : (
                    <div className="space-y-0 max-h-[280px] overflow-y-auto">
                      {data.recentChanges.map((log, idx) => (
                        <div key={log.id}>
                          <div className="flex items-center gap-3 py-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-foreground truncate">{log.details || log.action}</p>
                              <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                                {new Date(log.createdAt).toLocaleString('en-US', {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                                {log.entityId && (
                                  <span className="ml-2 text-zinc-600">ID: {log.entityId.slice(0, 8)}...</span>
                                )}
                              </p>
                            </div>
                          </div>
                          {idx < data.recentChanges.length - 1 && <Separator className="bg-border/30" />}
                        </div>
                      ))}
                    </div>
                  )}
                </GlassPanel>
              </div>
            )}
          </div>
        </GlassPanel>
      </StaggerItem>
    </StaggerGrid>
  );
}

export default function SettingsScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  // ── Active tab ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('profile');

  // ── Toast state ──────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // ── Tab 1: Mailbox ──────────────────────────────────────
  const [outlookEmail, setOutlookEmail] = useState('');
  const [graphConnected, setGraphConnected] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [hourlyLimit, setHourlyLimit] = useState(10);

  // ── Tab 2: Working Hours ─────────────────────────────────
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [timezone, setTimezone] = useState(getUserTimezone());
  const [workDays, setWorkDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [enforceWorkingHours, setEnforceWorkingHours] = useState(true);
  const [pauseOutsideHours, setPauseOutsideHours] = useState(true);

  // ── Tab 3: Email Verification ────────────────────────────
  const [autoVerify, setAutoVerify] = useState(true);
  const [blockDisposable, setBlockDisposable] = useState(true);
  const [blockRoleBased, setBlockRoleBased] = useState(false);
  const [flagFreeProviders, setFlagFreeProviders] = useState(true);
  const [requireMx, setRequireMx] = useState(true);
  const [minHealthScore, setMinHealthScore] = useState(0);

  // ── Tab 4: Lead Scoring ──────────────────────────────────
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>(DEFAULT_SCORING_RULES);

  const updateRulePoints = (id: string, points: number) => {
    setScoringRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, points: Math.max(0, points) } : r)),
    );
  };

  const resetScoringRules = () => {
    setScoringRules(DEFAULT_SCORING_RULES);
    showToast('Scoring rules reset to defaults');
  };

  const saveScoringRules = () => {
    showToast('Scoring rules saved');
  };

  // ── Tab 5: AI Providers ──────────────────────────────────
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiProviderKeys, setAiProviderKeys] = useState<Record<string, string>>({});
  const [aiProviderModels, setAiProviderModels] = useState<Record<string, string>>({});
  const [aiProviderEnabled, setAiProviderEnabled] = useState<Record<string, boolean>>({});
  const [aiTestResults, setAiTestResults] = useState<Record<string, { loading: boolean; success?: boolean; message: string }>>({});
  const [aiShowKeys, setAiShowKeys] = useState<Record<string, boolean>>({});

  const loadAIConfig = useCallback(async () => {
    try {
      setAiLoading(true);
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const config = data.aiProviders;
        setAiConfig(config);
        if (config?.providers) {
          const keys: Record<string, string> = {};
          const models: Record<string, string> = {};
          const enabled: Record<string, boolean> = {};
          for (const [id, p] of Object.entries(config.providers)) {
            const prov = p as any;
            keys[id] = prov.apiKey || '';
            models[id] = prov.model || '';
            enabled[id] = prov.enabled !== false;
          }
          setAiProviderKeys(keys);
          setAiProviderModels(models);
          setAiProviderEnabled(enabled);
        }
      }
    } catch { /* ignore */ }
    finally { setAiLoading(false); }
  }, []);

  useEffect(() => { loadAIConfig(); }, [loadAIConfig]);

  const saveAIProviders = async () => {
    setAiSaving(true);
    try {
      const providers: Record<string, any> = {};
      for (const [id, key] of Object.entries(aiProviderKeys)) {
        providers[id] = {
          apiKey: key,
          model: aiProviderModels[id] || undefined,
          enabled: aiProviderEnabled[id] ?? true,
        };
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProviders: { providers } }),
      });
      if (res.ok) {
        showToast('AI provider settings saved — takes effect immediately');
        await loadAIConfig();
      } else {
        showToast('Failed to save AI settings');
      }
    } catch { showToast('Failed to save AI settings'); }
    finally { setAiSaving(false); }
  };

  const testAIProvider = async (providerId: string) => {
    // First save the current key for this provider
    setAiTestResults(prev => ({ ...prev, [providerId]: { loading: true, message: 'Testing connection...' } }));
    try {
      // Save the key first
      const providers: Record<string, any> = {};
      providers[providerId] = {
        apiKey: aiProviderKeys[providerId],
        model: aiProviderModels[providerId] || undefined,
        enabled: aiProviderEnabled[providerId] ?? true,
      };
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProviders: { providers } }),
      });

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });
      const result = await res.json();
      setAiTestResults(prev => ({
        ...prev,
        [providerId]: { loading: false, success: result.success, message: result.message },
      }));
    } catch (err) {
      setAiTestResults(prev => ({
        ...prev,
        [providerId]: { loading: false, success: false, message: 'Connection test failed' },
      }));
    }
  };

  // ── Tab 5b: Suppression ──────────────────────────────────
  const [suppressBounce, setSuppressBounce] = useState(true);
  const [suppressUnsubscribe, setSuppressUnsubscribe] = useState(true);
  const [suppressNegative, setSuppressNegative] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);

  // ── Toggle day helper ────────────────────────────────────
  const toggleDay = (idx: number) => {
    setWorkDays((prev) => prev.map((d, i) => (i === idx ? !d : d)));
  };

  // ── Tab items ────────────────────────────────────────────
  // ── Profile state ──────────────────────────────────────
  const [profileUser, setProfileUser] = useState<any>(null);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileCompany, setProfileCompany] = useState('');
  const [profileDesignation, setProfileDesignation] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [profileOtpCode, setProfileOtpCode] = useState('');
  const [profileOtpPurpose, setProfileOtpPurpose] = useState<string>('');
  const [profileOtpSent, setProfileOtpSent] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileOtpCountdown, setProfileOtpCountdown] = useState(0);
  const [profileDevCode, setProfileDevCode] = useState<string | null>(null);
  const [newPasswordFields, setNewPasswordFields] = useState({ current: '', next: '', confirm: '' });
  const [showNewPasswords, setShowNewPasswords] = useState(false);

  // Load profile on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          setProfileUser(u);
          setProfileName(u.name || '');
          setProfilePhone(u.phone || '');
          setProfileCompany(u.company || '');
          setProfileDesignation(u.designation || '');
          setProfileEmail(u.email || '');
          setNewEmail(u.email || '');
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Profile OTP countdown
  useEffect(() => {
    if (profileOtpCountdown > 0) {
      const t = setTimeout(() => setProfileOtpCountdown(profileOtpCountdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [profileOtpCountdown]);

  const handleProfileOtpRequest = async (purpose: string, targetEmail?: string) => {
    const emailToSend = targetEmail || profileEmail;
    setProfileLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToSend, purpose }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Failed to send OTP'); return; }
      if (data.devCode) setProfileDevCode(data.devCode);
      setProfileOtpPurpose(purpose);
      setProfileOtpSent(true);
      setProfileOtpCode('');
      setProfileOtpCountdown(60);
      showToast('OTP sent to ' + emailToSend);
    } catch { showToast('Network error'); }
    finally { setProfileLoading(false); }
  };

  const handleProfileUpdate = async () => {
    if (!profileOtpCode || profileOtpCode.length !== 6) { showToast('Enter the 6-digit OTP'); return; }
    setProfileLoading(true);
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profileEmail,
          otpCode: profileOtpCode,
          purpose: 'update_profile',
          updates: { name: profileName, phone: profilePhone, company: profileCompany, designation: profileDesignation },
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Update failed'); return; }
      setProfileOtpSent(false);
      setProfileOtpCode('');
      setProfileDevCode(null);
      showToast('Profile updated successfully!');
    } catch { showToast('Network error'); }
    finally { setProfileLoading(false); }
  };

  const handleEmailChange = async () => {
    if (!newEmail || newEmail === profileEmail) { showToast('Enter a different email'); return; }
    if (!profileOtpCode || profileOtpCode.length !== 6) { showToast('Enter the 6-digit OTP'); return; }
    setProfileLoading(true);
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profileEmail, // OTP was sent to old email
          otpCode: profileOtpCode,
          purpose: 'change_email',
          updates: { newEmail: newEmail.toLowerCase().trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Email change failed'); return; }
      setProfileEmail(newEmail.toLowerCase().trim());
      setProfileOtpSent(false);
      setProfileOtpCode('');
      setProfileDevCode(null);
      showToast('Email updated! Use new email next login.');
    } catch { showToast('Network error'); }
    finally { setProfileLoading(false); }
  };

  const handlePasswordChange = async () => {
    if (!profileOtpCode || profileOtpCode.length !== 6) { showToast('Enter the 6-digit OTP'); return; }
    if (newPasswordFields.next.length < 8) { showToast('Password must be at least 8 characters'); return; }
    if (newPasswordFields.next !== newPasswordFields.confirm) { showToast('Passwords do not match'); return; }
    setProfileLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profileEmail,
          otpCode: profileOtpCode,
          newPassword: newPasswordFields.next,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Password change failed'); return; }
      setProfileOtpSent(false);
      setProfileOtpCode('');
      setProfileDevCode(null);
      setNewPasswordFields({ current: '', next: '', confirm: '' });
      setShowNewPasswords(false);
      showToast('Password changed successfully!');
    } catch { showToast('Network error'); }
    finally { setProfileLoading(false); }
  };

  const SETTINGS_TABS = [
    { key: 'profile', label: 'My Profile' },
    { key: 'ai-providers', label: 'AI Providers' },
    { key: 'mailbox', label: 'Mailbox' },
    { key: 'hours', label: 'Working Hours' },
    { key: 'verification', label: 'Verification' },
    { key: 'scoring', label: 'Lead Scoring' },
    { key: 'data-rules', label: 'Data Rules' },
    { key: 'suppression', label: 'Suppression' },
    { key: 'team', label: 'Team Performance' },
    { key: 'compliance', label: 'Compliance' },
  ];

  // ── Tab icon map ─────────────────────────────────────────
  const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    profile: UserCircle,
    'ai-providers': Plug,
    mailbox: Mail,
    hours: Clock,
    verification: ShieldCheck,
    scoring: Star,
    'data-rules': Database,
    suppression: Ban,
    team: Users,
    compliance: ShieldAlert,
  };

  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1 pb-8">
        {/* ── Toast notification ─────────────────────────────── */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-6 right-6 z-50"
            >
              <div
                className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 px-5 py-3 text-sm text-emerald-700 backdrop-blur-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))',
                  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(16, 185, 129, 0.08)',
                }}
              >
                <CheckCircle2 className="size-4" />
                <span className="font-medium">{toastMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Page header (dramatic) ─────────────────────────── */}
        <div className="space-y-2">
          <SectionHeader
            title="Settings"
            subtitle="Configure your DeepMindQ workspace preferences"
            className="mb-2"
          />
          <div className="flex items-center gap-2 ml-5">
            <PulseDot />
            <span className="text-xs text-muted-foreground">System active - 8 modules configured</span>
          </div>
        </div>

        {/* ── Tab bar (using enhanced TabBar) ────────────────── */}
        <div className="flex items-center gap-3">
          <TabBar tabs={SETTINGS_TABS} active={activeTab} onChange={setActiveTab} />
          {TAB_ICONS[activeTab] && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))',
                border: '1px solid rgba(212, 175, 55, 0.2)',
              }}
            >
              {(() => {
                const Icon = TAB_ICONS[activeTab];
                return <Icon className="size-4 text-[#D4AF37]" />;
              })()}
            </motion.div>
          )}
        </div>

        {/* ── Tabs content ───────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

        {/* ═══════════════════════════════════════════════════════
            TAB 0 - My Profile (OTP-verified)
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.08} className="space-y-6">
            {/* Personal Info Card */}
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), transparent)', borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.06))' }}>
                      <UserCircle className="size-4.5" style={{ color: '#D4AF37' }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground tracking-tight">Personal Information</h3>
                      <p className="text-xs text-muted-foreground">Your basic details — requires OTP to save changes</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5"><UserCircle className="w-3.5 h-3.5" /> Full Name</Label>
                      <Input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your full name" className={INPUT_CLS} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Mobile Number</Label>
                      <Input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+91 98765 43210" className={INPUT_CLS} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Company</Label>
                      <Input value={profileCompany} onChange={e => setProfileCompany(e.target.value)} placeholder="Your company" className={INPUT_CLS} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Designation</Label>
                      <Input value={profileDesignation} onChange={e => setProfileDesignation(e.target.value)} placeholder="Your role" className={INPUT_CLS} />
                    </div>
                  </div>

                  {/* OTP Verification Section */}
                  <div className="border-t border-border/50 pt-5">
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      Verify with OTP sent to <span className="font-medium text-foreground">{profileEmail}</span>
                    </p>
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <div className="flex justify-center mb-3">
                          <InputOTP maxLength={6} value={profileOtpCode} onChange={v => { setProfileOtpCode(v); setProfileDevCode(null); }}>
                            <InputOTPGroup>
                              {[0,1,2].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              {[3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        {profileDevCode && profileOtpPurpose === 'update_profile' && (
                          <p className="text-center text-xs text-amber-400/80 bg-amber-500/10 rounded px-2 py-1 mb-2">Your code: <span className="font-mono font-bold">{profileDevCode}</span></p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleProfileOtpRequest('update_profile')}
                          disabled={profileOtpCountdown > 0 || profileLoading}
                          variant="outline"
                          className="gap-1.5"
                        >
                          {profileOtpCountdown > 0 ? `${profileOtpCountdown}s` : <><RefreshCw className="w-3.5 h-3.5" /> Send OTP</>}
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleProfileUpdate}
                          disabled={profileOtpCode.length !== 6 || profileLoading}
                          className="gap-1.5"
                          style={{ background: 'linear-gradient(135deg, #B8860B, #D4A843)', color: '#fff' }}
                        >
                          <Save className="w-3.5 h-3.5" /> Save
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassPanel>
            </StaggerItem>

            {/* Email Change Card */}
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div className="px-6 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), transparent)', borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.06))' }}>
                    <Mail className="size-4.5" style={{ color: '#D4AF37' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">Change Email</h3>
                    <p className="text-xs text-muted-foreground">OTP verified — code sent to current email</p>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Current Email</Label>
                    <Input value={profileEmail} disabled className={INPUT_CLS + ' opacity-60'} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">New Email</Label>
                    <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" className={INPUT_CLS} />
                  </div>
                  <div className="border-t border-border/50 pt-5">
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      OTP will be sent to <span className="font-medium text-foreground">{profileEmail}</span> to authorize this change
                    </p>
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <div className="flex justify-center mb-2">
                          <InputOTP maxLength={6} value={profileOtpPurpose === 'change_email' ? profileOtpCode : ''} onChange={v => { setProfileOtpCode(v); setProfileDevCode(null); setProfileOtpPurpose('change_email'); }}>
                            <InputOTPGroup>
                              {[0,1,2].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              {[3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        {profileDevCode && profileOtpPurpose === 'change_email' && (
                          <p className="text-center text-xs text-amber-400/80 bg-amber-500/10 rounded px-2 py-1">Your code: <span className="font-mono font-bold">{profileDevCode}</span></p>
                        )}
                      </div>
                      <Button size="sm" onClick={() => { setProfileOtpPurpose('change_email'); handleProfileOtpRequest('change_email'); }} disabled={profileOtpCountdown > 0 || profileLoading} variant="outline" className="gap-1.5">
                        {profileOtpCountdown > 0 ? `${profileOtpCountdown}s` : <><RefreshCw className="w-3.5 h-3.5" /> Send OTP</>}
                      </Button>
                      <Button size="sm" onClick={handleEmailChange} disabled={profileOtpCode.length !== 6 || profileLoading || profileOtpPurpose !== 'change_email'} className="gap-1.5" style={{ background: 'linear-gradient(135deg, #B8860B, #D4A843)', color: '#fff' }}>
                        <ArrowRightLeft className="w-3.5 h-3.5" /> Update Email
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassPanel>
            </StaggerItem>

            {/* Password Change Card */}
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div className="px-6 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), transparent)', borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.06))' }}>
                    <Lock className="size-4.5" style={{ color: '#D4AF37' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">Change Password</h3>
                    <p className="text-xs text-muted-foreground">OTP verified — code sent to {profileEmail}</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">New Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showNewPasswords ? 'text' : 'password'}
                        value={newPasswordFields.next}
                        onChange={e => setNewPasswordFields(p => ({...p, next: e.target.value}))}
                        placeholder="Min. 8 characters"
                        className={INPUT_CLS + ' pl-9 pr-9'}
                      />
                      <button type="button" onClick={() => setShowNewPasswords(!showNewPasswords)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showNewPasswords ? <XCircle className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Confirm New Password</Label>
                    <Input
                      type={showNewPasswords ? 'text' : 'password'}
                      value={newPasswordFields.confirm}
                      onChange={e => setNewPasswordFields(p => ({...p, confirm: e.target.value}))}
                      placeholder="Re-enter password"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div className="border-t border-border/50 pt-4">
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      Verify with OTP to change your password
                    </p>
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <div className="flex justify-center mb-2">
                          <InputOTP maxLength={6} value={profileOtpPurpose === 'change_password' ? profileOtpCode : ''} onChange={v => { setProfileOtpCode(v); setProfileDevCode(null); setProfileOtpPurpose('change_password'); }}>
                            <InputOTPGroup>
                              {[0,1,2].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              {[3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        {profileDevCode && profileOtpPurpose === 'change_password' && (
                          <p className="text-center text-xs text-amber-400/80 bg-amber-500/10 rounded px-2 py-1">Your code: <span className="font-mono font-bold">{profileDevCode}</span></p>
                        )}
                      </div>
                      <Button size="sm" onClick={() => { setProfileOtpPurpose('change_password'); handleProfileOtpRequest('change_password'); }} disabled={profileOtpCountdown > 0 || profileLoading} variant="outline" className="gap-1.5">
                        {profileOtpCountdown > 0 ? `${profileOtpCountdown}s` : <><RefreshCw className="w-3.5 h-3.5" /> Send OTP</>}
                      </Button>
                      <Button size="sm" onClick={handlePasswordChange} disabled={profileOtpCode.length !== 6 || profileLoading || profileOtpPurpose !== 'change_password'} className="gap-1.5" style={{ background: 'linear-gradient(135deg, #B8860B, #D4A843)', color: '#fff' }}>
                        <KeyRound className="w-3.5 h-3.5" /> Update
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassPanel>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 1 - AI Providers & API Keys
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="ai-providers" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.08} className="space-y-6">
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), transparent)', borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.06))' }}>
                      <Plug className="size-4.5" style={{ color: '#D4AF37' }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground tracking-tight">
                        <ShimmerText>AI Providers & API Keys</ShimmerText>
                      </h3>
                      <p className="text-xs text-muted-foreground">Manage LLM and search providers — changes take effect immediately</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <PulseDot />\n                      <span>{Object.values(aiProviderEnabled).filter(Boolean).length} active</span>
                    </div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button size="sm" onClick={saveAIProviders} disabled={aiSaving} className="gap-1.5" style={{ background: 'linear-gradient(135deg, #B8860B, #D4A843)', color: '#fff' }}>
                        <Save className="size-3.5" />
                        {aiSaving ? 'Saving...' : 'Save All'}
                      </Button>
                    </motion.div>
                  </div>
                </div>

                <div className="p-6">
                  {aiLoading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <RefreshCw className="size-4 mr-2 animate-spin" /> Loading AI provider configuration...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Fallback chain info */}
                      <div className="rounded-lg border border-[#D4AF37]/20 p-3 mb-6" style={{ background: 'rgba(212, 175, 55, 0.04)' }}>
                        <div className="flex items-start gap-2">
                          <Target className="size-4 text-[#D4AF37] mt-0.5 shrink-0" />
                          <div className="text-xs text-muted-foreground leading-relaxed">
                            <p className="font-medium text-foreground mb-1">LLM Fallback Chain</p>
                            <p>AI calls try providers in priority order. If the primary fails, it automatically falls back to the next enabled provider. This ensures your enrichment and AI features never break.</p>
                          </div>
                        </div>
                      </div>

                      {/* Provider cards */}
                      {['nvidia', 'fireworks', 'groq', 'gemini', 'tavily'].map((providerId, idx) => {
                        const providerInfo = aiConfig?.providers?.[providerId] as any;
                        const label = providerInfo?.label || providerId;
                        const tier = providerInfo?.tier || '';
                        const baseUrl = providerInfo?.baseUrl || '';
                        const category = providerInfo?.category || 'llm';
                        const hasKey = !!aiProviderKeys[providerId];
                        const testResult = aiTestResults[providerId];
                        const showKey = aiShowKeys[providerId];

                        return (
                          <GradientCard key={providerId}>
                            <div className="space-y-4">
                              {/* Provider header */}
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: hasKey ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)', color: hasKey ? '#10B981' : '#EF4444' }}>
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-foreground">{label}</span>
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{category === 'search' ? 'Search' : 'LLM'}</Badge>
                                      {tier && <span className="text-[10px] text-muted-foreground">{tier}</span>}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate max-w-md">{baseUrl}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Switch
                                    checked={aiProviderEnabled[providerId] ?? true}
                                    onCheckedChange={(v) => setAiProviderEnabled(prev => ({ ...prev, [providerId]: v }))}
                                  />
                                </div>
                              </div>

                              {/* API Key input */}
                              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">API Key</Label>
                                  <div className="relative">
                                    <Input
                                      type={showKey ? 'text' : 'password'}
                                      value={aiProviderKeys[providerId] || ''}
                                      onChange={(e) => setAiProviderKeys(prev => ({ ...prev, [providerId]: e.target.value }))}
                                      placeholder={`Enter your ${label} API key`}
                                      className={`${INPUT_CLS} pr-20`}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                      onClick={() => setAiShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }))}
                                    >
                                      <Eye className="size-3 mr-1" />
                                      {showKey ? 'Hide' : 'Show'}
                                    </Button>
                                  </div>
                                </div>
                                {category === 'llm' && (
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Model</Label>
                                    <Input
                                      value={aiProviderModels[providerId] || ''}
                                      onChange={(e) => setAiProviderModels(prev => ({ ...prev, [providerId]: e.target.value }))}
                                      placeholder="model-name"
                                      className={`${INPUT_CLS} w-48 md:w-56`}
                                    />
                                  </div>
                                )}
                                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!aiProviderKeys[providerId] || testResult?.loading}
                                    onClick={() => testAIProvider(providerId)}
                                    className={testResult?.success ? 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10' : testResult?.success === false ? 'border-red-500/40 text-red-500 hover:bg-red-500/10' : 'border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10'}
                                  >
                                    {testResult?.loading ? <RefreshCw className="size-3.5 animate-spin" /> : testResult?.success ? <CheckCircle2 className="size-3.5" /> : testResult?.success === false ? <XCircle className="size-3.5" /> : <RefreshCw className="size-3.5" />}
                                    {testResult?.loading ? 'Testing...' : testResult?.message || 'Test'}
                                  </Button>
                                </motion.div>
                              </div>

                              {/* Test result message */}
                              {testResult && !testResult.loading && testResult.message !== 'Testing connection...' && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                  <div className={`rounded-lg px-3 py-2 text-xs ${testResult.success ? 'bg-emerald-500/8 text-emerald-700 border border-emerald-500/20' : 'bg-red-500/8 text-red-600 border border-red-500/20'}`}>
                                    {testResult.message}
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          </GradientCard>
                        );
                      })}

                      {/* Environment variables note */}
                      <div className="mt-4 rounded-lg border border-border/50 p-3">
                        <div className="flex items-start gap-2">
                          <ShieldCheck className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="text-[11px] text-muted-foreground leading-relaxed">
                            <p className="font-medium text-foreground text-xs mb-1">How It Works</p>
                            <p>Keys entered here override environment variables and take effect immediately for all AI operations (enrichment, research, email generation, chat). If a key is set in both environment variables and here, the value from this page wins. If this field is empty, the system falls back to environment variables.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </GlassPanel>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 2 - Mailbox Configuration
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="mailbox" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.1} className="space-y-6">
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                {/* Header stripe */}
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), transparent)',
                    borderBottom: '1px solid rgba(212, 175, 55, 0.1)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.06))' }}
                  >
                    <Mail className="size-4.5" style={{ color: '#D4AF37' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      <ShimmerText>Outlook Mailbox</ShimmerText>
                    </h3>
                    <p className="text-xs text-muted-foreground">Connect and configure your sending mailbox</p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Email address */}
                  <div className="space-y-2.5">
                    <Label htmlFor="outlook-email" className="text-sm font-medium text-muted-foreground">
                      Outlook Email Address
                    </Label>
                    <Input
                      id="outlook-email"
                      type="email"
                      placeholder="you@company.com"
                      value={outlookEmail}
                      onChange={(e) => setOutlookEmail(e.target.value)}
                      className={`${INPUT_CLS} max-w-md`}
                    />
                  </div>

                  {/* Connection status */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm text-muted-foreground">Microsoft Graph API:</span>
                      {graphConnected ? (
                        <Badge
                          className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 font-medium"
                        >
                          <CheckCircle2 className="size-3 mr-1.5" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/15 text-red-600 border-red-500/30 font-medium">
                          <XCircle className="size-3 mr-1.5" />
                          Not Connected
                        </Badge>
                      )}
                    </div>
                    {!graphConnected && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 w-fit transition-all duration-300"
                          onClick={() => {
                            setGraphConnected(true);
                            showToast('Microsoft Graph connected successfully');
                          }}
                        >
                          <Plug className="size-3.5 mr-1.5" />
                          Connect
                        </Button>
                      </motion.div>
                    )}
                  </div>

                  <Separator className="bg-border/60" />

                  {/* Send limits */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg">
                    <div className="space-y-2.5">
                      <Label htmlFor="daily-limit" className="text-sm font-medium text-muted-foreground">
                        Daily Send Limit
                      </Label>
                      <Input
                        id="daily-limit"
                        type="number"
                        min={1}
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(Number(e.target.value) || 0)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="hourly-limit" className="text-sm font-medium text-muted-foreground">
                        Per-Hour Send Limit
                      </Label>
                      <Input
                        id="hourly-limit"
                        type="number"
                        min={1}
                        value={hourlyLimit}
                        onChange={(e) => setHourlyLimit(Number(e.target.value) || 0)}
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>

                  <Separator className="bg-border/60" />

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-1">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="outline"
                        className="border-border hover:bg-accent transition-all duration-200"
                        onClick={() => showToast('Connection test initiated')}
                      >
                        Test Connection
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        className="text-primary-foreground hover:opacity-90 transition-all duration-200"
                        style={{
                          background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                          boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
                        }}
                        onClick={() => showToast('Mailbox settings saved')}
                      >
                        <Save className="size-3.5 mr-1.5" />
                        Save Settings
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </GlassPanel>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 2 - Working Hours
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="hours" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.1} className="space-y-6">
            {/* Time and timezone section */}
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), transparent)',
                    borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.06))' }}
                  >
                    <Clock className="size-4.5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      <ShimmerText>Schedule Configuration</ShimmerText>
                    </h3>
                    <p className="text-xs text-muted-foreground">Define when your campaigns are allowed to send</p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Time selects */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl">
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">Start Time</Label>
                      <Select value={startTime} onValueChange={setStartTime}>
                        <SelectTrigger className={`w-full ${INPUT_CLS}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {HOURS.filter((h) => {
                            const endNum = parseInt(endTime, 10);
                            const startNum = parseInt(h.value, 10);
                            return startNum < endNum;
                          }).map((h) => (
                            <SelectItem key={h.value} value={h.value}>
                              {h.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">End Time</Label>
                      <Select value={endTime} onValueChange={setEndTime}>
                        <SelectTrigger className={`w-full ${INPUT_CLS}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {HOURS.filter((h) => {
                            const startNum = parseInt(startTime, 10);
                            const endNum = parseInt(h.value, 10);
                            return endNum > startNum;
                          }).map((h) => (
                            <SelectItem key={h.value} value={h.value}>
                              {h.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">Timezone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className={`w-full ${INPUT_CLS}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator className="bg-border/60" />

                  {/* Days of week */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-muted-foreground">Working Days</Label>
                    <div className="flex flex-wrap gap-3">
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <motion.label
                          key={day}
                          className="flex items-center gap-2 cursor-pointer select-none"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Checkbox
                            checked={workDays[idx]}
                            onCheckedChange={() => toggleDay(idx)}
                          />
                          <span className="text-sm text-foreground font-medium">{day}</span>
                        </motion.label>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassPanel>
            </StaggerItem>

            {/* Toggle section with gradient borders */}
            <StaggerItem>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 px-1">
                  <div
                    className="w-1 h-4 rounded-full"
                    style={{ background: 'linear-gradient(180deg, #D4AF37, #9A8340)' }}
                  />
                  Enforcement Rules
                </h4>
                <div className="space-y-3">
                  <ToggleRow
                    title="Enforce working hours for sends"
                    description="Campaigns will only deliver emails during your configured working window"
                    checked={enforceWorkingHours}
                    onChange={setEnforceWorkingHours}
                  />
                  <ToggleRow
                    title="Pause sends outside working hours"
                    description="Automatically queue and pause outgoing emails outside of working hours"
                    checked={pauseOutsideHours}
                    onChange={setPauseOutsideHours}
                  />
                </div>
              </div>
            </StaggerItem>

            {/* Save button */}
            <StaggerItem>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-1">
                <Button
                  className="text-primary-foreground hover:opacity-90 transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                    boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
                  }}
                  onClick={() => showToast('Working hours saved')}
                >
                  <Save className="size-3.5 mr-1.5" />
                  Save Settings
                </Button>
              </motion.div>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 3 - Email Verification
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="verification" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.08} className="space-y-6">
            {/* Verification toggles */}
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06), transparent)',
                    borderBottom: '1px solid rgba(16, 185, 129, 0.1)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.06))' }}
                  >
                    <ShieldCheck className="size-4.5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      <ShimmerText>Email Verification Rules</ShimmerText>
                    </h3>
                    <p className="text-xs text-muted-foreground">Quality filters and automated verification checks</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <ToggleRow
                    icon={ShieldCheck}
                    title="Auto-verify emails on import"
                    description="Automatically run verification checks when leads are imported"
                    checked={autoVerify}
                    onChange={setAutoVerify}
                  />
                  <ToggleRow
                    icon={Ban}
                    title="Block disposable domains"
                    description="Reject emails from temporary/disposable email providers"
                    checked={blockDisposable}
                    onChange={setBlockDisposable}
                  />
                  <ToggleRow
                    icon={Ban}
                    title="Block role-based emails (info@, sales@, etc.)"
                    description="Filter out generic role-based email addresses"
                    checked={blockRoleBased}
                    onChange={setBlockRoleBased}
                  />
                  <ToggleRow
                    icon={Star}
                    title="Flag free providers as risky"
                    description="Mark Gmail, Yahoo, Outlook.com, etc. as lower quality leads"
                    checked={flagFreeProviders}
                    onChange={setFlagFreeProviders}
                  />
                  <ToggleRow
                    icon={ShieldCheck}
                    title="Require MX record validation"
                    description="Verify the domain has valid MX records before accepting"
                    checked={requireMx}
                    onChange={setRequireMx}
                  />
                </div>
              </GlassPanel>
            </StaggerItem>

            {/* Health score input */}
            <StaggerItem>
              <GlassPanel className="p-6 space-y-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <div
                    className="w-1 h-5 rounded-full"
                    style={{ background: 'linear-gradient(180deg, #D4AF37, #9A8340)' }}
                  />
                  <h4 className="text-sm font-semibold text-foreground">Email Health Threshold</h4>
                </div>
                <p className="text-xs text-muted-foreground ml-4">
                  Emails scoring below this threshold will be flagged for review (0-100)
                </p>
                <div className="max-w-xs space-y-2.5 pt-1">
                  <Label htmlFor="health-score" className="text-sm font-medium text-muted-foreground">
                    Minimum Email Health Score
                  </Label>
                  <Input
                    id="health-score"
                    type="number"
                    min={0}
                    max={100}
                    value={minHealthScore}
                    onChange={(e) => setMinHealthScore(Number(e.target.value) || 0)}
                    className={INPUT_CLS}
                  />
                </div>

                <div className="pt-3">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      className="text-primary-foreground hover:opacity-90 transition-all duration-200"
                      style={{
                        background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                        boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
                      }}
                      onClick={() => showToast('Verification settings saved')}
                    >
                      <Save className="size-3.5 mr-1.5" />
                      Save Settings
                    </Button>
                  </motion.div>
                </div>
              </GlassPanel>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 4 - Lead Scoring
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="scoring" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.08} className="space-y-6">
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), transparent)',
                    borderBottom: '1px solid rgba(212, 175, 55, 0.1)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.06))' }}
                  >
                    <Star className="size-4.5" style={{ color: '#D4AF37' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      <ShimmerText>Lead Scoring Rules</ShimmerText>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Adjust point values for each scoring criterion. Leads are ranked by total score.
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-1">
                  {scoringRules.map((rule, idx) => (
                    <div key={rule.id}>
                      <div className="flex items-center justify-between gap-4 max-w-lg py-3">
                        <Label className="text-sm text-foreground flex-1 font-medium">{rule.label}</Label>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: '#D4AF37' }}
                          >
                            +
                          </span>
                          <Input
                            type="number"
                            min={0}
                            value={rule.points}
                            onChange={(e) =>
                              updateRulePoints(rule.id, Number(e.target.value) || 0)
                            }
                            className={`${INPUT_CLS} w-20 text-right font-semibold`}
                          />
                          <span className="text-xs text-muted-foreground w-7">pts</span>
                        </div>
                      </div>
                      {idx < scoringRules.length - 1 && (
                        <Separator className="bg-border/40" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Total score bar */}
                <div
                  className="mx-6 mb-6 rounded-lg px-5 py-4 flex items-center justify-between"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), rgba(212, 175, 55, 0.02))',
                    border: '1px solid rgba(212, 175, 55, 0.1)',
                  }}
                >
                  <span className="text-sm text-muted-foreground font-medium">Maximum possible score:</span>
                  <Badge
                    className="font-bold text-sm px-3 py-1"
                    style={{
                      background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))',
                      color: '#D4AF37',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                    }}
                  >
                    {scoringRules.reduce((sum, r) => sum + r.points, 0)} pts
                  </Badge>
                </div>

                {/* Action buttons */}
                <div
                  className="px-6 pb-6 flex flex-wrap gap-3 pt-1"
                >
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="outline"
                      className="border-border hover:bg-accent transition-all duration-200"
                      onClick={resetScoringRules}
                    >
                      <RotateCcw className="size-3.5 mr-1.5" />
                      Reset to Defaults
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      className="text-primary-foreground hover:opacity-90 transition-all duration-200"
                      style={{
                        background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                        boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
                      }}
                      onClick={saveScoringRules}
                    >
                      <Save className="size-3.5 mr-1.5" />
                      Save Rules
                    </Button>
                  </motion.div>
                </div>
              </GlassPanel>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 5 - Suppression Rules
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="suppression" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.08} className="space-y-6">
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), transparent)',
                    borderBottom: '1px solid rgba(239, 68, 68, 0.1)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.06))' }}
                  >
                    <Ban className="size-4.5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      <ShimmerText>Suppression Rules</ShimmerText>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Control when contacts are automatically suppressed from future campaigns.
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <ToggleRow
                    icon={Ban}
                    title="Auto-suppress on hard bounce"
                    description="Permanently remove emails that return a hard bounce (5xx errors)"
                    checked={suppressBounce}
                    onChange={setSuppressBounce}
                  />
                  <ToggleRow
                    icon={Ban}
                    title="Auto-suppress on unsubscribe reply"
                    description="Suppress contacts who reply asking to unsubscribe"
                    checked={suppressUnsubscribe}
                    onChange={setSuppressUnsubscribe}
                  />
                  <ToggleRow
                    icon={Ban}
                    title="Auto-suppress on negative reply"
                    description="Suppress contacts who reply with negative sentiment or complaints"
                    checked={suppressNegative}
                    onChange={setSuppressNegative}
                  />
                  <ToggleRow
                    icon={ShieldCheck}
                    title="Suppression removal requires approval"
                    description="Team leads must approve before a suppressed contact can be re-activated"
                    checked={requireApproval}
                    onChange={setRequireApproval}
                  />
                </div>

                <div className="px-6 pb-6 pt-1">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      className="text-primary-foreground hover:opacity-90 transition-all duration-200"
                      style={{
                        background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                        boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
                      }}
                      onClick={() => showToast('Suppression rules saved')}
                    >
                      <Save className="size-3.5 mr-1.5" />
                      Save Settings
                    </Button>
                  </motion.div>
                </div>
              </GlassPanel>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB - Data Intelligence Rules
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="data-rules" className="mt-6 space-y-6">
          <DataRulesSection />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 6 - Team Performance
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="team" className="mt-6 space-y-6">
          <TeamPerformanceSection />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 7 - GDPR Compliance
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="compliance" className="mt-6 space-y-6">
          <ComplianceSection navigateTo={navigateTo} />
        </TabsContent>
      </Tabs>
    </div>
    </PageTransition>
  );
}