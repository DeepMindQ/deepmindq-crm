import { NextRequest } from 'next/server';
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers';
import { getIcpProfile, updateIcpProfile, resetIcpProfile, DEFAULT_ICP } from '@/lib/icp-config';
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
  targetIndustries: z.array(z.string()).optional(),
  targetSizeRanges: z.array(z.string()).optional(),
  targetRegions: z.array(z.string()).optional(),
  minEmployeeCount: z.number().int().min(0).optional(),
  maxEmployeeCount: z.number().int().min(-1).optional(),
  minRevenue: z.string().optional(),
  targetFundingStages: z.array(z.string()).optional(),
  preferredTechKeywords: z.array(z.string()).optional(),
  excludedIndustries: z.array(z.string()).optional(),
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

    const profile = await updateIcpProfile(parsed as Partial<import('@/lib/icp-config').IcpProfile>);

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