'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Download,
  Eye,
  Plus,
  Clock,
  FileBarChart,
  Building2,
  Loader2,
} from 'lucide-react';

const REPORT_TYPES = [
  { value: 'account-intel', label: 'Account Intelligence Brief' },
  { value: 'competitive', label: 'Competitive Landscape' },
  { value: 'market', label: 'Market Analysis' },
  { value: 'pipeline', label: 'Pipeline Review' },
  { value: 'win-loss', label: 'Win/Loss Analysis' },
];

const ORGANIZATIONS = [
  { id: 'acme', name: 'Acme Corporation' },
  { id: 'nexus', name: 'Nexus Technologies' },
  { id: 'vertex', name: 'Vertex Solutions' },
  { id: 'stellar', name: 'Stellar Dynamics' },
  { id: 'quantum', name: 'Quantum Leap Inc' },
];

const SECTIONS = [
  { id: 'exec-summary', label: 'Executive Summary' },
  { id: 'key-metrics', label: 'Key Metrics' },
  { id: 'signals', label: 'Signal Analysis' },
  { id: 'competitive', label: 'Competitive Positioning' },
  { id: 'risks', label: 'Risk Assessment' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'appendix', label: 'Appendix & Raw Data' },
];

const RECENT_REPORTS = [
  {
    id: '1',
    name: 'Q3 Account Intelligence - Acme Corp',
    type: 'account-intel',
    date: '2024-12-18',
    status: 'completed',
    pages: 24,
  },
  {
    id: '2',
    name: 'Competitive Landscape - Fintech Vertical',
    type: 'competitive',
    date: '2024-12-15',
    status: 'completed',
    pages: 38,
  },
  {
    id: '3',
    name: 'Pipeline Review - December 2024',
    type: 'pipeline',
    date: '2024-12-12',
    status: 'completed',
    pages: 16,
  },
  {
    id: '4',
    name: 'Market Analysis - Enterprise SaaS',
    type: 'market',
    date: '2024-12-10',
    status: 'completed',
    pages: 42,
  },
  {
    id: '5',
    name: 'Win/Loss Analysis - Q4 2024',
    type: 'win-loss',
    date: '2024-12-08',
    status: 'generating',
    pages: 0,
  },
];

const MOCK_PREVIEW = {
  title: 'Account Intelligence Brief: Acme Corporation',
  generatedAt: 'December 19, 2024 14:32 UTC',
  sections: [
    {
      heading: 'Executive Summary',
      body: 'Acme Corporation shows strong signals for enterprise expansion. With 2,400+ employees and $180M ARR, the company is actively investing in AI/ML capabilities. Recent leadership changes indicate strategic shift toward platform consolidation. Intelligence score: 87/100 — high priority target for Q1 engagement.',
    },
    {
      heading: 'Key Metrics',
      body: 'Employee Growth: +12% YoY | Revenue Est: $180M ARR | Funding: Series E, $250M | Technology Spend: ~$45M annually | Buying Signals: 7 detected in last 30 days.',
    },
    {
      heading: 'Competitive Positioning',
      body: 'Currently using Competitor A (CRM) and Competitor B (Analytics). Gap analysis reveals opportunity in unified intelligence platform. Decision maker: CTO Sarah Chen, recently promoted with mandate for platform consolidation.',
    },
    {
      heading: 'Risk Assessment',
      body: 'MEDIUM RISK: Budget cycle aligned to Q2. Competitor A has renewed contract through 2025. Champion is mid-level — need executive sponsorship. Positive: high NPS signals from product teams.',
    },
  ],
};

export default function IntelligenceReport() {
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([
    'exec-summary',
    'key-metrics',
    'signals',
    'recommendations',
  ]);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  const toggleOrg = (id: string) => {
    setSelectedOrgs((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  };

  const toggleSection = (id: string) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 3000);
  };

  const canGenerate = reportType && selectedOrgs.length > 0 && selectedSections.length > 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Intelligence Report Builder
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Generate comprehensive intelligence reports with AI-powered analysis
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          New Report
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Builder Panel */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Report Type */}
          <Card className="gap-4 py-4">
            <CardHeader className="pb-0 pt-0 px-6">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="size-4" style={{ color: tokens.domain.value }} />
                Report Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  Report Type
                </Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Organizations */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  <Building2 className="size-3 inline mr-1" />
                  Organizations ({selectedOrgs.length} selected)
                </Label>
                <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
                  {ORGANIZATIONS.map((org) => (
                    <label key={org.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <Checkbox
                        checked={selectedOrgs.includes(org.id)}
                        onCheckedChange={() => toggleOrg(org.id)}
                      />
                      <span className="text-sm" style={{ color: tokens.text.primary }}>
                        {org.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Sections */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  Sections to Include ({selectedSections.length} selected)
                </Label>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {SECTIONS.map((sec) => (
                    <label key={sec.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <Checkbox
                        checked={selectedSections.includes(sec.id)}
                        onCheckedChange={() => toggleSection(sec.id)}
                      />
                      <span className="text-sm" style={{ color: tokens.text.primary }}>
                        {sec.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setShowPreview(true)}
                  variant="outline"
                  disabled={!canGenerate}
                  className="w-full"
                >
                  <Eye className="size-4" />
                  Preview Report
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerate}
                    disabled={!canGenerate || generating}
                    className="flex-1"
                  >
                    {generating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FileBarChart className="size-4" />
                    )}
                    {generating ? 'Generating...' : 'Generate'}
                  </Button>
                  <Button variant="outline" disabled={!canGenerate} className="flex-1">
                    <Download className="size-4" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview & Recent Reports */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Preview */}
          {showPreview ? (
            <Card className="gap-0 py-0 overflow-hidden">
              <CardHeader className="pb-0 pt-0 px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Report Preview</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                    Close
                  </Button>
                </div>
                <CardDescription>{MOCK_PREVIEW.generatedAt}</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <h2 className="text-lg font-bold mb-4" style={{ color: tokens.text.primary }}>
                  {MOCK_PREVIEW.title}
                </h2>
                <div className="flex flex-col gap-4">
                  {MOCK_PREVIEW.sections.map((sec, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <h3 className="text-sm font-semibold" style={{ color: tokens.domain.value }}>
                        {sec.heading}
                      </h3>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: tokens.text.secondary }}
                      >
                        {sec.body}
                      </p>
                      {i < MOCK_PREVIEW.sections.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="gap-4 py-4 flex-1">
              <CardContent
                className="flex items-center justify-center h-full min-h-[200px]"
                style={{ color: tokens.text.muted }}
              >
                <div className="text-center flex flex-col items-center gap-2">
                  <FileText className="size-8 opacity-40" />
                  <p className="text-sm">Configure and preview your report</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Reports */}
          <Card className="gap-4 py-4">
            <CardHeader className="pb-0 pt-0 px-6">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="size-4" style={{ color: tokens.text.muted }} />
                Recent Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {RECENT_REPORTS.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer hover:bg-muted/50"
                    style={{ border: `1px solid ${tokens.border.default}` }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText
                        className="size-4 shrink-0"
                        style={{ color: tokens.domain.value }}
                      />
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: tokens.text.primary }}
                        >
                          {report.name}
                        </p>
                        <p className="text-xs" style={{ color: tokens.text.muted }}>
                          {report.date} {report.pages > 0 && `· ${report.pages} pages`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {report.status === 'completed' ? (
                        <Badge
                          style={{
                            backgroundColor: tokens.confidence.high.bg,
                            color: tokens.confidence.high.value,
                          }}
                        >
                          Completed
                        </Badge>
                      ) : (
                        <Badge
                          style={{ backgroundColor: tokens.gold.bgMedium, color: tokens.gold.dark }}
                        >
                          <Loader2 className="size-3 animate-spin mr-1" />
                          Generating
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="size-8">
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
