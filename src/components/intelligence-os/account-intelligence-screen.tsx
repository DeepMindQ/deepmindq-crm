'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §7 — Account Intelligence Screen
   
   Main account intelligence view with 4-tab navigation:
   Overview, Signals, Contacts, and Recommendations.
   
   This is the depth & trust entry point for any single account.
   Every data point shows its evidence provenance, confidence,
   and verification status. Zero dead ends.
   
   MS6 Reference: reference_account_intelligence.html
   MS8 Principles: Evidence, Transparency, Explainability
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Activity, Users, Sparkles, ChevronDown, ChevronRight,
  FileText, TrendingUp, BarChart3, Target, Clock,
  ShieldCheck, ExternalLink, AlertTriangle, Info,
  Radar, Signal, User, Mail, Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, elevation, motion as motionTokens, typography } from './design-tokens';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type {
  AccountTrustData,
  AccountIntelligenceTab,
  AccountSignalEntry,
  EvidenceChainItem,
  IntelligenceGrade,
  EvidenceFootprint as EvidenceFootprintType,
  ConfidenceBreakdown as ConfidenceBreakdownType,
  VerificationStatus,
} from '@/types/ms8-evidence';
import { TrustLevel } from '@/lib/intelligence-types';
import { getTrustColor, getTrustLabel, getConfidenceTrustLevel, formatFreshness } from '@/lib/intelligence-types';
import { EvidenceChain } from './evidence-chain';
import { ConfidenceBreakdown } from './confidence-breakdown';
import { EvidenceFootprint } from './molecules/evidence-footprint';
import { VerificationBadge } from './atoms/verification-badge';
import { TrustIndicator } from './atoms/trust-indicator';
import { CompanyIntelligenceHeader } from './company-intelligence-header';

// ─── Data Interface ─────────────────────────────────────────

/** Contact entry for the Contacts tab */
export interface AccountContact {
  id: string;
  name: string;
  title: string;
  email?: string;
  avatarGradient?: string;
  trustLevel: TrustLevel;
}

/** Recommendation entry for the Recommendations tab */
export interface AccountRecommendation {
  id: string;
  title: string;
  description: string;
  confidence: number;
  reasoning: string;
  actionType: 'review' | 'save' | 'monitor' | 'schedule';
  relatedSignalId?: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

/** Complete data for the Account Intelligence Screen */
export interface AccountIntelligenceScreenData {
  /** Account-level trust and confidence data */
  trustData: AccountTrustData;

  /** Active intelligence signals */
  signals: AccountSignalEntry[];

  /** Key contacts associated with the account */
  contacts: AccountContact[];

  /** AI-generated recommendations */
  recommendations: AccountRecommendation[];
}

// ─── Screen Props ───────────────────────────────────────────
export interface AccountIntelligenceScreenProps {
  /** Company identifier */
  companyId: string;

  /** Company display name */
  companyName: string;

  /** Industry classification */
  industry?: string;

  /** Company domain */
  domain?: string;

  /** Complete intelligence data */
  data: AccountIntelligenceScreenData;
}

// ─── Grade Color Map ────────────────────────────────────────
const GRADE_COLORS: Record<IntelligenceGrade, string> = {
  A: '#22c55e',
  B: '#14b8a6',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444',
};

const GRADE_BG: Record<IntelligenceGrade, string> = {
  A: 'rgba(34, 197, 94, 0.12)',
  B: 'rgba(20, 184, 166, 0.12)',
  C: 'rgba(245, 158, 11, 0.12)',
  D: 'rgba(249, 115, 22, 0.12)',
  F: 'rgba(239, 68, 68, 0.12)',
};

// ─── Impact Level Colors ────────────────────────────────────
const IMPACT_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: tokens.priority.critical.value, bg: tokens.priority.critical.bg, border: tokens.priority.critical.border, label: 'Critical' },
  high:     { color: tokens.priority.high.value,     bg: tokens.priority.high.bg,     border: tokens.priority.high.border,     label: 'High' },
  medium:   { color: tokens.priority.medium.value,   bg: tokens.priority.medium.bg,   border: tokens.priority.medium.border,   label: 'Medium' },
  low:      { color: tokens.priority.low.value,      bg: tokens.priority.low.bg,      border: tokens.priority.low.border,      label: 'Low' },
};

// ─── Priority Colors ─────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  high:   { color: tokens.priority.high.value,   bg: tokens.priority.high.bg,   border: tokens.priority.high.border },
  medium: { color: tokens.priority.medium.value, bg: tokens.priority.medium.bg, border: tokens.priority.medium.border },
  low:    { color: tokens.priority.low.value,    bg: tokens.priority.low.bg,    border: tokens.priority.low.border },
};

// ─── Tab Config ──────────────────────────────────────────────
const TAB_CONFIG: Array<{ id: AccountIntelligenceTab; label: string; icon: React.ElementType }> = [
  { id: 'overview',        label: 'Overview',        icon: BarChart3 },
  { id: 'signals',         label: 'Signals',         icon: Signal },
  { id: 'contacts',         label: 'Contacts',         icon: Users },
  { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
];

// ─── Glass Card Helper ──────────────────────────────────────
function GlassCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn('rounded-xl overflow-hidden', className)}
      style={{
        background: tokens.surface.card,
        border: `1px solid ${tokens.border.default}`,
        boxShadow: elevation.rest.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Card Header ─────────────────────────────────────────────
function CardHeaderRow({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: tokens.text.muted }}
        >
          {title}
        </span>
        {badge}
      </div>
      {children}
    </div>
  );
}

// ─── Key Metric Card ─────────────────────────────────────────
function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <GlassCard>
      <div className="flex items-start gap-3 p-4">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}25` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="min-w-0">
          <div
            className="font-mono font-semibold text-lg truncate"
            style={{ color: tokens.text.primary }}
          >
            {value}
          </div>
          <div
            className="text-[10px] font-medium uppercase tracking-wider mt-0.5"
            style={{ color: tokens.text.muted }}
          >
            {label}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Signal Timeline Entry ───────────────────────────────────
function SignalTimelineEntry({
  signal,
  index,
}: {
  signal: AccountSignalEntry;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const impactConfig = IMPACT_CONFIG[signal.impactLevel] || IMPACT_CONFIG.medium;
  const trustLevel = getConfidenceTrustLevel(signal.confidenceScore) as TrustLevel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: motionTokens.default.duration,
        ease: [...motionTokens.default.ease] as [number, number, number, number],
      }}
      className="relative"
    >
      <div
        className="flex items-start gap-3 py-3"
        style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
      >
        {/* Timeline dot */}
        <div className="relative flex-shrink-0 mt-1">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: impactConfig.color,
              boxShadow: `0 0 8px ${impactConfig.color}40`,
            }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p
              className="text-sm font-medium leading-snug"
              style={{ color: tokens.text.primary }}
            >
              {signal.headline}
            </p>

            {/* Expand button */}
            {signal.hasEvidenceChain && signal.evidence.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
                style={{
                  background: tokens.surface.elevated,
                  border: `1px solid ${tokens.border.default}`,
                  color: tokens.text.secondary,
                }}
                aria-label={expanded ? 'Collapse evidence' : 'Expand evidence'}
              >
                {expanded
                  ? <ChevronDown className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* Impact badge */}
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
              style={{
                color: impactConfig.color,
                background: impactConfig.bg,
                border: `1px solid ${impactConfig.border}`,
              }}
            >
              {impactConfig.label}
            </span>

            {/* Confidence */}
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-1.5 rounded-full overflow-hidden" style={{ background: tokens.surface.elevated }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${signal.confidenceScore}%`,
                    background: getTrustColor(trustLevel),
                  }}
                />
              </div>
              <span className="font-mono text-[10px] font-medium" style={{ color: tokens.text.secondary }}>
                {signal.confidenceScore}%
              </span>
            </div>

            {/* Freshness */}
            <div className="flex items-center gap-1" style={{ color: tokens.text.muted }}>
              <Clock className="w-3 h-3" />
              <span className="text-[10px]">{signal.freshnessLabel}</span>
            </div>
          </div>

          {/* Expanded evidence chain */}
          <AnimatePresence>
            {expanded && signal.evidence.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: motionTokens.default.duration }}
                className="mt-3 pl-0"
              >
                <EvidenceChain
                  items={signal.evidence.map((e, i) => ({
                    source: e.sourceName,
                    snippet: e.description,
                    date: e.detectedAt,
                    url: e.sourceUrl,
                    relevanceScore: e.relevanceScore,
                  }))}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Contact Row ────────────────────────────────────────────
function ContactRow({
  contact,
  index,
}: {
  contact: AccountContact;
  index: number;
}) {
  const gradients = [
    'linear-gradient(135deg, #3b82f6, #2563eb)',
    'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    'linear-gradient(135deg, #06b6d4, #0891b2)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
  ];
  const gradient = contact.avatarGradient || gradients[index % gradients.length];
  const initials = contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: motionTokens.fast.duration,
        ease: [...motionTokens.fast.ease] as [number, number, number, number],
      }}
      className="flex items-center justify-between py-3"
      style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0"
          style={{ background: gradient }}
        >
          <span className="text-xs font-semibold text-white">{initials}</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: tokens.text.primary }}>
            {contact.name}
          </div>
          <div className="text-xs truncate" style={{ color: tokens.text.secondary }}>
            {contact.title}
          </div>
        </div>
      </div>
      <TrustIndicator level={contact.trustLevel} size="sm" />
    </motion.div>
  );
}

// ─── Recommendation Card ─────────────────────────────────────
function RecommendationEntry({
  rec,
  index,
}: {
  rec: AccountRecommendation;
  index: number;
}) {
  const prioConfig = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.medium;
  const trustLevel = getConfidenceTrustLevel(rec.confidence) as TrustLevel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.06,
        duration: motionTokens.default.duration,
        ease: [...motionTokens.default.ease] as [number, number, number, number],
      }}
      className="rounded-xl overflow-hidden"
      style={{
        background: tokens.surface.card,
        border: `1px solid ${tokens.border.default}`,
        boxShadow: elevation.rest.shadow,
      }}
    >
      <div className="p-4">
        {/* Top row: badge + confidence */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
              style={{
                color: prioConfig.color,
                background: prioConfig.bg,
                border: `1px solid ${prioConfig.border}`,
              }}
            >
              {rec.priority}
            </span>
            <span className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>
              {rec.actionType}
            </span>
          </div>
          <TrustIndicator level={trustLevel} score={rec.confidence} size="sm" />
        </div>

        {/* Title */}
        <h4
          className="text-sm font-semibold mb-1.5"
          style={{ color: tokens.text.primary }}
        >
          {rec.title}
        </h4>

        {/* Description */}
        <p
          className="text-xs leading-relaxed mb-3"
          style={{ color: tokens.text.secondary }}
        >
          {rec.description}
        </p>

        {/* Reasoning (AI context) */}
        <div
          className="rounded-lg p-3 mb-3"
          style={{
            background: tokens.surface.elevated,
            borderLeft: `2px solid ${tokens.domain.opportunity}`,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3 h-3" style={{ color: tokens.domain.opportunity }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tokens.domain.opportunity }}>
              AI Reasoning
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: tokens.text.secondary }}>
            {rec.reasoning}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>
            {formatFreshness(rec.createdAt)}
          </span>
          <button
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              color: tokens.accent.bright,
              background: tokens.accent.ghost,
              border: `1px solid ${tokens.accent.subtle}`,
            }}
          >
            <ExternalLink className="w-3 h-3" />
            View Details
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
//   MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export function AccountIntelligenceScreen({
  companyId,
  companyName,
  industry,
  domain,
  data,
}: AccountIntelligenceScreenProps) {
  const [activeTab, setActiveTab] = useState<AccountIntelligenceTab>('overview');

  const { trustData, signals, contacts, recommendations } = data;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <CompanyIntelligenceHeader
        companyName={companyName}
        industry={industry}
        domain={domain}
        trustData={trustData}
      />

      {/* ── Tabs Navigation ── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AccountIntelligenceTab)}
      >
        <TabsList
          className="w-full justify-start h-auto gap-1 p-1 rounded-xl"
          style={{
            background: tokens.surface.elevated,
            border: `1px solid ${tokens.border.default}`,
          }}
        >
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all data-[state=active]:rounded-lg"
                style={{
                  color: isActive ? tokens.text.primary : tokens.text.secondary,
                  background: isActive ? tokens.surface.card : 'transparent',
                  boxShadow: isActive ? elevation.rest.shadow : 'none',
                  border: isActive ? `1px solid ${tokens.border.hover}` : '1px solid transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.id === 'signals' && signals.length > 0 && (
                  <span
                    className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold"
                    style={{
                      color: tokens.domain.signal,
                      background: `${tokens.domain.signal}15`,
                    }}
                  >
                    {signals.length}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ═══ Overview Tab ═══ */}
        <TabsContent value="overview" className="mt-0">
          <motion.div
            key="overview-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: motionTokens.smooth.duration, ease: motionTokens.smooth.ease as unknown as [number, number, number, number] }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4"
          >
            {/* ── Trust Score Panel ── */}
            <GlassCard className="lg:col-span-2">
              <CardHeaderRow
                title="Account Trust Analysis"
                badge={
                  <VerificationBadge
                    verification={trustData.verification}
                    size="xs"
                  />
                }
              />
              <div className="p-4 space-y-4">
                {/* Trust score display row */}
                <div className="flex items-center gap-6">
                  {/* Large score */}
                  <div className="flex flex-col items-center justify-center w-20 h-20 rounded-xl"
                    style={{
                      background: `${tokens.trust[trustData.overallTier].value}12`,
                      border: `1px solid ${tokens.trust[trustData.overallTier].border}`,
                    }}
                  >
                    <span
                      className="font-mono font-bold"
                      style={{
                        fontSize: '28px',
                        lineHeight: 1,
                        color: tokens.trust[trustData.overallTier].value,
                      }}
                    >
                      {trustData.overallScore}
                    </span>
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider mt-0.5"
                      style={{ color: tokens.trust[trustData.overallTier].value }}
                    >
                      Trust Score
                    </span>
                  </div>

                  {/* Grade badge */}
                  <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl"
                    style={{
                      background: GRADE_BG[trustData.grade],
                      border: `1px solid ${GRADE_COLORS[trustData.grade]}40`,
                    }}
                  >
                    <span
                      className="font-mono font-bold"
                      style={{ fontSize: '22px', lineHeight: 1, color: GRADE_COLORS[trustData.grade] }}
                    >
                      {trustData.grade}
                    </span>
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider mt-0.5"
                      style={{ color: GRADE_COLORS[trustData.grade] }}
                    >
                      Grade
                    </span>
                  </div>

                  {/* Quick stats */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <MetricCard
                      label="Active Signals"
                      value={trustData.activeSignalCount}
                      icon={Activity}
                      color={tokens.domain.signal}
                    />
                    <MetricCard
                      label="Verified Items"
                      value={trustData.verifiedItemCount}
                      icon={ShieldCheck}
                      color={tokens.trust.verified.value}
                    />
                    <MetricCard
                      label="Sources"
                      value={trustData.evidenceFootprint.totalSources}
                      icon={FileText}
                      color={tokens.domain.enrichment}
                    />
                  </div>
                </div>

                {/* Evidence footprint */}
                <div
                  className="rounded-lg p-3"
                  style={{ background: tokens.surface.elevated }}
                >
                  <EvidenceFootprint
                    footprint={trustData.evidenceFootprint}
                    size="sm"
                    showFreshness
                    showCount
                    showAIIndicator
                  />
                </div>
              </div>
            </GlassCard>

            {/* ── Confidence Breakdown Panel ── */}
            <GlassCard>
              <CardHeaderRow title="Confidence Breakdown" />
              <div className="p-4">
                <ConfidenceBreakdown
                  breakdown={trustData.confidenceBreakdown}
                  showRationale
                  showExplanations={false}
                  compact
                />
              </div>
            </GlassCard>
          </motion.div>
        </TabsContent>

        {/* ═══ Signals Tab ═══ */}
        <TabsContent value="signals" className="mt-0">
          <motion.div
            key="signals-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: motionTokens.smooth.duration, ease: motionTokens.smooth.ease as unknown as [number, number, number, number] }}
            className="mt-4"
          >
            <GlassCard>
              <CardHeaderRow
                title={`Active Signals (${signals.length})`}
              />
              <div className="px-4 pb-4 max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${tokens.border.hover} transparent` }}>
                {signals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Radar className="w-8 h-8" style={{ color: tokens.text.muted }} />
                    <p className="text-sm font-medium" style={{ color: tokens.text.muted }}>
                      No active signals detected
                    </p>
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      Signals will appear here as intelligence is gathered
                    </p>
                  </div>
                ) : (
                  <div className="divide-y-0">
                    {signals.map((signal, i) => (
                      <SignalTimelineEntry
                        key={signal.id}
                        signal={signal}
                        index={i}
                      />
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </TabsContent>

        {/* ═══ Contacts Tab ═══ */}
        <TabsContent value="contacts" className="mt-0">
          <motion.div
            key="contacts-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: motionTokens.smooth.duration, ease: motionTokens.smooth.ease as unknown as [number, number, number, number] }}
            className="mt-4"
          >
            <GlassCard>
              <CardHeaderRow
                title={`Key Contacts (${contacts.length})`}
              />
              <div className="px-4 pb-4 max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${tokens.border.hover} transparent` }}>
                {contacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Users className="w-8 h-8" style={{ color: tokens.text.muted }} />
                    <p className="text-sm font-medium" style={{ color: tokens.text.muted }}>
                      No contacts identified
                    </p>
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      Contacts will be discovered as intelligence is enriched
                    </p>
                  </div>
                ) : (
                  <div>
                    {contacts.map((contact, i) => (
                      <ContactRow key={contact.id} contact={contact} index={i} />
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </TabsContent>

        {/* ═══ Recommendations Tab ═══ */}
        <TabsContent value="recommendations" className="mt-0">
          <motion.div
            key="recommendations-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: motionTokens.smooth.duration, ease: motionTokens.smooth.ease as unknown as [number, number, number, number] }}
            className="mt-4"
          >
            {/* AI disclaimer banner */}
            <div
              className="rounded-xl p-3 mb-4 flex items-start gap-2"
              style={{
                background: `${tokens.domain.opportunity}08`,
                border: `1px solid ${tokens.domain.opportunity}20`,
                borderLeft: `3px solid ${tokens.domain.opportunity}`,
              }}
            >
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: tokens.domain.opportunity }} />
              <div>
                <p className="text-xs font-medium" style={{ color: tokens.domain.opportunity }}>
                  AI-Generated Recommendations
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: tokens.text.secondary }}>
                  These recommendations are AI assessments, not directives. Always use your professional judgment.
                </p>
              </div>
            </div>

            {/* Recommendations grid */}
            {recommendations.length === 0 ? (
              <GlassCard>
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Sparkles className="w-8 h-8" style={{ color: tokens.text.muted }} />
                  <p className="text-sm font-medium" style={{ color: tokens.text.muted }}>
                    No recommendations yet
                  </p>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>
                    Recommendations will appear as signals are analyzed
                  </p>
                </div>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.map((rec, i) => (
                  <RecommendationEntry key={rec.id} rec={rec} index={i} />
                ))}
              </div>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
