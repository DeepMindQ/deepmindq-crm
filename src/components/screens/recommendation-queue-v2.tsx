'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/screen-states';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';
import {
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  Lightbulb,
  AlertTriangle,
  Zap,
  ArrowRight,
  GripVertical,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';

// ── Mock Data ──
type RecType = 'action' | 'insight' | 'warning';
type RecStatus = 'new' | 'reviewed' | 'accepted' | 'dismissed';

type CardData = {
  id: string;
  title: string;
  account: string;
  type: RecType;
  confidence: number;
  status: RecStatus;
  priority: 'high' | 'medium' | 'low';
};

// Card data now fetched from /api/recommendations

// ── Helpers ──
const typeConfig: Record<
  RecType,
  { bg: string; text: string; label: string; icon: React.ReactNode }
> = {
  action: {
    bg: tokens.accent.ghost,
    text: tokens.accent.primary,
    label: 'Action',
    icon: <Zap className="w-3 h-3" />,
  },
  insight: {
    bg: tokens.confidence.high.bg,
    text: tokens.confidence.high.value,
    label: 'Insight',
    icon: <Lightbulb className="w-3 h-3" />,
  },
  warning: {
    bg: tokens.confidence.low.bg,
    text: tokens.confidence.low.value,
    label: 'Warning',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

const columnConfig: Record<
  RecStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  new: {
    label: 'New',
    color: tokens.accent.primary,
    bg: `${tokens.accent.primary}08`,
    border: `${tokens.accent.primary}25`,
  },
  reviewed: {
    label: 'Reviewed',
    color: tokens.confidence.medium.value,
    bg: `${tokens.confidence.medium.value}08`,
    border: `${tokens.confidence.medium.value}25`,
  },
  accepted: {
    label: 'Accepted',
    color: tokens.confidence.high.value,
    bg: `${tokens.confidence.high.value}08`,
    border: `${tokens.confidence.high.value}25`,
  },
  dismissed: {
    label: 'Dismissed',
    color: tokens.text.muted,
    bg: `${tokens.neutral['100']}50`,
    border: `${tokens.border.default}`,
  },
};

const columns: RecStatus[] = ['new', 'reviewed', 'accepted', 'dismissed'];

// ── Component ──
export function RecommendationQueueV2() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardData[]>([]);

  const fetchCards = useCallback(async () => {
    const { data, error } = await fetchApi<CardData[]>('/api/recommendations');
    if (error) {
      toast.error('Failed to load recommendations', { description: error });
    } else if (data) {
      setCards(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const moveCard = async (cardId: string, newStatus: RecStatus) => {
    const { error } = await fetchApi(`/api/recommendations/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (error) {
      toast.error('Failed to update recommendation', { description: error });
    } else {
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: newStatus } : c)));
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Recommendation Queue V2
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Click actions to move cards between columns
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          style={{ color: tokens.accent.primary, borderColor: tokens.accent.primary }}
        >
          <Sparkles className="w-3.5 h-3.5" /> Generate New
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((status) => {
          const config = columnConfig[status];
          const colCards = cards.filter((c) => c.status === status);
          const nextStatus = columns[columns.indexOf(status) + 1];
          const prevStatus = columns[columns.indexOf(status) - 1];

          return (
            <div
              key={status}
              className="flex flex-col rounded-xl min-h-[400px]"
              style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}
            >
              {/* Column Header */}
              <div className="p-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <h3 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                    {config.label}
                  </h3>
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-5 min-w-[20px] justify-center px-1.5"
                  >
                    {colCards.length}
                  </Badge>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 px-3 pb-3 space-y-3 max-h-[600px] overflow-y-auto">
                {colCards.length === 0 ? (
                  <div
                    className="flex items-center justify-center py-12 text-xs"
                    style={{ color: tokens.text.muted }}
                  >
                    No items
                  </div>
                ) : (
                  colCards.map((card) => {
                    const tc = typeConfig[card.type];
                    return (
                      <div
                        key={card.id}
                        className="bg-card rounded-lg p-4 shadow-sm border transition-shadow hover:shadow-md cursor-default"
                        style={{ borderColor: tokens.border.default }}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: tc.bg, color: tc.text }}
                          >
                            {tc.icon} {tc.label}
                          </span>
                          <span
                            className="text-[10px] font-bold uppercase"
                            style={{
                              color:
                                card.priority === 'high'
                                  ? tokens.priority.high
                                  : card.priority === 'medium'
                                    ? tokens.priority.medium
                                    : tokens.priority.low,
                            }}
                          >
                            {card.priority}
                          </span>
                        </div>

                        {/* Title */}
                        <p
                          className="text-sm font-medium leading-snug mb-3"
                          style={{ color: tokens.text.primary }}
                        >
                          {card.title}
                        </p>

                        {/* Account */}
                        <p className="text-xs mb-3" style={{ color: tokens.text.secondary }}>
                          {card.account}
                        </p>

                        {/* Confidence Bar */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px]" style={{ color: tokens.text.muted }}>
                              Confidence
                            </span>
                            <span
                              className="text-[11px] font-semibold"
                              style={{
                                color:
                                  card.confidence >= 85
                                    ? tokens.confidence.high.value
                                    : card.confidence >= 70
                                      ? tokens.confidence.medium.value
                                      : tokens.confidence.low.value,
                              }}
                            >
                              {card.confidence}%
                            </span>
                          </div>
                          <div
                            className="w-full h-1.5 rounded-full overflow-hidden"
                            style={{ backgroundColor: tokens.neutral['100'] }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${card.confidence}%`,
                                backgroundColor:
                                  card.confidence >= 85
                                    ? tokens.confidence.high.value
                                    : card.confidence >= 70
                                      ? tokens.confidence.medium.value
                                      : tokens.confidence.low.value,
                              }}
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {status !== 'dismissed' && nextStatus && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-xs gap-1"
                            style={{ borderColor: config.border, color: config.color }}
                            onClick={() => moveCard(card.id, nextStatus)}
                          >
                            {nextStatus === 'reviewed'
                              ? 'Mark Reviewed'
                              : nextStatus === 'accepted'
                                ? 'Accept'
                                : 'Dismiss'}
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        )}
                        {prevStatus && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full h-7 text-xs mt-1"
                            style={{ color: tokens.text.muted }}
                            onClick={() => moveCard(card.id, prevStatus)}
                          >
                            ← Move back
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
