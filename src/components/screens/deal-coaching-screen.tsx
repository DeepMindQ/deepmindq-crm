'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, CheckCircle2, AlertTriangle, Lightbulb,
  ArrowRight, Clock, User, Target, RefreshCw, ChevronDown, ChevronUp,
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
interface CoachingResponse {
  pursuitId: string;
  opportunityTitle: string;
  company: { id: string; name: string };
  currentStage: string;
  stageProgress: number;
  daysInStage: number;
  daysSinceActivity: number;
  coaching: {
    strengths: Array<{ area: string; evidence: string }>;
    gaps: Array<{ area: string; severity: 'high' | 'medium' | 'low'; suggestion: string }>;
    conversationTopics: Array<{ topic: string; why: string; timing: string }>;
    positioningNotes: string;
    nextSteps: Array<{ action: string; priority: string; deadline: string }>;
    churnRisk: number;
    churnRiskFactors: string[];
  };
}

const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const STAGE_ORDER = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

/* ═══════════════════════════════════════════════════ */
/*  Screen Component                                  */
/* ═══════════════════════════════════════════════════ */
export default function DealCoachingScreen() {
  const { data: deals, isLoading, refetch } = useQuery({
    queryKey: ['deal-coaching-all'],
    queryFn: async (): Promise<CoachingResponse[]> => {
      const res = await fetchApi<CoachingResponse[]>('/api/ai/deal-coaching');
      return res.data ?? [];
    },
    refetchInterval: 60000,
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Deal Coaching</h1>
            <p className="text-sm text-muted-foreground">AI-powered deal guidance and stage-specific coaching</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      )}

      {deals && deals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-medium">No Active Pursuits</h3>
          <p className="text-sm text-muted-foreground">Create and accept opportunities to get AI coaching insights.</p>
        </div>
      )}

      {deals && deals.length > 0 && (
        <div className="space-y-4">
          {deals.map((deal, i) => (
            <motion.div
              key={deal.pursuitId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="overflow-hidden">
                {/* Deal Header */}
                <button
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() => setExpandedId(expandedId === deal.pursuitId ? null : deal.pursuitId)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{deal.opportunityTitle}</span>
                        <Badge variant="outline">{STAGE_LABELS[deal.currentStage] || deal.currentStage}</Badge>
                        <Badge variant={deal.coaching.churnRisk >= 50 ? 'destructive' : 'secondary'} className="text-xs">
                          Risk: {deal.coaching.churnRisk}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{deal.company.name} · {deal.daysInStage}d in stage</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={deal.stageProgress} className="h-2 w-24" />
                    <span className="text-xs text-muted-foreground">{deal.stageProgress}%</span>
                    {expandedId === deal.pursuitId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Expanded Coaching Details */}
                <AnimatePresence>
                  {expandedId === deal.pursuitId && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t px-4 py-4">
                        {/* Stage Progression Guide */}
                        <div className="mb-6">
                          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Pipeline Progression</h3>
                          <div className="flex items-center gap-1">
                            {STAGE_ORDER.map((stage, idx) => {
                              const currentIdx = STAGE_ORDER.indexOf(deal.currentStage);
                              const isPast = idx < currentIdx;
                              const isCurrent = idx === currentIdx;
                              return (
                                <div key={stage} className="flex items-center gap-1">
                                  <div className={cn(
                                    'flex h-8 items-center rounded-md px-2 text-xs font-medium',
                                    isPast ? 'bg-green-100 text-green-700' :
                                    isCurrent ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-300' :
                                    'bg-muted text-muted-foreground'
                                  )}>
                                    {isPast && <CheckCircle2 className="mr-1 h-3 w-3" />}
                                    {STAGE_LABELS[stage]}
                                  </div>
                                  {idx < STAGE_ORDER.length - 1 && (
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Coaching Grid */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {/* Strengths */}
                          <Card className="border-green-200/50 bg-green-50/30">
                            <CardHeader className="pb-2 pt-3 px-3">
                              <CardTitle className="flex items-center gap-2 text-sm text-green-700">
                                <CheckCircle2 className="h-4 w-4" /> Strengths
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3">
                              {deal.coaching.strengths.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No strengths detected</p>
                              ) : (
                                <ul className="space-y-2">
                                  {deal.coaching.strengths.map((s, j) => (
                                    <li key={j}>
                                      <span className="text-xs font-medium text-green-800">{s.area}</span>
                                      <p className="text-xs text-green-700/80">{s.evidence}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </CardContent>
                          </Card>

                          {/* Gaps */}
                          <Card className={cn(
                            'border-amber-200/50',
                            deal.coaching.gaps.some(g => g.severity === 'high') ? 'bg-red-50/30' : 'bg-amber-50/30'
                          )}>
                            <CardHeader className="pb-2 pt-3 px-3">
                              <CardTitle className="flex items-center gap-2 text-sm text-amber-700">
                                <AlertTriangle className="h-4 w-4" /> Gaps & Warnings
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3">
                              {deal.coaching.gaps.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No gaps detected</p>
                              ) : (
                                <ul className="space-y-2">
                                  {deal.coaching.gaps.map((g, j) => (
                                    <li key={j}>
                                      <div className="flex items-center gap-1">
                                        <Badge variant="outline" className={cn('text-[11px] px-1 py-0',
                                          g.severity === 'high' ? 'border-red-300 text-red-600' : 'border-amber-300 text-amber-600'
                                        )}>
                                          {g.severity}
                                        </Badge>
                                        <span className="text-xs font-medium">{g.area}</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">{g.suggestion}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </CardContent>
                          </Card>

                          {/* Next Steps */}
                          <Card className="border-blue-200/50 bg-blue-50/30">
                            <CardHeader className="pb-2 pt-3 px-3">
                              <CardTitle className="flex items-center gap-2 text-sm text-blue-700">
                                <ArrowRight className="h-4 w-4" /> Next Steps
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3">
                              {deal.coaching.nextSteps.length === 0 ? (
                                <p className="text-xs text-muted-foreground">On track</p>
                              ) : (
                                <ul className="space-y-2">
                                  {deal.coaching.nextSteps.map((s, j) => (
                                    <li key={j} className="flex items-start gap-2">
                                      <Badge variant="outline" className="mt-0.5 shrink-0 text-[11px] px-1 py-0 border-blue-300 text-blue-600">
                                        {s.deadline}
                                      </Badge>
                                      <div>
                                        <span className="text-xs">{s.action}</span>
                                        <Badge variant="outline" className="ml-1 text-[11px] px-1 py-0">{s.priority}</Badge>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Conversation Topics */}
                        {deal.coaching.conversationTopics.length > 0 && (
                          <div className="mt-4">
                            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                              <Lightbulb className="h-4 w-4 text-amber-500" /> Suggested Conversation Topics
                            </h3>
                            <div className="grid gap-2 md:grid-cols-2">
                              {deal.coaching.conversationTopics.map((t, j) => (
                                <div key={j} className="rounded-lg border bg-white/50 p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{t.topic}</span>
                                    <Badge variant="secondary" className="text-[11px]">{t.timing}</Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">{t.why}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Positioning */}
                        {deal.coaching.positioningNotes && (
                          <div className="mt-4 rounded-lg border border-violet-200/50 bg-violet-50/30 p-3">
                            <h3 className="mb-1 text-xs font-semibold text-violet-700">Positioning Notes</h3>
                            <p className="text-xs text-violet-600/80">{deal.coaching.positioningNotes}</p>
                          </div>
                        )}

                        {/* Churn Risk */}
                        {deal.coaching.churnRisk > 0 && (
                          <div className="mt-4 flex items-center gap-3 rounded-lg border p-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">Churn Risk</span>
                                <span className={cn('text-sm font-bold',
                                  deal.coaching.churnRisk >= 50 ? 'text-red-600' : deal.coaching.churnRisk >= 25 ? 'text-amber-600' : 'text-green-600'
                                )}>
                                  {deal.coaching.churnRisk}%
                                </span>
                              </div>
                              {deal.coaching.churnRiskFactors.length > 0 && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {deal.coaching.churnRiskFactors.join(' · ')}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
