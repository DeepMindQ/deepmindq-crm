import { AsyncLocalStorage } from 'async_hooks';

/**
 * Per-request context stored in AsyncLocalStorage.
 * Automatically propagated through the async call chain.
 */
export interface RequestContext {
  /** Business-level correlation ID (propagated across services) */
  correlationId: string;
  /** Unique ID for this specific request */
  requestId: string;
  /** W3C trace ID (32 hex chars) from OTel or generated */
  traceId: string;
  /** Optional user ID for user-scoped logging */
  userId?: string;
  /** Optional route path for log grouping */
  route?: string;
  /** Request start time (Date.now()) for duration calculation */
  startTime: number;
}

/**
 * AsyncLocalStorage instance for per-request context.
 * All code within a request handler can access the context
 * via getRequestContext() without explicit parameter passing.
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context from AsyncLocalStorage.
 * Returns undefined if called outside of a request scope.
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Create a new request context with sensible defaults.
 * Partial overrides can be provided (e.g., when extracting
 * from incoming request headers).
 */
export function createRequestContext(partial?: Partial<RequestContext>): RequestContext {
  return {
    correlationId: partial?.correlationId || crypto.randomUUID(),
    requestId: partial?.requestId || crypto.randomUUID(),
    traceId: partial?.traceId || crypto.randomUUID().replace(/-/g, ''),
    startTime: partial?.startTime || Date.now(),
    ...partial,
  };
}

/**
 * Execute a function within a request context.
 * The context is automatically available to all async
 * callbacks called within `fn`.
 *
 * @example
 * ```ts
 * const ctx = createRequestContext({ correlationId: 'abc' });
 * await withRequestContext(ctx, async () => {
 *   // getRequestContext() returns ctx here
 *   logger.info('Processing request');
 * });
 * ```
 */
export function withRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return requestContextStorage.run(ctx, fn);
}

/**
 * Get the elapsed time in milliseconds since the request started.
 * Useful for logging request duration.
 */
export function getRequestDurationMs(): number {
  const ctx = getRequestContext();
  if (!ctx) return 0;
  return Date.now() - ctx.startTime;
}
