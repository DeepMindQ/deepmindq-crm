'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock, Activity, Globe, Building2, ChevronDown, Loader2,
  Zap, GitMerge, AlertTriangle, CheckCircle2, User, Shield,
  Database, Radio, Bell, RefreshCw, ChevronRight, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LoadingState } from '@/components/enterprise/LoadingState';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { EmptyState } from '@/components/shared/design-system';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
const TIMELINE_EVENT_TYPES = [
  'acquired', 'merged', 'conflict_detected', 'conflict_resolved',
  'confidence_updated', 'knowledge_updated', 'knowledge_restored',
  'source_health_changed', 'human_submitted', 'human_approved',
  'human_rejected', 'connector_created', 'connector_run',
  'alert_triggered', 'alert_resolved', 'dedup_detected', 'version_restored',
] as const;

interface TimelineEvent {
  id: string;
  companyId: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  title: string;
  description?: string | null;
  actor?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

type ViewMode = 'global' | 'company';

/* ═══════════════════════════════════════════════════════════════
   Event Type Config: color + icon mapping
   ═══════════════════════════════════════════════════════════════ */
const EVENT_CONFIG: Record<string, { icon: typeof Zap; color: string; bg: string; border: string; label: string }> = {
  acquired:            { icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50',    border: 'border-emerald-200', label: 'Acquired' },
  merged:              { icon: GitMerge,       color: 'text-blue-600',    bg: 'bg-blue-50',       border: 'border-blue-200',    label: 'Merged' },
  conflict_detected:   { icon: AlertTriangle,  color: 'text-red-500',     bg: 'bg-red-50',        border: 'border-red-200',      label: 'Conflict Detected' },
  conflict_resolved:   { icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50',    border: 'border-emerald-200', label: 'Conflict Resolved' },
  human_submitted:     { icon: User,           color: 'text-amber-600',   bg: 'bg-amber-50',      border: 'border-amber-200',   label: 'Human Submitted' },
  human_approved:      { icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50',    border: 'border-emerald-200', label: 'Human Approved' },
  human_rejected:      { icon: AlertTriangle,  color: 'text-red-500',     bg: 'bg-red-50',        border: 'border-red-200',      label: 'Human Rejected' },
  alert_triggered:     { icon: Bell,           color: 'text-orange-600',  bg: 'bg-orange-50',     border: 'border-orange-200',  label: 'Alert Triggered' },
  alert_resolved:      { icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50',    border: 'border-emerald-200', label: 'Alert Resolved' },
  knowledge_updated:   { icon: Database,       color: 'text-violet-600',  bg: 'bg-violet-50',     border: 'border-violet-200',  label: 'Knowledge Updated' },
  knowledge_restored:  { icon: RefreshCw,      color: 'text-sky-600',    bg: 'bg-sky-50',        border: 'border-sky-200',     label: 'Knowledge Restored' },
  connector_created:   { icon: Radio,          color: 'text-blue-600',    bg: 'bg-blue-50',       border: 'border-blue-200',    label: 'Connector Created' },
  connector_run:       { icon: Zap,            color: 'text-sky-600',     bg: 'bg-sky-50',        border: 'border-sky-200',     label: 'Connector Run' },
  confidence_updated:  { icon: Shield,         color: 'text-indigo-600',  bg: 'bg-indigo-50',     border: 'border-indigo-200',  label: 'Confidence Updated' },
  dedup_detected:      { icon: GitMerge,       color: 'text-orange-600',  bg: 'bg-orange-50',     border: 'border-orange-200',  label: 'Dedup Detected' },
  version_restored:    { icon: RefreshCw,      color: 'text-sky-600',     bg: 'bg-sky-50',        border: 'border-sky-200',     label: 'Version Restored' },
  source_health_changed: { icon: Activity,    color: 'text-amber-600',   bg: 'bg-amber-50',      border: 'border-amber-200',   label: 'Source Health Changed' },
};

const DEFAULT_CONFIG = { icon: FileText, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', label: 'Event' };

function getEventConfig(eventType: string) {
  return EVENT_CONFIG[eventType] ?? DEFAULT_CONFIG;
}

function formatLabel(eventType: string): string {
  return eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════
   Timeline Event Card
   ═══════════════════════════════════════════════════════════════ */
function TimelineEventCard({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const cfg = getEventConfig(event.eventType);
  const Icon = cfg.icon;
  const showActor = event.actor && event.actor !== 'system';
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative flex gap-4 pb-6 group">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 z-10',
          cfg.bg, cfg.border
        )}>
          <Icon className={cn('h-4 w-4', cfg.color)} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 min-h-[32px] bg-slate-200 mt-1" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className={cn(
          'rounded-xl border bg-white p-4 transition-all hover:shadow-md',
          cfg.border
        )}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-xs font-semibold uppercase tracking-wider', cfg.color)}>
                {cfg.label}
              </span>
              <span className="text-sm font-semibold text-slate-900 leading-snug">
                {event.title}
              </span>
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {relativeTime(event.createdAt)}
            </span>
          </div>

          {(event.description || event.entityType || showActor || event.companyId) && (
            <>
              <div className={cn('mt-2 text-sm text-slate-600 leading-relaxed', !expanded && event.description && event.description.length > 120 && 'line-clamp-2')}>
                {event.description || 'No description provided.'}
              </div>
              {event.description && event.description.length > 120 && (
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  {expanded ? (
                    <>Show less <ChevronRight className="h-3 w-3 rotate-90" /></>
                  ) : (
                    <>Show more <ChevronRight className="h-3 w-3" /></>
                  )}
                </button>
              )}
            </>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {showActor && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                <User className="h-3 w-3" />
                {event.actor}
              </span>
            )}
            {event.entityType && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50">
                {event.entityType}{event.entityId ? ` · ${event.entityId.slice(0, 8)}…` : ''}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceTimelineScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  const [companyId, setCompanyId] = useState('');
  const [companyIdInput, setCompanyIdInput] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState('');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGlobal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      const res = await fetch(`/api/g-intel-acquisition/timeline/recent?${params}`);
      if (!res.ok) throw new Error('Failed to fetch global timeline');
      const data = await res.json();
      setEvents(data.events ?? data ?? []);
      setHasMore(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      toast.error('Failed to load global timeline');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompany = useCallback(async (before?: string, append = false) => {
    if (!companyId.trim()) { setEvents([]); return; }
    if (append) setLoadingMore(true);
    else { setLoading(true); setError(null); }

    try {
      const params = new URLSearchParams();
      params.set('companyId', companyId.trim());
      params.set('limit', '30');
      if (eventTypeFilter !== 'all') params.set('eventType', eventTypeFilter);
      if (actorFilter.trim()) params.set('actor', actorFilter.trim());
      if (before) params.set('before', before);
      const res = await fetch(`/api/g-intel-acquisition/timeline?${params}`);
      if (!res.ok) throw new Error('Failed to fetch company timeline');
      const data = await res.json();
      const newEvents: TimelineEvent[] = data.events ?? data ?? [];
      setEvents(prev => append ? [...prev, ...newEvents] : newEvents);
      setHasMore(newEvents.length >= 30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      toast.error('Failed to load company timeline');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [companyId, eventTypeFilter, actorFilter]);

  useEffect(() => {
    if (viewMode === 'global') fetchGlobal().catch(() => {});
    else fetchCompany().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, fetchGlobal, fetchCompany]);

  useEffect(() => {
    if (viewMode === 'company') fetchCompany().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTypeFilter, actorFilter]);

  const handleCompanySearch = () => {
    if (!companyIdInput.trim()) return;
    setCompanyId(companyIdInput.trim());
    setEvents([]);
    setHasMore(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCompanySearch();
  };

  const loadMore = () => {
    if (events.length === 0) return;
    const lastEvent = events[events.length - 1];
    if (viewMode === 'company') fetchCompany(lastEvent.createdAt, true);
  };

  // Group events by date
  const groupedEvents = events.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    const dateKey = formatDate(event.createdAt);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const flatGroups = Object.entries(groupedEvents);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <Clock className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Intelligence Timeline</h2>
            <p className="text-sm text-slate-500">Chronological audit trail of all intelligence lifecycle events</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setViewMode('global')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              viewMode === 'global'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            Global Activity
          </button>
          <button
            onClick={() => setViewMode('company')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              viewMode === 'company'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            Company Activity
          </button>
        </div>
      </div>

      {/* ── Company Mode: Search + Filters ── */}
      {viewMode === 'company' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[250px]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <Input
                className="h-9 text-sm border-slate-200"
                placeholder="Enter Company ID and press Enter..."
                value={companyIdInput}
                onChange={e => setCompanyIdInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button size="sm" className="h-9 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleCompanySearch}>
                Search
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[180px] h-9 text-xs border-slate-200">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Event Types</SelectItem>
                  {TIMELINE_EVENT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-9 w-[180px] text-xs border-slate-200"
                placeholder="Filter by actor..."
                value={actorFilter}
                onChange={e => setActorFilter(e.target.value)}
              />
              {companyId && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  Company: {companyId}
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline Content ── */}
      {error ? (
        <ErrorState message={error} onRetry={() => { if (viewMode === 'global') fetchGlobal(); else fetchCompany(); }} />
      ) : loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-20 rounded-xl w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No events found"
          description={viewMode === 'global'
            ? 'The global timeline is empty. Intelligence events will appear here as they occur.'
            : 'Enter a Company ID above to view its intelligence timeline.'}
        />
      ) : (
        <div className="space-y-6">
          {flatGroups.map(([dateLabel, groupEvents]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 px-2">
                  {dateLabel}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Events */}
              <div className="relative pl-0.5">
                {groupEvents.map((event, idx) => (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    isLast={idx === groupEvents.length - 1 && dateLabel === flatGroups[flatGroups.length - 1]?.[0]}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Load More */}
          {viewMode === 'company' && hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                Load More Events
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
