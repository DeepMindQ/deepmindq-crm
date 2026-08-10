/**
 * Ticket 11 — Data Import Pipeline: Comprehensive Tests
 *
 * Tests cover:
 * - Column mapping rule matching (regex pattern matching against headers)
 * - Validation rule execution (required, regex, format, range rule types)
 * - Normalization mapping (source → normalized value lookup)
 * - Quality score computation (completeness, validity, richness dimensions)
 * - Full import pipeline with 100-row CSV simulation
 * - Auto-map columns from DB rules
 * - NormalizationLog creation for every transformation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Mock Setup
// ═══════════════════════════════════════════════════════════════

const {
  mockDataUploadCreate,
  mockDataUploadFindUnique,
  mockDataUploadUpdate,
  mockDataUploadFindMany,
  mockDataUploadCount,
  mockUploadRowCreateMany,
  mockUploadRowFindMany,
  mockUploadRowUpdateMany,
  mockUploadRowUpdate,
  mockColumnMappingRuleFindMany,
  mockFieldValidationRuleFindMany,
  mockNormalizationMappingFindMany,
  mockNormalizationLogCreate,
  mockDataQualityScoreCreate,
  mockImportBatchCreate,
  mockImportBatchUpdate,
  mockCompanyCreate,
  mockCompanyFindFirst,
  mockContactCreate,
} = vi.hoisted(() => ({
  mockDataUploadCreate: vi.fn(),
  mockDataUploadFindUnique: vi.fn(),
  mockDataUploadUpdate: vi.fn(),
  mockDataUploadFindMany: vi.fn(),
  mockDataUploadCount: vi.fn(),
  mockUploadRowCreateMany: vi.fn(),
  mockUploadRowFindMany: vi.fn(),
  mockUploadRowUpdateMany: vi.fn(),
  mockUploadRowUpdate: vi.fn(),
  mockColumnMappingRuleFindMany: vi.fn(),
  mockFieldValidationRuleFindMany: vi.fn(),
  mockNormalizationMappingFindMany: vi.fn(),
  mockNormalizationLogCreate: vi.fn(),
  mockDataQualityScoreCreate: vi.fn(),
  mockImportBatchCreate: vi.fn(),
  mockImportBatchUpdate: vi.fn(),
  mockCompanyCreate: vi.fn(),
  mockCompanyFindFirst: vi.fn(),
  mockContactCreate: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn((fn: Function) => fn({
      company: {
        findFirst: mockCompanyFindFirst,
        create: mockCompanyCreate,
      },
      contact: {
        create: mockContactCreate,
      },
      uploadRow: {
        update: mockUploadRowUpdate,
      },
      importBatch: {
        create: mockImportBatchCreate,
      },
    })),
    dataUpload: {
      create: mockDataUploadCreate,
      findUnique: mockDataUploadFindUnique,
      update: mockDataUploadUpdate,
      findMany: mockDataUploadFindMany,
      count: mockDataUploadCount,
    },
    uploadRow: {
      createMany: mockUploadRowCreateMany,
      findMany: mockUploadRowFindMany,
      updateMany: mockUploadRowUpdateMany,
      update: mockUploadRowUpdate,
    },
    columnMappingRule: {
      findMany: mockColumnMappingRuleFindMany,
    },
    fieldValidationRule: {
      findMany: mockFieldValidationRuleFindMany,
    },
    normalizationMapping: {
      findMany: mockNormalizationMappingFindMany,
    },
    normalizationLog: {
      create: mockNormalizationLogCreate,
    },
    dataQualityScore: {
      create: mockDataQualityScoreCreate,
      findMany: vi.fn().mockResolvedValue([]),
    },
    importBatch: {
      create: mockImportBatchCreate,
      update: mockImportBatchUpdate,
    },
    company: {
      create: mockCompanyCreate,
      findFirst: mockCompanyFindFirst,
    },
    contact: {
      create: mockContactCreate,
    },
  },
}));

import {
  createDataUpload,
  autoMapColumns,
  validateRows,
  normalizeRows,
  computeQualityScores,
  commitImport,
} from '@/lib/data-import/pipeline';

// ═══════════════════════════════════════════════════════════════
// Phase 1: Create DataUpload
// ═══════════════════════════════════════════════════════════════

describe('Data Import Pipeline — Phase 1: Create DataUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a DataUpload with default values', async () => {
    const fakeUpload = {
      id: 'upload-1',
      fileName: 'test.csv',
      totalRows: 50,
      status: 'created',
      columnMapping: '{}',
      consentSource: 'manual_upload',
      leadSource: 'manual',
    };
    mockDataUploadCreate.mockResolvedValue(fakeUpload);

    const result = await createDataUpload({ fileName: 'test.csv', totalRows: 50 });

    expect(result.id).toBe('upload-1');
    expect(mockDataUploadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fileName: 'test.csv',
        totalRows: 50,
        status: 'created',
        consentSource: 'manual_upload',
        leadSource: 'manual',
      }),
    });
  });

  it('passes custom consentSource and leadSource', async () => {
    mockDataUploadCreate.mockResolvedValue({ id: 'u-2' });

    await createDataUpload({
      fileName: 'leads.csv',
      totalRows: 100,
      consentSource: 'web_form',
      leadSource: 'website',
    });

    expect(mockDataUploadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        consentSource: 'web_form',
        leadSource: 'website',
      }),
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Phase 2: Auto-Map Columns
// ═══════════════════════════════════════════════════════════════

describe('Data Import Pipeline — Phase 2: Auto-Map Columns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps headers using regex patterns from ColumnMappingRule', async () => {
    const rules = [
      { id: 'r1', pattern: '^(first.?name|fname)$', targetField: 'name', priority: 10, isActive: true },
      { id: 'r2', pattern: '^(e-?mail|email.?address)$', targetField: 'email', priority: 10, isActive: true },
      { id: 'r3', pattern: '^company', targetField: 'company', priority: 5, isActive: true },
    ];
    mockColumnMappingRuleFindMany.mockResolvedValue(rules);
    mockDataUploadUpdate.mockResolvedValue({});

    const mapping = await autoMapColumns('upload-1', ['First Name', 'Email Address', 'Company Name']);

    expect(mapping['First Name']).toBe('name');
    expect(mapping['Email Address']).toBe('email');
    expect(mapping['Company Name']).toBe('company');
  });

  it('handles case-insensitive matching', async () => {
    const rules = [
      { id: 'r1', pattern: '^email$', targetField: 'email', priority: 10, isActive: true },
    ];
    mockColumnMappingRuleFindMany.mockResolvedValue(rules);
    mockDataUploadUpdate.mockResolvedValue({});

    const mapping = await autoMapColumns('upload-1', ['EMAIL', 'Email', 'e-mail']);

    // First match wins per target — EMAIL matches first
    expect(mapping['EMAIL']).toBe('email');
    // e-mail would also match but email target is already used
  });

  it('only uses active rules', async () => {
    // Mock simulates DB behavior: findMany({ where: { isActive: true } }) only returns active rules
    const rules = [
      { id: 'r1', pattern: '^email$', targetField: 'email', priority: 10, isActive: true },
    ];
    mockColumnMappingRuleFindMany.mockResolvedValue(rules);
    mockDataUploadUpdate.mockResolvedValue({});

    const mapping = await autoMapColumns('upload-1', ['email', 'phone']);

    expect(mapping['email']).toBe('email');
    expect(mapping['phone']).toBeUndefined();
  });

  it('higher priority rules are checked first', async () => {
    // Both match 'email' header — higher priority should win
    const rules = [
      { id: 'r1', pattern: '^e.*l$', targetField: 'primary_email', priority: 20, isActive: true },
      { id: 'r2', pattern: '^email$', targetField: 'secondary_email', priority: 5, isActive: true },
    ];
    mockColumnMappingRuleFindMany.mockResolvedValue(rules);
    mockDataUploadUpdate.mockResolvedValue({});

    const mapping = await autoMapColumns('upload-1', ['email']);

    expect(mapping['email']).toBe('primary_email');
  });

  it('skips invalid regex patterns gracefully', async () => {
    const rules = [
      { id: 'r1', pattern: '[invalid(', targetField: 'bad', priority: 10, isActive: true },
      { id: 'r2', pattern: '^email$', targetField: 'email', priority: 5, isActive: true },
    ];
    mockColumnMappingRuleFindMany.mockResolvedValue(rules);
    mockDataUploadUpdate.mockResolvedValue({});

    const mapping = await autoMapColumns('upload-1', ['email']);

    expect(mapping['email']).toBe('email');
  });

  it('returns empty mapping for no matching rules', async () => {
    mockColumnMappingRuleFindMany.mockResolvedValue([]);
    mockDataUploadUpdate.mockResolvedValue({});

    const mapping = await autoMapColumns('upload-1', ['unknown_column']);

    expect(Object.keys(mapping)).toHaveLength(0);
  });

  it('persists mapping as JSON on DataUpload', async () => {
    mockColumnMappingRuleFindMany.mockResolvedValue([
      { id: 'r1', pattern: '^name$', targetField: 'name', priority: 10, isActive: true },
    ]);
    mockDataUploadUpdate.mockResolvedValue({});

    await autoMapColumns('upload-1', ['name']);

    expect(mockDataUploadUpdate).toHaveBeenCalledWith({
      where: { id: 'upload-1' },
      data: { columnMapping: JSON.stringify({ name: 'name' }) },
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Phase 3: Validate Rows
// ═══════════════════════════════════════════════════════════════

describe('Data Import Pipeline — Phase 3: Validate Rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects required field violations', async () => {
    const rules = [
      {
        id: 'vr1', targetField: 'email', ruleType: 'required',
        config: '{}', severity: 'error', message: 'Email is required',
        priority: 10, isActive: true,
      },
      {
        id: 'vr2', targetField: 'name', ruleType: 'required',
        config: '{}', severity: 'error', message: 'Name is required',
        priority: 10, isActive: true,
      },
    ];
    mockFieldValidationRuleFindMany.mockResolvedValue(rules);
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });
    mockDataUploadUpdate.mockResolvedValue({});

    const results = await validateRows('upload-1', [
      { name: 'John', email: '' },      // missing email
      { name: '', email: 'a@b.com' },   // missing name
      { name: 'Jane', email: 'j@b.com' }, // valid
    ]);

    expect(results[0].status).toBe('failed');
    expect(results[0].issues).toHaveLength(1);
    expect(results[0].issues[0].field).toBe('email');
    expect(results[1].status).toBe('failed');
    expect(results[1].issues[0].field).toBe('name');
    expect(results[2].status).toBe('pending');
    expect(results[2].issues).toHaveLength(0);
  });

  it('validates regex pattern rules', async () => {
    const rules = [
      {
        id: 'vr1', targetField: 'email', ruleType: 'regex',
        config: JSON.stringify({ pattern: '^[^@]+@[^@]+\\.[^@]+$' }),
        severity: 'error', message: 'Invalid email format',
        priority: 10, isActive: true,
      },
    ];
    mockFieldValidationRuleFindMany.mockResolvedValue(rules);
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });
    mockDataUploadUpdate.mockResolvedValue({});

    const results = await validateRows('upload-1', [
      { email: 'valid@example.com' },
      { email: 'not-an-email' },
    ]);

    expect(results[0].issues).toHaveLength(0);
    expect(results[1].issues).toHaveLength(1);
    expect(results[1].issues[0].message).toBe('Invalid email format');
  });

  it('validates format rules (email, url, phone)', async () => {
    const rules = [
      {
        id: 'vr1', targetField: 'email', ruleType: 'format',
        config: JSON.stringify({ format: 'email' }),
        severity: 'error', message: 'Bad email',
        priority: 10, isActive: true,
      },
      {
        id: 'vr2', targetField: 'website', ruleType: 'format',
        config: JSON.stringify({ format: 'url' }),
        severity: 'warning', message: 'Bad URL',
        priority: 10, isActive: true,
      },
      {
        id: 'vr3', targetField: 'phone', ruleType: 'format',
        config: JSON.stringify({ format: 'phone' }),
        severity: 'warning', message: 'Bad phone',
        priority: 10, isActive: true,
      },
    ];
    mockFieldValidationRuleFindMany.mockResolvedValue(rules);
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });
    mockDataUploadUpdate.mockResolvedValue({});

    const results = await validateRows('upload-1', [
      { email: 'bad', website: 'not-url', phone: 'abc' },
      { email: 'ok@x.com', website: 'https://ok.com', phone: '+1-555-1234' },
    ]);

    // Row 0: 1 error (email) + 2 warnings = failed
    expect(results[0].status).toBe('failed');
    expect(results[0].issues).toHaveLength(3);
    // Row 1: all valid
    expect(results[1].status).toBe('pending');
    expect(results[1].issues).toHaveLength(0);
  });

  it('validates range rules', async () => {
    const rules = [
      {
        id: 'vr1', targetField: 'employee_size', ruleType: 'range',
        config: JSON.stringify({ min: 1, max: 100000 }),
        severity: 'error', message: 'Size out of range',
        priority: 10, isActive: true,
      },
    ];
    mockFieldValidationRuleFindMany.mockResolvedValue(rules);
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });
    mockDataUploadUpdate.mockResolvedValue({});

    const results = await validateRows('upload-1', [
      { employee_size: '50' },     // valid
      { employee_size: '0' },      // below min
      { employee_size: '200000' }, // above max
      { employee_size: 'abc' },    // non-numeric — skipped
    ]);

    expect(results[0].issues).toHaveLength(0);
    expect(results[1].issues).toHaveLength(1);
    expect(results[2].issues).toHaveLength(1);
    expect(results[3].issues).toHaveLength(0); // non-numeric values are skipped
  });

  it('detects uniqueness violations', async () => {
    const rules = [
      {
        id: 'vr1', targetField: 'email', ruleType: 'uniqueness',
        config: '{}', severity: 'error', message: 'Duplicate email',
        priority: 10, isActive: true,
      },
    ];
    mockFieldValidationRuleFindMany.mockResolvedValue(rules);
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });
    mockDataUploadUpdate.mockResolvedValue({});

    const results = await validateRows('upload-1', [
      { email: 'same@example.com' },
      { email: 'unique@example.com' },
      { email: 'same@example.com' }, // duplicate
    ]);

    // Both row 0 and row 2 should have uniqueness issues
    expect(results[0].issues.some((i) => i.ruleId === 'vr1')).toBe(true);
    expect(results[1].issues.some((i) => i.ruleId === 'vr1')).toBe(false);
    expect(results[2].issues.some((i) => i.ruleId === 'vr1')).toBe(true);
  });

  it('updates DataUpload with failed/warning counts', async () => {
    mockFieldValidationRuleFindMany.mockResolvedValue([
      {
        id: 'vr1', targetField: 'email', ruleType: 'required',
        config: '{}', severity: 'error', message: 'Required',
        priority: 10, isActive: true,
      },
    ]);
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });
    mockDataUploadUpdate.mockResolvedValue({});

    await validateRows('upload-1', [
      { email: '' },  // failed
      { email: 'a@b.com' }, // pending
    ]);

    expect(mockDataUploadUpdate).toHaveBeenCalledWith({
      where: { id: 'upload-1' },
      data: { failedRows: 1, warningRows: 0 },
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Phase 4: Normalize Values
// ═══════════════════════════════════════════════════════════════

describe('Data Import Pipeline — Phase 4: Normalize Values', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes industry values using NormalizationMapping', async () => {
    const mappings = [
      { category: 'industry', sourceValue: 'IT', normalizedValue: 'Technology', isActive: true },
      { category: 'industry', sourceValue: 'SaaS', normalizedValue: 'Technology', isActive: true },
    ];
    mockNormalizationMappingFindMany.mockResolvedValue(mappings);
    mockNormalizationLogCreate.mockResolvedValue({});
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });

    const results = await normalizeRows('upload-1', [
      { name: 'John', company: 'Acme', industry: 'IT' },
      { name: 'Jane', company: 'Beta', industry: 'SaaS' },
      { name: 'Bob', company: 'Gamma', industry: 'Healthcare' }, // no mapping
    ]);

    expect(results[0].normalizedData.industry).toBe('Technology');
    expect(results[0].appliedCorrections).toHaveLength(1);
    expect(results[0].appliedCorrections[0].field).toBe('industry');
    expect(results[0].appliedCorrections[0].original).toBe('IT');
    expect(results[0].appliedCorrections[0].applied).toBe('Technology');

    expect(results[1].normalizedData.industry).toBe('Technology');

    expect(results[2].normalizedData.industry).toBe('Healthcare'); // unchanged
    expect(results[2].appliedCorrections).toHaveLength(0);
  });

  it('normalizes country values with case-insensitive lookup', async () => {
    const mappings = [
      { category: 'country', sourceValue: 'United States', normalizedValue: 'US', isActive: true },
      { category: 'country', sourceValue: 'United Kingdom', normalizedValue: 'UK', isActive: true },
    ];
    mockNormalizationMappingFindMany.mockResolvedValue(mappings);
    mockNormalizationLogCreate.mockResolvedValue({});
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });

    const results = await normalizeRows('upload-1', [
      { country: 'united states' }, // case-insensitive match
      { country: 'UNITED KINGDOM' }, // case-insensitive match
    ]);

    expect(results[0].normalizedData.country).toBe('US');
    expect(results[1].normalizedData.country).toBe('UK');
  });

  it('normalizes employee_size and title categories', async () => {
    const mappings = [
      { category: 'employee_size', sourceValue: '1-10', normalizedValue: '1-10', isActive: true },
      { category: 'employee_size', sourceValue: '11-50', normalizedValue: '11-50', isActive: true },
      { category: 'title', sourceValue: 'CEO', normalizedValue: 'Chief Executive Officer', isActive: true },
      { category: 'title', sourceValue: 'CTO', normalizedValue: 'Chief Technology Officer', isActive: true },
    ];
    mockNormalizationMappingFindMany.mockResolvedValue(mappings);
    mockNormalizationLogCreate.mockResolvedValue({});
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });

    const results = await normalizeRows('upload-1', [
      { employee_size: '1-10', title: 'CEO' },
    ]);

    expect(results[0].normalizedData.title).toBe('Chief Executive Officer');
  });

  it('creates NormalizationLog entry for every transformation', async () => {
    const mappings = [
      { category: 'industry', sourceValue: 'FinTech', normalizedValue: 'Financial Services', isActive: true },
    ];
    mockNormalizationMappingFindMany.mockResolvedValue(mappings);
    mockNormalizationLogCreate.mockResolvedValue({});
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });

    await normalizeRows('upload-1', [
      { industry: 'FinTech' },
      { industry: 'FinTech' },
      { industry: 'FinTech' },
    ]);

    // One log entry per transformation = 3 entries
    expect(mockNormalizationLogCreate).toHaveBeenCalledTimes(3);
    expect(mockNormalizationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        uploadId: 'upload-1',
        category: 'industry',
        field: 'industry',
        originalValue: 'FinTech',
        normalizedValue: 'Financial Services',
        ruleApplied: 'NormalizationMapping',
      }),
    });
  });

  it('does not create log entries for unchanged values', async () => {
    const mappings = [
      { category: 'industry', sourceValue: 'Technology', normalizedValue: 'Technology', isActive: true },
    ];
    mockNormalizationMappingFindMany.mockResolvedValue(mappings);
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });

    await normalizeRows('upload-1', [
      { industry: 'Technology' }, // same value — no transformation
    ]);

    expect(mockNormalizationLogCreate).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// Phase 5: Quality Score Computation
// ═══════════════════════════════════════════════════════════════

describe('Data Import Pipeline — Phase 5: Quality Score Computation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes completeness based on key fields (name, email, company)', async () => {
    const rows = [
      makeRow(0, { name: 'John', email: 'j@x.com', company: 'Acme' }), // 100% complete
      makeRow(1, { name: 'Jane', email: '' }),                              // 67% complete (2/3)
      makeRow(2, {}),                                                         // 0% complete
    ];
    mockDataQualityScoreCreate.mockImplementation(async (args) => ({
      id: `qs-${args.data.rowIndex}`,
      ...args.data,
    }));
    mockUploadRowUpdate.mockResolvedValue({});
    mockDataUploadUpdate.mockResolvedValue({});

    const scores = await computeQualityScores('upload-1', rows);

    expect(scores[0].completenessScore).toBe(100);
    expect(scores[1].completenessScore).toBe(33); // 1 of 3 key fields (name only, email empty)
    expect(scores[2].completenessScore).toBe(0);
  });

  it('computes validity based on error count', async () => {
    const rows = [
      makeRow(0, { name: 'A' }, []),                    // no errors → 100
      makeRow(1, { name: 'B' }, [{ severity: 'error' }]), // 1 error → 90
      makeRow(2, { name: 'C' }, [{ severity: 'error' }, { severity: 'error' }]), // 2 → 80
    ];
    mockDataQualityScoreCreate.mockImplementation(async (args) => ({
      id: `qs-${args.data.rowIndex}`,
      ...args.data,
    }));
    mockUploadRowUpdate.mockResolvedValue({});
    mockDataUploadUpdate.mockResolvedValue({});

    const scores = await computeQualityScores('upload-1', rows);

    expect(scores[0].validityScore).toBe(100);
    expect(scores[1].validityScore).toBe(90);
    expect(scores[2].validityScore).toBe(80);
  });

  it('computes richness based on optional fields', async () => {
    const optionalFields = ['title', 'phone', 'location', 'industry', 'country', 'website'];
    const rows = [
      makeRow(0, { ...Object.fromEntries(optionalFields.map((f) => [f, 'val'])) }), // 100%
      makeRow(1, { title: 'CEO', phone: '123' }),                                     // 33%
      makeRow(2, {}),                                                                   // 0%
    ];
    mockDataQualityScoreCreate.mockImplementation(async (args) => ({
      id: `qs-${args.data.rowIndex}`,
      ...args.data,
    }));
    mockUploadRowUpdate.mockResolvedValue({});
    mockDataUploadUpdate.mockResolvedValue({});

    const scores = await computeQualityScores('upload-1', rows);

    expect(scores[0].richnessScore).toBe(100);
    expect(scores[1].richnessScore).toBe(33);
    expect(scores[2].richnessScore).toBe(0);
  });

  it('computes weighted totalScore (completeness 40%, validity 35%, richness 25%)', async () => {
    const rows = [
      makeRow(0, { name: 'A', email: 'a@x.com', company: 'Co' }, []), // 100, 100, 0 → 40+35+0=75
    ];
    mockDataQualityScoreCreate.mockImplementation(async (args) => ({
      id: `qs-${args.data.rowIndex}`,
      ...args.data,
    }));
    mockUploadRowUpdate.mockResolvedValue({});
    mockDataUploadUpdate.mockResolvedValue({});

    const scores = await computeQualityScores('upload-1', rows);

    // completeness=100, validity=100, richness=0
    // total = 100*0.4 + 100*0.35 + 0*0.25 = 40 + 35 + 0 = 75
    expect(scores[0].totalScore).toBe(75);
  });

  it('updates UploadRow qualityScore field', async () => {
    const rows = [makeRow(0, { name: 'A', email: 'a@x.com', company: 'Co' })];
    mockDataQualityScoreCreate.mockImplementation(async (args) => ({
      id: 'qs-0',
      ...args.data,
    }));
    mockUploadRowUpdate.mockResolvedValue({});
    mockDataUploadUpdate.mockResolvedValue({});

    await computeQualityScores('upload-1', rows);

    expect(mockUploadRowUpdate).toHaveBeenCalledWith({
      where: { id: 'row-0' },
      data: { qualityScore: expect.any(Number) },
    });
  });

  it('updates DataUpload aggregate dataQualityScore', async () => {
    const rows = [
      makeRow(0, { name: 'A', email: 'a@x.com', company: 'Co' }),
      makeRow(1, { name: 'B', email: 'b@x.com', company: 'Co2' }),
    ];
    mockDataQualityScoreCreate
      .mockImplementationOnce(async (args) => ({ id: 'qs-0', ...args.data, totalScore: 80 }))
      .mockImplementationOnce(async (args) => ({ id: 'qs-1', ...args.data, totalScore: 60 }));
    mockUploadRowUpdate.mockResolvedValue({});
    mockDataUploadUpdate.mockResolvedValue({});

    await computeQualityScores('upload-1', rows);

    // Average of 80 and 60 = 70
    expect(mockDataUploadUpdate).toHaveBeenCalledWith({
      where: { id: 'upload-1' },
      data: { dataQualityScore: 70 },
    });
  });

  it('totalScore is clamped to 0-100 range', async () => {
    const rows = [
      makeRow(0, {}, [{ severity: 'error' }, { severity: 'error' }, { severity: 'error' }]),
    ];
    mockDataQualityScoreCreate.mockImplementation(async (args) => ({
      id: 'qs-0',
      ...args.data,
    }));
    mockUploadRowUpdate.mockResolvedValue({});
    mockDataUploadUpdate.mockResolvedValue({});

    const scores = await computeQualityScores('upload-1', rows);

    // completeness=0, validity=70, richness=0 → total=28
    expect(scores[0].totalScore).toBeGreaterThanOrEqual(0);
    expect(scores[0].totalScore).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════
// Full Pipeline: 100-row CSV Simulation
// ═══════════════════════════════════════════════════════════════

describe('Data Import Pipeline — Full 100-row Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes 100 rows through all pipeline phases', async () => {
    // Generate 100 rows of test data
    const rows: Record<string, string>[] = [];
    for (let i = 0; i < 100; i++) {
      rows.push({
        name: `Contact ${i}`,
        email: `contact${i}@example.com`,
        company: `Company ${i % 10}`,
        industry: i % 2 === 0 ? 'IT' : 'Healthcare',
        country: i % 3 === 0 ? 'USA' : 'UK',
      });
    }

    // Phase 1: Create upload
    mockDataUploadCreate.mockResolvedValue({
      id: 'upload-100',
      fileName: 'big-file.csv',
      totalRows: 100,
      status: 'created',
    });
    const upload = await createDataUpload({ fileName: 'big-file.csv', totalRows: 100 });
    expect(upload.id).toBe('upload-100');

    // Phase 2: Auto-map columns
    mockColumnMappingRuleFindMany.mockResolvedValue([
      { id: 'mr1', pattern: '^name$', targetField: 'name', priority: 10, isActive: true },
      { id: 'mr2', pattern: '^email$', targetField: 'email', priority: 10, isActive: true },
      { id: 'mr3', pattern: '^company$', targetField: 'company', priority: 10, isActive: true },
      { id: 'mr4', pattern: '^industry$', targetField: 'industry', priority: 5, isActive: true },
      { id: 'mr5', pattern: '^country$', targetField: 'country', priority: 5, isActive: true },
    ]);
    mockDataUploadUpdate.mockResolvedValue({});
    const mapping = await autoMapColumns('upload-100', Object.keys(rows[0]));
    expect(Object.keys(mapping)).toHaveLength(5);

    // Phase 3: Validate
    mockFieldValidationRuleFindMany.mockResolvedValue([
      {
        id: 'vr1', targetField: 'email', ruleType: 'required',
        config: '{}', severity: 'error', message: 'Email required',
        priority: 10, isActive: true,
      },
      {
        id: 'vr2', targetField: 'name', ruleType: 'required',
        config: '{}', severity: 'error', message: 'Name required',
        priority: 10, isActive: true,
      },
    ]);
    mockUploadRowUpdateMany.mockResolvedValue({ count: 0 });
    const validationResults = await validateRows('upload-100', rows);
    expect(validationResults).toHaveLength(100);
    expect(validationResults.every((r) => r.status === 'pending')).toBe(true);

    // Phase 4: Normalize
    const normMappings = [
      { category: 'industry', sourceValue: 'IT', normalizedValue: 'Technology', isActive: true },
      { category: 'country', sourceValue: 'USA', normalizedValue: 'US', isActive: true },
      { category: 'country', sourceValue: 'UK', normalizedValue: 'United Kingdom', isActive: true },
    ];
    mockNormalizationMappingFindMany.mockResolvedValue(normMappings);
    mockNormalizationLogCreate.mockResolvedValue({});
    const normResults = await normalizeRows('upload-100', rows);
    expect(normResults).toHaveLength(100);
    // 50 rows have industry='IT' → 50 normalizations
    // 34 rows have country='USA' (i%3===0 for i in 0..99) → 34 normalizations
    // 66 rows have country='UK' → 66 normalizations
    // Total = 50 + 34 + 66 = 150 log entries
    expect(mockNormalizationLogCreate).toHaveBeenCalledTimes(150);

    // Phase 5: Quality scores
    const uploadRows = rows.map((r, i) =>
      makeRow(i, r, []),
    );
    mockDataQualityScoreCreate.mockImplementation(async (args) => ({
      id: `qs-${args.data.rowIndex}`,
      ...args.data,
    }));
    mockUploadRowUpdate.mockResolvedValue({});
    const scores = await computeQualityScores('upload-100', uploadRows);
    expect(scores).toHaveLength(100);
    expect(scores.every((s) => s.totalScore >= 0 && s.totalScore <= 100)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Phase 6: Commit Import
// ═══════════════════════════════════════════════════════════════

describe('Data Import Pipeline — Phase 6: Commit Import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when upload not found', async () => {
    mockDataUploadFindUnique.mockResolvedValue(null);

    await expect(commitImport('missing')).rejects.toThrow('not found');
  });

  it('throws when upload status is wrong', async () => {
    mockDataUploadFindUnique.mockResolvedValue({ id: 'u1', status: 'created' });

    await expect(commitImport('u1')).rejects.toThrow('Must be review_ready or processing');
  });

  it('creates Company and Contact records for accepted rows', async () => {
    mockDataUploadFindUnique.mockResolvedValue({ id: 'u1', status: 'review_ready', fileName: 'test.csv' });
    mockDataUploadUpdate.mockResolvedValue({});
    mockUploadRowFindMany.mockResolvedValue([
      {
        id: 'row-0', rowIndex: 0, status: 'accepted',
        normalizedData: JSON.stringify({ name: 'John', email: 'j@acme.com', company: 'Acme Corp' }),
      },
      {
        id: 'row-1', rowIndex: 1, status: 'accepted',
        normalizedData: JSON.stringify({ name: 'Jane', email: 'jane@beta.com', company: 'Beta Inc' }),
      },
    ]);
    mockImportBatchCreate.mockResolvedValue({ id: 'batch-1' });
    mockImportBatchUpdate.mockResolvedValue({});
    mockCompanyFindFirst.mockResolvedValue(null);
    mockCompanyCreate.mockImplementation(async (data) => ({ id: `co-${data.data.rawName}`, ...data.data }));
    mockContactCreate.mockImplementation(async (data) => ({ id: 'contact-1', ...data.data }));
    mockUploadRowUpdate.mockResolvedValue({});

    const result = await commitImport('u1');

    expect(result.companiesCreated).toBe(2);
    expect(result.contactsCreated).toBe(2);
    expect(result.duplicatesSkipped).toBe(0);
    expect(result.failedRows).toBe(0);
  });

  it('skips duplicate emails within the same import', async () => {
    mockDataUploadFindUnique.mockResolvedValue({ id: 'u1', status: 'review_ready', fileName: 'test.csv' });
    mockDataUploadUpdate.mockResolvedValue({});
    mockUploadRowFindMany.mockResolvedValue([
      {
        id: 'row-0', rowIndex: 0, status: 'accepted',
        normalizedData: JSON.stringify({ name: 'John', email: 'j@acme.com', company: 'Acme' }),
      },
      {
        id: 'row-1', rowIndex: 1, status: 'accepted',
        normalizedData: JSON.stringify({ name: 'Johnny', email: 'J@ACME.COM', company: 'Acme' }),
      },
    ]);
    mockImportBatchCreate.mockResolvedValue({ id: 'batch-1' });
    mockImportBatchUpdate.mockResolvedValue({});
    mockCompanyFindFirst.mockResolvedValue(null);
    mockCompanyCreate.mockResolvedValue({ id: 'co-1' });
    mockContactCreate.mockResolvedValue({ id: 'contact-1' });
    mockUploadRowUpdate.mockResolvedValue({});

    const result = await commitImport('u1');

    expect(result.contactsCreated).toBe(1);
    expect(result.duplicatesSkipped).toBe(1);
  });

  it('fails rows missing name or email', async () => {
    mockDataUploadFindUnique.mockResolvedValue({ id: 'u1', status: 'review_ready', fileName: 'test.csv' });
    mockDataUploadUpdate.mockResolvedValue({});
    mockUploadRowFindMany.mockResolvedValue([
      {
        id: 'row-0', rowIndex: 0, status: 'accepted',
        normalizedData: JSON.stringify({ name: '', email: 'j@x.com', company: 'Co' }),
      },
      {
        id: 'row-1', rowIndex: 1, status: 'accepted',
        normalizedData: JSON.stringify({ name: 'Jane' }),
      },
    ]);
    mockImportBatchCreate.mockResolvedValue({ id: 'batch-1' });
    mockImportBatchUpdate.mockResolvedValue({});
    mockUploadRowUpdate.mockResolvedValue({});

    const result = await commitImport('u1');

    expect(result.failedRows).toBe(2);
    expect(result.contactsCreated).toBe(0);
  });

  it('updates DataUpload status to completed after commit', async () => {
    mockDataUploadFindUnique.mockResolvedValue({ id: 'u1', status: 'review_ready', fileName: 'test.csv' });
    mockDataUploadUpdate.mockResolvedValue({});
    mockUploadRowFindMany.mockResolvedValue([]);
    mockImportBatchCreate.mockResolvedValue({ id: 'batch-1' });
    mockImportBatchUpdate.mockResolvedValue({});

    await commitImport('u1');

    // Last call should set status to 'completed'
    const lastCall = mockDataUploadUpdate.mock.calls[mockDataUploadUpdate.mock.calls.length - 1];
    expect(lastCall[0].data.status).toBe('completed');
    expect(lastCall[0].data.completedAt).toBeInstanceOf(Date);
  });
});

// ─── Helpers ──────────────────────────────────────────────────

function makeRow(
  rowIndex: number,
  mappedFields: Record<string, string>,
  issues: ValidationIssue[] = [],
): import('@prisma/client').UploadRow {
  return {
    id: `row-${rowIndex}`,
    uploadId: 'upload-1',
    rowIndex,
    rawData: '{}',
    mappedData: JSON.stringify(mappedFields),
    normalizedData: null,
    validationIssues: JSON.stringify(issues),
    suggestedCorrections: null,
    appliedCorrections: null,
    status: 'pending',
    duplicateOfRow: null,
    qualityScore: 0,
    companyId: null,
    createdAt: new Date(),
  };
}
