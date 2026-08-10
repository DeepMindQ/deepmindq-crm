/**
 * Shared helpers for Phase 9 E2E tests.
 * Provides mock session creation, request builders, and a mock Prisma client.
 */
import { vi } from 'vitest'
import { NextRequest } from 'next/server'

export function createMockSession(role: string = 'admin', userId: string = 'test-user-001') {
  return {
    id: `${userId}-session`,
    userId,
    email: `${userId}@deepmindq.com`,
    role,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

export function mockJsonRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': 'test-req-001',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

export function mockGetRequest(headers: Record<string, string> = {}): Request {
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'GET',
    headers: {
      'X-Request-Id': 'test-req-002',
      ...headers,
    },
  })
}

export function createMockDb() {
  return {
    company: { findMany: vi.fn(() => Promise.resolve([])), findFirst: vi.fn(() => Promise.resolve(null)), findUnique: vi.fn(() => Promise.resolve(null)), create: vi.fn(() => Promise.resolve({ id: 'comp-1' })), update: vi.fn(() => Promise.resolve({ id: 'comp-1' })), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })), count: vi.fn(() => Promise.resolve(0)), upsert: vi.fn(() => Promise.resolve({ id: 'comp-1' })) },
    contact: { findMany: vi.fn(() => Promise.resolve([])), findFirst: vi.fn(() => Promise.resolve(null)), findUnique: vi.fn(() => Promise.resolve(null)), create: vi.fn(() => Promise.resolve({ id: 'contact-1' })), update: vi.fn(() => Promise.resolve({ id: 'contact-1' })), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })), count: vi.fn(() => Promise.resolve(0)) },
    session: { findMany: vi.fn(() => Promise.resolve([])), findFirst: vi.fn(() => Promise.resolve(null)), findUnique: vi.fn(() => Promise.resolve(null)), create: vi.fn(() => Promise.resolve({ id: 'session-1' })), update: vi.fn(() => Promise.resolve({ id: 'session-1' })), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    user: { findMany: vi.fn(() => Promise.resolve([])), findFirst: vi.fn(() => Promise.resolve(null)), findUnique: vi.fn(() => Promise.resolve({ id: 'user-1', role: 'admin', email: 'admin@deepmindq.com' })), update: vi.fn(() => Promise.resolve({ id: 'user-1' })) },
    dataExport: { create: vi.fn(() => Promise.resolve({ id: 'export-1' })), findMany: vi.fn(() => Promise.resolve([])), update: vi.fn(() => Promise.resolve({ id: 'export-1' })), count: vi.fn(() => Promise.resolve(0)) },
    dataDeletionRequest: { create: vi.fn(() => Promise.resolve({ id: 'del-1' })), findMany: vi.fn(() => Promise.resolve([])), findUnique: vi.fn(() => Promise.resolve(null)), update: vi.fn(() => Promise.resolve({ id: 'del-1' })), count: vi.fn(() => Promise.resolve(0)) },
    comprehensiveAuditLog: { findMany: vi.fn(() => Promise.resolve([])), count: vi.fn(() => Promise.resolve(0)) },
    privacyRequest: { create: vi.fn(() => Promise.resolve({ id: 'priv-1' })), findMany: vi.fn(() => Promise.resolve([])) },
    systemSetting: { findUnique: vi.fn(() => Promise.resolve(null)), upsert: vi.fn(() => Promise.resolve({})) },
    companySignal: { findMany: vi.fn(() => Promise.resolve([])), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    companyTimelineEvent: { findMany: vi.fn(() => Promise.resolve([])) },
    aIGenerationAudit: { findMany: vi.fn(() => Promise.resolve([])), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    knowledgeEntry: { findMany: vi.fn(() => Promise.resolve([])), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    dataUpload: { create: vi.fn(() => Promise.resolve({ id: 'upload-1' })) },
    $transaction: vi.fn((fn: (tx: any) => Promise<unknown>) => fn({})),
  }
}
