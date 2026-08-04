/**
 * GET /api/compliance — API Compliance Report
 *
 * Returns the enterprise API compliance matrix showing
 * which routes have auth, validation, rate limiting, audit, etc.
 * Requires admin access.
 *
 * Phase 5: API Governance
 */
import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { scanApiRoutes } from '@/lib/api-compliance-scanner';
import { generateAuthorizationReport } from '@/lib/rbac';
import { apiError, apiSuccess } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { errorResponse } = await checkApiAuth();
    if (errorResponse) return errorResponse;

    const { session: user } = await checkApiAuth();
    if (!user) return apiError('Authentication required', 401);

    // Only admins can view compliance reports
    if (user.role !== 'admin') {
      return apiError('Admin access required for compliance reports', 403);
    }

    const apiCompliance = scanApiRoutes();
    const authMatrix = generateAuthorizationReport();

    return apiSuccess({
      apiCompliance: {
        totalRoutes: apiCompliance.totalRoutes,
        compliant: apiCompliance.compliant,
        partial: apiCompliance.partial,
        nonCompliant: apiCompliance.nonCompliant,
        complianceRate: apiCompliance.complianceRate,
        categories: apiCompliance.categories,
        nonCompliantRoutes: apiCompliance.routes
          .filter(r => r.status === 'non-compliant')
          .map(r => ({ route: r.route, gaps: r.gaps })),
      },
      authorizationMatrix: authMatrix,
      generatedAt: apiCompliance.generatedAt,
    });
  } catch (error) {
    return apiError('Failed to generate compliance report', 500);
  }
}
