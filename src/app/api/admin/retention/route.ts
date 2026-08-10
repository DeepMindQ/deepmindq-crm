/**
 * Phase 7.4 — Data Retention Policy Management
 *
 * GET:  List all retention policies + next scheduled cleanup info
 * PUT:  Update a retention policy (retentionDays, actionType, isActive, legalHold)
 * POST: Trigger manual cleanup or set legal hold
 *
 * Auth: Admin only
 */

import { NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  getRetentionPolicies,
  updateRetentionPolicy,
  setLegalHold,
  executeRetentionCleanup,
} from '@/lib/retention-policy-engine';
import { logDataAccess } from '@/lib/access-audit';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/retention — List all retention policies
// ═══════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const policies = await getRetentionPolicies();

    // Get next scheduled cleanup info from the earliest lastRunAt
    const allPolicies = await db.retentionPolicy.findMany({
      where: { isActive: true },
      select: { entityType: true, lastRunAt: true },
      orderBy: { lastRunAt: 'asc' },
    });

    const nextCleanup = allPolicies.length > 0 && allPolicies[0].lastRunAt
      ? {
          earliestLastRun: allPolicies[0].lastRunAt.toISOString(),
        }
      : null;

    // Log data access
    await logDataAccess({
      userId: session!.id,
      action: 'read',
      entityType: 'retentionPolicy',
      entityId: 'all',
      request,
    });

    return NextResponse.json({
      success: true,
      data: { policies, nextCleanup },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[api/admin/retention] GET error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch retention policies', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// PUT /api/admin/retention — Update a retention policy
// Body: { entityType, retentionDays?, actionType?, isActive?, legalHold? }
// ═══════════════════════════════════════════════════════════════
export async function PUT(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();
    const { entityType, retentionDays, actionType, isActive, legalHold } = body;

    if (!entityType || typeof entityType !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "entityType" field', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedBy: session!.id };
    if (retentionDays !== undefined) {
      const days = typeof retentionDays === 'number' ? retentionDays : parseInt(retentionDays, 10);
      if (!Number.isFinite(days) || days < 1) {
        return NextResponse.json(
          { success: false, error: 'retentionDays must be a positive integer', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      updates.retentionDays = days;
    }
    if (actionType !== undefined) {
      const validActions = ['delete', 'archive', 'anonymize'];
      if (!validActions.includes(actionType)) {
        return NextResponse.json(
          { success: false, error: `actionType must be one of: ${validActions.join(', ')}`, timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      updates.actionType = actionType;
    }
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (legalHold !== undefined) updates.legalHold = Boolean(legalHold);

    const updated = await updateRetentionPolicy(entityType, updates as Parameters<typeof updateRetentionPolicy>[1]);

    // Log data access
    await logDataAccess({
      userId: session!.id,
      action: 'write',
      entityType: 'retentionPolicy',
      entityId: entityType,
      metadata: { changes: Object.keys(updates) },
      request,
    });

    logger.info('[api/admin/retention] Policy updated', {
      entityType,
      changes: Object.keys(updates),
      actor: session!.email,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[api/admin/retention] PUT error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to update retention policy', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/retention — Trigger manual cleanup or legal hold
// Body: { action: 'cleanup' | 'legal_hold', entityType?, hold?, reason? }
// ═══════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();
    const { action, entityType, hold, reason } = body;

    if (!action || (action !== 'cleanup' && action !== 'legal_hold')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "action". Must be "cleanup" or "legal_hold"', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    if (action === 'cleanup') {
      // Log data access
      await logDataAccess({
        userId: session!.id,
        action: 'admin_access',
        entityType: 'retentionPolicy',
        entityId: 'cleanup',
        metadata: { triggeredBy: session!.email },
        request,
      });

      const result = await executeRetentionCleanup();

      logger.info('[api/admin/retention] Manual cleanup triggered', {
        actor: session!.email,
        totalDeleted: result.totalDeleted,
        duration: result.duration,
      });

      return NextResponse.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'legal_hold') {
      if (!entityType || typeof entityType !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Missing "entityType" for legal_hold action', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      if (typeof hold !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid "hold" (must be boolean)', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      if (hold && (!reason || typeof reason !== 'string')) {
        return NextResponse.json(
          { success: false, error: '"reason" is required when setting legal hold', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }

      const updated = await setLegalHold(entityType, hold, reason || '');

      // Log data access
      await logDataAccess({
        userId: session!.id,
        action: 'write',
        entityType: 'retentionPolicy',
        entityId: entityType,
        metadata: { legalHold: hold, reason },
        request,
      });

      logger.info('[api/admin/retention] Legal hold updated', {
        entityType,
        hold,
        actor: session!.email,
      });

      return NextResponse.json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  } catch (err) {
    logger.error('[api/admin/retention] POST error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to execute retention action', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
