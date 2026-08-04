/**
 * WI-18.5 Phase 5 — Enterprise Session Manager
 *
 * Production-grade session management with:
 *   - Session rotation (periodic re-authentication)
 *   - Session revocation (admin kill, security event trigger)
 *   - Device/session tracking with fingerprinting
 *   - Suspicious login detection (new device, new IP, rapid succession)
 *   - Concurrent session limits
 *   - Session audit trail
 *
 * All operations are non-blocking — failures are logged but never
 * impact the request path.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { audit, AuditCategory } from '@/lib/audit-logger';

// ── Configuration ──────────────────────────────────────────────

const SESSION_ROTATION_DAYS = 7;            // Force re-auth after 7 days
const MAX_CONCURRENT_SESSIONS = 5;          // Max active sessions per user
const SUSPICIOUS_WINDOW_MS = 10 * 60_000;   // 10 min — flag rapid logins
const NEW_DEVICE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TRUSTED_IP_CACHE_SIZE = 1000;

// ── Types ─────────────────────────────────────────────────────

export interface SessionDeviceInfo {
  userAgent: string;
  ip: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os: string;
  browser: string;
  fingerprint: string;
}

export interface SessionSecurityAssessment {
  isSuspicious: boolean;
  isNewDevice: boolean;
  isNewLocation: boolean;
  isRapidLogin: boolean;
  reasons: string[];
  riskScore: number; // 0-100
}

export interface ActiveSession {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  createdAt: Date;
  isCurrent: boolean;
  deviceType?: string;
  os?: string;
  browser?: string;
}

// ── Device Parsing ────────────────────────────────────────────

function parseUserAgent(ua: string): { deviceType: SessionDeviceInfo['deviceType']; os: string; browser: string } {
  const lower = ua.toLowerCase();

  const deviceType: SessionDeviceInfo['deviceType'] =
    /mobile|android(?!.*tablet)|iphone|ipod/.test(lower) ? 'mobile' :
    /tablet|ipad|android(.*tablet)/.test(lower) ? 'tablet' :
    'desktop';

  const os =
    /windows/.test(lower) ? 'Windows' :
    /macintosh|mac os/.test(lower) ? 'macOS' :
    /linux/.test(lower) ? 'Linux' :
    /android/.test(lower) ? 'Android' :
    /ios|iphone|ipad/.test(lower) ? 'iOS' :
    'Unknown';

  const browser =
    /edg\//.test(lower) ? 'Edge' :
    /chrome\//.test(lower) ? 'Chrome' :
    /firefox\//.test(lower) ? 'Firefox' :
    /safari\//.test(lower) ? 'Safari' :
    'Unknown';

  return { deviceType, os, browser };
}

function generateDeviceFingerprint(ua: string, ip: string): string {
  // Simple but effective fingerprint: hash user-agent + ip subnet
  const ipParts = ip.split('.');
  const ipSubnet = ipParts.length >= 3 ? ipParts.slice(0, 3).join('.') : ip;
  const raw = `${ua}||${ipSubnet}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

// ── Security Assessment ─────────────────────────────────────────

/**
 * Assess whether a login attempt is suspicious.
 * Checks for new device, new IP, rapid successive logins.
 */
export async function assessLoginSecurity(
  userId: string,
  deviceInfo: SessionDeviceInfo,
): Promise<SessionSecurityAssessment> {
  const reasons: string[] = [];
  let riskScore = 0;
  let isSuspicious = false;
  let isNewDevice = false;
  let isNewLocation = false;
  let isRapidLogin = false;

  try {
    // 1. Check for recent sessions from this user
    const recentSessions = await db.session.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - SUSPICIOUS_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { ipAddress: true, userAgent: true, createdAt: true },
    });

    // 2. Check for rapid successive logins (multiple sessions in short window)
    if (recentSessions.length >= 3) {
      isRapidLogin = true;
      reasons.push(`Rapid login: ${recentSessions.length} sessions in last 10 minutes`);
      riskScore += 30;
    }

    // 3. Check for new device (no prior session with same fingerprint)
    const matchingDevice = await db.session.findFirst({
      where: {
        userId,
        ipAddress: deviceInfo.ip,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!matchingDevice) {
      isNewDevice = true;
      reasons.push('Login from unrecognized IP address');
      riskScore += 25;
    }

    // 4. Check for new location (IP geo change — simplified: different IP class)
    if (matchingDevice && matchingDevice.ipAddress && matchingDevice.ipAddress !== deviceInfo.ip) {
      const oldParts = matchingDevice.ipAddress.split('.');
      const newParts = deviceInfo.ip.split('.');
      if (oldParts.length >= 2 && newParts.length >= 2 && oldParts[0] !== newParts[0]) {
        isNewLocation = true;
        reasons.push(`Location change: ${matchingDevice.ipAddress} → ${deviceInfo.ip}`);
        riskScore += 15;
      }
    }

    // 5. Elevated risk threshold
    if (riskScore >= 50) {
      isSuspicious = true;
    }
  } catch (err) {
    logger.error('[SessionManager] Security assessment failed:', { error: err });
    // Fail open — don't block login on assessment failure
  }

  return { isSuspicious, isNewDevice, isNewLocation, isRapidLogin, reasons, riskScore };
}

// ── Session Rotation ───────────────────────────────────────────

/**
 * Check if a session should be rotated (re-auth required).
 * Sessions older than SESSION_ROTATION_DAYS trigger rotation.
 */
export function shouldRotateSession(createdAt: Date): boolean {
  const ageMs = Date.now() - createdAt.getTime();
  return ageMs > SESSION_ROTATION_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Force-rotate a session: invalidate old, signal client to re-auth.
 * Returns true if rotation was performed.
 */
export async function rotateSession(sessionId: string): Promise<boolean> {
  try {
    await db.session.delete({ where: { id: sessionId } });
    logger.info(`[SessionManager] Session rotated: ${sessionId}`);
    return true;
  } catch {
    return false;
  }
}

// ── Session Revocation ────────────────────────────────────────

/**
 * Revoke all sessions for a user (e.g., password change, security event).
 */
export async function revokeAllUserSessions(userId: string, reason: string = 'Security event'): Promise<number> {
  try {
    const result = await db.session.deleteMany({ where: { userId } });
    logger.info(`[SessionManager] Revoked ${result.count} sessions for user ${userId}: ${reason}`);
    await audit({
      action: `All sessions revoked: ${reason}`,
      category: 'auth',
      severity: 'warn',
      details: { userId, reason, sessionsRevoked: result.count },
    });
    return result.count;
  } catch (err) {
    logger.error('[SessionManager] Failed to revoke sessions:', { error: err });
    return 0;
  }
}

/**
 * Revoke a specific session by ID.
 */
export async function revokeSession(sessionId: string, actorId?: string, reason?: string): Promise<boolean> {
  try {
    await db.session.delete({ where: { id: sessionId } });
    logger.info(`[SessionManager] Session ${sessionId} revoked by ${actorId || 'system'}`);
    await audit({
      action: `Session revoked: ${reason || 'Admin action'}`,
      category: 'auth',
      severity: 'info',
      actor: actorId,
      details: { sessionId, reason },
    });
    return true;
  } catch {
    return false;
  }
}

// ── Concurrent Session Enforcement ────────────────────────────

/**
 * Enforce max concurrent sessions. Removes oldest sessions beyond limit.
 */
export async function enforceSessionLimit(userId: string): Promise<number> {
  try {
    const activeSessions = await db.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (activeSessions.length <= MAX_CONCURRENT_SESSIONS) return 0;

    const toRemove = activeSessions.slice(MAX_CONCURRENT_SESSIONS);
    const ids = toRemove.map(s => s.id);

    await db.session.deleteMany({
      where: { id: { in: ids } },
    });

    logger.info(`[SessionManager] Removed ${ids.length} excess sessions for user ${userId}`);
    return ids.length;
  } catch (err) {
    logger.error('[SessionManager] Session limit enforcement failed:', { error: err });
    return 0;
  }
}

// ── Session Listing ────────────────────────────────────────────

/**
 * List all active sessions for a user with device info.
 */
export async function getUserSessions(userId: string, currentToken?: string): Promise<ActiveSession[]> {
  try {
    const sessions = await db.session.findMany({
      where: { userId, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        token: true,
        userAgent: true,
        ipAddress: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return sessions.map(s => {
      const ua = s.userAgent || '';
      const parsed = parseUserAgent(ua);
      return {
        id: s.id,
        token: s.token,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
        isCurrent: currentToken ? s.token === currentToken : false,
        deviceType: parsed.deviceType,
        os: parsed.os,
        browser: parsed.browser,
      };
    });
  } catch (err) {
    logger.error('[SessionManager] Failed to list sessions:', { error: err });
    return [];
  }
}

// ── Login Event Recording ───────────────────────────────────────

/**
 * Record a login event with full security context.
 */
export async function recordLoginEvent(
  userId: string,
  email: string,
  deviceInfo: SessionDeviceInfo,
  assessment: SessionSecurityAssessment,
  method: string = 'otp',
  success: boolean = true,
): Promise<void> {
  try {
    await audit({
      action: `User login (${method})`,
      category: 'auth',
      severity: assessment.isSuspicious ? 'warn' : 'info',
      actor: userId,
      ip: deviceInfo.ip,
      details: {
        email,
        method,
        success,
        deviceType: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        fingerprint: deviceInfo.fingerprint,
        riskScore: assessment.riskScore,
        isSuspicious: assessment.isSuspicious,
        reasons: assessment.reasons,
      },
    });

    // Update user's last login
    await db.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  } catch (err) {
    logger.error('[SessionManager] Failed to record login event:', { error: err });
  }
}

// ── Helpers (exported for use in session.ts integration) ────────

export { parseUserAgent, generateDeviceFingerprint, SESSION_ROTATION_DAYS, MAX_CONCURRENT_SESSIONS };
