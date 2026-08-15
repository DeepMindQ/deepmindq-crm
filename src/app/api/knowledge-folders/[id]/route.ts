import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const updateFolderSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const folder = await db.knowledgeFolder.findUnique({
      where: { id },
      include: {
        entities: true,
        _count: { select: { entities: true } },
      },
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Enrich entities with actual entity names
    const orgIds = folder.entities
      .filter((e) => e.entityType === 'organization')
      .map((e) => e.entityId);
    const personIds = folder.entities
      .filter((e) => e.entityType === 'person')
      .map((e) => e.entityId);

    const [orgs, people] = await Promise.all([
      orgIds.length > 0
        ? db.organization.findMany({
            where: { id: { in: orgIds } },
            select: { id: true, name: true },
          })
        : [],
      personIds.length > 0
        ? db.person.findMany({
            where: { id: { in: personIds } },
            select: { id: true, fullName: true },
          })
        : [],
    ]);

    const orgMap = new Map(orgs.map((o) => [o.id, o.name]));
    const personMap = new Map(people.map((p) => [p.id, p.fullName]));

    const enrichedEntities = folder.entities.map((e) => ({
      id: e.id,
      entityId: e.entityId,
      entityType: e.entityType,
      entityName:
        e.entityType === 'organization'
          ? orgMap.get(e.entityId) || e.entityId
          : personMap.get(e.entityId) || e.entityId,
      addedBy: e.addedBy,
      addedAt: e.addedAt,
    }));

    return NextResponse.json({
      data: {
        id: folder.id,
        name: folder.name,
        description: folder.description,
        color: folder.color,
        icon: folder.icon,
        createdBy: folder.createdBy,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        entityCount: folder._count.entities,
        entities: enrichedEntities,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch folder' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const body = await request.json();
    const parsed = updateFolderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await db.knowledgeFolder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const updated = await db.knowledgeFolder.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { entities: true } } },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        color: updated.color,
        icon: updated.icon,
        count: updated._count.entities,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const existing = await db.knowledgeFolder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    await db.knowledgeFolder.delete({ where: { id } });

    return NextResponse.json({ data: { success: true } });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
