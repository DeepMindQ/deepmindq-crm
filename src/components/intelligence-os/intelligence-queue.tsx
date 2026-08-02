'use client';

import { motion } from 'framer-motion';
import { Brain, ChevronRight, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { IntelligenceCard } from './intelligence-card';
import { IntelligencePanel } from './intelligence-panel';
import { EvidenceChain } from './evidence-chain';
import { tokens, getConfidenceTier, motion as motionTokens } from './design-tokens';
import { useState } from 'react';
import type { IntelligenceNarrativeData } from '@/lib/intelligence-narrative-service';

/* ═══════════════════════════════════════════════════════════════
   IntelligenceQueue — Priority Intelligence Feed
   
   Phase 1B Redesign: Extracted from command-center.tsx monolith.
   
   Displays the next 3-5 priority intelligence items after the
   HeroNarrative. Each card is a condensed signal with:
   - Confidence score (from multi-factor computation)
   - Reasoning snippet (from synthesis engine)
   - One-click drill to full evidence (IntelligencePanel)
   
   Intelligence Flow:
     useIntelligenceNarratives → /api/intelligence/narratives
       → IntelligenceNarrativeService → GroundingEngine
         → computeNarrativeConfidence → EvidenceChain
           → IntelligenceNarrativeData → IntelligenceCard
   
   UX DNA Compliance:
     ✅ Intelligence First — Queue shows intelligence, not data lists
     ✅ Reasoning Transparency — Each card shows reasoning snippet
     ✅ Evidence Visibility — Click opens IntelligencePanel with EvidenceChain
     ✅ Confidence Layer — Each card has confidence bar
     ✅ Action Orientation — Each card has action CTA
     ✅ Context Preservation — Drill-down preserves queue context
   ═══════════════════════════════════════════════════════════════ */

export interface IntelligenceQueueProps {
  /** Narrative data for queue items (narratives[1..6]) */
  narratives: IntelligenceNarrativeData[];
  /** Callback when user navigates to a company */
  onNavigateToCompany?: (companyId: string) => void;
  /** Callback when user drills into a narrative */
  onDrillDown?: (narrative: IntelligenceNarrativeData) => void;
}

export function IntelligenceQueue({
  narratives,
  onNavigateToCompany,
  onDrillDown,
}: IntelligenceQueueProps) {
  const [selectedNarrative, setSelectedNarrative] = useState<IntelligenceNarrativeData | null>(null);

  if (narratives.length === 0) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...motionTokens.default }}
      >
        {/* Queue header */}
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4" style={{ color: tokens.accent.bright }} />
          <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
            Other Priorities
          </h2>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0"
            style={{ background: tokens.accent.ghost, color: tokens.accent.bright, border: 0 }}
          >
            {narratives.length}
          </Badge>
        </div>

        {/* Intelligence card grid — each card is a condensed signal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {narratives.map((narrative, i) => {
            const tier = getConfidenceTier(narrative.confidence?.score ?? 0);
            const tierColor = tokens.confidence[tier].value;

            return (
              <IntelligenceCard
                key={narrative.id || i}
                title={narrative.headline}
                description={narrative.reasoning}
                variant={narrative.variant || 'signal'}
                confidence={narrative.confidence?.score ?? 0}
                timestamp={narrative.timestamp}
                entityName={narrative.entityName}
                priority={
                  narrative.priority === 'critical' ? 'critical' :
                  narrative.priority === 'high' ? 'high' : undefined
                }
                actionLabel={narrative.primaryAction?.label}
                onAction={() => {
                  if (narrative.entityType === 'company' && narrative.entityId) {
                    onNavigateToCompany?.(narrative.entityId);
                  } else {
                    onDrillDown?.(narrative);
                    setSelectedNarrative(narrative);
                  }
                }}
                onClick={() => setSelectedNarrative(narrative)}
              />
            );
          })}
        </div>

        {/* Confidence distribution summary */}
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: tokens.text.muted }}>
            Confidence Distribution
          </span>
          <div className="flex items-center gap-2">
            {(['high', 'medium', 'low'] as const).map(tier => {
              const count = narratives.filter(
                n => getConfidenceTier(n.confidence?.score ?? 0) === tier
              ).length;
              if (count === 0) return null;
              return (
                <span
                  key={tier}
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    color: tokens.confidence[tier].value,
                    background: tokens.confidence[tier].bg,
                  }}
                >
                  {count} {tier}
                </span>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Drill-down panel for selected queue item */}
      <IntelligencePanel
        open={selectedNarrative !== null}
        onClose={() => setSelectedNarrative(null)}
        title={selectedNarrative?.headline}
        subtitle={selectedNarrative?.subtitle}
        entityName={selectedNarrative?.entityName}
        entityType={selectedNarrative?.entityType}
        intelligenceScore={selectedNarrative?.confidence?.score ?? 0}
        loading={false}
        sections={[
          {
            id: 'reasoning',
            title: 'Why This Matters',
            content: selectedNarrative ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: tokens.text.secondary }}>
                  {selectedNarrative.reasoning}
                </p>
                {selectedNarrative.reasoningPoints.length > 0 && (
                  <ul className="space-y-1">
                    {selectedNarrative.reasoningPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs" style={{ color: tokens.text.secondary }}>
                        <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" style={{ color: tokens.text.muted }} />
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null,
            icon: Brain,
          },
          {
            id: 'evidence',
            title: 'Evidence Chain',
            content: selectedNarrative ? (
              <EvidenceChain
                items={selectedNarrative.evidence.map(e => ({
                  source: e.source,
                  sourceType: e.sourceType,
                  snippet: e.snippet,
                  url: e.url,
                  date: e.date,
                  relevanceScore: e.relevanceScore,
                }))}
                title="Supporting Evidence"
                conclusion={selectedNarrative.impactStatement}
                verdict={
                  (selectedNarrative.confidence?.score ?? 0) >= 70 ? 'strong' :
                  (selectedNarrative.confidence?.score ?? 0) >= 45 ? 'moderate' : 'weak'
                }
              />
            ) : null,
            icon: Shield,
          },
        ]}
      />
    </>
  );
}
