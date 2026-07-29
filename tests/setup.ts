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

// Silence console warnings in test output (optional — remove to debug)
// console.warn = () => {}
