/**
 * S5-3.5 — Single Experiment Management API
 *
 * GET    /api/ai/experiments/[id] — Get experiment details + analysis
 * PATCH  /api/ai/experiments/[id] — Start/pause/resume/complete experiment
 * DELETE /api/ai/experiments/[id] — (Future: archive experiment)
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers';
import {
  getExperiment,
  startExperiment,
  pauseExperiment,
  resumeExperiment,
  completeExperiment,
  analyzeExperiment,
  recordMetric,
  type ExperimentMetric,
} from '@/lib/prompt-ab-testing';
import { aiExperimentPatchSchema } from '@/lib/validation-schemas';

const _VALID_ACTIONS = ['start', 'pause', 'resume', 'complete'] as const;
const _VALID_METRICS: ExperimentMetric[] = [
  'accuracy', 'hallucination_rate', 'latency_ms',
  'user_rating', 'relevance_score', 'completion_rate',
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await checkApiAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await params;

    const experiment = getExperiment(id);
    if (!experiment) {
      return apiError(`Experiment "${id}" not found`, 404);
    }

    const analysis = analyzeExperiment(id);

    return apiSuccess({
      ...experiment,
      analysis,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return apiError('Unauthorized', 401);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await checkApiAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await params;

    const rawBody = await req.json();
    const parsed = validateBody(aiExperimentPatchSchema, rawBody);
    if (parsed instanceof Response) return parsed;

    const experiment = getExperiment(id);
    if (!experiment) {
      return apiError(`Experiment "${id}" not found`, 404);
    }

    // Handle lifecycle actions
    if (parsed.action) {
      let success = false;
      switch (parsed.action) {
        case 'start':
          success = startExperiment(id);
          break;
        case 'pause':
          success = pauseExperiment(id);
          break;
        case 'resume':
          success = resumeExperiment(id);
          break;
        case 'complete':
          success = completeExperiment(id);
          break;
      }

      if (!success) {
        return apiError(`Failed to ${parsed.action} experiment (check current status)`, 409);
      }

      return apiSuccess({
        message: `Experiment ${parsed.action}d`,
        experimentId: id,
        status: parsed.action === 'start' ? 'running' : parsed.action === 'complete' ? 'completed' : parsed.action === 'pause' ? 'paused' : 'running',
      });
    }

    // Handle metric recording
    if (parsed.metric && parsed.variantId && parsed.value !== undefined) {
      const recorded = recordMetric(id, parsed.variantId, parsed.metric, parsed.value, parsed.sampleId);
      if (!recorded) {
        return apiError('Failed to record metric (experiment not found)', 404);
      }

      const currentAnalysis = analyzeExperiment(id);

      return apiSuccess({
        message: 'Metric recorded',
        experimentId: id,
        variantId: parsed.variantId,
        metric: parsed.metric,
        value: parsed.value,
        currentAnalysis,
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return apiError('Unauthorized', 401);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}
