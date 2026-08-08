'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §3 — Evidence Detail Panel (Molecule)
   
   Expanded view of a single evidence item with full provenance,
   verification status, key data points, and source link.
   
   Used inside EvidenceChain (when an item is expanded) and
   inside EvidenceLayer for detailed evidence inspection.
   
   All tokens from design-tokens.ts. No hardcoded values.
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import {
  ExternalLink, Shield, Clock, CheckCircle2,
  FileText, Globe, Database, Sparkles, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, elevation, motion as motionTokens } from '../design-tokens';
import { SourceProvenanceBadge } from '../atoms/source-provenance-badge';
import { VerificationBadge } from '../atoms/verification-badge';
import { VerificationTimestamp } from '../atoms/verification-timestamp';
import type { EvidenceChainItem, VerificationStatus } from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg, getTrustBorder, getTrustLabel } from '@/lib/intelligence-types';

// ─── Props ──────────────────────────────────────────────────
export interface EvidenceDetailPanelProps {
  /** Evidence item to display in detail */
  item: EvidenceChainItem;

  /** Associated verification status */
  verification?: VerificationStatus;

  /** Whether this panel is visible (controls animation) */
  isVisible?: boolean;

  /** Callback to close the panel */
  onClose?: () => void;

  /** Additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────
export function EvidenceDetailPanel({
  item,
  verification,
  isVisible = true,
  onClose,
  className,
}: EvidenceDetailPanelProps) {
  const trustColor = getTrustColor(item.trustTier);
  const trustBg = getTrustBg(item.trustTier);
  const trustBorder = getTrustBorder(item.trustTier);
  const trustLabel = getTrustLabel(item.trustTier);

  // Build a default verification status from item if not provided
  const effectiveVerification: VerificationStatus = verification ?? {
    isVerified: item.humanVerified,
    verifiedBy: null,
    verifiedAt: item.detectedAt,
    method: item.humanVerified ? 'human_review' : 'not_verified',
    notes: null,
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={isVisible ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
      transition={{
        duration: motionTokens.default.duration,
        ease: motionTokens.default.ease as unknown as [number, number, number, number],
      }}
      className={cn('overflow-hidden', className)}
    >
      <div
        className="rounded-lg p-3.5 space-y-3"
        style={{
          background: tokens.surface.elevated,
          border: `1px solid ${tokens.border.default}`,
          boxShadow: elevation.rest.shadow,
        }}
      >
        {/* ── Header: Source Provenance + Trust ── */}
        <div className="flex items-center justify-between gap-2">
          <SourceProvenanceBadge
            category={item.sourceCategory}
            sourceName={item.sourceName}
            sourceUrl={item.sourceUrl}
            trustTier={item.trustTier}
            trustScore={item.trustScore}
            size="sm"
            showLabel={true}
            showTrust={true}
          />
          <VerificationBadge
            verification={effectiveVerification}
            size="xs"
          />
        </div>

        {/* ── Title ── */}
        <h4
          className="font-semibold leading-snug"
          style={{
            fontSize: '13px',
            color: tokens.text.primary,
            lineHeight: 1.5,
          }}
        >
          {item.title}
        </h4>

        {/* ── Description ── */}
        <p
          className="leading-relaxed"
          style={{
            fontSize: '12px',
            color: tokens.text.secondary,
            lineHeight: 1.6,
          }}
        >
          {item.description}
        </p>

        {/* ── Meta Row: Freshness + Relevance + Trust ── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Freshness */}
          <span
            className="inline-flex items-center gap-1 font-mono"
            style={{ fontSize: '10px', color: tokens.text.muted }}
          >
            <Clock className="w-3 h-3" />
            {item.freshnessLabel}
          </span>

          {/* Relevance */}
          <span
            className="inline-flex items-center gap-1 font-mono font-medium"
            style={{
              fontSize: '10px',
              color: trustColor,
            }}
          >
            <Shield className="w-3 h-3" />
            {item.relevanceScore}% relevant
          </span>

          {/* Trust tier */}
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold"
            style={{
              fontSize: '10px',
              color: trustColor,
              backgroundColor: trustBg,
              border: `1px solid ${trustBorder}`,
            }}
          >
            {trustLabel}
          </span>
        </div>

        {/* ── Key Data Points ── */}
        {item.keyDataPoints && item.keyDataPoints.length > 0 && (
          <div className="space-y-1.5">
            <span
              className="font-semibold uppercase"
              style={{
                fontSize: '10px',
                letterSpacing: '1px',
                color: tokens.text.muted,
              }}
            >
              Key Data Points
            </span>
            <div className="flex flex-wrap gap-1.5">
              {item.keyDataPoints.map((point, pi) => (
                <span
                  key={pi}
                  className="px-2 py-0.5 rounded font-mono"
                  style={{
                    fontSize: '10px',
                    color: tokens.text.secondary,
                    backgroundColor: tokens.surface.card,
                    border: `1px solid ${tokens.border.subtle}`,
                  }}
                >
                  {point}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Source Verification Timestamp ── */}
        <VerificationTimestamp
          verification={effectiveVerification}
          showVerifier={true}
          showMethodIcon={true}
          format="relative"
          size="xs"
        />

        {/* ── External Source Link ── */}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium transition-colors duration-150"
            style={{
              fontSize: '11px',
              color: tokens.accent.bright,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = tokens.accent.DEFAULT;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = tokens.accent.bright;
            }}
          >
            <ExternalLink className="w-3 h-3" />
            View original source
          </a>
        )}

        {/* ── Close button ── */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-1 text-center bg-transparent border-none cursor-pointer transition-colors duration-150"
            style={{
              fontSize: '10px',
              fontWeight: 500,
              fontFamily: 'inherit',
              color: tokens.text.muted,
              padding: '4px 0',
              borderTop: `1px solid ${tokens.border.subtle}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = tokens.text.secondary;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = tokens.text.muted;
            }}
          >
            Close details
          </button>
        )}
      </div>
    </motion.div>
  );
}
