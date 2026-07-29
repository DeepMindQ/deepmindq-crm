'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════
   Progressive Disclosure — L1 → L2 → L3 → L4
   
   L1 Decision: "What? Why now?" (headline + confidence)
   L2 Reasoning: "Why do we think this?" (evidence chain)
   L3 Evidence:  "What proves it?" (sources, URLs, data)
   L4 Exploration: "What else?" (related signals, history)
   
   Reusable across all intelligence surfaces.
   No fake intelligence — only shows what the system knows.
   ═══════════════════════════════════════════════════ */

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
  const color = value >= 80 ? '#059669' : value >= 60 ? '#f59e0b' : '#ef4444';
  const bgColor = value >= 80 ? 'rgba(5,150,105,0.1)' : value >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#f3f4f6" strokeWidth={3}
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
  const colors = {
    high: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', dot: '#ef4444' },
    medium: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', dot: '#f59e0b' },
    low: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', dot: '#3b82f6' },
    default: { bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6', dot: '#8b5cf6' },
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
  const hasL3 = evidence.length > 0;
  const hasL4 = Boolean(relatedSignals?.length || relatedActions?.length);

  return (
    <div className="border border-gray-100 rounded-xl bg-white overflow-hidden transition-all duration-200 hover:border-gray-200 hover:shadow-sm">
      {/* L1 — Decision Layer (always visible) */}
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <ConfidenceRing value={confidence} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {badge && <BadgeDot variant={badge.variant} />}
              <span className="badge-text">{badge?.label}</span>
              {confidenceLabel && (
                <span className="text-[10px] font-medium text-muted-foreground ml-auto">
                  {confidenceLabel}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-snug">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {timestamp && (
                <span className="text-[10px] text-muted-foreground/60">{timestamp}</span>
              )}
              {onAction && actionLabel && (
                <button
                  onClick={onAction}
                  className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
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
          <div className="flex items-center gap-1 border-t border-gray-50 pt-2">
            {hasL2 && (
              <button
                onClick={() => toggleLevel(2)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors',
                  expandedLevel >= 2
                    ? 'bg-primary/8 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                )}
              >
                {expandedLevel >= 2 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                Reasoning
              </button>
            )}
            {hasL3 && (
              <button
                onClick={() => toggleLevel(3)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors',
                  expandedLevel >= 3
                    ? 'bg-primary/8 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                )}
              >
                {expandedLevel >= 3 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                Evidence ({evidence.length})
              </button>
            )}
            {hasL4 && (
              <button
                onClick={() => toggleLevel(4)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors',
                  expandedLevel >= 4
                    ? 'bg-primary/8 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                )}
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Why we think this
              </p>
              {loading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Analyzing...</span>
                </div>
              ) : (
                <>
                  {reasoning && (
                    <p className="text-xs text-foreground leading-relaxed">{reasoning}</p>
                  )}
                  {reasoningItems && reasoningItems.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {reasoningItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                          <span className="w-1 h-1 rounded-full bg-primary/40 mt-1.5 shrink-0" />
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 border-t border-gray-50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Evidence
              </p>
              {impactStatement && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50/80 border border-amber-100">
                  <p className="text-xs text-amber-800 font-medium">{impactStatement}</p>
                </div>
              )}
              <div className="space-y-2">
                {evidence.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 group">
                    <span className="text-[10px] font-bold text-muted-foreground/40 mt-0.5 shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-relaxed">{ev.snippet}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{ev.source}</span>
                        {ev.date && (
                          <span className="text-[10px] text-muted-foreground/60">{ev.date}</span>
                        )}
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 transition-colors"
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Related Intelligence
              </p>
              <div className="space-y-2">
                {relatedSignals?.map((sig, i) => (
                  <div key={`sig-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{sig.title}</p>
                      <p className="text-[10px] text-muted-foreground">{sig.type}{sig.date ? ` · ${sig.date}` : ''}</p>
                    </div>
                  </div>
                ))}
                {relatedActions?.map((act, i) => (
                  <div key={`act-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-100">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      act.priority === 'high' ? 'bg-red-400' : act.priority === 'medium' ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{act.title}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{act.priority} priority</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom children slot for additional layers */}
      {children}
    </div>
  );
}
