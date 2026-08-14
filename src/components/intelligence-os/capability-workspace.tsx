'use client';

import { motion } from 'framer-motion';
import {
  PageTransition,
  StatCard,
  StaggerGrid,
  StaggerItem,
  AnimatedCard,
  GlassPanel,
} from '@/components/ui/animated-components';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Cpu,
  Target,
  TrendingUp,
  Brain,
  ShieldAlert,
  MessageSquareText,
  Settings2,
  Zap,
  BarChart3,
  SlidersHorizontal,
  Activity,
} from 'lucide-react';

/* ── Mock Data ── */

const CAPABILITIES_DATA = [
  {
    id: 'signal-detection',
    name: 'Signal Detection',
    description:
      'Real-time identification of business signals from 50+ data sources including funding, hiring, technology, and market events.',
    status: 'Active' as const,
    accuracy: 96.2,
    icon: Target,
    color: '#3B82F6',
    version: 'v3.2.1',
    lastTrained: 'Aug 12, 2026',
  },
  {
    id: 'entity-resolution',
    name: 'Entity Resolution',
    description:
      'Cross-referencing and deduplication of entities across data sources with fuzzy matching and graph-based disambiguation.',
    status: 'Active' as const,
    accuracy: 93.8,
    icon: Brain,
    color: '#8B5CF6',
    version: 'v2.8.4',
    lastTrained: 'Aug 10, 2026',
  },
  {
    id: 'trend-analysis',
    name: 'Trend Analysis',
    description:
      'Pattern recognition across temporal data to identify emerging market trends, seasonal patterns, and growth trajectories.',
    status: 'Active' as const,
    accuracy: 91.5,
    icon: TrendingUp,
    color: '#10B981',
    version: 'v2.5.0',
    lastTrained: 'Aug 11, 2026',
  },
  {
    id: 'predictive-scoring',
    name: 'Predictive Scoring',
    description:
      'ML-driven scoring models that predict buying intent, pipeline conversion probability, and account health trajectories.',
    status: 'Active' as const,
    accuracy: 94.1,
    icon: Activity,
    color: '#F59E0B',
    version: 'v4.1.2',
    lastTrained: 'Aug 13, 2026',
  },
  {
    id: 'anomaly-detection',
    name: 'Anomaly Detection',
    description:
      'Statistical outlier detection for unusual account behavior, sudden data shifts, and potential data quality issues.',
    status: 'Beta' as const,
    accuracy: 87.3,
    icon: ShieldAlert,
    color: '#EF4444',
    version: 'v0.9.3-beta',
    lastTrained: 'Aug 9, 2026',
  },
  {
    id: 'nl-query',
    name: 'Natural Language Query',
    description:
      'Conversational interface for querying intelligence data using natural language with context-aware intent parsing.',
    status: 'Beta' as const,
    accuracy: 89.7,
    icon: MessageSquareText,
    color: '#06B6D4',
    version: 'v1.0.0-beta',
    lastTrained: 'Aug 13, 2026',
  },
];

/* ── Status Badge ── */

function CapabilityStatusBadge({ status }: { status: string }) {
  const isBeta = status === 'Beta';
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        color: isBeta ? '#F59E0B' : '#10B981',
        background: isBeta ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
      }}
    >
      {status}
    </span>
  );
}

/* ── Accuracy Bar ── */

function AccuracyBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--ios-bg-elevated)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}CC)` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-12 text-right" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

/* ── Main Component ── */

export function CapabilityWorkspace() {
  return (
    <PageTransition className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--ios-text-primary)' }}
          >
            Capability Workspace
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ios-text-secondary)' }}>
            Configure AI engines, scoring models &amp; intelligence capabilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              color: 'var(--ios-text-secondary)',
              background: 'var(--ios-bg-card)',
              border: '1px solid var(--ios-border)',
            }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Global Settings
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Capabilities" value={12} icon={Cpu} color="#3B82F6" />
        <StatCard label="Model Accuracy" value="94.7%" icon={BarChart3} color="#10B981" />
        <StatCard label="Processing Speed" value="1.2s" icon={Zap} color="#F59E0B" />
        <StatCard label="Custom Rules" value={38} icon={Settings2} color="#8B5CF6" />
      </div>

      {/* ── Capabilities Grid ── */}
      <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" stagger={0.08}>
        {CAPABILITIES_DATA.map((cap) => {
          const Icon = cap.icon;
          return (
            <StaggerItem key={cap.id}>
              <AnimatedCard className="p-5 flex flex-col h-full" glow={`${cap.color}15`} delay={0}>
                {/* Top: Icon + Status */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${cap.color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: cap.color }} />
                  </div>
                  <CapabilityStatusBadge status={cap.status} />
                </div>

                {/* Name + Description */}
                <h3
                  className="text-sm font-semibold mb-1.5"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  {cap.name}
                </h3>
                <p
                  className="text-xs leading-relaxed mb-4 flex-1"
                  style={{ color: 'var(--ios-text-secondary)' }}
                >
                  {cap.description}
                </p>

                {/* Accuracy Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--ios-text-secondary)' }}
                    >
                      Accuracy
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--ios-text-secondary)' }}>
                      {cap.version}
                    </span>
                  </div>
                  <AccuracyBar value={cap.accuracy} color={cap.color} />
                </div>

                {/* Footer */}
                <div
                  className="flex items-center justify-between pt-3 mt-auto"
                  style={{ borderTop: '1px solid var(--ios-border)' }}
                >
                  <span className="text-[11px]" style={{ color: 'var(--ios-text-secondary)' }}>
                    Trained: {cap.lastTrained}
                  </span>
                  <button
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
                    style={{ color: cap.color, background: `${cap.color}10` }}
                  >
                    <Settings2 className="w-3 h-3" />
                    Configure
                  </button>
                </div>
              </AnimatedCard>
            </StaggerItem>
          );
        })}
      </StaggerGrid>
    </PageTransition>
  );
}
