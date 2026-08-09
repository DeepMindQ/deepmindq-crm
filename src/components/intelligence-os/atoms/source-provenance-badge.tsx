'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §2 — Source Provenance Badge (Atom)
   
   Displays source attribution with category-appropriate icon,
   trust tier color, and source name. Used inside evidence items,
   briefing cards, and recommendation footprints.
   
   Color-coded dots per MS6 Phase 3 reference:
   - Green = Verified official sources
   - Purple = AI inference  
   - Blue = CRM internal data
   - Cyan = Web signals
   - Teal = High-reliability external
   ═══════════════════════════════════════════════════════════════ */

import {
  FileText, Globe, Database, Shield, Sparkles, BarChart3, ExternalLink,
  CheckCircle2, ShieldCheck, ShieldAlert, ShieldQuestion, Link2,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SourceCategory, TrustTier } from '@/types/ms8-evidence';
import { SOURCE_CATEGORY_CONFIG } from '@/types/ms8-evidence';
import { getTrustColor, getTrustBg, getTrustBorder, getTrustLabel } from '@/lib/intelligence-types';

// ─── Source Category Icons ────────────────────────────────────
const SOURCE_ICONS: Record<SourceCategory, React.ElementType> = {
  verified_official: FileText,
  verified_external: CheckCircle2,
  crm_internal: Database,
  web_signal: Globe,
  ai_inference: Sparkles,
  crm_analytics: BarChart3,
  external_database: Link2,
};

// ─── Source Category Colors (from MS6 domain tokens) ────────
const SOURCE_COLORS: Record<SourceCategory, { icon: string; bg: string; border: string }> = {
  verified_official: { icon: 'var(--success-green)', bg: 'var(--success-green-low)', border: 'var(--success-green-med)' },
  verified_external: { icon: 'var(--trust-verified)', bg: 'var(--trust-verified-bg)', border: 'var(--trust-verified-border)' },
  crm_internal:      { icon: 'var(--signal-blue)',   bg: 'var(--signal-blue-low)',   border: 'var(--signal-blue-med)' },
  web_signal:        { icon: 'var(--enrichment-cyan)',bg: 'var(--enrichment-cyan-low)',border: 'var(--enrichment-cyan-med)' },
  ai_inference:      { icon: 'var(--accent-secondary)', bg: 'var(--opportunity-purple-low)', border: 'var(--opportunity-purple-med)' },
  crm_analytics:     { icon: 'var(--warning-amber)', bg: 'var(--warning-amber-low)', border: 'var(--warning-amber-med)' },
  external_database: { icon: 'var(--signal-blue)',   bg: 'var(--signal-blue-low)',   border: 'var(--signal-blue-med)' },
};

// ─── Props ──────────────────────────────────────────────────
export interface SourceProvenanceBadgeProps {
  /** Source category for icon and color */
  category: SourceCategory;

  /** Human-readable source name (e.g., "SEC Filing", "LinkedIn") */
  sourceName?: string;

  /** Direct URL to the source */
  sourceUrl?: string;

  /** Trust tier for the evidence from this source */
  trustTier?: TrustTier;

  /** Trust score 0-100 */
  trustScore?: number;

  /** Show a colored dot (for evidence footprints) */
  showDot?: boolean;

  /** Show the source name text */
  showLabel?: boolean;

  /** Show trust tier badge */
  showTrust?: boolean;

  /** Size variant */
  size?: 'xs' | 'sm' | 'md';

  /** Additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────
export function SourceProvenanceBadge({
  category,
  sourceName,
  sourceUrl,
  trustTier,
  trustScore,
  showDot = false,
  showLabel = true,
  showTrust = false,
  size = 'sm',
  className,
}: SourceProvenanceBadgeProps) {
  const config = SOURCE_CATEGORY_CONFIG[category];
  const colors = SOURCE_COLORS[category];
  const Icon = SOURCE_ICONS[category];
  const trustColor = trustTier ? getTrustColor(trustTier) : undefined;
  const trustBgColor = trustTier ? getTrustBg(trustTier) : undefined;
  const trustBorderColor = trustTier ? getTrustBorder(trustTier) : undefined;
  const trustLabel = trustTier ? getTrustLabel(trustTier) : undefined;

  const sizeClasses = {
    xs: { dot: 'w-2 h-2', icon: 'w-3 h-3', text: 'text-[9px]', badge: 'px-1.5 py-0.5 gap-1' },
    sm: { dot: 'w-2.5 h-2.5', icon: 'w-3.5 h-3.5', text: 'text-[10px]', badge: 'px-2 py-0.5 gap-1.5' },
    md: { dot: 'w-3 h-3', icon: 'w-4 h-4', text: 'text-[11px]', badge: 'px-2.5 py-1 gap-1.5' },
  }[size];

  // Dot-only mode (for evidence footprints)
  if (showDot) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn('inline-flex rounded-full flex-shrink-0', sizeClasses.dot)}
            style={{ backgroundColor: colors.icon }}
            aria-label={config.label}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">
          <span>{sourceName || config.label}{trustTier ? ` — ${trustLabel}` : ''}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  const content = (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        sizeClasses.badge,
        className,
      )}
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.icon,
      }}
    >
      <Icon className={sizeClasses.icon} />
      {showLabel && sourceName && (
        <span className={cn('font-sans', sizeClasses.text)}>{sourceName}</span>
      )}
      {showLabel && !sourceName && (
        <span className={cn('font-sans', sizeClasses.text)}>{config.label}</span>
      )}
      {showTrust && trustTier && trustColor && trustBgColor && trustBorderColor && (
        <span
          className={cn(
            'inline-flex items-center rounded-full font-medium px-1.5 py-px',
            sizeClasses.text,
          )}
          style={{
            color: trustColor,
            backgroundColor: trustBgColor,
            border: `1px solid ${trustBorderColor}`,
          }}
        >
          {trustLabel}
        </span>
      )}
      {sourceUrl && (
        <ExternalLink className={cn('w-3 h-3 opacity-60')} />
      )}
    </span>
  );

  // Wrap in link if URL provided
  if (sourceUrl) {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
        onClick={e => e.stopPropagation()}
      >
        {content}
      </a>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {content}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[250px]">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{sourceName || config.label}</span>
          {trustTier && trustScore !== undefined && (
            <span className="opacity-80">{trustLabel} — {trustScore}%</span>
          )}
          <span className="opacity-60">Source: {config.label}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
