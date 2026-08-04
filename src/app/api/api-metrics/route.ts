import { getApiMetrics } from '@/lib/api-observability';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

/**
 * WI-18.3 API Observability Endpoint
 *
 * Returns current API metrics: latency percentiles, error rates, top endpoints.
 * Requires authentication.
 */
export async function GET() {
  // Milestone 1: Fix auth guard — checkApiAuth() returns {session, errorResponse?}, never falsy
  const { errorResponse, session: user } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  const metrics = getApiMetrics();
  return apiSuccess(metrics);
}
