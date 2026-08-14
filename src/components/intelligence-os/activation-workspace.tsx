'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
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
  Zap,
  CheckCircle2,
  BarChart3,
  Timer,
  Play,
  Pause,
  RotateCcw,
  MoreHorizontal,
  TrendingUp,
  Signal,
  Monitor,
  Globe,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

/* ── Mock Data ── */

const QUEUE_DATA = [
  {
    id: 1,
    company: 'Stripe Inc.',
    domain: 'stripe.com',
    industry: 'Fintech',
    status: 'Active' as const,
    progress: 78,
  },
  {
    id: 2,
    company: 'Notion Labs',
    domain: 'notion.so',
    industry: 'Productivity',
    status: 'Active' as const,
    progress: 62,
  },
  {
    id: 3,
    company: 'Linear App',
    domain: 'linear.app',
    industry: 'Developer Tools',
    status: 'Completed' as const,
    progress: 100,
  },
  {
    id: 4,
    company: 'Vercel Inc.',
    domain: 'vercel.com',
    industry: 'Cloud Infra',
    status: 'Pending' as const,
    progress: 0,
  },
  {
    id: 5,
    company: 'Supabase',
    domain: 'supabase.com',
    industry: 'Database',
    status: 'Active' as const,
    progress: 45,
  },
  {
    id: 6,
    company: 'Resend Inc.',
    domain: 'resend.com',
    industry: 'Email API',
    status: 'Failed' as const,
    progress: 23,
  },
  {
    id: 7,
    company: 'Clerk Auth',
    domain: 'clerk.com',
    industry: 'Identity',
    status: 'Completed' as const,
    progress: 100,
  },
  {
    id: 8,
    company: 'PostHog',
    domain: 'posthog.com',
    industry: 'Analytics',
    status: 'Pending' as const,
    progress: 0,
  },
  {
    id: 9,
    company: 'Cal.com',
    domain: 'cal.com',
    industry: 'Scheduling',
    status: 'Active' as const,
    progress: 91,
  },
  {
    id: 10,
    company: 'Descript',
    domain: 'descript.com',
    industry: 'Media AI',
    status: 'Pending' as const,
    progress: 0,
  },
];

const RULES_DATA = [
  {
    id: 'funding',
    name: 'Funding Signals',
    description:
      'Monitor funding rounds, investor activity, and financial health indicators for target accounts.',
    icon: TrendingUp,
    enabled: true,
    color: '#10B981',
  },
  {
    id: 'hiring',
    name: 'Hiring Intelligence',
    description:
      'Track key hires, team growth patterns, and role changes that indicate strategic direction.',
    icon: Signal,
    enabled: true,
    color: '#3B82F6',
  },
  {
    id: 'tech',
    name: 'Tech Stack Monitoring',
    description:
      'Detect technology adoption, deprecation, and migration patterns across engineering teams.',
    icon: Monitor,
    enabled: false,
    color: '#8B5CF6',
  },
  {
    id: 'market',
    name: 'Market Expansion',
    description:
      'Identify geographic expansion signals, new office openings, and market entry strategies.',
    icon: Globe,
    color: '#06B6D4',
    enabled: true,
  },
];

const TIMELINE_DATA = [
  { time: '2 min ago', company: 'Linear App', action: 'completed full intelligence activation' },
  { time: '8 min ago', company: 'Clerk Auth', action: 'completed full intelligence activation' },
  { time: '15 min ago', company: 'Stripe Inc.', action: 'signal detection pipeline active (78%)' },
  { time: '23 min ago', company: 'Cal.com', action: 'hiring intelligence module enabled' },
  { time: '31 min ago', company: 'Notion Labs', action: 'tech stack scan in progress (62%)' },
  { time: '45 min ago', company: 'Resend Inc.', action: 'activation failed — rate limit exceeded' },
];

/* ── Status Badge ── */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; dot: string }> = {
    Pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', dot: '#F59E0B' },
    Active: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', dot: '#3B82F6' },
    Completed: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', dot: '#10B981' },
    Failed: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', dot: '#EF4444' },
  };
  const c = config[status] || config.Pending;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: c.color, background: c.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {status}
    </span>
  );
}

/* ── Main Component ── */

export function ActivationWorkspace() {
  const [rules, setRules] = useState(RULES_DATA.map((r) => ({ ...r })));

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  return (
    <PageTransition className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--ios-text-primary)' }}
          >
            Activation Workspace
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ios-text-secondary)' }}>
            Configure &amp; activate intelligence gathering for target accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PulseDot color="#3B82F6" />
          <span className="text-xs font-medium" style={{ color: '#3B82F6' }}>
            89 active scans running
          </span>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Accounts Queued" value={156} icon={Timer} color="#F59E0B" />
        <StatCard label="Active Scannings" value={89} icon={Zap} color="#3B82F6" />
        <StatCard label="Completed" value={1247} icon={CheckCircle2} color="#10B981" />
        <StatCard label="Success Rate" value="96.3%" icon={BarChart3} color="#8B5CF6" />
      </div>

      {/* ── Main 2-Column Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Activation Queue Table */}
        <div className="xl:col-span-2">
          <GlassPanel className="p-0 overflow-hidden">
            <div
              className="px-5 py-4 flex items-center justify-between border-b"
              style={{ borderBottomColor: 'var(--ios-border)' }}
            >
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
                  Activation Queue
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ios-text-secondary)' }}>
                  10 accounts in current batch
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.1)' }}
                >
                  <Play className="w-3 h-3" />
                  Activate All
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{
                      color: 'var(--ios-text-secondary)',
                      background: 'var(--ios-bg-secondary)',
                    }}
                  >
                    <th className="px-5 py-3">Company</th>
                    <th className="px-5 py-3">Industry</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Progress</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {QUEUE_DATA.map((row, i) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.35 }}
                      className="border-t transition-colors hover:bg-[var(--ios-bg-elevated)]"
                      style={{ borderTopColor: 'var(--ios-border)' }}
                    >
                      <td className="px-5 py-3">
                        <div>
                          <p
                            className="text-sm font-medium"
                            style={{ color: 'var(--ios-text-primary)' }}
                          >
                            {row.company}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                            {row.domain}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded-md"
                          style={{
                            color: 'var(--ios-text-secondary)',
                            background: 'var(--ios-bg-elevated)',
                          }}
                        >
                          {row.industry}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex-1 h-1.5 rounded-full"
                            style={{ background: 'var(--ios-bg-elevated)' }}
                          >
                            <motion.div
                              className="h-full rounded-full"
                              style={{
                                background:
                                  row.status === 'Completed'
                                    ? '#10B981'
                                    : row.status === 'Failed'
                                      ? '#EF4444'
                                      : '#3B82F6',
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${row.progress}%` }}
                              transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                            />
                          </div>
                          <span
                            className="text-xs tabular-nums w-8 text-right"
                            style={{ color: 'var(--ios-text-secondary)' }}
                          >
                            {row.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {row.status === 'Pending' && (
                            <button
                              className="p-1.5 rounded-md transition-colors hover:bg-[var(--ios-bg-elevated)]"
                              style={{ color: '#10B981' }}
                              title="Start activation"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {row.status === 'Active' && (
                            <button
                              className="p-1.5 rounded-md transition-colors hover:bg-[var(--ios-bg-elevated)]"
                              style={{ color: '#F59E0B' }}
                              title="Pause"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {row.status === 'Failed' && (
                            <button
                              className="p-1.5 rounded-md transition-colors hover:bg-[var(--ios-bg-elevated)]"
                              style={{ color: '#3B82F6' }}
                              title="Retry"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            className="p-1.5 rounded-md transition-colors hover:bg-[var(--ios-bg-elevated)]"
                            style={{ color: 'var(--ios-text-secondary)' }}
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        </div>

        {/* Right: Activation Rules Panel */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
            Activation Rules
          </h2>
          <StaggerGrid className="space-y-3" stagger={0.08}>
            {rules.map((rule) => {
              const Icon = rule.icon;
              return (
                <StaggerItem key={rule.id}>
                  <AnimatedCard delay={0} className="p-4" glow={`${rule.color}20`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${rule.color}15` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: rule.color }} />
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-sm font-semibold"
                            style={{ color: 'var(--ios-text-primary)' }}
                          >
                            {rule.name}
                          </p>
                          <p
                            className="text-xs mt-1 leading-relaxed"
                            style={{ color: 'var(--ios-text-secondary)' }}
                          >
                            {rule.description}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className="shrink-0 mt-0.5"
                        aria-label={`Toggle ${rule.name}`}
                      >
                        {rule.enabled ? (
                          <ToggleRight className="w-7 h-7" style={{ color: rule.color }} />
                        ) : (
                          <ToggleLeft
                            className="w-7 h-7"
                            style={{ color: 'var(--ios-text-secondary)' }}
                          />
                        )}
                      </button>
                    </div>
                  </AnimatedCard>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </div>
      </div>

      {/* ── Bottom: Activation Timeline ── */}
      <GlassPanel className="p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ios-text-primary)' }}>
          Recent Activations
        </h2>
        <div className="space-y-0">
          {TIMELINE_DATA.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.06, duration: 0.35 }}
              className="flex items-center gap-4 py-2.5"
              style={{
                borderBottom: i < TIMELINE_DATA.length - 1 ? '1px solid var(--ios-border)' : 'none',
              }}
            >
              <span
                className="text-xs tabular-nums w-20 shrink-0"
                style={{ color: 'var(--ios-text-secondary)' }}
              >
                {item.time}
              </span>
              <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--ios-border)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--ios-text-primary)' }}>
                {item.company}
              </span>
              <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                {item.action}
              </span>
            </motion.div>
          ))}
        </div>
      </GlassPanel>
    </PageTransition>
  );
}
