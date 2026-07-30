/**
 * GET /api/intelligence/stats — Pipeline statistics
 *
 * Intelligence API — Stats Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { IntelligencePipeline } from '@/lib/intelligence-pipeline';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function GET() {

  const startedAt = Date.now();

  try {
    const stats = await IntelligencePipeline.getStats();
    return Response.json({
      success: true,
      data: stats,
      meta: { endpoint: 'stats', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : 'Failed to get intelligence stats');
    return Response.json(
      { success: false, error: message, meta: { endpoint: 'stats', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
