import { describe, it, expect, beforeEach } from 'vitest'
import { CsvConnector } from '../connectors/csv-connector'

describe('CsvConnector', () => {
  let connector: CsvConnector

  beforeEach(() => {
    connector = new CsvConnector()
  })

  // ─── validateConfig ─────────────────────────────────────────

  describe('validateConfig', () => {
    it('returns valid=true when fileContent is a non-empty string', () => {
      const result = connector.validateConfig({ fileContent: 'a,b\n1,2' })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid=false when fileContent is missing', () => {
      const result = connector.validateConfig({})
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('fileContent is required and must be a string')
    })

    it('returns valid=false when fileContent is not a string', () => {
      const result = connector.validateConfig({ fileContent: 123 })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('fileContent is required and must be a string')
    })

    it('returns valid=false when fileContent is an empty string', () => {
      const result = connector.validateConfig({ fileContent: '' })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('fileContent is empty')
    })

    it('returns valid=false when fileContent is whitespace only', () => {
      const result = connector.validateConfig({ fileContent: '   \n  ' })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('fileContent is empty')
    })

    it('returns valid=false when fileContent is null', () => {
      const result = connector.validateConfig({ fileContent: null })
      expect(result.valid).toBe(false)
    })
  })

  // ─── acquire — happy paths ──────────────────────────────────

  describe('acquire', () => {
    it('parses a valid CSV with a company column', async () => {
      const csv = `company,revenue,industry\nAcme Corp,100M,Technology\nBeta Inc,50M,Finance`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects).toHaveLength(2)
      expect(result.intelligenceObjects[0]!.companyIdentifier).toBe('Acme Corp')
      expect(result.intelligenceObjects[0]!.content).toContain('revenue: 100M')
      expect(result.intelligenceObjects[0]!.content).toContain('industry: Technology')
      expect(result.intelligenceObjects[1]!.companyIdentifier).toBe('Beta Inc')
    })

    it('detects company column via alternative header names', async () => {
      const csv = `account name,notes\nGamma LLC,Some note here`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects).toHaveLength(1)
      expect(result.intelligenceObjects[0]!.companyIdentifier).toBe('Gamma LLC')
    })

    it('detects "Organization" header (case-insensitive)', async () => {
      const csv = `Organization,Category\nDelta Co,Strategy`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects[0]!.companyIdentifier).toBe('Delta Co')
    })

    it('uses explicit columnMapping when provided', async () => {
      const csv = `biz_name,desc\nEpsilon Inc,Great company`
      const result = await connector.acquire({
        fileContent: csv,
        columnMapping: [{ sourceColumn: 'biz_name', targetField: 'company' }],
      })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects[0]!.companyIdentifier).toBe('Epsilon Inc')
    })

    it('extracts notes as summary when notes column exists', async () => {
      const csv = `company,notes,industry\nZeta Corp,Very promising,Fintech`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects[0]!.summary).toBe('Very promising')
      expect(result.intelligenceObjects[0]!.metadata?.notes).toBe('Very promising')
    })

    it('extracts revenue and industry into metadata', async () => {
      const csv = `company,revenue,industry\nEta Corp,200M,Healthcare`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects[0]!.metadata?.revenue).toBe('200M')
      expect(result.intelligenceObjects[0]!.metadata?.industry).toBe('Healthcare')
    })

    it('uses defaultCategory when provided and no category column', async () => {
      const csv = `company,notes\nTheta Inc,Good prospect`
      const result = await connector.acquire({
        fileContent: csv,
        defaultCategory: 'Products',
      })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects[0]!.category).toBe('Products')
    })

    it('extracts date column into capturedAt', async () => {
      const csv = `company,date,notes\nIota Corp,2024-06-15T00:00:00Z,Some info`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects[0]!.capturedAt).toBeInstanceOf(Date)
    })

    it('includes metadata with source, rowIndex, and headers', async () => {
      const csv = `company,notes\nKappa Inc,Info here`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.metadata.totalRows).toBe(1)
      expect(result.metadata.parsedObjects).toBe(1)
      expect(result.metadata.companyColumn).toBe('company')
      expect(result.metadata.source).toBe('csv_upload')
      expect(result.metadata.headers).toEqual(['company', 'notes'])
    })

    it('handles CSV with quoted fields containing commas', async () => {
      const csv = `company,description\n"Acme, Inc.","Has offices in NY, SF, and LA"`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects).toHaveLength(1)
      expect(result.intelligenceObjects[0]!.companyIdentifier).toBe('Acme, Inc.')
      expect(result.intelligenceObjects[0]!.content).toContain('Has offices in NY, SF, and LA')
    })

    it('handles CRLF line endings', async () => {
      const csv = 'company,notes\r\nLambda Corp,Some note\r\nMu Inc,Another note'
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects).toHaveLength(2)
      expect(result.intelligenceObjects[0]!.companyIdentifier).toBe('Lambda Corp')
      expect(result.intelligenceObjects[1]!.companyIdentifier).toBe('Mu Inc')
    })

    it('handles LF line endings', async () => {
      const csv = 'company,notes\nNu Corp,Note A\nXi Inc,Note B'
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects).toHaveLength(2)
    })

    it('handles escaped quotes inside quoted fields', async () => {
      const csv = `company,description\n"Acme ""Big"" Corp","They said ""hello"""`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects[0]!.companyIdentifier).toBe('Acme "Big" Corp')
    })

    it('skips rows with empty company names', async () => {
      const csv = `company,notes\nAcme Corp,Note1\n,Note2\nBeta Inc,Note3`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects).toHaveLength(2)
      expect(result.metadata.skippedRows).toBe(1)
    })

    it('skips rows with no content besides company name', async () => {
      const csv = `company,notes\nAcme Corp,\nBeta Inc,Has note`
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.intelligenceObjects).toHaveLength(1)
      expect(result.intelligenceObjects[0]!.companyIdentifier).toBe('Beta Inc')
    })
  })

  // ─── acquire — error paths ──────────────────────────────────

  describe('acquire — error cases', () => {
    it('returns error when fileContent is missing', async () => {
      const result = await connector.acquire({})

      expect(result.success).toBe(false)
      expect(result.errors).toContain('fileContent is required and must be a string')
      expect(result.intelligenceObjects).toHaveLength(0)
    })

    it('returns error for empty CSV (headers only, no data rows)', async () => {
      const csv = 'company,revenue,industry'
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('no data rows')
    })

    it('returns error when no company column is detected', async () => {
      const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA'
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('No company column found')
      expect(result.errors[0]).toContain('name, age, city')
    })

    it('returns error for CSV with 50K+ rows', async () => {
      // Build a CSV with 50,001 data rows
      const header = 'company,notes\n'
      const rows = Array.from({ length: 50001 }, (_, i) =>
        `Company${i},Note${i}`
      ).join('\n')
      const csv = header + rows

      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('50,000')
    })

    it('returns error when all rows are skipped (empty company + content)', async () => {
      const csv = 'company,notes\n,\n,'
      const result = await connector.acquire({ fileContent: csv })

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('No valid rows found')
    })

    it('handles completely empty string fileContent', async () => {
      const result = await connector.acquire({ fileContent: '' })

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('fileContent is empty')
    })
  })

  // ─── test method ────────────────────────────────────────────

  describe('test', () => {
    it('returns success for valid CSV with company column', async () => {
      const csv = 'company,notes\nAcme Corp,Good'
      const result = await connector.test({ fileContent: csv })

      expect(result.success).toBe(true)
      expect(result.message).toContain('1 rows')
      expect(result.message).toContain('company')
    })

    it('returns failure when fileContent is missing', async () => {
      const result = await connector.test({})

      expect(result.success).toBe(false)
      expect(result.message).toContain('fileContent')
    })

    it('returns failure when fileContent is empty', async () => {
      const result = await connector.test({ fileContent: '' })

      expect(result.success).toBe(false)
      expect(result.message).toContain('empty')
    })

    it('returns failure when no company column is detected', async () => {
      const csv = 'foo,bar,baz\n1,2,3'
      const result = await connector.test({ fileContent: csv })

      expect(result.success).toBe(false)
      expect(result.message).toContain('No company column')
      expect(result.message).toContain('foo, bar, baz')
    })

    it('returns failure for headers-only CSV', async () => {
      const csv = 'company,notes'
      const result = await connector.test({ fileContent: csv })

      expect(result.success).toBe(false)
      expect(result.message).toContain('no data rows')
    })
  })

  // ─── sourceType and name ────────────────────────────────────

  describe('connector identity', () => {
    it('has sourceType "csv"', () => {
      expect(connector.sourceType).toBe('csv')
    })

    it('has name "CSV File Upload"', () => {
      expect(connector.name).toBe('CSV File Upload')
    })
  })
})
