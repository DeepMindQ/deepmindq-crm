'use client';

// G11 FIX: Data depth badge integrated into recommendation card
import { Sparkles, Check, X, Bookmark, Info } from 'lucide-react';
import { TrustIndicator } from '../atoms/trust-indicator';
import { ActionCTA } from '../atoms/action-cta';
import { DataDepthBadge } from './data-depth-badge';
import type { Recommendation, RecommendationStatus } from '@/lib/intelligence-types';
import { getConfidenceTrustLevel } from '@/lib/intelligence-types';

export interface RecommendationCardProps {
  recommendation: Recommendation;
  onAction?: (action: string, id: string) => void;
  className?: string;
}

const statusLabels: Record<RecommendationStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  dismissed: 'Dismissed',
  saved: 'Saved',
};

export function RecommendationCard({ recommendation, onAction, className = '' }: RecommendationCardProps) {
  const trustLevel = getConfidenceTrustLevel(recommendation.confidence);
  const isPending = recommendation.status === 'pending';

  return (
    <div
      className={`dmq-glass-card p-4 lg:p-5 transition-all duration-200 ${className}`}
      style={{
        borderLeft: '3px solid var(--accent-secondary)',
        opacity: isPending ? 1 : 0.6,
      }}
    >
      {/* AI Badge + Confidence */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[var(--opportunity-purple-low)] text-[var(--opportunity-purple)] border border-[var(--opportunity-purple)] border-opacity-30">
            <Sparkles className="w-3 h-3" />
            AI Recommendation
          </span>
          {!isPending && (
            <span className="text-[10px] font-medium text-[var(--primary-dim)]">
              {statusLabels[recommendation.status]}
            </span>
          )}
        </div>
        <TrustIndicator level={trustLevel} score={recommendation.confidence} size="sm" />
        {/* Phase 4.5.6: Data depth indicator on recommendation cards */}
        {recommendation.dataDepthIndicator && (
          <DataDepthBadge depth={recommendation.dataDepthIndicator} size="sm" />
        )}
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-semibold text-[var(--primary)] leading-snug mb-1.5">
        {recommendation.title}
      </h3>

      {/* Description */}
      <p className="text-[12px] text-[var(--primary-dim)] leading-relaxed mb-2">
        {recommendation.description}
      </p>

      {/* Reasoning (collapsed by default, can expand) */}
      <div className="flex items-start gap-1.5 mb-3 p-2.5 rounded-lg bg-[var(--bg-deep)] border border-[var(--border)]">
        <Info className="w-3.5 h-3.5 text-[var(--accent-secondary)] mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-[var(--primary-dim)] leading-relaxed">
          {recommendation.reasoning}
        </p>
      </div>

      {/* User decision buttons — MS7 principle: NO autonomous execution */}
      {isPending && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onAction?.('accept', recommendation.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--success-green)] text-white min-h-[44px] transition-colors hover:opacity-90"
          >
            <Check className="w-3.5 h-3.5" />
            Accept
          </button>
          <button
            onClick={() => onAction?.('dismiss', recommendation.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-transparent text-[var(--primary-dim)] border border-[var(--border)] min-h-[44px] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--primary)]"
          >
            <X className="w-3.5 h-3.5" />
            Dismiss
          </button>
          <button
            onClick={() => onAction?.('save', recommendation.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-transparent text-[var(--primary-dim)] border border-[var(--border)] min-h-[44px] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--primary)]"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Save for later
          </button>
        </div>
      )}
    </div>
  );
}
