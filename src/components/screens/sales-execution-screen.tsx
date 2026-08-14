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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Phone, Mail, Calendar, Trophy, Users, ArrowRight } from 'lucide-react';

const ACTIVITY_BY_DAY = [
  { day: 'Mon', calls: 42, emails: 87, meetings: 8 },
  { day: 'Tue', calls: 56, emails: 94, meetings: 12 },
  { day: 'Wed', calls: 38, emails: 78, meetings: 10 },
  { day: 'Thu', calls: 61, emails: 102, meetings: 14 },
  { day: 'Fri', calls: 45, emails: 89, meetings: 9 },
  { day: 'Sat', calls: 5, emails: 12, meetings: 1 },
  { day: 'Sun', calls: 2, emails: 8, meetings: 0 },
];

const FUNNEL_DATA = [
  { stage: 'Calls Made', value: 249, pct: 100 },
  { stage: 'Emails Sent', value: 470, pct: 100 },
  { stage: 'Emails Opened', value: 314, pct: 66.8 },
  { stage: 'Replies Received', value: 89, pct: 18.9 },
  { stage: 'Meetings Booked', value: 54, pct: 11.5 },
  { stage: 'Demos Delivered', value: 38, pct: 8.1 },
  { stage: 'Proposals Sent', value: 22, pct: 4.7 },
  { stage: 'Deals Won', value: 16, pct: 3.4 },
];

const REP_LEADERBOARD = [
  { name: 'Alex Kim', role: 'AE', calls: 67, emails: 142, meetings: 18, wins: 5, value: 320000 },
  { name: 'Jordan Lee', role: 'AE', calls: 58, emails: 128, meetings: 15, wins: 4, value: 285000 },
  {
    name: 'Casey Morgan',
    role: 'AE',
    calls: 52,
    emails: 118,
    meetings: 12,
    wins: 3,
    value: 210000,
  },
  {
    name: 'Taylor Brooks',
    role: 'SDR',
    calls: 45,
    emails: 96,
    meetings: 6,
    wins: 2,
    value: 140000,
  },
  { name: 'Reese Patel', role: 'SDR', calls: 38, emails: 84, meetings: 4, wins: 1, value: 85000 },
  { name: 'Dakota Chen', role: 'SDR', calls: 32, emails: 72, meetings: 3, wins: 1, value: 64000 },
];

const activityConfig = {
  calls: { label: 'Calls', color: tokens.accent.primary },
  emails: { label: 'Emails', color: tokens.domain.value },
  meetings: { label: 'Meetings', color: tokens.confidence.high.value },
};

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

function getFunnelWidth(pct: number) {
  return Math.max(pct, 15);
}

export default function SalesExecution() {
  const totalCalls = 249;
  const totalEmails = 470;
  const totalMeetings = 54;
  const totalWins = 16;

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
            label: 'Calls Made (Week)',
            value: totalCalls,
            icon: Phone,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'Emails Sent (Week)',
            value: totalEmails,
            icon: Mail,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Meetings Booked (Week)',
            value: totalMeetings,
            icon: Calendar,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Deals Won (Week)',
            value: totalWins,
            icon: Trophy,
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

      {/* Activity by Day Chart */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold">Activity by Day (This Week)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={activityConfig} className="h-[280px] w-full">
            <BarChart data={ACTIVITY_BY_DAY}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border.default} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: tokens.text.secondary }} />
              <YAxis tick={{ fontSize: 12, fill: tokens.text.secondary }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="calls" fill={tokens.accent.primary} radius={[3, 3, 0, 0]} />
              <Bar dataKey="emails" fill={tokens.domain.value} radius={[3, 3, 0, 0]} />
              <Bar dataKey="meetings" fill={tokens.confidence.high.value} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {FUNNEL_DATA.map((step) => (
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

        {/* Rep Leaderboard */}
        <Card className="gap-4 py-4">
          <CardHeader className="pb-0 pt-0 px-6">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4" style={{ color: tokens.gold.dark }} />
              Rep Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Emails</TableHead>
                  <TableHead className="text-right">Meetings</TableHead>
                  <TableHead className="text-right">Wins</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {REP_LEADERBOARD.map((rep, idx) => (
                  <TableRow key={rep.name} className="hover:bg-muted/50 transition-colors">
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
                            {rep.name}
                          </p>
                          <p className="text-[10px]" style={{ color: tokens.text.muted }}>
                            {rep.role}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-right font-mono text-xs"
                      style={{ color: tokens.text.secondary }}
                    >
                      {rep.calls}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono text-xs"
                      style={{ color: tokens.text.secondary }}
                    >
                      {rep.emails}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono text-xs"
                      style={{ color: tokens.text.secondary }}
                    >
                      {rep.meetings}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono text-xs font-medium"
                      style={{ color: tokens.confidence.high.value }}
                    >
                      {rep.wins}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono text-xs font-medium"
                      style={{ color: tokens.text.primary }}
                    >
                      {formatCurrency(rep.value)}
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
