'use client';

/**
 * Phase 3 — Item 3.1: Calibration Dashboard
 *
 * Admin screen for monitoring confidence calibration status across all dimensions.
 * Shows:
 *   - Overall calibration accuracy
 *   - Per-dimension correction factors
 *   - Calibration curve buckets (10-point buckets)
 *   - Sample counts and status
 *   - Recent calibration events
 *
 * Consumes: GET /api/intelligence/calibration?dimension=xxx
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Target,
  RefreshCw,
  Activity,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { EnterpriseLoading, EnterpriseEmptyState } from '@/components/enterprise';

// ── Types ──

interface CalibrationDimension {
  dimension: string;
  status: string;
  sampleCount: number;
  accuracy: number;
  correctionFactor: number;
  lastCalibratedAt: string | null;
  buckets: Record<string, { correct: number; total: number }>;
}

interface CalibrationOverview {
  dimensions: CalibrationDimension[];
  totalSamples: number;
  isCalibrated: boolean;
}

const DIMENSIONS = [
  { key: 'overall', label: 'Overall', description: 'Unified confidence accuracy' },
  { key: 'data_quality', label: 'Data Quality', description: 'Input data validation accuracy' },
  { key: 'source_reliability', label: 'Source Reliability', description: 'External source trust accuracy' },
  { key: 'freshness', label: 'Freshness', description: 'Temporal relevance accuracy' },
  { key: 'cross_validation', label: 'Cross Validation', description: 'Multi-source corroboration accuracy' },
  { key: 'evidence_coverage', label: 'Evidence Coverage', description: 'Evidence completeness scoring accuracy' },
  { key: 'ai_certainty', label: 'AI Certainty', description: 'AI model confidence prediction accuracy' },
] as const;

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: typeof CheckCircle2; label: string }> = {
  calibrated: { color: 'text-emerald-700', bgColor: 'bg-emerald-50', icon: CheckCircle2, label: 'Calibrated' },
  partially_calibrated: { color: 'text-amber-700', bgColor: 'bg-amber-50', icon: TrendingUp, label: 'Partially Calibrated' },
  uncalibrated: { color: 'text-red-700', bgColor: 'bg-red-50', icon: AlertTriangle, label: 'Uncalibrated' },
};

// ── Component ──

export function CalibrationDashboardScreen() {
  const [selectedDimension, setSelectedDimension] = useState<string>('overall');
  const [calibrationData, setCalibrationData] = useState<Record<string, CalibrationDimension>>({});
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchAllDimensions = useCallback(async () => {
    setLoading(true);
    const data: Record<string, CalibrationDimension> = {};

    const promises = DIMENSIONS.map(async (dim) => {
      try {
        const res = await fetch(`/api/intelligence/calibration?dimension=${dim.key}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            data[dim.key] = json.data as CalibrationDimension;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch calibration for ${dim.key}`, err);
      }
    });

    await Promise.all(promises);
    setCalibrationData(data);
    setLoading(false);
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => {
    fetchAllDimensions();
  }, [fetchAllDimensions]);

  const overall = calibrationData['overall'];
  const totalSamples = Object.values(calibrationData).reduce((sum, d) => sum + d.sampleCount, 0);
  const calibratedCount = Object.values(calibrationData).filter(d => d.status === 'calibrated').length;

  const selected = calibrationData[selectedDimension];
  const bucketEntries = selected?.buckets ? Object.entries(selected.buckets) : [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6" />
            Confidence Calibration Dashboard
          </h1>
          <p className="text-sm text-[var(--primary-dim)] mt-1">
            Monitor and improve AI prediction accuracy across all intelligence dimensions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--primary-dim)]">
            {lastRefreshed ? `Last refreshed: ${lastRefreshed.toLocaleTimeString()}` : ''}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAllDimensions}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium text-[var(--primary-dim)]">Total Samples</span>
            </div>
            <div className="text-2xl font-bold">{totalSamples}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium text-[var(--primary-dim)]">Calibrated Dimensions</span>
            </div>
            <div className="text-2xl font-bold">{calibratedCount}/{DIMENSIONS.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-medium text-[var(--primary-dim)]">Overall Accuracy</span>
            </div>
            <div className="text-2xl font-bold">
              {overall ? `${(overall.accuracy * 100).toFixed(1)}%` : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-[var(--primary-dim)]">Correction Factor</span>
            </div>
            <div className="text-2xl font-bold">
              {overall ? overall.correctionFactor.toFixed(3) : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dimension Selector + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dimension List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Dimensions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DIMENSIONS.map((dim) => {
              const data = calibrationData[dim.key];
              const statusCfg = STATUS_CONFIG[data?.status || 'uncalibrated'];
              const StatusIcon = statusCfg.icon;

              return (
                <button
                  key={dim.key}
                  onClick={() => setSelectedDimension(dim.key)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedDimension === dim.key
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                      : 'border-transparent hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{dim.label}</div>
                      <div className="text-xs text-[var(--primary-dim)]">{dim.description}</div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${statusCfg.color} ${statusCfg.bgColor} border-current/20`}
                    >
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusCfg.label}
                    </Badge>
                  </div>
                  {data && (
                    <div className="mt-2 flex items-center gap-4 text-xs text-[var(--primary-dim)]">
                      <span>{data.sampleCount} samples</span>
                      <span>Accuracy: {(data.accuracy * 100).toFixed(1)}%</span>
                      <span>Factor: {data.correctionFactor.toFixed(3)}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Selected Dimension Detail */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {DIMENSIONS.find(d => d.key === selectedDimension)?.label}
              {selected && (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${STATUS_CONFIG[selected.status]?.color} ${STATUS_CONFIG[selected.status]?.bgColor} border-current/20`}
                >
                  {STATUS_CONFIG[selected.status]?.label}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <EnterpriseLoading message="Loading calibration data..." />
            ) : selected ? (
              <div className="space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-lg font-bold">{selected.sampleCount}</div>
                    <div className="text-xs text-[var(--primary-dim)]">Samples</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-lg font-bold">{(selected.accuracy * 100).toFixed(1)}%</div>
                    <div className="text-xs text-[var(--primary-dim)]">Accuracy</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-lg font-bold">{selected.correctionFactor.toFixed(3)}</div>
                    <div className="text-xs text-[var(--primary-dim)]">Correction Factor</div>
                  </div>
                </div>

                {/* Calibration Curve (10-point buckets) */}
                {bucketEntries.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Calibration Curve (10-Point Buckets)</h3>
                    <div className="space-y-1.5">
                      {bucketEntries
                        .sort(([a], [b]) => {
                          const numA = parseInt(a.split('-')[0], 10);
                          const numB = parseInt(b.split('-')[0], 10);
                          return numA - numB;
                        })
                        .map(([bucket, { correct, total }]) => {
                          const pct = total > 0 ? (correct / total) * 100 : 0;
                          const bucketRange = bucket.replace(/_/g, '-');
                          return (
                            <div key={bucket} className="flex items-center gap-3">
                              <span className="text-xs w-16 text-right text-[var(--primary-dim)]">{bucketRange}</span>
                              <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                                <div
                                  className={`h-full rounded transition-all ${
                                    pct >= 70
                                      ? 'bg-emerald-500'
                                      : pct >= 40
                                        ? 'bg-amber-500'
                                        : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.max(pct, 2)}%` }}
                                />
                              </div>
                              <span className="text-xs w-20 text-right">
                                {correct}/{total} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Last calibrated */}
                {selected.lastCalibratedAt && (
                  <div className="text-xs text-[var(--primary-dim)]">
                    Last calibrated: {new Date(selected.lastCalibratedAt).toLocaleString()}
                  </div>
                )}

                {/* Empty state */}
                {bucketEntries.length === 0 && selected.status === 'uncalibrated' && (
                  <EnterpriseEmptyState
                    icon={AlertTriangle}
                    title="Not Yet Calibrated"
                    description="This dimension needs at least 10 outcome records before calibration can begin. Record outcomes via the feedback loop on recommendation cards."
                  />
                )}
              </div>
            ) : (
              <EnterpriseEmptyState
                icon={Target}
                title="No data available"
                description="Calibration data for this dimension is not yet available."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
