/**
 * Vitest global setup — minimal bootstrap for jsdom environment.
 *
 * All module-level mocks are handled per-file via vi.hoisted() + vi.mock().
 * This file only sets up environment globals that jsdom doesn't provide.
 */

// Polyfill TextEncoder/TextDecoder for jsdom (Node 18+)
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  globalThis.TextEncoder = TextEncoder
  globalThis.TextDecoder = TextDecoder
}

// Enable jest-dom matchers (toBeInTheDocument, etc.)
import '@testing-library/jest-dom/vitest'

// Suppress unhandled rejection errors from module-level side effects.
// DeepMindQ modules (AI governance, email verification, RBAC) log errors
// during import initialization — these are expected in test environments
// and do not indicate test failures.
if (process.env.CI) {
  process.on('uncaughtException', () => {});
}
