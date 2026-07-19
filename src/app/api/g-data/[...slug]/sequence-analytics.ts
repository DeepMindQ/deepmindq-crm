import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

// ---------------------------------------------------------------------------
// Period helper
// ---------------------------------------------------------------------------
function getPeriodDate(period: string): Date | null {
  if (period === 'all') return null;
  const days = period === '30d' ? 30 : 90;
  return new Date(Date.now() - days * 86400000);
}

function periodWhere(period: string): { createdAt?: { gte: Date } } {
  const date = getPeriodDate(period);
  if (!date) return {};
  return { createdAt: { gte: date } };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '90d';
    const dateFilter = periodWhere(period);

    // ── Parallel data fetches ──
    const [
      sequences,
      enrollments,
      sequenceSteps,
      drafts,
      sendQueues,
      emailEvents,
      companies,
    ] = await Promise.all([
      // All sequences
      db.emailSequence.findMany({
        where: dateFilter,
        include: {
          steps: { select: { id: true, stepNumber: true } },
          enrollments: {
            select: { id: true, status: true, currentStep: true },
          },
          company: { select: { id: true, rawName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // All enrollments (for overview counts)
      db.sequenceEnrollment.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { id: true },
      }),

      // All sequence steps (for step conversion)
      db.sequenceStep.findMany({
        select: { id: true, sequenceId: true, stepNumber: true },
      }),

      // Drafts linked to sequences
      db.draft.findMany({
        where: {
          sequenceId: { not: null },
          ...dateFilter,
        },
        select: {
          id: true,
          sequenceId: true,
          sequenceStepId: true,
          status: true,
          contactId: true,
        },
      }),

      // Send queue items linked to sequence drafts
      db.sendQueue.findMany({
        where: {
          draft: { sequenceId: { not: null } },
          ...dateFilter,
        },
        select: {
          id: true,
          draftId: true,
          openCount: true,
          clickCount: true,
          replied: true,
          bounced: true,
          status: true,
        },
      }),

      // Email events for sequence drafts
      db.emailEvent.findMany({
        where: {
          draft: { sequenceId: { not: null } },
          ...dateFilter,
        },
        select: {
          id: true,
          draftId: true,
          contactId: true,
          eventType: true,
        },
      }),

      // Companies for name lookups
      db.company.findMany({
        select: { id: true, rawName: true },
      }),
    ]);

    // ── Build lookup maps ──
    const companyMap = new Map(companies.map((c) => [c.id, c.rawName]));

    const sendQueueByDraftId = new Map<string, (typeof sendQueues)[number]>();
    for (const sq of sendQueues) {
      sendQueueByDraftId.set(sq.draftId, sq);
    }

    // Group email events by draftId
    const eventsByDraftId = new Map<string, { opens: number; clicks: number; replies: number }>();
    for (const evt of emailEvents) {
      if (!evt.draftId) continue;
      if (!eventsByDraftId.has(evt.draftId)) {
        eventsByDraftId.set(evt.draftId, { opens: 0, clicks: 0, replies: 0 });
      }
      const bucket = eventsByDraftId.get(evt.draftId)!;
      if (evt.eventType === 'open') bucket.opens++;
      if (evt.eventType === 'click') bucket.clicks++;
      if (evt.eventType === 'reply') bucket.replies++;
    }

    // Group drafts by sequenceId
    const draftsBySequenceId = new Map<string, typeof drafts>();
    for (const d of drafts) {
      if (!d.sequenceId) continue;
      if (!draftsBySequenceId.has(d.sequenceId)) {
        draftsBySequenceId.set(d.sequenceId, []);
      }
      draftsBySequenceId.get(d.sequenceId)!.push(d);
    }

    // ── Sequence Overview ──
    const signalDriven = sequences.filter((s) => s.generatedBy === 'signal_driven').length;
    const manual = sequences.filter((s) => s.generatedBy !== 'signal_driven').length;

    const enrollmentCounts: Record<string, number> = {
      active: 0,
      completed: 0,
      cancelled: 0,
      paused: 0,
    };
    for (const e of enrollments) {
      enrollmentCounts[e.status] = e._count.id;
    }

    const sequenceOverview = {
      totalSequences: sequences.length,
      signalDriven,
      manual,
      activeEnrollments: enrollmentCounts.active || 0,
      completedEnrollments: enrollmentCounts.completed || 0,
      cancelledEnrollments: enrollmentCounts.cancelled || 0,
    };

    // ── Sequence Performance ──
    const sequencePerformance = sequences.map((seq) => {
      const seqDrafts = draftsBySequenceId.get(seq.id) || [];

      let draftsGenerated = seqDrafts.length;
      let draftsApproved = 0;
      let draftsRejected = 0;
      let opens = 0;
      let clicks = 0;
      let replies = 0;

      const completedSteps = new Set<number>();

      for (const draft of seqDrafts) {
        if (draft.status === 'approved' || draft.status === 'sent') draftsApproved++;
        if (draft.status === 'rejected') draftsRejected++;

        const sq = sendQueueByDraftId.get(draft.id);
        if (sq) {
          opens += sq.openCount || 0;
          clicks += sq.clickCount || 0;
          if (sq.replied) replies++;
        } else {
          const evtBucket = eventsByDraftId.get(draft.id);
          if (evtBucket) {
            opens += evtBucket.opens;
            clicks += evtBucket.clicks;
            replies += evtBucket.replies;
          }
        }

        // Track which steps have at least one approved/sent draft
        if (draft.sequenceStepId && (draft.status === 'approved' || draft.status === 'sent')) {
          const step = seq.steps.find((s) => s.id === draft.sequenceStepId);
          if (step) completedSteps.add(step.stepNumber);
        }
      }

      const totalSteps = seq.steps.length || 1;
      const activeEnrollments = seq.enrollments.filter((e) => e.status === 'active').length;
      const stepsCompleted = completedSteps.size;

      // Determine enrollment status from the latest enrollment
      const latestEnrollment = seq.enrollments[seq.enrollments.length - 1];

      return {
        sequenceId: seq.id,
        sequenceName: seq.name,
        generatedBy: seq.generatedBy,
        triggerReason: seq.triggerReason || null,
        companyName: seq.company?.rawName || companyMap.get(seq.companyId || '') || null,
        totalSteps,
        stepsCompleted,
        draftsGenerated,
        draftsApproved,
        draftsRejected,
        opens,
        clicks,
        replies,
        enrollmentStatus: latestEnrollment?.status || 'unknown',
      };
    });

    // ── Step Conversion ──
    // Group all sequence drafts by their step number
    const stepDraftMap = new Map<number, typeof drafts>();
    for (const draft of drafts) {
      if (!draft.sequenceStepId) continue;
      const step = sequenceSteps.find((s) => s.id === draft.sequenceStepId);
      if (!step) continue;
      if (!stepDraftMap.has(step.stepNumber)) {
        stepDraftMap.set(step.stepNumber, []);
      }
      stepDraftMap.get(step.stepNumber)!.push(draft);
    }

    const stepConversion = Array.from(stepDraftMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([stepNumber, stepDrafts]) => {
        let approved = 0;
        let rejected = 0;
        let pending = 0;
        let totalOpens = 0;
        let totalSentWithQueue = 0;
        let totalReplied = 0;

        for (const draft of stepDrafts) {
          if (draft.status === 'approved' || draft.status === 'sent') approved++;
          else if (draft.status === 'rejected') rejected++;
          else pending++;

          const sq = sendQueueByDraftId.get(draft.id);
          if (sq && (sq.status === 'sent')) {
            totalOpens += sq.openCount || 0;
            totalSentWithQueue++;
            if (sq.replied) totalReplied++;
          }
        }

        const openRate = totalSentWithQueue > 0 ? parseFloat(((totalOpens / totalSentWithQueue) * 100).toFixed(1)) / 100 : 0;
        const replyRate = totalSentWithQueue > 0 ? parseFloat(((totalReplied / totalSentWithQueue) * 100).toFixed(1)) / 100 : 0;

        return {
          stepNumber,
          totalDrafts: stepDrafts.length,
          approved,
          rejected,
          pending,
          openRate,
          replyRate,
        };
      });

    return apiSuccess({
      sequenceOverview,
      sequencePerformance,
      stepConversion,
    });
  } catch (err: any) {
    console.error('[sequence-analytics]', err.message);
    return apiError('Failed to compute sequence analytics', 500);
  }
}