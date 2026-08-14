'use client';

import { useDroppable } from '@dnd-kit/core';
import { tokens, radius } from '@/components/intelligence-os/design-tokens';
import { type Deal, type StageConfig, formatCurrency } from './pipeline-types';
import { DealCard } from './deal-card';

// ═══════════════════════════════════════════════════════════════
// DROPPABLE COLUMN COMPONENT
// ═══════════════════════════════════════════════════════════════

export interface StageColumnProps {
  stage: StageConfig;
  deals: Deal[];
  onCardClick: (_deal: Deal) => void;
  isOver: boolean;
}

export function StageColumn({ stage, deals, onCardClick, isOver }: StageColumnProps) {
  const { setNodeRef } = useDroppable({ id: stage.key });
  const columnValue = deals.reduce((sum, d) => sum + d.value, 0);
  const StageIcon = stage.icon;

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col min-w-[280px] max-w-[320px] flex-1"
      style={{ borderRadius: radius.lg }}
    >
      {/* Column Header */}
      <div
        className="px-3 py-2.5 mb-2 flex items-center justify-between"
        style={{
          borderRadius: radius.md,
          background: isOver ? stage.bg : 'transparent',
          border: `1px solid ${isOver ? stage.border : 'transparent'}`,
          transition: 'all 200ms ease',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: stage.bg }}
          >
            <StageIcon className="w-3.5 h-3.5" style={{ color: stage.color }} />
          </div>
          <span className="text-[12px] font-semibold" style={{ color: tokens.text.primary }}>
            {stage.label}
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: stage.bg, color: stage.color }}
          >
            {deals.length}
          </span>
        </div>
        <span className="text-[11px] font-semibold" style={{ color: tokens.text.secondary }}>
          {formatCurrency(columnValue)}
        </span>
      </div>

      {/* Cards Container */}
      <div
        className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] pr-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${tokens.border.default} transparent` }}
      >
        {deals.length === 0 && (
          <div
            className="flex-1 flex items-center justify-center py-8 rounded-lg border border-dashed"
            style={{ borderColor: tokens.border.default, minHeight: '80px' }}
          >
            <p className="text-[11px]" style={{ color: tokens.text.muted }}>
              No deals
            </p>
          </div>
        )}
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onClick={() => onCardClick(deal)} />
        ))}
      </div>
    </div>
  );
}
