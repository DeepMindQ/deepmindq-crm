import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { validateBody } from '@/lib/apiHelpers';
import { updateCompanySchema } from '@/lib/validations';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════
   GET — Single company with counts and research card
   ═══════════════════════════════════════════════════ */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

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
    logger.error('Company get error:', { error: error });
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
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { id } = await params;
    const body = await request.json();
    const parsed = validateBody(updateCompanySchema, body);
    if (parsed instanceof Response) return parsed;

    // Verify company exists
    const existing = await db.company.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Build update data from Zod-validated fields (WI-18.1-04)
    const data: Record<string, any> = {};

    // Use only the validated/parsed fields from Zod, not raw body
    const validatedFields = Object.keys(parsed.data || {});
    for (const field of validatedFields) {
      if (parsed.data[field] !== undefined) {
        data[field] = parsed.data[field];
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
    logger.error('Company update error:', { error: error });
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
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

    // Admin-only: only admins can delete companies
    const session = await (await import('@/lib/session')).getCurrentSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

try {
    const { id } = await params;

    // Verify company exists
    const existing = await db.company.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

      // Audit log before destructive operation
      try {
        const { logAction } = await import('@/lib/audit');
        await logAction('company_deleted', 'company', id, { companyName: existing.rawName });
      } catch { /* non-critical */ }

    // Cascade delete is handled by Prisma schema (onDelete: Cascade)
    await db.company.delete({ where: { id } });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    logger.error('Company delete error:', { error: error });
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 });
  }
}