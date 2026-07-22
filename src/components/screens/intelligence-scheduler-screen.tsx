'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Play, RefreshCw, AlertTriangle, CheckCircle, Settings, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Types ──────────────────────────────────────────
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
}

// ─── Helpers ────────────────────────────────────────
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
    case 'daily': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'weekly': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'manual': return 'bg-gray-100 text-gray-600 border-gray-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function healthBadgeColor(score: number): string {
  if (score >= 0.7) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (score >= 0.4) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function healthNumberColor(score: number): string {
  if (score >= 0.7) return 'text-emerald-600';
  if (score >= 0.4) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Component ──────────────────────────────────────
export default function IntelligenceSchedulerScreen() {
  const [overview, setOverview] = useState<SchedulerOverview | null>(null);
  const [dueConnectors, setDueConnectors] = useState<DueConnector[]>([]);
  const [allConnectors, setAllConnectors] = useState<ScheduledConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const [triggeringIds, setTriggeringIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, dueRes, connectorsRes] = await Promise.all([
        fetch('/api/g-intel-acquisition/scheduler/overview'),
        fetch('/api/g-intel-acquisition/scheduler/due'),
        fetch('/api/g-intel-acquisition/connectors?status=active'),
      ]);

      if (!overviewRes.ok || !dueRes.ok || !connectorsRes.ok) {
        throw new Error('Failed to fetch scheduler data');
      }

      const overviewData = await overviewRes.json();
      const dueData = await dueRes.json();
      const connectorsData = await connectorsRes.json();

      setOverview(overviewData);
      setDueConnectors(Array.isArray(dueData) ? dueData : dueData.connectors ?? []);
      const active = Array.isArray(connectorsData) ? connectorsData : connectorsData.connectors ?? [];
      setAllConnectors(active.filter((c: ScheduledConnector) => c.scheduleFrequency !== 'manual'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      await fetch('/api/g-intel-acquisition/scheduler/run-all-due', { method: 'POST' });
      await fetchAll();
    } catch {
      /* silent */
    } finally {
      setRunningAll(false);
    }
  };

  const handleTrigger = async (id: string) => {
    setTriggeringIds(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/g-intel-acquisition/scheduler/trigger/${id}`, { method: 'POST' });
      await fetchAll();
    } catch {
      /* silent */
    } finally {
      setTriggeringIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleScheduleChange = async (id: string, freq: string) => {
    try {
      await fetch(`/api/g-intel-acquisition/connectors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleFrequency: freq }),
      });
      await fetchAll();
    } catch {
      /* silent */
    }
  };

  // ─── Render ───────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Connector Scheduler</h1>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Connector Scheduler</h1>
        </div>
        <Card>
          <CardContent className="flex items-center gap-3 py-8 justify-center text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scheduled = allConnectors.filter(c => c.scheduleFrequency !== 'manual');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Connector Scheduler</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleRunAll} disabled={runningAll || (overview?.dueNowCount ?? 0) === 0}>
            {runningAll ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
            Run All Due
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-0 pb-0">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Settings className="h-4 w-4" />
              Total Connectors
            </div>
            <div className="text-2xl font-bold">{overview?.totalConnectors ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0 pb-0">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="h-4 w-4" />
              Scheduled
            </div>
            <div className="text-2xl font-bold">{overview?.scheduledConnectors ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0 pb-0">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Play className="h-4 w-4" />
              Manual
            </div>
            <div className="text-2xl font-bold">{overview?.manualConnectors ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0 pb-0">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <AlertTriangle className="h-4 w-4" />
              Due Now
            </div>
            <div className={`text-2xl font-bold ${(overview?.dueNowCount ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {overview?.dueNowCount ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Due Now */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Due Now
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dueConnectors.length === 0 ? (
            <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <span>No connectors due</span>
            </div>
          ) : (
            <div className="space-y-2">
              {dueConnectors.map(connector => (
                <div
                  key={connector.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-sm">{connector.name}</div>
                      <Badge variant="outline" className="text-xs mt-1">{connector.sourceType}</Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleTrigger(connector.id)}
                    disabled={triggeringIds.has(connector.id)}
                  >
                    {triggeringIds.has(connector.id)
                      ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      : <Play className="h-3.5 w-3.5 mr-1" />
                    }
                    Trigger Now
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Scheduled Connectors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            All Scheduled Connectors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scheduled.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No scheduled connectors found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduled.map(connector => (
                  <TableRow key={connector.id}>
                    <TableCell className="font-medium">{connector.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{connector.sourceType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={scheduleBadgeColor(connector.scheduleFrequency)}>
                        {connector.scheduleFrequency}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {relativeTime(connector.lastRun)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {relativeTime(connector.nextRun)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={healthBadgeColor(connector.healthScore)}>
                        {(connector.healthScore * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTrigger(connector.id)}
                          disabled={triggeringIds.has(connector.id)}
                        >
                          {triggeringIds.has(connector.id)
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Play className="h-3.5 w-3.5" />
                          }
                        </Button>
                        <Select
                          value={connector.scheduleFrequency}
                          onValueChange={(val) => handleScheduleChange(connector.id, val)}
                        >
                          <SelectTrigger className="h-8 w-[110px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}