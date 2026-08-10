'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
/**
 * WI-17B — Activation Status Indicator
 *
 * Shows the intelligence activation lifecycle for a company.
 * Displays as a compact badge/chip in the workspace header.
 *
 * States:
 *   🟢 activated   (5-6 steps complete)
 *   🟡 partial      (3-4 steps complete)
 *   🟠 processing   (1-2 steps complete)
 *   ⬜ pending       (0 steps complete)
 *
 * Expandable to show step-by-step detail.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, Loader2, AlertCircle, Circle,
  ChevronDown, ChevronUp, Brain, Target, Database,
  Layers, Cpu, Zap, Shield,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────

interface ActivationStep {
  step: string;
  label: string;
  status: 'completed' | 'pending' | 'unknown';
  detail: string;
}

interface ActivationStatusResponse {
  companyId: string;
  companyName: string;
  overallStatus: 'activated' | 'partial' | 'processing' | 'pending';
  activationLevel: number;
  lastEnrichedAt: string | null;
  confidence: { score: number; grade: string };
  intelligenceSummary: {
    signals: number;
    evidence: number;
    contacts: number;
    hasResearchCard: boolean;
    memories: number;
  };
  steps: ActivationStep[];
}

// ─── Config ──────────────────────────────────────────────────────────────

const STEP_ICONS: Record<string, React.ElementType> = {
  entity_resolution: Target,
  knowledge_graph: Brain,
  retrieval_indexing: Database,
  memory_creation: Layers,
  signal_extraction: Zap,
  confidence_scoring: Shield,
};

const STATUS_CONFIG = {
  activated:   { label: 'Intelligence Active', color: tokens.domain.action, bg: tokens.trust.verified.bg, border: tokens.trust.verified.border },
  partial:     { label: 'Partially Activated', color: tokens.extended.amber.value, bg: tokens.extended.amber.bg, border: tokens.extended.amber.bg },
  processing:  { label: 'Activation In Progress', color: tokens.trust.low.value, bg: tokens.trust.low.bg, border: tokens.trust.low.border },
  pending:     { label: 'Not Activated', color: tokens.neutral['500'], bg: tokens.trust.unverified.bg, border: tokens.trust.unverified.border },
};

// ─── Component ──────────────────────────────────────────────────────────

interface ActivationStatusProps {
  companyId: string;
  compact?: boolean;
  darkMode?: boolean;
}

export function ActivationStatus({ companyId, compact = false, darkMode = true }: ActivationStatusProps) {
  const [data, setData] = useState<ActivationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${companyId}/activation-status`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setError('Failed to load');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
        style={{
          background: darkMode ? 'var(--ios-bg-card, tokens.opacity.white.ghost)' : tokens.neutral['100'],
          border: `1px solid ${darkMode ? tokens.border.subtle : tokens.neutral['200']}`,
        }}>
        <Loader2 className="w-3 h-3 animate-spin" style={{ color: darkMode ? 'var(--ios-text-secondary)' : tokens.neutral['400'] }} />
        <span style={{ color: darkMode ? 'var(--ios-text-secondary)' : tokens.neutral['500'] }}>Loading status...</span>
      </div>
    );
  }

  if (error || !data) return null;

  const config = STATUS_CONFIG[data.overallStatus];
  const textColor = darkMode ? config.color : config.color;
  const bgColor = darkMode ? config.bg : config.bg;
  const borderColor = darkMode ? config.border : config.border;

  // ── Compact mode: just a badge ──
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all hover:opacity-90"
        style={{ background: bgColor, border: `1px solid ${borderColor}`, color: textColor }}
        onClick={() => setExpanded(!expanded)}>
        {data.overallStatus === 'activated' ? (
          <CheckCircle2 className="w-3 h-3" />
        ) : data.overallStatus === 'partial' ? (
          <AlertCircle className="w-3 h-3" />
        ) : (
          <Circle className="w-3 h-3" />
        )}
        {config.label}
      </div>
    );
  }

  // ── Full mode: badge + expandable step list ──
  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
        style={{ background: bgColor, border: `1px solid ${borderColor}`, color: textColor }}
        onClick={() => setExpanded(!expanded)}>
        {data.overallStatus === 'activated' ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : data.overallStatus === 'partial' ? (
          <AlertCircle className="w-3.5 h-3.5" />
        ) : data.overallStatus === 'processing' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Circle className="w-3.5 h-3.5" />
        )}
        <span>{config.label}</span>
        <span className="opacity-60 ml-1">{data.activationLevel}/6</span>
        {data.confidence.score > 0 && (
          <span className="opacity-60">
            ({data.confidence.score}<span className="text-[10px]">/{data.confidence.grade}</span>)
          </span>
        )}
        {expanded ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
      </button>

      {/* Expanded step detail */}
      {expanded && (
        <div
          className="absolute top-full left-0 mt-2 w-80 rounded-xl p-3 z-50 shadow-xl"
          style={{
            background: darkMode ? 'var(--ios-bg-elevated, #1a1a2e)' : tokens.flat.white,
            border: `1px solid ${darkMode ? tokens.border.subtle : tokens.neutral['200']}`,
          }}>
          <div className="text-xs font-bold mb-3" style={{ color: darkMode ? 'var(--ios-text-primary)' : tokens.neutral['900'] }}>
            Intelligence Activation — {data.companyName}
          </div>

          {data.steps.map((step) => {
            const StepIcon = STEP_ICONS[step.step] || Circle;
            const isCompleted = step.status === 'completed';
            const isPending = step.status === 'pending';
            const isUnknown = step.status === 'unknown';

            return (
              <div key={step.step} className="flex items-start gap-2.5 py-2">
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" style={{ color: tokens.domain.action }} />
                  ) : isUnknown ? (
                    <AlertCircle className="w-4 h-4" style={{ color: tokens.neutral['500'] }} />
                  ) : (
                    <Circle className="w-4 h-4" style={{ color: borderColor, fill: 'transparent' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: darkMode ? 'var(--ios-text-primary)' : tokens.neutral['700'] }}>
                      {step.label}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: isCompleted ? tokens.trust.verified.bg : isUnknown ? tokens.trust.unverified.bg : bgColor,
                        color: isCompleted ? tokens.domain.action : isUnknown ? tokens.neutral['500'] : config.color,
                      }}
                    >
                      {step.status}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: darkMode ? 'var(--ios-text-muted)' : tokens.neutral['500'] }}>
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Summary footer */}
          <div className="mt-3 pt-2 flex items-center justify-between text-[11px]"
            style={{ borderTop: `1px solid ${darkMode ? tokens.border.subtle : tokens.neutral['200']}` }}>
            <span style={{ color: darkMode ? 'var(--ios-text-muted)' : tokens.neutral['500'] }}>
              {data.intelligenceSummary.signals} signals · {data.intelligenceSummary.evidence} evidence · {data.intelligenceSummary.contacts} contacts
            </span>
            <button
              className="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
              style={{ color: textColor }}
              onClick={(e) => {
                e.stopPropagation();
                fetchStatus(); // Refresh
              }}>
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
