import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET — Single company with counts and research card
   ═══════════════════════════════════════════════════ */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const company = await db.company.findUnique({
      where: { id },
      include: {
        researchCard: true,
        _count: {
          select: {
            contacts: true,
            notes: true,
            signals: true,
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...company,
      contactCount: company._count.contacts,
      noteCount: company._count.notes,
      signalCount: company._count.signals,
    });
  } catch (error) {
    console.error('Company get error:', error);
    return NextResponse.json({ error: 'Failed to fetch company' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   PATCH — Update company fields
   ═══════════════════════════════════════════════════ */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Verify company exists
    const existing = await db.company.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Build update data
    const data: Record<string, any> = {};

    const updatableFields = [
      'rawName', 'domain', 'industry', 'sizeRange', 'location',
      'country', 'website', 'internalSummary', 'status',
      'lifecycleStage', 'assignedTo', 'intelligenceScore',
      'engagementScore', 'lastActivityAt', 'source',
    ];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    // Handle tags — accept array or string, store as JSON string
    if (body.tags !== undefined) {
      if (Array.isArray(body.tags)) {
        data.tags = JSON.stringify(body.tags);
      } else if (typeof body.tags === 'string') {
        data.tags = body.tags;
      }
    }

    // Auto-update normalizedName if rawName changes
    if (data.rawName) {
      data.normalizedName = data.rawName.trim().toLowerCase();
    }

    // Auto-update lastActivityAt on status change
    if (data.status && data.status !== existing.status) {
      data.lastActivityAt = new Date();
    }

    const company = await db.company.update({
      where: { id },
      data,
      include: {
        researchCard: true,
        _count: {
          select: { contacts: true, notes: true, signals: true },
        },
      },
    });

    return NextResponse.json({
      ...company,
      contactCount: company._count.contacts,
      noteCount: company._count.notes,
      signalCount: company._count.signals,
    });
  } catch (error) {
    console.error('Company update error:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   DELETE — Remove company (cascade deletes relations)
   ═══════════════════════════════════════════════════ */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify company exists
    const existing = await db.company.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Cascade delete is handled by Prisma schema (onDelete: Cascade)
    await db.company.delete({ where: { id } });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Company delete error:', error);
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 });
  }
}