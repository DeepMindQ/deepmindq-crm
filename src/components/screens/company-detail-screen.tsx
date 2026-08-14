'use client';

import { useState, useMemo } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Globe,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Zap,
  BrainCircuit,
  TrendingUp,
  FileText,
  Loader2,
  Inbox,
  ArrowLeft,
  Mail,
  Phone,
  ExternalLink,
} from 'lucide-react';

const mockCompany = {
  name: 'Acme Corp',
  domain: 'acmecorp.com',
  industry: 'SaaS',
  score: 92,
  employees: 485,
  revenue: '$124M',
  founded: '2014',
  hq: 'San Francisco, CA',
  website: 'https://acmecorp.com',
  description:
    'Enterprise AI-powered analytics platform helping Fortune 500 companies optimize operations through real-time intelligence.',
};

const mockSignals = [
  {
    id: 'SIG-001',
    type: 'Funding',
    title: 'Series C round of $85M closed',
    confidence: 95,
    time: '2d ago',
  },
  {
    id: 'SIG-002',
    type: 'Hiring',
    title: '12 new engineering roles posted',
    confidence: 88,
    time: '5d ago',
  },
  {
    id: 'SIG-003',
    type: 'Tech',
    title: 'Migrated infrastructure to Kubernetes',
    confidence: 82,
    time: '1w ago',
  },
  {
    id: 'SIG-004',
    type: 'Partnership',
    title: 'Strategic partnership with CloudFlare',
    confidence: 78,
    time: '2w ago',
  },
  {
    id: 'SIG-005',
    type: 'Product',
    title: 'Launched new ML module v3.0',
    confidence: 91,
    time: '2w ago',
  },
];

const mockPeople = [
  { name: 'Sarah Chen', title: 'CEO', email: 'sarah@acmecorp.com', dept: 'Executive' },
  { name: 'James Wilson', title: 'CTO', email: 'james@acmecorp.com', dept: 'Engineering' },
  { name: 'Maria Garcia', title: 'CRO', email: 'maria@acmecorp.com', dept: 'Sales' },
  { name: 'David Park', title: 'VP Product', email: 'david@acmecorp.com', dept: 'Product' },
  { name: 'Lisa Thompson', title: 'VP Marketing', email: 'lisa@acmecorp.com', dept: 'Marketing' },
];

const mockInsights = [
  {
    title: 'Expansion Intent Detected',
    detail:
      'Recent hiring surge and office lease expansion suggest 40% headcount growth planned for Q2.',
    confidence: 'high',
  },
  {
    title: 'Technology Stack Shift',
    detail: 'Moving from monolith to microservices. Opportunity for cloud infrastructure vendors.',
    confidence: 'high',
  },
  {
    title: 'Competitive Pressure',
    detail:
      'Two direct competitors launched similar products. Acme may be in buying mode for differentiation.',
    confidence: 'medium',
  },
];

const mockBriefings = [
  {
    date: '2024-01-15',
    title: 'Q4 Performance Summary',
    summary: 'Acme exceeded revenue targets by 18%. Key growth in enterprise segment.',
  },
  {
    date: '2024-01-08',
    title: 'Leadership Change Alert',
    summary: 'New CRO Maria Garcia joined from Salesforce. Expected to revamp sales strategy.',
  },
];

const metrics = [
  { label: 'Employees', value: mockCompany.employees.toLocaleString(), icon: Users },
  { label: 'Revenue', value: mockCompany.revenue, icon: DollarSign },
  { label: 'Founded', value: mockCompany.founded, icon: Calendar },
  { label: 'HQ', value: mockCompany.hq, icon: MapPin },
];

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const cls =
    confidence === 'high'
      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
      : 'border-amber-500/40 bg-amber-500/15 text-amber-400';
  return <Badge className={cls}>{confidence}</Badge>;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626';
  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg width="110" height="110" className="-rotate-90">
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke={tokens.border.default}
          strokeWidth="8"
        />
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px]" style={{ color: tokens.text.muted }}>
          score
        </span>
      </div>
    </div>
  );
}

export default function CompanyDetail() {
  const [loading] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="rounded-xl p-3 flex items-center justify-center"
            style={{ backgroundColor: tokens.accent.subtle }}
          >
            <Building2 className="size-8" style={{ color: tokens.accent.primary }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: tokens.text.primary }}
            >
              {mockCompany.name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span
                className="text-sm flex items-center gap-1"
                style={{ color: tokens.text.secondary }}
              >
                <Globe className="size-3.5" /> {mockCompany.domain}
              </span>
              <Badge variant="outline">{mockCompany.industry}</Badge>
              <a
                href={mockCompany.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm flex items-center gap-1 hover:underline"
                style={{ color: tokens.accent.primary }}
              >
                <ExternalLink className="size-3" /> Website
              </a>
            </div>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: tokens.text.secondary }}>
              {mockCompany.description}
            </p>
          </div>
        </div>
        <ScoreRing score={mockCompany.score} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="py-4 gap-4">
            <CardContent className="px-4 flex items-center gap-3">
              <div className="rounded-lg p-2" style={{ backgroundColor: tokens.surfaceExtended }}>
                <m.icon className="size-4" style={{ color: tokens.text.secondary }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: tokens.text.muted }}>
                  {m.label}
                </p>
                <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                  {m.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="signals">
        <TabsList>
          <TabsTrigger value="signals" className="gap-1.5">
            <Zap className="size-3.5" /> Signals
          </TabsTrigger>
          <TabsTrigger value="people" className="gap-1.5">
            <Users className="size-3.5" /> People
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5">
            <BrainCircuit className="size-3.5" /> Insights
          </TabsTrigger>
          <TabsTrigger value="briefings" className="gap-1.5">
            <FileText className="size-3.5" /> Briefings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signals" className="mt-4">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Intelligence Signals</CardTitle>
              <CardDescription>{mockSignals.length} signals detected</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="max-h-[360px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="pr-6">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockSignals.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell
                          className="pl-6 font-mono text-xs"
                          style={{ color: tokens.domain.value }}
                        >
                          {s.id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm" style={{ color: tokens.text.primary }}>
                          {s.title}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              s.confidence >= 85
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                                : 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                            }
                          >
                            {s.confidence}%
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-xs" style={{ color: tokens.text.muted }}>
                          {s.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="people" className="mt-4">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Key People</CardTitle>
              <CardDescription>{mockPeople.length} contacts</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="max-h-[360px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Name</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="pr-6">Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockPeople.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-2">
                            <div
                              className="size-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                              style={{
                                backgroundColor: tokens.accent.subtle,
                                color: tokens.accent.primary,
                              }}
                            >
                              {p.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </div>
                            <span
                              className="text-sm font-medium"
                              style={{ color: tokens.text.primary }}
                            >
                              {p.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm" style={{ color: tokens.text.secondary }}>
                          {p.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {p.dept}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-xs" style={{ color: tokens.text.muted }}>
                          {p.email}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <div className="space-y-4">
            {mockInsights.map((ins, i) => (
              <Card key={i} className="py-0 gap-0">
                <CardContent className="p-4 flex items-start gap-3">
                  <div
                    className="rounded-lg p-2 mt-0.5 shrink-0"
                    style={{ backgroundColor: tokens.domain.bg }}
                  >
                    <BrainCircuit className="size-4" style={{ color: tokens.domain.value }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                        {ins.title}
                      </p>
                      <ConfidenceBadge confidence={ins.confidence} />
                    </div>
                    <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
                      {ins.detail}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="briefings" className="mt-4">
          <div className="space-y-4">
            {mockBriefings.map((b, i) => (
              <Card key={i} className="py-0 gap-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                      {b.title}
                    </p>
                    <span className="text-xs" style={{ color: tokens.text.muted }}>
                      {b.date}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: tokens.text.secondary }}>
                    {b.summary}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
