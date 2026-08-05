/**
 * Vitest Configuration — Golden Dataset (Single File)
 * M3 Stabilization — threads pool, single thread
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'golden-dataset',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/ai/ai-golden-dataset.test.ts',
    ],
    globals: true,
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    testTimeout: 30000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
