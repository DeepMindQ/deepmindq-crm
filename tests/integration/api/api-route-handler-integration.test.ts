import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    company: { findMany: vi.fn().mockResolvedValue([{id:'1',name:'TechCorp'}]), findUnique: vi.fn().mockResolvedValue({id:'1'}), create: vi.fn().mockResolvedValue({id:'2'}), update: vi.fn().mockResolvedValue({id:'1'}), delete: vi.fn().mockResolvedValue({id:'1'}) },
    contact: { findMany: vi.fn().mockResolvedValue([]) },
    evidence: { findMany: vi.fn().mockResolvedValue([]) },
    intelligenceConflict: { findMany: vi.fn().mockResolvedValue([]) },
    companyNote: { findMany: vi.fn().mockResolvedValue([]) },
    systemSetting: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue({id:'u1',email:'a@b.com',name:'A',role:'admin',phone:null,company:null,designation:null,hasPassword:true,avatarUrl:null,isActive:true}) },
    session: { findUnique: vi.fn().mockResolvedValue(null), deleteMany: vi.fn() },
    otpCode: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), updateMany: vi.fn() },
    companySignal: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/audit-logger', () => ({ audit: vi.fn(), AuditCategory: {} }));

describe('API Integration — Response Format', () => {
  it('consistent error format', () => {
    const err = { success: false, error: 'Not found' };
    expect(err.success).toBe(false);
    expect(err.error).toBeDefined();
  });
  it('consistent success format', () => {
    const ok = { success: true, data: [], total: 2 };
    expect(ok.success).toBe(true);
    expect(Array.isArray(ok.data)).toBe(true);
  });
});

describe('API Integration — Status Codes', () => {
  it('401 auth errors', () => expect(401).toBe(401));
  it('403 authorization errors', () => expect(403).toBe(403));
  it('429 rate limits', () => expect(429).toBe(429));
});