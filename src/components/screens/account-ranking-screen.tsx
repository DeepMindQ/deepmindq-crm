'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition,
  StatCard,
  AnimatedCounter,
  TabBar,
  StaggerGrid,
  StaggerItem,
  EmptyState,
  SectionHeader,
} from '@/components/ui/animated-components';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Flame,
  Zap,
  Sprout,
  Minus,
  Search,
  RefreshCw,
  ArrowUpDown,
  Trophy,
  Building2,
  Brain,
  Radio,
  Users,
  Lightbulb,
  ExternalLink,
  Loader2,
  Globe,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */
interface Company {
  id: string;
  rawName: string;
  domain: string | null;
  industry: string | null;
  sizeRange: string | null;
  country: string | null;
  status: string;
  intelligenceScore: number;
  engagementScore: number;
  accountPriorityScore: number;
  priorityTier: string;
  priorityComputedAt: string | null;
  _count: {
    contacts: number;
    signals: number;
    opportunityRecommendations: number;
    pursuits: number;
  };
}

interface TierDistribution {
  HOT?: number;
  ACTIVE?: number;
  NURTURE?: number;
  LOW?: number;
  [key: string]: number | undefined;
}

interface APIResponse {
  companies?: Company[];
  total: number;
  tierDistribution?: TierDistribution;
}

type SortField = 'priorityScore' | 'intelligenceScore' | 'engagementScore' | 'rawName';
type SortOrder = 'desc' | 'asc';
type TierFilter = 'ALL' | 'HOT' | 'ACTIVE' | 'NURTURE' | 'LOW';

/* ═══════════════════════════════════════════════════════════
   Tier Configuration
   ═══════════════════════════════════════════════════════════ */
const TIER_CONFIG: Record<string, {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  HOT: {
    label: 'Hot',
    color: '#EF4444',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    icon: Flame,
  },
  ACTIVE: {
    label: 'Active',
    color: '#D4AF37',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    icon: Zap,
  },
  NURTURE: {
    label: 'Nurture',
    color: '#2563EB',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    icon: Sprout,
  },
  LOW: {
    label: 'Low',
    color: '#9CA3AF',
    bgClass: 'bg-gray-50',
    textClass: 'text-gray-600',
    icon: Minus,
  },
};

const TIER_TABS: { key: TierFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'HOT', label: 'Hot' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'NURTURE', label: 'Nurture' },
  { key: 'LOW', label: 'Low' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'priorityScore', label: 'Priority Score' },
  { value: 'intelligenceScore', label: 'Intelligence Score' },
  { value: 'engagementScore', label: 'Engagement Score' },
  { value: 'rawName', label: 'Company Name' },
];

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */
function getTierConfig(tier: string) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG.LOW;
}

function scoreBarColor(score: number): string {
  if (score >= 75) return '#059669';
  if (score >= 50) return '#D4AF37';
  if (score >= 25) return '#D97706';
  return '#EF4444';
}

/* ═══════════════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════════════ */
function LoadingSkeleton() {
  return (
    <PageTransition className="p-4 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>

      {/* Tab bar */}
      <Skeleton className="h-12 w-96 rounded-xl" />

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-4 space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}

/* ═══════════════════════════════════════════════════════════
   Score Bar Component
   ═══════════════════════════════════════════════════════════ */
function ScoreBar({ score }: { score: number }) {
  const color = scoreBarColor(score);
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}CC)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums w-8 text-right" style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Tier Badge Component
   ═══════════════════════════════════════════════════════════ */
function TierBadge({ tier }: { tier: string }) {
  const config = getTierConfig(tier);
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bgClass} ${config.textClass}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Table Row Component
   ═══════════════════════════════════════════════════════════ */
function CompanyRow({
  company,
  rank,
  onClick,
}: {
  company: Company;
  rank: number;
  onClick: () => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="group cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-200 hover:bg-amber-50/40"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
    >
      {/* Rank */}
      <td className="py-3 px-4">
        <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
          style={{
            background: rank <= 3 ? 'linear-gradient(135deg, #D4AF37, #E8C860)' : '#F3F4F6',
            color: rank <= 3 ? '#fff' : '#6B7280',
            boxShadow: rank <= 3 ? '0 0 10px rgba(212,175,55,0.3)' : 'none',
          }}
        >
          {rank}
        </div>
      </td>

      {/* Company Name + Domain */}
      <td className="py-3 px-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground group-hover:text-amber-700 transition-colors truncate max-w-[200px]">
            {company.rawName}
          </span>
          {company.domain && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Globe className="w-3 h-3" />
              {company.domain}
            </span>
          )}
        </div>
      </td>

      {/* Industry */}
      <td className="py-3 px-4 hidden lg:table-cell">
        <span className="text-sm text-muted-foreground truncate max-w-[140px] block">
          {company.industry || '—'}
        </span>
      </td>

      {/* Tier Badge */}
      <td className="py-3 px-4">
        <TierBadge tier={company.priorityTier} />
      </td>

      {/* Priority Score */}
      <td className="py-3 px-4">
        <ScoreBar score={company.accountPriorityScore} />
      </td>

      {/* Intelligence Score */}
      <td className="py-3 px-4 hidden xl:table-cell">
        <span className="text-sm font-medium tabular-nums text-foreground">
          {Math.round(company.intelligenceScore)}
        </span>
      </td>

      {/* Signals */}
      <td className="py-3 px-4 hidden md:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Radio className="w-3.5 h-3.5" />
          <span className="tabular-nums">{company._count.signals}</span>
        </div>
      </td>

      {/* Contacts */}
      <td className="py-3 px-4 hidden md:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span className="tabular-nums">{company._count.contacts}</span>
        </div>
      </td>

      {/* Opportunities */}
      <td className="py-3 px-4 hidden lg:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lightbulb className="w-3.5 h-3.5" />
          <span className="tabular-nums">{company._count.opportunityRecommendations}</span>
        </div>
      </td>

      {/* Chevron */}
      <td className="py-3 px-2 w-8">
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </td>
    </motion.tr>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Screen Component
   ═══════════════════════════════════════════════════════════ */
export default function AccountRankingScreen() {
  const setSelectedCompanyId = useAppStore((s) => s.setSelectedCompanyId);

  /* ── State ── */
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [tierDistribution, setTierDistribution] = useState<TierDistribution>({});
  const [loading, setLoading] = useState(true);
  const [activeTier, setActiveTier] = useState<TierFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('priorityScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [recomputing, setRecomputing] = useState(false);

  /* ── Fetch Data ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tier: activeTier,
        limit: '50',
        offset: '0',
        sortBy: sortField,
        sortOrder,
      });
      const res = await fetch(`/api/g-strategy/account-rankings?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data: APIResponse = await res.json();
      const mappedCompanies = (data.companies || []).map((c) => ({
        ...c,
        accountPriorityScore: c.accountPriorityScore ?? 0,
        intelligenceScore: c.intelligenceScore ?? 0,
        engagementScore: c.engagementScore ?? 0,
        priorityTier: c.priorityTier || 'LOW',
        priorityComputedAt: c.priorityComputedAt || null,
        _count: {
          contacts: c._count?.contacts || 0,
          signals: c._count?.signals || 0,
          opportunityRecommendations: c._count?.opportunityRecommendations || 0,
          pursuits: c._count?.pursuits || 0,
        },
      }));
      setCompanies(mappedCompanies);
      setTotal(data.total);
      setTierDistribution(data.tierDistribution || {});
    } catch {
      toast.error('Failed to load account rankings');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [activeTier, sortField, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Recompute All ── */
  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const res = await fetch('/api/g-strategy/account-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error('Recomputation failed');
      const postData = await res.json();
      // If async job started (202), poll for completion
      if (res.status === 202 && postData?.jobId) {
        toast.info('Priority computation started. Processing in background…');
        pollJobStatus(postData.jobId, fetchData);
      } else {
        toast.success(postData?.message || 'Priority scores recomputed successfully');
        // Re-fetch after a short delay
        setTimeout(fetchData, 2000);
      }
    } catch {
      toast.error('Failed to trigger recomputation');
    } finally {
      setRecomputing(false);
    }
  };

  /* ── Poll async job status ── */
  const pollJobStatus = useCallback(
    (jobId: string, onDone: () => void) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/g-strategy/account-rankings?jobId=${jobId}`);
          if (!res.ok) return;
          const job = await res.json();
          if (job.status === 'completed') {
            clearInterval(interval);
            toast.success(`Computed priority scores for ${job.total ?? job.totalProcessed} companies`);
            onDone();
          } else if (job.status === 'failed') {
            clearInterval(interval);
            toast.error(job.error || 'Background computation failed');
          }
          // Still pending/running — keep polling
        } catch {
          // Ignore polling errors, will try again
        }
      }, 3000);
      // Safety: stop polling after 5 minutes
      setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
    },
    []
  );

  /* ── Filtered companies (client-side search) ── */
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter(
      (c) =>
        c.rawName.toLowerCase().includes(q) ||
        c.domain?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q)
    );
  }, [companies, searchQuery]);

  /* ── Tab data with counts ── */
  const tabs = useMemo(
    () =>
      TIER_TABS.map((t) => ({
        key: t.key,
        label: t.label,
        count:
          t.key === 'ALL'
            ? total
            : tierDistribution[t.key] ?? 0,
      })),
    [total, tierDistribution]
  );

  /* ── Stat cards data ── */
  const statCards = useMemo(
    () => [
      {
        tier: 'HOT' as const,
        label: 'Hot Accounts',
        count: tierDistribution.HOT ?? 0,
        icon: Flame,
        color: '#EF4444',
      },
      {
        tier: 'ACTIVE' as const,
        label: 'Active Accounts',
        count: tierDistribution.ACTIVE ?? 0,
        icon: Zap,
        color: '#D4AF37',
      },
      {
        tier: 'NURTURE' as const,
        label: 'Nurture Accounts',
        count: tierDistribution.NURTURE ?? 0,
        icon: Sprout,
        color: '#2563EB',
      },
      {
        tier: 'LOW' as const,
        label: 'Low Priority',
        count: tierDistribution.LOW ?? 0,
        icon: Minus,
        color: '#9CA3AF',
      },
    ],
    [tierDistribution]
  );

  /* ── Handle row click ── */
  const handleRowClick = (companyId: string) => {
    setSelectedCompanyId(companyId);
  };

  /* ── Handle sort toggle (field + order) ── */
  const handleSortChange = (val: string) => {
    const field = val as SortField;
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  /* ═══════════════════════════════════════════════════════════ */
  if (loading && companies.length === 0) {
    return <LoadingSkeleton />;
  }

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <PageTransition className="p-4 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <SectionHeader
          title="Account Ranking"
          subtitle="Companies ranked by AI-powered account priority score"
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search companies…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-64 h-9 bg-white border-gray-200"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <Select value={sortField} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[170px] h-9 bg-white border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSortOrder((p) => (p === 'desc' ? 'asc' : 'desc'))}
              title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
            >
              <span className="text-xs font-bold text-muted-foreground">
                {sortOrder === 'desc' ? 'Z→A' : 'A→Z'}
              </span>
            </Button>
          </div>

          {/* Recompute Button */}
          <Button
            variant="outline"
            onClick={handleRecompute}
            disabled={recomputing}
            className="h-9 border-gray-200 bg-white hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-all"
          >
            {recomputing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Recompute All</span>
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <StaggerGrid
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        stagger={0.08}
      >
        {statCards.map((stat) => (
          <StatCard
            key={stat.tier}
            label={stat.label}
            value={stat.count}
            icon={stat.icon}
            color={stat.color}
            delay={0}
          />
        ))}
      </StaggerGrid>

      {/* ── Tab Bar ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTier}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
        >
          <TabBar tabs={tabs} active={activeTier} onChange={(key) => setActiveTier(key as TierFilter)} />
        </motion.div>
      </AnimatePresence>

      {/* ── Results Count ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredCompanies.length}</span> of{' '}
          <span className="font-semibold text-foreground">{total}</span> companies
          {searchQuery && (
            <span>
              {' '}matching &ldquo;<span className="text-foreground">{searchQuery}</span>&rdquo;
            </span>
          )}
        </p>
        {activeTier !== 'ALL' && (
          <Badge variant="outline" className="text-xs">
            Filtered by: <span className="ml-1 font-semibold">{activeTier}</span>
          </Badge>
        )}
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)' }}
      >
        <ScrollArea className="max-h-[600px]">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
                <th className="py-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-14">
                  #
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Company
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                  Industry
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">
                  Tier
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-40">
                  Priority
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell w-20">
                  Intel.
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell w-20">
                  Signals
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell w-20">
                  Contacts
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell w-20">
                  Opps
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filteredCompanies.length > 0 ? (
                  filteredCompanies.map((company, index) => (
                    <CompanyRow
                      key={company.id}
                      company={company}
                      rank={index + 1}
                      onClick={() => handleRowClick(company.id)}
                    />
                  ))
                ) : (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={10} className="py-0">
                      <EmptyState
                        icon={Trophy}
                        title={searchQuery ? 'No matching companies' : 'No accounts ranked yet'}
                        description={
                          searchQuery
                            ? 'Try adjusting your search query or changing the tier filter.'
                            : 'Run the account prioritization engine to score and rank your accounts.'
                        }
                        action={
                          !searchQuery ? (
                            <Button
                              variant="outline"
                              onClick={handleRecompute}
                              disabled={recomputing}
                              className="mt-2 border-gray-200 hover:border-amber-300 hover:text-amber-700"
                            >
                              {recomputing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                              Compute Priority Scores
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </ScrollArea>
      </div>

      {/* ── Footer note ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-xs text-muted-foreground pb-4"
      >
        Priority scores are computed using AI-driven signals, engagement data, and opportunity analysis.
        Scores range from 0–100.
      </motion.p>
    </PageTransition>
  );
}