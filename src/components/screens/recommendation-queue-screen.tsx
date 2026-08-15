'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/screen-states';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { InlineFeedback } from '@/components/feedback/inline-feedback';
import {
  Brain,
  CheckCircle2,
  XCircle,
  Inbox,
  Filter,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Clock,
  Lightbulb,
  AlertTriangle,
  Zap,
  InboxIcon,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';

// ── Types ──
type RecType = 'action' | 'insight' | 'warning';
type RecStatus = 'pending' | 'accepted' | 'dismissed' | 'expired';
type Priority = 'high' | 'medium' | 'low';

// API response shape (after fetchApi unwraps { data: ... })
type RecItem = {
  id: string;
  title: string;
  confidenceScore: number | null;
  status: string;
  reasoningMethod: string;
  createdAt: string;
  organization?: { name: string; domain?: string; industry?: string } | null;
};

type RecStats = {
  total: number;
  accepted: number;
  dismissed: number;
  pending: number;
};

type Organization = {
  id: string;
  name: string;
};

type Recommendation = {
  id: string;
  priority: Priority;
  title: string;
  account: string;
  type: RecType;
  confidence: number;
  created: string;
  status: RecStatus;
};

// ── Helpers ──
function mapReasoningMethodToType(method: string): RecType {
  if (method === 'template') return 'action';
  if (method === 'llm') return 'insight';
  return 'warning';
}

function inferPriority(confidenceScore: number | null): Priority {
  if (confidenceScore === null) return 'medium';
  if (confidenceScore >= 85) return 'high';
  if (confidenceScore >= 70) return 'medium';
  return 'low';
}

function mapApiRec(rec: RecItem): Recommendation {
  return {
    id: rec.id,
    priority: inferPriority(rec.confidenceScore),
    title: rec.title,
    account: rec.organization?.name ?? 'Unknown',
    type: mapReasoningMethodToType(rec.reasoningMethod),
    confidence: rec.confidenceScore != null ? Number(rec.confidenceScore) : 50,
    created: new Date(rec.createdAt).toLocaleDateString(),
    status: rec.status as RecStatus,
  };
}

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

const statusConfig: Record<RecStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: tokens.accent.ghost, text: tokens.accent.primary, label: 'Pending' },
  accepted: {
    bg: tokens.confidence.high.bg,
    text: tokens.confidence.high.value,
    label: 'Accepted',
  },
  dismissed: { bg: tokens.neutral['100'], text: tokens.text.muted, label: 'Dismissed' },
  expired: { bg: tokens.neutral['100'], text: tokens.text.muted, label: 'Expired' },
};

const priorityColors: Record<Priority, string> = {
  high: tokens.priority.high,
  medium: tokens.priority.medium,
  low: tokens.priority.low,
};

// ── Component ──
export default function RecommendationQueue() {
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [stats, setStats] = useState<RecStats>({ total: 0, accepted: 0, dismissed: 0, pending: 0 });
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchApi<{ recommendations: RecItem[]; stats: RecStats }>(
      '/api/recommendations',
    );
    if (error) {
      toast.error('Failed to load recommendations', { description: error });
    } else if (data) {
      const mapped = (data.recommendations ?? []).map(mapApiRec);
      setRecs(mapped);
      if (data.stats) {
        setStats(data.stats);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  const filtered = useMemo(() => {
    return recs.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [recs, typeFilter, statusFilter]);

  const handleStatus = async (id: string, newStatus: RecStatus) => {
    const { error } = await fetchApi(`/api/recommendations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (error) {
      toast.error('Failed to update recommendation', { description: error });
      return;
    }
    setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
  };

  const handleGenerateNew = async () => {
    // Fetch organizations to get an organizationId for the pipeline
    const { data: orgsData, error: orgsError } =
      await fetchApi<Organization[]>('/api/organizations');
    if (orgsError) {
      toast.error('Failed to fetch organizations', { description: orgsError });
      return;
    }
    const orgId = Array.isArray(orgsData) && orgsData.length > 0 ? orgsData[0].id : undefined;
    if (!orgId) {
      toast.error('No organizations found', { description: 'Create an organization first' });
      return;
    }

    const { error } = await fetchApi('/api/advisor/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId }),
    });
    if (error) {
      toast.error('Failed to generate recommendations', { description: error });
      return;
    }
    toast.success('New recommendations generated');
    fetchRecs();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
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
            AI-powered recommendations for your pipeline
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          style={{ color: tokens.accent.primary, borderColor: tokens.accent.primary }}
          onClick={handleGenerateNew}
        >
          <Sparkles className="w-3.5 h-3.5" /> Generate New
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Queue Depth',
            value: stats.pending,
            icon: InboxIcon,
            color: tokens.accent.primary,
            desc: 'Pending recommendations',
          },
          {
            label: 'Accepted Today',
            value: stats.accepted,
            icon: CheckCircle2,
            color: tokens.confidence.high.value,
            desc: 'Acted upon',
          },
          {
            label: 'Dismissed',
            value: stats.dismissed,
            icon: XCircle,
            color: tokens.text.muted,
            desc: 'Not applicable',
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="py-4 gap-2">
              <CardContent className="p-4 pb-0">
                <div className="flex items-center justify-between">
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <p className="text-2xl font-bold mt-2" style={{ color: tokens.text.primary }}>
                  {s.value}
                </p>
                <p className="text-xs" style={{ color: tokens.text.muted }}>
                  {s.label}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4" style={{ color: tokens.text.muted }} />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px] h-8">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="action">Action</SelectItem>
            <SelectItem value="insight">Insight</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-8">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs ml-auto" style={{ color: tokens.text.muted }}>
          {filtered.length} of {recs.length} recommendations
        </span>
      </div>

      {/* DataTable */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No recommendations match your filters"
              description="Try adjusting your filter criteria"
              className="py-16"
            />
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Priority</TableHead>
                    <TableHead>Recommendation</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((rec) => {
                    const tc = typeConfig[rec.type];
                    const sc = statusConfig[rec.status];
                    return (
                      <TableRow key={rec.id}>
                        <TableCell className="pl-4">
                          <span
                            className="flex items-center gap-1.5 text-xs font-bold uppercase"
                            style={{ color: priorityColors[rec.priority] }}
                          >
                            {rec.priority === 'high' ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : rec.priority === 'low' ? (
                              <ArrowDown className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {rec.priority}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: tokens.text.primary }}
                          >
                            {rec.title}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm" style={{ color: tokens.text.secondary }}>
                            {rec.account}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: tc.bg, color: tc.text }}
                          >
                            {tc.icon} {tc.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-12 h-1.5 rounded-full overflow-hidden"
                              style={{ backgroundColor: tokens.neutral['100'] }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${rec.confidence}%`,
                                  backgroundColor:
                                    rec.confidence >= 85
                                      ? tokens.confidence.high.value
                                      : rec.confidence >= 70
                                        ? tokens.confidence.medium.value
                                        : tokens.confidence.low.value,
                                }}
                              />
                            </div>
                            <span
                              className="text-xs font-medium"
                              style={{ color: tokens.text.secondary }}
                            >
                              {rec.confidence}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs" style={{ color: tokens.text.muted }}>
                            {rec.created}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: sc.bg, color: sc.text }}
                          >
                            {sc.label}
                          </span>
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {rec.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1"
                                  style={{ color: tokens.confidence.high.value }}
                                  onClick={() => handleStatus(rec.id, 'accepted')}
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1"
                                  style={{ color: tokens.text.muted }}
                                  onClick={() => handleStatus(rec.id, 'dismissed')}
                                >
                                  <XCircle className="w-3 h-3" /> Dismiss
                                </Button>
                              </>
                            )}
                          </div>
                          <InlineFeedback
                            context="recommendation-queue"
                            itemId={rec.id}
                            itemType="recommendation"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
