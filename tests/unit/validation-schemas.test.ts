// ═══════════════════════════════════════════════════════════════════════════
// Validation Schemas — Unit Tests
//
// Tests all Zod schemas from @/lib/validation-schemas.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  aiChatSchema,
  aiGenerateSchema,
  aiGenerateEmailSchema,
  adminUserCreateSchema,
  adminUserUpdateSchema,
  dataExportSchema,
  dataDeletionSchema,
  bulkMergeSchema,
  duplicateMergeSchema,
  feedbackSchema,
  signalDismissSchema,
  segmentCreateSchema,
  suppressionSchema,
  genericBodySchema,
  genericIdBodySchema,
  idParamSchema,
  aiCacheInvalidateSchema,
  researchQuerySchema,
  duplicateScanSchema,
  webhookManageSchema,
} from '@/lib/validation-schemas';

// ── AI Schemas ──────────────────────────────────────────────────────────

describe('aiChatSchema', () => {
  it('accepts valid input with message', () => {
    const result = aiChatSchema.safeParse({ message: 'Hello AI' });
    expect(result.success).toBe(true);
  });

  it('accepts valid input with all optional fields', () => {
    const result = aiChatSchema.safeParse({
      message: 'Hello',
      companyId: 'c1',
      conversationId: 'conv1',
      context: { key: 'value' },
      conversationHistory: [{ role: 'user', content: 'hi' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing message', () => {
    const result = aiChatSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty message', () => {
    const result = aiChatSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });

  it('enforces max length of 10000 on message', () => {
    const result = aiChatSchema.safeParse({ message: 'a'.repeat(10001) });
    expect(result.success).toBe(false);
  });

  it('accepts message at exactly 10000 chars', () => {
    const result = aiChatSchema.safeParse({ message: 'a'.repeat(10000) });
    expect(result.success).toBe(true);
  });
});

describe('aiGenerateSchema', () => {
  it('accepts valid input with prompt', () => {
    const result = aiGenerateSchema.safeParse({ prompt: 'Write an email' });
    expect(result.success).toBe(true);
  });

  it('accepts optional type enum values', () => {
    for (const type of ['email', 'brief', 'summary', 'analysis']) {
      const result = aiGenerateSchema.safeParse({ prompt: 'test', type });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid type enum', () => {
    const result = aiGenerateSchema.safeParse({ prompt: 'test', type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing prompt', () => {
    const result = aiGenerateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('enforces max length of 5000 on prompt', () => {
    const result = aiGenerateSchema.safeParse({ prompt: 'a'.repeat(5001) });
    expect(result.success).toBe(false);
  });
});

describe('aiGenerateEmailSchema', () => {
  it('accepts valid input with required name', () => {
    const result = aiGenerateEmailSchema.safeParse({ name: 'John Doe' });
    expect(result.success).toBe(true);
  });

  it('accepts all optional fields', () => {
    const result = aiGenerateEmailSchema.safeParse({
      name: 'Jane',
      email: 'jane@example.com',
      title: 'CEO',
      company: 'Acme',
      industry: 'SaaS',
      companySize: '50-200',
      tone: 'professional',
      additionalContext: 'Some context',
      serviceLine: 'Consulting',
      problems: 'Scaling issues',
      knowledgeSearchMode: 'hybrid',
      knowledgeMinScore: 0.8,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = aiGenerateEmailSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('enforces max length of 200 on name', () => {
    const result = aiGenerateEmailSchema.safeParse({ name: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('enforces max length of 500 on email', () => {
    const result = aiGenerateEmailSchema.safeParse({
      name: 'Test',
      email: 'a' + '@' + 'b'.repeat(499), // 501 chars total
    });
    expect(result.success).toBe(false);
  });
});

// ── Admin Schemas ───────────────────────────────────────────────────────

describe('adminUserCreateSchema', () => {
  it('accepts valid input', () => {
    const result = adminUserCreateSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
    });
    expect(result.success).toBe(true);
    expect(result.data!.role).toBe('member'); // default
  });

  it('applies default role of member', () => {
    const result = adminUserCreateSchema.safeParse({
      name: 'Jane',
      email: 'jane@example.com',
    });
    expect(result.success).toBe(true);
    expect(result.data!.role).toBe('member');
  });

  it('accepts all valid role enum values', () => {
    for (const role of ['admin', 'member', 'viewer']) {
      const result = adminUserCreateSchema.safeParse({
        name: 'Test',
        email: 'test@test.com',
        role,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    const result = adminUserCreateSchema.safeParse({
      name: 'Test',
      email: 'test@test.com',
      role: 'superadmin',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = adminUserCreateSchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = adminUserCreateSchema.safeParse({
      name: 'Test',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = adminUserCreateSchema.safeParse({ email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('enforces max length of 200 on name', () => {
    const result = adminUserCreateSchema.safeParse({
      name: 'a'.repeat(201),
      email: 'a@b.com',
    });
    expect(result.success).toBe(false);
  });
});

describe('adminUserUpdateSchema', () => {
  it('accepts valid partial update', () => {
    const result = adminUserUpdateSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts valid role update', () => {
    const result = adminUserUpdateSchema.safeParse({ role: 'admin' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = adminUserUpdateSchema.safeParse({ role: 'hacker' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = adminUserUpdateSchema.safeParse({ status: 'banned' });
    expect(result.success).toBe(false);
  });

  it('accepts valid status values', () => {
    for (const status of ['active', 'inactive', 'suspended']) {
      const result = adminUserUpdateSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('accepts empty object (no-op update)', () => {
    const result = adminUserUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = adminUserUpdateSchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
  });
});

// ── Data Operations ────────────────────────────────────────────────────

describe('dataExportSchema', () => {
  it('accepts valid input with required fields', () => {
    const result = dataExportSchema.safeParse({
      format: 'csv',
      entityType: 'companies',
    });
    expect(result.success).toBe(true);
  });

  it('applies default format of csv', () => {
    const result = dataExportSchema.safeParse({ entityType: 'companies' });
    expect(result.success).toBe(true);
    expect(result.data!.format).toBe('csv');
  });

  it('accepts all valid format enum values', () => {
    for (const format of ['csv', 'json', 'xlsx']) {
      const result = dataExportSchema.safeParse({
        format,
        entityType: 'contacts',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid format', () => {
    const result = dataExportSchema.safeParse({
      format: 'pdf',
      entityType: 'companies',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing entityType', () => {
    const result = dataExportSchema.safeParse({ format: 'csv' });
    expect(result.success).toBe(false);
  });

  it('accepts optional filters and fields', () => {
    const result = dataExportSchema.safeParse({
      entityType: 'signals',
      filters: { status: 'active' },
      fields: ['name', 'email'],
    });
    expect(result.success).toBe(true);
  });
});

describe('dataDeletionSchema', () => {
  it('accepts valid input', () => {
    const result = dataDeletionSchema.safeParse({
      entityType: 'company',
      confirm: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid entityType values', () => {
    for (const type of ['company', 'contact', 'all']) {
      const result = dataDeletionSchema.safeParse({
        entityType: type,
        confirm: true,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid entityType', () => {
    const result = dataDeletionSchema.safeParse({
      entityType: 'signals',
      confirm: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects when confirm is not true', () => {
    const result = dataDeletionSchema.safeParse({
      entityType: 'company',
      confirm: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing confirm', () => {
    const result = dataDeletionSchema.safeParse({
      entityType: 'company',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional reason', () => {
    const result = dataDeletionSchema.safeParse({
      entityType: 'contact',
      confirm: true,
      reason: 'GDPR request',
    });
    expect(result.success).toBe(true);
  });

  it('enforces max length of 500 on reason', () => {
    const result = dataDeletionSchema.safeParse({
      entityType: 'all',
      confirm: true,
      reason: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ── Merge Schemas ──────────────────────────────────────────────────────

describe('bulkMergeSchema', () => {
  it('accepts valid input', () => {
    const result = bulkMergeSchema.safeParse({
      primaryId: 'org-1',
      mergeIds: ['org-2', 'org-3'],
    });
    expect(result.success).toBe(true);
    expect(result.data!.strategy).toBe('prefer_newer'); // default
  });

  it('applies default strategy of prefer_newer', () => {
    const result = bulkMergeSchema.safeParse({
      primaryId: 'org-1',
      mergeIds: ['org-2'],
    });
    expect(result.data!.strategy).toBe('prefer_newer');
  });

  it('accepts all valid strategies', () => {
    for (const strategy of ['prefer_newer', 'prefer_primary', 'manual']) {
      const result = bulkMergeSchema.safeParse({
        primaryId: 'org-1',
        mergeIds: ['org-2'],
        strategy,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid strategy', () => {
    const result = bulkMergeSchema.safeParse({
      primaryId: 'org-1',
      mergeIds: ['org-2'],
      strategy: 'random',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing primaryId', () => {
    const result = bulkMergeSchema.safeParse({ mergeIds: ['org-2'] });
    expect(result.success).toBe(false);
  });

  it('rejects empty mergeIds', () => {
    const result = bulkMergeSchema.safeParse({
      primaryId: 'org-1',
      mergeIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects mergeIds with more than 50 items', () => {
    const result = bulkMergeSchema.safeParse({
      primaryId: 'org-1',
      mergeIds: Array.from({ length: 51 }, (_, i) => `org-${i + 2}`),
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 50 merge IDs', () => {
    const result = bulkMergeSchema.safeParse({
      primaryId: 'org-1',
      mergeIds: Array.from({ length: 50 }, (_, i) => `org-${i + 2}`),
    });
    expect(result.success).toBe(true);
  });
});

describe('duplicateMergeSchema', () => {
  it('accepts valid input', () => {
    const result = duplicateMergeSchema.safeParse({
      primaryId: 'c1',
      secondaryId: 'c2',
    });
    expect(result.success).toBe(true);
    expect(result.data!.strategy).toBe('prefer_newer');
  });

  it('rejects missing secondaryId', () => {
    const result = duplicateMergeSchema.safeParse({ primaryId: 'c1' });
    expect(result.success).toBe(false);
  });

  it('rejects empty primaryId', () => {
    const result = duplicateMergeSchema.safeParse({
      primaryId: '',
      secondaryId: 'c2',
    });
    expect(result.success).toBe(false);
  });
});

// ── Feedback & Signals ─────────────────────────────────────────────────

describe('feedbackSchema', () => {
  it('accepts minimal valid input', () => {
    const result = feedbackSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data!.type).toBe('general'); // default
  });

  it('applies default type of general', () => {
    const result = feedbackSchema.safeParse({});
    expect(result.data!.type).toBe('general');
  });

  it('accepts all valid type values', () => {
    for (const type of ['general', 'bug', 'feature', 'intelligence_quality']) {
      const result = feedbackSchema.safeParse({ type });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    const result = feedbackSchema.safeParse({ type: 'rude_feedback' });
    expect(result.success).toBe(false);
  });

  it('accepts optional rating within 1-5', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      const result = feedbackSchema.safeParse({ rating });
      expect(result.success).toBe(true);
    }
  });

  it('rejects rating below 1', () => {
    const result = feedbackSchema.safeParse({ rating: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects rating above 5', () => {
    const result = feedbackSchema.safeParse({ rating: 6 });
    expect(result.success).toBe(false);
  });

  it('accepts optional comment', () => {
    const result = feedbackSchema.safeParse({
      companyId: 'c1',
      comment: 'Great feature!',
    });
    expect(result.success).toBe(true);
  });

  it('enforces max length of 5000 on comment', () => {
    const result = feedbackSchema.safeParse({ comment: 'a'.repeat(5001) });
    expect(result.success).toBe(false);
  });
});

describe('signalDismissSchema', () => {
  it('accepts empty input', () => {
    const result = signalDismissSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts optional reason', () => {
    const result = signalDismissSchema.safeParse({ reason: 'Not relevant' });
    expect(result.success).toBe(true);
  });

  it('enforces max length of 500 on reason', () => {
    const result = signalDismissSchema.safeParse({ reason: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

// ── Segment & Suppression ──────────────────────────────────────────────

describe('segmentCreateSchema', () => {
  it('accepts valid input with name', () => {
    const result = segmentCreateSchema.safeParse({ name: 'Enterprise Leads' });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = segmentCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = segmentCreateSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('enforces max length of 200 on name', () => {
    const result = segmentCreateSchema.safeParse({ name: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('accepts optional description and rules', () => {
    const result = segmentCreateSchema.safeParse({
      name: 'Segment',
      description: 'A segment description',
      rules: [{ field: 'industry', operator: 'eq', value: 'SaaS' }],
    });
    expect(result.success).toBe(true);
  });

  it('enforces max length of 500 on description', () => {
    const result = segmentCreateSchema.safeParse({
      name: 'Test',
      description: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('suppressionSchema', () => {
  it('accepts valid input with email', () => {
    const result = suppressionSchema.safeParse({ email: 'spam@example.com' });
    expect(result.success).toBe(true);
  });

  it('accepts valid input with domain', () => {
    const result = suppressionSchema.safeParse({ domain: 'spam.com' });
    expect(result.success).toBe(true);
  });

  it('accepts both email and domain', () => {
    const result = suppressionSchema.safeParse({
      email: 'test@test.com',
      domain: 'test.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when both email and domain are missing', () => {
    const result = suppressionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = suppressionSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts optional reason', () => {
    const result = suppressionSchema.safeParse({
      email: 'a@b.com',
      reason: 'Bounce',
    });
    expect(result.success).toBe(true);
  });

  it('enforces max length of 200 on reason', () => {
    const result = suppressionSchema.safeParse({
      email: 'a@b.com',
      reason: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

// ── Generic Schemas ────────────────────────────────────────────────────

describe('genericBodySchema', () => {
  it('accepts empty object', () => {
    const result = genericBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts arbitrary additional fields (passthrough)', () => {
    const result = genericBodySchema.safeParse({
      anything: 'goes',
      number: 42,
      nested: { deep: true },
    });
    expect(result.success).toBe(true);
  });
});

describe('genericIdBodySchema', () => {
  it('accepts valid input with id', () => {
    const result = genericIdBodySchema.safeParse({ id: 'abc-123' });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const result = genericIdBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty id', () => {
    const result = genericIdBodySchema.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });

  it('accepts arbitrary additional fields (passthrough)', () => {
    const result = genericIdBodySchema.safeParse({
      id: 'abc',
      extraField: 'value',
    });
    expect(result.success).toBe(true);
  });
});

describe('idParamSchema', () => {
  it('accepts valid id string', () => {
    const result = idParamSchema.safeParse('abc-123');
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = idParamSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('enforces max length of 100', () => {
    const result = idParamSchema.safeParse('a'.repeat(101));
    expect(result.success).toBe(false);
  });

  it('accepts id at exactly 100 chars', () => {
    const result = idParamSchema.safeParse('a'.repeat(100));
    expect(result.success).toBe(true);
  });
});

// ── Additional Schemas ─────────────────────────────────────────────────

describe('aiCacheInvalidateSchema', () => {
  it('accepts empty input', () => {
    const result = aiCacheInvalidateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts keys array', () => {
    const result = aiCacheInvalidateSchema.safeParse({ keys: ['key1', 'key2'] });
    expect(result.success).toBe(true);
  });

  it('accepts pattern string', () => {
    const result = aiCacheInvalidateSchema.safeParse({ pattern: 'ai:*' });
    expect(result.success).toBe(true);
  });
});

describe('researchQuerySchema', () => {
  it('accepts valid input with query', () => {
    const result = researchQuerySchema.safeParse({ query: 'Find competitors' });
    expect(result.success).toBe(true);
    expect(result.data!.depth).toBe('standard'); // default
  });

  it('applies default depth of standard', () => {
    const result = researchQuerySchema.safeParse({ query: 'test' });
    expect(result.data!.depth).toBe('standard');
  });

  it('rejects missing query', () => {
    const result = researchQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty query', () => {
    const result = researchQuerySchema.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });

  it('enforces max length of 5000 on query', () => {
    const result = researchQuerySchema.safeParse({ query: 'a'.repeat(5001) });
    expect(result.success).toBe(false);
  });

  it('accepts all valid depth values', () => {
    for (const depth of ['quick', 'standard', 'deep']) {
      const result = researchQuerySchema.safeParse({ query: 'test', depth });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid depth', () => {
    const result = researchQuerySchema.safeParse({ query: 'test', depth: 'thorough' });
    expect(result.success).toBe(false);
  });
});

describe('duplicateScanSchema', () => {
  it('accepts valid input', () => {
    const result = duplicateScanSchema.safeParse({ entityType: 'company' });
    expect(result.success).toBe(true);
    expect(result.data!.threshold).toBe(0.8); // default
    expect(result.data!.limit).toBe(100); // default
  });

  it('applies defaults', () => {
    const result = duplicateScanSchema.safeParse({ entityType: 'contact' });
    expect(result.data!.threshold).toBe(0.8);
    expect(result.data!.limit).toBe(100);
  });

  it('rejects invalid entityType', () => {
    const result = duplicateScanSchema.safeParse({ entityType: 'signal' });
    expect(result.success).toBe(false);
  });

  it('enforces threshold range 0-1', () => {
    const r1 = duplicateScanSchema.safeParse({ entityType: 'company', threshold: -0.1 });
    expect(r1.success).toBe(false);
    const r2 = duplicateScanSchema.safeParse({ entityType: 'company', threshold: 1.1 });
    expect(r2.success).toBe(false);
  });

  it('enforces limit range 1-1000', () => {
    const r1 = duplicateScanSchema.safeParse({ entityType: 'company', limit: 0 });
    expect(r1.success).toBe(false);
    const r2 = duplicateScanSchema.safeParse({ entityType: 'company', limit: 1001 });
    expect(r2.success).toBe(false);
  });
});

describe('webhookManageSchema', () => {
  it('accepts valid input', () => {
    const result = webhookManageSchema.safeParse({
      url: 'https://example.com/webhook',
      events: ['company.created'],
    });
    expect(result.success).toBe(true);
    expect(result.data!.active).toBe(true); // default
  });

  it('rejects missing url', () => {
    const result = webhookManageSchema.safeParse({ events: ['e1'] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL', () => {
    const result = webhookManageSchema.safeParse({
      url: 'not-a-url',
      events: ['e1'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty events array', () => {
    const result = webhookManageSchema.safeParse({
      url: 'https://example.com/webhook',
      events: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects events array with empty strings', () => {
    const result = webhookManageSchema.safeParse({
      url: 'https://example.com/webhook',
      events: [''],
    });
    expect(result.success).toBe(false);
  });
});
