/**
 * Phase 7.5 — Multi-Environment Support
 *
 * GET:  List all environments
 * PUT:  Update environment config (feature flags, deployment URL)
 * POST: Promote staging to production (copy feature flags)
 *
 * Auth: Admin only
 */

import { NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { logDataAccess } from '@/lib/access-audit';
import { validateBody } from '@/lib/apiHelpers';
import { adminEnvironmentPutSchema, adminEnvironmentPromoteSchema } from '@/lib/validation-schemas';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/environments — List all environments
// ═══════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const environments = await db.environmentConfig.findMany({
      orderBy: { environment: 'asc' },
    });

    // Log data access
    await logDataAccess({
      userId: session!.id,
      action: 'read',
      entityType: 'environmentConfig',
      entityId: 'all',
      request,
    });

    return NextResponse.json({
      success: true,
      data: environments,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[api/admin/environments] GET error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch environments', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// PUT /api/admin/environments — Update environment config
// Body: { environment, featureFlags?, deploymentUrl? }
// ═══════════════════════════════════════════════════════════════
export async function PUT(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const rawBody = await request.json();
    const parsed = validateBody(adminEnvironmentPutSchema, rawBody);
    if (parsed instanceof Response) return parsed;
    const { environment, featureFlags, deploymentUrl } = parsed;

    const updateData: Record<string, unknown> = {};
    if (featureFlags !== undefined) {
      updateData.featureFlags = featureFlags;
    }
    if (deploymentUrl !== undefined) {
      updateData.deploymentUrl = deploymentUrl;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const updated = await db.environmentConfig.upsert({
      where: { environment },
      update: updateData,
      create: {
        environment,
        featureFlags: featureFlags ? (featureFlags as Record<string, unknown>) : {},
        deploymentUrl: (deploymentUrl as string) || null,
      },
    });

    // Log data access
    await logDataAccess({
      userId: session!.id,
      action: 'write',
      entityType: 'environmentConfig',
      entityId: environment,
      metadata: { changes: Object.keys(updateData) },
      request,
    });

    logger.info('[api/admin/environments] Environment updated', {
      environment,
      changes: Object.keys(updateData),
      actor: session!.email,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[api/admin/environments] PUT error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to update environment configuration', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/environments — Promote staging to production
// Body: { action: 'promote', from: 'staging', to: 'production' }
// ═══════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const rawBody = await request.json();
    const parsed = validateBody(adminEnvironmentPromoteSchema, rawBody);
    if (parsed instanceof Response) return parsed;
    const { from, to } = parsed;

    // Fetch source environment
    const sourceEnv = await db.environmentConfig.findUnique({
      where: { environment: from },
    });

    if (!sourceEnv) {
      return NextResponse.json(
        { success: false, error: `Source environment "${from}" not found`, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // Copy feature flags from source to target
    const updated = await db.environmentConfig.upsert({
      where: { environment: to },
      update: {
        featureFlags: sourceEnv.featureFlags as Record<string, unknown>,
        lastPromotedAt: new Date(),
        promotedBy: session!.id,
      },
      create: {
        environment: to,
        featureFlags: sourceEnv.featureFlags as Record<string, unknown>,
        lastPromotedAt: new Date(),
        promotedBy: session!.id,
      },
    });

    // Log data access
    await logDataAccess({
      userId: session!.id,
      action: 'write',
      entityType: 'environmentConfig',
      entityId: to,
      metadata: {
        action: 'promote',
        from,
        to,
      },
      request,
    });

    logger.info('[api/admin/environments] Promotion executed', {
      from,
      to,
      actor: session!.email,
    });

    return NextResponse.json({
      success: true,
      data: {
        promoted: true,
        from,
        to,
        config: updated,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[api/admin/environments] POST error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to promote environment', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
