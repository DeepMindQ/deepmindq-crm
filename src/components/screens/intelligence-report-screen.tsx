'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft, Building2, TrendingUp, Shield, Target, AlertTriangle,
  Clock, BarChart3, FileWarning, FileText, Download, Eye, Printer,
  CheckCircle2, XCircle, Lightbulb, Users, Sparkles, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/enterprise/LoadingState';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { EmptyState } from '@/components/shared/design-system';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
type BriefData = {
  company: { name: string; industry: string; location: string; sizeRange: string; website: string };
  overallScore?: number;
  confidence?: string;
  summary?: string;
  overview?: string;
  keyThemes?: string[];
  risks?: string[];
  positiveFactors?: Factor[];
  negativeFactors?: Factor[];
  breakdown?: { signalQuality: number; evidenceQuality: number; capabilityFit: number; dataCompleteness: number };
  evidenceTimeline?: TimelineEntry[];
  capabilityMatch?: Record<string, unknown>;
  recommendation: {
    priority?: string;
    entryPoint: string;
    reason: string;
    target?: string;
    conversation?: string;
  };
  conflicts: Array<{ type: string; description: string; severity: string }>;
  evidenceStats: { total: number; highQuality: number; mediumQuality?: number; lowQuality?: number; sources?: number; avgRelevance?: number };
};

interface Factor { factor: string; impact: string; }
interface TimelineEntry { date: string; event: string; type: string; }

interface GeneratedReport {
  id: string;
  companyId: string;
  companyName: string;
  template: string;
  dateRange: { from: string; to: string };
  createdAt: string;
  status: 'completed' | 'generating' | 'failed';
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBarBg(score: number): string {
  if (score >= 80) return 'bg-emerald-400';
  if (score >= 60) return 'bg-amber-400';
  return 'bg-red-400';
}

function confidenceBadgeClass(confidence: string): string {
  switch (confidence.toLowerCase()) {
    case 'high': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function severityBadgeClass(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'HIGH': case 'CRITICAL': return 'bg-red-100 text-red-700';
    case 'MEDIUM': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

const TEMPLATES = [
  { id: 'executive', name: 'Executive Brief', description: 'C-suite summary with key insights and recommendations' },
  { id: 'detailed', name: 'Detailed Analysis', description: 'Comprehensive analysis with evidence and data' },
  { id: 'opportunity', name: 'Opportunity Assessment', description: 'Focus on actionable opportunities and entry points' },
  { id: 'competitive', name: 'Competitive Landscape', description: 'Competitive positioning and market analysis' },
];

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-4">
      {children}
    </h2>
  );
}

function EvidenceBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700 font-medium">{label}</span>
        <span className="text-slate-400 text-xs">{value} / {max}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-400 transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-4 w-full max-w-xl" />
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceReportScreen({
  companyId,
  navigateTo,
}: {
  companyId?: string;
  navigateTo?: (screen: string, companyId?: string) => void;
}) {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'builder' | 'reports'>('builder');

  // Builder state
  const [selectedTemplate, setSelectedTemplate] = useState('executive');
  const [dateFrom, setDateFrom] = useState('2024-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Mock generated reports
  const [generatedReports] = useState<GeneratedReport[]>([
    { id: 'r-1', companyId: 'comp-1', companyName: 'Acme Corp', template: 'Executive Brief', dateRange: { from: '2024-01-01', to: '2025-01-15' }, createdAt: '2025-01-15T10:00:00Z', status: 'completed' },
    { id: 'r-2', companyId: 'comp-2', companyName: 'TechVenture Inc', template: 'Detailed Analysis', dateRange: { from: '2024-06-01', to: '2025-01-15' }, createdAt: '2025-01-14T14:00:00Z', status: 'completed' },
    { id: 'r-3', companyId: 'comp-1', companyName: 'Acme Corp', template: 'Opportunity Assessment', dateRange: { from: '2024-01-01', to: '2025-01-10' }, createdAt: '2025-01-10T08:00:00Z', status: 'completed' },
  ]);

  useEffect(() => {
    async function fetchBrief() {
      if (!companyId) { setLoading(false); return; }
      try {
        const [healthRes] = await Promise.allSettled([
          fetch(`/api/g-intelligence/companies/${companyId}/health`).then(r => r.json()),
        ]);
        if (healthRes.status === 'fulfilled' && healthRes.value) {
          setBrief(healthRes.value);
        }
      } catch (e) {
        console.error('Failed to load brief:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchBrief();
  }, [companyId]);

  if (loading) return <ReportSkeleton />;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Report Builder</h2>
            <p className="text-sm text-slate-500">Generate executive intelligence reports with custom templates</p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <button onClick={() => setActiveView('builder')}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              activeView === 'builder' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50')}>
            Builder
          </button>
          <button onClick={() => setActiveView('reports')}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              activeView === 'reports' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50')}>
            Reports ({generatedReports.length})
          </button>
        </div>
      </div>

      {activeView === 'builder' ? (
        /* ═══════════════════════════════════════════════════════════
           Report Builder View
           ═══════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Configuration</h3>

              {/* Template Selection */}
              <div className="space-y-1.5 mb-4">
                <label className="text-xs font-medium text-slate-500">Template</label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="h-9 border-slate-200 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template cards */}
              <div className="space-y-2">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={cn(
                      'w-full text-left rounded-lg border p-3 transition-all',
                      selectedTemplate === t.id
                        ? 'border-blue-300 bg-blue-50/50 ring-1 ring-blue-200'
                        : 'border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <p className={cn('text-xs font-semibold', selectedTemplate === t.id ? 'text-blue-700' : 'text-slate-700')}>
                      {t.name}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{t.description}</p>
                  </button>
                ))}
              </div>

              {/* Date Range */}
              <div className="mt-4 space-y-2">
                <label className="text-xs font-medium text-slate-500">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="h-9 text-xs border-slate-200" />
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="h-9 text-xs border-slate-200" />
                </div>
              </div>

              {/* Sections */}
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-500 mb-2 block">Include Sections</label>
                <div className="space-y-2">
                  {['Company Overview', 'Key Themes', 'Risk Analysis', 'Evidence', 'Recommendation', 'Conflicts'].map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Report
              </Button>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-slate-900">Report Preview</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs border-slate-200 gap-1.5">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </Button>
                  <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </div>

              {brief ? (
                <div className="space-y-8 max-w-none">
                  {/* Executive header */}
                  <div className="border-b border-slate-200 pb-6">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Intelligence Report</p>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1">{brief.company?.name || 'Company Intelligence Brief'}</h1>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {brief.company?.industry}</span>
                      <span>·</span>
                      <span>{dateFrom} — {dateTo}</span>
                      <span>·</span>
                      {brief.confidence && <Badge variant="outline" className={cn('text-[10px]', confidenceBadgeClass(brief.confidence))}>{brief.confidence} Confidence</Badge>}
                    </div>
                  </div>

                  {/* Score */}
                  {brief.overallScore !== undefined && (
                    <div className="flex items-center gap-6">
                      <ConfidenceBar value={brief.overallScore} label="Overall Intelligence Score" size="lg" />
                    </div>
                  )}

                  {/* Summary */}
                  {(brief.summary || brief.overview) && (
                    <div>
                      <SectionLabel>Summary</SectionLabel>
                      <p className="text-sm text-slate-600 leading-relaxed">{brief.summary || brief.overview}</p>
                    </div>
                  )}

                  {/* Breakdown */}
                  {brief.breakdown && (
                    <div>
                      <SectionLabel>Quality Breakdown</SectionLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { label: 'Signal Quality', value: brief.breakdown.signalQuality },
                          { label: 'Evidence Quality', value: brief.breakdown.evidenceQuality },
                          { label: 'Capability Fit', value: brief.breakdown.capabilityFit },
                          { label: 'Data Completeness', value: brief.breakdown.dataCompleteness },
                        ].map(dim => (
                          <div key={dim.label} className="rounded-lg border border-slate-200 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-slate-600">{dim.label}</span>
                              <span className={cn('text-lg font-bold', getScoreColor(dim.value))}>{dim.value}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className={cn('h-full rounded-full', getScoreBarBg(dim.value))} style={{ width: `${dim.value}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evidence Stats */}
                  {brief.evidenceStats && (
                    <div>
                      <SectionLabel>Evidence</SectionLabel>
                      <div className="grid grid-cols-3 gap-3">
                        <EvidenceBar label="Total" value={brief.evidenceStats.total} max={brief.evidenceStats.total || 1} />
                        <EvidenceBar label="High Quality" value={brief.evidenceStats.highQuality} max={brief.evidenceStats.total || 1} />
                        <EvidenceBar label="Low Quality" value={brief.evidenceStats.lowQuality ?? 0} max={brief.evidenceStats.total || 1} />
                      </div>
                    </div>
                  )}

                  {/* Risks */}
                  {brief.risks && brief.risks.length > 0 && (
                    <div>
                      <SectionLabel>Risks</SectionLabel>
                      <div className="space-y-2">
                        {brief.risks.map((risk, i) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-red-50/50 border border-red-100">
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{risk}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendation */}
                  {brief.recommendation && (
                    <div>
                      <SectionLabel>Recommendation</SectionLabel>
                      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Suggested Action</span>
                          {brief.recommendation.priority && (
                            <Badge variant="outline" className={cn('text-[10px]', severityBadgeClass(brief.recommendation.priority))}>
                              {brief.recommendation.priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{brief.recommendation.reason}</p>
                        {brief.recommendation.entryPoint && (
                          <p className="text-xs text-blue-600 mt-2 font-medium">Entry Point: {brief.recommendation.entryPoint}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No report data"
                  description="Select a company and configure the template to generate a report."
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════
           Generated Reports List
           ═══════════════════════════════════════════════════════════ */
        <div className="space-y-3">
          {generatedReports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports generated"
              description="Use the Report Builder to generate your first intelligence report."
              actionLabel="Go to Builder"
              onAction={() => setActiveView('builder')}
            />
          ) : (
            generatedReports.map(report => (
              <div key={report.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{report.companyName}</h3>
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        {report.template}
                      </Badge>
                      <Badge variant="outline" className={cn(
                        'text-[10px]',
                        report.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        report.status === 'generating' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      )}>
                        {report.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>{report.dateRange.from} — {report.dateRange.to}</span>
                      <span>·</span>
                      <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs border-slate-200 gap-1.5">
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </Button>
                  <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
