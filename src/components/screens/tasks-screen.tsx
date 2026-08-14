'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  ArrowUp,
  Clock,
  ListChecks,
  CalendarClock,
  CalendarCheck,
  Flame,
} from 'lucide-react';

/* ═══ Types ═══ */

type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
type TaskStatus = 'todo' | 'in_progress' | 'done';

interface Task {
  id: string;
  name: string;
  assignedTo: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  relatedCompany: string;
  createdAt: string;
}

/* ═══ Mock Data ═══ */

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0];
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

const MOCK_TASKS: Task[] = [
  { id: 't-1', name: 'Send proposal to Acme Corp', assignedTo: 'Sarah Chen', dueDate: yesterday, priority: 'critical', status: 'todo', relatedCompany: 'Acme Corp', createdAt: threeDaysAgo },
  { id: 't-2', name: 'Follow up with TechStart demo', assignedTo: 'James Wilson', dueDate: today, priority: 'high', status: 'in_progress', relatedCompany: 'TechStart Inc', createdAt: fourDaysAgo },
  { id: 't-3', name: 'Prepare Q1 pipeline review', assignedTo: 'Sarah Chen', dueDate: tomorrow, priority: 'high', status: 'todo', relatedCompany: '—', createdAt: twoDaysAgo },
  { id: 't-4', name: 'Update CRM for Vertex Solutions', assignedTo: 'Mike Rodriguez', dueDate: today, priority: 'medium', status: 'in_progress', relatedCompany: 'Vertex Solutions', createdAt: threeDaysAgo },
  { id: 't-5', name: 'Research competitor positioning', assignedTo: 'Emily Park', dueDate: nextWeek, priority: 'low', status: 'todo', relatedCompany: '—', createdAt: twoDaysAgo },
  { id: 't-6', name: 'Schedule call with DataFlow', assignedTo: 'James Wilson', dueDate: twoDaysAgo, priority: 'high', status: 'done', relatedCompany: 'DataFlow Systems', createdAt: fourDaysAgo },
  { id: 't-7', name: 'Draft intro email for HealthFirst', assignedTo: 'Sarah Chen', dueDate: today, priority: 'medium', status: 'todo', relatedCompany: 'HealthFirst Medical', createdAt: yesterday },
  { id: 't-8', name: 'Review intelligence report for FinEdge', assignedTo: 'Mike Rodriguez', dueDate: tomorrow, priority: 'critical', status: 'in_progress', relatedCompany: 'FinEdge Capital', createdAt: threeDaysAgo },
  { id: 't-9', name: 'Add contacts for CloudNova', assignedTo: 'Emily Park', dueDate: twoDaysAgo, priority: 'medium', status: 'done', relatedCompany: 'CloudNova Inc', createdAt: fourDaysAgo },
  { id: 't-10', name: 'Send case study to NexGen', assignedTo: 'James Wilson', dueDate: today, priority: 'low', status: 'todo', relatedCompany: 'NexGen Robotics', createdAt: yesterday },
  { id: 't-11', name: 'Update ICP scoring model', assignedTo: 'Emily Park', dueDate: nextWeek, priority: 'medium', status: 'todo', relatedCompany: '—', createdAt: today },
  { id: 't-12', name: 'Resolve duplicate accounts', assignedTo: 'Mike Rodriguez', dueDate: yesterday, priority: 'high', status: 'done', relatedCompany: '—', createdAt: fourDaysAgo },
];

/* ═══ Helpers ═══ */

function formatDate(dateStr: string): string {
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPriorityConfig(priority: TaskPriority) {
  switch (priority) {
    case 'critical':
      return { label: 'Critical', color: tokens.confidence.critical.value, bg: tokens.confidence.critical.bg };
    case 'high':
      return { label: 'High', color: tokens.confidence.low.value, bg: tokens.confidence.low.bg };
    case 'medium':
      return { label: 'Medium', color: tokens.confidence.medium.value, bg: tokens.confidence.medium.bg };
    case 'low':
      return { label: 'Low', color: tokens.confidence.high.value, bg: tokens.confidence.high.bg };
  }
}

function getStatusConfig(status: TaskStatus) {
  switch (status) {
    case 'todo':
      return { label: 'To Do', color: tokens.text.muted, bg: tokens.neutral['100'] };
    case 'in_progress':
      return { label: 'In Progress', color: tokens.accent.primary, bg: tokens.accent.subtle };
    case 'done':
      return { label: 'Done', color: tokens.confidence.high.value, bg: tokens.confidence.high.bg };
  }
}

/* ═══ Sub-components ═══ */

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof ListChecks;
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
        <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>{label}</p>
        <p className="text-xl font-bold tracking-tight mt-0.5" style={{ color: tokens.text.primary }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>{sub}</p>}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = getPriorityConfig(priority);
  const Icon = priority === 'critical' ? Flame : priority === 'high' ? ArrowUp : AlertTriangle;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: config.bg, color: config.color }}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const config = getStatusConfig(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: config.bg, color: config.color }}
    >
      {status === 'done' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'in_progress' && <Clock className="w-3 h-3" />}
      {status === 'todo' && <Circle className="w-3 h-3" />}
      {config.label}
    </span>
  );
}

/* ═══ Main Component ═══ */

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [loading] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<string>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Filtered & sorted data ──
  const filteredData = useMemo(() => {
    let result = [...tasks];
    if (priorityFilter !== 'all') result = result.filter(t => t.priority === priorityFilter);
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortKey) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'dueDate':
        default: aVal = a.dueDate; bVal = b.dueDate; break;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [tasks, priorityFilter, statusFilter, sortKey, sortDir]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter(t => t.status !== 'done' && t.dueDate < today).length;
    const dueToday = tasks.filter(t => t.status !== 'done' && t.dueDate === today).length;
    const completedThisWeek = tasks.filter(t => t.status === 'done').length;
    return { total, overdue, dueToday, completedThisWeek };
  }, [tasks]);

  const handleSort = useCallback((key: string) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }, [sortKey]);

  const toggleComplete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (t.status === 'done') return { ...t, status: 'todo' as TaskStatus };
      return { ...t, status: 'done' as TaskStatus };
    }));
  }, []);

  // ── Columns ──
  const columns = useMemo(() => [
    {
      key: 'checkbox',
      label: '',
      render: (_: unknown, row: Record<string, unknown>) => {
        const task = row as unknown as Task;
        const isDone = task.status === 'done';
        return (
          <button
            onClick={(e) => toggleComplete(task.id, e)}
            className="flex items-center justify-center w-5 h-5 rounded transition-colors"
            style={{ color: isDone ? tokens.confidence.high.value : tokens.text.muted }}
          >
            {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </button>
        );
      },
    },
    {
      key: 'name',
      label: 'Task Name',
      sortable: true,
      render: (_: unknown, row: Record<string, unknown>) => {
        const task = row as unknown as Task;
        return (
          <div className="min-w-[200px]">
            <p
              className="text-sm font-semibold"
              style={{
                color: tokens.text.primary,
                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                opacity: task.status === 'done' ? 0.5 : 1,
              }}
            >
              {task.name}
            </p>
          </div>
        );
      },
    },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      render: (value: unknown) => {
        const name = value as string;
        return (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
              style={{ background: `${tokens.accent.primary}15`, color: tokens.accent.primary }}
            >
              {name.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-sm" style={{ color: tokens.text.secondary }}>{name}</span>
          </div>
        );
      },
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      sortable: true,
      render: (value: unknown, row: Record<string, unknown>) => {
        const dateStr = value as string;
        const task = row as unknown as Task;
        const isOverdue = task.status !== 'done' && dateStr < today;
        const isToday = dateStr === today;
        return (
          <span
            className="text-xs font-medium"
            style={{
              color: isOverdue ? tokens.confidence.low.value : isToday ? tokens.confidence.medium.value : tokens.text.secondary,
            }}
          >
            {isOverdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
            {formatDate(dateStr)}
          </span>
        );
      },
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (value: unknown) => <PriorityBadge priority={value as TaskPriority} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: unknown) => <StatusBadge status={value as TaskStatus} />,
    },
    {
      key: 'relatedCompany',
      label: 'Company',
      render: (value: unknown) => {
        const company = value as string;
        if (company === '—') return <span style={{ color: tokens.text.muted }}>—</span>;
        return (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            style={{ background: tokens.surfaceExtended, color: tokens.text.secondary }}
          >
            {company}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (value: unknown) => (
        <span className="text-xs" style={{ color: tokens.text.muted }}>{formatDate(value as string)}</span>
      ),
    },
  ], [toggleComplete]);

  const tableData = useMemo(() => filteredData.map(t => ({ ...t })) as Record<string, unknown>[], [filteredData]);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>Tasks</h1>
          <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>Manage your sales tasks and follow-ups</p>
        </div>
      </div>

      {/* ── Stats ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}>
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" style={{ background: tokens.border.default }} />
              <div className="flex-1">
                <Skeleton className="h-3 w-20 mb-2 rounded" style={{ background: tokens.border.default }} />
                <Skeleton className="h-6 w-12 rounded" style={{ background: tokens.border.default }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={ListChecks} label="Total Tasks" value={stats.total} accent={tokens.accent.primary} sub={`${tasks.filter(t => t.status === 'in_progress').length} in progress`} />
          <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue} accent={tokens.confidence.low.value} sub="Needs attention" />
          <StatCard icon={CalendarClock} label="Due Today" value={stats.dueToday} accent={tokens.confidence.medium.value} sub="Action required" />
          <StatCard icon={CalendarCheck} label="Completed This Week" value={stats.completedThisWeek} accent={tokens.confidence.high.value} sub={`${Math.round((stats.completedThisWeek / stats.total) * 100)}% completion rate`} />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>Priority:</span>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => {
            const isActive = priorityFilter === p;
            return (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  background: isActive ? `${tokens.accent.primary}15` : 'transparent',
                  color: isActive ? tokens.accent.primary : tokens.text.secondary,
                  border: isActive ? `1px solid ${tokens.accent.primary}30` : `1px solid ${tokens.border.default}`,
                }}
              >
                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>Status:</span>
          {(['all', 'todo', 'in_progress', 'done'] as const).map(s => {
            const isActive = statusFilter === s;
            const label = s === 'all' ? 'All' : s === 'todo' ? 'To Do' : s === 'in_progress' ? 'In Progress' : 'Done';
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  background: isActive ? `${tokens.accent.primary}15` : 'transparent',
                  color: isActive ? tokens.accent.primary : tokens.text.secondary,
                  border: isActive ? `1px solid ${tokens.accent.primary}30` : `1px solid ${tokens.border.default}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={tableData}
        onSort={handleSort}
        sortKey={sortKey}
        sortDir={sortDir}
        loading={loading}
        filterable
        filterPlaceholder="Search tasks..."
        exportable
        exportFilename="tasks-export"
        pageSize={20}
        emptyMessage="No tasks found"
      />
    </div>
  );
}
