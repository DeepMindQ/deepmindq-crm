/** @vitest-environment jsdom */
/**
 * Feedback Components Tests
 *
 * Tests FeedbackForm and InlineFeedback components.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mock design tokens ─────────────────────────────────────
vi.mock('@/components/intelligence-os/design-tokens', () => ({
  tokens: {
    accent: { DEFAULT: '#3b82f6', subtle: '#3b82f615', dim: '#3b82f680' },
    text: { primary: '#f8fafc', secondary: '#94a3b8', muted: '#64748b', inverse: '#0f172a' },
    flat: { white: '#ffffff' },
  },
}));

// ── Mock sonner ────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Mock Radix UI Dialog ──────────────────────────────────
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <button>{children}</button>
  ),
}));

// ── Mock UI components ─────────────────────────────────────
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea data-testid="feedback-textarea" {...props} />
  ),
}));

// ── Mock lucide-react ──────────────────────────────────────
vi.mock('lucide-react', () => ({
  Star: (props: Record<string, unknown>) => <svg data-testid="star" {...props} />,
  ThumbsUp: (props: Record<string, unknown>) => <svg data-testid="thumbs-up" {...props} />,
  ThumbsDown: (props: Record<string, unknown>) => <svg data-testid="thumbs-down" {...props} />,
  MessageSquare: (props: Record<string, unknown>) => <svg data-testid="message-square" {...props} />,
  Send: (props: Record<string, unknown>) => <svg data-testid="send" {...props} />,
}));

// ── Mock Tooltip ───────────────────────────────────────────
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <span>{children}</span>
  ),
}));

import { FeedbackForm } from '@/components/feedback/feedback-form';
import { InlineFeedback } from '@/components/feedback/inline-feedback';

describe('FeedbackForm', () => {
  it('renders with default trigger button', () => {
    render(<FeedbackForm />);
    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });

  it('renders dialog structure with trigger button', async () => {
    const mockOnSubmit = vi.fn();
    render(<FeedbackForm onSubmit={mockOnSubmit} />);

    // FeedbackForm renders its trigger and dialog structure
    // (Radix Dialog mock renders children regardless of open state)
    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });

  it('renders with custom trigger', () => {
    render(<FeedbackForm trigger={<button>Custom Trigger</button>} />);
    expect(screen.getByText('Custom Trigger')).toBeInTheDocument();
  });
});

describe('InlineFeedback', () => {
  it('renders thumbs up and thumbs down buttons', () => {
    render(<InlineFeedback context="test" itemId="item-1" />);
    expect(screen.getByTestId('thumbs-up')).toBeInTheDocument();
    expect(screen.getByTestId('thumbs-down')).toBeInTheDocument();
  });

  it('renders comment button', () => {
    render(<InlineFeedback context="test" itemId="item-1" />);
    expect(screen.getByTestId('message-square')).toBeInTheDocument();
  });

  it('calls onFeedback with positive sentiment on thumbs up click', () => {
    const mockOnFeedback = vi.fn();
    render(<InlineFeedback context="test" itemId="item-1" onFeedback={mockOnFeedback} />);

    fireEvent.click(screen.getByTestId('thumbs-up'));
    expect(mockOnFeedback).toHaveBeenCalledWith({
      sentiment: 'positive',
      comment: undefined,
      context: 'test',
      itemId: 'item-1',
    });
  });

  it('calls onFeedback with negative sentiment on thumbs down click', () => {
    const mockOnFeedback = vi.fn();
    render(<InlineFeedback context="test" itemId="item-2" onFeedback={mockOnFeedback} />);

    fireEvent.click(screen.getByTestId('thumbs-down'));
    expect(mockOnFeedback).toHaveBeenCalledWith({
      sentiment: 'negative',
      comment: undefined,
      context: 'test',
      itemId: 'item-2',
    });
  });

  it('disables buttons after feedback is given', () => {
    render(<InlineFeedback context="test" itemId="item-3" />);

    const thumbsUpBtn = screen.getByLabelText('Helpful');
    expect(thumbsUpBtn).not.toBeDisabled();

    fireEvent.click(thumbsUpBtn);

    // After clicking, the button should be disabled
    expect(screen.getByLabelText('Helpful')).toBeDisabled();
  });

  it('shows comment textarea when comment button clicked', () => {
    render(<InlineFeedback context="test" itemId="item-4" />);

    // No textarea visible initially
    expect(screen.queryByPlaceholderText('Add a comment...')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Add comment'));

    // Textarea should now be visible
    expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
  });
});
