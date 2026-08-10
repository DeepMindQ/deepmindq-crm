/**
 * S5-3.4 — Prompt Registry Management API
 *
 * GET    /api/ai/prompt-registry          — List all registered prompts
 * GET    /api/ai/prompt-registry?category=signal_analysis  — Filter by category
 * GET    /api/ai/prompt-registry?stats=true — Get registry stats
 * POST   /api/ai/prompt-registry          — Add new prompt version to registry
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import {
  listPrompts,
  listCategories,
  getPrompt,
  addPromptVersion,
  getRegistryStats,
} from '@/lib/ai-prompt-registry';
import { validateRequest } from '@/lib/with-validation';
import { genericBodySchema } from '@/lib/validation-schemas';
import type { PromptMetrics } from '@/lib/ai-prompt-registry';

export async function GET(req: NextRequest) {
  try {
    const auth = await checkApiAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const stats = searchParams.get('stats') === 'true';

    if (stats) {
      return apiSuccess(getRegistryStats());
    }

    const prompts = listPrompts(category ? { category: category as any } : undefined);
    const categories = listCategories();

    return apiSuccess({
      prompts: prompts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        tier: p.tier,
        currentVersion: p.currentVersion,
        description: p.description,
        tags: p.tags,
        usedBy: p.usedBy,
        versionsCount: p.versions.length,
        testCasesCount: 0,
        metrics: p.versions.find(v => v.active)?.metrics || null,
        hasUserPromptTemplate: p.versions.some(v => v.active && v.userPromptTemplate),
      })),
      categories,
      total: prompts.length,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return apiError('Unauthorized', 401);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await checkApiAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const validated = await validateRequest(req, genericBodySchema);
    if (validated instanceof Response) return validated;
    const body = validated.data as { promptId?: unknown; version?: Record<string, unknown>; changelog?: unknown };
    const { promptId, version, changelog } = body;

    if (!promptId || !version?.systemPrompt) {
      return apiError('promptId and version.systemPrompt are required', 400);
    }

    const existing = getPrompt(promptId as string);
    if (!existing) {
      return apiError(`Prompt "${promptId}" not found in registry`, 404);
    }

    const success = addPromptVersion(promptId as string, {
      version: String((version!.version as number) ?? existing.currentVersion + 1),
      systemPrompt: version!.systemPrompt as string,
      userPromptTemplate: version!.userPromptTemplate as string | undefined,
      changelog: (changelog as string) ?? 'Updated prompt via API',
      metrics: version!.metrics as PromptMetrics | undefined,
    });

    if (!success) {
      return apiError('Failed to add version', 500);
    }

    return apiSuccess({
      message: `Version added to prompt "${promptId}"`,
      promptId,
      previousVersion: existing.currentVersion,
      newVersion: existing.currentVersion + 1,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return apiError('Unauthorized', 401);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}
