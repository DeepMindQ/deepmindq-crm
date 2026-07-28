import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/companies/[id]/feedback — Human Intelligence Feedback
   
   Simple feedback: accurate / outdated / incorrect
   One click per intelligence item. No workflow. No approval chains.
   
   Uses existing IntelligenceValidation table in the schema.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const body = await request.json();

    const {
      artifactType,   // signal | need | capability_match | action | stakeholder
      artifactId,     // The intelligence object ID
      feedback,       // "accurate" | "outdated" | "incorrect"
      reason,         // Optional free-text
    } = body;

    if (!artifactType || !artifactId || !feedback) {
      return NextResponse.json(
        { error: 'artifactType, artifactId, and feedback are required' },
        { status: 400 }
      );
    }

    const validFeedback = ['accurate', 'outdated', 'incorrect'];
    if (!validFeedback.includes(feedback)) {
      return NextResponse.json(
        { error: 'feedback must be one of: accurate, outdated, incorrect' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Map to IntelligenceValidation schema
    const accuracyMap: Record<string, string> = {
      accurate: 'accurate',
      outdated: 'partially_accurate',
      incorrect: 'inaccurate',
    };

    const ratingMap: Record<string, number> = {
      accurate: 5,
      outdated: 3,
      incorrect: 1,
    };

    // Create validation record
    const validation = await db.intelligenceValidation.create({
      data: {
        companyId,
        artifactType,
        artifactId,
        accuracy: accuracyMap[feedback],
        rating: ratingMap[feedback],
        feedback: reason || null,
      },
    });

    // Optionally adjust signal confidence based on feedback
    if (artifactType === 'signal' && feedback === 'incorrect') {
      try {
        await db.companySignal.update({
          where: { id: artifactId },
          data: { confidence: Math.max(0, (await db.companySignal.findUnique({ where: { id: artifactId } }))?.confidence ?? 0.5) * 0.5 },
        });
      } catch { /* signal may not exist — non-blocking */ }
    }

    return NextResponse.json({
      success: true,
      feedback: {
        artifactType,
        artifactId,
        status: feedback,
        reason: reason || null,
        recordedAt: validation.validatedAt,
      },
    });
  } catch (error) {
    console.error('[feedback] Error:', error);
    return NextResponse.json({ error: 'Failed to record feedback' }, { status: 500 });
  }
}
