'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { TrustIndicator } from '../atoms/trust-indicator';
import { FreshnessIndicator } from '../atoms/freshness-indicator';
import { StatusBadge } from '../atoms/status-badge';
import { ActionCTA } from '../atoms/action-cta';
import type { IntelligenceSignal } from '@/lib/intelligence-types';
import { getConfidenceTrustLevel, getPriorityColor } from '@/lib/intelligence-types';

export interface IntelligenceBriefingCardProps {
  signal: IntelligenceSignal;
  onAction?: (action: string, signalId: string) => void;
  className?: string;
}

export function IntelligenceBriefingCard({ signal, onAction, className = '' }: IntelligenceBriefingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const trustLevel = getConfidenceTrustLevel(signal.confidenceScore);
  const priorityColor = getPriorityColor(signal.priority);

  return (
    <div
      className={`group relative dmq-glass-card overflow-hidden transition-colors duration-200 ${className}`}
      style={{
        borderLeft: `3px solid ${priorityColor}`,
      }}
    >
      {/* L1 — Decision Layer (always visible) */}
      <div className="p-4 lg:p-5">
        {/* Priority + Confidence row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <StatusBadge variant="priority" value={signal.priority} />
            {signal.accountName && (
              <span className="text-[11px] font-medium text-[var(--primary-dim)] truncate max-w-[180px]">
                {signal.accountName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TrustIndicator level={trustLevel} score={signal.confidenceScore} size="sm" />
            <FreshnessIndicator timestamp={signal.freshnessTimestamp} />
          </div>
        </div>

        {/* Headline */}
        <h3 className="text-[15px] font-semibold text-[var(--primary)] leading-snug mb-2 tracking-tight">
          {signal.headline}
        </h3>

        {/* Summary (L1 — always visible) */}
        <p className="text-[13px] text-[var(--primary-dim)] leading-relaxed mb-3">
          {signal.summary}
        </p>

        {/* Tags + Evidence indicator */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {signal.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--signal-blue-low)] text-[var(--signal-blue)] border border-[var(--signal-blue)] border-opacity-20"
            >
              {tag}
            </span>
          ))}
          {signal.evidenceAvailable && signal.evidenceCount && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--primary-dim)]">
              <Link2 className="w-3 h-3" />
              {signal.evidenceCount} evidence sources
            </span>
          )}
        </div>

        {/* Expand toggle + primary action */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent)] hover:text-[var(--accent)] transition-colors min-h-[44px] min-w-[44px] px-2"
            aria-expanded={expanded}
            aria-label={expanded ? 'Show less' : 'Show reasoning'}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Why this matters
              </>
            )}
          </button>
          <ActionCTA
            action="review"
            size="sm"
            onClick={() => onAction?.('review', signal.id)}
          />
        </div>
      </div>

      {/* L2 — Reasoning Layer (expanded state) */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-4 lg:px-5 pb-4 lg:pb-5 pt-0 border-t border-[var(--border)]"
            >
              {/* AI Reasoning */}
              <div className="mt-3 mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-secondary)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-secondary)]">
                    AI Reasoning
                  </span>
                </div>
                <p className="text-[13px] text-[var(--primary)] leading-relaxed">
                  {signal.reasoning}
                </p>
              </div>

              {/* Source attribution */}
              <div className="flex items-center gap-2 text-[11px] text-[var(--primary-dim)] mb-3">
                <span>Source: {signal.source}</span>
                <span>·</span>
                <FreshnessIndicator timestamp={signal.freshnessTimestamp} showIcon={false} />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <ActionCTA action="save" size="sm" onClick={() => onAction?.('save', signal.id)} />
                <ActionCTA action="monitor" size="sm" onClick={() => onAction?.('monitor', signal.id)} />
                <ActionCTA action="schedule" size="sm" onClick={() => onAction?.('schedule', signal.id)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
