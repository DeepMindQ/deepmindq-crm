'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §7 — Account Trust Panel (Screen Component)
   
   Displays the account-level trust visualization including:
   - Overall trust score with tier badge
   - Intelligence grade (A-F)
   - Confidence breakdown
   - Evidence footprint summary
   - Verification status
   - Verified items count
   
   Used inside AccountIntelligenceScreen (Overview tab).
   MS6 Reference: reference_account_intelligence.html trust panel
   All tokens from design-tokens.ts. No hardcoded values.
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import {
  Shield, ShieldCheck, FileText, Activity,
  CheckCircle2, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, elevation, motion as motionTokens, typography } from '../design-tokens';
import { ConfidenceBreakdown } from '../confidence-breakdown';
import { EvidenceFootprint } from '../molecules/evidence-footprint';
import { VerificationBadge } from '../atoms/verification-badge';
import { VerificationTimestamp } from '../atoms/verification-timestamp';
import type { AccountTrustData, IntelligenceGrade } from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg, getTrustBorder, getTrustLabel } from '@/lib/intelligence-types';

// ─── Intelligence Grade Configuration ─────────────────────────
const GRADE_CONFIG: Record<IntelligenceGrade, {
  label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
}> = {
  A: { label: 'A', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)',   border: 'rgba(34, 197, 94, 0.3)',   description: 'Excellent' },
  B: { label: 'B', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)',  border: 'rgba(20, 184, 166, 0.3)',  description: 'Strong' },
  C: { label: 'C', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)',  border: 'rgba(245, 158, 11, 0.3)',  description: 'Moderate' },
  D: { label: 'D', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)',  border: 'rgba(249, 115, 22, 0.3)',  description: 'Below Average' },
  F: { label: 'F', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)',   border: 'rgba(239, 68, 68, 0.3)',   description: 'Poor' },
};

// ─── Props ──────────────────────────────────────────────────
export interface AccountTrustPanelProps {
  /** Account trust data */
  trustData: AccountTrustData;

  /** Show the confidence breakdown */
  showConfidenceBreakdown?: boolean;

  /** Show the evidence footprint */
  showFootprint?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────
export function AccountTrustPanel({
  trustData,
  showConfidenceBreakdown = true,
  showFootprint = true,
  className,
}: AccountTrustPanelProps) {
  const gradeConfig = GRADE_CONFIG[trustData.grade];
  const trustTier = trustData.overallTier;
  const trustColor = getTrustColor(trustTier);
  const trustBg = getTrustBg(trustTier);
  const trustBorder = getTrustBorder(trustTier);
  const trustLabel = getTrustLabel(trustTier);

  return (
    <div className={cn('space-y-4', className)}>
      {/* ── Trust Score + Grade Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: motionTokens.smooth.duration, ease: motionTokens.smooth.ease as unknown as [number, number, number, number] }}
        className="rounded-xl overflow-hidden"
        style={{
          background: tokens.surface.card,
          border: `1px solid ${tokens.border.default}`,
          boxShadow: elevation.rest.shadow,
        }}
      >
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
        >
          <Shield className="w-3.5 h-3.5" style={{ color: tokens.accent.DEFAULT }} />
          <span
            className="font-semibold uppercase"
            style={{ fontSize: '10px', letterSpacing: '2px', color: tokens.text.muted }}
          >
            Trust Assessment
          </span>
        </div>

        <div className="p-4">
          {/* Score + Grade row */}
          <div className="flex items-center gap-4 mb-4">
            {/* Trust Score */}
            <div
              className="flex flex-col items-center px-4 py-3 rounded-xl"
              style={{
                background: trustBg,
                border: `1px solid ${trustBorder}`,
              }}
            >
              <span
                className="font-mono font-bold"
                style={{ fontSize: '32px', lineHeight: 1, color: trustColor }}
              >
                {trustData.overallScore}
              </span>
              <span
                className="font-semibold uppercase mt-1"
                style={{ fontSize: '9px', letterSpacing: '1.5px', color: trustColor }}
              >
                {trustLabel}
              </span>
            </div>

            {/* Grade Badge */}
            <div
              className="flex flex-col items-center justify-center w-16 h-16 rounded-xl"
              style={{
                background: gradeConfig.bg,
                border: `1px solid ${gradeConfig.border}`,
              }}
            >
              <span
                className="font-mono font-bold"
                style={{ fontSize: '28px', lineHeight: 1, color: gradeConfig.color }}
              >
                {gradeConfig.label}
              </span>
              <span
                className="font-semibold uppercase"
                style={{ fontSize: '8px', letterSpacing: '1px', color: gradeConfig.color }}
              >
                {gradeConfig.description}
              </span>
            </div>

            {/* Quick stats */}
            <div className="flex-1 space-y-2">
              {/* Active Signals */}
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" style={{ color: tokens.domain.signal }} />
                <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  {trustData.activeSignalCount} active signal{trustData.activeSignalCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Verified Items */}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: tokens.trust.verified.value }} />
                <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  {trustData.verifiedItemCount} verified item{trustData.verifiedItemCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Verification Status */}
              <VerificationBadge
                verification={trustData.verification}
                size="xs"
                showVerifier={true}
              />
            </div>
          </div>

          {/* Evidence Footprint */}
          {showFootprint && (
            <div
              className="pt-3"
              style={{ borderTop: `1px solid ${tokens.border.subtle}` }}
            >
              <EvidenceFootprint
                footprint={trustData.evidenceFootprint}
                size="sm"
                showFreshness={true}
                showCount={true}
                showAIIndicator={true}
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Confidence Breakdown ── */}
      {showConfidenceBreakdown && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: motionTokens.smooth.duration,
            ease: motionTokens.smooth.ease as unknown as [number, number, number, number],
            delay: 0.1,
          }}
        >
          <ConfidenceBreakdown
            breakdown={trustData.confidenceBreakdown}
            showRationale={true}
            showExplanations={true}
            compact={false}
          />
        </motion.div>
      )}
    </div>
  );
}
