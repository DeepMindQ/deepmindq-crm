'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  PageTransition,
  AnimatedCounter,
  EmptyState,
  StaggerGrid,
  StaggerItem,
  SectionHeader,
  AnimatedBar,
  GlassPanel,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  HeartPulse,
  Mail,
  Building2,
  Radio,
  GitBranch,
  Tag,
  Copy,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  TrendingUp,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */
interface DataHealthResponse {
  overallScore: number;
  totalRecords: number;
  healthyRecords: number;
  needsAttention: number;
  criticalRecords: number;
  healthBreakdown: {
    dataCompleteness: number;
    contactEnrichment: number;
    signalCoverage: number;
    relationshipMapping: number;
  };
  qualityCategories: {
    missingEmails: { count: number; entity: 'contacts' };
    missingCompanyData: { count: number; entity: 'companies' };
    staleSignals: { count: number; entity: 'companies' };
    incompleteStakeholders: { count: number; entity: 'companies' };
    missingIndustry: { count: number; entity: 'companies' };
    potentialDuplicates: { count: number; entity: 'contacts' };
  };
  enrichmentQueue: Array<{
    id: string;
    name: string;
    type: 'company' | 'contact';
    missing: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  dataFreshness: Array<{
    group: string;
    lastUpdated: string;
    completeness: number;
    totalRecords: number;
  }>;
}

/* ═══════════════════════════════════════════════════════════
   Shared constants
   ═══════════════════════════════════════════════════════════ */
const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

/** Map quality category key → (label, icon, unit, fixTarget) */
const CATEGORY_META: Record<
  keyof DataHealthResponse['qualityCategories'],
  { label: string; icon: typeof Mail; unit: string; fixTarget: string }
> = {
  missingEmails: { label: 'Missing Emails', icon: Mail, unit: 'contacts', fixTarget: 'contacts' },
  missingCompanyData: { label: 'Missing Company Data', icon: Building2, unit: 'companies', fixTarget: 'companies' },
  staleSignals: { label: 'Stale Signals', icon: Radio, unit: 'companies not monitored', fixTarget: 'companies' },
  incompleteStakeholders: { label: 'Incomplete Stakeholder Maps', icon: GitBranch, unit: 'companies', fixTarget: 'companies' },
  missingIndustry: { label: 'Missing Industry Classification', icon: Tag, unit: 'companies', fixTarget: 'companies' },
  potentialDuplicates: { label: 'Duplicate Records', icon: Copy, unit: 'potential', fixTarget: 'duplicates' },
};

/** Score color based on 0-100 threshold */
function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#D4AF37';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

/** Derive a category "health" score from its issue count */
function categoryScore(count: number): number {
  return Math.max(0, Math.min(100, 100 - count * 2));
}

/* ═══════════════════════════════════════════════════════════
   Circular Gauge Component
   ═══════════════════════════════════════════════════════════ */
function CircularGauge({ score, size = 160, strokeWidth = 12 }: { score: number; size?: number; strokeWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const motionVal = useMotionValue(0);
  const strokeDashoffset = useTransform(motionVal, v => circumference - (v / 100) * circumference);

  const color = scoreColor(score);

  // Animate the counter
  const counterRef = useRef<HTMLSpanElement>(null);
  const counterInView = useInView(counterRef, { once: true });
  const counterVal = useMotionValue(0);
  const rounded = useTransform(counterVal, v => Math.round(v));

  // Trigger animations
  if (inView) {
    animate(motionVal, score, { duration: 1.4, ease: [0.22, 1, 0.36, 1] });
    animate(counterVal, score, { duration: 1.4, ease: [0.22, 1, 0.36, 1] });
  }

  return (
    <div ref={ref} className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          style={{ strokeDasharray: circumference, strokeDashoffset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span ref={counterRef} className="text-4xl font-bold tabular-nums" style={{ color }}>
          <motion.span>{rounded}</motion.span>
        </motion.span>
        <span className="text-[11px] font-medium text-muted-foreground mt-0.5">out of 100</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════════════ */
function LoadingSkeleton() {
  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>

        {/* Overall Health Score */}
        <GlassPanel className="p-6">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="shrink-0">
              <CircularGauge score={0} />
            </div>
            <div className="flex-1 w-full space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-56" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 grid grid-cols-2 gap-3 lg:w-48">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                  <Skeleton className="w-4 h-4 mx-auto mb-1.5 rounded" />
                  <Skeleton className="h-5 w-10 mx-auto mb-0.5" />
                  <Skeleton className="h-2.5 w-14 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>

        {/* Quality Categories */}
        <div>
          <div className="space-y-2 mb-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
                <div className="flex-1 flex items-end justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-2 w-full rounded-full" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-8 w-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Enrichment Queue */}
        <div>
          <div className="space-y-2 mb-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
          <GlassPanel className="overflow-hidden">
            <div className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full shrink-0" />
                  <Skeleton className="h-8 w-20 rounded-md shrink-0" />
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* Data Freshness */}
        <div>
          <div className="space-y-2 mb-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-64" />
          </div>
          <GlassPanel className="p-5">
            <div className="space-y-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Skeleton className="w-2.5 h-2.5 rounded-full" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>
    </PageTransition>
  );
}

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

export default function DataHealthScreen({ navigateTo }: { navigateTo?: (screen: string, id?: string) => void }) {
  const [data, setData] = useState<DataHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (cacheBust = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = cacheBust ? `/api/data-health?_t=${Date.now()}` : '/api/data-health';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch data health (${res.status})`);
      }
      const json = await res.json();
      const d = json.data ?? json;
      setData(d);
    } catch (err) {
      console.error('[DataHealthScreen] fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Derived data ── */
  const healthBreakdown = data
    ? [
        { label: 'Data Completeness', score: data.healthBreakdown.dataCompleteness, color: scoreColor(data.healthBreakdown.dataCompleteness) },
        { label: 'Contact Enrichment', score: data.healthBreakdown.contactEnrichment, color: scoreColor(data.healthBreakdown.contactEnrichment) },
        { label: 'Signal Coverage', score: data.healthBreakdown.signalCoverage, color: scoreColor(data.healthBreakdown.signalCoverage) },
        { label: 'Relationship Mapping', score: data.healthBreakdown.relationshipMapping, color: scoreColor(data.healthBreakdown.relationshipMapping) },
      ]
    : [];

  const qualityCategories = data
    ? (Object.keys(CATEGORY_META) as Array<keyof DataHealthResponse['qualityCategories']>).map((key) => {
        const cat = data.qualityCategories[key];
        const meta = CATEGORY_META[key];
        const score = categoryScore(cat.count);
        return {
          icon: meta.icon,
          label: meta.label,
          count: cat.count,
          unit: meta.unit,
          score,
          color: scoreColor(score),
          fixTarget: meta.fixTarget,
        };
      })
    : [];

  const totalIssues = data
    ? Object.values(data.qualityCategories).reduce((sum, c) => sum + c.count, 0)
    : 0;

  /* ── States ── */
  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">Failed to load data health</p>
            <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-2 border-gray-200 text-foreground hover:bg-gray-100"
            onClick={() => fetchData(true)}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      </PageTransition>
    );
  }

  if (!data) {
    return (
      <PageTransition>
        <EmptyState
          title="No data health information"
          description="Start adding companies and contacts to see data health metrics."
          icon={HeartPulse}
        />
      </PageTransition>
    );
  }

  /* ── Main Render ── */
  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1 pb-4">

        {/* ── 1. Page Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <SectionHeader
            title="Data Health"
            subtitle="Monitor and improve the quality of your intelligence data"
          />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-primary/20 bg-primary/5 hidden sm:inline-flex">
              <HeartPulse className="h-3 w-3 mr-1.5" />
              {totalIssues} issues detected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs border-gray-200 text-muted-foreground hover:text-foreground hover:bg-gray-100 gap-1.5"
              onClick={() => fetchData(true)}
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* ── 2. Overall Health Score ────────────────────────────────────── */}
        <GlassPanel className="p-6">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Gauge */}
            <div className="shrink-0">
              <CircularGauge score={data.overallScore} />
            </div>

            {/* Breakdown */}
            <div className="flex-1 w-full space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Health Breakdown</h3>
                <p className="text-xs text-muted-foreground">Scores across key data quality dimensions</p>
              </div>
              <div className="space-y-3">
                {healthBreakdown.map((item, i) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground/80">{item.label}</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: item.color }}>
                        {item.score}%
                      </span>
                    </div>
                    <AnimatedBar value={item.score} max={100} color={item.color} delay={0.15 * i} />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="shrink-0 grid grid-cols-2 gap-3 lg:w-48">
              {[
                { label: 'Total Records', value: data.totalRecords, icon: Users, color: '#D4AF37' },
                { label: 'Healthy', value: data.healthyRecords, icon: CheckCircle2, color: '#16a34a' },
                { label: 'Needs Attention', value: data.needsAttention, icon: AlertTriangle, color: '#f59e0b' },
                { label: 'Critical', value: data.criticalRecords, icon: TrendingUp, color: '#ef4444' },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                  <stat.icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: stat.color }} />
                  <p className="text-lg font-bold tabular-nums text-foreground">
                    <AnimatedCounter value={stat.value} />
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>

        {/* ── 3. Data Quality Categories ─────────────────────────────────── */}
        <div>
          <SectionHeader title="Data Quality Categories" subtitle="Areas requiring attention" />
          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" stagger={0.06}>
            {qualityCategories.map((cat) => (
              <StaggerItem key={cat.label}>
                <motion.div
                  whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 h-full flex flex-col transition-shadow duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: `${cat.color}12` }}
                      >
                        <cat.icon className="w-4.5 h-4.5" style={{ color: cat.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{cat.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cat.count} {cat.unit}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
                      style={{ background: `${cat.color}12`, color: cat.color }}
                    >
                      {cat.score}%
                    </span>
                  </div>
                  <div className="flex-1 flex items-end justify-between gap-3">
                    <div className="flex-1">
                      <AnimatedBar value={100 - cat.score} max={100} color={cat.color} delay={0.1} />
                      <p className="text-[10px] text-muted-foreground mt-1.5">Issue severity</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs font-medium border-gray-200 text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200 shrink-0"
                      onClick={() => navigateTo?.(cat.fixTarget)}
                    >
                      Fix
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>

        {/* ── 4. Enrichment Queue ───────────────────────────────────────── */}
        <div>
          <SectionHeader title="Enrichment Queue" subtitle="Records needing data enrichment" />
          <GlassPanel className="overflow-hidden">
            <div className="divide-y divide-gray-100">
              {data.enrichmentQueue.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors duration-150 group"
                >
                  {/* Type indicator */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      item.type === 'company' ? 'bg-blue-50' : 'bg-purple-50'
                    }`}
                  >
                    {item.type === 'company' ? (
                      <Building2 className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Users className="w-4 h-4 text-purple-600" />
                    )}
                  </div>

                  {/* Name & missing data */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        {item.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      Missing: {item.missing}
                    </p>
                  </div>

                  {/* Priority badge */}
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold uppercase tracking-wider border shrink-0 ${PRIORITY_STYLES[item.priority]}`}
                  >
                    {item.priority}
                  </Badge>

                  {/* Enrich button */}
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs font-medium bg-gradient-to-r from-yellow-500/90 to-amber-600/90 text-black hover:from-yellow-500 hover:to-amber-600 border-0 shadow-sm shadow-amber-500/10 transition-all duration-200 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => navigateTo?.(item.type === 'company' ? 'company-detail' : 'contact-detail', item.id)}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Enrich
                  </Button>
                </motion.div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* ── 5. Data Freshness Timeline ────────────────────────────────── */}
        <div>
          <SectionHeader title="Data Freshness" subtitle="How recently data was updated across account groups" />
          <GlassPanel className="p-5">
            <div className="space-y-5">
              {data.dataFreshness.map((item, idx) => {
                const freshnessPct =
                  item.lastUpdated.includes('hour') ? 95
                    : item.lastUpdated.includes('day') && !item.lastUpdated.includes('week') ? 70
                      : item.lastUpdated.includes('week') ? 35
                        : 50;

                const color = scoreColor(item.completeness);

                return (
                  <div key={item.group}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">{item.group}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-muted-foreground border-gray-200 font-normal"
                        >
                          <Clock className="h-2.5 w-2.5 mr-1" />
                          {item.lastUpdated}
                        </Badge>
                      </div>
                      <span
                        className="text-xs font-bold tabular-nums"
                        style={{ color }}
                      >
                        {item.completeness}% complete
                      </span>
                    </div>
                    <AnimatedBar value={freshnessPct} max={100} color={color} delay={0.1 * idx} />
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-[11px] text-muted-foreground">&lt; 6 hours</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-[11px] text-muted-foreground">&lt; 2 days</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-[11px] text-muted-foreground">&gt; 2 days</span>
              </div>
            </div>
          </GlassPanel>
        </div>

      </div>
    </PageTransition>
  );
}