# DeepMindQ — Engineer Onboarding Guide

Get from `git clone` to a running development environment in ~20 minutes.

---

## 1. Prerequisites (5 min)

| Requirement | Minimum Version | Check |
|---|---|---|
| Node.js | 20+ | `node --version` |
| Docker + Docker Compose | Latest stable | `docker --version` && `docker compose version` |
| Git | 2.x | `git --version` |
| Code editor | VS Code recommended | — |

**Optional but helpful:**
- Postman or similar API client
- PostgreSQL client (for direct DB inspection)

---

## 2. Quick Start (15 min)

```bash
# 1. Clone and enter the project
git clone <repo> && cd deepmindq

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and set the minimum required vars:
#   - DATABASE_URL         (PostgreSQL connection string)
#   - NEXTAUTH_SECRET      (session encryption key)
#   - AUTHORIZED_EMAIL     (your email for initial login)
#   - EMAIL_API_KEY        (Resend API key for OTP)
#   - EMAIL_FROM           (verified sender email)

# 4. Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# 5. Start the dev server
npm run dev

# 6. Open in browser
# Open http://localhost:3000
```

**First login:** Request an OTP email, enter the code, and you'll land on the dashboard.

---

## 3. First 5 Files to Read

Read these in order to build a mental model of the system:

| # | File | Why | Key Takeaway |
|---|---|---|---|
| 1 | `docs/ARCHITECTURE.md` | Full system overview | Understand the 7-engine architecture, data flow, and deployment model |
| 2 | `src/app/page.tsx` | App shell and navigation | See how screens are routed, the nav structure, and the login/landing flow |
| 3 | `src/lib/engines/index.ts` | AI engine architecture | Understand how the 7 composable engines work and the non-throwing contract |
| 4 | `src/middleware.ts` | Security layers | See auth checks, rate limiting, and request validation |
| 5 | `src/lib/ai-config.ts` | AI provider configuration | Understand how NVIDIA, Groq, and Gemini are configured and selected |

---

## 4. Key Concepts

### 7-Engine Composable Architecture
DeepMindQ uses 7 AI engines that can run independently or be composed together:
Signal → Enrichment → Scoring → Reasoning → Action → Conversation → Briefing

Each engine has a **non-throwing contract** — errors are caught and returned as structured results, never thrown. This means the UI always renders; it degrades gracefully.

### Dedicated Per-Customer Deployment
This is **NOT** a multi-tenant SaaS. Every customer gets:
- Their own PostgreSQL database
- Their own file storage (S3 bucket)
- Their own secrets and API keys
- Their own domain

There are no shared tables, no tenant IDs, no data co-mingling. Data isolation is guaranteed by architecture, not by application logic.

### Evidence-First AI
Every AI output must cite its sources. The system tracks:
- **Confidence scores** (0-100 with high/medium/low)
- **Evidence provenance** (which sources, how many)
- **Freshness** (5 levels: Just In → Outdated)
- **Explainability** (why the AI thinks this, what it doesn't know)

### Non-Throwing Engine Contract
```typescript
// Engines return results, never throw
interface EngineResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  partialResults?: T[];  // Even on failure, return what we got
}
```

---

## 5. Common Tasks Quick Reference

| Task | Guide | Section |
|---|---|---|
| Adding an API endpoint | [`docs/DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) | API Routes |
| Adding a UI screen | [`docs/DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) | Screen Components |
| Debugging production issues | [`docs/DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) | Debugging |
| Adding a new AI engine | [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | Engine Architecture |
| Database schema changes | [`docs/DATABASE_DESIGN.md`](./DATABASE_DESIGN.md) | Migrations |
| Environment configuration | [`docs/ENVIRONMENT_CONFIGURATION.md`](./ENVIRONMENT_CONFIGURATION.md) | All Variables |
| Deployment | [`docs/DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) | Full Guide |
| Troubleshooting | [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) | Common Issues |

---

## 6. Architecture Ownership Map

| Domain | Key File(s) | What to Avoid |
|---|---|---|
| AI Engine orchestration | `src/lib/engines/index.ts`, `src/lib/engines/*.ts` | Don't throw errors — return structured results. Don't bypass the engine contract. |
| AI Provider config | `src/lib/ai-config.ts` | Don't hardcode API keys. Don't add providers without updating the config. |
| Authentication | `src/middleware.ts`, `src/lib/auth.ts` | Don't create auth bypasses. Don't store secrets in client code. |
| Database schema | `prisma/schema.prisma` | Don't modify without running `prisma generate`. Don't add tenant-scoping (single-tenant by design). |
| API routes | `src/app/api/*/route.ts` | Don't skip auth checks. Don't return raw errors to clients. |
| UI screens | `src/components/screens/*.tsx` | Don't use hardcoded colors (use design tokens). Don't add screens >2000 lines without splitting. |
| State management | `src/lib/store.ts` | Don't add server-only data to client store. |
| Navigation | `src/lib/nav-config.ts`, `src/lib/screen-map.ts` | Don't add routes without updating both files. |
| Email delivery | `src/lib/email.ts`, `src/app/api/auth/*/route.ts` | Don't send emails without rate limiting. |
| Background jobs | `src/app/api/cron/*/route.ts` | Don't add cron jobs without CRON_SECRET validation. |

---

## 7. Getting Help

- **Architecture questions:** Start with `docs/ARCHITECTURE.md`
- **"How do I X?":** Check `docs/DEVELOPMENT_GUIDE.md`
- **Something broke:** Check `docs/TROUBLESHOOTING.md`
- **Environment issues:** Check `docs/ENVIRONMENT_CONFIGURATION.md`
- **Design decisions:** Check `docs/ADR.md` (Architecture Decision Records)
