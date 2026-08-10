'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §5 — L4 Exploration Layer
   
   Renders the L4 Exploration content for progressive disclosure.
   Answers: "What else should I consider?" — full analysis
   with exploration grid, AI context, investigation paths,
   and related signals.
   
   MS6 Reference: Phase 3 intelligence_briefing_card.html L4 layer
   MS6 Pattern: PD-04 (Exploration Layer)
   
   Principles:
   - All tokens from design-tokens.ts, no hardcoded values
   - Glass-morphism: surface.card + border.default
   - Motion tokens for enter/exit animations
   - Elevation tokens for card shadows
   - Responsive: grid collapses to 1-column on mobile
   ═══════════════════════════════════════════════════════════════ */

import { motion } from 'framer-motion';
import {
  ChevronUp, Download, Share2, ArrowRight,
  Compass, Radio, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, motion as motionTokens, elevation } from '../design-tokens';
import type {
  ExplorationLayerData,
  ExplorationCard,
  InvestigationPath,
} from '@/types/ms8-evidence';

// ─── Props ──────────────────────────────────────────────────
export interface ExplorationLayerProps {
  /** Complete data for the L4 Exploration Layer */
  data: ExplorationLayerData;

  /** Callback to collapse back to summary (L1) */
  onCollapse?: () => void;

  /** Callback when an investigation path is clicked */
  onInvestigationClick?: (path: InvestigationPath) => void;

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

// ─── Priority color helper ─────────────────────────────────
function getInvestigationPriorityColor(priority: InvestigationPath['priority']): string {
  switch (priority) {
    case 'high': return tokens.priority.high.value;
    case 'medium': return tokens.priority.medium.value;
    case 'low': return tokens.priority.low.value;
  }
}

function getInvestigationPriorityBg(priority: InvestigationPath['priority']): string {
  switch (priority) {
    case 'high': return tokens.priority.high.bg;
    case 'medium': return tokens.priority.medium.bg;
    case 'low': return tokens.priority.low.bg;
  }
}

function getInvestigationPriorityBorder(priority: InvestigationPath['priority']): string {
  switch (priority) {
    case 'high': return tokens.priority.high.border;
    case 'medium': return tokens.priority.medium.border;
    case 'low': return tokens.priority.low.border;
  }
}

// ─── Exploration Card (individual grid card) ────────────────
function ExplorationGridCard({ card, index }: { card: ExplorationCard; index: number }) {
  return (
    <motion.div
      custom={index}
      variants={childVariants}
      className="rounded-xl p-3.5 transition-colors duration-150"
      style={{
        background: tokens.surface.elevated,
        border: `1px solid ${tokens.border.default}`,
        boxShadow: elevation.rest.shadow,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = tokens.border.hover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = tokens.border.default;
      }}
    >
      <div
        className="font-semibold uppercase mb-1.5"
        style={{
          fontSize: '10px',
          letterSpacing: '1.5px',
          color: tokens.text.muted,
        }}
      >
        {card.label}
      </div>
      <div
        className="font-semibold leading-snug mb-1"
        style={{
          fontSize: '13px',
          color: tokens.text.primary,
          lineHeight: 1.5,
        }}
      >
        {card.value}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: '10px',
          color: tokens.text.secondary,
          marginTop: '4px',
        }}
      >
        {card.context}
      </div>
    </motion.div>
  );
}

// ─── Component ──────────────────────────────────────────────
export function ExplorationLayer({
  data,
  onCollapse,
  onInvestigationClick,
  isVisible = true,
  className,
}: ExplorationLayerProps) {
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
        {/* ── Section Label: "Exploration" with accent bar ── */}
        <motion.div
          custom={0}
          variants={childVariants}
          className="flex items-center gap-1.5"
          style={{ marginBottom: '12px' }}
        >
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
            Exploration
          </span>
        </motion.div>

        {/* ── 2x2 Exploration Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.explorationCards.map((card, i) => (
            <ExplorationGridCard key={card.label} card={card} index={i + 1} />
          ))}
        </div>

        {/* ── AI Context Box (purple accent, matching MS6) ── */}
        <motion.div
          custom={5}
          variants={childVariants}
          className="rounded-xl p-3.5"
          style={{
            background: tokens.extended.purple.bgSubtle,
            border: `1px solid ${tokens.extended.purple.border}`,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className="shrink-0 rounded-full"
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: tokens.extended.purple.value,
              }}
            />
            <span
              className="font-semibold uppercase"
              style={{
                fontSize: '10px',
                letterSpacing: '1.5px',
                color: tokens.extended.violet.value,
              }}
            >
              AI Context — Not a Directive
            </span>
          </div>
          <p
            className="leading-relaxed"
            style={{
              fontSize: '12px',
              color: tokens.text.secondary,
              lineHeight: 1.6,
            }}
          >
            {data.aiContext.narrative}
          </p>
        </motion.div>

        {/* ── Investigation Paths ── */}
        {data.investigationPaths.length > 0 && (
          <motion.div custom={6} variants={childVariants}>
            <div
              className="flex items-center gap-1.5 mb-3"
            >
              <Compass className="w-3.5 h-3.5" style={{ color: tokens.accent.bright }} />
              <span
                className="font-semibold uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  color: tokens.text.muted,
                }}
              >
                Suggested Investigations
              </span>
            </div>
            <div className="space-y-2">
              {data.investigationPaths.map((path, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onInvestigationClick?.(path)}
                  className="w-full text-left rounded-lg p-3 transition-colors duration-150 cursor-pointer"
                  style={{
                    background: tokens.surface.card,
                    border: `1px solid ${tokens.border.default}`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = tokens.border.hover;
                    (e.currentTarget as HTMLElement).style.background = tokens.surface.cardHover;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = tokens.border.default;
                    (e.currentTarget as HTMLElement).style.background = tokens.surface.card;
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowRight
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: tokens.accent.bright }}
                      />
                      <span
                        className="font-medium truncate"
                        style={{
                          fontSize: '12px',
                          color: tokens.text.primary,
                        }}
                      >
                        {path.title}
                      </span>
                    </div>
                    <span
                      className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        fontSize: '9px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: getInvestigationPriorityColor(path.priority),
                        backgroundColor: getInvestigationPriorityBg(path.priority),
                        border: `1px solid ${getInvestigationPriorityBorder(path.priority)}`,
                      }}
                    >
                      {path.priority}
                    </span>
                  </div>
                  <p
                    className="mt-1 ml-5.5"
                    style={{
                      fontSize: '11px',
                      color: tokens.text.secondary,
                      lineHeight: 1.5,
                      paddingLeft: '22px',
                    }}
                  >
                    {path.rationale}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Related Signals ── */}
        {data.relatedSignals.length > 0 && (
          <motion.div custom={7} variants={childVariants}>
            <div className="flex items-center gap-1.5 mb-3">
              <Radio className="w-3.5 h-3.5" style={{ color: tokens.domain.signal }} />
              <span
                className="font-semibold uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  color: tokens.text.muted,
                }}
              >
                Related Signals
              </span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {data.relatedSignals.map((signal, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors duration-100"
                  style={{
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = tokens.opacity.white.hint;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TrendingUp
                      className="w-3 h-3 shrink-0"
                      style={{ color: tokens.text.muted }}
                    />
                    <div className="min-w-0">
                      <span
                        className="block truncate font-medium"
                        style={{
                          fontSize: '11px',
                          color: tokens.text.primary,
                        }}
                      >
                        {signal.title}
                      </span>
                      <span
                        className="block font-mono"
                        style={{
                          fontSize: '9px',
                          color: tokens.text.muted,
                        }}
                      >
                        {signal.type}{signal.date ? ` · ${signal.date}` : ''}
                      </span>
                    </div>
                  </div>
                  <span
                    className="shrink-0 font-mono font-medium"
                    style={{
                      fontSize: '10px',
                      color:
                        signal.relevance >= 70
                          ? tokens.confidence.high.value
                          : signal.relevance >= 45
                            ? tokens.confidence.medium.value
                            : tokens.confidence.low.value,
                    }}
                  >
                    {signal.relevance}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Footer: Collapse + Export Actions ── */}
        <motion.div
          custom={8}
          variants={childVariants}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{
            paddingTop: '14px',
            borderTop: `1px solid ${tokens.border.default}`,
          }}
        >
          {/* Collapse button */}
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex items-center gap-1 bg-transparent border-none cursor-pointer transition-colors duration-200"
            style={{
              fontSize: '11px',
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
            <ChevronUp className="w-3 h-3" />
            Collapse to summary
          </button>

          {/* Export actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-transparent cursor-pointer transition-all duration-150"
              style={{
                fontSize: '11px',
                fontWeight: 500,
                fontFamily: 'inherit',
                color: tokens.text.muted,
                padding: '6px 12px',
                border: `1px solid ${tokens.border.default}`,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = tokens.border.hover;
                el.style.color = tokens.text.primary;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = tokens.border.default;
                el.style.color = tokens.text.muted;
              }}
            >
              <Download className="w-3 h-3" />
              Export PDF
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-transparent cursor-pointer transition-all duration-150"
              style={{
                fontSize: '11px',
                fontWeight: 500,
                fontFamily: 'inherit',
                color: tokens.text.muted,
                padding: '6px 12px',
                border: `1px solid ${tokens.border.default}`,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = tokens.border.hover;
                el.style.color = tokens.text.primary;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = tokens.border.default;
                el.style.color = tokens.text.muted;
              }}
            >
              <Share2 className="w-3 h-3" />
              Share Briefing
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
