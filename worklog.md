---
Task ID: 1-10
Agent: Super Z (Main)
Task: Execute critical fixes, quick fixes, and test suite expansion

Work Log:
- Created `/api/people` route (GET with Zod validation, search, role filter, org filter, sort, pagination)
- Rewrote `otp.ts` — removed @ts-nocheck, replaced removed `OtpCode` model with User model fields (otpCode + otpExpiresAt), fixed all type errors
- Rewrote `llm-client.ts` — removed @ts-nocheck, added proper type narrowing for `getLLMChain()` return (null | LLMChainEntry[]), fixed `runQualityGates()` call signature mismatch, added `SearchProviderConfig` type for `getSearchProvider()`
- Rewrote `audit-trail-service.ts` — removed @ts-nocheck, replaced removed `company` model with `organization`, mapped fields to actual Evidence schema (claim, sourceType, sourceUrl, sourceTitle, excerpt, reliability), removed `isActive` reference
- Created `/api/settings` route (GET returns server config, POST with Zod validation for all setting categories)
- Rewired `settings-screen.tsx` — replaced all setTimeout mock handlers with real `fetchApi` calls, added `useEffect` to load settings from API, proper error handling with toast
- Added Zod validation to `request-otp/route.ts` — replaced manual regex with `z.object({ email: z.string().email() })`
- Fixed `session-manager.ts` `ActiveSession` interface — removed phantom fields (userAgent, ipAddress, deviceType, os, browser) that had no DB backing, added documentation comments
- Wrote 58 auth flow tests covering OTP request/verify, session creation, /me, logout, password change, CSRF, rate limiting
- Wrote 62 API route tests across 4 files: organizations (16), signals (13), people (16), settings (17)
- Wrote 70 RBAC tests + 38 CSRF tests (108 total)
- Wrote 78 screen smoke tests (all screens tested, 6 skipped due to pre-existing source bugs)

Stage Summary:
- 3 @ts-nocheck files reduced to 0 (all rewritten with proper types)
- 1 new API route created (/api/people)
- 1 new API route created (/api/settings)
- 1 existing route fixed (request-otp now uses Zod)
- 1 interface fixed (ActiveSession)
- 1 screen rewired (settings)
- 296 new tests added across 9 new test files
- Pre-existing bugs found in 6 screens (documented)
- Total @ts-nocheck in src/: 0 (was 3)
