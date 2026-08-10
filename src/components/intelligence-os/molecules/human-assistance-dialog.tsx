'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §6 — Human Assistance Request Dialog (Molecule)
   
   Modal dialog for submitting a human assistance escalation request.
   Captures the reason, priority, description, and context snapshot.
   
   This is NOT a generic form. It is an intelligence escalation
   workflow entry point that preserves evidence chain context.
   
   Tokens: surface.overlay, surface.elevated, domain colors
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../design-tokens';
import type {
  HumanAssistanceEntry,
  PriorityLevel,
} from '@/types/ms9-advisor';

export interface HumanAssistanceDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  
  /** Callback to close the dialog */
  onClose: () => void;
  
  /** Callback when user submits the escalation request */
  onSubmit: (request: {
    reason: HumanAssistanceEntry['reason'];
    priority: PriorityLevel;
    description: string;
  }) => void;
  
  /** Pre-populated reason (from banner) */
  preselectedReason?: HumanAssistanceEntry['reason'];
  
  /** Pre-populated priority */
  preselectedPriority?: PriorityLevel;
  
  /** Account name for context display */
  accountName?: string | null;
  
  /** Current confidence score */
  currentConfidence?: number;
  
  /** Evidence count */
  evidenceCount?: number;
  
  /** Signal count */
  signalCount?: number;
  
  /** Optional additional CSS classes */
  className?: string;
}

/** Escalation reason options with metadata */
const escalationReasons: Array<{
  value: HumanAssistanceEntry['reason'];
  label: string;
  description: string;
}> = [
  {
    value: 'low_confidence',
    label: 'Low Confidence',
    description: 'AI confidence falls below reliable threshold',
  },
  {
    value: 'conflicting_evidence',
    label: 'Conflicting Evidence',
    description: 'Sources present contradictory intelligence',
  },
  {
    value: 'complex_analysis',
    label: 'Complex Analysis',
    description: 'Requires multi-dimensional expert interpretation',
  },
  {
    value: 'data_gap',
    label: 'Data Gap',
    description: 'Key intelligence data missing or outdated',
  },
  {
    value: 'user_request',
    label: 'User Requested',
    description: 'User-initiated expert review',
  },
];

/** Priority options — using individual string fields to avoid literal type issues */
const priorityOptions: Array<{
  value: PriorityLevel;
  label: string;
  bg: string;
  border: string;
  value_color: string;
}> = [
  { value: 'critical', label: 'Critical', bg: tokens.priority.critical.bg, border: tokens.priority.critical.border, value_color: tokens.priority.critical.value },
  { value: 'high', label: 'High', bg: tokens.priority.high.bg, border: tokens.priority.high.border, value_color: tokens.priority.high.value },
  { value: 'medium', label: 'Medium', bg: tokens.priority.medium.bg, border: tokens.priority.medium.border, value_color: tokens.priority.medium.value },
  { value: 'low', label: 'Low', bg: tokens.priority.low.bg, border: tokens.priority.low.border, value_color: tokens.priority.low.value },
];

export function HumanAssistanceDialog({
  open,
  onClose,
  onSubmit,
  preselectedReason,
  preselectedPriority,
  accountName,
  currentConfidence,
  evidenceCount,
  signalCount,
  className,
}: HumanAssistanceDialogProps) {
  const [reason, setReason] = useState<HumanAssistanceEntry['reason']>(
    preselectedReason ?? 'low_confidence',
  );
  const [priority, setPriority] = useState<PriorityLevel>(
    preselectedPriority ?? 'medium',
  );
  const [description, setDescription] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!description.trim()) return;
    onSubmit({ reason, priority, description: description.trim() });
    setDescription('');
    onClose();
  };

  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-center justify-center', className)}
      style={{ backgroundColor: tokens.surface.overlay }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl overflow-hidden"
        style={{
          backgroundColor: tokens.surface.card,
          border: `1px solid ${tokens.border.default}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div
          className="px-6 pt-5 pb-4"
          style={{ borderBottom: `1px solid ${tokens.border.default}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: tokens.priority.high.bg,
                border: `1px solid ${tokens.priority.high.border}`,
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke={tokens.priority.high.value} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <circle cx="6" cy="5" r="2.5" />
                <path d="M1 14 C1 11 3.5 9 6 9" />
                <path d="M10 7 L12 9 L15 4" />
              </svg>
            </div>
            <div>
              <h3
                className="text-[15px] font-bold"
                style={{ color: tokens.text.primary }}
              >
                Request Human Review
              </h3>
              <p
                className="text-[12px] mt-0.5"
                style={{ color: tokens.text.muted }}
              >
                Escalate to expert intelligence analyst
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex flex-col gap-4">
          {/* Context snapshot */}
          {(accountName || currentConfidence !== undefined) && (
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono px-3 py-2 rounded-md"
              style={{
                backgroundColor: tokens.surface.elevated,
                border: `1px solid ${tokens.border.subtle}`,
                color: tokens.text.muted,
              }}
            >
              {accountName && <span>Account: {accountName}</span>}
              {currentConfidence !== undefined && <span>Confidence: {currentConfidence}%</span>}
              {evidenceCount !== undefined && <span>Evidence: {evidenceCount} items</span>}
              {signalCount !== undefined && <span>Signals: {signalCount}</span>}
            </div>
          )}

          {/* Reason selection */}
          <div>
            <label
              className="block text-[11px] font-bold uppercase tracking-wider mb-2"
              style={{
                color: tokens.text.secondary,
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              Escalation Reason
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {escalationReasons.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer"
                  style={{
                    backgroundColor: reason === r.value ? tokens.accent.ghost : 'transparent',
                    border: `1px solid ${reason === r.value ? tokens.accent.strong : tokens.border.subtle}`,
                  }}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: reason === r.value ? tokens.accent.DEFAULT : tokens.border.hover,
                      backgroundColor: reason === r.value ? tokens.accent.DEFAULT : 'transparent',
                    }}
                  >
                    {reason === r.value && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tokens.flat.white }} />
                    )}
                  </div>
                  <div>
                    <div
                      className="text-[13px] font-medium"
                      style={{ color: tokens.text.primary }}
                    >
                      {r.label}
                    </div>
                    <div
                      className="text-[11px]"
                      style={{ color: tokens.text.muted }}
                    >
                      {r.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Priority selection */}
          <div>
            <label
              className="block text-[11px] font-bold uppercase tracking-wider mb-2"
              style={{
                color: tokens.text.secondary,
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              Priority
            </label>
            <div className="flex gap-2">
              {priorityOptions.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
                  style={{
                    backgroundColor: priority === p.value ? p.bg : 'transparent',
                    border: `1px solid ${priority === p.value ? p.border : tokens.border.subtle}`,
                    color: priority === p.value ? p.value_color : tokens.text.muted,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              className="block text-[11px] font-bold uppercase tracking-wider mb-2"
              style={{
                color: tokens.text.secondary,
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              Additional Context
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what human review should focus on..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] resize-none outline-none transition-colors"
              style={{
                backgroundColor: tokens.surface.elevated,
                border: `1px solid ${tokens.border.default}`,
                color: tokens.text.primary,
                fontFamily: 'var(--font-sans, sans-serif)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = tokens.border.focus;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${tokens.accent.subtle}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = tokens.border.default;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-end gap-2"
          style={{ borderTop: `1px solid ${tokens.border.default}` }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
            style={{
              backgroundColor: 'transparent',
              border: `1px solid ${tokens.border.default}`,
              color: tokens.text.secondary,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!description.trim()}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: tokens.accent.DEFAULT,
              color: tokens.flat.white,
            }}
          >
            Submit Escalation
          </button>
        </div>
      </div>
    </div>
  );
}
