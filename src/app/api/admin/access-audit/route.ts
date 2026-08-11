/**
 * Phase 6.4 — Data Access Audit API
 *
 * GET: Query access audit log with filters
 *
 * Auth: Admin only
 */

import { NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { queryAccessAudit } from '@/lib/access-audit';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/access-audit — Query data access audit log
// Query: ?userId, &entityType, &entityId, &action, &startDate, &endDate, &limit, &offset
// ═══════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const { searchParams } = new URL(request.url);

    const params = {
      userId: searchParams.get('userId') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      entityId: searchParams.get('entityId') || undefined,
      action: searchParams.get('action') || undefined,
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
      limit: searchParams.get('limit')
        ? Math.min(parseInt(searchParams.get('limit')!, 10), 500)
        : 50,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!, 10)
        : 0,
    };

    // Validate limit
    if (!Number.isFinite(params.limit) || params.limit < 1) {
      params.limit = 50;
    }
    // Validate offset
    if (!Number.isFinite(params.offset) || params.offset < 0) {
      params.offset = 0;
    }

    const result = await queryAccessAudit(params);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[api/admin/access-audit] GET error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to query access audit log', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
