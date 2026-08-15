'use client';

import { useState, useMemo, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Target,
  Building2,
  Users,
  DollarSign,
  Globe,
  Cpu,
  Zap,
  Save,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Settings2,
} from 'lucide-react';

const INDUSTRIES = [
  'SaaS',
  'Fintech',
  'Healthcare',
  'E-commerce',
  'Cybersecurity',
  'AI/ML',
  'EdTech',
  'Logistics',
  'Manufacturing',
  'LegalTech',
  'Real Estate',
  'CleanTech',
];
const GEOGRAPHIES = ['North America', 'Europe', 'APAC', 'LATAM', 'Middle East', 'Global'];
const TECH_STACKS = [
  'AWS',
  'Azure',
  'GCP',
  'Kubernetes',
  'Docker',
  'React',
  'Python',
  'Node.js',
  'PostgreSQL',
  'Snowflake',
  'Databricks',
  'Terraform',
];
const BUYING_SIGNALS = [
  'Hiring growth',
  'Funding raised',
  'Tech migration',
  'Leadership change',
  'Expansion signals',
  'Competitor evaluation',
  'Partner search',
  'Budget increase',
];

const SIZE_RANGES = [
  { label: '1–10', min: '1', max: '10' },
  { label: '11–50', min: '11', max: '50' },
  { label: '51–200', min: '51', max: '200' },
  { label: '201–1000', min: '201', max: '1000' },
  { label: '1001–5000', min: '1001', max: '5000' },
  { label: '5000+', min: '5000', max: '50000' },
];

const REVENUE_RANGES = [
  { label: '<$1M', min: '0', max: '1000000' },
  { label: '$1M–$10M', min: '1000000', max: '10000000' },
  { label: '$10M–$50M', min: '10000000', max: '50000000' },
  { label: '$50M–$200M', min: '50000000', max: '200000000' },
  { label: '$200M–$1B', min: '200000000', max: '1000000000' },
  { label: '$1B+', min: '1000000000', max: '100000000000' },
];

const mockMatchingCompanies = [
  {
    name: 'Acme Corp',
    industry: 'SaaS',
    size: '201–1000',
    revenue: '$124M',
    score: 94,
    match: '96%',
  },
  {
    name: 'Vertex Solutions',
    industry: 'Fintech',
    size: '51–200',
    revenue: '$45M',
    score: 88,
    match: '91%',
  },
  {
    name: 'NovaTech AI',
    industry: 'AI/ML',
    size: '201–1000',
    revenue: '$82M',
    score: 85,
    match: '88%',
  },
  {
    name: 'Helix Biotech',
    industry: 'Healthcare',
    size: '1001–5000',
    revenue: '$310M',
    score: 79,
    match: '82%',
  },
  {
    name: 'Stratos Inc',
    industry: 'Cybersecurity',
    size: '51–200',
    revenue: '$28M',
    score: 72,
    match: '75%',
  },
];

export default function IcpSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([
    'SaaS',
    'Fintech',
    'AI/ML',
  ]);
  const [sizeRange, setSizeRange] = useState('201-1000');
  const [revenueRange, setRevenueRange] = useState('50M-200M');
  const [geography, setGeography] = useState('North America');
  const [selectedTech, setSelectedTech] = useState<string[]>(['AWS', 'Kubernetes', 'Python']);
  const [selectedSignals, setSelectedSignals] = useState<string[]>([
    'Hiring growth',
    'Funding raised',
    'Tech migration',
  ]);

  const toggleItem = (arr: string[], item: string, setter: (v: string[]) => void) => {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 1200);
  };

  const totalCriteria =
    selectedIndustries.length +
    selectedTech.length +
    selectedSignals.length +
    (sizeRange ? 1 : 0) +
    (revenueRange ? 1 : 0) +
    (geography ? 1 : 0);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Ideal Customer Profile
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Define and refine your ICP to improve account targeting
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? 'Saving...' : 'Save ICP'}
        </Button>
      </div>

      {/* Current ICP Summary */}
      <Card className="py-0 gap-0 border-l-4" style={{ borderLeftColor: tokens.accent.primary }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="size-4" style={{ color: tokens.accent.primary }} />
            <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
              Current ICP Summary
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIndustries.map((i) => (
              <Badge key={i} variant="outline">
                {i}
              </Badge>
            ))}
            {sizeRange && (
              <Badge className="border-sky-500/40 bg-sky-500/15 text-sky-400">
                {sizeRange} employees
              </Badge>
            )}
            {revenueRange && (
              <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                {revenueRange} revenue
              </Badge>
            )}
            {geography && (
              <Badge className="border-purple-500/40 bg-purple-500/15 text-purple-400">
                {geography}
              </Badge>
            )}
            <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-400">
              {totalCriteria} criteria
            </Badge>
          </div>
          {saved && (
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="size-3" /> ICP saved successfully!
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Configuration */}
        <div className="space-y-4">
          {/* Industry Targets */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Building2 className="size-3.5" /> Industry Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    onClick={() => toggleItem(selectedIndustries, ind, setSelectedIndustries)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      selectedIndustries.includes(ind)
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    style={
                      !selectedIndustries.includes(ind)
                        ? { borderColor: tokens.border.default, color: tokens.text.secondary }
                        : {}
                    }
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Company Size */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Users className="size-3.5" /> Company Size Range
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select value={sizeRange} onValueChange={setSizeRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_RANGES.map((r) => (
                    <SelectItem key={r.label} value={r.label}>
                      {r.label} employees
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Revenue Range */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <DollarSign className="size-3.5" /> Revenue Range
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select value={revenueRange} onValueChange={setRevenueRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {REVENUE_RANGES.map((r) => (
                    <SelectItem key={r.label} value={r.label}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Geography */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Globe className="size-3.5" /> Geography
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select value={geography} onValueChange={setGeography}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEOGRAPHIES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tech, Signals, Preview */}
        <div className="space-y-4">
          {/* Technology Stack */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Cpu className="size-3.5" /> Technology Stack
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {TECH_STACKS.map((tech) => (
                  <button
                    key={tech}
                    onClick={() => toggleItem(selectedTech, tech, setSelectedTech)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      selectedTech.includes(tech)
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    style={
                      !selectedTech.includes(tech)
                        ? { borderColor: tokens.border.default, color: tokens.text.secondary }
                        : {}
                    }
                  >
                    {tech}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Buying Signals */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Zap className="size-3.5" /> Buying Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {BUYING_SIGNALS.map((sig) => (
                  <button
                    key={sig}
                    onClick={() => toggleItem(selectedSignals, sig, setSelectedSignals)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      selectedSignals.includes(sig)
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    style={
                      !selectedSignals.includes(sig)
                        ? { borderColor: tokens.border.default, color: tokens.text.secondary }
                        : {}
                    }
                  >
                    {sig}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview Matching Companies */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Target className="size-3.5" /> Matching Companies Preview
              </CardTitle>
              <CardDescription>Top 5 companies matching current ICP</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="max-h-[280px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Company</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="pr-6">Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockMatchingCompanies.map((c) => (
                      <TableRow key={c.name}>
                        <TableCell
                          className="pl-6 text-sm font-medium"
                          style={{ color: tokens.text.primary }}
                        >
                          {c.name}
                        </TableCell>
                        <TableCell className="text-xs" style={{ color: tokens.text.secondary }}>
                          {c.industry}
                        </TableCell>
                        <TableCell className="text-xs" style={{ color: tokens.text.secondary }}>
                          {c.size}
                        </TableCell>
                        <TableCell
                          className="text-xs font-mono"
                          style={{ color: tokens.text.secondary }}
                        >
                          {c.revenue}
                        </TableCell>
                        <TableCell
                          className="font-mono text-xs"
                          style={{
                            color:
                              c.score >= 85
                                ? tokens.confidence.high.value
                                : tokens.confidence.medium.value,
                          }}
                        >
                          {c.score}
                        </TableCell>
                        <TableCell className="pr-6">
                          <Badge
                            className={
                              parseInt(c.match) >= 90
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                                : 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                            }
                          >
                            {c.match} match
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
