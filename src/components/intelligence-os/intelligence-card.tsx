'use client';

import { motion } from 'framer-motion';
import {
  Zap, TrendingUp, AlertTriangle, Sparkles, Brain, Target,
  Clock, ExternalLink, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, getConfidenceTier } from './design-tokens';

/* ═══════════════════════════════════════════════════
   IntelligenceCard — Dense Intelligence Display
   
   A compact, scannable card for displaying intelligence
   in feeds, grids, and lists. Not a narrative — a signal.
   Designed for rapid scanning across many items.
   
   Principles:
   - Minimal Surface Maximum Depth: Small footprint, dense info
   - Intelligence Density Not Information Density
   - Calm Over Complexity: Ordered, not cluttered
   ═══════════════════════════════════════════════════ */

export type CardVariant = 'signal' | 'opportunity' | 'risk' | 'enrichment' | 'reasoning' | 'action';

export interface IntelligenceCardProps {
  title: string;
  description?: string;
  variant?: CardVariant;
  confidence?: number;
  timestamp?: string;
  entityName?: string;
  intelligenceScore?: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  isNew?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  onClick?: () => void;
  meta?: Array<{ label: string; value: string }>;
  className?: string;
}

function getVariantConfig(variant: CardVariant) {
  const configs: Record<CardVariant, { icon: typeof Zap; color: string; bg: string; border: string }> = {
    signal:      { icon: Zap,         color: tokens.domain.signal,      bg: tokens.accent.ghost,      border: tokens.accent.subtle },
    opportunity: { icon: TrendingUp,  color: tokens.domain.opportunity, bg: tokens.extended.purple.bgSubtle,     border: tokens.extended.purple.border },
    risk:        { icon: AlertTriangle, color: tokens.domain.risk,       bg: tokens.priority.critical.bg,      border: tokens.priority.critical.border },
    enrichment:  { icon: Sparkles,     color: tokens.domain.enrichment, bg: tokens.extended.sky.bg,      border: tokens.extended.sky.border },
    reasoning:   { icon: Brain,        color: tokens.domain.reasoning,  bg: tokens.priority.high.bg,     border: tokens.priority.high.border },
    action:      { icon: Target,       color: tokens.domain.action,     bg: tokens.extended.emerald.bg,      border: tokens.extended.emerald.border },
  };
  return configs[variant];
}

function MiniConfidenceBar({ value }: { value: number }) {
  const tier = getConfidenceTier(value);
  const color = tokens.confidence[tier].value;
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: tokens.border.subtle }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

export function IntelligenceCard({
  title,
  description,
  variant = 'signal',
  confidence,
  timestamp,
  entityName,
  intelligenceScore,
  priority,
  isNew,
  actionLabel,
  onAction,
  onClick,
  meta,
  className,
}: IntelligenceCardProps) {
  const config = getVariantConfig(variant);
  const Icon = config.icon;

  const priorityColors: Record<string, { bg: string; color: string }> = {
    critical: { bg: tokens.confidence.low.bg, color: tokens.domain.risk },
    high:     { bg: tokens.confidence.medium.bg, color: tokens.domain.reasoning },
    medium:   { bg: tokens.accent.subtle, color: tokens.accent.DEFAULT },
    low:      { bg: tokens.priority.low.bg, color: tokens.text.secondary },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn('group rounded-xl border overflow-hidden transition-all duration-200', className)}
      style={{
        background: tokens.surface.card,
        borderColor: tokens.border.default,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tokens.border.hover;
        e.currentTarget.style.background = tokens.surface.cardHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tokens.border.default;
        e.currentTarget.style.background = tokens.surface.card;
      }}
    >
      {/* Left accent */}
      <div className="flex">
        <div className="w-[3px] shrink-0" style={{ background: config.color }} />

        <div className="flex-1 min-w-0 p-3.5">
          {/* Header row */}
          <div className="flex items-start gap-2.5">
            {/* Icon */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: config.bg }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Meta badges */}
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                {isNew && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: tokens.extended.emerald.bg, color: tokens.extended.emerald.value }}>
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    New
                  </span>
                )}
                {priority && priorityColors[priority] && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={priorityColors[priority]}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </span>
                )}
              </div>

              {/* Title */}
              <h4 className="text-[13px] font-semibold leading-snug" style={{ color: tokens.text.primary }}>
                {title}
              </h4>

              {/* Description */}
              {description && (
                <p className="text-[11px] leading-relaxed mt-0.5 line-clamp-2" style={{ color: tokens.text.secondary }}>
                  {description}
                </p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                {entityName && (
                  <span className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>
                    {entityName}
                  </span>
                )}
                {timestamp && (
                  <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: tokens.text.muted }}>
                    <Clock className="w-2.5 h-2.5" />
                    {timestamp}
                  </span>
                )}
                {confidence !== undefined && (
                  <MiniConfidenceBar value={confidence} />
                )}
                {intelligenceScore !== undefined && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: tokens.accent.bright }}>
                    <Brain className="w-2.5 h-2.5" />
                    {intelligenceScore}
                  </span>
                )}
              </div>

              {/* Extra meta grid */}
              {meta && meta.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 pt-2" style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                  {meta.map((m, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: tokens.text.muted }}>{m.label}</span>
                      <span className="text-[10px] font-semibold" style={{ color: tokens.text.primary }}>{m.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action */}
              {actionLabel && onAction && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction(); }}
                  className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold transition-colors"
                  style={{ color: config.color }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  {actionLabel}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
