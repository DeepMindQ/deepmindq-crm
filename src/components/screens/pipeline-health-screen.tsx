'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Activity, Clock, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { LoadingSkeleton, ErrorPanel } from '@/components/ui/screen-states';

interface StatusItem {
  status: string;
  count: number;
}

interface SeverityItem {
  severity: string;
  count: number;
}

interface RecentSignal {
  id: string;
  title: string;
  signalType: string;
  severity: string;
  status: string;
  organizationName: string;
  detectedAt: string;
}

interface PipelineHealthData {
  statusBreakdown: StatusItem[];
  severityBreakdown: SeverityItem[];
  recentSignals: RecentSignal[];
  avgConfidence: number;
  totalSignals: number;
}

function formatSeverity(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function getConfidenceColor(pct: number) {
  if (pct >= 65) return tokens.confidence.high.value;
  if (pct >= 45) return tokens.confidence.medium.value;
  return tokens.confidence.low.value;
}

function getSeverityBg(severity: string): string {
  switch (severity) {
    case 'critical':
      return tokens.confidence.low.bg;
    case 'high':
      return tokens.confidence.medium.bg;
    default:
      return tokens.accent.subtle;
  }
}

function getSeverityBorder(severity: string): string {
  switch (severity) {
    case 'critical':
      return tokens.confidence.low.border;
    case 'high':
      return tokens.confidence.medium.border;
    default:
      return tokens.border.default;
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return tokens.confidence.low.value;
    case 'high':
      return tokens.confidence.medium.value;
    default:
      return tokens.confidence.high.value;
  }
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

export default function PipelineHealth() {
  const [data, setData] = useState<PipelineHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchApi<PipelineHealthData>('/api/pipeline-health');
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

  // Stats derived from API data
  const actedCount = data?.statusBreakdown.find((s) => s.status === 'acted_upon')?.count || 0;
  const detectedCount = data?.statusBreakdown.find((s) => s.status === 'detected')?.count || 0;
  const criticalCount = data?.severityBreakdown.find((s) => s.severity === 'critical')?.count || 0;
  const highCount = data?.severityBreakdown.find((s) => s.severity === 'high')?.count || 0;
  const atRiskCount = criticalCount + highCount;

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Pipeline Health
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Monitor pipeline velocity, stage conversion, and at-risk deals
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
            Pipeline Health
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Monitor pipeline velocity, stage conversion, and at-risk deals
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
            label: 'Total Signals',
            value: data.totalSignals,
            icon: Activity,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Avg Confidence',
            value: data.avgConfidence.toFixed(1),
            icon: TrendingUp,
            color: tokens.confidence.medium.value,
            bg: tokens.confidence.medium.bg,
          },
          {
            label: 'At-Risk Signals',
            value: atRiskCount,
            icon: AlertTriangle,
            color: tokens.confidence.low.value,
            bg: tokens.confidence.low.bg,
          },
          {
            label: 'Acted Upon',
            value: `${actedCount}/${data.totalSignals}`,
            icon: Clock,
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

      {/* Status Breakdown */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowRight className="size-4" style={{ color: tokens.domain.value }} />
            Signal Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
                <TableHead className="text-right">Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.statusBreakdown.map((row) => {
                const pct =
                  data.totalSignals > 0 ? Math.round((row.count / data.totalSignals) * 100) : 0;
                return (
                  <TableRow key={row.status} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium" style={{ color: tokens.text.primary }}>
                      {row.status
                        .split('_')
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ')}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono"
                      style={{ color: tokens.text.primary }}
                    >
                      {row.count}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono"
                      style={{ color: tokens.text.primary }}
                    >
                      {pct}%
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className="font-medium"
                        style={{
                          color:
                            row.status === 'acted_upon'
                              ? tokens.confidence.high.value
                              : row.status === 'detected'
                                ? tokens.confidence.medium.value
                                : tokens.confidence.low.value,
                        }}
                      >
                        {row.status === 'acted_upon'
                          ? 'Healthy'
                          : row.status === 'detected'
                            ? 'Pending'
                            : 'Stale'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Severity Indicators */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4" style={{ color: tokens.confidence.medium.value }} />
            Severity Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
                <TableHead className="text-right">Risk Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.severityBreakdown.map((row) => {
                const pct =
                  data.totalSignals > 0 ? Math.round((row.count / data.totalSignals) * 100) : 0;
                return (
                  <TableRow key={row.severity} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium" style={{ color: tokens.text.primary }}>
                      {formatSeverity(row.severity)}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono"
                      style={{ color: tokens.text.primary }}
                    >
                      {row.count}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono"
                      style={{ color: tokens.text.primary }}
                    >
                      {pct}%
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className="font-medium"
                        style={{ color: getSeverityColor(row.severity) }}
                      >
                        {row.severity === 'critical'
                          ? 'Critical'
                          : row.severity === 'high'
                            ? 'Elevated'
                            : row.severity === 'medium'
                              ? 'Moderate'
                              : 'Low'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Signals */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4" style={{ color: tokens.confidence.low.value }} />
            Recent Signals
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 max-h-72 overflow-y-auto">
          {data.recentSignals.map((signal) => (
            <div
              key={signal.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg"
              style={{
                border: `1px solid ${getSeverityBorder(signal.severity)}`,
                backgroundColor: getSeverityBg(signal.severity),
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                  {signal.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: tokens.confidence.low.value }}>
                  {signal.organizationName} · {formatDate(signal.detectedAt)}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <Badge
                  style={{
                    backgroundColor: tokens.surface.secondary,
                    color: tokens.text.secondary,
                  }}
                >
                  {signal.severity}
                </Badge>
                <Badge
                  variant="outline"
                  style={{
                    borderColor: tokens.border.default,
                    color: tokens.text.secondary,
                  }}
                >
                  {signal.status
                    .split('_')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ')}
                </Badge>
                <span
                  className="text-xs font-mono"
                  style={{ color: tokens.confidence.medium.value }}
                >
                  {signal.signalType}
                </span>
              </div>
            </div>
          ))}
          {data.recentSignals.length === 0 && (
            <div className="text-center py-8" style={{ color: tokens.text.muted }}>
              No signals detected yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
