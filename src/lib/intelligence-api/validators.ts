/**
 * Intelligence API — Zod Validation Schemas
 *
 * Validates request parameters for all 6 core Intelligence API endpoints.
 * Each schema validates:
 *   - companyId: must be a non-empty string (UUID or NanoID format)
 *   - include: optional comma-separated list of valid include keys
 *
 * Usage:
 *   import { companyIntelligenceSchema } from '@/lib/intelligence-api/validators';
 *   const result = companyIntelligenceSchema.safeParse({ companyId, include });
 */

import { z } from 'zod';
import { VALID_INCLUDES } from './middleware';

// ── Shared building blocks ──────────────────────────────────────────────────

/** Company ID must be a non-empty string (UUID, NanoID, or CUID) */
export const companyIdSchema = z
  .string()
  .min(1, 'Company ID is required')
  .max(128, 'Company ID is too long')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Company ID contains invalid characters'
  );

// Valid include keys — imported from middleware (single source of truth).
// Do NOT duplicate this set here.
function getValidIncludeKeys(): Set<string> {
  return VALID_INCLUDES;
}

/** Include parameter: comma-separated list of valid keys */
export const includeSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val) return true; // null/undefined is fine (no includes)
      const parts = val.split(',').map(s => s.trim()).filter(Boolean);
      const validIncludes = getValidIncludeKeys();
      return parts.every(p => validIncludes.has(p));
    },
    { message: 'One or more include values are invalid' }
  );

/** Page parameter for paginated endpoints */
export const pageSchema = z
  .coerce
  .number()
  .int()
  .min(1, 'Page must be at least 1')
  .max(1000, 'Page cannot exceed 1000')
  .default(1);

/** Limit parameter for paginated endpoints */
export const limitSchema = z
  .coerce
  .number()
  .int()
  .min(1, 'Limit must be at least 1')
  .max(100, 'Limit cannot exceed 100')
  .default(20);

// ── Endpoint-specific schemas ───────────────────────────────────────────────

/**
 * GET /api/intelligence/company/{id}?include=signals,scores,...
 *
 * Validates:
 *   - companyId (path param)
 *   - include (optional query param)
 */
export const companyIntelligenceSchema = z.object({
  companyId: companyIdSchema,
  include: includeSchema,
});

/**
 * GET /api/intelligence/reasoning/{id}?include=steps
 *
 * Validates:
 *   - companyId (path param)
 *   - include (optional query param)
 */
export const reasoningIntelligenceSchema = z.object({
  companyId: companyIdSchema,
  include: includeSchema,
});

/**
 * GET /api/intelligence/opportunity/{id}?include=learning
 *
 * Validates:
 *   - companyId (path param)
 *   - include (optional query param)
 */
export const opportunityIntelligenceSchema = z.object({
  companyId: companyIdSchema,
  include: includeSchema,
});

/**
 * GET /api/intelligence/action/{id}?include=learning
 *
 * Validates:
 *   - companyId (path param)
 *   - include (optional query param)
 */
export const actionIntelligenceSchema = z.object({
  companyId: companyIdSchema,
  include: includeSchema,
});

/**
 * GET /api/intelligence/conversation/{id}?include=learning
 *
 * Validates:
 *   - companyId (path param)
 *   - include (optional query param)
 */
export const conversationIntelligenceSchema = z.object({
  companyId: companyIdSchema,
  include: includeSchema,
});

/**
 * GET /api/intelligence/mindmap/{id}?include=knowledge
 *
 * Validates:
 *   - companyId (path param)
 *   - include (optional query param)
 */
export const mindmapIntelligenceSchema = z.object({
  companyId: companyIdSchema,
  include: includeSchema,
});

/**
 * GET /api/intelligence/brief/{id}?include=steps
 *
 * Validates:
 *   - companyId (path param)
 *   - include (optional query param)
 */
export const briefIntelligenceSchema = z.object({
  companyId: companyIdSchema,
  include: includeSchema,
});

/**
 * GET /api/intelligence/grounding/{id}?include=evidence
 *
 * Validates:
 *   - companyId (path param)
 *   - include (optional query param)
 */
export const groundingIntelligenceSchema = z.object({
  companyId: companyIdSchema,
  include: includeSchema,
});

/**
 * GET /api/intelligence/retrieval/{id}?include=knowledge
 *
 * Validates:
 *   - companyId (path param)
 *   - include (optional query param)
 */
export const retrievalIntelligenceSchema = z.object({
  companyId: companyIdSchema,
  include: includeSchema,
});

/**
 * GET /api/intelligence/knowledge/{id}
 *
 * Validates:
 *   - companyId (path param)
 *   - include (optional query param)
 */
export const knowledgeIntelligenceSchema = z.object({
  companyId: companyIdSchema,
  include: includeSchema,
});

// ── Map: endpoint name → schema for lookup ──────────────────────────────────

export const intelligenceValidators: Record<string, z.ZodObject<{
  companyId: z.ZodString;
  include: z.ZodOptional<z.ZodString>;
}>> = {
  company: companyIntelligenceSchema,
  reasoning: reasoningIntelligenceSchema,
  opportunity: opportunityIntelligenceSchema,
  action: actionIntelligenceSchema,
  conversation: conversationIntelligenceSchema,
  mindmap: mindmapIntelligenceSchema,
  brief: briefIntelligenceSchema,
  grounding: groundingIntelligenceSchema,
  retrieval: retrievalIntelligenceSchema,
  knowledge: knowledgeIntelligenceSchema,
};

// ── Inferred input types ────────────────────────────────────────────────────

export type CompanyIntelligenceInput = z.infer<typeof companyIntelligenceSchema>;
export type ReasoningIntelligenceInput = z.infer<typeof reasoningIntelligenceSchema>;
export type OpportunityIntelligenceInput = z.infer<typeof opportunityIntelligenceSchema>;
export type ActionIntelligenceInput = z.infer<typeof actionIntelligenceSchema>;
export type ConversationIntelligenceInput = z.infer<typeof conversationIntelligenceSchema>;
export type MindmapIntelligenceInput = z.infer<typeof mindmapIntelligenceSchema>;
export type BriefIntelligenceInput = z.infer<typeof briefIntelligenceSchema>;
export type GroundingIntelligenceInput = z.infer<typeof groundingIntelligenceSchema>;
export type RetrievalIntelligenceInput = z.infer<typeof retrievalIntelligenceSchema>;
export type KnowledgeIntelligenceInput = z.infer<typeof knowledgeIntelligenceSchema>;

// ── Consistency check: all validators share the same shape ──────────────────

const ALL_VALIDATOR_KEYS = [
  'company', 'reasoning', 'opportunity', 'action', 'conversation', 'mindmap',
  'brief', 'grounding', 'retrieval', 'knowledge',
] as const;

/**
 * Runtime assertion: every key in ALL_VALIDATOR_KEYS exists in intelligenceValidators.
 * Will throw at module load time if a schema is missing.
 */
for (const key of ALL_VALIDATOR_KEYS) {
  if (!intelligenceValidators[key]) {
    throw new Error(`Intelligence API validator missing for endpoint: ${key}`);
  }
}
