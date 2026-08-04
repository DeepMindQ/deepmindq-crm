/**
 * Vitest Configuration — AI Core
 * Phase 5.5 Enterprise Test Architecture
 *
 * Covers: Small/medium AI modules (inbox, health, connectors, confidence, etc.)
 * Environment: node | Pool: forks | Memory: 2048
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'ai',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      // Intelligence inbox & navigation
      'tests/ai/intelligence-inbox-ticket10.test.ts',
      'tests/ai/intelligence-inbox-navigation.test.ts',
      'tests/ai/intelligence-timeline.test.ts',
      'tests/ai/intelligence-health.test.ts',
      // Connectors & scheduling
      'tests/ai/connector-scheduler.test.ts',
      'tests/ai/csv-connector.test.ts',
      'tests/ai/job-queue.test.ts',
      // Confidence & signals
      'tests/ai/confidence-engine.test.ts',
      'tests/ai/ai-confidence.test.ts',
      'tests/ai/signal-patterns.test.ts',
      // Human intelligence & company resolution
      'tests/ai/human-intelligence.test.ts',
      'tests/ai/company-resolution.test.ts',
      // Knowledge & brief
      'tests/ai/knowledge-fabric.test.ts',
      'tests/ai/brief-generator.test.ts',
      'tests/ai/evidence-adapter.test.ts',
      // Learning & association
      'tests/ai/learning-loop.test.ts',
      'tests/ai/association-engine.test.ts',
      // Navigation & barrel
      'tests/ai/data-import-navigation.test.ts',
      'tests/ai/index.test.ts',
      'tests/ai/recommendation-generator.test.ts',
      'tests/ai/opportunity-radar.test.ts',
    ],
    exclude: ['tests/legacy/**'],
    globals: true,
    pool: 'forks',
    maxWorkers: 2,
    testTimeout: 20000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
