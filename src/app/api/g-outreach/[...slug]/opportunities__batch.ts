import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   POST /api/g-outreach/opportunities/batch
   Human decision actions on OpportunityRecommendations.

   Actions:
     accept   — Sets status=accepted, creates a Pursuit record (human decides to pursue)
     reject   — Sets status=rejected with structured taxonomy + optional free-text feedback
     monitor  — Sets status=monitored (keep watching, no pursuit yet)
     assign   — Sets owner on the associated active Pursuit

   IMPORTANT BOUNDARY:
     - AI ONLY creates recommendations (status=pending_review)
     - AI does NOT accept, reject, or monitor
     - Pursuit is ONLY created on human Accept action
     - No SendQueue entries are created here (that's the draft approval flow)

   Body:
     action:          "accept" | "reject" | "monitor" | "assign"
     opportunityIds:  string[]
     reviewedBy:      string                  (user performing the action)
     rejectionReason: string                  (only for action=reject)
       — Must be one of: WRONG_TIMING, EXISTING_RELATIONSHIP, NOT_RELEVANT,
         LOW_CONFIDENCE, NO_BUDGET, OTHER
     rejectionFeedback: string                (only for action=reject, free-text)
     owner:           string                  (only for action=assign or accept)
     nextAction:      string                  (only for action=accept)
     nextActionAt:    string                  (only for action=accept, ISO date)
   ═══════════════════════════════════════ */

const VALID_REJECTION_REASONS = [
  'WRONG_TIMING',
  'EXISTING_RELATIONSHIP',
  'NOT_RELEVANT',
  'LOW_CONFIDENCE',
  'NO_BUDGET',
  'OTHER',
] as const;

type RejectionReason = typeof VALID_REJECTION_REASONS[number];
type OpportunityAction = 'accept' | 'reject' | 'monitor' | 'assign';

interface BatchRequestBody {
  action: OpportunityAction;
  opportunityIds: string[];
  reviewedBy?: string;
  rejectionReason?: RejectionReason;
  rejectionFeedback?: string;
  owner?: string;
  nextAction?: string;
  nextActionAt?: string;
}

interface BatchResult {
  id: string;
  success: boolean;
  error?: string;
  pursuitId?: string; // Only for accept action
}

// ── ACCEPT: Human decides to pursue — creates Pursuit ──

async function processAccept(
  opportunityId: string,
  reviewedBy: string | undefined,
  owner: string | undefined,
  nextAction: string | undefined,
  nextActionAt: string | undefined,
): Promise<BatchResult> {
  const opp = await db.opportunityRecommendation.findUnique({
    where: { id: opportunityId },
    select: { id: true, status: true, companyId: true, priority: true },
  });

  if (!opp) return { id: opportunityId, success: false, error: 'Opportunity not found' };
  if (opp.status !== 'pending_review' && opp.status !== 'monitored') {
    return {
      id: opportunityId,
      success: false,
      error: `Opportunity status is "${opp.status}", expected "pending_review" or "monitored"`,
    };
  }

  // Update opportunity status
  await db.opportunityRecommendation.update({
    where: { id: opp.id },
    data: {
      status: 'accepted',
      reviewedBy: reviewedBy || null,
      reviewedAt: new Date(),
    },
  });

  // Create Pursuit record — this is the ONLY place Pursuit is created
  const pursuit = await db.pursuit.create({
    data: {
      opportunityId: opp.id,
      companyId: opp.companyId,
      owner: owner || null,
      priority: opp.priority,
      status: 'active',
      outcomeStage: 'discovery',
      nextAction: nextAction || null,
      nextActionAt: nextActionAt ? new Date(nextActionAt) : null,
    },
  });

  return { id: opportunityId, success: true, pursuitId: pursuit.id };
}

// ── REJECT: Human rejects with structured taxonomy ──

async function processReject(
  opportunityId: string,
  reviewedBy: string | undefined,
  rejectionReason: RejectionReason | undefined,
  rejectionFeedback: string | undefined,
): Promise<BatchResult> {
  const opp = await db.opportunityRecommendation.findUnique({
    where: { id: opportunityId },
    select: { id: true, status: true },
  });

  if (!opp) return { id: opportunityId, success: false, error: 'Opportunity not found' };
  if (opp.status !== 'pending_review' && opp.status !== 'monitored') {
    return {
      id: opportunityId,
      success: false,
      error: `Opportunity status is "${opp.status}", expected "pending_review" or "monitored"`,
    };
  }

  const reason = rejectionReason || 'OTHER';

  await db.opportunityRecommendation.update({
    where: { id: opp.id },
    data: {
      status: 'rejected',
      rejectionReason: reason,
      rejectionFeedback: rejectionFeedback || null,
      reviewedBy: reviewedBy || null,
      reviewedAt: new Date(),
    },
  });

  return { id: opportunityId, success: true };
}

// ── MONITOR: Human wants to keep watching, not ready to pursue or reject ──

async function processMonitor(
  opportunityId: string,
  reviewedBy: string | undefined,
): Promise<BatchResult> {
  const opp = await db.opportunityRecommendation.findUnique({
    where: { id: opportunityId },
    select: { id: true, status: true },
  });

  if (!opp) return { id: opportunityId, success: false, error: 'Opportunity not found' };
  if (opp.status !== 'pending_review') {
    return {
      id: opportunityId,
      success: false,
      error: `Opportunity status is "${opp.status}", expected "pending_review"`,
    };
  }

  await db.opportunityRecommendation.update({
    where: { id: opp.id },
    data: {
      status: 'monitored',
      reviewedBy: reviewedBy || null,
      reviewedAt: new Date(),
    },
  });

  return { id: opportunityId, success: true };
}

// ── ASSIGN: Set owner on an active pursuit ──

async function processAssign(
  opportunityId: string,
  owner: string,
): Promise<BatchResult> {
  if (!owner) {
    return { id: opportunityId, success: false, error: 'owner is required for assign action' };
  }

  // Find the active pursuit for this opportunity
  const pursuit = await db.pursuit.findFirst({
    where: { opportunityId, status: 'active' },
  });

  if (!pursuit) {
    return {
      id: opportunityId,
      success: false,
      error: 'No active pursuit found for this opportunity. Accept the opportunity first.',
    };
  }

  await db.pursuit.update({
    where: { id: pursuit.id },
    data: { owner },
  });

  return { id: opportunityId, success: true };
}

// ── Main Handler ──

export async function POST(request: Request) {
  try {
    const body: BatchRequestBody = await request.json();
    const {
      action,
      opportunityIds,
      reviewedBy,
      rejectionReason,
      rejectionFeedback,
      owner,
      nextAction,
      nextActionAt,
    } = body;

    // ── Validate action ──
    if (!action || !['accept', 'reject', 'monitor', 'assign'].includes(action)) {
      return NextResponse.json(
        { error: 'action is required and must be one of: accept, reject, monitor, assign' },
        { status: 400 },
      );
    }

    // ── Validate opportunityIds ──
    if (!Array.isArray(opportunityIds) || opportunityIds.length === 0) {
      return NextResponse.json(
        { error: 'opportunityIds must be a non-empty array' },
        { status: 400 },
      );
    }

    if (opportunityIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 opportunities per batch request' },
        { status: 400 },
      );
    }

    // ── Validate rejection reason if rejecting ──
    if (action === 'reject' && rejectionReason && !VALID_REJECTION_REASONS.includes(rejectionReason as RejectionReason)) {
      return NextResponse.json(
        {
          error: `rejectionReason must be one of: ${VALID_REJECTION_REASONS.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // ── Process each opportunity ──
    const results: BatchResult[] = [];
    let processed = 0;
    let failed = 0;

    for (const oppId of opportunityIds) {
      try {
        let result: BatchResult;

        switch (action as OpportunityAction) {
          case 'accept':
            result = await processAccept(oppId, reviewedBy, owner, nextAction, nextActionAt);
            break;
          case 'reject':
            result = await processReject(oppId, reviewedBy, rejectionReason, rejectionFeedback);
            break;
          case 'monitor':
            result = await processMonitor(oppId, reviewedBy);
            break;
          case 'assign':
            result = await processAssign(oppId, owner!);
            break;
        }

        if (result.success) {
          processed++;
        } else {
          failed++;
        }
        results.push(result);
      } catch (err: unknown) {
        failed++;
        results.push({
          id: oppId,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      action,
      processed,
      failed,
      results,
    });
  } catch (error) {
    console.error('[opportunities/batch] POST error:', error);
    return NextResponse.json(
      { error: 'Batch action failed', detail: String(error) },
      { status: 500 },
    );
  }
}