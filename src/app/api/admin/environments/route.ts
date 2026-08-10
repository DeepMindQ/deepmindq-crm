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
    const body = await request.json();
    const { environment, featureFlags, deploymentUrl } = body;

    if (!environment || typeof environment !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "environment" field', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // Validate environment name
    const validEnvironments = ['development', 'staging', 'production'];
    if (!validEnvironments.includes(environment)) {
      return NextResponse.json(
        { success: false, error: `Invalid environment. Must be one of: ${validEnvironments.join(', ')}`, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (featureFlags !== undefined) {
      if (typeof featureFlags !== 'object' || featureFlags === null || Array.isArray(featureFlags)) {
        return NextResponse.json(
          { success: false, error: 'featureFlags must be a JSON object', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      updateData.featureFlags = featureFlags;
    }
    if (deploymentUrl !== undefined) {
      if (typeof deploymentUrl !== 'string') {
        return NextResponse.json(
          { success: false, error: 'deploymentUrl must be a string', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
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
    const body = await request.json();
    const { action, from, to } = body;

    if (action !== 'promote') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "promote".', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing "from" or "to" environment', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

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
