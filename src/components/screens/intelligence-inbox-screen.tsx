'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Inbox, Send, CheckCircle, XCircle, ArrowRight,
  ChevronDown, AlertTriangle, Tag, Loader2,
  Search, CheckCheck, Trash2, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/enterprise/LoadingState';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { EmptyState } from '@/components/shared/design-system';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { toast } from 'sonner';
import { ALL_CATEGORIES } from '@/lib/intelligence-sources/types';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
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
  confidence?: number;
  tags?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  convertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
const PRIORITY_CONFIG: Record<InboxPriority, { color: string; icon: typeof AlertTriangle; label: string }> = {
  critical: { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle, label: 'Critical' },
  high: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle, label: 'High' },
  normal: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Inbox, label: 'Normal' },
  low: { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Inbox, label: 'Low' },
};

const STATUS_CONFIG: Record<InboxStatus, { color: string; icon: typeof CheckCircle }> = {
  pending: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  approved: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  rejected: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  converted: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: ArrowRight },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
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
  } catch { return []; }
}

/* ═══════════════════════════════════════════════════════════════
   Inbox Item Card
   ═══════════════════════════════════════════════════════════════ */
function InboxItemCard({
  item, busy, onReview, onConvert, onExpand, expanded, selected,
  onSelect,
}: {
  item: InboxItem;
  busy: boolean;
  onReview: (id: string, action: 'approve' | 'reject') => void;
  onConvert: (id: string) => void;
  onExpand: (id: string) => void;
  expanded: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const tags = parseTags(item.tags);
  const priorityCfg = PRIORITY_CONFIG[item.priority];
  const statusCfg = STATUS_CONFIG[item.status];
  const truncated = item.content.length > 200;

  return (
    <div className={cn(
      'rounded-xl border bg-white shadow-sm transition-all',
      selected ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200 hover:shadow-md'
    )}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(item.id)}
            className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Badge variant="outline" className={cn('text-[10px]', priorityCfg.color)}>
                {item.priority === 'critical' && <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />}
                {priorityCfg.label}
              </Badge>
              <Badge variant="outline" className={cn('text-[10px]', statusCfg.color)}>
                {item.status}
              </Badge>
              <span className="text-[11px] text-slate-400">by {item.submittedBy}</span>
              <span className="ml-auto text-[11px] text-slate-400">{relativeTime(item.createdAt)}</span>
            </div>

            {/* Content */}
            <p className="text-sm text-slate-700 leading-relaxed">
              {expanded ? item.content : item.content.slice(0, 200)}
              {truncated && !expanded && '...'}
              {truncated && (
                <button onClick={() => onExpand(item.id)}
                  className="ml-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  {expanded ? 'less' : 'more'}
                </button>
              )}
            </p>

            {/* Tags & Meta */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.category && (
                <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
              )}
              {item.source && (
                <span className="text-[10px] text-slate-400">source: {item.source}</span>
              )}
              {tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-[10px] gap-0.5 text-slate-500 bg-slate-50">
                  <Tag className="h-2 w-2" />{tag}
                </Badge>
              ))}
            </div>

            {/* Confidence threshold indicator */}
            {item.confidence !== undefined && (
              <div className="mt-3">
                <ConfidenceBar value={item.confidence} label="AI Confidence" size="sm" />
              </div>
            )}

            {/* Summary */}
            {item.summary && (
              <p className="mt-2 text-xs italic text-slate-500 border-l-2 border-blue-200 pl-2">
                {item.summary}
              </p>
            )}

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
              {item.status === 'pending' && (
                <>
                  <Button size="sm" variant="outline"
                    className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1"
                    disabled={busy} onClick={() => onReview(item.id, 'approve')}>
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                    Approve
                  </Button>
                  <Button size="sm" variant="outline"
                    className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50 gap-1"
                    disabled={busy} onClick={() => onReview(item.id, 'reject')}>
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                    Reject
                  </Button>
                </>
              )}
              {item.status === 'approved' && (
                <Button size="sm" variant="outline"
                  className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 gap-1"
                  disabled={busy} onClick={() => onConvert(item.id)}>
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                  Convert to Intelligence
                </Button>
              )}
              {item.status === 'converted' && (
                <Button size="sm" variant="outline"
                  className="h-7 text-xs text-slate-400 cursor-not-allowed" disabled>
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Converted
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceInboxScreen() {
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [actionInProgress, setActionInProgress] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/g-intel-acquisition/inbox/stats');
      if (res.ok) setStats(await res.json());
    } catch { toast.error('Failed to load inbox stats'); }
  }, []);

  const fetchItems = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('limit', '20');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`/api/g-intel-acquisition/inbox?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const newItems: InboxItem[] = data.items ?? data ?? [];
      setItems(prev => append ? [...prev, ...newItems] : newItems);
      setHasMore(newItems.length >= 20);
    } catch { toast.error('Failed to load inbox items'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [statusFilter, priorityFilter, searchQuery]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(1); fetchItems(1, false); }, [statusFilter, priorityFilter, searchQuery]);

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    setActionInProgress(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/g-intel-acquisition/inbox/${id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewerId: 'current-user' }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Item ${action}d`);
      fetchItems(1, false); fetchStats();
    } catch { toast.error(`Failed to ${action}`); }
    finally { setActionInProgress(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const handleConvert = async (id: string) => {
    setActionInProgress(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/g-intel-acquisition/inbox/${id}/convert`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Converted to Intelligence Object');
      fetchItems(1, false); fetchStats();
    } catch { toast.error('Failed to convert'); }
    finally { setActionInProgress(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const handleBatchApprove = async () => {
    const pendingSelected = items.filter(i => selectedIds.has(i.id) && i.status === 'pending');
    for (const item of pendingSelected) await handleReview(item.id, 'approve');
    setSelectedIds(new Set());
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <Inbox className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Review Queue</h2>
            <p className="text-sm text-slate-500">Prioritized intelligence review with confidence thresholds</p>
          </div>
        </div>

        {/* Stats badges */}
        {stats && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Pending', value: stats.byStatus?.pending ?? 0, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
              { label: 'Approved', value: stats.byStatus?.approved ?? 0, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
              { label: 'Rejected', value: stats.byStatus?.rejected ?? 0, cls: 'bg-red-100 text-red-700 border-red-200' },
            ].map(s => (
              <Badge key={s.label} variant="outline" className={cn('text-[10px] px-2.5 py-1', s.cls)}>
                {s.label}: {s.value}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-9 pl-9 text-sm border-slate-200"
              placeholder="Search content, submitter, company..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs border-slate-200"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs border-slate-200"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Batch actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">{selectedIds.size} selected</span>
            <Button size="sm" variant="outline"
              className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1"
              onClick={handleBatchApprove}>
              <CheckCheck className="h-3 w-3" /> Batch Approve
            </Button>
            <Button size="sm" variant="ghost"
              className="h-7 text-xs text-slate-500 gap-1"
              onClick={() => setSelectedIds(new Set())}>
              <XCircle className="h-3 w-3" /> Clear
            </Button>
          </div>
        )}
      </div>

      {/* ── Items List ── */}
      {loading ? (
        <LoadingState message="Loading review queue..." lines={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No items in review queue"
          description="Intelligence submissions will appear here for review and approval."
        />
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <InboxItemCard
              key={item.id}
              item={item}
              busy={actionInProgress.has(item.id)}
              onReview={handleReview}
              onConvert={handleConvert}
              onExpand={toggleExpand}
              expanded={expandedIds.has(item.id)}
              selected={selectedIds.has(item.id)}
              onSelect={toggleSelect}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => { const np = page + 1; setPage(np); fetchItems(np, true); }}
                disabled={loadingMore}
                className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
