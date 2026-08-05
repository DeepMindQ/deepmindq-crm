/**
 * Vitest Configuration — UNIT
 * M4 Phase 2 — Switched from threads to forks (eliminates teardown crash)
 *
 * Pool: forks — avoids Vitest 4.x + Node 22.x/24.x worker teardown crash
 * that occurred with pool: 'threads' on large test suites (30+ files, 900+ tests).
 * See docs/VITEST_TEARDOWN_ANALYSIS.md for root cause details.
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/legacy/**',
      'tests/unit/sprint1-modules.test.ts',  // Imports removed module @/lib/intelligence-sources/adaptive-intelligence
    ],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: [
      'src/**/*.d.ts',
      'src/**/*.test.{ts,tsx}',
      'src/**/__tests__/**',
      'src/app/api/**/route.ts',
      'src/proxy.ts',
    ],
    thresholds: {
      statements: 30,
      branches: 20,
      functions: 30,
      lines: 30,
    },
  },
})
