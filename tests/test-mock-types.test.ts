import { describe, it, expect, vi } from 'vitest';

const originalModule = await import('@/lib/persistence/types');
const originalFlags = { ...originalModule.PERSISTENCE_FEATURE_FLAGS };

vi.mock('@/lib/persistence/types', async () => {
  const actual = await vi.importActual('@/lib/persistence/types');
  return {
    ...actual,
    PERSISTENCE_FEATURE_FLAGS: {
      ...actual.PERSISTENCE_FEATURE_FLAGS,
      USE_DB_PERSISTENCE: true,
    },
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { PERSISTENCE_FEATURE_FLAGS } from '@/lib/persistence/types';

describe('test', () => {
  it('checks mocked flag', () => {
    console.log('TEST: PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE =', PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE);
    expect(PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE).toBe(true);
  });
});
