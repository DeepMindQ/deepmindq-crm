/**
 * Vitest Configuration — PERFORMANCE
 * M3 Stabilization — threads pool, single thread
 *
 * Already using threads. Performance tests need controlled single-thread execution
 * for consistent benchmarking results.
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'performance',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/performance/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/legacy/**',
    ],
    globals: true,
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    testTimeout: 120000,
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
