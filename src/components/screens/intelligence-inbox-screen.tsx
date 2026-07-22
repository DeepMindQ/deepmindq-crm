'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Inbox, Send, CheckCircle, XCircle, ArrowRight,
  ChevronDown, Filter, AlertTriangle, Tag, Loader2,
  Search, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ALL_CATEGORIES } from '@/lib/intelligence-sources/types';

// ─── Types ──────────────────────────────────────────────────────

type InboxStatus = 'pending' | 'approved' | 'rejected' | 'converted';
type InboxPriority = 'low' | 'normal' | 'high' | 'critical';

interface InboxStats {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  total: number;
}

interface InboxItem {
  id: string;
  companyId: string;
  submittedBy: string;
  content: string;
  summary?: string | null;
  category?: string | null;
  source?: string | null;
  priority: InboxPriority;
  status: InboxStatus;
  tags?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  convertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<InboxPriority, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  normal: 'bg-blue-100 text-blue-800 border-blue-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_COLORS: Record<InboxStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  converted: 'bg-indigo-100 text-indigo-800',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Component ──────────────────────────────────────────────────

export default function IntelligenceInboxScreen() {
  // Stats
  const [stats, setStats] = useState<InboxStats | null>(null);

  // List
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    companyId: '',
    submittedBy: '',
    content: '',
    summary: '',
    category: '',
    priority: 'normal' as InboxPriority,
    tags: '',
  });

  // Expanded items
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Action in-progress tracking
  const [actionInProgress, setActionInProgress] = useState<Set<string>>(new Set());

  // ─── Fetch Stats ──────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/g-intel-acquisition/inbox/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch {
      toast.error('Failed to load inbox stats');
    }
  }, []);

  // ─── Fetch Items ──────────────────────────────────────────────

  const fetchItems = useCallback(async (pageNum: number, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('limit', '20');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/g-intel-acquisition/inbox?${params}`);
      if (!res.ok) throw new Error('Failed to fetch inbox');
      const data = await res.json();

      const newItems: InboxItem[] = data.items ?? data ?? [];
      setItems(prev => (append ? [...prev, ...newItems] : newItems));
      setHasMore(newItems.length >= 20);
    } catch {
      toast.error('Failed to load inbox items');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    setPage(1);
    fetchItems(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, searchQuery]);

  // ─── Handlers ─────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.companyId.trim() || !form.submittedBy.trim() || !form.content.trim()) {
      toast.error('Company ID, Submitter, and Content are required');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        companyId: form.companyId.trim(),
        submittedBy: form.submittedBy.trim(),
        content: form.content.trim(),
        summary: form.summary.trim() || undefined,
        category: form.category || undefined,
        priority: form.priority,
        tags: form.tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
      };
      const res = await fetch('/api/g-intel-acquisition/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Submit failed');
      }
      toast.success('Intelligence submitted to inbox');
      setForm({ companyId: '', submittedBy: '', content: '', summary: '', category: '', priority: 'normal', tags: '' });
      setFormOpen(false);
      fetchItems(1, false);
      fetchStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    setActionInProgress(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/g-intel-acquisition/inbox/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewerId: 'current-user' }),
      });
      if (!res.ok) throw new Error(`${action} failed`);
      toast.success(`Item ${action}d`);
      fetchItems(1, false);
      fetchStats();
    } catch {
      toast.error(`Failed to ${action} item`);
    } finally {
      setActionInProgress(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleConvert = async (id: string) => {
    setActionInProgress(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/g-intel-acquisition/inbox/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Convert failed');
      toast.success('Converted to Intelligence Object');
      fetchItems(1, false);
      fetchStats();
    } catch {
      toast.error('Failed to convert item');
    } finally {
      setActionInProgress(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchItems(nextPage, true);
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
            <Inbox className="h-5 w-5 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Human Intelligence Inbox</h2>
            <p className="text-sm text-muted-foreground">
              Submit, review, approve, reject, and convert human intelligence
            </p>
          </div>
        </div>

        {stats && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Total', value: stats.total, cls: 'bg-gray-100 text-gray-700' },
              { label: 'Pending', value: stats.byStatus?.pending ?? 0, cls: 'bg-yellow-100 text-yellow-800' },
              { label: 'Approved', value: stats.byStatus?.approved ?? 0, cls: 'bg-green-100 text-green-800' },
              { label: 'Rejected', value: stats.byStatus?.rejected ?? 0, cls: 'bg-red-100 text-red-800' },
              { label: 'Converted', value: stats.byStatus?.converted ?? 0, cls: 'bg-indigo-100 text-indigo-800' },
            ].map(s => (
              <Badge key={s.label} variant="outline" className={`${s.cls} px-2.5 py-1 text-xs font-medium`}>
                {s.label}: {s.value}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* ── Submit Form (collapsible) ──────────────────────────── */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none py-3"
          onClick={() => setFormOpen(v => !v)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              Submit New Intelligence
            </CardTitle>
            {formOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {formOpen && (
          <CardContent className="space-y-4 border-t pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Company ID *</label>
                <Input
                  placeholder="e.g. company_abc123"
                  value={form.companyId}
                  onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Submitted By *</label>
                <Input
                  placeholder="Your name or ID"
                  value={form.submittedBy}
                  onChange={e => setForm(f => ({ ...f, submittedBy: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Content *</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Intelligence content..."
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Summary</label>
                <Input
                  placeholder="Brief summary"
                  value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Priority</label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as InboxPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium">
                  <Tag className="h-3.5 w-3.5" /> Tags
                </label>
                <Input
                  placeholder="tag1, tag2, tag3"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit to Inbox
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Filter Bar ─────────────────────────────────────────── */}
      <Card className="py-3">
        <CardContent className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder="Search content, submitter, company..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Items List ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">No items found</p>
          <p className="text-sm">Adjust filters or submit new intelligence</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const expanded = expandedIds.has(item.id);
            const busy = actionInProgress.has(item.id);
            const tags = parseTags(item.tags);
            const truncated = item.content.length > 200;

            return (
              <Card key={item.id} className="overflow-hidden">
                {/* Header */}
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={PRIORITY_COLORS[item.priority]}>
                      {item.priority === 'critical' && <AlertTriangle className="mr-1 h-3 w-3" />}
                      {item.priority}
                    </Badge>
                    <Badge variant="outline" className={STATUS_COLORS[item.status]}>
                      {item.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      by {item.submittedBy}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {relativeTime(item.createdAt)}
                    </span>
                  </div>
                </CardHeader>

                {/* Body */}
                <CardContent className="space-y-2">
                  <p className="text-sm leading-relaxed">
                    {expanded ? item.content : item.content.slice(0, 200)}
                    {truncated && !expanded && '...'}
                    {truncated && (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="ml-1 text-xs text-indigo-600 hover:underline"
                      >
                        {expanded ? 'less' : 'more'}
                      </button>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.category && (
                      <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                    )}
                    {item.source && (
                      <span className="text-xs text-muted-foreground">source: {item.source}</span>
                    )}
                    {tags.map(tag => (
                      <Badge key={tag} variant="outline" className="gap-1 text-xs text-muted-foreground">
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {item.summary && (
                    <p className="text-xs italic text-muted-foreground border-l-2 border-muted pl-2">
                      {item.summary}
                    </p>
                  )}

                  {/* Footer actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {item.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                          disabled={busy}
                          onClick={() => handleReview(item.id, 'approve')}
                        >
                          {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                          disabled={busy}
                          onClick={() => handleReview(item.id, 'reject')}
                        >
                          {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3 w-3" />}
                          Reject
                        </Button>
                      </>
                    )}
                    {item.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                        disabled={busy}
                        onClick={() => handleConvert(item.id)}
                      >
                        {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ArrowRight className="mr-1 h-3 w-3" />}
                        Convert to Intelligence
                      </Button>
                    )}
                    {item.status === 'converted' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-muted-foreground cursor-not-allowed"
                        disabled
                      >
                        <ArrowRight className="mr-1 h-3 w-3" />
                        View Intelligence Object
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}