'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock, Activity, Filter, Globe, Building2,
  ChevronDown, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// ─── Types & Constants ──────────────────────────────────────────

const TIMELINE_EVENT_TYPES = [
  'acquired',
  'merged',
  'conflict_detected',
  'conflict_resolved',
  'confidence_updated',
  'knowledge_updated',
  'knowledge_restored',
  'source_health_changed',
  'human_submitted',
  'human_approved',
  'human_rejected',
  'connector_created',
  'connector_run',
  'alert_triggered',
  'alert_resolved',
  'dedup_detected',
  'version_restored',
] as const;

type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

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

// ─── Color Mapping ──────────────────────────────────────────────

const EVENT_TYPE_COLORS: Record<string, string> = {
  acquired: 'bg-green-500',
  merged: 'bg-blue-500',
  conflict_detected: 'bg-red-500',
  conflict_resolved: 'bg-green-500',
  human_submitted: 'bg-amber-500',
  human_approved: 'bg-green-500',
  human_rejected: 'bg-red-500',
  alert_triggered: 'bg-orange-500',
  alert_resolved: 'bg-green-500',
  knowledge_updated: 'bg-purple-500',
  connector_run: 'bg-sky-500',
};

function dotColor(eventType: string): string {
  return EVENT_TYPE_COLORS[eventType] ?? 'bg-gray-400';
}

function formatLabel(eventType: string): string {
  return eventType
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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

// ─── Component ──────────────────────────────────────────────────

export default function IntelligenceTimelineScreen() {
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('global');

  // Company mode
  const [companyId, setCompanyId] = useState('');
  const [companyIdInput, setCompanyIdInput] = useState('');

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState('');

  // List
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // ─── Fetch: Global ───────────────────────────────────────────

  const fetchGlobal = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      const res = await fetch(`/api/g-intel-acquisition/timeline/recent?${params}`);
      if (!res.ok) throw new Error('Failed to fetch global timeline');
      const data = await res.json();
      setEvents(data.events ?? data ?? []);
      setHasMore(false);
    } catch {
      toast.error('Failed to load global timeline');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch: Company ──────────────────────────────────────────

  const fetchCompany = useCallback(async (before?: string, append = false) => {
    if (!companyId.trim()) {
      setEvents([]);
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

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
      setEvents(prev => (append ? [...prev, ...newEvents] : newEvents));
      setHasMore(newEvents.length >= 30);
    } catch {
      toast.error('Failed to load company timeline');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [companyId, eventTypeFilter, actorFilter]);

  // ─── Effects ──────────────────────────────────────────────────

  useEffect(() => {
    if (viewMode === 'global') {
      fetchGlobal();
    } else {
      fetchCompany();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, fetchGlobal, fetchCompany]);

  // Re-fetch company timeline when filters change
  useEffect(() => {
    if (viewMode === 'company') {
      fetchCompany();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTypeFilter, actorFilter]);

  // ─── Handlers ─────────────────────────────────────────────────

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
    if (viewMode === 'company') {
      fetchCompany(lastEvent.createdAt, true);
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
            <Clock className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Intelligence Timeline</h2>
            <p className="text-sm text-muted-foreground">
              Audit trail of all intelligence lifecycle events
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
          <Button
            variant={viewMode === 'global' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setViewMode('global')}
          >
            <Globe className="h-3.5 w-3.5" />
            Global Activity
          </Button>
          <Button
            variant={viewMode === 'company' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setViewMode('company')}
          >
            <Building2 className="h-3.5 w-3.5" />
            Company Activity
          </Button>
        </div>
      </div>

      {/* ── Company Mode: Search + Filters ─────────────────────── */}
      {viewMode === 'company' && (
        <Card className="py-3">
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[250px]">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  className="h-8 text-xs"
                  placeholder="Enter Company ID and press Enter..."
                  value={companyIdInput}
                  onChange={e => setCompanyIdInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <Button size="sm" className="h-8 text-xs" onClick={handleCompanySearch}>
                  Search
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[180px] h-7 text-xs">
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
                className="h-7 w-[180px] text-xs"
                placeholder="Filter by actor..."
                value={actorFilter}
                onChange={e => setActorFilter(e.target.value)}
              />
              {companyId && (
                <span className="text-xs text-muted-foreground">
                  Showing events for <Badge variant="secondary" className="text-xs ml-1">{companyId}</Badge>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Timeline ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Activity className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">No events found</p>
          <p className="text-sm">
            {viewMode === 'global'
              ? 'Global timeline is empty'
              : 'Enter a Company ID to view its timeline'}
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-0">
            {events.map((event, idx) => {
              const color = dotColor(event.eventType);
              const showActor = event.actor && event.actor !== 'system';
              const isLast = idx === events.length - 1;

              return (
                <div key={event.id} className="relative pl-10 pb-6">
                  {/* Dot */}
                  <div
                    className={`absolute left-2.5 top-1.5 h-[7px] w-[7px] rounded-full ring-2 ring-background ${color}`}
                  />

                  <Card className="hover:shadow-sm transition-shadow">
                    <CardContent className="py-3 px-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold leading-tight">
                            {event.title}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {formatLabel(event.eventType)}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {relativeTime(event.createdAt)}
                        </span>
                      </div>

                      {event.description && (
                        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                          {event.description}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {showActor && (
                          <span className="text-xs text-muted-foreground">
                            Actor: <span className="font-medium text-foreground">{event.actor}</span>
                          </span>
                        )}
                        {event.entityType && (
                          <span className="text-xs text-muted-foreground">
                            Entity: <span className="font-medium text-foreground">{event.entityType}</span>
                            {event.entityId && (
                              <span className="text-muted-foreground/70"> ({event.entityId.slice(0, 8)}...)</span>
                            )}
                          </span>
                        )}
                        {viewMode === 'global' && event.companyId && (
                          <span className="text-xs text-muted-foreground">
                            Company: <span className="font-medium text-foreground">{event.companyId}</span>
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {viewMode === 'company' && hasMore && (
            <div className="flex justify-center pt-2 pl-10">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}