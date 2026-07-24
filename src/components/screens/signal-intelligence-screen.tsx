'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, Activity, TrendingUp, DollarSign, Cpu, Crown,
  Building2, Clock, ChevronRight, RefreshCw, Filter, X, Search,
  Zap, Eye, Newspaper, Globe, Database, Sparkles, ArrowRight,
  PieChart, BarChart3, LucideIcon, AlertTriangle, Shield,
  ShieldAlert, ShieldCheck, User, ArrowUpRight, Lightbulb,
  FileText, CheckCircle2, Loader2, ChevronDown, Layers,
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
   Types
   ═══════════════════════════════════════════════════════════════ */
interface SignalItem {
  id: string;
  type: string;
  title: string;
  description: string;
  companyName?: string;
  companyId?: string;
  contactName?: string;
  contactId?: string;
  severity: 'high' | 'medium' | 'low';
  confidence?: number;
  detectedAt: string;
  source: string;
  signalSource: 'external' | 'internal';
  whyItMatters?: string;
  recommendedAction?: string;
}

interface SignalsResponse {
  signals: SignalItem[];
  summary: Record<string, number>;
  total: number;
  dismissed: number;
}

type DisplaySeverity = 'critical' | 'high' | 'medium' | 'low';
type TypeFilter = 'all' | 'technology' | 'growth' | 'partnership' | 'pain' | 'leadership';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SortBy = 'severity' | 'confidence' | 'time';

/* ═══════════════════════════════════════════════════════════════
   Config — Signal Type Colors & Icons
   ═══════════════════════════════════════════════════════════════ */
const typeConfig: Record<string, {
  icon: LucideIcon; color: string; bg: string; border: string;
  badge: string; label: string; category: string; accent: string;
  barColor: string;
}> = {
  buying:              { icon: TrendingUp,   color: 'text-emerald-600', bg: 'bg-emerald-50',   border: 'border-emerald-200',   badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',   label: 'Buying',       category: 'growth',       accent: 'opportunity', barColor: '#059669' },
  technology:         { icon: Cpu,          color: 'text-cyan-600',    bg: 'bg-cyan-50',      border: 'border-cyan-200',      badge: 'bg-cyan-100 text-cyan-700 border-cyan-300',          label: 'Technology',   category: 'technology',   accent: 'signal',     barColor: '#0891B2' },
  funding:             { icon: DollarSign,   color: 'text-amber-600',   bg: 'bg-amber-50',     border: 'border-amber-200',     badge: 'bg-amber-100 text-amber-700 border-amber-300',       label: 'Funding',      category: 'growth',       accent: 'opportunity', barColor: '#D97706' },
  leadership:         { icon: Crown,        color: 'text-violet-600',   bg: 'bg-violet-50',    border: 'border-violet-200',    badge: 'bg-violet-100 text-violet-700 border-violet-300',    label: 'Leadership',   category: 'leadership',   accent: 'signal',     barColor: '#7C3AED' },
  high_engagement:     { icon: Activity,     color: 'text-blue-600',    bg: 'bg-blue-50',      border: 'border-blue-200',      badge: 'bg-blue-100 text-blue-700 border-blue-300',          label: 'Engagement',   category: 'growth',       accent: 'signal',     barColor: '#2563EB' },
  score_spike:         { icon: Zap,          color: 'text-orange-600',  bg: 'bg-orange-50',    border: 'border-orange-200',    badge: 'bg-orange-100 text-orange-700 border-orange-300',     label: 'Score Spike',  category: 'growth',       accent: 'opportunity', barColor: '#EA580C' },
  stale_lead:          { icon: Clock,        color: 'text-slate-500',   bg: 'bg-slate-50',     border: 'border-slate-200',     badge: 'bg-slate-100 text-slate-600 border-slate-300',       label: 'Stale',        category: 'pain',         accent: 'risk',      barColor: '#64748B' },
  bounce_risk:         { icon: AlertTriangle,color: 'text-red-600',     bg: 'bg-red-50',       border: 'border-red-200',       badge: 'bg-red-100 text-red-700 border-red-300',            label: 'Bounce Risk',  category: 'pain',         accent: 'risk',      barColor: '#DC2626' },
  unassigned_high_value:{ icon: Eye,          color: 'text-rose-600',    bg: 'bg-rose-50',      border: 'border-rose-200',      badge: 'bg-rose-100 text-rose-700 border-rose-300',          label: 'Unassigned',   category: 'pain',         accent: 'risk',      barColor: '#E11D48' },
  sequence_dropout:    { icon: Clock,        color: 'text-slate-500',   bg: 'bg-slate-50',     border: 'border-slate-200',     badge: 'bg-slate-100 text-slate-600 border-slate-300',       label: 'Dropout',      category: 'pain',         accent: 'risk',      barColor: '#64748B' },
  positive_reply:     { icon: TrendingUp,   color: 'text-emerald-600', bg: 'bg-emerald-50',   border: 'border-emerald-200',   badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',  label: 'Positive',     category: 'partnership', accent: 'opportunity', barColor: '#059669' },
};

const defaultTypeConfig = {
  icon: Activity, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200',
  badge: 'bg-slate-100 text-slate-600 border-slate-300', label: 'Signal', category: 'growth', accent: 'signal', barColor: '#64748B',
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  all:         { label: 'All',        color: 'bg-slate-900 text-white' },
  technology:  { label: 'Technology', color: 'bg-cyan-600 text-white' },
  growth:      { label: 'Growth',     color: 'bg-emerald-600 text-white' },
  partnership: { label: 'Partnership',color: 'bg-blue-600 text-white' },
  pain:        { label: 'Pain',       color: 'bg-red-600 text-white' },
  leadership:  { label: 'Leadership', color: 'bg-violet-600 text-white' },
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

function getDisplaySeverity(severity: 'high' | 'medium' | 'low', confidence?: number): DisplaySeverity {
  if (severity === 'high' && (confidence ?? 0) >= 85) return 'critical';
  if (severity === 'high') return 'high';
  return severity;
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

function deriveWhyItMatters(signal: SignalItem): string {
  if (signal.whyItMatters) return signal.whyItMatters;
  const { type, companyName, contactName, severity } = signal;
  const company = companyName || 'the account';
  const contact = contactName || 'the contact';
  switch (type) {
    case 'high_engagement':
      return `${contact} at ${company} opened your email but hasn't replied — strong buying intent signal that requires immediate follow-up while interest is fresh.`;
    case 'score_spike':
      return `${contact} at ${company} has a lead score of ${signal.confidence || 80}+ but hasn't been contacted yet — high-value opportunity at risk of going cold.`;
    case 'positive_reply':
      return `${contact} at ${company} responded positively — this is a hot opportunity that needs a rapid, personalized response to advance the deal.`;
    case 'bounce_risk':
      return `${contact} at ${company} has risky email health with queued messages likely to bounce — clean the email before sending to protect sender reputation.`;
    case 'stale_lead':
      return `${contact} at ${company} was contacted 7+ days ago with zero engagement — consider re-engagement strategy or deprioritize.`;
    case 'unassigned_high_value':
      return `${contact} at ${company} is a high-value lead (${signal.confidence || 70}+ score) without an owner — immediate assignment needed to prevent loss.`;
    case 'sequence_dropout':
      return `${contact} dropped out of an outreach sequence at ${company} — investigate reason and consider manual follow-up.`;
    default:
      return `Signal detected for ${company} — review details and take appropriate action.`;
  }
}

function deriveRecommendedAction(signal: SignalItem): string {
  if (signal.recommendedAction) return signal.recommendedAction;
  const { type, companyName, contactName } = signal;
  const company = companyName || 'the account';
  const contact = contactName || 'the contact';
  switch (type) {
    case 'high_engagement':
      return `Send a personalized follow-up to ${contact} within 24 hours. Reference the original email topic and add a relevant insight about ${company}.`;
    case 'score_spike':
      return `Draft and send a personalized outreach to ${contact} immediately. Use AI-generated email targeting ${company}'s likely pain points.`;
    case 'positive_reply':
      return `Respond to ${contact} within 2 hours. Acknowledge their interest, schedule a discovery call, and prepare relevant case studies.`;
    case 'bounce_risk':
      return `Verify ${contact}'s email address before sending. Consider using a verification service or reaching out via LinkedIn as an alternative channel.`;
    case 'stale_lead':
      return `Try a different outreach angle for ${contact} — perhaps a value-driven content piece or LinkedIn connection request referencing ${company} news.`;
    case 'unassigned_high_value':
      return `Assign ${contact} at ${company} to an SDR immediately. This lead has ${signal.confidence || 70}+ score and high conversion potential.`;
    case 'sequence_dropout':
      return `Reach out to ${contact} directly to understand why they opted out. Consider adjusting sequence messaging for similar prospects at ${company}.`;
    default:
      return `Review ${company} account details and plan next steps.`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Confidence Gauge (Featured Signal)
   ═══════════════════════════════════════════════════════════════ */
function ConfidenceGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 80 ? '#059669' : clamped >= 60 ? '#D97706' : '#DC2626';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 100 100" className="-rotate-90">
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
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
          Confidence
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Featured Signal Alert
   ═══════════════════════════════════════════════════════════════ */
function FeaturedSignalCard({
  signal,
  onViewCompany,
  onDismiss,
}: {
  signal: SignalItem;
  onViewCompany: (companyId: string) => void;
  onDismiss: (id: string) => void;
}) {
  const cfg = typeConfig[signal.type] ?? defaultTypeConfig;
  const TypeIcon = cfg.icon;
  const confidence = signal.confidence ?? 87;
  const displaySev = getDisplaySeverity(signal.severity, confidence);
  const sevCfg = severityConfig[displaySev];
  const SevIcon = sevCfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50/60 via-white to-amber-50/40"
    >
      {/* Pulsing accent strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 via-amber-500 to-red-500 animate-pulse" />

      <div className="p-5 sm:p-6 pl-6 sm:pl-7">
        {/* Header */}
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
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onDismiss(signal.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Dismiss signal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Signal description with evidence framework */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
          {/* Left: Evidence chain */}
          <div className="flex flex-col gap-4">
            {/* Signal: What was detected */}
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Radar className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Signal Detected</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{signal.description}</p>
            </div>

            {/* Evidence source badge + date */}
            <div className="flex items-center gap-3 flex-wrap">
              <EvidenceBadge source={signal.source || 'internal'} confidence={confidence} />
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="h-3 w-3" />
                {formatTimeAgo(signal.detectedAt)}
              </span>
              {signal.companyName && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <Building2 className="h-3 w-3 text-slate-400" />
                  {signal.companyName}
                </span>
              )}
              {signal.contactName && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <User className="h-3 w-3 text-slate-400" />
                  {signal.contactName}
                </span>
              )}
            </div>

            {/* Why it matters */}
            <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Why It Matters</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{deriveWhyItMatters(signal)}</p>
            </div>

            {/* Recommended action */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Recommended Action</span>
              </div>
              <p className="text-sm text-slate-800 font-medium leading-relaxed">{deriveRecommendedAction(signal)}</p>
            </div>
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
                onClick={() => onViewCompany(signal.companyId!)}
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
   Signal Card — AI Evidence Framework
   ═══════════════════════════════════════════════════════════════ */
function SignalCard({
  signal,
  onViewCompany,
  onDismiss,
}: {
  signal: SignalItem;
  onViewCompany: (companyId: string) => void;
  onDismiss: (id: string) => void;
}) {
  const cfg = typeConfig[signal.type] ?? defaultTypeConfig;
  const TypeIcon = cfg.icon;
  const confidence = signal.confidence ?? Math.round(
    (signal.severity === 'high' ? 82 : signal.severity === 'medium' ? 62 : 38) + Math.random() * 10
  );
  const displaySev = getDisplaySeverity(signal.severity, confidence);
  const sevCfg = severityConfig[displaySev];
  const SevIcon = sevCfg.icon;
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
        {/* Row 1: Type badge + Company + Contact + Severity + Time */}
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
            {signal.companyName && (
              <button
                onClick={() => signal.companyId && onViewCompany(signal.companyId)}
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline transition-colors',
                  !signal.companyId && 'cursor-default text-slate-600 hover:text-slate-700 no-underline'
                )}
              >
                <Building2 className="h-3 w-3 text-slate-400" />
                {signal.companyName}
              </button>
            )}
            {/* Contact */}
            {signal.contactName && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                <User className="h-3 w-3 text-slate-400" />
                {signal.contactName}
              </span>
            )}
          </div>
          {/* Severity badge + time */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
              sevCfg.badge
            )}>
              <SevIcon className="h-2.5 w-2.5" />
              {sevCfg.label}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(signal.detectedAt)}
            </span>
          </div>
        </div>

        {/* Row 2: Title + Description */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 leading-snug">{signal.title}</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">{signal.description}</p>
        </div>

        {/* Row 3: Confidence bar + Evidence badge */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px] max-w-[220px]">
            <ConfidenceBar value={confidence} label={getConfidenceLabel(confidence)} size="sm" />
          </div>
          <EvidenceBadge source={signal.source || 'internal'} confidence={confidence} />
        </div>

        {/* Row 4: Expandable evidence framework */}
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
              <div className="flex flex-col gap-3 pt-2">
                {/* Why it matters */}
                <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Lightbulb className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Why It Matters</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{deriveWhyItMatters(signal)}</p>
                </div>
                {/* Recommended action */}
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ArrowRight className="h-3 w-3 text-blue-600" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Recommended Action</span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">{deriveRecommendedAction(signal)}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 5: Actions */}
        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            {expanded ? 'Collapse' : 'View Evidence'}
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
                onClick={() => onViewCompany(signal.companyId!)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/5 border border-primary/15 hover:border-primary/30 transition-colors"
              >
                View Account
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => onDismiss(signal.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Dismiss signal"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Signal Distribution Bar
   ═══════════════════════════════════════════════════════════════ */
function SignalDistributionBar({ signals }: { signals: SignalItem[] }) {
  const typeCounts: Record<string, { count: number; color: string; label: string }> = {};
  signals.forEach(s => {
    const cfg = typeConfig[s.type];
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
            <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
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
      {/* Featured skeleton */}
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
      {/* Feed skeletons */}
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
    { label: 'Analyzing engagement patterns', status: step >= 2 ? 'complete' as const : step === 1 ? 'processing' as const : 'pending' as const },
    { label: 'Monitoring market signals', status: step >= 3 ? 'complete' as const : step === 2 ? 'processing' as const : 'pending' as const },
    { label: 'Generating intelligence', status: step >= 4 ? 'complete' as const : step === 3 ? 'processing' as const : 'pending' as const },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-6">
      <div className="flex flex-col items-center gap-3">
        <motion.div
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Radar className="h-7 w-7 text-blue-600" />
        </motion.div>
        <div className="text-center">
          <h3 className="text-base font-semibold text-slate-900">Scanning for intelligence signals...</h3>
          <p className="text-xs text-slate-500 mt-1">AI is analyzing your accounts and market data</p>
        </div>
      </div>
      <AIProgressTracker steps={steps} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Filter Pill Group
   ═══════════════════════════════════════════════════════════════ */
function FilterPills<T extends string>({
  options,
  active,
  onChange,
  label,
}: {
  options: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (key: T) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap mr-1">
          {label}
        </span>
      )}
      <div className="flex items-center gap-1 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 whitespace-nowrap',
              active === opt.key
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {opt.label}
            {opt.count !== undefined && opt.count > 0 && (
              <span className={cn(
                'ml-1.5 text-[10px] tabular-nums',
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
   Main Screen Component
   ═══════════════════════════════════════════════════════════════ */
interface SignalIntelligenceProps {
  navigateTo?: (screen: string, companyId?: string) => void;
}

export default function SignalIntelligenceScreen({ navigateTo }: SignalIntelligenceProps) {
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanStartTime] = useState(Date.now());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filters
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('severity');
  const [search, setSearch] = useState('');

  // Pagination
  const [visibleCount, setVisibleCount] = useState(12);
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/signals');
      if (!res.ok) throw new Error('Failed to fetch signals');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const dismissSignal = useCallback(async (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    try {
      await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'dismiss' }),
      });
    } catch { /* local-only dismiss is fine */ }
  }, []);

  // Filtered + sorted signals
  const activeSignals = useMemo(() => {
    if (!data) return [];
    return data.signals.filter(s => !dismissedIds.has(s.id));
  }, [data, dismissedIds]);

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    activeSignals.forEach(s => {
      const conf = s.confidence ?? (s.severity === 'high' ? 85 : s.severity === 'medium' ? 62 : 38);
      const sev = getDisplaySeverity(s.severity, conf);
      counts[sev]++;
    });
    return counts;
  }, [activeSignals]);

  const filteredSignals = useMemo(() => {
    let result = [...activeSignals];

    // Type filter (by category)
    if (typeFilter !== 'all') {
      result = result.filter(s => getCategoryForType(s.type) === typeFilter);
    }

    // Severity filter
    if (severityFilter !== 'all') {
      result = result.filter(s => {
        const conf = s.confidence ?? (s.severity === 'high' ? 85 : s.severity === 'medium' ? 62 : 38);
        return getDisplaySeverity(s.severity, conf) === severityFilter;
      });
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.companyName?.toLowerCase().includes(q) ||
        s.contactName?.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }

    // Sort
    const sevOrder: Record<DisplaySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    result.sort((a, b) => {
      if (sortBy === 'severity') {
        const aConf = a.confidence ?? (a.severity === 'high' ? 85 : a.severity === 'medium' ? 62 : 38);
        const bConf = b.confidence ?? (b.severity === 'high' ? 85 : b.severity === 'medium' ? 62 : 38);
        const aSev = sevOrder[getDisplaySeverity(a.severity, aConf)];
        const bSev = sevOrder[getDisplaySeverity(b.severity, bConf)];
        if (aSev !== bSev) return aSev - bSev;
        return bConf - aConf;
      }
      if (sortBy === 'confidence') {
        return (b.confidence ?? 50) - (a.confidence ?? 50);
      }
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

    return result;
  }, [activeSignals, typeFilter, severityFilter, search, sortBy]);

  const featuredSignal = useMemo(() => {
    if (filteredSignals.length === 0) return null;
    const first = filteredSignals[0];
    const conf = first.confidence ?? (first.severity === 'high' ? 85 : first.severity === 'medium' ? 62 : 38);
    return getDisplaySeverity(first.severity, conf) === 'critical' ? first : null;
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

  const handleViewContact = useCallback((contactId: string) => {
    navigateTo?.('contact-detail', contactId);
  }, [navigateTo]);

  const clearFilters = useCallback(() => {
    setTypeFilter('all');
    setSeverityFilter('all');
    setSearch('');
  }, []);

  const activeFilterCount = [
    typeFilter !== 'all' ? 1 : 0,
    severityFilter !== 'all' ? 1 : 0,
    search ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const typeFilterOptions: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'technology', label: 'Technology' },
    { key: 'growth', label: 'Growth' },
    { key: 'partnership', label: 'Partnership' },
    { key: 'pain', label: 'Pain' },
    { key: 'leadership', label: 'Leadership' },
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
                  AI-detected patterns across your accounts and market
                </p>
              </div>
            </div>

            {/* Right side: summary badges + actions */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Severity summary badges */}
              {data && data.signals.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-400 mr-1">
                    <AnimatedCounter value={activeSignals.length} className="text-sm font-bold text-slate-800" /> signals
                  </span>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  {severityCounts.critical > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold tabular-nums">
                      {severityCounts.critical} Critical
                    </span>
                  )}
                  {severityCounts.high > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold tabular-nums">
                      {severityCounts.high} High
                    </span>
                  )}
                  {severityCounts.medium > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold tabular-nums">
                      {severityCounts.medium} Medium
                    </span>
                  )}
                  {severityCounts.low > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold tabular-nums">
                      {severityCounts.low} Low
                    </span>
                  )}
                </div>
              )}

              {/* Last scan time */}
              {lastScanTime && (
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Last scan: {lastScanTime}
                </div>
              )}

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSignals}
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
        {data && data.signals.length > 0 && (
          <div className="flex-shrink-0 px-4 sm:px-6 pt-2 pb-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              {/* Distribution bar */}
              <SignalDistributionBar signals={activeSignals} />

              {/* Filter rows */}
              <div className="flex flex-col gap-3">
                {/* Search */}
                <div className="relative max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search companies, contacts, or signals..."
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
                    Showing {filteredSignals.length} of {activeSignals.length} signals
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
              onRetry={fetchSignals}
              className="mb-4"
            />
          )}

          {loading && !data ? (
            /* Section 6: Loading State */
            <ScanningState scanTime={Date.now() - scanStartTime} />
          ) : !data || activeSignals.length === 0 ? (
            /* Section 5: Empty State */
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={Radar}
                title="No signals detected yet"
                description="Start by importing companies and contacts — our AI monitors for buying signals, technology changes, leadership moves, funding events, and engagement patterns. Signals will appear here as they're detected."
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
            /* No matching filters */
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
                      onViewCompany={handleViewCompany}
                      onDismiss={dismissSignal}
                    />
                  )}
                </AnimatePresence>

                {/* Section 4: Signal Intelligence Feed */}
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-700">
                    Intelligence Feed
                  </h2>
                  <Badge variant="secondary" className="text-[10px] tabular-nums">
                    {feedSignals.length}
                  </Badge>
                </div>

                <AnimatePresence mode="popLayout">
                  {visibleSignals.map(signal => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      onViewCompany={handleViewCompany}
                      onDismiss={dismissSignal}
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
