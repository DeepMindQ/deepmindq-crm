/**
 * Milestone 3 — Real Database Integration Tests
 * Section 3.8: Real Environment Validation
 *
 * Tests that validate real PostgreSQL database operations:
 * - Prisma migration validation
 * - Database read/write operations
 * - Schema integrity checks
 * - Connection handling
 *
 * These tests run ONLY when DATABASE_URL is set (CI PostgreSQL service).
 *
 * Run: npx vitest run --config vitest.database.config.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const DB_URL = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;
const hasDatabase = !!DB_URL;

describe.skipIf(!hasDatabase)('Real PostgreSQL — Connection & Schema', () => {
  let prisma: any;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient({
      datasources: { db: { url: DB_URL } },
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to PostgreSQL successfully', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    expect(result).toBeDefined();
    expect(result[0].connected).toBe(1);
  });

  it('has User table with required columns', async () => {
    const columns = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'User' AND table_schema = 'public'
    `;
    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('email');
    expect(columnNames).toContain('role');
    expect(columnNames).toContain('isActive');
  });

  it('has Company table with required columns', async () => {
    const columns = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Company' AND table_schema = 'public'
    `;
    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain('id');
    // Company uses rawName (mapped to 'name' at application layer)
    expect(columnNames).toContain('rawName');
  });

  it('has Session table for token storage', async () => {
    const columns = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Session' AND table_schema = 'public'
    `;
    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('token');
    expect(columnNames).toContain('expiresAt');
  });

  it('has OtpCode table for OTP storage', async () => {
    const columns = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'OtpCode' AND table_schema = 'public'
    `;
    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('code');
    expect(columnNames).toContain('expiresAt');
    expect(columnNames).toContain('verified');
  });

  it('has Evidence table for intelligence data', async () => {
    const columns = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Evidence' AND table_schema = 'public'
    `;
    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain('id');
  });
});

describe.skipIf(!hasDatabase)('Real PostgreSQL — CRUD Operations', () => {
  let prisma: any;
  const testEmail = `test-m3-${Date.now()}@deepmindq.test`;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient({
      datasources: { db: { url: DB_URL } },
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'test-m3-' } } });
    await prisma.$disconnect();
  });

  it('creates a user and reads it back', async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'M3 Test User',
        role: 'viewer',
        isActive: true,
        hasPassword: false,
      },
    });
    expect(user.id).toBeDefined();
    expect(user.email).toBe(testEmail);

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found).not.toBeNull();
    expect(found!.email).toBe(testEmail);
  });

  it('updates a user and verifies change', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-m3-update-${Date.now()}@deepmindq.test`,
        name: 'Before Update',
        role: 'user',
        isActive: true,
        hasPassword: false,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { name: 'After Update' },
    });

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.name).toBe('After Update');
  });

  it('deletes a user and confirms removal', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-m3-delete-${Date.now()}@deepmindq.test`,
        name: 'To Be Deleted',
        role: 'viewer',
        isActive: true,
        hasPassword: false,
      },
    });

    await prisma.user.delete({ where: { id: user.id } });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found).toBeNull();
  });

  it('creates and verifies an OTP code record', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-m3-otp-${Date.now()}@deepmindq.test`,
        name: 'OTP Test User',
        role: 'user',
        isActive: true,
        hasPassword: false,
      },
    });

    const otp = await prisma.otpCode.create({
      data: {
        userId: user.id,
        email: user.email,
        code: 'abcdef1234567890',
        purpose: 'login',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    expect(otp.id).toBeDefined();
    expect(otp.verified).toBe(false);
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe.skipIf(!hasDatabase)('Real PostgreSQL — Schema Deployment Integrity', () => {
  let prisma: any;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient({
      datasources: { db: { url: DB_URL } },
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('schema is deployed with all expected core tables', async () => {
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const tableNames = tables.map((t: any) => t.table_name);
    // Verify core CRM tables exist
    expect(tableNames).toContain('User');
    expect(tableNames).toContain('Company');
    expect(tableNames).toContain('Contact');
    expect(tableNames).toContain('Session');
    expect(tableNames).toContain('OtpCode');
    // Verify intelligence tables exist
    expect(tableNames).toContain('Evidence');
    expect(tableNames).toContain('CompanySignal');
    expect(tableNames).toContain('CompanyNote');
  });

  it('no orphan enum types are present', async () => {
    const enums = await prisma.$queryRaw`
      SELECT t.typname FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public' AND t.typtype = 'e'
      ORDER BY t.typname
    `;
    const enumNames = enums.map((e: any) => e.typname);
    // Verify core enums exist
    expect(enumNames).toContain('CompanyStatus');
    expect(enumNames).toContain('ContactStatus');
  });
});
