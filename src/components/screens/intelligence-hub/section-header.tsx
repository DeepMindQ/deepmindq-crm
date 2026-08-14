'use client';

import { C } from './hub-types';

// ═══════════════════════════════════════════════════════════════
// Section Header — used across Intelligence Hub sections
// ═══════════════════════════════════════════════════════════════

export interface SectionHeaderProps {
  title: React.ReactNode;
  icon: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionHeader({ title, icon, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold" style={{ color: C.textPrimary }}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
