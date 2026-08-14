'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { BrainCircuit, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, radius, elevation } from '@/components/intelligence-os/design-tokens';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { type Deal, getStageConfig, getScoreColor, formatCurrency } from './pipeline-types';

// ═══════════════════════════════════════════════════════════════
// DRAGGABLE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

export interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  isDragOverlay?: boolean;
}

export function DealCard({ deal, onClick, isDragOverlay = false }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  });
  const stageConfig = getStageConfig(deal.stage);
  const scoreStyle = getScoreColor(deal.intelligenceScore);
  const style = isDragOverlay
    ? { transform: CSS.Translate.toString(transform), boxShadow: elevation.xl, opacity: 0.95 }
    : { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        cursor: 'grab',
        borderRadius: radius.md,
        border: `1px solid ${tokens.border.default}`,
        background: tokens.surface.card,
      }}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'p-3 transition-colors hover:border-opacity-60',
        !isDragging && 'hover:shadow-md',
      )}
      onMouseEnter={(e) => {
        if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = stageConfig.color;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = tokens.border.default;
      }}
    >
      {/* Header: Company + Value */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold"
            style={{
              background: stageConfig.bg,
              color: stageConfig.color,
              border: `1px solid ${stageConfig.border}`,
            }}
          >
            {deal.companyLogo}
          </div>
          <div className="min-w-0">
            <p
              className="text-[13px] font-semibold truncate"
              style={{ color: tokens.text.primary }}
            >
              {deal.company}
            </p>
            <p className="text-[11px] truncate" style={{ color: tokens.text.secondary }}>
              {deal.contact}
            </p>
          </div>
        </div>
        <span className="text-[13px] font-bold shrink-0" style={{ color: tokens.text.primary }}>
          {formatCurrency(deal.value)}
        </span>
      </div>

      {/* Intelligence Score Bar */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium" style={{ color: tokens.text.secondary }}>
            Intelligence Score
          </span>
          <span className="text-[11px] font-bold" style={{ color: scoreStyle.color }}>
            {deal.intelligenceScore}
          </span>
        </div>
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ background: tokens.borderFaint }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: scoreStyle.color }}
            initial={{ width: 0 }}
            animate={{ width: `${deal.intelligenceScore}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Footer: Days + Signals count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1" style={{ color: tokens.text.muted }}>
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-medium">{deal.daysInStage}d in stage</span>
        </div>
        {deal.signals.length > 0 && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                  style={{ background: tokens.accent.ghost }}
                >
                  <BrainCircuit className="w-3 h-3" style={{ color: tokens.domain.reasoning }} />
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: tokens.domain.reasoning }}
                  >
                    {deal.signals.length}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="text-xs"
                style={{
                  background: tokens.surface.elevated,
                  border: `1px solid ${tokens.border.default}`,
                }}
              >
                {deal.signals.length} intelligence signal{deal.signals.length > 1 ? 's' : ''}{' '}
                detected
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
