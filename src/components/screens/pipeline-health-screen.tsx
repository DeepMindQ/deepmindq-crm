'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DollarSign, Clock, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';

const STAGE_DATA = [
  { stage: 'Prospect', deals: 142, value: 4260000, avgDays: 8, conversion: 45 },
  { stage: 'Discovery', deals: 87, value: 6960000, avgDays: 12, conversion: 62 },
  { stage: 'Demo/Presentation', deals: 54, value: 8100000, avgDays: 15, conversion: 58 },
  { stage: 'Proposal', deals: 31, value: 9300000, avgDays: 11, conversion: 71 },
  { stage: 'Negotiation', deals: 22, value: 11000000, avgDays: 18, conversion: 73 },
  { stage: 'Closed Won', deals: 16, value: 8040000, avgDays: 0, conversion: null },
];

const AT_RISK_DEALS = [
  {
    name: 'Acme Corp - Enterprise License',
    stage: 'Negotiation',
    daysInStage: 34,
    value: 850000,
    risk: 'Budget approval delayed by CFO review',
  },
  {
    name: 'Nexus Technologies - Platform Deal',
    stage: 'Proposal',
    daysInStage: 42,
    value: 420000,
    risk: 'Champion left the company — no new sponsor',
  },
  {
    name: 'Vertex Solutions - Expansion',
    stage: 'Demo/Presentation',
    daysInStage: 31,
    value: 180000,
    risk: 'Competing against incumbent with multi-year contract',
  },
  {
    name: 'Stellar Dynamics - Migration',
    stage: 'Discovery',
    daysInStage: 38,
    value: 320000,
    risk: 'Technical evaluation stalled — no response to follow-ups',
  },
  {
    name: 'Quantum Leap - AI Suite',
    stage: 'Negotiation',
    daysInStage: 33,
    value: 1200000,
    risk: 'Legal review flagged data processing concerns',
  },
];

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

function getConversionColor(pct: number | null) {
  if (pct === null) return tokens.confidence.high.value;
  if (pct >= 65) return tokens.confidence.high.value;
  if (pct >= 45) return tokens.confidence.medium.value;
  return tokens.confidence.low.value;
}

export default function PipelineHealth() {
  const totalValue = STAGE_DATA.filter((s) => s.stage !== 'Closed Won').reduce(
    (a, b) => a + b.value,
    0,
  );
  const avgDaysAll = Math.round(
    STAGE_DATA.filter((s) => s.stage !== 'Closed Won').reduce((a, b) => a + b.avgDays, 0) /
      (STAGE_DATA.length - 1),
  );
  const stalledDeals = AT_RISK_DEALS.length;
  const overallConversion = 16; // Closed Won from Prospect

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
          Pipeline Health
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          Monitor pipeline velocity, stage conversion, and at-risk deals
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Pipeline Value',
            value: formatCurrency(totalValue),
            icon: DollarSign,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Avg Days in Stage',
            value: `${avgDaysAll}d`,
            icon: Clock,
            color: tokens.confidence.medium.value,
            bg: tokens.confidence.medium.bg,
          },
          {
            label: 'Stalled Deals (>30d)',
            value: stalledDeals,
            icon: AlertTriangle,
            color: tokens.confidence.low.value,
            bg: tokens.confidence.low.bg,
          },
          {
            label: 'Conversion Rate',
            value: `${overallConversion}%`,
            icon: TrendingUp,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
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

      {/* Stage Breakdown */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowRight className="size-4" style={{ color: tokens.domain.value }} />
            Stage-by-Stage Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Deal Count</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="text-right">Avg Days</TableHead>
                <TableHead className="text-right">Conversion to Next</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STAGE_DATA.map((row) => (
                <TableRow key={row.stage} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium" style={{ color: tokens.text.primary }}>
                    {row.stage}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono"
                    style={{ color: tokens.text.primary }}
                  >
                    {row.deals}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono"
                    style={{ color: tokens.text.primary }}
                  >
                    {formatCurrency(row.value)}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono"
                    style={{
                      color: row.avgDays > 20 ? tokens.confidence.low.value : tokens.text.primary,
                    }}
                  >
                    {row.avgDays > 0 ? `${row.avgDays}d` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.conversion !== null ? (
                      <span
                        className="font-medium"
                        style={{ color: getConversionColor(row.conversion) }}
                      >
                        {row.conversion}%
                      </span>
                    ) : (
                      <span style={{ color: tokens.text.muted }}>—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* At-Risk Deals */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4" style={{ color: tokens.confidence.low.value }} />
            At-Risk Deals
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 max-h-72 overflow-y-auto">
          {AT_RISK_DEALS.map((deal, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg"
              style={{
                border: `1px solid ${tokens.confidence.low.border}`,
                backgroundColor: tokens.confidence.low.bg,
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                  {deal.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: tokens.confidence.low.value }}>
                  {deal.risk}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <Badge
                  style={{
                    backgroundColor: tokens.surface.secondary,
                    color: tokens.text.secondary,
                  }}
                >
                  {deal.stage}
                </Badge>
                <span
                  className="text-xs font-mono"
                  style={{ color: tokens.confidence.medium.value }}
                >
                  {deal.daysInStage}d
                </span>
                <span className="text-sm font-bold" style={{ color: tokens.text.primary }}>
                  {formatCurrency(deal.value)}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
