'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  PageTransition,
  StatCard,
  StaggerGrid,
  StaggerItem,
  AnimatedCard,
  AnimatedCounter,
  PulseDot,
  GlassPanel,
} from '@/components/ui/animated-components';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Radar,
  Shield,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Users,
  GitBranch,
  FileText,
  Building2,
  UserMinus,
  Cpu,
  Handshake,
  RefreshCw,
  Clock,
  ChevronRight,
  Search,
  Zap,
  Brain,
  ArrowUpDown,
  Target,
  MessageSquare,
  Eye,
  XCircle,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type FilterKey = 'ALL' | Severity;

interface IntelligenceSignal {
  id: string;
  type: string;
  icon: React.ComponentType<{ className?: string; color?: string }>;
  severity: Severity;
  source: string;
  description: string;
  timestamp: string;
}

interface PipelineEngine {
  name: string;
  shortName: string;
  status: 'active' | 'completed' | 'queued';
  itemsProcessed: number;
  latency: string;
}

interface TeamAction {
  initials: string;
  name: string;
  action: string;
  timestamp: string;
}

interface CoverageDomain {
  domain: string;
  completeness: number;
  color: string;
}

/* ═══════════════════════════════════════════════════════════
   Severity Config
   ═══════════════════════════════════════════════════════════ */

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' },
  HIGH: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' },
  MEDIUM: { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' },
  LOW: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' },
};

/* ═══════════════════════════════════════════════════════════
   Mock Data — Intelligence Signals
   ═══════════════════════════════════════════════════════════ */

const SIGNALS: IntelligenceSignal[] = [
  {
    id: 'SIG-4821',
    type: 'Funding Round',
    icon: DollarSign,
    severity: 'CRITICAL',
    source: 'PitchBook API',
    description:
      'Series C funding round detected for NovaTech AI — $85M raise led by Sequoia Capital with participation from Andreessen Horowitz. Signals aggressive expansion into enterprise markets.',
    timestamp: '2 min ago',
  },
  {
    id: 'SIG-4820',
    type: 'Hiring Surge',
    icon: Users,
    severity: 'HIGH',
    source: 'LinkedIn Intelligence',
    description:
      'Abnormal hiring acceleration at Meridian Systems — 47 new engineering roles posted in 72 hours. Focus areas include ML infrastructure and distributed systems.',
    timestamp: '8 min ago',
  },
  {
    id: 'SIG-4819',
    type: 'Tech Stack Change',
    icon: GitBranch,
    severity: 'MEDIUM',
    source: 'GitHub Monitoring',
    description:
      'QuantumEdge Corp migrated primary backend from Java Spring Boot to Rust. Public repos now show active development of custom microservice framework.',
    timestamp: '14 min ago',
  },
  {
    id: 'SIG-4818',
    type: 'M&A Rumor',
    icon: Building2,
    severity: 'CRITICAL',
    source: 'Dark Web Intel',
    description:
      'Reliable source indicates advanced acquisition discussions between Palantir Technologies and Cipher Analytics. Due diligence phase reportedly underway since Q2.',
    timestamp: '22 min ago',
  },
  {
    id: 'SIG-4817',
    type: 'Exec Departure',
    icon: UserMinus,
    severity: 'HIGH',
    source: 'SEC Filings',
    description:
      'Chief Technology Officer of Helios Data resigned effective immediately. Board filing cites "personal reasons" — pattern matches pre-IPO volatility indicators.',
    timestamp: '35 min ago',
  },
  {
    id: 'SIG-4816',
    type: 'Patent Filing',
    icon: FileText,
    severity: 'MEDIUM',
    source: 'USPTO Feed',
    description:
      'NeuralPath Inc. filed 3 new patents covering transformer-based anomaly detection and real-time graph neural network architectures for financial fraud.',
    timestamp: '41 min ago',
  },
  {
    id: 'SIG-4815',
    type: 'Partnership',
    icon: Handshake,
    severity: 'LOW',
    source: 'Press Monitoring',
    description:
      'Strategic partnership announced between Vortex Cloud and AWS Marketplace. Joint go-to-market targeting regulated industries in EMEA and APAC regions.',
    timestamp: '53 min ago',
  },
  {
    id: 'SIG-4814',
    type: 'Tech Stack Change',
    icon: Cpu,
    severity: 'MEDIUM',
    source: 'Stack Overflow Jobs',
    description:
      'Archon Labs switching from monolithic architecture to event-driven microservices. Job postings indicate move to Kafka, Kubernetes, and Temporal workflows.',
    timestamp: '1h ago',
  },
];

/* ═══════════════════════════════════════════════════════════
   Mock Data — Processing Pipeline
   ═══════════════════════════════════════════════════════════ */

const PIPELINE_ENGINES: PipelineEngine[] = [
  { name: 'Model Router', shortName: 'MR', status: 'active', itemsProcessed: 847, latency: '12ms' },
  {
    name: 'Grounding Engine',
    shortName: 'GE',
    status: 'active',
    itemsProcessed: 832,
    latency: '45ms',
  },
  {
    name: 'Retrieval Engine',
    shortName: 'RE',
    status: 'completed',
    itemsProcessed: 829,
    latency: '120ms',
  },
  {
    name: 'Synthesis Engine',
    shortName: 'SE',
    status: 'active',
    itemsProcessed: 814,
    latency: '230ms',
  },
  {
    name: 'Scoring Engine',
    shortName: 'SC',
    status: 'completed',
    itemsProcessed: 801,
    latency: '18ms',
  },
  { name: 'Action Engine', shortName: 'AE', status: 'queued', itemsProcessed: 786, latency: '—' },
  {
    name: 'Conversation Engine',
    shortName: 'CE',
    status: 'queued',
    itemsProcessed: 762,
    latency: '—',
  },
];

/* ═══════════════════════════════════════════════════════════
   Mock Data — Team Activity
   ═══════════════════════════════════════════════════════════ */

const TEAM_ACTIONS: TeamAction[] = [
  {
    initials: 'SK',
    name: 'Sarah K.',
    action: 'escalated signal #2847 to critical',
    timestamp: '3 min ago',
  },
  {
    initials: 'MR',
    name: 'Mike R.',
    action: 'closed investigation #192 — confirmed false positive',
    timestamp: '11 min ago',
  },
  {
    initials: 'JL',
    name: 'Jenna L.',
    action: 'assigned 3 new signals to the fintech queue',
    timestamp: '18 min ago',
  },
  {
    initials: 'AT',
    name: 'Alex T.',
    action: 'updated threat assessment for sector Alpha-7',
    timestamp: '26 min ago',
  },
  {
    initials: 'DP',
    name: 'David P.',
    action: 'generated intelligence brief for Meridian Systems',
    timestamp: '34 min ago',
  },
];

/* ═══════════════════════════════════════════════════════════
   Mock Data — Coverage Domains
   ═══════════════════════════════════════════════════════════ */

const COVERAGE_DOMAINS: CoverageDomain[] = [
  { domain: 'Financial', completeness: 94, color: '#10B981' },
  { domain: 'Technology', completeness: 87, color: '#3B82F6' },
  { domain: 'Legal', completeness: 76, color: '#8B5CF6' },
  { domain: 'Market', completeness: 82, color: '#F59E0B' },
  { domain: 'Competitive', completeness: 91, color: '#EF4444' },
  { domain: 'Regulatory', completeness: 68, color: '#06B6D4' },
];

/* ═══════════════════════════════════════════════════════════
   Pipeline Status Helpers
   ═══════════════════════════════════════════════════════════ */

const PIPELINE_STATUS: Record<string, { color: string; label: string; dotColor: string }> = {
  active: { color: '#10B981', label: 'Active', dotColor: '#10B981' },
  completed: { color: '#3B82F6', label: 'Completed', dotColor: '#3B82F6' },
  queued: { color: '#F59E0B', label: 'Queued', dotColor: '#F59E0B' },
};

/* ═══════════════════════════════════════════════════════════
   Filter Options
   ═══════════════════════════════════════════════════════════ */

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
];

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

export function IntelligenceOperationsCenter() {
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Simulated clock for "last updated"
  useEffect(() => {
    const now = new Date();
    setLastUpdated(
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
  }, []);

  const filteredSignals =
    activeFilter === 'ALL' ? SIGNALS : SIGNALS.filter((s) => s.severity === activeFilter);

  const handleRefresh = useCallback(() => {
    const now = new Date();
    setLastUpdated(
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
  }, []);

  return (
    <PageTransition className="h-full">
      <div className="h-full flex flex-col gap-5 p-6 overflow-auto">
        {/* ── Header Row ── */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="h-7 w-1.5 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, #93C5FD, #3B82F6, #1E40AF)',
                    boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)',
                  }}
                />
                <h1
                  className="text-xl font-bold tracking-tight"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  Intelligence Operations Center
                </h1>
                <PulseDot color="#10B981" />
                <span
                  className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    color: '#10B981',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  Live
                </span>
              </div>
              <p className="text-sm ml-5" style={{ color: 'var(--ios-text-secondary)' }}>
                Real-time signal processing &amp; investigation management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: 'var(--ios-text-secondary)' }}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Last updated: {lastUpdated || '—'}</span>
            </div>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                color: 'var(--ios-text-secondary)',
                background: 'var(--ios-bg-elevated)',
                border: '1px solid var(--ios-border)',
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </header>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Signals"
            value={847}
            icon={Radar}
            color="#3B82F6"
            trend={{ value: '12%', up: true }}
            delay={0}
          />
          <StatCard
            label="Investigations"
            value={23}
            icon={Shield}
            color="#8B5CF6"
            trend={{ value: '3', up: true }}
            delay={0.08}
          />
          <StatCard
            label="Intel Generated"
            value={1284}
            icon={TrendingUp}
            color="#10B981"
            trend={{ value: '18%', up: true }}
            delay={0.16}
          />
          <StatCard
            label="Threat Level"
            value="MODERATE"
            icon={AlertTriangle}
            color="#F59E0B"
            trend={{ value: 'Stable', up: false }}
            delay={0.24}
          />
        </div>

        {/* ── Main Content: 2-Column Layout ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
          {/* LEFT: Active Signal Stream (7 cols) */}
          <section className="lg:col-span-7 flex flex-col gap-4 min-h-0">
            {/* Filter Bar + Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-5 w-1 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, #93C5FD, #3B82F6)',
                    boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
                  }}
                />
                <h2
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  Active Signal Stream
                </h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    color: 'var(--ios-text-secondary)',
                    background: 'var(--ios-bg-elevated)',
                    border: '1px solid var(--ios-border)',
                  }}
                >
                  {filteredSignals.length} signals
                </span>
              </div>

              {/* Filter Buttons */}
              <div
                className="flex items-center gap-1.5 p-1 rounded-lg"
                style={{
                  background: 'var(--ios-bg-secondary)',
                  border: '1px solid var(--ios-border)',
                }}
              >
                {FILTERS.map((f) => {
                  const isActive = activeFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setActiveFilter(f.key)}
                      className="relative px-3 py-1 rounded-md text-xs font-medium transition-colors"
                      style={{
                        color: isActive ? 'var(--ios-text-primary)' : 'var(--ios-text-secondary)',
                        background: isActive ? 'var(--ios-bg-elevated)' : 'transparent',
                        boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
                      }}
                    >
                      {isActive && f.key !== 'ALL' && (
                        <span
                          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                          style={{ background: SEVERITY_CONFIG[f.key as Severity].color }}
                        />
                      )}
                      <span className={isActive && f.key !== 'ALL' ? 'ml-2' : ''}>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Signal Cards */}
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[620px] pr-1 custom-scrollbar">
              <StaggerGrid stagger={0.06} className="flex flex-col gap-3">
                {filteredSignals.map((signal) => {
                  const isSelected = selectedSignalId === signal.id;
                  const sevConfig = SEVERITY_CONFIG[signal.severity];
                  const SignalIcon = signal.icon;
                  return (
                    <StaggerItem key={signal.id}>
                      <AnimatedCard delay={0} hover={false} glow={sevConfig.bg} className="">
                        <div
                          className="relative rounded-xl p-4 cursor-pointer transition-all duration-200"
                          style={{
                            background: isSelected
                              ? 'var(--ios-bg-elevated)'
                              : 'var(--ios-bg-card)',
                            borderLeft: isSelected
                              ? `3px solid ${sevConfig.color}`
                              : `3px solid transparent`,
                          }}
                          onClick={() => setSelectedSignalId(isSelected ? null : signal.id)}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedSignalId(isSelected ? null : signal.id);
                            }
                          }}
                        >
                          {/* Top row: icon, type, severity, timestamp */}
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                style={{
                                  background: sevConfig.bg,
                                  border: `1px solid ${sevConfig.border}`,
                                }}
                              >
                                <span style={{ color: sevConfig.color }}>
                                  <SignalIcon className="w-4 h-4" />
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className="text-sm font-semibold"
                                    style={{ color: 'var(--ios-text-primary)' }}
                                  >
                                    {signal.type}
                                  </span>
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                    style={{
                                      color: sevConfig.color,
                                      background: sevConfig.bg,
                                      border: `1px solid ${sevConfig.border}`,
                                    }}
                                  >
                                    {signal.severity}
                                  </span>
                                </div>
                                <span
                                  className="text-xs mt-0.5 block"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  {signal.source}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className="text-[11px] whitespace-nowrap"
                                style={{ color: 'var(--ios-text-secondary)' }}
                              >
                                {signal.timestamp}
                              </span>
                              <span
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                style={{
                                  color: 'var(--ios-text-secondary)',
                                  background: 'var(--ios-bg-secondary)',
                                }}
                              >
                                {signal.id}
                              </span>
                            </div>
                          </div>

                          {/* Description */}
                          <p
                            className="text-xs leading-relaxed mb-3 line-clamp-2"
                            style={{ color: 'var(--ios-text-secondary)' }}
                          >
                            {signal.description}
                          </p>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              style={{
                                color: '#3B82F6',
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                              }}
                            >
                              <Search className="w-3 h-3" />
                              Investigate
                            </button>
                            <button
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              style={{
                                color: 'var(--ios-text-secondary)',
                                background: 'var(--ios-bg-secondary)',
                                border: '1px solid var(--ios-border)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--ios-text-secondary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--ios-border)';
                              }}
                            >
                              <XCircle className="w-3 h-3" />
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </AnimatedCard>
                    </StaggerItem>
                  );
                })}
              </StaggerGrid>
            </div>
          </section>

          {/* RIGHT: Pipeline + Team (5 cols) */}
          <aside className="lg:col-span-5 flex flex-col gap-5 min-h-0">
            {/* Processing Pipeline */}
            <GlassPanel className="flex flex-col gap-4 p-5" style={{ minHeight: 0 }}>
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="h-5 w-1 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, #93C5FD, #3B82F6)',
                    boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
                  }}
                />
                <h2
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  Processing Pipeline
                </h2>
                <PulseDot color="#10B981" />
              </div>

              <div className="flex flex-col gap-2.5">
                {PIPELINE_ENGINES.map((engine, idx) => {
                  const statusConf = PIPELINE_STATUS[engine.status];
                  const isLast = idx === PIPELINE_ENGINES.length - 1;
                  return (
                    <div key={engine.shortName} className="relative">
                      <div
                        className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                        style={{
                          background: 'var(--ios-bg-secondary)',
                          border: '1px solid var(--ios-border)',
                        }}
                      >
                        {/* Engine initials badge */}
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{
                            color: statusConf.color,
                            background: `${statusConf.color}15`,
                            border: `1px solid ${statusConf.color}30`,
                          }}
                        >
                          {engine.shortName}
                        </div>

                        {/* Engine info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="text-xs font-medium truncate"
                              style={{ color: 'var(--ios-text-primary)' }}
                            >
                              {engine.name}
                            </span>
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                              style={{
                                color: statusConf.color,
                                background: `${statusConf.color}15`,
                              }}
                            >
                              {statusConf.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span
                              className="text-[11px]"
                              style={{ color: 'var(--ios-text-secondary)' }}
                            >
                              {engine.itemsProcessed.toLocaleString()} items
                            </span>
                            <span
                              className="text-[11px]"
                              style={{ color: 'var(--ios-text-secondary)' }}
                            >
                              {engine.latency !== '—' ? (
                                <span style={{ color: statusConf.color }}>{engine.latency}</span>
                              ) : (
                                '—'
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Connector line between engines */}
                      {!isLast && (
                        <div className="flex justify-center" style={{ height: '8px' }}>
                          <div
                            className="w-px"
                            style={{
                              background: `linear-gradient(180deg, ${statusConf.color}40, var(--ios-border))`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </GlassPanel>

            {/* Team Activity */}
            <GlassPanel className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="h-5 w-1 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, #C4B5FD, #8B5CF6)',
                    boxShadow: '0 0 8px rgba(139, 92, 246, 0.3)',
                  }}
                />
                <h2
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  Team Activity
                </h2>
              </div>

              <div className="flex flex-col gap-3">
                {TEAM_ACTIONS.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2.5 rounded-lg transition-colors"
                    style={{ background: 'var(--ios-bg-secondary)' }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        color: 'var(--ios-text-primary)',
                        background: `linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))`,
                        border: '1px solid var(--ios-border)',
                      }}
                    >
                      {item.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: 'var(--ios-text-secondary)' }}
                      >
                        <span
                          className="font-semibold"
                          style={{ color: 'var(--ios-text-primary)' }}
                        >
                          {item.name}
                        </span>{' '}
                        {item.action}
                      </p>
                      <span
                        className="text-[10px] mt-1 block"
                        style={{ color: 'var(--ios-text-muted, #5a6478)' }}
                      >
                        {item.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </aside>
        </div>

        {/* ── Bottom: Intelligence Coverage Map ── */}
        <GlassPanel className="p-5">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="h-5 w-1 rounded-full"
              style={{
                background: 'linear-gradient(180deg, #93C5FD, #3B82F6)',
                boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
              }}
            />
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--ios-text-primary)' }}
            >
              Intelligence Coverage Map
            </h2>
            <span
              className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                color: 'var(--ios-text-secondary)',
                background: 'var(--ios-bg-elevated)',
                border: '1px solid var(--ios-border)',
              }}
            >
              Collection Completeness
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {COVERAGE_DOMAINS.map((domain, idx) => (
              <div
                key={domain.domain}
                className="p-4 rounded-lg"
                style={{
                  background: 'var(--ios-bg-secondary)',
                  border: '1px solid var(--ios-border)',
                }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    {domain.domain}
                  </span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: domain.color }}>
                    {domain.completeness}%
                  </span>
                </div>
                {/* Progress bar */}
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: 'var(--ios-bg-elevated)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${domain.completeness}%`,
                      background: `linear-gradient(90deg, ${domain.color}, ${domain.color}CC)`,
                      boxShadow: `0 0 8px ${domain.color}40`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px]" style={{ color: 'var(--ios-text-secondary)' }}>
                    {domain.completeness >= 85
                      ? 'Well covered'
                      : domain.completeness >= 70
                        ? 'Gaps detected'
                        : 'Needs attention'}
                  </span>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background:
                            i < Math.round(domain.completeness / 20)
                              ? domain.color
                              : 'var(--ios-bg-elevated)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </PageTransition>
  );
}
