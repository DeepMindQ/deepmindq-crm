/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (must use vi.hoisted for variables referenced in vi.mock factories) ──

const { mockAuditLogCreate } = vi.hoisted(() => {
  const mockAuditLogCreate = vi.fn();
  return { mockAuditLogCreate };
});

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      create: mockAuditLogCreate,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

import { logAction } from '@/lib/audit';
import { logger } from '@/lib/logger';

// ── logAction ──────────────────────────────────────────────────────

describe('logAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-1' });
  });

  it('calls db.auditLog.create with correct action and resource', async () => {
    await logAction('company.create', 'Company', 'company-1');

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        action: 'company.create',
        resource: 'Company',
        userId: undefined,
        details: undefined,
      },
    });
  });

  it('includes userId when provided and stringifies empty details', async () => {
    await logAction('company.update', 'Company', 'company-1', {}, 'user-123');

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        action: 'company.update',
        resource: 'Company',
        userId: 'user-123',
        details: '{}',
      },
    });
  });

  it('stringifies details when provided', async () => {
    const details = { field: 'name', oldValue: 'Old', newValue: 'New' };
    await logAction('company.update', 'Company', 'company-1', details);

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        action: 'company.update',
        resource: 'Company',
        userId: undefined,
        details: JSON.stringify(details),
      },
    });
  });

  it('includes userId and details together', async () => {
    const details = { from: 'admin' };
    await logAction('role.change', 'User', 'user-1', details, 'admin-1');

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        action: 'role.change',
        resource: 'User',
        userId: 'admin-1',
        details: JSON.stringify(details),
      },
    });
  });

  it('does not throw on db failure, logs error instead', async () => {
    mockAuditLogCreate.mockRejectedValue(new Error('DB connection lost'));

    // Should not throw
    await expect(logAction('test.action', 'Test', 'id-1')).resolves.toBeUndefined();

    // Should log error
    expect(logger.error).toHaveBeenCalledWith(
      '[Audit] Failed to log action:',
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it('handles non-Error db failures', async () => {
    mockAuditLogCreate.mockRejectedValue('string error');

    await expect(logAction('test.action', 'Test', 'id-1')).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      '[Audit] Failed to log action:',
      expect.objectContaining({ error: 'string error' }),
    );
  });

  it('handles undefined details gracefully', async () => {
    await logAction('test.action', 'Test', 'id-1', undefined);

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        action: 'test.action',
        resource: 'Test',
        userId: undefined,
        details: undefined,
      },
    });
  });

  it('handles empty details object', async () => {
    await logAction('test.action', 'Test', 'id-1', {});

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        action: 'test.action',
        resource: 'Test',
        userId: undefined,
        details: JSON.stringify({}),
      },
    });
  });
});
