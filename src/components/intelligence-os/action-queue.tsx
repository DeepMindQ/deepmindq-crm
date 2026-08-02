'use client';

import { motion } from 'framer-motion';
import { Target, ChevronRight, Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ConfidenceIndicator } from './confidence-indicator';
import { ActionCTA } from './action-cta';
import { InlineReasoning } from './inline-reasoning';
import { tokens, getConfidenceTier, motion as motionTokens } from './design-tokens';

/* ═══════════════════════════════════════════════════════════════
   ActionQueue — Recommendation-to-Action Pipeline
   
   Phase 1B Redesign: Extracted from command-center.tsx monolith.
   
   Displays the top 5 recommended actions extracted from intelligence
   narratives. Each action shows:
   - What to do (from ActionEngine recommendation)
   - Why (from narrative reasoning)
   - Confidence (from multi-factor computation)
   - Which account (entity navigation)
   
   Intelligence Flow:
     IntelligenceNarrativeService → primaryAction/secondaryActions
       → NarrativeAction { label, actionType, priority, confidence, reasoning }
         → ActionQueue display → User clicks → Navigate to entity
   
   UX DNA Compliance:
     ✅ Intelligence First — Actions derived from intelligence, not manual entry
     ✅ Reasoning Transparency — Each action shows "Why this action?"
     ✅ Evidence Visibility — Confidence is traceable to evidence chain
     ✅ Confidence Layer — Each action has confidence bar
     ✅ Action Orientation — This IS the action layer — pure action orientation
     ✅ Context Preservation — Click navigates with full context
   ═══════════════════════════════════════════════════════════════ */

export interface ExtractedAction {
  /** Unique action ID */
  id: string;
  /** Action type from intelligence classification */
  type: 'opportunity' | 'risk' | 'action' | 'signal';
  /** What the user should do */
  title: string;
  /** Why this action is recommended */
  description: string;
  /** Account this action relates to */
  company: string;
  /** Company ID for navigation */
  companyId: string;
  /** Priority from intelligence engine */
  priority: 'high' | 'medium' | 'low';
  /** Confidence in this recommendation (0-100) */
  confidence: number;
  /** Reasoning from the narrative that generated this action */
  reason: string;
  /** When this intelligence was detected */
  createdAt: string;
  /** Source narrative ID for traceability */
  sourceNarrativeId?: string;
  /** Action type from ActionEngine */
  actionType?: string;
}

export interface ActionQueueProps {
  /** Actions extracted from intelligence narratives */
  actions: ExtractedAction[];
  /** Callback when user navigates to a company */
  onNavigateToCompany?: (companyId: string) => void;
  /** Callback when user takes an action */
  onActionExecute?: (action: ExtractedAction) => void;
}

// ── Priority visual config ──
const ACTION_PRIORITY_STYLES: Record<string, { color: string; bg: string }> = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  low:    { color: '#8892a8', bg: 'rgba(136,146,168,0.1)' },
};

export function ActionQueue({
  actions,
  onNavigateToCompany,
  onActionExecute,
}: ActionQueueProps) {
  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...motionTokens.default }}
    >
      {/* Queue header */}
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-4 h-4" style={{ color: tokens.domain.action }} />
        <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
          Recommended Actions
        </h2>
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0"
          style={{ background: 'rgba(16,185,129,0.1)', color: tokens.domain.action, border: 0 }}
        >
          {actions.length}
        </Badge>
        {/* Intelligence provenance label */}
        <span className="text-[9px] ml-auto" style={{ color: tokens.text.muted }}>
          Intelligence-derived
        </span>
      </div>

      {/* Action list — ranked by confidence × priority */}
      <div className="space-y-2">
        {actions.map((action, i) => {
          const pStyle = ACTION_PRIORITY_STYLES[action.priority] || ACTION_PRIORITY_STYLES.medium;
          const confidenceTier = getConfidenceTier(action.confidence);

          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, ...motionTokens.fast }}
              className="rounded-lg border overflow-hidden group transition-all duration-200"
              style={{
                background: tokens.surface.card,
                borderColor: tokens.border.subtle,
              }}
            >
              {/* Main action row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => onNavigateToCompany?.(action.companyId)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = tokens.surface.cardHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = tokens.surface.card;
                }}
              >
                {/* Rank number */}
                <span
                  className="text-[10px] font-bold tabular-nums w-5 text-center shrink-0"
                  style={{ color: tokens.text.muted }}
                >
                  {i + 1}
                </span>

                {/* Action content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold truncate"
                      style={{ color: tokens.text.primary }}
                    >
                      {action.title}
                    </span>
                    <Badge
                      className="text-[9px] px-1 py-0 shrink-0"
                      style={{
                        color: pStyle.color,
                        background: pStyle.bg,
                        border: 0,
                      }}
                    >
                      {action.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] truncate" style={{ color: tokens.text.secondary }}>
                      {action.company}
                    </span>
                    <ChevronRight className="w-2.5 h-2.5 shrink-0" style={{ color: tokens.text.muted }} />
                    <span className="text-[10px] font-medium truncate" style={{ color: tokens.text.muted }}>
                      Confidence {action.confidence}%
                    </span>
                  </div>
                </div>

                {/* Confidence indicator */}
                <ConfidenceIndicator
                  value={action.confidence}
                  mode="bar"
                  size="xs"
                  showPercentage={false}
                />

                {/* Execute action */}
                <ActionCTA
                  label="Execute"
                  variant="inline"
                  priority={action.priority === 'high' ? 'high' : 'medium'}
                  onClick={() => {
                    onActionExecute?.(action);
                  }}
                  icon={true}
                />
              </div>

              {/* Inline reasoning — collapsed by default, expands on hover */}
              {action.reason && (
                <div
                  className="px-4 py-2 transition-all duration-200"
                  style={{
                    background: tokens.surface.secondary,
                    borderTop: `1px solid ${tokens.border.subtle}`,
                    maxHeight: '0',
                    overflow: 'hidden',
                    opacity: '0',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.maxHeight = '80px';
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.paddingTop = '8px';
                    e.currentTarget.style.paddingBottom = '8px';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.maxHeight = '0';
                    e.currentTarget.style.opacity = '0';
                    e.currentTarget.style.paddingTop = '2px';
                    e.currentTarget.style.paddingBottom = '2px';
                  }}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: tokens.domain.reasoning }} />
                    <p className="text-[10px] leading-relaxed" style={{ color: tokens.text.muted }}>
                      {action.reason}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
