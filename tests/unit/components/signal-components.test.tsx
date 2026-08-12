/** @vitest-environment jsdom */
/**
 * Signal Components Tests
 *
 * Tests SignalCard, SignalFeed, and DetectionIndicator.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mock design tokens ─────────────────────────────────────
vi.mock('@/components/intelligence-os/design-tokens', () => ({
  tokens: {
    accent: { DEFAULT: '#3b82f6', subtle: '#3b82f615' },
    text: { primary: '#f8fafc', secondary: '#94a3b8', muted: '#64748b' },
    border: { default: '#1e293b', subtle: '#1e293b60' },
    surface: { card: '#1e293b', secondary: '#0f172a' },
    domain: {
      signal: '#3b82f6', enrichment: '#a855f7', action: '#22c55e', reasoning: '#f59e0b', risk: '#ef4444',
    },
    priority: {
      critical: { value: '#ef4444' },
      high: { value: '#f97316' },
      medium: { value: '#f59e0b' },
      low: { value: '#22c55e' },
    },
    confidence: {
      high: { value: '#22c55e' },
      medium: { value: '#f59e0b' },
      low: { value: '#ef4444' },
    },
  },
}));

// ── Mock framer-motion ─────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Mock lucide-react ──────────────────────────────────────
vi.mock('lucide-react', () => ({
  Radar: (props: Record<string, unknown>) => <svg data-testid="radar" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="alert-triangle" {...props} />,
  TrendingUp: (props: Record<string, unknown>) => <svg data-testid="trending-up" {...props} />,
  Clock: (props: Record<string, unknown>) => <svg data-testid="clock" {...props} />,
  ExternalLink: (props: Record<string, unknown>) => <svg data-testid="external-link" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <svg data-testid="chevron-right" {...props} />,
  Zap: (props: Record<string, unknown>) => <svg data-testid="zap" {...props} />,
  ArrowRight: (props: Record<string, unknown>) => <svg data-testid="arrow-right" {...props} />,
  Eye: (props: Record<string, unknown>) => <svg data-testid="eye" {...props} />,
  EyeOff: (props: Record<string, unknown>) => <svg data-testid="eye-off" {...props} />,
  Bookmark: (props: Record<string, unknown>) => <svg data-testid="bookmark" {...props} />,
  LayoutGrid: (props: Record<string, unknown>) => <svg data-testid="layout-grid" {...props} />,
  List: (props: Record<string, unknown>) => <svg data-testid="list-icon" {...props} />,
}));

// ── Mock UI components ─────────────────────────────────────
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, 'aria-label': ariaLabel, 'aria-pressed': ariaPressed }: { children: React.ReactNode; onClick?: () => void; variant?: string; size?: string; 'aria-label'?: string; 'aria-pressed'?: boolean; className?: string }) => (
    <button onClick={onClick} aria-label={ariaLabel} aria-pressed={ariaPressed} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children, 'aria-label': ariaLabel }: { children: React.ReactNode; 'aria-label'?: string; className?: string }) => (
    <button aria-label={ariaLabel}>{children}</button>
  ),
  SelectValue: () => <span />,
}));

import { SignalCard, type Signal } from '@/components/signals/signal-card';
import { SignalFeed } from '@/components/signals/signal-feed';
import { DetectionIndicator } from '@/components/signals/detection-indicator';

const MOCK_SIGNAL: Signal = {
  id: 'sig-1',
  title: 'Funding Round Detected',
  description: 'Acme Corp raised Series B funding of $50M',
  severity: 'high',
  source: 'ai_detected',
  confidence: 85,
  company: { id: 'c1', name: 'Acme Corp' },
  detectedAt: new Date(Date.now() - 3600000).toISOString(),
  tags: ['funding', 'growth'],
};

describe('SignalCard', () => {
  it('renders signal title', () => {
    render(<SignalCard signal={MOCK_SIGNAL} />);
    expect(screen.getByText('Funding Round Detected')).toBeInTheDocument();
  });

  it('renders signal description', () => {
    render(<SignalCard signal={MOCK_SIGNAL} />);
    expect(screen.getByText('Acme Corp raised Series B funding of $50M')).toBeInTheDocument();
  });

  it('renders company name', () => {
    render(<SignalCard signal={MOCK_SIGNAL} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders confidence score', () => {
    render(<SignalCard signal={MOCK_SIGNAL} />);
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('renders severity badge', () => {
    render(<SignalCard signal={MOCK_SIGNAL} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders tags', () => {
    render(<SignalCard signal={MOCK_SIGNAL} />);
    expect(screen.getByText('funding')).toBeInTheDocument();
    expect(screen.getByText('growth')).toBeInTheDocument();
  });

  it('renders time ago', () => {
    render(<SignalCard signal={MOCK_SIGNAL} />);
    expect(screen.getByText('1h ago')).toBeInTheDocument();
  });

  it('renders in compact variant', () => {
    render(<SignalCard signal={MOCK_SIGNAL} variant="compact" />);
    expect(screen.getByText('Funding Round Detected')).toBeInTheDocument();
  });
});

describe('SignalFeed', () => {
  const signals: Signal[] = [
    MOCK_SIGNAL,
    { ...MOCK_SIGNAL, id: 'sig-2', title: 'Executive Change', severity: 'critical', confidence: 92 },
    { ...MOCK_SIGNAL, id: 'sig-3', title: 'Product Launch', severity: 'medium', confidence: 60 },
  ];

  it('renders signal count', () => {
    render(<SignalFeed signals={signals} />);
    expect(screen.getByText('3 unread signals')).toBeInTheDocument();
  });

  it('renders critical count', () => {
    render(<SignalFeed signals={signals} />);
    expect(screen.getByText('1 critical')).toBeInTheDocument();
  });

  it('renders signal cards', () => {
    render(<SignalFeed signals={signals} />);
    expect(screen.getByText('Funding Round Detected')).toBeInTheDocument();
    expect(screen.getByText('Executive Change')).toBeInTheDocument();
    expect(screen.getByText('Product Launch')).toBeInTheDocument();
  });

  it('shows empty state when no signals match filter', () => {
    render(<SignalFeed signals={[]} />);
    expect(screen.getByText('No signals match your filters')).toBeInTheDocument();
  });
});

describe('DetectionIndicator', () => {
  it('renders with active state', () => {
    const { container } = render(<DetectionIndicator active type="signal" />);
    // Should have the ping animation element
    const pingEl = container.querySelector('.animate-ping');
    expect(pingEl).toBeInTheDocument();
  });

  it('renders without ping when inactive', () => {
    const { container } = render(<DetectionIndicator active={false} type="signal" />);
    const pingEl = container.querySelector('.animate-ping');
    expect(pingEl).not.toBeInTheDocument();
  });

  it('renders count when provided', () => {
    render(<DetectionIndicator active type="signal" count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders correct role and aria-label', () => {
    render(<DetectionIndicator active type="enrichment" count={3} />);
    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveAttribute('aria-label', 'enrichment active, 3 detected');
  });

  it('handles all type variants', () => {
    const types = ['signal', 'enrichment', 'monitoring', 'scoring'] as const;
    for (const type of types) {
      const { unmount } = render(<DetectionIndicator active type={type} />);
      screen.getByRole('status');
      unmount();
    }
  });
});
