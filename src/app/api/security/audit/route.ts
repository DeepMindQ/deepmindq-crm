/**
 * API: /api/security/audit — Comprehensive Audit Trail
 *
 * GET — Query audit trail with advanced filtering
 * POST — Create a manual audit entry (admin only)
 *      — Trigger compliance export
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  queryComprehensiveAudit,
  exportAuditTrail,
  getAuditStatistics,
  createAuditEntry,
} from '@/lib/comprehensive-audit';

export async function GET(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const { searchParams } = request.nextUrl;
    const mode = searchParams.get('mode');

    // Statistics mode
    if (mode === 'stats') {
      const stats = await getAuditStatistics({
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
      });
      return NextResponse.json({ success: true, data: stats });
    }

    // Export mode
    if (mode === 'export') {
      const format = (searchParams.get('format') || 'json') as 'csv' | 'json';
      const exportResult = await exportAuditTrail({
        format,
        startDate: searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: searchParams.get('endDate') || new Date().toISOString(),
        entity: (searchParams.get('entity') as any) || undefined,
        action: (searchParams.get('action') as any) || undefined,
      });

      if (!exportResult) {
        return NextResponse.json(
          { success: false, error: 'No audit data to export' },
          { status: 404 },
        );
      }

      return new Response(exportResult.content, {
        headers: {
          'Content-Type': exportResult.mimeType,
          'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        },
      });
    }

    // Default: query mode
    const result = await queryComprehensiveAudit({
      action: (searchParams.get('action') as any) || undefined,
      entity: (searchParams.get('entity') as any) || undefined,
      entityId: searchParams.get('entityId') || undefined,
      actorId: searchParams.get('actorId') || undefined,
      actorEmail: searchParams.get('actorEmail') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      changesField: searchParams.get('changesField') || undefined,
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('[API:audit] GET failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to query audit trail' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();
    const { action, entity, entityId, metadata } = body;

    if (!action || !entity) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: action, entity' },
        { status: 400 },
      );
    }

    const entryId = await createAuditEntry({
      action,
      entity,
      entityId: entityId || session!.id,
      actorId: session!.id,
      actorEmail: session!.email,
      actorRole: session!.role,
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      data: { entryId },
    });
  } catch (error) {
    logger.error('[API:audit] POST failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to create audit entry' },
      { status: 500 },
    );
  }
}
