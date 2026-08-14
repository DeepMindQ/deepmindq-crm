'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';

/* ═══ Types ═══ */

export type SequenceStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface SequenceStep {
  id: string;
  type: 'email' | 'wait' | 'task';
  label: string;
  delayDays: number;
}

export interface Sequence {
  id: string;
  name: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  openRate: number;
  replyRate: number;
  sentCount: number;
  lastModified: string;
}

/* ═══ Helpers ═══ */

export function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function getStatusConfig(status: SequenceStatus) {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        color: tokens.confidence.high.value,
        bg: tokens.confidence.high.bg,
      };
    case 'paused':
      return {
        label: 'Paused',
        color: tokens.confidence.medium.value,
        bg: tokens.confidence.medium.bg,
      };
    case 'completed':
      return { label: 'Completed', color: '#6366F1', bg: '#EEF2FF' };
    case 'draft':
    default:
      return { label: 'Draft', color: tokens.text.muted, bg: tokens.neutral['100'] };
  }
}

/* ═══ Mock Data ═══ */

export const MOCK_SEQUENCES: Sequence[] = [
  {
    id: 'seq-1',
    name: 'Enterprise SaaS Outreach',
    status: 'active',
    steps: [
      { id: 's1', type: 'email', label: 'Initial Intro', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 3 days', delayDays: 3 },
      { id: 's3', type: 'email', label: 'Follow-up', delayDays: 0 },
      { id: 's4', type: 'wait', label: 'Wait 5 days', delayDays: 5 },
      { id: 's5', type: 'email', label: 'Value Prop', delayDays: 0 },
    ],
    openRate: 67.2,
    replyRate: 12.8,
    sentCount: 342,
    lastModified: '2025-01-15T10:30:00Z',
  },
  {
    id: 'seq-2',
    name: 'Mid-Market Re-engagement',
    status: 'active',
    steps: [
      { id: 's1', type: 'email', label: 'Re-engagement Email', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 2 days', delayDays: 2 },
      { id: 's3', type: 'email', label: 'Case Study Share', delayDays: 0 },
      { id: 's4', type: 'email', label: 'Meeting Request', delayDays: 7 },
    ],
    openRate: 54.1,
    replyRate: 9.3,
    sentCount: 186,
    lastModified: '2025-01-14T15:20:00Z',
  },
  {
    id: 'seq-3',
    name: 'Healthcare IT Discovery',
    status: 'paused',
    steps: [
      { id: 's1', type: 'email', label: 'Industry Insight', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 4 days', delayDays: 4 },
      { id: 's3', type: 'email', label: 'Compliance Angle', delayDays: 0 },
    ],
    openRate: 71.5,
    replyRate: 18.2,
    sentCount: 89,
    lastModified: '2025-01-13T09:45:00Z',
  },
  {
    id: 'seq-4',
    name: 'FinTech Partnership Pitch',
    status: 'active',
    steps: [
      { id: 's1', type: 'email', label: 'Partnership Intro', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 3 days', delayDays: 3 },
      { id: 's3', type: 'email', label: 'ROI Analysis', delayDays: 0 },
      { id: 's4', type: 'wait', label: 'Wait 7 days', delayDays: 7 },
      { id: 's5', type: 'email', label: 'Demo Invite', delayDays: 0 },
      { id: 's6', type: 'email', label: 'Final Follow-up', delayDays: 5 },
    ],
    openRate: 62.8,
    replyRate: 15.1,
    sentCount: 124,
    lastModified: '2025-01-12T14:10:00Z',
  },
  {
    id: 'seq-5',
    name: 'Cold Lead Nurture',
    status: 'draft',
    steps: [
      { id: 's1', type: 'email', label: 'Warm Intro', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 5 days', delayDays: 5 },
      { id: 's3', type: 'email', label: 'Content Share', delayDays: 0 },
    ],
    openRate: 0,
    replyRate: 0,
    sentCount: 0,
    lastModified: '2025-01-16T08:00:00Z',
  },
  {
    id: 'seq-6',
    name: 'Post-Demo Follow-up',
    status: 'completed',
    steps: [
      { id: 's1', type: 'email', label: 'Thank You', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 1 day', delayDays: 1 },
      { id: 's3', type: 'email', label: 'Summary & Next Steps', delayDays: 0 },
      { id: 's4', type: 'task', label: 'Schedule Follow-up Call', delayDays: 3 },
    ],
    openRate: 89.3,
    replyRate: 42.6,
    sentCount: 67,
    lastModified: '2025-01-10T16:30:00Z',
  },
  {
    id: 'seq-7',
    name: 'Competitor Displacement',
    status: 'active',
    steps: [
      { id: 's1', type: 'email', label: 'Pain Point Email', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 4 days', delayDays: 4 },
      { id: 's3', type: 'email', label: 'Comparison Sheet', delayDays: 0 },
      { id: 's4', type: 'email', label: 'Switch Offer', delayDays: 7 },
    ],
    openRate: 48.9,
    replyRate: 7.5,
    sentCount: 215,
    lastModified: '2025-01-11T11:20:00Z',
  },
  {
    id: 'seq-8',
    name: 'Event Invitation Series',
    status: 'draft',
    steps: [
      { id: 's1', type: 'email', label: 'Save the Date', delayDays: 0 },
      { id: 's2', type: 'wait', label: 'Wait 7 days', delayDays: 7 },
      { id: 's3', type: 'email', label: 'Agenda Reveal', delayDays: 0 },
      { id: 's4', type: 'email', label: 'Final Reminder', delayDays: 3 },
    ],
    openRate: 0,
    replyRate: 0,
    sentCount: 0,
    lastModified: '2025-01-16T09:15:00Z',
  },
];
