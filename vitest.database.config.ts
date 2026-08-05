/**
 * Vitest Configuration — DATABASE
 * M3 Stabilization — threads pool, single thread
 *
 * Already using threads. Kept at single worker for stability with real DB.
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
