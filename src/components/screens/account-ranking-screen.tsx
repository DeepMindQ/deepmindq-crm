'use client';

import { useState, useMemo } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trophy, Building2, TrendingUp, Crown, Medal, Award, Loader2, Inbox } from 'lucide-react';

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
];

const mockAccounts = Array.from({ length: 15 }, (_, i) => {
  const score = Math.round(95 - i * 4 + Math.random() * 6);
  const tier = score >= 85 ? 'gold' : score >= 70 ? 'silver' : 'bronze';
  return {
    rank: i + 1,
    company: [
      'Acme Corp',
      'Vertex Solutions',
      'NovaTech AI',
      'Stratos Inc',
      'Helix Biotech',
      'Quantum Financial',
      'Pinnacle Systems',
      'Nexus Digital',
      'Cirrus Cloud',
      'Titan Enterprises',
      'Aurora Health',
      'Apex Robotics',
      'Meridian Labs',
      'Zenith Data',
      'Forge Analytics',
    ][i],
    industry: INDUSTRIES[i % INDUSTRIES.length],
    score,
    signals: Math.round(30 - i * 1.5 + Math.random() * 10),
    revenue: `$${Math.round((500 - i * 30 + Math.random() * 50) * 10) / 10}M`,
    tier,
    lastUpdated: `${Math.floor(Math.random() * 24)}h ago`,
  };
});

function TierBadge({ tier }: { tier: string }) {
  if (tier === 'gold')
    return (
      <Badge className="gap-1 border-amber-500/40 bg-amber-500/15 text-amber-400">
        <Crown className="size-3" /> Gold
      </Badge>
    );
  if (tier === 'silver')
    return (
      <Badge className="gap-1 border-slate-400/40 bg-slate-400/15 text-slate-300">
        <Medal className="size-3" /> Silver
      </Badge>
    );
  return (
    <Badge className="gap-1 border-orange-700/40 bg-orange-700/15 text-orange-400">
      <Award className="size-3" /> Bronze
    </Badge>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? '#16A34A' : score >= 70 ? '#D97706' : '#DC2626';
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <Progress value={score} className="h-2 flex-1 [&>div]:bg-emerald-500" />
      <span className="text-sm font-mono font-medium text-foreground w-8 text-right">{score}</span>
    </div>
  );
}

export default function AccountRanking() {
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    if (tierFilter === 'all') return mockAccounts;
    return mockAccounts.filter((a) => a.tier === tierFilter);
  }, [tierFilter]);

  const stats = useMemo(() => {
    const total = mockAccounts.length;
    const gold = mockAccounts.filter((a) => a.tier === 'gold').length;
    const avg = Math.round(mockAccounts.reduce((s, a) => s + a.score, 0) / total);
    return { total, gold, avg };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mockAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Inbox className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">No accounts ranked yet.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Account Ranking
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Intelligence-scored accounts ranked by composite score
          </p>
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
            <SelectItem value="silver">Silver</SelectItem>
            <SelectItem value="bronze">Bronze</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="py-4 gap-4">
          <CardContent className="px-4 flex items-center gap-3">
            <div className="rounded-lg p-2.5" style={{ backgroundColor: tokens.accent.subtle }}>
              <Building2 className="size-5" style={{ color: tokens.accent.primary }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: tokens.text.secondary }}>
                Total Accounts
              </p>
              <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                {stats.total}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4 gap-4">
          <CardContent className="px-4 flex items-center gap-3">
            <div className="rounded-lg p-2.5" style={{ backgroundColor: tokens.gold.bgMedium }}>
              <Crown className="size-5" style={{ color: tokens.gold.dark }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: tokens.text.secondary }}>
                Gold Tier
              </p>
              <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                {stats.gold}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4 gap-4">
          <CardContent className="px-4 flex items-center gap-3">
            <div
              className="rounded-lg p-2.5"
              style={{ backgroundColor: tokens.confidence.high.bg }}
            >
              <TrendingUp className="size-5" style={{ color: tokens.confidence.high.value }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: tokens.text.secondary }}>
                Avg Score
              </p>
              <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                {stats.avg}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="py-0 gap-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4" style={{ color: tokens.gold.dark }} />
            Ranked Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 w-16">Rank</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Intelligence Score</TableHead>
                  <TableHead>Signals</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="pr-6">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((account) => (
                  <TableRow key={account.rank} className="cursor-pointer">
                    <TableCell
                      className="pl-6 font-mono font-bold"
                      style={{ color: tokens.text.primary }}
                    >
                      #{account.rank}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium" style={{ color: tokens.text.primary }}>
                        {account.company}
                      </span>
                    </TableCell>
                    <TableCell style={{ color: tokens.text.secondary }}>
                      {account.industry}
                    </TableCell>
                    <TableCell>
                      <ScoreBar score={account.score} />
                    </TableCell>
                    <TableCell style={{ color: tokens.text.secondary }}>
                      {account.signals}
                    </TableCell>
                    <TableCell className="font-mono" style={{ color: tokens.text.secondary }}>
                      {account.revenue}
                    </TableCell>
                    <TableCell>
                      <TierBadge tier={account.tier} />
                    </TableCell>
                    <TableCell className="pr-6" style={{ color: tokens.text.muted }}>
                      {account.lastUpdated}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
