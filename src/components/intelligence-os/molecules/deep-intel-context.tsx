'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §6 — Deep Intel Context (Molecule)
   
   AI-generated context box for the L4 Exploration layer.
   Shows the AI narrative, source count, pattern count, and
   confidence score. Explicitly labeled as "Not a Directive"
   per MS6 design principles.
   
   MS6 Reference: Phase 3 intelligence_briefing_card.html AI context
   All tokens from design-tokens.ts. Purple accent from domain.opportunity.
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import { Sparkles, FileText, TrendingUp, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, motion as motionTokens } from '../design-tokens';
import type { AIContextBox } from '@/types/ms8-evidence';
import { getTrustColor, getTrustLabel } from '@/lib/intelligence-types';

// ─── Props ──────────────────────────────────────────────────
export interface DeepIntelContextProps {
  /** AI context data */
  aiContext: AIContextBox;

  /** Show metadata (source count, pattern count) */
  showMetadata?: boolean;

  /** Show confidence score */
  showConfidence?: boolean;

  /** Whether this component is visible (controls animation) */
  isVisible?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────
export function DeepIntelContext({
  aiContext,
  showMetadata = true,
  showConfidence = true,
  isVisible = true,
  className,
}: DeepIntelContextProps) {
  const confidenceTrustColor = getTrustColor(
    aiContext.confidenceScore >= 90 ? 'verified'
    : aiContext.confidenceScore >= 70 ? 'high'
    : aiContext.confidenceScore >= 45 ? 'medium'
    : 'low',
  );

  // Purple accent color from domain.opportunity — used for AI context
  const purpleAccent = tokens.domain.opportunity;
  const purpleGhost = tokens.extended.purple.bgFaint;
  const purpleBorder = tokens.domain.opportunity;
  const purpleText = tokens.extended.violet.value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{
        duration: motionTokens.default.duration,
        ease: motionTokens.default.ease as unknown as [number, number, number, number],
      }}
      className={cn('rounded-xl p-3.5', className)}
      style={{
        background: purpleGhost,
        border: `1px solid ${purpleBorder}`,
      }}
    >
      {/* ── Header: AI indicator ── */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="shrink-0 rounded-full"
          style={{
            width: '10px',
            height: '10px',
            backgroundColor: purpleAccent,
            opacity: 0.8,
          }}
        />
        <span
          className="font-semibold uppercase"
          style={{
            fontSize: '10px',
            letterSpacing: '1.5px',
            color: purpleText,
          }}
        >
          AI Context — Not a Directive
        </span>
      </div>

      {/* ── Narrative ── */}
      <p
        className="leading-relaxed"
        style={{
          fontSize: '12px',
          color: tokens.text.secondary,
          lineHeight: 1.6,
        }}
      >
        {aiContext.narrative}
      </p>

      {/* ── Metadata Row ── */}
      {(showMetadata || showConfidence) && (
        <div
          className="flex items-center gap-4 mt-3 pt-2.5"
          style={{ borderTop: `1px solid ${purpleBorder}` }}
        >
          {/* Source count */}
          {showMetadata && (
            <div className="flex items-center gap-1.5">
              <FileText className="w-3 h-3" style={{ color: tokens.text.muted }} />
              <span
                className="font-mono font-medium"
                style={{ fontSize: '10px', color: tokens.text.muted }}
              >
                {aiContext.sourceCount} source{aiContext.sourceCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Pattern count */}
          {showMetadata && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" style={{ color: tokens.text.muted }} />
              <span
                className="font-mono font-medium"
                style={{ fontSize: '10px', color: tokens.text.muted }}
              >
                {aiContext.patternCount} pattern{aiContext.patternCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Confidence */}
          {showConfidence && (
            <div className="flex items-center gap-1.5 ml-auto">
              <Shield className="w-3 h-3" style={{ color: confidenceTrustColor }} />
              <span
                className="font-mono font-semibold"
                style={{ fontSize: '10px', color: confidenceTrustColor }}
              >
                {aiContext.confidenceScore}%
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
