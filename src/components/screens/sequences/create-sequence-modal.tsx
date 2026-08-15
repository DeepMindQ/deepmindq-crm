'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
import { Mail, X, Plus } from 'lucide-react';
import { type SequenceStep } from './sequence-types';

/* ═══ Create Sequence Modal ═══ */

export interface CreateSequenceModalProps {
  newName: string;
  onNameChange: (_name: string) => void;
  newSubject: string;
  onSubjectChange: (_subject: string) => void;
  newSteps: SequenceStep[];
  onAddStep: () => void;
  onRemoveStep: (_id: string) => void;
  onUpdateStep: (_id: string, _field: keyof SequenceStep, _value: string | number) => void;
  onClose: () => void;
  onCreate: () => void;
}

export function CreateSequenceModal({
  newName,
  onNameChange,
  newSubject,
  onSubjectChange,
  newSteps,
  onAddStep,
  onRemoveStep,
  onUpdateStep,
  onClose,
  onCreate,
}: CreateSequenceModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-lg rounded-xl max-h-[85vh] overflow-y-auto"
        style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
      >
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: `1px solid ${tokens.border.default}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg"
              style={{ background: `${tokens.accent.primary}15`, color: tokens.accent.primary }}
            >
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                New Sequence
              </h2>
              <p className="text-xs" style={{ color: tokens.text.muted }}>
                Define your outreach steps
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: tokens.text.muted }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
              Sequence Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Enterprise Outreach Q1"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: 'var(--ios-bg-card)',
                border: `1px solid ${tokens.border.default}`,
                color: tokens.text.primary,
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
              Subject Template
            </label>
            <input
              type="text"
              value={newSubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="e.g. Quick question about {{company}}"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: 'var(--ios-bg-card)',
                border: `1px solid ${tokens.border.default}`,
                color: tokens.text.primary,
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                Sequence Steps
              </label>
              <button
                onClick={onAddStep}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  color: tokens.accent.primary,
                  border: `1px solid ${tokens.accent.primary}30`,
                }}
              >
                <Plus className="w-3 h-3" /> Add Step
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {newSteps.map((step, idx) => (
                <div
                  key={step.id}
                  className="flex items-center gap-2 p-3 rounded-lg"
                  style={{
                    background: tokens.surfaceExtended,
                    border: `1px solid ${tokens.border.default}`,
                  }}
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded text-xs font-bold shrink-0"
                    style={{
                      background: `${tokens.accent.primary}15`,
                      color: tokens.accent.primary,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <select
                    value={step.type}
                    onChange={(e) => onUpdateStep(step.id, 'type', e.target.value)}
                    className="px-2 py-1 rounded-md text-xs outline-none"
                    style={{
                      background: tokens.surface.card,
                      border: `1px solid ${tokens.border.default}`,
                      color: tokens.text.primary,
                    }}
                  >
                    <option value="email">Email</option>
                    <option value="wait">Wait</option>
                    <option value="task">Task</option>
                  </select>
                  <input
                    type="text"
                    value={step.label}
                    onChange={(e) => onUpdateStep(step.id, 'label', e.target.value)}
                    placeholder="Step label"
                    className="flex-1 px-2 py-1 rounded-md text-xs outline-none"
                    style={{
                      background: tokens.surface.card,
                      border: `1px solid ${tokens.border.default}`,
                      color: tokens.text.primary,
                    }}
                  />
                  {step.type === 'wait' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={step.delayDays}
                        onChange={(e) =>
                          onUpdateStep(step.id, 'delayDays', parseInt(e.target.value) || 0)
                        }
                        className="w-14 px-2 py-1 rounded-md text-xs outline-none"
                        style={{
                          background: tokens.surface.card,
                          border: `1px solid ${tokens.border.default}`,
                          color: tokens.text.primary,
                        }}
                      />
                      <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                        days
                      </span>
                    </div>
                  )}
                  {newSteps.length > 1 && (
                    <button
                      onClick={() => onRemoveStep(step.id)}
                      className="p-1 rounded transition-colors"
                      style={{ color: tokens.text.muted }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-3 p-5"
          style={{ borderTop: `1px solid ${tokens.border.default}` }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ border: `1px solid ${tokens.border.default}`, color: tokens.text.secondary }}
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={!newName.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: tokens.accent.primary, color: tokens.text.inverse }}
          >
            Create Sequence
          </button>
        </div>
      </div>
    </div>
  );
}
