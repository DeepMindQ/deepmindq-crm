'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, TrendingUp, AlertTriangle, Zap, Shield,
  ChevronRight, ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ConfidenceIndicator } from './confidence-indicator';
import { ActionCTA } from './action-cta';
import { EvidenceChain } from './evidence-chain';
import { IntelligencePanel } from './intelligence-panel';
import { InlineReasoning } from './inline-reasoning';
import { tokens, getConfidenceTier, motion as motionTokens } from './design-tokens';
import type { IntelligenceNarrativeData } from '@/lib/intelligence-narrative-service';

/* ═══════════════════════════════════════════════════════════════
   HeroNarrative — The Primary Intelligence Surface
   
   Phase 1B Redesign: Extracted from command-center.tsx monolith.
   
   The FIRST thing a VP Sales user sees. Replaces KPI grid.
   Intelligence speaks first.
   
   Intelligence Flow:
     Signal Detection → GroundingEngine → Confidence Computation
     → Evidence Chain → Reasoning Synthesis → Narrative → User Action
   
   Progressive Disclosure Architecture:
     L1: Decision — headline + confidence + priority badge
     L2: Reasoning — inline reasoning with confidence factors
     L3: Evidence — IntelligencePanel with EvidenceChain (slide-over)
     L4: Exploration — related signals + cross-account patterns
   
   UX DNA Compliance:
     ✅ Intelligence First — AI narrative is the FIRST visible element
     ✅ Reasoning Transparency — "Why?" factors shown inline
     ✅ Evidence Visibility — Full evidence chain one click away
     ✅ Confidence Layer — Ring + factor breakdown
     ✅ Action Orientation — ActionCTA terminates every narrative
     ✅ Context Preservation — Panel preserves narrative context
   ═══════════════════════════════════════════════════════════════ */

export interface HeroNarrativeProps {
  /** Real narrative data from IntelligenceNarrativeService pipeline */
  narrative: IntelligenceNarrativeData | null;
  /** Callback when user drills into narrative detail */
  onDrillDown?: (narrative: IntelligenceNarrativeData) => void;
  /** Callback when user takes the primary action */
  onAction?: (narrative: IntelligenceNarrativeData) => void;
  /** Loading state from the intelligence pipeline */
  isLoading?: boolean;
}

// ── Priority visual config aligned with design tokens ──
const PRIORITY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: tokens.domain.risk, bg: tokens.priority.critical.bg, border: tokens.confidence.low.bg },
  high:     { color: tokens.domain.reasoning, bg: tokens.confidence.medium.bg, border: tokens.confidence.medium.bg },
  medium:   { color: tokens.accent.DEFAULT, bg: tokens.accent.ghost, border: tokens.accent.subtle },
  low:      { color: tokens.text.secondary, bg: tokens.opacity.trace, border: tokens.opacity.whisper },
};

export function HeroNarrative({
  narrative,
  onDrillDown,
  onAction,
  isLoading,
}: HeroNarrativeProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...motionTokens.default }}
        className="rounded-xl border p-6"
        style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl animate-pulse" style={{ background: tokens.accent.ghost }} />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-3/4 rounded-lg animate-pulse" style={{ background: tokens.border.subtle }} />
            <div className="h-3 w-1/2 rounded-lg animate-pulse" style={{ background: tokens.border.subtle }} />
            <div className="h-3 w-2/3 rounded-lg animate-pulse" style={{ background: tokens.border.subtle }} />
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Empty state — no intelligence requiring attention ──
  if (!narrative) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...motionTokens.default }}
        className="rounded-xl border p-6 text-center"
        style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}
      >
        <Brain className="w-6 h-6 mx-auto mb-2" style={{ color: tokens.text.muted }} />
        <p className="text-sm" style={{ color: tokens.text.secondary }}>
          No critical intelligence requires attention right now.
        </p>
        <p className="text-xs mt-1" style={{ color: tokens.text.muted }}>
          The intelligence pipeline is monitoring your accounts.
        </p>
      </motion.div>
    );
  }

  // ── Derive values from real narrative data ──
  const confidenceScore = narrative.confidence?.score ?? 0;
  const confidenceTier = getConfidenceTier(confidenceScore);
  const tierConfig = tokens.confidence[confidenceTier];
  const priority = narrative.priority || 'medium';
  const pStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;

  // Confidence factors for inline reasoning display
  const factors = narrative.confidence?.factors;
  const positiveFactors = (factors?.positiveFactors ?? []).slice(0, 3).map(f => typeof f === 'string' ? f : f.factor ?? '');
  const negativeFactors = (factors?.negativeFactors ?? []).slice(0, 2).map(f => typeof f === 'string' ? f : f.factor ?? '');

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...motionTokens.smooth }}
        className="rounded-xl border overflow-hidden"
        style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}
      >
        {/* ═══ L1: Decision Layer — "What changed? Why now?" ═══ */}
        <div
          className="p-5 pb-4 cursor-pointer"
          onClick={() => setPanelOpen(true)}
          style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
        >
          <div className="flex items-start gap-4">
            {/* Confidence Ring — AI speaks first with measured confidence */}
            <div className="shrink-0">
              <ConfidenceIndicator
                value={confidenceScore}
                mode="ring"
                size="lg"
                label="AI Confidence"
                showPercentage={true}
                animated={true}
              />
            </div>

            {/* Headline + Priority Badge */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge
                  className="text-[10px] px-2 py-0.5 font-semibold"
                  style={{ color: pStyle.color, background: pStyle.bg, border: `1px solid ${pStyle.border}` }}
                >
                  {priority.toUpperCase()}
                </Badge>
                {narrative.timestamp && (
                  <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                    {narrative.timestamp}
                  </span>
                )}
                {/* Engine contribution indicators */}
                {narrative.engineContributions?.grounding && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: tokens.domain.signal + '12', color: tokens.domain.signal }}>
                    Grounded
                  </span>
                )}
              </div>
              <h2
                className="text-lg font-semibold leading-snug"
                style={{ color: tokens.text.primary }}
              >
                {narrative.headline}
              </h2>
              {narrative.subtitle && (
                <p className="text-sm mt-1 leading-relaxed" style={{ color: tokens.text.secondary }}>
                  {narrative.subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ═══ L2: Inline Reasoning — "Why does the system think this?" ═══ */}
        <InlineReasoning
          reasoning={narrative.reasoning}
          positiveFactors={positiveFactors}
          negativeFactors={negativeFactors}
          onClickExpand={() => setPanelOpen(true)}
        />

        {/* ═══ Action CTA — "What should I do?" ═══ */}
        <div className="px-5 py-3">
          <ActionCTA
            label={narrative.primaryAction?.label || 'View Full Intelligence'}
            variant="primary"
            priority={priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : 'medium'}
            onClick={() => {
              if (narrative.primaryAction?.companyId) {
                onAction?.(narrative);
              } else {
                setPanelOpen(true);
              }
            }}
            icon={true}
          />
        </div>
      </motion.div>

      {/* ═══ L3/L4: Intelligence Panel — Evidence + Exploration ═══ */}
      <IntelligencePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={narrative.headline}
        subtitle={narrative.subtitle}
        entityName={narrative.entityName}
        entityType={narrative.entityType}
        intelligenceScore={confidenceScore}
        loading={false}
        sections={[
          // L3: Evidence Chain — full traceability
          {
            id: 'evidence',
            title: 'Evidence Chain',
            content: (
              <EvidenceChain
                items={narrative.evidence.map(e => ({
                  source: e.source,
                  sourceType: e.sourceType,
                  snippet: e.snippet,
                  url: e.url,
                  date: e.date,
                  relevanceScore: e.relevanceScore,
                }))}
                title="Supporting Evidence"
                conclusion={narrative.impactStatement}
                verdict={confidenceScore >= 70 ? 'strong' : confidenceScore >= 45 ? 'moderate' : 'weak'}
              />
            ),
            icon: Shield,
          },
          // L4: Related Signals — cross-account exploration
          ...(narrative.relatedSignals && narrative.relatedSignals.length > 0 ? [{
            id: 'related',
            title: 'Related Signals',
            content: (
              <div className="space-y-2">
                {narrative.relatedSignals.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm" style={{ color: tokens.text.secondary }}>
                    <Zap className="w-3 h-3" style={{ color: tokens.domain.signal }} />
                    <span>{s.title}</span>
                    {s.date && <span className="text-xs ml-auto">{s.date}</span>}
                  </div>
                ))}
              </div>
            ),
            icon: Zap,
          }] : []),
        ]}
      />
    </>
  );
}
