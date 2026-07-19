import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET /api/g-outreach/pursuits
   List all pursuits with opportunity and company context.

   Query params:
     ?status=active|paused|won|lost
     ?outcomeStage=discovery|qualification|proposal|negotiation|closed_won|closed_lost
     ?owner=xxx
     ?companyId=xxx
     ?limit=50
   ═══════════════════════════════════════ */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const stageFilter = searchParams.get('outcomeStage');
    const ownerFilter = searchParams.get('owner');
    const companyIdFilter = searchParams.get('companyId');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    const whereClause: Record<string, unknown> = {};
    if (statusFilter) whereClause.status = statusFilter;
    if (stageFilter) whereClause.outcomeStage = stageFilter;
    if (ownerFilter) whereClause.owner = ownerFilter;
    if (companyIdFilter) whereClause.companyId = companyIdFilter;

    const pursuits = await db.pursuit.findMany({
      where: whereClause,
      include: {
        opportunity: {
          select: {
            id: true,
            opportunityTitle: true,
            recommendedCapability: true,
            opportunityScore: true,
            status: true,
          },
        },
        company: {
          select: { id: true, rawName: true, normalizedName: true, industry: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      total: pursuits.length,
      pursuits: pursuits.map(p => ({
        id: p.id,
        opportunityId: p.opportunityId,
        companyId: p.companyId,
        owner: p.owner,
        priority: p.priority,
        status: p.status,
        outcomeStage: p.outcomeStage,
        nextAction: p.nextAction,
        nextActionAt: p.nextActionAt?.toISOString() || null,
        outcome: p.outcome,
        notes: p.notes,
        opportunity: p.opportunity,
        company: {
          id: p.company.id,
          name: p.company.normalizedName || p.company.rawName,
          industry: p.company.industry,
        },
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[pursuits] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load pursuits', detail: String(error) },
      { status: 500 },
    );
  }
}

/* ═══════════════════════════════════════════════════
   PATCH /api/g-outreach/pursuits/[id]
   Update a pursuit: stage progression, owner, next action, notes.

   Body:
     outcomeStage?: string     — discovery|qualification|proposal|negotiation|closed_won|closed_lost
     status?: string           — active|paused|won|lost
     owner?: string
     nextAction?: string
     nextActionAt?: string     — ISO date
     outcome?: string          — Free-text outcome
     notes?: string

   IMPORTANT: Only humans update pursuits. AI never calls this endpoint.
   ═══════════════════════════════════════ */

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  try {
    const { slug } = await params;
    const pursuitId = slug[1]; // pursuits/[id]
    if (!pursuitId) {
      return NextResponse.json({ error: 'Pursuit ID required' }, { status: 400 });
    }

    const body = await request.json();

    // Validate outcomeStage if provided
    const VALID_STAGES = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    if (body.outcomeStage && !VALID_STAGES.includes(body.outcomeStage)) {
      return NextResponse.json(
        { error: `outcomeStage must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate status if provided
    const VALID_STATUSES = ['active', 'paused', 'won', 'lost'];
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    // Auto-derive status from outcomeStage
    const updateData: Record<string, unknown> = {};
    if (body.outcomeStage) updateData.outcomeStage = body.outcomeStage;
    if (body.status) updateData.status = body.status;
    else if (body.outcomeStage === 'closed_won') updateData.status = 'won';
    else if (body.outcomeStage === 'closed_lost') updateData.status = 'lost';
    if (body.owner !== undefined) updateData.owner = body.owner;
    if (body.nextAction !== undefined) updateData.nextAction = body.nextAction;
    if (body.nextActionAt) updateData.nextActionAt = new Date(body.nextActionAt);
    if (body.outcome !== undefined) updateData.outcome = body.outcome;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const pursuit = await db.pursuit.update({
      where: { id: pursuitId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      pursuit: {
        id: pursuit.id,
        outcomeStage: pursuit.outcomeStage,
        status: pursuit.status,
        owner: pursuit.owner,
        nextAction: pursuit.nextAction,
        nextActionAt: pursuit.nextActionAt?.toISOString() || null,
      },
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Pursuit not found' }, { status: 404 });
    }
    console.error('[pursuits] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update pursuit', detail: String(error) },
      { status: 500 },
    );
  }
}