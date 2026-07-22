'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Crosshair,
  Loader2,
  Sparkles,
  Target,
  MessageSquare,
  ShieldAlert,
  ArrowLeft,
  Clock,
  BadgeCheck,
  AlertTriangle,
  User,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

/* ── Types ── */

interface StrategyData {
  id: string;
  companyId: string;
  strategicInsightId: string;
  situationAssessment: {
    currentPhase: string;
    keyDrivers: string[];
    maturityLevel: string;
  };
  recommendedEntry: {
    role: string;
    rationale: string;
    department: string;
  };
  firstMeetingObjective: string;
  conversationAngles: Array<{
    angle: string;
    talkingPoints: string[];
  }>;
  riskFactors: Array<{
    risk: string;
    severity: string;
    mitigation: string;
  }>;
  priorityScore: number;
  generatedBy: string;
  modelUsed: string;
  generatedAt: string;
}

interface InsightSummary {
  summary: string;
  insightType: string;
  confidenceScore: number;
}

/* ── Helpers ── */

function getPriorityColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-gray-400';
}

function getPriorityLabel(score: number): string {
  if (score >= 80) return 'Immediate Action';
  if (score >= 60) return 'High Priority';
  if (score >= 40) return 'Monitor';
  return 'Low Priority';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-300';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'medium': return 'bg-amber-100 text-amber-800 border-amber-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-300';
  }
}

function getObjectiveLabel(obj: string): string {
  switch (obj) {
    case 'discovery': return 'Discovery Workshop';
    case 'technical': return 'Technical Deep Dive';
    case 'executive_alignment': return 'Executive Alignment';
    default: return obj;
  }
}

/* ── Component ── */

export default function AIStrategyScreen() {
  const [companyId, setCompanyId] = useState<string>('');
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [insightSummary, setInsightSummary] = useState<InsightSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // Listen for navigation events from reasoning screen
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.screen === 'ai-strategy' && e.detail?.companyId) {
        setCompanyId(e.detail.companyId);
      }
    };
    window.addEventListener('navigate-to', handler);
    return () => window.removeEventListener('navigate-to', handler);
  }, []);

  // Fetch strategy when companyId changes
  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoadingData(true);
    try {
      const [stratRes, insRes] = await Promise.all([
        fetch(`/api/g-ai-copilot/accounts/${companyId}/strategy`),
        fetch(`/api/g-ai-copilot/accounts/${companyId}/reasoning`),
      ]);
      if (stratRes.ok) {
        const stratData = await stratRes.json();
        setStrategy(stratData.strategy);
      }
      if (insRes.ok) {
        const insData = await insRes.json();
        if (insData.insight) {
          setInsightSummary({
            summary: insData.insight.summary,
            insightType: insData.insight.insightType,
            confidenceScore: insData.insight.confidenceScore,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/g-ai-copilot/accounts/${companyId}/strategy`, { method: 'POST' });
      if (res.ok) {
        toast.success('Engagement strategy generated');
        await fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to generate strategy');
      }
    } catch (err) {
      toast.error('Network error. Check AI provider configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
            <Crosshair className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">AI Engagement Strategy</h2>
            <p className="text-sm text-gray-500">Account-specific engagement playbook</p>
          </div>
        </div>
        {companyId && (
          <Button onClick={handleGenerate} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Strategy
          </Button>
        )}
      </div>

      <Separator />

      {!companyId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Crosshair className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No Company Selected</h3>
            <p className="text-sm text-gray-400 mt-1">Generate a strategic insight first, then navigate here.</p>
          </CardContent>
        </Card>
      ) : loadingData ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : strategy ? (
        <div className="space-y-6">
          {/* Insight Context */}
          {insightSummary && (
            <Card className="bg-violet-50 border-violet-100">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <BadgeCheck className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-violet-900">Strategic Insight Context</p>
                    <p className="text-sm text-violet-700 mt-1">{insightSummary.summary}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Priority Score + Situation Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Priority Score */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Priority Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full text-white font-bold text-lg ${getPriorityColor(strategy.priorityScore)}`}>
                    {strategy.priorityScore}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{getPriorityLabel(strategy.priorityScore)}</p>
                    <p className="text-xs text-gray-500">out of 100</p>
                  </div>
                </div>
                <Progress value={strategy.priorityScore} className="mt-3 h-2" />
              </CardContent>
            </Card>

            {/* Current Phase */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Current Phase</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="text-sm py-1 px-3 bg-blue-100 text-blue-800 border-blue-200">
                  {strategy.situationAssessment.currentPhase?.replace(/_/g, ' ') || 'Unknown'}
                </Badge>
                <p className="text-xs text-gray-500 mt-2">
                  Maturity: {strategy.situationAssessment.maturityLevel || 'Unknown'}
                </p>
              </CardContent>
            </Card>

            {/* Meeting Objective */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">First Meeting</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-medium text-gray-900">
                    {getObjectiveLabel(strategy.firstMeetingObjective)}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-1">Recommended objective</p>
              </CardContent>
            </Card>
          </div>

          {/* Key Drivers */}
          {strategy.situationAssessment.keyDrivers?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Key Drivers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {strategy.situationAssessment.keyDrivers.map((driver, i) => (
                    <Badge key={i} variant="secondary" className="text-sm py-1 px-3">{driver}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended Entry Point */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-violet-600" />
                Recommended Entry Point
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Department:</span>
                    <Badge variant="outline">{strategy.recommendedEntry.department}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Role:</span>
                    <Badge variant="outline">{strategy.recommendedEntry.role}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Rationale</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{strategy.recommendedEntry.rationale}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conversation Angles */}
          {strategy.conversationAngles.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  Conversation Angles ({strategy.conversationAngles.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {strategy.conversationAngles.map((angle, i) => (
                    <div key={i} className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">{angle.angle}</h4>
                      <ul className="space-y-1.5">
                        {angle.talkingPoints.map((tp, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-blue-800">
                            <span className="text-blue-400 mt-0.5">&#8226;</span>
                            {tp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Factors */}
          {strategy.riskFactors.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  Risk Factors ({strategy.riskFactors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {strategy.riskFactors.map((risk, i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{risk.risk}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <Badge className={`text-xs ${getSeverityColor(risk.severity)}`}>
                                {risk.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              <span className="font-medium">Mitigation:</span> {risk.mitigation}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(strategy.generatedAt).toLocaleString()}</span>
            {strategy.modelUsed && <span>Model: {strategy.modelUsed}</span>}
            <span>Generated by: {strategy.generatedBy}</span>
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Crosshair className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No Engagement Strategy Yet</h3>
            <p className="text-sm text-gray-400 mt-1">Generate a strategic insight first, then create a strategy from it.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
