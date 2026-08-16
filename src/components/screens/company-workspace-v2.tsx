'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Globe,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Zap,
  BrainCircuit,
  FileText,
  Loader2,
  Network,
  Clock,
  StickyNote,
  TrendingUp,
  Mail,
  ExternalLink,
  Save,
  Star,
} from 'lucide-react';

const company = {
  name: 'Acme Corp',
  domain: 'acmecorp.com',
  industry: 'SaaS',
  score: 92,
  employees: 485,
  revenue: '$124M',
  founded: '2014',
  hq: 'San Francisco, CA',
};

const signals = [
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
    type: 'Product',
    title: 'Launched new ML module v3.0',
    confidence: 91,
    time: '2w ago',
  },
];

const insights = [
  {
    title: 'Expansion Intent Detected',
    detail:
      'Recent hiring surge and office lease expansion suggest 40% headcount growth planned for Q2.',
    confidence: 'high' as const,
  },
  {
    title: 'Technology Stack Shift',
    detail: 'Moving from monolith to microservices. Opportunity for cloud infrastructure vendors.',
    confidence: 'high' as const,
  },
  {
    title: 'Competitive Pressure',
    detail: 'Two direct competitors launched similar products.',
    confidence: 'medium' as const,
  },
];

const contacts = [
  {
    name: 'Sarah Chen',
    title: 'CEO',
    email: 'sarah@acmecorp.com',
    dept: 'Executive',
    lastContact: '3d ago',
  },
  {
    name: 'James Wilson',
    title: 'CTO',
    email: 'james@acmecorp.com',
    dept: 'Engineering',
    lastContact: '1w ago',
  },
  {
    name: 'Maria Garcia',
    title: 'CRO',
    email: 'maria@acmecorp.com',
    dept: 'Sales',
    lastContact: '5d ago',
  },
  {
    name: 'David Park',
    title: 'VP Product',
    email: 'david@acmecorp.com',
    dept: 'Product',
    lastContact: '2w ago',
  },
];

const connections = [
  { company: 'CloudFlare', type: 'Partner', strength: 'Strong', since: '2022' },
  { company: 'AWS', type: 'Vendor', strength: 'Strong', since: '2019' },
  { company: 'Datadog', type: 'Partner', strength: 'Moderate', since: '2023' },
  { company: 'Snowflake', type: 'Vendor', strength: 'Moderate', since: '2021' },
];

const activityTimeline = [
  { time: '2d ago', event: 'Intelligence score updated to 92 (+5)', color: '#16A34A' },
  { time: '5d ago', event: 'New signal: 12 engineering roles posted', color: '#2563EB' },
  { time: '1w ago', event: 'Maria Garcia added as CRO', color: '#a78bfa' },
  { time: '2w ago', event: 'Partnership with CloudFlare detected', color: '#D97706' },
  { time: '3w ago', event: 'ML module v3.0 launched', color: '#059669' },
  { time: '1mo ago', event: 'Company profile enriched', color: tokens.text.secondary as string },
];

function ScoreRing({ score }: { score: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626';
  return (
    <div className="relative flex items-center justify-center" style={{ width: 90, height: 90 }}>
      <svg width="90" height="90" className="-rotate-90">
        <circle
          cx="45"
          cy="45"
          r={radius}
          fill="none"
          stroke={tokens.border.default}
          strokeWidth="7"
        />
        <circle
          cx="45"
          cy="45"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[9px]" style={{ color: tokens.text.muted }}>
          score
        </span>
      </div>
    </div>
  );
}

export function CompanyWorkspaceV2() {
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState(
    'Acme Corp is a high-priority account. Focus on cloud infrastructure and analytics solutions. Decision maker: Sarah Chen (CEO).',
  );
  const [saved, setSaved] = useState(false);

  const handleSaveNotes = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="rounded-xl p-3" style={{ backgroundColor: tokens.accent.subtle }}>
            <Building2 className="size-7" style={{ color: tokens.accent.primary }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: tokens.text.primary }}
            >
              {company.name}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span
                className="text-sm flex items-center gap-1"
                style={{ color: tokens.text.secondary }}
              >
                <Globe className="size-3.5" /> {company.domain}
              </span>
              <Badge variant="outline">{company.industry}</Badge>
            </div>
          </div>
        </div>
        <ScoreRing score={company.score} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" className="gap-1.5">
            <TrendingUp className="size-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="gap-1.5">
            <Zap className="size-3.5" /> Intelligence
          </TabsTrigger>
          <TabsTrigger value="people" className="gap-1.5">
            <Users className="size-3.5" /> People
          </TabsTrigger>
          <TabsTrigger value="relationships" className="gap-1.5">
            <Network className="size-3.5" /> Relationships
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Clock className="size-3.5" /> Activity
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5">
            <StickyNote className="size-3.5" /> Notes
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Employees', value: company.employees.toLocaleString(), icon: Users },
              { label: 'Revenue', value: company.revenue, icon: DollarSign },
              { label: 'Founded', value: company.founded, icon: Calendar },
              { label: 'HQ', value: company.hq, icon: MapPin },
            ].map((m) => (
              <Card key={m.label} className="py-4 gap-4">
                <CardContent className="px-4 flex items-center gap-3">
                  <div
                    className="rounded-lg p-2"
                    style={{ backgroundColor: tokens.surfaceExtended }}
                  >
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
        </TabsContent>

        {/* Intelligence */}
        <TabsContent value="intelligence" className="mt-4 space-y-4">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Signals ({signals.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="max-h-[240px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="pr-6">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signals.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="pl-6">
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
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <BrainCircuit className="size-3.5" /> AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-3"
                  style={{ borderColor: tokens.borderFaint }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                      {ins.title}
                    </p>
                    <Badge
                      className={
                        ins.confidence === 'high'
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                          : 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                      }
                    >
                      {ins.confidence}
                    </Badge>
                  </div>
                  <p className="text-xs" style={{ color: tokens.text.secondary }}>
                    {ins.detail}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* People */}
        <TabsContent value="people" className="mt-4">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Contacts ({contacts.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="max-h-[360px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Name</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="pr-6">Last Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c, i) => (
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
                              {c.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </div>
                            <span
                              className="text-sm font-medium"
                              style={{ color: tokens.text.primary }}
                            >
                              {c.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm" style={{ color: tokens.text.secondary }}>
                          {c.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {c.dept}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs" style={{ color: tokens.text.muted }}>
                          {c.email}
                        </TableCell>
                        <TableCell className="pr-6 text-xs" style={{ color: tokens.text.muted }}>
                          {c.lastContact}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relationships */}
        <TabsContent value="relationships" className="mt-4">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Connections ({connections.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Strength</TableHead>
                    <TableHead className="pr-6">Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell
                        className="pl-6 text-sm font-medium"
                        style={{ color: tokens.text.primary }}
                      >
                        {c.company}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            c.strength === 'Strong'
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                              : 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                          }
                        >
                          {c.strength}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-sm" style={{ color: tokens.text.muted }}>
                        {c.since}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity" className="mt-4">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="relative space-y-4">
                <div
                  className="absolute left-[7px] top-2 bottom-2 w-px"
                  style={{ backgroundColor: tokens.border.default }}
                />
                {activityTimeline.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 relative">
                    <div
                      className="rounded-full p-0.5 z-10 shrink-0"
                      style={{ backgroundColor: item.color }}
                    >
                      <div className="size-3 rounded-full bg-background" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: tokens.text.primary }}>
                        {item.event}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
                        {item.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-4">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <StickyNote className="size-3.5" /> Account Notes
              </CardTitle>
              <CardDescription>Private notes for your team</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                placeholder="Add notes about this company..."
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveNotes} className="gap-1.5">
                  <Save className="size-3.5" /> Save Notes
                </Button>
                {saved && <span className="text-xs text-emerald-400">Saved!</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CompanyWorkspaceV2;
