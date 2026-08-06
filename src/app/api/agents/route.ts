import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import {
  AGENT_REGISTRY,
  VALID_AGENT_TYPES,
  type AgentType,
  type AgentResponse,
} from '@/lib/enterprise-agents';

/**
 * POST /api/agents
 *
 * Routes to the correct enterprise agent based on the `agent` field.
 *
 * Body:
 *   { agent: string, params: Record<string, unknown> }
 *
 * Supported agents:
 *   - 'account-intelligence'  → { params: { companyId: string } }
 *   - 'research'              → { params: { query: string, maxResults?: number } }
 *   - 'sales-strategy'         → { params: { companyId: string } }
 *   - 'meeting-prep'           → { params: { companyId: string, contactId?: string, meetingType?: string } }
 *   - 'executive-decision'     → { params: { question: string, context?: { companyId?: string, industry?: string } } }
 */
export async function POST(request: NextRequest) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  const startTime = Date.now();

  try {
    const body = await request.json();
    const { agent, params } = body as { agent: string; params: Record<string, unknown> };

    // ── Validate agent type ──
    if (!agent || typeof agent !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid "agent" field. Must be one of: ' + VALID_AGENT_TYPES.join(', '),
          validAgents: VALID_AGENT_TYPES,
        },
        { status: 400 },
      );
    }

    if (!VALID_AGENT_TYPES.includes(agent as AgentType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown agent: "${agent}". Valid agents: ${VALID_AGENT_TYPES.join(', ')}`,
          validAgents: VALID_AGENT_TYPES,
        },
        { status: 400 },
      );
    }

    // ── Validate params ──
    if (!params || typeof params !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "params" object.' },
        { status: 400 },
      );
    }

    // Agent-specific required param validation
    const agentType = agent as AgentType;

    if (agentType === 'account-intelligence' || agentType === 'sales-strategy' || agentType === 'meeting-prep') {
      if (!params.companyId || typeof params.companyId !== 'string') {
        return NextResponse.json(
          { success: false, error: `Agent "${agentType}" requires a string "companyId" param.` },
          { status: 400 },
        );
      }
    }

    if (agentType === 'research') {
      if (!params.query || typeof params.query !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Agent "research" requires a string "query" param.' },
          { status: 400 },
        );
      }
    }

    if (agentType === 'executive-decision') {
      if (!params.question || typeof params.question !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Agent "executive-decision" requires a string "question" param.' },
          { status: 400 },
        );
      }
    }

    // ── Route to agent ──
    logger.info(`[api/agents] Routing to agent: ${agentType}`, {
      agent: agentType,
      paramsKeys: Object.keys(params),
    });

    const handler = AGENT_REGISTRY[agentType];
    const result: AgentResponse = await handler(params);

    const totalLatency = Date.now() - startTime;
    logger.info(`[api/agents] Agent ${agentType} completed`, {
      agentId: result.agentId,
      success: result.success,
      trustScore: result.trustScore,
      trustGrade: result.trustGrade,
      durationMs: result.durationMs,
      totalLatencyMs: totalLatency,
      error: result.error,
    });

    return NextResponse.json({
      ...result,
      _meta: {
        routeLatencyMs: totalLatency - result.durationMs,
        totalLatencyMs: totalLatency,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const duration = Date.now() - startTime;

    logger.error('[api/agents] Unhandled error', { error: message, durationMs: duration });

    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${message}`,
        durationMs: duration,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/agents
 *
 * Returns metadata about available agents — their types and expected params.
 */
export async function GET() {
  return NextResponse.json({
    agents: [
      {
        type: 'account-intelligence',
        description: 'Full company intelligence report with financial profile, engagement predictions, and recommendations.',
        requiredParams: ['companyId'],
        optionalParams: [],
      },
      {
        type: 'research',
        description: 'Knowledge query with hallucination guard, evidence synthesis, and source citation.',
        requiredParams: ['query'],
        optionalParams: ['maxResults'],
      },
      {
        type: 'sales-strategy',
        description: 'Account scoring, buying intent, ICP alignment, and sales strategy recommendation.',
        requiredParams: ['companyId'],
        optionalParams: [],
      },
      {
        type: 'meeting-prep',
        description: 'Meeting intelligence brief with company context, buying committee, and talking points.',
        requiredParams: ['companyId'],
        optionalParams: ['contactId', 'meetingType'],
      },
      {
        type: 'executive-decision',
        description: 'Executive decision support with knowledge retrieval, market context, and hallucination guard.',
        requiredParams: ['question'],
        optionalParams: ['context'],
      },
    ],
  });
}
