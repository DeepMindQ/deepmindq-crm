/**
 * @vitest-environment node
 * Tests for src/lib/fetchApi.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock document.cookie for CSRF token tests
declare const document: { cookie: string };
vi.stubGlobal('document', { cookie: '' });

import { fetchApi } from '@/lib/fetchApi';

describe('fetchApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.cookie = '';
  });

  it('returns data on successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 1, name: 'Test' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await fetchApi('/api/test');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 1, name: 'Test' });
  });

  it('unwraps { data: ... } envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [1, 2, 3] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await fetchApi('/api/items');
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('returns body directly when no data envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [1, 2] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await fetchApi('/api/items');
    expect(result.data).toEqual({ items: [1, 2] });
  });

  it('returns error on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await fetchApi('/api/missing');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Not found');
  });

  it('returns default error message when non-ok body has no error field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'something' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await fetchApi('/api/fail');
    expect(result.error).toContain('500');
  });

  it('handles 401 with isUnauthorized flag', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await fetchApi('/api/protected');
    expect(result.data).toBeNull();
    expect(result.isUnauthorized).toBe(true);
    expect(result.error).toBe('Session expired');
  });

  it('handles 401 with default message when body parse fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not json', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );
    const result = await fetchApi('/api/protected');
    expect(result.isUnauthorized).toBe(true);
    expect(result.error).toContain('log in again');
  });

  it('handles 429 with rate limit message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Too Many Requests', {
        status: 429,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );
    const result = await fetchApi('/api/limited');
    expect(result.error).toContain('Too many requests');
    expect(result.error).not.toContain('Retry-After');
  });

  it('includes Retry-After header in 429 error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', {
        status: 429,
        headers: { 'Retry-After': '60' },
      }),
    );
    const result = await fetchApi('/api/limited');
    expect(result.error).toContain('Retry-After: 60');
  });

  it('handles network errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await fetchApi('/api/down');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Failed to fetch');
  });

  it('retries on network error when retry is set', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('fail'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const result = await fetchApi('/api/flaky', { retry: 1 });
    expect(result.data).toBe('ok');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries and returns last error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('always fail'));
    const result = await fetchApi('/api/broken', { retry: 2 });
    expect(result.data).toBeNull();
    expect(result.error).toBe('always fail');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('appends query params to URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await fetchApi('/api/search', { params: { q: 'test', page: 1 } });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('q=test'), expect.any(Object));
  });

  it('skips undefined/null/empty params', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await fetchApi('/api/search', {
      params: { q: 'hello', page: undefined, empty: '', nil: null as any },
    });
    const calledUrl = (fetch as any).mock.calls[0][0];
    expect(calledUrl).not.toContain('page=');
    expect(calledUrl).not.toContain('empty=');
    expect(calledUrl).not.toContain('nil=');
    expect(calledUrl).toContain('q=hello');
  });

  it('uses & separator when URL already has query string', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await fetchApi('/api/search?existing=1', { params: { q: 'test' } });
    const calledUrl = (fetch as any).mock.calls[0][0];
    expect(calledUrl).toContain('existing=1&q=test');
  });

  it('sends credentials: include', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await fetchApi('/api/test');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('adds CSRF token for POST requests', async () => {
    document.cookie = 'csrf-token=my-csrf-value';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await fetchApi('/api/action', { method: 'POST' });
    const opts = (fetch as any).mock.calls[0][1];
    expect(opts.headers.get('x-csrf-token')).toBe('my-csrf-value');
  });

  it('does not add CSRF token for GET requests', async () => {
    document.cookie = 'csrf-token=my-csrf-value';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await fetchApi('/api/data', { method: 'GET' });
    const opts = (fetch as any).mock.calls[0][1];
    expect(opts.headers.get('x-csrf-token')).toBeNull();
  });

  it('does not add CSRF token for HEAD requests', async () => {
    document.cookie = 'csrf-token=my-csrf-value';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await fetchApi('/api/data', { method: 'HEAD' });
    const opts = (fetch as any).mock.calls[0][1];
    expect(opts.headers.get('x-csrf-token')).toBeNull();
  });

  it('does not add CSRF token for OPTIONS requests', async () => {
    document.cookie = 'csrf-token=my-csrf-value';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 200, statusText: 'OK' }),
    );
    await fetchApi('/api/data', { method: 'OPTIONS' });
    const opts = (fetch as any).mock.calls[0][1];
    expect(opts.headers.get('x-csrf-token')).toBeNull();
  });

  it('does not add CSRF token when cookie is absent', async () => {
    document.cookie = 'other-cookie=value';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await fetchApi('/api/action', { method: 'DELETE' });
    const opts = (fetch as any).mock.calls[0][1];
    expect(opts.headers.get('x-csrf-token')).toBeNull();
  });

  it('handles non-Error thrown objects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce('string error');
    const result = await fetchApi('/api/fail');
    expect(result.error).toBe('Network error');
  });
});
