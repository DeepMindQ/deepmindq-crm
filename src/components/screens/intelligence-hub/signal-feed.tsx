'use client';

import { ChevronRight, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { C, SEVERITY_CONFIG, SIGNAL_TYPE_COLORS, timeAgo, type SignalFeedItem } from './hub-types';

// ═══════════════════════════════════════════════════════════════
// SIGNAL FEED CARD
// ═══════════════════════════════════════════════════════════════

export function SignalFeedCard({
  signal,
  onClick,
}: {
  signal: SignalFeedItem;
  onClick: (_sig: SignalFeedItem) => void;
}) {
  const severityCfg = SEVERITY_CONFIG[signal.severity] || SEVERITY_CONFIG.low;
  const typeCfg = SIGNAL_TYPE_COLORS[signal.signalType] || {
    color: C.textSecondary,
    bg: C.accentGhost,
  };

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 group"
      style={{
        background: 'transparent',
        border: `1px solid transparent`,
      }}
      onClick={() => onClick(signal)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = C.bgCardHover;
        (e.currentTarget as HTMLElement).style.borderColor = C.border;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
      }}
    >
      <div
        className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 mt-0.5"
        style={{ background: severityCfg.bg, color: severityCfg.color }}
      >
        {severityCfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium truncate" style={{ color: C.textPrimary }}>
            {signal.title}
          </span>
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: C.textMuted }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {signal.organizationName && (
            <span className="text-xs" style={{ color: C.textSecondary }}>
              {signal.organizationName}
            </span>
          )}
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
            style={{ color: typeCfg.color, background: typeCfg.bg }}
          >
            {signal.signalType}
          </span>
          <span className="text-xs flex items-center gap-1" style={{ color: C.textMuted }}>
            <Clock className="h-3 w-3" />
            {timeAgo(signal.detectedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIGNAL FEED SKELETON
// ═══════════════════════════════════════════════════════════════

export function SignalFeedSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={`skeleton-signal-${i}`} className="flex items-center gap-3 p-3">
          <Skeleton className="h-8 w-8 rounded-lg shrink-0" style={{ background: C.border }} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4 rounded" style={{ background: C.border }} />
            <Skeleton className="h-3 w-1/2 rounded" style={{ background: C.border }} />
          </div>
        </div>
      ))}
    </>
  );
}
