'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, Clock, AlertTriangle, ChevronRight, RefreshCw, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchApi } from '@/lib/fetchApi';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════ */
/*  Types                                             */
/* ═══════════════════════════════════════════════════ */
interface RiskDeal {
  pursuitId: string;
  opportunityId: string;
  title: string;
  company: string;
  riskScore: number;
  riskFactors: string[];
  stage: string;
}

interface PipelineHealth {
  totalOpportunities: number;
  opportunitiesByStage: Record<string, number>;
  opportunitiesByPriority: Record<string, number>;
  avgDaysInStage: Record<string, number>;
  overallConversionRate: number;
  stageConversionRates: Array<{ from: string; to: string; rate: number }>;
  staleDeals: number;
  atRiskDeals: number;
  totalPipelineValue: number;
  riskSummary: {
    total: number;
    high: number;
    medium: number;
    low: number;
    topRisks: RiskDeal[];
  };
}

const STAGE_COLORS: Record<string, string> = {
  discovery: '#60a5fa',
  qualification: '#818cf8',
  proposal: '#a78bfa',
  negotiation: '#c084fc',
  closed_won: '#22c55e',
  closed_lost: '#f87171',
};

const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Won',
  closed_lost: 'Lost',
};

const RISK_COLORS: Record<string, string> = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  elevated: 'text-amber-600 bg-amber-50 border-amber-200',
  normal: 'text-blue-600 bg-blue-50 border-blue-200',
  healthy: 'text-green-600 bg-green-50 border-green-200',
};

/* ═══════════════════════════════════════════════════ */
/*  Screen Component                                  */
/* ═══════════════════════════════════════════════════ */
export default function PipelineHealthScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pipeline-health'],
    queryFn: async (): Promise<PipelineHealth> => {
      const res = await fetchApi<PipelineHealth>('/api/pipeline/health');
      return res.data ?? {
        totalOpportunities: 0, opportunitiesByStage: {}, opportunitiesByPriority: {},
        avgDaysInStage: {}, overallConversionRate: 0, stageConversionRates: [],
        staleDeals: 0, atRiskDeals: 0, totalPipelineValue: 0,
        riskSummary: { total: 0, high: 0, medium: 0, low: 0, topRisks: [] },
      };
    },
    refetchInterval: 60000,
  });

  const stages = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  const stageCounts = data?.opportunitiesByStage || {};
  const maxCount = Math.max(1, ...stages.map(s => stageCounts[s] || 0));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pipeline Health</h1>
            <p className="text-sm text-muted-foreground">AI-powered deal pipeline monitoring and risk detection</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {isLoading && <PipelineHealthSkeleton />}

      {data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* ── Health Score Cards ── */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={<Activity className="h-4 w-4" />} label="Active Pipeline" value={data.totalOpportunities} sublabel="Total pursuits" color="blue" />
            <StatCard icon={<Clock className="h-4 w-4" />} label="Avg Velocity" value={Object.values(data.avgDaysInStage).length > 0 ? (Object.values(data.avgDaysInStage).reduce((a, b) => a + b, 0) / Object.values(data.avgDaysInStage).length).toFixed(1) : '0'} sublabel="Days per stage" color="purple" />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Conversion Rate" value={`${data.overallConversionRate}%`} sublabel="To closed-won" color="green" />
            <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="At-Risk Deals" value={data.atRiskDeals} sublabel={`${data.staleDeals} stale`} color={data.atRiskDeals > 3 ? 'red' : 'amber'} />
          </div>

          {/* ── Pipeline Funnel ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Pipeline Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stages.map(stage => {
                  const count = stageCounts[stage] || 0;
                  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  const avgDays = data.avgDaysInStage[stage] || 0;
                  return (
                    <div key={stage} className="group">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{STAGE_LABELS[stage]}</span>
                        <div className="flex items-center gap-2">
                          {avgDays > 0 && <span className="text-xs text-muted-foreground">{avgDays}d avg</span>}
                          <span className="font-semibold">{count}</span>
                        </div>
                      </div>
                      <div className="h-8 w-full overflow-hidden rounded-md bg-muted/50">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="flex h-full items-center rounded-md"
                          style={{ backgroundColor: STAGE_COLORS[stage] || '#71717a', width: `${pct}%` }}
                        >
                          <span className="pl-3 text-xs font-medium text-white">{pct > 15 ? `${count}` : ''}</span>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ── Stage Conversion Rates ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Stage Conversion Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                {data.stageConversionRates.map((conv, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="rounded-lg bg-muted px-3 py-2 text-center">
                      <div className="text-xs text-muted-foreground">{conv.from}</div>
                      <div className="text-lg font-bold">{conv.rate}%</div>
                    </div>
                    {i < data.stageConversionRates.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── At-Risk Deals Table ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">At-Risk Deals</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-red-600">{data.riskSummary.high} Critical</Badge>
                  <Badge variant="outline" className="text-amber-600">{data.riskSummary.medium} Elevated</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {data.riskSummary.topRisks.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Shield className="mx-auto mb-2 h-8 w-8 text-green-500" />
                  <p>No at-risk deals detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.riskSummary.topRisks.map((deal, i) => (
                    <motion.div
                      key={deal.pursuitId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        'flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between',
                        deal.riskScore >= 71 ? 'border-red-200 bg-red-50/50' : deal.riskScore >= 51 ? 'border-amber-200 bg-amber-50/50' : 'border-blue-200 bg-blue-50/50'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{deal.title}</span>
                          <Badge variant="outline" className="text-xs">{STAGE_LABELS[deal.stage] || deal.stage}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{deal.company}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{deal.riskFactors.slice(0, 2).join(' · ')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={cn('rounded-full px-3 py-1 text-sm font-bold',
                          deal.riskScore >= 71 ? 'bg-red-100 text-red-700' : deal.riskScore >= 51 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {deal.riskScore}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Priority Distribution ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Pipeline by Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {(['high', 'medium', 'low'] as const).map(pri => {
                  const count = data.opportunitiesByPriority[pri] || 0;
                  return (
                    <div key={pri} className="text-center">
                      <div className={cn('text-2xl font-bold',
                        pri === 'high' ? 'text-red-500' : pri === 'medium' ? 'text-amber-500' : 'text-blue-500'
                      )}>
                        {count}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">{pri}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  Sub-components                                    */
/* ═══════════════════════════════════════════════════ */
function StatCard({ icon, label, value, sublabel, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-200/50 text-blue-600',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-200/50 text-purple-600',
    green: 'from-green-500/10 to-green-600/5 border-green-200/50 text-green-600',
    red: 'from-red-500/10 to-red-600/5 border-red-200/50 text-red-600',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-200/50 text-amber-600',
  };

  return (
    <Card className={cn('bg-gradient-to-br border', colorClasses[color] || colorClasses.blue)}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/60 shadow-sm">
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{sublabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineHealthSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}
