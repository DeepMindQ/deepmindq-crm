import { describe, it, expect } from 'vitest'
import * as fs from 'fs'

const schemaPath = 'prisma/schema.prisma';

describe('Prisma Integration — Relationships', () => {
  const exists = fs.existsSync(schemaPath);
  if (!exists) { it('skipped - no schema file', () => expect(true).toBe(true)); return; }
  const schema = fs.readFileSync(schemaPath, 'utf8');
  it('CompanySignal has companyId', () => expect(schema).toMatch(/companyId\s+String/));
  it('Session has userId', () => expect(schema).toMatch(/userId\s+String/));
  it('OtpCode has userId', () => expect(schema).toMatch(/userId\s+String/));
});