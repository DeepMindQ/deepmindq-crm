'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import { Skeleton } from '@/components/ui/skeleton';
import { FileEdit, Plus, X, Send, Mail, CalendarClock, Pencil } from 'lucide-react';

/* ═══ Types ═══ */

type DraftStatus = 'draft' | 'sent' | 'scheduled';

interface Draft {
  id: string;
  subject: string;
  toContact: string;
  relatedCompany: string;
  status: DraftStatus;
  lastModified: string;
  templateUsed: string;
  body: string;
}

/* ═══ Mock Data ═══ */

const MOCK_DRAFTS: Draft[] = [
  {
    id: 'd-1',
    subject: 'Re: Exploring partnership opportunities',
    toContact: 'David Kim',
    relatedCompany: 'Acme Corp',
    status: 'draft',
    lastModified: '2025-01-16T09:30:00Z',
    templateUsed: 'Introduction',
    body: "Hi David,\n\nI wanted to follow up on our conversation last week regarding the potential partnership between our teams. As discussed, I've put together a brief overview of how we could collaborate on the data analytics initiative.\n\nWould you have 15 minutes this Thursday to review it together?\n\nBest,\nSarah",
  },
  {
    id: 'd-2',
    subject: 'Q1 Results and Next Steps',
    toContact: 'Rachel Green',
    relatedCompany: 'TechStart Inc',
    status: 'scheduled',
    lastModified: '2025-01-15T16:45:00Z',
    templateUsed: 'Proposal',
    body: "Hi Rachel,\n\nThank you for the productive demo session. I'm excited about the fit between our platform and TechStart's requirements.\n\nHere are the key takeaways and proposed next steps:\n1. Integration timeline: 4 weeks\n2. Pilot program: 30-day trial with 10 users\n3. Expected ROI: 3x within 6 months\n\nI've scheduled this email to arrive tomorrow morning for your convenience.\n\nBest regards,\nJames",
  },
  {
    id: 'd-3',
    subject: 'Introduction - DataFlow intelligence solution',
    toContact: 'Mark Stevens',
    relatedCompany: 'DataFlow Systems',
    status: 'sent',
    lastModified: '2025-01-14T11:20:00Z',
    templateUsed: 'Introduction',
    body: 'Hi Mark,\n\nI noticed DataFlow has been expanding its analytics capabilities and thought this might be a great time to connect.\n\nOur platform has helped similar data companies reduce analysis time by 60% while improving accuracy.\n\nWould you be open to a brief call?\n\nBest,\nMike',
  },
  {
    id: 'd-4',
    subject: 'Following up on our demo',
    toContact: 'Lisa Chen',
    relatedCompany: 'Vertex Solutions',
    status: 'draft',
    lastModified: '2025-01-16T08:15:00Z',
    templateUsed: 'Follow-up',
    body: "Hi Lisa,\n\nI hope the demo gave you a clear picture of how our platform works. I wanted to address the question you had about custom reporting.\n\nYes, we fully support custom report building with drag-and-drop widgets. I'd love to show you this in more detail.\n\nAre you available this week?\n\nBest,\nSarah",
  },
  {
    id: 'd-5',
    subject: 'Healthcare compliance whitepaper',
    toContact: 'Dr. Amanda Foster',
    relatedCompany: 'HealthFirst Medical',
    status: 'draft',
    lastModified: '2025-01-15T14:00:00Z',
    templateUsed: 'Check-in',
    body: 'Hi Dr. Foster,\n\nFollowing our discussion about HIPAA-compliant data handling, I wanted to share our latest whitepaper on healthcare data intelligence best practices.\n\nThe paper covers:\n- Encryption standards for patient data\n- Access control frameworks\n- Audit trail requirements\n\nWould love to get your thoughts.\n\nBest,\nEmily',
  },
  {
    id: 'd-6',
    subject: 'Partnership proposal - CloudNova integration',
    toContact: 'Tom Richards',
    relatedCompany: 'CloudNova Inc',
    status: 'sent',
    lastModified: '2025-01-13T10:30:00Z',
    templateUsed: 'Proposal',
    body: "Hi Tom,\n\nAs discussed on our call, here's the formal partnership proposal for integrating CloudNova's cloud services with our intelligence platform.\n\nThe partnership would enable joint customers to leverage real-time cloud analytics alongside our intelligence scoring.\n\nLooking forward to your feedback.\n\nBest,\nJames",
  },
  {
    id: 'd-7',
    subject: 'Re-engagement: New features for FinEdge',
    toContact: 'Patricia Wong',
    relatedCompany: 'FinEdge Capital',
    status: 'scheduled',
    lastModified: '2025-01-16T07:00:00Z',
    templateUsed: 'Re-engagement',
    body: "Hi Patricia,\n\nIt's been a few months since we last connected about FinEdge's intelligence needs. Since then, we've launched several features that directly address the challenges you mentioned:\n\n- Real-time financial signal detection\n- Enhanced risk scoring models\n- Automated regulatory compliance tracking\n\nWould love to give you a quick update.\n\nBest,\nMike",
  },
  {
    id: 'd-8',
    subject: 'Meeting request - Product walkthrough',
    toContact: 'Alex Turner',
    relatedCompany: 'NexGen Robotics',
    status: 'draft',
    lastModified: '2025-01-16T10:45:00Z',
    templateUsed: 'Meeting Request',
    body: "Hi Alex,\n\nI've been following NexGen's impressive growth in the robotics space and believe our intelligence platform could significantly accelerate your sales cycle.\n\nI'd love to schedule a 30-minute product walkthrough to show you how we've helped similar technology companies.\n\nMy availability this week:\n- Tue 2-4 PM ET\n- Wed 10-12 PM ET\n- Thu 1-3 PM ET\n\nBest,\nEmily",
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

function getStatusConfig(status: DraftStatus) {
  switch (status) {
    case 'draft':
      return { label: 'Draft', color: tokens.text.muted, bg: tokens.neutral['100'] };
    case 'sent':
      return { label: 'Sent', color: tokens.confidence.high.value, bg: tokens.confidence.high.bg };
    case 'scheduled':
      return { label: 'Scheduled', color: tokens.accent.primary, bg: tokens.accent.subtle };
  }
}

/* ═══ Sub-components ═══ */

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof FileEdit;
  label: string;
  value: string | number;
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
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DraftStatus }) {
  const config = getStatusConfig(status);
  const Icon = status === 'draft' ? Pencil : status === 'sent' ? Send : CalendarClock;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: config.bg, color: config.color }}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

/* ═══ Main Component ═══ */

export default function Drafts() {
  const [drafts, setDrafts] = useState<Draft[]>(MOCK_DRAFTS);
  const [loading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DraftStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<string>('lastModified');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [editBody, setEditBody] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeCompany, setComposeCompany] = useState('');
  const [composeBody, setComposeBody] = useState('');

  // ── Filtered & sorted ──
  const filteredData = useMemo(() => {
    let result = [...drafts];
    if (statusFilter !== 'all') result = result.filter((d) => d.status === statusFilter);
    result.sort((a, b) => {
      let aVal: string;
      let bVal: string;
      switch (sortKey) {
        case 'subject':
          aVal = a.subject.toLowerCase();
          bVal = b.subject.toLowerCase();
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
    return result;
  }, [drafts, statusFilter, sortKey, sortDir]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = drafts.length;
    const draftsCount = drafts.filter((d) => d.status === 'draft').length;
    const scheduled = drafts.filter((d) => d.status === 'scheduled').length;
    const sent = drafts.filter((d) => d.status === 'sent').length;
    return { total, draftsCount, scheduled, sent };
  }, [drafts]);

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

  const openEditor = useCallback((draft: Draft) => {
    setEditingDraft(draft);
    setEditBody(draft.body);
  }, []);

  const saveDraft = useCallback(() => {
    if (!editingDraft) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === editingDraft.id
          ? { ...d, body: editBody, lastModified: new Date().toISOString() }
          : d,
      ),
    );
    setEditingDraft(null);
    setEditBody('');
  }, [editingDraft, editBody]);

  const handleCompose = useCallback(() => {
    if (!composeSubject.trim()) return;
    const newDraft: Draft = {
      id: `d-${Date.now()}`,
      subject: composeSubject.trim(),
      toContact: composeTo.trim() || 'Unknown',
      relatedCompany: composeCompany.trim() || '—',
      status: 'draft',
      lastModified: new Date().toISOString(),
      templateUsed: '—',
      body: composeBody,
    };
    setDrafts((prev) => [newDraft, ...prev]);
    setShowCompose(false);
    setComposeSubject('');
    setComposeTo('');
    setComposeCompany('');
    setComposeBody('');
  }, [composeSubject, composeTo, composeCompany, composeBody]);

  // ── Columns ──
  const columns = useMemo(
    () => [
      {
        key: 'subject',
        label: 'Subject',
        sortable: true,
        render: (_: unknown, row: Record<string, unknown>) => {
          const draft = row as unknown as Draft;
          return (
            <div className="min-w-[200px]">
              <p className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                {draft.subject}
              </p>
            </div>
          );
        },
      },
      {
        key: 'toContact',
        label: 'To',
        render: (value: unknown) => {
          const name = value as string;
          return (
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
                style={{ background: `${tokens.accent.primary}15`, color: tokens.accent.primary }}
              >
                {name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <span className="text-sm" style={{ color: tokens.text.secondary }}>
                {name}
              </span>
            </div>
          );
        },
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
        key: 'status',
        label: 'Status',
        render: (value: unknown) => <StatusBadge status={value as DraftStatus} />,
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
        key: 'templateUsed',
        label: 'Template',
        render: (value: unknown) => {
          const tpl = value as string;
          if (tpl === '—') return <span style={{ color: tokens.text.muted }}>—</span>;
          return (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
              style={{ background: `${tokens.domain.reasoning}15`, color: tokens.domain.reasoning }}
            >
              <Mail className="w-3 h-3" />
              {tpl}
            </span>
          );
        },
      },
    ],
    [],
  );

  const tableData = useMemo(
    () => filteredData.map((d) => ({ ...d })) as Record<string, unknown>[],
    [filteredData],
  );

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Email Drafts
          </h1>
          <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>
            Compose and manage email drafts
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
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
          Compose New
        </button>
      </div>

      {/* ── Stats ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                  className="h-6 w-12 rounded"
                  style={{ background: tokens.border.default }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard
            icon={FileEdit}
            label="Total Drafts"
            value={stats.total}
            accent={tokens.accent.primary}
          />
          <StatCard
            icon={Pencil}
            label="Drafts"
            value={stats.draftsCount}
            accent={tokens.text.muted}
          />
          <StatCard
            icon={CalendarClock}
            label="Scheduled"
            value={stats.scheduled}
            accent={tokens.confidence.medium.value}
          />
          <StatCard
            icon={Send}
            label="Sent"
            value={stats.sent}
            accent={tokens.confidence.high.value}
          />
        </div>
      )}

      {/* ── Status Filter ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>
          Filter:
        </span>
        {(['all', 'draft', 'scheduled', 'sent'] as const).map((s) => {
          const isActive = statusFilter === s;
          const label = s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1);
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
              style={{
                background: isActive ? `${tokens.accent.primary}15` : 'transparent',
                color: isActive ? tokens.accent.primary : tokens.text.secondary,
                border: isActive
                  ? `1px solid ${tokens.accent.primary}30`
                  : `1px solid ${tokens.border.default}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={tableData}
        onRowClick={(row) => openEditor(row as unknown as Draft)}
        onSort={handleSort}
        sortKey={sortKey}
        sortDir={sortDir}
        loading={loading}
        filterable
        filterPlaceholder="Search drafts..."
        exportable
        exportFilename="drafts-export"
        pageSize={20}
        emptyMessage="No drafts found"
      />

      {/* ── Edit Slide-over ── */}
      {editingDraft && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setEditingDraft(null)}
          />
          <div
            className="relative w-full max-w-lg flex flex-col"
            style={{
              background: tokens.surface.card,
              borderLeft: `1px solid ${tokens.border.default}`,
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
                  <Pencil className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2
                    className="text-base font-semibold truncate"
                    style={{ color: tokens.text.primary }}
                  >
                    {editingDraft.subject}
                  </h2>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>
                    To: {editingDraft.toContact} · {editingDraft.relatedCompany}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingDraft(null)}
                className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: tokens.text.muted }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <label
                className="text-xs font-medium block mb-1.5"
                style={{ color: tokens.text.muted }}
              >
                Email Body
              </label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={20}
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-colors resize-none font-mono leading-relaxed"
                style={{
                  background: 'var(--ios-bg-card)',
                  border: `1px solid ${tokens.border.default}`,
                  color: tokens.text.primary,
                }}
              />
            </div>
            <div
              className="flex items-center justify-end gap-3 p-5"
              style={{ borderTop: `1px solid ${tokens.border.default}` }}
            >
              <button
                onClick={() => setEditingDraft(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  border: `1px solid ${tokens.border.default}`,
                  color: tokens.text.secondary,
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveDraft}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: tokens.accent.primary, color: tokens.text.inverse }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compose Modal ── */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setShowCompose(false)}
          />
          <div
            className="relative w-full max-w-lg flex flex-col"
            style={{
              background: tokens.surface.card,
              borderLeft: `1px solid ${tokens.border.default}`,
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
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                    New Draft
                  </h2>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>
                    Compose a new email
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCompose(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: tokens.text.muted }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  To
                </label>
                <input
                  type="text"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="Contact name"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: 'var(--ios-bg-card)',
                    border: `1px solid ${tokens.border.default}`,
                    color: tokens.text.primary,
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  Company
                </label>
                <input
                  type="text"
                  value={composeCompany}
                  onChange={(e) => setComposeCompany(e.target.value)}
                  placeholder="Related company"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: 'var(--ios-bg-card)',
                    border: `1px solid ${tokens.border.default}`,
                    color: tokens.text.primary,
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  Subject
                </label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Email subject"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: 'var(--ios-bg-card)',
                    border: `1px solid ${tokens.border.default}`,
                    color: tokens.text.primary,
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  Body
                </label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email..."
                  rows={12}
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none font-mono leading-relaxed"
                  style={{
                    background: 'var(--ios-bg-card)',
                    border: `1px solid ${tokens.border.default}`,
                    color: tokens.text.primary,
                  }}
                />
              </div>
            </div>
            <div
              className="flex items-center justify-end gap-3 p-5"
              style={{ borderTop: `1px solid ${tokens.border.default}` }}
            >
              <button
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  border: `1px solid ${tokens.border.default}`,
                  color: tokens.text.secondary,
                }}
              >
                Discard
              </button>
              <button
                onClick={handleCompose}
                disabled={!composeSubject.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: tokens.accent.primary, color: tokens.text.inverse }}
              >
                <span className="flex items-center gap-2">
                  <FileEdit className="w-4 h-4" /> Save Draft
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
