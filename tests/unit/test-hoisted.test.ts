import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  console.log('HOISTED: env.USE_DB_PERSISTENCE =', process.env.USE_DB_PERSISTENCE);
  process.env.USE_DB_PERSISTENCE = 'true';
  console.log('HOISTED: after set, env.USE_DB_PERSISTENCE =', process.env.USE_DB_PERSISTENCE);
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { PERSISTENCE_FEATURE_FLAGS } from '@/lib/persistence/types';

describe('test', () => {
  it('checks env var', () => {
    console.log('TEST: PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE =', PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE);
    expect(PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE).toBe(true);
  });
});
