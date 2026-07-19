import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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

    // Validate structure
    const profile = {
      targetIndustries: Array.isArray(body.targetIndustries) ? body.targetIndustries : [],
      targetSizeRanges: Array.isArray(body.targetSizeRanges) ? body.targetSizeRanges : [],
      targetCountries: Array.isArray(body.targetCountries) ? body.targetCountries : [],
      preferredTechnologies: Array.isArray(body.preferredTechnologies) ? body.preferredTechnologies : [],
      excludeIndustries: Array.isArray(body.excludeIndustries) ? body.excludeIndustries : [],
      minRevenue: body.minRevenue || undefined,
      maxRevenue: body.maxRevenue || undefined,
      minEmployees: body.minEmployees || undefined,
      maxEmployees: body.maxEmployees || undefined,
    };

    await db.systemSetting.upsert({
      where: { key: 'icp_profile' },
      update: { value: JSON.stringify(profile) },
      create: { key: 'icp_profile', value: JSON.stringify(profile) },
    });

    return NextResponse.json({ message: 'ICP profile updated', profile });
  } catch (error) {
    console.error('[icp-profile] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update ICP profile' },
      { status: 500 },
    );
  }
}