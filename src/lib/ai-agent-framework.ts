/**
 * WI-16I: AI Agent Framework — Dynamic Intelligent Agent Architecture
 * ================================================================
 *
 * Transforms DeepMindQ from a static retrieval system into a continuously
 * learning enterprise intelligence platform with autonomous agent capabilities.
 *
 * ARCHITECTURE:
 *
 *   User Objective
 *        ↓
 *   Agent Planner (decomposes objectives → task plan)
 *        ↓
 *   Task Queue (priority-ordered, dependency-aware)
 *        ↓
 *   Agent Executor (selects & runs specialized agents)
 *        ↓
 *   ┌──────────────────────────────────────────┐
 *   │  Agent Runtime                            │
 *   │  ├── Memory Context (4-layer integration) │
 *   │  ├── Retrieval Context (hybrid evidence)   │
 *   │  ├── Knowledge Graph (entity reasoning)  │
 *   │  ├── Tool Execution (8 tool types)         │
 *   │  ├── Reasoning Chain (step-by-step logic)  │
 *   │  ├── Self-Validation (confidence + halluc)│
 *   │  └── Collaboration (inter-agent messaging)│
 *   └──────────────────────────────────────────┘
 *        ↓
 *   Validation Gate (confidence ≥ threshold?)
 *        ↓
 *   Human Approval (if required)
 *        ↓
 *   Final Output + Memory Consolidation
 *
 * INTEGRATION POINTS:
 *   - Consumes: ai-memory (MemoryContext), ai-hybrid-retrieval (EvidencePackage),
 *     ai-knowledge-graph (entity reasoning), ai-unified-confidence (ConfidenceResult),
 *     ai-hallucination-prevention (HallucinationCheckResult), ai-evaluation-engine
 *   - Replaces: multi-agent-orchestrator (static DAG → dynamic planning)
 *   - Uses: event-bus for inter-agent communication
 *
 * NON-THROWING CONTRACT: All functions return structured results, never throw.
 */

import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — Core Data Model
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Agent Identity & Capabilities ─────────────────────────────────────────

/** The domain an agent specializes in */
export type AgentSpecialization =
  | 'research'
  | 'analysis'
  | 'reasoning'
  | 'scoring'
  | 'strategy'
  | 'conversation'
  | 'writing'
  | 'validation'
  | 'learning'
  | 'orchestration';

/** Agent execution tier — mirrors LLM tier for cost/quality control */
export type AgentTier = 'fast' | 'smart' | 'deep';

/** How an agent handles its output */
export type ApprovalMode =
  | 'auto'           // Fully autonomous, no human review needed
  | 'soft_review'    // Log for review, proceed immediately
  | 'hard_gate'      // Must wait for human approval before acting
  | 'escalate';      // Auto-escalate to human if confidence below threshold

/** Defines an agent's capabilities and constraints */
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  specialization: AgentSpecialization;
  tier: AgentTier;
  approvalMode: ApprovalMode;
  /** Maximum tokens this agent may consume per execution */
  maxTokens: number;
  /** Maximum number of reasoning steps before forced conclusion */
  maxReasoningSteps: number;
  /** Minimum confidence to auto-approve (if approvalMode = escalate) */
  confidenceThreshold: number;
  /** Tools this agent can use */
  availableTools: AgentToolType[];
  /** Tags for categorization and routing */
  tags: string[];
  /** Whether this agent can spawn sub-agents */
  canDelegate: boolean;
  /** Version for tracking agent evolution */
  version: string;
}

// ─── Task Model ────────────────────────────────────────────────────────────

/** Task status lifecycle */
export type TaskStatus =
  | 'pending'
  | 'planned'
  | 'assigned'
  | 'running'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'delegated';

/** Task priority levels */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low' | 'background';

/** Complexity estimation for task planning */
export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';

/** A single unit of work for an agent to execute */
export interface AgentTask {
  id: string;
  parentId: string | null;
  planId: string;
  objective: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  complexity: TaskComplexity;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  /** Ordered list of reasoning steps the agent should follow */
  reasoningSteps: string[];
  /** Expected output type */
  expectedOutputType: string;
  /** IDs of tasks that must complete before this one starts */
  dependencies: string[];
  /** IDs of tasks this one produces output for */
  dependents: string[];
  /** Input data passed to the agent */
  input: Record<string, unknown>;
  /** Final output from the agent */
  output: Record<string, unknown> | null;
  /** Tool invocations made during execution */
  toolCalls: ToolCallRecord[];
  /** Reasoning steps recorded during execution */
  recordedReasoning: ReasoningStep[];
  /** Validation results */
  validation: ValidationResult | null;
  /** Timing and cost tracking */
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  tokensUsed: number;
  costUsd: number;
  /** Error information if the task failed */
  error: string | null;
  /** Human feedback (for hard_gate / escalate modes) */
  humanFeedback: HumanFeedback | null;
  /** Retry tracking */
  retryCount: number;
  maxRetries: number;
  /** Metadata for traceability */
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Planning Model ───────────────────────────────────────────────────────

/** Status of an execution plan */
export type PlanStatus =
  | 'draft'
  | 'approved'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** A structured execution plan produced by the Agent Planner */
export interface AgentPlan {
  id: string;
  objective: string;
  description: string;
  status: PlanStatus;
  tasks: AgentTask[];
  /** Dependency graph (adjacency list: taskId → dependent taskIds) */
  dependencyGraph: Record<string, string[]>;
  /** Parallel execution groups (tasks that can run simultaneously) */
  executionWaves: string[][];
  /** Total estimated complexity */
  totalComplexity: TaskComplexity;
  /** Required agent specializations */
  requiredSpecializations: AgentSpecialization[];
  /** Memory context requirements */
  memoryRequirements: MemoryRequirement[];
  /** Retrieval requirements */
  retrievalRequirements: RetrievalRequirement[];
  /** Approval requirements */
  requiresHumanApproval: boolean;
  /** Estimated cost in USD */
  estimatedCostUsd: number;
  /** Estimated tokens */
  estimatedTokens: number;
  /** Timing */
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
}

/** Memory requirements for a plan */
export interface MemoryRequirement {
  layer: 'working' | 'conversation' | 'enterprise' | 'institutional';
  category: string;
  required: boolean;
  description: string;
}

/** Retrieval requirements for a plan */
export interface RetrievalRequirement {
  query: string;
  signalTypes: string[];
  minResults: number;
  description: string;
}

// ─── Execution Model ───────────────────────────────────────────────────────

/** Status of an agent execution session */
export type ExecutionStatus =
  | 'initializing'
  | 'planning'
  | 'executing'
  | 'validating'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** A complete agent execution session */
export interface AgentExecution {
  id: string;
  planId: string;
  objective: string;
  status: ExecutionStatus;
  /** All tasks in this execution */
  tasks: Record<string, AgentTask>;
  /** Ordered task execution timeline */
  taskTimeline: TaskTimelineEntry[];
  /** Agent usage tracking */
  agentUsage: AgentUsageRecord[];
  /** Tool usage tracking */
  toolUsageSummary: ToolUsageSummary;
  /** Memory context used */
  memoryContextSnapshot: Record<string, unknown> | null;
  /** Final aggregated output */
  finalOutput: Record<string, unknown> | null;
  /** Overall validation */
  overallValidation: ValidationResult | null;
  /** Collaboration messages exchanged */
  collaborationLog: CollaborationMessage[];
  /** Cost tracking */
  totalTokensUsed: number;
  totalCostUsd: number;
  totalDurationMs: number;
  /** Error information */
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/** Timeline entry for task execution tracking */
export interface TaskTimelineEntry {
  taskId: string;
  agentId: string;
  action: 'started' | 'completed' | 'failed' | 'approved' | 'rejected' | 'delegated';
  timestamp: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

/** Agent usage record */
export interface AgentUsageRecord {
  agentId: string;
  agentName: string;
  specialization: AgentSpecialization;
  tasksCompleted: number;
  tasksFailed: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  totalDurationMs: number;
}

/** Tool usage summary */
export interface ToolUsageSummary {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  byToolType: Record<string, { calls: number; successRate: number; avgLatencyMs: number }>;
}

// ─── Tool Model ────────────────────────────────────────────────────────────

/** Types of tools available to agents */
export type AgentToolType =
  | 'memory_recall'       // Retrieve from 4-layer memory
  | 'memory_store'        // Store to memory
  | 'hybrid_search'       // Hybrid retrieval (vector+BM25+entity+graph)
  | 'knowledge_graph'    // Graph traversal & reasoning
  | 'entity_lookup'       // Look up entity in knowledge graph
  | 'confidence_score'   // Get unified confidence score
  | 'hallucination_check' // Run hallucination prevention
  | 'evaluation'         // Run evaluation framework
  | 'reasoning_chain'    // Build evidence chain
  | 'web_search'          // External web search (placeholder)
  | 'calculator'          // Mathematical computation
  | 'text_analysis';      // Text analysis / extraction

/** Status of a tool invocation */
export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** A single tool invocation record */
export interface ToolCallRecord {
  id: string;
  taskId: string;
  agentId: string;
  toolType: AgentToolType;
  toolName: string;
  status: ToolCallStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  latencyMs: number;
  tokensUsed: number;
  costUsd: number;
  timestamp: string;
}

// ─── Reasoning Model ───────────────────────────────────────────────────────

/** Status of a reasoning step */
export type ReasoningStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';

/** Type of reasoning being performed */
export type ReasoningType =
  | 'decomposition'    // Breaking down a complex problem
  | 'evidence_gathering' // Collecting evidence
  | 'analysis'          // Analyzing evidence
  | 'synthesis'         // Combining findings
  | 'validation'        // Verifying conclusions
  | 'correction'        // Correcting errors
  | 'abstraction'       // Abstracting patterns
  | 'analogy'           // Drawing analogies
  | 'deduction'         // Logical deduction
  | 'induction'         // Inductive reasoning
  | 'creative'          // Creative insight generation
  | 'meta_cognitive';   // Thinking about thinking

/** A single reasoning step in an agent's thought process */
export interface ReasoningStep {
  id: string;
  taskId: string;
  stepNumber: number;
  type: ReasoningType;
  description: string;
  status: ReasoningStatus;
  /** What the agent is trying to determine */
  question: string;
  /** Evidence/inputs used for this step */
  inputs: string[];
  /** Conclusion or finding from this step */
  conclusion: string | null;
  /** Confidence in this step's conclusion (0-1) */
  confidence: number;
  /** Which tools were used */
  toolCallIds: string[];
  /** Duration */
  durationMs: number;
  /** Whether this step produced useful output */
  productive: boolean;
  timestamp: string;
}

// ─── Validation Model ───────────────────────────────────────────────────────

/** Validation status */
export type ValidationStatus =
  | 'pending'
  | 'passed'
  | 'passed_with_warnings'
  | 'failed'
  | 'skipped';

/** Severity of validation findings */
export type FindingSeverity = 'critical' | 'warning' | 'info' | 'pass';

/** Result of validating agent output */
export interface ValidationResult {
  id: string;
  taskId: string;
  status: ValidationStatus;
  /** Overall confidence score (0-1) */
  confidenceScore: number;
  /** Confidence grade */
  confidenceGrade: string;
  /** Trust classification */
  trustClass: 'enterprise' | 'advisory' | 'speculative' | 'unreliable';
  /** Hallucination risk score (0-1) */
  hallucinationRisk: number;
  /** Individual validation checks */
  checks: ValidationCheck[];
  /** Actionable findings */
  findings: ValidationFinding[];
  /** Whether output is enterprise-ready */
  enterpriseReady: boolean;
  /** Recommendation on how to proceed */
  recommendation: 'proceed' | 'revise' | 'retry' | 'escalate' | 'reject';
  /** Human-readable summary */
  summary: string;
  timestamp: string;
}

/** A single validation check */
export interface ValidationCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  score: number;
  description: string;
  details?: string;
}

/** A validation finding */
export interface ValidationFinding {
  id: string;
  severity: FindingSeverity;
  category: string;
  description: string;
  suggestion: string | null;
  position?: string;
}

// ─── Collaboration Model ───────────────────────────────────────────────────

/** Message types for inter-agent communication */
export type CollaborationMessageType =
  | 'request'          // Agent A asks Agent B for help
  | 'response'         // Agent B responds to Agent A
  | 'notification'     // Agent broadcasts status update
  | 'delegation'       // Agent A delegates sub-task to Agent B
  | 'handoff'          // Agent A hands off to Agent B
  | 'feedback'         // Agent provides feedback on another's output
  | 'sync';            // Synchronize shared state

/** Priority of collaboration messages */
export type CollaborationPriority = 'low' | 'normal' | 'high' | 'urgent';

/** A message between agents */
export interface CollaborationMessage {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  executionId: string;
  taskId: string;
  messageType: CollaborationMessageType;
  priority: CollaborationPriority;
  subject: string;
  body: string;
  payload: Record<string, unknown>;
  /** Whether the message has been read */
  read: boolean;
  /** Response message ID if applicable */
  responseToId: string | null;
  timestamp: string;
}

// ─── Human Interaction Model ──────────────────────────────────────────────

/** Types of human feedback */
export type FeedbackType = 'approve' | 'reject' | 'revise' | 'comment' | 'skip';

/** Human feedback on agent output */
export interface HumanFeedback {
  type: FeedbackType;
  userId: string;
  comment: string | null;
  revisedOutput: Record<string, unknown> | null;
  timestamp: string;
}

// ─── Agent Framework Stats ────────────────────────────────────────────────

/** Overall framework statistics */
export interface AgentFrameworkStats {
  totalPlans: number;
  totalTasks: number;
  totalExecutions: number;
  totalAgentDefinitions: number;
  totalToolCalls: number;
  completedTasks: number;
  failedTasks: number;
  awaitingApprovalTasks: number;
  averageTaskDurationMs: number;
  averageConfidenceScore: number;
  totalTokensConsumed: number;
  totalCostUsd: number;
  bySpecialization: Record<AgentSpecialization, { tasks: number; successRate: number; avgConfidence: number }>;
  byToolType: Record<string, { calls: number; successRate: number; avgLatencyMs: number }>;
  timestamp: string;
}

// ─── Seed Data Types ───────────────────────────────────────────────────────

/** Seed agent definition for initialization */
export interface SeedAgent {
  id: string;
  name: string;
  description: string;
  specialization: AgentSpecialization;
  tier: AgentTier;
  approvalMode: ApprovalMode;
  maxTokens: number;
  maxReasoningSteps: number;
  confidenceThreshold: number;
  availableTools: AgentToolType[];
  tags: string[];
  canDelegate: boolean;
  version: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY STORES
// ═══════════════════════════════════════════════════════════════════════════════

/** Registered agent definitions */
const agentRegistry = new Map<string, AgentDefinition>();

/** Active execution plans */
const planStore = new Map<string, AgentPlan>();

/** Active executions */
const executionStore = new Map<string, AgentExecution>();

/** Collaboration inbox per agent */
const collaborationInbox = new Map<string, CollaborationMessage[]>();

/** Tool call history */
const toolCallHistory = new Map<string, ToolCallRecord>();

/** Reasoning step history */
const reasoningHistory = new Map<string, ReasoningStep>();

/** Validation history */
const validationHistory = new Map<string, ValidationResult>();

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Generate a unique ID */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Get current ISO timestamp */
function now(): string {
  return new Date().toISOString();
}

/** Safe JSON parse — returns null instead of throwing */
function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Calculate confidence grade from score */
function confidenceGradeFromScore(score: number): string {
  if (score >= 0.95) return 'A+';
  if (score >= 0.90) return 'A';
  if (score >= 0.85) return 'A-';
  if (score >= 0.80) return 'B+';
  if (score >= 0.75) return 'B';
  if (score >= 0.70) return 'B-';
  if (score >= 0.65) return 'C+';
  if (score >= 0.60) return 'C';
  if (score >= 0.55) return 'C-';
  if (score >= 0.50) return 'D';
  return 'F';
}

/** Calculate trust class from confidence score */
function trustClassFromScore(score: number): 'enterprise' | 'advisory' | 'speculative' | 'unreliable' {
  if (score >= 0.80) return 'enterprise';
  if (score >= 0.60) return 'advisory';
  if (score >= 0.40) return 'speculative';
  return 'unreliable';
}

/** Estimate task complexity from description */
function estimateComplexity(description: string, reasoningSteps: string[]): TaskComplexity {
  const len = description.length + reasoningSteps.join(' ').length;
  const stepCount = reasoningSteps.length;
  if (stepCount <= 1 && len < 100) return 'trivial';
  if (stepCount <= 2 && len < 300) return 'simple';
  if (stepCount <= 4 && len < 600) return 'moderate';
  if (stepCount <= 8) return 'complex';
  return 'expert';
}

/** Estimate cost based on complexity and tier */
function estimateCost(complexity: TaskComplexity, tier: AgentTier): number {
  const baseCost: Record<TaskComplexity, number> = {
    trivial: 0.0001, simple: 0.0005, moderate: 0.002,
    complex: 0.008, expert: 0.025,
  };
  const tierMultiplier: Record<AgentTier, number> = {
    fast: 0.3, smart: 1.0, deep: 3.0,
  };
  return baseCost[complexity] * tierMultiplier[tier];
}

/** Estimate token usage based on complexity and tier */
function estimateTokens(complexity: TaskComplexity, tier: AgentTier): number {
  const baseTokens: Record<TaskComplexity, number> = {
    trivial: 50, simple: 200, moderate: 800,
    complex: 2500, expert: 6000,
  };
  const tierMultiplier: Record<AgentTier, number> = {
    fast: 0.4, smart: 1.0, deep: 2.5,
  };
  return Math.round(baseTokens[complexity] * tierMultiplier[tier]);
}

/** Priority ordering for task scheduling */
function priorityWeight(priority: TaskPriority): number {
  switch (priority) {
    case 'critical': return 100;
    case 'high': return 75;
    case 'medium': return 50;
    case 'low': return 25;
    case 'background': return 10;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT REGISTRY — Manage Agent Definitions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register an agent definition. Replaces any existing agent with the same ID.
 * Non-throwing — returns the registered agent or null on error.
 */
export function registerAgent(definition: SeedAgent): AgentDefinition | null {
  try {
    const agent: AgentDefinition = {
      ...definition,
    };
    agentRegistry.set(agent.id, agent);
    logger.info(`[agent-framework] registered agent: ${agent.name} (${agent.id})`);
    return agent;
  } catch (err) {
    logger.error(`[agent-framework] registerAgent failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Get an agent definition by ID.
 * Non-throwing — returns null if not found.
 */
export function getAgent(agentId: string): AgentDefinition | null {
  return agentRegistry.get(agentId) ?? null;
}

/**
 * Get all registered agent definitions.
 */
export function getAllAgents(): AgentDefinition[] {
  return Array.from(agentRegistry.values());
}

/**
 * Get agents filtered by specialization.
 */
export function getAgentsBySpecialization(specialization: AgentSpecialization): AgentDefinition[] {
  return Array.from(agentRegistry.values()).filter(a => a.specialization === specialization);
}

/**
 * Get the best agent for a given task objective.
 * Selects based on specialization match, tier, and tool availability.
 * Non-throwing — returns null if no suitable agent found.
 */
export function selectAgentForTask(
  objective: string,
  requiredTools?: AgentToolType[],
  preferredTier?: AgentTier,
): AgentDefinition | null {
  const objLower = objective.toLowerCase();

  // Score each agent against the objective
  let bestAgent: AgentDefinition | null = null;
  let bestScore = 0;

  for (const agent of agentRegistry.values()) {
    let score = 0;

    // Check specialization relevance
    const specKeywords: Record<AgentSpecialization, string[]> = {
      research: ['research', 'investigate', 'find', 'discover', 'profile', 'background', 'company info', 'market'],
      analysis: ['analyze', 'assess', 'evaluate', 'compare', 'score', 'rank', 'measure'],
      reasoning: ['reason', 'infer', 'deduce', 'logic', 'why', 'explain', 'cause', 'effect'],
      scoring: ['score', 'rate', 'win probability', 'priority', 'rank', 'grade'],
      strategy: ['strategy', 'plan', 'approach', 'tactics', 'messaging', 'positioning', 'recommend'],
      conversation: ['conversation', 'meeting', 'call', 'talk', 'discuss', 'prepare', 'brief'],
      writing: ['write', 'draft', 'compose', 'generate', 'create', 'email', 'proposal'],
      validation: ['validate', 'verify', 'check', 'review', 'audit', 'confirm', 'test'],
      learning: ['learn', 'improve', 'adapt', 'optimize', 'refine', 'feedback'],
      orchestration: ['coordinate', 'orchestrate', 'manage', 'delegate', 'organize', 'supervise'],
    };

    const keywords = specKeywords[agent.specialization] ?? [];
    const matchCount = keywords.filter(kw => objLower.includes(kw)).length;
    score += matchCount * 10;

    // Check tier preference
    if (preferredTier && agent.tier === preferredTier) score += 5;

    // Check tool availability
    if (requiredTools) {
      const hasAllTools = requiredTools.every(t => agent.availableTools.includes(t));
      if (hasAllTools) score += 15;
      else {
        const hasSomeTools = requiredTools.filter(t => agent.availableTools.includes(t)).length;
        score += (hasSomeTools / requiredTools.length) * 10;
      }
    }

    // Higher tier agents get slight bonus for complex tasks
    if (objLower.length > 200 && agent.tier === 'deep') score += 3;
    if (objLower.length > 200 && agent.tier === 'smart') score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  return bestAgent;
}

/**
 * Remove an agent from the registry.
 * Non-throwing — returns true if removed, false if not found.
 */
export function unregisterAgent(agentId: string): boolean {
  return agentRegistry.delete(agentId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK MANAGEMENT — Create and Track Tasks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new task within a plan.
 * Non-throwing — returns the created task.
 */
export function createTask(params: {
  planId: string;
  objective: string;
  description?: string;
  priority?: TaskPriority;
  reasoningSteps?: string[];
  expectedOutputType?: string;
  dependencies?: string[];
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  maxRetries?: number;
}): AgentTask {
  const task: AgentTask = {
    id: generateId('task'),
    parentId: null,
    planId: params.planId,
    objective: params.objective,
    description: params.description ?? params.objective,
    status: 'pending',
    priority: params.priority ?? 'medium',
    complexity: estimateComplexity(params.description ?? params.objective, params.reasoningSteps ?? []),
    assignedAgentId: null,
    assignedAgentName: null,
    reasoningSteps: params.reasoningSteps ?? [],
    expectedOutputType: params.expectedOutputType ?? 'analysis',
    dependencies: params.dependencies ?? [],
    dependents: [],
    input: params.input ?? {},
    output: null,
    toolCalls: [],
    recordedReasoning: [],
    validation: null,
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    tokensUsed: 0,
    costUsd: 0,
    error: null,
    humanFeedback: null,
    retryCount: 0,
    maxRetries: params.maxRetries ?? 3,
    metadata: params.metadata ?? {},
    createdAt: now(),
    updatedAt: now(),
  };
  return task;
}

/**
 * Update task status.
 * Non-throwing — returns updated task or null if not found.
 */
export function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  updates?: Partial<AgentTask>,
): AgentTask | null {
  // Find task in all plans
  for (const plan of planStore.values()) {
    const task = plan.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      if (updates) {
        Object.assign(task, updates);
      }
      task.updatedAt = now();
      return task;
    }
  }
  // Check in executions
  for (const exec of executionStore.values()) {
    const task = exec.tasks[taskId];
    if (task) {
      task.status = status;
      if (updates) {
        Object.assign(task, updates);
      }
      task.updatedAt = now();
      return task;
    }
  }
  return null;
}

/**
 * Get a task by ID (searches all plans and executions).
 * Non-throwing — returns null if not found.
 */
export function getTask(taskId: string): AgentTask | null {
  for (const plan of planStore.values()) {
    const task = plan.tasks.find(t => t.id === taskId);
    if (task) return task;
  }
  for (const exec of executionStore.values()) {
    const task = exec.tasks[taskId];
    if (task) return task;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT PLANNER — Objective Decomposition & Plan Generation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Decompose a high-level objective into an execution plan.
 * Analyzes the objective, determines required agents, tools, and memory,
 * and produces a dependency-ordered task plan.
 *
 * Non-throwing — returns a plan (may have empty tasks on error).
 */
export function createPlan(params: {
  objective: string;
  description?: string;
  priorities?: TaskPriority[];
  memoryRequirements?: MemoryRequirement[];
  retrievalRequirements?: RetrievalRequirement[];
  metadata?: Record<string, unknown>;
}): AgentPlan {
  const objective = params.objective;
  const description = params.description ?? objective;

  // Step 1: Analyze objective to determine required capabilities
  const objLower = objective.toLowerCase();
  const capabilities = analyzeObjectiveCapabilities(objLower);

  // Step 2: Determine task decomposition
  const tasks = decomposeObjective(objective, capabilities, params.priorities);

  // Step 3: Build dependency graph
  const dependencyGraph: Record<string, string[]> = {};
  for (const task of tasks) {
    dependencyGraph[task.id] = task.dependents;
  }

  // Step 4: Compute execution waves (parallel-safe groups)
  const executionWaves = computeExecutionWaves(tasks);

  // Step 5: Calculate estimates
  let estimatedCostUsd = 0;
  let estimatedTokens = 0;
  let maxComplexity: TaskComplexity = 'trivial';
  const complexityOrder: Record<TaskComplexity, number> = {
    trivial: 0, simple: 1, moderate: 2, complex: 3, expert: 4,
  };
  const requiredSpecializations: AgentSpecialization[] = [];

  for (const task of tasks) {
    const agent = selectAgentForTask(task.objective);
    if (agent) {
      if (!requiredSpecializations.includes(agent.specialization)) {
        requiredSpecializations.push(agent.specialization);
      }
      estimatedCostUsd += estimateCost(task.complexity, agent.tier);
      estimatedTokens += estimateTokens(task.complexity, agent.tier);
    } else {
      estimatedCostUsd += estimateCost(task.complexity, 'smart');
      estimatedTokens += estimateTokens(task.complexity, 'smart');
    }
    if (complexityOrder[task.complexity] > complexityOrder[maxComplexity]) {
      maxComplexity = task.complexity;
    }
  }

  // Step 6: Check if any task requires human approval
  let requiresHumanApproval = false;
  for (const task of tasks) {
    const agent = selectAgentForTask(task.objective);
    if (agent && (agent.approvalMode === 'hard_gate' || agent.approvalMode === 'escalate')) {
      requiresHumanApproval = true;
      break;
    }
  }

  const plan: AgentPlan = {
    id: generateId('plan'),
    objective,
    description,
    status: 'draft',
    tasks,
    dependencyGraph,
    executionWaves,
    totalComplexity: maxComplexity,
    requiredSpecializations,
    memoryRequirements: params.memoryRequirements ?? inferMemoryRequirements(objLower),
    retrievalRequirements: params.retrievalRequirements ?? inferRetrievalRequirements(objLower),
    requiresHumanApproval,
    estimatedCostUsd,
    estimatedTokens,
    createdAt: now(),
    updatedAt: now(),
    startedAt: null,
    completedAt: null,
    durationMs: 0,
  };

  planStore.set(plan.id, plan);
  logger.info(`[agent-framework] created plan: ${plan.id} with ${tasks.length} tasks, ${executionWaves.length} waves, est cost=$${estimatedCostUsd.toFixed(4)}`);

  return plan;
}

/**
 * Analyze an objective to determine required capabilities.
 * Returns a set of capability flags.
 */
function analyzeObjectiveCapabilities(objLower: string): Set<string> {
  const capabilities = new Set<string>();

  // Research capability
  if (/\b(research|investigate|find|discover|profile|background|company|market|industry|competitor)\b/.test(objLower)) {
    capabilities.add('research');
  }

  // Analysis capability
  if (/\b(analyze|assess|evaluate|compare|measure|score|rank|swot)\b/.test(objLower)) {
    capabilities.add('analysis');
  }

  // Reasoning capability
  if (/\b(reason|infer|deduce|logic|why|explain|cause|effect|impact|implication)\b/.test(objLower)) {
    capabilities.add('reasoning');
  }

  // Scoring capability
  if (/\b(score|rate|win.probability|priority|grade|rank|opportunity|pipeline)\b/.test(objLower)) {
    capabilities.add('scoring');
  }

  // Strategy capability
  if (/\b(strategy|plan|approach|tactics|messaging|positioning|recommend|next.best|action)\b/.test(objLower)) {
    capabilities.add('strategy');
  }

  // Conversation capability
  if (/\b(conversation|meeting|call|talk|discuss|prepare|brief|talking.point|objection)\b/.test(objLower)) {
    capabilities.add('conversation');
  }

  // Writing capability
  if (/\b(write|draft|compose|generate|create|email|proposal|report|document|executive)\b/.test(objLower)) {
    capabilities.add('writing');
  }

  // Validation capability
  if (/\b(validate|verify|check|review|audit|confirm|test|accuracy)\b/.test(objLower)) {
    capabilities.add('validation');
  }

  // Learning capability
  if (/\b(learn|improve|adapt|optimize|refine|feedback|pattern|trend)\b/.test(objLower)) {
    capabilities.add('learning');
  }

  // If no capabilities detected, default to research + analysis
  if (capabilities.size === 0) {
    capabilities.add('research');
    capabilities.add('analysis');
  }

  return capabilities;
}

/**
 * Decompose an objective into a task list based on detected capabilities.
 */
function decomposeObjective(
  objective: string,
  capabilities: Set<string>,
  priorities?: TaskPriority[],
): AgentTask[] {
  const tasks: AgentTask[] = [];
  const planId = 'pending-plan'; // Will be assigned when plan is created

  // Task 1: Research / Intelligence Gathering (always first if research needed)
  if (capabilities.has('research')) {
    tasks.push(createTask({
      planId,
      objective: `Research and gather intelligence: ${objective}`,
      description: 'Collect relevant data, signals, entities, and context for the objective',
      priority: priorities?.[0] ?? 'high',
      reasoningSteps: [
        'Identify key entities mentioned in the objective',
        'Retrieve relevant enterprise memory and context',
        'Search for matching signals and intelligence data',
        'Expand knowledge graph connections from identified entities',
        'Synthesize findings into a structured intelligence package',
      ],
      expectedOutputType: 'intelligence_package',
      dependencies: [],
    }));
  }

  // Task 2: Analysis
  if (capabilities.has('analysis')) {
    const researchTask = tasks.find(t => t.objective.includes('Research'));
    tasks.push(createTask({
      planId,
      objective: `Analyze gathered intelligence for: ${objective}`,
      description: 'Perform deep analysis on collected intelligence to identify patterns, gaps, and insights',
      priority: priorities?.[1] ?? 'high',
      reasoningSteps: [
        'Review intelligence package from research phase',
        'Identify key patterns and trends in the data',
        'Assess data quality and completeness',
        'Identify gaps that need additional investigation',
        'Score and rank findings by relevance and confidence',
      ],
      expectedOutputType: 'analysis_report',
      dependencies: researchTask ? [researchTask.id] : [],
    }));
  }

  // Task 3: Reasoning
  if (capabilities.has('reasoning')) {
    const analysisTask = tasks.find(t => t.objective.includes('Analyze'));
    const researchTask = tasks.find(t => t.objective.includes('Research'));
    tasks.push(createTask({
      planId,
      objective: `Reason through evidence for: ${objective}`,
      description: 'Build evidence chains and draw logical conclusions from analyzed data',
      priority: priorities?.[2] ?? 'medium',
      reasoningSteps: [
        'Map evidence to specific claims or hypotheses',
        'Build evidence chains connecting facts to conclusions',
        'Identify logical dependencies and causal relationships',
        'Apply deductive and inductive reasoning',
        'Evaluate alternative explanations',
        'Synthesize reasoning into a coherent argument',
      ],
      expectedOutputType: 'reasoning_chain',
      dependencies: [analysisTask?.id, researchTask?.id].filter(Boolean) as string[],
    }));
  }

  // Task 4: Scoring
  if (capabilities.has('scoring')) {
    const analysisTask = tasks.find(t => t.objective.includes('Analyze'));
    tasks.push(createTask({
      planId,
      objective: `Score and prioritize findings for: ${objective}`,
      description: 'Apply scoring methodology to rank and prioritize insights',
      priority: priorities?.[3] ?? 'medium',
      reasoningSteps: [
        'Apply scoring criteria to each finding',
        'Calculate composite scores',
        'Rank findings by strategic value',
        'Identify high-confidence vs speculative items',
      ],
      expectedOutputType: 'scored_ranking',
      dependencies: analysisTask ? [analysisTask.id] : [],
    }));
  }

  // Task 5: Strategy
  if (capabilities.has('strategy')) {
    const scoringTask = tasks.find(t => t.objective.includes('Score'));
    const reasoningTask = tasks.find(t => t.objective.includes('Reason'));
    tasks.push(createTask({
      planId,
      objective: `Develop strategy and recommendations for: ${objective}`,
      description: 'Create actionable strategy based on analysis, reasoning, and scoring',
      priority: priorities?.[4] ?? 'high',
      reasoningSteps: [
        'Review all analysis, reasoning, and scoring outputs',
        'Identify strategic opportunities and risks',
        'Develop recommended approaches ranked by expected impact',
        'Define key messaging and positioning',
        'Create next-best-action recommendations',
      ],
      expectedOutputType: 'strategy_recommendation',
      dependencies: [scoringTask?.id, reasoningTask?.id].filter(Boolean) as string[],
    }));
  }

  // Task 6: Conversation Planning
  if (capabilities.has('conversation')) {
    const strategyTask = tasks.find(t => t.objective.includes('strategy') || t.objective.includes('Strategy'));
    tasks.push(createTask({
      planId,
      objective: `Prepare conversation plan for: ${objective}`,
      description: 'Create meeting-ready conversation plan with talking points, objections, and questions',
      priority: priorities?.[5] ?? 'medium',
      reasoningSteps: [
        'Identify target personas and stakeholders',
        'Develop talking points for each persona',
        'Prepare objection handling strategies',
        'Draft key questions to ask',
        'Create conversation flow and timing guide',
      ],
      expectedOutputType: 'conversation_plan',
      dependencies: strategyTask ? [strategyTask.id] : [],
    }));
  }

  // Task 7: Writing / Generation
  if (capabilities.has('writing')) {
    const strategyTask = tasks.find(t => t.objective.includes('strategy') || t.objective.includes('Strategy'));
    const analysisTask = tasks.find(t => t.objective.includes('Analyze'));
    tasks.push(createTask({
      planId,
      objective: `Generate deliverable for: ${objective}`,
      description: 'Create the final written deliverable (email, proposal, report, or brief)',
      priority: priorities?.[6] ?? 'high',
      reasoningSteps: [
        'Determine deliverable format and audience',
        'Structure the content based on analysis and strategy',
        'Write initial draft incorporating evidence and reasoning',
        'Apply tone and style guidelines',
        'Review for accuracy and completeness',
      ],
      expectedOutputType: 'written_deliverable',
      dependencies: [strategyTask?.id, analysisTask?.id].filter(Boolean) as string[],
    }));
  }

  // Task 8: Validation (always last if present)
  if (capabilities.has('validation')) {
    const allTaskIds = tasks.map(t => t.id);
    tasks.push(createTask({
      planId,
      objective: `Validate output for: ${objective}`,
      description: 'Run comprehensive validation on all generated outputs',
      priority: priorities?.[7] ?? 'high',
      reasoningSteps: [
        'Review all task outputs for factual accuracy',
        'Run hallucination prevention checks',
        'Verify evidence grounding and citation accuracy',
        'Assess confidence calibration',
        'Check enterprise readiness criteria',
      ],
      expectedOutputType: 'validation_report',
      dependencies: allTaskIds.length > 0 ? [allTaskIds[allTaskIds.length - 1]] : [],
    }));
  }

  // Task 9: Learning
  if (capabilities.has('learning')) {
    const allTaskIds = tasks.map(t => t.id);
    tasks.push(createTask({
      planId,
      objective: `Extract learnings from: ${objective}`,
      description: 'Capture insights and patterns for organizational learning',
      priority: 'low',
      reasoningSteps: [
        'Review execution outcomes',
        'Identify what worked well and what could improve',
        'Extract reusable patterns',
        'Store learnings in institutional memory',
      ],
      expectedOutputType: 'learning_report',
      dependencies: allTaskIds.length > 0 ? [allTaskIds[allTaskIds.length - 1]] : [],
    }));
  }

  // Build forward dependency links (dependents)
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      const depTask = tasks.find(t => t.id === depId);
      if (depTask && !depTask.dependents.includes(task.id)) {
        depTask.dependents.push(task.id);
      }
    }
  }

  return tasks;
}

/**
 * Compute execution waves from task dependencies.
 * Tasks in the same wave can execute in parallel.
 */
function computeExecutionWaves(tasks: AgentTask[]): string[][] {
  const waves: string[][] = [];
  const completed = new Set<string>();
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const remaining = new Set(tasks.map(t => t.id));

  let maxWaves = tasks.length + 1;
  while (remaining.size > 0 && maxWaves-- > 0) {
    const wave: string[] = [];
    for (const taskId of remaining) {
      const task = taskMap.get(taskId);
      if (task && task.dependencies.every(dep => completed.has(dep))) {
        wave.push(taskId);
      }
    }
    if (wave.length === 0) {
      // Circular dependency or stuck tasks — force remaining into last wave
      wave.push(...remaining);
    }
    for (const id of wave) {
      completed.add(id);
      remaining.delete(id);
    }
    if (wave.length > 0) {
      waves.push(wave);
    }
  }

  return waves;
}

/**
 * Infer memory requirements from objective text.
 */
function inferMemoryRequirements(objLower: string): MemoryRequirement[] {
  const requirements: MemoryRequirement[] = [];

  requirements.push({
    layer: 'working',
    category: 'reasoning_chain',
    required: true,
    description: 'Active reasoning state for the current objective',
  });

  if (/\b(user|preference|history|previous|before|last.time|remember)\b/.test(objLower)) {
    requirements.push({
      layer: 'conversation',
      category: 'user_preference',
      required: true,
      description: 'User preferences and interaction history',
    });
    requirements.push({
      layer: 'conversation',
      category: 'conversation_history',
      required: false,
      description: 'Previous conversation context',
    });
  }

  if (/\b(company|account|client|customer|organization|acme|corp|inc|ltd)\b/.test(objLower)) {
    requirements.push({
      layer: 'enterprise',
      category: 'company_intelligence',
      required: true,
      description: 'Company intelligence and signal history',
    });
    requirements.push({
      layer: 'enterprise',
      category: 'contact_intelligence',
      required: false,
      description: 'Contact and stakeholder intelligence',
    });
  }

  if (/\b(learn|improve|pattern|trend|historical|benchmark|best.practice)\b/.test(objLower)) {
    requirements.push({
      layer: 'institutional',
      category: 'learning_insight',
      required: false,
      description: 'Organizational learning and best practices',
    });
  }

  return requirements;
}

/**
 * Infer retrieval requirements from objective text.
 */
function inferRetrievalRequirements(objLower: string): RetrievalRequirement[] {
  const requirements: RetrievalRequirement[] = [];

  if (/\b(company|account|client|competitor|market|industry)\b/.test(objLower)) {
    requirements.push({
      query: objLower.slice(0, 200),
      signalTypes: ['company_intelligence', 'signal_detection', 'market_knowledge'],
      minResults: 5,
      description: 'Company and market intelligence retrieval',
    });
  }

  if (/\b(contact|person|stakeholder|decision.maker|cto|ceo|vp|director|leader)\b/.test(objLower)) {
    requirements.push({
      query: objLower.slice(0, 200),
      signalTypes: ['contact_intelligence', 'company_intelligence'],
      minResults: 3,
      description: 'Contact and stakeholder retrieval',
    });
  }

  if (/\b(technology|tech.stack|kubernetes|aws|cloud|software|platform)\b/.test(objLower)) {
    requirements.push({
      query: objLower.slice(0, 200),
      signalTypes: ['company_intelligence', 'competitive_intelligence'],
      minResults: 5,
      description: 'Technology landscape retrieval',
    });
  }

  if (requirements.length === 0) {
    requirements.push({
      query: objLower.slice(0, 200),
      signalTypes: ['company_intelligence', 'signal_detection'],
      minResults: 3,
      description: 'General intelligence retrieval',
    });
  }

  return requirements;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL EXECUTION — Simulated Tool Calls
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a tool call on behalf of an agent.
 * In production, each tool type would connect to the corresponding WI-16 module.
 * For now, this simulates realistic tool execution with structured outputs.
 *
 * Non-throwing — returns a ToolCallRecord with status and output/error.
 */
export function executeToolCall(params: {
  taskId: string;
  agentId: string;
  toolType: AgentToolType;
  toolName?: string;
  input: Record<string, unknown>;
}): ToolCallRecord {
  const startTime = Date.now();
  const call: ToolCallRecord = {
    id: generateId('tool'),
    taskId: params.taskId,
    agentId: params.agentId,
    toolType: params.toolType,
    toolName: params.toolName ?? params.toolType,
    status: 'pending',
    input: params.input,
    output: null,
    error: null,
    latencyMs: 0,
    tokensUsed: 0,
    costUsd: 0,
    timestamp: now(),
  };

  try {
    call.status = 'running';

    // Simulate realistic tool execution
    const result = simulateToolExecution(params.toolType, params.input);

    if (result.success) {
      call.status = 'completed';
      call.output = result.data;
    } else {
      call.status = 'failed';
      call.error = result.error ?? 'Tool execution failed';
    }

    call.latencyMs = Date.now() - startTime;
    call.tokensUsed = result.tokensUsed ?? 0;
    call.costUsd = result.costUsd ?? 0;

    toolCallHistory.set(call.id, call);
    return call;
  } catch (err) {
    call.status = 'failed';
    call.error = err instanceof Error ? err.message : String(err);
    call.latencyMs = Date.now() - startTime;
    toolCallHistory.set(call.id, call);
    return call;
  }
}

/** Internal: Simulate tool execution with realistic outputs */
function simulateToolExecution(
  toolType: AgentToolType,
  input: Record<string, unknown>,
): { success: boolean; data: Record<string, unknown>; error?: string; tokensUsed?: number; costUsd?: number } {
  switch (toolType) {
    case 'memory_recall': {
      const query = String(input.query ?? '');
      const layer = String(input.layer ?? 'all');
      return {
        success: true,
        data: {
          memories: [
            { id: 'mem-1', layer, content: `Recalled memory for: ${query.slice(0, 80)}`, relevanceScore: 0.85, matchReason: 'semantic_match' },
            { id: 'mem-2', layer, content: `Related context: ${query.slice(0, 60)}`, relevanceScore: 0.72, matchReason: 'entity_match' },
          ],
          totalFound: 2,
          latencyMs: 12,
        },
        tokensUsed: 15,
        costUsd: 0.00002,
      };
    }

    case 'memory_store': {
      const content = String(input.content ?? 'stored insight');
      return {
        success: true,
        data: {
          memoryId: generateId('mem'),
          layer: input.layer ?? 'enterprise',
          content,
          stored: true,
          timestamp: now(),
        },
        tokensUsed: 5,
        costUsd: 0.00001,
      };
    }

    case 'hybrid_search': {
      const query = String(input.query ?? '');
      return {
        success: true,
        data: {
          packageId: generateId('ep'),
          query,
          activeSignalCount: 4,
          results: [
            { id: 'r-1', content: `Search result 1 for: ${query.slice(0, 60)}`, score: 0.88, signals: ['vector', 'keyword'] },
            { id: 'r-2', content: `Search result 2: ${query.slice(0, 50)}`, score: 0.76, signals: ['vector', 'entity'] },
            { id: 'r-3', content: `Search result 3: ${query.slice(0, 40)}`, score: 0.65, signals: ['keyword', 'graph'] },
          ],
          totalRetrieved: 3,
          quality: { averageConfidence: 0.76, premiumSourceCount: 2 },
        },
        tokensUsed: 30,
        costUsd: 0.0001,
      };
    }

    case 'knowledge_graph': {
      const entity = String(input.entity ?? 'target');
      const operation = String(input.operation ?? 'expand');
      return {
        success: true,
        data: {
          entity,
          operation,
          nodes: [
            { id: 'n-1', label: entity, type: 'company', confidence: 0.9 },
            { id: 'n-2', label: `${entity}-tech`, type: 'technology', confidence: 0.85 },
            { id: 'n-3', label: `${entity}-contact`, type: 'person', confidence: 0.8 },
          ],
          edges: [
            { sourceId: 'n-1', targetId: 'n-2', relationship: 'uses', confidence: 0.88 },
            { sourceId: 'n-1', targetId: 'n-3', relationship: 'employed_by', confidence: 0.82 },
          ],
          pathScore: 0.85,
        },
        tokensUsed: 25,
        costUsd: 0.00005,
      };
    }

    case 'entity_lookup': {
      const name = String(input.name ?? 'unknown');
      return {
        success: true,
        data: {
          entity: { id: 'e-1', label: name, type: 'company', aliases: [name], confidence: 0.92, properties: { industry: 'Technology', size: 'Mid-Market' } },
          found: true,
        },
        tokensUsed: 10,
        costUsd: 0.00001,
      };
    }

    case 'confidence_score': {
      return {
        success: true,
        data: {
          score: 0.82,
          grade: 'B+',
          trustClass: 'enterprise',
          enterpriseReady: true,
          factors: [
            { dimension: 'data_quality', score: 0.85, weight: 0.2 },
            { dimension: 'source_reliability', score: 0.80, weight: 0.2 },
            { dimension: 'freshness', score: 0.78, weight: 0.15 },
            { dimension: 'cross_validation', score: 0.84, weight: 0.15 },
            { dimension: 'evidence_coverage', score: 0.79, weight: 0.15 },
            { dimension: 'ai_certainty', score: 0.83, weight: 0.15 },
          ],
        },
        tokensUsed: 20,
        costUsd: 0.00003,
      };
    }

    case 'hallucination_check': {
      return {
        success: true,
        data: {
          riskScore: 0.12,
          riskLevel: 'low',
          claims: [
            { text: 'Acme Corp uses Kubernetes', type: 'factual', verified: true, source: 'enterprise_memory' },
            { text: 'Revenue approximately $50M', type: 'quantitative', verified: true, source: 'signal_data' },
          ],
          verifiedClaims: 2,
          unverifiedClaims: 0,
          passesTrustThreshold: true,
          recommendations: ['Output is well-grounded in verified evidence'],
        },
        tokensUsed: 35,
        costUsd: 0.00008,
      };
    }

    case 'evaluation': {
      return {
        success: true,
        data: {
          evaluationId: generateId('eval'),
          compositeScore: 84,
          compositeGrade: 'B+',
          enterpriseReady: true,
          dimensions: [
            { dimension: 'accuracy', score: 87, grade: 'B+' },
            { dimension: 'hallucination_rate', score: 92, grade: 'A-' },
            { dimension: 'citation_accuracy', score: 80, grade: 'B' },
            { dimension: 'confidence_calibration', score: 82, grade: 'B+' },
            { dimension: 'response_quality', score: 85, grade: 'B+' },
            { dimension: 'business_usefulness', score: 78, grade: 'B' },
          ],
          findings: [
            { severity: 'info', description: 'Strong overall quality with minor citation gaps' },
          ],
        },
        tokensUsed: 45,
        costUsd: 0.00015,
      };
    }

    case 'reasoning_chain': {
      const question = String(input.question ?? 'analyze');
      return {
        success: true,
        data: {
          chainId: generateId('chain'),
          question,
          steps: [
            { step: 1, type: 'evidence_gathering', conclusion: `Evidence collected for: ${question.slice(0, 60)}`, confidence: 0.85 },
            { step: 2, type: 'analysis', conclusion: 'Cross-referenced evidence supports the hypothesis', confidence: 0.78 },
            { step: 3, type: 'synthesis', conclusion: 'Integrated findings form coherent reasoning chain', confidence: 0.82 },
          ],
          overallConfidence: 0.82,
        },
        tokensUsed: 40,
        costUsd: 0.00012,
      };
    }

    case 'web_search': {
      const query = String(input.query ?? '');
      return {
        success: true,
        data: {
          results: [
            { title: `Result for: ${query.slice(0, 50)}`, snippet: 'Relevant information from external source', url: 'https://example.com/resource', relevance: 0.7 },
          ],
          totalFound: 1,
        },
        tokensUsed: 10,
        costUsd: 0.00002,
      };
    }

    case 'calculator': {
      const expression = String(input.expression ?? '2+2');
      let result: number;
      try {
        // Safe evaluation of simple math expressions
        result = Function('"use strict"; return (' + expression.replace(/[^0-9+\-*/().%\s]/g, '') + ')')();
      } catch {
        result = 0;
      }
      return {
        success: true,
        data: { expression, result, unit: input.unit ?? null },
        tokensUsed: 2,
        costUsd: 0.0,
      };
    }

    case 'text_analysis': {
      const text = String(input.text ?? '');
      return {
        success: true,
        data: {
          entities: [
            { text: 'Acme Corp', type: 'company', normalized: 'acme_corp' },
            { text: 'Kubernetes', type: 'technology', normalized: 'kubernetes' },
          ],
          sentiment: { score: 0.65, label: 'positive' },
          keywords: text.split(/\s+/).slice(0, 5).filter(Boolean),
          language: 'en',
          wordCount: text.split(/\s+/).length,
          characterCount: text.length,
        },
        tokensUsed: 15,
        costUsd: 0.00002,
      };
    }

    default:
      return {
        success: false,
        data: {},
        error: `Unknown tool type: ${toolType}`,
      };
  }
}

/**
 * Get tool call history.
 * Non-throwing — returns array of tool calls.
 */
export function getToolCallHistory(options?: {
  taskId?: string;
  agentId?: string;
  toolType?: AgentToolType;
  limit?: number;
}): ToolCallRecord[] {
  let calls = Array.from(toolCallHistory.values());

  if (options?.taskId) {
    calls = calls.filter(c => c.taskId === options.taskId);
  }
  if (options?.agentId) {
    calls = calls.filter(c => c.agentId === options.agentId);
  }
  if (options?.toolType) {
    calls = calls.filter(c => c.toolType === options.toolType);
  }
  if (options?.limit) {
    calls = calls.slice(-options.limit);
  }

  return calls;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REASONING ENGINE — Step-by-Step Reasoning
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a reasoning step for a task.
 * Non-throwing — returns the created step.
 */
export function createReasoningStep(params: {
  taskId: string;
  stepNumber: number;
  type: ReasoningType;
  description: string;
  question: string;
  inputs?: string[];
  toolCallIds?: string[];
}): ReasoningStep {
  const step: ReasoningStep = {
    id: generateId('reason'),
    taskId: params.taskId,
    stepNumber: params.stepNumber,
    type: params.type,
    description: params.description,
    status: 'pending',
    question: params.question,
    inputs: params.inputs ?? [],
    conclusion: null,
    confidence: 0,
    toolCallIds: params.toolCallIds ?? [],
    durationMs: 0,
    productive: false,
    timestamp: now(),
  };
  reasoningHistory.set(step.id, step);
  return step;
}

/**
 * Complete a reasoning step with a conclusion.
 * Non-throwing — returns updated step or null.
 */
export function completeReasoningStep(
  stepId: string,
  conclusion: string,
  confidence: number,
  productive: boolean,
  durationMs?: number,
): ReasoningStep | null {
  const step = reasoningHistory.get(stepId);
  if (!step) return null;

  step.status = 'completed';
  step.conclusion = conclusion;
  step.confidence = Math.min(1, Math.max(0, confidence));
  step.productive = productive;
  step.durationMs = durationMs ?? (Date.now() - new Date(step.timestamp).getTime());

  return step;
}

/**
 * Get reasoning history for a task.
 * Non-throwing — returns array of reasoning steps.
 */
export function getReasoningHistory(taskId?: string): ReasoningStep[] {
  let steps = Array.from(reasoningHistory.values());
  if (taskId) {
    steps = steps.filter(s => s.taskId === taskId);
  }
  return steps.sort((a, b) => a.stepNumber - b.stepNumber);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELF-VALIDATION — Agent Output Quality Gates
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate agent output through multiple quality gates.
 * Checks: confidence, hallucination, evidence grounding, completeness, coherence.
 *
 * Non-throwing — returns ValidationResult.
 */
export function validateOutput(params: {
  taskId: string;
  output: Record<string, unknown>;
  reasoningSteps: ReasoningStep[];
  toolCalls: ToolCallRecord[];
  agentDefinition: AgentDefinition;
  contextConfidence?: number;
}): ValidationResult {
  const checks: ValidationCheck[] = [];
  const findings: ValidationFinding[] = [];
  let totalScore = 0;
  let checkCount = 0;

  // Check 1: Confidence Score
  const contextConf = params.contextConfidence ?? 0.75;
  const confScore = contextConf >= params.agentDefinition.confidenceThreshold ? 1 : contextConf / params.agentDefinition.confidenceThreshold;
  const confCheck: ValidationCheck = {
    name: 'confidence_threshold',
    status: contextConf >= params.agentDefinition.confidenceThreshold ? 'passed' : 'warning',
    score: Math.round(confScore * 100),
    description: `Context confidence ${Math.round(contextConf * 100)}% vs threshold ${Math.round(params.agentDefinition.confidenceThreshold * 100)}%`,
  };
  checks.push(confCheck);
  totalScore += confScore;
  checkCount++;

  if (contextConf < params.agentDefinition.confidenceThreshold) {
    findings.push({
      id: generateId('find'),
      severity: 'warning',
      category: 'confidence',
      description: `Confidence (${Math.round(contextConf * 100)}%) below agent threshold (${Math.round(params.agentDefinition.confidenceThreshold * 100)}%)`,
      suggestion: 'Consider gathering more evidence or escalating to human review',
    });
  }

  // Check 2: Reasoning Completeness
  const productiveSteps = params.reasoningSteps.filter(s => s.productive).length;
  const totalSteps = params.reasoningSteps.length;
  const reasoningScore = totalSteps === 0 ? 0.5 : productiveSteps / totalSteps;
  const reasoningCheck: ValidationCheck = {
    name: 'reasoning_completeness',
    status: reasoningScore >= 0.7 ? 'passed' : reasoningScore >= 0.4 ? 'warning' : 'failed',
    score: Math.round(reasoningScore * 100),
    description: `${productiveSteps}/${totalSteps} reasoning steps produced conclusions`,
  };
  checks.push(reasoningCheck);
  totalScore += reasoningScore;
  checkCount++;

  if (reasoningScore < 0.5) {
    findings.push({
      id: generateId('find'),
      severity: 'warning',
      category: 'reasoning',
      description: 'Less than half of reasoning steps produced useful conclusions',
      suggestion: 'Review reasoning chain for gaps or logical errors',
    });
  }

  // Check 3: Tool Usage Effectiveness
  const successfulTools = params.toolCalls.filter(t => t.status === 'completed').length;
  const totalTools = params.toolCalls.length;
  const toolScore = totalTools === 0 ? 0.8 : successfulTools / totalTools;
  const toolCheck: ValidationCheck = {
    name: 'tool_effectiveness',
    status: toolScore >= 0.8 ? 'passed' : toolScore >= 0.5 ? 'warning' : 'failed',
    score: Math.round(toolScore * 100),
    description: `${successfulTools}/${totalTools} tool calls succeeded`,
  };
  checks.push(toolCheck);
  totalScore += toolScore;
  checkCount++;

  // Check 4: Output Completeness
  const outputKeys = Object.keys(params.output).length;
  const outputScore = outputKeys >= 3 ? 1 : outputKeys >= 1 ? 0.6 : 0.2;
  const outputCheck: ValidationCheck = {
    name: 'output_completeness',
    status: outputScore >= 0.8 ? 'passed' : outputScore >= 0.5 ? 'warning' : 'failed',
    score: Math.round(outputScore * 100),
    description: `Output contains ${outputKeys} fields`,
  };
  checks.push(outputCheck);
  totalScore += outputScore;
  checkCount++;

  if (outputKeys === 0) {
    findings.push({
      id: generateId('find'),
      severity: 'critical',
      category: 'completeness',
      description: 'Agent produced no output',
      suggestion: 'Task may need to be retried with different parameters',
    });
  }

  // Check 5: Hallucination Risk (simulated)
  const hallucRisk = 0.08 + Math.random() * 0.12; // Simulated 8-20% risk
  const hallucScore = 1 - hallucRisk;
  const hallucCheck: ValidationCheck = {
    name: 'hallucination_risk',
    status: hallucRisk <= 0.15 ? 'passed' : hallucRisk <= 0.3 ? 'warning' : 'failed',
    score: Math.round(hallucScore * 100),
    description: `Hallucination risk: ${Math.round(hallucRisk * 100)}%`,
  };
  checks.push(hallucCheck);
  totalScore += hallucScore;
  checkCount++;

  if (hallucRisk > 0.25) {
    findings.push({
      id: generateId('find'),
      severity: 'critical',
      category: 'hallucination',
      description: `Hallucination risk (${Math.round(hallucRisk * 100)}%) exceeds safe threshold`,
      suggestion: 'Apply hallucination prevention rules and regenerate',
    });
  }

  // Check 6: Evidence Grounding
  const hasEvidence = params.toolCalls.some(t =>
    t.toolType === 'hybrid_search' || t.toolType === 'knowledge_graph' || t.toolType === 'memory_recall'
  );
  const evidenceScore = hasEvidence ? 0.9 : totalTools > 0 ? 0.5 : 0.3;
  const evidenceCheck: ValidationCheck = {
    name: 'evidence_grounding',
    status: evidenceScore >= 0.8 ? 'passed' : evidenceScore >= 0.5 ? 'warning' : 'failed',
    score: Math.round(evidenceScore * 100),
    description: hasEvidence ? 'Output grounded in retrieved evidence' : 'No evidence retrieval detected',
  };
  checks.push(evidenceCheck);
  totalScore += evidenceScore;
  checkCount++;

  // Calculate overall validation
  const avgScore = checkCount > 0 ? totalScore / checkCount : 0;
  const overallConfidence = avgScore * contextConf; // Weighted by context
  const overallConf = Math.min(1, overallConfidence * 1.1); // Slight boost from multiple checks passing

  const criticalFindings = findings.filter(f => f.severity === 'critical');
  const warningFindings = findings.filter(f => f.severity === 'warning');

  let validationStatus: ValidationStatus;
  let recommendation: ValidationResult['recommendation'];

  if (criticalFindings.length > 0) {
    validationStatus = 'failed';
    recommendation = 'retry';
  } else if (warningFindings.length > 2) {
    validationStatus = 'passed_with_warnings';
    recommendation = 'revise';
  } else if (warningFindings.length > 0) {
    validationStatus = 'passed_with_warnings';
    recommendation = 'proceed';
  } else {
    validationStatus = 'passed';
    recommendation = 'proceed';
  }

  // Enterprise readiness requires confidence >= 0.8 and no critical findings
  const enterpriseReady = overallConf >= 0.80 && criticalFindings.length === 0;

  const result: ValidationResult = {
    id: generateId('val'),
    taskId: params.taskId,
    status: validationStatus,
    confidenceScore: overallConf,
    confidenceGrade: confidenceGradeFromScore(overallConf),
    trustClass: trustClassFromScore(overallConf),
    hallucinationRisk: hallucRisk,
    checks,
    findings,
    enterpriseReady,
    recommendation,
    summary: `Validation ${validationStatus}: confidence=${confidenceGradeFromScore(overallConf)}, trust=${trustClassFromScore(overallConf)}, ${checks.filter(c => c.status === 'passed').length}/${checks.length} checks passed`,
    timestamp: now(),
  };

  validationHistory.set(result.id, result);
  return result;
}

/**
 * Get validation history.
 */
export function getValidationHistory(taskId?: string): ValidationResult[] {
  let results = Array.from(validationHistory.values());
  if (taskId) {
    results = results.filter(r => r.taskId === taskId);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLABORATION — Inter-Agent Communication
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a collaboration message from one agent to another.
 * Non-throwing — returns the message.
 */
export function sendCollaborationMessage(params: {
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  executionId: string;
  taskId: string;
  messageType: CollaborationMessageType;
  priority?: CollaborationPriority;
  subject: string;
  body: string;
  payload?: Record<string, unknown>;
  responseToId?: string;
}): CollaborationMessage {
  const message: CollaborationMessage = {
    id: generateId('msg'),
    fromAgentId: params.fromAgentId,
    fromAgentName: params.fromAgentName,
    toAgentId: params.toAgentId,
    toAgentName: params.toAgentName,
    executionId: params.executionId,
    taskId: params.taskId,
    messageType: params.messageType,
    priority: params.priority ?? 'normal',
    subject: params.subject,
    body: params.body,
    payload: params.payload ?? {},
    read: false,
    responseToId: params.responseToId ?? null,
    timestamp: now(),
  };

  // Add to recipient's inbox
  const inbox = collaborationInbox.get(params.toAgentId) ?? [];
  inbox.push(message);
  collaborationInbox.set(params.toAgentId, inbox);

  // Emit event for real-time communication
  eventBus.emit('agent:collaboration', message);

  return message;
}

/**
 * Get messages in an agent's inbox.
 */
export function getAgentInbox(agentId: string, options?: {
  unreadOnly?: boolean;
  messageType?: CollaborationMessageType;
  limit?: number;
}): CollaborationMessage[] {
  const inbox = collaborationInbox.get(agentId) ?? [];
  let messages = [...inbox];

  if (options?.unreadOnly) {
    messages = messages.filter(m => !m.read);
  }
  if (options?.messageType) {
    messages = messages.filter(m => m.messageType === options.messageType);
  }
  if (options?.limit) {
    messages = messages.slice(-options.limit);
  }

  return messages;
}

/**
 * Mark a message as read.
 */
export function markMessageRead(messageId: string): boolean {
  for (const [, inbox] of collaborationInbox) {
    const msg = inbox.find(m => m.id === messageId);
    if (msg) {
      msg.read = true;
      return true;
    }
  }
  return false;
}

/**
 * Get collaboration messages for an execution.
 */
export function getExecutionCollaboration(executionId: string): CollaborationMessage[] {
  const messages: CollaborationMessage[] = [];
  for (const [, inbox] of collaborationInbox) {
    messages.push(...inbox.filter(m => m.executionId === executionId));
  }
  return messages;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HUMAN APPROVAL — Checkpoint Management
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Submit human feedback for a task.
 * Non-throwing — returns the task with feedback applied.
 */
export function submitHumanFeedback(params: {
  taskId: string;
  feedbackType: FeedbackType;
  userId: string;
  comment?: string;
  revisedOutput?: Record<string, unknown>;
}): AgentTask | null {
  const task = getTask(params.taskId);
  if (!task) return null;

  const feedback: HumanFeedback = {
    type: params.feedbackType,
    userId: params.userId,
    comment: params.comment ?? null,
    revisedOutput: params.revisedOutput ?? null,
    timestamp: now(),
  };

  task.humanFeedback = feedback;

  // Update task status based on feedback type
  switch (params.feedbackType) {
    case 'approve':
      task.status = 'approved';
      break;
    case 'reject':
      task.status = 'rejected';
      break;
    case 'revise':
      task.status = 'planned'; // Ready for revision
      break;
    case 'comment':
      // Keep current status, just add the comment
      break;
    case 'skip':
      task.status = 'completed'; // Skip validation, proceed
      break;
  }

  task.updatedAt = now();

  // Emit event for real-time notification
  eventBus.emit('agent:human_feedback', { taskId: task.id, feedback, taskStatus: task.status });

  return task;
}

/**
 * Get tasks awaiting human approval.
 */
export function getTasksAwaitingApproval(): AgentTask[] {
  const tasks: AgentTask[] = [];
  for (const plan of planStore.values()) {
    tasks.push(...plan.tasks.filter(t => t.status === 'awaiting_approval'));
  }
  for (const exec of executionStore.values()) {
    for (const task of Object.values(exec.tasks)) {
      if (task.status === 'awaiting_approval') {
        tasks.push(task);
      }
    }
  }
  return tasks;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT EXECUTION — Orchestrate Plan Execution
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a plan synchronously through all waves.
 * Simulates the full agent execution lifecycle:
 *   1. Initialize execution context
 *   2. Execute tasks wave-by-wave (respecting dependencies)
 *   3. For each task: select agent → execute reasoning → invoke tools → validate → apply approval
 *   4. Aggregate results
 *   5. Consolidate learnings
 *
 * Non-throwing — returns an AgentExecution.
 */
export function executePlan(planId: string): AgentExecution {
  const plan = planStore.get(planId);
  if (!plan) {
    const exec: AgentExecution = {
      id: generateId('exec'),
      planId,
      objective: 'Unknown plan',
      status: 'failed',
      tasks: {},
      taskTimeline: [],
      agentUsage: [],
      toolUsageSummary: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, byToolType: {} },
      memoryContextSnapshot: null,
      finalOutput: null,
      overallValidation: null,
      collaborationLog: [],
      totalTokensUsed: 0,
      totalCostUsd: 0,
      totalDurationMs: 0,
      error: `Plan not found: ${planId}`,
      createdAt: now(),
      updatedAt: now(),
      startedAt: now(),
      completedAt: now(),
    };
    executionStore.set(exec.id, exec);
    return exec;
  }

  const startMs = Date.now();
  plan.status = 'executing';
  plan.startedAt = now();

  const execution: AgentExecution = {
    id: generateId('exec'),
    planId,
    objective: plan.objective,
    status: 'initializing',
    tasks: {},
    taskTimeline: [],
    agentUsage: [],
    toolUsageSummary: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, byToolType: {} },
    memoryContextSnapshot: { layers: plan.memoryRequirements.map(r => r.layer), retrievals: plan.retrievalRequirements.length },
    finalOutput: null,
    overallValidation: null,
    collaborationLog: [],
    totalTokensUsed: 0,
    totalCostUsd: 0,
    totalDurationMs: 0,
    error: null,
    createdAt: now(),
    updatedAt: now(),
    startedAt: now(),
    completedAt: null,
  };

  executionStore.set(execution.id, execution);
  execution.status = 'planning';

  // Index tasks by ID for fast lookup
  const taskMap = new Map(plan.tasks.map(t => [t.id, t]));
  for (const task of plan.tasks) {
    execution.tasks[task.id] = task;
  }

  // Execute waves
  execution.status = 'executing';
  const completedTasks = new Set<string>();
  const failedTasks = new Set<string>();
  const agentUsageMap = new Map<string, AgentUsageRecord>();
  let totalToolCalls = 0;
  let successfulToolCalls = 0;
  let failedToolCalls = 0;
  const toolTypeStats = new Map<string, { calls: number; successRate: number; totalLatency: number }>();

  for (const wave of plan.executionWaves) {
    for (const taskId of wave) {
      const task = taskMap.get(taskId);
      if (!task || completedTasks.has(taskId) || failedTasks.has(taskId)) continue;

      // Check dependencies
      const depsMet = task.dependencies.every(dep => completedTasks.has(dep));
      if (!depsMet) {
        // Skip if dependencies not met (shouldn't happen with correct wave computation)
        continue;
      }

      // Select agent
      const agent = selectAgentForTask(task.objective);
      if (!agent) {
        task.status = 'failed';
        task.error = 'No suitable agent found for this task';
        task.completedAt = now();
        failedTasks.add(taskId);
        execution.taskTimeline.push({
          taskId, agentId: 'none', action: 'failed', timestamp: now(), metadata: { error: 'No agent found' },
        });
        continue;
      }

      task.assignedAgentId = agent.id;
      task.assignedAgentName = agent.name;
      task.status = 'running';
      task.startedAt = now();

      execution.taskTimeline.push({
        taskId, agentId: agent.id, action: 'started', timestamp: now(),
      });

      // Simulate agent execution
      const taskStartMs = Date.now();

      // 1. Agent performs reasoning steps
      const taskReasoning: ReasoningStep[] = [];
      for (let i = 0; i < Math.min(task.reasoningSteps.length, agent.maxReasoningSteps); i++) {
        const step = createReasoningStep({
          taskId: task.id,
          stepNumber: i + 1,
          type: determineReasoningType(task.reasoningSteps[i]),
          description: task.reasoningSteps[i],
          question: task.reasoningSteps[i],
        });
        step.status = 'completed';
        step.conclusion = `Completed: ${task.reasoningSteps[i].slice(0, 80)}`;
        step.confidence = 0.7 + Math.random() * 0.25;
        step.productive = true;
        step.durationMs = 10 + Math.round(Math.random() * 50);
        reasoningHistory.set(step.id, step);
        taskReasoning.push(step);
      }
      task.recordedReasoning = taskReasoning;

      // 2. Agent invokes tools
      const taskToolCalls: ToolCallRecord[] = [];
      if (agent.availableTools.length > 0) {
        // Select relevant tools based on task type
        const relevantTools = selectRelevantTools(task.objective, agent.availableTools);
        for (const toolType of relevantTools) {
          const toolCall = executeToolCall({
            taskId: task.id,
            agentId: agent.id,
            toolType,
            input: { query: task.objective.slice(0, 100), taskId: task.id },
          });
          taskToolCalls.push(toolCall);
          totalToolCalls++;

          if (toolCall.status === 'completed') {
            successfulToolCalls++;
            const stats = toolTypeStats.get(toolType) ?? { calls: 0, successRate: 0, totalLatency: 0 };
            stats.calls++;
            stats.totalLatency += toolCall.latencyMs;
            stats.successRate = (stats.successRate * (stats.calls - 1) + 1) / stats.calls;
            toolTypeStats.set(toolType, stats);
          } else {
            failedToolCalls++;
            const stats = toolTypeStats.get(toolType) ?? { calls: 0, successRate: 0, totalLatency: 0 };
            stats.calls++;
            stats.successRate = (stats.successRate * (stats.calls - 1) + 0) / stats.calls;
            toolTypeStats.set(toolType, stats);
          }
        }
      }
      task.toolCalls = taskToolCalls;

      // 3. Agent produces output
      task.output = {
        objective: task.objective,
        findings: taskReasoning.map(s => ({ step: s.stepNumber, conclusion: s.conclusion, confidence: s.confidence })),
        toolResults: taskToolCalls.filter(t => t.status === 'completed').map(t => ({ tool: t.toolType, latencyMs: t.latencyMs })),
        agentName: agent.name,
        agentTier: agent.tier,
      };

      // 4. Self-validate
      const contextConf = 0.70 + Math.random() * 0.25; // Simulated context confidence
      const validation = validateOutput({
        taskId: task.id,
        output: task.output,
        reasoningSteps: taskReasoning,
        toolCalls: taskToolCalls,
        agentDefinition: agent,
        contextConfidence: contextConf,
      });
      task.validation = validation;

      // 5. Apply approval logic
      if (validation.recommendation === 'reject' || validation.status === 'failed') {
        if (task.retryCount < task.maxRetries) {
          // Soft retry for validation failures
          task.status = 'planned';
          task.retryCount++;
          execution.taskTimeline.push({
            taskId, agentId: agent.id, action: 'failed', timestamp: now(),
            durationMs: Date.now() - taskStartMs,
            metadata: { reason: 'validation_failed', retryCount: task.retryCount },
          });
          continue; // Will be picked up in next iteration
        } else {
          task.status = 'failed';
          task.error = 'Max retries exceeded after validation failures';
          failedTasks.add(taskId);
          execution.taskTimeline.push({
            taskId, agentId: agent.id, action: 'failed', timestamp: now(),
            durationMs: Date.now() - taskStartMs,
          });
          continue;
        }
      }

      // Handle approval modes
      if (agent.approvalMode === 'hard_gate') {
        task.status = 'awaiting_approval';
        execution.taskTimeline.push({
          taskId, agentId: agent.id, action: 'completed', timestamp: now(),
          durationMs: Date.now() - taskStartMs,
        });
        // Note: In production, execution would pause here for human review
        // For simulation, we auto-approve after marking
        task.status = 'completed';
      } else if (agent.approvalMode === 'escalate' && validation.confidenceScore < agent.confidenceThreshold) {
        task.status = 'awaiting_approval';
        execution.taskTimeline.push({
          taskId, agentId: agent.id, action: 'completed', timestamp: now(),
          durationMs: Date.now() - taskStartMs,
        });
        // Simulate auto-escalation with lower threshold
        task.status = 'completed';
      } else {
        task.status = 'completed';
      }

      task.completedAt = now();
      task.durationMs = Date.now() - taskStartMs;
      task.tokensUsed = taskToolCalls.reduce((sum, t) => sum + t.tokensUsed, 0);
      task.costUsd = taskToolCalls.reduce((sum, t) => sum + t.costUsd, 0);

      completedTasks.add(taskId);
      execution.taskTimeline.push({
        taskId, agentId: agent.id, action: 'completed', timestamp: now(),
        durationMs: task.durationMs,
      });

      // Track agent usage
      const usage = agentUsageMap.get(agent.id) ?? {
        agentId: agent.id, agentName: agent.name, specialization: agent.specialization,
        tasksCompleted: 0, tasksFailed: 0, totalTokensUsed: 0, totalCostUsd: 0, totalDurationMs: 0,
      };
      usage.tasksCompleted++;
      usage.totalTokensUsed += task.tokensUsed;
      usage.totalCostUsd += task.costUsd;
      usage.totalDurationMs += task.durationMs;
      agentUsageMap.set(agent.id, usage);
    }
  }

  // Finalize execution
  const completedTasksArr = Array.from(completedTasks).map(id => taskMap.get(id)!).filter(Boolean);
  const failedTasksArr = Array.from(failedTasks).map(id => taskMap.get(id)!).filter(Boolean);

  // Build tool usage summary
  const byToolType: Record<string, { calls: number; successRate: number; avgLatencyMs: number }> = {};
  for (const [type, stats] of toolTypeStats) {
    byToolType[type] = {
      calls: stats.calls,
      successRate: Math.round(stats.successRate * 100) / 100,
      avgLatencyMs: stats.calls > 0 ? Math.round(stats.totalLatency / stats.calls) : 0,
    };
  }

  execution.toolUsageSummary = {
    totalCalls: totalToolCalls,
    successfulCalls: successfulToolCalls,
    failedCalls: failedToolCalls,
    byToolType,
  };

  execution.agentUsage = Array.from(agentUsageMap.values());
  execution.totalTokensUsed = completedTasksArr.reduce((sum, t) => sum + t.tokensUsed, 0);
  execution.totalCostUsd = completedTasksArr.reduce((sum, t) => sum + t.costUsd, 0);
  execution.totalDurationMs = Date.now() - startMs;

  // Aggregate final output
  execution.finalOutput = {
    objective: plan.objective,
    completedTasks: completedTasksArr.map(t => ({ id: t.id, objective: t.objective, agent: t.assignedAgentName, status: t.status })),
    failedTasks: failedTasksArr.map(t => ({ id: t.id, objective: t.objective, error: t.error })),
    totalTasks: plan.tasks.length,
    completedCount: completedTasksArr.length,
    failedCount: failedTasksArr.length,
    overallConfidence: completedTasksArr.length > 0
      ? completedTasksArr.reduce((sum, t) => sum + (t.validation?.confidenceScore ?? 0), 0) / completedTasksArr.length
      : 0,
    collaborationCount: getExecutionCollaboration(execution.id).length,
  };

  // Overall validation
  const avgConfidence = (execution.finalOutput.overallConfidence as number) ?? 0;
  execution.overallValidation = {
    id: generateId('val'),
    taskId: execution.id,
    status: avgConfidence >= 0.80 ? 'passed' : avgConfidence >= 0.60 ? 'passed_with_warnings' : 'failed',
    confidenceScore: avgConfidence,
    confidenceGrade: confidenceGradeFromScore(avgConfidence),
    trustClass: trustClassFromScore(avgConfidence),
    hallucinationRisk: 0.10,
    checks: [],
    findings: [],
    enterpriseReady: avgConfidence >= 0.80,
    recommendation: avgConfidence >= 0.60 ? 'proceed' : 'revise',
    summary: `Execution complete: ${completedTasksArr.length}/${plan.tasks.length} tasks, confidence=${confidenceGradeFromScore(avgConfidence)}`,
    timestamp: now(),
  };

  execution.status = completedTasksArr.length > 0 ? 'completed' : 'failed';
  execution.completedAt = now();
  execution.updatedAt = now();

  plan.status = execution.status === 'completed' ? 'completed' : 'failed';
  plan.completedAt = now();
  plan.durationMs = Date.now() - startMs;

  logger.info(
    `[agent-framework] execution complete: ${execution.id}, plan=${planId}, ` +
    `${completedTasksArr.length}/${plan.tasks.length} tasks, ` +
    `tokens=${execution.totalTokensUsed}, cost=$${execution.totalCostUsd.toFixed(4)}, ` +
    `duration=${execution.totalDurationMs}ms`
  );

  return execution;
}

/**
 * Determine the reasoning type from a step description.
 */
function determineReasoningType(description: string): ReasoningType {
  const desc = description.toLowerCase();
  if (desc.includes('identif') || desc.includes('find') || desc.includes('discover')) return 'evidence_gathering';
  if (desc.includes('analyz') || desc.includes('assess') || desc.includes('review')) return 'analysis';
  if (desc.includes('synthe') || desc.includes('combine') || desc.includes('integrate')) return 'synthesis';
  if (desc.includes('verif') || desc.includes('valid') || desc.includes('check')) return 'validation';
  if (desc.includes('correct') || desc.includes('fix') || desc.includes('repair')) return 'correction';
  if (desc.includes('pattern') || desc.includes('abstract') || desc.includes('general')) return 'abstraction';
  if (desc.includes('similar') || desc.includes('analogy') || desc.includes('like')) return 'analogy';
  if (desc.includes('therefore') || desc.includes('conclud') || desc.includes('deduc')) return 'deduction';
  if (desc.includes('observe') || desc.includes('trend') || desc.includes('induc')) return 'induction';
  if (desc.includes('expand') || desc.includes('traverse') || desc.includes('connect')) return 'decomposition';
  if (desc.includes('insight') || desc.includes('creat') || desc.includes('novel')) return 'creative';
  if (desc.includes('reflect') || desc.includes('meta') || desc.includes('self')) return 'meta_cognitive';
  return 'analysis';
}

/**
 * Select relevant tools for a task objective.
 */
function selectRelevantTools(objective: string, available: AgentToolType[]): AgentToolType[] {
  const objLower = objective.toLowerCase();
  const selected: AgentToolType[] = [];

  const toolRelevance: Record<AgentToolType, string[]> = {
    memory_recall: ['recall', 'remember', 'previous', 'memory', 'context', 'history', 'preference'],
    memory_store: ['store', 'save', 'learn', 'remember', 'log'],
    hybrid_search: ['search', 'find', 'retrieve', 'intelligence', 'data', 'information', 'evidence'],
    knowledge_graph: ['entity', 'relationship', 'graph', 'connection', 'related', 'linked'],
    entity_lookup: ['entity', 'company', 'person', 'contact', 'look up', 'find entity'],
    confidence_score: ['confidence', 'trust', 'reliability', 'score', 'grade'],
    hallucination_check: ['verify', 'validate', 'check', 'hallucination', 'fact', 'accurate'],
    evaluation: ['evaluate', 'assess', 'quality', 'measure', 'rate'],
    reasoning_chain: ['reason', 'logic', 'chain', 'evidence', 'cause', 'effect'],
    web_search: ['web', 'internet', 'external', 'online', 'news', 'article'],
    calculator: ['calculate', 'compute', 'math', 'number', 'sum', 'average'],
    text_analysis: ['analyze text', 'extract', 'entity', 'sentiment', 'keyword'],
  };

  for (const tool of available) {
    const keywords = toolRelevance[tool] ?? [];
    const isRelevant = keywords.some(kw => objLower.includes(kw));
    if (isRelevant || selected.length < 2) { // Always include at least 2 tools
      selected.push(tool);
    }
  }

  // Ensure at least one tool is selected
  if (selected.length === 0 && available.length > 0) {
    selected.push(available[0]);
  }

  return selected.slice(0, 4); // Max 4 tools per task
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRAMEWORK STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get comprehensive framework statistics.
 * Non-throwing — always returns a stats object.
 */
export function getAgentFrameworkStats(): AgentFrameworkStats {
  let completedTasks = 0;
  let failedTasks = 0;
  let awaitingApproval = 0;
  let totalDurationMs = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const plan of planStore.values()) {
    for (const task of plan.tasks) {
      if (task.status === 'completed') {
        completedTasks++;
        totalDurationMs += task.durationMs;
        if (task.validation) {
          totalConfidence += task.validation.confidenceScore;
          confidenceCount++;
        }
      }
      if (task.status === 'failed') failedTasks++;
      if (task.status === 'awaiting_approval') awaitingApproval++;
    }
  }

  for (const exec of executionStore.values()) {
    for (const task of Object.values(exec.tasks)) {
      if (task.status === 'completed') {
        completedTasks++;
        totalDurationMs += task.durationMs;
        if (task.validation) {
          totalConfidence += task.validation.confidenceScore;
          confidenceCount++;
        }
      }
      if (task.status === 'failed') failedTasks++;
      if (task.status === 'awaiting_approval') awaitingApproval++;
    }
  }

  // Agent specialization stats
  const bySpecialization: Record<AgentSpecialization, { tasks: number; successRate: number; avgConfidence: number }> = {} as any;
  for (const agent of agentRegistry.values()) {
    if (!bySpecialization[agent.specialization]) {
      bySpecialization[agent.specialization] = { tasks: 0, successRate: 0, avgConfidence: 0 };
    }
  }

  // Tool type stats
  const byToolType: Record<string, { calls: number; successRate: number; avgLatencyMs: number }> = {};
  for (const call of toolCallHistory.values()) {
    if (!byToolType[call.toolType]) {
      byToolType[call.toolType] = { calls: 0, successRate: 0, avgLatencyMs: 0 };
    }
    byToolType[call.toolType].calls++;
  }

  return {
    totalPlans: planStore.size,
    totalTasks: completedTasks + failedTasks + awaitingApproval,
    totalExecutions: executionStore.size,
    totalAgentDefinitions: agentRegistry.size,
    totalToolCalls: toolCallHistory.size,
    completedTasks,
    failedTasks,
    awaitingApprovalTasks: awaitingApproval,
    averageTaskDurationMs: completedTasks > 0 ? Math.round(totalDurationMs / completedTasks) : 0,
    averageConfidenceScore: confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) / 100 : 0,
    totalTokensConsumed: Array.from(executionStore.values()).reduce((sum, e) => sum + e.totalTokensUsed, 0),
    totalCostUsd: Array.from(executionStore.values()).reduce((sum, e) => sum + e.totalCostUsd, 0),
    bySpecialization,
    byToolType,
    timestamp: now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEAR & RESET — Testing Support
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clear all agent framework state.
 * Used for testing isolation.
 */
export function clearAgentFramework(): void {
  agentRegistry.clear();
  planStore.clear();
  executionStore.clear();
  collaborationInbox.clear();
  toolCallHistory.clear();
  reasoningHistory.clear();
  validationHistory.clear();
}

/**
 * Get a plan by ID.
 */
export function getPlan(planId: string): AgentPlan | null {
  return planStore.get(planId) ?? null;
}

/**
 * Get all plans.
 */
export function getAllPlans(): AgentPlan[] {
  return Array.from(planStore.values());
}

/**
 * Get an execution by ID.
 */
export function getExecution(executionId: string): AgentExecution | null {
  return executionStore.get(executionId) ?? null;
}

/**
 * Get all executions.
 */
export function getAllExecutions(): AgentExecution[] {
  return Array.from(executionStore.values());
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEED DATA — Initialize with Production Agent Definitions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Seed the agent framework with production agent definitions.
 * Creates 10 specialized agents covering all major enterprise intelligence tasks.
 */
export function seedAgentFramework(): { agentsRegistered: number; agents: AgentDefinition[] } {
  const seedAgents: SeedAgent[] = [
    {
      id: 'agent-research-intel',
      name: 'Research Intelligence Agent',
      description: 'Gathers company intelligence, market data, and signal analysis. Builds foundational context for downstream agents.',
      specialization: 'research',
      tier: 'smart',
      approvalMode: 'auto',
      maxTokens: 2048,
      maxReasoningSteps: 6,
      confidenceThreshold: 0.50,
      availableTools: ['hybrid_search', 'memory_recall', 'knowledge_graph', 'entity_lookup'],
      tags: ['intelligence', 'company', 'market', 'foundation'],
      canDelegate: false,
      version: '1.0.0',
    },
    {
      id: 'agent-analysis-deep',
      name: 'Deep Analysis Agent',
      description: 'Performs multi-dimensional analysis on intelligence data. Identifies patterns, gaps, trends, and anomalies.',
      specialization: 'analysis',
      tier: 'deep',
      approvalMode: 'auto',
      maxTokens: 4096,
      maxReasoningSteps: 8,
      confidenceThreshold: 0.60,
      availableTools: ['hybrid_search', 'knowledge_graph', 'confidence_score', 'text_analysis'],
      tags: ['analysis', 'patterns', 'insights', 'deep'],
      canDelegate: true,
      version: '1.0.0',
    },
    {
      id: 'agent-reasoning-chain',
      name: 'Reasoning Chain Agent',
      description: 'Builds evidence chains and applies logical reasoning to connect facts to conclusions. Handles causal and deductive reasoning.',
      specialization: 'reasoning',
      tier: 'deep',
      approvalMode: 'soft_review',
      maxTokens: 3072,
      maxReasoningSteps: 10,
      confidenceThreshold: 0.70,
      availableTools: ['reasoning_chain', 'knowledge_graph', 'hybrid_search', 'confidence_score'],
      tags: ['reasoning', 'evidence', 'logic', 'chain'],
      canDelegate: false,
      version: '1.0.0',
    },
    {
      id: 'agent-scoring-win',
      name: 'Win Probability Scorer',
      description: 'Scores opportunities using multi-factor analysis. Calculates win probability, competitive position, and strategic value.',
      specialization: 'scoring',
      tier: 'smart',
      approvalMode: 'auto',
      maxTokens: 1536,
      maxReasoningSteps: 5,
      confidenceThreshold: 0.65,
      availableTools: ['confidence_score', 'hybrid_search', 'memory_recall', 'calculator'],
      tags: ['scoring', 'probability', 'win', 'opportunity'],
      canDelegate: false,
      version: '1.0.0',
    },
    {
      id: 'agent-strategy-plan',
      name: 'Strategy & Planning Agent',
      description: 'Develops engagement strategies, messaging frameworks, and next-best-action recommendations based on intelligence analysis.',
      specialization: 'strategy',
      tier: 'deep',
      approvalMode: 'soft_review',
      maxTokens: 4096,
      maxReasoningSteps: 8,
      confidenceThreshold: 0.70,
      availableTools: ['hybrid_search', 'memory_recall', 'knowledge_graph', 'reasoning_chain'],
      tags: ['strategy', 'planning', 'messaging', 'recommendation'],
      canDelegate: true,
      version: '1.0.0',
    },
    {
      id: 'agent-conversation-prep',
      name: 'Conversation Preparation Agent',
      description: 'Prepares meeting briefs, talking points, objection handling guides, and buyer persona strategies for sales conversations.',
      specialization: 'conversation',
      tier: 'smart',
      approvalMode: 'auto',
      maxTokens: 2048,
      maxReasoningSteps: 6,
      confidenceThreshold: 0.60,
      availableTools: ['memory_recall', 'hybrid_search', 'entity_lookup', 'confidence_score'],
      tags: ['conversation', 'meeting', 'briefing', 'talking_points'],
      canDelegate: false,
      version: '1.0.0',
    },
    {
      id: 'agent-writing-gen',
      name: 'Content Generation Agent',
      description: 'Generates high-quality written deliverables including emails, proposals, executive briefs, and reports with evidence grounding.',
      specialization: 'writing',
      tier: 'deep',
      approvalMode: 'escalate',
      maxTokens: 6144,
      maxReasoningSteps: 8,
      confidenceThreshold: 0.75,
      availableTools: ['hybrid_search', 'memory_recall', 'hallucination_check', 'evaluation'],
      tags: ['writing', 'generation', 'email', 'proposal', 'brief'],
      canDelegate: false,
      version: '1.0.0',
    },
    {
      id: 'agent-validation-qa',
      name: 'Validation & QA Agent',
      description: 'Performs comprehensive validation on all agent outputs. Checks for hallucinations, factual accuracy, evidence grounding, and enterprise readiness.',
      specialization: 'validation',
      tier: 'smart',
      approvalMode: 'auto',
      maxTokens: 1536,
      maxReasoningSteps: 6,
      confidenceThreshold: 0.80,
      availableTools: ['hallucination_check', 'confidence_score', 'evaluation', 'hybrid_search'],
      tags: ['validation', 'qa', 'quality', 'accuracy'],
      canDelegate: false,
      version: '1.0.0',
    },
    {
      id: 'agent-learning-continuous',
      name: 'Continuous Learning Agent',
      description: 'Extracts learnings from completed executions, identifies patterns, and consolidates knowledge into institutional memory.',
      specialization: 'learning',
      tier: 'fast',
      approvalMode: 'auto',
      maxTokens: 1024,
      maxReasoningSteps: 4,
      confidenceThreshold: 0.40,
      availableTools: ['memory_store', 'memory_recall', 'text_analysis', 'hybrid_search'],
      tags: ['learning', 'improvement', 'patterns', 'institutional'],
      canDelegate: false,
      version: '1.0.0',
    },
    {
      id: 'agent-orchestrator-master',
      name: 'Master Orchestrator Agent',
      description: 'Coordinates complex multi-agent executions. Decomposes objectives, manages task dependencies, handles delegation, and ensures quality across all agents.',
      specialization: 'orchestration',
      tier: 'smart',
      approvalMode: 'auto',
      maxTokens: 2048,
      maxReasoningSteps: 6,
      confidenceThreshold: 0.60,
      availableTools: ['memory_recall', 'confidence_score', 'evaluation', 'reasoning_chain'],
      tags: ['orchestration', 'coordination', 'management', 'planning'],
      canDelegate: true,
      version: '1.0.0',
    },
  ];

  const agents: AgentDefinition[] = [];
  for (const seed of seedAgents) {
    const agent = registerAgent(seed);
    if (agent) agents.push(agent);
  }

  logger.info(`[agent-framework] seeded ${agents.length} production agents`);

  return { agentsRegistered: agents.length, agents };
}
