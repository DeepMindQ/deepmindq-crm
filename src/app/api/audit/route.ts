import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

// GET /api/audit — returns audit entries (admin-only)
export async function GET(request: NextRequest) {
  // Auth gate: admin-only for audit data
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '200', 10);

    const auditLogs = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });

    // Map DB shape → frontend shape (matches AuditEntry interface in dashboard-screen.tsx)
    const entries = auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId || undefined,
      details: log.details || '',
      createdAt: log.createdAt.toISOString(),
    }));

    return apiSuccess(entries);
  } catch (error) {
    logger.error('Audit error:', { error: error });
    return apiError('Failed to fetch audit entries', 500);
  }
}