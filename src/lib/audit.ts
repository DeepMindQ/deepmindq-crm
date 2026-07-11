// Audit logging utility for tracking CUD operations
import { db } from './db'

interface AuditOptions {
  userId: string
  action: string       // 'create', 'update', 'delete', 'login', 'logout', 'export', 'import'
  entity: string       // 'Company', 'Contact', 'Opportunity', etc.
  entityId?: string
  details?: string
  request?: Request
}

export async function createAuditLog(options: AuditOptions) {
  try {
    const ipAddress = options.request?.headers.get('x-forwarded-for') ||
                      options.request?.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = options.request?.headers.get('user-agent') || 'unknown'

    await db.auditLog.create({
      data: {
        userId: options.userId,
        action: options.action,
        entity: options.entity,
        entityId: options.entityId || null,
        details: options.details || null,
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    // Audit logging should never crash the app
    console.error('[AuditLog] Failed to create audit entry:', error)
  }
}

// Helper to create audit logs from API routes
export function auditAction(action: string, entity: string) {
  return (userId: string, entityId?: string, details?: string, request?: Request) =>
    createAuditLog({ userId, action, entity, entityId, details, request })
}

// Pre-configured audit helpers
export const audit = {
  companyCreated: auditAction('create', 'Company'),
  companyUpdated: auditAction('update', 'Company'),
  companyDeleted: auditAction('delete', 'Company'),
  contactCreated: auditAction('create', 'Contact'),
  contactUpdated: auditAction('update', 'Contact'),
  contactDeleted: auditAction('delete', 'Contact'),
  opportunityCreated: auditAction('create', 'Opportunity'),
  opportunityUpdated: auditAction('update', 'Opportunity'),
  opportunityDeleted: auditAction('delete', 'Opportunity'),
  userLogin: auditAction('login', 'User'),
  userLogout: auditAction('logout', 'User'),
  exportData: auditAction('export', 'Data'),
  importData: auditAction('import', 'Data'),
  settingsChanged: auditAction('update', 'Settings'),
}