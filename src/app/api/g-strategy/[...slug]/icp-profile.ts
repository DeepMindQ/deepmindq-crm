import { NextRequest } from 'next/server';
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers';
import { getIcpProfile, updateIcpProfile, resetIcpProfile, normalizeIcpProfile, DEFAULT_ICP } from '@/lib/icp-config';
import { db } from '@/lib/db';
import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════
   GET /api/strategy/icp-profile
   Returns the current ICP configuration (loaded from DB).
   ═══════════════════════════════════════════════════════════════ */

export async function GET() {
  try {
    const profile = await getIcpProfile();
    return apiSuccess({
      profile,
      isDefault: JSON.stringify(profile) === JSON.stringify(DEFAULT_ICP),
    });
  } catch (error) {
    console.error('[icp-profile] GET error:', error);
    return apiError('Failed to fetch ICP profile');
  }
}

/* ═══════════════════════════════════════════════════════════════
   PUT /api/strategy/icp-profile
   Update ICP configuration (partial updates deep-merged).
   Persists to DB immediately.

   Body: Partial<IcpProfile>
     e.g. { "targetIndustries": ["fintech", "saas"] }
   ═══════════════════════════════════════════════════════════════ */

const updateIcpSchema = z.object({
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
  weights: z.object({
    industry: z.number().min(0).max(1).optional(),
    companySize: z.number().min(0).max(1).optional(),
    geography: z.number().min(0).max(1).optional(),
    revenue: z.number().min(0).max(1).optional(),
    techFit: z.number().min(0).max(1).optional(),
  }).optional(),
}).optional();

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Check for reset request
    if (body?.reset === true) {
      const profile = await resetIcpProfile();
      return apiSuccess({
        message: 'ICP profile reset to defaults',
        profile,
        isDefault: true,
      });
    }

    const parsed = validateBody(updateIcpSchema, body);
    if (parsed instanceof Response) return parsed;

    if (!parsed) {
      return apiError('Request body must be a valid object', 400);
    }

    // Validate weights sum if provided
    if (parsed.weights) {
      const current = await getIcpProfile();
      const w = { ...current.weights, ...parsed.weights };
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        return apiError(
          `Static Fit weights must sum to 1.0 (currently ${sum.toFixed(2)}). Adjust weights and try again.`,
          400,
        );
      }
    }

    // Normalise frontend field names → backend canonical names
    const normalised = normalizeIcpProfile(parsed);
    const profile = await updateIcpProfile(normalised as Partial<import('@/lib/icp-config').IcpProfile>);

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

    return apiSuccess({
      message: 'ICP profile updated and persisted',
      profile,
      isDefault: false,
    });
  } catch (error) {
    console.error('[icp-profile] PUT error:', error);
    return apiError('Failed to update ICP profile');
  }
}