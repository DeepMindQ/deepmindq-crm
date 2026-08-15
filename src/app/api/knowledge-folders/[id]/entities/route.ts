import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const addEntitySchema = z.object({
  entityId: z.string().min(1),
  entityType: z.enum(['organization', 'person']),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const body = await request.json();
    const parsed = addEntitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Verify folder exists
    const folder = await db.knowledgeFolder.findUnique({ where: { id } });
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Verify entity exists
    if (parsed.data.entityType === 'organization') {
      const org = await db.organization.findUnique({ where: { id: parsed.data.entityId } });
      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
    } else {
      const person = await db.person.findUnique({ where: { id: parsed.data.entityId } });
      if (!person) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      }
    }

    const entity = await db.knowledgeFolderEntity.create({
      data: {
        folderId: id,
        entityId: parsed.data.entityId,
        entityType: parsed.data.entityType,
      },
    });

    return NextResponse.json({ data: entity }, { status: 201 });
  } catch (error: unknown) {
    // Handle unique constraint violation (already in folder)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'Entity already in this folder' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to add entity to folder' }, { status: 500 });
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
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');
    const entityType = searchParams.get('entityType');

    if (!entityId || !entityType) {
      return NextResponse.json(
        { error: 'Missing entityId or entityType query params' },
        { status: 400 },
      );
    }

    if (!['organization', 'person'].includes(entityType)) {
      return NextResponse.json(
        { error: 'entityType must be organization or person' },
        { status: 400 },
      );
    }

    const deleted = await db.knowledgeFolderEntity.deleteMany({
      where: {
        folderId: id,
        entityId,
        entityType,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Entity not found in folder' }, { status: 404 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to remove entity from folder' }, { status: 500 });
  }
}
