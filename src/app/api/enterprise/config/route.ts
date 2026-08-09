/**
 * GET    /api/enterprise/config?tenantId=xxx
 * POST   /api/enterprise/config
 * PUT    /api/enterprise/config
 * DELETE /api/enterprise/config?tenantId=xxx
 *
 * 5.4 — Self-Service Enterprise Configuration API
 *
 * Allows tenants to configure their own scoring weights, signal priorities,
 * and ICP (Ideal Customer Profile) parameters.
 *
 * GET: Returns TenantScoringConfig for the tenant.
 * POST: Upserts partial config (merge with existing).
 * PUT: Full replacement of the config.
 * DELETE: Soft-deletes (sets isActive=false).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { invalidateTenantConfigCache } from '@/lib/tenant-scoring-config';
import { z } from 'zod';

// ── Validation ──────────────────────────────────────────────────────────

const ConfigBodySchema = z.object({
  tenantId: z.string().min(1),
  confidenceWeights: z.record(z.string(), z.number().min(0).max(1)).optional(),
  recommendationWeights: z.record(z.string(), z.number().min(0).max(1)).optional(),
  prioritySignals: z.array(z.string()).optional(),
  targetIndustries: z.array(z.string()).optional(),
  targetSizeRange: z.object({
    min: z.number().int().min(1).optional(),
    max: z.number().int().min(1).optional(),
  }).optional(),
});

// ── GET ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId query parameter is required' },
        { status: 400 },
      );
    }

    const config = await db.tenantScoringConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.isActive) {
      return NextResponse.json(
        { success: false, error: 'No active configuration found for this tenant' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        tenantId: config.tenantId,
        confidenceWeights: config.confidenceWeights,
        recommendationWeights: config.recommendationWeights,
        prioritySignals: config.prioritySignals,
        targetIndustries: config.targetIndustries,
        targetSizeRange: config.targetSizeRange,
        isActive: config.isActive,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    logger.error('[enterprise/config] GET failed', { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── POST: Upsert (merge with existing) ─────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ConfigBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: `Validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}` },
        { status: 400 },
      );
    }

    const { tenantId, ...updateFields } = parsed.data;

    // Fetch existing config for merge
    const existing = await db.tenantScoringConfig.findUnique({
      where: { tenantId },
    });

    // Build merged data
    const mergedData: Record<string, unknown> = { isActive: true };
    if (updateFields.confidenceWeights) {
      const existingWeights = (existing?.confidenceWeights as Record<string, number>) ?? {};
      mergedData.confidenceWeights = { ...existingWeights, ...updateFields.confidenceWeights };
    }
    if (updateFields.recommendationWeights) {
      const existingWeights = (existing?.recommendationWeights as Record<string, number>) ?? {};
      mergedData.recommendationWeights = { ...existingWeights, ...updateFields.recommendationWeights };
    }
    if (updateFields.prioritySignals) {
      mergedData.prioritySignals = updateFields.prioritySignals;
    }
    if (updateFields.targetIndustries) {
      mergedData.targetIndustries = updateFields.targetIndustries;
    }
    if (updateFields.targetSizeRange) {
      const existingRange = (existing?.targetSizeRange as Record<string, number>) ?? {};
      mergedData.targetSizeRange = { ...existingRange, ...updateFields.targetSizeRange };
    }

    const config = await db.tenantScoringConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        confidenceWeights: (mergedData.confidenceWeights as Record<string, number>) ?? {},
        recommendationWeights: (mergedData.recommendationWeights as Record<string, number>) ?? {},
        prioritySignals: (mergedData.prioritySignals as string[]) ?? [],
        targetIndustries: (mergedData.targetIndustries as string[]) ?? [],
        targetSizeRange: (mergedData.targetSizeRange as Record<string, number>) ?? {},
      },
      update: {
        ...(mergedData.confidenceWeights ? { confidenceWeights: mergedData.confidenceWeights } : {}),
        ...(mergedData.recommendationWeights ? { recommendationWeights: mergedData.recommendationWeights } : {}),
        ...(mergedData.prioritySignals ? { prioritySignals: mergedData.prioritySignals } : {}),
        ...(mergedData.targetIndustries ? { targetIndustries: mergedData.targetIndustries } : {}),
        ...(mergedData.targetSizeRange ? { targetSizeRange: mergedData.targetSizeRange } : {}),
      } as Record<string, unknown>,
    });

    // Invalidate cache
    invalidateTenantConfigCache(tenantId);

    logger.info('[enterprise/config] Upserted config', { tenantId, fields: Object.keys(updateFields) });

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        tenantId: config.tenantId,
        confidenceWeights: config.confidenceWeights,
        recommendationWeights: config.recommendationWeights,
        prioritySignals: config.prioritySignals,
        targetIndustries: config.targetIndustries,
        targetSizeRange: config.targetSizeRange,
        isActive: config.isActive,
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    logger.error('[enterprise/config] POST failed', { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── PUT: Full replacement ──────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ConfigBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: `Validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}` },
        { status: 400 },
      );
    }

    const { tenantId, ...fields } = parsed.data;

    const config = await db.tenantScoringConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        confidenceWeights: fields.confidenceWeights ?? {},
        recommendationWeights: fields.recommendationWeights ?? {},
        prioritySignals: fields.prioritySignals ?? [],
        targetIndustries: fields.targetIndustries ?? [],
        targetSizeRange: fields.targetSizeRange ?? {},
      },
      update: {
        confidenceWeights: fields.confidenceWeights ?? {},
        recommendationWeights: fields.recommendationWeights ?? {},
        prioritySignals: fields.prioritySignals ?? [],
        targetIndustries: fields.targetIndustries ?? [],
        targetSizeRange: fields.targetSizeRange ?? {},
      },
    });

    // Invalidate cache
    invalidateTenantConfigCache(tenantId);

    logger.info('[enterprise/config] Replaced config', { tenantId });

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        tenantId: config.tenantId,
        confidenceWeights: config.confidenceWeights,
        recommendationWeights: config.recommendationWeights,
        prioritySignals: config.prioritySignals,
        targetIndustries: config.targetIndustries,
        targetSizeRange: config.targetSizeRange,
        isActive: config.isActive,
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    logger.error('[enterprise/config] PUT failed', { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── DELETE: Soft-delete ────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId query parameter is required' },
        { status: 400 },
      );
    }

    const existing = await db.tenantScoringConfig.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Configuration not found for this tenant' },
        { status: 404 },
      );
    }

    await db.tenantScoringConfig.update({
      where: { tenantId },
      data: { isActive: false },
    });

    // Invalidate cache
    invalidateTenantConfigCache(tenantId);

    logger.info('[enterprise/config] Soft-deleted config', { tenantId });

    return NextResponse.json({
      success: true,
      data: { tenantId, deactivated: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    logger.error('[enterprise/config] DELETE failed', { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
