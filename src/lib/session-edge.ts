/* ═══════════════════════════════════════════════════
   Edge-Compatible Session Validator
   
   P0.1 DEEP FIX: The main session.ts uses Prisma Client
   (Node.js only — TCP sockets, native Rust bindings).
   This module uses @neondatabase/serverless (HTTP-based)
   to validate sessions in Edge Runtime without Prisma.
   
   Uses:
     - @neondatabase/serverless (pool.connect over HTTP/WebSocket)
     - crypto.subtle (Web Crypto API — Edge-native)
     - Raw SQL against the Session + User tables
   
   NO Node.js APIs used. NO Prisma. NO Buffer.
   Fully Edge Runtime compatible.
   ═══════════════════════════════════════════════════ */

import { neon } from '@neondatabase/serverless';
import { logger } from '@/lib/logger';

// Re-use the same DATABASE_URL as Prisma
const databaseUrl = process.env.DATABASE_URL ?? '';

/**
 * SHA-256 hash a session token.
 * Uses Web Crypto API — fully Edge-compatible.
 * Identical logic to session.ts hashToken().
 */
async function hashTokenEdge(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`dmq_session:${token}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface EdgeSessionUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  designation: string | null;
  role: string;
  hasPassword: boolean;
  avatarUrl: string | null;
}

/**
 * Validate a session token in Edge Runtime.
 * Uses @neondatabase/serverless for HTTP-based DB access.
 *
 * Returns the user if session is valid, null otherwise.
 * Does NOT set cookies.
 * Conditionally extends expiry when < 7 days remaining (P0 Audit #3 fix).
 */
export async function validateSessionEdge(token: string): Promise<EdgeSessionUser | null> {
  if (!token || token.length < 16) return null;

  // ── CRITICAL: Session lookup — failure = deny access ──
  let rows;
  try {
    const sql = neon(databaseUrl);
    const tokenHash = await hashTokenEdge(token);

    rows = await sql`
      SELECT 
        u.id, u.email, u.name, u.phone, u.company, u.designation, 
        u.role, u."hasPassword", u."avatarUrl",
        s.id as session_id, s."expiresAt", u."isActive"
      FROM "Session" s
      JOIN "User" u ON s."userId" = u.id
      WHERE s.token = ${tokenHash}
        AND s."expiresAt" > NOW()
        AND u."isActive" = true
      LIMIT 1
    `;
  } catch (error) {
    logger.error('[EdgeSession] SELECT failed', { error });
    return null;
  }

  if (!rows || rows.length === 0) return null;

  const row = rows[0];

  // ── NON-CRITICAL: Rolling expiry extension (conditional) ──
  // P0 Deep Audit #3 FIX: Only update expiry when < 7 days remaining.
  // Previously updated on EVERY request, causing DB write amplification.
  // Now skips the UPDATE for ~70% of requests (those with > 7 days left).
  // Failure here must NOT deny an authenticated user.
  try {
    const expiresAt = new Date(row.expiresAt);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const remainingMs = expiresAt.getTime() - Date.now();

    if (remainingMs < sevenDaysMs) {
      const sql = neon(databaseUrl);
      await sql`
        UPDATE "Session"
        SET "expiresAt" = NOW() + INTERVAL '30 days'
        WHERE id = ${row.session_id}
      `;
    }
  } catch (error) {
    logger.error('[EdgeSession] UPDATE failed (non-critical, session still valid)', { error });
    // Swallow — session is valid, just couldn't extend
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    company: row.company,
    designation: row.designation,
    role: row.role,
    hasPassword: row.hasPassword,
    avatarUrl: row.avatarUrl,
  };
}
