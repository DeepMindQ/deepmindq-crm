/**
 * Security Audit Logger
 *
 * Structured audit trail for security-relevant events:
 * auth failures, CSRF violations, rate limit hits, admin actions,
 * data exports, and configuration changes.
 *
 * Uses the existing AuditLog Prisma model plus structured logger
 * for real-time alerting. Non-blocking — audit failures never
 * impact request handling.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Audit Event Types ──────────────────────────────────────

export type AuditCategory =
  | 'auth' // Login, logout, OTP, session
  | 'authorization' // Access denied, RBAC failures
  | 'csrf' // CSRF validation failures
  | 'rate_limit' // Rate limit exceeded
  | 'admin' // Admin actions (seed, config changes)
  | 'data_export' // Data downloads, CSV/Excel exports
  | 'data_import' // Bulk data imports
  | 'data_delete' // Bulk deletions, purges
  | 'config_change' // Settings updates, ICP changes
  | 'webhook' // Incoming webhook processing
  | 'security'; // Other security events

export type AuditSeverity = 'info' | 'warn' | 'critical';

export interface AuditEvent {
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  actor?: string; // userId or email if available
  ip?: string;
  path?: string;
  method?: string;
  details?: Record<string, unknown>;
}

// ── Core Audit Function ────────────────────────────────────

/**
 * Record a security audit event.
 * Writes to both AuditLog table (persistent) and structured logger (real-time).
 * Non-blocking: failures are logged but never throw.
 */
export async function audit(event: AuditEvent): Promise<void> {
  const { action, category, severity, actor, ip, path, method, details } = event;

  // Real-time structured log (always)
  const logMsg = `[AUDIT:${category.toUpperCase()}] ${action}`;
  const logMeta: Record<string, unknown> = {
    category,
    severity,
    action,
    ...(actor ? { actor } : {}),
    ...(ip ? { ip } : {}),
    ...(path ? { path, method } : {}),
    ...(details ? { details } : {}),
  };

  switch (severity) {
    case 'critical':
      logger.error(logMsg, logMeta);
      break;
    case 'warn':
      logger.warn(logMsg, logMeta);
      break;
    default:
      logger.info(logMsg, logMeta);
  }

  // Persistent audit record (best-effort)
  try {
    await db.auditLog.create({
      data: {
        action: `[${category}] ${action}`,
        resource: category,
        ipAddress: ip || null,
        details: details ? JSON.stringify(details) : undefined,
      },
    });
  } catch (err) {
    // Audit write failure should NEVER impact the request
    logger.error('[AUDIT] Failed to persist audit record:', { error: err });
  }
}

// ── Convenience Helpers ────────────────────────────────────

/** Log an authentication failure (wrong OTP, invalid token, etc.) */
export function auditAuthFailure(action: string, ip: string, extras?: Record<string, unknown>) {
  return audit({
    action,
    category: 'auth',
    severity: 'warn',
    ip,
    ...extras,
  });
}

/** Log a CSRF validation failure */
export function auditCsrfFailure(ip: string, path: string, method: string) {
  return audit({
    action: 'CSRF validation failed',
    category: 'csrf',
    severity: 'warn',
    ip,
    path,
    method,
  });
}

/** Log a rate limit exceeded event */
export function auditRateLimit(ip: string, path: string, limit: number) {
  return audit({
    action: `Rate limit exceeded (${limit})`,
    category: 'rate_limit',
    severity: 'warn',
    ip,
    path,
    details: { limit },
  });
}

/** Log an admin action */
export function auditAdminAction(action: string, actor: string, details?: Record<string, unknown>) {
  return audit({
    action,
    category: 'admin',
    severity: 'info',
    actor,
    details,
  });
}

/** Log a data export */
export function auditDataExport(action: string, actor: string, format?: string) {
  return audit({
    action,
    category: 'data_export',
    severity: 'info',
    actor,
    details: format ? { format } : undefined,
  });
}

/** Log a data deletion */
export function auditDataDelete(action: string, actor: string, details?: Record<string, unknown>) {
  return audit({
    action,
    category: 'data_delete',
    severity: 'warn',
    actor,
    details,
  });
}

/** Log a security-critical event (e.g. suspicious activity pattern) */
export function auditSecurityCritical(
  action: string,
  ip: string,
  details?: Record<string, unknown>,
) {
  return audit({
    action,
    category: 'security',
    severity: 'critical',
    ip,
    details,
  });
}
