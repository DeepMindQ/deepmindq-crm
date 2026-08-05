/**
 * DeepMindQ — Golden User Dataset for Enterprise Testing
 * Milestone 3 — Section 3.4: Golden Dataset Fixtures
 *
 * Provides test users across all RBAC roles for authentication,
 * authorization, and session management tests.
 */

export interface GoldenUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'user' | 'viewer';
  isActive: boolean;
  hasPassword: boolean;
  company: string | null;
  phone: string | null;
  avatarUrl: string | null;
  expectedPermissionCount: number;
}

export const GOLDEN_USERS: GoldenUser[] = [
  {
    id: 'user-admin-001',
    email: 'admin@deepmindq.test',
    name: 'Admin User',
    role: 'admin',
    isActive: true,
    hasPassword: true,
    company: 'DeepMindQ',
    phone: '+91 99999 00001',
    avatarUrl: '/avatars/admin.png',
    expectedPermissionCount: 49,
  },
  {
    id: 'user-operator-001',
    email: 'operator@deepmindq.test',
    name: 'Operator User',
    role: 'operator',
    isActive: true,
    hasPassword: true,
    company: 'DeepMindQ',
    phone: '+91 99999 00002',
    avatarUrl: '/avatars/operator.png',
    expectedPermissionCount: 38,
  },
  {
    id: 'user-std-001',
    email: 'user@deepmindq.test',
    name: 'Standard User',
    role: 'user',
    isActive: true,
    hasPassword: true,
    company: null,
    phone: '+91 99999 00003',
    avatarUrl: null,
    expectedPermissionCount: 18,
  },
  {
    id: 'user-viewer-001',
    email: 'viewer@deepmindq.test',
    name: 'Viewer User',
    role: 'viewer',
    isActive: true,
    hasPassword: false,
    company: null,
    phone: null,
    avatarUrl: null,
    expectedPermissionCount: 3,
  },
  {
    id: 'user-inactive-001',
    email: 'inactive@deepmindq.test',
    name: 'Inactive User',
    role: 'user',
    isActive: false,
    hasPassword: true,
    company: null,
    phone: null,
    avatarUrl: null,
    expectedPermissionCount: 18,
  },
];

// Test password hash for verification tests (pre-computed PBKDF2)
export const TEST_PASSWORD_HASH = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2$abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

// Test OTP codes and their hashes
export const TEST_OTP_CODE = '123456';
export const TEST_OTP_HASH_PREFIX = 'dmq:';

// Test session token
export const TEST_SESSION_TOKEN = 'a'.repeat(64); // 32-byte hex

// Session cookie name
export const SESSION_COOKIE_NAME = 'dmq_session';
export const CSRF_COOKIE_NAME = 'csrf-token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

// RBAC permission counts for validation
export const ROLE_PERMISSION_COUNTS: Record<string, number> = {
  admin: 49,
  operator: 38,
  user: 18,
  viewer: 3,
};

// Route authorization test data
export const PUBLIC_ROUTES = [
  '/api/request-otp',
  '/api/verify-otp',
  '/api/health',
  '/api/ping',
  '/api/ready',
  '/api/version',
  '/api/unsubscribe',
  '/api/verify-email',
  '/api/verify-queue',
  '/api/setup-db',
];

export const ADMIN_ONLY_ROUTES = [
  '/api/users/manage',
  '/api/settings/write',
  '/api/seed',
];

export const READ_ONLY_ROUTES = [
  '/api/dashboard',
  '/api/analytics',
  '/api/companies',
  '/api/contacts',
  '/api/reports',
];
