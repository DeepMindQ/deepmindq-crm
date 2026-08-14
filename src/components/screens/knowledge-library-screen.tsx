'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { BookOpen, FileText, BarChart3, Plus, Eye, User, Search } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──
interface KnowledgeItem {
  id: string;
  title: string;
  category: 'industry' | 'product' | 'competitor' | 'general';
  type: 'article' | 'report' | 'playbook';
  author: string;
  created: string;
  usageCount: number;
  description: string;
}

type CategoryFilter = 'all' | 'industry' | 'product' | 'competitor' | 'general';

// ── Mock Data ──
const MOCK_KNOWLEDGE: KnowledgeItem[] = [
  {
    id: 'k1',
    title: 'SaaS Industry Trends 2025',
    category: 'industry',
    type: 'report',
    author: 'Sarah Chen',
    created: '2025-01-18',
    usageCount: 342,
    description:
      'Comprehensive analysis of SaaS market trends, growth drivers, and emerging opportunities.',
  },
  {
    id: 'k2',
    title: 'Competitive Battlecard: Salesforce',
    category: 'competitor',
    type: 'playbook',
    author: 'James Wilson',
    created: '2025-01-15',
    usageCount: 528,
    description: 'Detailed competitive analysis and positioning guide against Salesforce CRM.',
  },
  {
    id: 'k3',
    title: 'Product Feature Deep Dive: AI Scoring',
    category: 'product',
    type: 'article',
    author: 'Maria Garcia',
    created: '2025-01-20',
    usageCount: 189,
    description: 'Technical overview of the AI-powered lead scoring engine and its methodology.',
  },
  {
    id: 'k4',
    title: 'Enterprise Sales Playbook',
    category: 'general',
    type: 'playbook',
    author: 'David Kim',
    created: '2025-01-12',
    usageCount: 674,
    description:
      'End-to-end playbook for selling into enterprise accounts with multi-threaded outreach.',
  },
  {
    id: 'k5',
    title: 'Fintech Sector Analysis Q4',
    category: 'industry',
    type: 'report',
    author: 'Emily Zhang',
    created: '2025-01-08',
    usageCount: 231,
    description: 'Quarterly analysis of fintech market dynamics, funding trends, and key players.',
  },
  {
    id: 'k6',
    title: 'Competitive Battlecard: HubSpot',
    category: 'competitor',
    type: 'playbook',
    author: 'Michael Brown',
    created: '2025-01-10',
    usageCount: 445,
    description: 'Competitive positioning and objection handling guide for HubSpot comparisons.',
  },
  {
    id: 'k7',
    title: 'Onboarding Best Practices',
    category: 'product',
    type: 'article',
    author: 'Priya Patel',
    created: '2025-01-22',
    usageCount: 98,
    description: 'Best practices for customer onboarding workflows and time-to-value optimization.',
  },
  {
    id: 'k8',
    title: 'Healthcare IT Market Overview',
    category: 'industry',
    type: 'report',
    author: 'Alex Rivera',
    created: '2025-01-05',
    usageCount: 167,
    description: 'Overview of healthcare IT spending, regulations, and technology adoption trends.',
  },
];

const CATEGORY_CONFIG: Record<
  KnowledgeItem['category'],
  { label: string; color: string; bg: string }
> = {
  industry: { label: 'Industry', color: '#7C3AED', bg: '#EDE9FE' },
  product: { label: 'Product', color: '#059669', bg: '#D1FAE5' },
  competitor: { label: 'Competitor', color: '#DC2626', bg: '#FEE2E2' },
  general: { label: 'General', color: '#2563EB', bg: '#DBEAFE' },
};

const TYPE_ICONS: Record<KnowledgeItem['type'], typeof FileText> = {
  article: FileText,
  report: BarChart3,
  playbook: BookOpen,
};

// ── Component ──
export default function KnowledgeLibrary() {
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  const filteredData = useMemo(() => {
    let items = MOCK_KNOWLEDGE;
    if (categoryFilter !== 'all') {
      items = items.filter((k) => k.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (k) =>
          k.title.toLowerCase().includes(q) ||
          k.description.toLowerCase().includes(q) ||
          k.author.toLowerCase().includes(q),
      );
    }
    return items;
  }, [categoryFilter, search]);

  const handleAdd = useCallback(() => {
    toast.info('Knowledge creation dialog would open here');
  }, []);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  const categoryFilters: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'industry', label: 'Industry' },
    { key: 'product', label: 'Product' },
    { key: 'competitor', label: 'Competitor' },
    { key: 'general', label: 'General' },
  ];

  if (isLoading) {
    return (
      <div
        className="p-6 space-y-6"
        style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: border }} />
          ))}
        </div>
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
            Knowledge Library
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Articles, reports, and playbooks for your team
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors hover:opacity-90"
          style={{ background: tokens.accent.primary, color: tokens.flat.white }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Knowledge
        </button>
      </div>

      {/* ── Search + Category Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: textMuted }}
          />
          <input
            type="text"
            placeholder="Search knowledge..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg text-xs"
            style={{
              background: 'var(--ios-bg-card)',
              border: `1px solid ${border}`,
              color: textPrimary,
            }}
          />
        </div>
        <div
          className="flex items-center gap-1.5 p-1 rounded-lg"
          style={{ background: tokens.surface.secondary, border: `1px solid ${border}` }}
        >
          {categoryFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setCategoryFilter(f.key)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: categoryFilter === f.key ? tokens.accent.primary : 'transparent',
                color: categoryFilter === f.key ? tokens.flat.white : textSecondary,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Knowledge Grid ── */}
      {filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <BookOpen className="h-10 w-10 mb-3" style={{ color: textMuted }} />
          <p className="text-sm font-medium" style={{ color: textSecondary }}>
            No knowledge items found
          </p>
          <p className="text-xs mt-1" style={{ color: textMuted }}>
            Try adjusting your search or filter
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredData.map((item) => {
            const catCfg = CATEGORY_CONFIG[item.category];
            const TypeIcon = TYPE_ICONS[item.type];
            return (
              <div
                key={item.id}
                className="rounded-xl p-4 flex flex-col gap-3 transition-colors cursor-pointer"
                style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = tokens.accent.dim;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = border;
                }}
              >
                {/* Top row: type icon + category badge */}
                <div className="flex items-center justify-between">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${tokens.accent.primary}15` }}
                  >
                    <TypeIcon className="w-4 h-4" style={{ color: tokens.accent.primary }} />
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: catCfg.bg, color: catCfg.color }}
                  >
                    {catCfg.label}
                  </span>
                </div>

                {/* Title + Description */}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                    {item.title}
                  </h3>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: textMuted }}>
                    {item.description}
                  </p>
                </div>

                {/* Footer: author, type, usage */}
                <div
                  className="flex items-center justify-between mt-auto pt-2"
                  style={{ borderTop: `1px solid ${border}` }}
                >
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3" style={{ color: textMuted }} />
                    <span className="text-xs" style={{ color: textSecondary }}>
                      {item.author}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3 h-3" style={{ color: textMuted }} />
                    <span className="text-xs" style={{ color: textSecondary }}>
                      {item.usageCount}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
