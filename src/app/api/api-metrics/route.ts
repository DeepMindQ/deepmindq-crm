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
  const auth = await checkApiAuth();
  if (!auth) {
    return apiError('Unauthorized', 401);
  }

  const metrics = getApiMetrics();
  return apiSuccess(metrics);
}
