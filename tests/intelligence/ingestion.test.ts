import { describe, it, expect } from 'vitest';
import { detectColumns, type ColumnMapping } from '@/lib/intelligence/ingestion/column-detector';
import { extractEntities } from '@/lib/intelligence/ingestion/entity-extractor';
import { parseCSV } from '@/lib/intelligence/ingestion/parsers';
import type { ParsedRow } from '@/lib/intelligence/ingestion/parsers';

// ─── Column Detection Tests ──────────────────────────────────────────────

describe('Column Detection', () => {
  it('detects standard company columns', () => {
    const row: ParsedRow = {
      'company name': 'Acme Corp',
      'website': 'acme.com',
      'industry': 'Software',
      'employees': '500',
      'revenue': '$50M',
      'location': 'San Francisco, CA',
    };

    const mapping = detectColumns(row);

    expect(mapping.companyName).toBe('company name');
    expect(mapping.domain).toBe('website');
    expect(mapping.industry).toBe('industry');
    expect(mapping.employeeCount).toBe('employees');
    expect(mapping.revenue).toBe('revenue');
    expect(mapping.headquarters).toBe('location');
  });

  it('detects contact columns', () => {
    const row: ParsedRow = {
      'contact name': 'John Smith',
      'email': 'john@acme.com',
      'title': 'VP Sales',
      'department': 'Sales',
    };

    const mapping = detectColumns(row);

    expect(mapping.contactName).toBe('contact name');
    expect(mapping.email).toBe('email');
    expect(mapping.title).toBe('title');
    expect(mapping.department).toBe('department');
  });

  it('handles ambiguous "name" column — maps to company when no email', () => {
    const row: ParsedRow = {
      'name': 'Acme Corp',
      'industry': 'Software',
    };

    const mapping = detectColumns(row);

    expect(mapping.companyName).toBe('name');
    expect(mapping.contactName).toBeUndefined();
  });

  it('handles ambiguous "name" column — maps to person when email exists', () => {
    const row: ParsedRow = {
      'name': 'John Smith',
      'email': 'john@acme.com',
    };

    const mapping = detectColumns(row);

    expect(mapping.contactName).toBe('name');
    expect(mapping.companyName).toBeUndefined();
  });

  it('handles mixed company + contact columns', () => {
    const row: ParsedRow = {
      'company': 'Acme Corp',
      'domain': 'acme.com',
      'contact': 'Jane Doe',
      'work email': 'jane@acme.com',
      'job title': 'CTO',
    };

    const mapping = detectColumns(row);

    expect(mapping.companyName).toBe('company');
    expect(mapping.domain).toBe('domain');
    expect(mapping.contactName).toBe('contact');
    expect(mapping.email).toBe('work email');
    expect(mapping.title).toBe('job title');
  });
});

// ─── Entity Extraction Tests ────────────────────────────────────────────

describe('Entity Extraction', () => {
  it('extracts organization from a row', () => {
    const row: ParsedRow = {
      'company name': 'ABC Technologies Inc.',
      'website': 'abctech.com',
      'industry': 'Enterprise Software',
      'employees': '1200',
      'revenue': '$200M',
      'location': 'New York, NY',
      'description': 'Leading enterprise SaaS provider',
    };

    const mapping: ColumnMapping = {
      companyName: 'company name',
      domain: 'website',
      industry: 'industry',
      employeeCount: 'employees',
      revenue: 'revenue',
      headquarters: 'location',
      description: 'description',
    };

    const entities = extractEntities(row, mapping);

    expect(entities.organization).toBeDefined();
    expect(entities.organization!.name).toBe('ABC Technologies');
    expect(entities.organization!.domain).toBe('abctech.com');
    expect(entities.organization!.industry).toBe('Enterprise Software');
    expect(entities.organization!.employeeCount).toBe(1200);
    expect(entities.organization!.revenue).toBe('$200M');
    expect(entities.organization!.headquarters).toBe('New York, NY');
  });

  it('extracts person from a row', () => {
    const row: ParsedRow = {
      'contact name': 'John Smith',
      'email': 'john.smith@company.com',
      'title': 'VP of Engineering',
      'department': 'Engineering',
    };

    const mapping: ColumnMapping = {
      contactName: 'contact name',
      email: 'email',
      title: 'title',
      department: 'department',
    };

    const entities = extractEntities(row, mapping);

    expect(entities.person).toBeDefined();
    expect(entities.person!.fullName).toBe('John Smith');
    expect(entities.person!.email).toBe('john.smith@company.com');
    expect(entities.person!.title).toBe('VP of Engineering');
    expect(entities.person!.department).toBe('Engineering');
  });

  it('extracts both organization and person from same row', () => {
    const row: ParsedRow = {
      'company': 'Acme Corp',
      'website': 'acme.com',
      'industry': 'SaaS',
      'contact name': 'Sarah Johnson',
      'email': 'sarah@acme.com',
      'title': 'CRO',
    };

    const mapping: ColumnMapping = {
      companyName: 'company',
      domain: 'website',
      industry: 'industry',
      contactName: 'contact name',
      email: 'email',
      title: 'title',
    };

    const entities = extractEntities(row, mapping);

    expect(entities.organization).toBeDefined();
    expect(entities.organization!.name).toBe('Acme');
    expect(entities.person).toBeDefined();
    expect(entities.person!.fullName).toBe('Sarah Johnson');
    expect(entities.person!.email).toBe('sarah@acme.com');
  });

  it('extracts domain from URL format', () => {
    const row: ParsedRow = {
      'company name': 'Test Corp',
      'website': 'https://www.testcorp.com/products',
    };

    const mapping: ColumnMapping = {
      companyName: 'company name',
      domain: 'website',
    };

    const entities = extractEntities(row, mapping);

    expect(entities.organization!.domain).toBe('testcorp.com');
  });
});

// ─── CSV Parsing Tests ──────────────────────────────────────────────────

describe('CSV Parsing', () => {
  it('parses a basic CSV with headers', async () => {
    const csv = `Company Name,Website,Industry,Employees
Acme Corp,acme.com,Software,500
Beta Inc,beta.io,FinTech,200
Gamma Ltd,gamma.co,Healthcare,1000`;

    const rows = await parseCSV(csv);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      'company name': 'Acme Corp',
      'website': 'acme.com',
      'industry': 'Software',
      'employees': '500',
    });
    expect(rows[1]['company name']).toBe('Beta Inc');
    expect(rows[2]['employees']).toBe('1000');
  });

  it('handles quoted fields with commas', async () => {
    const csv = `Name,Description
"Acme Corp, Inc.","A leading software company, founded in 2010"
Beta Ltd,"Simple description"`;

    const rows = await parseCSV(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]['description']).toBe('A leading software company, founded in 2010');
    expect(rows[1]['name']).toBe('Beta Ltd');
  });

  it('handles BOM characters', async () => {
    const csv = '\uFEFFCompany,Industry\nAcme,Software';

    const rows = await parseCSV(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]['company']).toBe('Acme');
  });

  it('handles empty rows gracefully', async () => {
    const csv = `Company,Industry
Acme,Software

Beta,FinTech`;

    const rows = await parseCSV(csv);

    expect(rows).toHaveLength(2);
  });

  it('lowercases column headers', async () => {
    const csv = `Company Name,Web Site,Email Address
Acme,acme.com,test@acme.com`;

    const rows = await parseCSV(csv);

    expect(rows[0]).toHaveProperty('company name');
    expect(rows[0]).toHaveProperty('web site');
    expect(rows[0]).toHaveProperty('email address');
  });
});
