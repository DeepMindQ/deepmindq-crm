'use client';

import { useState, useEffect, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Activity, TrendingUp, Building2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { LoadingSkeleton, ErrorPanel } from '@/components/ui/screen-states';

interface MonthlyData {
  month: string;
  total: number;
  critical: number;
  high: number;
}

interface OrgByStatus {
  active: number;
  paused: number;
  archived: number;
}

interface PipelineForecastData {
  monthly: MonthlyData[];
  organizationsByStatus: OrgByStatus;
  projectedGrowth: string;
}

const forecastConfig = {
  total: { label: 'Total Signals', color: tokens.accent.primary },
  critical: { label: 'Critical', color: tokens.confidence.low.value },
  high: { label: 'High', color: tokens.confidence.medium.value },
};

const stageConfig = {
  count: { label: 'Organizations', color: tokens.accent.primary },
};

const winRateConfig = {
  total: { label: 'Signal Volume', color: tokens.confidence.high.value },
};

export default function PipelineForecast() {
  const [data, setData] = useState<PipelineForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchApi<PipelineForecastData>('/api/pipeline-forecast');
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

  // Derived stats
  const totalSignals = data?.monthly.reduce((sum, m) => sum + m.total, 0) || 0;
  const totalCritical = data?.monthly.reduce((sum, m) => sum + m.critical, 0) || 0;
  const totalHigh = data?.monthly.reduce((sum, m) => sum + m.high, 0) || 0;
  const activeOrgs = data?.organizationsByStatus.active || 0;

  const growthNum = parseFloat(data?.projectedGrowth || '0');
  const isGrowthPositive = growthNum >= 0;

  // Organizations by status chart data
  const orgStatusData = data?.organizationsByStatus
    ? [
        { status: 'Active', count: data.organizationsByStatus.active },
        { status: 'Paused', count: data.organizationsByStatus.paused },
        { status: 'Archived', count: data.organizationsByStatus.archived },
      ]
    : [];

  // Growth rate trend: compute month-over-month growth percentages
  const growthTrend = (data?.monthly || []).map((m, idx, arr) => {
    const prev = idx > 0 ? arr[idx - 1].total : m.total;
    const rate = prev > 0 ? Math.round(((m.total - prev) / prev) * 100) : 0;
    return {
      month: m.month,
      total: m.total,
      rate,
    };
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Pipeline Forecast
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            AI-powered pipeline forecasting and revenue predictions
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
            Pipeline Forecast
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            AI-powered pipeline forecasting and revenue predictions
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
          Pipeline Forecast
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          AI-powered pipeline forecasting and revenue predictions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Signals (6mo)',
            value: totalSignals,
            icon: Activity,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'Critical Signals',
            value: totalCritical,
            icon: ArrowUpRight,
            color: tokens.confidence.low.value,
            bg: tokens.confidence.low.bg,
          },
          {
            label: 'High Severity',
            value: totalHigh,
            icon: TrendingUp,
            color: tokens.confidence.medium.value,
            bg: tokens.confidence.medium.bg,
          },
          {
            label: 'Projected Growth',
            value: data.projectedGrowth,
            icon: Building2,
            color: isGrowthPositive ? tokens.confidence.high.value : tokens.confidence.low.value,
            bg: isGrowthPositive ? tokens.confidence.high.bg : tokens.confidence.low.bg,
            up: isGrowthPositive,
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
                  {'up' in stat && stat.up !== undefined && (
                    <span
                      className="text-xs font-medium flex items-center gap-0.5"
                      style={{
                        color: stat.up ? tokens.confidence.high.value : tokens.confidence.low.value,
                      }}
                    >
                      {stat.up ? (
                        <ArrowUpRight className="size-3" />
                      ) : (
                        <ArrowDownRight className="size-3" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Forecast by Month */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold">Signal Volume by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={forecastConfig} className="h-[300px] w-full">
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
              <YAxis tick={{ fontSize: 12, fill: tokens.text.secondary }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="total" fill={tokens.accent.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="critical" fill={tokens.confidence.low.value} radius={[4, 4, 0, 0]} />
              <Bar dataKey="high" fill={tokens.confidence.medium.value} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organizations by Status */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold">Organizations by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageConfig} className="h-[260px] w-full">
              <BarChart data={orgStatusData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={tokens.border.default}
                  horizontal={false}
                />
                <XAxis type="number" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
                <YAxis
                  type="category"
                  dataKey="status"
                  tick={{ fontSize: 12, fill: tokens.text.secondary }}
                  width={80}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill={tokens.accent.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Signal Growth Trend */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold">Signal Growth Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={winRateConfig} className="h-[260px] w-full">
              <LineChart data={growthTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
                <YAxis tick={{ fontSize: 12, fill: tokens.text.secondary }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={tokens.confidence.high.value}
                  strokeWidth={2}
                  dot={{ r: 4, fill: tokens.confidence.high.value }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Organization Status Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {orgStatusData.map((item) => (
          <Card key={item.status} className="gap-4 py-4">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  {item.status}
                </p>
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                  {item.count}
                </p>
              </div>
              <div
                className="size-10 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor:
                    item.status === 'Active'
                      ? tokens.confidence.high.bg
                      : item.status === 'Paused'
                        ? tokens.confidence.medium.bg
                        : tokens.accent.subtle,
                }}
              >
                <Building2
                  className="size-5"
                  style={{
                    color:
                      item.status === 'Active'
                        ? tokens.confidence.high.value
                        : item.status === 'Paused'
                          ? tokens.confidence.medium.value
                          : tokens.text.muted,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
