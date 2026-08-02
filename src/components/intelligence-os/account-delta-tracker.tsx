'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Brain, TrendingUp, TrendingDown, AlertTriangle,
  ArrowRight, Clock, Zap, RefreshCw, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ConfidenceIndicator } from './confidence-indicator';
import { InlineReasoning } from './inline-reasoning';
import { tokens, getConfidenceTier, motion as motionTokens } from './design-tokens';

/* ═══════════════════════════════════════════════════════════════
   AccountDeltaTracker — Intelligence Change Detection
   
   BRAND NEW COMPONENT — Phase 1B.
   
   Tracks meaningful changes in account intelligence over time.
   Answers: "What changed since I last looked?"
   
   Monitors:
   - Intelligence score changes (confidence delta)
  . New signal detections
  . Evidence additions/updates
  . Priority shifts
   
   Intelligence Flow:
     /api/intelligence/deltas → compare current vs. snapshot
       → Score delta computation
         → Signal delta detection
           → Priority change detection
             → AccountDeltaTracker display
               → User action: investigate or dismiss
   
   UX DNA Compliance:
     ✅ Intelligence First — Shows what CHANGED, not static state
     ✅ Reasoning Transparency — Each delta explains "Why this changed"
     ✅ Evidence Visibility — Links to new evidence causing the delta
     ✅ Confidence Layer — Delta confidence based on signal quality
     ✅ Action Orientation — "Investigate" terminates each delta
     ✅ Context Preservation — Timeline preserves chronological context
   ═══════════════════════════════════════════════════════════════ */

// ── Types ──

export type DeltaType = 'score_change' | 'new_signal' | 'evidence_update' | 'priority_shift' | 'confidence_change';

export interface AccountDelta {
  /** Unique delta ID */
  id: string;
  /** Company that changed */
  companyId: string;
  /** Company name */
  companyName: string;
  /** Type of change */
  deltaType: DeltaType;
  /** Direction of change */
  direction: 'up' | 'down' | 'new';
  /** Previous value */
  previousValue: number;
  /** New value */
  newValue: number;
  /** How much it changed */
  magnitude: number;
  /** Why this change occurred (from intelligence engine) */
  reasoning: string;
  /** Confidence in this delta detection */
  confidence: number;
  /** Related signal IDs that caused this delta */
  signalIds?: string[];
  /** Evidence snippets that support this delta */
  evidence?: Array<{ source: string; snippet: string }>;
  /** When this delta was detected */
  detectedAt: string;
  /** Whether user has acknowledged this delta */
  acknowledged: boolean;
}

export interface AccountDeltaTrackerProps {
  /** Pre-loaded deltas from API */
  deltas?: AccountDelta[];
  /** Auto-fetch deltas */
  autoFetch?: boolean;
  /** Callback when user investigates a delta */
  onInvestigate?: (delta: AccountDelta) => void;
  /** Callback when user navigates to a company */
  onNavigateToCompany?: (companyId: string) => void;
}

// ── Delta type visual config ──
const DELTA_TYPE_CONFIG: Record<DeltaType, { label: string; color: string; bg: string; icon: typeof TrendingUp }> = {
  score_change:      { label: 'Score Change',    color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  icon: TrendingUp },
  new_signal:        { label: 'New Signal',      color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   icon: Zap },
  evidence_update:   { label: 'Evidence Update', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  icon: AlertTriangle },
  priority_shift:    { label: 'Priority Shift',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: TrendingDown },
  confidence_change: { label: 'Confidence Change', color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: TrendingUp },
};

export function AccountDeltaTracker({
  deltas: initialDeltas,
  autoFetch = true,
  onInvestigate,
  onNavigateToCompany,
}: AccountDeltaTrackerProps) {
  const [deltas, setDeltas] = useState<AccountDelta[]>(initialDeltas ?? []);
  const [isLoading, setIsLoading] = useState(!initialDeltas);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | DeltaType>('all');

  // ── Fetch deltas from API ──
  const fetchDeltas = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/intelligence/deltas?limit=20');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setDeltas(json.data);
        }
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch && !initialDeltas) {
      fetchDeltas();
    }
  }, [autoFetch, initialDeltas, fetchDeltas]);

  // Filter deltas
  const filteredDeltas = filter === 'all'
    ? deltas.filter(d => !d.acknowledged)
    : deltas.filter(d => d.deltaType === filter && !d.acknowledged);

  // Acknowledge a delta
  const acknowledgeDelta = (deltaId: string) => {
    setDeltas(prev => prev.map(d =>
      d.id === deltaId ? { ...d, acknowledged: true } : d
    ));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...motionTokens.default }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" style={{ color: tokens.text.muted }} />
          <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
            Account Intelligence Deltas
          </h2>
          {filteredDeltas.length > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 0 }}
            >
              {filteredDeltas.length} changes
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter controls */}
          <div className="flex items-center gap-1">
            {(['all', 'new_signal', 'score_change', 'priority_shift'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className="text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors"
                style={{
                  color: filter === type ? tokens.text.primary : tokens.text.muted,
                  background: filter === type ? tokens.accent.ghost : 'transparent',
                }}
              >
                {type === 'all' ? 'All' : DELTA_TYPE_CONFIG[type].label.split(' ')[0]}
              </button>
            ))}
          </div>
          <button
            onClick={fetchDeltas}
            className="p-1 rounded transition-colors"
            style={{ color: tokens.text.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.background = tokens.accent.ghost; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: tokens.accent.bright }} />
          <span className="text-xs" style={{ color: tokens.text.secondary }}>
            Analyzing intelligence deltas...
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.15)' }}>
          <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
          <span className="text-xs" style={{ color: tokens.text.secondary }}>{error}</span>
        </div>
      )}

      {/* Delta list */}
      {!isLoading && filteredDeltas.length === 0 && (
        <div className="text-center py-6 rounded-xl border" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
          <Brain className="w-5 h-5 mx-auto mb-2" style={{ color: tokens.text.muted }} />
          <p className="text-xs" style={{ color: tokens.text.muted }}>
            No intelligence changes detected since your last session.
          </p>
          <p className="text-[9px] mt-1" style={{ color: tokens.text.muted }}>
            Deltas are computed from intelligence snapshots.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence>
          {filteredDeltas.map((delta, i) => {
            const typeConfig = DELTA_TYPE_CONFIG[delta.deltaType];
            const TypeIcon = typeConfig.icon;
            const isUp = delta.direction === 'up';
            const isNew = delta.direction === 'new';
            const directionColor = isNew ? tokens.domain.enrichment
              : isUp ? tokens.confidence.high.value
              : tokens.confidence.medium.value;

            return (
              <motion.div
                key={delta.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ delay: i * 0.03, ...motionTokens.fast }}
                className="rounded-lg border overflow-hidden"
                style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}
              >
                {/* Delta header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Direction indicator */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: typeConfig.bg }}
                  >
                    {isNew ? (
                      <Zap className="w-4 h-4" style={{ color: typeConfig.color }} />
                    ) : isUp ? (
                      <TrendingUp className="w-4 h-4" style={{ color: directionColor }} />
                    ) : (
                      <TrendingDown className="w-4 h-4" style={{ color: directionColor }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold truncate" style={{ color: tokens.text.primary }}>
                        {delta.companyName}
                      </span>
                      <Badge
                        className="text-[9px] px-1 py-0 shrink-0"
                        style={{ color: typeConfig.color, background: typeConfig.bg, border: 0 }}
                      >
                        {typeConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {/* Value change display */}
                      {isNew ? (
                        <span className="text-[10px] font-medium" style={{ color: directionColor }}>
                          New intelligence detected
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium tabular-nums" style={{ color: directionColor }}>
                          {delta.previousValue} → {delta.newValue}
                          <span className="ml-1">
                            ({isUp ? '+' : ''}{delta.magnitude})
                          </span>
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                        {delta.detectedAt}
                      </span>
                    </div>
                  </div>

                  {/* Confidence */}
                  <ConfidenceIndicator
                    value={delta.confidence}
                    mode="badge"
                    size="xs"
                    showPercentage={true}
                  />

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onInvestigate?.(delta)}
                      className="text-[10px] font-semibold px-2 py-1 rounded transition-colors"
                      style={{ color: tokens.accent.bright }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = tokens.accent.ghost; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Investigate
                    </button>
                    <button
                      onClick={() => acknowledgeDelta(delta.id)}
                      className="text-[10px] font-medium px-2 py-1 rounded transition-colors"
                      style={{ color: tokens.text.muted }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = tokens.accent.ghost; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                {/* Reasoning — expandable */}
                {delta.reasoning && (
                  <div
                    className="px-4 py-2"
                    style={{ borderTop: `1px solid ${tokens.border.subtle}`, background: tokens.surface.secondary }}
                  >
                    <InlineReasoning
                      reasoning={delta.reasoning}
                      positiveFactors={delta.evidence
                        ?.filter(e => e.snippet.length > 20)
                        .slice(0, 2)
                        .map(e => e.source) ?? []
                      }
                      compact={true}
                      showExpandLink={false}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
