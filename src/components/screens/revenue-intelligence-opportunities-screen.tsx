'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/screen-states';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  DollarSign, TrendingUp, Target, BarChart3, ArrowUpDown, Filter, Building2,
} from 'lucide-react';

// ── Mock Data ──
type OppRow = {
  id: string; company: string; currentRevenue: number; potentialRevenue: number;
  growthPct: number; confidence: number; signalsCount: number; priority: 'high' | 'medium' | 'low';
};

const initialOpps: OppRow[] = [
  { id: 'o1', company: 'Acme Corp', currentRevenue: 2400000, potentialRevenue: 420000, growthPct: 17.5, confidence: 94, signalsCount: 12, priority: 'high' },
  { id: 'o2', company: 'NovaTech', currentRevenue: 1800000, potentialRevenue: 350000, growthPct: 19.4, confidence: 88, signalsCount: 9, priority: 'high' },
  { id: 'o3', company: 'Pinnacle Health', currentRevenue: 3100000, potentialRevenue: 520000, growthPct: 16.8, confidence: 82, signalsCount: 15, priority: 'high' },
  { id: 'o4', company: 'Quantum Dynamics', currentRevenue: 980000, potentialRevenue: 180000, growthPct: 18.4, confidence: 76, signalsCount: 7, priority: 'medium' },
  { id: 'o5', company: 'SkyBridge Labs', currentRevenue: 1200000, potentialRevenue: 280000, growthPct: 23.3, confidence: 91, signalsCount: 11, priority: 'high' },
  { id: 'o6', company: 'Vertex AI', currentRevenue: 750000, potentialRevenue: 150000, growthPct: 20.0, confidence: 79, signalsCount: 6, priority: 'medium' },
  { id: 'o7', company: 'Meridian Inc', currentRevenue: 2200000, potentialRevenue: 310000, growthPct: 14.1, confidence: 72, signalsCount: 8, priority: 'medium' },
  { id: 'o8', company: 'Catalyst Systems', currentRevenue: 1600000, potentialRevenue: 240000, growthPct: 15.0, confidence: 84, signalsCount: 10, priority: 'high' },
  { id: 'o9', company: 'Horizon Labs', currentRevenue: 520000, potentialRevenue: 95000, growthPct: 18.3, confidence: 68, signalsCount: 4, priority: 'low' },
  { id: 'o10', company: 'DataFlow Inc', currentRevenue: 1900000, potentialRevenue: 270000, growthPct: 14.2, confidence: 74, signalsCount: 5, priority: 'medium' },
];

type SortKey = 'potentialRevenue' | 'confidence' | 'growthPct' | 'signalsCount';
type SortDir = 'asc' | 'desc';

// ── Helpers ──
function fmt(val: number) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

// ── Component ──
export default function RevenueIntelligenceOpportunitiesScreen() {
  const [loading, setLoading] = useState(true);
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('potentialRevenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let data = [...initialOpps];
    if (confidenceFilter === 'high') data = data.filter((o) => o.confidence >= 85);
    else if (confidenceFilter === 'medium') data = data.filter((o) => o.confidence >= 70 && o.confidence < 85);
    else if (confidenceFilter === 'low') data = data.filter((o) => o.confidence < 70);

    data.sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return (a[sortKey] - b[sortKey]) * mul;
    });
    return data;
  }, [confidenceFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const totalPotential = initialOpps.reduce((s, o) => s + o.potentialRevenue, 0);
    const highConf = initialOpps.filter((o) => o.confidence >= 85);
    const avgGrowth = initialOpps.reduce((s, o) => s + o.growthPct, 0) / initialOpps.length;
    return { totalPotential, highConfCount: highConf.length, avgGrowth };
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>Revenue Opportunities</h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>AI-identified revenue growth opportunities across your accounts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Potential Revenue', value: fmt(stats.totalPotential), icon: DollarSign, color: tokens.confidence.high.value },
          { label: 'High Confidence Opportunities', value: `${stats.highConfCount} accounts`, icon: Target, color: tokens.accent.primary },
          { label: 'Average Growth %', value: `${stats.avgGrowth.toFixed(1)}%`, icon: TrendingUp, color: tokens.gold.dark },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="py-4 gap-2">
              <CardContent className="p-4 pb-0">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                  <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>{s.label}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4" style={{ color: tokens.text.muted }} />
        <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
          <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Confidence" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Confidence</SelectItem>
            <SelectItem value="high">High (≥85%)</SelectItem>
            <SelectItem value="medium">Medium (70-84%)</SelectItem>
            <SelectItem value="low">Low (&lt;70%)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs ml-auto" style={{ color: tokens.text.muted }}>{filtered.length} of {initialOpps.length} opportunities</span>
      </div>

      {/* DataTable */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon="chart" title="No opportunities match your filters" description="Try adjusting confidence filter" className="py-16" />
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Company</TableHead>
                    <TableHead>Current Revenue</TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1" onClick={() => handleSort('potentialRevenue')}>
                        Potential Revenue <ArrowUpDown className="w-3 h-3" style={{ color: sortKey === 'potentialRevenue' ? tokens.text.primary : tokens.text.muted }} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1" onClick={() => handleSort('growthPct')}>
                        Growth % <ArrowUpDown className="w-3 h-3" style={{ color: sortKey === 'growthPct' ? tokens.text.primary : tokens.text.muted }} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1" onClick={() => handleSort('confidence')}>
                        Confidence <ArrowUpDown className="w-3 h-3" style={{ color: sortKey === 'confidence' ? tokens.text.primary : tokens.text.muted }} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1" onClick={() => handleSort('signalsCount')}>
                        Signals <ArrowUpDown className="w-3 h-3" style={{ color: sortKey === 'signalsCount' ? tokens.text.primary : tokens.text.muted }} />
                      </button>
                    </TableHead>
                    <TableHead className="pr-4">Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((opp) => (
                    <TableRow key={opp.id} className="cursor-pointer">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" style={{ color: tokens.text.muted }} />
                          <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>{opp.company}</span>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-sm" style={{ color: tokens.text.secondary }}>{fmt(opp.currentRevenue)}</span></TableCell>
                      <TableCell><span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{fmt(opp.potentialRevenue)}</span></TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm font-medium" style={{ color: tokens.confidence.high.value }}>
                          <TrendingUp className="w-3 h-3" /> +{opp.growthPct}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: tokens.neutral['100'] }}>
                            <div className="h-full rounded-full" style={{ width: `${opp.confidence}%`, backgroundColor: opp.confidence >= 85 ? tokens.confidence.high.value : opp.confidence >= 70 ? tokens.confidence.medium.value : tokens.confidence.low.value }} />
                          </div>
                          <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>{opp.confidence}%</span>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-sm" style={{ color: tokens.text.secondary }}>{opp.signalsCount}</span></TableCell>
                      <TableCell className="pr-4">
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: opp.priority === 'high' ? tokens.confidence.low.bg : opp.priority === 'medium' ? tokens.confidence.medium.bg : tokens.confidence.high.bg, color: opp.priority === 'high' ? tokens.confidence.low.value : opp.priority === 'medium' ? tokens.confidence.medium.value : tokens.confidence.high.value }}>
                          {opp.priority}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
