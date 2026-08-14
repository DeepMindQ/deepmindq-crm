'use client';

import { Search, X } from 'lucide-react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { type StageKey, STAGES } from './pipeline-types';

// ═══════════════════════════════════════════════════════════════
// FILTER BAR COMPONENT
// ═══════════════════════════════════════════════════════════════

export interface PipelineFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  stageFilter: StageKey | 'all';
  onStageFilterChange: (filter: StageKey | 'all') => void;
  deals: { stage: StageKey }[];
}

export function PipelineFilters({
  searchQuery,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  deals,
}: PipelineFiltersProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
          style={{ color: tokens.text.muted }}
        />
        <input
          type="text"
          placeholder="Search by company or contact…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 pl-8 pr-8 rounded-lg text-[12px] outline-none transition-colors"
          style={{
            background: tokens.surface.secondary,
            border: `1px solid ${tokens.border.default}`,
            color: tokens.text.primary,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = tokens.accent.primary)}
          onBlur={(e) => (e.currentTarget.style.borderColor = tokens.border.default)}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <X className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
          </button>
        )}
      </div>

      {/* Stage Filter Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => onStageFilterChange('all')}
          className="px-3 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all"
          style={{
            background: stageFilter === 'all' ? tokens.accent.primary : 'transparent',
            color: stageFilter === 'all' ? tokens.flat.white : tokens.text.secondary,
            border: `1px solid ${stageFilter === 'all' ? tokens.accent.primary : tokens.border.default}`,
          }}
        >
          All Stages
        </button>
        {STAGES.map((stage) => {
          const count = deals.filter((d) => d.stage === stage.key).length;
          return (
            <button
              key={stage.key}
              onClick={() => onStageFilterChange(stage.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all"
              style={{
                background: stageFilter === stage.key ? stage.color : 'transparent',
                color: stageFilter === stage.key ? tokens.flat.white : tokens.text.secondary,
                border: `1px solid ${stageFilter === stage.key ? stage.color : tokens.border.default}`,
              }}
            >
              <stage.icon className="w-3 h-3" />
              {stage.label}
              <span
                className="text-[9px] font-bold px-1 py-0.5 rounded-full"
                style={{
                  background: stageFilter === stage.key ? 'rgba(255,255,255,0.25)' : stage.bg,
                  color: stageFilter === stage.key ? tokens.flat.white : stage.color,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
