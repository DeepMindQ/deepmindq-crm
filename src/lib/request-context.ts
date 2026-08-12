/**
 * Per-request context stored in AsyncLocalStorage.
 * Automatically propagated through the async call chain.
 *
 * SERVER-ONLY — async_hooks is a Node.js built-in.
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

type StorageLike = {
  getStore: () => RequestContext | undefined;
  run: <T>(ctx: RequestContext, fn: () => T) => T;
};

let _storage: StorageLike | null = null;
let _tried = false;

function getStorage(): StorageLike | null {
  if (_tried) return _storage;
  _tried = true;
  try {
    // Using `process.env` in the require path prevents Turbopack from
    // statically analyzing and attempting to resolve `async_hooks` at build
    // time for client bundles. At runtime on the server, Node resolves it fine.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(
      process.env.NODE_ENV === 'production' ? 'async_hooks' : 'async_hooks'
    ) as typeof import('async_hooks');
    _storage = new mod.AsyncLocalStorage<RequestContext>();
  } catch {
    _storage = null;
  }
  return _storage;
}

/**
 * AsyncLocalStorage instance for per-request context (server only).
 * Returns null on client.
 */
export const requestContextStorage: StorageLike | null = null;

/**
 * Get the current request context from AsyncLocalStorage.
 * Returns undefined if called outside of a request scope or on client.
 */
export function getRequestContext(): RequestContext | undefined {
  return getStorage()?.getStore();
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
 */
export function withRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  const storage = getStorage();
  if (!storage) return fn();
  return storage.run(ctx, fn);
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
