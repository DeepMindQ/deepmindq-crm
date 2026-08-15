'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Lightbulb, CheckCircle2, BarChart3, Users, ArrowRight } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { LoadingSkeleton, ErrorPanel } from '@/components/ui/screen-states';

interface TeamMember {
  id: string;
  fullName: string;
  email: string | null;
  title: string | null;
  department: string | null;
  seniority: string | null;
  organization: {
    name: string;
    industry: string | null;
  } | null;
  updatedAt: string;
}

interface DeptItem {
  dept: string;
  count: number;
}

interface SalesExecutionData {
  teamMembers: TeamMember[];
  departmentBreakdown: DeptItem[];
  totalInsights: number;
  actedSignalsCount: number;
  outreachRate: string;
}

const deptConfig = {
  count: { label: 'People', color: tokens.accent.primary },
};

function getFunnelWidth(pct: number) {
  return Math.max(pct, 15);
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function SalesExecution() {
  const [data, setData] = useState<SalesExecutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchApi<SalesExecutionData>('/api/sales-execution');
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setData(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Department chart data
  const deptChartData = data?.departmentBreakdown || [];

  // Conversion funnel derived from stats
  const funnelData = data
    ? [
        { stage: 'Total Insights', value: data.totalInsights, pct: 100 },
        {
          stage: 'Acted Signals',
          value: data.actedSignalsCount,
          pct:
            data.totalInsights > 0
              ? Math.round((data.actedSignalsCount / data.totalInsights) * 100)
              : 0,
        },
        {
          stage: 'Outreach Rate',
          value: data.actedSignalsCount,
          pct: parseInt(data.outreachRate) || 0,
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Sales Execution
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Track sales team activity, conversion funnel, and rep performance
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
            Sales Execution
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Track sales team activity, conversion funnel, and rep performance
          </p>
        </div>
        <ErrorPanel message={error} onRetry={fetchData} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
          Sales Execution
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          Track sales team activity, conversion funnel, and rep performance
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Insights',
            value: data.totalInsights,
            icon: Lightbulb,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'Acted Signals',
            value: data.actedSignalsCount,
            icon: CheckCircle2,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Outreach Rate',
            value: data.outreachRate,
            icon: BarChart3,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Team Members',
            value: data.teamMembers.length,
            icon: Users,
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
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Department Breakdown Chart */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold">Department Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={deptConfig} className="h-[280px] w-full">
            <BarChart data={deptChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
              <XAxis dataKey="dept" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
              <YAxis tick={{ fontSize: 12, fill: tokens.text.secondary }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill={tokens.accent.primary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold">Signal Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {funnelData.map((step) => (
              <div key={step.stage} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <p className="text-xs font-medium" style={{ color: tokens.text.primary }}>
                    {step.stage}
                  </p>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <div
                    className="h-7 rounded transition-all duration-500 flex items-center px-2"
                    style={{
                      backgroundColor: tokens.accent.primary,
                      width: `${getFunnelWidth(step.pct)}%`,
                      opacity: 0.6 + (step.pct / 100) * 0.4,
                    }}
                  >
                    <span className="text-xs font-medium text-white font-mono">{step.value}</span>
                  </div>
                </div>
                <span
                  className="text-xs font-mono w-14 text-right"
                  style={{ color: tokens.text.secondary }}
                >
                  {step.pct}%
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Team Members Table */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4" style={{ color: tokens.gold.dark }} />
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Department</TableHead>
                  <TableHead className="text-right">Organization</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.teamMembers.map((member, idx) => (
                  <TableRow key={member.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{
                            backgroundColor:
                              idx === 0
                                ? tokens.gold.dark
                                : idx === 1
                                  ? tokens.neutral.zinc
                                  : tokens.accent.primary,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                            {member.fullName}
                          </p>
                          <p className="text-[10px]" style={{ color: tokens.text.muted }}>
                            {member.title || member.email || '—'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-right font-mono text-xs"
                      style={{ color: tokens.text.secondary }}
                    >
                      {member.department || '—'}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono text-xs"
                      style={{ color: tokens.text.secondary }}
                    >
                      {member.organization?.name || '—'}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono text-xs"
                      style={{ color: tokens.text.muted }}
                    >
                      {formatDate(member.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
