'use client';

import { useState, useMemo, useCallback } from 'react';
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

// ── Mock Data ──
const MOCK_INSIGHTS: Insight[] = [
  { id: 'ins-001', title: 'Acme Corp expanding into APAC markets', organization: 'Acme Corp', category: 'opportunity', confidence: 92, status: 'active', createdAt: '2025-01-15T10:30:00Z', narrative: 'Acme Corp has posted 3 new job openings for Regional Directors in Singapore, Tokyo, and Sydney within the past 48 hours. This follows their Q3 earnings call where CEO explicitly mentioned APAC expansion as a 2025 strategic priority. Their VP of Sales has also been actively engaging with partners in the region on LinkedIn, suggesting immediate go-to-market activity.', recommendation: 'Reach out to the VP of Sales with a tailored partnership proposal. Leverage the timing of their hiring to position your solution as a force-multiplier for their new APAC team. Consider offering an introductory APAC market analysis as a conversation starter.', evidence: ['Job postings on LinkedIn', 'Q3 earnings call transcript', 'LinkedIn engagement activity'] },
  { id: 'ins-002', title: 'TechStart Inc funding round at risk', organization: 'TechStart Inc', category: 'risk', confidence: 78, status: 'active', createdAt: '2025-01-14T14:20:00Z', narrative: 'TechStart Inc\'s Series C round has been in discussion for 90+ days without closing. Two of their previously confirmed investors have pulled back based on recent market volatility. Their current runway is estimated at 4.2 months, putting pressure on operational decisions.', recommendation: 'Proceed with caution in any outbound engagement. If already in pipeline, assess deal viability and consider accelerated closing strategies or flexible payment terms. Monitor their funding status weekly.', evidence: ['PitchBook data', 'Investor meeting leaks', 'Financial model analysis'] },
  { id: 'ins-003', title: 'GlobalFin implementing AI fraud detection', organization: 'GlobalFin', category: 'opportunity', confidence: 85, status: 'acted_upon', createdAt: '2025-01-13T09:15:00Z', narrative: 'GlobalFin has issued an RFP for AI-based fraud detection systems. Their current solution has shown a 23% increase in false positives over the last quarter, triggering the search for alternatives. Budget allocation of $2.5M has been approved by the CTO.', recommendation: 'Prepare a targeted RFP response highlighting false positive reduction capabilities. Include case studies from financial services clients. Schedule a technical deep-dive with their security team.', evidence: ['RFP document', 'CTO blog post', 'Industry analyst report'] },
  { id: 'ins-004', title: 'HealthPlus experiencing executive churn', organization: 'HealthPlus', category: 'risk', confidence: 71, status: 'active', createdAt: '2025-01-12T16:45:00Z', narrative: 'HealthPlus has lost 3 C-suite executives in the past 6 months including their CTO, CFO, and Head of Product. Board members have expressed concerns about strategic direction in recent filings. Employee sentiment on Glassdoor has dropped 18 points.', recommendation: 'Delay major account engagement until leadership stabilizes. If in active deal cycle, qualify the decision-maker\'s authority and budget commitment. Consider positioning as a stability partner rather than growth partner.', evidence: ['SEC filings', 'Glassdoor reviews', 'LinkedIn departures'] },
  { id: 'ins-005', title: 'Pattern: Enterprise buyers requesting RAG capabilities', organization: 'Multiple', category: 'pattern', confidence: 88, status: 'active', createdAt: '2025-01-11T11:00:00Z', narrative: 'Analysis of the last 200 inbound inquiries reveals a 340% increase in RAG (Retrieval-Augmented Generation) capability requests. 67% of enterprise buyers specifically mention RAG in their evaluation criteria. This pattern has intensified since the December product announcements from major competitors.', recommendation: 'Prioritize RAG feature development and marketing. Update product demos to highlight RAG capabilities. Create comparison materials that position your RAG implementation against competitors. Consider a dedicated RAG-focused webinar.', evidence: ['Inbound inquiry analysis', 'Competitive intelligence', 'Sales call transcripts'] },
  { id: 'ins-006', title: 'RetailMax supply chain optimization initiative', organization: 'RetailMax', category: 'recommendation', confidence: 82, status: 'active', createdAt: '2025-01-10T08:30:00Z', narrative: 'RetailMax has publicly committed to a $15M supply chain digitization initiative following a Q4 inventory management failure that cost an estimated $8.2M in lost revenue. Their CIO has been appointed to lead the transformation with a 12-month timeline.', recommendation: 'Position supply chain optimization solutions immediately. The CIO is the key decision-maker and has authority to move quickly given the board mandate. Offer a rapid assessment engagement to establish credibility and uncover specific pain points.', evidence: ['Press release', 'Earnings call', 'Industry publication'] },
  { id: 'ins-007', title: 'CloudScale downgrading infrastructure spend', organization: 'CloudScale', category: 'risk', confidence: 65, status: 'dismissed', createdAt: '2025-01-09T13:20:00Z', narrative: 'CloudScale has announced a 30% reduction in cloud infrastructure spend for Q1 2025. While this may indicate cost optimization, it could also signal budget pressures that affect purchasing decisions for SaaS tools.', recommendation: 'Investigate the nature of the spending reduction. If it\'s pure optimization, opportunity exists for cost-saving solutions. If it\'s budget pressure, adjust deal sizing and timing expectations.', evidence: ['Internal memo leak', 'AWS usage data', 'Industry benchmarks'] },
  { id: 'ins-008', title: 'AutoDrive AI partnership with major OEM', organization: 'AutoDrive AI', category: 'opportunity', confidence: 91, status: 'active', createdAt: '2025-01-08T15:10:00Z', narrative: 'AutoDrive AI has signed a strategic partnership with a Tier-1 automotive OEM worth an estimated $50M over 3 years. This significantly increases their market credibility and likely triggers expanded technology needs across engineering, testing, and simulation teams.', recommendation: 'Fast-track engagement with AutoDrive AI. The new partnership creates urgent needs for scalable engineering tools. Target the VP of Engineering and newly created partnership liaison roles.', evidence: ['Partnership announcement', 'Job postings', 'Patent filings'] },
  { id: 'ins-009', title: 'Pattern: Mid-market consolidation in FinTech', organization: 'Multiple', category: 'pattern', confidence: 76, status: 'expired', createdAt: '2025-01-07T10:00:00Z', narrative: 'The FinTech mid-market segment has seen 4 acquisitions in the past 60 days, with an average deal multiple of 8.2x revenue. Companies in the $10M-$50M ARR range are primary targets. This consolidation is creating both opportunity (acqui-hire needs) and risk (customer uncertainty).', recommendation: 'Identify FinTech prospects in the $10M-$50M ARR range. For acquisition targets, accelerate engagement before ownership changes. For acquirers, position as an integration-friendly solution. Update ICP criteria to reflect market shifts.', evidence: ['M&A database', 'Industry reports', 'Revenue estimates'] },
  { id: 'ins-010', title: 'EduLearn platform migration underway', organization: 'EduLearn', category: 'recommendation', confidence: 84, status: 'active', createdAt: '2025-01-06T12:30:00Z', narrative: 'EduLearn is migrating from their legacy LMS to a cloud-native architecture. The project has a dedicated team of 12 engineers and a Q2 completion target. They\'ve been evaluating complementary tools for analytics, personalization, and content management.', recommendation: 'Engage with EduLearn\'s CTO and the migration project lead. Offer tools that complement their new architecture. A pilot program for one module could serve as a beachhead for broader adoption.', evidence: ['Job postings', 'Tech stack analysis', 'Conference presentations'] },
  { id: 'ins-011', title: 'GreenEnergy Corp regulatory compliance gap', organization: 'GreenEnergy Corp', category: 'risk', confidence: 73, status: 'acted_upon', createdAt: '2025-01-05T09:00:00Z', narrative: 'New EPA regulations effective March 2025 will require GreenEnergy Corp to implement enhanced emissions tracking and reporting. Their current systems lack the granularity needed for compliance, creating an urgent technology need with a hard deadline.', recommendation: 'Position compliance solutions with a clear ROI case tied to penalty avoidance. The March deadline creates urgency. Offer a compliance gap assessment as a first engagement step. Target the VP of Operations and Chief Compliance Officer.', evidence: ['EPA regulation text', 'Company compliance filings', 'Industry compliance reports'] },
  { id: 'ins-012', title: 'MediaFlow content delivery optimization', organization: 'MediaFlow', category: 'opportunity', confidence: 87, status: 'active', createdAt: '2025-01-04T14:00:00Z', narrative: 'MediaFlow has reported a 40% increase in streaming traffic post-holiday season, exposing performance bottlenecks in their content delivery pipeline. Their CTO published a blog about needing "fundamental architectural changes" to handle projected 2025 growth of 200%.', recommendation: 'Leverage the CTO\'s public statement as a conversation opener. Focus on scalability and performance optimization capabilities. Provide a free infrastructure assessment that quantifies current bottlenecks and projected costs of inaction.', evidence: ['CTO blog post', 'Traffic analytics', 'Performance monitoring data'] },
];

// ── Category Config ──
const CATEGORY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  opportunity: { color: tokens.domain.opportunity, bg: '#ECFDF5', border: '#A7F3D0', label: 'Opportunity' },
  risk: { color: tokens.domain.risk, bg: tokens.confidence.low.bg, border: tokens.confidence.low.border, label: 'Risk' },
  recommendation: { color: tokens.domain.action, bg: tokens.accent.subtle, border: '#93C5FD', label: 'Recommendation' },
  pattern: { color: tokens.domain.reasoning, bg: tokens.domain.bg, border: tokens.domain.border, label: 'Pattern' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: '#16A34A', bg: '#DCFCE7', label: 'Active' },
  acted_upon: { color: tokens.accent.primary, bg: tokens.accent.subtle, label: 'Acted Upon' },
  dismissed: { color: tokens.text.muted, bg: tokens.neutral['100'], label: 'Dismissed' },
  expired: { color: tokens.priority.medium, bg: tokens.gold.bgMedium, label: 'Expired' },
};

// ── Component ──
export default function IntelligenceInbox() {
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [insights, setInsights] = useState<Insight[]>(MOCK_INSIGHTS);

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
      avgConfidence: Math.round(insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length),
      activeCount: active.length,
    };
  }, [insights]);

  const handleRowClick = useCallback((row: Record<string, unknown>) => {
    const insight = insights.find((i) => i.id === row.id);
    if (insight) {
      setSelectedInsight(insight);
      setSlideOpen(true);
    }
  }, [insights]);

  const handleActOnInsight = useCallback((id: string) => {
    setInsights((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'acted_upon' as const } : i))
    );
    setSelectedInsight((prev) => prev ? { ...prev, status: 'acted_upon' } : null);
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
          <span style={{ color: tokens.text.secondary }}>
            {row.organization as string}
          </span>
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
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: tokens.border.default }}>
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
    []
  );

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: tokens.text.primary }}>
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
          { label: 'Total Insights', value: stats.total, icon: Inbox, color: tokens.accent.primary, bg: tokens.accent.ghost },
          { label: 'Opportunities', value: stats.opportunities, icon: TrendingUp, color: tokens.domain.opportunity, bg: '#ECFDF5' },
          { label: 'Risks', value: stats.risks, icon: AlertTriangle, color: tokens.domain.risk, bg: tokens.confidence.low.bg },
          { label: 'Avg Confidence', value: `${stats.avgConfidence}%`, icon: BarChart3, color: tokens.domain.reasoning, bg: tokens.domain.bg, isText: true },
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
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                  {stat.label}
                </p>
                <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: tokens.text.primary }}>
                  {stat.isText ? stat.value : (stat.value as number)}
                </p>
              </div>
              <div
                className="rounded-lg p-2.5"
                style={{ background: stat.bg }}
              >
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
          <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>Filters:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filters */}
          {['all', 'opportunity', 'risk', 'recommendation', 'pattern'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: categoryFilter === cat ? tokens.accent.primary : tokens.surface.secondary,
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
              {st === 'all' ? 'All Statuses' : st.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
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
                <SheetTitle
                  className="text-lg leading-snug"
                  style={{ color: tokens.text.primary }}
                >
                  {selectedInsight.title}
                </SheetTitle>
                <SheetDescription style={{ color: tokens.text.secondary }}>
                  {selectedInsight.organization} • Confidence: {selectedInsight.confidence}%
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-6 px-4 pb-6">
                {/* Confidence Bar */}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: tokens.text.muted }}>
                    Confidence Score
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: tokens.border.default }}>
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
                  <p className="text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: tokens.text.muted }}>
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
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: tokens.text.muted }}>
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
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: tokens.text.muted }}>
                    Supporting Evidence
                  </p>
                  <div className="space-y-1.5">
                    {selectedInsight.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-sm"
                        style={{ color: tokens.text.secondary }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: tokens.accent.dim }} />
                        {ev}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs" style={{ color: tokens.text.muted }}>
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
