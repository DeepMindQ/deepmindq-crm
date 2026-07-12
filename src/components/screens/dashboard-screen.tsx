'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, FileCheck, Clock, Mail, Activity, Heart, ShieldCheck, ShieldAlert, ShieldX, HelpCircle,
} from 'lucide-react';

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

const STATUS_COLORS: Record<string, string> = {
  staged: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  processing: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  archived: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const STATUS_DOT: Record<string, string> = {
  imported: 'bg-zinc-400',
  cleaned: 'bg-blue-400',
  drafted: 'bg-amber-400',
  queued: 'bg-purple-400',
  sent: 'bg-emerald-400',
  replied: 'bg-emerald-500',
  bounced: 'bg-red-400',
  suppressed: 'bg-slate-400',
  archived: 'bg-zinc-500',
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return iso; }
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-muted-foreground text-sm p-6">Failed to load dashboard data.</div>;
  }

  const totalLeads = Object.values(data.contactsByStatus).reduce((a, b) => a + b, 0);
  const statusBreakdown = Object.entries(data.contactsByStatus).map(([status, count]) => ({ status, count }));
  const { emailHealthDistribution: eh } = data;
  const healthTotal = eh.valid + eh.risky + eh.invalid + eh.unknown;

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: totalLeads, icon: Users },
          { label: 'Ready for Review', value: data.draftsPendingReview, icon: FileCheck },
          { label: 'In Queue', value: data.queuePending, icon: Clock },
          { label: 'Replies This Week', value: data.repliesThisWeek, icon: Mail },
        ].map(s => (
          <Card key={s.label} className="bg-card border border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{s.label}</p>
                  <p className="text-2xl font-bold text-primary mt-1 tabular-nums">{s.value.toLocaleString()}</p>
                </div>
                <s.icon className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Batches + Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border border-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Batches
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Filename</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Rows</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Accepted</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentBatches.map(b => (
                  <TableRow key={b.id} className="border-border">
                    <TableCell className="text-foreground text-sm font-medium max-w-[160px] truncate">{b.fileName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm text-right tabular-nums">{b.totalRows}</TableCell>
                    <TableCell className="text-foreground text-sm text-right tabular-nums">{b.acceptedRows}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[b.status] || ''}>
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs text-right whitespace-nowrap">{fmtDate(b.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {data.recentBatches.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground text-sm text-center py-6">No batches yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Lead Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {statusBreakdown.map(s => (
                <div key={s.status} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s.status] || 'bg-zinc-500'}`} />
                    <span className="text-sm text-foreground capitalize">{s.status.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-sm font-medium text-primary tabular-nums">{s.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Health Distribution */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            Email Health Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              { key: 'valid', label: 'Valid', icon: ShieldCheck, color: 'bg-emerald-400' },
              { key: 'risky', label: 'Risky', icon: ShieldAlert, color: 'bg-amber-400' },
              { key: 'invalid', label: 'Invalid', icon: ShieldX, color: 'bg-red-400' },
              { key: 'unknown', label: 'Unknown', icon: HelpCircle, color: 'bg-zinc-500' },
            ] as const).map(h => {
              const count = eh[h.key];
              const pct = healthTotal > 0 ? (count / healthTotal) * 100 : 0;
              return (
                <div key={h.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h.icon className={`w-3.5 h-3.5 ${h.color.replace('bg-', 'text-')}`} />
                      <span className="text-sm text-foreground">{h.label}</span>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-primary">{count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${h.color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Counts */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-red-500/15 flex items-center justify-center">
              <ShieldX className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bounces</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">{data.bouncesCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-slate-500/15 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Suppressions</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">{data.suppressionsCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Companies</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">{data.totalCompanies}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}