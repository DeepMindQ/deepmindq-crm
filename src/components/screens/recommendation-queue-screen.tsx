'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Brain,
  CheckCircle2,
  XCircle,
  Filter,
  Sparkles,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';

// ── Types ──

type RecStatus = 'active' | 'accepted' | 'dismissed';
type Priority = 'high' | 'medium' | 'low';

interface RecommendationItem {
  id: string;
  organizationName: string;
  organizationDomain: string | null;
  organizationIndustry: string | null;
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
  status: RecStatus;
  createdAt: string;
}

interface RecStats {
  total: number;
  accepted: number;
  dismissed: number;
  acceptanceRate: number;
  dismissalRate: number;
}

function getPriority(confidence: string, score: number | null): Priority {
  if (confidence === 'very_high' || confidence === 'high' || (score ?? 0) >= 80) return 'high';
  if (confidence === 'medium' || (score ?? 0) >= 50) return 'medium';
  return 'low';
}

function getConfidenceColor(confidence: string) {
  switch (confidence) {
    case 'very_high':
    case 'high':
      return { bg: tokens.confidence.high.bg, color: tokens.confidence.high.value };
    case 'medium':
      return { bg: tokens.confidence.medium.bg, color: tokens.confidence.medium.value };
    default:
      return { bg: tokens.confidence.low.bg, color: tokens.confidence.low.value };
  }
}

export default function RecommendationQueue() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Q6 FIX: Fetch real recommendations from /api/recommendations
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['recommendations', typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50', status: statusFilter });
      if (typeFilter !== 'all') params.set('category', typeFilter);
      const result = await fetchApi<{
        data: RecommendationItem[];
        stats: RecStats;
      }>('/api/recommendations?' + params.toString());
      return result.data;
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const recommendations = data?.data || [];
  const stats = data?.stats || {
    total: 0,
    accepted: 0,
    dismissed: 0,
    acceptanceRate: 0,
    dismissalRate: 0,
  };

  // Q7/Q8 FIX: Accept/Dismiss → persisted to DB via PATCH /api/insights/:id
  const handleAction = async (id: string, action: 'accept' | 'dismiss') => {
    setActionInProgress(id);
    try {
      const res = await fetch(`/api/insights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(`Recommendation ${action === 'accept' ? 'accepted' : 'dismissed'}`);
        refetch();
      } else {
        toast.error(`Failed to ${action} recommendation`);
      }
    } catch {
      toast.error(`Failed to ${action} recommendation`);
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredRecs = useMemo(() => {
    return recommendations.filter((r) => {
      return true; // server-side filtering handles this
    });
  }, [recommendations]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Recommendation Queue
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            AI-generated recommendations from intelligence pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-2"
            style={{ color: tokens.text.white, background: tokens.accent.primary }}
            onClick={() => {
              toast.info('Run the intelligence pipeline to generate new recommendations');
            }}
          >
            <Sparkles className="w-3.5 h-3.5" /> Generate New
          </Button>
        </div>
      </div>

      {/* Stats Row — Q11 FIX: Shows acceptance/dismissal rates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'In Queue',
            value: filteredRecs.length,
            icon: Lightbulb,
            color: tokens.gold.dark,
            bg: tokens.gold.bgMedium,
          },
          {
            label: 'Accepted',
            value: stats.accepted,
            icon: CheckCircle2,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Dismissed',
            value: stats.dismissed,
            icon: XCircle,
            color: tokens.confidence.low.value,
            bg: tokens.confidence.low.bg,
          },
          {
            label: 'Accept Rate',
            value: `${stats.acceptanceRate}%`,
            icon: TrendingUp,
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="size-4" style={{ color: tokens.text.muted }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{
              borderColor: tokens.border,
              backgroundColor: tokens.surface.secondary,
              color: tokens.text.primary,
            }}
          >
            <option value="active">Active</option>
            <option value="accepted">Accepted</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{
              borderColor: tokens.border,
              backgroundColor: tokens.surface.secondary,
              color: tokens.text.primary,
            }}
          >
            <option value="all">All Categories</option>
            <option value="opportunity">Opportunity</option>
            <option value="risk">Risk</option>
            <option value="recommendation">Recommendation</option>
            <option value="growth">Growth</option>
            <option value="competitive">Competitive</option>
          </select>
          <span className="text-xs" style={{ color: tokens.text.muted }}>
            {filteredRecs.length} recommendation{filteredRecs.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Recommendation Cards */}
      <div className="space-y-3">
        {filteredRecs.length === 0 ? (
          <Card className="gap-4 py-8">
            <CardContent className="text-center py-12">
              <Brain className="size-10 mx-auto mb-3" style={{ color: tokens.text.muted }} />
              <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                No recommendations found
              </p>
              <p className="text-xs mt-1" style={{ color: tokens.text.muted }}>
                Run the intelligence pipeline to generate recommendations from your data
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRecs.map((rec) => {
            const priority = getPriority(rec.confidence, rec.confidenceScore);
            const confColor = getConfidenceColor(rec.confidence);
            const isActing = actionInProgress === rec.id;

            return (
              <Card
                key={rec.id}
                className="gap-0 py-0 overflow-hidden"
                style={{
                  borderLeft: `3px solid ${
                    priority === 'high'
                      ? tokens.confidence.high.value
                      : priority === 'medium'
                        ? tokens.gold.dark
                        : tokens.text.muted
                  }`,
                }}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: tokens.surface.secondary,
                            color: tokens.text.muted,
                          }}
                        >
                          {rec.organizationName}
                        </span>
                        {rec.signalType && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: tokens.domain.bg,
                              color: tokens.domain.value,
                            }}
                          >
                            {rec.signalType}
                          </span>
                        )}
                        <Badge
                          className="text-[10px] px-1.5 py-0"
                          style={{ backgroundColor: confColor.bg, color: confColor.color }}
                        >
                          {rec.confidenceScore ?? rec.confidence}
                        </Badge>
                        <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                          {rec.reasoningMethod}
                        </span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                        {rec.title}
                      </p>
                      {/* Q12 FIX: Show recommendation text */}
                      {rec.recommendation && (
                        <div
                          className="rounded-lg p-3 text-xs leading-relaxed"
                          style={{
                            backgroundColor: tokens.gold.bgLight,
                            color: tokens.text.primary,
                          }}
                        >
                          <Lightbulb
                            className="size-3 inline mr-1"
                            style={{ color: tokens.gold.dark }}
                          />
                          {rec.recommendation}
                        </div>
                      )}
                      {/* Q12 FIX: Show suggestedMessage */}
                      {rec.suggestedMessage && (
                        <div
                          className="rounded-lg p-3 text-xs leading-relaxed"
                          style={{
                            backgroundColor: tokens.accent.subtle,
                            color: tokens.text.primary,
                          }}
                        >
                          <MessageSquare
                            className="size-3 inline mr-1"
                            style={{ color: tokens.accent.primary }}
                          />
                          {rec.suggestedMessage}
                        </div>
                      )}
                    </div>
                    {/* Q7/Q8 FIX: Accept/Dismiss → persisted to DB */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        disabled={isActing || rec.status === 'accepted'}
                        onClick={() => handleAction(rec.id, 'accept')}
                        style={{
                          borderColor: tokens.confidence.high.value,
                          color: tokens.confidence.high.value,
                        }}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        disabled={isActing || rec.status === 'dismissed'}
                        onClick={() => handleAction(rec.id, 'dismiss')}
                        style={{
                          borderColor: tokens.text.muted,
                          color: tokens.text.secondary,
                        }}
                      >
                        <XCircle className="size-3.5" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
