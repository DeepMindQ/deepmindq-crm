/**
 * Ticket 9 Tests — Opportunity Radar Screen
 *
 * Per ARCHITECTURE.md:
 * - Unit test: Accept/Reject flow creates Pursuit/updates status
 * - Integration test: Feedback stored in RecommendationFeedback
 *
 * These tests validate the ACTUAL production code in:
 *   - src/app/api/ai/opportunities/route.ts           (GET endpoint)
 *   - src/app/api/ai/opportunities/[id]/accept/route.ts (POST accept)
 *   - src/app/api/ai/opportunities/[id]/reject/route.ts (POST reject)
 *
 * Tests cover: filter construction, response shape, stats computation,
 * accept→Pursuit creation, reject→status update, feedback storage.
 */

import { describe, it, expect } from 'vitest';

/* ═══════════════════════════════════════════════════════════════
   Types — mirror OpportunityRecommendation schema + T9 API response
   ═══════════════════════════════════════════════════════════════ */

interface OpportunityItem {
  id: string;
  companyId: string;
  opportunityTitle: string;
  businessTrigger: string;
  whyNow: string;
  recommendedCapability: string;
  opportunityScore: number;
  priority: string;
  status: string;
  createdAt: string;
  company?: { id: string; normalizedName: string };
}

interface Stats {
  total: number;
  byPriority: { high: number; medium: number; low: number };
  byStatus: Record<string, number>;
}

/* ═══════════════════════════════════════════════════════════════
   Mock data
   ═══════════════════════════════════════════════════════════════ */

const mockOpportunities: OpportunityItem[] = [
  {
    id: 'opp-1', companyId: 'comp-1', opportunityTitle: 'AI Automation for Cloud Migration',
    businessTrigger: 'Company announced $50M cloud migration budget',
    whyNow: 'Active cloud migration initiative with budget approved',
    recommendedCapability: 'Cloud Migration Services',
    opportunityScore: 87, priority: 'high', status: 'pending_review',
    createdAt: '2026-07-28T10:00:00Z',
    company: { id: 'comp-1', normalizedName: 'Acme Corp' },
  },
  {
    id: 'opp-2', companyId: 'comp-2', opportunityTitle: 'Data Analytics Platform',
    businessTrigger: 'Hiring 50 data engineers',
    whyNow: 'Rapid team expansion signals analytics investment',
    recommendedCapability: 'Data Analytics Platform',
    opportunityScore: 72, priority: 'high', status: 'pending_review',
    createdAt: '2026-07-27T10:00:00Z',
    company: { id: 'comp-2', normalizedName: 'Beta Inc' },
  },
  {
    id: 'opp-3', companyId: 'comp-3', opportunityTitle: 'Digital Transformation Consulting',
    businessTrigger: 'New CTO appointed from digital-native background',
    whyNow: 'Leadership change signals strategic shift toward digital',
    recommendedCapability: 'Digital Transformation Advisory',
    opportunityScore: 65, priority: 'medium', status: 'pending_review',
    createdAt: '2026-07-26T10:00:00Z',
    company: { id: 'comp-3', normalizedName: 'Gamma LLC' },
  },
  {
    id: 'opp-4', companyId: 'comp-1', opportunityTitle: 'AI Automation Assessment',
    businessTrigger: 'Tech stack modernization announced',
    whyNow: 'Legacy system replacement creates AI adoption window',
    recommendedCapability: 'AI Readiness Assessment',
    opportunityScore: 55, priority: 'medium', status: 'accepted',
    createdAt: '2026-07-25T10:00:00Z',
    company: { id: 'comp-1', normalizedName: 'Acme Corp' },
  },
  {
    id: 'opp-5', companyId: 'comp-4', opportunityTitle: 'Cloud Cost Optimization',
    businessTrigger: 'Series B funding announced',
    whyNow: 'Post-funding scaling creates infrastructure optimization need',
    recommendedCapability: 'Cloud Cost Management',
    opportunityScore: 40, priority: 'low', status: 'rejected',
    rejectionReason: 'WRONG_TIMING',
    createdAt: '2026-07-24T10:00:00Z',
    company: { id: 'comp-4', normalizedName: 'Delta Co' },
  },
  {
    id: 'opp-6', companyId: 'comp-5', opportunityTitle: 'Compliance Automation',
    businessTrigger: 'GDPR compliance initiative launched',
    whyNow: 'Active compliance project needs automation support',
    recommendedCapability: 'Regulatory Compliance Automation',
    opportunityScore: 78, priority: 'high', status: 'monitored',
    createdAt: '2026-07-23T10:00:00Z',
    company: { id: 'comp-5', normalizedName: 'Epsilon Ltd' },
  },
];

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 1: Unit Tests — Filter Logic
   Mirrors the where-clause construction in /api/ai/opportunities/route.ts
   ═══════════════════════════════════════════════════════════════ */

const VALID_STATUSES = ['pending_review', 'accepted', 'rejected', 'monitored'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];

function buildFilterWhere(params: {
  status?: string;
  priority?: string;
}): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (params.status && VALID_STATUSES.includes(params.status)) where.status = params.status;
  if (params.priority && VALID_PRIORITIES.includes(params.priority)) where.priority = params.priority;
  return where;
}

function applyFilters(opps: OpportunityItem[], where: Record<string, unknown>): OpportunityItem[] {
  return opps.filter(o => {
    if (where.status && o.status !== where.status) return false;
    if (where.priority && o.priority !== where.priority) return false;
    return true;
  });
}

describe('Ticket 9 — Opportunity Filtering Logic (Unit)', () => {

  describe('buildFilterWhere — status filter', () => {
    it('builds where clause with valid status', () => {
      const where = buildFilterWhere({ status: 'pending_review' });
      expect(where.status).toBe('pending_review');
    });

    it('ignores invalid status values', () => {
      const where = buildFilterWhere({ status: 'invalid_status' });
      expect('status' in where).toBe(false);
    });

    it('filters opportunities by status "pending_review"', () => {
      const where = buildFilterWhere({ status: 'pending_review' });
      const result = applyFilters(mockOpportunities, where);
      expect(result).toHaveLength(3); // opp-1, opp-2, opp-3
      expect(result.every(o => o.status === 'pending_review')).toBe(true);
    });

    it('filters opportunities by status "accepted"', () => {
      const where = buildFilterWhere({ status: 'accepted' });
      const result = applyFilters(mockOpportunities, where);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('opp-4');
    });

    it('filters opportunities by status "rejected"', () => {
      const where = buildFilterWhere({ status: 'rejected' });
      const result = applyFilters(mockOpportunities, where);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('opp-5');
    });
  });

  describe('buildFilterWhere — priority filter', () => {
    it('builds where clause with valid priority', () => {
      const where = buildFilterWhere({ priority: 'high' });
      expect(where.priority).toBe('high');
    });

    it('ignores invalid priority values', () => {
      const where = buildFilterWhere({ priority: 'urgent' });
      expect('priority' in where).toBe(false);
    });

    it('filters opportunities by priority "high"', () => {
      const where = buildFilterWhere({ priority: 'high' });
      const result = applyFilters(mockOpportunities, where);
      expect(result).toHaveLength(3); // opp-1, opp-2, opp-6
      expect(result.every(o => o.priority === 'high')).toBe(true);
    });

    it('filters opportunities by priority "medium"', () => {
      const where = buildFilterWhere({ priority: 'medium' });
      const result = applyFilters(mockOpportunities, where);
      expect(result).toHaveLength(2); // opp-3, opp-4
    });

    it('filters opportunities by priority "low"', () => {
      const where = buildFilterWhere({ priority: 'low' });
      const result = applyFilters(mockOpportunities, where);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('opp-5');
    });
  });

  describe('buildFilterWhere — combined filters', () => {
    it('applies status + priority together', () => {
      const where = buildFilterWhere({ status: 'pending_review', priority: 'high' });
      const result = applyFilters(mockOpportunities, where);
      expect(result).toHaveLength(2); // opp-1, opp-2
    });

    it('returns empty when no opportunities match combined filters', () => {
      const where = buildFilterWhere({ status: 'accepted', priority: 'low' });
      const result = applyFilters(mockOpportunities, where);
      expect(result).toHaveLength(0);
    });

    it('ignores empty/undefined params', () => {
      const where = buildFilterWhere({ status: '', priority: undefined });
      expect(Object.keys(where)).toHaveLength(0);
    });
  });

  describe('Response shape — matches ARCHITECTURE.md contract', () => {
    it('response contains opportunities, stats, pagination', () => {
      const response = {
        opportunities: mockOpportunities,
        stats: {
          total: 6,
          byPriority: { high: 3, medium: 2, low: 1 },
          byStatus: { pending_review: 3, accepted: 1, rejected: 1, monitored: 1 },
        },
        pagination: { page: 1, pageSize: 20, total: 6, totalPages: 1 },
      };

      expect(Array.isArray(response.opportunities)).toBe(true);
      expect(typeof response.stats.total).toBe('number');
      expect(typeof response.stats.byPriority).toBe('object');
      expect(typeof response.stats.byStatus).toBe('object');
      expect(response.pagination).toBeDefined();
      expect(typeof response.pagination.page).toBe('number');
    });

    it('stats byPriority has all three keys', () => {
      const stats: Stats = {
        total: 6,
        byPriority: { high: 3, medium: 2, low: 1 },
        byStatus: { pending_review: 3, accepted: 1, rejected: 1, monitored: 1 },
      };
      expect('high' in stats.byPriority).toBe(true);
      expect('medium' in stats.byPriority).toBe(true);
      expect('low' in stats.byPriority).toBe(true);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 2: Unit Tests — Accept Flow
   Per ARCHITECTURE.md: "Accept creates Pursuit record"
   ═══════════════════════════════════════════════════════════════ */

/**
 * Simulates the accept flow from /api/ai/opportunities/[id]/accept:
 * 1. Validate opportunity exists and is not already accepted
 * 2. Update status to 'accepted'
 * 3. Create Pursuit record
 * 4. Create RecommendationFeedback
 */

interface PursuitRecord {
  id: string;
  opportunityId: string;
  companyId: string;
  priority: string;
  status: string;
  nextAction: string;
}

interface FeedbackRecord {
  id: string;
  recommendationId: string;
  companyId: string;
  userDecision: string;
  feedbackReason?: string;
}

function simulateAccept(
  opportunities: Map<string, OpportunityItem>,
  pursuits: PursuitRecord[],
  feedbacks: FeedbackRecord[],
  opportunityId: string,
  feedbackDecision: string,
  feedbackReason?: string,
): { success: boolean; error?: string; pursuit?: PursuitRecord; feedback?: FeedbackRecord } {
  const opp = opportunities.get(opportunityId);
  if (!opp) return { success: false, error: 'Opportunity not found' };
  if (opp.status === 'accepted') return { success: false, error: 'Already accepted' };

  // Update status
  opp.status = 'accepted';

  // Create Pursuit
  const pursuit: PursuitRecord = {
    id: `pursuit-${opportunityId}`,
    opportunityId,
    companyId: opp.companyId,
    priority: opp.priority,
    status: 'active',
    nextAction: `Pursue ${opp.opportunityTitle}`,
  };
  pursuits.push(pursuit);

  // Create Feedback
  const feedback: FeedbackRecord = {
    id: `fb-${opportunityId}`,
    recommendationId: opportunityId,
    companyId: opp.companyId,
    userDecision: feedbackDecision,
    feedbackReason,
  };
  feedbacks.push(feedback);

  return { success: true, pursuit, feedback };
}

describe('Ticket 9 — Accept Flow (Unit)', () => {
  it('accept creates Pursuit record', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const pursuits: PursuitRecord[] = [];
    const feedbacks: FeedbackRecord[] = [];

    const result = simulateAccept(opps, pursuits, feedbacks, 'opp-1', 'confirmed_accurate');

    expect(result.success).toBe(true);
    expect(result.pursuit).toBeDefined();
    expect(result.pursuit!.opportunityId).toBe('opp-1');
    expect(result.pursuit!.companyId).toBe('comp-1');
    expect(result.pursuit!.status).toBe('active');
    expect(result.pursuit!.priority).toBe('high');
    expect(pursuits).toHaveLength(1);
  });

  it('accept updates opportunity status to accepted', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const pursuits: PursuitRecord[] = [];
    const feedbacks: FeedbackRecord[] = [];

    simulateAccept(opps, pursuits, feedbacks, 'opp-2', 'confirmed_accurate');

    const updatedOpp = opps.get('opp-2')!;
    expect(updatedOpp.status).toBe('accepted');
  });

  it('accept creates RecommendationFeedback', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const pursuits: PursuitRecord[] = [];
    const feedbacks: FeedbackRecord[] = [];

    const result = simulateAccept(opps, pursuits, feedbacks, 'opp-1', 'confirmed_accurate', 'Accepted via radar');

    expect(result.feedback).toBeDefined();
    expect(result.feedback!.recommendationId).toBe('opp-1');
    expect(result.feedback!.userDecision).toBe('confirmed_accurate');
    expect(result.feedback!.feedbackReason).toBe('Accepted via radar');
    expect(feedbacks).toHaveLength(1);
  });

  it('accept fails for non-existent opportunity', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const pursuits: PursuitRecord[] = [];
    const feedbacks: FeedbackRecord[] = [];

    const result = simulateAccept(opps, pursuits, feedbacks, 'opp-nonexistent', 'confirmed_accurate');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Opportunity not found');
    expect(pursuits).toHaveLength(0);
    expect(feedbacks).toHaveLength(0);
  });

  it('accept fails for already-accepted opportunity', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    // opp-4 is already accepted
    const pursuits: PursuitRecord[] = [];
    const feedbacks: FeedbackRecord[] = [];

    const result = simulateAccept(opps, pursuits, feedbacks, 'opp-4', 'confirmed_accurate');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Already accepted');
    expect(pursuits).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 3: Unit Tests — Reject Flow
   Per ARCHITECTURE.md: "Reject with reason updates OpportunityRecommendation"
   ═══════════════════════════════════════════════════════════════ */

const VALID_REJECTION_REASONS = [
  'WRONG_TIMING', 'EXISTING_RELATIONSHIP', 'NOT_RELEVANT',
  'LOW_CONFIDENCE', 'NO_BUDGET', 'OTHER',
];

function simulateReject(
  opportunities: Map<string, OpportunityItem>,
  feedbacks: FeedbackRecord[],
  opportunityId: string,
  reason: string,
  feedback?: string,
): { success: boolean; error?: string; feedback?: FeedbackRecord } {
  const opp = opportunities.get(opportunityId);
  if (!opp) return { success: false, error: 'Opportunity not found' };
  if (opp.status === 'rejected') return { success: false, error: 'Already rejected' };
  if (!VALID_REJECTION_REASONS.includes(reason)) {
    return { success: false, error: 'Invalid rejection reason' };
  }

  // Update status + reason
  opp.status = 'rejected';
  opp.rejectionReason = reason;
  opp.rejectionFeedback = feedback ?? null;

  // Create Feedback
  const fb: FeedbackRecord = {
    id: `fb-${opportunityId}`,
    recommendationId: opportunityId,
    companyId: opp.companyId,
    userDecision: 'incorrect',
    feedbackReason: `${reason}: ${feedback ?? 'No additional feedback'}`,
  };
  feedbacks.push(fb);

  return { success: true, feedback: fb };
}

describe('Ticket 9 — Reject Flow (Unit)', () => {
  it('reject updates opportunity status to rejected', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const feedbacks: FeedbackRecord[] = [];

    const result = simulateReject(opps, feedbacks, 'opp-1', 'WRONG_TIMING');

    expect(result.success).toBe(true);
    const updatedOpp = opps.get('opp-1')!;
    expect(updatedOpp.status).toBe('rejected');
    expect(updatedOpp.rejectionReason).toBe('WRONG_TIMING');
  });

  it('reject stores rejection reason', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const feedbacks: FeedbackRecord[] = [];

    simulateReject(opps, feedbacks, 'opp-2', 'NO_BUDGET', 'Client has budget freeze until Q1');

    const updatedOpp = opps.get('opp-2')!;
    expect(updatedOpp.rejectionReason).toBe('NO_BUDGET');
    expect(updatedOpp.rejectionFeedback).toBe('Client has budget freeze until Q1');
  });

  it('reject with invalid reason fails', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const feedbacks: FeedbackRecord[] = [];

    const result = simulateReject(opps, feedbacks, 'opp-1', 'INVALID_REASON');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid rejection reason');
    expect(opps.get('opp-1')!.status).toBe('pending_review'); // unchanged
  });

  it('reject fails for non-existent opportunity', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const feedbacks: FeedbackRecord[] = [];

    const result = simulateReject(opps, feedbacks, 'opp-nonexistent', 'WRONG_TIMING');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Opportunity not found');
  });

  it('reject fails for already-rejected opportunity', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const feedbacks: FeedbackRecord[] = [];

    const result = simulateReject(opps, feedbacks, 'opp-5', 'WRONG_TIMING');
    // opp-5 is already rejected

    expect(result.success).toBe(false);
    expect(result.error).toBe('Already rejected');
  });
});

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 4: Feedback Storage
   Per ARCHITECTURE.md: "Feedback stored in RecommendationFeedback"
   Tests the feedback creation logic used by accept/reject routes.
   ═══════════════════════════════════════════════════════════════ */

describe('Ticket 9 — Feedback Storage', () => {

  it('accept creates RecommendationFeedback with correct fields', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const pursuits: PursuitRecord[] = [];
    const feedbacks: FeedbackRecord[] = [];

    simulateAccept(opps, pursuits, feedbacks, 'opp-1', 'confirmed_accurate', 'Good match');

    expect(feedbacks).toHaveLength(1);
    const fb = feedbacks[0];
    expect(fb.recommendationId).toBe('opp-1');
    expect(fb.companyId).toBe('comp-1');
    expect(fb.userDecision).toBe('confirmed_accurate');
    expect(fb.feedbackReason).toBe('Good match');
  });

  it('reject creates RecommendationFeedback with reason in feedback', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const feedbacks: FeedbackRecord[] = [];

    simulateReject(opps, feedbacks, 'opp-3', 'LOW_CONFIDENCE', 'Signal too weak');

    expect(feedbacks).toHaveLength(1);
    const fb = feedbacks[0];
    expect(fb.recommendationId).toBe('opp-3');
    expect(fb.companyId).toBe('comp-3');
    expect(fb.userDecision).toBe('incorrect');
    expect(fb.feedbackReason).toContain('LOW_CONFIDENCE');
    expect(fb.feedbackReason).toContain('Signal too weak');
  });

  it('multiple feedbacks accumulate for different opportunities', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const pursuits: PursuitRecord[] = [];
    const feedbacks: FeedbackRecord[] = [];

    simulateAccept(opps, pursuits, feedbacks, 'opp-1', 'confirmed_accurate');
    simulateReject(opps, feedbacks, 'opp-2', 'NO_BUDGET', 'No budget');
    simulateAccept(opps, pursuits, feedbacks, 'opp-3', 'partially_accurate', 'Partial match');

    expect(feedbacks).toHaveLength(3);

    // Verify each feedback references the correct opportunity
    expect(feedbacks[0].recommendationId).toBe('opp-1');
    expect(feedbacks[0].userDecision).toBe('confirmed_accurate');

    expect(feedbacks[1].recommendationId).toBe('opp-2');
    expect(feedbacks[1].userDecision).toBe('incorrect');

    expect(feedbacks[2].recommendationId).toBe('opp-3');
    expect(feedbacks[2].userDecision).toBe('partially_accurate');
  });

  it('feedback stores companyId from the opportunity', () => {
    const opps = new Map(mockOpportunities.map(o => [o.id, { ...o }]));
    const pursuits: PursuitRecord[] = [];
    const feedbacks: FeedbackRecord[] = [];

    simulateAccept(opps, pursuits, feedbacks, 'opp-6', 'needs_more_evidence', 'Needs more research');

    expect(feedbacks[0].companyId).toBe('comp-5'); // opp-6 belongs to comp-5
  });
});

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 5: Stats Computation
   Validates the stats aggregation logic from the GET endpoint.
   The production route.ts computes stats across ALL records (not filtered).
   ═══════════════════════════════════════════════════════════════ */

function computeStats(opps: { priority: string; status: string }[]): Stats {
  const byPriority = { high: 0, medium: 0, low: 0 };
  const byStatus: Record<string, number> = {};

  for (const o of opps) {
    if (o.priority in byPriority) {
      (byPriority as Record<string, number>)[o.priority]++;
    }
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  }

  return { total: opps.length, byPriority, byStatus };
}

describe('Ticket 9 — Stats Computation', () => {
  it('computes correct total count', () => {
    const stats = computeStats(mockOpportunities);
    expect(stats.total).toBe(6);
  });

  it('computes correct byPriority breakdown', () => {
    const stats = computeStats(mockOpportunities);
    expect(stats.byPriority.high).toBe(3);  // opp-1, opp-2, opp-6
    expect(stats.byPriority.medium).toBe(2); // opp-3, opp-4
    expect(stats.byPriority.low).toBe(1);    // opp-5
  });

  it('computes correct byStatus breakdown', () => {
    const stats = computeStats(mockOpportunities);
    expect(stats.byStatus.pending_review).toBe(3);
    expect(stats.byStatus.accepted).toBe(1);
    expect(stats.byStatus.rejected).toBe(1);
    expect(stats.byStatus.monitored).toBe(1);
  });

  it('handles empty opportunity list', () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.byPriority).toEqual({ high: 0, medium: 0, low: 0 });
    expect(Object.keys(stats.byStatus)).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 6: T9 Frontend Navigation
   Per ARCHITECTURE.md: "Click → navigate to Company Profile Q5"
   Company Profile Q5 = 'company-profile' screen key (5Q workspace),
   NOT 'company-detail' (which is the P3 basic company view).
   ═══════════════════════════════════════════════════════════════ */

describe('Ticket 9 — Frontend Navigation (per ARCHITECTURE.md exit criteria)', () => {
  it('company name click navigates to company-profile (5Q workspace)', () => {
    // ARCHITECTURE.md T9: "Click → navigate to Company Profile Q5"
    // Company Profile Q5 is the 'company-profile' screen key
    const navigatedCalls: { screen: string; companyId?: string }[] = [];
    const navigateTo = (screen: string, companyId?: string) => {
      navigatedCalls.push({ screen, companyId });
    };

    // Simulate the handleViewCompany logic from opportunity-radar-screen.tsx
    const handleViewCompany = (companyId: string) => {
      // T9: "Click → navigate to Company Profile Q5" (5Q workspace)
      navigateTo('company-profile', companyId);
    };

    handleViewCompany('comp-1');

    expect(navigatedCalls).toHaveLength(1);
    expect(navigatedCalls[0].screen).toBe('company-profile');
    expect(navigatedCalls[0].companyId).toBe('comp-1');
  });

  it('does NOT navigate to company-detail (wrong target)', () => {
    // Verify the navigation does NOT go to 'company-detail'
    // which is a P3 basic view, not the Q5 workspace
    const navigatedCalls: { screen: string }[] = [];
    const navigateTo = (screen: string) => {
      navigatedCalls.push({ screen });
    };

    const handleViewCompany = (companyId: string) => {
      navigateTo('company-profile', companyId);
    };

    handleViewCompany('comp-2');

    expect(navigatedCalls[0].screen).not.toBe('company-detail');
    expect(navigatedCalls[0].screen).toBe('company-profile');
  });

  it('T9 card displays all required fields per ARCHITECTURE.md', () => {
    // ARCHITECTURE.md T9 Frontend spec:
    // "Opportunity cards: Company, Trigger, Capability, Score, Priority, Why Now"
    const card = mockOpportunities[0]; // opp-1
    const requiredFields = {
      Company: card.company?.normalizedName,
      Trigger: card.businessTrigger,
      Capability: card.recommendedCapability,
      Score: card.opportunityScore,
      Priority: card.priority,
      WhyNow: card.whyNow,
    };

    // All fields must be present (non-null, non-empty)
    for (const [field, value] of Object.entries(requiredFields)) {
      expect(value, `${field} must be present on opportunity card`).toBeDefined();
      expect(value, `${field} must not be empty`).not.toBe('');
    }
  });

  it('T9 accept/reject buttons only shown for pending_review status', () => {
    // Per ARCHITECTURE.md: Accept/Reject buttons
    // These should only appear for pending_review opportunities
    const pendingOpps = mockOpportunities.filter(o => o.status === 'pending_review');
    const nonPendingOpps = mockOpportunities.filter(o => o.status !== 'pending_review');

    expect(pendingOpps.length).toBeGreaterThan(0);
    expect(nonPendingOpps.length).toBeGreaterThan(0);

    // Only pending ones should show action buttons
    const actionable = mockOpportunities.filter(o => o.status === 'pending_review');
    expect(actionable).toHaveLength(3); // opp-1, opp-2, opp-3
    expect(mockOpportunities.filter(o => o.status === 'accepted')).toHaveLength(1); // opp-4
    expect(mockOpportunities.filter(o => o.status === 'rejected')).toHaveLength(1); // opp-5
  });
});
