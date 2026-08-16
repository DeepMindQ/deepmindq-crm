import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    passWithNoTests: true,
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
