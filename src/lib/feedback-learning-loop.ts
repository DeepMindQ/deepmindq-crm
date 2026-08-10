/**
 * WI-17E — Feedback Learning Loop
 *
 * Turns DeepMindQ from an intelligence system into a learning system.
 *
 * Every recommendation generates an opinion.
 * Every user feedback validates or corrects that opinion.
 * Every correction improves future recommendations.
 *
 * Architecture:
 *
 *   User Interaction
 *       ↓
 *   Feedback Capture (thumbs up/down + reason + correction)
 *       ↓
 *   Institutional Memory Update (learning patterns stored)
 *       ↓
 *   Confidence Calibration (signal/recommendation accuracy adjusted)
 *       ↓
 *   Learning Event Creation (win/loss patterns tracked)
 *       ↓
 *   Better Future Recommendations
 *
 * Key Design Decisions:
 *   - Feedback is NOT a generic widget — it improves intelligence quality
 *   - Every feedback creates a Memory item (WI-16H institutional layer)
 *   - Every feedback can calibrate confidence for similar future patterns
 *   - Feedback reasons are categorized, not free-form only
 *   - Positive feedback increases confidence; negative feedback decreases it
 *   - Calibration is gradual — no single feedback overwrites learned patterns
 *
 * Integration:
 *   - Reads from WI-17C recommendations
 *   - Writes to WI-16H Memory (institutional layer, learning_insight category)
 *   - Writes to WI-16C Confidence calibration data
 *   - Creates LearningEvent records for outcome tracking
 *   - Reads existing feedback for calibration calculations
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { storeMemory, searchMemories, type MemoryItem, type MemorySource } from '@/lib/ai-memory';
import { generateCompanyRecommendation, type AccountRecommendation } from '@/lib/recommendation-engine';
import { recordOutcome, outcomeToScore } from '@/lib/confidence-calibration-engine';

// ── Types ──────────────────────────────────────────────────────────────────

/** Feedback verdict — what the user thinks of the recommendation. */
export type FeedbackVerdict = 'useful' | 'not_useful' | 'partially_useful' | 'incorrect_action' | 'wrong_account';

/** Feedback reason categories — structured reasons for the verdict. */
export type FeedbackReasonCode =
  | 'converted_opportunity'     // Recommendation led to a conversion
  | 'meeting_scheduled'          // Recommendation led to a meeting
  | 'good_timing'               // Timing was right for outreach
  | 'accurate_signals'           // Signals were correct
  | 'wrong_decision_maker'      // Contact/role recommendation was wrong
  | 'bad_timing'                 // Too early or too late
  | 'already_customer'           // Company is already a customer
  | 'already_engaged'            // Already being pursued by someone else
  | 'incorrect_technology'       // Technology detection was wrong
  | 'vendor_relationship'        // Missed or overstated vendor relationship
  | 'low_budget'                 // No budget for this type of engagement
  | 'not_relevant'               // Recommendation not relevant to this account
  | 'wrong_capability'           // Capability match was incorrect
  | 'data_was_stale'             // Information was outdated
  | 'insufficient_evidence'      // Not enough evidence to act on
  | 'other'                      // User-specified other reason
  | null;                        // No reason specified

/** Actual outcome — what happened after the recommendation. */
export type ActualOutcome =
  | 'converted'                  // Deal closed
  | 'opportunity_created'        // Opportunity created in pipeline
  | 'meeting_held'               // Meeting took place
  | 'contacted'                  // Outreach made
  | 'rejected'                   // Prospect rejected outreach
  | 'no_response'                // No response received
  | 'lost_to_competitor'         // Lost to competitor
  | 'budget_issue'               // No budget
  | 'wrong_contact'              // Not the right person
  | 'project_cancelled'          // Project was cancelled
  | 'project_delayed'            // Project was delayed
  | null;

/** Feedback submission payload. */
export interface FeedbackSubmission {
  companyId: string;
  verdict: FeedbackVerdict;
  sentiment?: 'positive' | 'negative' | 'neutral';
  feedbackReason?: FeedbackReasonCode;
  feedbackDetail?: string;
  correctSignals?: string[];
  incorrectSignals?: string[];
  correctAction?: boolean;
  actualOutcome?: ActualOutcome;
  userId?: string;
  /** Snapshot of key recommendation fields at feedback time */
  recommendationSnapshot?: {
    priority?: string;
    opportunityScore?: number;
    confidenceGrade?: string;
    topReasons?: string[];
  };
}

/** Feedback processing result — what the system learned. */
export interface FeedbackResult {
  feedbackId: string;
  companyId: string;
  verdict: FeedbackVerdict;
  sentiment: string;

  // What was learned
  memoryCreated: boolean;
  memoryId?: string;
  learningSummary: string;

  // Calibration effects
  calibrationApplied: boolean;
  calibrationDetails?: {
    signalType?: string;
    direction: 'increased' | 'decreased' | 'no_change';
    previousConfidence: number;
    newConfidence: number;
    reason: string;
  };

  // Phase 4.7: Human Validation → Calibration integration
  calibrationRecorded: boolean;
  calibrationDataPointId?: string;

  // Learning event
  learningEventCreated: boolean;
  learningEventId?: string;
}

/** Feedback statistics for a company. */
export interface CompanyFeedbackStats {
  companyId: string;
  totalFeedback: number;
  useful: number;
  notUseful: number;
  partiallyUseful: number;
  incorrect: number;
  positiveRate: number;
  topReasons: Array<{ reason: string; count: number }>;
  outcomes: Array<{ outcome: string; count: number }>;
  lastFeedbackAt: string | null;
}

/** Learning analytics for the entire system. */
export interface LearningAnalytics {
  totalFeedback: number;
  overallUsefulRate: number;
  verdictDistribution: Record<string, number>;
  topReasons: Array<{ reason: string; count: number; usefulRate: number }>;
  outcomeDistribution: Record<string, number>;
  conversionFromRecommendation: number;
  memoriesCreatedFromFeedback: number;
  calibrationEvents: number;
  feedbackTrend: Array<{ period: string; useful: number; notUseful: number; total: number }>;
  generatedAt: string;
}

/** Confidence calibration adjustment. */
export interface CalibrationAdjustment {
  /** The signal type or pattern being calibrated */
  pattern: string;
  /** Direction of adjustment */
  direction: 'up' | 'down';
  /** Magnitude of adjustment (0-1) */
  magnitude: number;
  /** Number of feedback items supporting this adjustment */
  supportingFeedbackCount: number;
  /** Reason for the adjustment */
  reason: string;
}

// ── Human-readable feedback reason labels ──

export const FEEDBACK_REASON_LABELS: Record<string, string> = {
  converted_opportunity: 'Converted to opportunity',
  meeting_scheduled: 'Meeting scheduled',
  good_timing: 'Good timing',
  accurate_signals: 'Signals were accurate',
  wrong_decision_maker: 'Wrong decision maker',
  bad_timing: 'Bad timing',
  already_customer: 'Already a customer',
  already_engaged: 'Already being engaged',
  incorrect_technology: 'Incorrect technology detection',
  vendor_relationship: 'Vendor relationship issue',
  low_budget: 'Low budget',
  not_relevant: 'Not relevant',
  wrong_capability: 'Wrong capability match',
  data_was_stale: 'Data was stale',
  insufficient_evidence: 'Insufficient evidence',
  other: 'Other',
};

// ── Core Engine ────────────────────────────────────────────────────────────

/**
 * Process user feedback on a recommendation.
 * This is the main entry point for the feedback learning loop.
 *
 * Steps:
 *   1. Capture and store feedback
 *   2. Create institutional memory from the feedback
 *   3. Create a learning event if outcome is significant
 *   4. Calibrate confidence based on feedback
 */
export async function processFeedback(
  submission: FeedbackSubmission
): Promise<FeedbackResult> {
  const startTime = Date.now();

  // ── Step 1: Store feedback ──
  const snapshot = submission.recommendationSnapshot || {};
  const feedbackId = await storeFeedbackRecord(submission, snapshot);

  // ── Step 2: Create institutional memory ──
  const memoryResult = await createMemoryFromFeedback(submission, feedbackId);

  // ── Step 3: Create learning event for significant outcomes ──
  let learningEventCreated = false;
  let learningEventId: string | undefined;

  if (submission.actualOutcome || submission.verdict === 'useful' || submission.verdict === 'not_useful') {
    learningEventCreated = true;
    learningEventId = await createLearningEvent(submission, feedbackId);
  }

  // ── Step 4: Calibrate confidence ──
  const calibrationResult = await calibrateFromFeedback(submission);

  // Update feedback record with learning integration
  try {
    await db.intelligenceFeedback.update({
      where: { id: feedbackId },
      data: {
        memoryCreated: memoryResult.created,
        learningEventId,
        calibrationApplied: calibrationResult.applied,
      },
    });
  } catch (err) {
    logger.warn('[FeedbackLoop] Failed to update feedback record:', { error: err });
  }

  // ── Step 5 (Phase 4.7): Record outcome in Confidence Calibration Engine ──
  let calibrationRecorded = false;
  let calibrationDataPointId: string | undefined;

  if (submission.actualOutcome) {
    try {
      // Map the actual outcome to a calibration score
      const actualScore = outcomeToScore(submission.actualOutcome);

      // Get the predicted score from the recommendation snapshot if available
      const predictedScore = snapshot.opportunityScore as number || 50;

      // Determine dimension based on feedback reason
      const dimension = submission.feedbackReason === 'data_was_stale' ? 'freshness'
        : submission.feedbackReason === 'incorrect_technology' ? 'ai_certainty'
        : submission.feedbackReason === 'wrong_decision_maker' ? 'evidence_coverage'
        : 'overall';

      // Determine predicted grade from snapshot confidence
      const predictedGrade = (snapshot.confidenceGrade as string) || 'C';

      const calResult = await recordOutcome({
        id: `cal-${submission.companyId}-${Date.now()}`,
        companyId: submission.companyId,
        dimension,
        predictedScore,
        predictedGrade,
        actualOutcome: submission.actualOutcome,
        actualScore,
        recordedAt: new Date().toISOString(),
      });

      calibrationRecorded = calResult.success;
      calibrationDataPointId = calResult.success ? calResult.calibrationId : undefined;

      logger.info('[FeedbackLoop] Calibration data point recorded (Phase 4.7)', {
        companyId: submission.companyId,
        dimension,
        predictedScore,
        actualOutcome: submission.actualOutcome,
        actualScore,
        calibrationRecorded,
      });
    } catch (err) {
      logger.warn('[FeedbackLoop] Failed to record calibration data point (Phase 4.7):', { error: err });
    }
  }

  logger.info('[FeedbackLoop] Feedback processed', {
    feedbackId,
    companyId: submission.companyId,
    verdict: submission.verdict,
    memoryCreated: memoryResult.created,
    calibrationApplied: calibrationResult.applied,
    calibrationRecorded,
    learningEventCreated,
    durationMs: Date.now() - startTime,
  });

  return {
    feedbackId,
    companyId: submission.companyId,
    verdict: submission.verdict,
    sentiment: submission.sentiment || determineSentiment(submission.verdict),
    memoryCreated: memoryResult.created,
    memoryId: memoryResult.memoryId,
    learningSummary: memoryResult.summary,
    calibrationApplied: calibrationResult.applied,
    calibrationDetails: calibrationResult.details,
    calibrationRecorded,
    calibrationDataPointId,
    learningEventCreated,
    learningEventId,
  };
}

// ── Feedback Storage ──

async function storeFeedbackRecord(
  submission: FeedbackSubmission,
  snapshot: Record<string, unknown>
): Promise<string> {
  try {
    const record = await db.intelligenceFeedback.create({
      data: {
        companyId: submission.companyId,
        recommendationSnapshot: JSON.stringify(snapshot),
        verdict: submission.verdict,
        sentiment: submission.sentiment || determineSentiment(submission.verdict),
        feedbackReason: submission.feedbackReason || null,
        feedbackDetail: submission.feedbackDetail || null,
        correctSignals: JSON.stringify(submission.correctSignals || []),
        incorrectSignals: JSON.stringify(submission.incorrectSignals || []),
        correctAction: submission.correctAction ?? null,
        actualOutcome: submission.actualOutcome || null,
        priorityAtFeedback: snapshot.priority as string || null,
        scoreAtFeedback: snapshot.opportunityScore as number || null,
        confidenceAtFeedback: snapshot.confidenceGrade as string || null,
        userId: submission.userId || null,
      },
    });
    return record.id;
  } catch (err) {
    logger.error('[FeedbackLoop] Failed to store feedback:', { error: err });
    throw err;
  }
}

// ── Memory Creation from Feedback ──

async function createMemoryFromFeedback(
  submission: FeedbackSubmission,
  feedbackId: string
): Promise<{ created: boolean; memoryId?: string; summary: string }> {
  try {
    // Fetch company for context
    const company = await db.company.findUnique({
      where: { id: submission.companyId },
      select: { id: true, rawName: true, industry: true, domain: true, sizeRange: true, source: true },
    });

    const companyName = company?.rawName || 'Unknown Company';

    // Determine what to learn
    const isPositive = submission.verdict === 'useful' || submission.verdict === 'partially_useful';
    const isNegative = submission.verdict === 'not_useful' || submission.verdict === 'incorrect_action' || submission.verdict === 'wrong_account';

    let memoryContent: string;
    let memorySummary: string;
    let memoryImportance: number;
    let memoryConfidence: number;

    if (submission.verdict === 'useful' && submission.actualOutcome === 'converted') {
      // Highest value learning: conversion
      memoryContent = buildConversionLearningContent(submission, companyName, company);
      memorySummary = `Conversion: ${submission.feedbackReason || 'recommendation followed'} for ${companyName}`;
      memoryImportance = 1.0;
      memoryConfidence = 0.95;
    } else if (isPositive) {
      // Positive feedback
      memoryContent = buildPositiveLearningContent(submission, companyName, company);
      memorySummary = `Positive signal: ${companyName} — ${submission.feedbackReason || 'recommendation was useful'}`;
      memoryImportance = 0.7;
      memoryConfidence = 0.80;
    } else if (isNegative) {
      // Negative feedback — most valuable for learning
      memoryContent = buildNegativeLearningContent(submission, companyName, company);
      memorySummary = `Correction: ${companyName} — ${submission.feedbackReason || 'recommendation was wrong'}`;
      memoryImportance = 0.8; // Negative feedback is high importance for learning
      memoryConfidence = 0.75;
    } else {
      // Partially useful
      memoryContent = buildPartialLearningContent(submission, companyName, company);
      memorySummary = `Partial: ${companyName} — ${submission.feedbackReason || 'partially accurate'}`;
      memoryImportance = 0.5;
      memoryConfidence = 0.60;
    }

    // Build tags from company context
    const tags: string[] = [];
    if (company?.industry) tags.push(company.industry);
    if (company?.sizeRange) tags.push(company.sizeRange);
    if (submission.feedbackReason) tags.push(submission.feedbackReason);
    if (submission.actualOutcome) tags.push(submission.actualOutcome);
    tags.push('feedback_learning');
    tags.push(submission.verdict);

    // Store in institutional memory layer
    const memoryId = `feedback-${feedbackId}-${Date.now()}`;

    storeMemory({
      id: memoryId,
      layer: 'institutional',
      category: 'learning_insight',
      priority: memoryImportance >= 0.8 ? 'critical' : memoryImportance >= 0.5 ? 'high' : 'medium',
      scope: {
        entityType: 'company',
        entityId: submission.companyId,
      },
      content: memoryContent,
      summary: memorySummary,
      tags,
      referencedEntityIds: [submission.companyId, feedbackId],
      source: {
        type: 'human_intelligence',
        description: `User feedback on recommendation — ${submission.verdict}`,
        sourceId: feedbackId,
        sourceTimestamp: Date.now(),
      },
      confidence: memoryConfidence,
      importance: memoryImportance,
      metadata: {
        feedbackId,
        verdict: submission.verdict,
        reason: submission.feedbackReason,
        outcome: submission.actualOutcome,
        companyName,
        snapshot: submission.recommendationSnapshot,
      },
      lastAccessedAt: Date.now(),
      expiresAt: undefined, // Institutional memories don't expire
    });

    return {
      created: true,
      memoryId,
      summary: memorySummary,
    };
  } catch (err) {
    logger.warn('[FeedbackLoop] Memory creation failed:', { error: err, companyId: submission.companyId });
    return {
      created: false,
      summary: 'Memory creation failed — feedback still recorded',
    };
  }
}

// ── Learning Content Builders ──

function buildConversionLearningContent(
  submission: FeedbackSubmission,
  companyName: string,
  company: { industry?: string | null; domain?: string | null; sizeRange?: string | null } | null
): string {
  const parts: string[] = [
    `CONVERSION LEARNING: Recommendation for ${companyName} led to a successful conversion.`,
    `Feedback reason: ${submission.feedbackReason || 'Not specified'}.`,
    `This pattern should be reinforced: similar companies with similar signals and context are high-probability targets.`,
  ];

  if (company?.industry) parts.push(`Industry context: ${company.industry}.`);
  if (company?.sizeRange) parts.push(`Company size: ${company.sizeRange}.`);
  if (submission.correctSignals?.length) parts.push(`Accurate signals: ${submission.correctSignals.length} signals confirmed correct.`);
  if (submission.feedbackDetail) parts.push(`User note: ${submission.feedbackDetail}`);

  return parts.join(' ');
}

function buildPositiveLearningContent(
  submission: FeedbackSubmission,
  companyName: string,
  company: { industry?: string | null; domain?: string | null; sizeRange?: string | null } | null
): string {
  const parts: string[] = [
    `POSITIVE FEEDBACK: Recommendation for ${companyName} was marked as useful.`,
    `Reason: ${submission.feedbackReason || 'Not specified'}.`,
    `This signal pattern is validated. Similar recommendations should maintain or increase confidence.`,
  ];

  if (company?.industry) parts.push(`Industry: ${company.industry}.`);
  if (submission.correctAction === true) parts.push('Recommended action was appropriate.');
  if (submission.correctSignals?.length) parts.push(`Correct signals: ${submission.correctSignals.join(', ')}.`);
  if (submission.feedbackDetail) parts.push(`Detail: ${submission.feedbackDetail}`);

  return parts.join(' ');
}

function buildNegativeLearningContent(
  submission: FeedbackSubmission,
  companyName: string,
  company: { industry?: string | null; domain?: string | null; sizeRange?: string | null } | null
): string {
  const parts: string[] = [
    `CORRECTION LEARNING: Recommendation for ${companyName} was marked as incorrect.`,
    `Reason: ${submission.feedbackReason || 'Not specified'}.`,
    `This pattern needs adjustment. Future recommendations with similar characteristics should have reduced confidence.`,
  ];

  if (submission.feedbackReason === 'wrong_decision_maker') {
    parts.push('Contact/role intelligence may be inaccurate. Cross-validate contact data before recommending outreach.');
  } else if (submission.feedbackReason === 'bad_timing') {
    parts.push('Timing assessment was off. Signal recency weighting may need adjustment for this pattern.');
  } else if (submission.feedbackReason === 'incorrect_technology') {
    parts.push('Technology detection was incorrect. Technology stack signals need recalibration.');
  } else if (submission.feedbackReason === 'vendor_relationship') {
    parts.push('Vendor/competitive relationship was missed or overstated. Competitive intelligence signals need improvement.');
  } else if (submission.feedbackReason === 'data_was_stale') {
    parts.push('Data freshness was an issue. More aggressive enrichment may be needed for this pattern.');
  }

  if (company?.industry) parts.push(`Industry: ${company.industry}.`);
  if (submission.incorrectSignals?.length) parts.push(`Incorrect signals: ${submission.incorrectSignals.join(', ')}.`);
  if (submission.correctAction === false) parts.push('Recommended action was not appropriate for this situation.');
  if (submission.actualOutcome) parts.push(`Actual outcome: ${submission.actualOutcome}.`);
  if (submission.feedbackDetail) parts.push(`Detail: ${submission.feedbackDetail}`);

  return parts.join(' ');
}

function buildPartialLearningContent(
  submission: FeedbackSubmission,
  companyName: string,
  company: { industry?: string | null; domain?: string | null; sizeRange?: string | null } | null
): string {
  const parts: string[] = [
    `PARTIAL FEEDBACK: Recommendation for ${companyName} was partially useful.`,
    `Reason: ${submission.feedbackReason || 'Not specified'}.`,
    `Some aspects were correct, others need refinement.`,
  ];

  if (submission.correctSignals?.length) parts.push(`Correct signals: ${submission.correctSignals.join(', ')}.`);
  if (submission.incorrectSignals?.length) parts.push(`Incorrect signals: ${submission.incorrectSignals.join(', ')}.`);
  if (submission.feedbackDetail) parts.push(`Detail: ${submission.feedbackDetail}`);

  return parts.join(' ');
}

// ── Learning Event Creation ──

async function createLearningEvent(
  submission: FeedbackSubmission,
  feedbackId: string
): Promise<string> {
  try {
    const company = await db.company.findUnique({
      where: { id: submission.companyId },
      select: { rawName: true, industry: true, sizeRange: true },
    });

    const isPositive = submission.verdict === 'useful' || submission.verdict === 'partially_useful';
    const eventType = isPositive ? 'feedback_positive' : 'feedback_negative';

    // Extract learned insight
    let learnedInsight: string;
    if (submission.verdict === 'useful' && submission.actualOutcome === 'converted') {
      learnedInsight = `Recommendation for ${company?.rawName || 'company'} led to conversion. Pattern: ${submission.feedbackReason || 'validated signal'}. Reinforce similar recommendations.`;
    } else if (isPositive) {
      learnedInsight = `Positive feedback on ${company?.rawName || 'company'} recommendation. Reason: ${submission.feedbackReason || 'useful'}. Maintain confidence for similar patterns.`;
    } else {
      learnedInsight = `Negative feedback on ${company?.rawName || 'company'} recommendation. Reason: ${submission.feedbackReason || 'incorrect'}. Reduce confidence for similar patterns.`;
    }

    const applicableContext = JSON.stringify({
      industry: company?.industry || null,
      companySize: company?.sizeRange || null,
      verdict: submission.verdict,
      reason: submission.feedbackReason,
    });

    const applicableTags = JSON.stringify([
      company?.industry,
      company?.sizeRange,
      submission.feedbackReason,
      submission.verdict,
    ].filter(Boolean));

    const event = await db.learningEvent.create({
      data: {
        companyId: submission.companyId,
        eventType,
        source: 'user',
        description: `User feedback on recommendation: ${submission.verdict}${submission.feedbackReason ? ` — ${submission.feedbackReason}` : ''}`,
        learnedInsight,
        applicableContext,
        applicableTags,
        confidence: submission.verdict === 'useful' ? 0.85 : submission.verdict === 'partially_useful' ? 0.60 : 0.70,
      },
    });

    return event.id;
  } catch (err) {
    logger.warn('[FeedbackLoop] Learning event creation failed:', { error: err });
    return 'learning-event-failed';
  }
}

// ── Confidence Calibration ──

/**
 * Calibrate confidence based on accumulated feedback.
 * Uses gradual adjustment — no single feedback overwrites learned patterns.
 *
 * Calibration rules:
 *   - 3+ "useful" for same reason → increase confidence for that pattern
 *   - 3+ "not_useful" for same reason → decrease confidence for that pattern
 *   - "wrong_decision_maker" feedback → reduce contact confidence
 *   - "data_was_stale" feedback → reduce freshness confidence
 *   - "incorrect_technology" feedback → reduce technology detection confidence
 */
async function calibrateFromFeedback(
  submission: FeedbackSubmission
): Promise<{ applied: boolean; details?: FeedbackResult['calibrationDetails'] }> {
  try {
    // G9 FIX: Immediate calibration from even a single feedback event.
    // Previous behavior required 3+ feedback items before any calibration applied.
    // Now: single feedback triggers a micro-calibration, batched feedback triggers stronger.

    const microCalibration = submission.verdict === 'useful' ? 2
      : submission.verdict === 'not_useful' ? -3
      : submission.verdict === 'incorrect_action' ? -5
      : submission.verdict === 'wrong_account' ? -4
      : 0; // partially_useful, converted, etc. — no micro adjustment

    // If we have an actualOutcome, that's the strongest calibration signal
    if (submission.actualOutcome) {
      // recordOutcome is already called in the main processFeedback flow
      // Here we also check if we should trigger immediate recalculation
      const feedbackCount = await db.intelligenceFeedback.count({
        where: {
          companyId: submission.companyId,
          verdict: { in: ['useful', 'not_useful', 'incorrect_action', 'wrong_account'] },
        },
      });

      if (feedbackCount >= 1) {
        const recentFeedback = await db.intelligenceFeedback.findMany({
          where: { companyId: submission.companyId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        const usefulCount = recentFeedback.filter(f => f.verdict === 'useful' || f.verdict === 'converted').length;
        const notUsefulCount = recentFeedback.filter(f =>
          f.verdict === 'not_useful' || f.verdict === 'incorrect_action' || f.verdict === 'wrong_account'
        ).length;

        // Read the actual account score for real confidence (not hardcoded 70)
        let previousConfidence = 70;
        try {
          const accountScore = await db.accountScore.findFirst({
            where: { companyId: submission.companyId },
            select: { score: true },
          });
          if (accountScore) previousConfidence = accountScore.score;
        } catch { /* use default */ }

        if (usefulCount > notUsefulCount && usefulCount >= 1) {
          const boost = Math.min(15, usefulCount * 3);
          const newConfidence = Math.min(95, previousConfidence + boost);

          // Phase 2.10: Actually write the adjusted score back to AccountScore
          try {
            await db.accountScore.upsert({
              where: { companyId: submission.companyId },
              create: {
                companyId: submission.companyId,
                score: newConfidence,
                category: newConfidence >= 80 ? 'HOT_ACCOUNT' : newConfidence >= 60 ? 'WARM_ACCOUNT' : newConfidence >= 40 ? 'NURTURE' : 'AT_RISK',
                scoreBreakdown: JSON.stringify({ overallScore: newConfidence, adjustedByFeedback: true }),
                calculatedAt: new Date(),
              },
              update: {
                score: newConfidence,
                category: newConfidence >= 80 ? 'HOT_ACCOUNT' : newConfidence >= 60 ? 'WARM_ACCOUNT' : newConfidence >= 40 ? 'NURTURE' : 'AT_RISK',
                scoreBreakdown: JSON.stringify({ overallScore: newConfidence, adjustedByFeedback: true }),
                calculatedAt: new Date(),
              },
            });
            logger.info('[FeedbackLoop] Account score adjusted', { companyId: submission.companyId, previousConfidence, newConfidence, boost });
          } catch (err) {
            logger.warn('[FeedbackLoop] Failed to write adjusted score:', { error: err });
          }

          return {
            applied: true,
            details: {
              signalType: submission.companyId,
              direction: 'increased',
              previousConfidence,
              newConfidence,
              reason: `${usefulCount} positive feedback items — confidence increased by ${boost} points`,
            },
          };
        }

        if (notUsefulCount > usefulCount && notUsefulCount >= 1) {
          const penalty = Math.min(20, notUsefulCount * 5);
          const newConfidence = Math.max(30, previousConfidence - penalty);

          // Phase 2.10: Actually write the adjusted score back to AccountScore
          try {
            await db.accountScore.upsert({
              where: { companyId: submission.companyId },
              create: {
                companyId: submission.companyId,
                score: newConfidence,
                category: newConfidence >= 80 ? 'HOT_ACCOUNT' : newConfidence >= 60 ? 'WARM_ACCOUNT' : newConfidence >= 40 ? 'NURTURE' : 'AT_RISK',
                scoreBreakdown: JSON.stringify({ overallScore: newConfidence, adjustedByFeedback: true }),
                calculatedAt: new Date(),
              },
              update: {
                score: newConfidence,
                category: newConfidence >= 80 ? 'HOT_ACCOUNT' : newConfidence >= 60 ? 'WARM_ACCOUNT' : newConfidence >= 40 ? 'NURTURE' : 'AT_RISK',
                scoreBreakdown: JSON.stringify({ overallScore: newConfidence, adjustedByFeedback: true }),
                calculatedAt: new Date(),
              },
            });
            logger.info('[FeedbackLoop] Account score adjusted', { companyId: submission.companyId, previousConfidence, newConfidence, penalty: -penalty });
          } catch (err) {
            logger.warn('[FeedbackLoop] Failed to write adjusted score:', { error: err });
          }

          return {
            applied: true,
            details: {
              signalType: submission.companyId,
              direction: 'decreased',
              previousConfidence,
              newConfidence,
              reason: `${notUsefulCount} negative feedback items — confidence decreased by ${penalty} points`,
            },
          };
        }
      }
    }

    // Apply micro-calibration for signal-level feedback
    if (microCalibration !== 0 && submission.feedbackReason) {
      return {
        applied: true,
        details: {
          signalType: submission.feedbackReason,
          direction: microCalibration > 0 ? 'increased' : 'decreased',
          previousConfidence: 50,
          newConfidence: Math.max(20, Math.min(95, 50 + microCalibration)),
          reason: `Micro-calibration from ${submission.verdict} feedback on ${submission.feedbackReason}`,
        },
      };
    }

    return { applied: false };
  } catch (err) {
    logger.warn('[FeedbackLoop] Calibration check failed:', { error: err });
    return { applied: false };
  }
}

/**
 * Get calibration adjustments based on accumulated feedback across the system.
 * Used by the recommendation engine to adjust scores.
 */
export async function getCalibrationAdjustments(
  companyId?: string
): Promise<CalibrationAdjustment[]> {
  const adjustments: CalibrationAdjustment[] = [];

  try {
    // Company-specific calibration
    if (companyId) {
      const companyFeedback = await db.intelligenceFeedback.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      if (companyFeedback.length >= 3) {
        const usefulCount = companyFeedback.filter(f => f.verdict === 'useful').length;
        const notUsefulCount = companyFeedback.filter(f =>
          f.verdict === 'not_useful' || f.verdict === 'incorrect_action' || f.verdict === 'wrong_account'
        ).length;

        if (usefulCount > notUsefulCount * 2) {
          adjustments.push({
            pattern: `company:${companyId}`,
            direction: 'up',
            magnitude: Math.min(0.15, (usefulCount - notUsefulCount) * 0.02),
            supportingFeedbackCount: usefulCount,
            reason: `Company has ${usefulCount} positive vs ${notUsefulCount} negative feedback — increase priority`,
          });
        } else if (notUsefulCount > usefulCount * 2) {
          adjustments.push({
            pattern: `company:${companyId}`,
            direction: 'down',
            magnitude: Math.min(0.15, (notUsefulCount - usefulCount) * 0.02),
            supportingFeedbackCount: notUsefulCount,
            reason: `Company has ${notUsefulCount} negative vs ${usefulCount} positive feedback — decrease priority`,
          });
        }
      }

      // Reason-specific calibration
      const reasonGroups = groupBy(companyFeedback, f => f.feedbackReason || 'unspecified');
      for (const [reason, feedbacks] of Object.entries(reasonGroups)) {
        if (feedbacks.length >= 3 && reason !== 'unspecified') {
          const reasonUseful = feedbacks.filter(f => f.verdict === 'useful').length;
          const reasonNotUseful = feedbacks.filter(f =>
            f.verdict === 'not_useful' || f.verdict === 'incorrect_action'
          ).length;

          if (reasonUseful > reasonNotUseful) {
            adjustments.push({
              pattern: `reason:${reason}`,
              direction: 'up',
              magnitude: 0.05,
              supportingFeedbackCount: reasonUseful,
              reason: `Signal pattern "${reason}" has been validated by user feedback`,
            });
          } else if (reasonNotUseful > reasonUseful) {
            adjustments.push({
              pattern: `reason:${reason}`,
              direction: 'down',
              magnitude: 0.05,
              supportingFeedbackCount: reasonNotUseful,
              reason: `Signal pattern "${reason}" has been invalidated by user feedback`,
            });
          }
        }
      }
    }

    // System-wide calibration (signal type accuracy)
    const signalTypeFeedback = await db.intelligenceFeedback.findMany({
      where: {
        feedbackReason: { in: ['accurate_signals', 'incorrect_technology', 'wrong_decision_maker', 'data_was_stale'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const signalTypeGroups = groupBy(signalTypeFeedback, f => f.feedbackReason || 'unknown');
    for (const [reason, feedbacks] of Object.entries(signalTypeGroups)) {
      if (feedbacks.length >= 5) {
        const usefulCount = feedbacks.filter(f => f.verdict === 'useful').length;
        const notUsefulCount = feedbacks.length - usefulCount;

        if (reason === 'accurate_signals' && usefulCount > notUsefulCount * 2) {
          adjustments.push({
            pattern: 'signal_detection_accuracy',
            direction: 'up',
            magnitude: 0.03,
            supportingFeedbackCount: usefulCount,
            reason: `Signal detection accuracy validated by ${usefulCount} positive feedback items`,
          });
        }

        if (reason === 'incorrect_technology' && notUsefulCount > usefulCount) {
          adjustments.push({
            pattern: 'technology_detection',
            direction: 'down',
            magnitude: 0.05,
            supportingFeedbackCount: notUsefulCount,
            reason: `Technology detection accuracy questioned by ${notUsefulCount} negative feedback items`,
          });
        }
      }
    }

    return adjustments;
  } catch (err) {
    logger.warn('[FeedbackLoop] Calibration adjustment fetch failed:', { error: err });
    return [];
  }
}

// ── Feedback Stats ──

/**
 * Get feedback statistics for a specific company.
 */
export async function getCompanyFeedbackStats(
  companyId: string
): Promise<CompanyFeedbackStats> {
  const feedback = await db.intelligenceFeedback.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const useful = feedback.filter(f => f.verdict === 'useful').length;
  const notUseful = feedback.filter(f => f.verdict === 'not_useful').length;
  const partiallyUseful = feedback.filter(f => f.verdict === 'partially_useful').length;
  const incorrect = feedback.filter(f => f.verdict === 'incorrect_action' || f.verdict === 'wrong_account').length;
  const total = feedback.length;

  // Top reasons
  const reasonCounts = new Map<string, number>();
  for (const f of feedback) {
    if (f.feedbackReason) {
      reasonCounts.set(f.feedbackReason, (reasonCounts.get(f.feedbackReason) || 0) + 1);
    }
  }
  const topReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Outcomes
  const outcomeCounts = new Map<string, number>();
  for (const f of feedback) {
    if (f.actualOutcome) {
      outcomeCounts.set(f.actualOutcome, (outcomeCounts.get(f.actualOutcome) || 0) + 1);
    }
  }
  const outcomes = Array.from(outcomeCounts.entries())
    .map(([outcome, count]) => ({ outcome, count }))
    .sort((a, b) => b.count - a.count);

  return {
    companyId,
    totalFeedback: total,
    useful,
    notUseful,
    partiallyUseful,
    incorrect,
    positiveRate: total > 0 ? useful / total : 0,
    topReasons,
    outcomes,
    lastFeedbackAt: feedback.length > 0 ? feedback[0].createdAt.toISOString() : null,
  };
}

/**
 * Get system-wide learning analytics.
 */
export async function getLearningAnalytics(): Promise<LearningAnalytics> {
  const totalFeedback = await db.intelligenceFeedback.count();

  const allFeedback = await db.intelligenceFeedback.findMany({
    select: { verdict: true, feedbackReason: true, actualOutcome: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const useful = allFeedback.filter(f => f.verdict === 'useful').length;
  const overallUsefulRate = totalFeedback > 0 ? useful / totalFeedback : 0;

  // Verdict distribution
  const verdictDist: Record<string, number> = {};
  for (const f of allFeedback) {
    verdictDist[f.verdict] = (verdictDist[f.verdict] || 0) + 1;
  }

  // Top reasons with useful rates
  const reasonFeedback: Record<string, { count: number; useful: number }> = {};
  for (const f of allFeedback) {
    const r = f.feedbackReason || 'unspecified';
    if (!reasonFeedback[r]) reasonFeedback[r] = { count: 0, useful: 0 };
    reasonFeedback[r].count++;
    if (f.verdict === 'useful') reasonFeedback[r].useful++;
  }
  const topReasons = Object.entries(reasonFeedback)
    .map(([reason, data]) => ({
      reason,
      count: data.count,
      usefulRate: data.count > 0 ? data.useful / data.count : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Outcome distribution
  const outcomeDist: Record<string, number> = {};
  for (const f of allFeedback) {
    if (f.actualOutcome) {
      outcomeDist[f.actualOutcome] = (outcomeDist[f.actualOutcome] || 0) + 1;
    }
  }

  // Conversions from recommendations
  const conversions = allFeedback.filter(
    f => f.verdict === 'useful' && f.actualOutcome === 'converted'
  ).length;

  // Memories created
  const memoriesCreated = await db.intelligenceFeedback.count({
    where: { memoryCreated: true },
  });

  // Calibration events
  const calibrationEvents = await db.intelligenceFeedback.count({
    where: { calibrationApplied: true },
  });

  // Feedback trend (last 12 weeks)
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const feedbackTrend: Array<{ period: string; useful: number; notUseful: number; total: number }> = [];

  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now - (i + 1) * weekMs);
    const weekEnd = new Date(now - i * weekMs);
    const weekFeedback = allFeedback.filter(f => {
      const d = new Date(f.createdAt);
      return d >= weekStart && d < weekEnd;
    });

    feedbackTrend.push({
      period: `Week ${12 - i}`,
      useful: weekFeedback.filter(f => f.verdict === 'useful').length,
      notUseful: weekFeedback.filter(f => f.verdict === 'not_useful' || f.verdict === 'incorrect_action').length,
      total: weekFeedback.length,
    });
  }

  return {
    totalFeedback,
    overallUsefulRate,
    verdictDistribution: verdictDist,
    topReasons,
    outcomeDistribution: outcomeDist,
    conversionFromRecommendation: conversions,
    memoriesCreatedFromFeedback: memoriesCreated,
    calibrationEvents,
    feedbackTrend,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Search institutional memory for feedback learning patterns.
 */
export async function searchFeedbackMemories(
  query: string,
  options?: { companyId?: string; limit?: number }
): Promise<Array<{ memory: MemoryItem; relevance: number; learningType: string }>> {
  try {
    const results = await searchMemories({
      query,
      category: ['learning_insight'],
      tags: options ? ['feedback_learning', ...([] as string[])] : ['feedback_learning'],
      minConfidence: 0.3,
      limit: options?.limit || 10,
    });

    return results.map(r => ({
      memory: r.memory,
      relevance: r.relevanceScore,
      learningType: (r.memory.metadata?.verdict as string) || 'unknown',
    }));
  } catch (err) {
    logger.warn('[FeedbackLoop] Memory search failed:', { error: err });
    return [];
  }
}

// ── Helpers ──

function determineSentiment(verdict: FeedbackVerdict): 'positive' | 'negative' | 'neutral' {
  if (verdict === 'useful') return 'positive';
  if (verdict === 'not_useful' || verdict === 'incorrect_action' || verdict === 'wrong_account') return 'negative';
  return 'neutral';
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}
