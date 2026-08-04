import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const schemaPath = path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma');
function readSchema() { return fs.readFileSync(schemaPath, 'utf8'); }

describe('Schema Validation — Required Models', () => {
  it('schema file exists', () => expect(fs.existsSync(schemaPath)).toBe(true));
  it('has User model', () => expect(readSchema()).toMatch(/model\s+User\s*\{/));
  it('has Session model', () => expect(readSchema()).toMatch(/model\s+Session\s*\{/));
  it('has OtpCode model', () => expect(readSchema()).toMatch(/model\s+OtpCode\s*\{/));
  it('has Company model', () => expect(readSchema()).toMatch(/model\s+Company\s*\{/));
  it('has CompanySignal model', () => expect(readSchema()).toMatch(/model\s+CompanySignal\s*\{/));
  it('has 80+ models', () => {
    const matches = readSchema().match(/model\s+\w+\s*\{/g);
    expect(matches?.length).toBeGreaterThanOrEqual(80);
  });
});

describe('Schema Validation — Security Fields', () => {
  const s = readSchema();
  it('User has role field', () => expect(s).toMatch(/model\s+User[\s\S]*?role\s+/));
  it('Session has expiresAt', () => expect(s).toMatch(/model\s+Session[\s\S]*?expiresAt\s+/));
  it('OtpCode has attempts', () => expect(s).toMatch(/model\s+OtpCode[\s\S]*?attempts\s+/));
});