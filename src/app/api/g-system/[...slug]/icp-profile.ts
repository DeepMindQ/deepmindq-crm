import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { normalizeIcpProfile, DEFAULT_ICP } from '@/lib/icp-config';
import { z } from 'zod';

/**
 * GET /api/g-system/icp-profile
 *
 * Phase 5: Retrieve ICP configuration from SystemSetting.
 */
export async function GET() {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: 'icp_profile' },
    });

    // GAP-3: Use canonical field names in default fallback & normalize DB-sourced data
    const rawProfile = setting?.value
      ? JSON.parse(setting.value)
      : null;

    // Normalize to canonical backend field names (handles legacy frontend names)
    const profile = normalizeIcpProfile(rawProfile || {
      targetIndustries: [],
      targetSizeRanges: [],
      targetRegions: [],
      preferredTechKeywords: [],
      excludedIndustries: [],
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[icp-profile] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load ICP profile' },
      { status: 500 },
    );
  }
}

/* ═══════════════ Validation Schema ═══════════════ */

const icpWeightsSchema = z.object({
  industry: z.number().min(0).max(1).optional(),
  companySize: z.number().min(0).max(1).optional(),
  geography: z.number().min(0).max(1).optional(),
  revenue: z.number().min(0).max(1).optional(),
  techFit: z.number().min(0).max(1).optional(),
});

const icpProfileSchema = z.object({
  // Backend canonical names
  targetIndustries: z.array(z.string()).optional(),
  targetSizeRanges: z.array(z.string()).optional(),
  targetRegions: z.array(z.string()).optional(),
  minEmployeeCount: z.number().int().min(0).optional(),
  maxEmployeeCount: z.number().int().min(-1).optional(),
  minRevenue: z.string().optional(),
  maxRevenue: z.string().optional(),
  targetFundingStages: z.array(z.string()).optional(),
  preferredTechKeywords: z.array(z.string()).optional(),
  excludedIndustries: z.array(z.string()).optional(),
  // Frontend field names (will be normalised)
  targetCountries: z.array(z.string()).optional(),
  preferredTechnologies: z.array(z.string()).optional(),
  excludeIndustries: z.array(z.string()).optional(),
  minEmployees: z.number().int().min(0).optional(),
  maxEmployees: z.number().int().min(-1).optional(),
  weights: icpWeightsSchema.optional(),
}).optional();

/**
 * PUT /api/g-system/icp-profile
 *
 * Phase 5: Update ICP configuration (stored in SystemSetting key "icp_profile").
 * Includes full weight validation and critical array non-empty checks.
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Handle reset request
    if (body?.reset === true) {
      await db.systemSetting.upsert({
        where: { key: 'icp_profile' },
        update: { value: JSON.stringify(DEFAULT_ICP) },
        create: { key: 'icp_profile', value: JSON.stringify(DEFAULT_ICP) },
      });

      // Invalidate all priority scores on reset
      try {
        await db.company.updateMany({
          data: {
            accountPriorityScore: null,
            priorityTier: null,
            priorityComputedAt: null,
          },
        });
        await db.systemSetting.upsert({
          where: { key: 'priority_scores_stale' },
          create: {
            key: 'priority_scores_stale',
            value: JSON.stringify({ stale: true, invalidatedAt: new Date().toISOString() }),
          },
          update: {
            value: JSON.stringify({ stale: true, invalidatedAt: new Date().toISOString() }),
          },
        });
      } catch (invalidateErr) {
        console.warn('[icp-profile] Score invalidation failed (non-blocking):', invalidateErr);
      }

      return NextResponse.json({ message: 'ICP profile reset to defaults', profile: DEFAULT_ICP });
    }

    // Validate request body via Zod
    const parsed = icpProfileSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Validation error: ${firstError.message}`, details: parsed.error.issues },
        { status: 400 },
      );
    }

    // Normalise frontend field names → backend canonical names
    const normalised = normalizeIcpProfile(parsed.data);

    // Build stored profile with canonical field names
    const targetIndustries = Array.isArray(normalised.targetIndustries) ? normalised.targetIndustries : [];
    const targetRegions = Array.isArray(normalised.targetRegions) ? normalised.targetRegions : [];

    const profile = {
      targetIndustries,
      targetSizeRanges: Array.isArray(normalised.targetSizeRanges) ? normalised.targetSizeRanges : [],
      targetRegions,
      preferredTechKeywords: Array.isArray(normalised.preferredTechKeywords) ? normalised.preferredTechKeywords : [],
      excludedIndustries: Array.isArray(normalised.excludedIndustries) ? normalised.excludedIndustries : [],
      minRevenue: normalised.minRevenue || undefined,
      maxRevenue: normalised.maxRevenue || undefined,
      minEmployeeCount: normalised.minEmployeeCount ?? undefined,
      maxEmployeeCount: normalised.maxEmployeeCount ?? undefined,
    };

    // GAP-31: Validate critical arrays are non-empty
    if (targetIndustries.length === 0) {
      return NextResponse.json(
        { error: 'targetIndustries must not be empty — define at least one target industry for the ICP to function.' },
        { status: 400 },
      );
    }
    if (targetRegions.length === 0) {
      return NextResponse.json(
        { error: 'targetRegions must not be empty — define at least one target region for the ICP to function.' },
        { status: 400 },
      );
    }

    // GAP-31: Validate weights if provided
    if (normalised.weights) {
      // Zod already validated each individual weight is 0-1
      const currentWeights = DEFAULT_ICP.weights;
      const mergedWeights = { ...currentWeights, ...normalised.weights };
      const weightValues = Object.values(mergedWeights) as number[];
      const sum = weightValues.reduce((a, b) => a + b, 0);

      if (Math.abs(sum - 1.0) > 0.01) {
        return NextResponse.json(
          { error: `Static Fit weights must sum to 1.0 (currently ${sum.toFixed(2)}). Adjust weights and try again.` },
          { status: 400 },
        );
      }
    }

    await db.systemSetting.upsert({
      where: { key: 'icp_profile' },
      update: { value: JSON.stringify(profile) },
      create: { key: 'icp_profile', value: JSON.stringify(profile) },
    });

    // GAP-32: Invalidate ALL priority score fields (not just priorityComputedAt)
    // so UI shows "needs recomputation" state with the new ICP profile.
    try {
      await db.company.updateMany({
        data: {
          accountPriorityScore: null,
          priorityTier: null,
          priorityComputedAt: null,
        },
      });
      await db.systemSetting.upsert({
        where: { key: 'priority_scores_stale' },
        create: {
          key: 'priority_scores_stale',
          value: JSON.stringify({ stale: true, invalidatedAt: new Date().toISOString() }),
        },
        update: {
          value: JSON.stringify({ stale: true, invalidatedAt: new Date().toISOString() }),
        },
      });
    } catch (invalidateErr) {
      console.warn('[icp-profile] Score invalidation failed (non-blocking):', invalidateErr);
    }

    return NextResponse.json({ message: 'ICP profile updated', profile });
  } catch (error) {
    console.error('[icp-profile] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update ICP profile' },
      { status: 500 },
    );
  }
}