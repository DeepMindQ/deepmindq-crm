/**
 * MS9 Integration Layer — Barrel Export
 * ===========================================
 *
 * Public API for the advisor integration layer.
 * All consumers should import from '@/lib/advisor' rather than
 * individual files.
 */

export { adaptBriefToStructuredBriefing } from './briefing-adapter';
export type {
  BriefingAdapterConfig,
  BriefingAdapterInput,
} from './briefing-adapter';

export {
  buildAdvisorAccountContext,
  buildContextSidebarData,
} from './context-builders';
export type {
  AccountContextBuildOptions,
  ContextSidebarBuildOptions,
} from './context-builders';

export { orchestrateAdvisorQuery } from './advisor-orchestrator';
export type {
  AdvisorOrchestrationResult,
  AdvisorOrchestrationOptions,
} from './advisor-orchestrator';

export { advisorConversationApi } from './advisor-persistence';
export type {
  CreateConversationInput,
  AddMessageInput,
  UpdateWorkspaceInput,
  CreateEscalationInput,
} from './advisor-persistence';
