'use client';

import { useState, useMemo } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { DataTable, type Column } from '@/components/enterprise/DataTable';
import { Eye } from 'lucide-react';

// ── Types ──
interface IntelItem {
  id: string;
  title: string;
  category: 'competitive' | 'deal' | 'product' | 'market';
  author: string;
  confidentiality: 'public' | 'team' | 'restricted';
  created: string;
  views: number;
}

type CategoryFilter = 'all' | 'competitive' | 'deal' | 'product' | 'market';

// ── Mock Data ──
const MOCK_INTEL: IntelItem[] = [
  { id: 'ii1', title: 'Salesforce shifting to AI-first pricing model', category: 'competitive', author: 'Sarah Chen', confidentiality: 'team', created: '2025-01-22', views: 47 },
  { id: 'ii2', title: 'Acme Corp deal: champion just got promoted to VP', category: 'deal', author: 'James Wilson', confidentiality: 'team', created: '2025-01-22', views: 31 },
  { id: 'ii3', title: 'New competitor: VelocityAI entering mid-market', category: 'competitive', author: 'Maria Garcia', confidentiality: 'public', created: '2025-01-21', views: 89 },
  { id: 'ii4', title: 'Product roadmap: AI advisor v2 features finalized', category: 'product', author: 'David Kim', confidentiality: 'team', created: '2025-01-21', views: 62 },
  { id: 'ii5', title: 'Market trend: PLG overtaking SLG in SaaS', category: 'market', author: 'Emily Zhang', confidentiality: 'public', created: '2025-01-20', views: 124 },
  { id: 'ii6', title: 'HubSpot adding native AI scoring — threat level high', category: 'competitive', author: 'Michael Brown', confidentiality: 'restricted', created: '2025-01-20', views: 18 },
  { id: 'ii7', title: 'Vertex AI deal: procurement starting next week', category: 'deal', author: 'Priya Patel', confidentiality: 'team', created: '2025-01-19', views: 23 },
  { id: 'ii8', title: 'Enterprise dashboard redesign — user testing results', category: 'product', author: 'Alex Rivera', confidentiality: 'team', created: '2025-01-19', views: 56 },
  { id: 'ii9', title: 'Healthcare IT compliance changes for 2025', category: 'market', author: 'Rachel Thompson', confidentiality: 'public', created: '2025-01-18', views: 73 },
  { id: 'ii10', title: 'Revenue intel: Q4 close rates by segment', category: 'deal', author: 'Kevin O\'Brien', confidentiality: 'restricted', created: '2025-01-18', views: 12 },
];

const CATEGORY_CONFIG: Record<IntelItem['category'], { label: string; color: string; bg: string }> = {
  competitive: { label: 'Competitive', color: '#DC2626', bg: '#FEE2E2' },
  deal: { label: 'Deal', color: '#16A34A', bg: '#DCFCE7' },
  product: { label: 'Product', color: '#2563EB', bg: '#DBEAFE' },
  market: { label: 'Market', color: '#7C3AED', bg: '#EDE9FE' },
};

const CONFIDENTIALITY_CONFIG: Record<IntelItem['confidentiality'], { label: string; color: string; bg: string }> = {
  public: { label: 'Public', color: '#16A34A', bg: '#DCFCE7' },
  team: { label: 'Team', color: '#2563EB', bg: '#DBEAFE' },
  restricted: { label: 'Restricted', color: '#DC2626', bg: '#FEE2E2' },
};

// ── Component ──
export default function InternalIntelligence() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [loading] = useState(false);

  const filteredData = useMemo(() => {
    if (categoryFilter === 'all') return MOCK_INTEL;
    return MOCK_INTEL.filter((i) => i.category === categoryFilter);
  }, [categoryFilter]);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  const columns: Column[] = useMemo(
    () => [
      { key: 'title', label: 'Title', sortable: true },
      {
        key: 'category',
        label: 'Category',
        sortable: true,
        render: (value: unknown) => {
          const cat = value as IntelItem['category'];
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
          );
        },
      },
      { key: 'author', label: 'Author', sortable: true },
      {
        key: 'confidentiality',
        label: 'Visibility',
        render: (value: unknown) => {
          const conf = value as IntelItem['confidentiality'];
          const cfg = CONFIDENTIALITY_CONFIG[conf];
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
          );
        },
      },
      { key: 'created', label: 'Created', sortable: true },
      {
        key: 'views',
        label: 'Views',
        sortable: true,
        render: (value: unknown) => (
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: textSecondary }}>
            <Eye className="w-3 h-3" style={{ color: textMuted }} />
            {value as number}
          </span>
        ),
      },
    ],
    [textMuted, textSecondary]
  );

  const categoryFilters: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'competitive', label: 'Competitive' },
    { key: 'deal', label: 'Deal' },
    { key: 'product', label: 'Product' },
    { key: 'market', label: 'Market' },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6" style={{ background: '#0a0e17', minHeight: '100%' }}>
        <div className="h-96 rounded-xl animate-pulse" style={{ background: border }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#0a0e17', minHeight: '100%' }}>
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: textPrimary }}>Internal Intelligence</h1>
        <p className="text-sm mt-1" style={{ color: textSecondary }}>Team-shared notes, competitive intel, and deal insights</p>
      </div>

      {/* ── Category Filters ── */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg w-fit" style={{ background: tokens.surface.secondary, border: `1px solid ${border}` }}>
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

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={filteredData as unknown as Record<string, unknown>[]}
        filterable
        filterPlaceholder="Search intelligence..."
        exportable
        exportFilename="internal-intelligence"
        emptyMessage="No intelligence items found"
      />
    </div>
  );
}
