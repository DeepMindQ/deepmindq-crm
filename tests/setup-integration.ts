/**
 * Integration Test Setup — Real Database + Real Route Handlers
 *
 * Milestone 3: Testing Quality Certification
 *
 * This setup provides:
 * 1. Real Prisma client (no mocks)
 * 2. Per-test transaction isolation (rollback after each test)
 * 3. Auth helper utilities for creating test sessions
 * 4. Cleanup utilities for test data
 *
 * Usage: Import this in integration test files that need real DB access.
 * Tests that use this setup will run against a real PostgreSQL database.
 */

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// Track Prisma transaction for per-test isolation
let integrationTx: Prisma.TransactionClient | null = null
let integrationTxClient: typeof db | null = null

/**
 * Get the integration database client.
 * During a test, this returns a transaction client.
 * Outside tests, this returns the regular db client.
 */
export function getTestDb(): typeof db {
  return integrationTxClient || db
}

/**
 * Begin a Prisma transaction for test isolation.
 * All operations within the test will be rolled back on cleanup.
 */
export async function beginTestTransaction(): Promise<void> {
  if (integrationTx) {
    throw new Error('Test transaction already active. Did you forget to call rollbackTestTransaction()?')
  }

  integrationTx = await db.$begin()
  // Create a proxied client that uses the transaction
  integrationTxClient = integrationTx as unknown as typeof db
}

/**
 * Rollback the test transaction — all changes are discarded.
 */
export async function rollbackTestTransaction(): Promise<void> {
  if (integrationTx) {
    try {
      await integrationTx.$rollback()
    } catch (e) {
      // Transaction may already be rolled back
    }
    integrationTx = null
    integrationTxClient = null
  }
}

/**
 * Direct cleanup: delete test records by IDs.
 * Use this when transaction isolation is not needed (e.g., for tests
 * that span multiple describe blocks).
 */
export async function cleanupTestData(orderedDeletions: {
  table: string
  ids: string[]
}[]): Promise<void> {
  for (const { table, ids } of orderedDeletions) {
    if (ids.length === 0) continue
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)[table]?.deleteMany?.({
        where: { id: { in: ids } },
      })
    } catch (e) {
      console.error(`Cleanup error for ${table}:`, e)
    }
  }
}

/**
 * Create a test session in the database for authentication testing.
 * Returns the session token and user ID.
 */
export async function createTestSession(overrides: {
  email?: string
  name?: string
  role?: string
} = {}): Promise<{
  userId: string
  sessionToken: string
  cookieHeader: string
}> {
  const email = overrides.email || `test-${Date.now()}@deepmindq.test`
  const name = overrides.name || 'Test User'
  const role = overrides.role || 'admin'

  // Create or find user
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      role,
      emailVerified: true,
      isActive: true,
    },
  })

  // Create session with a known token
  const sessionToken = `test-session-${Date.now()}-${Math.random().toString(36).slice(2)}`

  // Hash the token the same way the real session code does
  const crypto = await import('crypto')
  const tokenHash = crypto
    .createHash('sha256')
    .update(`dmq_session:${sessionToken}`)
    .digest('hex')

  await db.session.create({
    data: {
      token: tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      userAgent: 'test-integration-agent',
      ipAddress: '127.0.0.1',
    },
  })

  return {
    userId: user.id,
    sessionToken,
    cookieHeader: `dmq_session=${sessionToken}`,
  }
}

/**
 * Delete a test session and optionally the test user.
 */
export async function deleteTestSession(userId: string, deleteUser = false): Promise<void> {
  await db.session.deleteMany({ where: { userId } })
  if (deleteUser) {
    await db.user.delete({ where: { id: userId } })
  }
}

/**
 * Build a NextRequest-compatible request object for route handler testing.
 */
export function buildRequest(
  path: string,
  options: {
    method?: string
    body?: Record<string, unknown>
    headers?: Record<string, string>
    cookie?: string
  } = {}
): Request {
  const url = new URL(path, 'http://localhost:3000')
  const headers = new Headers(options.headers || {})

  if (options.cookie) {
    headers.set('Cookie', options.cookie)
  }
  headers.set('Content-Type', 'application/json')
  headers.set('x-forwarded-for', '127.0.0.1')

  const init: RequestInit = {
    method: options.method || 'GET',
    headers,
  }

  if (options.body && options.method !== 'GET') {
    init.body = JSON.stringify(options.body)
  }

  return new Request(url.toString(), init)
}
