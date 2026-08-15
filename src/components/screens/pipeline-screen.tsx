'use client';

import { useState, useMemo, useCallback } from 'react';
import { typography } from '@/components/intelligence-os/design-tokens';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { DollarSign, TrendingUp, BarChart3, CalendarDays } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DealCard,
  StageColumn,
  DealDetailPanel,
  PipelineStatCard,
  PipelineFilters,
  STAGES,
  MOCK_DEALS,
  getStageConfig,
  formatCurrency,
  type Deal,
  type StageKey,
} from './pipeline';

// ═══════════════════════════════════════════════════════════════
// MAIN PIPELINE SCREEN
// ═══════════════════════════════════════════════════════════════

export default function Pipeline() {
  const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<StageKey | 'all'>('all');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── Filtered deals ──
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      const matchesSearch =
        !searchQuery.trim() ||
        d.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.contact.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStage = stageFilter === 'all' || d.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [deals, searchQuery, stageFilter]);

  // ── Stats ──
  const stats = useMemo(() => {
    const activeDeals = deals.filter((d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
    const totalValue = activeDeals.reduce((s, d) => s + d.value, 0);
    const weightedValue = activeDeals.reduce((s, d) => s + d.value * d.probability, 0);
    const avgDeal = activeDeals.length > 0 ? totalValue / activeDeals.length : 0;
    const dealsThisMonth = deals.filter((d) => {
      const created = new Date(d.createdAt);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
    return { totalValue, weightedValue, avgDeal, dealsThisMonth, activeCount: activeDeals.length };
  }, [deals]);

  // ── DnD handlers ──
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could be used for visual feedback
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const dealId = active.id as string;
    const newStage = over.id as StageKey;

    // Validate it's a valid stage
    if (
      ![
        'prospecting',
        'qualification',
        'proposal',
        'negotiation',
        'closed_won',
        'closed_lost',
      ].includes(newStage)
    )
      return;

    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d;
        const stageConfig = getStageConfig(newStage);
        return {
          ...d,
          stage: newStage,
          probability: stageConfig.probability,
          daysInStage: newStage === d.stage ? d.daysInStage : 0,
        };
      }),
    );
  }, []);

  const activeDeal = useMemo(() => deals.find((d) => d.id === activeId) ?? null, [deals, activeId]);

  // ── Grouped by stage ──
  const dealsByStage = useMemo(() => {
    const map: Record<StageKey, Deal[]> = {
      prospecting: [],
      qualification: [],
      proposal: [],
      negotiation: [],
      closed_won: [],
      closed_lost: [],
    };
    filteredDeals.forEach((d) => map[d.stage].push(d));
    // Sort each stage by intelligence score descending
    Object.keys(map).forEach((k) => {
      (map[k as StageKey] as Deal[]).sort((a, b) => b.intelligenceScore - a.intelligenceScore);
    });
    return map;
  }, [filteredDeals]);

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: typography.fontFamily }}>
      {/* ── Header ── */}
      <div
        className="px-5 pt-4 pb-3 shrink-0"
        style={{ borderBottom: `1px solid var(--ios-border-default, #1E293B)` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="text-base font-bold"
              style={{ color: 'var(--ios-text-primary, #F1F5F9)' }}
            >
              Deal Pipeline
            </h1>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: 'var(--ios-text-secondary, #94A3B8)' }}
            >
              {stats.activeCount} active deals · Drag cards to update stages
            </p>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <PipelineStatCard
            icon={DollarSign}
            label="Total Pipeline Value"
            value={formatCurrency(stats.totalValue)}
            subValue={`${stats.activeCount} active deals`}
            accentColor="var(--ios-accent-primary, #3B82F6)"
          />
          <PipelineStatCard
            icon={TrendingUp}
            label="Weighted Pipeline"
            value={formatCurrency(stats.weightedValue)}
            subValue={`${Math.round((stats.weightedValue / stats.totalValue) * 100)}% of total`}
            accentColor="var(--ios-confidence-high, #10B981)"
          />
          <PipelineStatCard
            icon={BarChart3}
            label="Avg Deal Size"
            value={formatCurrency(stats.avgDeal)}
            accentColor="var(--ios-domain-enrichment, #D97706)"
          />
          <PipelineStatCard
            icon={CalendarDays}
            label="Deals This Month"
            value={String(stats.dealsThisMonth)}
            subValue="New pipeline entries"
            accentColor="var(--ios-domain-reasoning, #8B5CF6)"
          />
        </div>

        {/* ── Filter Bar ── */}
        <PipelineFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          stageFilter={stageFilter}
          onStageFilterChange={setStageFilter}
          deals={deals}
        />
      </div>

      {/* ── Kanban Board ── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-5 py-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max">
            {STAGES.map((stage) => (
              <StageColumn
                key={stage.key}
                stage={stage}
                deals={dealsByStage[stage.key]}
                onCardClick={setSelectedDeal}
                isOver={false}
              />
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeDeal ? (
              <div style={{ width: '280px' }}>
                <DealCard deal={activeDeal} onClick={() => {}} isDragOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Detail Panel ── */}
      <AnimatePresence>
        {selectedDeal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
              onClick={() => setSelectedDeal(null)}
            />
            <DealDetailPanel deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
