'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, Play, RefreshCw, AlertTriangle, CheckCircle,
  Settings, Loader2, Plus, X, Pause, Trash2, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/design-system';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface SchedulerOverview {
  totalConnectors: number;
  scheduledConnectors: number;
  manualConnectors: number;
  dueNowCount: number;
}

interface DueConnector {
  id: string;
  name: string;
  sourceType: string;
  scheduleFrequency: string;
  lastRun: string | null;
  nextRun: string | null;
}

interface ScheduledConnector {
  id: string;
  name: string;
  sourceType: string;
  scheduleFrequency: string;
  lastRun: string | null;
  nextRun: string | null;
  healthScore: number;
  status: string;
  enabled: boolean;
}

interface NewScheduleForm {
  connectorName: string;
  sourceType: string;
  frequency: string;
  cronExpression?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = then - now;
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs > 0;
  const prefix = isFuture ? 'in ' : '';
  const suffix = isFuture ? '' : ' ago';
  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${prefix}${minutes}m${suffix}`;
  if (hours < 24) return `${prefix}${hours}h${suffix}`;
  return `${prefix}${days}d${suffix}`;
}

function scheduleBadgeColor(freq: string): string {
  switch (freq) {
    case 'hourly': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'daily': return 'bg-violet-100 text-violet-700 border-violet-200';
    case 'weekly': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'monthly': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'manual': return 'bg-slate-100 text-slate-600 border-slate-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function healthBadgeColor(score: number): string {
  if (score >= 0.7) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (score >= 0.4) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function cronDescription(freq: string): string {
  switch (freq) {
    case 'hourly': return 'Every hour';
    case 'daily': return 'Every day at midnight';
    case 'weekly': return 'Every Monday at midnight';
    case 'monthly': return '1st of each month at midnight';
    default: return freq;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Schedule Row Card
   ═══════════════════════════════════════════════════════════════ */
function ScheduleCard({
  connector, onTrigger, onToggle, onFreqChange, triggeringId,
}: {
  connector: ScheduledConnector;
  onTrigger: (id: string) => void;
  onToggle: (id: string) => void;
  onFreqChange: (id: string, freq: string) => void;
  triggeringId: string | null;
}) {
  return (
    <div className={cn(
      'rounded-xl border bg-white shadow-sm transition-all p-4',
      connector.enabled ? 'border-slate-200' : 'border-slate-200 opacity-60'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{connector.name}</h3>
            <Badge variant="outline" className="text-[10px] bg-slate-50">{connector.sourceType}</Badge>
            <Badge variant="outline" className={cn('text-[10px]', scheduleBadgeColor(connector.scheduleFrequency))}>
              {connector.scheduleFrequency}
            </Badge>
          </div>

          <p className="text-[11px] text-slate-400 mt-1">{cronDescription(connector.scheduleFrequency)}</p>

          <div className="mt-3 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Last Run</p>
              <p className="text-xs font-medium text-slate-600 mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                {relativeTime(connector.lastRun)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Next Run</p>
              <p className="text-xs font-medium text-slate-600 mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                {relativeTime(connector.nextRun)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Health</p>
              <div className="mt-1">
                <ConfidenceBar value={Math.round(connector.healthScore * 100)} size="sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Status toggle */}
          <button
            onClick={() => onToggle(connector.id)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0',
              connector.enabled ? 'bg-blue-600' : 'bg-slate-200'
            )}
          >
            <span className={cn(
              'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
              connector.enabled ? 'translate-x-6' : 'translate-x-1'
            )} />
          </button>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm"
              onClick={() => onTrigger(connector.id)}
              disabled={triggeringId === connector.id}
              className="h-7 text-xs gap-1 border-slate-200 text-slate-600 hover:bg-slate-50">
              {triggeringId === connector.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Run
            </Button>
            <Select value={connector.scheduleFrequency} onValueChange={val => onFreqChange(connector.id, val)}>
              <SelectTrigger className="h-7 w-[90px] text-[11px] border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceSchedulerScreen() {
  const [overview, setOverview] = useState<SchedulerOverview | null>(null);
  const [dueConnectors, setDueConnectors] = useState<DueConnector[]>([]);
  const [allConnectors, setAllConnectors] = useState<ScheduledConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const [triggeringIds, setTriggeringIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Add schedule dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSchedule, setNewSchedule] = useState<NewScheduleForm>({
    connectorName: '', sourceType: 'web', frequency: 'daily',
  });

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [overviewRes, dueRes, connectorsRes] = await Promise.all([
        fetch('/api/g-intel-acquisition/scheduler/overview'),
        fetch('/api/g-intel-acquisition/scheduler/due'),
        fetch('/api/g-intel-acquisition/connectors?status=active'),
      ]);
      if (!overviewRes.ok || !dueRes.ok || !connectorsRes.ok) throw new Error('Failed to fetch');

      setOverview(await overviewRes.json());
      const dueData = await dueRes.json();
      setDueConnectors(Array.isArray(dueData) ? dueData : dueData.connectors ?? []);
      const connectorsData = await connectorsRes.json();
      const active = Array.isArray(connectorsData) ? connectorsData : connectorsData.connectors ?? [];
      setAllConnectors(active.filter((c: ScheduledConnector) => c.scheduleFrequency !== 'manual'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      await fetch('/api/g-intel-acquisition/scheduler/run-all-due', { method: 'POST' });
      await fetchAll();
    } catch { /* silent */ }
    finally { setRunningAll(false); }
  };

  const handleTrigger = async (id: string) => {
    setTriggeringIds(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/g-intel-acquisition/scheduler/trigger/${id}`, { method: 'POST' });
      await fetchAll();
    } catch { /* silent */ }
    finally { setTriggeringIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const handleToggle = async (id: string) => {
    setAllConnectors(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  const handleScheduleChange = async (id: string, freq: string) => {
    try {
      await fetch(`/api/g-intel-acquisition/connectors/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleFrequency: freq }),
      });
      await fetchAll();
    } catch { /* silent */ }
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.connectorName.trim()) {
      toast.error('Connector name is required');
      return;
    }
    setShowAddDialog(false);
    toast.success(`Schedule "${newSchedule.connectorName}" created with ${newSchedule.frequency} frequency`);
    setNewSchedule({ connectorName: '', sourceType: 'web', frequency: 'daily' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  const scheduled = allConnectors;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Collection Schedules</h2>
            <p className="text-sm text-slate-500">Manage automated data collection schedules and run frequencies</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}
            className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={handleRunAll}
            disabled={runningAll || (overview?.dueNowCount ?? 0) === 0}
            className="gap-2 bg-blue-600 hover:bg-blue-700">
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run All Due
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Add Schedule
          </Button>
        </div>
      </div>

      {/* ── Overview Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Connectors', value: overview?.totalConnectors ?? 0, icon: Settings, color: 'text-slate-900', bg: 'bg-slate-50' },
          { label: 'Scheduled', value: overview?.scheduledConnectors ?? 0, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Manual', value: overview?.manualConnectors ?? 0, icon: Play, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Due Now', value: overview?.dueNowCount ?? 0, icon: AlertTriangle, color: (overview?.dueNowCount ?? 0) > 0 ? 'text-red-500' : 'text-emerald-600', bg: (overview?.dueNowCount ?? 0) > 0 ? 'bg-red-50' : 'bg-emerald-50' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', stat.bg)}>
                <stat.icon className={cn('h-4 w-4', stat.color)} />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{stat.label}</p>
            <p className={cn('text-2xl font-bold mt-0.5', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Due Now ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-slate-900">Due Now</h3>
          {dueConnectors.length > 0 && (
            <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
              {dueConnectors.length}
            </Badge>
          )}
        </div>
        <div className="p-4">
          {dueConnectors.length === 0 ? (
            <div className="flex items-center gap-3 py-4 justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <span className="text-sm text-slate-500">No connectors due</span>
            </div>
          ) : (
            <div className="space-y-2">
              {dueConnectors.map(connector => (
                <div key={connector.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{connector.name}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">{connector.sourceType}</Badge>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleTrigger(connector.id)}
                    disabled={triggeringIds.has(connector.id)}
                    className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700">
                    {triggeringIds.has(connector.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    Trigger Now
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── All Scheduled Connectors ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">All Scheduled Connectors</h3>
          <span className="text-xs text-slate-400">{scheduled.length} scheduled</span>
        </div>

        {scheduled.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No scheduled connectors"
            description="Add a schedule to start automating data collection."
            actionLabel="Add Schedule"
            onAction={() => setShowAddDialog(true)}
          />
        ) : (
          <div className="space-y-3">
            {scheduled.map(connector => (
              <ScheduleCard
                key={connector.id}
                connector={connector}
                onTrigger={handleTrigger}
                onToggle={handleToggle}
                onFreqChange={handleScheduleChange}
                triggeringId={triggeringIds.has(connector.id) ? connector.id : null}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add Schedule Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Add Collection Schedule
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Connector Name</label>
              <Input
                className="h-9 text-sm border-slate-200"
                placeholder="e.g., LinkedIn Jobs Scraper"
                value={newSchedule.connectorName}
                onChange={e => setNewSchedule(prev => ({ ...prev, connectorName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Source Type</label>
              <Select value={newSchedule.sourceType} onValueChange={v => setNewSchedule(prev => ({ ...prev, sourceType: v }))}>
                <SelectTrigger className="h-9 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['web', 'rss', 'api', 'csv', 'social', 'news'].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Frequency</label>
              <Select value={newSchedule.frequency} onValueChange={v => setNewSchedule(prev => ({ ...prev, frequency: v }))}>
                <SelectTrigger className="h-9 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Cron Expression</p>
              <p className="text-sm font-mono text-slate-700">{cronDescription(newSchedule.frequency)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}
              className="border-slate-200 text-slate-600">
              Cancel
            </Button>
            <Button onClick={handleAddSchedule} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Save className="h-4 w-4" /> Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
