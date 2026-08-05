/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Smoke test configuration — runs against deployed environments.
 *
 * Usage:
 *   SMOKE_TEST_URL=https://staging.deepmindq.com npx vitest run --config vitest.smoke.config.ts
 *   SMOKE_TEST_URL=https://deepmindq.com SMOKE_TEST_ENV=production npx vitest run --config vitest.smoke.config.ts
 *
 * Environment variables:
 *   SMOKE_TEST_URL  — Base URL of the deployed environment (required)
 *   SMOKE_TEST_ENV  — Environment name: "staging" or "production" (default: "staging")
 */
export default defineConfig({
  test: {
    include: ['tests/smoke/**/*.test.ts'],
    testTimeout: 15_000,       // 15s per test — smoke tests should be fast
    hookTimeout: 10_000,
    retry: 2,                  // Retry flaky network tests once
    pool: 'forks',
    globals: false,
    env: {
      SMOKE_TEST_URL: process.env.SMOKE_TEST_URL || 'http://localhost:3000',
      SMOKE_TEST_ENV: process.env.SMOKE_TEST_ENV || 'staging',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
