/**
 * Ticket 1 — Unit Tests: Intelligence API Zod Validation Schemas
 *
 * Tests all 10 Intelligence API endpoint validation schemas.
 * Each endpoint gets 2+ test cases:
 *   - Valid params pass validation
 *   - Invalid companyId rejected
 *   - Invalid include values rejected
 *   - Edge cases (empty, special characters, SQL injection)
 */

import { describe, it, expect } from 'vitest';
import {
  companyIdSchema,
  includeSchema,
  companyIntelligenceSchema,
  reasoningIntelligenceSchema,
  opportunityIntelligenceSchema,
  actionIntelligenceSchema,
  conversationIntelligenceSchema,
  mindmapIntelligenceSchema,
  briefIntelligenceSchema,
  groundingIntelligenceSchema,
  retrievalIntelligenceSchema,
  knowledgeIntelligenceSchema,
  pageSchema,
  limitSchema,
} from '@/lib/intelligence-api/validators';

// ═══════════════════════════════════════════════════════════════════════════
//  Shared: companyIdSchema
// ═══════════════════════════════════════════════════════════════════════════

describe('companyIdSchema', () => {
  it('accepts valid UUID format', () => {
    const result = companyIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000');
    expect(result.success).toBe(true);
  });

  it('accepts valid NanoID format', () => {
    const result = companyIdSchema.safeParse('V1StGXR8_Z5jdHi6B-myT');
    expect(result.success).toBe(true);
  });

  it('accepts plain alphanumeric ID', () => {
    const result = companyIdSchema.safeParse('company-123');
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = companyIdSchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('required');
    }
  });

  it('rejects whitespace-only string', () => {
    const result = companyIdSchema.safeParse('   ');
    expect(result.success).toBe(false);
  });

  it('rejects string with spaces', () => {
    const result = companyIdSchema.safeParse('company 123');
    expect(result.success).toBe(false);
  });

  it('rejects SQL injection attempt', () => {
    const result = companyIdSchema.safeParse("1; DROP TABLE companies;--");
    expect(result.success).toBe(false);
  });

  it('rejects string with special characters', () => {
    const result = companyIdSchema.safeParse('id<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });

  it('rejects overly long string (>128 chars)', () => {
    const result = companyIdSchema.safeParse('a'.repeat(129));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('too long');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Shared: includeSchema
// ═══════════════════════════════════════════════════════════════════════════

describe('includeSchema', () => {
  it('accepts undefined (no include param)', () => {
    const result = includeSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('accepts valid single include', () => {
    const result = includeSchema.safeParse('signals');
    expect(result.success).toBe(true);
  });

  it('accepts valid multiple includes', () => {
    const result = includeSchema.safeParse('signals,scores,contacts');
    expect(result.success).toBe(true);
  });

  it('accepts valid includes with extra whitespace', () => {
    const result = includeSchema.safeParse(' signals , scores , contacts ');
    expect(result.success).toBe(true);
  });

  it('rejects invalid include value', () => {
    const result = includeSchema.safeParse('signals,INVALID_KEY');
    expect(result.success).toBe(false);
  });

  it('rejects SQL injection in include param', () => {
    const result = includeSchema.safeParse("signals; DROP TABLE companies");
    expect(result.success).toBe(false);
  });

  it('accepts all 14 valid include keys', () => {
    const allValid = 'signals,scores,contacts,timeline,actions,brief,knowledge,mindmap,reasoning,opportunities,learning,data_health,people_changes,steps';
    const result = includeSchema.safeParse(allValid);
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Shared: pageSchema + limitSchema
// ═══════════════════════════════════════════════════════════════════════════

describe('pageSchema', () => {
  it('coerces string "1" to number 1', () => {
    const result = pageSchema.safeParse('1');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(1);
  });

  it('defaults to 1 when undefined', () => {
    const result = pageSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(1);
  });

  it('rejects page 0', () => {
    const result = pageSchema.safeParse(0);
    expect(result.success).toBe(false);
  });

  it('rejects page > 1000', () => {
    const result = pageSchema.safeParse(1001);
    expect(result.success).toBe(false);
  });

  it('rejects negative page', () => {
    const result = pageSchema.safeParse(-1);
    expect(result.success).toBe(false);
  });
});

describe('limitSchema', () => {
  it('accepts valid limit 20', () => {
    const result = limitSchema.safeParse(20);
    expect(result.success).toBe(true);
  });

  it('defaults to 20 when undefined', () => {
    const result = limitSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(20);
  });

  it('rejects limit > 100', () => {
    const result = limitSchema.safeParse(101);
    expect(result.success).toBe(false);
  });

  it('rejects limit 0', () => {
    const result = limitSchema.safeParse(0);
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Endpoint-specific: companyIntelligenceSchema (2+ tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('companyIntelligenceSchema', () => {
  it('accepts valid companyId with no include', () => {
    const result = companyIntelligenceSchema.safeParse({
      companyId: 'company-abc-123',
      include: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid companyId with multiple includes', () => {
    const result = companyIntelligenceSchema.safeParse({
      companyId: '550e8400-e29b-41d4-a716-446655440000',
      include: 'signals,scores,contacts,timeline,actions,brief,knowledge,mindmap',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyId).toBe('550e8400-e29b-41d4-a716-446655440000');
    }
  });

  it('rejects missing companyId', () => {
    const result = companyIntelligenceSchema.safeParse({
      companyId: '',
      include: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid include with valid companyId', () => {
    const result = companyIntelligenceSchema.safeParse({
      companyId: 'valid-id',
      include: 'signals,BOGUS',
    });
    expect(result.success).toBe(false);
  });

  it('strips whitespace from include values', () => {
    const result = companyIntelligenceSchema.safeParse({
      companyId: 'valid-id',
      include: '  signals  ,  scores  ',
    });
    // Note: the schema itself just validates; whitespace trimming happens at parse time
    // The regex in includeSchema checks each trimmed part
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Endpoint-specific: reasoningIntelligenceSchema (2+ tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('reasoningIntelligenceSchema', () => {
  it('accepts valid params with steps include', () => {
    const result = reasoningIntelligenceSchema.safeParse({
      companyId: 'reason-123',
      include: 'steps',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty companyId', () => {
    const result = reasoningIntelligenceSchema.safeParse({
      companyId: '',
      include: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid include key', () => {
    const result = reasoningIntelligenceSchema.safeParse({
      companyId: 'reason-123',
      include: 'INVALID',
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Endpoint-specific: opportunityIntelligenceSchema (2+ tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('opportunityIntelligenceSchema', () => {
  it('accepts valid params with no includes', () => {
    const result = opportunityIntelligenceSchema.safeParse({
      companyId: 'opp-456',
      include: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid params with learning include', () => {
    const result = opportunityIntelligenceSchema.safeParse({
      companyId: 'opp-456',
      include: 'learning',
    });
    expect(result.success).toBe(true);
  });

  it('rejects special characters in companyId', () => {
    const result = opportunityIntelligenceSchema.safeParse({
      companyId: '../admin/users',
      include: undefined,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Endpoint-specific: actionIntelligenceSchema (2+ tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('actionIntelligenceSchema', () => {
  it('accepts valid params', () => {
    const result = actionIntelligenceSchema.safeParse({
      companyId: 'action-789',
      include: 'learning',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty companyId', () => {
    const result = actionIntelligenceSchema.safeParse({
      companyId: '',
      include: 'signals',
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Endpoint-specific: conversationIntelligenceSchema (2+ tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('conversationIntelligenceSchema', () => {
  it('accepts valid params with talkingPoints include variant', () => {
    const result = conversationIntelligenceSchema.safeParse({
      companyId: 'conv-101',
      include: 'learning',
    });
    expect(result.success).toBe(true);
  });

  it('rejects path traversal in companyId', () => {
    const result = conversationIntelligenceSchema.safeParse({
      companyId: '../../etc/passwd',
      include: undefined,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Endpoint-specific: mindmapIntelligenceSchema (2+ tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('mindmapIntelligenceSchema', () => {
  it('accepts valid params with knowledge include', () => {
    const result = mindmapIntelligenceSchema.safeParse({
      companyId: 'map-202',
      include: 'knowledge',
    });
    expect(result.success).toBe(true);
  });

  it('rejects XSS payload in companyId', () => {
    const result = mindmapIntelligenceSchema.safeParse({
      companyId: '<img src=x onerror=alert(1)>',
      include: undefined,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Endpoint-specific: briefIntelligenceSchema (2+ tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('briefIntelligenceSchema', () => {
  it('accepts valid params with signals include', () => {
    const result = briefIntelligenceSchema.safeParse({
      companyId: 'brief-301',
      include: 'signals,scores',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty companyId', () => {
    const result = briefIntelligenceSchema.safeParse({
      companyId: '',
      include: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('rejects path traversal in companyId', () => {
    const result = briefIntelligenceSchema.safeParse({
      companyId: '../../../etc/passwd',
      include: undefined,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Endpoint-specific: groundingIntelligenceSchema (2+ tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('groundingIntelligenceSchema', () => {
  it('accepts valid params with no include', () => {
    const result = groundingIntelligenceSchema.safeParse({
      companyId: 'ground-401',
      include: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('rejects null companyId', () => {
    const result = groundingIntelligenceSchema.safeParse({
      companyId: null as any,
      include: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid params with knowledge include', () => {
    const result = groundingIntelligenceSchema.safeParse({
      companyId: 'ground-402',
      include: 'knowledge',
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Endpoint-specific: retrievalIntelligenceSchema (2+ tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('retrievalIntelligenceSchema', () => {
  it('accepts valid params with knowledge include', () => {
    const result = retrievalIntelligenceSchema.safeParse({
      companyId: 'retrieval-501',
      include: 'knowledge',
    });
    expect(result.success).toBe(true);
  });

  it('rejects companyId exceeding max length', () => {
    const result = retrievalIntelligenceSchema.safeParse({
      companyId: 'a'.repeat(200),
      include: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid include value', () => {
    const result = retrievalIntelligenceSchema.safeParse({
      companyId: 'retrieval-502',
      include: 'INVALID_INCLUDE',
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Endpoint-specific: knowledgeIntelligenceSchema (2+ tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('knowledgeIntelligenceSchema', () => {
  it('accepts valid params with multiple includes', () => {
    const result = knowledgeIntelligenceSchema.safeParse({
      companyId: 'knowledge-601',
      include: 'signals,knowledge,brief',
    });
    expect(result.success).toBe(true);
  });

  it('rejects companyId with special characters', () => {
    const result = knowledgeIntelligenceSchema.safeParse({
      companyId: 'id<script>alert(1)</script>',
      include: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid params without include', () => {
    const result = knowledgeIntelligenceSchema.safeParse({
      companyId: 'knowledge-602',
      include: undefined,
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Cross-cutting: All schemas share the same shape
// ═══════════════════════════════════════════════════════════════════════════

describe('Intelligence schema consistency', () => {
  const schemas = [
    { name: 'company', schema: companyIntelligenceSchema },
    { name: 'reasoning', schema: reasoningIntelligenceSchema },
    { name: 'opportunity', schema: opportunityIntelligenceSchema },
    { name: 'action', schema: actionIntelligenceSchema },
    { name: 'conversation', schema: conversationIntelligenceSchema },
    { name: 'mindmap', schema: mindmapIntelligenceSchema },
    { name: 'brief', schema: briefIntelligenceSchema },
    { name: 'grounding', schema: groundingIntelligenceSchema },
    { name: 'retrieval', schema: retrievalIntelligenceSchema },
    { name: 'knowledge', schema: knowledgeIntelligenceSchema },
  ];

  it('all schemas reject empty companyId', () => {
    for (const { name, schema } of schemas) {
      const result = schema.safeParse({ companyId: '', include: undefined });
      expect(result.success, `${name} should reject empty companyId`).toBe(false);
    }
  });

  it('all schemas accept valid companyId with no include', () => {
    for (const { name, schema } of schemas) {
      const result = schema.safeParse({ companyId: `test-${name}-id`, include: undefined });
      expect(result.success, `${name} should accept valid companyId`).toBe(true);
    }
  });

  it('all schemas reject companyId with spaces', () => {
    for (const { name, schema } of schemas) {
      const result = schema.safeParse({ companyId: 'has spaces', include: undefined });
      expect(result.success, `${name} should reject companyId with spaces`).toBe(false);
    }
  });
});
