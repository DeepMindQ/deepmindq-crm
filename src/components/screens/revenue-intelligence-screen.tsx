'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ArrowRight,
  TrendingUp,
  Shield,
  AlertCircle,
  Sparkles,
  Target,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { DEMO_COMPANIES as CANONICAL_DEMO, type DemoCompanyCard } from '@/lib/demo-data';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CompanyCard = DemoCompanyCard;

interface DashboardSummary {
  companies: CompanyCard[];
  avgHealthScore: number;
  totalCompanies: number;
}

/* ------------------------------------------------------------------ */
/*  Demo fallback — canonical source: lib/demo-data.ts                */
/* ------------------------------------------------------------------ */

const DEMO_COMPANIES = CANONICAL_DEMO;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function scoreColor(score: number) {
  if (score >= 80) return 'bg-emerald-500 text-white';
  if (score >= 60) return 'bg-amber-500 text-white';
  return 'bg-red-500 text-white';
}

function confidenceVariant(c: string) {
  switch (c) {
    case 'high':
      return 'border-emerald-500/40 text-emerald-700 bg-emerald-50';
    case 'medium':
      return 'border-amber-500/40 text-amber-700 bg-amber-50';
    default:
      return 'border-red-500/40 text-red-700 bg-red-50';
  }
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KpiCard({
  icon: Icon,
  label,
  value,
  context,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  context: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-gold-subtle' : 'bg-muted'}`}
        >
          <Icon className={`w-4 h-4 ${accent ? 'text-gold' : 'text-muted-foreground'}`} />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${accent ? 'text-gold' : 'text-foreground'}`}>
        {value}
      </p>
      <p className="text-sm text-muted-foreground leading-snug">{context}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Account Card                                                       */
/* ------------------------------------------------------------------ */

function AccountCard({
  rank,
  company,
  onView,
}: {
  rank: number;
  company: CompanyCard;
  onView: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow group">
      {/* Top row: rank + score + confidence */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-gold-subtle text-gold text-xs font-bold flex items-center justify-center">
            #{rank}
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground leading-tight">
              {company.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {company.industry} · {company.country}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${confidenceVariant(company.confidence)}`}
          >
            {company.confidence}
          </span>
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${scoreColor(company.score)}`}
          >
            {company.score}
          </div>
        </div>
      </div>

      {/* AI Insight — the "why" */}
      <div className="bg-muted/40 rounded-lg p-3 border-l-3 border-gold/50">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {company.reason}
        </p>
      </div>

      {/* Recommended Action — the "what" */}
      <div className="flex items-start gap-2">
        <Target className="w-4 h-4 text-gold mt-0.5 shrink-0" />
        <p className="text-sm text-foreground font-medium leading-snug">
          Recommended: {company.action}
        </p>
      </div>

      {/* Evidence footer */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-border/50">
        <span className="text-xs text-muted-foreground">
          Evidence: {company.signals} signals · {company.sources} sources
        </span>
        <button
          onClick={() => onView(company.id)}
          className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-bright transition-colors group/btn"
        >
          View Intelligence
          <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export default function RevenueIntelligenceScreen({
  navigateTo,
}: {
  navigateTo?: (screen: string, companyId?: string) => void;
}) {
  const [companies, setCompanies] = useState<CompanyCard[]>(DEMO_COMPANIES);
  const [avgHealth, setAvgHealth] = useState(78);
  const [activeConflicts, setActiveConflicts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashRes, conflictRes] = await Promise.allSettled([
          fetch('/api/g-intelligence/dashboard'),
          fetch('/api/g-intelligence/conflicts'),
        ]);

        // Dashboard
        if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
          const data: DashboardSummary = await dashRes.value.json();
          if (data.companies && data.companies.length > 0) {
            setCompanies(data.companies);
          }
          if (data.avgHealthScore != null) {
            setAvgHealth(Math.round(data.avgHealthScore));
          }
        }

        // Conflicts
        if (conflictRes.status === 'fulfilled' && conflictRes.value.ok) {
          const conflictData = await conflictRes.value.json();
          const openConflicts =
            conflictData?.openConflicts ??
            conflictData?.totalOpen ??
            (Array.isArray(conflictData) ? conflictData.length : 0);
          setActiveConflicts(typeof openConflicts === 'number' ? openConflicts : 0);
        }
      } catch (err) {
        console.error('[RevenueIntelligence] Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  /* Derived KPIs */
  const accountsNeedingAttention = companies.filter(
    (c) => c.signals >= 8
  ).length;
  const highConfidenceOpps = companies.filter(
    (c) => c.score >= 80 && c.confidence === 'high'
  ).length;
  const activeAlerts = companies.reduce(
    (sum, c) => sum + Math.min(c.signals, 3),
    0
  ) + activeConflicts;

  /* Loading skeleton */
  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-72 bg-muted rounded" />
        <div className="h-4 w-[480px] bg-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="h-6 w-48 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const topCompanies = companies.slice(0, 8);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Header ── */}
      <header className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gold-subtle flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-gold" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Revenue Intelligence
          </h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          AI-powered account prioritization based on signals, evidence,
          capability fit and confidence.
        </p>
      </header>

      {/* ── Decision-Oriented KPI Row ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={AlertCircle}
          label="Accounts Requiring Attention"
          value={accountsNeedingAttention}
          context="with active buying signals"
          accent
        />
        <KpiCard
          icon={Target}
          label="High-Confidence Opportunities"
          value={highConfidenceOpps}
          context="90+ intelligence score"
        />
        <KpiCard
          icon={Shield}
          label="Average Intelligence Health"
          value={`${avgHealth}%`}
          context="across analyzed accounts"
          accent
        />
        <KpiCard
          icon={Activity}
          label="Active Intelligence Alerts"
          value={activeAlerts}
          context="new buying signals detected"
        />
      </section>

      {/* ── Priority Accounts ── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Priority Accounts
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Accounts ranked by intelligence score and confidence
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            Showing top {topCompanies.length}
          </span>
        </div>

        {topCompanies.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-12 text-center">
            <TrendingUp className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No accounts analyzed yet. Intelligence data will appear here once
              accounts are enriched.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {topCompanies.map((company, idx) => (
              <AccountCard
                key={company.id}
                rank={idx + 1}
                company={company}
                onView={(id) => navigateTo?.('revenue-intelligence-brief', id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}