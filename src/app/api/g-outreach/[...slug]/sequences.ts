import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET /api/sequences
   List sequences with step counts and enrollment counts
   ═══════════════════════════════════════════════════ */
export async function GET() {
  try {
    const sequences = await db.emailSequence.findMany({
      where: { isActive: true },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Collect IDs for signal, capability match, and opportunity lookups
    const signalIds = sequences
      .filter(seq => seq.triggerSignalId)
      .map(seq => seq.triggerSignalId!);
    const matchIds = sequences
      .filter(seq => seq.triggerCapabilityMatchId)
      .map(seq => seq.triggerCapabilityMatchId!);
    const opportunityIds = sequences
      .filter(seq => seq.opportunityId)
      .map(seq => seq.opportunityId!);

    // Batch-load signal, capability match, and opportunity data
    const [signals, matches, opportunities] = await Promise.all([
      signalIds.length > 0
        ? db.companySignal.findMany({ where: { id: { in: signalIds } } })
        : Promise.resolve([] as never[]),
      matchIds.length > 0
        ? db.signalCapabilityMatch.findMany({
            where: { id: { in: matchIds } },
          })
        : Promise.resolve([] as never[]),
      opportunityIds.length > 0
        ? db.opportunityRecommendation.findMany({
            where: { id: { in: opportunityIds } },
            select: {
              id: true,
              opportunityTitle: true,
              opportunityScore: true,
              suggestedConversation: true,
            },
          })
        : Promise.resolve([] as { id: string; opportunityTitle: string; opportunityScore: number; suggestedConversation: string }[]),
    ]);

    const signalMap = new Map(signals.map(s => [s.id, s]));
    const matchMap = new Map(matches.map(m => [m.id, m]));
    const opportunityMap = new Map(opportunities.map(o => [o.id, o]));

    // Load capability titles for matches
    const capabilityIds = matches.map(m => m.capabilityId).filter(Boolean);
    const capabilities = capabilityIds.length > 0
      ? await db.capabilityAsset.findMany({
          where: { id: { in: capabilityIds } },
          select: { id: true, title: true },
        })
      : [];
    const capabilityTitleMap = new Map(capabilities.map(c => [c.id, c.title]));

    const enriched = sequences.map(seq => {
      const result: Record<string, unknown> = {
        id: seq.id,
        name: seq.name,
        description: seq.description,
        serviceLine: seq.serviceLine,
        isActive: seq.isActive,
        stepCount: seq.steps.length,
        enrollmentCount: seq._count.enrollments,
        companyId: seq.companyId,
        generatedBy: seq.generatedBy,
        triggerReason: seq.triggerReason,
        steps: seq.steps.map(s => ({
          id: s.id,
          stepNumber: s.stepNumber,
          delayDays: s.delayDays,
          subject: s.subject,
          bodyPreview: s.body.slice(0, 120) + (s.body.length > 120 ? '...' : ''),
          cta: s.cta,
        })),
        createdAt: seq.createdAt,
      };

      // Attach signal intelligence context
      if (seq.triggerSignalId) {
        const signal = signalMap.get(seq.triggerSignalId);
        if (signal) {
          result.signal = {
            signalTitle: signal.title,
            signalType: signal.signalType,
            impact: signal.impact,
          };
        }
      }

      // Attach capability match intelligence context
      if (seq.triggerCapabilityMatchId) {
        const match = matchMap.get(seq.triggerCapabilityMatchId);
        if (match) {
          result.capabilityMatch = {
            capabilityTitle: capabilityTitleMap.get(match.capabilityId) || null,
            matchScore: match.matchScore,
            businessProblem: match.businessProblem,
          };
        }
      }

      // Attach opportunity context when sequence fulfills an OpportunityRecommendation
      if (seq.opportunityId) {
        const opp = opportunityMap.get(seq.opportunityId);
        if (opp) {
          result.opportunity = {
            opportunityTitle: opp.opportunityTitle,
            opportunityScore: opp.opportunityScore,
            suggestedConversation: opp.suggestedConversation,
          };
        }
      }

      return result;
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Sequences GET error:', error);
    return NextResponse.json([]);
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/sequences
   Create a sequence with steps

   Body: { name, description?, serviceLine?, steps: [{stepNumber, delayDays, subject, body, cta?}] }
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, serviceLine, steps } = body;

    if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: 'name and steps are required' }, { status: 400 });
    }

    const sequence = await db.emailSequence.create({
      data: {
        name,
        description: description || null,
        serviceLine: serviceLine || null,
        steps: {
          create: steps.map((step: { stepNumber: number; delayDays: number; subject: string; body: string; cta?: string }) => ({
            stepNumber: step.stepNumber,
            delayDays: step.delayDays || 3,
            subject: step.subject,
            body: step.body,
            cta: step.cta || null,
          })),
        },
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    return NextResponse.json({ success: true, sequence });
  } catch (error) {
    console.error('Sequences POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create sequence: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   PUT /api/sequences
   Update sequence metadata or a specific step

   Body (sequence): { id, name?, description?, serviceLine?, isActive? }
   Body (step):      { id, stepId, subject?, body?, cta?, delayDays? }
   ═══════════════════════════════════════════════════ */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, stepId, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (stepId) {
      // Update a specific step
      const stepUpdate: Record<string, unknown> = {};
      if (updates.subject !== undefined) stepUpdate.subject = updates.subject;
      if (updates.body !== undefined) stepUpdate.body = updates.body;
      if (updates.cta !== undefined) stepUpdate.cta = updates.cta;
      if (updates.delayDays !== undefined) stepUpdate.delayDays = updates.delayDays;

      const step = await db.sequenceStep.update({
        where: { id: stepId },
        data: stepUpdate,
      });
      return NextResponse.json({ success: true, step });
    }

    // Update sequence metadata
    const seqUpdate: Record<string, unknown> = {};
    if (updates.name !== undefined) seqUpdate.name = updates.name;
    if (updates.description !== undefined) seqUpdate.description = updates.description;
    if (updates.serviceLine !== undefined) seqUpdate.serviceLine = updates.serviceLine;
    if (updates.isActive !== undefined) seqUpdate.isActive = updates.isActive;

    const sequence = await db.emailSequence.update({
      where: { id },
      data: seqUpdate,
    });

    return NextResponse.json({ success: true, sequence });
  } catch (error) {
    console.error('Sequences PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update sequence: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   DELETE /api/sequences
   Archive (soft-delete) a sequence
   ═══════════════════════════════════════════════════ */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.emailSequence.update({
      where: { id },
      data: { isActive: false },
    });

    // Cancel active enrollments
    await db.sequenceEnrollment.updateMany({
      where: { sequenceId: id, status: 'active' },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sequences DELETE error:', error);
    return NextResponse.json({ error: 'Failed to archive sequence' }, { status: 500 });
  }
}