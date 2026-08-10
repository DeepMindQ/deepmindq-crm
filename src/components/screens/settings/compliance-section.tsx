'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  RefreshCw, ShieldAlert, Trash2, Download, ExternalLink,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import {
  StaggerGrid, StaggerItem, GlassPanel, ShimmerText,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cardSolid, colors } from '@/components/design-system';

// ── Opacity helpers ─────────────────────────────
const goldAlpha = (a: number) => `rgba(212,175,55,${a})`;
const redAlpha = (a: number) => `rgba(239,68,68,${a})`;
const blackAlpha = (a: number) => `rgba(0,0,0,${a})`;

const CONSENT_COLORS: Record<string, string> = {
  opted_in: colors.green,
  unknown: 'var(--color-gold)',
  opted_out: colors.red,
};

interface ComplianceData {
  summary: any;
  consentBreakdown: Record<string, number>;
  riskFlags: Array<{ type: string; message: string; count: number; fixable?: boolean; fixAction?: string }>;
  recentChanges: Array<{ id: string; action: string; details?: string; entityId?: string; createdAt: string }>;
  retentionDays: number;
}

export function ComplianceSection({ navigateTo }: { navigateTo?: (screen: string) => void }) {
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
  const complianceColor = complianceRate >= 80 ? colors.green : complianceRate >= 50 ? colors.amber : colors.red;
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
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div
            className="px-6 py-4 flex items-center gap-3"
            style={{
              background: `linear-gradient(135deg, ${redAlpha(0.06)}, ${goldAlpha(0.04)}, transparent)`,
              borderBottom: `1px solid ${redAlpha(0.1)}`,
            }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${redAlpha(0.2)}, ${goldAlpha(0.08)})` }}>
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
                {/* Score + Donut Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Compliance Score Card */}
                  <div className="lg:col-span-1">
                    <GlassPanel className="p-6 flex flex-col items-center justify-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3">Compliance Score</p>
                      <div className="relative">
                        <span className="text-5xl font-bold tabular-nums" style={{ color: complianceColor }}>
                          {data.summary.complianceRate}%
                        </span>
                      </div>
                      <Badge className="mt-3 text-xs font-medium" style={{ background: `${complianceColor}20`, color: complianceColor, border: `1px solid ${complianceColor}40` }}>
                        {complianceLabel}
                      </Badge>
                      <div className="mt-4 w-full space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between"><span>Total contacts</span><span className="font-semibold text-foreground tabular-nums">{data.summary.totalContacts}</span></div>
                        <div className="flex items-center justify-between"><span>Opted in</span><span className="font-semibold text-emerald-600 tabular-nums">{data.summary.consented}</span></div>
                        <div className="flex items-center justify-between"><span>Unknown status</span><span className="font-semibold text-amber-600 tabular-nums">{data.summary.unknown}</span></div>
                        <div className="flex items-center justify-between"><span>Suppressed</span><span className="font-semibold text-red-600 tabular-nums">{data.summary.suppressed}</span></div>
                        <Separator className="bg-border/40 !my-2" />
                        <div className="flex items-center justify-between"><span>Email verified</span><span className="font-semibold text-foreground tabular-nums">{data.summary.emailVerifiedRate}%</span></div>
                        <div className="flex items-center justify-between"><span>Data retention</span><span className="font-semibold text-foreground tabular-nums">{data.retentionDays} days</span></div>
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
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                                {pieData.map((entry, idx) => (<Cell key={idx} fill={entry.fill} />))}
                              </Pie>
                              <Tooltip contentStyle={{ background: cardSolid, border: `1px solid ${blackAlpha(0.06)}`, boxShadow: `0 4px 16px ${blackAlpha(0.12)}`, borderRadius: '8px', fontSize: '12px', color: 'var(--ios-chart-text)' }} itemStyle={{ color: 'var(--ios-chart-text)' }} />
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
                          <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[11px] ml-auto">{data.riskFlags.length}</Badge>
                        )}
                      </div>
                      {data.riskFlags.length === 0 ? (
                        <div className="text-center py-6">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                          <p className="text-xs text-emerald-600 font-medium">No risk flags</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">All compliance checks passed</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                          {data.riskFlags.map(flag => (
                            <div key={flag.type} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-xs font-medium text-foreground leading-snug">{flag.message}</p>
                                <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[11px] shrink-0 tabular-nums">{flag.count}</Badge>
                              </div>
                              {flag.fixable && (
                                <Button size="sm" variant="ghost" className="h-10 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 mt-1 min-h-[44px]" disabled={actionLoading === flag.fixAction} onClick={() => runAction('fix', flag.fixAction)}>
                                  {actionLoading === flag.fixAction ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
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

                {/* Quick Actions */}
                <GlassPanel className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, var(--color-gold-dim), var(--ios-gold-dark))' }} />
                    <h4 className="text-sm font-semibold text-foreground">Quick Actions</h4>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant="outline" className="h-10 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 min-h-[44px]" disabled={actionLoading === 'export_all_consented'} onClick={() => runAction('export_all_consented')}>
                        {actionLoading === 'export_all_consented' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Export All Contact Data
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant="outline" className="h-10 text-xs gap-1.5 border-red-500/30 text-red-600 hover:bg-red-50 hover:border-red-500/50 min-h-[44px]" disabled={actionLoading === 'clean_stale_suppressions'} onClick={() => runAction('clean', 'clean_stale_suppressions')}>
                        {actionLoading === 'clean_stale_suppressions' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Clean Stale Suppressions
                      </Button>
                    </motion.div>
                    {navigateTo && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button variant="outline" className="h-10 text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground hover:bg-accent min-h-[44px]" onClick={() => navigateTo('bounces')}>
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Suppression List
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </GlassPanel>

                {/* Recent Consent Changes */}
                <GlassPanel className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, var(--color-gold-dim), var(--ios-gold-dark))' }} />
                    <h4 className="text-sm font-semibold text-foreground">Recent Consent Changes</h4>
                    <span className="text-[11px] text-muted-foreground ml-1">(last 30 days)</span>
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
                              <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                                {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                {log.entityId && <span className="ml-2 text-zinc-600">ID: {log.entityId.slice(0, 8)}...</span>}
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
