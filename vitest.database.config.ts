/**
 * Vitest Configuration — DATABASE
 * M5 Governance Hardening — forks pool, standardized timeouts
 *
 * Pool: forks — eliminates Vitest 4.x + Node 22.x worker teardown crash.
 * Single worker for stability with real DB connections.
 * Standardized: 30s test (DB ops), 15s hook, 10s teardown, 1 worker.
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'database',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/database/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/legacy/**',
    ],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 15000,
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
