import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { normalizeIcpProfile } from '@/lib/icp-config';

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

    const profile = setting?.value
      ? JSON.parse(setting.value)
      : {
          targetIndustries: [],
          targetSizeRanges: [],
          targetCountries: [],
          preferredTechnologies: [],
          excludeIndustries: [],
        };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[icp-profile] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load ICP profile' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/g-system/icp-profile
 *
 * Phase 5: Update ICP configuration (stored in SystemSetting key "icp_profile").
 * No new model — uses existing SystemSetting.
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Normalise frontend field names → backend canonical names
    const normalised = normalizeIcpProfile(body);

    // Build stored profile with canonical field names
    const profile = {
      targetIndustries: Array.isArray(normalised.targetIndustries) ? normalised.targetIndustries : [],
      targetSizeRanges: Array.isArray(normalised.targetSizeRanges) ? normalised.targetSizeRanges : [],
      targetRegions: Array.isArray(normalised.targetRegions) ? normalised.targetRegions : [],
      preferredTechKeywords: Array.isArray(normalised.preferredTechKeywords) ? normalised.preferredTechKeywords : [],
      excludedIndustries: Array.isArray(normalised.excludedIndustries) ? normalised.excludedIndustries : [],
      minRevenue: normalised.minRevenue || undefined,
      maxRevenue: normalised.maxRevenue || undefined,
      minEmployeeCount: normalised.minEmployeeCount ?? undefined,
      maxEmployeeCount: normalised.maxEmployeeCount ?? undefined,
    };

    await db.systemSetting.upsert({
      where: { key: 'icp_profile' },
      update: { value: JSON.stringify(profile) },
      create: { key: 'icp_profile', value: JSON.stringify(profile) },
    });

    // GAP-22: Invalidate stale priority scores so UI knows recomputation is needed
    try {
      await db.company.updateMany({
        data: { priorityComputedAt: null },
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