'use client';

import { useState, useMemo, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  BrainCircuit,
  Layers,
  Clock,
  AlertTriangle,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  X,
  BarChart3,
  TrendingDown,
  Inbox,
} from 'lucide-react';

const TASK_TYPES = [
  'Enrichment',
  'Scoring',
  'Insight Generation',
  'Signal Analysis',
  'Research',
  'Summarization',
];
const MODELS = ['gpt-4o', 'claude-3.5-sonnet', 'claude-3-haiku'];
type TaskStatus = 'running' | 'queued' | 'completed' | 'failed';

const mockTasks = Array.from({ length: 8 }, (_, i) => {
  const status = (
    [
      'running',
      'queued',
      'completed',
      'completed',
      'failed',
      'running',
      'queued',
      'completed',
    ] as TaskStatus[]
  )[i];
  return {
    id: `AI-${String(10234 + i).padStart(5, '0')}`,
    type: TASK_TYPES[i % TASK_TYPES.length],
    model: MODELS[i % MODELS.length],
    status,
    duration:
      status === 'running'
        ? `${Math.floor(Math.random() * 30) + 5}s`
        : status === 'queued'
          ? '—'
          : `${Math.floor(Math.random() * 12) + 2}s`,
    tokens: status === 'queued' ? '—' : `${Math.floor(Math.random() * 8000) + 500}`,
  };
});

const tasksOverTime = [
  { time: '00:00', tasks: 4 },
  { time: '04:00', tasks: 2 },
  { time: '08:00', tasks: 12 },
  { time: '12:00', tasks: 28 },
  { time: '16:00', tasks: 19 },
  { time: '20:00', tasks: 8 },
];

const errorRateTrend = [
  { time: 'Mon', rate: 2.1 },
  { time: 'Tue', rate: 1.8 },
  { time: 'Wed', rate: 3.4 },
  { time: 'Thu', rate: 1.2 },
  { time: 'Fri', rate: 0.9 },
  { time: 'Sat', rate: 0.4 },
  { time: 'Sun', rate: 0.6 },
];

const tasksChartConfig = { tasks: { label: 'Tasks', color: '#2563EB' } };
const errorChartConfig = { rate: { label: 'Error Rate %', color: '#DC2626' } };

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'running') return <Loader2 className="size-3.5 animate-spin text-sky-400" />;
  if (status === 'queued') return <Clock className="size-3.5 text-amber-400" />;
  if (status === 'completed') return <CheckCircle2 className="size-3.5 text-emerald-400" />;
  return <XCircle className="size-3.5 text-red-400" />;
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, string> = {
    running: 'border-sky-500/40 bg-sky-500/15 text-sky-400',
    queued: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
    completed: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
    failed: 'border-red-500/40 bg-red-500/15 text-red-400',
  };
  return (
    <Badge className={`${map[status]} gap-1`}>
      <StatusIcon status={status} /> {status}
    </Badge>
  );
}

export default function AiCommandCenter() {
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState(mockTasks);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const stats = useMemo(
    () => ({
      active: tasks.filter((t) => t.status === 'running').length,
      queueDepth: tasks.filter((t) => t.status === 'queued').length,
      avgLatency: '4.2s',
      errorRate: '1.4%',
    }),
    [tasks],
  );

  const handleCancel = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: 'failed' as TaskStatus, duration: 'cancelled' } : t,
      ),
    );
  };

  const handleRetry = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'queued' as TaskStatus, duration: '—' } : t)),
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Inbox className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">No AI tasks found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
          AI Command Center
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          Monitor and manage AI task execution pipeline
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Active AI Tasks',
            value: stats.active,
            icon: Play,
            color: '#38bdf8',
            bg: 'rgba(56,189,248,0.12)',
          },
          {
            label: 'Queue Depth',
            value: stats.queueDepth,
            icon: Layers,
            color: '#fbbf24',
            bg: 'rgba(251,191,36,0.12)',
          },
          {
            label: 'Avg Latency',
            value: stats.avgLatency,
            icon: Clock,
            color: '#a78bfa',
            bg: 'rgba(167,139,250,0.12)',
          },
          {
            label: 'Error Rate',
            value: stats.errorRate,
            icon: AlertTriangle,
            color: '#f87171',
            bg: 'rgba(248,113,113,0.12)',
          },
        ].map((s) => (
          <Card key={s.label} className="py-4 gap-4">
            <CardContent className="px-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5" style={{ backgroundColor: s.bg }}>
                <s.icon className="size-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: tokens.text.secondary }}>
                  {s.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                  {s.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="py-0 gap-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4" style={{ color: tokens.accent.primary }} />
              Tasks Over Time
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ChartContainer config={tasksChartConfig} className="h-[200px] w-full">
              <BarChart data={tasksOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
                <XAxis dataKey="time" tick={{ fill: tokens.text.muted, fontSize: 12 }} />
                <YAxis tick={{ fill: tokens.text.muted, fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="tasks" fill="var(--color-tasks)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="py-0 gap-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="size-4 text-red-400" />
              Error Rate Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ChartContainer config={errorChartConfig} className="h-[200px] w-full">
              <LineChart data={errorRateTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
                <XAxis dataKey="time" tick={{ fill: tokens.text.muted, fontSize: 12 }} />
                <YAxis tick={{ fill: tokens.text.muted, fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--color-rate)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <Card className="py-0 gap-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <BrainCircuit className="size-4" style={{ color: tokens.accent.primary }} />
            Live Task Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Task ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell
                      className="pl-6 font-mono text-xs"
                      style={{ color: tokens.accent.primary }}
                    >
                      {task.id}
                    </TableCell>
                    <TableCell className="text-sm" style={{ color: tokens.text.primary }}>
                      {task.type}
                    </TableCell>
                    <TableCell
                      className="text-xs font-mono"
                      style={{ color: tokens.text.secondary }}
                    >
                      {task.model}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell
                      className="font-mono text-xs"
                      style={{ color: tokens.text.secondary }}
                    >
                      {task.duration}
                    </TableCell>
                    <TableCell
                      className="font-mono text-xs"
                      style={{ color: tokens.text.secondary }}
                    >
                      {task.tokens}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(task.status === 'running' || task.status === 'queued') && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => handleCancel(task.id)}
                          >
                            <X className="size-3.5 text-red-400" />
                          </Button>
                        )}
                        {task.status === 'failed' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => handleRetry(task.id)}
                          >
                            <RotateCcw
                              className="size-3.5"
                              style={{ color: tokens.accent.primary }}
                            />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
