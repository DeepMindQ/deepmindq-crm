'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Globe, FileText, Database, Shield, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens } from './design-tokens';

/* ═══════════════════════════════════════════════════
   EvidenceChain — Visual Evidence Trail
   
   Displays the chain of evidence supporting an intelligence
   conclusion. Makes the AI reasoning transparent and
   auditable — building trust through visibility.
   
   Principles:
   - Confidence & Trust: Evidence is always accessible
   - Zero Dead Ends: Every source can be traced
   - Consistent Intelligence Language
   ═══════════════════════════════════════════════════ */

export interface EvidenceChainItem {
  source: string;
  sourceType?: 'news' | 'filing' | 'web' | 'database' | 'social' | 'internal' | 'sec' | 'press';
  snippet: string;
  url?: string;
  date?: string;
  relevanceScore?: number; // 0-100
}

export interface EvidenceChainProps {
  items: EvidenceChainItem[];
  title?: string;
  conclusion?: string;
  verdict?: 'strong' | 'moderate' | 'weak';
  compact?: boolean;
  className?: string;
}

function getSourceIcon(type?: string) {
  const map: Record<string, typeof Globe> = {
    news: FileText, filing: FileText, web: Globe, database: Database,
    social: Globe, internal: Shield, sec: FileText, press: FileText,
  };
  return type ? (map[type] || FileText) : FileText;
}

function getVerdictConfig(verdict?: string) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    strong:   { label: 'Strong Evidence',   color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)',   border: 'rgba(16, 185, 129, 0.2)' },
    moderate: { label: 'Moderate Evidence', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)',  border: 'rgba(245, 158, 11, 0.2)' },
    weak:     { label: 'Weak Evidence',     color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)',    border: 'rgba(239, 68, 68, 0.2)' },
  };
  return verdict ? map[verdict] : null;
}

export function EvidenceChain({
  items,
  title = 'Evidence Chain',
  conclusion,
  verdict,
  compact = false,
  className,
}: EvidenceChainProps) {
  const verdictConfig = getVerdictConfig(verdict);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn('rounded-xl border overflow-hidden', className)}
      style={{
        background: tokens.surface.card,
        borderColor: tokens.border.default,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" style={{ color: tokens.accent.DEFAULT }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tokens.text.muted }}>
            {title}
          </span>
        </div>
        {verdictConfig && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: verdictConfig.bg, color: verdictConfig.color, border: `1px solid ${verdictConfig.border}` }}
          >
            {verdictConfig.label}
          </span>
        )}
      </div>

      {/* Evidence items */}
      <div className="divide-y" style={{ borderColor: tokens.border.subtle }}>
        {items.map((item, i) => {
          const Icon = getSourceIcon(item.sourceType);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex items-start gap-3 px-4 py-3 group/item hover:bg-white/[0.02] transition-colors"
            >
              {/* Step number + connector line */}
              <div className="flex flex-col items-center shrink-0 pt-0.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums"
                  style={{ background: tokens.accent.subtle, color: tokens.accent.bright }}
                >
                  {i + 1}
                </div>
                {i < items.length - 1 && (
                  <div className="w-px flex-1 mt-1" style={{ background: tokens.border.subtle, minHeight: '16px' }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-relaxed" style={{ color: tokens.text.primary }}>
                  {item.snippet}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: tokens.text.secondary }}>
                    <Icon className="w-2.5 h-2.5" />
                    {item.source}
                  </span>
                  {item.date && (
                    <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: tokens.text.muted }}>
                      <Clock className="w-2.5 h-2.5" />
                      {item.date}
                    </span>
                  )}
                  {item.relevanceScore !== undefined && (
                    <span className="text-[10px] font-semibold tabular-nums" style={{ color: tokens.confidence[item.relevanceScore >= 70 ? 'high' : item.relevanceScore >= 45 ? 'medium' : 'low'].value }}>
                      {item.relevanceScore}% relevant
                    </span>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[10px] font-medium opacity-0 group-hover/item:opacity-100 transition-opacity"
                      style={{ color: tokens.accent.bright }}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      Verify
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Conclusion */}
      {conclusion && (
        <div
          className="px-4 py-3"
          style={{ borderTop: `1px solid ${tokens.border.subtle}`, background: tokens.accent.ghost }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: tokens.text.muted }}>
            Conclusion
          </p>
          <p className="text-xs font-medium leading-relaxed" style={{ color: tokens.text.primary }}>
            {conclusion}
          </p>
        </div>
      )}
    </motion.div>
  );
}
