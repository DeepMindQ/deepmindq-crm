'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import {
  Zap,
  Brain,
  FlaskConical,
  BarChart3,
  MessageSquare,
  Shield,
  Clock,
  Power,
  PowerOff,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──
interface Capability {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'disabled' | 'experimental';
  usageCount: number;
  lastUsed: string;
  model: string;
  icon: typeof Zap;
}

// ── Mock Data ──
const MOCK_CAPABILITIES: Capability[] = [
  { id: 'c1', name: 'Lead Scoring', description: 'AI-powered lead scoring based on firmographic, behavioral, and intent signals.', status: 'active', usageCount: 12847, lastUsed: '2 min ago', model: 'GPT-4o', icon: Target },
  { id: 'c2', name: 'Email Generation', description: 'Generate personalized outreach emails using context-aware AI templates.', status: 'active', usageCount: 8932, lastUsed: '5 min ago', model: 'Claude 3.5', icon: MessageSquare },
  { id: 'c3', name: 'Competitive Intelligence', description: 'Analyze competitor movements, positioning, and market strategies in real-time.', status: 'active', usageCount: 3456, lastUsed: '1 hour ago', model: 'GPT-4o', icon: Shield },
  { id: 'c4', name: 'Conversation Planning', description: 'AI-driven conversation strategy with context-aware talking points.', status: 'experimental', usageCount: 892, lastUsed: '3 hours ago', model: 'Claude 3.5', icon: Brain },
  { id: 'c5', name: 'Revenue Forecasting', description: 'Predictive revenue models using pipeline analysis and historical trends.', status: 'disabled', usageCount: 0, lastUsed: '2 weeks ago', model: 'GPT-4o', icon: BarChart3 },
  { id: 'c6', name: 'Signal Processing', description: 'Process and categorize intelligence signals from web, social, and news sources.', status: 'active', usageCount: 45621, lastUsed: 'Just now', model: 'Custom NLP', icon: FlaskConical },
];

const STATUS_CONFIG: Record<Capability['status'], { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#16A34A', bg: '#DCFCE7' },
  disabled: { label: 'Disabled', color: '#6B7280', bg: '#F3F4F6' },
  experimental: { label: 'Experimental', color: '#7C3AED', bg: '#EDE9FE' },
};

// ── Component ──
export default function Capability() {
  const [capabilities, setCapabilities] = useState(MOCK_CAPABILITIES);
  const [loading] = useState(false);

  const handleToggle = useCallback((id: string) => {
    setCapabilities((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const newStatus = c.status === 'disabled' ? 'active' : 'disabled';
        toast.success(`${c.name} ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
        return { ...c, status: newStatus as Capability['status'] };
      })
    );
  }, []);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  if (loading) {
    return (
      <div className="p-6 space-y-6" style={{ background: '#0a0e17', minHeight: '100%' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl animate-pulse" style={{ background: border }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#0a0e17', minHeight: '100%' }}>
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: textPrimary }}>AI Capabilities</h1>
        <p className="text-sm mt-1" style={{ color: textSecondary }}>Registry of AI-powered capabilities and their status</p>
      </div>

      {/* ── Capability Cards Grid ── */}
      {capabilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Zap className="h-10 w-10 mb-3" style={{ color: textMuted }} />
          <p className="text-sm font-medium" style={{ color: textSecondary }}>No capabilities configured</p>
          <p className="text-xs mt-1" style={{ color: textMuted }}>Add AI capabilities to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((cap) => {
            const statusCfg = STATUS_CONFIG[cap.status];
            const Icon = cap.icon;
            const isActive = cap.status === 'active';
            return (
              <div
                key={cap.id}
                className="rounded-xl p-5 flex flex-col gap-4 transition-colors"
                style={{
                  background: bg,
                  border: `1px solid ${border}`,
                  boxShadow: elevation.sm,
                  opacity: cap.status === 'disabled' ? 0.6 : 1,
                }}
              >
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${isActive ? tokens.accent.primary : '#6B7280'}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: isActive ? tokens.accent.primary : '#6B7280' }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>{cap.name}</h3>
                      <p className="text-xs" style={{ color: textMuted }}>{cap.model}</p>
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: statusCfg.bg, color: statusCfg.color }}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs leading-relaxed" style={{ color: textSecondary }}>{cap.description}</p>

                {/* Footer: usage + toggle */}
                <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: `1px solid ${border}` }}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3" style={{ color: textMuted }} />
                      <span className="text-xs" style={{ color: textSecondary }}>
                        {cap.usageCount.toLocaleString()} uses
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" style={{ color: textMuted }} />
                      <span className="text-xs" style={{ color: textSecondary }}>{cap.lastUsed}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(cap.id)}
                    className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                    style={{
                      background: isActive ? '#DCFCE7' : '#F3F4F6',
                      color: isActive ? '#16A34A' : '#6B7280',
                    }}
                    title={isActive ? 'Disable' : 'Enable'}
                  >
                    {isActive ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
