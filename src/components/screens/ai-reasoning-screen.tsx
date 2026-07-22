'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw,
  Target,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

/* ── Types ── */

interface StrategicInsightData {
  id: string;
  companyId: string;
  insightType: string;
  summary: string;
  keyThemes: string[];
  reasoningSummary: {
    observations: string[];
    interpretation: string;
    confidenceFactors: string[];
  };
  supportingEvidence: Array<{
    evidenceId: string;
    relevance: string;
    quote: string;
  }>;
  confidenceScore: number;
  generatedBy: string;
  modelUsed: string;
  generatedAt: string;
  expiresAt: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
  industry: string | null;
  intelligenceScore: number;
  status: string;
}

/* ── Helpers ── */

function getConfidenceColor(score: number): string {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function getConfidenceBg(score: number): string {
  if (score >= 75) return 'bg-emerald-50 border-emerald-200';
  if (score >= 50) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function getInsightTypeIcon(type: string) {
  switch (type) {
    case 'STRATEGIC_SHIFT': return <Zap className="h-4 w-4" />;
    case 'OPPORTUNITY': return <TrendingUp className="h-4 w-4" />;
    case 'RISK': return <AlertTriangle className="h-4 w-4" />;
    case 'PATTERN_EMERGED': return <Lightbulb className="h-4 w-4" />;
    default: return <Sparkles className="h-4 w-4" />;
  }
}

function getInsightTypeColor(type: string): string {
  switch (type) {
    case 'STRATEGIC_SHIFT': return 'bg-violet-100 text-violet-800 border-violet-200';
    case 'OPPORTUNITY': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'RISK': return 'bg-red-100 text-red-800 border-red-200';
    case 'PATTERN_EMERGED': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getConfidenceLabel(score: number): string {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium-High';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Very Low';
}

/* ── Component ── */

export default function AIReasoningScreen() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [insight, setInsight] = useState<StrategicInsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [companiesLoading, setCompaniesLoading] = useState(true);

  // Fetch companies on mount
  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch('/api/g-crm/companies?limit=50&sortBy=intelligenceScore&sortOrder=desc');
        if (res.ok) {
          const data = await res.json();
          setCompanies((data.companies || []).map((c: any) => ({
            id: c.id,
            name: c.rawName || c.name,
            industry: c.industry,
            intelligenceScore: c.intelligenceScore || 0,
            status: c.status,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch companies:', err);
      } finally {
        setCompaniesLoading(false);
      }
    }
    fetchCompanies();
  }, []);

  // Fetch latest insight when company changes
  const fetchInsight = useCallback(async () => {
    if (!selectedCompanyId) {
      setInsight(null);
      return;
    }
    setLoadingInsight(true);
    try {
      const res = await fetch(`/api/g-ai-copilot/accounts/${selectedCompanyId}/reasoning`);
      if (res.ok) {
        const data = await res.json();
        setInsight(data.insight);
      }
    } catch (err) {
      console.error('Failed to fetch insight:', err);
    } finally {
      setLoadingInsight(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  // Generate new insight
  const handleGenerate = async () => {
    if (!selectedCompanyId) {
      toast.error('Select a company first');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/g-ai-copilot/accounts/${selectedCompanyId}/reason`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        toast.success('Strategic insight generated successfully');
        // Re-fetch to get the saved version
        await fetchInsight();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to generate insight');
      }
    } catch (err) {
      toast.error('Network error. Check if AI providers are configured in Settings.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
            <Brain className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">AI Reasoning Engine</h2>
            <p className="text-sm text-gray-500">Strategic insight synthesis from intelligence data</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Company Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Company</label>
              {companiesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a company to analyze..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <span>{c.name}</span>
                          {c.industry && (
                            <Badge variant="outline" className="text-xs">{c.industry}</Badge>
                          )}
                          {c.intelligenceScore > 0 && (
                            <span className="text-xs text-gray-400">Score: {c.intelligenceScore}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!selectedCompanyId || loading}
              className="bg-violet-600 hover:bg-violet-700 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Insight
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Insight Display */}
      {loadingInsight ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : insight ? (
        <div className="space-y-6">
          {/* Insight Summary Card */}
          <Card className={`border-2 ${getConfidenceBg(insight.confidenceScore)}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={getInsightTypeColor(insight.insightType)}>
                    {getInsightTypeIcon(insight.insightType)}
                    <span className="ml-1">{insight.insightType.replace(/_/g, ' ')}</span>
                  </Badge>
                  <Badge variant="outline">
                    Confidence: {insight.confidenceScore.toFixed(0)}/100 — {getConfidenceLabel(insight.confidenceScore)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {new Date(insight.generatedAt).toLocaleDateString()}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed text-gray-800">{insight.summary}</p>
            </CardContent>
          </Card>

          {/* Key Themes */}
          {insight.keyThemes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-600" />
                  Key Themes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {insight.keyThemes.map((theme, i) => (
                    <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                      {theme}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reasoning Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                Reasoning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {insight.reasoningSummary.observations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Observations</h4>
                  <ul className="space-y-1.5">
                    {insight.reasoningSummary.observations.map((obs, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-violet-500 shrink-0" />
                        {obs}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {insight.reasoningSummary.interpretation && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Interpretation</h4>
                  <p className="text-sm text-gray-700 bg-amber-50 rounded-lg p-3 border border-amber-100">
                    {insight.reasoningSummary.interpretation}
                  </p>
                </div>
              )}
              {insight.reasoningSummary.confidenceFactors.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Confidence Factors</h4>
                  <ul className="space-y-1.5">
                    {insight.reasoningSummary.confidenceFactors.map((factor, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supporting Evidence */}
          {insight.supportingEvidence.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Supporting Evidence ({insight.supportingEvidence.length} sources)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {insight.supportingEvidence.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
                      <Badge variant="outline" className="text-xs shrink-0 mt-0.5">{ev.relevance}</Badge>
                      <div>
                        <p className="text-sm text-gray-700">&ldquo;{ev.quote}&rdquo;</p>
                        <p className="text-xs text-gray-400 mt-1">ID: {ev.evidenceId}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigate-to', { detail: { screen: 'ai-strategy', companyId: selectedCompanyId } }));
              }}
              disabled={!selectedCompanyId}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Generate Engagement Strategy
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigate-to', { detail: { screen: 'enhanced-brief', companyId: selectedCompanyId } }));
              }}
              disabled={!selectedCompanyId}
            >
              <FileText className="h-4 w-4 mr-2" />
              Enhance Executive Brief
            </Button>
          </div>
        </div>
      ) : selectedCompanyId && !loadingInsight ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No Strategic Insight Yet</h3>
            <p className="text-sm text-gray-400 mt-1 max-w-md">
              Click &quot;Generate Insight&quot; to analyze this company&apos;s intelligence data and produce a strategic assessment.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
