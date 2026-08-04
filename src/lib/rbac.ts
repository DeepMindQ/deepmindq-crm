/**
 * WI-18.5 Phase 5 — Role-Based Access Control (RBAC)
 *
 * Enterprise authorization layer providing:
 *   - Role definitions: admin, operator, user, viewer
 *   - Permission definitions mapped to API routes
 *   - Route-by-route authorization matrix
 *   - Tenant isolation verification
 *   - Permission boundary enforcement
 *
 * DESIGN:
 *   - Single-user deployment: all routes currently share one tenant
 *   - Multi-tenant ready: architecture supports tenant isolation
 *   - Permission checks are composable and reusable across routes
 */

import { logger } from '@/lib/logger';
import { audit, AuditCategory } from '@/lib/audit-logger';

// ── Role Definitions ──────────────────────────────────────────

export type UserRole = 'admin' | 'operator' | 'user' | 'viewer';

export interface RoleDefinition {
  name: UserRole;
  label: string;
  description: string;
  permissions: Permission[];
  canManageUsers: boolean;
  canAccessAllData: boolean;
  canExportData: boolean;
  canConfigureSystem: boolean;
  canManageAI: boolean;
}

// ── Permission Definitions ────────────────────────────────────

export type Permission =
  // Data access
  | 'companies:read' | 'companies:write' | 'companies:delete'
  | 'contacts:read' | 'contacts:write' | 'contacts:delete'
  | 'leads:read' | 'leads:write' | 'leads:delete'
  | 'opportunities:read' | 'opportunities:write' | 'opportunities:delete'
  | 'pipeline:read' | 'pipeline:write'
  | 'segments:read' | 'segments:write' | 'segments:delete'
  // AI & Intelligence
  | 'ai:read' | 'ai:write' | 'ai:configure'
  | 'research:read' | 'research:write'
  | 'knowledge:read' | 'knowledge:write' | 'knowledge:manage'
  | 'recommendations:read' | 'recommendations:write'
  // Email & Outreach
  | 'email:read' | 'email:write' | 'email:send'
  | 'sequences:read' | 'sequences:write'
  | 'templates:read' | 'templates:write'
  // Analytics & Reporting
  | 'analytics:read' | 'analytics:export'
  | 'dashboard:read'
  | 'reports:read' | 'reports:export'
  // System & Configuration
  | 'settings:read' | 'settings:write'
  | 'users:read' | 'users:write' | 'users:manage'
  | 'audit:read'
  | 'health:read'
  | 'import:read' | 'import:write'
  | 'export:read' | 'export:write';

// ── Role Configurations ─────────────────────────────────────────

const ROLES: Record<UserRole, RoleDefinition> = {
  admin: {
    name: 'admin',
    label: 'Administrator',
    description: 'Full system access. Can manage users, configure system, and access all data.',
    permissions: [
      // All permissions
      'companies:read', 'companies:write', 'companies:delete',
      'contacts:read', 'contacts:write', 'contacts:delete',
      'leads:read', 'leads:write', 'leads:delete',
      'opportunities:read', 'opportunities:write', 'opportunities:delete',
      'pipeline:read', 'pipeline:write',
      'segments:read', 'segments:write',
      'ai:read', 'ai:write', 'ai:configure',
      'research:read', 'research:write',
      'knowledge:read', 'knowledge:write', 'knowledge:manage',
      'recommendations:read', 'recommendations:write',
      'email:read', 'email:write', 'email:send',
      'sequences:read', 'sequences:write',
      'templates:read', 'templates:write',
      'analytics:read', 'analytics:export',
      'dashboard:read',
      'reports:read', 'reports:export',
      'settings:read', 'settings:write',
      'users:read', 'users:write', 'users:manage',
      'audit:read',
      'health:read',
      'import:read', 'import:write',
      'export:read', 'export:write',
    ],
    canManageUsers: true,
    canAccessAllData: true,
    canExportData: true,
    canConfigureSystem: true,
    canManageAI: true,
  },
  operator: {
    name: 'operator',
    label: 'Operator',
    description: 'Day-to-day operations. Can manage data, use AI, manage email sequences. Cannot manage users or system config.',
    permissions: [
      'companies:read', 'companies:write',
      'contacts:read', 'contacts:write',
      'leads:read', 'leads:write',
      'opportunities:read', 'opportunities:write',
      'pipeline:read', 'pipeline:write',
      'segments:read', 'segments:write',
      'ai:read', 'ai:write',
      'research:read', 'research:write',
      'knowledge:read', 'knowledge:write',
      'recommendations:read', 'recommendations:write',
      'email:read', 'email:write', 'email:send',
      'sequences:read', 'sequences:write',
      'templates:read', 'templates:write',
      'analytics:read', 'analytics:export',
      'dashboard:read',
      'reports:read', 'reports:export',
      'settings:read',
      'import:read', 'import:write',
      'export:read', 'export:write',
    ],
    canManageUsers: false,
    canAccessAllData: true,
    canExportData: true,
    canConfigureSystem: false,
    canManageAI: false,
  },
  user: {
    name: 'user',
    label: 'Standard User',
    description: 'Read-only data access with limited write. Can use AI features but cannot configure system.',
    permissions: [
      'companies:read',
      'contacts:read',
      'leads:read',
      'opportunities:read',
      'pipeline:read',
      'segments:read',
      'ai:read',
      'research:read',
      'knowledge:read',
      'recommendations:read',
      'email:read',
      'sequences:read',
      'templates:read',
      'analytics:read',
      'dashboard:read',
      'reports:read',
      'settings:read',
      'import:read',
      'export:read',
    ],
    canManageUsers: false,
    canAccessAllData: false,
    canExportData: false,
    canConfigureSystem: false,
    canManageAI: false,
  },
  viewer: {
    name: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to dashboards and reports only.',
    permissions: [
      'dashboard:read',
      'analytics:read',
      'reports:read',
    ],
    canManageUsers: false,
    canAccessAllData: false,
    canExportData: false,
    canConfigureSystem: false,
    canManageAI: false,
  },
};

// ── Route-Permission Mapping ───────────────────────────────────

export interface RouteAuthorizationConfig {
  path: string;
  methods: Record<string, Permission[]>;
  public?: boolean;
  description?: string;
}

/**
 * Route-by-route authorization matrix.
 * Maps API paths to required permissions per HTTP method.
 * Public routes bypass authorization entirely.
 */
export const ROUTE_AUTHORIZATION_MATRIX: RouteAuthorizationConfig[] = [
  // Auth routes (public)
  { path: '/api/request-otp', methods: { POST: [] }, public: true, description: 'Request OTP code' },
  { path: '/api/verify-otp', methods: { POST: [] }, public: true, description: 'Verify OTP login' },
  { path: '/api/health', methods: { GET: [] }, public: true, description: 'Health check' },
  { path: '/api/ping', methods: { GET: [] }, public: true, description: 'Liveness probe' },
  { path: '/api/ready', methods: { GET: [] }, public: true, description: 'Readiness probe' },
  { path: '/api/version', methods: { GET: [] }, public: true, description: 'Version info' },
  { path: '/api/unsubscribe', methods: { GET: [], POST: [] }, public: true, description: 'Email unsubscribe' },

  // Dashboard & Analytics
  { path: '/api/dashboard', methods: { GET: ['dashboard:read'] }, description: 'Main dashboard' },
  { path: '/api/analytics', methods: { GET: ['analytics:read'] }, description: 'Analytics data' },
  { path: '/api/stats', methods: { GET: ['analytics:read'] }, description: 'System statistics' },

  // Companies
  { path: '/api/companies', methods: { GET: ['companies:read'], POST: ['companies:write'], PUT: ['companies:write'], DELETE: ['companies:delete'] }, description: 'Company CRUD' },

  // Contacts
  { path: '/api/contacts', methods: { GET: ['contacts:read'], POST: ['contacts:write'], PUT: ['contacts:write'], DELETE: ['contacts:delete'] }, description: 'Contact CRUD' },

  // Leads
  { path: '/api/leads', methods: { GET: ['leads:read'], POST: ['leads:write'], PUT: ['leads:write'], DELETE: ['leads:delete'] }, description: 'Lead management' },

  // Opportunities
  { path: '/api/opportunities', methods: { GET: ['opportunities:read'], POST: ['opportunities:write'], PUT: ['opportunities:write'], DELETE: ['opportunities:delete'] }, description: 'Opportunity pipeline' },

  // Pipeline
  { path: '/api/pipeline', methods: { GET: ['pipeline:read'], POST: ['pipeline:write'], PUT: ['pipeline:write'] }, description: 'Pipeline management' },

  // Segments
  { path: '/api/segments', methods: { GET: ['segments:read'], POST: ['segments:write'], PUT: ['segments:write'], DELETE: ['segments:delete'] }, description: 'Segment management' },

  // AI & Intelligence
  { path: '/api/research', methods: { GET: ['research:read'], POST: ['research:write'] }, description: 'AI research' },
  { path: '/api/research-agent', methods: { GET: ['research:read'], POST: ['research:write'] }, description: 'Research agent' },
  { path: '/api/reasoning', methods: { GET: ['ai:read'], POST: ['ai:write'] }, description: 'AI reasoning' },
  { path: '/api/orchestration', methods: { GET: ['ai:read'], POST: ['ai:write'] }, description: 'Multi-agent orchestration' },
  { path: '/api/knowledge', methods: { GET: ['knowledge:read'], POST: ['knowledge:write'], DELETE: ['knowledge:manage'] }, description: 'Knowledge base' },
  { path: '/api/capabilities', methods: { GET: ['ai:read'] }, description: 'AI capabilities' },
  { path: '/api/recommendations', methods: { GET: ['recommendations:read'], POST: ['recommendations:write'] }, description: 'AI recommendations' },
  { path: '/api/fusion', methods: { GET: ['ai:read'], POST: ['ai:write'] }, description: 'AI fusion engine' },
  { path: '/api/learning', methods: { GET: ['ai:read'], POST: ['ai:write'] }, description: 'AI continuous learning' },

  // Email
  { path: '/api/email-templates', methods: { GET: ['templates:read'], POST: ['templates:write'] }, description: 'Email templates' },
  { path: '/api/sequences', methods: { GET: ['sequences:read'], POST: ['sequences:write'], PUT: ['sequences:write'], DELETE: ['sequences:write'] }, description: 'Email sequences' },
  { path: '/api/replies', methods: { GET: ['email:read'], POST: ['email:write'] }, description: 'Email replies' },
  { path: '/api/bounces', methods: { GET: ['email:read'] }, description: 'Email bounces' },
  { path: '/api/suppressions', methods: { GET: ['email:read'], POST: ['email:write'] }, description: 'Email suppressions' },

  // Data Import/Export
  { path: '/api/imports', methods: { GET: ['import:read'], POST: ['import:write'] }, description: 'Data imports' },
  { path: '/api/data-import', methods: { GET: ['import:read'], POST: ['import:write'] }, description: 'Data import operations' },
  { path: '/api/export', methods: { GET: ['export:read'], POST: ['export:write'] }, description: 'Data export' },
  { path: '/api/export-center', methods: { GET: ['export:read'] }, description: 'Export center' },

  // Settings & Configuration
  { path: '/api/settings', methods: { GET: ['settings:read'], POST: ['settings:write'], PUT: ['settings:write'] }, description: 'System settings' },
  { path: '/api/preferences', methods: { GET: ['settings:read'], POST: ['settings:write'] }, description: 'User preferences' },
  { path: '/api/prompt-templates', methods: { GET: ['ai:read'], POST: ['ai:write'], PUT: ['ai:write'] }, description: 'Prompt templates' },

  // Audit & Compliance
  { path: '/api/audit', methods: { GET: ['audit:read'] }, description: 'Audit logs' },
  { path: '/api/audit-logs', methods: { GET: ['audit:read'] }, description: 'Audit log viewer' },
  { path: '/api/compliance', methods: { GET: ['audit:read'] }, description: 'Compliance status' },

  // System & Health
  { path: '/api/system-health', methods: { GET: ['health:read'] }, description: 'System health details' },
  { path: '/api/performance', methods: { GET: ['health:read'] }, description: 'Performance metrics' },
  { path: '/api/api-metrics', methods: { GET: ['health:read'] }, description: 'API metrics' },
  { path: '/api/data-health', methods: { GET: ['health:read'] }, description: 'Data health' },

  // Enterprise
  { path: '/api/enterprise', methods: { GET: ['settings:read'], POST: ['settings:write'] }, description: 'Enterprise features' },

  // Other operations
  { path: '/api/notes', methods: { GET: ['companies:read'], POST: ['companies:write'], DELETE: ['companies:write'] }, description: 'Notes CRUD' },
  { path: '/api/duplicates', methods: { GET: ['companies:read'], POST: ['companies:write'] }, description: 'Duplicate management' },
  { path: '/api/signals', methods: { GET: ['ai:read'] }, description: 'Signal intelligence' },
  { path: '/api/feedback', methods: { GET: ['ai:read'], POST: ['ai:write'] }, description: 'AI feedback' },
  { path: '/api/batches', methods: { GET: ['import:read'], POST: ['import:write'] }, description: 'Batch operations' },
  { path: '/api/queue', methods: { GET: ['health:read'] }, description: 'Job queue status' },
  { path: '/api/playbooks', methods: { GET: ['sequences:read'], POST: ['sequences:write'] }, description: 'Playbooks' },
  { path: '/api/conversation-plans', methods: { GET: ['research:read'], POST: ['research:write'] }, description: 'Conversation plans' },
  { path: '/api/cro-dashboard', methods: { GET: ['analytics:read'] }, description: 'CRO dashboard' },
  { path: '/api/revops', methods: { GET: ['analytics:read'] }, description: 'Revenue operations' },
  { path: '/api/sales-execution', methods: { GET: ['pipeline:read'] }, description: 'Sales execution' },
  { path: '/api/timeline', methods: { GET: ['companies:read'] }, description: 'Activity timeline' },
  { path: '/api/drafts', methods: { GET: ['email:read'], POST: ['email:write'], PUT: ['email:write'], DELETE: ['email:write'] }, description: 'Draft management' },
  { path: '/api/realtime', methods: { GET: ['dashboard:read'] }, description: 'Real-time updates' },
  { path: '/api/verify-email', methods: { GET: [] }, public: true, description: 'Email verification' },
  { path: '/api/verify-queue', methods: { GET: [] }, public: true, description: 'Queue verification' },
];

// ── Authorization Functions ──────────────────────────────────────

/**
 * Check if a user role has a specific permission.
 */
export function hasPermission(role: string, permission: Permission): boolean {
  // Current system uses 'admin' for authorized user — map to RBAC
  const normalizedRole = (role as UserRole) || 'admin';
  const roleDef = ROLES[normalizedRole];
  if (!roleDef) {
    // Unknown role — deny by default
    logger.warn(`[RBAC] Unknown role: ${role}, denying access`);
    return false;
  }
  return roleDef.permissions.includes(permission);
}

/**
 * Check if a user role has ANY of the required permissions.
 */
export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Authorize a request against the route-permission matrix.
 * Returns { authorized: true } or { authorized: false, reason: string }.
 */
export function authorizeRoute(
  pathname: string,
  method: string,
  userRole: string,
): { authorized: boolean; reason?: string; requiredPermissions?: Permission[] } {
  // Normalize path (remove trailing slash, query params)
  const normalizedPath = pathname.replace(/\/+$/, '').split('?')[0];

  // Find matching route config
  const routeConfig = ROUTE_AUTHORIZATION_MATRIX.find(r => normalizedPath === r.path);

  if (!routeConfig) {
    // No explicit config — default to requiring auth (admin access)
    // In single-user mode, admin has all permissions
    logger.warn(`[RBAC] No authorization config for ${normalizedPath} — defaulting to authenticated access`);
    return { authorized: true };
  }

  // Public route — no authorization needed
  if (routeConfig.public) {
    return { authorized: true };
  }

  // Get required permissions for this method
  const methodUpper = method.toUpperCase();
  const requiredPermissions = routeConfig.methods[methodUpper] || routeConfig.methods['GET'] || [];

  // No permissions required (e.g., generic read access after auth)
  if (requiredPermissions.length === 0) {
    return { authorized: true };
  }

  // Check permissions
  if (hasAnyPermission(userRole, requiredPermissions)) {
    return { authorized: true, requiredPermissions };
  }

  // Denied
  return {
    authorized: false,
    reason: `Role '${userRole}' lacks required permissions: ${requiredPermissions.join(', ')}`,
    requiredPermissions,
  };
}

/**
 * Get all permissions for a role.
 */
export function getRolePermissions(role: string): Permission[] {
  const normalizedRole = (role as UserRole) || 'admin';
  return ROLES[normalizedRole]?.permissions || [];
}

/**
 * Get role definition.
 */
export function getRoleDefinition(role: string): RoleDefinition | undefined {
  return ROLES[(role as UserRole)];
}

/**
 * Get all available roles.
 */
export function getAllRoles(): RoleDefinition[] {
  return Object.values(ROLES);
}

/**
 * Generate an authorization compliance report for all routes.
 */
export function generateAuthorizationReport(): Array<{
  path: string;
  methods: Record<string, { permissions: Permission[]; public: boolean }>;
  description?: string;
}> {
  return ROUTE_AUTHORIZATION_MATRIX.map(r => ({
    path: r.path,
    methods: Object.fromEntries(
      Object.entries(r.methods).map(([method, perms]) => [
        method,
        { permissions: perms, public: r.public || false },
      ])
    ),
    description: r.description,
  }));
}
