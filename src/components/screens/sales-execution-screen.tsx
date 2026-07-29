'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Target, TrendingUp, Users, Clock, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { fetchApi } from '@/lib/fetchApi';
import { cn } from '@/lib/utils';

interface SalesExec {
  totalPursuits: number; activePursuits: number; wonPursuits: number; lostPursuits: number; winRate: number;
  newThisWeek: number; advancedThisWeek: number; winsThisMonth: number; lossesThisMonth: number;
  stageDistribution: Record<string, number>;
  ownerPerformance: Record<string, { active: number; won: number; lost: number; avgDaysInStage: number }>;
  needsAction: number; stalePursuits: number;
  topNeedsAction: Array<{ pursuitId: string; title: string; company: string; owner: string; stage: string; nextAction: string; overdue: boolean }>;
}

const STAGE_LABELS: Record<string, string> = { discovery: 'Discovery', qualification: 'Qualification', proposal: 'Proposal', negotiation: 'Negotiation' };

export default function SalesExecutionScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sales-execution'],
    queryFn: async (): Promise<SalesExec> => {
      const res = await fetchApi<SalesExec>('/api/sales-execution');
      return res.data ?? { totalPursuits: 0, activePursuits: 0, wonPursuits: 0, lostPursuits: 0, winRate: 0, newThisWeek: 0, advancedThisWeek: 0, winsThisMonth: 0, lossesThisMonth: 0, stageDistribution: {}, ownerPerformance: {}, needsAction: 0, stalePursuits: 0, topNeedsAction: [] };
    },
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white"><Target className="h-5 w-5" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Sales Execution</h1><p className="text-sm text-muted-foreground">Pipeline velocity, win rates, and pursuit activity tracking</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh</Button>
      </div>

      {isLoading && <div className="grid gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>}

      {data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard icon={<Target className="h-4 w-4" />} label="Active Pursuits" value={data.activePursuits} sublabel={`${data.totalPursuits} total`} gradient="from-indigo-500/10 to-indigo-600/5" iconBg="bg-indigo-100 text-indigo-600" />
            <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Win Rate" value={`${data.winRate}%`} sublabel={`${data.wonPursuits}W / ${data.wonPursuits + data.lostPursuits} closed`} gradient={data.winRate >= 30 ? 'from-green-500/10 to-green-600/5' : 'from-amber-500/10 to-amber-600/5'} iconBg={data.winRate >= 30 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'} />
            <KpiCard icon={<Zap className="h-4 w-4" />} label="New This Week" value={data.newThisWeek} sublabel={`${data.advancedThisWeek} advanced`} gradient="from-blue-500/10 to-blue-600/5" iconBg="bg-blue-100 text-blue-600" />
            <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Needs Action" value={data.needsAction} sublabel={`${data.stalePursuits} stale`} gradient={data.needsAction > 3 ? 'from-red-500/10 to-red-600/5' : 'from-emerald-500/10 to-emerald-600/5'} iconBg={data.needsAction > 3 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'} />
          </div>

          {/* Stage Distribution + Win/Loss */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Active Pursuits by Stage</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(data.stageDistribution).map(([stage, count]) => {
                    const maxCount = Math.max(...Object.values(data.stageDistribution), 1);
                    return (
                      <div key={stage}>
                        <div className="mb-1 flex justify-between text-sm"><span>{STAGE_LABELS[stage] || stage}</span><span className="font-semibold">{count}</span></div>
                        <div className="h-6 w-full overflow-hidden rounded-md bg-muted/50">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(count / maxCount) * 100}%` }} transition={{ duration: 0.5 }} className="flex h-full items-center rounded-md bg-indigo-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">This Month Performance</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between"><span className="text-sm">Wins</span><span className="text-lg font-bold text-green-600">{data.winsThisMonth}</span></div>
                <div className="flex items-center justify-between"><span className="text-sm">Losses</span><span className="text-lg font-bold text-red-500">{data.lossesThisMonth}</span></div>
                <Progress value={data.winRate} className="h-2" />
                <p className="text-xs text-muted-foreground">{data.winRate}% win rate this month</p>
              </CardContent>
            </Card>
          </div>

          {/* Needs Action Table */}
          {data.topNeedsAction.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Pursuits Needing Action</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.topNeedsAction.map((p, i) => (
                    <motion.div key={p.pursuitId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className={cn('flex items-center justify-between rounded-lg border p-3', p.overdue ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30')}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="font-medium truncate">{p.title}</span><Badge variant="outline" className="text-xs">{STAGE_LABELS[p.stage] || p.stage}</Badge></div>
                        <p className="text-xs text-muted-foreground">{p.company} · {p.owner}</p>
                      </div>
                      <div className="text-right"><Badge variant={p.overdue ? 'destructive' : 'secondary'} className="text-[11px]">{p.overdue ? 'Overdue' : 'No action'}</Badge></div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Owner Performance */}
          {Object.keys(data.ownerPerformance).length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Owner Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(data.ownerPerformance).map(([owner, stats]) => (
                    <div key={owner} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{owner}</span></div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-blue-600">{stats.active} active</span>
                        <span className="text-green-600">{stats.won} won</span>
                        <span className="text-red-500">{stats.lost} lost</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sublabel, gradient, iconBg }: { icon: React.ReactNode; label: string; value: string | number; sublabel: string; gradient: string; iconBg: string }) {
  return (
    <Card className={cn('bg-gradient-to-br border', gradient)}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconBg)}>{icon}</div>
        <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{sublabel}</div></div>
      </CardContent>
    </Card>
  );
}
