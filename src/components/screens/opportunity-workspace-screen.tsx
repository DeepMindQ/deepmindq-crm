'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, CheckCircle2, Eye, XCircle, Clock,
  Building2, Target, Zap, TrendingUp, ShieldCheck,
  BarChart3, Brain, ArrowRight, Loader2, ChevronDown,
  RefreshCw, Lightbulb, FileText, Users,
} from 'lucide-react';
import {
  PageTransition, StatCard, AnimatedCounter, TabBar, StaggerGrid,
  StaggerItem, EmptyState, SectionHeader, AnimatedBar, GlassPanel,
} from '@/components/ui/animated-components';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface Company {
  id: string;
  rawName: string;
  domain: string | null;
  industry: string | null;
}

interface Signal {
  id: string;
  title: string;
  signalType: string;
  severity: string;
  impact: string;
}

interface ScoringBreakdown {
  signalConfidence: number;
  capabilityMatch: number;
  freshnessScore: number;
  evidenceQuality: number;
  businessImpact: number;
}

interface Opportunity {
  id: string;
  opportunityTitle: string;
  businessTrigger: string;
  whyNow: string;
  businessProblem: string;
  recommendedCapability: string;
  recommendedStakeholders: string;
  suggestedConversation: string;
  confidenceScore: number;
  freshnessScore: number;
  matchScore: number;
  opportunityScore: number;
  priority: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  company: Company;
  signal: Signal;
  scoringBreakdown?: ScoringBreakdown;
}

interface APIResponse {
  opportunities: Opportunity[];
  total: number;
}

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */
const REJECTION_REASONS = [
  { key: 'WRONG_TIMING', label: 'Wrong Timing', icon: Clock },
  { key: 'EXISTING_RELATIONSHIP', label: 'Existing Relationship', icon: Users },
  { key: 'NOT_RELEVANT', label: 'Not Relevant', icon: XCircle },
  { key: 'LOW_CONFIDENCE', label: 'Low Confidence', icon: TrendingUp },
  { key: 'NO_BUDGET', label: 'No Budget', icon: BarChart3 },
  { key: 'OTHER', label: 'Other', icon: FileText },
] as const;

const SCORING_DIMENSIONS = [
  { key: 'signalConfidence' as const, label: 'Signal Confidence', color: 'var(--color-gold)' },
  { key: 'capabilityMatch' as const, label: 'Capability Match', color: '#059669' },
  { key: 'freshnessScore' as const, label: 'Freshness', color: '#2563EB' },
  { key: 'evidenceQuality' as const, label: 'Evidence Quality', color: '#9333EA' },
  { key: 'businessImpact' as const, label: 'Business Impact', color: '#DC2626' },
] as const;

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'High' },
  medium: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Medium' },
  low: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', label: 'Low' },
};

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */
function scoreColor(score: number): string {
  if (score >= 75) return '#059669';
  if (score >= 50) return '#D97706';
  if (score >= 25) return '#DC2626';
  return '#9CA3AF';
}

function scoreRingColor(score: number): string {
  if (score >= 75) return '#10B981';
  if (score >= 50) return '#F59E0B';
  if (score >= 25) return '#EF4444';
  return '#9CA3AF';
}

function formatScore(value: number, max: number = 100): number {
  return max === 100 ? Math.round(value) : Math.round(value * 100);
}

/* ═══════════════════════════════════════════════════
   Score Ring — SVG circular score indicator
   ═══════════════════════════════════════════════════ */
function ScoreRing({ score, size = 72, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreRingColor(score);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums" style={{ color }}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Scoring Breakdown — 5 mini bars
   ═══════════════════════════════════════════════════ */
function ScoringBreakdownBars({ breakdown }: { breakdown: ScoringBreakdown }) {
  return (
    <div className="space-y-2">
      {SCORING_DIMENSIONS.map((dim) => {
        const raw = breakdown[dim.key];
        const value = dim.key === 'freshnessScore' ? raw : Math.round(raw * 100);
        return (
          <div key={dim.key} className="flex items-center gap-2.5">
            <span className="text-[11px] text-muted-foreground w-[105px] shrink-0 text-right truncate">
              {dim.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: dim.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(value, 100)}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground w-8 text-right">
              {value}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Opportunity Card
   ═══════════════════════════════════════════════════ */
function OpportunityCard({
  opportunity,
  onAction,
  onCompanyClick,
  isActioning,
}: {
  opportunity: Opportunity;
  onAction: (id: string, action: 'accept' | 'reject' | 'monitor', reason?: string) => void;
  onCompanyClick: (companyId: string) => void;
  isActioning: boolean;
}) {
  const priority = PRIORITY_STYLES[opportunity.priority] || PRIORITY_STYLES.low;
  const isPending = opportunity.status === 'pending_review';
  const stakeholders: string[] = (() => {
    try { return JSON.parse(opportunity.recommendedStakeholders); }
    catch { return []; }
  })();

  return (
    <GlassPanel className="p-5 hover:shadow-md transition-all duration-300 group">
      {/* Top row: company info + score */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <button
              onClick={() => onCompanyClick(opportunity.company.id)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-semibold text-foreground hover:underline truncate max-w-[200px]">
                {opportunity.company.rawName}
              </span>
            </button>
            {opportunity.company.industry && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-200 text-muted-foreground font-normal">
                {opportunity.company.industry}
              </Badge>
            )}
            <Badge className={`text-[10px] px-1.5 py-0 border font-medium ${priority.bg} ${priority.text}`}>
              {priority.label}
            </Badge>
          </div>
          <h3 className="text-base font-bold text-foreground leading-snug mb-1 group-hover:text-primary/80 transition-colors">
            {opportunity.opportunityTitle}
          </h3>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
            <Zap className="w-3 h-3 mt-0.5 text-primary shrink-0" />
            <p className="line-clamp-2">{opportunity.businessTrigger}</p>
          </div>
        </div>
        <ScoreRing score={opportunity.opportunityScore} />
      </div>

      {/* Signal badge */}
      {opportunity.signal && (
        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 w-fit">
          <Target className="w-3 h-3 text-primary/70" />
          <span className="text-[11px] text-muted-foreground font-medium">
            {opportunity.signal.signalType}
          </span>
          <span className="text-[11px] text-muted-foreground">·</span>
          <span className="text-[11px] text-muted-foreground truncate max-w-[260px]">
            {opportunity.signal.title}
          </span>
        </div>
      )}

      {/* Scoring breakdown */}
      {opportunity.scoringBreakdown && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-gray-50/50 border border-gray-100">
          <ScoringBreakdownBars breakdown={opportunity.scoringBreakdown} />
        </div>
      )}

      {/* Recommended capability + stakeholders */}
      <div className="space-y-1.5 mb-4">
        {opportunity.recommendedCapability && (
          <div className="flex items-start gap-1.5">
            <Lightbulb className="w-3 h-3 mt-0.5 text-primary/60 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/70">Capability:</span>{' '}
              {opportunity.recommendedCapability}
            </p>
          </div>
        )}
        {stakeholders.length > 0 && (
          <div className="flex items-start gap-1.5">
            <Users className="w-3 h-3 mt-0.5 text-primary/60 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/70">Stakeholders:</span>{' '}
              {stakeholders.join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Rejection reason (if rejected) */}
      {opportunity.status === 'rejected' && opportunity.rejectionReason && (
        <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100">
          <p className="text-[11px] text-red-600">
            <span className="font-medium">Rejection reason:</span>{' '}
            {opportunity.rejectionReason.replace(/_/g, ' ')}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        {isPending ? (
          <>
            <Button
              size="sm"
              onClick={() => onAction(opportunity.id, 'accept')}
              disabled={isActioning}
              className="h-8 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
            >
              {isActioning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(opportunity.id, 'monitor')}
              disabled={isActioning}
              className="h-8 px-3 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 gap-1.5"
            >
              <Eye className="w-3 h-3" />
              Monitor
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isActioning}
                  className="h-8 px-3 text-xs border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 gap-1.5"
                >
                  <XCircle className="w-3 h-3" />
                  Reject
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Select rejection reason
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {REJECTION_REASONS.map((reason) => (
                  <DropdownMenuItem
                    key={reason.key}
                    onClick={() => onAction(opportunity.id, 'reject', reason.key)}
                    className="text-xs cursor-pointer gap-2"
                  >
                    <reason.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {reason.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[11px] font-medium ${
                opportunity.status === 'accepted'
                  ? 'border-emerald-200 text-emerald-600 bg-emerald-50'
                  : opportunity.status === 'monitored'
                  ? 'border-blue-200 text-blue-600 bg-blue-50'
                  : 'border-red-200 text-red-500 bg-red-50'
              }`}
            >
              {opportunity.status === 'accepted' && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {opportunity.status === 'monitored' && <Eye className="w-3 h-3 mr-1" />}
              {opportunity.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
              {opportunity.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </Badge>
            {isPending && (
              <span className="text-[11px] text-muted-foreground">
                {new Date(opportunity.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums">
          {new Date(opportunity.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric',
          })}
        </span>
      </div>
    </GlassPanel>
  );
}

/* ═══════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════ */
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="h-5 w-72" />
              <Skeleton className="h-3 w-full max-w-xs" />
            </div>
            <Skeleton className="h-[72px] w-[72px] rounded-full" />
          </div>
          <Skeleton className="h-8 w-64 rounded-lg" />
          <div className="space-y-2 px-3 py-2.5 rounded-lg bg-gray-50">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="flex items-center gap-2.5">
                <Skeleton className="h-3 w-[105px]" />
                <Skeleton className="h-1.5 flex-1 rounded-full" />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════ */
export default function OpportunityWorkspaceScreen() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [isActioning, setIsActioning] = useState(false);
  const [actioningIds, setActioningIds] = useState<Set<string>>(new Set());
  const setSelectedCompanyId = useAppStore((s) => s.setSelectedCompanyId);

  // Fetch opportunities
  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/g-outreach/opportunities?status=pending_review&limit=50&offset=0');
      if (!res.ok) throw new Error('Failed to fetch opportunities');
      const data: APIResponse = await res.json();
      setAllOpportunities(data.opportunities);
    } catch {
      toast.error('Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Filtered opportunities by tab
  const filtered = useMemo(() => {
    if (activeTab === 'ALL') return allOpportunities;
    return allOpportunities.filter((o) => o.status === activeTab);
  }, [allOpportunities, activeTab]);

  // Status counts
  const counts = useMemo(() => {
    const c = { pending_review: 0, accepted: 0, monitored: 0, rejected: 0, total: 0 };
    allOpportunities.forEach((o) => {
      if (o.status in c) c[o.status as keyof typeof c]++;
      c.total++;
    });
    return c;
  }, [allOpportunities]);

  // Tab definitions
  const tabs = useMemo(() => [
    { key: 'ALL', label: 'All', count: counts.total },
    { key: 'pending_review', label: 'Pending Review', count: counts.pending_review },
    { key: 'accepted', label: 'Accepted', count: counts.accepted },
    { key: 'monitored', label: 'Monitored', count: counts.monitored },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
  ], [counts]);

  // Handle action
  const handleAction = useCallback(async (
    id: string,
    action: 'accept' | 'reject' | 'monitor',
    reason?: string,
  ) => {
    setActioningIds((prev) => new Set(prev).add(id));
    setIsActioning(true);
    try {
      const res = await fetch('/api/g-outreach/opportunities/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, opportunityIds: [id], rejectionReason: reason }),
      });
      if (!res.ok) throw new Error('Action failed');
      setAllOpportunities((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'monitored', rejectionReason: reason ?? o.rejectionReason }
            : o,
        ),
      );
      const labels: Record<string, string> = { accept: 'accepted', reject: 'rejected', monitor: 'monitored' };
      toast.success(`Opportunity ${labels[action]}`, {
        description: reason ? `Reason: ${reason.replace(/_/g, ' ')}` : undefined,
      });
    } catch {
      toast.error('Failed to update opportunity');
    } finally {
      setActioningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setIsActioning(false);
    }
  }, []);

  // Handle company click
  const handleCompanyClick = useCallback((companyId: string) => {
    setSelectedCompanyId(companyId);
  }, [setSelectedCompanyId]);

  // Handle generate
  const handleGenerate = useCallback(() => {
    toast.info('Generating new opportunities...', { description: 'AI is scanning for new signals and opportunities.' });
  }, []);

  // Set filtered state for rendering
  useEffect(() => {
    setOpportunities(filtered);
  }, [filtered]);

  return (
    <PageTransition>
      <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="h-7 w-1.5 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, #E8C860, #D4AF37, #9A8340)',
                  boxShadow: '0 0 12px rgba(212, 175, 55, 0.3)',
                }}
              />
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Opportunity Workspace
              </h1>
            </div>
            <p className="text-sm text-muted-foreground ml-5">
              AI-identified opportunities backed by intelligence
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20"
          >
            <Sparkles className="w-4 h-4" />
            Generate
          </Button>
        </div>

        {/* ─── Stat Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Pending Review"
            value={counts.pending_review}
            icon={Clock}
            color="var(--color-gold)"
            delay={0}
          />
          <StatCard
            label="Accepted"
            value={counts.accepted}
            icon={CheckCircle2}
            color="#059669"
            delay={0.08}
          />
          <StatCard
            label="Monitored"
            value={counts.monitored}
            icon={Eye}
            color="#2563EB"
            delay={0.16}
          />
          <StatCard
            label="Rejected"
            value={counts.rejected}
            icon={XCircle}
            color="#DC2626"
            delay={0.24}
          />
        </div>

        {/* ─── Tab Bar ─── */}
        <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {/* ─── Content ─── */}
        {loading ? (
          <LoadingSkeleton />
        ) : opportunities.length === 0 ? (
          <EmptyState
            icon={Brain}
            title={activeTab === 'ALL' ? 'No opportunities yet' : `No ${activeTab.replace(/_/g, ' ')} opportunities`}
            description={
              activeTab === 'ALL'
                ? 'Generate opportunities to see AI-identified revenue chances here.'
                : `There are no ${activeTab.replace(/_/g, ' ')} opportunities to display.`
            }
            action={
              <Button
                onClick={handleGenerate}
                variant="outline"
                className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Opportunities
              </Button>
            }
          />
        ) : (
          <StaggerGrid
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            stagger={0.06}
          >
            <AnimatePresence mode="popLayout">
              {opportunities.map((opp) => (
                <StaggerItem key={opp.id}>
                  <OpportunityCard
                    opportunity={opp}
                    onAction={handleAction}
                    onCompanyClick={handleCompanyClick}
                    isActioning={actioningIds.has(opp.id)}
                  />
                </StaggerItem>
              ))}
            </AnimatePresence>
          </StaggerGrid>
        )}
      </div>
    </PageTransition>
  );
}