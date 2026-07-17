/* ═══════════════════════════════════════════════════
   Session Management Utility
   
   Creates, verifies, and manages opaque session tokens
   stored in the database.
   ═══════════════════════════════════════════════════ */

import { db } from './db';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'dmq_session';
const SESSION_EXPIRY_DAYS = 30;

/**
 * Generate a cryptographically random session token.
 */
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface CreateSessionResult {
  token: string;
  expiresAt: Date;
}

/**
 * Create a new session for a user. Returns the token and sets httpOnly cookie.
 */
export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<CreateSessionResult> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Clean up expired sessions for this user
  await db.session.deleteMany({
    where: {
      userId,
      expiresAt: { lt: new Date() },
    },
  });

  await db.session.create({
    data: {
      userId,
      token,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt,
    },
  });

  // Set httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  });

  return { token, expiresAt };
}

export interface SessionUser {
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
 * Get the current session from the request cookie.
 * Returns the user if valid session exists, null otherwise.
 */
export async function getCurrentSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const session = await db.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            company: true,
            designation: true,
            role: true,
            hasPassword: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      // Clean up expired/invalid session
      if (session) {
        await db.session.delete({ where: { id: session.id } });
      }
      return null;
    }

    // Extend session expiry (rolling expiry)
    const newExpiry = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: newExpiry },
    });

    const cookieStore2 = await cookies();
    cookieStore2.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: newExpiry,
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    });

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      phone: session.user.phone,
      company: session.user.company,
      designation: session.user.designation,
      role: session.user.role,
      hasPassword: session.user.hasPassword,
      avatarUrl: session.user.avatarUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns user or throws error response.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentSession();
  if (!user) {
    throw new AuthError('Authentication required', 401);
  }
  return user;
}

/**
 * Delete the current session (logout).
 */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Custom error class for auth failures.
 */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}