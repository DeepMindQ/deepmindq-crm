'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { toast } from 'sonner';
import { LoadingSkeleton, ErrorPanel } from '@/components/ui/screen-states';
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
  icon: string; // icon key name from server — we map to component on the client
  color: string;
  lastGenerated: string | null;
  category: string;
}

// ── Icon mapping (maps server icon keys to Lucide components) ──

const ICON_MAP: Record<string, React.ElementType> = {
  FileBarChart,
  BarChart3,
  Activity,
  Trophy,
  ShieldCheck,
  Bot,
  Globe,
  TrendingUp,
};

function getIcon(iconKey: string): React.ElementType {
  return ICON_MAP[iconKey] || FileBarChart;
}

// ── Component ──

export default function Reports() {
  const [reports, setReports] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports');
      if (!res.ok) {
        throw new Error(`Failed to fetch reports (HTTP ${res.status})`);
      }
      const json = await res.json();
      setReports(json.data ?? json.reports ?? json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error loading reports'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(reports.map((r) => r.category)))],
    [reports],
  );

  const filtered = useMemo(() => {
    let result = [...reports];
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
  }, [reports, categoryFilter, searchQuery]);

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

  /* ── Error State ── */
  if (error) {
    return (
      <div className="p-6">
        <ErrorPanel
          error={error}
          message="Unable to load intelligence reports from the Intelligence OS server."
          onRetry={fetchReports}
        />
      </div>
    );
  }

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="p-6">
        <LoadingSkeleton variant="cards" count={8} />
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
          {categories.map((cat) => (
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
            {reports.length === 0 ? 'No reports configured yet' : 'No reports match your search'}
          </p>
          {(searchQuery || categoryFilter !== 'All') && (
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
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((report) => {
            const Icon = getIcon(report.icon);
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
