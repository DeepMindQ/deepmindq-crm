// ═══════════════════════════════════════════════════════════════════════════
// Validations — Unit Tests
//
// Tests all Zod schemas from @/lib/validations.ts.
// Covers happy paths, error paths, edge cases, and defaults.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  createCompanySchema,
  updateCompanySchema,
  createContactSchema,
  updateContactSchema,
  createOpportunitySchema,
  updateOpportunitySchema,
  createNoteSchema,
  createTimelineSchema,
  createDraftSchema,
  updateDraftSchema,
  updatePreferencesSchema,
  createKnowledgeDocSchema,
  importExecuteSchema,
  registerSchema,
  loginSchema,
  createTaskSchema,
  updateTaskSchema,
  createNotificationSchema,
  markNotificationReadSchema,
  createTagSchema,
  assignTagsSchema,
  createCustomFieldSchema,
  updateCustomFieldSchema,
  upsertCustomFieldValuesSchema,
  createSequenceSchema,
  updateSequenceSchema,
  createSequenceStepSchema,
  updateSequenceStepSchema,
  createEmailTemplateSchema,
  updateEmailTemplateSchema,
  createCommentSchema,
  createTeamSchema,
  addTeamMemberSchema,
  submitValidationSchema,
} from '@/lib/validations';

// ── Company ──────────────────────────────────────────────────────
describe('createCompanySchema', () => {
  it('accepts valid minimal input', () => {
    const result = createCompanySchema.safeParse({ name: 'Acme Inc' });
    expect(result.success).toBe(true);
  });

  it('accepts full valid input', () => {
    const result = createCompanySchema.safeParse({
      name: 'Acme Inc',
      domain: 'https://acme.com',
      website: 'https://acme.com',
      linkedinUrl: 'https://linkedin.com/company/acme',
      industry: 'SaaS',
      employeeSize: '51-200',
      country: 'US',
      location: 'San Francisco',
    });
    expect(result.success).toBe(true);
  });

  it('defaults status to "new"', () => {
    const result = createCompanySchema.parse({ name: 'Test' });
    expect(result.status).toBe('new');
  });

  it('rejects empty name', () => {
    const result = createCompanySchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only name', () => {
    const result = createCompanySchema.safeParse({ name: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects name > 200 chars', () => {
    const result = createCompanySchema.safeParse({ name: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid domain URL', () => {
    const result = createCompanySchema.safeParse({ name: 'Test', domain: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('accepts empty string for optional URL fields', () => {
    const result = createCompanySchema.safeParse({
      name: 'Test',
      domain: '',
      website: '',
      linkedinUrl: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid employeeSize', () => {
    const result = createCompanySchema.safeParse({ name: 'Test', employeeSize: 'mega' });
    expect(result.success).toBe(false);
  });
});

describe('updateCompanySchema', () => {
  it('accepts empty object (no updates)', () => {
    const result = updateCompanySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid score fields', () => {
    const result = updateCompanySchema.safeParse({
      intelligenceScore: 85,
      engagementScore: 42,
      accountPriorityScore: 99,
      opportunityScore: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects score > 100', () => {
    const result = updateCompanySchema.safeParse({ intelligenceScore: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects score < 0', () => {
    const result = updateCompanySchema.safeParse({ intelligenceScore: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts tags as array', () => {
    const result = updateCompanySchema.safeParse({ tags: ['vip', 'enterprise'] });
    expect(result.success).toBe(true);
  });

  it('accepts tags as JSON string', () => {
    const result = updateCompanySchema.safeParse({ tags: '["vip","enterprise"]' });
    expect(result.success).toBe(true);
  });

  it('accepts valid ISO datetime for lastActivityAt', () => {
    const result = updateCompanySchema.safeParse({
      lastActivityAt: '2025-01-15T10:30:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid datetime for lastActivityAt', () => {
    const result = updateCompanySchema.safeParse({ lastActivityAt: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('accepts priorityTier enum values', () => {
    for (const tier of ['HOT', 'ACTIVE', 'NURTURE', 'LOW'] as const) {
      expect(updateCompanySchema.safeParse({ priorityTier: tier }).success).toBe(true);
    }
  });

  it('rejects invalid priorityTier', () => {
    const result = updateCompanySchema.safeParse({ priorityTier: 'INVALID' });
    expect(result.success).toBe(false);
  });
});

// ── Contact ──────────────────────────────────────────────────────
describe('createContactSchema', () => {
  it('accepts valid input', () => {
    const result = createContactSchema.safeParse({
      name: 'John Doe',
      companyId: 'comp-1',
      email: 'john@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing companyId', () => {
    const result = createContactSchema.safeParse({ name: 'John' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = createContactSchema.safeParse({
      name: 'John',
      companyId: 'c1',
      email: 'not-email',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty email string', () => {
    const result = createContactSchema.safeParse({
      name: 'John',
      companyId: 'c1',
      email: '',
    });
    expect(result.success).toBe(true);
  });

  it('defaults status to "new"', () => {
    const result = createContactSchema.parse({ name: 'Jane', companyId: 'c1' });
    expect(result.status).toBe('new');
  });
});

describe('updateContactSchema', () => {
  it('accepts empty object', () => {
    expect(updateContactSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid roleBucket', () => {
    expect(updateContactSchema.safeParse({ roleBucket: 'Executive' }).success).toBe(true);
  });

  it('rejects invalid roleBucket', () => {
    expect(updateContactSchema.safeParse({ roleBucket: 'Clown' }).success).toBe(false);
  });
});

// ── Opportunity ──────────────────────────────────────────────────
describe('createOpportunitySchema', () => {
  it('accepts valid input', () => {
    const result = createOpportunitySchema.safeParse({
      title: 'Big Deal',
      companyId: 'c1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const result = createOpportunitySchema.safeParse({ companyId: 'c1' });
    expect(result.success).toBe(false);
  });

  it('rejects missing companyId', () => {
    const result = createOpportunitySchema.safeParse({ title: 'Deal' });
    expect(result.success).toBe(false);
  });

  it('defaults status to "researching"', () => {
    const result = createOpportunitySchema.parse({ title: 'Deal', companyId: 'c1' });
    expect(result.status).toBe('researching');
  });

  it('rejects title > 300 chars', () => {
    const result = createOpportunitySchema.safeParse({
      title: 'a'.repeat(301),
      companyId: 'c1',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateOpportunitySchema', () => {
  it('accepts nullable targetContactId', () => {
    expect(updateOpportunitySchema.safeParse({ targetContactId: null }).success).toBe(true);
  });
});

// ── Notes ─────────────────────────────────────────────────────────
describe('createNoteSchema', () => {
  it('accepts note with companyId', () => {
    const result = createNoteSchema.safeParse({
      body: 'Important note',
      companyId: 'c1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts note with contactId', () => {
    const result = createNoteSchema.safeParse({
      body: 'Note about contact',
      contactId: 'ct1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects note without companyId or contactId', () => {
    const result = createNoteSchema.safeParse({ body: 'Orphan note' });
    expect(result.success).toBe(false);
  });

  it('rejects empty body', () => {
    const result = createNoteSchema.safeParse({ body: '', companyId: 'c1' });
    expect(result.success).toBe(false);
  });

  it('rejects body > 10000 chars', () => {
    const result = createNoteSchema.safeParse({
      body: 'a'.repeat(10001),
      companyId: 'c1',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid noteType', () => {
    expect(
      createNoteSchema.safeParse({ body: 'Call notes', companyId: 'c1', noteType: 'call' }).success,
    ).toBe(true);
  });
});

// ── Timeline ──────────────────────────────────────────────────────
describe('createTimelineSchema', () => {
  it('accepts valid input', () => {
    const result = createTimelineSchema.safeParse({
      action: 'company_created',
      companyId: 'c1',
      details: 'Company was created',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action', () => {
    const result = createTimelineSchema.safeParse({ action: 'invalid_action' });
    expect(result.success).toBe(false);
  });

  it('rejects details > 2000 chars', () => {
    const result = createTimelineSchema.safeParse({
      action: 'note_added',
      details: 'a'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ── Drafts ────────────────────────────────────────────────────────
describe('createDraftSchema', () => {
  it('accepts valid input', () => {
    const result = createDraftSchema.safeParse({
      contactId: 'ct1',
      subject: 'Follow up',
      body: 'Dear John...',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing contactId', () => {
    const result = createDraftSchema.safeParse({ subject: 'Test', body: 'Body' });
    expect(result.success).toBe(false);
  });

  it('rejects empty subject', () => {
    const result = createDraftSchema.safeParse({ contactId: 'c1', subject: '', body: 'Body' });
    expect(result.success).toBe(false);
  });
});

describe('updateDraftSchema', () => {
  it('accepts status change', () => {
    expect(updateDraftSchema.safeParse({ status: 'sent' }).success).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(updateDraftSchema.safeParse({ status: 'unknown' }).success).toBe(false);
  });
});

// ── User Preferences ──────────────────────────────────────────────
describe('updatePreferencesSchema', () => {
  it('accepts valid preferences', () => {
    const result = updatePreferencesSchema.safeParse({
      tone: 'professional-casual',
      emailLength: 'medium',
      ctaStyle: 'direct',
      aiProvider: 'openai',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid tone', () => {
    expect(updatePreferencesSchema.safeParse({ tone: 'angry' }).success).toBe(false);
  });

  it('rejects invalid aiProvider', () => {
    expect(updatePreferencesSchema.safeParse({ aiProvider: 'claude' }).success).toBe(false);
  });
});

// ── Knowledge Library ─────────────────────────────────────────────
describe('createKnowledgeDocSchema', () => {
  it('accepts valid input', () => {
    const result = createKnowledgeDocSchema.safeParse({
      title: 'Case Study: Acme',
      docType: 'case-study',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid docType', () => {
    expect(createKnowledgeDocSchema.safeParse({ title: 'Test', docType: 'novel' }).success).toBe(
      false,
    );
  });
});

// ── Import ────────────────────────────────────────────────────────
describe('importExecuteSchema', () => {
  it('accepts valid import', () => {
    const result = importExecuteSchema.safeParse({
      importBatchId: 'batch-1',
      mapping: { name: 'Name', email: 'Email' },
      rows: [{ Name: 'John', Email: 'john@test.com' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects > 1000 rows', () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ name: `Row ${i}` }));
    const result = importExecuteSchema.safeParse({
      importBatchId: 'b1',
      mapping: {},
      rows,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing importBatchId', () => {
    const result = importExecuteSchema.safeParse({
      importBatchId: '',
      mapping: {},
      rows: [],
    });
    expect(result.success).toBe(false);
  });
});

// ── Auth ──────────────────────────────────────────────────────────
describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const result = registerSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password1',
      confirmPassword: 'Password1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects name < 2 chars', () => {
    const result = registerSchema.safeParse({
      name: 'J',
      email: 'j@e.com',
      password: 'Password1',
      confirmPassword: 'Password1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    const result = registerSchema.safeParse({
      name: 'John',
      email: 'j@e.com',
      password: 'password1',
      confirmPassword: 'password1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without number', () => {
    const result = registerSchema.safeParse({
      name: 'John',
      email: 'j@e.com',
      password: 'Passwordx',
      confirmPassword: 'Passwordx',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password < 8 chars', () => {
    const result = registerSchema.safeParse({
      name: 'John',
      email: 'j@e.com',
      password: 'Pass1',
      confirmPassword: 'Pass1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      name: 'John',
      email: 'j@e.com',
      password: 'Password1',
      confirmPassword: 'Password2',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      name: 'John',
      email: 'not-email',
      password: 'Password1',
      confirmPassword: 'Password1',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid login', () => {
    expect(loginSchema.safeParse({ email: 'j@e.com', password: 'pass' }).success).toBe(true);
  });

  it('rejects missing email', () => {
    expect(loginSchema.safeParse({ password: 'pass' }).success).toBe(false);
  });

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'j@e.com', password: '' }).success).toBe(false);
  });
});

// ── Tasks ──────────────────────────────────────────────────────────
describe('createTaskSchema', () => {
  it('accepts valid input', () => {
    const result = createTaskSchema.safeParse({ title: 'Follow up' });
    expect(result.success).toBe(true);
  });

  it('defaults status to pending and priority to medium', () => {
    const result = createTaskSchema.parse({ title: 'Task' });
    expect(result.status).toBe('pending');
    expect(result.priority).toBe('medium');
  });

  it('accepts valid ISO datetime for dueDate', () => {
    expect(
      createTaskSchema.safeParse({ title: 'T', dueDate: '2025-12-31T00:00:00Z' }).success,
    ).toBe(true);
  });

  it('accepts empty string for dueDate', () => {
    expect(createTaskSchema.safeParse({ title: 'T', dueDate: '' }).success).toBe(true);
  });
});

describe('updateTaskSchema', () => {
  it('accepts nullable dueDate', () => {
    expect(updateTaskSchema.safeParse({ dueDate: null }).success).toBe(true);
  });

  it('accepts nullable companyId', () => {
    expect(updateTaskSchema.safeParse({ companyId: null }).success).toBe(true);
  });
});

// ── Notifications ──────────────────────────────────────────────────
describe('createNotificationSchema', () => {
  it('accepts valid input', () => {
    expect(createNotificationSchema.safeParse({ title: 'Alert' }).success).toBe(true);
  });

  it('defaults type to info', () => {
    const result = createNotificationSchema.parse({ title: 'Test' });
    expect(result.type).toBe('info');
  });

  it('rejects message > 2000 chars', () => {
    expect(
      createNotificationSchema.safeParse({ title: 'T', message: 'a'.repeat(2001) }).success,
    ).toBe(false);
  });
});

describe('markNotificationReadSchema', () => {
  it('accepts read: true', () => {
    expect(markNotificationReadSchema.safeParse({ read: true }).success).toBe(true);
  });
});

// ── Tags ───────────────────────────────────────────────────────────
describe('createTagSchema', () => {
  it('accepts valid input', () => {
    expect(createTagSchema.safeParse({ name: 'VIP' }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createTagSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects name > 50 chars', () => {
    expect(createTagSchema.safeParse({ name: 'a'.repeat(51) }).success).toBe(false);
  });
});

describe('assignTagsSchema', () => {
  it('accepts valid input', () => {
    expect(
      assignTagsSchema.safeParse({ tagIds: ['t1', 't2'], entity: 'company', entityId: 'c1' })
        .success,
    ).toBe(true);
  });

  it('rejects invalid entity', () => {
    expect(
      assignTagsSchema.safeParse({ tagIds: ['t1'], entity: 'user', entityId: 'u1' }).success,
    ).toBe(false);
  });

  it('accepts empty tagIds array (Zod allows empty arrays by default)', () => {
    expect(
      assignTagsSchema.safeParse({ tagIds: [], entity: 'company', entityId: 'c1' }).success,
    ).toBe(true);
  });

  it('rejects empty string in tagIds', () => {
    expect(
      assignTagsSchema.safeParse({ tagIds: [''], entity: 'company', entityId: 'c1' }).success,
    ).toBe(false);
  });
});

// ── Custom Fields ──────────────────────────────────────────────────
describe('createCustomFieldSchema', () => {
  it('accepts valid input', () => {
    expect(
      createCustomFieldSchema.safeParse({
        entityType: 'Company',
        sourceHeader: 'Revenue',
        internalKey: 'revenue',
        displayName: 'Annual Revenue',
      }).success,
    ).toBe(true);
  });

  it('defaults dataType to text', () => {
    const result = createCustomFieldSchema.parse({
      entityType: 'Contact',
      sourceHeader: 'H',
      internalKey: 'k',
      displayName: 'Field',
    });
    expect(result.dataType).toBe('text');
  });

  it('defaults isSearchable and isFilterable to false', () => {
    const result = createCustomFieldSchema.parse({
      entityType: 'Company',
      sourceHeader: 'H',
      internalKey: 'k',
      displayName: 'F',
    });
    expect(result.isSearchable).toBe(false);
    expect(result.isFilterable).toBe(false);
  });
});

describe('upsertCustomFieldValuesSchema', () => {
  it('accepts valid input', () => {
    expect(
      upsertCustomFieldValuesSchema.safeParse({
        entityType: 'Company',
        entityId: 'c1',
        values: [
          { fieldId: 'f1', value: 'text' },
          { fieldId: 'f2', value: 42 },
        ],
      }).success,
    ).toBe(true);
  });

  it('accepts null values', () => {
    expect(
      upsertCustomFieldValuesSchema.safeParse({
        entityType: 'Company',
        entityId: 'c1',
        values: [{ fieldId: 'f1', value: null }],
      }).success,
    ).toBe(true);
  });

  it('rejects > 100 values', () => {
    const values = Array.from({ length: 101 }, (_, i) => ({
      fieldId: `f${i}`,
      value: `v${i}`,
    }));
    expect(
      upsertCustomFieldValuesSchema.safeParse({
        entityType: 'Company',
        entityId: 'c1',
        values,
      }).success,
    ).toBe(false);
  });
});

// ── Email Sequences ────────────────────────────────────────────────
describe('createSequenceSchema', () => {
  it('accepts valid input', () => {
    expect(createSequenceSchema.safeParse({ name: 'Onboarding' }).success).toBe(true);
  });
});

describe('createSequenceStepSchema', () => {
  it('accepts valid input', () => {
    const result = createSequenceStepSchema.safeParse({
      subject: 'Step 1',
      body: 'Body content',
    });
    expect(result.success).toBe(true);
  });

  it('defaults delayMinutes to 1440', () => {
    const result = createSequenceStepSchema.parse({
      subject: 'Step',
      body: 'Body',
    });
    expect(result.delayMinutes).toBe(1440);
  });

  it('rejects negative delayMinutes', () => {
    expect(
      createSequenceStepSchema.safeParse({ subject: 'S', body: 'B', delayMinutes: -1 }).success,
    ).toBe(false);
  });
});

describe('updateSequenceStepSchema', () => {
  it('accepts nullable timestamps', () => {
    expect(
      updateSequenceStepSchema.safeParse({
        sentAt: null,
        openedAt: null,
        repliedAt: null,
      }).success,
    ).toBe(true);
  });

  it('accepts empty string for sentAt', () => {
    expect(updateSequenceStepSchema.safeParse({ sentAt: '' }).success).toBe(true);
  });
});

// ── Email Templates ────────────────────────────────────────────────
describe('createEmailTemplateSchema', () => {
  it('accepts valid input', () => {
    expect(
      createEmailTemplateSchema.safeParse({
        name: 'Welcome',
        subject: 'Welcome!',
        body: 'Hello {{name}}',
      }).success,
    ).toBe(true);
  });
});

// ── Comments ───────────────────────────────────────────────────────
describe('createCommentSchema', () => {
  it('accepts comment with companyId', () => {
    expect(createCommentSchema.safeParse({ body: 'Nice!', companyId: 'c1' }).success).toBe(true);
  });

  it('accepts comment with opportunityId', () => {
    expect(createCommentSchema.safeParse({ body: 'Update', opportunityId: 'o1' }).success).toBe(
      true,
    );
  });

  it('rejects comment without any entity link', () => {
    expect(createCommentSchema.safeParse({ body: 'Orphan' }).success).toBe(false);
  });
});

// ── Teams ──────────────────────────────────────────────────────────
describe('createTeamSchema', () => {
  it('accepts valid input', () => {
    expect(createTeamSchema.safeParse({ name: 'Sales' }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createTeamSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('addTeamMemberSchema', () => {
  it('accepts valid input', () => {
    const result = addTeamMemberSchema.safeParse({ userId: 'u1' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('member');
    }
  });

  it('accepts admin role', () => {
    expect(addTeamMemberSchema.safeParse({ userId: 'u1', role: 'admin' }).success).toBe(true);
  });
});

// ── Intelligence Validation ────────────────────────────────────────
describe('submitValidationSchema', () => {
  it('accepts valid input', () => {
    const result = submitValidationSchema.safeParse({
      artifactType: 'signal_meaning',
      artifactId: 'a1',
      rating: 4,
      accuracy: 'accurate',
      relevance: 'highly_relevant',
      actionability: 'actionable_now',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null optional fields', () => {
    expect(
      submitValidationSchema.safeParse({
        artifactType: 'capability_match',
        artifactId: 'a2',
        rating: 3,
        accuracy: null,
        feedback: null,
      }).success,
    ).toBe(true);
  });

  it('rejects rating < 1', () => {
    expect(
      submitValidationSchema.safeParse({
        artifactType: 'signal_meaning',
        artifactId: 'a1',
        rating: 0,
      }).success,
    ).toBe(false);
  });

  it('rejects rating > 5', () => {
    expect(
      submitValidationSchema.safeParse({
        artifactType: 'signal_meaning',
        artifactId: 'a1',
        rating: 6,
      }).success,
    ).toBe(false);
  });

  it('accepts validatorContext as record', () => {
    expect(
      submitValidationSchema.safeParse({
        artifactType: 'evidence_quality',
        artifactId: 'a1',
        rating: 5,
        validatorContext: { source: 'human', confidence: 0.95 },
      }).success,
    ).toBe(true);
  });
});
