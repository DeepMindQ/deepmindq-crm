/**
 * Vitest Configuration — AI Core
 * M3 Stabilization — threads pool, single thread
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'ai',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/ai/intelligence-inbox-ticket10.test.ts',
      'tests/ai/intelligence-inbox-navigation.test.ts',
      'tests/ai/intelligence-timeline.test.ts',
      'tests/ai/intelligence-health.test.ts',
      'tests/ai/connector-scheduler.test.ts',
      'tests/ai/csv-connector.test.ts',
      'tests/ai/job-queue.test.ts',
      'tests/ai/confidence-engine.test.ts',
      'tests/ai/ai-confidence.test.ts',
      'tests/ai/signal-patterns.test.ts',
      'tests/ai/human-intelligence.test.ts',
      'tests/ai/company-resolution.test.ts',
      'tests/ai/knowledge-fabric.test.ts',
      'tests/ai/brief-generator.test.ts',
      'tests/ai/evidence-adapter.test.ts',
      'tests/ai/learning-loop.test.ts',
      'tests/ai/association-engine.test.ts',
      'tests/ai/data-import-navigation.test.ts',
      'tests/ai/index.test.ts',
      'tests/ai/recommendation-generator.test.ts',
      'tests/ai/opportunity-radar.test.ts',
    ],
    exclude: ['tests/legacy/**'],
    globals: true,
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    testTimeout: 20000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
