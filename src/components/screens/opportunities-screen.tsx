'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens, spacing, radius, typography, elevation } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  Target,
  Percent,
  CalendarDays,
  User,
  X,
  Building2,
  Clock,
  BarChart3,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// ── Types ──

type Stage = 'Prospecting' | 'Qualification' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';

interface Opportunity {
  id: string;
  company: string;
  dealName: string;
  value: number;
  stage: Stage;
  probability: number;
  closeDate: string;
  owner: string;
  createdAt: string;
  description: string;
  industry: string;
}

const STAGES: Stage[] = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

const STAGE_COLORS: Record<Stage, { bg: string; text: string; border: string }> = {
  Prospecting: { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  Qualification: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  Proposal: { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' },
  Negotiation: { bg: '#FCE7F3', text: '#9D174D', border: '#FBCFE8' },
  'Closed Won': { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
  'Closed Lost': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
};

// ── Mock Data ──

const MOCK_OPPORTUNITIES: Opportunity[] = [
  { id: 'opp-001', company: 'Acme Corp', dealName: 'Enterprise Platform License', value: 285000, stage: 'Proposal', probability: 60, closeDate: '2025-02-15', owner: 'Sarah Chen', createdAt: '2024-10-01', description: 'Full enterprise license for 500+ seats with premium support.', industry: 'Technology' },
  { id: 'opp-002', company: 'GlobalTech Industries', dealName: 'Data Analytics Suite', value: 142000, stage: 'Negotiation', probability: 75, closeDate: '2025-01-28', owner: 'Marcus Johnson', createdAt: '2024-09-15', description: 'Custom analytics dashboard with API integrations.', industry: 'Manufacturing' },
  { id: 'opp-003', company: 'NovaStar Finance', dealName: 'Risk Management Module', value: 398000, stage: 'Qualification', probability: 35, closeDate: '2025-03-20', owner: 'Emily Rodriguez', createdAt: '2024-11-10', description: 'AI-powered risk assessment and compliance module.', industry: 'Finance' },
  { id: 'opp-004', company: 'Pinnacle Healthcare', dealName: 'Patient Intelligence System', value: 520000, stage: 'Proposal', probability: 55, closeDate: '2025-02-28', owner: 'Sarah Chen', createdAt: '2024-08-22', description: 'Comprehensive patient data analytics and prediction platform.', industry: 'Healthcare' },
  { id: 'opp-005', company: 'Vertex Dynamics', dealName: 'Supply Chain Optimizer', value: 178000, stage: 'Closed Won', probability: 100, closeDate: '2025-01-05', owner: 'James Park', createdAt: '2024-07-14', description: 'End-to-end supply chain visibility and optimization tool.', industry: 'Logistics' },
  { id: 'opp-006', company: 'Eclipse Media Group', dealName: 'Content Intelligence', value: 95000, stage: 'Prospecting', probability: 15, closeDate: '2025-04-10', owner: 'Lisa Wang', createdAt: '2024-12-01', description: 'AI-driven content performance analytics and recommendations.', industry: 'Media' },
  { id: 'opp-007', company: 'Ironclad Security', dealName: 'Threat Detection Platform', value: 445000, stage: 'Negotiation', probability: 80, closeDate: '2025-01-20', owner: 'Marcus Johnson', createdAt: '2024-09-28', description: 'Real-time threat detection and automated response system.', industry: 'Cybersecurity' },
  { id: 'opp-008', company: 'Summit Retail', dealName: 'Customer 360 Platform', value: 215000, stage: 'Qualification', probability: 40, closeDate: '2025-03-15', owner: 'Emily Rodriguez', createdAt: '2024-11-20', description: 'Unified customer view across all retail touchpoints.', industry: 'Retail' },
  { id: 'opp-009', company: 'Atlas Energy', dealName: 'Predictive Maintenance Suite', value: 675000, stage: 'Proposal', probability: 50, closeDate: '2025-02-20', owner: 'James Park', createdAt: '2024-10-15', description: 'IoT-integrated predictive maintenance for energy infrastructure.', industry: 'Energy' },
  { id: 'opp-010', company: 'BrightPath Education', dealName: 'Learning Analytics Engine', value: 132000, stage: 'Closed Won', probability: 100, closeDate: '2024-12-20', owner: 'Lisa Wang', createdAt: '2024-06-30', description: 'Student performance analytics and personalized learning paths.', industry: 'Education' },
  { id: 'opp-011', company: 'QuantumLeap Labs', dealName: 'Research Intelligence Platform', value: 388000, stage: 'Prospecting', probability: 20, closeDate: '2025-05-01', owner: 'Sarah Chen', createdAt: '2024-12-10', description: 'Research data management with AI-powered insights.', industry: 'Biotech' },
  { id: 'opp-012', company: 'Stratos Aerospace', dealName: 'Mission Planning System', value: 890000, stage: 'Qualification', probability: 30, closeDate: '2025-06-15', owner: 'Marcus Johnson', createdAt: '2024-12-05', description: 'Advanced mission planning and simulation platform.', industry: 'Aerospace' },
  { id: 'opp-013', company: 'Vanguard Logistics', dealName: 'Fleet Management AI', value: 265000, stage: 'Negotiation', probability: 70, closeDate: '2025-01-30', owner: 'Emily Rodriguez', createdAt: '2024-10-08', description: 'AI-powered fleet optimization and route planning.', industry: 'Logistics' },
  { id: 'opp-014', company: 'Horizon Real Estate', dealName: 'Property Intelligence Suite', value: 156000, stage: 'Closed Lost', probability: 0, closeDate: '2025-01-10', owner: 'James Park', createdAt: '2024-08-15', description: 'Market analysis and property valuation intelligence.', industry: 'Real Estate' },
];

// ── Helpers ──

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function daysBetween(d1: string, d2: string): number {
  return Math.ceil((new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24));
}

// ── Component ──

export default function Opportunities() {
  const [stageFilter, setStageFilter] = useState<Stage | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [loading] = useState(false);

  const filtered = useMemo(() => {
    let result = [...MOCK_OPPORTUNITIES];
    if (stageFilter !== 'All') result = result.filter((o) => o.stage === stageFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((o) => o.company.toLowerCase().includes(q) || o.dealName.toLowerCase().includes(q));
    }
    // Sort
    result.sort((a, b) => {
      const aVal = a[sortKey as keyof Opportunity];
      const bVal = b[sortKey as keyof Opportunity];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
    return result;
  }, [stageFilter, searchQuery, sortKey, sortDir]);

  const stats = useMemo(() => {
    const totalValue = filtered.reduce((sum, o) => sum + o.value, 0);
    const weightedValue = filtered.reduce((sum, o) => sum + o.value * (o.probability / 100), 0);
    const avgDealSize = filtered.length > 0 ? totalValue / filtered.length : 0;
    const wonDeals = filtered.filter((o) => o.stage === 'Closed Won').length;
    const closedDeals = filtered.filter((o) => o.stage === 'Closed Won' || o.stage === 'Closed Lost').length;
    const winRate = closedDeals > 0 ? (wonDeals / closedDeals) * 100 : 0;
    return { totalValue, weightedValue, avgDealSize, winRate };
  }, [filtered]);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const columns = useMemo(() => [
    { key: 'company', label: 'Company', sortable: true, render: (_v: unknown, row: Record<string, unknown>) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold" style={{ background: tokens.accent.subtle, color: tokens.accent.primary }}>
          {(row.company as string).charAt(0)}
        </div>
        <span className="font-medium">{row.company as string}</span>
      </div>
    )},
    { key: 'dealName', label: 'Deal Name', sortable: true },
    { key: 'value', label: 'Value', sortable: true, render: (v: unknown) => (
      <span className="font-semibold" style={{ color: tokens.confidence.high.value }}>{formatCurrency(v as number)}</span>
    )},
    { key: 'stage', label: 'Stage', sortable: true, render: (v: unknown) => {
      const stage = v as Stage;
      const c = STAGE_COLORS[stage];
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
          {stage}
        </span>
      );
    }},
    { key: 'probability', label: 'Probability', sortable: true, render: (v: unknown) => {
      const p = v as number;
      const color = p >= 70 ? tokens.confidence.high.value : p >= 40 ? tokens.confidence.medium.value : tokens.confidence.low.value;
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full" style={{ background: tokens.border.default }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: color }} />
          </div>
          <span className="text-xs font-medium" style={{ color }}>{p}%</span>
        </div>
      );
    }},
    { key: 'closeDate', label: 'Close Date', sortable: true, render: (v: unknown) => (
      <span className="text-xs">{new Date(v as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
    )},
    { key: 'owner', label: 'Owner', sortable: true },
    { key: 'createdAt', label: 'Days Active', sortable: true, render: (_v: unknown, row: Record<string, unknown>) => {
      const days = daysBetween(row.createdAt as string, new Date().toISOString().split('T')[0]);
      return <span className="text-xs" style={{ color: tokens.text.secondary }}>{days}d</span>;
    }},
  ], []);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  return (
    <div className="p-6 space-y-6" style={{ background: '#0a0e17', minHeight: '100%' }}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: textPrimary }}>Opportunities</h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>Track and manage your deal pipeline</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stage filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['All', ...STAGES] as const).map((stage) => (
              <button
                key={stage}
                onClick={() => setStageFilter(stage)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: stageFilter === stage ? tokens.accent.primary : 'transparent',
                  color: stageFilter === stage ? tokens.flat.white : textSecondary,
                  border: `1px solid ${stageFilter === stage ? tokens.accent.primary : border}`,
                }}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Value', value: formatCurrency(stats.totalValue), icon: DollarSign, color: tokens.accent.primary },
          { label: 'Weighted Value', value: formatCurrency(stats.weightedValue), icon: TrendingUp, color: '#059669' },
          { label: 'Avg Deal Size', value: formatCurrency(stats.avgDealSize), icon: BarChart3, color: '#7C3AED' },
          { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, icon: Target, color: tokens.confidence.high.value },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs truncate" style={{ color: textMuted }}>{stat.label}</p>
                <p className="text-lg font-bold" style={{ color: textPrimary }}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={filtered as unknown as Record<string, unknown>[]}
        onRowClick={(row) => setSelectedOpp(row as unknown as Opportunity)}
        onSort={handleSort}
        sortKey={sortKey}
        sortDir={sortDir}
        loading={loading}
        filterable
        filterPlaceholder="Search companies or deal names…"
        exportable
        exportFilename="opportunities"
        emptyMessage="No opportunities match your criteria"
      />

      {/* ── Detail Slide-over ── */}
      <Sheet open={!!selectedOpp} onOpenChange={(open) => !open && setSelectedOpp(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" style={{ background: '#0d1117', borderLeft: `1px solid ${border}` }}>
          {selectedOpp && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg font-bold" style={{ color: textPrimary }}>{selectedOpp.dealName}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Company & Industry */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: tokens.accent.subtle, color: tokens.accent.primary }}>
                    {selectedOpp.company.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: textPrimary }}>{selectedOpp.company}</p>
                    <p className="text-xs" style={{ color: textSecondary }}>{selectedOpp.industry}</p>
                  </div>
                </div>

                {/* Value */}
                <div className="rounded-xl p-4" style={{ background: tokens.surface.secondary, border: `1px solid ${border}` }}>
                  <p className="text-xs font-medium mb-1" style={{ color: textMuted }}>Deal Value</p>
                  <p className="text-2xl font-bold" style={{ color: tokens.confidence.high.value }}>{formatCurrency(selectedOpp.value)}</p>
                  <p className="text-xs mt-1" style={{ color: textSecondary }}>Weighted: {formatCurrency(selectedOpp.value * (selectedOpp.probability / 100))}</p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Stage', value: selectedOpp.stage, icon: Target },
                    { label: 'Probability', value: `${selectedOpp.probability}%`, icon: Percent },
                    { label: 'Close Date', value: new Date(selectedOpp.closeDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), icon: CalendarDays },
                    { label: 'Owner', value: selectedOpp.owner, icon: User },
                    { label: 'Created', value: new Date(selectedOpp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), icon: Clock },
                    { label: 'Days Active', value: `${daysBetween(selectedOpp.createdAt, new Date().toISOString().split('T')[0])} days`, icon: Building2 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg p-3" style={{ background: tokens.surface.secondary, border: `1px solid ${border}` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <item.icon className="w-3.5 h-3.5" style={{ color: textMuted }} />
                        <p className="text-xs" style={{ color: textMuted }}>{item.label}</p>
                      </div>
                      <p className="text-sm font-medium" style={{ color: textPrimary }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Description */}
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: textMuted }}>Description</p>
                  <p className="text-sm leading-relaxed" style={{ color: textSecondary }}>{selectedOpp.description}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    style={{ background: tokens.accent.primary, color: tokens.flat.white }}
                    onClick={() => toast.success(`Opened ${selectedOpp.dealName}`)}
                  >
                    Open Deal
                  </button>
                  <button
                    className="py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: 'transparent', border: `1px solid ${border}`, color: textSecondary }}
                    onClick={() => toast.info('Activity logged')}
                  >
                    Log Activity
                  </button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
