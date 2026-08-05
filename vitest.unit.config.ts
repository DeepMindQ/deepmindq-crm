/**
 * Vitest Configuration — UNIT
 * M3 Stabilization — Deterministic, single-threaded execution
 *
 * Pool: threads (shared memory — avoids OOM from fork-based process duplication)
 * maxThreads: 1, minThreads: 1 — sequential for deterministic CI execution
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
    ],
    globals: true,
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
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
