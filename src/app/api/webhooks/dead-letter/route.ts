import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess, apiError, apiPaginated, safeInt, validateBody } from '@/lib/apiHelpers';
import { getDeadLetterQueue, retryDeadLetterEntry, resolveDeadLetterEntry } from '@/lib/webhook-reliability';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const resolveSchema = z.object({
  id: z.string().min(1),
  resolution: z.enum(['retried_manually', 'deleted', 'target_fixed']),
});

const retrySchema = z.object({
  id: z.string().min(1),
});

// GET: List dead-letter entries (paginated, filterable by event)
export async function GET(request: NextRequest) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const event = searchParams.get('event') || undefined;
  const page = safeInt(searchParams.get('page'), 1, 1);
  const limit = safeInt(searchParams.get('limit'), 20, 1);
  const includeResolved = searchParams.get('includeResolved') === 'true';

  const { data, total } = await getDeadLetterQueue({ event, page, limit, includeResolved });
  return apiPaginated(data, total, page, limit);
}

// POST: Manually retry a dead-letter entry
export async function POST(request: NextRequest) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = validateBody(retrySchema, body);
  if (parsed instanceof Response) return parsed;

  const result = await retryDeadLetterEntry(parsed.id);
  if (!result) {
    return apiError('Dead-letter entry not found', 404);
  }

  return apiSuccess(result);
}

// PATCH: Resolve a dead-letter entry
export async function PATCH(request: NextRequest) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = validateBody(resolveSchema, body);
  if (parsed instanceof Response) return parsed;

  const ok = await resolveDeadLetterEntry(parsed.id, parsed.resolution);
  if (!ok) {
    return apiError('Dead-letter entry not found or already resolved', 404);
  }

  return apiSuccess({ id: parsed.id, resolution: parsed.resolution });
}
