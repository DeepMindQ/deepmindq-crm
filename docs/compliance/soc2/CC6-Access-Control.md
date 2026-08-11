# CC6: Access Control

**SOC 2 Criterion:** CC6.1 — The entity implements logical access security measures over information assets.

**Last Updated:** 2026-08-10
**Owner:** Security Engineering
**Review Cadence:** Quarterly

---

## Overview

DeepMindQ implements role-based access control (RBAC) enforced at the application layer via NextAuth.js session management and middleware guards. Access decisions are governed by the `role` field on the `User` model in `prisma/schema.prisma` and validated on every API request through `src/middleware.ts`.

---

## RBAC Matrix

| Permission Category | admin | editor | viewer | system |
|---------------------|-------|--------|--------|--------|
| **Companies — Read** | ✅ | ✅ | ✅ | ✅ |
| **Companies — Write** | ✅ | ✅ | ❌ | ✅ |
| **Companies — Delete** | ✅ | ❌ | ❌ | ❌ |
| **Contacts — Read** | ✅ | ✅ | ✅ | ✅ |
| **Contacts — Write** | ✅ | ✅ | ❌ | ✅ |
| **Intelligence — Read** | ✅ | ✅ | ✅ | ✅ |
| **Intelligence — Write** | ✅ | ✅ | ❌ | ✅ |
| **Intelligence — Admin** | ✅ | ❌ | ❌ | ❌ |
| **AI Configuration — Manage** | ✅ | ❌ | ❌ | ❌ |
| **Users — Manage** | ✅ | ❌ | ❌ | ❌ |
| **Audit Logs — Read** | ✅ | ✅ | ✅ | ✅ |
| **Audit Logs — Export** | ✅ | ❌ | ❌ | ✅ |
| **Data Import/Export** | ✅ | ✅ | ❌ | ✅ |
| **Settings — System** | ✅ | ❌ | ❌ | ❌ |
| **Settings — Personal** | ✅ | ✅ | ✅ | ❌ |
| **API Keys — Manage** | ✅ | ❌ | ❌ | ❌ |

**Implementation:** Role checks are performed in `src/lib/auth/rbac.ts` and enforced via route middleware in `src/middleware.ts`. Server-side API routes in `src/app/api/` re-validate roles on every request — client-side role checks are informational only.

---

## Onboarding Procedure

1. **Admin creates account:** Admin navigates to `/settings/users` and invites a new user by email.
2. **Email verification:** New user receives OTP via Resend email (`src/app/api/auth/login/route.ts`). OTP expires in 10 minutes.
3. **Default role:** New users are assigned `viewer` role by default.
4. **Role elevation:** Admin explicitly promotes to `editor` or `admin` via the users management screen (`src/components/screens/users-screen.tsx`).
5. **Session activation:** HMAC-signed session token issued with 24-hour expiry (`SESSION_TOKEN_HMAC_SECRET` in `.env.example`).

## Offboarding Procedure

1. **Immediate session revocation:** Admin disables the user account via `/settings/users`.
2. **Session invalidation:** All active sessions for the user are invalidated on next request (session middleware check in `src/middleware.ts`).
3. **Audit trail:** Account deactivation is logged in the audit logs table (`src/app/api/audit/route.ts`).
4. **Within 24 hours:** Admin removes any API keys associated with the user.
5. **Within 7 days:** Confirm data access review completed (see Access Review below).

---

## Privileged Access Management

- **Admin accounts** are limited to a maximum of 3 per organization (configurable via `MAX_ADMIN_ACCOUNTS` env var).
- **API key encryption:** All AI provider API keys stored in the database are encrypted at rest using AES-256-GCM (`API_KEY_ENCRYPTION_KEY`). Implementation in `src/lib/crypto/encryption.ts`.
- **Secret rotation:** `SESSION_TOKEN_HMAC_SECRET`, `CRON_SECRET`, `TRACKING_SECRET` are rotated quarterly. Rotation is tracked in `docs/compliance/secret-rotation-log.md`.
- **No shared credentials:** Each user has a unique session. Service accounts use dedicated tokens with least-privilege scope.

## Access Review Cadence

| Review Type | Frequency | Owner | Evidence Location |
|-------------|-----------|-------|-------------------|
| User access review | Monthly | Platform Engineering | `docs/compliance/access-reviews/` |
| API key review | Monthly | Security Team | Audit logs in DB |
| Admin privilege review | Quarterly | CTO | `docs/compliance/admin-reviews/` |
| Service account review | Quarterly | Platform Engineering | GitHub secrets audit |
| Third-party access review | Semi-annually | Security Team | Vendor access matrix |

**Automated enforcement:** The cron job at `/api/cron/data-retention` (scheduled `0 5 * * *` in `vercel.json`) includes a sweep for dormant accounts (no login in 90+ days), which are flagged for review.
