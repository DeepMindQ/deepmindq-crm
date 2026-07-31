'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, Activity, TrendingUp, DollarSign, Cpu, Crown,
  Building2, Clock, ChevronRight, RefreshCw, Filter, X, Search,
  Zap, Eye, Newspaper, Globe, Database, Sparkles, ArrowRight,
  LucideIcon, AlertTriangle, ShieldAlert, Shield, ShieldCheck, User,
  ArrowUpRight, Lightbulb, FileText, CheckCircle2, Loader2,
  ChevronDown, Layers, Target, Crosshair, Link2,
} from 'lucide-react';
import { PageTransition, AnimatedCounter, EmptyState } from '@/components/ui/animated-components';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';
import { AIProgressTracker } from '@/components/enterprise/AIProgressTracker';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   Types — aligned with CompanySignal schema + T8 API contract
   ═══════════════════════════════════════════════════════════════ */
interface SignalCapabilityMatch {
  id: string;
  matchScore: number;
  reason: string;
  businessProblem?: string;
  expectedOutcome?: string;
  salesAngle?: string;
  capability: { id: string; title: string; category?: string | null };
}

interface SignalItem {
  id: string;
  signalType: string;
  title: string;
  description?: string | null;
  companyName?: string;
  companyId: string;
  company?: { id: string; normalizedName: string; website?: string | null };
  severity: string;
  impact: string;
  confidence: number;
  meaningCategory?: string | null;
  signalDate?: string | null;
  extractedAt: string;
  source?: string | null;
  sourceUrl?: string | null;
  businessImpact?: string | null;
  recommendedAction?: string | null;
  timingWindow?: string | null;
  status: string;
  isRead: boolean;
  signalCapabilityMatches?: SignalCapabilityMatch[];
}

interface SignalsResponse {
  signals: SignalItem[];
  evidenceCounts: Record<string, number>;
  categories: string[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type DisplaySeverity = 'critical' | 'high' | 'medium' | 'low';
type TypeFilter = 'all' | 'technology' | 'growth' | 'partnership' | 'leadership' | 'news' | 'people';
type MeaningFilter = 'all' | 'budget_available' | 'leadership_openness' | 'tech_dissatisfaction' | 'growth_pressure' | 'compliance_requirement' | 'vendor_evaluation';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SortBy = 'severity' | 'confidence' | 'time';

/* ═══════════════════════════════════════════════════════════════
   Config — Signal Type Colors & Icons (from Prisma SignalType enum)
   ═══════════════════════════════════════════════════════════════ */
const typeConfig: Record<string, {
  icon: LucideIcon; color: string; bg: string; border: string;
  badge: string; label: string; category: string; accent: string;
  barColor: string;
}> = {
  funding:             { icon: DollarSign,    color: 'text-amber-600',   bg: 'bg-amber-50',     border: 'border-amber-200',     badge: 'bg-amber-100 text-amber-700 border-amber-300',       label: 'Funding',         category: 'growth',       accent: 'opportunity', barColor: '#D97706' },
  hiring:              { icon: User,          color: 'text-blue-600',    bg: 'bg-blue-50',      border: 'border-blue-200',      badge: 'bg-blue-100 text-blue-700 border-blue-300',          label: 'Hiring',          category: 'growth',       accent: 'opportunity', barColor: '#2563EB' },
  leadership_change:   { icon: Crown,         color: 'text-violet-600',   bg: 'bg-violet-50',    border: 'border-violet-200',    badge: 'bg-violet-100 text-violet-700 border-violet-300',    label: 'Leadership',      category: 'leadership',   accent: 'signal',     barColor: '#7C3AED' },
  leadership:          { icon: Crown,         color: 'text-violet-600',   bg: 'bg-violet-50',    border: 'border-violet-200',    badge: 'bg-violet-100 text-violet-700 border-violet-300',    label: 'Leadership',      category: 'leadership',   accent: 'signal',     barColor: '#7C3AED' },
  tech_change:         { icon: Cpu,           color: 'text-cyan-600',    bg: 'bg-cyan-50',      border: 'border-cyan-200',      badge: 'bg-cyan-100 text-cyan-700 border-cyan-300',          label: 'Technology',      category: 'technology',   accent: 'signal',     barColor: '#0891B2' },
  technology:          { icon: Cpu,           color: 'text-cyan-600',    bg: 'bg-cyan-50',      border: 'border-cyan-200',      badge: 'bg-cyan-100 text-cyan-700 border-cyan-300',          label: 'Technology',      category: 'technology',   accent: 'signal',     barColor: '#0891B2' },
  news:                { icon: Newspaper,     color: 'text-slate-600',   bg: 'bg-slate-50',     border: 'border-slate-200',     badge: 'bg-slate-100 text-slate-600 border-slate-300',       label: 'News',            category: 'news',         accent: 'signal',     barColor: '#475569' },
  mention:             { icon: Globe,         color: 'text-teal-600',    bg: 'bg-teal-50',      border: 'border-teal-200',      badge: 'bg-teal-100 text-teal-700 border-teal-300',          label: 'Mention',         category: 'news',         accent: 'signal',     barColor: '#0D9488' },
  partnership:         { icon: Link2,         color: 'text-blue-600',    bg: 'bg-blue-50',      border: 'border-blue-200',      badge: 'bg-blue-100 text-blue-700 border-blue-300',          label: 'Partnership',     category: 'partnership', accent: 'opportunity', barColor: '#2563EB' },
  expansion:           { icon: TrendingUp,    color: 'text-emerald-600', bg: 'bg-emerald-50',   border: 'border-emerald-200',   badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',  label: 'Expansion',       category: 'growth',       accent: 'opportunity', barColor: '#059669' },
  people_change:       { icon: User,          color: 'text-rose-600',    bg: 'bg-rose-50',      border: 'border-rose-200',      badge: 'bg-rose-100 text-rose-700 border-rose-300',          label: 'People Change',   category: 'leadership',   accent: 'signal',     barColor: '#E11D48' },
  internal_memory:     { icon: Database,      color: 'text-indigo-600',  bg: 'bg-indigo-50',    border: 'border-indigo-200',    badge: 'bg-indigo-100 text-indigo-700 border-indigo-300',     label: 'Internal Memory', category: 'technology',   accent: 'signal',     barColor: '#4F46E5' },
};

const defaultTypeConfig = {
  icon: Activity, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200',
  badge: 'bg-slate-100 text-slate-600 border-slate-300', label: 'Signal', category: 'growth', accent: 'signal', barColor: '#64748B',
};

/* ═══════════════════════════════════════════════════════════════
   Meaning Category Config — per T8 spec
   ═══════════════════════════════════════════════════════════════ */
const meaningCategoryConfig: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  budget_available:      { label: 'Budget Available',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200',     icon: DollarSign },
  leadership_openness:   { label: 'Leadership Open',       color: 'bg-violet-100 text-violet-700 border-violet-200',       icon: Crown },
  tech_dissatisfaction:  { label: 'Tech Dissatisfaction',   color: 'bg-red-100 text-red-700 border-red-200',               icon: Cpu },
  growth_pressure:       { label: 'Growth Pressure',        color: 'bg-amber-100 text-amber-700 border-amber-200',         icon: TrendingUp },
  compliance_requirement:{ label: 'Compliance Need',        color: 'bg-blue-100 text-blue-700 border-blue-200',            icon: Shield },
  vendor_evaluation:    { label: 'Vendor Evaluation',       color: 'bg-cyan-100 text-cyan-700 border-cyan-200',           icon: Target },
};

const impactConfig: Record<string, { label: string; color: string }> = {
  high:   { label: 'High Impact',   color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Med Impact',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  low:    { label: 'Low Impact',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const severityConfig: Record<DisplaySeverity, {
  label: string; icon: LucideIcon; color: string; bg: string; border: string; badge: string; order: number;
}> = {
  critical: { label: 'Critical', icon: ShieldAlert,   color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-300',      badge: 'bg-red-100 text-red-800 border-red-200',      order: 0 },
  high:     { label: 'High',     icon: Shield,         color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-300',    badge: 'bg-amber-100 text-amber-800 border-amber-200', order: 1 },
  medium:   { label: 'Medium',   icon: ShieldCheck,    color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-300',     badge: 'bg-blue-100 text-blue-800 border-blue-200',    order: 2 },
  low:      { label: 'Low',      icon: Shield,         color: 'text-slate-600',   bg: 'bg-slate-50',    border: 'border-slate-200',    badge: 'bg-slate-100 text-slate-700 border-slate-200',   order: 3 },
};

/* ═══════════════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════════════ */
function unwrap<T>(raw: unknown): T | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (obj.success === true && obj.data !== undefined) return obj.data as T;
  if (Array.isArray(raw) || !('success' in obj)) return raw as T;
  return undefined;
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDisplaySeverity(severity: string, confidence?: number): DisplaySeverity {
  if (severity === 'critical') return 'critical';
  if (severity === 'high' && (confidence ?? 0) >= 0.85) return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

function getConfidenceLabel(conf: number | undefined): string {
  if (conf === undefined) return '—';
  if (conf >= 80) return 'High';
  if (conf >= 60) return 'Medium';
  return 'Low';
}

function getCategoryForType(type: string): string {
  return typeConfig[type]?.category ?? 'growth';
}

function getSeverityOrder(s: string): number {
  const map: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return map[s] ?? 3;
}

/* ═══════════════════════════════════════════════════════════════
   Confidence Gauge (Featured Signal)
   ═══════════════════════════════════════════════════════════════ */
function ConfidenceGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value * 100)));
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 80 ? '#059669' : clamped >= 60 ? '#D97706' : '#DC2626';

  return (
    <div className="relative flex items-center justify-center">
      <svg aria-hidden="true" width="120" height="120" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="8" />
        <motion.circle
          cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-bold tabular-nums"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {clamped}%
        </motion.span>
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Confidence
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Capability Match Display — T8 exit criteria
   ═══════════════════════════════════════════════════════════════ */
function CapabilityMatchPanel({ matches }: { matches: SignalCapabilityMatch[] }) {
  if (!matches || matches.length === 0) {
    return (
      <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Target className="h-3 w-3 text-slate-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Capability Matches</span>
        </div>
        <p className="text-xs text-slate-500">No capability matches yet for this signal.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Crosshair className="h-3 w-3 text-blue-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
          Signal-to-Capability Matches
        </span>
        <Badge variant="secondary" className="text-[10px] ml-1">{matches.length}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {matches.map((m) => (
          <div key={m.id} className="flex items-start gap-2 rounded-md bg-white border border-slate-100 p-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {m.capability.title}
                </span>
                <span className="text-[10px] font-bold tabular-nums text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {Math.round(m.matchScore * 100)}%
                </span>
              </div>
              {m.reason && (
                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{m.reason}</p>
              )}
              {m.salesAngle && (
                <div className="mt-1.5 flex items-start gap-1">
                  <ArrowRight className="h-2.5 w-2.5 text-blue-500 mt-0.5 shrink-0" />
                  <span className="text-[11px] text-blue-600 font-medium leading-relaxed">{m.salesAngle}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Evidence Detail Panel — T8 exit criteria
   ═══════════════════════════════════════════════════════════════ */
function EvidenceDetailPanel({ signal, evidenceCount }: { signal: SignalItem; evidenceCount: number }) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Evidence count */}
      <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <FileText className="h-3 w-3 text-blue-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Supporting Evidence</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800 tabular-nums">{evidenceCount}</span>
          <span className="text-xs text-slate-500">evidence records backing this signal</span>
        </div>
        {signal.sourceUrl && (
          <a
            href={signal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            <Globe className="h-3 w-3" />
            {signal.sourceUrl.length > 60 ? signal.sourceUrl.slice(0, 60) + '...' : signal.sourceUrl}
          </a>
        )}
      </div>

      {/* Business Impact — from CompanySignal.businessImpact */}
      {signal.businessImpact && (
        <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb className="h-3 w-3 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Business Impact</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{signal.businessImpact}</p>
        </div>
      )}

      {/* Recommended Action — from CompanySignal.recommendedAction */}
      {signal.recommendedAction && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowRight className="h-3 w-3 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Recommended Action</span>
          </div>
          <p className="text-xs text-slate-700 font-medium leading-relaxed">{signal.recommendedAction}</p>
        </div>
      )}

      {/* Signal-to-Capability matches */}
      <CapabilityMatchPanel matches={signal.signalCapabilityMatches ?? []} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Featured Signal Alert
   ═══════════════════════════════════════════════════════════════ */
function FeaturedSignalCard({
  signal,
  evidenceCount,
  onViewCompany,
}: {
  signal: SignalItem;
  evidenceCount: number;
  onViewCompany: (companyId: string) => void;
}) {
  const cfg = typeConfig[signal.signalType] ?? defaultTypeConfig;
  const TypeIcon = cfg.icon;
  const confidence = signal.confidence ?? 0;
  const displaySev = getDisplaySeverity(signal.severity, confidence);
  const sevCfg = severityConfig[displaySev];
  const SevIcon = sevCfg.icon;
  const meaningCfg = signal.meaningCategory ? meaningCategoryConfig[signal.meaningCategory] : null;
  const MeaningIcon = meaningCfg?.icon ?? Lightbulb;
  const impactCfg = impactConfig[signal.impact] ?? impactConfig.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50/60 via-white to-amber-50/40"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 via-amber-500 to-red-500 animate-pulse" />

      <div className="p-5 sm:p-6 pl-6 sm:pl-7">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-red-600">Priority Alert</span>
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', sevCfg.badge)}>
                  <SevIcon className="h-3 w-3" />
                  {sevCfg.label}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">{signal.title}</h2>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
          <div className="flex flex-col gap-4">
            {/* Signal: What was detected */}
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Radar className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Signal Detected</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{signal.description || 'No description available.'}</p>
            </div>

            {/* Meta badges */}
            <div className="flex items-center gap-3 flex-wrap">
              <EvidenceBadge source={signal.source || 'internal'} confidence={Math.round(confidence * 100)} />
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="h-3 w-3" />
                {signal.signalDate ? formatTimeAgo(signal.signalDate) : formatTimeAgo(signal.extractedAt)}
              </span>
              {signal.company?.normalizedName && (
                <button
                  onClick={() => onViewCompany(signal.companyId)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  <Building2 className="h-3 w-3 text-slate-400" />
                  {signal.company.normalizedName}
                </button>
              )}
              {/* Impact badge */}
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', impactCfg.color)}>
                {impactCfg.label}
              </span>
              {/* Meaning category badge */}
              {meaningCfg && (
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', meaningCfg.color)}>
                  <MeaningIcon className="h-2.5 w-2.5" />
                  {meaningCfg.label}
                </span>
              )}
            </div>

            {/* Evidence detail panel with capability matches */}
            <EvidenceDetailPanel signal={signal} evidenceCount={evidenceCount} />
          </div>

          {/* Right: Confidence gauge */}
          <div className="flex flex-col items-center gap-3 lg:pl-4">
            <ConfidenceGauge value={confidence} />
            <div className="flex items-center gap-1.5">
              <TypeIcon className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">{cfg.label}</span>
            </div>
            {signal.companyId && (
              <Button
                onClick={() => onViewCompany(signal.companyId)}
                size="sm"
                className="mt-2 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                View Account
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Signal Card — Full T8 columns: Title, Type, Severity, Impact, Confidence, Meaning, Date
   ═══════════════════════════════════════════════════════════════ */
function SignalCard({
  signal,
  evidenceCount,
  onViewCompany,
}: {
  signal: SignalItem;
  evidenceCount: number;
  onViewCompany: (companyId: string) => void;
}) {
  const cfg = typeConfig[signal.signalType] ?? defaultTypeConfig;
  const TypeIcon = cfg.icon;
  const confidence = signal.confidence ?? 0;
  const displaySev = getDisplaySeverity(signal.severity, confidence);
  const sevCfg = severityConfig[displaySev];
  const SevIcon = sevCfg.icon;
  const impactCfg = impactConfig[signal.impact] ?? impactConfig.medium;
  const meaningCfg = signal.meaningCategory ? meaningCategoryConfig[signal.meaningCategory] : null;
  const MeaningIcon = meaningCfg?.icon ?? Lightbulb;
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      data-accent={cfg.accent}
      className="intel-card group"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1 }}
    >
      <div className="pl-5 pr-5 py-4 sm:pl-6 sm:pr-6 sm:py-5 flex flex-col gap-3.5">
        {/* Row 1: Type badge + Company + Severity + Impact + Meaning + Time */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Type icon + badge */}
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider border shrink-0',
              cfg.badge
            )}>
              <TypeIcon className="h-3 w-3" />
              {cfg.label}
            </span>
            {/* Company */}
            {signal.company?.normalizedName && (
              <button
                onClick={() => onViewCompany(signal.companyId)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline transition-colors"
              >
                <Building2 className="h-3 w-3 text-slate-400" />
                {signal.company.normalizedName}
              </button>
            )}
            {/* Severity badge — T8: color-coded */}
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
              sevCfg.badge
            )}>
              <SevIcon className="h-2.5 w-2.5" />
              {sevCfg.label}
            </span>
            {/* Impact badge — T8 column */}
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
              impactCfg.color
            )}>
              {impactCfg.label}
            </span>
            {/* Meaning category badge — T8 column */}
            {meaningCfg && (
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
                meaningCfg.color
              )}>
                <MeaningIcon className="h-2.5 w-2.5" />
                {meaningCfg.label}
              </span>
            )}
          </div>
          {/* Time */}
          <span className="flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap shrink-0">
            <Clock className="h-3 w-3" />
            {signal.signalDate ? formatTimeAgo(signal.signalDate) : formatTimeAgo(signal.extractedAt)}
          </span>
        </div>

        {/* Row 2: Title + Description */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 leading-snug">{signal.title}</h3>
          {signal.description && (
            <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">{signal.description}</p>
          )}
        </div>

        {/* Row 3: Confidence bar + Evidence count */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px] max-w-[220px]">
            <ConfidenceBar value={Math.round(confidence * 100)} label={getConfidenceLabel(Math.round(confidence * 100))} size="sm" />
          </div>
          {/* Evidence count badge — T8 evidence detail */}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-600">
            <FileText className="h-3 w-3" />
            {evidenceCount} evidence
          </span>
          {/* Capability matches count */}
          {(signal.signalCapabilityMatches?.length ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-blue-50 border border-blue-200 text-blue-600">
              <Target className="h-3 w-3" />
              {signal.signalCapabilityMatches!.length} match{signal.signalCapabilityMatches!.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {/* Row 4: Expandable evidence detail panel — T8: Click signal → evidence detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <Separator className="my-1" />
              <EvidenceDetailPanel signal={signal} evidenceCount={evidenceCount} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 5: Actions */}
        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            {expanded ? 'Collapse' : 'View Evidence & Matches'}
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-3 w-3" />
            </motion.div>
          </button>
          <div className="flex items-center gap-2">
            {signal.companyId && (
              <button
                onClick={() => onViewCompany(signal.companyId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/5 border border-primary/15 hover:border-primary/30 transition-colors"
              >
                View Account
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Filter Pills
   ═══════════════════════════════════════════════════════════════ */
function FilterPills<T extends string>({
  options,
  active,
  onChange,
  label,
}: {
  options: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-slate-400 shrink-0">{label}:</span>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
              active === opt.key
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            {opt.label}
            {opt.count !== undefined && opt.count > 0 && (
              <span className={cn(
                'ml-1.5 text-[11px] tabular-nums',
                active === opt.key ? 'text-slate-300' : 'text-slate-400'
              )}>
                {opt.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Signal Distribution Bar
   ═══════════════════════════════════════════════════════════════ */
function SignalDistributionBar({ signals }: { signals: SignalItem[] }) {
  const typeCounts: Record<string, { count: number; color: string; label: string }> = {};
  signals.forEach(s => {
    const cfg = typeConfig[s.signalType];
    if (!cfg) return;
    const label = cfg.label;
    if (!typeCounts[label]) {
      typeCounts[label] = { count: 0, color: cfg.barColor, label };
    }
    typeCounts[label].count++;
  });

  const entries = Object.values(typeCounts).sort((a, b) => b.count - a.count);
  const total = entries.reduce((sum, e) => sum + e.count, 0);

  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100">
        {entries.map((entry, idx) => (
          <motion.div
            key={entry.label}
            className="h-full"
            style={{ background: entry.color }}
            initial={{ width: 0 }}
            animate={{ width: `${(entry.count / total) * 100}%` }}
            transition={{ duration: 0.6, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
            title={`${entry.label}: ${entry.count} (${Math.round((entry.count / total) * 100)}%)`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {entries.map(entry => (
          <div key={entry.label} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
              {entry.label} <span className="text-slate-400">({entry.count})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════════════════ */
function SignalsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-5 w-64 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-xl w-full" />
            <Skeleton className="h-16 rounded-xl w-full" />
            <Skeleton className="h-16 rounded-xl w-full" />
          </div>
          <div className="flex justify-center items-start">
            <Skeleton className="h-[120px] w-[120px] rounded-full" />
          </div>
        </div>
      </div>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2 w-48 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AI Scanning Loading State
   ═══════════════════════════════════════════════════════════════ */
function ScanningState({ scanTime }: { scanTime: number }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (scanTime < 400) setStep(4);
    else if (scanTime < 800) setStep(3);
    else if (scanTime < 1400) setStep(2);
    else setStep(1);

    const t1 = setTimeout(() => setStep(2), 600);
    const t2 = setTimeout(() => setStep(3), 1200);
    const t3 = setTimeout(() => setStep(4), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [scanTime]);

  const steps = [
    { label: 'Reading account data', status: step >= 1 ? 'complete' as const : 'pending' as const },
    { label: 'Analyzing signal patterns', status: step >= 2 ? 'complete' as const : step === 1 ? 'processing' as const : 'pending' as const },
    { label: 'Mapping evidence & capabilities', status: step >= 3 ? 'complete' as const : step === 2 ? 'processing' as const : 'pending' as const },
    { label: 'Generating intelligence feed', status: step >= 4 ? 'complete' as const : step === 3 ? 'processing' as const : 'pending' as const },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-6">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200/50 flex items-center justify-center">
            <Radar className="h-7 w-7 text-blue-600" />
          </div>
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 animate-ping" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">Scanning for Intelligence Signals</h3>
        <p className="text-xs text-slate-400 max-w-xs text-center">
          Analyzing company signals, evidence records, and capability matches across your accounts
        </p>
      </div>
      <AIProgressTracker steps={steps} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Screen Component
   ═══════════════════════════════════════════════════════════════ */
interface SignalIntelligenceProps {
  navigateTo?: (screen: string, companyId?: string) => void;
}

export default function SignalIntelligenceScreen({ navigateTo }: SignalIntelligenceProps) {
  /* ── Data fetching with useQuery — T8 API contract ── */
  const { data: raw, isLoading, error: fetchError, refetch: fetchSignals } = useQuery({
    queryKey: ['signals', 'intelligence'],
    queryFn: () => fetch('/api/signals')
      .then(r => { if (!r.ok) throw new Error('Failed to fetch signals'); return r.json(); }),
    staleTime: 15000,
    retry: false,
  });
  const data = unwrap<SignalsResponse>(raw) ?? null;
  const loading = isLoading;
  const error = fetchError?.message || null;

  const [scanStartTime] = useState(Date.now());

  // Filters
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [meaningFilter, setMeaningFilter] = useState<MeaningFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('severity');
  const [search, setSearch] = useState('');

  // Pagination
  const [visibleCount, setVisibleCount] = useState(12);
  const loaderRef = useRef<HTMLDivElement>(null);

  const signals = data?.signals ?? [];
  const evidenceCounts = data?.evidenceCounts ?? {};
  const categories = data?.categories ?? [];
  const pagination = data?.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 };

  // Client-side filtering (server also supports filters, but we do client-side for instant UX)
  const filteredSignals = useMemo(() => {
    let result = [...signals];

    if (typeFilter !== 'all') {
      result = result.filter(s => getCategoryForType(s.signalType) === typeFilter);
    }

    if (meaningFilter !== 'all') {
      result = result.filter(s => s.meaningCategory === meaningFilter);
    }

    if (severityFilter !== 'all') {
      result = result.filter(s => {
        const ds = getDisplaySeverity(s.severity, s.confidence);
        return ds === severityFilter;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.company?.normalizedName?.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.signalType.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'severity') {
        const aSev = getSeverityOrder(getDisplaySeverity(a.severity, a.confidence));
        const bSev = getSeverityOrder(getDisplaySeverity(b.severity, b.confidence));
        if (aSev !== bSev) return aSev - bSev;
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      }
      if (sortBy === 'confidence') {
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      }
      return new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime();
    });

    return result;
  }, [signals, typeFilter, meaningFilter, severityFilter, search, sortBy]);

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    signals.forEach(s => {
      const ds = getDisplaySeverity(s.severity, s.confidence);
      counts[ds]++;
    });
    return counts;
  }, [signals]);

  const meaningCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    signals.forEach(s => {
      if (s.meaningCategory) {
        counts[s.meaningCategory] = (counts[s.meaningCategory] || 0) + 1;
      }
    });
    return counts;
  }, [signals]);

  const featuredSignal = useMemo(() => {
    if (filteredSignals.length === 0) return null;
    const first = filteredSignals[0];
    const ds = getDisplaySeverity(first.severity, first.confidence);
    return ds === 'critical' ? first : null;
  }, [filteredSignals]);

  const feedSignals = featuredSignal
    ? filteredSignals.filter(s => s.id !== featuredSignal.id)
    : filteredSignals;

  const visibleSignals = feedSignals.slice(0, visibleCount);
  const hasMore = visibleCount < feedSignals.length;

  // Infinite scroll observer
  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 8);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  const handleViewCompany = useCallback((companyId: string) => {
    navigateTo?.('company-detail', companyId);
  }, [navigateTo]);

  const clearFilters = useCallback(() => {
    setTypeFilter('all');
    setMeaningFilter('all');
    setSeverityFilter('all');
    setSearch('');
  }, []);

  const activeFilterCount = [
    typeFilter !== 'all' ? 1 : 0,
    meaningFilter !== 'all' ? 1 : 0,
    severityFilter !== 'all' ? 1 : 0,
    search ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const typeFilterOptions: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'technology', label: 'Technology' },
    { key: 'growth', label: 'Growth' },
    { key: 'partnership', label: 'Partnership' },
    { key: 'leadership', label: 'Leadership' },
    { key: 'news', label: 'News' },
    { key: 'people', label: 'People' },
  ];

  /* T8: Meaning category filter options from API categories */
  const meaningFilterOptions: { key: MeaningFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    ...(Object.entries(meaningCategoryConfig)
      .filter(([k]) => categories.includes(k))
      .map(([k, v]) => ({
        key: k as MeaningFilter,
        label: v.label,
        count: meaningCounts[k],
      }))
    ),
  ];

  const severityFilterOptions: { key: SeverityFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'critical', label: 'Critical', count: severityCounts.critical },
    { key: 'high', label: 'High', count: severityCounts.high },
    { key: 'medium', label: 'Medium', count: severityCounts.medium },
    { key: 'low', label: 'Low', count: severityCounts.low },
  ];

  const sortOptions: { key: SortBy; label: string }[] = [
    { key: 'severity', label: 'Severity' },
    { key: 'confidence', label: 'Confidence' },
    { key: 'time', label: 'Time' },
  ];

  const lastScanTime = useMemo(() => {
    if (!data) return null;
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }, [data]);

  return (
    <PageTransition>
      <div className="h-full flex flex-col gap-0 overflow-hidden">
        {/* ═══════════════════════════════════════════════════
           Section 1: Signal Intelligence Header
           ═══════════════════════════════════════════════════ */}
        <div className="flex-shrink-0 px-4 sm:px-6 pt-6 pb-2">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200/50">
                <Radar className="h-5.5 w-5.5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Signal Intelligence</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI-detected buying signals, evidence, and capability matches across your accounts
                </p>
              </div>
            </div>

            {/* Right side: summary badges + actions */}
            <div className="flex items-center gap-3 flex-wrap">
              {data && signals.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-400 mr-1">
                    <AnimatedCounter value={signals.length} className="text-sm font-bold text-slate-800" /> signals
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 mr-1">
                    {pagination.total} total
                  </span>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  {severityCounts.critical > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[11px] font-bold tabular-nums">
                      {severityCounts.critical} Critical
                    </span>
                  )}
                  {severityCounts.high > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[11px] font-bold tabular-nums">
                      {severityCounts.high} High
                    </span>
                  )}
                  {severityCounts.medium > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[11px] font-bold tabular-nums">
                      {severityCounts.medium} Medium
                    </span>
                  )}
                  {severityCounts.low > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold tabular-nums">
                      {severityCounts.low} Low
                    </span>
                  )}
                </div>
              )}

              {lastScanTime && (
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Last scan: {lastScanTime}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchSignals()}
                disabled={loading}
                className="h-8 gap-1.5 text-xs"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
           Section 2: Signal Distribution Analytics + Filters
           ═══════════════════════════════════════════════════ */}
        {data && signals.length > 0 && (
          <div className="flex-shrink-0 px-4 sm:px-6 pt-2 pb-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              {/* Distribution bar */}
              <SignalDistributionBar signals={signals} />

              {/* Filter rows */}
              <div className="flex flex-col gap-3">
                {/* Search */}
                <div className="relative max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search companies, signals, or types..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm bg-slate-50 border-slate-200"
                  />
                </div>

                {/* Filter pill groups */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 flex-wrap">
                  <FilterPills
                    options={typeFilterOptions}
                    active={typeFilter}
                    onChange={setTypeFilter}
                    label="Type"
                  />
                  {/* T8: Meaning category filter */}
                  <FilterPills
                    options={meaningFilterOptions}
                    active={meaningFilter}
                    onChange={setMeaningFilter}
                    label="Meaning"
                  />
                  <FilterPills
                    options={severityFilterOptions}
                    active={severityFilter}
                    onChange={setSeverityFilter}
                    label="Severity"
                  />
                  <FilterPills
                    options={sortOptions}
                    active={sortBy}
                    onChange={setSortBy}
                    label="Sort by"
                  />
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Active filter count */}
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    Showing {filteredSignals.length} of {signals.length} signals
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
           Sections 3–6: Content Area (scrollable)
           ═══════════════════════════════════════════════════ */}
        <div className="flex-1 min-h-0 px-4 sm:px-6 pb-6">
          {error && (
            <ErrorState
              title="Signal Intelligence Error"
              message={error}
              onRetry={() => fetchSignals()}
              className="mb-4"
            />
          )}

          {loading && !data ? (
            <ScanningState scanTime={Date.now() - scanStartTime} />
          ) : !data || signals.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={Radar}
                title="No signals detected yet"
                description="Signals are generated from our intelligence pipeline when company data is enriched. Import companies and run research to start detecting buying signals, technology changes, leadership moves, funding events, and more."
                action={
                  navigateTo && (
                    <div className="flex items-center gap-3">
                      <Button onClick={() => navigateTo('import')} size="sm" className="gap-1.5">
                        Import Companies
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                }
              />
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={Filter}
                title="No signals match your filters"
                description="Try adjusting your filter criteria to see more signals."
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5">
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-340px)]">
              <div className="space-y-4 pr-3">
                {/* Section 3: Featured Signal Alert */}
                <AnimatePresence>
                  {featuredSignal && (
                    <FeaturedSignalCard
                      signal={featuredSignal}
                      evidenceCount={evidenceCounts[featuredSignal.id] ?? 0}
                      onViewCompany={handleViewCompany}
                    />
                  )}
                </AnimatePresence>

                {/* Section 4: Signal Intelligence Feed */}
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-700">
                    Intelligence Feed
                  </h2>
                  <Badge variant="secondary" className="text-[11px] tabular-nums">
                    {feedSignals.length}
                  </Badge>
                </div>

                <AnimatePresence mode="popLayout">
                  {visibleSignals.map(signal => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      evidenceCount={evidenceCounts[signal.id] ?? 0}
                      onViewCompany={handleViewCompany}
                    />
                  ))}
                </AnimatePresence>

                {/* Load more sentinel */}
                {hasMore && (
                  <div ref={loaderRef} className="flex items-center justify-center py-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading more signals...
                    </div>
                  </div>
                )}

                {!hasMore && feedSignals.length > 12 && (
                  <div className="flex items-center justify-center py-3">
                    <span className="text-xs text-slate-400">
                      Showing all {feedSignals.length} signals
                    </span>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
