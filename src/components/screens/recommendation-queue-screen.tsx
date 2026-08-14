'use client';

import { useState, useMemo } from 'react';
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

// ── Mock Data ──
type RecType = 'action' | 'insight' | 'warning';
type RecStatus = 'new' | 'accepted' | 'dismissed';
type Priority = 'high' | 'medium' | 'low';

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

const initialRecs: Recommendation[] = [
  {
    id: 'r1',
    priority: 'high',
    title: 'Schedule executive briefing with Acme Corp CTO',
    account: 'Acme Corp',
    type: 'action',
    confidence: 94,
    created: '10 min ago',
    status: 'new',
  },
  {
    id: 'r2',
    priority: 'high',
    title: 'NovaTech showing strong buying signals — 3 new signals in 24h',
    account: 'NovaTech',
    type: 'insight',
    confidence: 91,
    created: '25 min ago',
    status: 'new',
  },
  {
    id: 'r3',
    priority: 'high',
    title: 'Pinnacle Health contract renewal at risk — engagement dropped 40%',
    account: 'Pinnacle Health',
    type: 'warning',
    confidence: 88,
    created: '1h ago',
    status: 'new',
  },
  {
    id: 'r4',
    priority: 'medium',
    title: 'Cross-sell opportunity: Quantum Dynamics needs security module',
    account: 'Quantum Dynamics',
    type: 'action',
    confidence: 85,
    created: '2h ago',
    status: 'new',
  },
  {
    id: 'r5',
    priority: 'medium',
    title: 'SkyBridge Labs competitor evaluation nearing completion',
    account: 'SkyBridge Labs',
    type: 'insight',
    confidence: 82,
    created: '3h ago',
    status: 'new',
  },
  {
    id: 'r6',
    priority: 'low',
    title: 'Meridian Inc posted about data platform consolidation',
    account: 'Meridian Inc',
    type: 'insight',
    confidence: 76,
    created: '4h ago',
    status: 'new',
  },
  {
    id: 'r7',
    priority: 'medium',
    title: 'Vertex AI expanding team — potential upsell window',
    account: 'Vertex AI',
    type: 'action',
    confidence: 79,
    created: '5h ago',
    status: 'accepted',
  },
  {
    id: 'r8',
    priority: 'low',
    title: 'Horizon Labs budget review scheduled for Q2',
    account: 'Horizon Labs',
    type: 'insight',
    confidence: 68,
    created: '6h ago',
    status: 'accepted',
  },
  {
    id: 'r9',
    priority: 'low',
    title: 'Legacy contact email bounced at DataFlow Inc',
    account: 'DataFlow Inc',
    type: 'warning',
    confidence: 72,
    created: '8h ago',
    status: 'dismissed',
  },
  {
    id: 'r10',
    priority: 'medium',
    title: 'Catalyst Systems evaluating 3 competitors — respond with differentiation',
    account: 'Catalyst Systems',
    type: 'action',
    confidence: 84,
    created: '12h ago',
    status: 'dismissed',
  },
];

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

const statusConfig: Record<RecStatus, { bg: string; text: string; label: string }> = {
  new: { bg: tokens.accent.ghost, text: tokens.accent.primary, label: 'New' },
  accepted: {
    bg: tokens.confidence.high.bg,
    text: tokens.confidence.high.value,
    label: 'Accepted',
  },
  dismissed: { bg: tokens.neutral['100'], text: tokens.text.muted, label: 'Dismissed' },
};

const priorityColors: Record<Priority, string> = {
  high: tokens.priority.high,
  medium: tokens.priority.medium,
  low: tokens.priority.low,
};

// ── Component ──
export default function RecommendationQueue() {
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState(initialRecs);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    return recs.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [recs, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const newCount = recs.filter((r) => r.status === 'new').length;
    const acceptedToday = recs.filter((r) => r.status === 'accepted').length;
    const dismissedCount = recs.filter((r) => r.status === 'dismissed').length;
    return { queueDepth: newCount, acceptedToday, dismissed: dismissedCount };
  }, [recs]);

  const handleStatus = (id: string, newStatus: RecStatus) => {
    setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
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
        >
          <Sparkles className="w-3.5 h-3.5" /> Generate New
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Queue Depth',
            value: stats.queueDepth,
            icon: InboxIcon,
            color: tokens.accent.primary,
            desc: 'Pending recommendations',
          },
          {
            label: 'Accepted Today',
            value: stats.acceptedToday,
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
            <SelectItem value="new">New</SelectItem>
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
                          {rec.status === 'new' && (
                            <div className="flex items-center justify-end gap-1">
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
                            </div>
                          )}
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
