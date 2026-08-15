'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Building2, TrendingUp, ArrowUpRight, BarChart3, Search, Loader2, X } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { LoadingSkeleton } from '@/components/ui/screen-states';
import { ErrorPanel } from '@/components/ui/screen-states';
import { Input } from '@/components/ui/input';

interface TopOpportunity {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  intelligenceScore: number | null;
  signalCount: number;
}

interface IndustryItem {
  industry: string;
  count: number;
  avgScore: number;
}

interface RevenueIntelligenceData {
  topOpportunities: TopOpportunity[];
  industryBreakdown: IndustryItem[];
  totalOrganizations: number;
  avgIntelligenceScore: number;
}

const PIE_COLORS = [
  tokens.accent.primary,
  tokens.domain.value,
  tokens.confidence.medium.value,
  tokens.confidence.high.value,
  tokens.gold.dark,
  tokens.neutral.zinc,
  tokens.accent.secondary || '#8b5cf6',
  tokens.confidence.low.value,
];

const trendConfig = {
  count: { label: 'Organizations', color: tokens.accent.primary },
  avgScore: { label: 'Avg Intel Score', color: tokens.domain.value },
};

const expConfig = {
  count: { label: 'Count', color: tokens.confidence.high.value },
  avgScore: { label: 'Avg Score', color: tokens.confidence.low.value },
};

export default function RevenueIntelligence() {
  const [data, setData] = useState<RevenueIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const res = await fetchApi<RevenueIntelligenceData>('/api/revenue-intelligence');
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOpportunities = data?.topOpportunities.filter((org) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      (org.industry || '').toLowerCase().includes(q) ||
      (org.domain || '').toLowerCase().includes(q)
    );
  });

  // Transform industryBreakdown into line-chart-friendly shape
  const industryTrend = (data?.industryBreakdown || []).map((item, idx) => ({
    industry: item.industry.length > 12 ? item.industry.slice(0, 12) + '…' : item.industry,
    count: item.count,
    avgScore: Math.round(item.avgScore),
  }));

  // Pie chart data
  const pieData = (data?.industryBreakdown || []).map((item, idx) => ({
    name: item.industry,
    value: item.count,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));

  // Segment config for pie chart legend
  const segmentConfig = Object.fromEntries(
    pieData.map((d) => [d.name, { label: d.name, color: d.color }]),
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Revenue Intelligence
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Revenue metrics, trends, and account-level performance analysis
          </p>
        </div>
        <LoadingSkeleton variant="dashboard" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Revenue Intelligence
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Revenue metrics, trends, and account-level performance analysis
          </p>
        </div>
        <ErrorPanel
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            fetchApi<RevenueIntelligenceData>('/api/revenue-intelligence').then((res) => {
              if (res.error) setError(res.error);
              else if (res.data) setData(res.data);
              setLoading(false);
            });
          }}
        />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
          Revenue Intelligence
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          Revenue metrics, trends, and account-level performance analysis
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Organizations',
            value: data.totalOrganizations,
            change: `${data.industryBreakdown.length} industries`,
            up: true,
            icon: Building2,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'Avg Intel Score',
            value: data.avgIntelligenceScore.toFixed(1),
            change: 'across all orgs',
            up: true,
            icon: BarChart3,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Top Opportunity',
            value: data.topOpportunities[0]?.intelligenceScore?.toFixed(0) ?? '—',
            change: data.topOpportunities[0]?.signalCount
              ? `${data.topOpportunities[0].signalCount} signals`
              : '',
            up: true,
            icon: TrendingUp,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Tracked Industries',
            value: data.industryBreakdown.length,
            change: `${data.totalOrganizations} orgs`,
            up: true,
            icon: ArrowUpRight,
            color: tokens.gold.dark,
            bg: tokens.gold.bgMedium,
          },
        ].map((stat) => (
          <Card key={stat.label} className="gap-4 py-4">
            <CardContent className="flex items-center gap-4">
              <div
                className="size-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: stat.bg }}
              >
                <stat.icon className="size-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  {stat.label}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                    {stat.value}
                  </p>
                  <span
                    className="text-xs font-medium flex items-center gap-0.5"
                    style={{
                      color: stat.up ? tokens.confidence.high.value : tokens.confidence.low.value,
                    }}
                  >
                    {stat.up ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowUpRight className="size-3 rotate-180" />
                    )}
                    {stat.change}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Industry Intelligence Trend */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold">Intelligence by Industry</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendConfig} className="h-[300px] w-full">
            <LineChart data={industryTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
              <XAxis dataKey="industry" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
              <YAxis tick={{ fontSize: 12, fill: tokens.text.secondary }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey="count"
                stroke={tokens.accent.primary}
                strokeWidth={2}
                dot={{ r: 4, fill: tokens.accent.primary }}
              />
              <Line
                type="monotone"
                dataKey="avgScore"
                stroke={tokens.domain.value}
                strokeWidth={2}
                dot={{ r: 3, fill: tokens.domain.value }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organizations by Industry PieChart */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold">Organizations by Industry</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={segmentConfig} className="h-[280px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Count vs Avg Score by Industry */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold">Count vs Avg Score by Industry</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={expConfig} className="h-[280px] w-full">
              <BarChart data={industryTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
                <XAxis dataKey="industry" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
                <YAxis tick={{ fontSize: 12, fill: tokens.text.secondary }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="count" fill={tokens.confidence.high.value} radius={[3, 3, 0, 0]} />
                <Bar dataKey="avgScore" fill={tokens.confidence.low.value} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Opportunities Table */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Top Opportunities</CardTitle>
            <div className="relative w-64">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5"
                style={{ color: tokens.text.muted }}
              />
              <Input
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-8 text-xs"
                style={{
                  backgroundColor: tokens.surface.secondary,
                  borderColor: tokens.border.default,
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                >
                  <X className="size-3" style={{ color: tokens.text.muted }} />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                <TableHead>Organization</TableHead>
                <TableHead className="w-[120px]">Industry</TableHead>
                <TableHead className="text-right">Intel Score</TableHead>
                <TableHead className="text-right">Signals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(filteredOpportunities || []).map((org) => (
                <TableRow key={org.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium" style={{ color: tokens.text.primary }}>
                    {org.name}
                  </TableCell>
                  <TableCell>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: tokens.surface.secondary,
                        color: tokens.text.secondary,
                      }}
                    >
                      {org.industry || '—'}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-right font-mono font-medium"
                    style={{ color: tokens.text.primary }}
                  >
                    {org.intelligenceScore?.toFixed(0) ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className="text-sm font-medium flex items-center justify-end gap-1"
                      style={{
                        color:
                          org.signalCount > 0 ? tokens.confidence.high.value : tokens.text.muted,
                      }}
                    >
                      {org.signalCount > 0 && <ArrowUpRight className="size-3.5" />}
                      {org.signalCount}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOpportunities?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-8"
                    style={{ color: tokens.text.muted }}
                  >
                    No organizations match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
