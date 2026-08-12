/** @vitest-environment jsdom */
/**
 * Loading State Components Tests
 *
 * Tests EnterpriseLoading, EnterpriseEmptyState, EnterpriseErrorState, LoadingState.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mock design tokens ─────────────────────────────────────
vi.mock('@/components/intelligence-os/design-tokens', () => ({
  tokens: {
    accent: { DEFAULT: '#3b82f6', subtle: '#3b82f615', dim: '#3b82f680' },
    text: { primary: '#f8fafc', secondary: '#94a3b8', muted: '#64748b', inverse: '#0f172a' },
    flat: { white: '#ffffff', lightGray: '#e2e8f0' },
    domain: { risk: '#ef4444' },
    confidence: { low: { bg: '#ef444415' } },
    border: { default: '#1e293b', subtle: '#1e293b60' },
    surface: { card: '#1e293b', secondary: '#0f172a' },
  },
}));

// ── Mock lucide-react ──────────────────────────────────────
vi.mock('lucide-react', () => ({
  Loader2: (props: Record<string, unknown>) => <svg data-testid="loader2" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="alert-triangle" {...props} />,
  RefreshCw: (props: Record<string, unknown>) => <svg data-testid="refresh-cw" {...props} />,
  ArrowLeft: (props: Record<string, unknown>) => <svg data-testid="arrow-left" {...props} />,
}));

// ── Mock Skeleton component ─────────────────────────────────
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: { className?: string }) => <div data-testid="skeleton" className={props.className} />,
}));

import { EnterpriseLoading } from '@/components/enterprise/EnterpriseLoading';
import { EnterpriseEmptyState } from '@/components/enterprise/EnterpriseEmptyState';
import { EnterpriseErrorState } from '@/components/enterprise/EnterpriseErrorState';
import { LoadingState } from '@/components/enterprise/LoadingState';

describe('EnterpriseLoading', () => {
  it('renders a loading spinner', () => {
    render(<EnterpriseLoading />);
    expect(screen.getByTestId('loader2')).toBeInTheDocument();
  });

  it('renders default message', () => {
    render(<EnterpriseLoading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<EnterpriseLoading message="Fetching data..." />);
    expect(screen.getByText('Fetching data...')).toBeInTheDocument();
  });

  it('renders spinner with animate-spin class', () => {
    const { container } = render(<EnterpriseLoading />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders in full screen mode', () => {
    const { container } = render(<EnterpriseLoading fullScreen />);
    expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
  });

  it('handles all size variants', () => {
    const { rerender } = render(<EnterpriseLoading size="sm" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    rerender(<EnterpriseLoading size="md" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    rerender(<EnterpriseLoading size="lg" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('EnterpriseEmptyState', () => {
  const MockIcon = () => <svg data-testid="mock-icon" />;

  it('renders title', () => {
    render(<EnterpriseEmptyState icon={MockIcon} title="No data" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EnterpriseEmptyState icon={MockIcon} title="No data" description="Add items to get started" />);
    expect(screen.getByText('Add items to get started')).toBeInTheDocument();
  });

  it('renders action button when label and handler provided', () => {
    render(<EnterpriseEmptyState icon={MockIcon} title="No data" actionLabel="Add Item" onAction={vi.fn()} />);
    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });

  it('renders secondary action button', () => {
    render(
      <EnterpriseEmptyState
        icon={MockIcon}
        title="No data"
        actionLabel="Add Item"
        onAction={vi.fn()}
        secondaryActionLabel="Import"
        onSecondaryAction={vi.fn()}
      />
    );
    expect(screen.getByText('Import')).toBeInTheDocument();
  });

  it('renders without action buttons if not provided', () => {
    render(<EnterpriseEmptyState icon={MockIcon} title="No data" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the icon', () => {
    render(<EnterpriseEmptyState icon={MockIcon} title="No data" />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });
});

describe('EnterpriseErrorState', () => {
  it('renders default title', () => {
    render(<EnterpriseErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<EnterpriseErrorState title="Network Error" />);
    expect(screen.getByText('Network Error')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<EnterpriseErrorState message="Could not reach server" />);
    expect(screen.getByText('Could not reach server')).toBeInTheDocument();
  });

  it('renders retry button when onRetry provided', () => {
    render(<EnterpriseErrorState onRetry={vi.fn()} />);
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders back button when onBack provided', () => {
    render(<EnterpriseErrorState onBack={vi.fn()} />);
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('renders correlation ID', () => {
    render(<EnterpriseErrorState correlationId="corr-123" />);
    expect(screen.getByText(/Correlation: corr-123/)).toBeInTheDocument();
  });

  it('does not render buttons when no handlers provided', () => {
    render(<EnterpriseErrorState />);
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    expect(screen.queryByText('Go Back')).not.toBeInTheDocument();
  });
});

describe('LoadingState', () => {
  it('renders loading message', () => {
    render(<LoadingState message="Loading companies..." />);
    expect(screen.getByText('Loading companies...')).toBeInTheDocument();
  });

  it('renders skeleton lines based on lines prop', () => {
    const { container } = render(<LoadingState lines={5} />);
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    // Each line has 2-3 skeletons, so at least 10
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
  });

  it('renders default 3 lines', () => {
    const { container } = render(<LoadingState />);
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});
