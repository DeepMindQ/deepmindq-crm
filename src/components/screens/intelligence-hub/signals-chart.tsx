'use client';

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { C } from './hub-types';

// ═══════════════════════════════════════════════════════════════
// CHART TOOLTIP
// ═══════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-lg"
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
      }}
    >
      <p className="text-xs font-medium mb-1.5" style={{ color: C.textSecondary }}>
        {label}
      </p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span style={{ color: C.textPrimary }}>{entry.name}: </span>
          <span className="font-semibold" style={{ color: C.textPrimary }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════════
// SIGNALS CHART
// ═══════════════════════════════════════════════════════════════

export interface SignalsChartProps {
  chartData: { day: string; signals: number; criticals: number }[];
}

export function SignalsChart({ chartData }: SignalsChartProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
    >
      <div className="h-[200px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="signalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.danger} stopOpacity={0.2} />
                <stop offset="95%" stopColor={C.danger} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: C.textMuted, fontSize: 11 }}
              axisLine={{ stroke: C.border }}
              tickLine={false}
            />
            <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <RechartsTooltip
              content={<ChartTooltipContent />}
              cursor={{ stroke: C.border, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="signals"
              stroke={C.accent}
              strokeWidth={2}
              fill="url(#signalGradient)"
              name="All Signals"
            />
            <Area
              type="monotone"
              dataKey="criticals"
              stroke={C.danger}
              strokeWidth={2}
              fill="url(#criticalGradient)"
              name="Critical"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: C.accent }} />
          <span className="text-[11px]" style={{ color: C.textSecondary }}>
            All Signals
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: C.danger }} />
          <span className="text-[11px]" style={{ color: C.textSecondary }}>
            Critical
          </span>
        </div>
      </div>
    </div>
  );
}
