'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchApi } from '@/lib/fetchApi';
import {
  Mail,
  Send,
  Eye,
  MessageSquareReply,
  Play,
  Pause,
  Plus,
  X,
  Zap,
  Clock,
} from 'lucide-react';

/* ═══ Types ═══ */

type SequenceStatus = 'draft' | 'active' | 'paused' | 'completed';

interface SequenceStep {
  id: string;
  type: 'email' | 'wait' | 'task';
  label: string;
  delayDays: number;
}

interface Sequence {
  id: string;
  name: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  openRate: number;
  replyRate: number;
  sentCount: number;
  lastModified: string;
}

/* ═══ Mock Data ═══ */

const MOCK_SEQUENCES: Sequence[] = [
  {
    id: 'seq-1',
    name: 'Enterprise SaaS Outreach',
    status: 'active',
    steps: [
      { id: 's1', type: 'email', label: 'Initial Intro', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 3 days', delayDays: 3 },
      { id: 's3', type: 'email', label: 'Follow-up', delayDays: 0 },
      { id: 's4', type: 'wait', label: 'Wait 5 days', delayDays: 5 },
      { id: 's5', type: 'email', label: 'Value Prop', delayDays: 0 },
    ],
    openRate: 67.2,
    replyRate: 12.8,
    sentCount: 342,
    lastModified: '2025-01-15T10:30:00Z',
  },
  {
    id: 'seq-2',
    name: 'Mid-Market Re-engagement',
    status: 'active',
    steps: [
      { id: 's1', type: 'email', label: 'Re-engagement Email', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 2 days', delayDays: 2 },
      { id: 's3', type: 'email', label: 'Case Study Share', delayDays: 0 },
      { id: 's4', type: 'email', label: 'Meeting Request', delayDays: 7 },
    ],
    openRate: 54.1,
    replyRate: 9.3,
    sentCount: 186,
    lastModified: '2025-01-14T15:20:00Z',
  },
  {
    id: 'seq-3',
    name: 'Healthcare IT Discovery',
    status: 'paused',
    steps: [
      { id: 's1', type: 'email', label: 'Industry Insight', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 4 days', delayDays: 4 },
      { id: 's3', type: 'email', label: 'Compliance Angle', delayDays: 0 },
    ],
    openRate: 71.5,
    replyRate: 18.2,
    sentCount: 89,
    lastModified: '2025-01-13T09:45:00Z',
  },
  {
    id: 'seq-4',
    name: 'FinTech Partnership Pitch',
    status: 'active',
    steps: [
      { id: 's1', type: 'email', label: 'Partnership Intro', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 3 days', delayDays: 3 },
      { id: 's3', type: 'email', label: 'ROI Analysis', delayDays: 0 },
      { id: 's4', type: 'wait', label: 'Wait 7 days', delayDays: 7 },
      { id: 's5', type: 'email', label: 'Demo Invite', delayDays: 0 },
      { id: 's6', type: 'email', label: 'Final Follow-up', delayDays: 5 },
    ],
    openRate: 62.8,
    replyRate: 15.1,
    sentCount: 124,
    lastModified: '2025-01-12T14:10:00Z',
  },
  {
    id: 'seq-5',
    name: 'Cold Lead Nurture',
    status: 'draft',
    steps: [
      { id: 's1', type: 'email', label: 'Warm Intro', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 5 days', delayDays: 5 },
      { id: 's3', type: 'email', label: 'Content Share', delayDays: 0 },
    ],
    openRate: 0,
    replyRate: 0,
    sentCount: 0,
    lastModified: '2025-01-16T08:00:00Z',
  },
  {
    id: 'seq-6',
    name: 'Post-Demo Follow-up',
    status: 'completed',
    steps: [
      { id: 's1', type: 'email', label: 'Thank You', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 1 day', delayDays: 1 },
      { id: 's3', type: 'email', label: 'Summary & Next Steps', delayDays: 0 },
      { id: 's4', type: 'task', label: 'Schedule Follow-up Call', delayDays: 3 },
    ],
    openRate: 89.3,
    replyRate: 42.6,
    sentCount: 67,
    lastModified: '2025-01-10T16:30:00Z',
  },
  {
    id: 'seq-7',
    name: 'Competitor Displacement',
    status: 'active',
    steps: [
      { id: 's1', type: 'email', label: 'Pain Point Email', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 4 days', delayDays: 4 },
      { id: 's3', type: 'email', label: 'Comparison Sheet', delayDays: 0 },
      { id: 's4', type: 'email', label: 'Switch Offer', delayDays: 7 },
    ],
    openRate: 48.9,
    replyRate: 7.5,
    sentCount: 215,
    lastModified: '2025-01-11T11:20:00Z',
  },
  {
    id: 'seq-8',
    name: 'Event Invitation Series',
    status: 'draft',
    steps: [
      { id: 's1', type: 'email', label: 'Save the Date', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 7 days', delayDays: 7 },
      { id: 's3', type: 'email', label: 'Agenda Reveal', delayDays: 0 },
      { id: 's4', type: 'email', label: 'Final Reminder', delayDays: 3 },
    ],
    openRate: 0,
    replyRate: 0,
    sentCount: 0,
    lastModified: '2025-01-16T09:15:00Z',
  },
];

/* ═══ Helpers ═══ */

function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function getStatusConfig(status: SequenceStatus) {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        color: tokens.confidence.high.value,
        bg: tokens.confidence.high.bg,
      };
    case 'paused':
      return {
        label: 'Paused',
        color: tokens.confidence.medium.value,
        bg: tokens.confidence.medium.bg,
      };
    case 'completed':
      return { label: 'Completed', color: '#6366F1', bg: '#EEF2FF' };
    case 'draft':
    default:
      return { label: 'Draft', color: tokens.text.muted, bg: tokens.neutral['100'] };
  }
}

/* ═══ Sub-components ═══ */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Mail;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl transition-all"
      style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
        style={{ background: `${accent}15`, color: accent }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
          {label}
        </p>
        <p
          className="text-xl font-bold tracking-tight mt-0.5"
          style={{ color: tokens.text.primary }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SequenceStatus }) {
  const config = getStatusConfig(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: config.bg, color: config.color }}
    >
      {status === 'active' && <Zap className="w-3 h-3" />}
      {status === 'paused' && <Pause className="w-3 h-3" />}
      {status === 'completed' && <Clock className="w-3 h-3" />}
      {config.label}
    </span>
  );
}

function StepsPreview({ steps }: { steps: SequenceStep[] }) {
  return (
    <div className="flex items-center gap-1">
      {steps.slice(0, 4).map((step, i) => (
        <div key={step.id} className="flex items-center gap-1">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold"
            style={{
              background:
                step.type === 'email'
                  ? `${tokens.accent.primary}15`
                  : step.type === 'task'
                    ? `${tokens.domain.opportunity}15`
                    : tokens.surfaceExtended,
              color:
                step.type === 'email'
                  ? tokens.accent.primary
                  : step.type === 'task'
                    ? tokens.domain.opportunity
                    : tokens.text.muted,
            }}
            title={step.label}
          >
            {step.type === 'email' ? 'E' : step.type === 'task' ? 'T' : '⏱'}
          </span>
          {i < Math.min(steps.length, 4) - 1 && (
            <span style={{ color: tokens.text.muted }} className="text-[10px]">
              →
            </span>
          )}
        </div>
      ))}
      {steps.length > 4 && (
        <span className="text-[10px]" style={{ color: tokens.text.muted }}>
          +{steps.length - 4}
        </span>
      )}
    </div>
  );
}

/* ═══ Main Component ═══ */

export default function Sequences() {
  const [sequences, setSequences] = useState<Sequence[]>(MOCK_SEQUENCES);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>('lastModified');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchApi<Sequence[]>('/api/sequences')
      .then(({ data }) => {
        if (data && data.length > 0) setSequences(data);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Create modal state ──
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newSteps, setNewSteps] = useState<SequenceStep[]>([
    { id: 'ns-1', type: 'email', label: 'Initial Email', delayDays: 0 },
  ]);

  // ── Stats ──
  const stats = useMemo(() => {
    const active = sequences.filter((s) => s.status === 'active').length;
    const totalSent = sequences.reduce((sum, s) => sum + s.sentCount, 0);
    const withOpens = sequences.filter((s) => s.sentCount > 0);
    const avgOpen =
      withOpens.length > 0
        ? withOpens.reduce((sum, s) => sum + s.openRate, 0) / withOpens.length
        : 0;
    const avgReply =
      withOpens.length > 0
        ? withOpens.reduce((sum, s) => sum + s.replyRate, 0) / withOpens.length
        : 0;
    return { active, totalSent, avgOpen, avgReply };
  }, [sequences]);

  // ── Sort ──
  const sortedData = useMemo(() => {
    const sorted = [...sequences];
    sorted.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortKey) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'openRate':
          aVal = a.openRate;
          bVal = b.openRate;
          break;
        case 'replyRate':
          aVal = a.replyRate;
          bVal = b.replyRate;
          break;
        case 'sentCount':
          aVal = a.sentCount;
          bVal = b.sentCount;
          break;
        case 'lastModified':
        default:
          aVal = a.lastModified;
          bVal = b.lastModified;
          break;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [sequences, sortKey, sortDir]);

  const handleSort = useCallback(
    (key: string) => {
      if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  const togglePause = useCallback((id: string) => {
    setSequences((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (s.status === 'active') return { ...s, status: 'paused' as SequenceStatus };
        if (s.status === 'paused') return { ...s, status: 'active' as SequenceStatus };
        return s;
      }),
    );
  }, []);

  const addStep = useCallback(() => {
    setNewSteps((prev) => [
      ...prev,
      { id: `ns-${Date.now()}`, type: 'email', label: `Step ${prev.length + 1}`, delayDays: 0 },
    ]);
  }, []);

  const removeStep = useCallback((id: string) => {
    setNewSteps((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateStep = useCallback(
    (id: string, field: keyof SequenceStep, value: string | number) => {
      setNewSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    },
    [],
  );

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    const seq: Sequence = {
      id: `seq-${Date.now()}`,
      name: newName.trim(),
      status: 'draft',
      steps: newSteps,
      openRate: 0,
      replyRate: 0,
      sentCount: 0,
      lastModified: new Date().toISOString(),
    };
    setSequences((prev) => [seq, ...prev]);
    setShowCreateModal(false);
    setNewName('');
    setNewSubject('');
    setNewSteps([{ id: 'ns-1', type: 'email', label: 'Initial Email', delayDays: 0 }]);
  }, [newName, newSteps]);

  // ── Columns ──
  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Sequence Name',
        sortable: true,
        render: (_: unknown, row: Record<string, unknown>) => {
          const seq = row as unknown as Sequence;
          return (
            <div className="min-w-[180px]">
              <p className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                {seq.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
                {seq.steps.length} steps
              </p>
            </div>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        render: (value: unknown) => <StatusBadge status={value as SequenceStatus} />,
      },
      {
        key: 'steps',
        label: 'Steps',
        render: (_: unknown, row: Record<string, unknown>) => {
          const seq = row as unknown as Sequence;
          return <StepsPreview steps={seq.steps} />;
        },
      },
      {
        key: 'openRate',
        label: 'Open Rate',
        sortable: true,
        render: (value: unknown) => {
          const rate = value as number;
          return (
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
              <span
                className="text-sm font-medium"
                style={{
                  color:
                    rate > 60
                      ? tokens.confidence.high.value
                      : rate > 40
                        ? tokens.confidence.medium.value
                        : tokens.text.secondary,
                }}
              >
                {rate > 0 ? `${rate}%` : '—'}
              </span>
            </div>
          );
        },
      },
      {
        key: 'replyRate',
        label: 'Reply Rate',
        sortable: true,
        render: (value: unknown) => {
          const rate = value as number;
          return (
            <div className="flex items-center gap-2">
              <MessageSquareReply className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
              <span
                className="text-sm font-medium"
                style={{
                  color:
                    rate > 15
                      ? tokens.confidence.high.value
                      : rate > 8
                        ? tokens.confidence.medium.value
                        : tokens.text.secondary,
                }}
              >
                {rate > 0 ? `${rate}%` : '—'}
              </span>
            </div>
          );
        },
      },
      {
        key: 'sentCount',
        label: 'Sent',
        sortable: true,
        render: (value: unknown) => {
          const count = value as number;
          return (
            <div className="flex items-center gap-2">
              <Send className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
              <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                {count.toLocaleString()}
              </span>
            </div>
          );
        },
      },
      {
        key: 'lastModified',
        label: 'Last Modified',
        sortable: true,
        render: (value: unknown) => (
          <span className="text-xs" style={{ color: tokens.text.secondary }}>
            {formatRelativeDate(value as string)}
          </span>
        ),
      },
      {
        key: 'actions',
        label: '',
        render: (_: unknown, row: Record<string, unknown>) => {
          const seq = row as unknown as Sequence;
          if (seq.status !== 'active' && seq.status !== 'paused') return null;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePause(seq.id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                border: `1px solid ${seq.status === 'active' ? tokens.confidence.medium.bg : tokens.confidence.high.bg}`,
                color:
                  seq.status === 'active'
                    ? tokens.confidence.medium.value
                    : tokens.confidence.high.value,
                background:
                  seq.status === 'active' ? tokens.confidence.medium.bg : tokens.confidence.high.bg,
              }}
            >
              {seq.status === 'active' ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {seq.status === 'active' ? 'Pause' : 'Resume'}
            </button>
          );
        },
      },
    ],
    [togglePause],
  );

  const tableData = useMemo(
    () => sortedData.map((s) => ({ ...s })) as Record<string, unknown>[],
    [sortedData],
  );

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Sequences
          </h1>
          <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>
            Manage outreach campaigns and email sequences
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0"
          style={{ background: tokens.accent.primary, color: tokens.text.inverse }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = tokens.accent.hover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = tokens.accent.primary;
          }}
        >
          <Plus className="w-4 h-4" />
          Create Sequence
        </button>
      </div>

      {/* ── Stats ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{
                background: tokens.surface.card,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <Skeleton
                className="w-10 h-10 rounded-lg shrink-0"
                style={{ background: tokens.border.default }}
              />
              <div className="flex-1">
                <Skeleton
                  className="h-3 w-20 mb-2 rounded"
                  style={{ background: tokens.border.default }}
                />
                <Skeleton
                  className="h-6 w-16 rounded"
                  style={{ background: tokens.border.default }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Zap}
            label="Active Sequences"
            value={stats.active}
            accent={tokens.confidence.high.value}
          />
          <StatCard
            icon={Send}
            label="Total Emails Sent"
            value={stats.totalSent.toLocaleString()}
            accent={tokens.accent.primary}
          />
          <StatCard
            icon={Eye}
            label="Avg Open Rate"
            value={`${stats.avgOpen.toFixed(1)}%`}
            accent={tokens.domain.reasoning}
          />
          <StatCard
            icon={MessageSquareReply}
            label="Avg Reply Rate"
            value={`${stats.avgReply.toFixed(1)}%`}
            accent={tokens.domain.opportunity}
          />
        </div>
      )}

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={tableData}
        onSort={handleSort}
        sortKey={sortKey}
        sortDir={sortDir}
        loading={loading}
        filterable
        filterPlaceholder="Search sequences..."
        exportable
        exportFilename="sequences-export"
        pageSize={20}
        emptyMessage="No sequences found"
      />

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="w-full max-w-lg rounded-xl max-h-[85vh] overflow-y-auto"
            style={{
              background: tokens.surface.card,
              border: `1px solid ${tokens.border.default}`,
            }}
          >
            <div
              className="flex items-center justify-between p-5"
              style={{ borderBottom: `1px solid ${tokens.border.default}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg"
                  style={{ background: `${tokens.accent.primary}15`, color: tokens.accent.primary }}
                >
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                    New Sequence
                  </h2>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>
                    Define your outreach steps
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: tokens.text.muted }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  Sequence Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Enterprise Outreach Q1"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    background: 'var(--ios-bg-card)',
                    border: `1px solid ${tokens.border.default}`,
                    color: tokens.text.primary,
                  }}
                />
              </div>

              {/* Subject Template */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  Subject Template
                </label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Quick question about {{company}}"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    background: 'var(--ios-bg-card)',
                    border: `1px solid ${tokens.border.default}`,
                    color: tokens.text.primary,
                  }}
                />
              </div>

              {/* Steps Editor */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                    Sequence Steps
                  </label>
                  <button
                    onClick={addStep}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                    style={{
                      color: tokens.accent.primary,
                      border: `1px solid ${tokens.accent.primary}30`,
                    }}
                  >
                    <Plus className="w-3 h-3" /> Add Step
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {newSteps.map((step, idx) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-2 p-3 rounded-lg"
                      style={{
                        background: tokens.surfaceExtended,
                        border: `1px solid ${tokens.border.default}`,
                      }}
                    >
                      <span
                        className="flex items-center justify-center w-6 h-6 rounded text-xs font-bold shrink-0"
                        style={{
                          background: `${tokens.accent.primary}15`,
                          color: tokens.accent.primary,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <select
                        value={step.type}
                        onChange={(e) => updateStep(step.id, 'type', e.target.value)}
                        className="px-2 py-1 rounded-md text-xs outline-none"
                        style={{
                          background: tokens.surface.card,
                          border: `1px solid ${tokens.border.default}`,
                          color: tokens.text.primary,
                        }}
                      >
                        <option value="email">Email</option>
                        <option value="wait">Wait</option>
                        <option value="task">Task</option>
                      </select>
                      <input
                        type="text"
                        value={step.label}
                        onChange={(e) => updateStep(step.id, 'label', e.target.value)}
                        placeholder="Step label"
                        className="flex-1 px-2 py-1 rounded-md text-xs outline-none"
                        style={{
                          background: tokens.surface.card,
                          border: `1px solid ${tokens.border.default}`,
                          color: tokens.text.primary,
                        }}
                      />
                      {step.type === 'wait' && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={step.delayDays}
                            onChange={(e) =>
                              updateStep(step.id, 'delayDays', parseInt(e.target.value) || 0)
                            }
                            className="w-14 px-2 py-1 rounded-md text-xs outline-none"
                            style={{
                              background: tokens.surface.card,
                              border: `1px solid ${tokens.border.default}`,
                              color: tokens.text.primary,
                            }}
                          />
                          <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                            days
                          </span>
                        </div>
                      )}
                      {newSteps.length > 1 && (
                        <button
                          onClick={() => removeStep(step.id)}
                          className="p-1 rounded transition-colors"
                          style={{ color: tokens.text.muted }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="flex items-center justify-end gap-3 p-5"
              style={{ borderTop: `1px solid ${tokens.border.default}` }}
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  border: `1px solid ${tokens.border.default}`,
                  color: tokens.text.secondary,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: tokens.accent.primary, color: tokens.text.inverse }}
              >
                Create Sequence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
