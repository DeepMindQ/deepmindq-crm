/**
 * Phase 7.3 — Custom Intelligence Scoring Configuration
 *
 * GET:  Get current scoring config + history of changes
 * PUT:  Update scoring weights (with validation + audit trail)
 * POST: Reset to defaults
 *
 * Auth: Admin only
 */

import { NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getScoringConfig, updateScoringConfig, DEFAULT_SCORING_CONFIG } from '@/lib/scoring-config';
import type { ScoringConfig } from '@/lib/scoring-config';
import { logDataAccess } from '@/lib/access-audit';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/scoring — Current config + change history
// ═══════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const [currentConfig, history] = await Promise.all([
      getScoringConfig(),
      db.scoringConfigHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Log data access
    await logDataAccess({
      userId: session!.id,
      action: 'read',
      entityType: 'scoringConfig',
      entityId: 'current',
      request,
    });

    return NextResponse.json({
      success: true,
      data: {
        config: currentConfig,
        history,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[api/admin/scoring] GET error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scoring configuration', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// PUT /api/admin/scoring — Update scoring weights with audit trail
// Body: Partial<ScoringConfig> + { changeReason?: string }
// ═══════════════════════════════════════════════════════════════
export async function PUT(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();
    const { changeReason, ...partialConfig } = body;

    // Get current config for history recording
    const previousConfig = await getScoringConfig();

    try {
      // updateScoringConfig validates weight sums, thresholds, etc.
      const newConfig = await updateScoringConfig(partialConfig as Partial<ScoringConfig>);

      // Save change history entry
      await db.scoringConfigHistory.create({
        data: {
          previousConfig: previousConfig as unknown as Record<string, unknown>,
          newConfig: newConfig as unknown as Record<string, unknown>,
          changedBy: session!.id,
          changeReason: changeReason || null,
        },
      });

      // Log data access
      await logDataAccess({
        userId: session!.id,
        action: 'write',
        entityType: 'scoringConfig',
        entityId: 'current',
        metadata: {
          changeReason,
          changes: Object.keys(partialConfig),
        },
        request,
      });

      logger.info('[api/admin/scoring] Config updated', {
        changedBy: session!.email,
        changes: Object.keys(partialConfig),
      });

      return NextResponse.json({
        success: true,
        data: newConfig,
        timestamp: new Date().toISOString(),
      });
    } catch (validationErr) {
      const message = validationErr instanceof Error ? validationErr.message : 'Validation failed';
      return NextResponse.json(
        { success: false, error: message, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }
  } catch (err) {
    logger.error('[api/admin/scoring] PUT error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to update scoring configuration', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/scoring — Reset to defaults
// Body: { action: 'reset' }
// ═══════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();
    const { action } = body;

    if (action !== 'reset') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "reset" to restore defaults.', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // Get current config for history recording
    const previousConfig = await getScoringConfig();

    const newConfig = await updateScoringConfig(DEFAULT_SCORING_CONFIG);

    // Save history entry
    await db.scoringConfigHistory.create({
      data: {
        previousConfig: previousConfig as unknown as Record<string, unknown>,
        newConfig: newConfig as unknown as Record<string, unknown>,
        changedBy: session!.id,
        changeReason: 'Reset to defaults',
      },
    });

    // Log data access
    await logDataAccess({
      userId: session!.id,
      action: 'write',
      entityType: 'scoringConfig',
      entityId: 'current',
      metadata: { action: 'reset' },
      request,
    });

    logger.info('[api/admin/scoring] Config reset to defaults', {
      changedBy: session!.email,
    });

    return NextResponse.json({
      success: true,
      data: newConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[api/admin/scoring] POST error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to reset scoring configuration', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
