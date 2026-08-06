import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

describe('minimal', () => {
  it('should import', async () => {
    const mod = await import('@/lib/ai-hallucination-prevention');
    expect(mod).toBeDefined();
  });
});
