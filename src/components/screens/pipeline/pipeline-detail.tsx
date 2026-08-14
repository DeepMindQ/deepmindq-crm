'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  ArrowRight,
  BrainCircuit,
  User,
  Building2,
  CalendarDays,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  type Deal,
  STAGES,
  SIGNAL_TYPE_STYLES,
  getStageConfig,
  getScoreColor,
  formatCurrencyFull,
} from './pipeline-types';

// ═══════════════════════════════════════════════════════════════
// DETAIL PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════

export interface DealDetailPanelProps {
  deal: Deal;
  onClose: () => void;
}

export function DealDetailPanel({ deal, onClose }: DealDetailPanelProps) {
  const stageConfig = getStageConfig(deal.stage);
  const scoreStyle = getScoreColor(deal.intelligenceScore);
  const weightedValue = deal.value * deal.probability;
  const StageIcon = stageConfig.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 480, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 480, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 h-full w-[460px] z-50 flex flex-col"
        style={{
          background: tokens.surface.primary,
          borderLeft: `1px solid ${tokens.border.default}`,
          boxShadow: '-8px 0 30px rgba(0,0,0,0.12)',
        }}
      >
        {/* Panel Header */}
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: `1px solid ${tokens.border.default}` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
              style={{
                background: stageConfig.bg,
                color: stageConfig.color,
                border: `1px solid ${stageConfig.border}`,
              }}
            >
              {deal.companyLogo}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate" style={{ color: tokens.text.primary }}>
                {deal.company}
              </h3>
              <p className="text-[11px]" style={{ color: tokens.text.secondary }}>
                {deal.industry}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
            style={{ background: tokens.surfaceExtended }}
          >
            <X className="w-4 h-4" style={{ color: tokens.text.secondary }} />
          </button>
        </div>

        {/* Panel Body - Scrollable */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
          style={{ scrollbarWidth: 'thin', scrollbarColor: `${tokens.border.default} transparent` }}
        >
          {/* Deal Value & Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="p-3 rounded-lg"
              style={{
                background: tokens.surface.secondary,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <p className="text-[10px] font-medium mb-1" style={{ color: tokens.text.muted }}>
                Deal Value
              </p>
              <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                {formatCurrencyFull(deal.value)}
              </p>
            </div>
            <div
              className="p-3 rounded-lg"
              style={{
                background: tokens.surface.secondary,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <p className="text-[10px] font-medium mb-1" style={{ color: tokens.text.muted }}>
                Weighted Value
              </p>
              <p
                className="text-lg font-bold"
                style={{
                  color:
                    deal.probability >= 0.5 ? tokens.confidence.high.value : tokens.text.secondary,
                }}
              >
                {formatCurrencyFull(weightedValue)}
              </p>
              <p className="text-[10px]" style={{ color: tokens.text.muted }}>
                {Math.round(deal.probability * 100)}% probability
              </p>
            </div>
          </div>

          {/* Stage Progress */}
          <div
            className="p-3 rounded-lg"
            style={{
              background: tokens.surface.secondary,
              border: `1px solid ${tokens.border.default}`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <StageIcon className="w-4 h-4" style={{ color: stageConfig.color }} />
              <span className="text-[12px] font-semibold" style={{ color: tokens.text.primary }}>
                Stage: {stageConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              {STAGES.filter((s) => s.key !== 'closed_lost').map((s, i) => {
                const isActive =
                  STAGES.filter((st) => st.key !== 'closed_lost').findIndex(
                    (st) => st.key === deal.stage,
                  ) >= i;
                return (
                  <div key={s.key} className="flex-1 flex items-center gap-1.5">
                    <div
                      className="h-1.5 flex-1 rounded-full"
                      style={{
                        background: isActive ? s.color : tokens.border.default,
                        transition: 'background 300ms',
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                Days in stage
              </span>
              <span className="text-[11px] font-semibold" style={{ color: tokens.text.primary }}>
                {deal.daysInStage} days
              </span>
            </div>
          </div>

          {/* Intelligence Score */}
          <div
            className="p-3 rounded-lg"
            style={{
              background: tokens.surface.secondary,
              border: `1px solid ${tokens.border.default}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4" style={{ color: tokens.domain.reasoning }} />
                <span className="text-[12px] font-semibold" style={{ color: tokens.text.primary }}>
                  Intelligence Score
                </span>
              </div>
              <span
                className="text-sm font-bold px-2 py-0.5 rounded-md"
                style={{ color: scoreStyle.color, background: scoreStyle.bg }}
              >
                {deal.intelligenceScore}/100
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ background: tokens.borderFaint }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: scoreStyle.color }}
                initial={{ width: 0 }}
                animate={{ width: `${deal.intelligenceScore}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          <Separator style={{ background: tokens.border.default }} />

          {/* Contact Info */}
          <div>
            <h4
              className="text-[11px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: tokens.text.muted }}
            >
              Contact
            </h4>
            <div
              className="p-3 rounded-lg space-y-2.5"
              style={{
                background: tokens.surface.secondary,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: stageConfig.bg, color: stageConfig.color }}
                >
                  {deal.contact
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>
                    {deal.contact}
                  </p>
                  <p className="text-[11px]" style={{ color: tokens.text.secondary }}>
                    {deal.contactTitle}
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 text-[11px]"
                style={{ color: tokens.text.secondary }}
              >
                <span className="truncate">{deal.contactEmail}</span>
              </div>
            </div>
          </div>

          {/* Deal Details */}
          <div>
            <h4
              className="text-[11px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: tokens.text.muted }}
            >
              Deal Details
            </h4>
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: `1px solid ${tokens.border.default}` }}
            >
              {[
                { label: 'Owner', value: deal.owner, icon: User },
                { label: 'Source', value: deal.source, icon: Sparkles },
                { label: 'Employees', value: deal.employees, icon: Building2 },
                { label: 'Created', value: deal.createdAt, icon: CalendarDays },
                { label: 'Last Activity', value: deal.lastActivity, icon: Clock },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-3 py-2"
                  style={{
                    background: i % 2 === 0 ? tokens.surface.secondary : tokens.surface.primary,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <row.icon className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
                    <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                      {row.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: tokens.text.primary }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Next Step */}
          <div
            className="p-3 rounded-lg"
            style={{ background: tokens.accent.ghost, border: `1px solid ${tokens.accent.subtle}` }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <ArrowRight className="w-3.5 h-3.5" style={{ color: tokens.accent.primary }} />
              <span className="text-[11px] font-semibold" style={{ color: tokens.accent.primary }}>
                Next Step
              </span>
            </div>
            <p className="text-[12px]" style={{ color: tokens.text.primary }}>
              {deal.nextStep}
            </p>
          </div>

          {/* Notes */}
          <div>
            <h4
              className="text-[11px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: tokens.text.muted }}
            >
              Notes
            </h4>
            <p className="text-[12px] leading-relaxed" style={{ color: tokens.text.secondary }}>
              {deal.notes}
            </p>
          </div>

          {/* Intelligence Signals */}
          {deal.signals.length > 0 && (
            <div>
              <h4
                className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                style={{ color: tokens.text.muted }}
              >
                Intelligence Signals ({deal.signals.length})
              </h4>
              <div className="space-y-2">
                {deal.signals.map((signal) => {
                  const typeStyle = SIGNAL_TYPE_STYLES[signal.type];
                  const SignalIcon = signal.icon;
                  return (
                    <div
                      key={signal.id}
                      className="p-3 rounded-lg"
                      style={{
                        background: typeStyle.bg,
                        border: `1px solid ${typeStyle.border}`,
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: 'rgba(255,255,255,0.6)' }}
                        >
                          <SignalIcon className="w-3.5 h-3.5" style={{ color: typeStyle.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className="text-[12px] font-semibold"
                              style={{ color: typeStyle.color }}
                            >
                              {signal.label}
                            </span>
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                              style={{
                                background: 'rgba(255,255,255,0.7)',
                                color: typeStyle.color,
                              }}
                            >
                              {signal.type}
                            </span>
                          </div>
                          <p
                            className="text-[11px] leading-relaxed mb-1.5"
                            style={{ color: tokens.text.secondary }}
                          >
                            {signal.description}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                              {signal.detectedAt}
                            </span>
                            <span
                              className="text-[10px] font-medium"
                              style={{ color: typeStyle.color }}
                            >
                              {signal.confidence}% confidence
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
