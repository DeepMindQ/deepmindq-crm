/**
 * Vitest Configuration — E2E
 * M5 Governance Hardening -- forks pool
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'e2e',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/e2e/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/legacy/**',
    ],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    teardownTimeout: 10000,
    testTimeout: 60000,
    hookTimeout: 10000,
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
