import { z } from 'zod'

// ── AI Routes ──────────────────────────────────────────────────────────
export const aiChatSchema = z.object({
  message: z.string().min(1).max(10000),
  companyId: z.string().optional(),
  conversationId: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  conversationHistory: z.array(z.record(z.string(), z.unknown())).optional(),
})

export const aiGenerateSchema = z.object({
  prompt: z.string().min(1).max(5000),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  type: z.enum(['email', 'brief', 'summary', 'analysis']).optional(),
})

/** Schema for AI email generation endpoint */
export const aiGenerateEmailSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().max(500).optional(),
  title: z.string().max(200).optional(),
  company: z.string().max(300).optional(),
  industry: z.string().max(200).optional(),
  companySize: z.string().max(50).optional(),
  tone: z.string().max(50).optional(),
  additionalContext: z.string().max(5000).optional(),
  serviceLine: z.string().max(200).optional(),
  problems: z.string().max(5000).optional(),
  knowledgeSearchMode: z.string().max(50).optional(),
  knowledgeMinScore: z.number().optional(),
})

export const aiCacheInvalidateSchema = z.object({
  keys: z.array(z.string()).optional(),
  pattern: z.string().optional(),
})

export const aiExperimentCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.string().max(50).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export const aiExperimentUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  results: z.record(z.string(), z.unknown()).optional(),
})

/** Full schema for prompt A/B experiment creation */
export const aiExperimentFullCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  promptId: z.string().min(1),
  variants: z.array(z.record(z.string(), z.unknown())).min(2).max(10),
  primaryMetric: z.enum([
    'accuracy', 'hallucination_rate', 'latency_ms',
    'user_rating', 'relevance_score', 'completion_rate',
  ]),
  weights: z.array(z.number()).optional(),
  minSamplesPerVariant: z.number().int().min(1).optional(),
  significanceThreshold: z.number().min(0).max(1).optional(),
})

/** Schema for experiment PATCH: action or metric recording */
export const aiExperimentPatchSchema = z.object({
  action: z.enum(['start', 'pause', 'resume', 'complete']).optional(),
  metric: z.enum([
    'accuracy', 'hallucination_rate', 'latency_ms',
    'user_rating', 'relevance_score', 'completion_rate',
  ]).optional(),
  variantId: z.string().optional(),
  value: z.number().optional(),
  sampleId: z.string().optional(),
}).refine(d => d.action || (d.metric && d.variantId && d.value !== undefined), {
  message: 'Specify either "action" (start/pause/resume/complete) or metric recording fields (metric, variantId, value)',
})

// ── Admin Routes ───────────────────────────────────────────────────────
export const adminSettingsSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown()), z.record(z.string(), z.unknown())]),
})

/** Schema for DELETE /api/admin/settings (requires key) */
export const adminSettingDeleteSchema = z.object({
  key: z.string().min(1).max(100),
})

export const adminUserCreateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
})

export const adminUserUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'member', 'viewer']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
})

/** Schema for PATCH /api/admin/users (includes required id) */
export const adminUserPatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  role: z.string().max(50).optional(),
  status: z.enum(['active', 'suspended', 'inactive']).optional(),
})

export const adminScoringSchema = z.object({
  weights: z.record(z.string(), z.number().min(0).max(1)).optional(),
  thresholds: z.record(z.string(), z.number()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  changeReason: z.string().max(500).optional(),
}).passthrough()

/** Schema for POST /api/admin/scoring (reset action) */
export const adminScoringResetSchema = z.object({
  action: z.literal('reset'),
})

export const adminSecurityFindingsSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['open', 'investigating', 'resolved', 'dismissed', 'false_positive']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  notes: z.string().max(2000).optional(),
})

/** Schema for POST /api/admin/security-findings (create) */
export const adminSecurityFindingCreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.string().min(1).max(100),
  remediation: z.string().min(1),
  owaspCategory: z.string().max(100).optional(),
  cvssScore: z.number().min(0).max(10).optional(),
  affectedEndpoints: z.union([z.string(), z.array(z.string())]).optional(),
  remediationDeadline: z.string().optional(),
  assignedTo: z.string().max(200).optional(),
  evidence: z.string().max(10000).optional(),
  externalTestRef: z.string().max(200).optional(),
})

export const adminEnvironmentCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['development', 'staging', 'production', 'preview']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export const adminEnvironmentUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['development', 'staging', 'production', 'preview']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
})

/** Schema for PUT /api/admin/environments */
export const adminEnvironmentPutSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  featureFlags: z.record(z.string(), z.unknown()).optional(),
  deploymentUrl: z.string().optional(),
})

/** Schema for POST /api/admin/environments (promote) */
export const adminEnvironmentPromoteSchema = z.object({
  action: z.literal('promote'),
  from: z.string().min(1),
  to: z.string().min(1),
})

// ── Intelligence Routes ────────────────────────────────────────────────
export const intelligenceEnrichSchema = z.object({
  companyId: z.string().min(1),
  sources: z.array(z.string()).optional(),
  force: z.boolean().default(false),
})

export const intelligenceBriefSchema = z.object({
  companyId: z.string().min(1),
  sections: z.array(z.string()).optional(),
  depth: z.enum(['summary', 'detailed', 'comprehensive']).default('summary'),
})

export const intelligenceActivationSchema = z.object({
  companyId: z.string().min(1),
  trigger: z.string().max(50).optional(),
  priority: z.number().min(1).max(10).optional(),
})

export const intelligenceFeedbackSchema = z.object({
  artifactId: z.string().min(1),
  rating: z.number().min(1).max(5),
  feedback: z.string().max(2000).optional(),
  accuracy: z.enum(['accurate', 'partially_accurate', 'inaccurate', 'cannot_judge']).optional(),
})

export const intelligenceRefreshSchema = z.object({
  companyId: z.string().min(1),
  sources: z.array(z.string()).optional(),
})

export const intelligenceEnrichBatchSchema = z.object({
  companyIds: z.array(z.string().min(1)).min(1).max(100),
  sources: z.array(z.string()).optional(),
  force: z.boolean().default(false),
})

// ── Data Operations ────────────────────────────────────────────────────
export const dataExportSchema = z.object({
  format: z.enum(['csv', 'json', 'xlsx']).default('csv'),
  entityType: z.string().min(1),
  filters: z.record(z.string(), z.unknown()).optional(),
  fields: z.array(z.string()).optional(),
})

/** Schema for POST /api/data-export (with valid entity types) */
export const dataExportPostSchema = z.object({
  format: z.enum(['csv', 'json', 'xlsx']),
  entityType: z.enum(['companies', 'contacts', 'opportunities', 'signals']),
  filters: z.record(z.string(), z.unknown()).optional(),
  fields: z.array(z.string()).optional(),
})

export const dataDeletionSchema = z.object({
  entityType: z.enum(['company', 'contact', 'all']),
  confirm: z.literal(true),
  reason: z.string().max(500).optional(),
})

/** Schema for POST /api/account/data-deletion (initiate) */
export const accountDataDeletionInitiateSchema = z.object({
  reason: z.string().max(500).optional(),
  scope: z.object({
    entityTypes: z.array(z.string()).optional(),
  }).optional(),
}).passthrough()

/** Schema for POST /api/account/data-deletion (cancel) */
export const accountDataDeletionCancelSchema = z.object({
  id: z.string().min(1),
  reason: z.string().max(500).optional(),
})

/** Schema for POST /api/account/data-export (optional companyId) */
export const accountDataExportSchema = z.object({
  companyId: z.string().optional(),
}).passthrough()

export const bulkMergeSchema = z.object({
  primaryId: z.string().min(1),
  mergeIds: z.array(z.string().min(1)).min(1).max(50),
  strategy: z.enum(['prefer_newer', 'prefer_primary', 'manual']).default('prefer_newer'),
})

// ── CRM Routes ─────────────────────────────────────────────────────────
export const crmSyncSchema = z.object({
  provider: z.enum(['hubspot', 'salesforce']).optional(),
  syncType: z.enum(['full', 'incremental']).default('incremental'),
  entities: z.array(z.string()).optional(),
})

/** Schema for POST /api/crm/[id]/sync (optional sync options) */
export const crmSyncOptionsSchema = z.object({
  conflictResolution: z.enum(['local_wins', 'remote_wins', 'newest_wins']).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
  modifiedAfter: z.string().optional(),
  syncAccounts: z.boolean().optional(),
  syncContacts: z.boolean().optional(),
  syncDeals: z.boolean().optional(),
}).passthrough()

export const crmPushSchema = z.object({
  entityType: z.enum(['company', 'contact', 'deal']),
  entityId: z.string().min(1),
  provider: z.enum(['hubspot', 'salesforce']).optional(),
})

// ── Feedback Routes ────────────────────────────────────────────────────
export const feedbackSchema = z.object({
  companyId: z.string().min(1).optional(),
  type: z.enum(['general', 'bug', 'feature', 'intelligence_quality']).default('general'),
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().max(5000).optional(),
})

// ── Webhook Routes ─────────────────────────────────────────────────────
export const webhookManageSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
  secret: z.string().optional(),
  active: z.boolean().default(true),
})

// ── Sequence/Playbook Routes ───────────────────────────────────────────
export const sequenceEnrollSchema = z.object({
  contactId: z.string().min(1),
  sequenceId: z.string().min(1),
  scheduleAt: z.string().datetime().optional(),
})

export const sequenceExecuteSchema = z.object({
  stepId: z.string().min(1).optional(),
  customSubject: z.string().max(500).optional(),
  customBody: z.string().max(50000).optional(),
})

export const playbookUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  stages: z.array(z.record(z.string(), z.unknown())).optional(),
  active: z.boolean().optional(),
})

// ── Batch Routes ───────────────────────────────────────────────────────
export const batchCreateSchema = z.object({
  type: z.string().min(1).max(50),
  config: z.record(z.string(), z.unknown()).optional(),
  itemCount: z.number().int().min(0).optional(),
})

// ── Knowledge Routes ───────────────────────────────────────────────────
export const knowledgeIngestSchema = z.object({
  source: z.string().min(1).max(100),
  content: z.string().min(1).max(100000),
  title: z.string().max(300).optional(),
  docType: z.string().max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// ── Signal Routes ──────────────────────────────────────────────────────
export const signalDismissSchema = z.object({
  reason: z.string().max(500).optional(),
})

// ── Segment Routes ─────────────────────────────────────────────────────
export const segmentCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  rules: z.array(z.record(z.string(), z.unknown())).optional(),
})

// ── Suppression Routes ─────────────────────────────────────────────────
export const suppressionSchema = z.object({
  email: z.string().email().optional(),
  domain: z.string().optional(),
  reason: z.string().max(200).optional(),
}).refine(d => d.email || d.domain, { message: 'Either email or domain is required' })

// ── Duplicate Routes ───────────────────────────────────────────────────
export const duplicateScanSchema = z.object({
  entityType: z.enum(['company', 'contact']),
  threshold: z.number().min(0).max(1).default(0.8),
  limit: z.number().int().min(1).max(1000).default(100),
})

export const duplicateMergeSchema = z.object({
  primaryId: z.string().min(1),
  secondaryId: z.string().min(1),
  strategy: z.enum(['prefer_newer', 'prefer_primary']).default('prefer_newer'),
})

/** Schema for POST /api/duplicates/merge (actual route uses survivorId/duplicateId) */
export const duplicateMergePostSchema = z.object({
  survivorId: z.string().min(1),
  duplicateId: z.string().min(1),
  strategy: z.enum(['keep_survivor', 'keep_duplicate', 'keep_most_recent']).default('keep_survivor'),
  action: z.enum(['skip', 'merge']).optional(),
  reason: z.string().max(500).optional(),
})

/** Schema for POST /api/duplicates/bulk-merge */
export const duplicateBulkMergePostSchema = z.object({
  merges: z.array(z.object({
    survivorId: z.string().min(1),
    duplicateId: z.string().min(1),
    strategy: z.enum(['keep_survivor', 'keep_duplicate', 'keep_most_recent']).optional(),
  })).min(1).max(50),
})

// ── Settings/Preferences ───────────────────────────────────────────────
export const settingsUpdateSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
})

// ── Research/Intelligence Routes ───────────────────────────────────────
export const researchQuerySchema = z.object({
  query: z.string().min(1).max(5000),
  companyId: z.string().optional(),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard'),
  sources: z.array(z.string()).optional(),
})

// ── AI Advisor / Buying Intent / Evaluation ─────────────────────────────
export const aiAdvisorWorkspaceSchema = z.object({
  companyId: z.string().min(1),
  query: z.string().max(5000).optional(),
  action: z.enum(['research', 'analyze', 'recommend', 'summarize']).optional(),
})

/** Schema for persisting advisor workspace state */
export const aiAdvisorWorkspaceSaveSchema = z.object({
  conversationId: z.string().min(1),
  workspace: z.record(z.string(), z.unknown()),
})

export const aiBuyingIntentSchema = z.object({
  companyId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  signalTypes: z.array(z.string()).optional(),
  timeframe: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
})

export const aiEvaluationSchema = z.object({
  companyId: z.string().min(1),
  criteria: z.array(z.record(z.string(), z.unknown())).optional(),
  weights: z.record(z.string(), z.number()).optional(),
})

export const aiEvaluationUpdateSchema = z.object({
  id: z.string().min(1),
  scores: z.record(z.string(), z.number()).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['draft', 'final', 'archived']).optional(),
})

/** Schema for AI evaluation dashboard POST (evaluate or compare) */
export const aiEvaluationPostSchema = z.object({
  action: z.enum(['evaluate', 'compare']),
  input: z.object({
    aiOutput: z.string().min(1),
    engine: z.string().min(1),
    category: z.string().min(1),
    expectedOutput: z.string().optional(),
    context: z.string().optional(),
  }).optional(),
  labelA: z.string().optional(),
  labelB: z.string().optional(),
  resultsA: z.array(z.record(z.string(), z.unknown())).optional(),
  resultsB: z.array(z.record(z.string(), z.unknown())).optional(),
  comparisonType: z.enum(['prompt_version', 'model', 'engine_version', 'configuration']).optional(),
}).refine(d => {
  if (d.action === 'evaluate') return !!d.input
  if (d.action === 'compare') return !!d.labelA && !!d.labelB && Array.isArray(d.resultsA) && Array.isArray(d.resultsB)
  return false
}, { message: 'Invalid request for the specified action' })

// ── Generic catch-all for simple body validation ───────────────────────
export const genericBodySchema = z.object({}).passthrough()

export const genericIdBodySchema = z.object({
  id: z.string().min(1),
}).passthrough()

// ── ID parameter validation ────────────────────────────────────────────
export const idParamSchema = z.string().min(1).max(100)
export const uuidParamSchema = z.string().uuid()
