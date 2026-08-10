/**
 * Phase B Engine Architecture — Barrel Export
 * ============================================
 *
 * The 6-engine composable architecture for DeepMindQ AI.
 *
 * Foundation engines (call LLMs / collect evidence / retrieve knowledge):
 *   - ModelRouter       Tiered LLM router (Deep/Smart/Fast)
 *   - GroundingEngine   Evidence chain builder with citations + confidence
 *   - RetrievalEngine   Local semantic search (@xenova/transformers + DB)
 *
 * Composition engines (orchestrate foundation engines to produce output):
 *   - SynthesisEngine      Long-form evidence-grounded briefs
 *   - ScoringEngine        Revenue Intelligence Score (explainable, decomposed)
 *   - ActionEngine         Next-best-action + sales motion recommendations
 *   - ConversationEngine   Meeting prep + conversation planning intelligence
 *
 * WI-16F: Hybrid Retrieval Intelligence (multi-signal replacement for
 * single-signal RetrievalEngine.search). Available at @/lib/ai-hybrid-retrieval.
 *
 * WI-16G: Knowledge Graph Intelligence (entity extraction, graph traversal,
 * relationship scoring, evidence chain reasoning). Available at @/lib/ai-knowledge-graph.
 *
 * WI-16H: AI Memory Architecture (layered memory, consolidation, decay,
 * enterprise context building). Available at @/lib/ai-memory.
 *
 * WI-16I: AI Agent Framework (dynamic agent planning, tool usage,
 * task decomposition, reasoning chains, self-validation, collaboration,
 * human approval checkpoints). Available at @/lib/ai-agent-framework.
 */

export { ModelRouter } from './model-router';
export type { Tier, CompletionParams, CompletionResult } from './model-router';

export { GroundingEngine, renderChainForPrompt } from './grounding-engine';
export type {
  Evidence,
  EvidenceChain,
  EvidenceGap,
  EvidenceType,
  GroundingContext,
} from './grounding-engine';

export { RetrievalEngine } from './retrieval-engine';
export type {
  EmbeddableEntityType,
  EmbeddingResult,
  RetrievalResult,
  RetrievalStats,
} from './retrieval-engine';

export { SynthesisEngine } from './synthesis-engine';
export type {
  Brief,
  BriefCitation,
  BriefDepth,
  BriefRequest,
  BriefSection,
  BriefType,
} from './synthesis-engine';

export { ScoringEngine } from './scoring-engine';
export type {
  ScoreDimension,
  ScoreGrade,
  PriorityTier,
  ScoreFactor,
  RevenueScore,
} from './scoring-engine';

export { ActionEngine } from './action-engine';
export type {
  ActionType,
  SalesMotion,
  UrgencyLevel,
  RecommendedAction,
  ActionResult,
} from './action-engine';

export { ConversationEngine } from './conversation-engine';
export type {
  BriefingType,
  MeetingType,
  BuyerRole,
  TalkingPoint,
  QuestionToAsk,
  ObjectionPrep,
  BuyerProfile,
  ConversationResult,
} from './conversation-engine';

// WI-16G: Knowledge Graph Intelligence — entity/relationship reasoning engine
export {
  addNode,
  addEdge,
  removeNode,
  removeEdge,
  addNodeSync,
  addEdgeSync,
  removeNodeSync,
  removeEdgeSync,
  ensureGraphLoaded,
  resolveEntity,
  getNode,
  getNodeEdges,
  getOutgoingEdges,
  getIncomingEdges,
  extractGraphEntities,
  populateGraphFromIntelligence,
  traverseBFS,
  findPaths,
  findShortestPath,
  expandFromEntity,
  generateRecommendations,
  reasonAboutEntity,
  getGraphStats,
  clearGraph,
  getAllNodes,
  getAllEdges,
  seedKnowledgeGraph,
} from '../ai-knowledge-graph';
export type {
  GraphEntityType,
  RelationshipType,
  GraphNode,
  GraphEdge,
  GraphPath,
  EvidenceChain as GraphEvidenceChain,
  GraphExpansionResult,
  GraphStats,
  GraphRecommendationInput,
  GraphRecommendation,
  GraphEntityExtraction,
  TraversalConfig,
} from '../ai-knowledge-graph';

// WI-16H: AI Memory Architecture — layered memory with consolidation and decay
export {
  storeMemory,
  recallMemory,
  forgetMemory,
  updateMemory,
  searchMemories,
  getEntityMemories,
  buildMemoryContext,
  consolidateMemories,
  applyMemoryDecay,
  getMemoryStats,
  clearAllMemories,
  getAllMemories,
  seedMemorySystem,
} from '../ai-memory';
export type {
  MemoryLayer,
  MemoryCategory,
  MemoryPriority,
  MemoryItem,
  MemorySource,
  MemoryRecallResult,
  MemoryConsolidation,
  MemoryStats,
  MemorySearchQuery,
  MemoryContext,
} from '../ai-memory';

// WI-16I: AI Agent Framework — dynamic intelligent agent architecture
export {
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
  clearAgentFramework,
  seedAgentFramework,
} from '../ai-agent-framework';
export type {
  AgentSpecialization,
  AgentTier,
  ApprovalMode,
  AgentDefinition,
  TaskStatus,
  TaskPriority,
  TaskComplexity,
  AgentTask,
  PlanStatus,
  AgentPlan,
  MemoryRequirement,
  RetrievalRequirement,
  ExecutionStatus,
  AgentExecution,
  TaskTimelineEntry,
  AgentUsageRecord,
  ToolUsageSummary,
  AgentToolType,
  ToolCallStatus,
  ToolCallRecord,
  ReasoningStatus,
  ReasoningType,
  ReasoningStep,
  ValidationStatus,
  FindingSeverity,
  ValidationResult,
  ValidationCheck,
  ValidationFinding,
  CollaborationMessageType,
  CollaborationPriority,
  CollaborationMessage,
  FeedbackType,
  HumanFeedback,
  AgentFrameworkStats,
  SeedAgent,
} from '../ai-agent-framework';
