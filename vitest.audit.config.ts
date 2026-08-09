/**
 * Vitest Configuration — AUDIT
 * Compliance audit tests (GDPR, encryption, access logging)
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'audit',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/audit/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/legacy/**',
    ],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
