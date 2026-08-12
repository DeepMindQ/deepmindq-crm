/**
 * PHASE D — Quality Metrics & Feedback Tracking Tests
 *
 * Tests the feedback tracking and enhanced quality metrics:
 *   - recordFeedback stores positive/negative/correction feedback
 *   - recordFeedback handles DB errors gracefully
 *   - getFeedbackAnalytics returns aggregated stats
 *   - getFeedbackAnalytics handles empty data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    aIInsight: {
      create: (...args: any[]) => mockCreate(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
      update: (...args: any[]) => mockUpdate(...args),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

import { recordFeedback, getFeedbackAnalytics } from '@/lib/ai-reliability';

describe('PHASE D: Quality Metrics & Feedback Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: DB operations succeed
    mockUpdate.mockResolvedValue({});
    mockCreate.mockResolvedValue({ id: 'fb_test' });
    mockFindMany.mockResolvedValue([]);
  });

  // ── Test 1: recordFeedback stores positive feedback ──
  it('recordFeedback stores positive feedback', async () => {
    mockUpdate.mockResolvedValue({});
    mockCreate.mockResolvedValue({ id: 'fb_123' });

    const feedbackId = await recordFeedback({
      insightId: 'insight-1',
      generationType: 'scoring',
      feedbackType: 'positive',
      userComment: 'Great recommendation!',
    });

    // Should return a feedback ID
    expect(feedbackId).toBeTruthy();
    expect(typeof feedbackId).toBe('string');
    expect(feedbackId).toContain('fb_');

    // update should have been called to mark the original insight
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'insight-1' },
        data: expect.objectContaining({ feedback: 'positive' }),
      })
    );

    // create should have been called to store the feedback record
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'ai_feedback',
        }),
      })
    );
  });

  // ── Test 2: recordFeedback stores negative feedback ──
  it('recordFeedback stores negative feedback', async () => {
    const feedbackId = await recordFeedback({
      insightId: 'insight-2',
      generationType: 'recommendation',
      feedbackType: 'negative',
      userComment: 'Not accurate',
    });

    expect(feedbackId).toBeTruthy();
    // Negative feedback maps to 'negative'
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ feedback: 'negative' }),
      })
    );
  });

  // ── Test 3: recordFeedback stores correction with correctedAnswer ──
  it('recordFeedback stores correction with correctedAnswer', async () => {
    const feedbackId = await recordFeedback({
      insightId: 'insight-3',
      generationType: 'brief',
      feedbackType: 'correction',
      correctedAnswer: 'The correct revenue is $50M, not $500M.',
    });

    expect(feedbackId).toBeTruthy();
    // Correction maps to 'negative' for the insight feedback field
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          feedback: 'negative',
          feedbackNote: 'The correct revenue is $50M, not $500M.',
        }),
      })
    );

    // The create call metadata should include correctedAnswer
    const createCall = mockCreate.mock.calls[0][0];
    const metadata = JSON.parse(createCall.data.metadata);
    expect(metadata.correctedAnswer).toBe('The correct revenue is $50M, not $500M.');
    expect(metadata.feedbackType).toBe('correction');
  });

  // ── Test 4: recordFeedback handles DB errors gracefully ──
  it('recordFeedback handles DB errors gracefully', async () => {
    // Both update and create throw
    mockUpdate.mockRejectedValue(new Error('DB connection lost'));
    mockCreate.mockRejectedValue(new Error('DB connection lost'));

    // Should NOT throw — feedback recording is non-blocking
    const feedbackId = await recordFeedback({
      insightId: 'insight-4',
      generationType: 'scoring',
      feedbackType: 'positive',
    });

    // Should still return a feedback ID (generated client-side)
    expect(feedbackId).toBeTruthy();
  });

  // ── Test 5: getFeedbackAnalytics returns aggregated stats ──
  it('getFeedbackAnalytics returns aggregated stats', async () => {
    // Mock DB returning feedback records
    mockFindMany.mockResolvedValue([
      {
        id: 'fb-1',
        metadata: JSON.stringify({
          _feedbackRecord: true,
          insightId: 'insight-1',
          generationType: 'scoring',
          feedbackType: 'positive',
          userComment: 'Good',
          createdAt: '2024-01-01T00:00:00Z',
        }),
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'fb-2',
        metadata: JSON.stringify({
          _feedbackRecord: true,
          insightId: 'insight-2',
          generationType: 'scoring',
          feedbackType: 'negative',
          userComment: 'Bad',
          createdAt: '2024-01-02T00:00:00Z',
        }),
        createdAt: new Date('2024-01-02'),
      },
      {
        id: 'fb-3',
        metadata: JSON.stringify({
          _feedbackRecord: true,
          insightId: 'insight-3',
          generationType: 'recommendation',
          feedbackType: 'positive',
          createdAt: '2024-01-03T00:00:00Z',
        }),
        createdAt: new Date('2024-01-03'),
      },
      {
        id: 'fb-4',
        metadata: JSON.stringify({
          _feedbackRecord: true,
          insightId: 'insight-4',
          generationType: 'scoring',
          feedbackType: 'correction',
          correctedAnswer: 'Fixed answer',
          createdAt: '2024-01-04T00:00:00Z',
        }),
        createdAt: new Date('2024-01-04'),
      },
    ]);

    const analytics = await getFeedbackAnalytics(30);

    expect(analytics.totalFeedback).toBe(4);
    // 2 positive out of 4 = 50%
    expect(analytics.approvalRate).toBe(50.0);
    // 1 negative out of 4 = 25%
    expect(analytics.negativeRate).toBe(25.0);
    // 1 correction out of 4 = 25%
    expect(analytics.correctionRate).toBe(25.0);
    // By-type breakdown
    expect(analytics.byType['scoring']).toBeDefined();
    expect(analytics.byType['scoring'].positive).toBe(1);
    expect(analytics.byType['scoring'].negative).toBe(1);
    expect(analytics.byType['scoring'].corrections).toBe(1);
    expect(analytics.byType['recommendation'].positive).toBe(1);
    // Recent corrections
    expect(analytics.recentCorrections.length).toBe(1);
    expect(analytics.recentCorrections[0].comment).toBe('Fixed answer');
  });

  // ── Test 6: getFeedbackAnalytics handles empty data ──
  it('getFeedbackAnalytics handles empty data', async () => {
    mockFindMany.mockResolvedValue([]);

    const analytics = await getFeedbackAnalytics();

    expect(analytics.totalFeedback).toBe(0);
    expect(analytics.approvalRate).toBe(100); // Default: 100% when no data
    expect(analytics.negativeRate).toBe(0);
    expect(analytics.correctionRate).toBe(0);
    expect(analytics.byType).toEqual({});
    expect(analytics.recentCorrections).toEqual([]);
  });
});
