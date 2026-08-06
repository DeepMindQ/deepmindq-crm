'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §3 — Evidence Chain (Rewritten)
   
   Displays the chain of evidence supporting an intelligence
   conclusion with full source provenance, verification status,
   trust tier badges, freshness indicators, and expandable detail.
   
   MS6 Reference: Phase 3 intelligence_briefing_card.html L3 layer
   MS6 Pattern: PD-03 (Evidence Layer) — "What proves it?"
   
   Principles:
   - Confidence & Trust: Evidence is always accessible
   - Zero Dead Ends: Every source can be traced to its origin
   - Consistent Intelligence Language
   - Design DNA: All tokens from design-tokens.ts, no hardcoded values
   
   Backward compatibility: Accepts legacy EvidenceChainItem (flat)
   and new MS8 EvidenceChainItem (enriched).
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLink, Shield, Clock, ChevronDown, ChevronRight,
  CheckCircle2, ShieldCheck, ShieldAlert, ShieldQuestion,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, getTrustTier, motion as motionTokens, elevation } from './design-tokens';
import { SourceProvenanceBadge } from './atoms/source-provenance-badge';
import type { EvidenceChainItem as MS8EvidenceItem, TrustTier, EvidenceFootprint as EvidenceFootprintType } from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg, getTrustBorder, getTrustLabel } from '@/lib/intelligence-types';

// ─── Legacy interface (backward compatibility) ───────────────
/** @deprecated Use MS8 EvidenceChainItem from @/types/ms8-evidence instead */
export interface EvidenceChainItem {
  source: string;
  sourceType?: 'news' | 'filing' | 'web' | 'database' | 'social' | 'internal' | 'sec' | 'press';
  snippet: string;
  url?: string;
  date?: string;
  relevanceScore?: number;
}

/** @deprecated Alias for backward compatibility */
export type { EvidenceChainItem as LegacyEvidenceChainItem };

// ─── Source type → MS8 SourceCategory mapping ────────────────
function legacyTypeToCategory(type?: string): MS8EvidenceItem['sourceCategory'] {
  switch (type) {
    case 'sec': case 'filing': case 'press': return 'verified_official';
    case 'internal': return 'crm_internal';
    case 'database': return 'crm_internal';
    case 'news': case 'web': case 'social': return 'web_signal';
    default: return 'web_signal';
  }
}

/** Normalize legacy items to MS8 enriched items */
function normalizeItem(item: EvidenceChainItem, index: number): MS8EvidenceItem {
  const trustScore = item.relevanceScore ?? 50;
  return {
    id: `legacy-${index}`,
    title: item.source,
    description: item.snippet,
    sourceCategory: legacyTypeToCategory(item.sourceType),
    sourceName: item.source,
    sourceUrl: item.url,
    detectedAt: item.date ?? new Date().toISOString(),
    freshnessLabel: item.date ?? 'Unknown',
    trustTier: getTrustTier(trustScore) as TrustTier,
    trustScore,
    evidenceQuality: trustScore >= 80 ? 'verified' : trustScore >= 60 ? 'corroborated' : trustScore >= 40 ? 'inferred' : 'estimated',
    relevanceScore: item.relevanceScore ?? 50,
    humanVerified: false,
  };
}

// ─── Trust Tier Icon ─────────────────────────────────────────
function TrustIcon({ tier, size = 'sm' }: { tier: TrustTier; size?: 'xs' | 'sm' | 'md' }) {
  const iconClass = { xs: 'w-3 h-3', sm: 'w-3.5 h-3.5', md: 'w-4 h-4' }[size];
  const icons: Record<TrustTier, React.ElementType> = {
    verified: CheckCircle2,
    high: ShieldCheck,
    medium: ShieldAlert,
    low: ShieldAlert,
    unverified: ShieldQuestion,
  };
  const Icon = icons[tier];
  return <Icon className={iconClass} />;
}

// ─── Props ──────────────────────────────────────────────────
export interface EvidenceChainProps {
  /** Evidence items — accepts both legacy and MS8 enriched items */
  items: MS8EvidenceItem[] | EvidenceChainItem[];

  /** Section title (default: "Evidence Chain") */
  title?: string;

  /** Optional conclusion text shown at the bottom */
  conclusion?: string;

  /** Evidence verdict (maps to trust tier) */
  verdict?: 'strong' | 'moderate' | 'weak';

  /** Evidence footprint summary (shown in header) */
  footprint?: EvidenceFootprintType;

  /** Compact mode: hides descriptions, shows only source + trust */
  compact?: boolean;

  /** Maximum items to show before "Show more" */
  maxVisible?: number;

  /** Additional CSS classes */
  className?: string;
}

// ─── Verdict Config ──────────────────────────────────────────
function getVerdictConfig(verdict?: string) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    strong:   { label: 'Strong Evidence',   color: tokens.trust.verified.value, bg: tokens.trust.verified.bg,   border: tokens.trust.verified.border },
    moderate: { label: 'Moderate Evidence', color: tokens.trust.medium.value,   bg: tokens.trust.medium.bg,     border: tokens.trust.medium.border },
    weak:     { label: 'Weak Evidence',     color: tokens.trust.low.value,      bg: tokens.trust.low.bg,       border: tokens.trust.low.border },
  };
  return verdict ? map[verdict] : null;
}

// ─── Component ──────────────────────────────────────────────
export function EvidenceChain({
  items,
  title = 'Evidence Chain',
  conclusion,
  verdict,
  footprint,
  compact = false,
  maxVisible = 4,
  className,
}: EvidenceChainProps) {
  const [expanded, setExpanded] = useState(false);
  const verdictConfig = getVerdictConfig(verdict);

  // Normalize items
  const normalizedItems: MS8EvidenceItem[] = items.map((item, i) =>
    'sourceCategory' in item ? item : normalizeItem(item as EvidenceChainItem, i)
  );

  const visibleItems = expanded ? normalizedItems : normalizedItems.slice(0, maxVisible);
  const hasMore = normalizedItems.length > maxVisible;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionTokens.default.duration, ease: motionTokens.default.ease as unknown as [number, number, number, number] }}
      className={cn('rounded-xl border overflow-hidden', className)}
      style={{
        background: tokens.surface.card,
        borderColor: tokens.border.default,
        boxShadow: elevation.rest.shadow,
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" style={{ color: tokens.accent.DEFAULT }} />
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: tokens.text.muted }}
          >
            {title}
          </span>
          {footprint && (
            <span
              className="text-[10px] font-mono font-medium ml-1"
              style={{ color: tokens.text.muted }}
            >
              {footprint.totalSources} {footprint.totalSources === 1 ? 'source' : 'sources'}
            </span>
          )}
        </div>
        {verdictConfig && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: verdictConfig.bg,
              color: verdictConfig.color,
              border: `1px solid ${verdictConfig.border}`,
            }}
          >
            {verdictConfig.label}
          </span>
        )}
      </div>

      {/* ── Evidence Items ── */}
      <div className="divide-y" style={{ borderColor: tokens.border.subtle }}>
        <AnimatePresence mode="popLayout">
          {visibleItems.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                duration: motionTokens.fast.duration,
                ease: motionTokens.fast.ease as unknown as [number, number, number, number],
                delay: i * 0.04,
              }}
              className="flex items-start gap-3 px-4 py-3 group/item transition-colors hover:bg-white/[0.02]"
            >
              {/* Step number + connector line */}
              <div className="flex flex-col items-center shrink-0 pt-0.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold tabular-nums"
                  style={{
                    background: tokens.accent.subtle,
                    color: tokens.accent.bright,
                    border: `1px solid ${tokens.border.subtle}`,
                  }}
                >
                  {i + 1}
                </div>
                {i < visibleItems.length - 1 && (
                  <div
                    className="w-px flex-1 mt-1.5"
                    style={{ background: tokens.border.subtle, minHeight: '12px' }}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Title */}
                <div className="flex items-center gap-2 mb-1">
                  <SourceProvenanceBadge
                    category={item.sourceCategory}
                    sourceName={item.sourceName}
                    sourceUrl={item.sourceUrl}
                    trustTier={item.trustTier}
                    trustScore={item.trustScore}
                    size="xs"
                    showLabel={true}
                    showTrust={false}
                  />
                  <TrustIcon tier={item.trustTier} size="xs" />
                </div>

                {/* Description (hidden in compact mode) */}
                {!compact && (
                  <p
                    className="text-xs leading-relaxed mt-1 mb-2"
                    style={{ color: tokens.text.primary }}
                  >
                    {item.description}
                  </p>
                )}

                {/* Meta row: trust badge, freshness, relevance */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Trust tier badge */}
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold font-mono"
                    style={{
                      color: getTrustColor(item.trustTier),
                      backgroundColor: getTrustBg(item.trustTier),
                      border: `1px solid ${getTrustBorder(item.trustTier)}`,
                    }}
                  >
                    <TrustIcon tier={item.trustTier} size="xs" />
                    {getTrustLabel(item.trustTier)}
                  </span>

                  {/* Freshness */}
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-mono"
                    style={{
                      color: item.freshnessLabel.includes('ago') && parseInt(item.freshnessLabel) > 30
                        ? tokens.trust.medium.value
                        : tokens.text.muted,
                    }}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    {item.freshnessLabel}
                  </span>

                  {/* Relevance score */}
                  {item.relevanceScore > 0 && (
                    <span
                      className="text-[10px] font-semibold tabular-nums"
                      style={{
                        color: tokens.confidence[
                          item.relevanceScore >= 70 ? 'high' : item.relevanceScore >= 45 ? 'medium' : 'low'
                        ].value,
                      }}
                    >
                      {item.relevanceScore}% relevant
                    </span>
                  )}

                  {/* External link */}
                  {item.sourceUrl && !compact && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[10px] font-medium opacity-0 group-hover/item:opacity-100 transition-opacity"
                      style={{ color: tokens.accent.bright }}
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      Verify
                    </a>
                  )}

                  {/* Human verified indicator */}
                  {item.humanVerified && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1 py-px rounded-full text-[9px] font-semibold"
                      style={{
                        color: tokens.trust.verified.value,
                        backgroundColor: tokens.trust.verified.bg,
                      }}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Verified
                    </span>
                  )}
                </div>

                {/* Key data points */}
                {!compact && item.keyDataPoints && item.keyDataPoints.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {item.keyDataPoints.map((point, pi) => (
                      <span
                        key={pi}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                        style={{
                          color: tokens.text.secondary,
                          backgroundColor: tokens.surface.elevated,
                          border: `1px solid ${tokens.border.subtle}`,
                        }}
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Show More / Show Less ── */}
      {hasMore && (
        <div
          className="px-4 py-2.5 flex items-center justify-center cursor-pointer transition-colors"
          style={{
            borderTop: `1px solid ${tokens.border.subtle}`,
            color: tokens.accent.bright,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = tokens.accent.ghost; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium">
              <ChevronDown className="w-3.5 h-3.5" />
              Show less
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium">
              <ChevronRight className="w-3.5 h-3.5" />
              Show {normalizedItems.length - maxVisible} more source{normalizedItems.length - maxVisible > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Conclusion ── */}
      {conclusion && (
        <div
          className="px-4 py-3"
          style={{
            borderTop: `1px solid ${tokens.border.subtle}`,
            background: tokens.accent.ghost,
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: tokens.text.muted }}>
            Conclusion
          </p>
          <p className="text-xs font-medium leading-relaxed" style={{ color: tokens.text.primary }}>
            {conclusion}
          </p>
        </div>
      )}
    </motion.div>
  );
}
