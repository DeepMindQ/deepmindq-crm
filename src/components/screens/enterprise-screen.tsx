'use client';

import { useState } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import {
  Users,
  Activity,
  Zap,
  Clock,
  Database,
  Server,
  Brain,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Settings,
  Shield,
  BarChart3,
} from 'lucide-react';

// ── Types ──
interface ActivityItem {
  id: string;
  action: string;
  user: string;
  time: string;
  type: 'info' | 'warning' | 'success' | 'error';
}

interface SystemStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: string;
  icon: typeof Database;
}

// ── Mock Data ──
const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: 'a1',
    action: 'Deployed v2.4.1 to production',
    user: 'CI/CD Pipeline',
    time: '2 min ago',
    type: 'success',
  },
  {
    id: 'a2',
    action: 'AI provider rate limit hit (OpenAI)',
    user: 'System',
    time: '8 min ago',
    type: 'warning',
  },
  {
    id: 'a3',
    action: 'New user onboarded: Acme Corp (12 seats)',
    user: 'Sarah Chen',
    time: '15 min ago',
    type: 'info',
  },
  {
    id: 'a4',
    action: 'Database backup completed successfully',
    user: 'System',
    time: '32 min ago',
    type: 'success',
  },
  {
    id: 'a5',
    action: 'Email delivery failure rate > 5%',
    user: 'System',
    time: '45 min ago',
    type: 'error',
  },
  {
    id: 'a6',
    action: 'Import job completed: 1,247 records',
    user: 'James Wilson',
    time: '1 hour ago',
    type: 'success',
  },
  {
    id: 'a7',
    action: 'Webhook endpoint updated for Salesforce',
    user: 'Maria Garcia',
    time: '1.5 hours ago',
    type: 'info',
  },
  {
    id: 'a8',
    action: 'Memory usage exceeded 80% threshold',
    user: 'System',
    time: '2 hours ago',
    type: 'warning',
  },
  {
    id: 'a9',
    action: 'SSO configuration updated for Okta',
    user: 'David Kim',
    time: '3 hours ago',
    type: 'info',
  },
  {
    id: 'a10',
    action: 'AI model switched to Claude 3.5',
    user: 'Admin',
    time: '4 hours ago',
    type: 'success',
  },
];

const SYSTEM_STATUSES: SystemStatus[] = [
  { name: 'Database', status: 'healthy', latency: '12ms', icon: Database },
  { name: 'Redis Cache', status: 'healthy', latency: '2ms', icon: Server },
  { name: 'AI Providers', status: 'degraded', latency: '340ms', icon: Brain },
  { name: 'Email Service', status: 'healthy', latency: '89ms', icon: Mail },
];

const STATUS_COLORS = {
  healthy: { color: '#16A34A', bg: '#DCFCE7', label: 'Healthy' },
  degraded: { color: '#D97706', bg: '#FEF3C7', label: 'Degraded' },
  down: { color: '#DC2626', bg: '#FEE2E2', label: 'Down' },
};

const ACTIVITY_ICONS = {
  info: ArrowRight,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: AlertTriangle,
};

const ACTIVITY_COLORS = {
  info: tokens.accent.primary,
  warning: '#D97706',
  success: '#16A34A',
  error: '#DC2626',
};

// ── Component ──
export default function Enterprise() {
  const [loading] = useState(false);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  if (loading) {
    return (
      <div
        className="p-6 space-y-6"
        style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: border }} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-72 rounded-xl animate-pulse" style={{ background: border }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-6 space-y-6"
      style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
    >
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
          Enterprise Overview
        </h1>
        <p className="text-sm mt-1" style={{ color: textSecondary }}>
          System health, activity, and admin quick access
        </p>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: '2,847', icon: Users, color: tokens.accent.primary },
          { label: 'Active Sessions', value: '384', icon: Activity, color: '#16A34A' },
          { label: 'API Calls Today', value: '1.2M', icon: Zap, color: '#D97706' },
          { label: 'Uptime', value: '99.97%', icon: Clock, color: '#7C3AED' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${stat.color}15` }}
              >
                <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs truncate" style={{ color: textMuted }}>
                  {stat.label}
                </p>
                <p className="text-lg font-bold" style={{ color: textPrimary }}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── System Status ── */}
        <div
          className="lg:col-span-1 rounded-xl p-5"
          style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
            System Status
          </h3>
          <div className="space-y-3">
            {SYSTEM_STATUSES.map((sys) => {
              const cfg = STATUS_COLORS[sys.status];
              const Icon = sys.icon;
              return (
                <div
                  key={sys.name}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: tokens.surface.secondary }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${cfg.color}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: textPrimary }}>
                        {sys.name}
                      </p>
                      <p className="text-xs" style={{ color: textMuted }}>
                        {sys.latency}
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick Links */}
          <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${border}` }}>
            <h4 className="text-xs font-semibold mb-3" style={{ color: textSecondary }}>
              Quick Links
            </h4>
            <div className="space-y-2">
              {[
                { label: 'User Management', icon: Users, color: tokens.accent.primary },
                { label: 'System Settings', icon: Settings, color: '#7C3AED' },
                { label: 'Security & Audit', icon: Shield, color: '#D97706' },
                { label: 'Analytics', icon: BarChart3, color: '#059669' },
              ].map((link) => (
                <button
                  key={link.label}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors hover:opacity-80"
                  style={{ background: tokens.surface.secondary }}
                >
                  <link.icon className="w-4 h-4" style={{ color: link.color }} />
                  <span className="text-xs font-medium" style={{ color: textPrimary }}>
                    {link.label}
                  </span>
                  <ArrowRight className="w-3 h-3 ml-auto" style={{ color: textMuted }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Activity Feed ── */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
            Activity Feed
          </h3>
          <div className="space-y-0 max-h-[420px] overflow-y-auto">
            {MOCK_ACTIVITY.map((item, idx) => {
              const Icon = ACTIVITY_ICONS[item.type];
              const color = ACTIVITY_COLORS[item.type];
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 py-3"
                  style={{
                    borderBottom: idx < MOCK_ACTIVITY.length - 1 ? `1px solid ${border}` : 'none',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${color}15` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs" style={{ color: textPrimary }}>
                      {item.action}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: textMuted }}>
                        {item.user}
                      </span>
                      <span className="text-xs" style={{ color: textMuted }}>
                        ·
                      </span>
                      <span className="text-xs" style={{ color: textMuted }}>
                        {item.time}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
