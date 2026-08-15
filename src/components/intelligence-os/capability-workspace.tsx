'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';
import {
  PageTransition,
  StatCard,
  StaggerGrid,
  StaggerItem,
  AnimatedCard,
  GlassPanel,
} from '@/components/ui/animated-components';

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

/* ── Types ── */

interface CapabilityCard {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Beta' | 'Inactive';
  accuracy: number;
  iconName: string;
  color: string;
  version: string;
  lastTrained: string;
}

interface CapabilitiesApiResponse {
  data?: CapabilityCard[];
  stats?: {
    avgAccuracy: number;
    avgLatency: string;
    totalRules: number;
  };
}

const ICON_MAP: Record<string, typeof Target> = {
  Target,
  Brain,
  TrendingUp,
  Activity,
  ShieldAlert,
  MessageSquareText,
};

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
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilityCard[]>([]);
  const [aiHealth, setAiHealth] = useState<{
    providers?: { count: number };
    status?: string;
  } | null>(null);
  const [avgAccuracy, setAvgAccuracy] = useState<number | null>(null);
  const [avgLatency, setAvgLatency] = useState<string | null>(null);
  const [totalRules, setTotalRules] = useState<number | null>(null);

  const fetchAllData = useCallback(async () => {
    let cancelled = false;
    try {
      setLoading(true);
      setError(null);

      const [capsRes, healthRes] = await Promise.all([
        fetchApi<CapabilitiesApiResponse>('/api/capabilities'),
        fetchApi('/api/health/ai'),
      ]);

      if (cancelled) return;

      // Process capabilities
      if (!capsRes.error && capsRes.data) {
        const payload = capsRes.data as CapabilitiesApiResponse;
        if (payload.data?.length) {
          setCapabilities(payload.data);
        }
        if (payload.stats) {
          setAvgAccuracy(payload.stats.avgAccuracy);
          setAvgLatency(payload.stats.avgLatency);
          setTotalRules(payload.stats.totalRules);
        }
      }

      // Process AI health
      if (!healthRes.error && healthRes.data) {
        setAiHealth(healthRes.data as { providers?: { count: number }; status?: string });
      }
    } catch (err) {
      if (!cancelled)
        setError(err instanceof Error ? err.message : 'Failed to load capability data');
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const providerCount = aiHealth?.providers?.count ?? capabilities.length;
  const _aiStatus = aiHealth?.status ?? 'healthy';

  // Compute stats from API data
  const computedAvgAccuracy =
    avgAccuracy ??
    (capabilities.length > 0
      ? Math.round(
          (capabilities.reduce((sum, c) => sum + c.accuracy, 0) / capabilities.length) * 10,
        ) / 10
      : 0);
  const computedLatency = avgLatency ?? (computedAvgAccuracy > 90 ? '1.2s' : '2.4s');
  const computedRules = totalRules ?? 0;

  const handleCardClick = (cap: CapabilityCard) => {
    toast.info(`${cap.name} (${cap.status})`, {
      description: `Accuracy: ${cap.accuracy}% | Version: ${cap.version} | Last trained: ${cap.lastTrained}`,
      duration: 4000,
    });
  };

  return (
    <div role="region" aria-label="AI Capabilities">
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
          <div aria-label={`Active Capabilities: ${providerCount}`}>
            <StatCard
              label="Active Capabilities"
              value={providerCount}
              icon={Cpu}
              color="#3B82F6"
            />
          </div>
          <div aria-label={`Model Accuracy: ${computedAvgAccuracy}%`}>
            <StatCard
              label="Model Accuracy"
              value={`${computedAvgAccuracy}%`}
              icon={BarChart3}
              color="#10B981"
            />
          </div>
          <div aria-label={`Processing Speed: ${computedLatency}`}>
            <StatCard label="Processing Speed" value={computedLatency} icon={Zap} color="#F59E0B" />
          </div>
          <div aria-label={`Custom Rules: ${computedRules}`}>
            <StatCard label="Custom Rules" value={computedRules} icon={Settings2} color="#8B5CF6" />
          </div>
        </div>

        {/* ── Capabilities Grid ── */}
        {capabilities.length > 0 ? (
          <StaggerGrid
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            stagger={0.08}
          >
            {capabilities.map((cap) => {
              const Icon = ICON_MAP[cap.iconName] ?? Cpu;
              return (
                <StaggerItem key={cap.id}>
                  <div
                    className="p-5 flex flex-col h-full cursor-pointer rounded-xl"
                    style={{
                      background: 'rgba(30, 36, 51, 0.8)',
                      border: '1px solid rgba(30, 37, 53, 1)',
                    }}
                    onClick={() => handleCardClick(cap)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${cap.name}, accuracy ${cap.accuracy}%`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(cap);
                      }
                    }}
                  >
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
                        <span
                          className="text-[11px]"
                          style={{ color: 'var(--ios-text-secondary)' }}
                        >
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(cap);
                        }}
                      >
                        <Settings2 className="w-3 h-3" />
                        Configure
                      </button>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        ) : (
          !loading && (
            <GlassPanel className="p-12">
              <div className="flex flex-col items-center justify-center">
                <Cpu
                  className="w-12 h-12 mb-4"
                  style={{ color: 'var(--ios-text-secondary)', opacity: 0.3 }}
                />
                <p className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                  No capabilities configured
                </p>
              </div>
            </GlassPanel>
          )
        )}
      </PageTransition>
    </div>
  );
}
