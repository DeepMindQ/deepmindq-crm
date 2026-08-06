'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §5 - L3 Evidence Layer
   
   Renders the L3 Evidence content for progressive disclosure.
   Answers: "What proves it?" - the evidence chain supporting
   the intelligence conclusion.
   
   MS6 Reference: Phase 3 intelligence_briefing_card.html L3 layer
   MS6 Pattern: PD-03 (Evidence Layer)
   
   Principles:
   - All tokens from design-tokens.ts, no hardcoded values
   - Glass-morphism: surface.card + border.default
   - Motion tokens for enter/exit animations
   - Elevation tokens for card shadows
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import { ChevronDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, motion as motionTokens } from '../design-tokens';
import { EvidenceChain } from '../evidence-chain';
import { EvidenceFootprint } from '../molecules/evidence-footprint';
import { VerificationBadge } from '../atoms/verification-badge';
import type { EvidenceLayerData } from '@/types/ms8-evidence';

// ─── Props ──────────────────────────────────────────────────
export interface EvidenceLayerProps {
  /** Complete data for the L3 Evidence Layer */
  data: EvidenceLayerData;

  /** Callback to deepen to L4 Exploration Layer */
  onDeepen?: () => void;

  /** Whether this layer is currently visible (controls animation) */
  isVisible?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// ─── Animation Variants ─────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      duration: motionTokens.smooth.duration,
      ease: motionTokens.smooth.ease as unknown as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      duration: motionTokens.default.duration,
      ease: motionTokens.default.ease as unknown as [number, number, number, number],
    },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: motionTokens.default.duration,
      ease: motionTokens.default.ease as unknown as [number, number, number, number],
      delay: i * 0.06,
    },
  }),
};

// ─── Component ──────────────────────────────────────────────
export function EvidenceLayer({
  data,
  onDeepen,
  isVisible = true,
  className,
}: EvidenceLayerProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate={isVisible ? 'visible' : 'hidden'}
      exit="exit"
      className={cn('overflow-hidden', className)}
      style={{
        borderTop: `1px solid ${tokens.border.default}`,
      }}
    >
      <div className="p-4 sm:p-5 space-y-4">
        {/* Section Label: "Evidence Chain" with accent bar */}
        <motion.div
          custom={0}
          variants={childVariants}
          className="flex items-center gap-1.5"
          style={{ marginBottom: '12px' }}
        >
          {/* Accent bar */}
          <span
            className="shrink-0 rounded-sm"
            style={{
              width: '3px',
              height: '12px',
              backgroundColor: tokens.accent.DEFAULT,
            }}
          />
          <span
            className="font-semibold uppercase"
            style={{
              fontSize: '10px',
              letterSpacing: '2px',
              color: tokens.text.muted,
            }}
          >
            Evidence Chain
          </span>
        </motion.div>

        {/* Evidence Footprint Summary */}
        <motion.div
          custom={1}
          variants={childVariants}
          className="flex items-center justify-between flex-wrap gap-2"
        >
          <EvidenceFootprint
            footprint={data.footprint}
            size="sm"
            showFreshness={true}
            showCount={true}
            showAIIndicator={true}
          />
          <VerificationBadge
            verification={data.verification}
            size="sm"
            showVerifier={true}
          />
        </motion.div>

        {/* Evidence Chain Items */}
        <motion.div custom={2} variants={childVariants}>
          <EvidenceChain
            items={data.evidence}
            title="Sources"
            footprint={data.footprint}
            maxVisible={4}
          />
        </motion.div>

        {/* Impact Statement */}
        {data.impactStatement && (
          <motion.div
            custom={3}
            variants={childVariants}
            className="rounded-lg p-3"
            style={{
              background: tokens.accent.ghost,
              border: `1px solid ${tokens.border.subtle}`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap
                className="w-3 h-3"
                style={{ color: tokens.accent.bright }}
              />
              <span
                className="font-semibold uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  color: tokens.text.muted,
                }}
              >
                Impact Assessment
              </span>
            </div>
            <p
              className="text-xs leading-relaxed"
              style={{ color: tokens.text.primary }}
            >
              {data.impactStatement}
            </p>
          </motion.div>
        )}

        {/* Deepen Button */}
        {onDeepen && (
          <motion.div
            custom={4}
            variants={childVariants}
            style={{
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: `1px solid ${tokens.border.subtle}`,
            }}
          >
            <button
              type="button"
              onClick={onDeepen}
              className="inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer transition-colors duration-150"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                fontFamily: 'inherit',
                color: tokens.text.muted,
                padding: '4px 0',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = tokens.accent.bright;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = tokens.text.muted;
              }}
            >
              <ChevronDown className="w-3 h-3" />
              View full analysis and exploration
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
