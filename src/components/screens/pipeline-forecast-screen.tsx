'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingUp, Calendar, DollarSign, Clock, AlertTriangle,
  CheckCircle2, ArrowRight, RefreshCw, Zap, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { fetchApi } from '@/lib/fetchApi';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════ */
/*  Types                                             */
/* ═══════════════════════════════════════════════════ */
interface ForecastResponse {
  totalActivePipeline: number;
  totalActivePursuits: number;
  weightedPipelineValue: number;
  projectedCloses: { thisWeek: number; thisMonth: number; thisQuarter: number };
  stageForecast: Array<{
    stage: string;
    currentCount: number;
    expectedToAdvance: number;
    expectedToClose: number;
    expectedToLose: number;
    avgDaysToNextStage: number;
  }>;
  avgDaysToClose: number;
  avgDaysPerStage: Record<string, number>;
  fastestDeals: Array<{ pursuitId: string; title: string; company: string; days: number }>;
  slowestDeals: Array<{ pursuitId: string; title: string; company: string; days: number }>;
  pipelineHealthScore: number;
  healthFactors: Array<{ factor: string; score: number; description: string }>;
  recommendations: Array<{ action: string; impact: string; priority: string }>;
}

const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
};

const STAGE_COLORS: Record<string, string> = {
  discovery: 'bg-blue-500',
  qualification: 'bg-indigo-500',
  proposal: 'bg-purple-500',
  negotiation: 'bg-violet-500',
};

/* ═══════════════════════════════════════════════════ */
/*  Screen Component                                  */
/* ═══════════════════════════════════════════════════ */
export default function PipelineForecastScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pipeline-forecast'],
    queryFn: async (): Promise<ForecastResponse> => {
      const res = await fetchApi<ForecastResponse>('/api/pipeline/forecast');
      return res.data ?? {
        totalActivePipeline: 0, totalActivePursuits: 0, weightedPipelineValue: 0,
        projectedCloses: { thisWeek: 0, thisMonth: 0, thisQuarter: 0 },
        stageForecast: [], avgDaysToClose: 0, avgDaysPerStage: {},
        fastestDeals: [], slowestDeals: [], pipelineHealthScore: 0,
        healthFactors: [], recommendations: [],
      };
    },
    refetchInterval: 120000,
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pipeline Forecast</h1>
            <p className="text-sm text-muted-foreground">Revenue projections, velocity analytics, and pipeline health</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {isLoading && <ForecastSkeleton />}

      {data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* ── Forecast Summary Cards ── */}
          <div className="grid gap-4 md:grid-cols-4">
            <ForecastCard
              icon={<Calendar className="h-4 w-4" />}
              label="This Week"
              value={data.projectedCloses.thisWeek}
              sublabel="projected closes"
              gradient="from-blue-500/10 to-blue-600/5"
              iconBg="bg-blue-100 text-blue-600"
            />
            <ForecastCard
              icon={<Calendar className="h-4 w-4" />}
              label="This Month"
              value={data.projectedCloses.thisMonth}
              sublabel="projected closes"
              gradient="from-indigo-500/10 to-indigo-600/5"
              iconBg="bg-indigo-100 text-indigo-600"
            />
            <ForecastCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Pipeline Value"
              value={data.weightedPipelineValue}
              sublabel="weighted score"
              gradient="from-emerald-500/10 to-emerald-600/5"
              iconBg="bg-emerald-100 text-emerald-600"
            />
            <ForecastCard
              icon={<Zap className="h-4 w-4" />}
              label="Health Score"
              value={data.pipelineHealthScore}
              sublabel="/ 100"
              gradient={data.pipelineHealthScore >= 60 ? 'from-green-500/10 to-green-600/5' : 'from-amber-500/10 to-amber-600/5'}
              iconBg={data.pipelineHealthScore >= 60 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}
            />
          </div>

          {/* ── Stage Flow Forecast ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Stage Flow Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4">Stage</th>
                      <th className="pb-2 pr-4 text-center">Current</th>
                      <th className="pb-2 pr-4 text-center">Advance</th>
                      <th className="pb-2 pr-4 text-center">Close Won</th>
                      <th className="pb-2 pr-4 text-center">Close Lost</th>
                      <th className="pb-2 text-center">Avg Days/Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stageForecast.map((sf, i) => (
                      <motion.tr
                        key={sf.stage}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="border-b last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className={cn('h-3 w-3 rounded-full', STAGE_COLORS[sf.stage] || 'bg-gray-400')} />
                            <span className="font-medium">{STAGE_LABELS[sf.stage] || sf.stage}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-center font-semibold">{sf.currentCount}</td>
                        <td className="py-3 pr-4 text-center text-green-600">{sf.expectedToAdvance}</td>
                        <td className="py-3 pr-4 text-center text-emerald-600 font-medium">{sf.expectedToClose}</td>
                        <td className="py-3 pr-4 text-center text-red-500">{sf.expectedToLose}</td>
                        <td className="py-3 text-center text-muted-foreground">{sf.avgDaysToNextStage}d</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── Velocity Chart (CSS bars) ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Sales Velocity — Avg Days per Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(data.avgDaysPerStage).map(([stage, days]) => {
                  const maxDays = Math.max(...Object.values(data.avgDaysPerStage), 1);
                  const pct = Math.min(100, (days / maxDays) * 100);
                  return (
                    <div key={stage} className="flex items-center gap-4">
                      <span className="w-24 text-sm font-medium">{STAGE_LABELS[stage] || stage}</span>
                      <div className="flex-1">
                        <div className="h-6 w-full overflow-hidden rounded-md bg-muted/50">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6 }}
                            className={cn('flex h-full items-center rounded-md', STAGE_COLORS[stage] || 'bg-gray-500')}
                          >
                            <span className="pl-2 text-xs font-medium text-white">{days}d</span>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-4 border-t pt-3">
                  <span className="w-24 text-sm font-medium text-muted-foreground">Avg Close</span>
                  <span className="text-lg font-bold">{data.avgDaysToClose}d</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Pipeline Health Score ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Pipeline Health Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center justify-center">
                <div className="relative flex h-32 w-32 items-center justify-center">
                  <svg aria-hidden="true" className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="52" fill="none"
                      stroke={data.pipelineHealthScore >= 70 ? 'var(--dmq-domain-action)' : data.pipelineHealthScore >= 40 ? 'var(--dmq-domain-reasoning)' : 'var(--dmq-domain-risk)'}
                      strokeWidth="8"
                      strokeDasharray={`${(data.pipelineHealthScore / 100) * 327} 327`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-bold">{data.pipelineHealthScore}</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {data.healthFactors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{f.factor}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={f.score} className="h-2 w-24" />
                      <span className="text-xs text-muted-foreground w-8 text-right">{f.score}</span>
                    </div>
                  </div>
                ))}
                <p className="mt-2 text-xs text-muted-foreground">{data.healthFactors.map(f => f.description).join('. ')}</p>
              </div>
            </CardContent>
          </Card>

          {/* ── Fastest vs Slowest Deals ── */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Fastest Deals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.fastestDeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No closed deals yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.fastestDeals.map((d, i) => (
                      <div key={d.pursuitId} className="flex items-center justify-between rounded-md border p-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium truncate block">{d.title}</span>
                          <span className="text-xs text-muted-foreground">{d.company}</span>
                        </div>
                        <Badge variant="outline" className="text-green-600 ml-2 shrink-0">{d.days}d</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-amber-500" /> Slowest Deals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.slowestDeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No closed deals yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.slowestDeals.map((d, i) => (
                      <div key={d.pursuitId} className="flex items-center justify-between rounded-md border p-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium truncate block">{d.title}</span>
                          <span className="text-xs text-muted-foreground">{d.company}</span>
                        </div>
                        <Badge variant="outline" className="text-amber-600 ml-2 shrink-0">{d.days}d</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Recommendations ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-blue-500" /> Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pipeline is healthy — no actions needed</p>
              ) : (
                <div className="space-y-3">
                  {data.recommendations.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <Badge variant={r.priority === 'high' ? 'destructive' : 'secondary'} className="mt-0.5 shrink-0">
                        {r.priority}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{r.action}</p>
                        <p className="text-xs text-muted-foreground">{r.impact}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
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
function ForecastCard({ icon, label, value, sublabel, gradient, iconBg }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel: string;
  gradient: string;
  iconBg: string;
}) {
  return (
    <Card className={cn('bg-gradient-to-br border', gradient)}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconBg)}>
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

function ForecastSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}
