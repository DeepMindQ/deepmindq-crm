'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Plus, X, Building2, Target, Layers, Tag } from 'lucide-react';

/* ═══ Types ═══ */

interface Segment {
  id: string;
  name: string;
  description: string;
  companyCount: number;
  avgIntelScore: number;
  criteria: SegmentCriterion[];
  lastUpdated: string;
}

interface SegmentCriterion {
  field: string;
  operator: string;
  value: string;
}

/* ═══ Mock Data ═══ */

const MOCK_SEGMENTS: Segment[] = [
  {
    id: 'seg-1',
    name: 'Enterprise SaaS',
    description: 'Large SaaS companies with 500+ employees and high intelligence scores.',
    companyCount: 47,
    avgIntelScore: 82,
    criteria: [
      { field: 'industry', operator: 'equals', value: 'SaaS' },
      { field: 'employeeCount', operator: 'greater_than', value: '500' },
      { field: 'intelligenceScore', operator: 'greater_than', value: '70' },
    ],
    lastUpdated: '2025-01-15T10:00:00Z',
  },
  {
    id: 'seg-2',
    name: 'Mid-Market FinTech',
    description: 'Mid-size financial technology companies showing growth signals.',
    companyCount: 63,
    avgIntelScore: 74,
    criteria: [
      { field: 'industry', operator: 'equals', value: 'FinTech' },
      { field: 'employeeCount', operator: 'between', value: '100-500' },
      { field: 'intelligenceScore', operator: 'greater_than', value: '60' },
    ],
    lastUpdated: '2025-01-14T15:30:00Z',
  },
  {
    id: 'seg-3',
    name: 'Healthcare IT',
    description: 'Healthcare technology companies with compliance focus and expansion signals.',
    companyCount: 38,
    avgIntelScore: 68,
    criteria: [
      { field: 'industry', operator: 'equals', value: 'Healthcare IT' },
      { field: 'intelligenceScore', operator: 'greater_than', value: '50' },
    ],
    lastUpdated: '2025-01-13T09:15:00Z',
  },
  {
    id: 'seg-4',
    name: 'High-Intent Buyers',
    description: 'Companies with recent buying signals and high engagement scores.',
    companyCount: 24,
    avgIntelScore: 91,
    criteria: [
      { field: 'intelligenceScore', operator: 'greater_than', value: '85' },
      { field: 'signalCount', operator: 'greater_than', value: '5' },
      { field: 'trackingStatus', operator: 'equals', value: 'active' },
    ],
    lastUpdated: '2025-01-15T14:00:00Z',
  },
  {
    id: 'seg-5',
    name: 'Series B+ Startups',
    description: 'Well-funded startups that have reached Series B or later funding rounds.',
    companyCount: 55,
    avgIntelScore: 72,
    criteria: [
      { field: 'fundingStage', operator: 'in', value: 'Series B, Series C, Series D+' },
      { field: 'employeeCount', operator: 'greater_than', value: '50' },
    ],
    lastUpdated: '2025-01-12T11:45:00Z',
  },
  {
    id: 'seg-6',
    name: 'At-Risk Accounts',
    description: 'Existing accounts with declining engagement or negative signals.',
    companyCount: 12,
    avgIntelScore: 35,
    criteria: [
      { field: 'intelligenceScore', operator: 'less_than', value: '40' },
      { field: 'trackingStatus', operator: 'equals', value: 'paused' },
    ],
    lastUpdated: '2025-01-16T08:30:00Z',
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

function getScoreColor(score: number): { color: string; bg: string } {
  if (score >= 80) return { color: tokens.confidence.high.value, bg: tokens.confidence.high.bg };
  if (score >= 50)
    return { color: tokens.confidence.medium.value, bg: tokens.confidence.medium.bg };
  return { color: tokens.confidence.low.value, bg: tokens.confidence.low.bg };
}

function getCriterionColor(field: string): string {
  switch (field) {
    case 'industry':
      return tokens.domain.reasoning;
    case 'employeeCount':
    case 'fundingStage':
      return tokens.accent.primary;
    case 'intelligenceScore':
      return tokens.domain.opportunity;
    case 'signalCount':
      return tokens.confidence.medium.value;
    case 'trackingStatus':
      return tokens.domain.risk;
    default:
      return tokens.text.muted;
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
  icon: typeof PieChart;
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

/* ═══ Main Component ═══ */

export default function Segments() {
  const [segments, setSegments] = useState<Segment[]>(MOCK_SEGMENTS);
  const [loading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ── Create modal state ──
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCriteria, setNewCriteria] = useState<SegmentCriterion[]>([
    { field: 'industry', operator: 'equals', value: '' },
  ]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = segments.length;
    const totalCompanies = segments.reduce((sum, s) => sum + s.companyCount, 0);
    const avgScore =
      segments.length > 0
        ? Math.round(segments.reduce((sum, s) => sum + s.avgIntelScore, 0) / segments.length)
        : 0;
    return { total, totalCompanies, avgScore };
  }, [segments]);

  const addCriterion = useCallback(() => {
    setNewCriteria((prev) => [...prev, { field: 'industry', operator: 'equals', value: '' }]);
  }, []);

  const removeCriterion = useCallback((idx: number) => {
    setNewCriteria((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateCriterion = useCallback(
    (idx: number, field: keyof SegmentCriterion, value: string) => {
      setNewCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
    },
    [],
  );

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    const seg: Segment = {
      id: `seg-${Date.now()}`,
      name: newName.trim(),
      description: newDescription.trim() || 'No description provided.',
      companyCount: 0,
      avgIntelScore: 0,
      criteria: newCriteria,
      lastUpdated: new Date().toISOString(),
    };
    setSegments((prev) => [seg, ...prev]);
    setShowCreateModal(false);
    setNewName('');
    setNewDescription('');
    setNewCriteria([{ field: 'industry', operator: 'equals', value: '' }]);
  }, [newName, newDescription, newCriteria]);

  const FIELD_OPTIONS = [
    { value: 'industry', label: 'Industry' },
    { value: 'employeeCount', label: 'Employee Count' },
    { value: 'intelligenceScore', label: 'Intelligence Score' },
    { value: 'fundingStage', label: 'Funding Stage' },
    { value: 'signalCount', label: 'Signal Count' },
    { value: 'trackingStatus', label: 'Tracking Status' },
  ];

  const OPERATOR_OPTIONS = [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'greater_than', label: 'greater than' },
    { value: 'less_than', label: 'less than' },
    { value: 'between', label: 'between' },
    { value: 'in', label: 'in' },
  ];

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Segments
          </h1>
          <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>
            Manage customer segments and Ideal Customer Profiles (ICPs)
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
          Create Segment
        </button>
      </div>

      {/* ── Stats ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={Layers}
            label="Total Segments"
            value={stats.total}
            accent={tokens.accent.primary}
          />
          <StatCard
            icon={Building2}
            label="Total Companies"
            value={stats.totalCompanies.toLocaleString()}
            accent={tokens.domain.reasoning}
            sub="Across all segments"
          />
          <StatCard
            icon={Target}
            label="Avg Match Score"
            value={stats.avgScore}
            accent={tokens.domain.opportunity}
            sub="Weighted by company count"
          />
        </div>
      )}

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
                className="h-5 w-32 mb-2 rounded"
                style={{ background: tokens.border.default }}
              />
              <Skeleton
                className="h-3 w-full mb-1 rounded"
                style={{ background: tokens.border.default }}
              />
              <Skeleton
                className="h-3 w-3/4 mb-4 rounded"
                style={{ background: tokens.border.default }}
              />
              <div className="flex gap-2 mb-4">
                <Skeleton
                  className="h-6 w-16 rounded-full"
                  style={{ background: tokens.border.default }}
                />
                <Skeleton
                  className="h-6 w-16 rounded-full"
                  style={{ background: tokens.border.default }}
                />
              </div>
              <div className="flex gap-4">
                <Skeleton
                  className="h-10 w-20 rounded-lg"
                  style={{ background: tokens.border.default }}
                />
                <Skeleton
                  className="h-10 w-20 rounded-lg"
                  style={{ background: tokens.border.default }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && segments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: `${tokens.accent.primary}12` }}
          >
            <PieChart className="w-8 h-8" style={{ color: tokens.accent.primary }} />
          </div>
          <h3 className="text-base font-semibold mb-1.5" style={{ color: tokens.text.primary }}>
            No segments yet
          </h3>
          <p className="text-sm text-center max-w-sm mb-6" style={{ color: tokens.text.secondary }}>
            Create your first customer segment to start organizing accounts by criteria.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: tokens.accent.primary, color: tokens.text.inverse }}
          >
            <Plus className="w-4 h-4" /> Create Segment
          </button>
        </div>
      )}

      {/* ── Segment Grid ── */}
      {!loading && segments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((seg) => {
            const scoreColor = getScoreColor(seg.avgIntelScore);
            return (
              <div
                key={seg.id}
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
                      style={{
                        background: `${tokens.domain.reasoning}15`,
                        color: tokens.domain.reasoning,
                      }}
                    >
                      <PieChart className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3
                        className="text-sm font-semibold truncate"
                        style={{ color: tokens.text.primary }}
                      >
                        {seg.name}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
                        Updated {formatRelativeDate(seg.lastUpdated)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p
                  className="text-xs leading-relaxed line-clamp-2"
                  style={{ color: tokens.text.secondary }}
                >
                  {seg.description}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg" style={{ background: tokens.surfaceExtended }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: tokens.text.muted }}
                      >
                        Companies
                      </span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                      {seg.companyCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: tokens.surfaceExtended }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: tokens.text.muted }}
                      >
                        Avg Score
                      </span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: scoreColor.color }}>
                      {seg.avgIntelScore}
                    </p>
                  </div>
                </div>

                {/* Criteria Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {seg.criteria.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
                      style={{
                        background: `${getCriterionColor(c.field)}15`,
                        color: getCriterionColor(c.field),
                      }}
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {c.field} {c.operator} {c.value}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Segment Modal ── */}
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
                  style={{
                    background: `${tokens.domain.reasoning}15`,
                    color: tokens.domain.reasoning,
                  }}
                >
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                    New Segment
                  </h2>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>
                    Define criteria for your customer segment
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
                  Segment Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Enterprise SaaS"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    background: 'var(--ios-bg-card)',
                    border: `1px solid ${tokens.border.default}`,
                    color: tokens.text.primary,
                  }}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe the segment's purpose and target audience..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors resize-none"
                  style={{
                    background: 'var(--ios-bg-card)',
                    border: `1px solid ${tokens.border.default}`,
                    color: tokens.text.primary,
                  }}
                />
              </div>

              {/* Criteria Builder */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                    Criteria
                  </label>
                  <button
                    onClick={addCriterion}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                    style={{
                      color: tokens.accent.primary,
                      border: `1px solid ${tokens.accent.primary}30`,
                    }}
                  >
                    <Plus className="w-3 h-3" /> Add Criterion
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {newCriteria.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-3 rounded-lg"
                      style={{
                        background: tokens.surfaceExtended,
                        border: `1px solid ${tokens.border.default}`,
                      }}
                    >
                      <select
                        value={c.field}
                        onChange={(e) => updateCriterion(idx, 'field', e.target.value)}
                        className="flex-1 px-2 py-1.5 rounded-md text-xs outline-none"
                        style={{
                          background: tokens.surface.card,
                          border: `1px solid ${tokens.border.default}`,
                          color: tokens.text.primary,
                        }}
                      >
                        {FIELD_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={c.operator}
                        onChange={(e) => updateCriterion(idx, 'operator', e.target.value)}
                        className="flex-1 px-2 py-1.5 rounded-md text-xs outline-none"
                        style={{
                          background: tokens.surface.card,
                          border: `1px solid ${tokens.border.default}`,
                          color: tokens.text.primary,
                        }}
                      >
                        {OPERATOR_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={c.value}
                        onChange={(e) => updateCriterion(idx, 'value', e.target.value)}
                        placeholder="Value"
                        className="flex-1 px-2 py-1.5 rounded-md text-xs outline-none"
                        style={{
                          background: tokens.surface.card,
                          border: `1px solid ${tokens.border.default}`,
                          color: tokens.text.primary,
                        }}
                      />
                      {newCriteria.length > 1 && (
                        <button
                          onClick={() => removeCriterion(idx)}
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
                Create Segment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
