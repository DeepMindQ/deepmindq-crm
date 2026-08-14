'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { toast } from 'sonner';
import {
  FileBarChart,
  BarChart3,
  Activity,
  Trophy,
  ShieldCheck,
  Bot,
  Globe,
  TrendingUp,
  Search,
  CalendarClock,
  Loader2,
} from 'lucide-react';

// ── Types ──

interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  lastGenerated: string | null;
  category: string;
}

// ── Mock Data ──

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'rpt-001',
    title: 'Weekly Intelligence Brief',
    description:
      'Comprehensive summary of intelligence signals, key account movements, and strategic insights from the past week.',
    icon: FileBarChart,
    color: tokens.accent.primary,
    lastGenerated: '2025-01-14',
    category: 'Intelligence',
  },
  {
    id: 'rpt-002',
    title: 'Pipeline Coverage',
    description:
      'Analysis of pipeline health, stage distribution, and coverage gaps across all active opportunities.',
    icon: BarChart3,
    color: '#059669',
    lastGenerated: '2025-01-13',
    category: 'Pipeline',
  },
  {
    id: 'rpt-003',
    title: 'Signal Activity',
    description:
      'Breakdown of detected signals by type, source, and severity with trend analysis over time.',
    icon: Activity,
    color: '#D97706',
    lastGenerated: '2025-01-15',
    category: 'Intelligence',
  },
  {
    id: 'rpt-004',
    title: 'Account Rankings',
    description:
      'Ranked list of target accounts based on intelligence score, engagement level, and opportunity fit.',
    icon: Trophy,
    color: '#7C3AED',
    lastGenerated: '2025-01-12',
    category: 'Accounts',
  },
  {
    id: 'rpt-005',
    title: 'Data Quality',
    description:
      'Assessment of data completeness, accuracy, and freshness across all account and contact records.',
    icon: ShieldCheck,
    color: '#DC2626',
    lastGenerated: '2025-01-10',
    category: 'Data',
  },
  {
    id: 'rpt-006',
    title: 'AI Usage',
    description:
      'Metrics on AI provider usage, token consumption, response quality, and cost analysis.',
    icon: Bot,
    color: '#0891B2',
    lastGenerated: '2025-01-15',
    category: 'AI',
  },
  {
    id: 'rpt-007',
    title: 'Competitive Landscape',
    description:
      'Intelligence on competitor activities, market positioning, and strategic moves in your target segments.',
    icon: Globe,
    color: '#4F46E5',
    lastGenerated: '2025-01-11',
    category: 'Intelligence',
  },
  {
    id: 'rpt-008',
    title: 'Revenue Forecast',
    description:
      'Predicted revenue based on pipeline data, historical win rates, and AI-powered opportunity scoring.',
    icon: TrendingUp,
    color: '#16A34A',
    lastGenerated: null,
    category: 'Revenue',
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(REPORT_TEMPLATES.map((r) => r.category)))];

// ── Component ──

export default function Reports() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...REPORT_TEMPLATES];
    if (categoryFilter !== 'All') result = result.filter((r) => r.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q),
      );
    }
    return result;
  }, [categoryFilter, searchQuery]);

  const handleGenerate = useCallback((report: ReportTemplate) => {
    setGeneratingId(report.id);
    setTimeout(() => {
      setGeneratingId(null);
      toast.success(`Report generation started: ${report.title}`);
    }, 1500);
  }, []);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  return (
    <div
      className="p-6 space-y-6"
      style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
            Reports
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Generate and schedule intelligence reports
          </p>
        </div>
      </div>

      {/* ── Search + Filter ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: textMuted }}
          />
          <input
            type="text"
            placeholder="Search reports…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'var(--ios-bg-card)',
              border: `1px solid ${border}`,
              color: textPrimary,
            }}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: categoryFilter === cat ? tokens.accent.primary : 'transparent',
                color: categoryFilter === cat ? tokens.flat.white : textSecondary,
                border: `1px solid ${categoryFilter === cat ? tokens.accent.primary : border}`,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Report Cards Grid ── */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: bg, border: `1px solid ${border}` }}
        >
          <FileBarChart className="w-10 h-10 mx-auto mb-3" style={{ color: textMuted }} />
          <p className="text-sm font-medium" style={{ color: textSecondary }}>
            No reports match your search
          </p>
          <button
            className="text-xs font-medium mt-2"
            style={{ color: tokens.accent.primary }}
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('All');
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((report) => {
            const Icon = report.icon;
            const isGenerating = generatingId === report.id;
            return (
              <div
                key={report.id}
                className="rounded-xl p-5 flex flex-col gap-4 transition-all hover:translate-y-[-1px]"
                style={{
                  background: bg,
                  border: `1px solid ${border}`,
                  boxShadow: elevation.sm,
                }}
              >
                {/* Icon + Category */}
                <div className="flex items-start justify-between">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${report.color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: report.color }} />
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-md font-medium"
                    style={{
                      background: tokens.surface.secondary,
                      color: textMuted,
                      border: `1px solid ${border}`,
                    }}
                  >
                    {report.category}
                  </span>
                </div>

                {/* Title + Description */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold mb-1.5" style={{ color: textPrimary }}>
                    {report.title}
                  </h3>
                  <p
                    className="text-xs leading-relaxed line-clamp-3"
                    style={{ color: textSecondary }}
                  >
                    {report.description}
                  </p>
                </div>

                {/* Last Generated */}
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" style={{ color: textMuted }} />
                  <span className="text-xs" style={{ color: textMuted }}>
                    {report.lastGenerated
                      ? `Last: ${new Date(report.lastGenerated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : 'Not yet generated'}
                  </span>
                </div>

                {/* Generate Button */}
                <button
                  className="w-full py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  style={{
                    background: isGenerating ? 'transparent' : report.color,
                    color: isGenerating ? textMuted : tokens.flat.white,
                    border: `1px solid ${isGenerating ? border : report.color}`,
                    opacity: isGenerating ? 0.7 : 1,
                  }}
                  onClick={() => handleGenerate(report)}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {isGenerating ? 'Generating…' : 'Generate Report'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
