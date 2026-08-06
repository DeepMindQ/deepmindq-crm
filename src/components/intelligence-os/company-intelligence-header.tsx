'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §7 — Company Intelligence Header (Organism)
   
   Account-level header showing company name, trust score,
   intelligence grade badge, evidence footprint summary,
   and active signal count.
   
   Matches MS6 reference_account_intelligence.html header pattern:
   - Company name (h1, large)
   - Industry/domain secondary text
   - Trust score large numeric display with tier badge
   - Intelligence grade badge (A–F, color-coded)
   - Evidence footprint summary
   - Active signal count
   - Horizontal layout, responsive to vertical on mobile
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import {
  Building2, ShieldCheck, Activity, FileText,
  Signal, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, elevation, motion as motionTokens, typography } from './design-tokens';
import type { AccountTrustData, EvidenceFootprint as EvidenceFootprintType, IntelligenceGrade } from '@/types/ms8-evidence';
import { TrustIndicator } from './atoms/trust-indicator';
import type { TrustLevel } from '@/lib/intelligence-types';
import { getTrustLabel } from '@/lib/intelligence-types';

// ─── Intelligence Grade Configuration ─────────────────────────
const GRADE_CONFIG: Record<IntelligenceGrade, {
  label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
}> = {
  A: { label: 'A', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)', description: 'Excellent' },
  B: { label: 'B', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.3)', description: 'Strong' },
  C: { label: 'C', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', description: 'Moderate' },
  D: { label: 'D', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)', description: 'Below Average' },
  F: { label: 'F', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', description: 'Poor' },
};

// ─── Props ──────────────────────────────────────────────────
export interface CompanyIntelligenceHeaderProps {
  /** Company display name */
  companyName: string;

  /** Industry classification */
  industry?: string;

  /** Company domain/website */
  domain?: string;

  /** Account-level trust data */
  trustData: AccountTrustData;
}

// ─── Component ──────────────────────────────────────────────
export function CompanyIntelligenceHeader({
  companyName,
  industry,
  domain,
  trustData,
}: CompanyIntelligenceHeaderProps) {
  const gradeConfig = GRADE_CONFIG[trustData.grade];
  const trustTier = trustData.overallTier;
  const footprint = trustData.evidenceFootprint;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionTokens.smooth.duration, ease: [...motionTokens.smooth.ease] as [number, number, number, number] }}
      className="rounded-xl overflow-hidden"
      style={{
        background: tokens.surface.card,
        border: `1px solid ${tokens.border.default}`,
        boxShadow: elevation.rest.shadow,
      }}
    >
      <div
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 p-5 md:p-6"
      >
        {/* ── Left: Company Identity ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
              style={{
                background: tokens.accent.strong,
                border: `1px solid ${tokens.accent.subtle}`,
              }}
            >
              <Building2 className="w-5 h-5" style={{ color: tokens.accent.bright }} />
            </div>
            <div className="min-w-0">
              <h1
                className="truncate"
                style={{
                  fontSize: typography.h1.size,
                  fontWeight: typography.h1.weight,
                  lineHeight: typography.h1.lineHeight,
                  letterSpacing: typography.h1.tracking,
                  color: tokens.text.primary,
                }}
              >
                {companyName}
              </h1>
              {(industry || domain) && (
                <p className="flex items-center gap-2 text-xs" style={{ color: tokens.text.secondary }}>
                  {industry && <span>{industry}</span>}
                  {industry && domain && <span style={{ color: tokens.text.muted }}>·</span>}
                  {domain && (
                    <span className="truncate" style={{ color: tokens.text.muted }}>
                      {domain}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* ── Sub-row: Footprint + Signals on mobile ── */}
          <div className="flex items-center gap-4 mt-3 md:hidden">
            {/* Grade badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{
                background: gradeConfig.bg,
                border: `1px solid ${gradeConfig.border}`,
              }}
            >
              <span
                className="font-mono font-bold text-sm"
                style={{ color: gradeConfig.color }}
              >
                {gradeConfig.label}
              </span>
              <span
                className="text-[10px] font-semibold"
                style={{ color: gradeConfig.color }}
              >
                {gradeConfig.description}
              </span>
            </div>

            {/* Active signals */}
            <div className="flex items-center gap-1.5" style={{ color: tokens.text.secondary }}>
              <Activity className="w-3.5 h-3.5" style={{ color: tokens.domain.signal }} />
              <span className="text-xs font-medium">
                {trustData.activeSignalCount} signal{trustData.activeSignalCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* ── Center: Trust Score Display ── */}
        <div className="flex items-center gap-6 md:gap-8 order-first md:order-none">
          {/* Trust Score */}
          <div className="flex flex-col items-center">
            <div
              className="flex flex-col items-center px-5 py-3 rounded-xl"
              style={{
                background: `${tokens.trust[trustTier].bg}`,
                border: `1px solid ${tokens.trust[trustTier].border}`,
              }}
            >
              <div className="flex items-baseline gap-0.5">
                <span
                  className="font-mono font-bold"
                  style={{
                    fontSize: '28px',
                    lineHeight: 1,
                    color: tokens.trust[trustTier].value,
                  }}
                >
                  {trustData.overallScore}
                </span>
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider mt-1"
                style={{ color: tokens.trust[trustTier].value }}
              >
                {getTrustLabel(trustTier)}
              </span>
            </div>
          </div>

          {/* Grade Badge (desktop) */}
          <div
            className="hidden md:flex flex-col items-center gap-1.5"
          >
            <div
              className="flex flex-col items-center justify-center w-16 h-16 rounded-xl"
              style={{
                background: gradeConfig.bg,
                border: `1px solid ${gradeConfig.border}`,
              }}
            >
              <span
                className="font-mono font-bold"
                style={{
                  fontSize: '24px',
                  lineHeight: 1,
                  color: gradeConfig.color,
                }}
              >
                {gradeConfig.label}
              </span>
              <span
                className="text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: gradeConfig.color }}
              >
                {gradeConfig.description}
              </span>
            </div>
          </div>
        </div>

        {/* ── Right: Summary Stats (desktop) ── */}
        <div className="hidden md:flex flex-col items-end gap-3">
          {/* Evidence footprint summary */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" style={{ color: tokens.text.secondary }}>
              <FileText className="w-3.5 h-3.5" style={{ color: tokens.domain.enrichment }} />
              <span className="text-xs font-medium">
                {footprint.totalSources} source{footprint.totalSources !== 1 ? 's' : ''}
              </span>
            </div>
            <div
              className="w-px h-4"
              style={{ background: tokens.border.default }}
            />
            <div className="flex items-center gap-1.5" style={{ color: tokens.text.secondary }}>
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: tokens.trust.verified.value }} />
              <span className="text-xs font-medium">
                {footprint.verifiedCount} verified
              </span>
            </div>
          </div>

          {/* Active signals */}
          <div className="flex items-center gap-1.5" style={{ color: tokens.text.secondary }}>
            <Signal className="w-3.5 h-3.5" style={{ color: tokens.domain.signal }} />
            <span className="text-xs font-medium">
              {trustData.activeSignalCount} active signal{trustData.activeSignalCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Verified items count */}
          <div className="flex items-center gap-1.5" style={{ color: tokens.text.secondary }}>
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: tokens.trust.verified.value }} />
            <span className="text-xs font-medium">
              {trustData.verifiedItemCount} verified items
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
