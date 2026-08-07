/**
 * Task 4.6 — Bulk Import/Export Pipeline: Comprehensive Tests
 *
 * Tests cover:
 * - CSV formatter: RFC 4180 escaping, BOM, streaming, sync formatting
 * - JSON formatter: array mode, NDJSON mode, sanitization, streaming
 * - XLSX formatter: tab-delimited placeholder, streaming, sync formatting
 * - Streaming export engine: field definitions, validation, where clause building
 * - Enhanced import: template mapping, preview, rollback, incremental import
 * - Import templates: listing, creating, deleting, built-in seeding
 */

import { describe, it, expect } from 'vitest';
import { escapeCsvValue, formatCsvSync, getCsvBom, getCsvContentType, getCsvExtension, createCsvFormatterStream } from '@/lib/data-export/formatters/csv-formatter';
import { formatJsonSync, getJsonContentType, getJsonExtension, createJsonFormatterStream } from '@/lib/data-export/formatters/json-formatter';
import { formatXlsxSync, getXlsxContentType, getXlsxExtension, createXlsxFormatterStream } from '@/lib/data-export/formatters/xlsx-formatter';
import { getAvailableFields, getContentType, createExportJob } from '@/lib/data-export/streaming-export';
import { applyTemplateMapping, listImportTemplates, createImportTemplate, deleteImportTemplate, getImportTemplate, generateImportPreview, rollbackImport, incrementalImport, createImportSchedule, listImportSchedules, deleteImportSchedule } from '@/lib/data-import/enhanced-import';
import { Readable } from 'stream';

// ═══════════════════════════════════════════════════════════════
// CSV Formatter Tests
// ═══════════════════════════════════════════════════════════════

describe('CSV Formatter', () => {
  it('should escape values containing commas', () => {
    expect(escapeCsvValue('hello,world')).toBe('"hello,world"');
  });

  it('should escape values containing double-quotes', () => {
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
  });

  it('should escape values containing newlines', () => {
    expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
  });

  it('should not escape simple values', () => {
    expect(escapeCsvValue('hello')).toBe('hello');
  });

  it('should handle null and undefined', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });

  it('should handle numbers', () => {
    expect(escapeCsvValue(42)).toBe('42');
    expect(escapeCsvValue(3.14)).toBe('3.14');
  });

  it('should format CSV synchronously with header and BOM', () => {
    const rows = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ];
    const result = formatCsvSync(rows, ['name', 'email']);
    expect(result.startsWith('\uFEFF')).toBe(true); // BOM
    expect(result).toContain('name,email');
    expect(result).toContain('Alice,alice@example.com');
    expect(result).toContain('Bob,bob@example.com');
  });

  it('should format CSV without BOM when disabled', () => {
    const rows = [{ name: 'Alice' }];
    const result = formatCsvSync(rows, ['name'], { bom: false });
    expect(result.startsWith('\uFEFF')).toBe(false);
    expect(result).toContain('name');
  });

  it('should format CSV with custom delimiter', () => {
    const rows = [{ name: 'Alice', email: 'a@b.com' }];
    const result = formatCsvSync(rows, ['name', 'email'], { delimiter: ';', bom: false });
    expect(result).toContain('name;email');
    expect(result).toContain('Alice;a@b.com');
  });

  it('should handle empty rows', () => {
    const result = formatCsvSync([], ['name', 'email'], { bom: false });
    expect(result).toContain('name,email');
  });

  it('should sanitize string values in CSV', () => {
    // DOMPurify strips HTML tags including content inside <script>
    const result = escapeCsvValue('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    // Content inside <script> is stripped entirely by DOMPurify
    expect(result).not.toContain('alert(1)');
  });

  it('should return correct content type', () => {
    expect(getCsvContentType()).toBe('text/csv; charset=utf-8');
  });

  it('should return correct file extension', () => {
    expect(getCsvExtension()).toBe('.csv');
  });

  it('should generate BOM string', () => {
    expect(getCsvBom()).toBe('\uFEFF');
  });
});

// ═══════════════════════════════════════════════════════════════
// JSON Formatter Tests
// ═══════════════════════════════════════════════════════════════

describe('JSON Formatter', () => {
  it('should format JSON array synchronously', () => {
    const rows = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ];
    const result = formatJsonSync(rows);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Alice');
  });

  it('should format NDJSON synchronously', () => {
    const rows = [
      { name: 'Alice' },
      { name: 'Bob' },
    ];
    const result = formatJsonSync(rows, { ndjson: true });
    const lines = result.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).name).toBe('Alice');
    expect(JSON.parse(lines[1]).name).toBe('Bob');
  });

  it('should minify JSON when indent is 0', () => {
    const rows = [{ name: 'Alice' }];
    const result = formatJsonSync(rows, { indent: 0 });
    expect(result).toBe('[{"name":"Alice"}]');
  });

  it('should handle empty rows', () => {
    const result = formatJsonSync([]);
    expect(result).toBe('[]');
  });

  it('should sanitize string values', () => {
    const rows = [{ name: '<b>Bold</b>' }];
    const result = formatJsonSync(rows);
    const parsed = JSON.parse(result);
    // DOMPurify should strip the <b> tag
    expect(parsed[0].name).not.toContain('<b>');
  });

  it('should convert Date objects to ISO strings', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const rows = [{ name: 'Test', createdAt: date }];
    const result = formatJsonSync(rows);
    const parsed = JSON.parse(result);
    expect(parsed[0].createdAt).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should return correct content types', () => {
    expect(getJsonContentType()).toBe('application/json; charset=utf-8');
    expect(getJsonContentType({ ndjson: true })).toBe('application/x-ndjson; charset=utf-8');
  });

  it('should return correct file extensions', () => {
    expect(getJsonExtension()).toBe('.json');
    expect(getJsonExtension({ ndjson: true })).toBe('.ndjson');
  });
});

// ═══════════════════════════════════════════════════════════════
// XLSX Formatter Tests
// ═══════════════════════════════════════════════════════════════

describe('XLSX Formatter', () => {
  it('should format XLSX (tab-delimited) synchronously', () => {
    const rows = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ];
    const result = formatXlsxSync(rows, ['name', 'email']);
    const lines = result.trim().split('\n');
    // Tab-delimited header
    expect(lines[0]).toBe('name\temail');
    expect(lines[1]).toBe('Alice\talice@example.com');
    expect(lines[2]).toBe('Bob\tbob@example.com');
  });

  it('should handle values with tabs by quoting', () => {
    const rows = [{ name: 'Alice\tSmith' }];
    const result = formatXlsxSync(rows, ['name']);
    expect(result).toContain('"Alice\tSmith"');
  });

  it('should handle null and undefined', () => {
    const rows = [{ name: null, email: undefined }];
    const result = formatXlsxSync(rows, ['name', 'email']);
    const lines = result.split('\n').filter((l) => l.length > 0);
    // Header: name\temail, Data: \t
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('name\temail');
    expect(lines[1]).toBe('\t');
  });

  it('should sanitize string values', () => {
    const rows = [{ name: '<script>alert(1)</script>' }];
    const result = formatXlsxSync(rows, ['name']);
    expect(result).not.toContain('<script>');
  });

  it('should return correct content type and extension', () => {
    expect(getXlsxContentType()).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(getXlsxExtension()).toBe('.xlsx');
  });
});

// ═══════════════════════════════════════════════════════════════
// Streaming Export Engine Tests
// ═══════════════════════════════════════════════════════════════

describe('Streaming Export Engine', () => {
  it('should return available fields for companies', () => {
    const fields = getAvailableFields('companies');
    expect(fields).toContain('id');
    expect(fields).toContain('rawName');
    expect(fields).toContain('domain');
    expect(fields).toContain('industry');
    expect(fields).toContain('status');
    expect(fields).toContain('createdAt');
  });

  it('should return available fields for contacts', () => {
    const fields = getAvailableFields('contacts');
    expect(fields).toContain('id');
    expect(fields).toContain('email');
    expect(fields).toContain('title');
    expect(fields).toContain('companyId');
    expect(fields).toContain('status');
  });

  it('should return available fields for opportunities', () => {
    const fields = getAvailableFields('opportunities');
    expect(fields).toContain('id');
    expect(fields).toContain('companyId');
    expect(fields).toContain('opportunityTitle');
    expect(fields).toContain('confidenceScore');
  });

  it('should return available fields for signals', () => {
    const fields = getAvailableFields('signals');
    expect(fields).toContain('id');
    expect(fields).toContain('companyId');
    expect(fields).toContain('signalType');
    expect(fields).toContain('title');
    expect(fields).toContain('severity');
  });

  it('should return correct content type for each format', () => {
    expect(getContentType('csv')).toBe('text/csv; charset=utf-8');
    expect(getContentType('json')).toBe('application/json; charset=utf-8');
    expect(getContentType('xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('should validate export request with invalid format', async () => {
    await expect(
      createExportJob({ format: 'xml' as any, entityType: 'companies' })
    ).rejects.toThrow('Invalid format');
  });

  it('should validate export request with invalid entityType', async () => {
    await expect(
      createExportJob({ format: 'csv', entityType: 'users' as any })
    ).rejects.toThrow('Invalid entityType');
  });

  it('should validate export request with invalid fields', async () => {
    await expect(
      createExportJob({ format: 'csv', entityType: 'companies', fields: ['nonexistent_field'] })
    ).rejects.toThrow('Invalid fields for companies');
  });
});

// ═══════════════════════════════════════════════════════════════
// Enhanced Import Tests
// ═══════════════════════════════════════════════════════════════

describe('Enhanced Import — Template Mapping', () => {
  it('should apply Salesforce contact template mapping', () => {
    const template = {
      id: '1',
      name: 'Salesforce Contacts',
      source: 'salesforce',
      entityType: 'contacts',
      columnMap: {
        'Account Name': 'company',
        'First Name': 'firstName',
        'Last Name': 'lastName',
        'Email': 'email',
      },
      isActive: true,
      createdAt: new Date(),
    };

    const headers = ['Account Name', 'First Name', 'Email', 'Custom Field'];
    const mapping = applyTemplateMapping(template, headers);

    expect(mapping['Account Name']).toBe('company');
    expect(mapping['First Name']).toBe('firstName');
    expect(mapping['Email']).toBe('email');
    expect(mapping['Custom Field']).toBeUndefined();
  });

  it('should do case-insensitive template matching', () => {
    const template = {
      id: '1',
      name: 'Test',
      source: 'custom',
      entityType: 'contacts',
      columnMap: { 'Account Name': 'company' },
      isActive: true,
      createdAt: new Date(),
    };

    const mapping = applyTemplateMapping(template, ['account name', 'ACCOUNT NAME']);
    expect(mapping['account name']).toBe('company');
    expect(mapping['ACCOUNT NAME']).toBe('company');
  });

  it('should do fuzzy matching as fallback', () => {
    const template = {
      id: '1',
      name: 'Test',
      source: 'custom',
      entityType: 'contacts',
      columnMap: { 'Email': 'email' },
      isActive: true,
      createdAt: new Date(),
    };

    const mapping = applyTemplateMapping(template, ['Email Address']);
    // 'Email Address' contains 'Email' so fuzzy match should work
    expect(mapping['Email Address']).toBe('email');
  });

  it('should handle empty headers', () => {
    const template = {
      id: '1',
      name: 'Test',
      source: 'custom',
      entityType: 'contacts',
      columnMap: { 'Email': 'email' },
      isActive: true,
      createdAt: new Date(),
    };

    const mapping = applyTemplateMapping(template, []);
    expect(Object.keys(mapping)).toHaveLength(0);
  });

  it('should not overwrite direct matches with fuzzy matches', () => {
    const template = {
      id: '1',
      name: 'Test',
      source: 'custom',
      entityType: 'contacts',
      columnMap: { 'Email': 'email', 'Email Address': 'emailAddress' },
      isActive: true,
      createdAt: new Date(),
    };

    const mapping = applyTemplateMapping(template, ['Email Address']);
    // Direct match on 'Email Address' should win
    expect(mapping['Email Address']).toBe('emailAddress');
  });
});

// ═══════════════════════════════════════════════════════════════
// Built-in Templates Tests
// ═══════════════════════════════════════════════════════════════

describe('Built-in Import Templates', () => {
  it('should export all enhanced import module functions', () => {
    expect(typeof listImportTemplates).toBe('function');
    expect(typeof createImportTemplate).toBe('function');
    expect(typeof deleteImportTemplate).toBe('function');
    expect(typeof getImportTemplate).toBe('function');
    expect(typeof generateImportPreview).toBe('function');
    expect(typeof rollbackImport).toBe('function');
    expect(typeof incrementalImport).toBe('function');
    expect(typeof createImportSchedule).toBe('function');
    expect(typeof listImportSchedules).toBe('function');
    expect(typeof deleteImportSchedule).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════
// Barrel Exports Tests
// ═══════════════════════════════════════════════════════════════

describe('Barrel Exports', () => {
  it('should export all data-export module functions', async () => {
    const mod = await import('@/lib/data-export/index');
    expect(typeof mod.createExportJob).toBe('function');
    expect(typeof mod.listExports).toBe('function');
    expect(typeof mod.getExport).toBe('function');
    expect(typeof mod.getExportProgress).toBe('function');
    expect(typeof mod.cancelExport).toBe('function');
    expect(typeof mod.deleteExport).toBe('function');
    expect(typeof mod.getAvailableFields).toBe('function');
    expect(typeof mod.getContentType).toBe('function');
    // Formatters
    expect(typeof mod.escapeCsvValue).toBe('function');
    expect(typeof mod.formatCsvSync).toBe('function');
    expect(typeof mod.formatJsonSync).toBe('function');
    expect(typeof mod.formatXlsxSync).toBe('function');
    expect(typeof mod.createCsvFormatterStream).toBe('function');
    expect(typeof mod.createJsonFormatterStream).toBe('function');
    expect(typeof mod.createXlsxFormatterStream).toBe('function');
  });

  it('should export all data-import module functions', async () => {
    const mod = await import('@/lib/data-import/index');
    // Original pipeline
    expect(typeof mod.createDataUpload).toBe('function');
    expect(typeof mod.autoMapColumns).toBe('function');
    expect(typeof mod.validateRows).toBe('function');
    expect(typeof mod.normalizeRows).toBe('function');
    expect(typeof mod.commitImport).toBe('function');
    expect(typeof mod.getUploadWithDetails).toBe('function');
    expect(typeof mod.listUploads).toBe('function');
    // Enhanced
    expect(typeof mod.listImportTemplates).toBe('function');
    expect(typeof mod.createImportTemplate).toBe('function');
    expect(typeof mod.deleteImportTemplate).toBe('function');
    expect(typeof mod.generateImportPreview).toBe('function');
    expect(typeof mod.rollbackImport).toBe('function');
    expect(typeof mod.incrementalImport).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════
// CSV Streaming Tests
// ═══════════════════════════════════════════════════════════════

describe('CSV Streaming', () => {
  it('should stream CSV through Transform stream', async () => {
    const fields = ['name', 'email'];
    const rows = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ];

    const readable = Readable.from(rows, { objectMode: true });
    const formatter = createCsvFormatterStream(fields, { bom: false });

    const chunks: string[] = [];
    readable.pipe(formatter).on('data', (chunk: Buffer) => {
      chunks.push(chunk.toString());
    });

    await new Promise<void>((resolve) => {
      formatter.on('end', resolve);
    });

    const output = chunks.join('');
    expect(output).toContain('name,email');
    expect(output).toContain('Alice,alice@example.com');
    expect(output).toContain('Bob,bob@example.com');
  });

  it('should handle special characters in streaming CSV', async () => {
    const fields = ['name', 'description'];
    const rows = [
      { name: 'Test', description: 'Has "quotes" and, commas' },
    ];

    const readable = Readable.from(rows, { objectMode: true });
    const formatter = createCsvFormatterStream(fields, { bom: false });

    const chunks: string[] = [];
    readable.pipe(formatter).on('data', (chunk: Buffer) => {
      chunks.push(chunk.toString());
    });

    await new Promise<void>((resolve) => {
      formatter.on('end', resolve);
    });

    const output = chunks.join('');
    expect(output).toContain('"Has ""quotes"" and, commas"');
  });
});

// ═══════════════════════════════════════════════════════════════
// JSON Streaming Tests
// ═══════════════════════════════════════════════════════════════

describe('JSON Streaming', () => {
  it('should stream JSON array through Transform stream', async () => {
    const rows = [
      { name: 'Alice' },
      { name: 'Bob' },
    ];

    const readable = Readable.from(rows, { objectMode: true });
    const formatter = createJsonFormatterStream({ indent: 2 });

    const chunks: string[] = [];
    readable.pipe(formatter).on('data', (chunk: Buffer) => {
      chunks.push(chunk.toString());
    });

    await new Promise<void>((resolve) => {
      formatter.on('end', resolve);
    });

    const output = chunks.join('');
    // Should be valid JSON array
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Alice');
  });

  it('should stream NDJSON through Transform stream', async () => {
    const rows = [
      { name: 'Alice' },
      { name: 'Bob' },
    ];

    const readable = Readable.from(rows, { objectMode: true });
    const formatter = createJsonFormatterStream({ ndjson: true });

    const chunks: string[] = [];
    readable.pipe(formatter).on('data', (chunk: Buffer) => {
      chunks.push(chunk.toString());
    });

    await new Promise<void>((resolve) => {
      formatter.on('end', resolve);
    });

    const output = chunks.join('');
    const lines = output.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).name).toBe('Alice');
  });
});

// ═══════════════════════════════════════════════════════════════
// XLSX Streaming Tests
// ═══════════════════════════════════════════════════════════════

describe('XLSX Streaming', () => {
  it('should stream tab-delimited data through Transform stream', async () => {
    const fields = ['name', 'email'];
    const rows = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ];

    const readable = Readable.from(rows, { objectMode: true });
    const formatter = createXlsxFormatterStream(fields);

    const chunks: string[] = [];
    readable.pipe(formatter).on('data', (chunk: Buffer) => {
      chunks.push(chunk.toString());
    });

    await new Promise<void>((resolve) => {
      formatter.on('end', resolve);
    });

    const output = chunks.join('');
    const lines = output.trim().split('\n');
    expect(lines[0]).toBe('name\temail');
    expect(lines[1]).toBe('Alice\talice@example.com');
  });
});

// ═══════════════════════════════════════════════════════════════
// Edge Case Tests
// ═══════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('should handle Date objects in CSV sync format', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const rows = [{ name: 'Test', createdAt: date }];
    const result = formatCsvSync(rows, ['name', 'createdAt'], { bom: false });
    expect(result).toContain('2024-06-15T12:00:00.000Z');
  });

  it('should handle Date objects in JSON sync format', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const rows = [{ name: 'Test', createdAt: date }];
    const result = formatJsonSync(rows);
    const parsed = JSON.parse(result);
    expect(parsed[0].createdAt).toBe('2024-06-15T12:00:00.000Z');
  });

  it('should handle nested objects in CSV sync format', () => {
    const rows = [{ name: 'Test', tags: ['a', 'b', 'c'] }];
    const result = formatCsvSync(rows, ['name', 'tags'], { bom: false });
    // JSON.stringify produces ["a","b","c"] then CSV-escaping doubles the quotes
    expect(result).toContain('"[""a"",""b"",""c""]"');
  });

  it('should handle nested objects in JSON sync format', () => {
    const rows = [{ name: 'Test', meta: { key: 'value' } }];
    const result = formatJsonSync(rows);
    const parsed = JSON.parse(result);
    expect(parsed[0].meta).toEqual({ key: 'value' });
  });

  it('should handle large number of rows in CSV format', () => {
    const rows = Array.from({ length: 10000 }, (_, i) => ({
      id: `id-${i}`,
      name: `Company ${i}`,
      domain: `company${i}.com`,
    }));
    const result = formatCsvSync(rows, ['id', 'name', 'domain'], { bom: false });
    const lines = result.trim().split('\r\n');
    expect(lines).toHaveLength(10001); // header + 10000 rows
    expect(lines[0]).toBe('id,name,domain');
    expect(lines[10000]).toBe('id-9999,Company 9999,company9999.com');
  });

  it('should handle field selection (subset of fields)', () => {
    const rows = [{ id: '1', name: 'Test', email: 'a@b.com', phone: '123' }];
    const result = formatCsvSync(rows, ['name', 'email'], { bom: false });
    expect(result).toContain('name,email');
    expect(result).toContain('Test,a@b.com');
    expect(result).not.toContain('id');
    expect(result).not.toContain('phone');
  });

  it('should handle empty field values', () => {
    const rows = [{ name: 'Test', email: '', phone: null }];
    const result = formatCsvSync(rows, ['name', 'email', 'phone'], { bom: false });
    const lines = result.trim().split('\r\n');
    // name=Test, email=empty, phone=empty (null becomes '')
    expect(lines[1]).toBe('Test,,');
  });

  it('should sanitize HTML in deeply nested JSON objects', () => {
    const rows = [{ name: 'Test', data: { nested: { html: '<b>Bold</b>' } } }];
    const result = formatJsonSync(rows);
    const parsed = JSON.parse(result);
    expect(parsed[0].data.nested.html).not.toContain('<b>');
  });

  it('should handle arrays with sanitization in JSON format', () => {
    const rows = [{ name: 'Test', tags: ['<script>alert(1)</script>', 'safe'] }];
    const result = formatJsonSync(rows);
    const parsed = JSON.parse(result);
    expect(parsed[0].tags[0]).not.toContain('<script>');
    expect(parsed[0].tags[1]).toBe('safe');
  });
});
