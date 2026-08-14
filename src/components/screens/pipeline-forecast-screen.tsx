'use client';

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
import { DollarSign, TrendingUp, BarChart3, ArrowUpRight } from 'lucide-react';

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

const FORECAST_BY_MONTH = [
  { month: 'Oct', committed: 320000, bestCase: 480000, upside: 620000 },
  { month: 'Nov', committed: 410000, bestCase: 590000, upside: 780000 },
  { month: 'Dec', committed: 380000, bestCase: 540000, upside: 710000 },
  { month: 'Jan', committed: 520000, bestCase: 740000, upside: 960000 },
  { month: 'Feb', committed: 460000, bestCase: 670000, upside: 880000 },
  { month: 'Mar', committed: 580000, bestCase: 820000, upside: 1050000 },
];

const PIPELINE_BY_STAGE = [
  { stage: 'Prospect', value: 4260000 },
  { stage: 'Discovery', value: 6960000 },
  { stage: 'Demo', value: 8100000 },
  { stage: 'Proposal', value: 9300000 },
  { stage: 'Negotiation', value: 11000000 },
];

const HISTORICAL_WIN_RATES = [
  { month: 'Jul', rate: 22 },
  { month: 'Aug', rate: 25 },
  { month: 'Sep', rate: 28 },
  { month: 'Oct', rate: 31 },
  { month: 'Nov', rate: 29 },
  { month: 'Dec', rate: 33 },
  { month: 'Jan', rate: 36 },
  { month: 'Feb', rate: 38 },
];

const forecastConfig = {
  committed: { label: 'Committed', color: tokens.accent.primary },
  bestCase: { label: 'Best Case', color: tokens.confidence.medium.value },
  upside: { label: 'Upside', color: tokens.domain.value },
};

const stageConfig = {
  value: { label: 'Pipeline Value', color: tokens.accent.primary },
};

const winRateConfig = {
  rate: { label: 'Win Rate %', color: tokens.confidence.high.value },
};

export default function PipelineForecast() {
  const totalCommitted = 2370000;
  const totalBestCase = 3840000;
  const totalUpside = 5000000;
  const weightedForecast = Math.round(
    totalCommitted * 1.0 +
      (totalBestCase - totalCommitted) * 0.6 +
      (totalUpside - totalBestCase) * 0.25,
  );

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
            label: 'Committed Pipeline',
            value: formatCurrency(totalCommitted),
            icon: DollarSign,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'Best Case',
            value: formatCurrency(totalBestCase),
            icon: TrendingUp,
            color: tokens.confidence.medium.value,
            bg: tokens.confidence.medium.bg,
          },
          {
            label: 'Upside',
            value: formatCurrency(totalUpside),
            icon: ArrowUpRight,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Weighted Forecast',
            value: formatCurrency(weightedForecast),
            icon: BarChart3,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
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

      {/* Forecast by Month */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold">Forecast by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={forecastConfig} className="h-[300px] w-full">
            <BarChart data={FORECAST_BY_MONTH}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
              <YAxis
                tickFormatter={(v) => formatCurrency(v)}
                tick={{ fontSize: 12, fill: tokens.text.secondary }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="committed" fill={tokens.accent.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="bestCase" fill={tokens.confidence.medium.value} radius={[4, 4, 0, 0]} />
              <Bar dataKey="upside" fill={tokens.domain.value} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Stage */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageConfig} className="h-[260px] w-full">
              <BarChart data={PIPELINE_BY_STAGE} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={tokens.border.default}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatCurrency(v)}
                  tick={{ fontSize: 12, fill: tokens.text.secondary }}
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tick={{ fontSize: 12, fill: tokens.text.secondary }}
                  width={90}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill={tokens.accent.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Historical Win Rates */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold">Historical Win Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={winRateConfig} className="h-[260px] w-full">
              <LineChart data={HISTORICAL_WIN_RATES}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 12, fill: tokens.text.secondary }}
                  domain={[15, 45]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={tokens.confidence.high.value}
                  strokeWidth={2}
                  dot={{ r: 4, fill: tokens.confidence.high.value }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
