/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    dataIngestion: {
      create: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    person: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    dataIngestionRow: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/intelligence/knowledge-graph', () => ({
  discoverRelationships: vi.fn().mockResolvedValue(5),
}));

vi.mock('@/lib/intelligence/ingestion/parsers', () => ({
  parseCSV: vi.fn(),
  parseExcelRow: vi.fn(),
}));

vi.mock('@/lib/intelligence/ingestion/column-detector', () => ({
  detectColumns: vi.fn(),
}));

vi.mock('@/lib/intelligence/ingestion/entity-extractor', () => ({
  extractEntities: vi.fn(),
}));

import { db } from '@/lib/db';
import { parseCSV, parseExcelRow } from '@/lib/intelligence/ingestion/parsers';
import { detectColumns } from '@/lib/intelligence/ingestion/column-detector';
import { extractEntities } from '@/lib/intelligence/ingestion/entity-extractor';
import { ingestFile, type IngestionResult } from '@/lib/intelligence/ingestion/engine';

const mockedDb = vi.mocked(db);
const mockedParseCSV = vi.mocked(parseCSV);
const mockedParseExcelRow = vi.mocked(parseExcelRow);
const mockedDetectColumns = vi.mocked(detectColumns);
const mockedExtractEntities = vi.mocked(extractEntities);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ───────────────────────────────────────────────────────────

const sampleRows = [
  { company: 'Acme Corp', website: 'acme.com', industry: 'Software' },
  { company: 'Beta Inc', website: 'beta.io', industry: 'FinTech' },
];

const sampleColumnMapping = {
  companyName: 'company',
  domain: 'website',
  industry: 'industry',
};

// ─── ingestFile ─────────────────────────────────────────────────────────

describe('ingestFile', () => {
  it('creates a dataIngestion record with correct metadata', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-1' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({
      organization: { name: 'Acme Corp', domain: 'acme.com', industry: 'Software' },
    });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    const buffer = Buffer.from('test');
    await ingestFile(buffer, 'test.csv', 'csv');

    expect(mockedDb.dataIngestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: 'test.csv',
          fileSize: 4,
          fileType: 'csv',
          status: 'processing',
        }),
      }),
    );
  });

  it('parses CSV file and processes rows', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-1' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({
      organization: { name: 'Acme Corp', domain: 'acme.com' },
    });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    const result = await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    expect(mockedParseCSV).toHaveBeenCalledWith('data');
    expect(mockedDetectColumns).toHaveBeenCalledWith(sampleRows[0]);
    expect(result.totalRows).toBe(2);
    expect(result.processedRows).toBe(2);
  });

  it('parses Excel file using parseExcelRow', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-2' } as any);
    mockedParseExcelRow.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({
      organization: { name: 'Acme Corp' },
    });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-2' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    const result = await ingestFile(Buffer.from('xlsx'), 'test.xlsx', 'xlsx');

    expect(mockedParseExcelRow).toHaveBeenCalledWith(expect.any(Buffer));
    expect(result.totalRows).toBe(2);
  });

  it('deduplicates organizations by domain', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-3' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({
      organization: { name: 'Acme Corp', domain: 'acme.com' },
    });
    mockedDb.organization.findFirst.mockResolvedValue({ id: 'existing-org' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    const result = await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    expect(mockedDb.organization.findFirst).toHaveBeenCalledWith({
      where: { domain: 'acme.com' },
    });
    expect(result.organizationsCreated).toBe(0);
  });

  it('creates new org when dedup is disabled', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-4' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({
      organization: { name: 'Acme Corp', domain: 'acme.com' },
    });
    mockedDb.organization.create.mockResolvedValue({ id: 'new-org' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    const result = await ingestFile(Buffer.from('data'), 'test.csv', 'csv', { deduplicate: false });

    expect(mockedDb.organization.findFirst).not.toHaveBeenCalled();
    expect(result.organizationsCreated).toBe(2);
  });

  it('creates people linked to organizations', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-5' } as any);
    mockedParseCSV.mockResolvedValue([
      { 'contact name': 'Alice', email: 'alice@acme.com', company: 'Acme' },
    ]);
    mockedDetectColumns.mockReturnValue({
      companyName: 'company',
      contactName: 'contact name',
      email: 'email',
    });
    mockedExtractEntities.mockReturnValue({
      organization: { name: 'Acme' },
      person: { fullName: 'Alice', email: 'alice@acme.com' },
    });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.person.findFirst.mockResolvedValue(null);
    mockedDb.person.create.mockResolvedValue({ id: 'person-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    const result = await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    expect(result.peopleCreated).toBe(1);
    expect(mockedDb.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fullName: 'Alice',
          email: 'alice@acme.com',
          organizationId: 'org-1',
          source: 'upload',
        }),
      }),
    );
  });

  it('deduplicates people by email', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-6' } as any);
    mockedParseCSV.mockResolvedValue([{ name: 'Alice', email: 'alice@acme.com' }]);
    mockedDetectColumns.mockReturnValue({ contactName: 'name', email: 'email' });
    mockedExtractEntities.mockReturnValue({
      person: { fullName: 'Alice', email: 'alice@acme.com' },
    });
    mockedDb.person.findFirst.mockResolvedValue({ id: 'existing-person' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    const result = await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    expect(mockedDb.person.findFirst).toHaveBeenCalledWith({
      where: { email: 'alice@acme.com' },
    });
    expect(result.peopleCreated).toBe(0);
  });

  it('handles row-level errors and continues processing', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-7' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    // First row succeeds, second row fails
    mockedExtractEntities
      .mockReturnValueOnce({ organization: { name: 'Acme Corp' } })
      .mockImplementationOnce(() => {
        throw new Error('Bad row data');
      });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    const result = await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    expect(result.processedRows).toBe(1);
    expect(result.failedRows).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe('Bad row data');
  });

  it('sets status to completed when all rows succeed', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-8' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({ organization: { name: 'Acme' } });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    expect(mockedDb.dataIngestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ing-8' },
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('sets status to partial when some rows fail', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-9' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities
      .mockReturnValueOnce({ organization: { name: 'Acme' } })
      .mockImplementationOnce(() => {
        throw new Error('fail');
      });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    expect(mockedDb.dataIngestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'partial' }),
      }),
    );
  });

  it('sets status to failed and re-throws on pipeline-level failure', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-10' } as any);
    mockedParseCSV.mockRejectedValue(new Error('Parse failure'));
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    await expect(ingestFile(Buffer.from('bad'), 'bad.csv', 'csv')).rejects.toThrow('Parse failure');

    expect(mockedDb.dataIngestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('triggers knowledge graph discovery after org creation', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-11' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({ organization: { name: 'Acme Corp' } });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    // Knowledge graph discovery was called (mocked in top-level vi.mock)
    const { discoverRelationships } = await import('@/lib/intelligence/knowledge-graph');
    expect(discoverRelationships).toHaveBeenCalled();
  });

  it('skips knowledge graph discovery when no orgs created', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-12' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    // No organization extracted
    mockedExtractEntities.mockReturnValue({});
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    const { discoverRelationships } = await import('@/lib/intelligence/knowledge-graph');
    expect(discoverRelationships).not.toHaveBeenCalled();
  });

  it('respects skipRows option', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-13' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({ organization: { name: 'Acme' } });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    // Skip first row, process 1
    const result = await ingestFile(Buffer.from('data'), 'test.csv', 'csv', { skipRows: 1 });

    expect(result.processedRows).toBe(1);
  });

  it('respects maxRows option', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-14' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({ organization: { name: 'Acme' } });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    // Max 1 row
    const result = await ingestFile(Buffer.from('data'), 'test.csv', 'csv', { maxRows: 1 });

    expect(result.processedRows).toBe(1);
  });

  it('stores each row as dataIngestionRow', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-15' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({ organization: { name: 'Acme' } });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    // 2 rows processed, each creates a dataIngestionRow
    expect(mockedDb.dataIngestionRow.create).toHaveBeenCalledTimes(2);
  });

  it('sets website from domain when creating org', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-16' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({
      organization: { name: 'Acme Corp', domain: 'acme.com' },
    });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    await ingestFile(Buffer.from('data'), 'test.csv', 'csv');

    expect(mockedDb.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          website: 'https://acme.com',
        }),
      }),
    );
  });

  it('passes userId to dataIngestion record', async () => {
    mockedDb.dataIngestion.create.mockResolvedValue({ id: 'ing-17' } as any);
    mockedParseCSV.mockResolvedValue(sampleRows);
    mockedDetectColumns.mockReturnValue(sampleColumnMapping);
    mockedExtractEntities.mockReturnValue({ organization: { name: 'Acme' } });
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.organization.create.mockResolvedValue({ id: 'org-1' } as any);
    mockedDb.dataIngestionRow.create.mockResolvedValue({} as any);
    mockedDb.dataIngestion.update.mockResolvedValue({} as any);

    await ingestFile(Buffer.from('data'), 'test.csv', 'csv', { userId: 'user-1' });

    expect(mockedDb.dataIngestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ uploadedBy: 'user-1' }),
      }),
    );
  });
});

// ─── ingestion/index.ts exports ────────────────────────────────────────

describe('ingestion/index exports', () => {
  it('re-exports ingestFile', async () => {
    const mod = await import('@/lib/intelligence/ingestion');
    expect(mod.ingestFile).toBe(ingestFile);
  });

  it('re-exports parseCSV from parsers', async () => {
    const mod = await import('@/lib/intelligence/ingestion');
    expect(mod.parseCSV).toBe(parseCSV);
  });

  it('re-exports detectColumns from column-detector', async () => {
    const mod = await import('@/lib/intelligence/ingestion');
    expect(mod.detectColumns).toBe(detectColumns);
  });

  it('re-exports extractEntities from entity-extractor', async () => {
    const mod = await import('@/lib/intelligence/ingestion');
    expect(mod.extractEntities).toBe(extractEntities);
  });
});
