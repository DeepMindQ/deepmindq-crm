'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import {
  X,
  Mail,
  MailOpen,
  Reply,
  Paperclip,
  ArrowLeftRight,
} from 'lucide-react';

/* ═══ Types ═══ */

type ReplyStatus = 'unread' | 'read' | 'replied';

interface EmailReply {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  relatedCompany: string;
  receivedAt: string;
  status: ReplyStatus;
  hasAttachment: boolean;
  body: string;
}

/* ═══ Mock Data ═══ */

const MOCK_REPLIES: EmailReply[] = [
  {
    id: 'r-1',
    from: 'David Kim',
    fromEmail: 'david.kim@acmecorp.com',
    subject: 'Re: Exploring partnership opportunities',
    relatedCompany: 'Acme Corp',
    receivedAt: '2025-01-16T09:15:00Z',
    status: 'unread',
    hasAttachment: false,
    body: 'Hi Sarah,\n\nThanks for reaching out! I\'d be happy to schedule a call this Thursday. Let\'s aim for 2 PM EST.\n\nLooking forward to it.\n\nBest,\nDavid',
  },
  {
    id: 'r-2',
    from: 'Rachel Green',
    fromEmail: 'rachel@techstart.io',
    subject: 'Re: Q1 Results and Next Steps',
    relatedCompany: 'TechStart Inc',
    receivedAt: '2025-01-16T08:45:00Z',
    status: 'unread',
    hasAttachment: true,
    body: 'Hi James,\n\nGreat summary! I\'ve shared this with our CTO and she\'s very interested in the pilot program. Can we extend it to 25 users?\n\nAlso, I\'ve attached our technical requirements doc for your review.\n\nBest,\nRachel',
  },
  {
    id: 'r-3',
    from: 'Mark Stevens',
    fromEmail: 'mark.stevens@dataflow.io',
    subject: 'Re: Introduction - DataFlow intelligence solution',
    relatedCompany: 'DataFlow Systems',
    receivedAt: '2025-01-15T16:30:00Z',
    status: 'replied',
    hasAttachment: false,
    body: 'Hi Mike,\n\nThanks for the introduction. We\'re actually looking at a few solutions right now, but your 60% reduction claim caught my attention.\n\nI\'d be open to a quick demo next week. What does your calendar look like?',
  },
  {
    id: 'r-4',
    from: 'Lisa Chen',
    fromEmail: 'lisa.chen@vertexsol.com',
    subject: 'Re: Following up on our demo',
    relatedCompany: 'Vertex Solutions',
    receivedAt: '2025-01-15T14:20:00Z',
    status: 'unread',
    hasAttachment: false,
    body: 'Hi Sarah,\n\nThe demo was excellent! The custom reporting feature is exactly what we need. However, I have a few concerns about the pricing structure.\n\nCan we set up a call to discuss?\n\nBest,\nLisa',
  },
  {
    id: 'r-5',
    from: 'Dr. Amanda Foster',
    fromEmail: 'a.foster@healthfirst.com',
    subject: 'Re: Healthcare compliance whitepaper',
    relatedCompany: 'HealthFirst Medical',
    receivedAt: '2025-01-15T11:00:00Z',
    status: 'read',
    hasAttachment: true,
    body: 'Hi Emily,\n\nThank you for sharing the whitepaper. The encryption standards section was particularly relevant to our current compliance review.\n\nI\'d like to discuss how your platform handles PHI data in more detail. I\'ve attached our compliance checklist for reference.\n\nBest,\nDr. Foster',
  },
  {
    id: 'r-6',
    from: 'Tom Richards',
    fromEmail: 'tom@cloudnova.com',
    subject: 'Re: Partnership proposal - CloudNova integration',
    relatedCompany: 'CloudNova Inc',
    receivedAt: '2025-01-14T15:45:00Z',
    status: 'replied',
    hasAttachment: false,
    body: 'Hi James,\n\nWe\'ve reviewed the proposal internally and are very interested. The joint analytics capabilities would be a strong differentiator for both of our platforms.\n\nLet\'s schedule a detailed technical discussion next week.',
  },
  {
    id: 'r-7',
    from: 'Patricia Wong',
    fromEmail: 'p.wong@finedge.capital',
    subject: 'Re: New features for FinEdge',
    relatedCompany: 'FinEdge Capital',
    receivedAt: '2025-01-16T10:30:00Z',
    status: 'unread',
    hasAttachment: false,
    body: 'Hi Mike,\n\nThe real-time financial signal detection sounds very interesting. We\'ve been struggling with latency in our current setup.\n\nCan you send over some performance benchmarks?\n\nBest,\nPatricia',
  },
  {
    id: 'r-8',
    from: 'Alex Turner',
    fromEmail: 'alex.t@nexgen.ai',
    subject: 'Re: Meeting request - Product walkthrough',
    relatedCompany: 'NexGen Robotics',
    receivedAt: '2025-01-14T09:20:00Z',
    status: 'read',
    hasAttachment: false,
    body: 'Hi Emily,\n\nWednesday 10-12 PM ET works perfectly for me. Please send the meeting link when you have a chance.\n\nLooking forward to the walkthrough!\n\nAlex',
  },
  {
    id: 'r-9',
    from: 'Jordan Blake',
    fromEmail: 'j.blake@synthetica.com',
    subject: 'Re: AI-powered analytics platform',
    relatedCompany: 'Synthetica Labs',
    receivedAt: '2025-01-16T07:00:00Z',
    status: 'unread',
    hasAttachment: true,
    body: 'Hi Sarah,\n\nI saw your presentation at the SaaStr conference last month. Very impressed with the intelligence scoring approach.\n\nWe\'re currently evaluating vendors and I\'d love to include you in our RFP process. I\'ve attached the RFP document.\n\nBest regards,\nJordan',
  },
  {
    id: 'r-10',
    from: 'Maria Santos',
    fromEmail: 'maria.s@globaledge.com',
    subject: 'Re: Expansion opportunity discussion',
    relatedCompany: 'GlobalEdge Partners',
    receivedAt: '2025-01-13T17:15:00Z',
    status: 'read',
    hasAttachment: false,
    body: 'Hi Mike,\n\nThanks for the detailed analysis. The European market data you shared was very insightful. Our board is reviewing the expansion plan and should have a decision by end of month.\n\nI\'ll keep you posted.\n\nBest,\nMaria',
  },
];

/* ═══ Helpers ═══ */

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const then = d.getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getStatusConfig(status: ReplyStatus) {
  switch (status) {
    case 'unread':
      return { label: 'Unread', color: tokens.accent.primary, bg: tokens.accent.subtle };
    case 'read':
      return { label: 'Read', color: tokens.text.muted, bg: tokens.neutral['100'] };
    case 'replied':
      return { label: 'Replied', color: tokens.confidence.high.value, bg: tokens.confidence.high.bg };
  }
}

/* ═══ Main Component ═══ */

export default function Replies() {
  const [replies, setReplies] = useState<EmailReply[]>(MOCK_REPLIES);
  const [loading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReplyStatus | 'all'>('all');
  const [viewingReply, setViewingReply] = useState<EmailReply | null>(null);

  // ── Filtered data ──
  const filteredData = useMemo(() => {
    let result = [...replies];
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    // Sort: unread first, then by date desc
    result.sort((a, b) => {
      const statusOrder = { unread: 0, read: 1, replied: 2 };
      const sDiff = statusOrder[a.status] - statusOrder[b.status];
      if (sDiff !== 0) return sDiff;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });
    return result;
  }, [replies, statusFilter]);

  // ── Stats ──
  const stats = useMemo(() => {
    const unread = replies.filter(r => r.status === 'unread').length;
    const total = replies.length;
    const replied = replies.filter(r => r.status === 'replied').length;
    return { unread, total, replied };
  }, [replies]);

  const openReply = useCallback((reply: EmailReply) => {
    setViewingReply(reply);
    // Mark as read when opened
    setReplies(prev => prev.map(r =>
      r.id === reply.id && r.status === 'unread'
        ? { ...r, status: 'read' as ReplyStatus }
        : r
    ));
  }, []);

  // ── Columns ──
  const columns = useMemo(() => [
    {
      key: 'status',
      label: '',
      render: (value: unknown) => {
        const status = value as ReplyStatus;
        if (status === 'unread') {
          return <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tokens.accent.primary }} />;
        }
        return <div className="w-2.5 h-2.5 shrink-0" />;
      },
    },
    {
      key: 'from',
      label: 'From',
      render: (value: unknown, row: Record<string, unknown>) => {
        const reply = row as unknown as EmailReply;
        const isUnread = reply.status === 'unread';
        return (
          <div className="min-w-[160px]">
            <p className="text-sm" style={{ color: tokens.text.primary, fontWeight: isUnread ? 600 : 400 }}>{reply.from}</p>
            <p className="text-xs truncate" style={{ color: tokens.text.muted }}>{reply.fromEmail}</p>
          </div>
        );
      },
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (value: unknown, row: Record<string, unknown>) => {
        const reply = row as unknown as EmailReply;
        const isUnread = reply.status === 'unread';
        return (
          <div className="min-w-[200px]">
            <p className="text-sm" style={{ color: tokens.text.primary, fontWeight: isUnread ? 600 : 400 }}>{reply.subject}</p>
          </div>
        );
      },
    },
    {
      key: 'relatedCompany',
      label: 'Company',
      render: (value: unknown) => {
        const company = value as string;
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
      key: 'receivedAt',
      label: 'Received',
      render: (value: unknown) => (
        <span className="text-xs" style={{ color: tokens.text.secondary }}>{formatDateTime(value as string)}</span>
      ),
    },
    {
      key: 'statusLabel',
      label: 'Status',
      render: (_: unknown, row: Record<string, unknown>) => {
        const reply = row as unknown as EmailReply;
        const config = getStatusConfig(reply.status);
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ background: config.bg, color: config.color }}
          >
            {reply.status === 'unread' && <Mail className="w-3 h-3" />}
            {reply.status === 'read' && <MailOpen className="w-3 h-3" />}
            {reply.status === 'replied' && <Reply className="w-3 h-3" />}
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'hasAttachment',
      label: '',
      render: (value: unknown) => {
        const hasAttachment = value as boolean;
        if (!hasAttachment) return <span className="w-4" />;
        return <Paperclip className="w-4 h-4" style={{ color: tokens.text.muted }} />;
      },
    },
  ], []);

  const tableData = useMemo(() => filteredData.map(r => ({ ...r })) as Record<string, unknown>[], [filteredData]);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
                Replies
              </h1>
              {stats.unread > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold"
                  style={{ background: tokens.confidence.low.value, color: tokens.flat.white }}
                >
                  {stats.unread}
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>
              {stats.total} replies · {stats.replied} replied
            </p>
          </div>
        </div>
      </div>

      {/* ── Status Filter ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>Filter:</span>
        {(['all', 'unread', 'replied'] as const).map(s => {
          const isActive = statusFilter === s;
          let label = s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1);
          if (s === 'unread' && stats.unread > 0) label += ` (${stats.unread})`;
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

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={tableData}
        onRowClick={(row) => openReply(row as unknown as EmailReply)}
        loading={loading}
        filterable
        filterPlaceholder="Search by subject or sender..."
        exportable
        exportFilename="replies-export"
        pageSize={20}
        emptyMessage="No replies found"
      />

      {/* ── View Reply Slide-over ── */}
      {viewingReply && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setViewingReply(null)}
          />
          <div
            className="relative w-full max-w-lg flex flex-col"
            style={{ background: tokens.surface.card, borderLeft: `1px solid ${tokens.border.default}` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid ${tokens.border.default}` }}>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shrink-0"
                  style={{ background: `${tokens.accent.primary}15`, color: tokens.accent.primary }}
                >
                  {viewingReply.from.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold truncate" style={{ color: tokens.text.primary }}>
                    {viewingReply.from}
                  </h2>
                  <p className="text-xs truncate" style={{ color: tokens.text.muted }}>{viewingReply.fromEmail}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingReply(null)}
                className="p-1.5 rounded-lg transition-colors hover:bg-gray-100 shrink-0"
                style={{ color: tokens.text.muted }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              {/* Meta */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: tokens.surfaceExtended, color: tokens.text.secondary }}
                  >
                    {viewingReply.relatedCompany}
                  </span>
                  <span className="text-xs" style={{ color: tokens.text.muted }}>{formatDateTime(viewingReply.receivedAt)}</span>
                  {viewingReply.hasAttachment && (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: tokens.text.muted }}>
                      <Paperclip className="w-3 h-3" /> Attachment
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold" style={{ color: tokens.text.primary }}>{viewingReply.subject}</h3>
              </div>

              {/* Body */}
              <div
                className="px-4 py-4 rounded-lg whitespace-pre-wrap text-sm leading-relaxed"
                style={{ background: tokens.surfaceExtended, border: `1px solid ${tokens.border.default}`, color: tokens.text.primary }}
              >
                {viewingReply.body}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5" style={{ borderTop: `1px solid ${tokens.border.default}` }}>
              <span className="text-xs" style={{ color: tokens.text.muted }}>
                {getStatusConfig(viewingReply.status).label}
              </span>
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ border: `1px solid ${tokens.border.default}`, color: tokens.text.secondary }}
                >
                  <ArrowLeftRight className="w-4 h-4" /> Forward
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: tokens.accent.primary, color: tokens.text.inverse }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = tokens.accent.hover; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = tokens.accent.primary; }}
                >
                  <Reply className="w-4 h-4" /> Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
