'use client';

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
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, BarChart3 } from 'lucide-react';

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

const REVENUE_TREND = [
  { month: 'Jul', arr: 4200000, mrr: 350000 },
  { month: 'Aug', arr: 4350000, mrr: 362500 },
  { month: 'Sep', arr: 4510000, mrr: 376000 },
  { month: 'Oct', arr: 4680000, mrr: 390000 },
  { month: 'Nov', arr: 4820000, mrr: 402000 },
  { month: 'Dec', arr: 5010000, mrr: 418000 },
  { month: 'Jan', arr: 5200000, mrr: 433000 },
  { month: 'Feb', arr: 5440000, mrr: 453000 },
];

const REVENUE_BY_SEGMENT = [
  { name: 'Enterprise', value: 2800000, color: tokens.accent.primary },
  { name: 'Mid-Market', value: 1200000, color: tokens.domain.value },
  { name: 'SMB', value: 380000, color: tokens.confidence.medium.value },
  { name: 'Startup', value: 150000, color: tokens.confidence.high.value },
];

const EXPANSION_CONTRACTION = [
  { month: 'Jul', expansion: 180000, contraction: 45000 },
  { month: 'Aug', expansion: 210000, contraction: 38000 },
  { month: 'Sep', expansion: 195000, contraction: 52000 },
  { month: 'Oct', expansion: 240000, contraction: 41000 },
  { month: 'Nov', expansion: 260000, contraction: 35000 },
  { month: 'Dec', expansion: 280000, contraction: 30000 },
  { month: 'Jan', expansion: 310000, contraction: 28000 },
  { month: 'Feb', expansion: 340000, contraction: 25000 },
];

const TOP_ACCOUNTS = [
  { name: 'Acme Corporation', arr: 480000, segment: 'Enterprise', growth: 12 },
  { name: 'Nexus Technologies', arr: 320000, segment: 'Mid-Market', growth: 24 },
  { name: 'Stellar Dynamics', arr: 290000, segment: 'Enterprise', growth: 8 },
  { name: 'Quantum Leap Inc', arr: 240000, segment: 'Mid-Market', growth: -3 },
  { name: 'Vertex Solutions', arr: 96000, segment: 'Startup', growth: 45 },
  { name: 'Pinnacle Systems', arr: 180000, segment: 'Mid-Market', growth: 15 },
  { name: 'Atlas Corp', arr: 165000, segment: 'Enterprise', growth: 6 },
];

const trendConfig = {
  arr: { label: 'ARR', color: tokens.accent.primary },
  mrr: { label: 'MRR', color: tokens.domain.value },
};

const expConfig = {
  expansion: { label: 'Expansion', color: tokens.confidence.high.value },
  contraction: { label: 'Contraction', color: tokens.confidence.low.value },
};

const segmentConfig = {
  Enterprise: { label: 'Enterprise', color: tokens.accent.primary },
  'Mid-Market': { label: 'Mid-Market', color: tokens.domain.value },
  SMB: { label: 'SMB', color: tokens.confidence.medium.value },
  Startup: { label: 'Startup', color: tokens.confidence.high.value },
};

export default function RevenueIntelligence() {
  const currentARR = 5440000;
  const currentMRR = 453000;
  const growthRate = 29.5;
  const nrr = 118;

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
            label: 'ARR',
            value: formatCurrency(currentARR),
            change: '+8.1%',
            up: true,
            icon: DollarSign,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'MRR',
            value: formatCurrency(currentMRR),
            change: '+5.3%',
            up: true,
            icon: BarChart3,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Growth Rate (YoY)',
            value: `${growthRate}%`,
            change: '+4.2pp',
            up: true,
            icon: TrendingUp,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Net Revenue Retention',
            value: `${nrr}%`,
            change: '+3pp',
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
                      <ArrowDownRight className="size-3" />
                    )}
                    {stat.change}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Trend */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendConfig} className="h-[300px] w-full">
            <LineChart data={REVENUE_TREND}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
              <YAxis
                tickFormatter={(v) => formatCurrency(v)}
                tick={{ fontSize: 12, fill: tokens.text.secondary }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey="arr"
                stroke={tokens.accent.primary}
                strokeWidth={2}
                dot={{ r: 4, fill: tokens.accent.primary }}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke={tokens.domain.value}
                strokeWidth={2}
                dot={{ r: 3, fill: tokens.domain.value }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Segment PieChart */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold">Revenue by Segment</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={segmentConfig} className="h-[280px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={REVENUE_BY_SEGMENT}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                >
                  {REVENUE_BY_SEGMENT.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Expansion vs Contraction */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold">Expansion vs Contraction</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={expConfig} className="h-[280px] w-full">
              <BarChart data={EXPANSION_CONTRACTION}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v)}
                  tick={{ fontSize: 12, fill: tokens.text.secondary }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="expansion"
                  fill={tokens.confidence.high.value}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="contraction"
                  fill={tokens.confidence.low.value}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Accounts by Revenue */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold">Top Accounts by Revenue</CardTitle>
        </CardHeader>
        <CardContent className="p-0 max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                <TableHead>Account</TableHead>
                <TableHead className="w-[100px]">Segment</TableHead>
                <TableHead className="text-right">ARR</TableHead>
                <TableHead className="text-right">Growth</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TOP_ACCOUNTS.map((account) => (
                <TableRow key={account.name} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium" style={{ color: tokens.text.primary }}>
                    {account.name}
                  </TableCell>
                  <TableCell>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: tokens.surface.secondary,
                        color: tokens.text.secondary,
                      }}
                    >
                      {account.segment}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-right font-mono font-medium"
                    style={{ color: tokens.text.primary }}
                  >
                    {formatCurrency(account.arr)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className="text-sm font-medium flex items-center justify-end gap-1"
                      style={{
                        color:
                          account.growth >= 0
                            ? tokens.confidence.high.value
                            : tokens.confidence.low.value,
                      }}
                    >
                      {account.growth >= 0 ? (
                        <ArrowUpRight className="size-3.5" />
                      ) : (
                        <ArrowDownRight className="size-3.5" />
                      )}
                      {Math.abs(account.growth)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
