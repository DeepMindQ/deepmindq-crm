'use client';

import { Radio, Brain, Database, RefreshCw, FileText } from 'lucide-react';
import { C, formatTimestamp, type TimelineEntry } from './hub-types';

// ═══════════════════════════════════════════════════════════════
// TIMELINE ITEM
// ═══════════════════════════════════════════════════════════════

export function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const iconMap: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    signal: { icon: <Radio className="h-3.5 w-3.5" />, color: C.accent, bg: C.accentGhost },
    insight: { icon: <Brain className="h-3.5 w-3.5" />, color: C.purple, bg: C.purpleGhost },
    import: { icon: <Database className="h-3.5 w-3.5" />, color: C.cyan, bg: C.cyanGhost },
    pipeline: { icon: <RefreshCw className="h-3.5 w-3.5" />, color: C.success, bg: C.successGhost },
    briefing: { icon: <FileText className="h-3.5 w-3.5" />, color: C.gold, bg: C.goldGhost },
  };
  const cfg = iconMap[entry.type] || iconMap.signal;

  return (
    <div className="flex items-start gap-3 py-2.5 group">
      <div
        className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-0.5"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium" style={{ color: C.textPrimary }}>
          {entry.message}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>
          {entry.detail}
        </div>
      </div>
      <span className="text-[11px] shrink-0 mt-0.5" style={{ color: C.textMuted }}>
        {formatTimestamp(entry.timestamp)}
      </span>
    </div>
  );
}
