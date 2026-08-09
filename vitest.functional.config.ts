/**
 * Vitest Configuration — FUNCTIONAL
 * Complete business flow tests (auth, CRUD, import/export, etc.)
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'functional',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/functional/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/legacy/**',
    ],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
