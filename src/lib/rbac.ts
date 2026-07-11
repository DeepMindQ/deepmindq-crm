export type Permission = 'create' | 'read' | 'update' | 'delete' | 'export' | 'admin'
export type ResourceType =
  | 'Company'
  | 'Contact'
  | 'Opportunity'
  | 'Draft'
  | 'Note'
  | 'Research'
  | 'Settings'
  | 'User'
  | 'Team'

// Role definitions — what each role can do with each resource
const ROLE_PERMISSIONS: Record<string, Record<ResourceType, Permission[]>> = {
  admin: {
    Company: ['create', 'read', 'update', 'delete', 'export'],
    Contact: ['create', 'read', 'update', 'delete', 'export'],
    Opportunity: ['create', 'read', 'update', 'delete', 'export'],
    Draft: ['create', 'read', 'update', 'delete', 'export'],
    Note: ['create', 'read', 'update', 'delete'],
    Research: ['create', 'read', 'update', 'delete'],
    Settings: ['read', 'update', 'admin'],
    User: ['create', 'read', 'update', 'delete', 'admin'],
    Team: ['create', 'read', 'update', 'delete', 'admin'],
  },
  manager: {
    Company: ['create', 'read', 'update', 'export'],
    Contact: ['create', 'read', 'update', 'export'],
    Opportunity: ['create', 'read', 'update', 'export'],
    Draft: ['create', 'read', 'update'],
    Note: ['create', 'read', 'update'],
    Research: ['create', 'read', 'update'],
    Settings: ['read'],
    User: ['read'],
    Team: ['read'],
  },
  sales_rep: {
    Company: ['create', 'read', 'update'],
    Contact: ['create', 'read', 'update'],
    Opportunity: ['create', 'read', 'update'],
    Draft: ['create', 'read', 'update'],
    Note: ['create', 'read', 'update'],
    Research: ['read'],
    Settings: ['read'],
    User: ['read'],
    Team: ['read'],
  },
  viewer: {
    Company: ['read'],
    Contact: ['read'],
    Opportunity: ['read'],
    Draft: ['read'],
    Note: ['read'],
    Research: ['read'],
    Settings: ['read'],
    User: ['read'],
    Team: ['read'],
  },
}

export function hasPermission(
  role: string,
  resource: ResourceType,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role]?.[resource]?.includes(permission) ?? false
}

export function canAccess(
  role: string,
  resource: ResourceType,
  permission: Permission,
): boolean {
  // Admin can do everything
  if (role === 'admin') return true
  return hasPermission(role, resource, permission)
}

export const ALL_ROLES = ['admin', 'manager', 'sales_rep', 'viewer'] as const
export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  sales_rep: 'Sales Representative',
  viewer: 'Viewer',
}