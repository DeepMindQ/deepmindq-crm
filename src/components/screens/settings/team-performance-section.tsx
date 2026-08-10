'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Users, Target, MessageSquare, Trophy, RefreshCw, ArrowRightLeft,
} from 'lucide-react';
import {
  GlassPanel, StaggerGrid, StaggerItem, StatCard, ShimmerText,
} from '@/components/ui/animated-components';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { cardSolid, colors, textSecondary } from '@/components/design-system';

// ── Dynamic opacity helpers (from design token base colors) ─────────────
const goldAlpha = (a: number) => `rgba(212,175,55,${a})`;
const blackAlpha = (a: number) => `rgba(0,0,0,${a})`;

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface TeamMember {
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

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const STATUS_ORDER = ['imported', 'cleaned', 'drafted', 'queued', 'sent', 'replied', 'bounced'] as const;
const STATUS_COLORS: Record<string, string> = {
  imported: textSecondary,
  cleaned: colors.purple,
  drafted: colors.blue,
  queued: colors.amber,
  sent: 'var(--color-gold)',
  replied: colors.green,
  bounced: colors.red,
};

/* ═══════════════════════════════════════════════════════════════
   Custom recharts tooltip
   ═══════════════════════════════════════════════════════════════ */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-lg px-3 py-2 text-xs backdrop-blur-sm">
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

/* ═══════════════════════════════════════════════════════════════
   Team Performance Section
   ═══════════════════════════════════════════════════════════════ */

export default function TeamPerformanceSection() {
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

  useEffect(() => { fetchPerformance(); }, [fetchPerformance]);

  const runAssignment = async (method: 'unassigned' | 'all') => {
    setAssigning(true);
    try {
      const url = '/api/leads/assign';
      const res = await fetch(url);
      const summary = await res.json();
      const assignRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: ['_all'], method: 'round_robin', _assignMode: method }),
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

  const totalTeamSize = members.length;
  const totalContacts = members.reduce((s, m) => s + m.totalAssigned, 0);
  const teamAvgReplyRate = members.length > 0
    ? Math.round(members.reduce((s, m) => s + m.replyRate, 0) / members.length) : 0;
  const topPerformer = members.length > 0 ? members[0] : null;

  return (
    <StaggerGrid stagger={0.08} className="space-y-6">
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div
            className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap"
            style={{
              background: `linear-gradient(135deg, ${goldAlpha(0.06)}, transparent)`,
              borderBottom: `1px solid ${goldAlpha(0.1)}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${goldAlpha(0.2)}, ${goldAlpha(0.06)})` }}>
                <Users className="size-4.5" style={{ color: 'var(--color-gold)' }} />
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
                <Button size="sm" variant="outline" disabled={assigning}
                  className="border-[var(--color-gold-dim)]/40 text-[var(--color-gold-dim)] hover:bg-[var(--color-gold-dim)]/10 transition-all duration-300"
                  onClick={() => runAssignment('unassigned')}>
                  {assigning ? <RefreshCw className="size-3.5 mr-1.5 animate-spin" /> : <ArrowRightLeft className="size-3.5 mr-1.5" />}
                  Auto-Assign Unassigned
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button size="sm" variant="outline" disabled={assigning}
                  className="border-border text-muted-foreground hover:bg-accent transition-all duration-300"
                  onClick={() => runAssignment('all')}>
                  <RefreshCw className={`size-3.5 mr-1.5 ${assigning ? 'animate-spin' : ''}`} />
                  Rebalance
                </Button>
              </motion.div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Team Size" value={totalTeamSize} icon={Users} color="var(--color-gold)" delay={0} />
              <StatCard label="Total Assigned" value={totalContacts} icon={Target} color={colors.blue} delay={0.05} />
              <StatCard label="Avg Reply Rate" value={`${teamAvgReplyRate}%`} icon={MessageSquare} color={colors.green} delay={0.1} />
              <StatCard label="Top Performer" value={topPerformer ? topPerformer.name.split(' ')[0] : '—'} icon={Trophy} color={colors.amber} delay={0.15} />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="size-5 text-[var(--color-gold-dim)] animate-spin" />
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
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                          style={{ background: cardSolid, border: '1px solid var(--ios-border-light)', boxShadow: `0 4px 16px ${blackAlpha(0.12)}`, backdropFilter: 'blur(8px)' }}>
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
                          const replyColor = m.replyRate > 20 ? colors.green : m.replyRate >= 10 ? colors.amber : colors.red;
                          const barData = STATUS_ORDER.filter(s => (m.statusBreakdown[s] || 0) > 0).map(s => ({ name: s, value: m.statusBreakdown[s] || 0 }));
                          const barTotal = barData.reduce((sum, d) => sum + d.value, 0);

                          return (
                            <motion.tr key={m.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05, duration: 0.3 }} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                    style={{ background: 'linear-gradient(135deg, var(--color-gold-dim), var(--ios-gold-dark))', boxShadow: idx === 0 ? `0 0 12px ${goldAlpha(0.4)}` : 'none' }}>
                                    {m.avatar}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                                    {idx === 0 && <span className="text-[11px] font-semibold text-[var(--color-gold-dim)] flex items-center gap-1"><Trophy className="size-2.5" /> Top Performer</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">{m.totalAssigned}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">{sentCount}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{repliedCount}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-red-600">{bouncedCount}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-bold tabular-nums" style={{ color: replyColor }}>{m.replyRate}%</span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{m.avgScore}</td>
                              <td className="px-4 py-3">
                                <div className="h-2.5 rounded-full overflow-hidden bg-gray-100 flex">
                                  {barData.map(d => {
                                    const pct = barTotal > 0 ? (d.value / barTotal) * 100 : 0;
                                    return <motion.div key={d.name} initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                      transition={{ delay: idx * 0.05 + 0.2, duration: 0.6 }} className="h-full"
                                      style={{ background: STATUS_COLORS[d.name] || textSecondary }} title={`${d.name}: ${d.value}`} />;
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

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {members.slice(0, 4).map((m, idx) => {
                    const chartData = STATUS_ORDER.filter(s => (m.statusBreakdown[s] || 0) > 0)
                      .map(s => ({ name: s.charAt(0).toUpperCase() + s.slice(1, 4), value: m.statusBreakdown[s] || 0, color: STATUS_COLORS[s] }));
                    return (
                      <motion.div key={m.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + idx * 0.08 }}>
                        <GlassPanel className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, var(--color-gold-dim), var(--ios-gold-dark))' }}>{m.avatar}</div>
                              <span className="text-xs font-medium text-foreground truncate">{m.name}</span>
                            </div>
                            <span className="text-xs font-bold tabular-nums" style={{ color: m.replyRate > 20 ? colors.green : m.replyRate >= 10 ? colors.amber : colors.red }}>{m.replyRate}% reply</span>
                          </div>
                          <div className="h-24">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: textSecondary }} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: `${blackAlpha(0.03)}` }} />
                                <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={24}>
                                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
