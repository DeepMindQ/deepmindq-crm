'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';

/* ══════════════════════════════════════════════════════════════
   Stats Card Component
   ══════════════════════════════════════════════════════════════ */

export interface ImportStatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
}

export function ImportStatCard({ icon: Icon, label, value, color, bgColor }: ImportStatCardProps) {
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-xl transition-all"
      style={{
        background: tokens.surface.primary,
        border: `1px solid ${tokens.border.default}`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
        style={{ background: bgColor }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: tokens.text.secondary }}>
          {label}
        </p>
        <p className="text-xl font-bold" style={{ color: tokens.text.primary }}>
          {value}
        </p>
      </div>
    </div>
  );
}
