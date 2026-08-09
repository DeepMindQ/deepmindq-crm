/**
 * Vitest Configuration — Accessibility Audit
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'a11y',
    environment: 'node',
    include: ['tests/accessibility/wcag-compliance-audit.ts'],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
