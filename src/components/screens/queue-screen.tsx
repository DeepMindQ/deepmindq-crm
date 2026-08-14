'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { DataTable, type Column } from '@/components/enterprise/DataTable';
import { Send, CheckCircle2, XCircle, Clock, Pause, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──
interface QueueItem {
  id: string;
  to: string;
  subject: string;
  company: string;
  sequence: string;
  scheduledFor: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  priority: 'high' | 'medium' | 'low';
}

// ── Mock Data ──
const MOCK_QUEUE: QueueItem[] = [
  {
    id: 'q1',
    to: 'sarah.chen@acmecorp.com',
    subject: 'Re: Partnership Opportunity',
    company: 'Acme Corp',
    sequence: 'Enterprise Outreach',
    scheduledFor: '2025-01-22 14:00',
    status: 'queued',
    priority: 'high',
  },
  {
    id: 'q2',
    to: 'jwilson@technova.io',
    subject: 'Quick Question About Your Stack',
    company: 'TechNova Inc',
    sequence: 'Cold Intro',
    scheduledFor: '2025-01-22 14:15',
    status: 'sending',
    priority: 'medium',
  },
  {
    id: 'q3',
    to: 'm.garcia@dataflow.com',
    subject: 'DataFlow + DeepMindQ Integration',
    company: 'DataFlow Systems',
    sequence: 'Enterprise Outreach',
    scheduledFor: '2025-01-22 13:30',
    status: 'sent',
    priority: 'high',
  },
  {
    id: 'q4',
    to: 'dkim@cloudpeak.co',
    subject: 'Scaling Your Cloud Infrastructure',
    company: 'CloudPeak',
    sequence: 'Product Demo',
    scheduledFor: '2025-01-22 12:00',
    status: 'failed',
    priority: 'low',
  },
  {
    id: 'q5',
    to: 'emily.z@vertexai.com',
    subject: 'AI Capabilities Overview',
    company: 'Vertex AI',
    sequence: 'Cold Intro',
    scheduledFor: '2025-01-22 14:30',
    status: 'queued',
    priority: 'medium',
  },
  {
    id: 'q6',
    to: 'mbrown@synthetica.dev',
    subject: 'Your Dev Workflow, Upgraded',
    company: 'Synthetica',
    sequence: 'Re-engagement',
    scheduledFor: '2025-01-22 11:00',
    status: 'sent',
    priority: 'low',
  },
  {
    id: 'q7',
    to: 'priya@nexgenrobotics.com',
    subject: 'Automation Solutions for Robotics',
    company: 'NexGen Robotics',
    sequence: 'Enterprise Outreach',
    scheduledFor: '2025-01-22 15:00',
    status: 'queued',
    priority: 'high',
  },
  {
    id: 'q8',
    to: 'arivera@quantumleap.io',
    subject: 'Following Up on Our Call',
    company: 'QuantumLeap',
    sequence: 'Follow-up',
    scheduledFor: '2025-01-22 10:30',
    status: 'failed',
    priority: 'medium',
  },
  {
    id: 'q9',
    to: 'rthompson@biogenesis.com',
    subject: 'Biotech Intelligence Platform',
    company: 'BioGenesis Labs',
    sequence: 'Cold Intro',
    scheduledFor: '2025-01-22 14:45',
    status: 'queued',
    priority: 'medium',
  },
  {
    id: 'q10',
    to: 'kobrien@stellardynamics.co',
    subject: 'Dynamics of Modern Sales',
    company: 'Stellar Dynamics',
    sequence: 'Product Demo',
    scheduledFor: '2025-01-22 09:00',
    status: 'sent',
    priority: 'low',
  },
];

const STATUS_CONFIG: Record<
  QueueItem['status'],
  { label: string; color: string; bg: string; icon: typeof Send }
> = {
  queued: { label: 'Queued', color: '#2563EB', bg: '#DBEAFE', icon: Clock },
  sending: { label: 'Sending', color: '#D97706', bg: '#FEF3C7', icon: Send },
  sent: { label: 'Sent', color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle2 },
  failed: { label: 'Failed', color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: '#DC2626',
  medium: '#D97706',
  low: '#16A34A',
};

// ── Component ──
export default function Queue() {
  const [loading] = useState(false);

  const stats = useMemo(() => {
    const inQueue = MOCK_QUEUE.filter(
      (q) => q.status === 'queued' || q.status === 'sending',
    ).length;
    const sentToday = MOCK_QUEUE.filter((q) => q.status === 'sent').length;
    const failed = MOCK_QUEUE.filter((q) => q.status === 'failed').length;
    return { inQueue, sentToday, failed };
  }, []);

  const handleRetryFailed = useCallback(() => {
    toast.success(`Retrying ${stats.failed} failed email(s)`);
  }, [stats.failed]);

  const handlePauseQueue = useCallback(() => {
    toast.info('Queue paused');
  }, []);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  const columns: Column[] = useMemo(
    () => [
      { key: 'to', label: 'To', sortable: true },
      { key: 'subject', label: 'Subject' },
      { key: 'company', label: 'Company', sortable: true },
      { key: 'sequence', label: 'Sequence' },
      { key: 'scheduledFor', label: 'Scheduled For', sortable: true },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (value: unknown) => {
          const status = value as QueueItem['status'];
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          return (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
          );
        },
      },
      {
        key: 'priority',
        label: 'Priority',
        sortable: true,
        render: (value: unknown) => {
          const priority = value as string;
          const color = PRIORITY_COLORS[priority] || textMuted;
          return (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </span>
          );
        },
      },
    ],
    [textMuted],
  );

  if (loading) {
    return (
      <div
        className="p-6 space-y-6"
        style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: border }} />
          ))}
        </div>
        <div className="h-96 rounded-xl animate-pulse" style={{ background: border }} />
      </div>
    );
  }

  return (
    <div
      className="p-6 space-y-6"
      style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
            Outreach Queue
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Emails waiting to be sent or in progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.failed > 0 && (
            <button
              onClick={handleRetryFailed}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors hover:opacity-90"
              style={{ background: '#FEE2E2', color: '#DC2626' }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry Failed ({stats.failed})
            </button>
          )}
          <button
            onClick={handlePauseQueue}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors hover:opacity-90"
            style={{ border: `1px solid ${border}`, color: textSecondary }}
          >
            <Pause className="h-3.5 w-3.5" />
            Pause Queue
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'In Queue', value: stats.inQueue, icon: Clock, color: '#2563EB' },
          { label: 'Sent Today', value: stats.sentToday, icon: CheckCircle2, color: '#16A34A' },
          { label: 'Failed', value: stats.failed, icon: AlertTriangle, color: '#DC2626' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${stat.color}15` }}
              >
                <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs truncate" style={{ color: textMuted }}>
                  {stat.label}
                </p>
                <p className="text-lg font-bold" style={{ color: textPrimary }}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={MOCK_QUEUE as unknown as Record<string, unknown>[]}
        filterable
        filterPlaceholder="Search queue..."
        exportable
        exportFilename="outreach-queue"
        emptyMessage="No emails in the queue"
      />
    </div>
  );
}
