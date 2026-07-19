import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   POST /api/g-outreach/drafts/batch
   Batch actions on drafts: approve, reject, assign, regenerate.

   Body:
     action:     "approve" | "reject" | "assign" | "regenerate"
     draftIds:   string[]
     assigneeId: string       (only for action=assign)
     feedback:   string       (only for action=reject or regenerate)
     scheduledAt: string      (only for action=approve, optional scheduling)
   ═══════════════════════════════════════ */

type BatchAction = 'approve' | 'reject' | 'assign' | 'regenerate';

interface BatchRequestBody {
  action: BatchAction;
  draftIds: string[];
  assigneeId?: string;
  feedback?: string;
  scheduledAt?: string;
}

interface BatchResult {
  id: string;
  success: boolean;
  error?: string;
}

async function processApprove(draftId: string, scheduledAt?: string): Promise<BatchResult> {
  const draft = await db.draft.findUnique({
    where: { id: draftId },
    select: { id: true, contactId: true, status: true },
  });

  if (!draft) return { id: draftId, success: false, error: 'Draft not found' };
  if (draft.status !== 'pending_review') {
    return { id: draftId, success: false, error: `Draft status is "${draft.status}", expected "pending_review"` };
  }

  // Update draft status to approved
  await db.draft.update({
    where: { id: draft.id },
    data: { status: 'approved' },
  });

  // Create SendQueue entry (same pattern as drafts.ts lines 591-597)
  const hasSchedule = scheduledAt && scheduledAt !== 'now' && scheduledAt !== null;
  const queueScheduledAt = hasSchedule ? new Date(scheduledAt) : new Date();
  const queueStatus = hasSchedule ? 'scheduled' : 'pending';

  await db.sendQueue.create({
    data: {
      draftId: draft.id,
      status: queueStatus,
      scheduledAt: queueScheduledAt,
    },
  });

  // Update contact status to queued
  await db.contact.update({
    where: { id: draft.contactId },
    data: { status: 'queued' },
  });

  return { id: draftId, success: true };
}

async function processReject(draftId: string, feedback?: string): Promise<BatchResult> {
  const draft = await db.draft.findUnique({
    where: { id: draftId },
    select: { id: true, contactId: true, status: true },
  });

  if (!draft) return { id: draftId, success: false, error: 'Draft not found' };
  if (draft.status !== 'pending_review') {
    return { id: draftId, success: false, error: `Draft status is "${draft.status}", expected "pending_review"` };
  }

  await db.draft.update({
    where: { id: draft.id },
    data: {
      status: 'rejected',
      rejectReason: feedback || null,
    },
  });

  await db.contact.update({
    where: { id: draft.contactId },
    data: { status: 'cleaned' },
  });

  return { id: draftId, success: true };
}

async function processAssign(draftId: string, assigneeId: string): Promise<BatchResult> {
  const draft = await db.draft.findUnique({
    where: { id: draftId },
    select: { id: true, status: true },
  });

  if (!draft) return { id: draftId, success: false, error: 'Draft not found' };

  await db.draft.update({
    where: { id: draft.id },
    data: { assigneeId },
  });

  return { id: draftId, success: true };
}

async function processRegenerate(draftId: string, feedback?: string): Promise<BatchResult> {
  const draft = await db.draft.findUnique({
    where: { id: draftId },
    select: { id: true, status: true },
  });

  if (!draft) return { id: draftId, success: false, error: 'Draft not found' };
  if (draft.status !== 'pending_review') {
    return { id: draftId, success: false, error: `Draft status is "${draft.status}", expected "pending_review"` };
  }

  // Keep pending_review, store feedback in reviewNotes for next generation cycle
  await db.draft.update({
    where: { id: draft.id },
    data: {
      reviewNotes: feedback || null,
    },
  });

  return { id: draftId, success: true };
}

export async function POST(request: Request) {
  try {
    const body: BatchRequestBody = await request.json();
    const { action, draftIds, assigneeId, feedback, scheduledAt } = body;

    // ── Validate required fields ──
    if (!action || !['approve', 'reject', 'assign', 'regenerate'].includes(action)) {
      return NextResponse.json(
        { error: 'action is required and must be one of: approve, reject, assign, regenerate' },
        { status: 400 },
      );
    }

    if (!Array.isArray(draftIds) || draftIds.length === 0) {
      return NextResponse.json(
        { error: 'draftIds must be a non-empty array' },
        { status: 400 },
      );
    }

    if (draftIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 drafts per batch request' },
        { status: 400 },
      );
    }

    // ── Action-specific validation ──
    if (action === 'assign' && !assigneeId) {
      return NextResponse.json(
        { error: 'assigneeId is required for action=assign' },
        { status: 400 },
      );
    }

    // ── Process each draft ──
    const results: BatchResult[] = [];
    let processed = 0;
    let failed = 0;

    for (const draftId of draftIds) {
      try {
        let result: BatchResult;

        switch (action as BatchAction) {
          case 'approve':
            result = await processApprove(draftId, scheduledAt);
            break;
          case 'reject':
            result = await processReject(draftId, feedback);
            break;
          case 'assign':
            result = await processAssign(draftId, assigneeId!);
            break;
          case 'regenerate':
            result = await processRegenerate(draftId, feedback);
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
          id: draftId,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      results,
    });
  } catch (error) {
    console.error('[drafts/batch] POST error:', error);
    return NextResponse.json(
      { error: 'Batch action failed', detail: String(error) },
      { status: 500 },
    );
  }
}