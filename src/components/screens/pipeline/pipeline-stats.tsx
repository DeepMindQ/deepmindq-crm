'use client';

import { type LucideIcon } from 'lucide-react';
import { tokens } from '@/components/intelligence-os/design-tokens';

// ═══════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

export interface PipelineStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subValue?: string;
  accentColor: string;
}

export function PipelineStatCard({
  icon: Icon,
  label,
  value,
  subValue,
  accentColor,
}: PipelineStatCardProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg"
      style={{
        background: tokens.surface.secondary,
        border: `1px solid ${tokens.border.default}`,
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${accentColor}12` }}
      >
        <Icon className="w-[18px] h-[18px]" style={{ color: accentColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>
          {label}
        </p>
        <p className="text-[15px] font-bold" style={{ color: tokens.text.primary }}>
          {value}
        </p>
        {subValue && (
          <p className="text-[10px]" style={{ color: tokens.text.secondary }}>
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}
