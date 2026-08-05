/**
 * Vitest Configuration — UNIT
 * Phase 5.5 Enterprise Test Architecture
 *
 * Environment: node
 * Pool: forks
 * Memory: 1024
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
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 10000,
    poolOptions: {
      forks: {
        singleFork: true,
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
