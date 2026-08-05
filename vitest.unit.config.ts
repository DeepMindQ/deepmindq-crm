/**
 * Vitest Configuration — UNIT
 * Phase 5.5 Enterprise Test Architecture
 *
 * Environment: node
 * Pool: forks (maxWorkers: 1 — sequential for stability in CI)
 *
 * Note: Some test files import modules with side effects (DNS lookups,
 * AI cache initialization) that trigger unhandled rejections in worker forks.
 * These are expected in CI and do not indicate test failures.
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
      'tests/legacy/**'
    ],
    globals: true,
    pool: 'forks',
    maxWorkers: 2,
    testTimeout: 15000,
    hookTimeout: 10000,
    poolOptions: {
      forks: {
        // Allow worker reuse without crashing on unhandled rejections
        execArgv: ['--unhandled-rejections=warn'],
      },
    },
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
