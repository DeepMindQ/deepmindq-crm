'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  Eye,
  FileWarning,
  Info,
} from 'lucide-react';

interface TrustReport {
  recommendation: {
    id: string;
    title: string;
    company: string;
    confidenceScore: number;
  };
  overallConfidence: number;
  breakdown: {
    signalQuality: number;
    evidenceQuality: number;
    capabilityFit: number;
    dataCompleteness: number;
    overall: number;
  } | null;
  factors: {
    positiveFactors: { factor: string; impact: string; category: string }[];
    negativeFactors: { factor: string; impact: string; category: string }[];
  } | null;
  supportingEvidence: {
    total: number;
    avgRelevance: number;
    validatedSignals: number;
    weakSignals: number;
  };
  conflicts: { conflictType: string; severity: string; description: string }[];
  missingIntelligence: string[];
}

function getTierColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getTierBg(score: number): string {
  if (score >= 80) return 'bg-emerald-50 border-emerald-200';
  if (score >= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function getTierLabel(score: number): string {
  if (score >= 80) return 'High Trust';
  if (score >= 60) return 'Medium Trust';
  return 'Low Trust';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'destructive';
    case 'HIGH': return 'destructive';
    case 'MEDIUM': return 'secondary';
    default: return 'outline';
  }
}

interface TrustScoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendationId: string | null;
}

export function TrustScoreModal({ open, onOpenChange, recommendationId }: TrustScoreModalProps) {
  const [data, setData] = useState<TrustReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'why' | 'evidence' | 'gaps'>('why');

  useEffect(() => {
    if (!open || !recommendationId) return;
    let cancelled = false;
    setError(null);
    setData(null);
    fetch(`/api/g-intelligence/recommendations/${recommendationId}/trust-report`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load trust report'); });
    return () => { cancelled = true; };
  }, [open, recommendationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Trust Score Report
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mx-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            {error}
          </div>
        )}

        {data && (
          <ScrollArea className="max-h-[65vh]">
            <div className="p-6 space-y-6">
              {/* Overall Confidence */}
              <div className={`rounded-lg border p-4 ${getTierBg(data.overallConfidence)}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Confidence</p>
                    <p className={`text-2xl font-bold ${getTierColor(data.overallConfidence)}`}>
                      {data.overallConfidence}%
                    </p>
                  </div>
                  <Badge variant={data.overallConfidence >= 80 ? 'default' : data.overallConfidence >= 60 ? 'secondary' : 'destructive'}>
                    {getTierLabel(data.overallConfidence)}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {data.recommendation.title} — {data.recommendation.company}
                </div>
              </div>

              {/* Breakdown bars */}
              {data.breakdown && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Signal Quality', value: data.breakdown.signalQuality, weight: '30%' },
                    { label: 'Evidence Quality', value: data.breakdown.evidenceQuality, weight: '30%' },
                    { label: 'Capability Fit', value: data.breakdown.capabilityFit, weight: '25%' },
                    { label: 'Data Completeness', value: data.breakdown.dataCompleteness, weight: '15%' },
                  ].map(dim => (
                    <div key={dim.label} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{dim.label}</span>
                        <span className="text-xs text-muted-foreground">w: {dim.weight}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${getTierColor(dim.value)}`}>{dim.value}</span>
                        <Progress value={dim.value} className="h-2 flex-1" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Tab navigation */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                {([
                  { key: 'why' as const, label: 'Why AI believes this', icon: Eye },
                  { key: 'evidence' as const, label: 'Evidence & Conflicts', icon: FileWarning },
                  { key: 'gaps' as const, label: 'Missing Intelligence', icon: Info },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab: Why AI believes this */}
              {activeTab === 'why' && data.factors && (
                <div className="space-y-4">
                  {data.factors.positiveFactors.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 mb-2">
                        <TrendingUp className="h-4 w-4" /> Positive Contributors
                      </h4>
                      <div className="space-y-1.5">
                        {data.factors.positiveFactors.map((f, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded bg-emerald-50 text-sm">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span>{f.factor}</span>
                            </div>
                            <span className="font-semibold text-emerald-700 shrink-0">{f.impact}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.factors.negativeFactors.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-2">
                        <TrendingDown className="h-4 w-4" /> Negative Contributors
                      </h4>
                      <div className="space-y-1.5">
                        {data.factors.negativeFactors.map((f, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded bg-red-50 text-sm">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                              <span>{f.factor}</span>
                            </div>
                            <span className="font-semibold text-red-700 shrink-0">{f.impact}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.factors.positiveFactors.length === 0 && data.factors.negativeFactors.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No explainability factors computed yet.
                    </p>
                  )}
                </div>
              )}

              {/* Tab: Evidence & Conflicts */}
              {activeTab === 'evidence' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border text-center">
                      <p className="text-2xl font-bold">{data.supportingEvidence.total}</p>
                      <p className="text-xs text-muted-foreground">Evidence Items</p>
                    </div>
                    <div className="p-3 rounded-lg border text-center">
                      <p className="text-2xl font-bold">{data.supportingEvidence.avgRelevance}%</p>
                      <p className="text-xs text-muted-foreground">Avg Relevance</p>
                    </div>
                    <div className="p-3 rounded-lg border text-center">
                      <p className="text-2xl font-bold text-emerald-600">{data.supportingEvidence.validatedSignals}</p>
                      <p className="text-xs text-muted-foreground">Valid Signals</p>
                    </div>
                    <div className="p-3 rounded-lg border text-center">
                      <p className="text-2xl font-bold text-amber-600">{data.supportingEvidence.weakSignals}</p>
                      <p className="text-xs text-muted-foreground">Weak Signals</p>
                    </div>
                  </div>

                  {data.conflicts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Active Conflicts</h4>
                      <div className="space-y-2">
                        {data.conflicts.map((c, i) => (
                          <div key={i} className="p-3 rounded-lg border flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={getSeverityColor(c.severity) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                                  {c.severity}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{c.conflictType}</span>
                              </div>
                              <p className="text-sm">{c.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.conflicts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active conflicts detected.
                    </p>
                  )}
                </div>
              )}

              {/* Tab: Missing Intelligence */}
              {activeTab === 'gaps' && (
                <div>
                  {data.missingIntelligence.length > 0 ? (
                    <div className="space-y-2">
                      {data.missingIntelligence.map((gap, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="text-sm">{gap}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-8 text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm font-medium">All intelligence data is complete</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
