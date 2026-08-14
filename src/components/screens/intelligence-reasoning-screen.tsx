'use client';

import { useState, useMemo } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Activity, Brain, AlertTriangle, BarChart3, Filter, RefreshCw } from 'lucide-react';

const MOCK_RUNS = [
  {
    id: '1',
    input: 'Evaluate competitor pricing strategy for Q3',
    method: 'llm',
    model: 'GPT-4o',
    confidence: 0.92,
    duration: 3200,
    output:
      'Pricing pressure from Competitor A is increasing; recommend value-based positioning with ROI bundling.',
  },
  {
    id: '2',
    input: 'Score lead Acme Corp for enterprise tier',
    method: 'hybrid',
    model: 'Claude-3.5',
    confidence: 0.87,
    duration: 4800,
    output:
      'Acme Corp scores 84/100. Strong fit based on employee count, industry, and technology stack.',
  },
  {
    id: '3',
    input: 'Determine risk level for stalled deal #4451',
    method: 'rule',
    model: 'Rule Engine v2',
    confidence: 0.95,
    duration: 120,
    output: 'HIGH RISK: Deal stalled 42 days, no contact in 14 days, competitor activity detected.',
  },
  {
    id: '4',
    input: 'Predict close probability for Nexus deal',
    method: 'llm',
    model: 'GPT-4o',
    confidence: 0.78,
    duration: 2900,
    output:
      '65% close probability. Key concern: budget approval timeline. Strength: executive sponsor alignment.',
  },
  {
    id: '5',
    input: 'Extract entity relationships from quarterly filing',
    method: 'hybrid',
    model: 'Claude-3.5',
    confidence: 0.91,
    duration: 6100,
    output:
      'Identified 12 new entity relationships including 3 board member connections to target accounts.',
  },
  {
    id: '6',
    input: 'Validate contact email deliverability',
    method: 'rule',
    model: 'Validation Engine',
    confidence: 0.99,
    duration: 85,
    output: 'Email valid. MX records verified, SPF/DKIM/DMARC all passing.',
  },
  {
    id: '7',
    input: 'Generate account expansion opportunity analysis',
    method: 'llm',
    model: 'GPT-4o',
    confidence: 0.83,
    duration: 5400,
    output:
      'Expansion opportunity detected: Customer uses 3 of 8 modules. Security and Analytics modules are next best fit.',
  },
  {
    id: '8',
    input: 'Classify incoming support ticket severity',
    method: 'rule',
    model: 'Classification v3',
    confidence: 0.96,
    duration: 45,
    output:
      'SEVERITY: P2. Keywords match escalation pattern. Recommended: assign to senior support within 2hrs.',
  },
  {
    id: '9',
    input: 'Synthesize market signals for fintech vertical',
    method: 'hybrid',
    model: 'Claude-3.5',
    confidence: 0.74,
    duration: 7200,
    output:
      'Market trending toward embedded finance. 3 target accounts show hiring signals in payments division.',
  },
  {
    id: '10',
    input: 'Error: timeout on knowledge graph traversal',
    method: 'hybrid',
    model: 'Graph Engine',
    confidence: 0,
    duration: 30000,
    output: 'ERROR: Query exceeded 30s timeout. Graph partition may need reindexing.',
  },
];

function getConfidenceBadge(confidence: number) {
  if (confidence === 0) return <Badge variant="destructive">Error</Badge>;
  if (confidence >= 0.85)
    return (
      <Badge
        style={{
          backgroundColor: tokens.confidence.high.bg,
          color: tokens.confidence.high.value,
          borderColor: tokens.confidence.high.border,
          borderWidth: 1,
        }}
      >
        {(confidence * 100).toFixed(0)}%
      </Badge>
    );
  if (confidence >= 0.7)
    return (
      <Badge
        style={{
          backgroundColor: tokens.confidence.medium.bg,
          color: tokens.confidence.medium.value,
          borderColor: tokens.confidence.medium.border,
          borderWidth: 1,
        }}
      >
        {(confidence * 100).toFixed(0)}%
      </Badge>
    );
  return (
    <Badge
      style={{
        backgroundColor: tokens.confidence.low.bg,
        color: tokens.confidence.low.value,
        borderColor: tokens.confidence.low.border,
        borderWidth: 1,
      }}
    >
      {(confidence * 100).toFixed(0)}%
    </Badge>
  );
}

function getMethodBadge(method: string) {
  const map: Record<string, { bg: string; color: string }> = {
    llm: { bg: tokens.domain.bg, color: tokens.domain.value },
    rule: { bg: tokens.confidence.high.bg, color: tokens.confidence.high.value },
    hybrid: { bg: tokens.gold.bgMedium, color: tokens.gold.dark },
  };
  const style = map[method] || map.llm;
  return (
    <Badge
      className="uppercase text-[10px] font-bold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {method}
    </Badge>
  );
}

export default function IntelligenceReasoning() {
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredRuns = useMemo(() => {
    return MOCK_RUNS.filter((r) => {
      if (methodFilter !== 'all' && r.method !== methodFilter) return false;
      if (search && !r.input.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [methodFilter, search]);

  const stats = useMemo(() => {
    const today = MOCK_RUNS.filter((r) => r.confidence > 0);
    const errors = MOCK_RUNS.filter((r) => r.confidence === 0);
    const models = new Set(MOCK_RUNS.map((r) => r.model));
    const avgConf = today.reduce((a, b) => a + b.confidence, 0) / today.length;
    return {
      runsToday: MOCK_RUNS.length,
      avgConfidence: (avgConf * 100).toFixed(1),
      modelsUsed: models.size,
      errors: errors.length,
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Intelligence Reasoning Engine
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Monitor AI reasoning runs, model performance, and inference logs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Reasoning Runs Today',
            value: stats.runsToday,
            icon: Brain,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Avg Confidence',
            value: `${stats.avgConfidence}%`,
            icon: BarChart3,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Models Used',
            value: stats.modelsUsed,
            icon: Activity,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'Errors',
            value: stats.errors,
            icon: AlertTriangle,
            color: tokens.confidence.low.value,
            bg: tokens.confidence.low.bg,
          },
        ].map((stat) => (
          <Card key={stat.label} className="gap-4 py-4">
            <CardContent className="flex items-center gap-4">
              <div
                className="flex items-center justify-center size-10 rounded-lg"
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

      {/* Filters */}
      <Card className="gap-4 py-4">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
              style={{ color: tokens.text.muted }}
            />
            <Input
              placeholder="Search reasoning inputs..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filter by method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="llm">LLM</SelectItem>
              <SelectItem value="rule">Rule</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs" style={{ color: tokens.text.muted }}>
            {filteredRuns.length} of {MOCK_RUNS.length} runs
          </span>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="gap-0 py-0 overflow-hidden">
        <CardContent className="p-0 max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                <TableHead className="w-[200px]">Input</TableHead>
                <TableHead className="w-[90px]">Method</TableHead>
                <TableHead className="w-[120px]">Model</TableHead>
                <TableHead className="w-[100px]">Confidence</TableHead>
                <TableHead className="w-[90px]">Duration</TableHead>
                <TableHead>Output Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div
                      className="flex items-center justify-center gap-2"
                      style={{ color: tokens.text.muted }}
                    >
                      <RefreshCw className="size-4 animate-spin" />
                      Loading reasoning runs...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRuns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center"
                    style={{ color: tokens.text.muted }}
                  >
                    No reasoning runs match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRuns.map((run) => (
                  <TableRow key={run.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell
                      className="font-medium max-w-[200px] truncate"
                      style={{ color: tokens.text.primary }}
                    >
                      {run.input}
                    </TableCell>
                    <TableCell>{getMethodBadge(run.method)}</TableCell>
                    <TableCell className="text-xs" style={{ color: tokens.text.secondary }}>
                      {run.model}
                    </TableCell>
                    <TableCell>{getConfidenceBadge(run.confidence)}</TableCell>
                    <TableCell
                      className="text-xs font-mono"
                      style={{ color: tokens.text.secondary }}
                    >
                      {run.duration >= 1000
                        ? `${(run.duration / 1000).toFixed(1)}s`
                        : `${run.duration}ms`}
                    </TableCell>
                    <TableCell
                      className="text-xs max-w-[300px] truncate"
                      style={{ color: tokens.text.secondary }}
                    >
                      {run.output}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
