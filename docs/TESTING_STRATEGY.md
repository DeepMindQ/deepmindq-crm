# Testing Strategy

> How tests are organized, run, and written in DeepMindQ.

## 1. Test Framework

| Tool | Version | Purpose |
|---|---|---|
| **Vitest** | 4.x | Test runner and assertion library |
| **@testing-library/react** | 16.x | React component testing (render, screen, fireEvent) |
| **@testing-library/jest-dom** | 6.x | Custom DOM matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.) |
| **@testing-library/user-event** | 14.x | User interaction simulation (click, type, keyboard) |
| **jsdom** | 29.x | DOM environment for component tests |
| **@vitest/coverage-v8** | 4.x | Code coverage via V8 engine |
| **@vitejs/plugin-react** | 6.x | React JSX transform for Vitest |

The setup file (`tests/setup.ts`) polyfills `TextEncoder`/`TextDecoder` for jsdom and imports `@testing-library/jest-dom/vitest` for matchers.

## 2. Directory Structure

```
Home > my-project/
├── tests/                          # Integration, E2E, and cross-cutting tests
│   ├── setup.ts                    # Global test bootstrap
│   ├── e2e-business-journey.test.ts
│   ├── security-auth.test.ts
│   ├── security-auth-blocking.test.ts
│   ├── security-admin-routes.test.ts
│   ├── security-batch2-authenticated-access.test.ts
│   ├── security-phase3a-audit-fixes.test.ts
│   ├── security-phase3b-hygiene.test.ts
│   ├── security-phase4-critical-input-path.test.ts
│   ├── security-verify-otp.test.ts
│   ├── api-routes.test.ts
│   ├── utils.test.ts
│   ├── intelligence-contract.test.ts
│   ├── intelligence-health.test.ts
│   ├── icp-config.test.ts
│   ├── ai-governance.test.ts
│   ├── ticket1-intelligence-integration.test.ts
│   ├── ticket1-intelligence-errors.test.ts
│   ├── ticket1-intelligence-validation.test.ts
│   ├── ticket2-integration.test.ts
│   ├── ticket2-parse-include.test.ts
│   ├── ticket3-config-coverage.test.ts
│   ├── ticket3-deep-audit.test.ts
│   ├── ticket3-governance.test.ts
│   ├── ticket5-command-center.test.ts
│   ├── ticket6-company-priority.test.ts
│   ├── ticket7-5q-workspace.test.ts
│   ├── ticket-deep-coverage.test.ts
│   └── phase-1a-intelligence-foundation.test.ts
│
├── src/
│   ├── app/api/
│   │   ├── __tests__/                    # API integration tests
│   │   │   ├── api-integration.test.ts
│   │   │   ├── import-timeline-notes.test.ts
│   │   │   ├── opportunities-research.test.ts
│   │   │   └── health-export-knowledge.test.ts
│   │   ├── signals/__tests__/
│   │   │   └── signal-intelligence.test.ts
│   │   ├── g-intel-acquisition/inbox/__tests__/
│   │   │   └── inbox-api.test.ts
│   │   ├── g-intel-acquisition/inbox/batch-dismiss/__tests__/
│   │   │   └── batch-dismiss-api.test.ts
│   │   ├── ai/opportunities/__tests__/
│   │   │   └── opportunity-radar.test.ts
│   │   └── data-import/__tests__/
│   │       └── data-import-api.test.ts
│   │
│   ├── lib/
│   │   ├── __tests__/                    # Library unit tests
│   │   │   ├── store.test.ts
│   │   │   ├── data-import-navigation.test.ts
│   │   │   ├── intelligence-inbox-navigation.test.ts
│   │   │   └── phase3-e2e-governance.ts
│   │   ├── account-prioritization/__tests__/
│   │   │   ├── engine.test.ts
│   │   │   └── ticket4-score-unification.test.ts
│   │   ├── data-import/__tests__/
│   │   │   └── data-import-ticket11.test.ts
│   │   ├── intelligence-sources/__tests__/
│   │   │   ├── knowledge-fabric.test.ts
│   │   │   ├── intelligence-timeline.test.ts
│   │   │   ├── csv-connector.test.ts
│   │   │   ├── company-resolution.test.ts
│   │   │   ├── human-intelligence.test.ts
│   │   │   ├── connector-scheduler.test.ts
│   │   │   ├── job-queue.test.ts
│   │   │   ├── intelligence-inbox-ticket10.test.ts
│   │   │   ├── evidence-adapter.test.ts
│   │   │   ├── association-engine.test.ts
│   │   │   ├── confidence-engine.test.ts
│   │   │   ├── learning-loop.test.ts
│   │   │   └── (excluded: source-governance, analytics-dashboard, acquisition-engine, intelligence-alerts)
│   │   └── revenue-intelligence/__tests__/
│   │       ├── index.test.ts
│   │       ├── account-brief.test.ts
│   │       ├── account-scoring.test.ts
│   │       ├── brief-generator.test.ts
│   │       ├── opportunity-radar.test.ts
│   │       ├── recommendation-generator.test.ts
│   │       ├── signal-extraction.test.ts
│   │       ├── signal-patterns.test.ts
│   │       └── (excluded: signal-detector)
│   │
│   ├── components/shared/__tests__/
│   │   └── design-system.test.tsx
│   │
│   └── lib/
│       └── email-verification.test.ts     # Standalone test file (not in __tests__ dir)
│
└── vitest.config.ts               # Vitest configuration
```

### Major Test Files in `tests/`

| File | Purpose |
|---|---|
| `e2e-business-journey.test.ts` | End-to-end business journey validation — verifies complete user workflows |
| `security-auth.test.ts` | Authentication security — session handling, OTP flow, login/logout |
| `security-auth-blocking.test.ts` | Verifies unauthenticated access is blocked on protected routes |
| `security-admin-routes.test.ts` | Admin-only route access control |
| `security-batch2-authenticated-access.test.ts` | Second batch of authenticated access tests |
| `security-phase3a-audit-fixes.test.ts` | Phase 3a security audit fix verification |
| `security-phase3b-hygiene.test.ts` | Security hygiene checks (headers, input sanitization) |
| `security-phase4-critical-input-path.test.ts` | Critical input path security validation |
| `security-verify-otp.test.ts` | OTP verification flow security |
| `api-routes.test.ts` | API route integration tests |
| `intelligence-contract.test.ts` | Intelligence pipeline contract verification |
| `intelligence-health.test.ts` | Intelligence system health check tests |
| `ai-governance.test.ts` | AI governance and compliance tests |
| `icp-config.test.ts` | ICP (Ideal Customer Profile) configuration validation |
| `utils.test.ts` | Utility function unit tests |
| `ticket{N}-*.test.ts` | Feature-specific integration tests (ticket-tracked work) |

## 3. Running Tests

```bash
# Run all tests once (CI mode)
npm run test

# Watch mode (development)
npm run test:watch

# Run a single file
npx vitest run path/to/file.test.ts

# Run files matching a pattern
npx vitest run --grep "security"

# With coverage report
npx vitest run --coverage

# Run only non-excluded tests (same as npm run test)
npx vitest run
```

### Excluded Tests

The `vitest.config.ts` `exclude` list suppresses tests that reference deleted source modules or outdated API shapes. As of the current codebase, 16 test files are excluded (totaling ~121 assertions across 8 files needing rewrite). These are documented in `vitest.config.ts` with comments explaining why each is excluded.

## 4. Test Categories

### Unit Tests
- **Engine logic**: Scoring engines, signal detection, evidence classification, confidence calculation
- **Data intelligence**: Column detection, normalization, deduplication, quality scoring
- **Intelligence sources**: Connectors (CSV, RSS), knowledge fabric, job queue, freshness decay
- **Revenue intelligence**: Account scoring, brief generation, signal patterns, opportunity radar
- **Account prioritization**: Priority engine, score unification
- **Utilities**: Sanitization, pagination, date formatting, validations

### Integration Tests
- **API routes**: Full request/response cycles for auth, companies, contacts, signals, sequences, data import
- **Database operations**: Prisma client interactions, data import pipeline
- **Intelligence pipeline**: Cross-module data flow from ingestion to insight

### E2E Tests
- **Business journey** (`e2e-business-journey.test.ts`): Validates complete user workflows end-to-end
- **Phase 3 governance** (`phase3-e2e-governance.ts`): End-to-end governance compliance checks

### Security Tests
- **Auth blocking** (`security-auth-blocking.test.ts`): Unauthenticated requests return 401
- **CSRF protection** (`security-auth.test.ts`): Token validation, cookie handling
- **Input validation** (`security-phase4-critical-input-path.test.ts`): SQL injection, XSS, path traversal
- **Route access** (`security-admin-routes.test.ts`, `security-batch2-authenticated-access.test.ts`): Role-based access control
- **OTP security** (`security-verify-otp.test.ts`): OTP verification flow hardening
- **Hygiene** (`security-phase3b-hygiene.test.ts`): Headers, content-type enforcement

## 5. Writing New Tests

### Basic Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Module Name', () => {
  beforeEach(() => {
    // Reset mocks, clear state
    vi.clearAllMocks()
  })

  it('should do something expected', () => {
    // Arrange
    const input = { value: 42 }

    // Act
    const result = myFunction(input)

    // Assert
    expect(result).toEqual({ processed: true })
  })

  it('should return 400 when input is invalid', () => {
    const result = myFunction(null)
    expect(result.status).toBe(400)
  })
})
```

### Component Test Pattern

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyComponent from './MyComponent'

// Mock server-side modules
vi.mock('@/lib/db', () => ({ db: { /* ... */ } }))

describe('MyComponent', () => {
  it('should render the title', () => {
    render(<MyComponent title="Test" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('should call onSubmit when button is clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<MyComponent onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })
})
```

## 6. Mocking Patterns

### Prisma Client

```typescript
vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: '1', name: 'Test Co' }),
      create: vi.fn().mockResolvedValue({ id: '2', name: 'New Co' }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ _1: 1 }]),
  },
}))
```

### LLM / Fetch Calls

```typescript
vi.mock('@/lib/llm-client', () => ({
  callLLM: vi.fn().mockResolvedValue({
    content: 'Mocked LLM response',
    provider: 'mock',
    tokens: { input: 10, output: 20 },
  }),
}))

// Or mock the global fetch
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ result: 'mock' }),
}))
```

### Environment Variables

```typescript
import { vi } from 'vitest'

beforeEach(() => {
  vi.stubEnv('NVIDIA_API_KEY', 'test-nvidia-key')
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})
```

### NextAuth / Session

```typescript
vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { email: 'admin@test.com' },
    expires: '2099-01-01',
  }),
}))
```

## 7. Test Naming Convention

| Element | Convention | Example |
|---|---|---|
| **File name** | `{feature}.test.ts` or `{feature}-{specific}.test.ts` | `account-scoring.test.ts`, `security-auth-blocking.test.ts` |
| **Describe block** | Module or feature name | `describe('AccountScoringEngine', ...)` |
| **It block** | Behavior description starting with "should" | `it('should return zero score for company with no signals', ...)` |
| **Test file location** | `tests/` for integration/E2E, `src/**/__tests__/` for unit | — |
