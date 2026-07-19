import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

/* ═══════════════════════════════════════════════════
   GET /api/g-crm/pursuits
   List all pursuits with filters.
   Query params: ?status, ?owner, ?companyId
   ═══════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const owner = searchParams.get('owner');
    const companyId = searchParams.get('companyId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (owner) where.owner = owner;
    if (companyId) where.companyId = companyId;

    const pursuits = await db.pursuit.findMany({
      where,
      include: {
        opportunity: {
          select: {
            id: true,
            opportunityTitle: true,
            businessTrigger: true,
            recommendedCapability: true,
            opportunityScore: true,
            priority: true,
          },
        },
        company: {
          select: { id: true, rawName: true, normalizedName: true, industry: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = pursuits.map(p => ({
      ...p,
      companyName: p.company.rawName || p.company.normalizedName,
      companyIndustry: p.company.industry,
      company: undefined,
    }));

    return apiSuccess(enriched);
  } catch (err) {
    console.error('[pursuits GET]', err);
    return apiError('Failed to list pursuits');
  }
}

/* ═══════════════════════════════════════════════════
   PATCH /api/g-crm/pursuits
   Update a pursuit.
   Body: { id, owner?, priority?, status?, nextAction?, nextActionAt?, outcome?, outcomeStage?, notes? }
   ═══════════════════════════════════════════════════ */

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return apiError('id is required', 400);
    }

    // Verify pursuit exists
    const pursuit = await db.pursuit.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!pursuit) {
      return apiError('Pursuit not found', 404);
    }

    // Build update data — only include provided fields
    const data: Record<string, unknown> = {};
    if (updateFields.owner !== undefined) data.owner = updateFields.owner || null;
    if (updateFields.priority !== undefined) data.priority = updateFields.priority;
    if (updateFields.status !== undefined) data.status = updateFields.status;
    if (updateFields.nextAction !== undefined) data.nextAction = updateFields.nextAction || null;
    if (updateFields.nextActionAt !== undefined) {
      data.nextActionAt = updateFields.nextActionAt ? new Date(updateFields.nextActionAt) : null;
    }
    if (updateFields.outcome !== undefined) data.outcome = updateFields.outcome || null;
    if (updateFields.outcomeStage !== undefined) data.outcomeStage = updateFields.outcomeStage || null;
    if (updateFields.notes !== undefined) data.notes = updateFields.notes || null;

    if (Object.keys(data).length === 0) {
      return apiError('No fields to update', 400);
    }

    const updated = await db.pursuit.update({
      where: { id },
      data,
    });

    return apiSuccess(updated);
  } catch (err) {
    console.error('[pursuits PATCH]', err);
    return apiError(err instanceof Error ? err.message : 'Failed to update pursuit');
  }
}