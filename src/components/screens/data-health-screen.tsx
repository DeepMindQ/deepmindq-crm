'use client';

import { useRef } from 'react';
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
} from 'lucide-react';

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

  const color =
    score >= 80 ? '#16a34a' : score >= 60 ? '#D4AF37' : score >= 40 ? '#f59e0b' : '#ef4444';

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
   Demo Data
   ═══════════════════════════════════════════════════════════ */

const HEALTH_BREAKDOWN = [
  { label: 'Data Completeness', score: 82, color: '#16a34a' },
  { label: 'Contact Enrichment', score: 64, color: '#D4AF37' },
  { label: 'Signal Coverage', score: 71, color: '#f59e0b' },
  { label: 'Relationship Mapping', score: 58, color: '#ef4444' },
];

const QUALITY_CATEGORIES = [
  { icon: Mail, label: 'Missing Emails', count: 23, unit: 'contacts', score: 88, color: '#ef4444' },
  { icon: Building2, label: 'Missing Company Data', count: 12, unit: 'companies', score: 72, color: '#f59e0b' },
  { icon: Radio, label: 'Stale Signals', count: 8, unit: 'companies not monitored', score: 65, color: '#f59e0b' },
  { icon: GitBranch, label: 'Incomplete Stakeholder Maps', count: 15, unit: 'companies', score: 54, color: '#ef4444' },
  { icon: Tag, label: 'Missing Industry Classification', count: 9, unit: 'companies', score: 78, color: '#D4AF37' },
  { icon: Copy, label: 'Duplicate Records', count: 5, unit: 'potential', score: 91, color: '#16a34a' },
];

const ENRICHMENT_QUEUE = [
  { id: 'eq1', name: 'Acme Corp', type: 'company', missing: 'Revenue, employee count, tech stack', priority: 'high' as const },
  { id: 'eq2', name: 'Sarah Chen', type: 'contact', missing: 'LinkedIn profile, job title, email', priority: 'high' as const },
  { id: 'eq3', name: 'NovaTech Solutions', type: 'company', missing: 'Industry classification, headquarters', priority: 'medium' as const },
  { id: 'eq4', name: 'James Rodriguez', type: 'contact', missing: 'Phone number, company email', priority: 'medium' as const },
  { id: 'eq5', name: 'BlueSky Analytics', type: 'company', missing: 'Funding data, decision makers', priority: 'high' as const },
  { id: 'eq6', name: 'Emily Watson', type: 'contact', missing: 'Social profiles, seniority level', priority: 'low' as const },
  { id: 'eq7', name: 'Pinnacle Systems', type: 'company', missing: 'Annual revenue, headcount', priority: 'medium' as const },
  { id: 'eq8', name: 'David Kim', type: 'contact', missing: 'Email address, current role', priority: 'low' as const },
];

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

const FRESHNESS_DATA = [
  { group: 'Enterprise Accounts', lastUpdated: '2 hours ago', completeness: 94, color: '#16a34a' },
  { group: 'Mid-Market Accounts', lastUpdated: '6 hours ago', completeness: 82, color: '#D4AF37' },
  { group: 'SMB Accounts', lastUpdated: '1 day ago', completeness: 71, color: '#f59e0b' },
  { group: 'Prospect Pool', lastUpdated: '3 days ago', completeness: 58, color: '#ef4444' },
  { group: 'Churned Accounts', lastUpdated: '2 weeks ago', completeness: 42, color: '#ef4444' },
];

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

export default function DataHealthScreen({ navigateTo }: { navigateTo?: (screen: string, id?: string) => void }) {
  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1 pb-4">

        {/* ── 1. Page Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <SectionHeader
            title="Data Health"
            subtitle="Monitor and improve the quality of your intelligence data"
          />
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-primary/20 bg-primary/5 hidden sm:inline-flex">
            <HeartPulse className="h-3 w-3 mr-1.5" />
            72 issues detected
          </Badge>
        </div>

        {/* ── 2. Overall Health Score ────────────────────────────────────── */}
        <GlassPanel className="p-6">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Gauge */}
            <div className="shrink-0">
              <CircularGauge score={76} />
            </div>

            {/* Breakdown */}
            <div className="flex-1 w-full space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Health Breakdown</h3>
                <p className="text-xs text-muted-foreground">Scores across key data quality dimensions</p>
              </div>
              <div className="space-y-3">
                {HEALTH_BREAKDOWN.map((item, i) => (
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
                { label: 'Total Records', value: 2483, icon: Users, color: '#D4AF37' },
                { label: 'Healthy', value: 1847, icon: CheckCircle2, color: '#16a34a' },
                { label: 'Needs Attention', value: 521, icon: AlertTriangle, color: '#f59e0b' },
                { label: 'Critical', value: 115, icon: TrendingUp, color: '#ef4444' },
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
            {QUALITY_CATEGORIES.map((cat) => (
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
                      onClick={() => navigateTo?.('duplicates')}
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
              {ENRICHMENT_QUEUE.map((item, idx) => (
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
              {FRESHNESS_DATA.map((item, idx) => {
                const freshnessPct =
                  item.lastUpdated.includes('hour') ? 95
                    : item.lastUpdated.includes('day') && !item.lastUpdated.includes('week') ? 70
                      : item.lastUpdated.includes('week') ? 35
                        : 50;

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
                        style={{ color: item.color }}
                      >
                        {item.completeness}% complete
                      </span>
                    </div>
                    <AnimatedBar value={freshnessPct} max={100} color={item.color} delay={0.1 * idx} />
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