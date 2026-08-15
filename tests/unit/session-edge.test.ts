// ═══════════════════════════════════════════════════════════════════════════
// Session Edge — Unit Tests
//
// Tests validateSessionEdge from @/lib/session-edge.ts.
// Mocks @neondatabase/serverless and crypto.subtle.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @neondatabase/serverless
const mockSql = vi.fn();
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockSql),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

import { validateSessionEdge } from '@/lib/session-edge';
import { logger } from '@/lib/logger';

describe('session-edge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: mockSql returns empty array (no session found)
    mockSql.mockResolvedValue([]);
  });

  // ── Token validation ───────────────────────────────────────────
  describe('token validation', () => {
    it('returns null for empty token', async () => {
      expect(await validateSessionEdge('')).toBeNull();
    });

    it('returns null for short token (< 16 chars)', async () => {
      expect(await validateSessionEdge('short')).toBeNull();
    });

    it('returns null for 15-char token', async () => {
      expect(await validateSessionEdge('a'.repeat(15))).toBeNull();
    });

    it('returns null for undefined token', async () => {
      expect(await validateSessionEdge(undefined as unknown as string)).toBeNull();
    });
  });

  // ── Session lookup ──────────────────────────────────────────────
  describe('session lookup', () => {
    it('returns null when no rows returned', async () => {
      mockSql.mockResolvedValue([]);
      expect(await validateSessionEdge('a'.repeat(16))).toBeNull();
    });

    it('returns null when rows is null/undefined', async () => {
      mockSql.mockResolvedValue(null);
      expect(await validateSessionEdge('a'.repeat(16))).toBeNull();
    });

    it('returns user when valid session found', async () => {
      mockSql.mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          phone: null,
          company: 'Acme',
          designation: 'CEO',
          role: 'admin',
          hasPassword: true,
          avatarUrl: 'https://example.com/avatar.png',
          session_id: 'sess-1',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isActive: true,
        },
      ]);

      const user = await validateSessionEdge('valid-token-16chars');
      expect(user).not.toBeNull();
      expect(user!.id).toBe('user-1');
      expect(user!.email).toBe('user@example.com');
      expect(user!.role).toBe('admin');
      expect(user!.hasPassword).toBe(true);
      expect(user!.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('handles null name/phone/company/designation/avatarUrl', async () => {
      mockSql.mockResolvedValue([
        {
          id: 'u2',
          email: 'u2@test.com',
          name: null,
          phone: null,
          company: null,
          designation: null,
          role: 'member',
          hasPassword: false,
          avatarUrl: null,
          session_id: 's2',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          isActive: true,
        },
      ]);

      const user = await validateSessionEdge('a'.repeat(16));
      expect(user!.name).toBeNull();
      expect(user!.phone).toBeNull();
      expect(user!.company).toBeNull();
      expect(user!.designation).toBeNull();
      expect(user!.avatarUrl).toBeNull();
      expect(user!.hasPassword).toBe(false);
    });
  });

  // ── Error handling ──────────────────────────────────────────────
  describe('error handling', () => {
    it('returns null when SQL query throws', async () => {
      mockSql.mockRejectedValue(new Error('DB connection failed'));
      expect(await validateSessionEdge('a'.repeat(16))).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('logs error but returns user when UPDATE fails', async () => {
      // First call (SELECT) succeeds, second call (UPDATE) fails
      const expiresSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      mockSql.mockResolvedValueOnce([
        {
          id: 'u3',
          email: 'u3@test.com',
          name: 'Test',
          phone: null,
          company: null,
          designation: null,
          role: 'member',
          hasPassword: false,
          avatarUrl: null,
          session_id: 's3',
          expiresAt: expiresSoon,
          isActive: true,
        },
      ]);
      mockSql.mockRejectedValueOnce(new Error('UPDATE failed'));

      const user = await validateSessionEdge('a'.repeat(16));
      // User should still be returned even though UPDATE failed
      expect(user).not.toBeNull();
      expect(user!.id).toBe('u3');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE failed'),
        expect.any(Object),
      );
    });
  });

  // ── Rolling expiry ───────────────────────────────────────────────
  describe('rolling expiry', () => {
    it('extends expiry when < 7 days remaining', async () => {
      const expiresSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      mockSql.mockResolvedValue([
        {
          id: 'u4',
          email: 'u4@test.com',
          name: 'T',
          phone: null,
          company: null,
          designation: null,
          role: 'member',
          hasPassword: false,
          avatarUrl: null,
          session_id: 's4',
          expiresAt: expiresSoon,
          isActive: true,
        },
      ]);

      await validateSessionEdge('a'.repeat(16));
      // Should call SQL twice: once for SELECT, once for UPDATE
      expect(mockSql).toHaveBeenCalledTimes(2);
    });

    it('skips UPDATE when > 7 days remaining', async () => {
      const expiresLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      mockSql.mockResolvedValue([
        {
          id: 'u5',
          email: 'u5@test.com',
          name: 'T',
          phone: null,
          company: null,
          designation: null,
          role: 'member',
          hasPassword: false,
          avatarUrl: null,
          session_id: 's5',
          expiresAt: expiresLater,
          isActive: true,
        },
      ]);

      await validateSessionEdge('a'.repeat(16));
      // Should call SQL only once (SELECT), no UPDATE needed
      expect(mockSql).toHaveBeenCalledTimes(1);
    });
  });
});
