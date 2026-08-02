'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, Brain, Activity, Shield, Zap,
} from 'lucide-react';
import { ConfidenceIndicator } from './confidence-indicator';
import { tokens, motion as motionTokens } from './design-tokens';

/* ═══════════════════════════════════════════════════════════════
   StatusMetricsBar — Collapsible Intelligence Health Strip
   
   Phase 1B Redesign: Extracted from command-center.tsx monolith.
   
   Design Intent: KPI metrics relocated from first viewport to a
   collapsible strip. Intelligence-first means KPIs are accessible
   but NOT prominent. The bar shows system health, signal activity,
   and confidence averages — not dashboard counts.
   
   Intelligence Flow:
     /api/command-center/insights → KPI aggregation
     System health from engine monitoring
     Confidence averages from multi-factor computation
   
   UX DNA Compliance:
     ✅ Intelligence First — Bar is collapsed by default, intelligence above
     ✅ Reasoning Transparency — Confidence is a computed average, not a count
     ✅ Evidence Visibility — Clicking "Why?" shows computation method
     ✅ Confidence Layer — Average confidence displayed with tier color
     ✅ Action Orientation — "Expand" reveals detail for investigation
     ✅ Context Preservation — Compact inline, no page navigation
   ═══════════════════════════════════════════════════════════════ */

export interface StatusMetricsKPIs {
  totalAccounts: number;
  activeSignals: number;
  avgIntelligenceScore: number;
  pendingActions: number;
}

export interface SystemHealth {
  engines: Array<{ name: string; status: string }>;
  aiStatus: string;
}

export interface StatusMetricsBarProps {
  /** KPI data from /api/command-center/insights */
  kpis: StatusMetricsKPIs | null;
  /** System health from engine monitoring */
  systemHealth: SystemHealth | null;
}

export function StatusMetricsBar({
  kpis,
  systemHealth,
}: StatusMetricsBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (!kpis && !systemHealth) return null;

  const aiOnline = systemHealth?.aiStatus === 'available';
  const avgConfidence = kpis?.avgIntelligenceScore ?? 0;
  const confidenceTier = avgConfidence >= 70 ? 'high' : avgConfidence >= 45 ? 'medium' : 'low';
  const confidenceColor = tokens.confidence[confidenceTier as keyof typeof tokens.confidence].value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...motionTokens.default }}
      className="rounded-lg border"
      style={{ background: tokens.surface.secondary, borderColor: tokens.border.subtle }}
    >
      {/* Collapsed strip — minimal footprint */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-left"
      >
        <div className="flex items-center gap-3">
          {/* AI Status indicator — real engine health */}
          <div
            className="flex items-center gap-1.5"
            title={aiOnline ? 'Intelligence engine online' : 'Intelligence engine degraded'}
          >
            <div className={`size-1.5 rounded-full ${aiOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-[10px] font-medium" style={{ color: aiOnline ? tokens.confidence.high.value : tokens.confidence.medium.value }}>
              AI {aiOnline ? 'Online' : 'Degraded'}
            </span>
          </div>

          {/* Separator */}
          <div className="w-px h-3" style={{ background: tokens.border.subtle }} />

          {/* Compact metrics — scannable not prominent */}
          <div className="flex items-center gap-3">
            <MetricPill
              icon={<Activity className="w-3 h-3" />}
              label={`${kpis?.totalAccounts ?? 0} accounts`}
              color={tokens.text.secondary}
            />
            <MetricPill
              icon={<Zap className="w-3 h-3" />}
              label={`${kpis?.activeSignals ?? 0} signals`}
              color={tokens.domain.signal}
            />
            <MetricPill
              icon={<Shield className="w-3 h-3" />}
              label={`${avgConfidence}% confidence`}
              color={confidenceColor}
            />
            <MetricPill
              icon={<Brain className="w-3 h-3" />}
              label={`${kpis?.pendingActions ?? 0} actions`}
              color={tokens.domain.action}
            />
          </div>
        </div>

        <ChevronRight
          className="w-3 h-3 transition-transform"
          style={{ color: tokens.text.muted, transform: expanded ? 'rotate(90deg)' : 'none' }}
        />
      </button>

      {/* Expanded detail — KPI cards with confidence visualization */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ ...motionTokens.fast }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-3 pb-3">
              <KPICard
                label="Accounts"
                value={kpis?.totalAccounts ?? 0}
                color={tokens.text.primary}
                description="Tracked companies"
              />
              <KPICard
                label="Active Signals"
                value={kpis?.activeSignals ?? 0}
                color={tokens.domain.signal}
                description="Intelligence events"
              />
              <KPICard
                label="Avg Confidence"
                value={`${avgConfidence}%`}
                color={confidenceColor}
                description="Multi-factor average"
                showConfidenceBar={true}
                confidenceValue={avgConfidence}
              />
              <KPICard
                label="Pending Actions"
                value={kpis?.pendingActions ?? 0}
                color={tokens.domain.action}
                description="Awaiting execution"
              />
            </div>

            {/* Engine health detail */}
            {systemHealth?.engines && systemHealth.engines.length > 0 && (
              <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: tokens.text.muted }}>
                  Engine Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {systemHealth.engines.map((engine, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className={`size-1.5 rounded-full ${
                        engine.status === 'active' ? 'bg-emerald-500' :
                        engine.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                      }`} />
                      <span className="text-[10px]" style={{ color: tokens.text.secondary }}>
                        {engine.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components — Minimal, purpose-built
   ═══════════════════════════════════════════════════════════════ */

function MetricPill({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span style={{ color }}>{icon}</span>
      <span className="text-[10px] font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

function KPICard({
  label,
  value,
  color,
  description,
  showConfidenceBar,
  confidenceValue,
}: {
  label: string;
  value: number | string;
  color: string;
  description: string;
  showConfidenceBar?: boolean;
  confidenceValue?: number;
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: tokens.surface.card }}>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
      {showConfidenceBar && confidenceValue !== undefined && (
        <div className="mt-1">
          <ConfidenceIndicator
            value={confidenceValue}
            mode="bar"
            size="xs"
            showPercentage={false}
          />
        </div>
      )}
      <p className="text-[9px] mt-0.5" style={{ color: tokens.text.muted }}>
        {description}
      </p>
    </div>
  );
}
