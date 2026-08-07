/**
 * S5-3.4 — Single Prompt Registry Item API
 *
 * GET    /api/ai/prompt-registry/[id] — Get full prompt with all versions
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { getPrompt, getSystemPrompt } from '@/lib/ai-prompt-registry';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await checkApiAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await params;

    const prompt = getPrompt(id);
    if (!prompt) {
      return apiError(`Prompt "${id}" not found`, 404);
    }

    const activeSystemPrompt = getSystemPrompt(id);

    return apiSuccess({
      ...prompt,
      activeSystemPrompt,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return apiError('Unauthorized', 401);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}
