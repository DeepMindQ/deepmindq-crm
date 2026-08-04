/**
 * Vitest Configuration — AI Quality Testing
 * Milestone 3 Enterprise Validation Framework
 *
 * Covers: Hallucination detection, golden dataset validation,
 * confidence scoring, output quality, recommendation validation
 * Environment: node | Pool: forks | Memory: 4096MB
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'ai-quality',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/ai-testing/**/*.test.{ts,tsx}',
    ],
    exclude: ['tests/legacy/**'],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
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
