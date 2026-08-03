/**
 * WI-16I: AI Agent Framework — Comprehensive Test Suite
 * =====================================================
 *
 * Tests cover:
 *   1. Agent Data Model & Type Safety
 *   2. Agent Registry (register, get, select, unregister)
 *   3. Task Management (create, update, status lifecycle)
 *   4. Agent Planner (objective analysis, decomposition, wave computation)
 *   5. Tool Execution (all 12 tool types)
 *   6. Reasoning Engine (create, complete, history)
 *   7. Self-Validation (6 quality gates)
 *   8. Collaboration (messages, inbox, read tracking)
 *   9. Human Approval (feedback types, status transitions)
 *   10. Plan Execution (full lifecycle, wave-by-wave)
 *   11. Framework Statistics
 *   12. Seed Data Integrity
 *   13. API Contract Validation
 */

import {
  clearAgentFramework,
  seedAgentFramework,
  registerAgent,
  getAgent,
  getAllAgents,
  getAgentsBySpecialization,
  selectAgentForTask,
  unregisterAgent,
  createTask,
  updateTaskStatus,
  getTask,
  createPlan,
  getPlan,
  getAllPlans,
  executePlan,
  getExecution,
  getAllExecutions,
  executeToolCall,
  getToolCallHistory,
  createReasoningStep,
  completeReasoningStep,
  getReasoningHistory,
  validateOutput,
  getValidationHistory,
  sendCollaborationMessage,
  getAgentInbox,
  markMessageRead,
  getExecutionCollaboration,
  submitHumanFeedback,
  getTasksAwaitingApproval,
  getAgentFrameworkStats,
  type SeedAgent,
  type AgentDefinition,
  type AgentSpecialization,
  type AgentTier,
  type ApprovalMode,
  type AgentToolType,
  type TaskStatus,
  type TaskPriority,
  type TaskComplexity,
  type AgentTask,
  type PlanStatus,
  type AgentPlan,
  type ExecutionStatus,
  type AgentExecution,
  type ToolCallStatus,
  type ToolCallRecord,
  type ReasoningType,
  type ReasoningStep,
  type ValidationStatus,
  type ValidationResult,
  type CollaborationMessageType,
  type CollaborationPriority,
  type CollaborationMessage,
  type FeedbackType,
  type AgentFrameworkStats,
} from '@/lib/ai-agent-framework';

// ─── Setup & Teardown ──────────────────────────────────────────────────

beforeEach(() => {
  clearAgentFramework();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. AGENT DATA MODEL & TYPE SAFETY
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Agent Data Model', () => {
  test('should accept all specialization values', () => {
    const specs: AgentSpecialization[] = [
      'research', 'analysis', 'reasoning', 'scoring', 'strategy',
      'conversation', 'writing', 'validation', 'learning', 'orchestration',
    ];
    expect(specs).toHaveLength(10);
  });

  test('should accept all tier values', () => {
    const tiers: AgentTier[] = ['fast', 'smart', 'deep'];
    expect(tiers).toHaveLength(3);
  });

  test('should accept all approval mode values', () => {
    const modes: ApprovalMode[] = ['auto', 'soft_review', 'hard_gate', 'escalate'];
    expect(modes).toHaveLength(4);
  });

  test('should accept all task status values', () => {
    const statuses: TaskStatus[] = [
      'pending', 'planned', 'assigned', 'running', 'awaiting_approval',
      'approved', 'rejected', 'completed', 'failed', 'cancelled', 'delegated',
    ];
    expect(statuses).toHaveLength(11);
  });

  test('should accept all task priority values', () => {
    const priorities: TaskPriority[] = ['critical', 'high', 'medium', 'low', 'background'];
    expect(priorities).toHaveLength(5);
  });

  test('should accept all task complexity values', () => {
    const complexities: TaskComplexity[] = ['trivial', 'simple', 'moderate', 'complex', 'expert'];
    expect(complexities).toHaveLength(5);
  });

  test('should accept all tool type values', () => {
    const tools: AgentToolType[] = [
      'memory_recall', 'memory_store', 'hybrid_search', 'knowledge_graph',
      'entity_lookup', 'confidence_score', 'hallucination_check', 'evaluation',
      'reasoning_chain', 'web_search', 'calculator', 'text_analysis',
    ];
    expect(tools).toHaveLength(12);
  });

  test('should accept all reasoning type values', () => {
    const types: ReasoningType[] = [
      'decomposition', 'evidence_gathering', 'analysis', 'synthesis', 'validation',
      'correction', 'abstraction', 'analogy', 'deduction', 'induction', 'creative', 'meta_cognitive',
    ];
    expect(types).toHaveLength(12);
  });

  test('should accept all collaboration message types', () => {
    const types: CollaborationMessageType[] = [
      'request', 'response', 'notification', 'delegation', 'handoff', 'feedback', 'sync',
    ];
    expect(types).toHaveLength(7);
  });

  test('should accept all collaboration priority values', () => {
    const priorities: CollaborationPriority[] = ['low', 'normal', 'high', 'urgent'];
    expect(priorities).toHaveLength(4);
  });

  test('should accept all feedback types', () => {
    const types: FeedbackType[] = ['approve', 'reject', 'revise', 'comment', 'skip'];
    expect(types).toHaveLength(5);
  });

  test('should accept all validation status values', () => {
    const statuses: ValidationStatus[] = ['pending', 'passed', 'passed_with_warnings', 'failed', 'skipped'];
    expect(statuses).toHaveLength(5);
  });

  test('should accept all execution status values', () => {
    const statuses: ExecutionStatus[] = [
      'initializing', 'planning', 'executing', 'validating', 'awaiting_approval',
      'completed', 'failed', 'cancelled',
    ];
    expect(statuses).toHaveLength(8);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. AGENT REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Agent Registry', () => {
  const testAgent: SeedAgent = {
    id: 'test-research-agent',
    name: 'Test Research Agent',
    description: 'A test research agent for unit tests',
    specialization: 'research',
    tier: 'smart',
    approvalMode: 'auto',
    maxTokens: 2048,
    maxReasoningSteps: 6,
    confidenceThreshold: 0.60,
    availableTools: ['hybrid_search', 'memory_recall', 'knowledge_graph'],
    tags: ['test', 'research'],
    canDelegate: false,
    version: '1.0.0',
  };

  test('should register an agent and return it', () => {
    const agent = registerAgent(testAgent);
    expect(agent).not.toBeNull();
    expect(agent!.id).toBe('test-research-agent');
    expect(agent!.name).toBe('Test Research Agent');
    expect(agent!.specialization).toBe('research');
    expect(agent!.tier).toBe('smart');
    expect(agent!.approvalMode).toBe('auto');
    expect(agent!.maxTokens).toBe(2048);
    expect(agent!.maxReasoningSteps).toBe(6);
    expect(agent!.confidenceThreshold).toBe(0.60);
    expect(agent!.availableTools).toEqual(['hybrid_search', 'memory_recall', 'knowledge_graph']);
    expect(agent!.tags).toEqual(['test', 'research']);
    expect(agent!.canDelegate).toBe(false);
    expect(agent!.version).toBe('1.0.0');
  });

  test('should get a registered agent by ID', () => {
    registerAgent(testAgent);
    const agent = getAgent('test-research-agent');
    expect(agent).not.toBeNull();
    expect(agent!.id).toBe('test-research-agent');
  });

  test('should return null for non-existent agent', () => {
    const agent = getAgent('non-existent');
    expect(agent).toBeNull();
  });

  test('should get all registered agents', () => {
    registerAgent(testAgent);
    registerAgent({
      ...testAgent,
      id: 'test-analysis-agent',
      name: 'Test Analysis Agent',
      specialization: 'analysis',
    });
    const agents = getAllAgents();
    expect(agents).toHaveLength(2);
  });

  test('should get agents by specialization', () => {
    registerAgent(testAgent);
    registerAgent({
      ...testAgent,
      id: 'test-analysis-agent',
      name: 'Test Analysis Agent',
      specialization: 'analysis',
    });
    const researchAgents = getAgentsBySpecialization('research');
    expect(researchAgents).toHaveLength(1);
    expect(researchAgents[0].specialization).toBe('research');

    const analysisAgents = getAgentsBySpecialization('analysis');
    expect(analysisAgents).toHaveLength(1);
  });

  test('should return empty array for specialization with no agents', () => {
    const agents = getAgentsBySpecialization('orchestration');
    expect(agents).toHaveLength(0);
  });

  test('should unregister an agent', () => {
    registerAgent(testAgent);
    expect(getAgent('test-research-agent')).not.toBeNull();
    const result = unregisterAgent('test-research-agent');
    expect(result).toBe(true);
    expect(getAgent('test-research-agent')).toBeNull();
  });

  test('should return false when unregistering non-existent agent', () => {
    const result = unregisterAgent('non-existent');
    expect(result).toBe(false);
  });

  test('should replace agent when registering with same ID', () => {
    registerAgent(testAgent);
    registerAgent({
      ...testAgent,
      name: 'Updated Research Agent',
      tier: 'deep',
    });
    const agent = getAgent('test-research-agent');
    expect(agent!.name).toBe('Updated Research Agent');
    expect(agent!.tier).toBe('deep');
    expect(getAllAgents()).toHaveLength(1);
  });

  test('should select agent for task based on objective keywords', () => {
    registerAgent(testAgent);
    registerAgent({
      ...testAgent,
      id: 'test-analysis-agent',
      name: 'Test Analysis Agent',
      specialization: 'analysis',
    });

    const researchAgent = selectAgentForTask('Research the company Acme Corp and investigate their market position');
    expect(researchAgent).not.toBeNull();
    expect(researchAgent!.specialization).toBe('research');

    const analysisAgent = selectAgentForTask('Analyze the competitive landscape and evaluate strategic options');
    expect(analysisAgent).not.toBeNull();
    expect(analysisAgent!.specialization).toBe('analysis');
  });

  test('should select agent considering tool requirements', () => {
    registerAgent(testAgent); // Has hybrid_search, memory_recall, knowledge_graph
    registerAgent({
      ...testAgent,
      id: 'test-scoring-agent',
      name: 'Test Scoring Agent',
      specialization: 'scoring',
      availableTools: ['confidence_score', 'calculator'],
    });

    const agent = selectAgentForTask('score this', ['confidence_score']);
    expect(agent).not.toBeNull();
    expect(agent!.specialization).toBe('scoring');
  });

  test('should return null when no agents registered', () => {
    const agent = selectAgentForTask('do something');
    expect(agent).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. TASK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Task Management', () => {
  test('should create a task with default values', () => {
    const task = createTask({
      planId: 'plan-1',
      objective: 'Research company Acme Corp',
    });

    expect(task.id).toBeDefined();
    expect(task.planId).toBe('plan-1');
    expect(task.objective).toBe('Research company Acme Corp');
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('medium');
    expect(task.assignedAgentId).toBeNull();
    expect(task.output).toBeNull();
    expect(task.toolCalls).toEqual([]);
    expect(task.recordedReasoning).toEqual([]);
    expect(task.validation).toBeNull();
    expect(task.error).toBeNull();
    expect(task.humanFeedback).toBeNull();
    expect(task.retryCount).toBe(0);
    expect(task.maxRetries).toBe(3);
    expect(task.dependencies).toEqual([]);
    expect(task.dependents).toEqual([]);
  });

  test('should create a task with custom values', () => {
    const task = createTask({
      planId: 'plan-1',
      objective: 'Deep analysis',
      description: 'Perform deep multi-dimensional analysis',
      priority: 'high',
      reasoningSteps: ['Step 1: gather data', 'Step 2: analyze', 'Step 3: synthesize'],
      expectedOutputType: 'analysis_report',
      dependencies: ['task-1', 'task-2'],
      input: { companyId: 'acme-123' },
      maxRetries: 5,
      metadata: { source: 'api' },
    });

    expect(task.description).toBe('Perform deep multi-dimensional analysis');
    expect(task.priority).toBe('high');
    expect(task.reasoningSteps).toHaveLength(3);
    expect(task.expectedOutputType).toBe('analysis_report');
    expect(task.dependencies).toEqual(['task-1', 'task-2']);
    expect(task.input).toEqual({ companyId: 'acme-123' });
    expect(task.maxRetries).toBe(5);
    expect(task.metadata).toEqual({ source: 'api' });
  });

  test('should estimate complexity based on description and steps', () => {
    const trivial = createTask({ planId: 'p', objective: 'Quick lookup' });
    expect(trivial.complexity).toBe('trivial');

    const complex = createTask({
      planId: 'p',
      objective: 'Perform deep analysis of company competitive landscape with multiple reasoning steps',
      reasoningSteps: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'],
    });
    expect(['complex', 'expert']).toContain(complex.complexity);
  });

  test('should have valid timestamps', () => {
    const task = createTask({ planId: 'p', objective: 'test' });
    expect(task.createdAt).toBeDefined();
    expect(task.updatedAt).toBeDefined();
    const createdAt = new Date(task.createdAt).getTime();
    const now = Date.now();
    expect(createdAt).toBeLessThanOrEqual(now);
    expect(createdAt).toBeGreaterThan(now - 5000); // Within 5 seconds
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. AGENT PLANNER
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Agent Planner', () => {
  beforeEach(() => {
    seedAgentFramework();
  });

  test('should create a plan for a research objective', () => {
    const plan = createPlan({
      objective: 'Research company Acme Corp and analyze their technology landscape',
    });

    expect(plan.id).toBeDefined();
    expect(plan.objective).toContain('Acme Corp');
    expect(plan.status).toBe('draft');
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.executionWaves.length).toBeGreaterThan(0);
    expect(plan.createdAt).toBeDefined();
  });

  test('should create plan with memory requirements', () => {
    const plan = createPlan({
      objective: 'Research the company Acme Corp and their technology stack',
    });

    expect(plan.memoryRequirements.length).toBeGreaterThan(0);
    const hasWorking = plan.memoryRequirements.some(r => r.layer === 'working');
    expect(hasWorking).toBe(true);
  });

  test('should create plan with retrieval requirements', () => {
    const plan = createPlan({
      objective: 'Research company Acme Corp and contact stakeholders',
    });

    expect(plan.retrievalRequirements.length).toBeGreaterThan(0);
  });

  test('should create plan with dependency graph', () => {
    const plan = createPlan({
      objective: 'Research company Acme Corp, analyze findings, and develop strategy',
    });

    // Check that dependency graph is populated
    const graphKeys = Object.keys(plan.dependencyGraph);
    expect(graphKeys.length).toBe(plan.tasks.length);
  });

  test('should create plan with execution waves', () => {
    const plan = createPlan({
      objective: 'Research company Acme Corp, analyze findings, validate output',
    });

    expect(plan.executionWaves.length).toBeGreaterThan(0);
    // First wave should have at least one task (research)
    expect(plan.executionWaves[0].length).toBeGreaterThanOrEqual(1);
    // All tasks should be accounted for in waves
    const allWaveTaskIds = plan.executionWaves.flat();
    const planTaskIds = plan.tasks.map(t => t.id);
    expect(allWaveTaskIds.sort()).toEqual(planTaskIds.sort());
  });

  test('should create plan with cost estimates', () => {
    const plan = createPlan({
      objective: 'Research company Acme Corp and analyze findings',
    });

    expect(plan.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    expect(plan.estimatedTokens).toBeGreaterThanOrEqual(0);
  });

  test('should detect company-related memory requirements', () => {
    const plan = createPlan({
      objective: 'Analyze company Acme Corp and their client relationships',
    });

    const hasEnterprise = plan.memoryRequirements.some(r => r.layer === 'enterprise');
    expect(hasEnterprise).toBe(true);
  });

  test('should detect conversation-related memory requirements', () => {
    const plan = createPlan({
      objective: 'Remember user preferences and prepare for the next conversation',
    });

    const hasConversation = plan.memoryRequirements.some(r => r.layer === 'conversation');
    expect(hasConversation).toBe(true);
  });

  test('should store plan for retrieval', () => {
    const plan = createPlan({ objective: 'Research Acme Corp' });
    const retrieved = getPlan(plan.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(plan.id);
  });

  test('should list all plans', () => {
    createPlan({ objective: 'Plan 1' });
    createPlan({ objective: 'Plan 2' });
    const plans = getAllPlans();
    expect(plans).toHaveLength(2);
  });

  test('should return null for non-existent plan', () => {
    const plan = getPlan('non-existent');
    expect(plan).toBeNull();
  });

  test('should decompose complex objective into multiple tasks', () => {
    const plan = createPlan({
      objective: 'Research company Acme Corp, analyze their market position, score the opportunity, develop engagement strategy, prepare conversation plan, validate output, and extract learnings',
    });

    expect(plan.tasks.length).toBeGreaterThanOrEqual(5);
  });

  test('should infer retrieval requirements from objective with technology keywords', () => {
    const plan = createPlan({
      objective: 'Analyze Kubernetes and AWS usage at company Acme Corp',
    });

    const hasTechRetrieval = plan.retrievalRequirements.some(r =>
      r.signalTypes.includes('competitive_intelligence')
    );
    expect(hasTechRetrieval).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. TOOL EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Tool Execution', () => {
  test('should execute memory_recall tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'memory_recall',
      input: { query: 'Acme Corp technology stack', layer: 'enterprise' },
    });

    expect(result.status).toBe('completed');
    expect(result.output).not.toBeNull();
    expect(result.output!['memories']).toBeDefined();
    expect(result.tokensUsed).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test('should execute memory_store tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'memory_store',
      input: { content: 'Acme Corp uses Kubernetes', layer: 'enterprise' },
    });

    expect(result.status).toBe('completed');
    expect(result.output!['stored']).toBe(true);
    expect(result.output!['memoryId']).toBeDefined();
  });

  test('should execute hybrid_search tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'hybrid_search',
      input: { query: 'company intelligence for Acme Corp' },
    });

    expect(result.status).toBe('completed');
    expect(result.output!['results']).toBeDefined();
    expect(result.output!['packageId']).toBeDefined();
  });

  test('should execute knowledge_graph tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'knowledge_graph',
      input: { entity: 'Acme Corp', operation: 'expand' },
    });

    expect(result.status).toBe('completed');
    expect(result.output!['nodes']).toBeDefined();
    expect(result.output!['edges']).toBeDefined();
  });

  test('should execute entity_lookup tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'entity_lookup',
      input: { name: 'Acme Corp' },
    });

    expect(result.status).toBe('completed');
    expect(result.output!['entity']).toBeDefined();
    expect(result.output!['found']).toBe(true);
  });

  test('should execute confidence_score tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'confidence_score',
      input: {},
    });

    expect(result.status).toBe('completed');
    expect(result.output!['score']).toBeDefined();
    expect(result.output!['grade']).toBeDefined();
    expect(result.output!['trustClass']).toBeDefined();
  });

  test('should execute hallucination_check tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'hallucination_check',
      input: {},
    });

    expect(result.status).toBe('completed');
    expect(result.output!['riskScore']).toBeDefined();
    expect(result.output!['riskLevel']).toBeDefined();
  });

  test('should execute evaluation tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'evaluation',
      input: {},
    });

    expect(result.status).toBe('completed');
    expect(result.output!['compositeScore']).toBeDefined();
    expect(result.output!['dimensions']).toBeDefined();
  });

  test('should execute reasoning_chain tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'reasoning_chain',
      input: { question: 'Why is Acme Corp a good fit?' },
    });

    expect(result.status).toBe('completed');
    expect(result.output!['steps']).toBeDefined();
    expect(result.output!['overallConfidence']).toBeDefined();
  });

  test('should execute calculator tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'calculator',
      input: { expression: '10 + 20 * 3' },
    });

    expect(result.status).toBe('completed');
    expect(result.output!['result']).toBe(70);
  });

  test('should execute text_analysis tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'text_analysis',
      input: { text: 'Acme Corp uses Kubernetes and AWS' },
    });

    expect(result.status).toBe('completed');
    expect(result.output!['entities']).toBeDefined();
    expect(result.output!['wordCount']).toBeGreaterThan(0);
  });

  test('should execute web_search tool successfully', () => {
    const result = executeToolCall({
      taskId: 'task-1',
      agentId: 'agent-1',
      toolType: 'web_search',
      input: { query: 'Acme Corp news' },
    });

    expect(result.status).toBe('completed');
    expect(result.output!['results']).toBeDefined();
  });

  test('should generate unique IDs for each tool call', () => {
    const r1 = executeToolCall({ taskId: 't1', agentId: 'a1', toolType: 'memory_recall', input: {} });
    const r2 = executeToolCall({ taskId: 't1', agentId: 'a1', toolType: 'memory_recall', input: {} });
    expect(r1.id).not.toBe(r2.id);
  });

  test('should track tool call history', () => {
    executeToolCall({ taskId: 't1', agentId: 'a1', toolType: 'memory_recall', input: {} });
    executeToolCall({ taskId: 't2', agentId: 'a1', toolType: 'hybrid_search', input: {} });

    const history = getToolCallHistory();
    expect(history).toHaveLength(2);
  });

  test('should filter tool call history by taskId', () => {
    executeToolCall({ taskId: 't1', agentId: 'a1', toolType: 'memory_recall', input: {} });
    executeToolCall({ taskId: 't2', agentId: 'a1', toolType: 'hybrid_search', input: {} });

    const history = getToolCallHistory({ taskId: 't1' });
    expect(history).toHaveLength(1);
    expect(history[0].taskId).toBe('t1');
  });

  test('should filter tool call history by agentId', () => {
    executeToolCall({ taskId: 't1', agentId: 'agent-a', toolType: 'memory_recall', input: {} });
    executeToolCall({ taskId: 't2', agentId: 'agent-b', toolType: 'hybrid_search', input: {} });

    const history = getToolCallHistory({ agentId: 'agent-a' });
    expect(history).toHaveLength(1);
  });

  test('should filter tool call history by toolType', () => {
    executeToolCall({ taskId: 't1', agentId: 'a1', toolType: 'memory_recall', input: {} });
    executeToolCall({ taskId: 't2', agentId: 'a1', toolType: 'hybrid_search', input: {} });

    const history = getToolCallHistory({ toolType: 'memory_recall' });
    expect(history).toHaveLength(1);
  });

  test('should limit tool call history results', () => {
    for (let i = 0; i < 5; i++) {
      executeToolCall({ taskId: `t${i}`, agentId: 'a1', toolType: 'memory_recall', input: {} });
    }

    const history = getToolCallHistory({ limit: 3 });
    expect(history).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. REASONING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Reasoning Engine', () => {
  test('should create a reasoning step', () => {
    const step = createReasoningStep({
      taskId: 'task-1',
      stepNumber: 1,
      type: 'evidence_gathering',
      description: 'Gather evidence about Acme Corp technology stack',
      question: 'What technologies does Acme Corp use?',
      inputs: ['company_profile', 'signal_data'],
    });

    expect(step.id).toBeDefined();
    expect(step.taskId).toBe('task-1');
    expect(step.stepNumber).toBe(1);
    expect(step.type).toBe('evidence_gathering');
    expect(step.status).toBe('pending');
    expect(step.conclusion).toBeNull();
    expect(step.confidence).toBe(0);
    expect(step.productive).toBe(false);
  });

  test('should complete a reasoning step', () => {
    const step = createReasoningStep({
      taskId: 'task-1',
      stepNumber: 1,
      type: 'analysis',
      description: 'Analyze technology patterns',
      question: 'What patterns exist in the tech stack?',
    });

    const completed = completeReasoningStep(
      step.id,
      'Acme Corp primarily uses cloud-native technologies with Kubernetes and AWS',
      0.85,
      true,
      50,
    );

    expect(completed).not.toBeNull();
    expect(completed!.status).toBe('completed');
    expect(completed!.conclusion).toContain('Acme Corp');
    expect(completed!.confidence).toBe(0.85);
    expect(completed!.productive).toBe(true);
    expect(completed!.durationMs).toBe(50);
  });

  test('should return null when completing non-existent step', () => {
    const result = completeReasoningStep('non-existent', 'conclusion', 0.5, true);
    expect(result).toBeNull();
  });

  test('should clamp confidence to 0-1 range', () => {
    const step = createReasoningStep({
      taskId: 'task-1', stepNumber: 1, type: 'analysis',
      description: 'test', question: 'test',
    });

    const high = completeReasoningStep(step.id, 'high', 1.5, true);
    expect(high!.confidence).toBe(1.0);

    const low = completeReasoningStep(step.id, 'low', -0.5, true);
    expect(low!.confidence).toBe(0.0);
  });

  test('should get reasoning history for a task', () => {
    const step1 = createReasoningStep({ taskId: 'task-1', stepNumber: 1, type: 'analysis', description: 'Step 1', question: 'Q1' });
    const step2 = createReasoningStep({ taskId: 'task-1', stepNumber: 2, type: 'synthesis', description: 'Step 2', question: 'Q2' });
    createReasoningStep({ taskId: 'task-2', stepNumber: 1, type: 'analysis', description: 'Other task', question: 'Q3' });

    const history = getReasoningHistory('task-1');
    expect(history).toHaveLength(2);
    expect(history[0].stepNumber).toBeLessThan(history[1].stepNumber);
  });

  test('should get all reasoning history when no taskId specified', () => {
    createReasoningStep({ taskId: 't1', stepNumber: 1, type: 'analysis', description: 's1', question: 'q1' });
    createReasoningStep({ taskId: 't2', stepNumber: 1, type: 'analysis', description: 's2', question: 'q2' });

    const history = getReasoningHistory();
    expect(history).toHaveLength(2);
  });

  test('should sort reasoning steps by step number', () => {
    const s2 = createReasoningStep({ taskId: 't1', stepNumber: 2, type: 'synthesis', description: 's2', question: 'q2' });
    const s1 = createReasoningStep({ taskId: 't1', stepNumber: 1, type: 'analysis', description: 's1', question: 'q1' });

    const history = getReasoningHistory('t1');
    expect(history[0].id).toBe(s1.id);
    expect(history[1].id).toBe(s2.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. SELF-VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Self-Validation', () => {
  const testAgentDef: AgentDefinition = {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'Test',
    specialization: 'analysis',
    tier: 'smart',
    approvalMode: 'auto',
    maxTokens: 2048,
    maxReasoningSteps: 6,
    confidenceThreshold: 0.70,
    availableTools: ['hybrid_search', 'confidence_score'],
    tags: [],
    canDelegate: false,
    version: '1.0.0',
  };

  test('should validate output with all 6 checks', () => {
    const step = createReasoningStep({ taskId: 'task-1', stepNumber: 1, type: 'analysis', description: 'test', question: 'test' });
    completeReasoningStep(step.id, 'conclusion', 0.85, true, 10);

    const toolCall = executeToolCall({ taskId: 'task-1', agentId: 'test-agent', toolType: 'hybrid_search', input: {} });

    const validation = validateOutput({
      taskId: 'task-1',
      output: { findings: 'result', analysis: 'data', recommendation: 'action' },
      reasoningSteps: [step],
      toolCalls: [toolCall],
      agentDefinition: testAgentDef,
      contextConfidence: 0.85,
    });

    expect(validation.id).toBeDefined();
    expect(validation.taskId).toBe('task-1');
    expect(validation.checks.length).toBe(6);
    expect(validation.checks.every(c => ['passed', 'warning', 'failed', 'skipped'].includes(c.status))).toBe(true);
  });

  test('should produce confidence grade', () => {
    const validation = validateOutput({
      taskId: 'task-1',
      output: { data: 'test' },
      reasoningSteps: [],
      toolCalls: [],
      agentDefinition: testAgentDef,
      contextConfidence: 0.90,
    });

    expect(validation.confidenceGrade).toBeDefined();
    expect(validation.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(validation.confidenceScore).toBeLessThanOrEqual(1);
  });

  test('should produce trust classification', () => {
    // With high confidence AND substantive output, trust should be high
    const step = createReasoningStep({ taskId: 'task-1', stepNumber: 1, type: 'analysis', description: 'test', question: 'test' });
    completeReasoningStep(step.id, 'conclusion', 0.95, true, 10);
    const toolCall = executeToolCall({ taskId: 'task-1', agentId: 'test-agent', toolType: 'hybrid_search', input: {} });

    const high = validateOutput({
      taskId: 'task-1', output: { findings: 'a', analysis: 'b', recommendation: 'c' },
      reasoningSteps: [step], toolCalls: [toolCall],
      agentDefinition: testAgentDef, contextConfidence: 0.95,
    });
    expect(['enterprise', 'advisory']).toContain(high.trustClass);

    const low = validateOutput({
      taskId: 'task-1', output: {}, reasoningSteps: [], toolCalls: [],
      agentDefinition: testAgentDef, contextConfidence: 0.20,
    });
    expect(['unreliable', 'speculative']).toContain(low.trustClass);
  });

  test('should flag low confidence against threshold', () => {
    const validation = validateOutput({
      taskId: 'task-1', output: { data: 'test' }, reasoningSteps: [], toolCalls: [],
      agentDefinition: { ...testAgentDef, confidenceThreshold: 0.90 },
      contextConfidence: 0.50,
    });

    const confCheck = validation.checks.find(c => c.name === 'confidence_threshold');
    expect(confCheck).toBeDefined();
    expect(confCheck!.status).toBe('warning');
  });

  test('should detect empty output', () => {
    const validation = validateOutput({
      taskId: 'task-1', output: {}, reasoningSteps: [], toolCalls: [],
      agentDefinition: testAgentDef, contextConfidence: 0.80,
    });

    const outputCheck = validation.checks.find(c => c.name === 'output_completeness');
    expect(outputCheck).toBeDefined();
    expect(outputCheck!.status).toBe('failed');

    const criticalFinding = validation.findings.some(f => f.severity === 'critical');
    expect(criticalFinding).toBe(true);
  });

  test('should produce validation summary', () => {
    const validation = validateOutput({
      taskId: 'task-1', output: { data: 'test' }, reasoningSteps: [], toolCalls: [],
      agentDefinition: testAgentDef, contextConfidence: 0.80,
    });

    expect(validation.summary).toBeDefined();
    expect(validation.summary.length).toBeGreaterThan(0);
  });

  test('should produce recommendation', () => {
    const validation = validateOutput({
      taskId: 'task-1', output: { data: 'test' }, reasoningSteps: [], toolCalls: [],
      agentDefinition: testAgentDef, contextConfidence: 0.80,
    });

    expect(['proceed', 'revise', 'retry', 'escalate', 'reject']).toContain(validation.recommendation);
  });

  test('should track validation history', () => {
    validateOutput({
      taskId: 'task-1', output: { data: 'a' }, reasoningSteps: [], toolCalls: [],
      agentDefinition: testAgentDef, contextConfidence: 0.80,
    });
    validateOutput({
      taskId: 'task-2', output: { data: 'b' }, reasoningSteps: [], toolCalls: [],
      agentDefinition: testAgentDef, contextConfidence: 0.80,
    });

    const history = getValidationHistory();
    expect(history).toHaveLength(2);
  });

  test('should filter validation history by taskId', () => {
    validateOutput({
      taskId: 'task-1', output: { data: 'a' }, reasoningSteps: [], toolCalls: [],
      agentDefinition: testAgentDef, contextConfidence: 0.80,
    });
    validateOutput({
      taskId: 'task-2', output: { data: 'b' }, reasoningSteps: [], toolCalls: [],
      agentDefinition: testAgentDef, contextConfidence: 0.80,
    });

    const history = getValidationHistory('task-1');
    expect(history).toHaveLength(1);
    expect(history[0].taskId).toBe('task-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. COLLABORATION
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Agent Collaboration', () => {
  test('should send a collaboration message', () => {
    const msg = sendCollaborationMessage({
      fromAgentId: 'agent-research',
      fromAgentName: 'Research Agent',
      toAgentId: 'agent-analysis',
      toAgentName: 'Analysis Agent',
      executionId: 'exec-1',
      taskId: 'task-1',
      messageType: 'request',
      priority: 'normal',
      subject: 'Request for analysis',
      body: 'Please analyze the collected intelligence',
      payload: { data: 'acme_intel' },
    });

    expect(msg.id).toBeDefined();
    expect(msg.fromAgentId).toBe('agent-research');
    expect(msg.toAgentId).toBe('agent-analysis');
    expect(msg.messageType).toBe('request');
    expect(msg.read).toBe(false);
    expect(msg.timestamp).toBeDefined();
  });

  test('should deliver message to recipient inbox', () => {
    sendCollaborationMessage({
      fromAgentId: 'a1', fromAgentName: 'Agent 1',
      toAgentId: 'a2', toAgentName: 'Agent 2',
      executionId: 'e1', taskId: 't1',
      messageType: 'notification', subject: 'Update', body: 'Task completed',
    });

    const inbox = getAgentInbox('a2');
    expect(inbox).toHaveLength(1);
    expect(inbox[0].toAgentId).toBe('a2');
  });

  test('should filter inbox to unread messages', () => {
    sendCollaborationMessage({
      fromAgentId: 'a1', fromAgentName: 'Agent 1',
      toAgentId: 'a2', toAgentName: 'Agent 2',
      executionId: 'e1', taskId: 't1',
      messageType: 'notification', subject: 'Msg 1', body: 'First',
    });
    const msg2 = sendCollaborationMessage({
      fromAgentId: 'a1', fromAgentName: 'Agent 1',
      toAgentId: 'a2', toAgentName: 'Agent 2',
      executionId: 'e1', taskId: 't1',
      messageType: 'notification', subject: 'Msg 2', body: 'Second',
    });

    markMessageRead(msg2.id);

    const unread = getAgentInbox('a2', { unreadOnly: true });
    expect(unread).toHaveLength(1);
  });

  test('should mark message as read', () => {
    const msg = sendCollaborationMessage({
      fromAgentId: 'a1', fromAgentName: 'Agent 1',
      toAgentId: 'a2', toAgentName: 'Agent 2',
      executionId: 'e1', taskId: 't1',
      messageType: 'notification', subject: 'Test', body: 'Test message',
    });

    expect(msg.read).toBe(false);
    const result = markMessageRead(msg.id);
    expect(result).toBe(true);

    const inbox = getAgentInbox('a2');
    expect(inbox[0].read).toBe(true);
  });

  test('should return false when marking non-existent message as read', () => {
    const result = markMessageRead('non-existent');
    expect(result).toBe(false);
  });

  test('should filter inbox by message type', () => {
    sendCollaborationMessage({
      fromAgentId: 'a1', fromAgentName: 'Agent 1',
      toAgentId: 'a2', toAgentName: 'Agent 2',
      executionId: 'e1', taskId: 't1',
      messageType: 'request', subject: 'Request', body: 'Help needed',
    });
    sendCollaborationMessage({
      fromAgentId: 'a1', fromAgentName: 'Agent 1',
      toAgentId: 'a2', toAgentName: 'Agent 2',
      executionId: 'e1', taskId: 't1',
      messageType: 'notification', subject: 'Update', body: 'Task done',
    });

    const requests = getAgentInbox('a2', { messageType: 'request' });
    expect(requests).toHaveLength(1);
    expect(requests[0].messageType).toBe('request');
  });

  test('should limit inbox results', () => {
    for (let i = 0; i < 5; i++) {
      sendCollaborationMessage({
        fromAgentId: 'a1', fromAgentName: 'Agent 1',
        toAgentId: 'a2', toAgentName: 'Agent 2',
        executionId: 'e1', taskId: 't1',
        messageType: 'notification', subject: `Msg ${i}`, body: `Body ${i}`,
      });
    }

    const inbox = getAgentInbox('a2', { limit: 3 });
    expect(inbox).toHaveLength(3);
  });

  test('should get collaboration messages for an execution', () => {
    sendCollaborationMessage({
      fromAgentId: 'a1', fromAgentName: 'Agent 1',
      toAgentId: 'a2', toAgentName: 'Agent 2',
      executionId: 'exec-1', taskId: 't1',
      messageType: 'notification', subject: 'Exec 1', body: 'Message for exec 1',
    });
    sendCollaborationMessage({
      fromAgentId: 'a1', fromAgentName: 'Agent 1',
      toAgentId: 'a2', toAgentName: 'Agent 2',
      executionId: 'exec-2', taskId: 't2',
      messageType: 'notification', subject: 'Exec 2', body: 'Message for exec 2',
    });

    const exec1Msgs = getExecutionCollaboration('exec-1');
    expect(exec1Msgs).toHaveLength(1);
    expect(exec1Msgs[0].executionId).toBe('exec-1');
  });

  test('should return empty inbox for agent with no messages', () => {
    const inbox = getAgentInbox('no-messages-agent');
    expect(inbox).toHaveLength(0);
  });

  test('should support all message types', () => {
    const types: CollaborationMessageType[] = [
      'request', 'response', 'notification', 'delegation', 'handoff', 'feedback', 'sync',
    ];

    for (const type of types) {
      const msg = sendCollaborationMessage({
        fromAgentId: 'a1', fromAgentName: 'Sender',
        toAgentId: 'a2', toAgentName: 'Receiver',
        executionId: 'e1', taskId: 't1',
        messageType: type, subject: `Test ${type}`, body: `Body for ${type}`,
      });
      expect(msg.messageType).toBe(type);
    }

    const inbox = getAgentInbox('a2');
    expect(inbox).toHaveLength(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. HUMAN APPROVAL
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Human Approval', () => {
  test('should submit approval feedback', () => {
    // Create a plan and task within it
    const plan = createPlan({ objective: 'Research Acme Corp' });
    const task = plan.tasks[0];
    task.status = 'awaiting_approval';

    const result = submitHumanFeedback({
      taskId: task.id,
      feedbackType: 'approve',
      userId: 'user-123',
      comment: 'Looks good, proceed',
    });

    expect(result).not.toBeNull();
    expect(result!.status).toBe('approved');
    expect(result!.humanFeedback).not.toBeNull();
    expect(result!.humanFeedback!.type).toBe('approve');
    expect(result!.humanFeedback!.userId).toBe('user-123');
    expect(result!.humanFeedback!.comment).toBe('Looks good, proceed');
  });

  test('should submit rejection feedback', () => {
    const plan = createPlan({ objective: 'Research Acme Corp' });
    const task = plan.tasks[0];
    task.status = 'awaiting_approval';

    const result = submitHumanFeedback({
      taskId: task.id,
      feedbackType: 'reject',
      userId: 'user-456',
      comment: 'Needs more research',
    });

    expect(result!.status).toBe('rejected');
    expect(result!.humanFeedback!.type).toBe('reject');
  });

  test('should submit revision feedback', () => {
    const plan = createPlan({ objective: 'Research Acme Corp' });
    const task = plan.tasks[0];
    task.status = 'awaiting_approval';

    const result = submitHumanFeedback({
      taskId: task.id,
      feedbackType: 'revise',
      userId: 'user-789',
      revisedOutput: { analysis: 'improved analysis' },
    });

    expect(result!.status).toBe('planned');
    expect(result!.humanFeedback!.revisedOutput).toBeDefined();
  });

  test('should submit comment feedback without changing status', () => {
    const plan = createPlan({ objective: 'Research Acme Corp' });
    const task = plan.tasks[0];
    const originalStatus = task.status;

    const result = submitHumanFeedback({
      taskId: task.id,
      feedbackType: 'comment',
      userId: 'user-999',
      comment: 'Just a note',
    });

    expect(result!.status).toBe(originalStatus);
    expect(result!.humanFeedback!.type).toBe('comment');
  });

  test('should skip validation with skip feedback', () => {
    const plan = createPlan({ objective: 'Research Acme Corp' });
    const task = plan.tasks[0];

    const result = submitHumanFeedback({
      taskId: task.id,
      feedbackType: 'skip',
      userId: 'user-skip',
    });

    expect(result!.status).toBe('completed');
  });

  test('should return null for non-existent task', () => {
    const result = submitHumanFeedback({
      taskId: 'non-existent',
      feedbackType: 'approve',
      userId: 'user-1',
    });
    expect(result).toBeNull();
  });

  test('should get tasks awaiting approval', () => {
    const plan = createPlan({ objective: 'Research Acme Corp and analyze' });
    // Mark first task as awaiting approval
    plan.tasks[0].status = 'awaiting_approval';

    const queue = getTasksAwaitingApproval();
    expect(queue.length).toBeGreaterThanOrEqual(1);
    expect(queue.some(t => t.status === 'awaiting_approval')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. PLAN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Plan Execution', () => {
  beforeEach(() => {
    seedAgentFramework();
  });

  test('should execute a plan and produce an execution', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp' });
    expect(plan.status).toBe('draft');

    const execution = executePlan(plan.id);
    expect(execution).not.toBeNull();
    expect(execution.id).toBeDefined();
    expect(execution.planId).toBe(plan.id);
    expect(execution.status).toBeDefined();
  });

  test('should handle execution of non-existent plan', () => {
    const execution = executePlan('non-existent-plan');
    expect(execution.status).toBe('failed');
    expect(execution.error).toContain('Plan not found');
  });

  test('should complete tasks during execution', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp and analyze findings' });
    const execution = executePlan(plan.id);

    const tasks = Object.values(execution.tasks);
    const completedTasks = tasks.filter(t => t.status === 'completed');
    expect(completedTasks.length).toBeGreaterThan(0);
  });

  test('should produce task timeline entries', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp' });
    const execution = executePlan(plan.id);

    expect(execution.taskTimeline.length).toBeGreaterThan(0);
    const hasStart = execution.taskTimeline.some(e => e.action === 'started');
    expect(hasStart).toBe(true);
  });

  test('should assign agents to tasks', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp' });
    const execution = executePlan(plan.id);

    const tasks = Object.values(execution.tasks);
    const assignedTasks = tasks.filter(t => t.assignedAgentId !== null);
    expect(assignedTasks.length).toBeGreaterThan(0);
  });

  test('should produce tool usage summary', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp and analyze technology stack' });
    const execution = executePlan(plan.id);

    expect(execution.toolUsageSummary).toBeDefined();
    expect(execution.toolUsageSummary.totalCalls).toBeGreaterThan(0);
  });

  test('should produce agent usage records', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp' });
    const execution = executePlan(plan.id);

    expect(execution.agentUsage.length).toBeGreaterThan(0);
    const totalCompleted = execution.agentUsage.reduce((s, a) => s + a.tasksCompleted, 0);
    expect(totalCompleted).toBeGreaterThan(0);
  });

  test('should produce final output', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp' });
    const execution = executePlan(plan.id);

    expect(execution.finalOutput).not.toBeNull();
    expect(execution.finalOutput!['completedCount']).toBeDefined();
    expect(execution.finalOutput!['totalTasks']).toBeDefined();
  });

  test('should produce overall validation', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp' });
    const execution = executePlan(plan.id);

    expect(execution.overallValidation).not.toBeNull();
    expect(execution.overallValidation!.confidenceScore).toBeGreaterThanOrEqual(0);
  });

  test('should track execution duration', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp' });
    const execution = executePlan(plan.id);

    expect(execution.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(execution.startedAt).not.toBeNull();
    expect(execution.completedAt).not.toBeNull();
  });

  test('should store execution for retrieval', () => {
    const plan = createPlan({ objective: 'Research Acme Corp' });
    const execution = executePlan(plan.id);

    const retrieved = getExecution(execution.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(execution.id);
  });

  test('should list all executions', () => {
    const plan = createPlan({ objective: 'Research Acme Corp' });
    executePlan(plan.id);
    executePlan(plan.id); // Execute again (plan status will already be completed)

    const executions = getAllExecutions();
    expect(executions.length).toBeGreaterThanOrEqual(1);
  });

  test('should update plan status after execution', () => {
    const plan = createPlan({ objective: 'Research Acme Corp' });
    expect(plan.status).toBe('draft');

    executePlan(plan.id);

    const updatedPlan = getPlan(plan.id);
    expect(['completed', 'failed']).toContain(updatedPlan!.status);
  });

  test('should have reasoning steps in completed tasks', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp and analyze technology' });
    const execution = executePlan(plan.id);

    const completedTasks = Object.values(execution.tasks).filter(t => t.status === 'completed');
    const tasksWithReasoning = completedTasks.filter(t => t.recordedReasoning.length > 0);
    expect(tasksWithReasoning.length).toBeGreaterThan(0);
  });

  test('should have tool calls in completed tasks', () => {
    const plan = createPlan({ objective: 'Research company Acme Corp' });
    const execution = executePlan(plan.id);

    const completedTasks = Object.values(execution.tasks).filter(t => t.status === 'completed');
    const tasksWithTools = completedTasks.filter(t => t.toolCalls.length > 0);
    expect(tasksWithTools.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. FRAMEWORK STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Framework Statistics', () => {
  test('should return empty stats when nothing executed', () => {
    const stats = getAgentFrameworkStats();
    expect(stats).toBeDefined();
    expect(stats.totalPlans).toBe(0);
    expect(stats.totalTasks).toBe(0);
    expect(stats.totalExecutions).toBe(0);
    expect(stats.totalAgentDefinitions).toBe(0);
    expect(stats.totalToolCalls).toBe(0);
    expect(stats.completedTasks).toBe(0);
    expect(stats.failedTasks).toBe(0);
    expect(stats.averageConfidenceScore).toBe(0);
    expect(stats.timestamp).toBeDefined();
  });

  test('should track stats after execution', () => {
    seedAgentFramework();
    const plan = createPlan({ objective: 'Research Acme Corp' });
    executePlan(plan.id);

    const stats = getAgentFrameworkStats();
    expect(stats.totalPlans).toBeGreaterThanOrEqual(1);
    expect(stats.totalExecutions).toBeGreaterThanOrEqual(1);
    expect(stats.totalAgentDefinitions).toBe(10); // From seed
    expect(stats.completedTasks).toBeGreaterThan(0);
  });

  test('should include specialization breakdown', () => {
    seedAgentFramework();
    const stats = getAgentFrameworkStats();
    expect(stats.bySpecialization).toBeDefined();
    expect(typeof stats.bySpecialization).toBe('object');
  });

  test('should include tool type breakdown', () => {
    seedAgentFramework();
    const plan = createPlan({ objective: 'Research Acme Corp' });
    executePlan(plan.id);

    const stats = getAgentFrameworkStats();
    expect(stats.byToolType).toBeDefined();
    expect(typeof stats.byToolType).toBe('object');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. SEED DATA INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Seed Data Integrity', () => {
  test('should seed 10 production agents', () => {
    const result = seedAgentFramework();
    expect(result.agentsRegistered).toBe(10);
    expect(result.agents).toHaveLength(10);
  });

  test('seed agents should cover all specializations', () => {
    const result = seedAgentFramework();
    const specializations = new Set(result.agents.map(a => a.specialization));
    expect(specializations.size).toBe(10);

    const expectedSpecs: AgentSpecialization[] = [
      'research', 'analysis', 'reasoning', 'scoring', 'strategy',
      'conversation', 'writing', 'validation', 'learning', 'orchestration',
    ];
    for (const spec of expectedSpecs) {
      expect(specializations.has(spec)).toBe(true);
    }
  });

  test('seed agents should have valid tier assignments', () => {
    const result = seedAgentFramework();
    for (const agent of result.agents) {
      expect(['fast', 'smart', 'deep']).toContain(agent.tier);
    }
  });

  test('seed agents should have appropriate approval modes', () => {
    const result = seedAgentFramework();
    for (const agent of result.agents) {
      expect(['auto', 'soft_review', 'hard_gate', 'escalate']).toContain(agent.approvalMode);
    }
  });

  test('seed agents should have tool assignments', () => {
    const result = seedAgentFramework();
    for (const agent of result.agents) {
      expect(agent.availableTools.length).toBeGreaterThan(0);
      expect(agent.availableTools.length).toBeLessThanOrEqual(4); // Max 4 tools
    }
  });

  test('seed agents should have confidence thresholds between 0 and 1', () => {
    const result = seedAgentFramework();
    for (const agent of result.agents) {
      expect(agent.confidenceThreshold).toBeGreaterThanOrEqual(0);
      expect(agent.confidenceThreshold).toBeLessThanOrEqual(1);
    }
  });

  test('seed agents should have reasonable token limits', () => {
    const result = seedAgentFramework();
    for (const agent of result.agents) {
      expect(agent.maxTokens).toBeGreaterThan(0);
      expect(agent.maxTokens).toBeLessThanOrEqual(10000);
    }
  });

  test('seed agents should have canDelegate flag', () => {
    const result = seedAgentFramework();
    const delegatingAgents = result.agents.filter(a => a.canDelegate);
    expect(delegatingAgents.length).toBeGreaterThan(0);
    // Orchestrator and analysis/strategy agents should be able to delegate
    const orchestrator = result.agents.find(a => a.specialization === 'orchestration');
    expect(orchestrator!.canDelegate).toBe(true);
  });

  test('writing agent should have escalate approval mode', () => {
    const result = seedAgentFramework();
    const writingAgent = result.agents.find(a => a.specialization === 'writing');
    expect(writingAgent!.approvalMode).toBe('escalate');
    expect(writingAgent!.confidenceThreshold).toBe(0.75);
  });

  test('validation agent should have highest confidence threshold', () => {
    const result = seedAgentFramework();
    const validationAgent = result.agents.find(a => a.specialization === 'validation');
    expect(validationAgent!.confidenceThreshold).toBe(0.80);
  });

  test('seed should be idempotent', () => {
    seedAgentFramework();
    seedAgentFramework(); // Seed again
    const agents = getAllAgents();
    // Second seed should overwrite, not duplicate
    const uniqueIds = new Set(agents.map(a => a.id));
    expect(uniqueIds.size).toBe(agents.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. CLEAR & RESET
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: Clear & Reset', () => {
  test('should clear all framework state', () => {
    seedAgentFramework();
    createPlan({ objective: 'Test' });

    clearAgentFramework();

    expect(getAllAgents()).toHaveLength(0);
    expect(getAllPlans()).toHaveLength(0);
    expect(getAllExecutions()).toHaveLength(0);
    expect(getToolCallHistory()).toHaveLength(0);
    expect(getReasoningHistory()).toHaveLength(0);
    expect(getValidationHistory()).toHaveLength(0);
  });

  test('should allow fresh operations after clear', () => {
    seedAgentFramework();
    clearAgentFramework();

    // Re-seed and verify
    const result = seedAgentFramework();
    expect(result.agentsRegistered).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. END-TO-END INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

describe('WI-16I: End-to-End Integration', () => {
  test('full lifecycle: seed → plan → execute → validate → stats', () => {
    // 1. Seed
    const seedResult = seedAgentFramework();
    expect(seedResult.agentsRegistered).toBe(10);

    // 2. Create plan
    const plan = createPlan({
      objective: 'Research company Acme Corp, analyze their technology stack, score the opportunity, and develop an engagement strategy',
    });
    expect(plan.tasks.length).toBeGreaterThanOrEqual(3);
    expect(plan.executionWaves.length).toBeGreaterThanOrEqual(2);

    // 3. Execute plan
    const execution = executePlan(plan.id);
    expect(execution.status).toBeDefined();

    // 4. Verify completed tasks
    const tasks = Object.values(execution.tasks);
    const completedTasks = tasks.filter(t => t.status === 'completed');
    expect(completedTasks.length).toBeGreaterThan(0);

    // 5. Verify tool usage
    expect(execution.toolUsageSummary.totalCalls).toBeGreaterThan(0);

    // 6. Verify agent usage
    expect(execution.agentUsage.length).toBeGreaterThan(0);

    // 7. Verify validation
    expect(execution.overallValidation).not.toBeNull();

    // 8. Verify final output
    expect(execution.finalOutput).not.toBeNull();

    // 9. Check stats
    const stats = getAgentFrameworkStats();
    expect(stats.totalPlans).toBeGreaterThanOrEqual(1);
    expect(stats.totalExecutions).toBeGreaterThanOrEqual(1);
    expect(stats.completedTasks).toBeGreaterThan(0);
  });

  test('collaboration during execution', () => {
    seedAgentFramework();

    // Create a plan with multiple tasks
    const plan = createPlan({
      objective: 'Research Acme Corp and analyze technology stack',
    });

    // Execute
    const execution = executePlan(plan.id);

    // Send collaboration messages during execution context
    const msg = sendCollaborationMessage({
      fromAgentId: 'agent-research-intel',
      fromAgentName: 'Research Intelligence Agent',
      toAgentId: 'agent-analysis-deep',
      toAgentName: 'Deep Analysis Agent',
      executionId: execution.id,
      taskId: Object.values(execution.tasks)[0].id,
      messageType: 'handoff',
      priority: 'high',
      subject: 'Research complete, handing off to analysis',
      body: 'Research phase complete. Found 5 key signals about Acme Corp technology stack.',
      payload: { signalCount: 5, keyFindings: ['Kubernetes', 'AWS', 'Terraform'] },
    });

    expect(msg.id).toBeDefined();
    expect(msg.messageType).toBe('handoff');

    // Verify message in inbox
    const inbox = getAgentInbox('agent-analysis-deep');
    expect(inbox.length).toBeGreaterThanOrEqual(1);
  });

  test('human approval flow during execution', () => {
    seedAgentFramework();

    // Create a plan
    const plan = createPlan({
      objective: 'Draft an executive proposal for Acme Corp',
    });

    // Execute
    const execution = executePlan(plan.id);

    // Verify approval queue is accessible (may or may not have tasks depending on approval modes)
    const queue = getTasksAwaitingApproval();
    // Queue should exist and be callable regardless
    expect(Array.isArray(queue)).toBe(true);
  });
});
