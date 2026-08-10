'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §6 — Advisor Workspace Panel (Organism)
   
   Slide-out panel showing the user's saved intelligence workspace:
   saved briefings, pinned accounts, conversation history, and
   quick-access intelligence items.
   
   This is NOT a generic sidebar. It is the intelligence analyst's
   persistent workspace for managing briefings and tracked accounts.
   
   MS6 Reference: workspace patterns, history list patterns
   Tokens: surface layers, text hierarchy, accent colors
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from './design-tokens';
import type { WorkspaceItem, AdvisorWorkspace } from '@/types/ms9-advisor';

export interface AdvisorWorkspacePanelProps {
  /** Complete workspace data */
  workspace: AdvisorWorkspace;
  
  /** Whether the panel is open */
  open: boolean;
  
  /** Callback to close the panel */
  onClose: () => void;
  
  /** Callback when a workspace item is clicked */
  onItemSelect?: (item: WorkspaceItem) => void;
  
  /** Callback when a new briefing is requested */
  onNewBriefing?: () => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

/** Section configuration */
const sectionConfig: Array<{
  key: WorkspaceItem['section'];
  label: string;
  icon: 'bookmark' | 'building' | 'clock' | 'zap';
}> = [
  { key: 'briefings', label: 'Saved Briefings', icon: 'bookmark' },
  { key: 'accounts', label: 'Pinned Accounts', icon: 'building' },
  { key: 'history', label: 'Conversation History', icon: 'clock' },
  { key: 'quick_access', label: 'Quick Access', icon: 'zap' },
];

/** Item type → icon config */
const itemTypeIcons: Record<WorkspaceItem['type'], string> = {
  saved_briefing: 'file-text',
  pinned_account: 'building-2',
  conversation_history: 'message-square',
  intelligence_access: 'radar',
};

function SectionIcon({ icon }: { icon: string }) {
  const cls = 'w-3.5 h-3.5';
  switch (icon) {
    case 'bookmark':
      return (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M3 1 L3 13 L7 10 L11 13 L11 1 Z" />
        </svg>
      );
    case 'building':
      return (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <rect x="2" y="3" width="10" height="9" rx="1" />
          <path d="M5 3 L5 1 L9 1 L9 3" />
          <path d="M5 6 L5 8" />
          <path d="M7 6 L7 8" />
          <path d="M9 6 L9 8" />
        </svg>
      );
    case 'clock':
      return (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <circle cx="7" cy="7" r="5" />
          <path d="M7 4 L7 7.5 L9.5 9" />
        </svg>
      );
    case 'zap':
      return (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M8 1 L3 8 L7 8 L6 13 L11 6 L7 6 Z" />
        </svg>
      );
    default:
      return null;
  }
}

function ItemTypeIcon({ type }: { type: WorkspaceItem['type'] }) {
  const cls = 'w-3.5 h-3.5 flex-shrink-0';
  switch (type) {
    case 'saved_briefing':
      return (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M3 1 L10 1 C10.6 1 11 1.4 11 2 L11 12 L7 10 L3 12 L3 2 C3 1.4 3.4 1 3 1Z" />
          <path d="M5 5 L9 5" />
          <path d="M5 7 L8 7" />
        </svg>
      );
    case 'pinned_account':
      return (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <rect x="2" y="4" width="10" height="8" rx="1" />
          <path d="M4 4 L4 2 L10 2 L10 4" />
          <circle cx="7" cy="8" r="1.5" />
        </svg>
      );
    case 'conversation_history':
      return (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M2 2 L12 2 C12.6 2 13 2.4 13 3 L13 9 C13 9.6 12.6 10 12 10 L5 10 L3 13 L3 10 L2 10 C1.4 10 1 9.6 1 9 L1 3 C1 2.4 1.4 2 2 2Z" />
        </svg>
      );
    case 'intelligence_access':
      return (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <circle cx="7" cy="7" r="5" />
          <path d="M7 4 L7 7.5 L10 9.5" />
          <path d="M2 7 L3.5 7" />
          <path d="M10.5 7 L12 7" />
        </svg>
      );
    default:
      return null;
  }
}

export function AdvisorWorkspacePanel({
  workspace,
  open,
  onClose,
  onItemSelect,
  onNewBriefing,
  className,
}: AdvisorWorkspacePanelProps) {
  const [activeSection, setActiveSection] = useState<WorkspaceItem['section']>('briefings');

  if (!open) return null;

  const activeItems = workspace.sections[activeSection] ?? [];

  return (
    <div
      className={cn('fixed inset-0 z-40', className)}
      style={{ backgroundColor: tokens.opacity.subtle }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Panel */}
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-sm flex flex-col"
        style={{
          backgroundColor: tokens.surface.card,
          borderLeft: `1px solid ${tokens.border.default}`,
          boxShadow: '-8px 0 24px tokens.opacity.subtle',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${tokens.border.default}` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: tokens.accent.subtle,
                border: `1px solid ${tokens.accent.strong}`,
              }}
            >
              <svg viewBox="0 0 14 14" fill="none" stroke={tokens.accent.DEFAULT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <rect x="1" y="1" width="5" height="5" rx="1" />
                <rect x="8" y="1" width="5" height="5" rx="1" />
                <rect x="1" y="8" width="5" height="5" rx="1" />
                <rect x="8" y="8" width="5" height="5" rx="1" />
              </svg>
            </div>
            <div>
              <h3
                className="text-[14px] font-bold"
                style={{ color: tokens.text.primary }}
              >
                Intelligence Workspace
              </h3>
              <p
                className="text-[11px] font-mono"
                style={{ color: tokens.text.muted }}
              >
                {workspace.totalItems} items
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: tokens.text.muted,
            }}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M3 3 L11 11 M11 3 L3 11" />
            </svg>
          </button>
        </div>

        {/* Section tabs */}
        <div
          className="flex items-center gap-0.5 px-4 py-2"
          style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
        >
          {sectionConfig.map((section) => {
            const count = (workspace.sections[section.key] ?? []).length;
            if (count === 0) return null;
            return (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                style={{
                  backgroundColor: activeSection === section.key ? tokens.accent.ghost : 'transparent',
                  border: `1px solid ${activeSection === section.key ? tokens.accent.strong : 'transparent'}`,
                  color: activeSection === section.key ? tokens.accent.DEFAULT : tokens.text.muted,
                }}
              >
                <SectionIcon icon={section.icon} />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: 'thin' }}>
          {activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke={tokens.text.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9 L15 9 M9 13 L15 13" />
              </svg>
              <p className="text-[12px]" style={{ color: tokens.text.muted }}>
                No items in this section
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {activeItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onItemSelect?.(item)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer w-full"
                  style={{
                    backgroundColor: tokens.surface.elevated,
                    border: `1px solid ${tokens.border.subtle}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = tokens.surface.cardHover;
                    e.currentTarget.style.borderColor = tokens.border.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = tokens.surface.elevated;
                    e.currentTarget.style.borderColor = tokens.border.subtle;
                  }}
                >
                  {/* Type icon */}
                  <div
                    style={{ color: tokens.accent.bright }}
                  >
                    <ItemTypeIcon type={item.type} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px] font-medium truncate"
                      style={{ color: tokens.text.primary }}
                    >
                      {item.title}
                    </div>
                    {item.description && (
                      <div
                        className="text-[11px] truncate mt-0.5"
                        style={{ color: tokens.text.muted }}
                      >
                        {item.description}
                      </div>
                    )}
                  </div>

                  {/* Access time */}
                  <div
                    className="text-[10px] font-mono flex-shrink-0"
                    style={{ color: tokens.text.muted }}
                  >
                    {/* Show relative time from lastAccessedAt */}
                    {item.lastAccessedAt}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer — New Briefing CTA */}
        <div
          className="px-4 py-3"
          style={{ borderTop: `1px solid ${tokens.border.default}` }}
        >
          <button
            onClick={onNewBriefing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
            style={{
              backgroundColor: tokens.accent.subtle,
              border: `1px solid ${tokens.accent.strong}`,
              color: tokens.accent.DEFAULT,
            }}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M7 1 L7 13 M1 7 L13 7" />
            </svg>
            Start New Briefing
          </button>
        </div>
      </div>
    </div>
  );
}
