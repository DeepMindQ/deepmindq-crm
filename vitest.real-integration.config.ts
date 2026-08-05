/**
 * Vitest Configuration — REAL INTEGRATION TESTS
 * M3 Stabilization — threads pool, single thread
 *
 * These tests use REAL database connections and REAL route handlers.
 * No mocking of Prisma or route handlers.
 *
 * Requirements:
 * - DATABASE_URL must be set (PostgreSQL)
 * - Database must have migrations applied
 * - Seed data must be present for read-based tests
 *
 * Usage: npx vitest run --config vitest.real-integration.config.ts
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'real-integration',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/real-integration/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/legacy/**',
      'tests/e2e/**',
      'tests/database/**',
    ],
    globals: true,
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    testTimeout: 30000,
    hookTimeout: 15000,
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
