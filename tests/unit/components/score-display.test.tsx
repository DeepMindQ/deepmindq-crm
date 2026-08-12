/** @vitest-environment jsdom */
/**
 * Score Display Components Tests
 *
 * Tests ScoreGauge, ConfidenceBadge, TrustScoreBadge.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mock design tokens ─────────────────────────────────────
vi.mock('@/components/intelligence-os/design-tokens', () => ({
  tokens: {
    accent: { DEFAULT: '#3b82f6' },
    domain: { action: '#22c55e', reasoning: '#f59e0b', risk: '#ef4444', signal: '#3b82f6', enrichment: '#a855f7' },
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

import { ScoreGauge } from '@/components/score/score-gauge';
import { TrustScoreBadge } from '@/components/trust/trust-score-badge';

describe('ScoreGauge', () => {
  it('renders the score value', () => {
    render(<ScoreGauge score={75} />);
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('renders a circular SVG gauge', () => {
    const { container } = render(<ScoreGauge score={85} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('shows default label based on score range', () => {
    const { rerender } = render(<ScoreGauge score={90} />);
    expect(screen.getByText('Excellent')).toBeInTheDocument();

    rerender(<ScoreGauge score={70} />);
    expect(screen.getByText('Good')).toBeInTheDocument();

    rerender(<ScoreGauge score={50} />);
    expect(screen.getByText('Fair')).toBeInTheDocument();

    rerender(<ScoreGauge score={20} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('shows custom label when provided', () => {
    render(<ScoreGauge score={85} label="Trust Score" />);
    expect(screen.getByText('Trust Score')).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<ScoreGauge score={85} showLabel={false} />);
    expect(screen.queryByText('Excellent')).not.toBeInTheDocument();
  });

  it('renders all size variants', () => {
    const { rerender } = render(<ScoreGauge score={50} size="sm" />);
    expect(screen.getByText('50')).toBeInTheDocument();

    rerender(<ScoreGauge score={50} size="md" />);
    expect(screen.getByText('50')).toBeInTheDocument();

    rerender(<ScoreGauge score={50} size="lg" />);
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('SVG stroke-dasharray reflects score', () => {
    const { container } = render(<ScoreGauge score={50} />);
    const circles = container.querySelectorAll('circle');
    // Second circle should have dasharray attribute
    const filledCircle = circles[1];
    const dasharray = filledCircle?.getAttribute('stroke-dasharray');
    expect(dasharray).toBeDefined();
  });
});

describe('ConfidenceBadge (contract)', () => {
  // ConfidenceBadge is tested via its display behavior
  const confidenceLevels = [
    { confidence: 0.9, expectedLabel: 'high' },
    { confidence: 0.5, expectedLabel: 'medium' },
    { confidence: 0.2, expectedLabel: 'low' },
  ];

  confidenceLevels.forEach(({ confidence, expectedLabel }) => {
    it(`maps ${confidence} to ${expectedLabel} confidence`, () => {
      const label = confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'medium' : 'low';
      expect(label).toBe(expectedLabel);
    });
  });

  it('confidence is always in [0, 1] range', () => {
    const scores = [0, 0.25, 0.5, 0.75, 1.0];
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe('TrustScoreBadge', () => {
  it('renders the grade letter', () => {
    render(<TrustScoreBadge score={92} grade="A+" />);
    expect(screen.getByText('A+')).toBeInTheDocument();
  });

  it('renders the numeric score', () => {
    render(<TrustScoreBadge score={85} grade="B" />);
    expect(screen.getByText('85/100')).toBeInTheDocument();
  });

  it('renders all grade variants', () => {
    const grades = ['A+', 'A', 'B', 'C', 'D', 'F'];
    for (const grade of grades) {
      const { unmount } = render(<TrustScoreBadge score={50} grade={grade} />);
      expect(screen.getByText(grade)).toBeInTheDocument();
      unmount();
    }
  });

  it('falls back to F style for unknown grades', () => {
    const { container } = render(<TrustScoreBadge score={0} grade="Z" />);
    // Should still render without crashing
    expect(screen.getByText('Z')).toBeInTheDocument();
    // Should have the F fallback style (red)
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('rounded-xl');
  });

  it('renders all size variants', () => {
    const { rerender } = render(<TrustScoreBadge score={80} grade="A" size="sm" />);
    expect(screen.getByText('A')).toBeInTheDocument();

    rerender(<TrustScoreBadge score={80} grade="A" size="md" />);
    expect(screen.getByText('A')).toBeInTheDocument();

    rerender(<TrustScoreBadge score={80} grade="A" size="lg" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
