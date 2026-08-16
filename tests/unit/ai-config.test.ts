/**
 * AI Configuration — Provider Chain Tests
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Must read module via dynamic import since it reads process.env at module level
const originalEnv = process.env;

describe('AI Configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getLLMChain', () => {
    it('returns null when no providers configured', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.LLM_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GEMINI_API_KEY;
      const { getLLMChain } = await import('@/lib/ai-config');
      expect(getLLMChain()).toBeNull();
    });

    it('returns OpenAI as first provider when OPENAI_API_KEY is set', async () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = getLLMChain();
      expect(chain).not.toBeNull();
      expect(chain![0]).toEqual({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
        label: 'OpenAI',
      });
    });

    it('falls back to LLM_API_KEY when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      process.env.LLM_API_KEY = 'sk-fallback';
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = getLLMChain();
      expect(chain).not.toBeNull();
      expect(chain![0].apiKey).toBe('sk-fallback');
      expect(chain![0].label).toBe('OpenAI');
    });

    it('supports custom OPENAI_BASE_URL', async () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.OPENAI_BASE_URL = 'https://azure.openai.com/custom';
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = getLLMChain();
      expect(chain![0].baseUrl).toBe('https://azure.openai.com/custom');
    });

    it('supports custom LLM_MODEL', async () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.LLM_MODEL = 'gpt-4-turbo';
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = getLLMChain();
      expect(chain![0].model).toBe('gpt-4-turbo');
    });

    it('adds Anthropic as second provider', async () => {
      process.env.OPENAI_API_KEY = 'sk-openai';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = getLLMChain();
      expect(chain!.length).toBe(2);
      expect(chain![1]).toEqual({
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: 'sk-ant-test',
        model: 'claude-3-5-sonnet-20241022',
        label: 'Anthropic',
      });
    });

    it('supports custom ANTHROPIC_MODEL', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant';
      process.env.ANTHROPIC_MODEL = 'claude-3-opus';
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = getLLMChain();
      expect(chain![0].model).toBe('claude-3-opus');
    });

    it('adds Gemini as third provider', async () => {
      process.env.OPENAI_API_KEY = 'sk-openai';
      process.env.GEMINI_API_KEY = 'gem-test';
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = getLLMChain();
      expect(chain!.length).toBe(2);
      expect(chain![1]).toEqual({
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: 'gem-test',
        model: 'gemini-2.0-flash',
        label: 'Gemini',
      });
    });

    it('supports custom GEMINI_MODEL', async () => {
      process.env.GEMINI_API_KEY = 'gem';
      process.env.GEMINI_MODEL = 'gemini-1.5-pro';
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = getLLMChain();
      expect(chain![0].model).toBe('gemini-1.5-pro');
    });

    it('OPENAI_API_KEY takes priority over LLM_API_KEY', async () => {
      process.env.OPENAI_API_KEY = 'sk-openai';
      process.env.LLM_API_KEY = 'sk-llm';
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = getLLMChain();
      expect(chain![0].apiKey).toBe('sk-openai');
    });

    it('returns all 3 providers when all keys are set', async () => {
      process.env.OPENAI_API_KEY = 'sk-o';
      process.env.ANTHROPIC_API_KEY = 'sk-a';
      process.env.GEMINI_API_KEY = 'sk-g';
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = getLLMChain();
      expect(chain!.length).toBe(3);
      expect(chain![0].label).toBe('OpenAI');
      expect(chain![1].label).toBe('Anthropic');
      expect(chain![2].label).toBe('Gemini');
    });
  });

  describe('getSearchProvider', () => {
    it('returns "none" when no TAVILY_API_KEY', async () => {
      delete process.env.TAVILY_API_KEY;
      const { getSearchProvider } = await import('@/lib/ai-config');
      expect(getSearchProvider()).toBe('none');
    });

    it('returns Tavily config when key is set', async () => {
      process.env.TAVILY_API_KEY = 'tvly-test';
      const { getSearchProvider } = await import('@/lib/ai-config');
      expect(getSearchProvider()).toEqual({
        apiKey: 'tvly-test',
        provider: 'tavily',
      });
    });
  });
});
