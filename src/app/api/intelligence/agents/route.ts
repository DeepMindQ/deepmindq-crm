/**
 * WI-16I: AI Agent Framework API
 * ==============================
 *
 * GET views (read-only):
 *   ?view=agents              — List all registered agents
 *   ?view=agent&id=<agentId>   — Get a specific agent
 *   ?view=plan&id=<planId>     — Get a specific plan
 *   ?view=plans               — List all plans
 *   ?view=execution&id=<id>   — Get a specific execution
 *   ?view=executions           — List all executions
 *   ?view=stats                — Framework statistics
 *   ?view=tools&taskId=<id>    — Tool call history for a task
 *   ?view=reasoning&taskId=<id> — Reasoning history for a task
 *   ?view=approval-queue       — Tasks awaiting human approval
 *   ?view=inbox&agentId=<id>   — Agent collaboration inbox
 *
 * POST actions:
 *   ?action=register-agent     — Register a new agent
 *   ?action=create-plan        — Create an execution plan
 *   ?action=execute-plan       — Execute a plan
 *   ?action=execute-tool       — Execute a tool call
 *   ?action=validate           — Validate task output
 *   ?action=submit-feedback    — Submit human feedback
 *   ?action=send-message       — Send collaboration message
 *   ?action=seed               — Seed the agent framework
 *   ?action=clear              — Clear all framework state
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import {
  registerAgent,
  getAgent,
  getAllAgents,
  getAgentsBySpecialization,
  createPlan,
  getPlan,
  getAllPlans,
  executePlan,
  getExecution,
  getAllExecutions,
  executeToolCall,
  validateOutput,
  submitHumanFeedback,
  getTasksAwaitingApproval,
  sendCollaborationMessage,
  getAgentInbox,
  getToolCallHistory,
  getReasoningHistory,
  getAgentFrameworkStats,
  clearAgentFramework,
  seedAgentFramework,
  type SeedAgent,
} from '@/lib/ai-agent-framework';

// ─── GET: Views ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  const view = request.nextUrl.searchParams.get('view') ?? '';
  const searchParams = request.nextUrl.searchParams;

  try {
    switch (view) {
      case 'agents': {
        const specialization = searchParams.get('specialization');
        if (specialization) {
          const agents = getAgentsBySpecialization(specialization as 'research' | 'analysis' | 'reasoning' | 'scoring' | 'strategy' | 'conversation' | 'writing' | 'validation' | 'learning' | 'orchestration');
          return NextResponse.json({ view: 'agents', specialization, count: agents.length, agents });
        }
        const agents = getAllAgents();
        return NextResponse.json({ view: 'agents', count: agents.length, agents });
      }

      case 'agent': {
        const agentId = searchParams.get('id');
        if (!agentId) {
          return NextResponse.json({ error: 'Missing agent id parameter' }, { status: 400 });
        }
        const agent = getAgent(agentId);
        if (!agent) {
          return NextResponse.json({ error: `Agent not found: ${agentId}` }, { status: 404 });
        }
        return NextResponse.json({ view: 'agent', agent });
      }

      case 'plan': {
        const planId = searchParams.get('id');
        if (!planId) {
          return NextResponse.json({ error: 'Missing plan id parameter' }, { status: 400 });
        }
        const plan = getPlan(planId);
        if (!plan) {
          return NextResponse.json({ error: `Plan not found: ${planId}` }, { status: 404 });
        }
        return NextResponse.json({ view: 'plan', plan });
      }

      case 'plans': {
        const plans = getAllPlans();
        return NextResponse.json({
          view: 'plans',
          count: plans.length,
          plans: plans.map(p => ({
            id: p.id,
            objective: p.objective,
            status: p.status,
            taskCount: p.tasks.length,
            waves: p.executionWaves.length,
            totalComplexity: p.totalComplexity,
            estimatedCostUsd: p.estimatedCostUsd,
            createdAt: p.createdAt,
          })),
        });
      }

      case 'execution': {
        const executionId = searchParams.get('id');
        if (!executionId) {
          return NextResponse.json({ error: 'Missing execution id parameter' }, { status: 400 });
        }
        const execution = getExecution(executionId);
        if (!execution) {
          return NextResponse.json({ error: `Execution not found: ${executionId}` }, { status: 404 });
        }
        return NextResponse.json({ view: 'execution', execution });
      }

      case 'executions': {
        const executions = getAllExecutions();
        return NextResponse.json({
          view: 'executions',
          count: executions.length,
          executions: executions.map(e => ({
            id: e.id,
            planId: e.planId,
            objective: e.objective,
            status: e.status,
            totalTasks: Object.keys(e.tasks).length,
            totalTokensUsed: e.totalTokensUsed,
            totalCostUsd: e.totalCostUsd,
            totalDurationMs: e.totalDurationMs,
            overallValidation: e.overallValidation ? {
              confidenceScore: e.overallValidation.confidenceScore,
              confidenceGrade: e.overallValidation.confidenceGrade,
              enterpriseReady: e.overallValidation.enterpriseReady,
            } : null,
            createdAt: e.createdAt,
            completedAt: e.completedAt,
          })),
        });
      }

      case 'stats': {
        const stats = getAgentFrameworkStats();
        return NextResponse.json({ view: 'stats', stats });
      }

      case 'tools': {
        const taskId = searchParams.get('taskId');
        const agentId = searchParams.get('agentId');
        const toolType = searchParams.get('toolType');
        const limit = searchParams.get('limit');

        const history = getToolCallHistory({
          taskId: taskId ?? undefined,
          agentId: agentId ?? undefined,
          toolType: (toolType as any) ?? undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
        });

        return NextResponse.json({
          view: 'tools',
          count: history.length,
          toolCalls: history.map(c => ({
            id: c.id,
            taskId: c.taskId,
            agentId: c.agentId,
            toolType: c.toolType,
            status: c.status,
            latencyMs: c.latencyMs,
            tokensUsed: c.tokensUsed,
            costUsd: c.costUsd,
            timestamp: c.timestamp,
          })),
        });
      }

      case 'reasoning': {
        const taskId = searchParams.get('taskId');
        const history = getReasoningHistory(taskId ?? undefined);
        return NextResponse.json({
          view: 'reasoning',
          count: history.length,
          steps: history.map(s => ({
            id: s.id,
            taskId: s.taskId,
            stepNumber: s.stepNumber,
            type: s.type,
            description: s.description,
            status: s.status,
            conclusion: s.conclusion,
            confidence: s.confidence,
            productive: s.productive,
            durationMs: s.durationMs,
          })),
        });
      }

      case 'approval-queue': {
        const tasks = getTasksAwaitingApproval();
        return NextResponse.json({
          view: 'approval-queue',
          count: tasks.length,
          tasks: tasks.map(t => ({
            id: t.id,
            planId: t.planId,
            objective: t.objective,
            assignedAgent: t.assignedAgentName,
            validation: t.validation ? {
              confidenceScore: t.validation.confidenceScore,
              confidenceGrade: t.validation.confidenceGrade,
              recommendation: t.validation.recommendation,
            } : null,
            createdAt: t.createdAt,
          })),
        });
      }

      case 'inbox': {
        const agentId = searchParams.get('agentId');
        if (!agentId) {
          return NextResponse.json({ error: 'Missing agentId parameter' }, { status: 400 });
        }
        const unreadOnly = searchParams.get('unread') === 'true';
        const messages = getAgentInbox(agentId, { unreadOnly });
        return NextResponse.json({
          view: 'inbox',
          agentId,
          count: messages.length,
          messages,
        });
      }

      default:
        return NextResponse.json({
          error: `Unknown view: "${view}". Use: agents|agent|plan|plans|execution|executions|stats|tools|reasoning|approval-queue|inbox`,
          availableViews: ['agents', 'agent', 'plan', 'plans', 'execution', 'executions', 'stats', 'tools', 'reasoning', 'approval-queue', 'inbox'],
        }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Agent framework error: ${msg}` }, { status: 500 });
  }
}

// ─── POST: Actions ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  const action = request.nextUrl.searchParams.get('action') ?? '';

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Some actions don't require body
    }

    switch (action) {
      case 'register-agent': {
        const agent = registerAgent(body as unknown as SeedAgent);
        if (!agent) {
          return NextResponse.json({ error: 'Failed to register agent' }, { status: 400 });
        }
        return NextResponse.json({ action: 'register-agent', success: true, agent });
      }

      case 'create-plan': {
        const objective = String(body.objective ?? '');
        if (!objective) {
          return NextResponse.json({ error: 'Missing objective' }, { status: 400 });
        }
        const plan = createPlan({
          objective,
          description: String(body.description ?? undefined),
        });
        return NextResponse.json({
          action: 'create-plan',
          success: true,
          planId: plan.id,
          taskCount: plan.tasks.length,
          waves: plan.executionWaves.length,
          totalComplexity: plan.totalComplexity,
          requiredSpecializations: plan.requiredSpecializations,
          estimatedCostUsd: plan.estimatedCostUsd,
          memoryRequirements: plan.memoryRequirements.length,
          retrievalRequirements: plan.retrievalRequirements.length,
          requiresHumanApproval: plan.requiresHumanApproval,
        });
      }

      case 'execute-plan': {
        const planId = String(body.planId ?? '');
        if (!planId) {
          return NextResponse.json({ error: 'Missing planId' }, { status: 400 });
        }
        const execution = executePlan(planId);
        return NextResponse.json({
          action: 'execute-plan',
          success: execution.status === 'completed',
          executionId: execution.id,
          planId: execution.planId,
          status: execution.status,
          tasksCompleted: Object.values(execution.tasks).filter(t => t.status === 'completed').length,
          tasksFailed: Object.values(execution.tasks).filter(t => t.status === 'failed').length,
          totalTasks: Object.keys(execution.tasks).length,
          totalTokensUsed: execution.totalTokensUsed,
          totalCostUsd: execution.totalCostUsd,
          totalDurationMs: execution.totalDurationMs,
          overallValidation: execution.overallValidation ? {
            confidenceScore: execution.overallValidation.confidenceScore,
            confidenceGrade: execution.overallValidation.confidenceGrade,
            trustClass: execution.overallValidation.trustClass,
            enterpriseReady: execution.overallValidation.enterpriseReady,
            recommendation: execution.overallValidation.recommendation,
          } : null,
          error: execution.error,
        });
      }

      case 'execute-tool': {
        const taskId = String(body.taskId ?? '');
        const agentId = String(body.agentId ?? '');
        const toolType = String(body.toolType ?? '');
        if (!taskId || !agentId || !toolType) {
          return NextResponse.json({ error: 'Missing taskId, agentId, or toolType' }, { status: 400 });
        }
        const result = executeToolCall({
          taskId,
          agentId,
          toolType: toolType as 'memory_recall' | 'memory_store' | 'hybrid_search' | 'knowledge_graph' | 'entity_lookup' | 'confidence_score' | 'hallucination_check' | 'evaluation' | 'reasoning_chain' | 'web_search' | 'calculator' | 'text_analysis',
          input: (body.input as Record<string, unknown>) ?? {},
          toolName: String(body.toolName ?? undefined),
        });
        return NextResponse.json({
          action: 'execute-tool',
          toolCallId: result.id,
          status: result.status,
          latencyMs: result.latencyMs,
          tokensUsed: result.tokensUsed,
          costUsd: result.costUsd,
          output: result.output,
          error: result.error,
        });
      }

      case 'validate': {
        const taskId = String(body.taskId ?? '');
        const output = (body.output as Record<string, unknown>) ?? {};
        const agentId = String(body.agentId ?? '');
        if (!taskId || !agentId) {
          return NextResponse.json({ error: 'Missing taskId or agentId' }, { status: 400 });
        }
        const agent = getAgent(agentId);
        if (!agent) {
          return NextResponse.json({ error: `Agent not found: ${agentId}` }, { status: 404 });
        }
        const reasoningSteps = (body.reasoningSteps as any[]) ?? [];
        const toolCalls = (body.toolCalls as any[]) ?? [];
        const contextConfidence = body.contextConfidence as number | undefined;

        const validation = validateOutput({
          taskId,
          output,
          reasoningSteps,
          toolCalls,
          agentDefinition: agent,
          contextConfidence,
        });

        return NextResponse.json({
          action: 'validate',
          validationId: validation.id,
          status: validation.status,
          confidenceScore: validation.confidenceScore,
          confidenceGrade: validation.confidenceGrade,
          trustClass: validation.trustClass,
          hallucinationRisk: validation.hallucinationRisk,
          enterpriseReady: validation.enterpriseReady,
          recommendation: validation.recommendation,
          checks: validation.checks,
          findings: validation.findings,
          summary: validation.summary,
        });
      }

      case 'submit-feedback': {
        const taskId = String(body.taskId ?? '');
        const feedbackType = String(body.feedbackType ?? '');
        const userId = String(body.userId ?? '');
        if (!taskId || !feedbackType || !userId) {
          return NextResponse.json({ error: 'Missing taskId, feedbackType, or userId' }, { status: 400 });
        }
        const task = submitHumanFeedback({
          taskId,
          feedbackType: feedbackType as 'approve' | 'reject' | 'revise' | 'comment' | 'skip',
          userId,
          comment: String(body.comment ?? undefined),
          revisedOutput: (body.revisedOutput as Record<string, unknown>) ?? undefined,
        });
        if (!task) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        return NextResponse.json({
          action: 'submit-feedback',
          success: true,
          taskId: task.id,
          taskStatus: task.status,
          feedback: task.humanFeedback,
        });
      }

      case 'send-message': {
        const msg = sendCollaborationMessage({
          fromAgentId: String(body.fromAgentId ?? ''),
          fromAgentName: String(body.fromAgentName ?? ''),
          toAgentId: String(body.toAgentId ?? ''),
          toAgentName: String(body.toAgentName ?? ''),
          executionId: String(body.executionId ?? ''),
          taskId: String(body.taskId ?? ''),
          messageType: String(body.messageType ?? 'notification') as 'request' | 'response' | 'notification' | 'delegation' | 'handoff' | 'feedback' | 'sync',
          priority: String(body.priority ?? 'normal') as 'low' | 'normal' | 'high' | 'urgent',
          subject: String(body.subject ?? ''),
          body: String(body.body ?? ''),
          payload: (body.payload as Record<string, unknown>) ?? {},
          responseToId: String(body.responseToId ?? undefined),
        });
        return NextResponse.json({ action: 'send-message', success: true, messageId: msg.id });
      }

      case 'seed': {
        const result = seedAgentFramework();
        return NextResponse.json({
          action: 'seed',
          success: true,
          agentsRegistered: result.agentsRegistered,
          agents: result.agents.map(a => ({ id: a.id, name: a.name, specialization: a.specialization, tier: a.tier })),
        });
      }

      case 'clear': {
        clearAgentFramework();
        return NextResponse.json({ action: 'clear', success: true, message: 'Agent framework state cleared' });
      }

      default:
        return NextResponse.json({
          error: `Unknown action: "${action}". Use: register-agent|create-plan|execute-plan|execute-tool|validate|submit-feedback|send-message|seed|clear`,
        }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Agent framework error: ${msg}` }, { status: 500 });
  }
}
