'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, motion as motionTokens } from './design-tokens';
import { EvidenceLayer } from './layers/evidence-layer';
import { ExplorationLayer } from './layers/exploration-layer';
import type {
  EvidenceChainItem as MS8EvidenceItem,
  EvidenceLayerData,
  ExplorationLayerData,
  EvidenceFootprint as EvidenceFootprintType,
  VerificationStatus,
} from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg } from '@/lib/intelligence-types';
import type { TrustTier } from '@/types/ms8-evidence';

/* ═══════════════════════════════════════════════════
   Progressive Disclosure — L1 → L2 → L3 → L4
   
   L1 Decision: "What? Why now?" (headline + confidence)
   L2 Reasoning: "Why do we think this?" (evidence chain)
   L3 Evidence:  "What proves it?" (sources, URLs, data)
   L4 Exploration: "What else?" (related signals, history)
   
   MS8 Integration: L3 and L4 now use EvidenceLayer and
   ExplorationLayer components from layers/ directory.
   
   Reusable across all intelligence surfaces.
   No fake intelligence — only shows what the system knows.
   
   All tokens from design-tokens.ts. No hardcoded colors.
   ═══════════════════════════════════════ */

export interface EvidenceItem {
  source: string;
  url?: string;
  snippet: string;
  date?: string;
}

export interface ProgressiveDisclosureProps {
  /* L1 — Decision Layer */
  title: string;
  subtitle?: string;
  confidence: number; // 0-100
  confidenceLabel?: string;
  badge?: { label: string; variant?: 'default' | 'high' | 'medium' | 'low' };
  timestamp?: string;

  /* L2 — Reasoning Layer */
  reasoning: string;
  reasoningItems?: string[];

  /* L3 — Evidence Layer */
  evidence: EvidenceItem[];
  impactStatement?: string;

  /* L4 — Exploration Layer (optional, only if available) */
  relatedSignals?: Array<{ title: string; type: string; date?: string }>;
  relatedActions?: Array<{ title: string; priority: 'high' | 'medium' | 'low' }>;

  /* MS8 L3/L4 enriched data (optional — supersedes legacy L3/L4 when provided) */
  evidenceLayerData?: EvidenceLayerData;
  explorationLayerData?: ExplorationLayerData;

  /* Behavior */
  defaultExpanded?: number; // Start at L1, L2, L3, or L4
  onAction?: () => void;
  actionLabel?: string;
  loading?: boolean;
  children?: ReactNode;
}

function ConfidenceRing({ value, size = 40 }: { value: number; size?: number }) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  // Use design tokens for confidence colors
  const tier = value >= 70 ? 'high' : value >= 45 ? 'medium' : 'low';
  const color = tokens.confidence[tier].value;
  const bgColor = tokens.confidence[tier].bg;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={tokens.border.subtle} strokeWidth={3}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function BadgeDot({ variant = 'default' }: { variant?: 'default' | 'high' | 'medium' | 'low' }) {
  const colors: Record<string, { bg: string; color: string; dot: string }> = {
    high:    { bg: tokens.priority.high.bg,    color: tokens.priority.high.value,    dot: tokens.priority.high.value },
    medium:  { bg: tokens.priority.medium.bg,  color: tokens.priority.medium.value,  dot: tokens.priority.medium.value },
    low:     { bg: tokens.priority.low.bg,     color: tokens.priority.low.value,     dot: tokens.priority.low.value },
    default: { bg: tokens.accent.strong,       color: tokens.domain.opportunity,      dot: tokens.domain.opportunity },
  };
  const c = colors[variant] || colors.default;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
    </span>
  );
}

export function ProgressiveDisclosure({
  title,
  subtitle,
  confidence,
  confidenceLabel,
  badge,
  timestamp,
  reasoning,
  reasoningItems,
  evidence,
  impactStatement,
  relatedSignals,
  relatedActions,
  evidenceLayerData,
  explorationLayerData,
  defaultExpanded = 1,
  onAction,
  actionLabel,
  loading = false,
  children,
}: ProgressiveDisclosureProps) {
  const [expandedLevel, setExpandedLevel] = useState(defaultExpanded);

  const toggleLevel = (level: number) => {
    setExpandedLevel(prev => prev === level ? level - 1 : level);
  };

  const hasL2 = Boolean(reasoning || reasoningItems?.length);
  const hasL3 = evidenceLayerData ? true : evidence.length > 0;
  const hasL4 = explorationLayerData ? true : Boolean(relatedSignals?.length || relatedActions?.length);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: tokens.surface.card,
        border: `1px solid ${tokens.border.default}`,
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.08)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = tokens.border.hover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = tokens.border.default;
      }}
    >
      {/* L1 — Decision Layer (always visible) */}
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <ConfidenceRing value={confidence} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {badge && <BadgeDot variant={badge.variant} />}
              <span className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>{badge?.label}</span>
              {confidenceLabel && (
                <span className="text-[10px] font-medium ml-auto" style={{ color: tokens.text.muted }}>
                  {confidenceLabel}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold leading-snug" style={{ color: tokens.text.primary }}>{title}</h3>
            {subtitle && (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: tokens.text.secondary }}>{subtitle}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {timestamp && (
                <span className="text-[10px]" style={{ color: tokens.text.muted }}>{timestamp}</span>
              )}
              {onAction && actionLabel && (
                <button
                  onClick={onAction}
                  className="text-[10px] font-semibold transition-colors duration-150"
                  style={{ color: tokens.accent.bright }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = tokens.accent.DEFAULT; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = tokens.accent.bright; }}
                >
                  {actionLabel} →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progressive Disclosure Controls */}
      {(hasL2 || hasL3 || hasL4) && (
        <div className="px-4 pb-1">
          <div
            className="flex items-center gap-1 pt-2"
            style={{ borderTop: `1px solid ${tokens.border.subtle}` }}
          >
            {hasL2 && (
              <button
                onClick={() => toggleLevel(2)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors duration-150',
                )}
                style={{
                  background: expandedLevel >= 2 ? tokens.accent.subtle : 'transparent',
                  color: expandedLevel >= 2 ? tokens.accent.bright : tokens.text.muted,
                }}
                onMouseEnter={(e) => {
                  if (expandedLevel < 2) (e.currentTarget as HTMLElement).style.background = tokens.surface.elevated;
                }}
                onMouseLeave={(e) => {
                  if (expandedLevel < 2) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {expandedLevel >= 2 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                Reasoning
              </button>
            )}
            {hasL3 && (
              <button
                onClick={() => toggleLevel(3)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors duration-150"
                style={{
                  background: expandedLevel >= 3 ? tokens.accent.subtle : 'transparent',
                  color: expandedLevel >= 3 ? tokens.accent.bright : tokens.text.muted,
                }}
                onMouseEnter={(e) => {
                  if (expandedLevel < 3) (e.currentTarget as HTMLElement).style.background = tokens.surface.elevated;
                }}
                onMouseLeave={(e) => {
                  if (expandedLevel < 3) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {expandedLevel >= 3 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                Evidence ({evidenceLayerData ? evidenceLayerData.evidence.length : evidence.length})
              </button>
            )}
            {hasL4 && (
              <button
                onClick={() => toggleLevel(4)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors duration-150"
                style={{
                  background: expandedLevel >= 4 ? tokens.accent.subtle : 'transparent',
                  color: expandedLevel >= 4 ? tokens.accent.bright : tokens.text.muted,
                }}
                onMouseEnter={(e) => {
                  if (expandedLevel < 4) (e.currentTarget as HTMLElement).style.background = tokens.surface.elevated;
                }}
                onMouseLeave={(e) => {
                  if (expandedLevel < 4) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {expandedLevel >= 4 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                Related
              </button>
            )}
          </div>
        </div>
      )}

      {/* L2 — Reasoning Layer */}
      <AnimatePresence>
        {expandedLevel >= 2 && hasL2 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: motionTokens.default.duration, ease: motionTokens.default.ease as unknown as [number, number, number, number] }}
            className="overflow-hidden"
          >
            <div
              className="px-4 py-3"
              style={{ borderTop: `1px solid ${tokens.border.subtle}`, background: tokens.surface.secondary }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.text.muted }}>
                Why we think this
              </p>
              {loading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-3 h-3 animate-spin" style={{ color: tokens.text.muted }} />
                  <span className="text-xs" style={{ color: tokens.text.muted }}>Analyzing...</span>
                </div>
              ) : (
                <>
                  {reasoning && (
                    <p className="text-xs leading-relaxed" style={{ color: tokens.text.primary }}>{reasoning}</p>
                  )}
                  {reasoningItems && reasoningItems.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {reasoningItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs" style={{ color: tokens.text.secondary }}>
                          <span
                            className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                            style={{ background: tokens.accent.DEFAULT }}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* L3 — Evidence Layer */}
      <AnimatePresence>
        {expandedLevel >= 3 && hasL3 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: motionTokens.default.duration, ease: motionTokens.default.ease as unknown as [number, number, number, number] }}
            className="overflow-hidden"
          >
            {evidenceLayerData ? (
              // MS8 enriched L3 layer
              <EvidenceLayer
                data={evidenceLayerData}
                onDeepen={() => toggleLevel(4)}
                isVisible={expandedLevel >= 3}
              />
            ) : (
              // Legacy L3 layer (backward compatible)
              <div
                className="px-4 py-3"
                style={{ borderTop: `1px solid ${tokens.border.subtle}` }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.text.muted }}>
                  Evidence
                </p>
                {impactStatement && (
                  <div
                    className="mb-3 px-3 py-2 rounded-lg"
                    style={{
                      background: tokens.trust.medium.bg,
                      border: `1px solid ${tokens.trust.medium.border}`,
                    }}
                  >
                    <p className="text-xs font-medium" style={{ color: tokens.trust.medium.value }}>{impactStatement}</p>
                  </div>
                )}
                <div className="space-y-2">
                  {evidence.map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-3 py-2 rounded-lg"
                      style={{ background: tokens.surface.elevated }}
                    >
                      <span className="text-[10px] font-bold mt-0.5 shrink-0" style={{ color: tokens.text.muted }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed" style={{ color: tokens.text.primary }}>{ev.snippet}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px]" style={{ color: tokens.text.muted }}>{ev.source}</span>
                          {ev.date && (
                            <span className="text-[10px]" style={{ color: tokens.text.muted }}>{ev.date}</span>
                          )}
                          {ev.url && (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[10px] font-medium transition-colors"
                              style={{ color: tokens.accent.bright }}
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              Source
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* L4 — Exploration Layer */}
      <AnimatePresence>
        {expandedLevel >= 4 && hasL4 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: motionTokens.default.duration, ease: motionTokens.default.ease as unknown as [number, number, number, number] }}
            className="overflow-hidden"
          >
            {explorationLayerData ? (
              // MS8 enriched L4 layer
              <ExplorationLayer
                data={explorationLayerData}
                onCollapse={() => setExpandedLevel(1)}
                isVisible={expandedLevel >= 4}
              />
            ) : (
              // Legacy L4 layer (backward compatible)
              <div
                className="px-4 py-3"
                style={{ borderTop: `1px solid ${tokens.border.subtle}`, background: tokens.surface.secondary }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.text.muted }}>
                  Related Intelligence
                </p>
                <div className="space-y-2">
                  {relatedSignals?.map((sig, i) => (
                    <div
                      key={`sig-${i}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.subtle}` }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: tokens.domain.reasoning }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: tokens.text.primary }}>{sig.title}</p>
                        <p className="text-[10px]" style={{ color: tokens.text.muted }}>{sig.type}{sig.date ? ` · ${sig.date}` : ''}</p>
                      </div>
                    </div>
                  ))}
                  {relatedActions?.map((act, i) => (
                    <div
                      key={`act-${i}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.subtle}` }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background: act.priority === 'high' ? tokens.priority.high.value
                            : act.priority === 'medium' ? tokens.priority.medium.value
                            : tokens.priority.low.value,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: tokens.text.primary }}>{act.title}</p>
                        <p className="text-[10px] capitalize" style={{ color: tokens.text.muted }}>{act.priority} priority</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom children slot for additional layers */}
      {children}
    </div>
  );
}
