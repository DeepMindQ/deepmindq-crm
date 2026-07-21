'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight,
  Building2,
  Shield,
  ChevronRight,
  Sparkles,
  Play,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DemoCompany {
  id: string;
  name: string;
  industry: string;
  score: number;
  tagline: string;
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
}

/* ------------------------------------------------------------------ */
/*  Demo companies                                                     */
/* ------------------------------------------------------------------ */

const DEMO_COMPANIES: DemoCompany[] = [
  {
    id: 'demo-aramco.com',
    name: 'Saudi Aramco',
    industry: 'Oil & Gas',
    score: 91,
    tagline: 'AI transformation signals',
    tier: 'HIGH',
  },
  {
    id: 'demo-adnoc.com',
    name: 'ADNOC',
    industry: 'Oil & Gas',
    score: 88,
    tagline: 'Cloud modernization activity',
    tier: 'HIGH',
  },
  {
    id: 'demo-stc.com',
    name: 'STC',
    industry: 'Telecommunications',
    score: 86,
    tagline: 'Data platform investment',
    tier: 'HIGH',
  },
  {
    id: 'demo-emiratesnbd.com',
    name: 'Emirates NBD',
    industry: 'Banking',
    score: 82,
    tagline: 'Digital banking expansion',
    tier: 'HIGH',
  },
  {
    id: 'demo-neom.com',
    name: 'NEOM',
    industry: 'Technology',
    score: 79,
    tagline: 'Smart city procurement',
    tier: 'MEDIUM',
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function getTierConfig(tier: string) {
  switch (tier) {
    case 'HIGH':
      return {
        label: 'HIGH',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        scoreColor: 'text-emerald-600',
      };
    case 'MEDIUM':
      return {
        label: 'MEDIUM',
        className: 'bg-amber-100 text-amber-700 border-amber-200',
        scoreColor: 'text-amber-600',
      };
    default:
      return {
        label: 'LOW',
        className: 'bg-gray-100 text-gray-600 border-gray-200',
        scoreColor: 'text-gray-600',
      };
  }
}

function getIndustryIcon(industry: string): string {
  switch (industry.toLowerCase()) {
    case 'oil & gas':
      return '🛢️';
    case 'telecommunications':
      return '📡';
    case 'banking':
      return '🏦';
    case 'technology':
      return '💡';
    default:
      return '🏢';
  }
}

/* ------------------------------------------------------------------ */
/*  Company Card                                                       */
/* ------------------------------------------------------------------ */

function CompanyCard({
  company,
  onExplore,
}: {
  company: DemoCompany;
  onExplore: () => void;
}) {
  const tierConfig = getTierConfig(company.tier);
  const barWidth = Math.min(100, Math.max(0, company.score));

  return (
    <button
      onClick={onExplore}
      className="group relative w-full text-left rounded-2xl border bg-card p-6 transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.06] hover:border-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {/* Industry icon */}
      <div className="text-3xl mb-4">
        {getIndustryIcon(company.industry)}
      </div>

      {/* Company name & industry */}
      <h3 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-foreground transition-colors">
        {company.name}
      </h3>
      <p className="text-sm text-muted-foreground mt-0.5">{company.industry}</p>

      {/* Score section */}
      <div className="mt-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Intelligence Score
          </span>
          <span className={`text-xl font-bold ${tierConfig.scoreColor}`}>
            {company.score}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={`h-full rounded-full ${getScoreBarColor(company.score)} transition-all duration-700 ease-out`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold px-2 py-0.5 border ${tierConfig.className}`}
          >
            {tierConfig.label}
          </Badge>
        </div>
      </div>

      {/* Tagline */}
      <p className="text-xs text-muted-foreground mt-4">{company.tagline}</p>

      {/* CTA */}
      <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-emerald-600 group-hover:text-emerald-700 transition-colors">
        Explore Intelligence
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function DemoSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border p-6 space-y-4">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function DemoExperienceScreen({
  navigateTo,
}: {
  navigateTo?: (screen: string, companyId?: string) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!mounted) return <DemoSkeleton />;

  const handleExplore = (companyId: string) => {
    navigateTo?.('revenue-intelligence-brief', companyId);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
      {/* ── Header ── */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 text-xs font-medium text-emerald-700">
          <Sparkles className="h-3.5 w-3.5" />
          Demo Mode
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Intelligence Demo
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
          Select a company to explore AI-powered intelligence analysis.
          Each company features real-world signal patterns from the Middle East market.
        </p>
      </header>

      {/* ── Quick stats bar ── */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span>{DEMO_COMPANIES.length} companies</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>AI-analyzed</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          <span>Click to explore</span>
        </div>
      </div>

      {/* ── Company Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DEMO_COMPANIES.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            onExplore={() => handleExplore(company.id)}
          />
        ))}

        {/* Empty placeholder card to maintain grid alignment */}
        <div className="hidden lg:block rounded-2xl border border-dashed p-6 flex flex-col items-center justify-center gap-3 text-muted-foreground/50 min-h-[240px]">
          <ChevronRight className="h-6 w-6" />
          <p className="text-xs">More companies coming soon</p>
        </div>
      </div>

      {/* ── Footer note ── */}
      <div className="text-center pt-4">
        <p className="text-xs text-muted-foreground/50">
          Demo data is simulated for demonstration purposes. Intelligence scores and signals
          are illustrative.
        </p>
      </div>
    </div>
  );
}