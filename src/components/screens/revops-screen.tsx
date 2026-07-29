'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart3, Database, Shield, Brain, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { fetchApi } from '@/lib/fetchApi';
import { cn } from '@/lib/utils';

interface RevOpsData {
  totalPipelineValue: number; activeDeals: number; closedWon: number; closedLost: number; winRate: number;
  wonThisMonth: number; wonLastMonth: number; lostThisMonth: number; monthOverMonthGrowth: number;
  totalContacts: number; sentContacts: number; replyRate: number; bounceRate: number; sequencesCount: number;
  enrichmentRate: number; emailQualityRate: number; companies: number;
  companiesWithSignals: number; companiesWithPursuits: number; companiesWithOpportunities: number;
  totalAIInsights: number; recentAIInsights: number;
  revopsHealthScore: number;
  healthBreakdown: { coverage: number; data: number; execution: number; pipeline: number };
}

export default function RevOpsScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['revops'],
    queryFn: async (): Promise<RevOpsData> => {
      const res = await fetchApi<RevOpsData>('/api/revops');
      return res.data ?? { totalPipelineValue: 0, activeDeals: 0, closedWon: 0, closedLost: 0, winRate: 0, wonThisMonth: 0, wonLastMonth: 0, lostThisMonth: 0, monthOverMonthGrowth: 0, totalContacts: 0, sentContacts: 0, replyRate: 0, bounceRate: 0, sequencesCount: 0, enrichmentRate: 0, emailQualityRate: 0, companies: 0, companiesWithSignals: 0, companiesWithPursuits: 0, companiesWithOpportunities: 0, totalAIInsights: 0, recentAIInsights: 0, revopsHealthScore: 0, healthBreakdown: { coverage: 0, data: 0, execution: 0, pipeline: 0 } };
    },
    refetchInterval: 120000,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white"><BarChart3 className="h-5 w-5" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">RevOps Dashboard</h1><p className="text-sm text-muted-foreground">Revenue operations health, data quality, and execution metrics</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh</Button>
      </div>

      {isLoading && <div className="grid gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>}

      {data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Health Score + KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <svg aria-hidden="true" className="h-16 w-16 -rotate-90" viewBox="0 0 60 60"><circle cx="30" cy="30" r="25" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="5" /><circle cx="30" cy="30" r="25" fill="none" stroke={data.revopsHealthScore >= 60 ? '#22c55e' : '#f59e0b'} strokeWidth="5" strokeDasharray={`${(data.revopsHealthScore / 100) * 157} 157`} strokeLinecap="round" /></svg>
                  <span className="absolute text-lg font-bold">{data.revopsHealthScore}</span>
                </div>
                <div><div className="text-xs text-muted-foreground">RevOps Health</div><div className="text-sm">/ 100</div></div>
              </CardContent>
            </Card>
            <Kpi icon={<Database className="h-4 w-4" />} label="Pipeline Value" value={data.totalPipelineValue} sub={`${data.activeDeals} active deals`} bg="from-blue-500/10 to-blue-600/5" iconBg="bg-blue-100 text-blue-600" />
            <Kpi icon={<Brain className="h-4 w-4" />} label="AI Insights" value={data.totalAIInsights} sub={`${data.recentAIInsights} this week`} bg="from-violet-500/10 to-violet-600/5" iconBg="bg-violet-100 text-violet-600" />
            <Kpi icon={<BarChart3 className="h-4 w-4" />} label="Win Rate" value={`${data.winRate}%`} sub={`${data.wonThisMonth} wins this month`} bg={data.winRate >= 25 ? 'from-green-500/10 to-green-600/5' : 'from-amber-500/10 to-amber-600/5'} iconBg={data.winRate >= 25 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'} />
          </div>

          {/* Health Breakdown */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Health Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(data.healthBreakdown).map(([key, score]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{key === 'data' ? 'Data Quality' : key === 'execution' ? 'Execution' : key === 'pipeline' ? 'Pipeline' : 'Coverage'}</span>
                  <div className="flex items-center gap-2"><Progress value={score} className="h-2 w-32" /><span className="text-xs w-8 text-right">{score}</span></div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Data Quality + Activity */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4 text-blue-500" /> Data Quality</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><div className="flex justify-between text-sm"><span>Enrichment Rate</span><span className="font-semibold">{data.enrichmentRate}%</span></div><Progress value={data.enrichmentRate} className="mt-1 h-2" /></div>
                <div><div className="flex justify-between text-sm"><span>Email Quality</span><span className="font-semibold">{data.emailQualityRate}%</span></div><Progress value={data.emailQualityRate} className="mt-1 h-2" /></div>
                <div className="flex justify-between text-sm"><span>Total Contacts</span><span className="font-semibold">{data.totalContacts}</span></div>
                <div className="flex justify-between text-sm"><span>Companies</span><span className="font-semibold">{data.companies}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-emerald-500" /> Activity Metrics</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm"><span>Reply Rate</span><span className="font-semibold text-green-600">{data.replyRate}%</span></div>
                <div className="flex justify-between text-sm"><span>Bounce Rate</span><span className={cn('font-semibold', data.bounceRate > 10 ? 'text-red-500' : 'text-green-600')}>{data.bounceRate}%</span></div>
                <div className="flex justify-between text-sm"><span>Sent</span><span className="font-semibold">{data.sentContacts}</span></div>
                <div className="flex justify-between text-sm"><span>Sequences</span><span className="font-semibold">{data.sequencesCount}</span></div>
                <div className="flex justify-between text-sm"><span>MoM Growth</span><span className={cn('font-semibold', data.monthOverMonthGrowth >= 0 ? 'text-green-600' : 'text-red-500')}>{data.monthOverMonthGrowth >= 0 ? '+' : ''}{data.monthOverMonthGrowth}%</span></div>
              </CardContent>
            </Card>
          </div>

          {/* Company Coverage */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Company Intelligence Coverage</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                {[
                  { label: 'Total Companies', value: data.companies, color: 'text-blue-600' },
                  { label: 'With Signals', value: data.companiesWithSignals, color: 'text-indigo-600' },
                  { label: 'With Pursuits', value: data.companiesWithPursuits, color: 'text-violet-600' },
                  { label: 'With Opportunities', value: data.companiesWithOpportunities, color: 'text-purple-600' },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <div className={cn('text-2xl font-bold', item.color)}>{item.value}</div>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, sub, bg, iconBg }: { icon: React.ReactNode; label: string; value: string | number; sub: string; bg: string; iconBg: string }) {
  return (
    <Card className={cn('bg-gradient-to-br border', bg)}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconBg)}>{icon}</div>
        <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{sub}</div></div>
      </CardContent>
    </Card>
  );
}
