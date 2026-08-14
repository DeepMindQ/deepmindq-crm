'use client';

// ── Types ──

export interface SignalEvidence {
  id: string;
  claim: string;
  sourceType: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceDate: string | null;
  excerpt: string | null;
  reliability: string;
}

export interface SignalOrganization {
  name: string;
  domain: string | null;
  industry: string | null;
}

export interface Signal {
  id: string;
  organizationId: string;
  organization: SignalOrganization;
  signalType: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  confidenceScore: number | null;
  impactScore: number | null;
  detectedAt: string;
  eventDate: string | null;
  source: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  analyzedAt: string | null;
  evidence: SignalEvidence[];
}

// ── Constants ──

export const SIGNAL_TYPE_LABELS: Record<string, string> = {
  hiring_change: 'Hiring Change',
  leadership_change: 'Leadership Change',
  technology_change: 'Technology Change',
  funding_event: 'Funding Event',
  market_expansion: 'Market Expansion',
  partnership: 'Partnership',
  competitor_move: 'Competitor Move',
  financial_indicator: 'Financial Indicator',
  product_launch: 'Product Launch',
  regulatory: 'Regulatory',
  customer_signal: 'Customer Signal',
  social_mention: 'Social Mention',
};

export const SEVERITY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
  high: { label: 'High', color: '#EA580C', bg: '#FFEDD5', border: '#FED7AA' },
  medium: { label: 'Medium', color: '#CA8A04', bg: '#FEF9C3', border: '#FDE68A' },
  low: { label: 'Low', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
};

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; strikethrough?: boolean }
> = {
  detected: { label: 'Detected', color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
  validated: { label: 'Validated', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
  analyzed: { label: 'Analyzed', color: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE' },
  acted_upon: { label: 'Acted Upon', color: '#059669', bg: '#D1FAE5', border: '#A7F3D0' },
  expired: { label: 'Expired', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' },
  dismissed: {
    label: 'Dismissed',
    color: '#9CA3AF',
    bg: '#F9FAFB',
    border: '#F3F4F6',
    strikethrough: true,
  },
};

// ── Helpers ──

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}
