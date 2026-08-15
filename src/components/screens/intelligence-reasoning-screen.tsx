'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Activity,
  Brain,
  AlertTriangle,
  BarChart3,
  Filter,
  RefreshCw,
  MessageSquare,
  Lightbulb,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────

interface InsightRow {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationDomain: string | null;
  signalType: string | null;
  signalSeverity: string | null;
  category: string;
  title: string;
  narrative: string;
  recommendation: string | null;
  suggestedMessage: string | null;
  confidence: string;
  confidenceScore: number | null;
  reasoningMethod: string;
  modelUsed: string | null;
  createdAt: string;
}

function getConfidenceBadge(confidence: string, score: number | null) {
  const numScore = score ?? 0;
  if (confidence === 'very_high' || numScore >= 85)
    return (
      <Badge
        style={{
          backgroundColor: tokens.confidence.high.bg,
          color: tokens.confidence.high.value,
          borderColor: tokens.confidence.high.border,
          borderWidth: 1,
        }}
      >
        {confidence}
        {score ? ` (${score}%)` : ''}
      </Badge>
    );
  if (confidence === 'high' || numScore >= 70)
    return (
      <Badge
        style={{
          backgroundColor: tokens.confidence.medium.bg,
          color: tokens.confidence.medium.value,
          borderColor: tokens.confidence.medium.border,
          borderWidth: 1,
        }}
      >
        {confidence}
        {score ? ` (${score}%)` : ''}
      </Badge>
    );
  return (
    <Badge
      style={{
        backgroundColor: tokens.confidence.low.bg,
        color: tokens.confidence.low.value,
        borderColor: tokens.confidence.low.border,
        borderWidth: 1,
      }}
    >
      {confidence}
      {score ? ` (${score}%)` : ''}
    </Badge>
  );
}

function getMethodBadge(method: string) {
  const map: Record<string, { bg: string; color: string }> = {
    llm: { bg: tokens.domain.bg, color: tokens.domain.value },
    rule: { bg: tokens.confidence.high.bg, color: tokens.confidence.high.value },
    hybrid: { bg: tokens.gold.bgMedium, color: tokens.gold.dark },
    template: { bg: tokens.accent.subtle, color: tokens.accent.primary },
  };
  const style = map[method] || map.template;
  return (
    <Badge
      className="uppercase text-[10px] font-bold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {method}
    </Badge>
  );
}

export default function IntelligenceReasoning() {
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedInsight, setSelectedInsight] = useState<InsightRow | null>(null);

  // Q12 FIX: Fetch real insights from API
  const {
    data: insightsData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['insights-reasoning', methodFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (methodFilter !== 'all') {
        params.set('category', methodFilter);
      }
      const result = await fetchApi<InsightRow[]>('/api/insights?' + params.toString());
      return result.data;
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const insights = insightsData || [];

  const filteredRuns = useMemo(() => {
    return insights.filter((r) => {
      if (
        search &&
        !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !r.narrative.toLowerCase().includes(search.toLowerCase()) &&
        !r.organizationName.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [insights, search]);

  const stats = useMemo(() => {
    const totalRuns = insights.length;
    const errors = insights.filter((r) => r.confidence === 'very_low');
    const models = new Set(insights.map((r) => r.modelUsed).filter(Boolean));
    const avgScore = insights.reduce((a, b) => a + (b.confidenceScore ?? 0), 0) / (totalRuns || 1);
    const withRecommendation = insights.filter((r) => r.recommendation).length;
    const withMessage = insights.filter((r) => r.suggestedMessage).length;
    return {
      runsTotal: totalRuns,
      avgConfidence: avgScore.toFixed(1),
      modelsUsed: models.size,
      errors: errors.length,
      withRecommendation,
      withMessage,
    };
  }, [insights]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Intelligence Reasoning Engine
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            AI-generated insights with recommendations and suggested messages
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Insights',
            value: stats.runsTotal,
            icon: Brain,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Avg Confidence',
            value: `${stats.avgConfidence}%`,
            icon: BarChart3,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'With Recommendations',
            value: stats.withRecommendation,
            icon: Lightbulb,
            color: tokens.gold.dark,
            bg: tokens.gold.bgMedium,
          },
          {
            label: 'With Suggested Messages',
            value: stats.withMessage,
            icon: MessageSquare,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
        ].map((stat) => (
          <Card key={stat.label} className="gap-4 py-4">
            <CardContent className="flex items-center gap-4">
              <div
                className="flex items-center justify-center size-10 rounded-lg"
                style={{ backgroundColor: stat.bg }}
              >
                <stat.icon className="size-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  {stat.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="gap-4 py-4">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
              style={{ color: tokens.text.muted }}
            />
            <Input
              placeholder="Search insights, narratives, orgs..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="opportunity">Opportunity</SelectItem>
              <SelectItem value="risk">Risk</SelectItem>
              <SelectItem value="growth">Growth</SelectItem>
              <SelectItem value="competitive">Competitive</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs" style={{ color: tokens.text.muted }}>
            {filteredRuns.length} of {insights.length} insights
          </span>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="gap-0 py-0 overflow-hidden">
        <CardContent className="p-0 max-h-[520px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                <TableHead className="w-[180px]">Organization</TableHead>
                <TableHead className="w-[150px]">Title</TableHead>
                <TableHead className="w-[90px]">Method</TableHead>
                <TableHead className="w-[100px]">Confidence</TableHead>
                <TableHead className="w-[80px]">Model</TableHead>
                <TableHead className="w-[100px]">Has Rec.</TableHead>
                <TableHead>Recommendation Preview</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div
                      className="flex items-center justify-center gap-2"
                      style={{ color: tokens.text.muted }}
                    >
                      <RefreshCw className="size-4 animate-spin" />
                      Loading insights from database...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRuns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center"
                    style={{ color: tokens.text.muted }}
                  >
                    {insights.length === 0
                      ? 'No insights generated yet. Run the intelligence pipeline to generate insights.'
                      : 'No insights match the current filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRuns.map((insight) => (
                  <TableRow
                    key={insight.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedInsight(insight)}
                  >
                    <TableCell
                      className="font-medium max-w-[180px] truncate"
                      style={{ color: tokens.text.primary }}
                    >
                      {insight.organizationName}
                    </TableCell>
                    <TableCell
                      className="text-xs max-w-[150px] truncate"
                      style={{ color: tokens.text.secondary }}
                    >
                      {insight.title}
                    </TableCell>
                    <TableCell>{getMethodBadge(insight.reasoningMethod)}</TableCell>
                    <TableCell>
                      {getConfidenceBadge(insight.confidence, insight.confidenceScore)}
                    </TableCell>
                    <TableCell className="text-xs" style={{ color: tokens.text.secondary }}>
                      {insight.modelUsed || '—'}
                    </TableCell>
                    <TableCell>
                      {insight.recommendation ? (
                        <Badge
                          style={{
                            backgroundColor: tokens.confidence.high.bg,
                            color: tokens.confidence.high.value,
                            borderWidth: 1,
                          }}
                        >
                          <Lightbulb className="size-3 mr-1" /> Yes
                        </Badge>
                      ) : (
                        <span style={{ color: tokens.text.muted }}>—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-xs max-w-[300px] truncate"
                      style={{ color: tokens.text.secondary }}
                    >
                      {insight.recommendation
                        ? insight.recommendation.slice(0, 80) +
                          (insight.recommendation.length > 80 ? '...' : '')
                        : insight.narrative.slice(0, 80) +
                          (insight.narrative.length > 80 ? '...' : '')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Q12 FIX: Insight Detail Dialog showing recommendation + suggestedMessage */}
      <Dialog open={!!selectedInsight} onOpenChange={() => setSelectedInsight(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="size-5" style={{ color: tokens.domain.value }} />
              {selectedInsight?.title || 'Insight Detail'}
            </DialogTitle>
          </DialogHeader>
          {selectedInsight && (
            <div className="space-y-4">
              {/* Meta info */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{selectedInsight.organizationName}</Badge>
                {getMethodBadge(selectedInsight.reasoningMethod)}
                {getConfidenceBadge(selectedInsight.confidence, selectedInsight.confidenceScore)}
                {selectedInsight.modelUsed && (
                  <span className="text-xs" style={{ color: tokens.text.muted }}>
                    Model: {selectedInsight.modelUsed}
                  </span>
                )}
              </div>

              {/* Narrative */}
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: tokens.text.primary }}>
                  Analysis
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: tokens.text.secondary }}>
                  {selectedInsight.narrative}
                </p>
              </div>

              {/* Q12 FIX: Recommendation */}
              {selectedInsight.recommendation && (
                <div
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: tokens.gold.bgLight,
                    border: `1px solid ${tokens.gold.medium}`,
                  }}
                >
                  <h3
                    className="text-sm font-semibold mb-2 flex items-center gap-2"
                    style={{ color: tokens.gold.dark }}
                  >
                    <Lightbulb className="size-4" /> Recommendation
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: tokens.text.primary }}>
                    {selectedInsight.recommendation}
                  </p>
                </div>
              )}

              {/* Q12 FIX: Suggested Message */}
              {selectedInsight.suggestedMessage && (
                <div
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: tokens.accent.subtle,
                    border: `1px solid ${tokens.accent.primary}33`,
                  }}
                >
                  <h3
                    className="text-sm font-semibold mb-2 flex items-center gap-2"
                    style={{ color: tokens.accent.primary }}
                  >
                    <MessageSquare className="size-4" /> Suggested Message
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: tokens.text.primary }}>
                    {selectedInsight.suggestedMessage}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 gap-2"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedInsight.suggestedMessage || '');
                      toast.success('Message copied to clipboard');
                    }}
                  >
                    Copy Message
                  </Button>
                </div>
              )}

              {/* Category */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>
                  Category:
                </span>
                <Badge variant="secondary">{selectedInsight.category}</Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
