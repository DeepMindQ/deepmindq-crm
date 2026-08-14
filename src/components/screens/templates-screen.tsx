'use client';

import { useState, useMemo } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Search,
  Eye,
  Copy,
  X,
  LayoutTemplate,
  Mail,
  CalendarCheck,
  FileBarChart,
  Clock,
  RotateCcw,
} from 'lucide-react';

/* ═══ Types ═══ */

type TemplateCategory =
  'introduction' | 'follow-up' | 'meeting' | 'proposal' | 'check-in' | 're-engagement';

interface EmailTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  lastUsed: string;
  useCount: number;
}

/* ═══ Mock Data ═══ */

const MOCK_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Introduction',
    category: 'introduction',
    subject: 'Quick introduction — {{company}} + {{product}}',
    body: `Hi {{firstName}},

I noticed {{company}} recently {{recentEvent}} and thought it might be a great time to connect.

I'm reaching out because we've helped similar teams in the {{industry}} space achieve {{metric}} improvement in {{timeframe}}.

Would you be open to a brief 15-minute call this week to explore if there's a fit?

Best regards,
{{senderName}}`,
    lastUsed: '2025-01-15T10:00:00Z',
    useCount: 147,
  },
  {
    id: 'tpl-2',
    name: 'Follow-up',
    category: 'follow-up',
    subject: 'Re: {{previousSubject}} — any thoughts?',
    body: `Hi {{firstName}},

I wanted to circle back on my previous message. I understand you're busy, so I'll keep this brief.

Based on what I've seen about {{company}}'s {{focusArea}}, I believe there are a few specific areas where we could add real value:

• {{valuePoint1}}
• {{valuePoint2}}
• {{valuePoint3}}

Would love to hear your thoughts when you get a chance.

Best,
{{senderName}}`,
    lastUsed: '2025-01-14T14:30:00Z',
    useCount: 203,
  },
  {
    id: 'tpl-3',
    name: 'Meeting Request',
    category: 'meeting',
    subject: "15 min to discuss {{company}}'s {{initiative}} strategy",
    body: `Hi {{firstName}},

I've been following {{company}}'s work in {{space}} and I'm impressed by your recent {{achievement}}.

I have a few ideas that might be relevant to your {{currentProject}} initiative. Rather than detail everything here, would a quick 15-minute call make sense?

I have availability:
• {{slot1}}
• {{slot2}}
• {{slot3}}

If none of these work, feel free to suggest a time that's better for you.

Looking forward to connecting,
{{senderName}}`,
    lastUsed: '2025-01-13T09:15:00Z',
    useCount: 89,
  },
  {
    id: 'tpl-4',
    name: 'Proposal',
    category: 'proposal',
    subject: 'Proposal: {{solutionName}} for {{company}}',
    body: `Hi {{firstName}},

Thank you for the great conversation on {{callDate}}. As discussed, here's a summary of what we can deliver for {{company}}:

**Proposed Solution:**
{{solutionDescription}}

**Expected Outcomes:**
• {{outcome1}}
• {{outcome2}}
• {{outcome3}}

**Timeline:** {{timeline}}
**Investment:** {{pricing}}

I've attached a detailed proposal document for your review. Happy to walk through any questions on a follow-up call.

Best regards,
{{senderName}}`,
    lastUsed: '2025-01-12T16:45:00Z',
    useCount: 56,
  },
  {
    id: 'tpl-5',
    name: 'Check-in',
    category: 'check-in',
    subject: 'Checking in — {{company}} + {{topic}}',
    body: `Hi {{firstName}},

It's been a while since we last connected. I hope everything is going well with {{project}} at {{company}}.

I came across {{relevantContent}} and immediately thought of you — it touches on the {{topic}} challenge we discussed.

Worth a quick read: {{contentLink}}

No action needed — just wanted to share. Let me know if there's anything I can help with.

Cheers,
{{senderName}}`,
    lastUsed: '2025-01-11T11:20:00Z',
    useCount: 124,
  },
  {
    id: 'tpl-6',
    name: 'Re-engagement',
    category: 're-engagement',
    subject: "{{firstName}}, it's been a while — new developments at {{senderCompany}}",
    body: `Hi {{firstName}},

We spoke back in {{lastContactDate}} about {{previousTopic}}. A lot has changed since then, and I think you'll find our recent updates interesting.

**What's new:**
• {{newFeature1}}
• {{newFeature2}}
• {{newFeature3}}

Several teams similar to {{company}} have recently seen {{improvement}} after implementing these updates.

Would you be open to a quick catch-up call to see what's changed?

Best,
{{senderName}}`,
    lastUsed: '2025-01-10T08:30:00Z',
    useCount: 72,
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

function getCategoryConfig(cat: TemplateCategory) {
  switch (cat) {
    case 'introduction':
      return { label: 'Introduction', color: tokens.accent.primary, bg: tokens.accent.subtle };
    case 'follow-up':
      return { label: 'Follow-up', color: tokens.domain.opportunity, bg: '#ECFDF5' };
    case 'meeting':
      return { label: 'Meeting', color: tokens.domain.reasoning, bg: '#EDE9FE' };
    case 'proposal':
      return {
        label: 'Proposal',
        color: tokens.confidence.high.value,
        bg: tokens.confidence.high.bg,
      };
    case 'check-in':
      return {
        label: 'Check-in',
        color: tokens.confidence.medium.value,
        bg: tokens.confidence.medium.bg,
      };
    case 're-engagement':
      return { label: 'Re-engagement', color: tokens.domain.action, bg: '#DBEAFE' };
    default:
      return { label: cat, color: tokens.text.muted, bg: tokens.neutral['100'] };
  }
}

function getCategoryIcon(cat: TemplateCategory) {
  switch (cat) {
    case 'introduction':
      return Mail;
    case 'follow-up':
      return RotateCcw;
    case 'meeting':
      return CalendarCheck;
    case 'proposal':
      return FileBarChart;
    case 'check-in':
      return Clock;
    case 're-engagement':
      return RotateCcw;
    default:
      return FileText;
  }
}

const CATEGORIES: { value: TemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'introduction', label: 'Introduction' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'check-in', label: 'Check-in' },
  { value: 're-engagement', label: 'Re-engagement' },
];

/* ═══ Main Component ═══ */

export default function Templates() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all');
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [loading] = useState(false);

  const filteredTemplates = useMemo(() => {
    let result = MOCK_TEMPLATES;
    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      );
    }
    return result;
  }, [search, categoryFilter]);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Email Templates
          </h1>
          <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>
            Manage your library of outreach email templates
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: tokens.text.muted }}>
          <LayoutTemplate className="w-4 h-4" />
          {MOCK_TEMPLATES.length} templates
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: tokens.text.muted }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name or subject..."
            className="w-full pl-10 pr-3 py-2 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'var(--ios-bg-card)',
              border: `1px solid ${tokens.border.default}`,
              color: tokens.text.primary,
            }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map((cat) => {
            const isActive = categoryFilter === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  background: isActive ? `${tokens.accent.primary}15` : 'transparent',
                  color: isActive ? tokens.accent.primary : tokens.text.secondary,
                  border: isActive
                    ? `1px solid ${tokens.accent.primary}30`
                    : `1px solid ${tokens.border.default}`,
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-5"
              style={{
                background: tokens.surface.card,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <Skeleton
                className="h-5 w-32 mb-3 rounded"
                style={{ background: tokens.border.default }}
              />
              <Skeleton
                className="h-3 w-full mb-2 rounded"
                style={{ background: tokens.border.default }}
              />
              <Skeleton
                className="h-3 w-3/4 mb-4 rounded"
                style={{ background: tokens.border.default }}
              />
              <div className="flex gap-2">
                <Skeleton
                  className="h-8 w-20 rounded-lg"
                  style={{ background: tokens.border.default }}
                />
                <Skeleton
                  className="h-8 w-20 rounded-lg"
                  style={{ background: tokens.border.default }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && filteredTemplates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: `${tokens.accent.primary}12` }}
          >
            <LayoutTemplate className="w-8 h-8" style={{ color: tokens.accent.primary }} />
          </div>
          <h3 className="text-base font-semibold mb-1.5" style={{ color: tokens.text.primary }}>
            No templates found
          </h3>
          <p className="text-sm text-center max-w-sm" style={{ color: tokens.text.secondary }}>
            {search || categoryFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No email templates have been created yet.'}
          </p>
          {(search || categoryFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setCategoryFilter('all');
              }}
              className="text-xs font-medium mt-3"
              style={{ color: tokens.accent.primary }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Template Grid ── */}
      {!loading && filteredTemplates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => {
            const catConfig = getCategoryConfig(tpl.category);
            const CatIcon = getCategoryIcon(tpl.category);
            return (
              <div
                key={tpl.id}
                className="rounded-xl p-5 flex flex-col gap-3 transition-all hover:shadow-lg"
                style={{
                  background: tokens.surface.card,
                  border: `1px solid ${tokens.border.default}`,
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
                      style={{ background: `${catConfig.color}15`, color: catConfig.color }}
                    >
                      <CatIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3
                        className="text-sm font-semibold truncate"
                        style={{ color: tokens.text.primary }}
                      >
                        {tpl.name}
                      </h3>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium mt-0.5"
                        style={{ background: catConfig.bg, color: catConfig.color }}
                      >
                        {catConfig.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subject Preview */}
                <div className="min-w-0">
                  <p className="text-xs font-medium mb-1" style={{ color: tokens.text.muted }}>
                    Subject
                  </p>
                  <p className="text-sm truncate" style={{ color: tokens.text.secondary }}>
                    {tpl.subject}
                  </p>
                </div>

                {/* Meta */}
                <div
                  className="flex items-center justify-between text-xs"
                  style={{ color: tokens.text.muted }}
                >
                  <span>{tpl.useCount} uses</span>
                  <span>Last used {formatRelativeDate(tpl.lastUsed)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <button
                    onClick={() => setPreviewTemplate(tpl)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      border: `1px solid ${tokens.border.default}`,
                      color: tokens.text.secondary,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = tokens.surfaceExtended;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: tokens.accent.primary, color: tokens.text.inverse }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = tokens.accent.hover;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = tokens.accent.primary;
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" /> Use Template
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Preview Slide-over ── */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setPreviewTemplate(null)}
          />
          {/* Panel */}
          <div
            className="relative w-full max-w-lg flex flex-col"
            style={{
              background: tokens.surface.card,
              borderLeft: `1px solid ${tokens.border.default}`,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-5"
              style={{ borderBottom: `1px solid ${tokens.border.default}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg"
                  style={{ background: `${tokens.accent.primary}15`, color: tokens.accent.primary }}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                    {previewTemplate.name}
                  </h2>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>
                    Template Preview
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: tokens.text.muted }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              {/* Subject */}
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: tokens.text.muted }}
                >
                  Subject Line
                </label>
                <div
                  className="px-4 py-3 rounded-lg"
                  style={{
                    background: tokens.surfaceExtended,
                    border: `1px solid ${tokens.border.default}`,
                  }}
                >
                  <p className="text-sm" style={{ color: tokens.text.primary }}>
                    {previewTemplate.subject}
                  </p>
                </div>
              </div>

              {/* Category & Usage */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: tokens.text.muted }}>
                    Category:
                  </span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      background: getCategoryConfig(previewTemplate.category).bg,
                      color: getCategoryConfig(previewTemplate.category).color,
                    }}
                  >
                    {getCategoryConfig(previewTemplate.category).label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: tokens.text.muted }}>
                    Used:
                  </span>
                  <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>
                    {previewTemplate.useCount} times
                  </span>
                </div>
              </div>

              {/* Body Preview */}
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: tokens.text.muted }}
                >
                  Email Body
                </label>
                <div
                  className="px-4 py-4 rounded-lg whitespace-pre-wrap font-mono text-sm leading-relaxed"
                  style={{
                    background: 'var(--ios-bg-card)',
                    border: `1px solid ${tokens.border.default}`,
                    color: tokens.text.secondary,
                  }}
                >
                  {previewTemplate.body}
                </div>
              </div>

              {/* Variables Used */}
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: tokens.text.muted }}
                >
                  Variables
                </label>
                <div className="flex flex-wrap gap-2">
                  {[...new Set(previewTemplate.body.match(/\{\{[^}]+\}\}/g) || [])].map(
                    (variable) => (
                      <span
                        key={variable}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono"
                        style={{
                          background: `${tokens.domain.reasoning}15`,
                          color: tokens.domain.reasoning,
                        }}
                      >
                        {variable}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-3 p-5"
              style={{ borderTop: `1px solid ${tokens.border.default}` }}
            >
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  border: `1px solid ${tokens.border.default}`,
                  color: tokens.text.secondary,
                }}
              >
                Close
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: tokens.accent.primary, color: tokens.text.inverse }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = tokens.accent.hover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = tokens.accent.primary;
                }}
              >
                <Copy className="w-4 h-4" /> Use Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
