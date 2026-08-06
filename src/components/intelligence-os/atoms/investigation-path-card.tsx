'use client';

/* ═══════════════════════════════════════════════════════════════
   MS8 §6 — Investigation Path Card (Atom)
   
   Displays a suggested investigation path from the L4 Exploration
   layer. Shows the path title, rationale, priority badge, and
   investigation type icon.
   
   Used inside ExplorationLayer and Account Intelligence Screen.
   All tokens from design-tokens.ts. No hardcoded values.
   ═══════════════════════════════════════════════════════════════ */

import { ArrowRight, Building2, UserSearch, BarChart3, Globe, Radar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens, elevation } from '../design-tokens';
import type { InvestigationPath } from '@/types/ms8-evidence';

// ─── Investigation Type Icons ──────────────────────────────
const TYPE_ICONS: Record<InvestigationPath['type'], React.ElementType> = {
  company_research:    Building2,
  contact_discovery:   UserSearch,
  competitive_analysis: BarChart3,
  market_research:     Globe,
  signal_tracking:     Radar,
};

const TYPE_LABELS: Record<InvestigationPath['type'], string> = {
  company_research:    'Company Research',
  contact_discovery:   'Contact Discovery',
  competitive_analysis: 'Competitive Analysis',
  market_research:     'Market Research',
  signal_tracking:     'Signal Tracking',
};

// ─── Priority Helpers ───────────────────────────────────────
function getPriorityColor(priority: InvestigationPath['priority']): string {
  return tokens.priority[priority].value;
}

function getPriorityBg(priority: InvestigationPath['priority']): string {
  return tokens.priority[priority].bg;
}

function getPriorityBorder(priority: InvestigationPath['priority']): string {
  return tokens.priority[priority].border;
}

// ─── Props ──────────────────────────────────────────────────
export interface InvestigationPathCardProps {
  /** Investigation path data */
  path: InvestigationPath;

  /** Click callback */
  onClick?: (path: InvestigationPath) => void;

  /** Show the investigation type icon */
  showTypeIcon?: boolean;

  /** Whether this card is interactive (clickable) */
  interactive?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────
export function InvestigationPathCard({
  path,
  onClick,
  showTypeIcon = true,
  interactive = true,
  className,
}: InvestigationPathCardProps) {
  const TypeIcon = TYPE_ICONS[path.type];

  const content = (
    <div
      className={cn(
        'w-full text-left rounded-lg p-3 transition-all duration-150',
        className,
      )}
      style={{
        background: tokens.surface.card,
        border: `1px solid ${tokens.border.default}`,
        cursor: interactive ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        if (interactive) {
          (e.currentTarget as HTMLElement).style.borderColor = tokens.border.hover;
          (e.currentTarget as HTMLElement).style.background = tokens.surface.cardHover;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = tokens.border.default;
        (e.currentTarget as HTMLElement).style.background = tokens.surface.card;
      }}
    >
      {/* Title + Priority row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {showTypeIcon && TypeIcon && (
            <TypeIcon
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: tokens.text.muted }}
            />
          )}
          <span
            className="font-medium truncate"
            style={{
              fontSize: '12px',
              color: tokens.text.primary,
            }}
          >
            {path.title}
          </span>
        </div>
        <span
          className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full font-medium"
          style={{
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: getPriorityColor(path.priority),
            backgroundColor: getPriorityBg(path.priority),
            border: `1px solid ${getPriorityBorder(path.priority)}`,
          }}
        >
          {path.priority}
        </span>
      </div>

      {/* Rationale */}
      <p
        className="mt-1.5"
        style={{
          fontSize: '11px',
          color: tokens.text.secondary,
          lineHeight: 1.5,
          paddingLeft: showTypeIcon && TypeIcon ? '22px' : '0',
        }}
      >
        {path.rationale}
      </p>

      {/* Type label + arrow */}
      <div className="flex items-center justify-between mt-2">
        <span
          className="font-medium uppercase"
          style={{
            fontSize: '9px',
            letterSpacing: '1px',
            color: tokens.text.muted,
          }}
        >
          {TYPE_LABELS[path.type]}
        </span>
        {interactive && (
          <ArrowRight
            className="w-3 h-3"
            style={{ color: tokens.accent.bright }}
          />
        )}
      </div>
    </div>
  );

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={() => onClick(path)}
        className="w-full bg-transparent border-none p-0"
      >
        {content}
      </button>
    );
  }

  return content;
}
