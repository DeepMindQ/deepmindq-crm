/**
 * S5-3.5 — Prompt A/B Testing API
 *
 * GET    /api/ai/experiments              — List all experiments (optionally filter by status)
 * POST   /api/ai/experiments              — Create a new experiment
 * GET    /api/ai/experiments/[id]         — Get experiment details + results (see [id]/route.ts)
 * PATCH  /api/ai/experiments/[id]         — Update experiment lifecycle (see [id]/route.ts)
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import {
  createExperiment,
  listExperiments,
  getExperimentSummary,
  type ExperimentMetric,
} from '@/lib/prompt-ab-testing';

const VALID_METRICS: ExperimentMetric[] = [
  'accuracy', 'hallucination_rate', 'latency_ms',
  'user_rating', 'relevance_score', 'completion_rate',
];

export async function GET(req: NextRequest) {
  try {
    const auth = await checkApiAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const summary = searchParams.get('summary') === 'true';

    if (summary) {
      return apiSuccess(getExperimentSummary());
    }

    const experiments = listExperiments(
      status ? (status as any) : undefined
    );

    return apiSuccess({
      experiments: experiments.map(e => ({
        id: e.id,
        name: e.name,
        description: e.description,
        promptId: e.promptId,
        status: e.status,
        primaryMetric: e.primaryMetric,
        variants: e.variants.map(v => ({
          id: v.id,
          name: v.name,
          weight: v.weight,
          model: v.model,
          hasPromptOverride: !!v.systemPromptOverride,
        })),
        minSamplesPerVariant: e.minSamplesPerVariant,
        significanceThreshold: e.significanceThreshold,
        totalMetrics: e.metrics.length,
        createdAt: e.createdAt,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
      })),
      total: experiments.length,
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

    const body = await req.json();
    const {
      name,
      description,
      promptId,
      variants,
      primaryMetric,
      weights,
      minSamplesPerVariant,
      significanceThreshold,
    } = body;

    // Validation
    if (!name || !promptId || !variants || variants.length < 2) {
      return apiError('name, promptId, and at least 2 variants are required', 400);
    }
    if (!VALID_METRICS.includes(primaryMetric)) {
      return apiError(`primaryMetric must be one of: ${VALID_METRICS.join(', ')}`, 400);
    }
    if (variants.length > 10) {
      return apiError('Maximum 10 variants per experiment', 400);
    }

    const experiment = createExperiment({
      name,
      description: description || '',
      promptId,
      variants,
      primaryMetric,
      weights,
      minSamplesPerVariant,
      significanceThreshold,
    });

    return apiSuccess({
      message: 'Experiment created',
      experiment: {
        id: experiment.id,
        name: experiment.name,
        promptId: experiment.promptId,
        status: experiment.status,
        variants: experiment.variants,
      },
    }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return apiError('Unauthorized', 401);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}
