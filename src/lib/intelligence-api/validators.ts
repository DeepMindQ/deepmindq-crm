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

/** Include parameter: comma-separated list of valid keys */
export const includeSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val) return true; // null/undefined is fine (no includes)
      const parts = val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const validIncludes = new Set([
        'signals', 'scores', 'contacts', 'timeline', 'actions', 'brief',
        'knowledge', 'mindmap', 'reasoning', 'opportunities',
        'learning', 'data_health', 'people_changes', 'steps',
      ]);
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
};

// ── Inferred input types ────────────────────────────────────────────────────

export type CompanyIntelligenceInput = z.infer<typeof companyIntelligenceSchema>;
export type ReasoningIntelligenceInput = z.infer<typeof reasoningIntelligenceSchema>;
export type OpportunityIntelligenceInput = z.infer<typeof opportunityIntelligenceSchema>;
export type ActionIntelligenceInput = z.infer<typeof actionIntelligenceSchema>;
export type ConversationIntelligenceInput = z.infer<typeof conversationIntelligenceSchema>;
export type MindmapIntelligenceInput = z.infer<typeof mindmapIntelligenceSchema>;
