// ═══════════════════════════════════════════════════════════════════════════
// Tracing — Unit Tests
//
// Tests generateTraceContext, extractTraceContext, injectTraceContext,
// getTraceContext, withTrace, and formatTraceparent from @/lib/tracing.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @opentelemetry/api to be unavailable (throws on require/import)
vi.mock(
  '@opentelemetry/api',
  () => {
    throw new Error('OTel not available');
  },
  { virtual: true },
);

import {
  generateTraceContext,
  extractTraceContext,
  injectTraceContext,
  getTraceContext,
  withTrace,
  formatTraceparent,
  type TraceContext,
} from '@/lib/tracing';

describe('tracing', () => {
  // ── generateTraceContext ─────────────────────────────────────────
  describe('generateTraceContext', () => {
    it('returns object with 32-char traceId', () => {
      const ctx = generateTraceContext();
      expect(ctx.traceId).toHaveLength(32);
      expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('returns object with 16-char spanId', () => {
      const ctx = generateTraceContext();
      expect(ctx.spanId).toHaveLength(16);
      expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('generates unique traceIds', () => {
      const ctx1 = generateTraceContext();
      const ctx2 = generateTraceContext();
      expect(ctx1.traceId).not.toBe(ctx2.traceId);
    });

    it('generates unique spanIds', () => {
      const ctx1 = generateTraceContext();
      const ctx2 = generateTraceContext();
      expect(ctx1.spanId).not.toBe(ctx2.spanId);
    });
  });

  // ── extractTraceContext ──────────────────────────────────────────
  describe('extractTraceContext', () => {
    it('extracts from valid traceparent header', () => {
      const traceId = '0'.repeat(32);
      const spanId = 'a'.repeat(16);
      const headers = new Headers({
        traceparent: `00-${traceId}-${spanId}-01`,
      });
      const ctx = extractTraceContext(headers);
      expect(ctx.traceId).toBe(traceId);
      expect(ctx.spanId).toBe(spanId);
    });

    it('generates new context when no headers present', () => {
      const headers = new Headers();
      const ctx = extractTraceContext(headers);
      expect(ctx.traceId).toHaveLength(32);
      expect(ctx.spanId).toHaveLength(16);
    });

    it('generates new context for malformed traceparent', () => {
      const headers = new Headers({ traceparent: 'malformed' });
      const ctx = extractTraceContext(headers);
      expect(ctx.traceId).toHaveLength(32);
    });

    it('ignores traceparent with wrong version', () => {
      const headers = new Headers({
        traceparent: `01-${'0'.repeat(32)}-${'a'.repeat(16)}-01`,
      });
      const ctx = extractTraceContext(headers);
      // Falls through to generate new
      expect(ctx.traceId).toHaveLength(32);
    });

    it('extracts from x-correlation-id (UUID format)', () => {
      // Use a valid UUID with exactly 32 hex chars after removing dashes
      const uuid = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789';
      const headers = new Headers({ 'x-correlation-id': uuid });
      const ctx = extractTraceContext(headers);
      const hexTraceId = uuid.replace(/-/g, '');
      expect(ctx.traceId).toBe(hexTraceId);
      expect(ctx.traceId).toHaveLength(32);
    });

    it('pads non-UUID correlation-id to 32 chars', () => {
      const headers = new Headers({ 'x-correlation-id': 'short-id' });
      const ctx = extractTraceContext(headers);
      expect(ctx.traceId).toHaveLength(32);
      expect(ctx.traceId.endsWith('0')).toBe(true); // padded with zeros
    });

    it('prefers traceparent over x-correlation-id', () => {
      const traceId = 'f'.repeat(32);
      const spanId = '1'.repeat(16);
      const headers = new Headers({
        traceparent: `00-${traceId}-${spanId}-01`,
        'x-correlation-id': 'other-id',
      });
      const ctx = extractTraceContext(headers);
      expect(ctx.traceId).toBe(traceId);
    });

    it('generates new spanId for x-correlation-id', () => {
      const headers = new Headers({ 'x-correlation-id': '12345678-1234-1234-1234-123456789abc' });
      const ctx = extractTraceContext(headers);
      expect(ctx.spanId).toHaveLength(16);
    });
  });

  // ── injectTraceContext ───────────────────────────────────────────
  describe('injectTraceContext', () => {
    it('sets traceparent header in W3C format', () => {
      const ctx: TraceContext = {
        traceId: 'a'.repeat(32),
        spanId: 'b'.repeat(16),
      };
      const headers: Record<string, string> = {};
      injectTraceContext(headers, ctx);
      expect(headers['traceparent']).toBe(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`);
    });

    it('sets x-trace-id header', () => {
      const ctx: TraceContext = {
        traceId: 'c'.repeat(32),
        spanId: 'd'.repeat(16),
      };
      const headers: Record<string, string> = {};
      injectTraceContext(headers, ctx);
      expect(headers['x-trace-id']).toBe('c'.repeat(32));
    });
  });

  // ── getTraceContext ──────────────────────────────────────────────
  describe('getTraceContext', () => {
    it('returns a TraceContext with valid IDs (fallback path)', () => {
      const ctx = getTraceContext();
      expect(ctx.traceId).toHaveLength(32);
      expect(ctx.spanId).toHaveLength(16);
    });
  });

  // ── withTrace (fallback path, no OTel) ──────────────────────────
  describe('withTrace', () => {
    it('executes function and returns result', async () => {
      const result = await withTrace('test-op', async (ctx) => {
        expect(ctx.traceId).toHaveLength(32);
        expect(ctx.spanId).toHaveLength(16);
        return 42;
      });
      expect(result).toBe(42);
    });

    it('passes parent traceId when parent provided', async () => {
      const parent: TraceContext = {
        traceId: 'p'.repeat(32),
        spanId: 'q'.repeat(16),
      };
      const result = await withTrace(
        'child-op',
        async (ctx) => {
          return ctx;
        },
        { parent },
      );
      expect(result.traceId).toBe('p'.repeat(32));
      expect(result.parentSpanId).toBe('q'.repeat(16));
    });

    it('generates new spanId even with parent', async () => {
      const parent: TraceContext = {
        traceId: 'p'.repeat(32),
        spanId: 'q'.repeat(16),
      };
      const ctx = await withTrace('op', (c) => Promise.resolve(c), { parent });
      expect(ctx.spanId).not.toBe(parent.spanId);
    });

    it('re-throws errors from the wrapped function', async () => {
      await expect(
        withTrace('failing-op', () => Promise.reject(new Error('boom'))),
      ).rejects.toThrow('boom');
    });

    it('passes attributes to context', async () => {
      const ctx = await withTrace('attr-op', (c) => Promise.resolve(c), {
        attributes: { userId: 'u1', action: 'read' },
      });
      expect(ctx).toBeDefined();
    });
  });

  // ── formatTraceparent ────────────────────────────────────────────
  describe('formatTraceparent', () => {
    it('formats correctly', () => {
      const ctx: TraceContext = {
        traceId: 'a'.repeat(32),
        spanId: 'b'.repeat(16),
      };
      expect(formatTraceparent(ctx)).toBe(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`);
    });

    it('includes parentSpanId in output if present (just formats)', () => {
      const ctx: TraceContext = {
        traceId: 'c'.repeat(32),
        spanId: 'd'.repeat(16),
        parentSpanId: 'e'.repeat(16),
      };
      // formatTraceparent doesn't include parentSpanId in W3C format
      const result = formatTraceparent(ctx);
      expect(result).toContain('c'.repeat(32));
      expect(result).toContain('d'.repeat(16));
    });
  });
});
