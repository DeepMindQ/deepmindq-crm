'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { tokens, getConfidenceTier } from '@/components/intelligence-os/design-tokens';
import { DataTable, type Column } from '@/components/enterprise/DataTable';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Inbox,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchApi } from '@/lib/fetchApi';

// ── Types ──
interface Insight {
  id: string;
  title: string;
  organization: string;
  category: 'opportunity' | 'risk' | 'recommendation' | 'pattern';
  confidence: number;
  status: 'active' | 'acted_upon' | 'dismissed' | 'expired';
  createdAt: string;
  narrative: string;
  recommendation: string;
  evidence: string[];
}

// ── Category Config ──
const CATEGORY_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  opportunity: {
    color: tokens.domain.opportunity,
    bg: '#ECFDF5',
    border: '#A7F3D0',
    label: 'Opportunity',
  },
  risk: {
    color: tokens.domain.risk,
    bg: tokens.confidence.low.bg,
    border: tokens.confidence.low.border,
    label: 'Risk',
  },
  recommendation: {
    color: tokens.domain.action,
    bg: tokens.accent.subtle,
    border: '#93C5FD',
    label: 'Recommendation',
  },
  pattern: {
    color: tokens.domain.reasoning,
    bg: tokens.domain.bg,
    border: tokens.domain.border,
    label: 'Pattern',
  },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: '#16A34A', bg: '#DCFCE7', label: 'Active' },
  acted_upon: { color: tokens.accent.primary, bg: tokens.accent.subtle, label: 'Acted Upon' },
  dismissed: { color: tokens.text.muted, bg: tokens.neutral['100'], label: 'Dismissed' },
  expired: { color: tokens.priority.medium, bg: tokens.gold.bgMedium, label: 'Expired' },
};

// ── Component ──
export default function IntelligenceInbox() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    async function loadInsights() {
      setIsLoading(true);
      const { data, error } = await fetchApi<Insight[]>('/api/team-activity');
      if (error) {
        toast.error('Failed to load intelligence inbox', { description: error });
      } else if (Array.isArray(data)) {
        setInsights(data);
      }
      setIsLoading(false);
    }
    loadInsights();
  }, []);

  // All hooks must be called before any conditional return (rules-of-hooks)
  const filteredInsights = useMemo(() => {
    return insights.filter((i) => {
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      return true;
    });
  }, [insights, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = insights.filter((i) => i.status === 'active');
    return {
      total: insights.length,
      opportunities: insights.filter((i) => i.category === 'opportunity').length,
      risks: insights.filter((i) => i.category === 'risk').length,
      avgConfidence:
        insights.length > 0
          ? Math.round(insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length)
          : 0,
      activeCount: active.length,
    };
  }, [insights]);

  const handleRowClick = useCallback(
    (row: Record<string, unknown>) => {
      const insight = insights.find((i) => i.id === row.id);
      if (insight) {
        setSelectedInsight(insight);
        setSlideOpen(true);
      }
    },
    [insights],
  );

  const handleActOnInsight = useCallback((id: string) => {
    setInsights((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'acted_upon' as const } : i)),
    );
    setSelectedInsight((prev) => (prev ? { ...prev, status: 'acted_upon' } : null));
    toast.success('Insight marked as acted upon');
  }, []);

  const columns: Column[] = useMemo(
    () => [
      {
        key: 'title',
        label: 'Insight Title',
        sortable: true,
        render: (_, row) => (
          <span className="font-medium" style={{ color: tokens.text.primary }}>
            {row.title as string}
          </span>
        ),
      },
      {
        key: 'organization',
        label: 'Organization',
        sortable: true,
        render: (_, row) => (
          <span style={{ color: tokens.text.secondary }}>{row.organization as string}</span>
        ),
      },
      {
        key: 'category',
        label: 'Category',
        sortable: true,
        render: (_, row) => {
          const cat = row.category as string;
          const config = CATEGORY_CONFIG[cat];
          return config ? (
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                color: config.color,
                background: config.bg,
                border: `1px solid ${config.border}`,
              }}
            >
              {config.label}
            </span>
          ) : null;
        },
      },
      {
        key: 'confidence',
        label: 'Confidence',
        sortable: true,
        render: (_, row) => {
          const score = row.confidence as number;
          const tier = getConfidenceTier(score);
          return (
            <div className="flex items-center gap-2 min-w-[120px]">
              <div
                className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ background: tokens.border.default }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${score}%`,
                    background: tier.color,
                  }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums" style={{ color: tier.color }}>
                {score}%
              </span>
            </div>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (_, row) => {
          const status = row.status as string;
          const config = STATUS_CONFIG[status];
          return config ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                color: config.color,
                background: config.bg,
              }}
            >
              {status === 'acted_upon' && <CheckCircle2 className="h-3 w-3" />}
              {config.label}
            </span>
          ) : null;
        },
      },
      {
        key: 'createdAt',
        label: 'Created',
        sortable: true,
        render: (_, row) => {
          const d = new Date(row.createdAt as string);
          return (
            <span className="text-xs" style={{ color: tokens.text.muted }}>
              {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          );
        },
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-lg animate-pulse"
            style={{ background: tokens.border.default }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold flex items-center gap-2"
            style={{ color: tokens.text.primary }}
          >
            <Inbox className="h-6 w-6" style={{ color: tokens.accent.primary }} />
            Intelligence Inbox
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            AI-generated insights and actionable intelligence
          </p>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Insights',
            value: stats.total,
            icon: Inbox,
            color: tokens.accent.primary,
            bg: tokens.accent.ghost,
          },
          {
            label: 'Opportunities',
            value: stats.opportunities,
            icon: TrendingUp,
            color: tokens.domain.opportunity,
            bg: '#ECFDF5',
          },
          {
            label: 'Risks',
            value: stats.risks,
            icon: AlertTriangle,
            color: tokens.domain.risk,
            bg: tokens.confidence.low.bg,
          },
          {
            label: 'Avg Confidence',
            value: `${stats.avgConfidence}%`,
            icon: BarChart3,
            color: tokens.domain.reasoning,
            bg: tokens.domain.bg,
            isText: true,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4"
            style={{
              background: tokens.surface.card,
              border: `1px solid ${tokens.border.default}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: tokens.text.muted }}
                >
                  {stat.label}
                </p>
                <p
                  className="text-2xl font-bold mt-1 tabular-nums"
                  style={{ color: tokens.text.primary }}
                >
                  {stat.isText ? stat.value : (stat.value as number)}
                </p>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: stat.bg }}>
                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: tokens.text.muted }} />
          <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
            Filters:
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filters */}
          {['all', 'opportunity', 'risk', 'recommendation', 'pattern'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background:
                  categoryFilter === cat ? tokens.accent.primary : tokens.surface.secondary,
                color: categoryFilter === cat ? tokens.flat.white : tokens.text.secondary,
                border: `1px solid ${categoryFilter === cat ? tokens.accent.primary : tokens.border.default}`,
              }}
            >
              {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
          <div className="w-px h-6" style={{ background: tokens.border.default }} />
          {/* Status Filters */}
          {['all', 'active', 'acted_upon', 'dismissed', 'expired'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: statusFilter === st ? tokens.accent.primary : tokens.surface.secondary,
                color: statusFilter === st ? tokens.flat.white : tokens.text.secondary,
                border: `1px solid ${statusFilter === st ? tokens.accent.primary : tokens.border.default}`,
              }}
            >
              {st === 'all'
                ? 'All Statuses'
                : st.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={filteredInsights.map((i) => ({
          id: i.id,
          title: i.title,
          organization: i.organization,
          category: i.category,
          confidence: i.confidence,
          status: i.status,
          createdAt: i.createdAt,
        }))}
        onRowClick={handleRowClick}
        emptyMessage="No insights match the selected filters"
        filterable
        filterPlaceholder="Search insights..."
        exportable
        exportFilename="intelligence-inbox"
      />

      {/* ── Slide-over Detail ── */}
      <Sheet open={slideOpen} onOpenChange={setSlideOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
          style={{
            background: tokens.surface.primary,
            borderLeft: `1px solid ${tokens.border.default}`,
          }}
        >
          {selectedInsight && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      color: CATEGORY_CONFIG[selectedInsight.category].color,
                      background: CATEGORY_CONFIG[selectedInsight.category].bg,
                      border: `1px solid ${CATEGORY_CONFIG[selectedInsight.category].border}`,
                    }}
                  >
                    {CATEGORY_CONFIG[selectedInsight.category].label}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      color: STATUS_CONFIG[selectedInsight.status].color,
                      background: STATUS_CONFIG[selectedInsight.status].bg,
                    }}
                  >
                    {STATUS_CONFIG[selectedInsight.status].label}
                  </span>
                </div>
                <SheetTitle className="text-lg leading-snug" style={{ color: tokens.text.primary }}>
                  {selectedInsight.title}
                </SheetTitle>
                <SheetDescription style={{ color: tokens.text.secondary }}>
                  {selectedInsight.organization} • Confidence: {selectedInsight.confidence}%
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-6 px-4 pb-6">
                {/* Confidence Bar */}
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-2"
                    style={{ color: tokens.text.muted }}
                  >
                    Confidence Score
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex-1 h-3 rounded-full overflow-hidden"
                      style={{ background: tokens.border.default }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${selectedInsight.confidence}%`,
                          background: getConfidenceTier(selectedInsight.confidence).color,
                        }}
                      />
                    </div>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: getConfidenceTier(selectedInsight.confidence).color }}
                    >
                      {selectedInsight.confidence}%
                    </span>
                  </div>
                </div>

                {/* Narrative */}
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5"
                    style={{ color: tokens.text.muted }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Narrative
                  </p>
                  <div
                    className="rounded-lg p-4 text-sm leading-relaxed"
                    style={{
                      background: tokens.surface.secondary,
                      color: tokens.text.primary,
                      border: `1px solid ${tokens.border.default}`,
                    }}
                  >
                    {selectedInsight.narrative}
                  </div>
                </div>

                {/* Recommendation */}
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-2"
                    style={{ color: tokens.text.muted }}
                  >
                    Recommendation
                  </p>
                  <div
                    className="rounded-lg p-4 text-sm leading-relaxed"
                    style={{
                      background: tokens.accent.ghost,
                      color: tokens.text.primary,
                      border: `1px solid ${tokens.accent.subtle}`,
                    }}
                  >
                    {selectedInsight.recommendation}
                  </div>
                </div>

                {/* Evidence */}
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-2"
                    style={{ color: tokens.text.muted }}
                  >
                    Supporting Evidence
                  </p>
                  <div className="space-y-1.5">
                    {selectedInsight.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-sm"
                        style={{ color: tokens.text.secondary }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: tokens.accent.dim }}
                        />
                        {ev}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metadata */}
                <div
                  className="flex items-center gap-4 text-xs"
                  style={{ color: tokens.text.muted }}
                >
                  <span>ID: {selectedInsight.id}</span>
                  <span>•</span>
                  <span>{new Date(selectedInsight.createdAt).toLocaleString()}</span>
                </div>

                {/* Action Button */}
                {selectedInsight.status === 'active' && (
                  <Button
                    onClick={() => handleActOnInsight(selectedInsight.id)}
                    className="w-full"
                    style={{
                      background: tokens.accent.primary,
                      color: tokens.flat.white,
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Act on This Insight
                  </Button>
                )}
                {selectedInsight.status === 'acted_upon' && (
                  <div
                    className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium"
                    style={{
                      background: '#DCFCE7',
                      color: '#16A34A',
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Insight has been acted upon
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
